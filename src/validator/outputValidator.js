/**
 * Validates that an output record has all required fields
 * AND that examples/test_cases have the correct internal structure.
 */
export function validateOutputRecord(record) {
  const mustHave = ["problemId", "source", "original", "difficulty", "topic", "bloom", "examples", "constraints", "test_cases", "variants"];
  for (const key of mustHave) {
    if (record[key] === undefined || record[key] === null) {
      throw new Error(`Missing field '${key}' in output for problemId=${record.problemId}`);
    }
  }

  // ── Validate examples structure ──
  if (!Array.isArray(record.examples)) {
    throw new Error(`'examples' must be an array for problemId=${record.problemId}`);
  }

  for (let i = 0; i < record.examples.length; i++) {
    const ex = record.examples[i];

    if (ex.input === undefined || ex.input === null) {
      throw new Error(
        `examples[${i}].input is missing for problemId=${record.problemId}`
      );
    }

    if (ex.output === undefined) {
      throw new Error(
        `examples[${i}].output is missing for problemId=${record.problemId}`
      );
    }

    // Output must be a typed value (number, boolean, array, object, or string), never left as undefined
    // Warn if output looks like an unparsed string that should be a number
    if (typeof ex.output === "string" && /^-?\d+(\.\d+)?$/.test(ex.output)) {
      throw new Error(
        `examples[${i}].output is a numeric string "${ex.output}" instead of a number for problemId=${record.problemId}. ` +
        `The description parser should have converted this to a typed value.`
      );
    }

    // Input should be an object (with named keys), not a raw assignment string
    if (typeof ex.input === "string" && ex.input.includes("=")) {
      throw new Error(
        `examples[${i}].input is a raw string "${ex.input.slice(0, 50)}..." instead of a parsed object for problemId=${record.problemId}. ` +
        `The description parser should have converted this to { key: value }.`
      );
    }
  }

  // ── Validate test_cases structure ──
  if (!Array.isArray(record.test_cases)) {
    throw new Error(`'test_cases' must be an array for problemId=${record.problemId}`);
  }

  for (let i = 0; i < record.test_cases.length; i++) {
    const tc = record.test_cases[i];

    if (tc.input === undefined || tc.input === null) {
      throw new Error(
        `test_cases[${i}].input is missing for problemId=${record.problemId}`
      );
    }

    if (tc.expected_output === undefined) {
      throw new Error(
        `test_cases[${i}].expected_output is missing for problemId=${record.problemId}`
      );
    }

    // Same type checks as examples
    if (typeof tc.expected_output === "string" && /^-?\d+(\.\d+)?$/.test(tc.expected_output)) {
      throw new Error(
        `test_cases[${i}].expected_output is a numeric string "${tc.expected_output}" instead of a number for problemId=${record.problemId}. ` +
        `The test case generator should have converted this to a typed value.`
      );
    }

    if (typeof tc.input === "string" && tc.input.includes("=")) {
      throw new Error(
        `test_cases[${i}].input is a raw string "${tc.input.slice(0, 50)}..." instead of a parsed object for problemId=${record.problemId}. ` +
        `The test case generator should have converted this to { key: value }.`
      );
    }
  }

  // ── Validate variants ──
  if (!Array.isArray(record.variants) || record.variants.length === 0) {
    throw new Error(`'variants' must be a non-empty array for problemId=${record.problemId}`);
  }
}