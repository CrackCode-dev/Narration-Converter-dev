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

export function normalizeCsvRowToProblem(row, mappingConfig) {
  const cols = mappingConfig.columns;

  const sourceId = readField(row, cols.id);
  const title = readField(row, cols.title);
  const description = readField(row, cols.description);
  const difficultyRaw = readField(row, cols.difficulty);

  if (!sourceId || !title || !description || !difficultyRaw) {
    throw new Error("Missing one of: id/title/description/difficulty");
  }

  // optional (leetcode one isPremium field)
  const isPremiumRaw = cols.isPremium ? readField(row, cols.isPremium) : null;
  const isPremium = isPremiumRaw ? (String(isPremiumRaw) === "1") : false;

  const difficulty = normalizeDifficulty(difficultyRaw);
  if (!difficulty) throw new Error(`Unknown difficulty: ${difficultyRaw}`);

  const examplesRaw = readField(row, cols.examples);
  const constraintsRaw = readField(row, cols.constraints);
  const testCasesRaw = readField(row, cols.testCases);

  const examples = parseJsonIfPossible(examplesRaw, "examples");
  const constraints = parseJsonIfPossible(constraintsRaw, "constraints");
  const test_cases = parseJsonIfPossible(testCasesRaw, "test_cases");

  return {
    source: {
      dataset: mappingConfig.datasetName,
      source_question_id: String(sourceId)
    },
    original: {
      title: String(title),
      description: String(description)
    },
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

export function ensureExecutionFieldsExist(problem) {
  // Required for judge + platform reliability
  if (problem.examples === null || problem.constraints === null || problem.test_cases === null) {
    throw new Error("Missing examples/constraints/test_cases (execution required).");
  }
}