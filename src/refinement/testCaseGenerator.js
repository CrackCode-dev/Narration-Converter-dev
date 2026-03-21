import Groq from "groq-sdk";
import { log } from "../utils/logger.js";
import { parseInputString, parseValueString } from "../normalizer/descriptionParser.js";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * ── Test Case Generator ──
 *
 * Generates structured test cases for coding problems that lack them.
 * Uses the Groq LLM to analyze the problem description, examples, and
 * constraints, then produces at least 3 well-formed test cases.
 *
 * Output format matches the platform's expected structure:
 *   { input: { nums: [1,2,3], target: 4 }, expected_output: 1, explanation: "..." }
 *
 * NOT string-based like: { input: "nums = [1,2,3]", expected_output: "1" }
 */

const SYSTEM_PROMPT = `You are a test case generator for a coding platform. Given a coding problem, you produce structured test cases that validate correctness.

RULES:
1. Generate EXACTLY 3–5 test cases. Never fewer than 3.
2. Include at least: one simple/basic case, one edge case (smallest input, largest constraint boundary, empty/null where applicable), and one medium-complexity case.
3. Test cases must be consistent with the problem's constraints and examples.
4. If the problem provides examples with Input/Output, your test cases must use the SAME input/output format.
5. Do NOT duplicate any examples that are already provided — generate NEW cases only.
6. Each test case must have: "input", "expected_output", and "explanation" fields.
7. The "input" field MUST be a JSON object with named keys matching the function parameters. For example: {"nums": [1,2,3], "target": 4} — NOT a string like "nums = [1,2,3], target = 4".
8. The "expected_output" field MUST be the raw typed value: a number, boolean, array, or string — NOT a stringified version. For example: 1 — NOT "1".
9. The "explanation" field should briefly describe what the test case validates.

OUTPUT FORMAT:
Return ONLY a valid JSON array of test case objects. No markdown, no commentary.
Example: [{"input":{"nums":[1,2,3],"target":4},"expected_output":[0,2],"explanation":"Basic case: first and last elements sum to target"},{"input":{"nums":[1],"target":1},"expected_output":[],"explanation":"Edge case: single element, no pair exists"}]`;

/**
 * Build the user prompt with all available problem context.
 */
function buildPrompt(problem) {
  const parts = [];

  parts.push(`PROBLEM TITLE: ${problem.original.title}`);
  parts.push(`DIFFICULTY: ${problem.difficulty}`);
  parts.push(`\nDESCRIPTION:\n${problem.rawDescription || problem.original.description}`);

  if (problem.examples && Array.isArray(problem.examples) && problem.examples.length > 0) {
    parts.push("\nEXISTING EXAMPLES (do NOT duplicate these — match the same input key names):");
    for (let i = 0; i < problem.examples.length; i++) {
      const ex = problem.examples[i];
      parts.push(`  Example ${i + 1}:`);
      if (ex.input) parts.push(`    Input: ${JSON.stringify(ex.input)}`);
      if (ex.output !== undefined) parts.push(`    Output: ${JSON.stringify(ex.output)}`);
    }
  }

  if (problem.constraints && Array.isArray(problem.constraints)) {
    parts.push(`\nCONSTRAINTS:\n${problem.constraints.map(c => `  - ${c}`).join("\n")}`);
  }

  parts.push("\nGenerate 3–5 NEW test cases as a JSON array. The input field must be a JSON object, not a string. Output ONLY the JSON array.");

  return parts.join("\n");
}

/**
 * Attempt to parse test cases from LLM output.
 */
function parseTestCases(raw) {
  if (!raw || typeof raw !== "string") return null;

  let text = raw.trim();

  // Strip markdown fences
  text = text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
  text = text.replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();

  // Try direct parse
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed) && parsed.length >= 1) {
      return normalizeTestCases(parsed);
    }
  } catch (e) { /* continue */ }

  // Try extracting array from surrounding text
  try {
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed) && parsed.length >= 1) {
        return normalizeTestCases(parsed);
      }
    }
  } catch (e) { /* continue */ }

  return null;
}

/**
 * Validate, normalize, and type-cast test case objects.
 *
 * Converts:
 *   - String inputs like "nums = [1,2,3]" → { nums: [1,2,3] }
 *   - String outputs like "1" → 1
 */
function normalizeTestCases(cases) {
  const valid = [];

  for (const tc of cases) {
    if (!tc || typeof tc !== "object") continue;

    // Extract fields (handle multiple naming conventions)
    let input = tc.input ?? tc.Input ?? tc.INPUT ?? null;
    let output = tc.expected_output ?? tc.expectedOutput ?? tc.output ?? tc.Output ?? null;
    const explanation = tc.explanation ?? tc.Explanation ?? "";

    if (input === null || output === null) continue;

    // ── Normalize input: string → typed object ──
    if (typeof input === "string") {
      input = parseInputString(input);
    }

    // ── Normalize output: string → typed value ──
    if (typeof output === "string") {
      output = parseValueString(output);
    }

    valid.push({
      input,
      expected_output: output,
      explanation: String(explanation)
    });
  }

  return valid.length >= 1 ? valid : null;
}

/**
 * Generate test cases for a single problem using the Groq LLM.
 *
 * @param {Object} problem - Normalized problem with original, difficulty, examples, constraints
 * @returns {Array|null} - Array of typed test case objects, or null on failure
 */
export async function generateTestCases(problem) {
  const userPrompt = buildPrompt(problem);

  // Attempt 1: JSON mode
  try {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.4,
      response_format: { type: "json_object" }
    });

    const rawContent = completion.choices[0]?.message?.content || null;

    if (rawContent) {
      let parsed;
      try {
        parsed = JSON.parse(rawContent);
      } catch (e) {
        parsed = null;
      }

      if (parsed) {
        // If the model wrapped it: { "test_cases": [...] } or { "testCases": [...] }
        const arr = Array.isArray(parsed)
          ? parsed
          : (parsed.test_cases || parsed.testCases || parsed.cases || parsed.tests || null);

        if (Array.isArray(arr)) {
          const validated = normalizeTestCases(arr);
          if (validated) return validated;
        }
      }
    }
  } catch (apiError) {
    const failedGen = extractFailedGeneration(apiError);
    if (failedGen) {
      const recovered = parseTestCases(failedGen);
      if (recovered) return recovered;
    }
    log.warn(`[TestGen] JSON mode failed for ${problem.original.title}: ${apiError.message}`);
  }

  // Attempt 2: Free-form mode
  try {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt + "\n\nIMPORTANT: Output ONLY the JSON array. No markdown, no explanation." }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.3
    });

    const rawContent = completion.choices[0]?.message?.content || null;
    if (rawContent) {
      const parsed = parseTestCases(rawContent);
      if (parsed) {
        log.info(`[TestGen] Generated ${parsed.length} test case(s) for "${problem.original.title}" (retry mode)`);
        return parsed;
      }
    }
  } catch (retryError) {
    log.warn(`[TestGen] Retry also failed for ${problem.original.title}: ${retryError.message}`);
  }

  return null;
}

/**
 * Extract failed_generation from Groq API errors.
 */
function extractFailedGeneration(apiError) {
  if (apiError?.error?.failed_generation) {
    return apiError.error.failed_generation;
  }
  if (apiError?.body?.error?.failed_generation) {
    return apiError.body.error.failed_generation;
  }
  if (apiError?.message) {
    try {
      const jsonMatch = apiError.message.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed?.error?.failed_generation || parsed?.failed_generation || null;
      }
    } catch (e) { /* ignore */ }
  }
  return null;
}