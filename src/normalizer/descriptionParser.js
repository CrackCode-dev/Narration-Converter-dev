function stripHtml(text) {
  if (!text) return "";

  let cleaned = text;

  // Normalize line endings first (\r\n → \n)
  cleaned = cleaned.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Replace <br>, <br/>, <br /> with newlines
  cleaned = cleaned.replace(/<br\s*\/?>/gi, "\n");

  // Replace </p>, </div>, </li> with newlines (block-level closers)
  cleaned = cleaned.replace(/<\/(p|div|li)>/gi, "\n");

  // Replace <li> with "- " for list items
  cleaned = cleaned.replace(/<li>/gi, "- ");

  // Replace <sup> tags: e.g., 10<sup>4</sup> → 10^4
  cleaned = cleaned.replace(/<sup>(.*?)<\/sup>/gi, "^$1");

  // Replace <sub> tags: e.g., a<sub>i</sub> → a_i
  cleaned = cleaned.replace(/<sub>(.*?)<\/sub>/gi, "_$1");

  // Replace <code> and <pre> tags — keep content
  cleaned = cleaned.replace(/<\/?(code|pre|strong|b|em|i|u|span|ul|ol|a|img|table|tr|td|th|thead|tbody|font)[^>]*>/gi, "");

  // Remove any remaining tags
  cleaned = cleaned.replace(/<[^>]+>/g, "");

  // Decode common HTML entities
  cleaned = cleaned.replace(/&lt;/g, "<");
  cleaned = cleaned.replace(/&gt;/g, ">");
  cleaned = cleaned.replace(/&amp;/g, "&");
  cleaned = cleaned.replace(/&nbsp;/g, " ");
  cleaned = cleaned.replace(/&quot;/g, '"');
  cleaned = cleaned.replace(/&#39;/g, "'");
  cleaned = cleaned.replace(/&le;/g, "<=");
  cleaned = cleaned.replace(/&ge;/g, ">=");

  // Strip markdown backticks (inline code markers)
  cleaned = cleaned.replace(/`/g, "");

  // Collapse excessive whitespace (but preserve intentional newlines)
  cleaned = cleaned.replace(/[ \t]+/g, " ");
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  return cleaned.trim();
}


function stripMarkdown(text) {
  if (!text) return text;
  return text.replace(/`/g, "").trim();
}


function findConstraintStart(text) {
  const match = text.match(/(?:^|\n)\s*Constraints\s*:/i);
  return match ? match.index : -1;
}


function extractExamples(text) {
  const examples = [];

  // Find where constraints section begins - hard boundary for examples
  const constraintStart = findConstraintStart(text);

  // Strategy 1: Match "Example N:" blocks 
  const exampleBlockRegex = /Example\s*\d*\s*:/gi;
  const splitPoints = [];
  let match;

  while ((match = exampleBlockRegex.exec(text)) !== null) {
    // Don't pick up "Example" references inside the constraints section
    if (constraintStart !== -1 && match.index >= constraintStart) break;
    splitPoints.push(match.index);
  }

  if (splitPoints.length > 0) {
    for (let i = 0; i < splitPoints.length; i++) {
      const start = splitPoints[i];
      // End boundary: next example, or constraints section, or end of text
      let end = splitPoints[i + 1] || text.length;
      if (constraintStart !== -1 && end > constraintStart) {
        end = constraintStart;
      }
      const block = text.slice(start, end);

      const example = parseExampleBlock(block);
      if (example) examples.push(example);
    }
  }

  // Strategy 2: Look for Input/Output pairs without "Example:" headers 
  if (examples.length === 0) {
    const ioRegex = /Input\s*:\s*(.*?)(?:\n|$)\s*Output\s*:\s*(.*?)(?:\n|$)(?:\s*Explanation\s*:\s*(.*?)(?:\n\n|\n(?=Input)|$))?/gis;
    let ioMatch;

    while ((ioMatch = ioRegex.exec(text)) !== null) {
      // Don't extract past constraints
      if (constraintStart !== -1 && ioMatch.index >= constraintStart) break;

      examples.push(normalizeExample({
        input: ioMatch[1].trim(),
        output: ioMatch[2].trim(),
        explanation: ioMatch[3] ? cleanExplanation(ioMatch[3].trim()) : null
      }));
    }
  }

  return examples.length > 0 ? examples : null;
}


function parseExampleBlock(block) {
  const inputMatch = block.match(/Input\s*:\s*(.*?)(?=\s*Output\s*:)/is);
  const outputMatch = block.match(/Output\s*:\s*(.*?)(?=\s*Explanation\s*:|\s*\n\s*\n|$)/is);

  // For explanation: use a regex that stops at Constraints, double-newline, or end
  const explanationMatch = block.match(/Explanation\s*:\s*(.*?)(?=\s*Constraints\s*:|\n\n|$)/is);

  if (!inputMatch && !outputMatch) return null;

  const rawExplanation = explanationMatch ? explanationMatch[1].trim() : null;

  return normalizeExample({
    input: inputMatch ? inputMatch[1].trim() : null,
    output: outputMatch ? outputMatch[1].trim() : null,
    explanation: cleanExplanation(rawExplanation)
  });
}

/**
 * Clean an explanation string by removing any constraint content that bled in.
 */
function cleanExplanation(explanation) {
  if (!explanation) return null;

  let cleaned = explanation;

  // Truncate at "Constraints:" if it somehow still appears
  const constraintIdx = cleaned.search(/Constraints\s*:/i);
  if (constraintIdx !== -1) {
    cleaned = cleaned.slice(0, constraintIdx).trim();
  }

  // Strip trailing \r\n noise
  cleaned = cleaned.replace(/[\r\n]+$/, "").trim();

  return cleaned || null;
}


function normalizeExample(example) {
  return {
    input: parseInputString(example.input),
    output: parseValueString(example.output),
    explanation: example.explanation || null
  };
}


export function parseInputString(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "string") return raw;

  const text = raw.trim();
  if (!text) return null;

  // Quick check: does it look like "key = value" assignments?
  if (!text.includes("=")) {
    // It might be a bare value like "[1,2,3]" or "5"
    return parseValueString(text);
  }

  const result = {};
  let remaining = text;
  let parsedAny = false;

  while (remaining.length > 0) {
    remaining = remaining.replace(/^[\s,]+/, ""); // strip leading commas/spaces
    if (!remaining) break;

    // Match key name
    const keyMatch = remaining.match(/^(\w+)\s*=\s*/);
    if (!keyMatch) break;

    const key = keyMatch[1];
    remaining = remaining.slice(keyMatch[0].length);

    // Determine value boundaries
    let value;

    if (remaining.startsWith("[")) {
      // Array value — find the matching closing bracket
      const endIdx = findMatchingBracket(remaining, 0, "[", "]");
      if (endIdx !== -1) {
        const arrayStr = remaining.slice(0, endIdx + 1);
        value = tryParseJson(arrayStr);
        remaining = remaining.slice(endIdx + 1);
      } else {
        break;
      }
    } else if (remaining.startsWith("{")) {
      // Object value
      const endIdx = findMatchingBracket(remaining, 0, "{", "}");
      if (endIdx !== -1) {
        const objStr = remaining.slice(0, endIdx + 1);
        value = tryParseJson(objStr);
        remaining = remaining.slice(endIdx + 1);
      } else {
        break;
      }
    } else if (remaining.startsWith('"')) {
      // Quoted string
      const endQuote = remaining.indexOf('"', 1);
      if (endQuote !== -1) {
        value = remaining.slice(1, endQuote);
        remaining = remaining.slice(endQuote + 1);
      } else {
        break;
      }
    } else {
      // Scalar value - read until next comma + key pattern, or end
      const nextKeyMatch = remaining.match(/,\s*(\w+)\s*=/);
      if (nextKeyMatch) {
        const scalarStr = remaining.slice(0, nextKeyMatch.index).trim();
        value = parseScalar(scalarStr);
        remaining = remaining.slice(nextKeyMatch.index);
      } else {
        value = parseScalar(remaining.trim());
        remaining = "";
      }
    }

    result[key] = value;
    parsedAny = true;
  }

  return parsedAny ? result : raw;
}


