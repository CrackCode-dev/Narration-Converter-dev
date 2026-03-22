import Groq from "groq-sdk";
import { log } from "../utils/logger.js";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// VALID MODES

const VALID_MODES = ["function", "program"];

// LANGUAGE PROMPTS — verbatim from STARTER_PROMPTS.md
//
// These are the exact system prompts prescribed by the spec.
// Placeholders ({{FUNCTION_NAME}}, {{PARAMS}}, etc.) are filled in
// dynamically at generation time by substitutePlaceholders().
//
// The prompts instruct the model to produce ONLY a blank starter
// template — no solution logic, no hints, no algorithm steps.
// The user is expected to implement the solution themselves.

const LANGUAGE_PROMPTS = {

    python: `You are a code generator for starter templates. Read the problem description carefully and produce only valid Python 3 code (no explanation).

- If the problem is function-style (tests will call a function), output only a single function with the exact name and signature requested: \`def {{FUNCTION_NAME}}({{PARAMS}}) -> {{RETURN_TYPE}}:\` and a short docstring describing inputs/outputs. Do NOT include a \`main\` runner.
- If the problem is program-style (stdin → stdout), output a complete program that uses \`if __name__ == "__main__":\` and reads input exactly as described by \`{{INPUT_FORMAT}}\`, performs the computation, and prints output matching \`{{OUTPUT_FORMAT}}\`.
- Use only the Python standard library. Do not import dangerous modules (\`os.system\`, \`subprocess\`, \`socket\`, \`threading\`, \`multiprocessing\`, etc.). No top-level side-effects (network, file writes, long sleeps).
- Make parsing robust (strip whitespace, handle empty inputs, validate numeric conversions). Handle edge cases (n ≤ 0, empty lists).
- Ensure code is compatible with Python 3.10+. Include only code — no tests, comments beyond a short docstring, or extra text.

Output only the source code — no explanations, no example runs, no tests.`,

    javascript: `You are a code generator for Node.js starter templates. Produce only valid JavaScript (Node 16+) and nothing else.

- For function-style problems: output a single function \`function {{FUNCTION_NAME}}({{PARAMS}}) { ... }\` and at the end export it with \`if (typeof module !== 'undefined') module.exports = {{FUNCTION_NAME}};\`. Do not include a runner.
- For stdin-style problems: output a full program that reads from \`process.stdin\` (buffered), parses input according to \`{{INPUT_FORMAT}}\`, computes and prints results matching \`{{OUTPUT_FORMAT}}\`.
- Use only built-in modules. Avoid \`child_process\`, \`fs\` writes, network calls, or top-level async side effects.
- Be defensive about parsing (trim, Number conversions, handle missing values).

Use this snippet for stdin-style:

\`\`\`javascript
'use strict';
const fs = require('fs');
const data = fs.readFileSync(0, 'utf8').trim().split(/\\s+/);
// parse data according to {{INPUT_FORMAT}}
// compute and console.log(...) according to {{OUTPUT_FORMAT}}
\`\`\`

Output only the source code — no explanations, no example runs, no tests.`,

    java: `You are a code generator for Java starter templates. Produce only Java code (no package declaration) that compiles with OpenJDK 17+ and nothing else.

- For function-style problems: produce a \`public class Main\` containing a \`public static {{RETURN_TYPE}} {{FUNCTION_NAME}}({{PARAMS}})\` method only. Do NOT include a \`main\` method.
- For stdin-style problems: produce a full program with \`public class Main { public static void main(String[] args) throws Exception { ... } }\`. Use \`BufferedReader\`/\`StringTokenizer\` or \`Scanner\` for fast parsing.
- Do not use threads, reflection, file/network IO, or external libraries. Keep I/O exact to \`{{INPUT_FORMAT}}\` and \`{{OUTPUT_FORMAT}}\`.
- Be robust when parsing numbers and arrays; handle empty input edge-cases.

Parsing pattern suggestion:

\`\`\`java
import java.io.*;
import java.util.*;

public class Main {
  public static {{RETURN_TYPE}} {{FUNCTION_NAME}}({{PARAMS}}) { /* implement */ }

  public static void main(String[] args) throws Exception {
    BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
    StringTokenizer st = new StringTokenizer(br.readLine()==null?"":br.readLine());
    // parse according to {{INPUT_FORMAT}}
    // call function or inline logic and System.out.println(...)
  }
}
\`\`\`

Output only the source code — no explanations, no example runs, no tests.`,

    cpp: `You are a code generator for C++ starter templates. Produce only C++ code (no extra text) that compiles with g++11+ and nothing else.

- For function-style problems: output only the function with the exact signature \`{{RETURN_TYPE}} {{FUNCTION_NAME}}({{PARAMS}})\` and any #includes needed. Do NOT include \`main\`.
- For stdin-style problems: output a complete program with \`int main()\` that reads input via \`std::cin\`, handles whitespace robustly, and prints results with \`std::cout\` matching \`{{OUTPUT_FORMAT}}\`.
- Use only standard headers (\`<bits/stdc++.h>\` allowed), avoid unsafe system calls, threads, or file/network IO.
- Ensure correct types, handle large integers (use \`long long\` if needed), check edge cases, and avoid undefined behavior.

Example stdin-style pattern:

\`\`\`cpp
#include <bits/stdc++.h>
using namespace std;

{{RETURN_TYPE}} {{FUNCTION_NAME}}({{PARAMS}}) { /* implement */ }

int main() {
  ios::sync_with_stdio(false);
  cin.tie(nullptr);
  // parse input according to {{INPUT_FORMAT}}
  // compute and cout << result << '\\n';
  return 0;
}
\`\`\`

Output only the source code — no explanations, no example runs, no tests.`
};

