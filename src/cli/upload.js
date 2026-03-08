import 'dotenv/config';
import path from 'path';
import { log } from '../utils/logger.js';
import { uploadAllFromDirectory, uploadFromJsonFile } from '../uploader/uploadFromJson.js';

/**
 * ── Standalone Upload CLI ──
 *
 * Upload existing JSON output files to MongoDB without re-running generation.
 *
 * Usage:
 *   npm run upload -- --all                          Upload all output files
 *   npm run upload -- --learn                        Upload all learn files
 *   npm run upload -- --challenge                    Upload all challenge files
 *   npm run upload -- --challenge --phase 2          Upload challenge phase 2 only
 *   npm run upload -- --file <path>                  Upload a specific file
 *
 * Options:
 *   --dir <path>     Override output directory (default: data/output/)
 *
 * Examples:
 *   npm run upload -- --all
 *   npm run upload -- --learn --dir data/output/
 *   npm run upload -- --challenge --phase 1
 *   npm run upload -- --file data/output/learn_programming_easy_python.json
 */

function getSetting(short, long) {
  const longIdx = process.argv.indexOf(`--${long}`);
  if (longIdx !== -1 && process.argv[longIdx + 1] && !process.argv[longIdx + 1].startsWith("-")) {
    return process.argv[longIdx + 1];
  }
  const shortIdx = process.argv.indexOf(`-${short}`);
  if (shortIdx !== -1 && process.argv[shortIdx + 1] && !process.argv[shortIdx + 1].startsWith("-")) {
    return process.argv[shortIdx + 1];
  }
  return null;
}

function hasFlag(short, long) {
  return process.argv.includes(`--${long}`) || process.argv.includes(`-${short}`);
}

async function main() {
  const uploadAll       = hasFlag("a", "all");
  const uploadLearn     = hasFlag("l", "learn");
  const uploadChallenge = hasFlag("ch", "challenge");
  const specificFile    = getSetting("f", "file");
  const phaseArg        = getSetting("p", "phase");
  const outputDir       = getSetting("dir", "dir") || path.join("data", "output");

  // Validate: at least one target must be specified
  if (!uploadAll && !uploadLearn && !uploadChallenge && !specificFile) {
    log.error(
      "Standalone Upload CLI\n\n" +
      "Usage: npm run upload -- <target> [options]\n\n" +
      "Targets (pick one):\n" +
      "  -a,  --all                     Upload all learn + challenge files\n" +
      "  -l,  --learn                   Upload all learn files\n" +
      "  -ch, --challenge               Upload all challenge files\n" +
      "  -ch, --challenge -p, --phase <N>  Upload challenge files for phase N only\n" +
      "  -f,  --file <path>             Upload a specific JSON file\n\n" +
      "Options:\n" +
      "  --dir <path>                   Override output directory (default: data/output/)\n\n" +
      "Examples:\n" +
      "  npm run upload -- --all\n" +
      "  npm run upload -- --learn\n" +
      "  npm run upload -- --challenge --phase 1\n" +
      "  npm run upload -- --file data/output/learn_programming_easy_python.json"
    );
    process.exit(1);
  }

  // Mode 1: Upload a specific file
  if (specificFile) {
    log.info(`[Upload] Uploading single file: ${specificFile}`);
    const { connectDB, disconnectDB } = await import("../db/connection.js");
    await connectDB();
    const result = await uploadFromJsonFile(specificFile);
    await disconnectDB();

    log.info(`\n[Upload] Done: ${result.uploaded} uploaded, ${result.skipped} skipped.`);
    return;
  }

  // Mode 2: Upload by filter
  let filter = null;

  if (uploadAll) {
    filter = null; // no filter = upload everything
    log.info(`[Upload] Uploading ALL output files from ${outputDir}`);

  } else if (uploadLearn) {
    filter = "learn";
    log.info(`[Upload] Uploading LEARN files from ${outputDir}`);

  } else if (uploadChallenge) {
    if (phaseArg) {
      const phaseNum = parseInt(phaseArg, 10);
      if (isNaN(phaseNum)) {
        throw new Error(`Invalid phase number: ${phaseArg}`);
      }
      filter = `challenge:phase${phaseNum}`;
      log.info(`[Upload] Uploading CHALLENGE phase ${phaseNum} files from ${outputDir}`);
    } else {
      filter = "challenge";
      log.info(`[Upload] Uploading ALL CHALLENGE files from ${outputDir}`);
    }
  }

  await uploadAllFromDirectory(outputDir, filter);
}

main().catch((e) => {
  log.error(e.message);
  process.exit(1);
});