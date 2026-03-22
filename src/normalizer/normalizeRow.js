import { parseDescription, hasEmbeddedStructure } from "./descriptionParser.js";
import { log } from "../utils/logger.js";

function normalizeDifficulty(value) {
  if (!value) return null;
  const v = String(value).toLowerCase();
  if (v.includes("easy")) return "Easy";
  if (v.includes("medium")) return "Medium";
  if (v.includes("hard")) return "Hard";
  return null;
}

function readField(row, colName) {
  if (!colName) return null;
  const v = row[colName];
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
} 

function parseJsonIfPossible(value, fieldName) {
  if (value === null) return null;
  const s = String(value).trim();
  if (!s) return null;

  const looksJson = s.startsWith("[") || s.startsWith("{");
  if (!looksJson) return s;

  try {
    return JSON.parse(s);
  } catch (e) {
    throw new Error(`Invalid JSON in '${fieldName}': ${e.message}`);
  }
}

/**
 * Strip carriage returns and backticks from a string.
 */
function cleanText(text) {
  if (!text) return text;
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/`/g, "");
}

export function normalizeCsvRowToProblem(row, mappingConfig) {
  const cols = mappingConfig.columns;

  const sourceId = readField(row, cols.id);
  const title = readField(row, cols.title);
  const description = readField(row, cols.description);
  const difficultyRaw = readField(row, cols.difficulty);

  if (!sourceId || !title || !description || !difficultyRaw) {
    throw new Error("Missing one of: id/title/description/difficulty");
  }

  // optional (leetcode has isPremium field)
  const isPremiumRaw = cols.isPremium ? readField(row, cols.isPremium) : null;
  const isPremium = isPremiumRaw ? (String(isPremiumRaw) === "1") : false;

  const difficulty = normalizeDifficulty(difficultyRaw);
  if (!difficulty) throw new Error(`Unknown difficulty: ${difficultyRaw}`);

  const examplesRaw = readField(row, cols.examples);
  const constraintsRaw = readField(row, cols.constraints);
  const testCasesRaw = readField(row, cols.testCases);

  let examples = parseJsonIfPossible(examplesRaw, "examples");
  let constraints = parseJsonIfPossible(constraintsRaw, "constraints");
  let test_cases = parseJsonIfPossible(testCasesRaw, "test_cases");

  // ── Fallback: extract from description when structured fields are missing ──
  // This handles datasets like LeetCode where examples and constraints
  // are embedded in the description body rather than stored as separate fields.
  let cleanDescription = cleanText(description);

  if ((examples === null || constraints === null) && hasEmbeddedStructure(description)) {
    const parsed = parseDescription(description);

    if (examples === null && parsed.examples) {
      examples = parsed.examples;
      log.info(`[Parser] Extracted ${parsed.examples.length} example(s) from description for ID ${sourceId}`);
    }

    if (constraints === null && parsed.constraints) {
      constraints = parsed.constraints;
      log.info(`[Parser] Extracted ${parsed.constraints.length} constraint(s) from description for ID ${sourceId}`);
    }

    // Use the clean description (without examples/constraints) for narrative
    if (parsed.cleanDescription) {
      cleanDescription = parsed.cleanDescription;
    }
  }

  return {
    source: {
      dataset: mappingConfig.datasetName,
      source_question_id: String(sourceId)
    },
    original: {
      title: cleanText(String(title)),
      description: cleanDescription
    },
    // Keep the full raw description available for AI test case generation
    rawDescription: cleanText(String(description)),
    difficulty,
    isPremium,
    examples,
    constraints,
    test_cases,
    meta: {
      rawRow: row
    }
  };
}

/**
 * Validates that execution-critical fields exist.
 *
 * When `allowAiFallback` is true, missing test_cases are permitted because
 * the AI refinement layer will generate them downstream.
 *
 * @param {Object} problem - The normalized problem object
 * @param {Object} [options]
 * @param {boolean} [options.allowAiFallback=false] - If true, tolerate missing test_cases
 */
export function ensureExecutionFieldsExist(problem, options = {}) {
  const { allowAiFallback = false } = options;

  if (problem.examples === null) {
    throw new Error("Missing examples (not found in fields or description). Execution required.");
  }

  if (problem.constraints === null) {
    throw new Error("Missing constraints (not found in fields or description). Execution required.");
  }

  if (problem.test_cases === null && !allowAiFallback) {
    throw new Error(
      "Missing test_cases (execution required). " +
      "Use the -ai flag to auto-generate test cases, or provide them in the dataset."
    );
  }
}