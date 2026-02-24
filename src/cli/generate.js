import 'dotenv/config'; 
import fs from "fs";
import path from "path";
import pLimit from "p-limit"; 

import { log } from "../utils/logger.js";
import { makeProblemId } from "../utils/idMaker.js";

import { loadCsvRows } from "../loaders/readCsv.js";
import { normalizeCsvRowToProblem, ensureExecutionFieldsExist } from "../normalizer/normalizeRow.js";

import { detectTopic } from "../classifier/topicClassifier.js";
import { detectBloom } from "../classifier/bloomClassifier.js";

import { makeBeatId } from "../narrative/beatMaker.js";
import { makeLanguageVariants } from "../narrative/variantMaker.js";
import { refineVariant } from "../refinement/refinerEngine.js"; 

import { pickLearnProblems } from "../selector/learnSelector.js";
import { pickChallengeHardPhase } from "../selector/challengeSelector.js";

import {
  loadUsageRegistry,
  saveUsageRegistry,
  getLearnUsedSet,
  getChallengeUsedSet,
  addLearnUsed,
  addChallengeUsed,
  resetRegistryAll,
  resetRegistryLearnOnly,
  resetRegistryChallengesOnly
} from "../registry/usageRegistry.js";

import { validateOutputRecord } from "../validator/outputValidator.js";
import { diff } from 'util';


function getSetting(short, long, envKey, fallback = null) {
  const longIdx = process.argv.indexOf(`--${long}`);
  if (longIdx !== -1 && process.argv[longIdx + 1] && !process.argv[longIdx + 1].startsWith("-")) {
    return process.argv[longIdx + 1];
  }
  const shortIdx = process.argv.indexOf(`-${short}`);
  if (shortIdx !== -1 && process.argv[shortIdx + 1] && !process.argv[shortIdx + 1].startsWith("-")) {
    return process.argv[shortIdx + 1];
  }
  if (envKey && process.env[envKey]) {
    return process.env[envKey];
  }
  return fallback;
}

