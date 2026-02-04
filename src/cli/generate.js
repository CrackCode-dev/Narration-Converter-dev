import 'dotenv/config'; 
import fs from "fs";
import path from "path";

import { log } from "../utils/logger.js";
import { makeProblemId } from "../utils/idMaker.js";

import { loadCsvRows } from "../loaders/readCsv.js";
import { normalizeCsvRowToProblem, ensureExecutionFieldsExist } from "../normalizer/normalizeRow.js";

import { detectTopic } from "../classifier/topicClassifier.js";
import { detectBloom } from "../classifier/bloomClassifier.js";

import { makeBeatId } from "../narrative/beatMaker.js";
import { makeLanguageVariants } from "../narrative/variantMaker.js";

import { pickLearnProblems } from "../selector/learnSelector.js";
import { pickChallengeHardPhase } from "../selector/challengeSelector.js";

import {
  loadUsageRegistry,
  saveUsageRegistry,
  getLearnUsedSet,
  getChallengeUsedHardSet,
  addLearnUsed,
  addChallengeUsedHard,
  resetRegistryAll,
  resetRegistryLearnOnly,
  resetRegistryChallengesOnly
} from "../registry/usageRegistry.js";

import { validateOutputRecord } from "../validator/outputValidator.js";

/**
 * Resolves settings using the hierarchy: CLI Args > Environment Variables > Fallback
 */
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
  // 1) Resolve core configurations
  const dataset = getSetting("d", "dataset", "DEFAULT_DATASET", "datasetA");
  const mode = getSetting("m", "mode", "DEFAULT_MODE"); 
  const phase = toNumberOrFallback(getSetting("p", "phase", null, "1"), 1);

  // Inferred input path if not explicitly provided
  const defaultInput = `data/input/${dataset}.csv`;
  const input = getSetting("i", "input", null, defaultInput);

  // Registry reset flags
  const resetAll = hasFlag("R", "reset-registry");
  const resetLearnOnly = hasFlag("rl", "reset-learn-only");
  const resetChallengesOnly = hasFlag("rc", "reset-challenges-only");

  if (!dataset || !input || !mode) {
    log.error(
      "Usage: npm run generate -- -m <learn|challenge> [options]\n" +
      "Options:\n" +
      "  -d, --dataset <name>    (Default: from .env or datasetA)\n" +
      "  -i, --input <path>      (Default: data/input/<dataset>.csv)\n" +
      "  -p, --phase <N>         (Default: 1)\n" +
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

  const enrichedProblems = normalizedProblems.map((p) => {
    const combinedText = `${p.original.title}\n${p.original.description}`;
    const topic = detectTopic(combinedText);
    const bloom = detectBloom(combinedText, p.difficulty);
    const beatId = makeBeatId(bloom.score);

    return { ...p, topic, bloom, beatId };
  });

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
  const challengeUsedSet = getChallengeUsedHardSet(registry);

  const languages = rules.languages;
  const languageToStory = stories.languageToStory;
  const defaultStory = stories.defaultStory;
  const chapterId = stories.defaultChapterId;

  if (mode === "learn") {
    const availableForLearn = enrichedProblems.filter(p => !learnUsedSet.has(p.problemId));

    const { selected, meta } = pickLearnProblems({
      allProblems: availableForLearn,
      countsPerDifficulty: rules.learn.countsPerDifficulty
    });

    addLearnUsed(registry, selected.map(p => p.problemId));
    saveUsageRegistry(registryPath, registry);

    const outputItems = selected.map((p) => {
      const variants = makeLanguageVariants({
        problemId: p.problemId,
        languages,
        languageToStory,
        defaultStory,
        mode: "learn",
        topic: p.topic,
        original: p.original
      });

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
        variants
      };

      validateOutputRecord(record);
      return record;
    });

    const outPath = path.join("data", "output", "learn_programming.json");
    writeJson(outPath, {
      meta: { dataset, mode: "learn", generatedAt: new Date().toISOString(), selection: meta },
      items: outputItems
    });

    log.info(`Wrote Learn output: ${outPath}`);
    return;
  }

  if (mode === "challenge") {
    const hardProblems = enrichedProblems.filter(p => p.difficulty === "Hard");

    const { selected, meta } = pickChallengeHardPhase({
      hardProblems,
      learnUsedSet,
      challengeUsedSet,
      phaseSize: rules.challenge.phaseSize
    });

    const newUniqueIds = selected
      .filter(p => !challengeUsedSet.has(p.problemId) && !learnUsedSet.has(p.problemId))
      .map(p => p.problemId);

    addChallengeUsedHard(registry, newUniqueIds, phase);
    saveUsageRegistry(registryPath, registry);

    const outputItems = selected.map((p) => {
      const variants = makeLanguageVariants({
        problemId: p.problemId,
        languages,
        languageToStory,
        defaultStory,
        mode: "challenge",
        topic: p.topic,
        original: p.original
      });

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
        variants
      };

      validateOutputRecord(record);
      return record;
    });

    const outPath = path.join("data", "output", `challenges_phase_${phase}.json`);
    writeJson(outPath, {
      meta: { dataset, mode: "challenge", phase, generatedAt: new Date().toISOString(), ...meta },
      items: outputItems
    });

    log.info(`Wrote Challenge output: ${outPath}`);
    return;
  }

  throw new Error(`Unknown mode '${mode}'. Use learn or challenge.`);
}

main().catch((e) => {
  log.error(e.message);
  process.exit(1);
});
