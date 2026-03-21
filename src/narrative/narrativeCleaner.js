export function cleanNarrative(narrative) {
  if (!narrative) return narrative;

  return {
    title: narrative.title ? cleanTitle(narrative.title) : narrative.title,
    description: narrative.description ? cleanDescription(narrative.description) : narrative.description
  };
}

/**
 * Clean a narrative title.
 */
function cleanTitle(title) {
  let cleaned = title;

  // Strip trailing JSON artifacts
  cleaned = cleaned.replace(/[\s{}]+$/, "").trim();

  // Strip carriage returns
  cleaned = cleaned.replace(/\r/g, "");

  return cleaned;
}

function cleanDescription(text) {
  let cleaned = text;

  // Step 1: Strip carriage returns 
  cleaned = cleaned.replace(/\r/g, "");

  // Step 2: Remove trailing JSON garbage 
  // Patterns like: \n}}, }}, \n}, }, \\n}}
  cleaned = cleaned.replace(/\\*n?\s*\}{1,2}\s*$/, "");
  cleaned = cleaned.replace(/\}{1,2}\s*$/, "");

  // Step 3: Normalize double-escaped newlines
  // The AI outputs literal "\\n" in the JSON string. After JSON.parse,
  // this becomes the two-character sequence backslash + n in the string,
  // instead of an actual newline character.
  //
  // Pattern: literal backslash followed by 'n' → real newline
  // We need to handle: \\n\\n (double), \\n (single), and mixed with spaces

  // First: collapse patterns like " \\n\\n \\n" or "\\n\\n \\n" to clean double-newline
  cleaned = cleaned.replace(/\s*\\n\s*\\n\s*/g, "\n\n");

  // Then: remaining single \\n → real newline
  cleaned = cleaned.replace(/\s*\\n\s*/g, "\n");

  // ── Step 4: Clean up whitespace artifacts ──
  // Collapse 3+ consecutive newlines to double-newline (section break)
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  // Remove trailing whitespace on each line
  cleaned = cleaned.replace(/[ \t]+$/gm, "");

  // Remove leading whitespace on lines (except intentional indentation)
  cleaned = cleaned.replace(/^[ \t]+/gm, (match) => {
    // Preserve indentation for numbered steps (1-2 spaces is fine)
    return match.length <= 2 ? match : "";
  });

  cleaned = cleaned.replace(/(\d+\.)\s*/g, (match, num) => {
    return num + " ";
  });

  // Ensure each numbered step is on its own line (but not double-spaced)
  // Look for "text. 2." or "text 2." patterns where a step follows inline
  cleaned = cleaned.replace(/([.!?])\s+(\d+\.\s)/g, "$1\n$2");

  // Final trim
  cleaned = cleaned.trim();

  return cleaned;
}

export function cleanVariantNarrative(variant) {
  if (!variant || !variant.narrative) return variant;

  return {
    ...variant,
    narrative: cleanNarrative(variant.narrative)
  };
}