function hasFlag(short, long) {
  return process.argv.includes(`--${long}`) || process.argv.includes(`-${short}`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function mustExist(filePath, label) {
  if (!fs.existsSync(filePath)) throw new Error(`${label} not found: ${filePath}`);
}

function toNumberOrFallback(value, fallbackNumber) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallbackNumber;
}

async function main() {
  const dataset = getSetting("d", "dataset", "DEFAULT_DATASET", "datasetA");
  const mode = getSetting("m", "mode", "DEFAULT_MODE"); 
  const phase = toNumberOrFallback(getSetting("p", "phase", null, "1"), 1);

  const diffculty = getSetting("diff", "difficulty", null, "Medium");
  const count = toNumberOrFallback(getSetting("c", "count", null, "5"), 5);
  
  // Check for AI flags
  const useAi = process.argv.includes("--ai") || process.argv.includes("--ai-refine");

  // Limit concurrency to 1 to strictly control the rate.
  const limit = pLimit(1); 
  // Safety delay in milliseconds (2000ms = 2 seconds).
  // 30 Requests Per Minute max = 1 request every 2 seconds.
  const RATE_LIMIT_DELAY = 2000; 

  const defaultInput = `data/input/${dataset}.csv`;
  const input = getSetting("i", "input", null, defaultInput);

  const resetAll = hasFlag("R", "reset-registry");
  const resetLearnOnly = hasFlag("rl", "reset-learn-only");
  const resetChallengesOnly = hasFlag("rc", "reset-challenges-only");

  if (!dataset || !input || !mode) {
    log.error(
      "Usage: npm run generate -- -m <learn|challenge> [options]\n" +
      "Options:\n" +
      "  -d, --dataset <name>\n" +
      "  -i, --input <path>\n" +
      "  -p, --phase <N>\n" +
      " --difficulty <Easy|Medium|Hard> (Learn: isolate by diffulty)\n" +
      " --c, --count <N>                (Learn: override question count)\n" +
      "  --ai, --ai-refine       (Enable AI Refinement)\n" +
      "Reset Flags:\n" +
      "  -R,  --reset-registry\n" +
      "  -rl, --reset-learn-only\n" +
      "  -rc, --reset-challenges-only"
    );
    process.exit(1);
  }

  const mappingPath = path.join("config", "dataset_mappings", `${dataset}.json`);
  const rulesPath = path.join("config", "selection_rules.json");
  const storiesPath = path.join("config", "stories.json");
  const registryPath = path.join("data", "registry", "usage_registry.json");

  mustExist(mappingPath, "Dataset mapping");
  mustExist(rulesPath, "Selection rules");
  mustExist(storiesPath, "Stories config");
  mustExist(input, "Input CSV");
  mustExist(registryPath, "Usage registry");

  const mappingConfig = readJson(mappingPath);
  const rules = readJson(rulesPath);
  const stories = readJson(storiesPath);

  const { rows } = await loadCsvRows(input);
  log.info(`Loaded ${rows.length} rows from ${input}`);

  // Normalization
  const normalizedProblems = [];
  for (let i = 0; i < rows.length; i++) {
    try {
      const p = normalizeCsvRowToProblem(rows[i], mappingConfig);
      if (p.isPremium) continue;
      ensureExecutionFieldsExist(p);
      const sourceIdNumber = toNumberOrFallback(p.source.source_question_id, i + 1);
      const problemId = makeProblemId(sourceIdNumber);
      normalizedProblems.push({ ...p, problemId });
    } catch (e) {
      if (mappingConfig.strict) {
        throw new Error(`Row ${i + 1} failed: ${e.message}`);
      } else {
        log.warn(`Skipping row ${i + 1}: ${e.message}`);
      }
    }
  }

  if (!normalizedProblems.length) {
    throw new Error("No usable problems found after normalization.");
  }

  // Enrichment
  const enrichedProblems = normalizedProblems.map((p) => {
    const combinedText = `${p.original.title}\n${p.original.description}`;
    const topic = detectTopic(combinedText);
    const bloom = detectBloom(combinedText, p.difficulty);
    const beatId = makeBeatId(bloom.score);
    return { ...p, topic, bloom, beatId };
  });

  // Registry Management
  const registry = loadUsageRegistry(registryPath);

  if (resetAll) {
    resetRegistryAll(registry);
    saveUsageRegistry(registryPath, registry);
    log.warn("Registry reset: ALL cleared.");
  } else {
    if (resetLearnOnly) {
      resetRegistryLearnOnly(registry);
      saveUsageRegistry(registryPath, registry);
      log.warn("Registry reset: LEARN cleared.");
    }
    if (resetChallengesOnly) {
      resetRegistryChallengesOnly(registry);
      saveUsageRegistry(registryPath, registry);
      log.warn("Registry reset: CHALLENGES cleared.");
    }
  }

  const learnUsedSet = getLearnUsedSet(registry);
  const challengeUsedSet = getChallengeUsedSet(registry);

  const languages = rules.languages;
  const languageToStory = stories.languageToStory;
  const defaultStory = stories.defaultStory;
  const chapterId = stories.defaultChapterId;

  //PROGRESS TRACKER HELPER 
  let processedCount = 0;
  const totalCount = (problems) => problems.length * languages.length;

  // LEARN MODE
  if (mode === "learn") {
  const availableForLearn = enrichedProblems.filter(p => !learnUsedSet.has(p.problemId));

  let countsPerDifficulty;

  if (diffculty) {
    const normalizedDifficulty = diffculty.charAt(0).toUpperCase() + diffculty.slice(1).toLowerCase();
    const validDifficulties = ["Easy", "Medium", "Hard"];

    if (!validDifficulties.includes(normalizedDifficulty)) {
      throw new Error(`Invalid --difficulty value '${diffculty}'. Must be Easy, Medium, or Hard.`);
    }

    const resolvedCount = count ?? rules.learn.countsPerDifficulty[normalizedDifficulty];

    if (!resolvedCount) {
      throw new Error(
        `No count found for difficulty '${normalizedDifficulty}'. ` +
        `Either pass --count or ensure it exists in selection_rules.json.`
      );
    }

    countsPerDifficulty = { [normalizedDifficulty]: resolvedCount };
    log.info(`[Learn Mode] Isolated batch — Difficulty: ${normalizedDifficulty}, Count: ${resolvedCount}`);
  } else {
    countsPerDifficulty = rules.learn.countsPerDifficulty;
  }

  const { selected, meta } = pickLearnProblems({
    allProblems: availableForLearn,
    countsPerDifficulty
  });

  addLearnUsed(registry, selected.map(p => p.problemId));
  saveUsageRegistry(registryPath, registry);

  log.info(`[Learn Mode] Selected ${selected.length} problems. Starting AI Refinement...`);

  const outputItems = [];
  let processedVariants = 0;

  for (const p of selected) {
    const variants = makeLanguageVariants({
      problemId: p.problemId,
      languages,
      languageToStory,
      defaultStory,
      mode: "learn",
      topic: p.topic,
      original: p.original
    });

    // Refine variants sequentially with proper rate limiting
    const refinedVariants = [];
    
    for (const v of variants) {
      // WAIT BEFORE making the request (proper rate limiting)
      if (useAi && processedVariants > 0) {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
      }
      
      const refined = await refineVariant(v, {
        difficulty: p.difficulty,
        topic: p.topic,
        bloom: p.bloom,
        skipAi: !useAi
      });
      
      refinedVariants.push({ ...v, narrative: refined });
      
      if (useAi) {
        processedVariants++;
        if (processedVariants % 5 === 0) {
          log.info(`[Progress] Refined ${processedVariants} variants...`);
        }
      }
    }

    const record = {
      problemId: p.problemId,
      source: p.source,
      original: p.original,
      difficulty: p.difficulty,
      topic: p.topic,
      bloom: p.bloom,
      story: { chapterId, beatId: p.beatId },
      examples: p.examples,
      constraints: p.constraints,
      test_cases: p.test_cases,
      variants: refinedVariants
    };

    validateOutputRecord(record);
    outputItems.push(record);
  }

  const difficultyTag = diffculty ? `_${diffculty.toLowerCase()}`: "";
  const outPath = path.join("data", "output", `learn_programming${difficultyTag}.json`);

  writeJson(outPath, {
    meta: { 
      dataset, 
      mode: "learn", 
      generatedAt: new Date().toISOString(), 
      selection: meta, 
      aiRefined: useAi,
      totalVariantsProcessed: processedVariants
    },
    items: outputItems
  });

  log.info(`✅ Wrote Learn output: ${outPath} (AI Refinement: ${useAi ? "ON" : "OFF"})`);
  return;
}

// CHALLENGE MODE
if (mode === "challenge") {
  const challengeEligibleProblems = enrichedProblems.filter(p => p.difficulty === "Hard" || p.difficulty === "Medium");

  const { selected, meta } = pickChallengeHardPhase({
    eligbibleProblems: challengeEligibleProblems,
    learnUsedSet,
    challengeUsedSet,
    phaseSize: rules.challenge.phaseSize
  });

  const newUniqueIds = selected
    .filter(p => !challengeUsedSet.has(p.problemId) && !learnUsedSet.has(p.problemId))
    .map(p => p.problemId);

  addChallengeUsedHard(registry, newUniqueIds, phase);
  saveUsageRegistry(registryPath, registry);

  log.info(`[Challenge Mode] Selected ${selected.length} problems. Starting AI Refinement...`);

  const outputItems = [];
  let processedVariants = 0;

  for (const p of selected) {
    const variants = makeLanguageVariants({
      problemId: p.problemId,
      languages,
      languageToStory,
      defaultStory,
      mode: "challenge",
      topic: p.topic,
      original: p.original
    });

    // Refine variants sequentially with proper rate limiting
    const refinedVariants = [];
    
    for (const v of variants) {
      // WAIT BEFORE making the request (proper rate limiting)
      if (useAi && processedVariants > 0) {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
      }
      
      const refined = await refineVariant(v, {
        difficulty: p.difficulty,
        topic: p.topic,
        bloom: p.bloom,
        skipAi: !useAi
      });
      
      refinedVariants.push({ ...v, narrative: refined });
      
      if (useAi) {
        processedVariants++;
        if (processedVariants % 5 === 0) {
          log.info(`[Progress] Refined ${processedVariants} variants...`);
        }
      }
    }

    const record = {
      problemId: p.problemId,
      source: p.source,
      original: p.original,
      difficulty: p.difficulty,
      topic: p.topic,
      bloom: p.bloom,
      beatId: null,
      examples: p.examples,
      constraints: p.constraints,
      test_cases: p.test_cases,
      variants: refinedVariants
    };

    validateOutputRecord(record);
    outputItems.push(record);
  }

  const outPath = path.join("data", "output", `challenges_phase_${phase}.json`);
  writeJson(outPath, {
    meta: { 
      dataset, 
      mode: "challenge", 
      phase, 
      generatedAt: new Date().toISOString(), 
      ...meta, 
      aiRefined: useAi,
      totalVariantsProcessed: processedVariants
    },
    items: outputItems
  });

  log.info(`✅ Wrote Challenge output: ${outPath} (AI Refinement: ${useAi ? "ON" : "OFF"})`);
  return;
}

  throw new Error(`Unknown mode '${mode}'. Use learn or challenge.`);
}

main().catch((e) => {
  log.error(e.message);
  process.exit(1);
});