// PLACEHOLDER EXTRACTION FROM PROBLEM METADATA

/**
 * Returns the fixed function name required by the JudgeO harness.
 *
 * JudgeO expects every submission to expose a function called `solve`.
 * The harness calls `solve(...)` with parsed test-case inputs and compares
 * the return value against expected output. Any other name will cause a
 * "function not found" verdict, so we hard-code it here.
 *
 * @param {string} _title    - (unused) kept for signature compatibility
 * @param {string} _language - (unused) kept for signature compatibility
 * @returns {string} Always "solve"
 */
function deriveFunctionName(_title, _language) {
    return "solve";
}

/**
 * Infer parameter names and types from the problem's examples.
 * Returns { params, returnType } with language-appropriate type annotations.
 */
function inferSignature(problem, language) {
    const params = [];
    let returnType = "void";

    if (problem.examples && problem.examples.length > 0) {
        const firstExample = problem.examples[0];

        // Infer params from input keys
        if (firstExample.input && typeof firstExample.input === "object" && !Array.isArray(firstExample.input)) {
            for (const [key, value] of Object.entries(firstExample.input)) {
                params.push({ name: key, type: inferType(value, language) });
            }
        }

        // Infer return type from output
        if (firstExample.output !== undefined && firstExample.output !== null) {
            returnType = inferType(firstExample.output, language);
        }
    }

    return { params, returnType };
}

/**
 * Map a JS value to a language-specific type string.
 */
function inferType(value, language) {
    if (value === null || value === undefined) return typeMap(language, "any");
    if (typeof value === "boolean") return typeMap(language, "bool");
    if (typeof value === "number") {
        return Number.isInteger(value) ? typeMap(language, "int") : typeMap(language, "float");
    }
    if (typeof value === "string") return typeMap(language, "string");
    if (Array.isArray(value)) {
        if (value.length === 0) return typeMap(language, "intArray");
        const inner = inferType(value[0], language);
        return typeMap(language, "arrayOf", inner);
    }
    return typeMap(language, "any");
}

/**
 * Type name mapper per language.
 */
