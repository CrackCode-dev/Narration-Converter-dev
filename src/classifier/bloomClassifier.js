export function detectBloom(text, difficulty) {
  const t = text.toLowerCase();
  const has = (w) => t.includes(w);

  if (has("define") || has("identify") || has("list") || has("what is")) return { level: "Remember", score: 1 };
  if (has("explain") || has("describe") || has("summarize") || has("predict output")) return { level: "Understand", score: 2 };
  if (has("implement") || has("write") || has("solve")) return { level: "Apply", score: 3 };
  if (has("debug") || has("trace") || has("analyze") || has("complexity")) return { level: "Analyze", score: 4 };
  if (has("optimize") || has("justify") || has("compare")) return { level: "Evaluate", score: 5 };
  if (has("design") || has("build")) return { level: "Create", score: 6 };

  // fallback
  if (difficulty === "Easy") return { level: "Understand", score: 2 };
  if (difficulty === "Medium") return { level: "Apply", score: 3 };
  return { level: "Analyze", score: 4 };
}
