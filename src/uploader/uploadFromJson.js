import fs from "fs";
import path from "path";
import { log } from "../utils/logger.js";
import { connectDB, disconnectDB } from "../db/connection.js";
import {
  getQuestionModel,
  buildCollectionName,
  isLearnFile,
  isChallengeFile,
  extractPhaseFromFileName
} from "../db/models/question.js";

/**
 * ── How the routing works ──
 *
 * The target collection is determined from the ITEM DATA inside each file,
 * not from the filename. The filename is only used to classify the file
 * as learn or challenge.
 *
 * LEARN files (learn_programming*.json):
 *   Each item's difficulty + variant language → learnPythonEasyQ
 *   Upsert key: { problemId }
 *
 * CHALLENGE files (challenges_phase_N*.json):
 *   Each item's variant language → challengePythonQ
 *   Phase is stored in the document, all phases share one collection.
 *   Upsert key: { problemId, phase }
 */

/**
 * Builds a learn document from a JSON item.
 */
function buildLearnDoc(item, aiRefined) {
  return {
    problemId:   item.problemId,
    source:      item.source,
    original:    item.original,
    difficulty:  item.difficulty,
    topic:       item.topic,
    bloom:       item.bloom,
    story:       item.story || null,
    examples:    item.examples,
    constraints: item.constraints,
    test_cases:  item.test_cases,
    variants:    item.variants,
    aiRefined,
    uploadedAt:  new Date()
  };
}

/**
 * Builds a challenge document from a JSON item.
 */
function buildChallengeDoc(item, phase, aiRefined) {
  return {
    problemId:   item.problemId,
    source:      item.source,
    original:    item.original,
    difficulty:  item.difficulty,
    topic:       item.topic,
    bloom:       item.bloom,
    beatId:      item.beatId || null,
    phase,
    examples:    item.examples,
    constraints: item.constraints,
    test_cases:  item.test_cases,
    variants:    item.variants,
    aiRefined,
    uploadedAt:  new Date()
  };
}

/**
 * Uploads a single LEARN JSON file.
 * Routes each item to learnPythonEasyQ, learnJavaMediumQ, etc.
 * based on the item's difficulty and variant language.
 */
async function uploadLearnFile(jsonFilePath) {
  const raw = JSON.parse(fs.readFileSync(jsonFilePath, "utf8"));
  const { meta, items } = raw;

  if (!items || !items.length) {
    log.warn(`No items found in ${path.basename(jsonFilePath)}. Skipping.`);
    return { uploaded: 0, skipped: 0, breakdown: {} };
  }

  const aiRefined = meta.aiRefined || false;
  let uploaded = 0;
  let skipped = 0;
  const breakdown = {};

  for (const item of items) {
    const language = item.variants[0].language;
    const difficulty = item.difficulty;
    const collectionName = buildCollectionName("learn", language, difficulty);

    try {
      const Model = getQuestionModel("learn", language, difficulty);
      const doc = buildLearnDoc(item, aiRefined);

      await Model.findOneAndUpdate(
        { problemId: item.problemId },
        { $set: doc },
        { upsert: true, new: true }
      );

      uploaded++;
      breakdown[collectionName] = (breakdown[collectionName] || 0) + 1;
    } catch (error) {
      log.warn(`Failed to upload ${item.problemId} → ${collectionName}: ${error.message}`);
      skipped++;
    }
  }

  log.info(`[Upload] ${path.basename(jsonFilePath)} → ${uploaded} uploaded, ${skipped} skipped.`);
  for (const [name, count] of Object.entries(breakdown)) {
    log.info(`[Upload]   ${name}: ${count} questions`);
  }

  return { uploaded, skipped, breakdown };
}

/**
 * Uploads a single CHALLENGE JSON file.
 * Routes each item to challengePythonQ, challengeJavaQ, etc.
 * based on the item's variant language. Phase is extracted from filename or meta.
 */