function typeMap(language, kind, inner) {
    const maps = {
        python: {
            int: "int", float: "float", string: "str", bool: "bool",
            intArray: "List[int]", any: "Any",
            arrayOf: (t) => `List[${t}]`
        },
        java: {
            int: "int", float: "double", string: "String", bool: "boolean",
            intArray: "int[]", any: "Object",
            arrayOf: (t) => {
                if (t === "int") return "int[]";
                if (t === "double") return "double[]";
                if (t === "String") return "String[]";
                return `${t}[]`;
            }
        },
        cpp: {
            int: "int", float: "double", string: "string", bool: "bool",
            intArray: "vector<int>", any: "auto",
            arrayOf: (t) => `vector<${t}>`
        },
        javascript: {
            int: "number", float: "number", string: "string", bool: "boolean",
            intArray: "number[]", any: "any",
            arrayOf: (t) => `${t}[]`
        }
    };

    const langMap = maps[language] || maps.javascript;
    if (kind === "arrayOf" && typeof langMap.arrayOf === "function") {
        return langMap.arrayOf(inner || langMap.int);
    }
    return langMap[kind] || langMap.any;
}

/**
 * Format parameters list for a language signature string.
 */
function formatParams(params, language) {
    if (!params.length) return "";

    switch (language) {
        case "python":
            return params.map(p => `${p.name}: ${p.type}`).join(", ");
        case "java":
            return params.map(p => `${p.type} ${p.name}`).join(", ");
        case "cpp":
            return params.map(p => {
                if (p.type.startsWith("vector") || p.type === "string") {
                    return `${p.type}& ${p.name}`;
                }
                return `${p.type} ${p.name}`;
            }).join(", ");
        case "javascript":
            return params.map(p => p.name).join(", ");
        default:
            return params.map(p => p.name).join(", ");
    }
}

/**
 * Build a simple input format description from examples.
 */
function describeInputFormat(problem) {
    if (!problem.examples || !problem.examples.length) return "Read input as described in the problem.";

    const firstInput = problem.examples[0]?.input;
    if (!firstInput || typeof firstInput !== "object") return "Read input as described in the problem.";

    const lines = [];
    for (const [key, value] of Object.entries(firstInput)) {
        if (Array.isArray(value)) {
            lines.push(`${key}: an array of ${value.length > 0 ? typeof value[0] + "s" : "values"} on one line, space-separated`);
        } else {
            lines.push(`${key}: a single ${typeof value} on one line`);
        }
    }
    return lines.join("; ");
}

/**
 * Build a simple output format description from examples.
 */
function describeOutputFormat(problem) {
    if (!problem.examples || !problem.examples.length) return "Print the result.";

    const firstOutput = problem.examples[0]?.output;
    if (firstOutput === undefined || firstOutput === null) return "Print the result.";

    if (Array.isArray(firstOutput)) return "Print the result array values space-separated on one line.";
    if (typeof firstOutput === "boolean") return "Print true or false.";
    if (typeof firstOutput === "number") return "Print the numeric result.";
    if (typeof firstOutput === "string") return "Print the string result.";
    return "Print the result.";
}

// PLACEHOLDER SUBSTITUTION

/**
 * Fill all {{...}} placeholders in a prompt template with problem-derived values.
 */
function substitutePlaceholders(promptTemplate, placeholders) {
    let result = promptTemplate;
    for (const [key, value] of Object.entries(placeholders)) {
        result = result.replaceAll(`{{${key}}}`, value);
    }
    return result;
}

/**
 * Build the full set of placeholder values from a problem and language.
 */
function buildPlaceholders(problem, language) {
    const functionName = deriveFunctionName(problem.original.title, language);
    const { params, returnType } = inferSignature(problem, language);
    const formattedParams = formatParams(params, language);
    const inputFormat = describeInputFormat(problem);
    const outputFormat = describeOutputFormat(problem);

    return {
        FUNCTION_NAME: functionName,
        PARAMS: formattedParams || "(derive from problem description)",
        RETURN_TYPE: returnType,
        INPUT_FORMAT: inputFormat,
        OUTPUT_FORMAT: outputFormat
    };
}

// SYSTEM PROMPT BUILDER

/**
 * Build the system prompt by taking the verbatim MD prompt for this language
 * and substituting placeholders with problem-specific values.
 */
function buildSystemPrompt(language, problem) {
    const template = LANGUAGE_PROMPTS[language];
    if (!template) return null;

    const placeholders = buildPlaceholders(problem, language);
    return substitutePlaceholders(template, placeholders);
}

