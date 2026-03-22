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
import { cleanVariantNarrative } from "../narrative/narrativeCleaner.js";
import { refineVariant } from "../refinement/refinerEngine.js"; 
import { generateTestCases } from "../refinement/testCaseGenerator.js";
import { generateStarterCode } from "../refinement/starterCodeGenerator.js";

import { pickLearnProblems } from "../selector/learnSelector.js";
import { pickChallengePhase } from "../selector/challengeSelector.js";

import { uploadAllFromDirectory } from '../uploader/uploadFromJson.js';

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

  const difficulty = getSetting("diff", "difficulty", null, null);
  const countRaw = getSetting("c", "count", null, null);
  const count = countRaw !== null ? toNumberOrFallback(countRaw, null) : null;

  const language = getSetting("lang", "language", null, null);
  const clearOutputs = getSetting("clr", "clear-outputs", null, null);

  // ── Topic flag: single-question generation by topic ──
  const topicFilter = getSetting("t", "topic", null, null);

  // Check for AI flags
  const useAi = process.argv.includes("-ai") || process.argv.includes("--ai") || process.argv.includes("--ai-refine");
  const skipAi = !useAi;

  const shouldUpload = hasFlag("u", "upload");

  const limit = pLimit(1); 
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
      "  -d, --dataset <n>\n" +
      "  -i, --input <path>\n" +
      "  -p, --phase <N>\n" +
      "  -diff, --difficulty <Easy|Medium|Hard> (Learn: isolate by difficulty)\n" +
      "  -c, --count <N>                (Learn: override question count)\n" +
      "  -t, --topic <topic>            (Generate a single question for a specific topic)\n" +
      "  -lang, --language <lang>       (Override language selection)\n" +
      "  -ai, --ai-refine              (Enable AI Refinement + test case + starter code generation)\n" +
      "Reset Flags:\n" +
      "  -R,  --reset-registry\n" +
      "  -rl, --reset-learn-only\n" +
      "  -rc, --reset-challenges-only\n" + 
      "Output Flags:\n" + 
      "  -clr, --clear-outputs <type>   Types: all, learn, learn:easy, learn:medium, learn:hard, challenge, challenge:phase<N>\n" +
      "\nAvailable topics: arrays, strings, trees, graphs, dp, hashmap, stack_queue, sorting_searching, general"
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
      ensureExecutionFieldsExist(p, { allowAiFallback: useAi });
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
    process.exit(0);
  } else {
    if (resetLearnOnly) {
      resetRegistryLearnOnly(registry);
      saveUsageRegistry(registryPath, registry);
      log.warn("Registry reset: LEARN cleared.");
      process.exit(0);
    }
    if (resetChallengesOnly) {
      resetRegistryChallengesOnly(registry);
      saveUsageRegistry(registryPath, registry);
      log.warn("Registry reset: CHALLENGES cleared.");
      process.exit(0);
    }
  }

  if (clearOutputs) {
    const outputDir = path.join("data", "output");  

    const prefixMap = {
      "learn": f => f === "learn_programming.json",
      "learn:easy": f => f === "learn_programming_easy.json",
      "learn:medium": f => f === "learn_programming_medium.json",
      "learn:hard": f => f === "learn_programming_hard.json",
      "learn:easy:python": f => f === "learn_programming_easy_python.json",
      "learn:easy:java": f => f === "learn_programming_easy_java.json",
      "learn:easy:cpp": f => f === "learn_programming_easy_cpp.json",
      "learn:easy:javascript": f => f === "learn_programming_easy_javascript.json",
      "learn:medium:python": f => f === "learn_programming_medium_python.json",
      "learn:medium:java": f => f === "learn_programming_medium_java.json",
      "learn:medium:cpp": f => f === "learn_programming_medium_cpp.json",
      "learn:medium:javascript": f => f === "learn_programming_medium_javascript.json",
      "learn:hard:python": f => f === "learn_programming_hard_python.json",
      "learn:hard:java": f => f === "learn_programming_hard_java.json",
      "learn:hard:cpp": f => f === "learn_programming_hard_cpp.json",
      "learn:hard:javascript": f => f === "learn_programming_hard_javascript.json",
      "challenge:python:phase1": f => f === "challenges_phase_1_python.json",
      "challenge:java:phase1": f => f === "challenges_phase_1_java.json",
      "challenge:cpp:phase1": f => f === "challenges_phase_1_cpp.json",
      "challenge:javascript:phase1": f => f === "challenges_phase_1_javascript.json",
      "all": f => f.startsWith("learn_programming") || f.startsWith("challenges_phase_")
    };

    const challengePhaseMatch = clearOutputs.match(/^challenge:phase(\d+)$/);
    if (challengePhaseMatch) {
      const phaseNum = challengePhaseMatch[1];
      prefixMap[clearOutputs] = f => f.startsWith(`challenges_phase_${phaseNum}`);
    }

    const matcher = prefixMap[clearOutputs.toLowerCase()];
    if (!matcher) {
      throw new Error(`Invalid clear-outputs value '${clearOutputs}'. Valid options: ${Object.keys(prefixMap).join(", ")}`);
    }

    const files = fs.readdirSync(outputDir).filter(f => f.endsWith(".json"));
    const matched = files.filter(matcher);

    if (matched.length === 0) {
      log.info(`No output files found matching '${clearOutputs}'.`);
    } else {
      for(const file of matched) {
        fs.unlinkSync(path.join(outputDir, file));
        log.info(`Cleared: ${file}`);
      }
      log.warn(`Cleared ${matched.length} output file(s).`);
    }
    process.exit(0);
  }

  const learnUsedSet = getLearnUsedSet(registry);
  const challengeUsedSet = getChallengeUsedSet(registry);

  const validLanguages = rules.languages;

  let activeLanguages;
  if (language) {
    const normalizedLanguage = language.toLowerCase();
    if (!validLanguages.includes(normalizedLanguage)) {
      throw new Error(`Invalid language '${language}'. Valid options: ${validLanguages.join(", ")}`);
    }
    activeLanguages = [normalizedLanguage];
    log.info(`Language override active. Only generating variants for: ${normalizedLanguage}`);
  } else {
    activeLanguages = validLanguages;
  }

  const languages = rules.languages;
  const languageToStory = stories.languageToStory;
  const defaultStory = stories.defaultStory;
  const chapterId = stories.defaultChapterId;

  // ── Helper: Generate test cases for a problem if missing ──
  async function ensureTestCases(problem) {
    if (problem.test_cases !== null) return problem;

    if (!useAi) {
      log.warn(`[TestGen] Missing test_cases for ${problem.problemId} — AI disabled, skipping.`);
      return problem;
    }

    log.info(`[TestGen] Generating test cases for "${problem.original.title}"...`);

    const generated = await generateTestCases(problem);

    if (generated && generated.length > 0) {
      log.info(`[TestGen] ✅ Generated ${generated.length} test case(s) for ${problem.problemId}`);
      return { ...problem, test_cases: generated };
    } else {
      log.warn(`[TestGen] ⚠ Failed to generate test cases for ${problem.problemId}. Using empty array.`);
      return { ...problem, test_cases: [] };
    }
  }

  // ── Helper: Apply topic filter to select a single question ──
  function applyTopicFilter(problems) {
    if (!topicFilter) return problems;

    const normalizedTopic = topicFilter.toLowerCase().replace(/[-\s]/g, "_");

    const validTopics = ["arrays", "strings", "trees", "graphs", "dp", "hashmap", "stack_queue", "sorting_searching", "general"];
    if (!validTopics.includes(normalizedTopic)) {
      throw new Error(
        `Invalid topic '${topicFilter}'. Valid options: ${validTopics.join(", ")}`
      );
    }

    const matching = problems.filter(p => p.topic === normalizedTopic);

    if (matching.length === 0) {
      throw new Error(
        `No problems found for topic '${normalizedTopic}'. ` +
        `Available topics in this dataset: ${[...new Set(problems.map(p => p.topic))].join(", ")}`
      );
    }

    const selected = matching[0];
    log.info(`[Topic] Selected 1 problem for topic '${normalizedTopic}': ${selected.problemId} — "${selected.original.title}"`);

    return [selected];
  }

  // ── Helper: Refine a single variant (narrative + starter code) ──
  async function refineAndBuildVariant(v, p, processedVariants) {
    // 1. Refine narrative
    const refined = await refineVariant(v, {
      difficulty: p.difficulty,
      topic: p.topic,
      bloom: p.bloom,
      skipAi
    });

    // 2. Clean narrative formatting
    const cleanedVariant = cleanVariantNarrative({ ...v, narrative: refined });

    // 3. Generate tailored starter code (AI-only, falls back to static)
    if (useAi) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));

      const aiStarterCode = await generateStarterCode(p, v.language);

      if (aiStarterCode) {
        log.info(`[StarterCode] ✅ Generated for ${v.variantId}`);
        cleanedVariant.starterCode = aiStarterCode;
      } else {
        log.warn(`[StarterCode] ⚠ Failed for ${v.variantId}, keeping static template.`);
        // cleanedVariant.starterCode already has the static fallback from variantMaker
      }
    }

    return cleanedVariant;
  }

  let processedCount = 0;

  // ═══ LEARN MODE ═══
  if (mode === "learn") {
    const availableForLearn = enrichedProblems.filter(p => !learnUsedSet.has(p.problemId));

    let selectedProblems;

    if (topicFilter) {
      selectedProblems = applyTopicFilter(availableForLearn);
    } else {
      let countsPerDifficulty;

      if (difficulty) {
        const normalizedDifficulty = difficulty.charAt(0).toUpperCase() + difficulty.slice(1).toLowerCase();
        const validDifficulties = ["Easy", "Medium", "Hard"];

        if (!validDifficulties.includes(normalizedDifficulty)) {
          throw new Error(`Invalid --difficulty value '${difficulty}'. Must be Easy, Medium, or Hard.`);
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

      selectedProblems = selected;
    }

    addLearnUsed(registry, selectedProblems.map(p => p.problemId));
    saveUsageRegistry(registryPath, registry);

    log.info(`[Learn Mode] Selected ${selectedProblems.length} problems. ${useAi ? "Starting AI Refinement..." : "Starting Manual Conversion..."}`);

    const outputItems = [];
    let processedVariants = 0;

    for (let pi = 0; pi < selectedProblems.length; pi++) {
      let p = selectedProblems[pi];

      // ── Generate test cases if missing ──
      if (p.test_cases === null) {
        if (useAi && processedVariants > 0) {
          await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
        }
        p = await ensureTestCases(p);
        if (useAi) processedVariants++;
      }

      const variants = makeLanguageVariants({
        problemId: p.problemId,
        languages: activeLanguages,
        languageToStory,
        defaultStory,
        mode: "learn",
        topic: p.topic,
        original: p.original,
        skipAi
      });

      const refinedVariants = [];
      
      for (const v of variants) {
        if (useAi && processedVariants > 0) {
          await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
        }
        
        const completedVariant = await refineAndBuildVariant(v, p, processedVariants);
        refinedVariants.push(completedVariant);
        
        if (useAi) {
          processedVariants++;
          if (processedVariants % 5 === 0) {
            log.info(`[Progress] Processed ${processedVariants} variants...`);
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

    const difficultyTag = difficulty ? `_${difficulty.toLowerCase()}` : "";
    const languageTag = language ? `_${language.toLowerCase()}` : "";
    const topicTag = topicFilter ? `_${topicFilter.toLowerCase().replace(/[-\s]/g, "_")}` : "";
    const outPath = path.join("data", "output", `learn_programming${difficultyTag}${topicTag}${languageTag}.json`);

    writeJson(outPath, {
      meta: { 
        dataset, 
        mode: "learn", 
        generatedAt: new Date().toISOString(), 
        ...(topicFilter ? { topicFilter: topicFilter.toLowerCase() } : {}),
        selection: topicFilter 
          ? { topic: topicFilter.toLowerCase(), count: selectedProblems.length }
          : undefined,
        aiRefined: useAi,
        totalVariantsProcessed: processedVariants
      },
      items: outputItems
    });

    log.info(`✅ Wrote Learn output: ${outPath} (AI Refinement: ${useAi ? "ON" : "OFF"})`);

    if(shouldUpload) {
      log.info(`[Upload] Scanning output directory for learn files...`);
      await uploadAllFromDirectory(path.join("data", "output"), "learn");
    }

    return;
  }

  // ═══ CHALLENGE MODE ═══
  if (mode === "challenge") {
    const challengeEligibleProblems = enrichedProblems.filter(p => p.difficulty === "Hard" || p.difficulty === "Medium");

    let selectedProblems;
    let meta;

    if (topicFilter) {
      const eligibleForTopic = challengeEligibleProblems.filter(p => !learnUsedSet.has(p.problemId));
      selectedProblems = applyTopicFilter(eligibleForTopic);
      meta = { topic: topicFilter.toLowerCase(), count: selectedProblems.length };
    } else {
      const result = pickChallengePhase({
        eligibleProblems: challengeEligibleProblems,
        learnUsedSet,
        challengeUsedSet,
        phaseSize: rules.challenge.phaseSize
      });

      selectedProblems = result.selected;
      meta = result.meta;
    }

    const newUniqueIds = selectedProblems
      .filter(p => !challengeUsedSet.has(p.problemId) && !learnUsedSet.has(p.problemId))
      .map(p => p.problemId);

    addChallengeUsed(registry, newUniqueIds, phase);
    saveUsageRegistry(registryPath, registry);

    log.info(`[Challenge Mode] Selected ${selectedProblems.length} problems. ${useAi ? "Starting AI Refinement..." : "Starting Manual Conversion..."}`);

    const outputItems = [];
    let processedVariants = 0;

    for (let pi = 0; pi < selectedProblems.length; pi++) {
      let p = selectedProblems[pi];

      // ── Generate test cases if missing ──
      if (p.test_cases === null) {
        if (useAi && processedVariants > 0) {
          await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
        }
        p = await ensureTestCases(p);
        if (useAi) processedVariants++;
      }

      const variants = makeLanguageVariants({
        problemId: p.problemId,
        languages: activeLanguages,
        languageToStory,
        defaultStory,
        mode: "challenge",
        topic: p.topic,
        original: p.original,
        skipAi
      });

      const refinedVariants = [];
      
      for (const v of variants) {
        if (useAi && processedVariants > 0) {
          await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
        }
        
        const completedVariant = await refineAndBuildVariant(v, p, processedVariants);
        refinedVariants.push(completedVariant);
        
        if (useAi) {
          processedVariants++;
          if (processedVariants % 5 === 0) {
            log.info(`[Progress] Processed ${processedVariants} variants...`);
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

    const topicTag = topicFilter ? `_${topicFilter.toLowerCase().replace(/[-\s]/g, "_")}` : "";
    const languageTag = language ? `_${language.toLowerCase()}` : "";
    const outPath = path.join("data", "output", `challenges_phase_${phase}${topicTag}${languageTag}.json`);

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

    if(shouldUpload) {
      log.info(`[Upload] Scanning output directory for challenge files...`);
      await uploadAllFromDirectory(path.join("data", "output"), `challenge:phase${phase}`);
    }

    return;
  }

  throw new Error(`Unknown mode '${mode}'. Use learn or challenge.`);
}

main().catch((e) => {
  log.error(e.message);
  process.exit(1);
});