export function parseValueString(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "string") return raw;
  return parseScalar(raw.trim());
}

/**
 * Parse a scalar string to its natural type.
 */
function parseScalar(s) {
    const lower = s.toLowerCase();
  if (lower === "true") return true;
  if (lower === "false") return false;
  if (lower === "null" || lower === "none") return null;

  // Try as number
  if (/^-?\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n)) return n;
  }

  // Try as JSON (arrays, objects)
  const parsed = tryParseJson(s);
  if (parsed !== undefined) return parsed;

  // Strip surrounding quotes if present
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }

  return s;
}

/**
 * Try to parse a string as JSON. Returns undefined on failure.
 */
function tryParseJson(s) {
  try {
    return JSON.parse(s);
  } catch (e) {
    // Handle Python-style strings with single quotes: ['a','b'] → ["a","b"]
    try {
      const fixed = s.replace(/'/g, '"');
      return JSON.parse(fixed);
    } catch (e2) {
      return undefined;
    }
  }
}


function findMatchingBracket(text, startIdx, openChar, closeChar) {
  let depth = 0;
  let inString = false;
  let stringChar = null;

  for (let i = startIdx; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (ch === stringChar && text[i - 1] !== "\\") {
        inString = false;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = true;
      stringChar = ch;
      continue;
    }

    if (ch === openChar) depth++;
    if (ch === closeChar) {
      depth--;
      if (depth === 0) return i;
    }
  }

  return -1;
}


function extractConstraints(text) {
  const constraintHeaderRegex = /Constraints\s*:\s*\n?/i;
  const headerMatch = text.match(constraintHeaderRegex);

  if (!headerMatch) return null;

  const startIdx = headerMatch.index + headerMatch[0].length;

  // Find where constraints section ends
  const endMarkers = /(?:^|\n)\s*(?:Follow[\s-]?up|Note|Hint|Related Topics|Similar Questions|Example\s*\d*\s*:)/i;
  const afterConstraints = text.slice(startIdx);
  const endMatch = afterConstraints.match(endMarkers);
  const constraintText = endMatch
    ? afterConstraints.slice(0, endMatch.index)
    : afterConstraints;

  // Parse individual constraints, strip backticks and markdown
  const lines = constraintText
    .split("\n")
    .map(line => {
      let clean = line.replace(/^[\s\-\*•·]+/, "").trim();
      clean = stripMarkdown(clean);
      return clean;
    })
    .filter(line => line.length > 0);

  return lines.length > 0 ? lines : null;
}


function extractCleanDescription(text) {
  const sectionStart = text.match(/(?:Example\s*\d*\s*:|Constraints\s*:)/i);

  if (!sectionStart) return text.trim();

  return text.slice(0, sectionStart.index).trim();
}


export function parseDescription(rawDescription) {
  if (!rawDescription) {
    return { cleanDescription: "", examples: null, constraints: null };
  }

  const text = stripHtml(rawDescription);

  const examples = extractExamples(text);
  const constraints = extractConstraints(text);
  const cleanDescription = extractCleanDescription(text);

  return {
    cleanDescription,
    examples,
    constraints
  };
}

export function hasEmbeddedStructure(description) {
  if (!description) return false;
  const text = typeof description === "string" ? description : String(description);
  return /Example\s*\d*\s*:/i.test(text) || /Constraints\s*:/i.test(text);
}