// USER PROMPT BUILDER

function buildUserPrompt(problem, language, mode) {
    const parts = [];

    const placeholders = buildPlaceholders(problem, language);

    parts.push(`PROBLEM: ${problem.original.title}`);
    parts.push(`DIFFICULTY: ${problem.difficulty}`);
    parts.push(`TOPIC: ${problem.topic}`);

    // Explicitly tell the model which mode to generate
    const modeLabel = mode === "function" ? "function" : "program";
    parts.push(`\nMODE: ${modeLabel}`);
    parts.push(`This problem is ${mode === "function" ? "function-style (tests will call the function directly)" : "program-style (stdin → stdout)"}.`);

    parts.push(`\nFUNCTION NAME: ${placeholders.FUNCTION_NAME} (REQUIRED — the judge harness calls this exact name)`);
    parts.push(`PARAMETERS: ${placeholders.PARAMS}`);
    parts.push(`RETURN TYPE: ${placeholders.RETURN_TYPE}`);

    if (mode === "program") {
        parts.push(`INPUT FORMAT: ${placeholders.INPUT_FORMAT}`);
        parts.push(`OUTPUT FORMAT: ${placeholders.OUTPUT_FORMAT}`);
    }

    parts.push(`\nDESCRIPTION:\n${problem.original.description}`);

    if (problem.examples && Array.isArray(problem.examples) && problem.examples.length > 0) {
        parts.push("\nEXAMPLES:");
        for (let i = 0; i < Math.min(problem.examples.length, 2); i++) {
            const ex = problem.examples[i];
            parts.push(`  Input: ${JSON.stringify(ex.input)}`);
            parts.push(`  Output: ${JSON.stringify(ex.output)}`);
        }
    }

    if (problem.constraints && Array.isArray(problem.constraints)) {
        parts.push(`\nCONSTRAINTS:\n${problem.constraints.map(c => `  - ${c}`).join("\n")}`);
    }

    // Critical: enforce blank template rules 
    parts.push(`\nCRITICAL RULES:`);
    parts.push(`- The function MUST be named '${placeholders.FUNCTION_NAME}'.`);
    parts.push(`- Do NOT implement any solution logic. The function body must be empty — use \`pass\` (Python), \`return\` with a default value (JS/Java/C++), or \`/* implement */\` placeholder only.`);
    parts.push(`- Do NOT include hints, algorithm steps, or guiding comments inside the function body.`);
    parts.push(`- Include ONLY: the correct function signature, a short docstring/comment describing inputs and expected output, and a placeholder body.`);
    parts.push(`- The user will implement the solution themselves.`);

    parts.push(`\nGenerate the ${mode}-style starter code. Output ONLY the source code — no explanations, no example runs, no tests.`);

    return parts.join("\n");
}

// CODE CLEANUP

/**
 * Clean AI-generated code: strip markdown fences, normalize whitespace.
 */