async function uploadChallengeFile(jsonFilePath) {
  const raw = JSON.parse(fs.readFileSync(jsonFilePath, "utf8"));
  const { meta, items } = raw;

  if (!items || !items.length) {
    log.warn(`No items found in ${path.basename(jsonFilePath)}. Skipping.`);
    return { uploaded: 0, skipped: 0, breakdown: {} };
  }

  const phase = extractPhaseFromFileName(jsonFilePath) || meta.phase;
  const aiRefined = meta.aiRefined || false;

  if (phase == null) {
    log.warn(`Cannot determine phase for ${path.basename(jsonFilePath)}. Skipping.`);
    return { uploaded: 0, skipped: 0, breakdown: {} };
  }

  let uploaded = 0;
  let skipped = 0;
  const breakdown = {};

  for (const item of items) {
    const language = item.variants[0].language;
    const collectionName = buildCollectionName("challenge", language);

    try {
      const Model = getQuestionModel("challenge", language);
      const doc = buildChallengeDoc(item, phase, aiRefined);

      await Model.findOneAndUpdate(
        { problemId: item.problemId, phase },
        { $set: doc },
        { upsert: true, new: true }
      );

      uploaded++;
      breakdown[collectionName] = (breakdown[collectionName] || 0) + 1;
    } catch (error) {
      log.warn(`Failed to upload ${item.problemId} → ${collectionName}: ${error.message}`);
      skipped++;
    }
  }

  log.info(`[Upload] ${path.basename(jsonFilePath)} → ${uploaded} uploaded, ${skipped} skipped.`);
  for (const [name, count] of Object.entries(breakdown)) {
    log.info(`[Upload]   ${name}: ${count} questions`);
  }

  return { uploaded, skipped, breakdown };
}

/**
 * Uploads a single JSON output file (auto-detects learn vs challenge).
 *
 * @param {string} jsonFilePath - Path to the output JSON file
 */
export async function uploadFromJsonFile(jsonFilePath) {
  if (!fs.existsSync(jsonFilePath)) {
    throw new Error(`Output file not found: ${jsonFilePath}`);
  }

  if (isLearnFile(jsonFilePath)) {
    return uploadLearnFile(jsonFilePath);
  }

  if (isChallengeFile(jsonFilePath)) {
    return uploadChallengeFile(jsonFilePath);
  }

  log.warn(`[Upload] Unrecognized file: ${path.basename(jsonFilePath)}. Skipping.`);
  return { uploaded: 0, skipped: 0, breakdown: {} };
}

/**
 * Scans a directory for output JSON files and uploads matching ones.
 *
 * @param {string} dirPath - e.g. "data/output/"
 * @param {string} [filter] - Optional filter:
 *   "learn"             → only learn files
 *   "challenge:phase1"  → only challenge files for phase 1
 *   undefined/null      → all recognized files
 * @returns {{ totalUploaded, totalSkipped, breakdown }}
 */
export async function uploadAllFromDirectory(dirPath, filter = null) {
  if (!fs.existsSync(dirPath)) {
    throw new Error(`Output directory not found: ${dirPath}`);
  }

  const allFiles = fs.readdirSync(dirPath).filter(f => f.endsWith(".json"));

  // Apply filter to select relevant files
  let matchingFiles;

  if (!filter) {
    // No filter: upload all recognized files
    matchingFiles = allFiles.filter(f => isLearnFile(f) || isChallengeFile(f));

  } else if (filter === "learn") {
    matchingFiles = allFiles.filter(f => isLearnFile(f));

  } else if (filter === "challenge") {
    matchingFiles = allFiles.filter(f => isChallengeFile(f));

  } else if (filter.startsWith("challenge:phase")) {
    const phaseNum = parseInt(filter.replace("challenge:phase", ""), 10);
    matchingFiles = allFiles.filter(f => {
      if (!isChallengeFile(f)) return false;
      const filePhase = extractPhaseFromFileName(f);
      return filePhase === phaseNum;
    });

  } else {
    // Unknown filter, try to match anything
    matchingFiles = allFiles.filter(f => isLearnFile(f) || isChallengeFile(f));
    log.warn(`[Upload] Unrecognized filter '${filter}', uploading all matching files.`);
  }

  if (!matchingFiles.length) {
    log.warn(`[Upload] No matching output files found in ${dirPath}`);
    return { totalUploaded: 0, totalSkipped: 0, breakdown: {} };
  }

  log.info(`[Upload] Found ${matchingFiles.length} output file(s) to upload.`);

  await connectDB();

  let totalUploaded = 0;
  let totalSkipped = 0;
  const breakdown = {};

  for (const file of matchingFiles) {
    const filePath = path.join(dirPath, file);
    const result = await uploadFromJsonFile(filePath);

    totalUploaded += result.uploaded;
    totalSkipped += result.skipped;

    // Merge breakdown
    for (const [name, count] of Object.entries(result.breakdown || {})) {
      breakdown[name] = (breakdown[name] || 0) + count;
    }
  }

  await disconnectDB();

  log.info(`\n[Upload] ═══ SUMMARY ═══`);
  log.info(`[Upload] Total: ${totalUploaded} uploaded, ${totalSkipped} skipped.`);
  log.info(`[Upload] Collections:`);
  for (const [name, count] of Object.entries(breakdown)) {
    log.info(`[Upload]   ${name}: ${count} questions`);
  }

  return { totalUploaded, totalSkipped, breakdown };
}