function cleanCode(raw) {
    if (!raw || typeof raw !== "string") return null;

    let code = raw.trim();

    // Strip markdown fences: ```python ... ```, ```java ... ```, etc
    code = code.replace(/^```[\w]*\s*\n?/i, "").replace(/\n?\s*```$/i, "").trim();

    // Strip any leading prose before the first code line
    const lines = code.split("\n");
    let startIdx = 0;
    for (let i = 0; i < Math.min(lines.length, 3); i++) {
        const line = lines[i].trim();
        if (line && !line.startsWith("#") && !line.startsWith("//") &&
            !line.startsWith("import") && !line.startsWith("from") &&
            !line.startsWith("def ") && !line.startsWith("class ") &&
            !line.startsWith("function") && !line.startsWith("/**") &&
            !line.startsWith("/*") && !line.startsWith("*") &&
            !line.startsWith("#include") && !line.startsWith("using") &&
            !line.startsWith("const ") && !line.startsWith("let ") &&
            !line.startsWith("var ") && !line.startsWith("public") &&
            !line.startsWith("int ") && !line.startsWith("void ") &&
            !line.startsWith("vector") && !line.startsWith("string") &&
            !line.startsWith("bool") && !line.startsWith("'use strict'") &&
            !line.match(/^[A-Za-z_]+\s*\(/) &&
            line.match(/^[A-Z].*[.!:]$/)) {
            startIdx = i + 1;
        } else {
            break;
        }
    }
    if (startIdx > 0) {
        code = lines.slice(startIdx).join("\n").trim();
    }

    // Ensure trailing newline
    if (!code.endsWith("\n")) code += "\n";

    return code;
}

// VALIDATION

/**
 * Check that the starter code has the correct `solve` function with
 * problem-specific parameters — not a bare no-param stub.
 *
 * Returns true if the code is a broken/unusable stub.
 */
function isMalformedStub(code, language) {
    if (!code) return true;

    // Reject stubs that have NO parameters at all (bare `solve()`)
    // These are useless because the judge passes arguments to solve(...)
    if (language === "python" && /def solve\(\s*\):/.test(code)) return true;
    if (language === "java" && /solve\(\s*\)\s*\{/.test(code)) return true;
    if (language === "cpp" && /solve\(\s*\)\s*\{/.test(code)) return true;
    if (language === "javascript" && /function solve\(\s*\)\s*\{/.test(code)) return true;

    return false;
}

/**
 * Detect if the LLM accidentally included solution logic in what should
 * be a blank template. We look for patterns that indicate actual algorithm
 * implementation rather than a placeholder body.
 *
 * Returns an issue string if solution logic is detected, or null if clean.
 */
function detectSolutionLogic(code, language) {
    if (!code) return null;

    // Count substantive logic lines (excluding blanks, comments, signatures,
    // imports, braces, return defaults, pass, docstrings)
    const lines = code.split("\n");
    let logicLines = 0;

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        // Skip comment-only lines
        if (line.startsWith("//") || line.startsWith("#") || line.startsWith("*") ||
            line.startsWith("/*") || line.startsWith("*/") || line.startsWith("/**") ||
            line.startsWith('"""') || line.startsWith("'''")) continue;

        // Skip imports / includes / using
        if (line.startsWith("import ") || line.startsWith("from ") ||
            line.startsWith("#include") || line.startsWith("using namespace")) continue;

        // Skip structural lines (signatures, braces, class declarations)
        if (line.startsWith("def ") || line.startsWith("function ") ||
            line.startsWith("public ") || line.startsWith("class ") ||
            line === "{" || line === "}" || line === "};" ||
            line.startsWith("if __name__") || line.startsWith("int main") ||
            line.startsWith("'use strict'") || line.startsWith('"use strict"')) continue;

        // Skip placeholder bodies
        if (line === "pass" || line === "pass;" ||
            line.startsWith("return null") || line.startsWith("return None") ||
            line.startsWith("return 0") || line.startsWith("return false") ||
            line.startsWith("return True") || line.startsWith("return False") ||
            line.startsWith("return \"\"") || line.startsWith("return ''") ||
            line.startsWith("return []") || line.startsWith("return {}") ||
            line.startsWith("return new int") || line.startsWith("return new String") ||
            line === "return;" || line === "return 0;") continue;

        // Skip stdin boilerplate patterns (these are OK in program-mode)
        if (line.startsWith("BufferedReader") || line.startsWith("StringTokenizer") ||
            line.startsWith("Scanner") || line.includes("readFileSync") ||
            line.includes("sys.stdin") || line.includes("cin >>") ||
            line.includes("cin.tie") || line.includes("ios::sync_with_stdio") ||
            line.includes("br.readLine") || line.includes("st.nextToken") ||
            line.includes("parseInt") || line.includes("data.split") ||
            line.includes("input()") || line.includes("int(data") ||
            line.includes("Number(data") || line.includes("console.log") ||
            line.includes("System.out") || line.includes("cout <<") ||
            line.includes("print(") || line.includes("result =") ||
            line.includes("solve(")) continue;

        // Skip module.exports boilerplate
        if (line.includes("module.exports") || line.includes("typeof module")) continue;

        // Anything else is logic — count it
        logicLines++;
    }

    // Heuristic: if there are more than 3 substantive logic lines inside the
    // solve function, the LLM likely implemented something
    if (logicLines > 3) {
        return `detected ${logicLines} lines of potential solution logic — starter template should be blank`;
    }

    // Check for obvious algorithm patterns
    const algorithmPatterns = [
        /\bfor\s*\(.+;.+;.+\)/,           // C-style for loop with logic
        /\bwhile\s*\(.+\)\s*\{/,           // while loop with condition
        /\bfor\s+\w+\s+in\s+/,             // Python for-in with iteration
        /\.sort\(/, /\.push\(/, /\.append\(/,  // collection mutations
        /\bHashMap\b/, /\bHashSet\b/,       // data structure usage
        /\bMap\(\)/, /\bSet\(\)/,           // JS data structures
        /\bdict\(\)/, /\bset\(\)/,          // Python data structures
        /\bunordered_map\b/,                // C++ data structures
        /\bdp\[/, /\bmemo\[/,              // DP patterns
    ];

    for (const pattern of algorithmPatterns) {
        if (pattern.test(code)) {
            // Only flag if it appears INSIDE the solve function, not in stdin boilerplate
            // Simple check: is it between the function signature and the closing?
            return `detected algorithm pattern ${pattern} — starter template should not contain solution logic`;
        }
    }

    return null;
}

/**
 * Validate mode-specific structural rules.
 * Returns an issue string if validation fails, or null if OK.
 */
function validateModeStructure(code, language, mode) {
    if (!code) return "empty code";

    if (mode === "function") {
        // function-mode should NOT have main/runner blocks
        if (language === "python" && code.includes("if __name__")) {
            return "function-mode should not include if __name__ block";
        }
        if (language === "java" && /public\s+static\s+void\s+main\s*\(/.test(code)) {
            return "function-mode should not include main method";
        }
        if (language === "cpp" && /\bint\s+main\s*\(/.test(code)) {
            return "function-mode should not include main()";
        }
        if (language === "javascript" && (code.includes("readFileSync") || code.includes("process.stdin"))) {
            return "function-mode should not include stdin reading";
        }
    }

    if (mode === "program") {
        // program-mode SHOULD have main/runner blocks
        if (language === "python" && !code.includes("if __name__") && !code.includes("sys.stdin") && !code.includes("input(")) {
            return "program-mode should include a main runner or stdin reading";
        }
        if (language === "java" && !/public\s+static\s+void\s+main\s*\(/.test(code)) {
            return "program-mode should include main method";
        }
        if (language === "cpp" && !/\bint\s+main\s*\(/.test(code)) {
            return "program-mode should include main()";
        }
        if (language === "javascript" && !code.includes("readFileSync") && !code.includes("process.stdin")) {
            return "program-mode should include stdin reading";
        }
    }

    // Verify the function is named 'solve'
    const solvePatterns = {
        python: /def solve\s*\(/,
        java: /\bsolve\s*\(/,
        cpp: /\bsolve\s*\(/,
        javascript: /function solve\s*\(/
    };
    const pattern = solvePatterns[language];
    if (pattern && !pattern.test(code)) {
        return "function must be named 'solve' for JudgeO compatibility";
    }

    // Safety checks across all modes
    const dangerousPatterns = [
        /\bos\.system\b/, /\bsubprocess\b/, /\bchild_process\b/,
        /\bSocket\b/, /\bServerSocket\b/, /\bRuntime\.getRuntime\b/,
        /\bfork\b/, /\bexec[lv]?p?\b/,
    ];
    for (const pat of dangerousPatterns) {
        if (pat.test(code)) {
            return `code contains potentially dangerous pattern: ${pat}`;
        }
    }

    return null; // OK
}

// MAIN GENERATION FUNCTION

/**
 * Generate a blank starter code template for a problem in a specific
 * language and mode. The template contains the correct function signature,
 * a short docstring, and an empty body — no solution logic, no hints.
 * The user implements the solution themselves.
 *
 * @param {Object} problem   - Enriched problem object with original, difficulty, topic, examples, constraints
 * @param {string} language  - Target language: "python", "java", "cpp", "javascript"
 * @param {string} [mode="function"] - "function" (callable, no main) or "program" (stdin→stdout with main)
 * @returns {string|null}    - The generated starter code, or null on failure
 */
export async function generateStarterCode(problem, language, mode = "function") {
    // Validate mode
    if (!VALID_MODES.includes(mode)) {
        log.warn(`[StarterCode] Invalid mode '${mode}', falling back to 'function'.`);
        mode = "function";
    }

    const systemPrompt = buildSystemPrompt(language, problem);
    if (!systemPrompt) {
        log.warn(`[StarterCode] Unsupported language: ${language}`);
        return null;
    }

    const userPrompt = buildUserPrompt(problem, language, mode);

    // Attempt 1: Direct generation 
    try {
        const completion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.3,
            max_tokens: 1000
        });

        const rawContent = completion.choices[0]?.message?.content || null;
        if (rawContent) {
            const code = cleanCode(rawContent);
            if (code && !isMalformedStub(code, language)) {
                const structureIssue = validateModeStructure(code, language, mode);
                if (structureIssue) {
                    log.warn(`[StarterCode] Attempt 1 structural issue for ${problem.problemId}:${language}:${mode} — ${structureIssue}, retrying...`);
                } else {
                    const solutionIssue = detectSolutionLogic(code, language);
                    if (solutionIssue) {
                        log.warn(`[StarterCode] Attempt 1 for ${problem.problemId}:${language}:${mode} — ${solutionIssue}, retrying...`);
                    } else {
                        return code;
                    }
                }
            } else {
                log.warn(`[StarterCode] Attempt 1 produced malformed stub for ${problem.problemId}:${language}:${mode}, retrying...`);
            }
        }
    } catch (error) {
        log.warn(`[StarterCode] Attempt 1 failed for ${problem.problemId}:${language}:${mode}: ${error.message}`);
    }

    // Attempt 2: Retry with reinforced blank-template rules 
    try {
        const modeReminder = mode === "function"
            ? "IMPORTANT: This is a FUNCTION-STYLE problem. Do NOT include any main() runner, if __name__ block, or stdin reading. Output only the function signature with a placeholder body."
            : "IMPORTANT: This is a PROGRAM-STYLE problem (stdin → stdout). You MUST include a main/runner block that reads from stdin and prints to stdout. The solve() function above main must have an EMPTY body — do not implement the solution.";

        const completion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                {
                    role: "user",
                    content: userPrompt +
                        `\n\n${modeReminder}` +
                        `\n\nREMINDER: The function MUST be named 'solve'. The function body must be BLANK — no solution logic, no algorithm, no hints, no comments explaining how to solve it. Just the signature, a short docstring describing inputs/outputs, and a placeholder return (pass, return [], return 0, etc.).` +
                        `\n\nOutput ONLY the source code — no explanations, no example runs, no tests.`
                }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.4,
            max_tokens: 1000
        });

        const rawContent = completion.choices[0]?.message?.content || null;
        if (rawContent) {
            const code = cleanCode(rawContent);
            if (code) {
                const structureIssue = validateModeStructure(code, language, mode);
                if (structureIssue) {
                    log.warn(`[StarterCode] Attempt 2 structural issue for ${problem.problemId}:${language}:${mode} — ${structureIssue}. Returning code anyway.`);
                }
                const solutionIssue = detectSolutionLogic(code, language);
                if (solutionIssue) {
                    log.warn(`[StarterCode] Attempt 2 for ${problem.problemId}:${language}:${mode} — ${solutionIssue}. Returning code anyway.`);
                }
                return code;
            }
        }
    } catch (retryError) {
        log.warn(`[StarterCode] Attempt 2 also failed for ${problem.problemId}:${language}:${mode}: ${retryError.message}`);
    }

    return null;
}

// EXPORTED HELPERS (for external use / testing)

export {
    deriveFunctionName,
    inferSignature,
    formatParams,
    describeInputFormat,
    describeOutputFormat,
    buildPlaceholders,
    substitutePlaceholders,
    cleanCode,
    isMalformedStub,
    detectSolutionLogic,
    validateModeStructure,
    VALID_MODES,
    LANGUAGE_PROMPTS
};