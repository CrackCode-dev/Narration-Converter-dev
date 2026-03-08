import mongoose from "mongoose";

/**
 * ── Collection Routing ──
 *
 * LEARN:     learn{Language}{Difficulty}Q     e.g. learnPythonEasyQ
 * CHALLENGE: challenge{Language}Q             e.g. challengePythonQ
 *
 * The target collection is determined from each item's DATA, not filenames.
 * This handles all filename variations:
 *   learn_programming.json                    (all diffs, all langs)
 *   learn_programming_easy.json               (one diff, all langs)
 *   learn_programming_easy_python.json        (one diff, one lang)
 *   challenges_phase_1.json                   (all langs)
 *   challenges_phase_1_python.json            (one lang)
 */

// ── Shared Variant Sub-Schema ──

const VariantSchema = new mongoose.Schema(
  {
    variantId:   { type: String, required: true },
    language:    { type: String, required: true, enum: ["python", "java", "cpp", "javascript"] },
    storyId:     { type: String, required: true },
    templateId:  { type: String, required: true },
    narrative: {
      title:       { type: String, required: true },
      description: { type: String, required: true }
    },
    starterCode: { type: String, default: "" }
  },
  { _id: false }
);

// ── Learn Question Schema ──

const LearnQuestionSchema = {
  problemId: { type: String, required: true, unique: true, index: true },

  source: {
    dataset:            { type: String, required: true },
    source_question_id: { type: String, required: true }
  },
  original: {
    title:       { type: String, required: true },
    description: { type: String, required: true }
  },

  difficulty: { type: String, required: true, enum: ["Easy", "Medium", "Hard"] },
  topic:      { type: String, required: true },
  bloom: {
    level: { type: String, required: true },
    score: { type: Number, required: true }
  },

  story: {
    chapterId: { type: String, default: null },
    beatId:    { type: String, default: null }
  },

  examples:    { type: mongoose.Schema.Types.Mixed, required: true },
  constraints: { type: mongoose.Schema.Types.Mixed, required: true },
  test_cases:  { type: mongoose.Schema.Types.Mixed, required: true },

  variants: {
    type: [VariantSchema],
    required: true,
    validate: [arr => arr.length > 0, "At least one variant is required."]
  },

  aiRefined:  { type: Boolean, default: false },
  uploadedAt: { type: Date, default: Date.now }
};

// ── Challenge Question Schema ──

const ChallengeQuestionSchema = {
  problemId: { type: String, required: true, index: true },

  source: {
    dataset:            { type: String, required: true },
    source_question_id: { type: String, required: true }
  },
  original: {
    title:       { type: String, required: true },
    description: { type: String, required: true }
  },

  difficulty: { type: String, required: true, enum: ["Medium", "Hard"] },
  topic:      { type: String, required: true },
  bloom: {
    level: { type: String, required: true },
    score: { type: Number, required: true }
  },

  beatId: { type: String, default: null },
  phase:  { type: Number, default: null },

  examples:    { type: mongoose.Schema.Types.Mixed, required: true },
  constraints: { type: mongoose.Schema.Types.Mixed, required: true },
  test_cases:  { type: mongoose.Schema.Types.Mixed, required: true },

  variants: {
    type: [VariantSchema],
    required: true,
    validate: [arr => arr.length > 0, "At least one variant is required."]
  },

  aiRefined:  { type: Boolean, default: false },
  uploadedAt: { type: Date, default: Date.now }
};

// ── Naming Helpers ──

const LANGUAGE_NAMES = {
  python:     "Python",
  java:       "Java",
  cpp:        "Cpp",
  javascript: "Javascript"
};

/**
 * Builds the collection name.
 *
 *   buildCollectionName("learn", "python", "Easy")  → "learnPythonEasyQ"
 *   buildCollectionName("challenge", "java")         → "challengeJavaQ"
 */
export function buildCollectionName(mode, language, difficulty = null) {
  const langPart = LANGUAGE_NAMES[language];
  if (!langPart) throw new Error(`Unknown language: ${language}`);

  if (mode === "learn") {
    if (!difficulty) throw new Error("Learn mode requires a difficulty.");
    return `learn${langPart}${difficulty}Q`;
  }

  return `challenge${langPart}Q`;
}

// ── File Classification ──

/**
 * Checks if a filename is a learn output file.
 * Matches: learn_programming.json, learn_programming_easy.json, learn_programming_easy_python.json
 */
export function isLearnFile(filePath) {
  const baseName = filePath.split("/").pop().split("\\").pop();
  return baseName.startsWith("learn_programming") && baseName.endsWith(".json");
}

/**
 * Checks if a filename is a challenge output file.
 * Matches: challenges_phase_1.json, challenges_phase_1_python.json
 */
export function isChallengeFile(filePath) {
  const baseName = filePath.split("/").pop().split("\\").pop();
  return baseName.startsWith("challenges_phase_") && baseName.endsWith(".json");
}

/**
 * Extracts the phase number from a challenge filename.
 *   "challenges_phase_1_python.json" → 1
 *   "challenges_phase_3.json"        → 3
 */
export function extractPhaseFromFileName(filePath) {
  const baseName = filePath.split("/").pop().split("\\").pop().replace(".json", "");
  const parts = baseName.split("_");
  // ["challenges", "phase", "1", ...] 
  if (parts.length >= 3 && parts[0] === "challenges" && parts[1] === "phase") {
    const phase = parseInt(parts[2], 10);
    if (!isNaN(phase)) return phase;
  }
  return null;
}

// ── Model Cache ──

const modelCache = {};

/**
 * Returns the Mongoose model for a given target collection.
 *
 *   getQuestionModel("learn", "python", "Easy")  → model for "learnPythonEasyQ"
 *   getQuestionModel("challenge", "java")         → model for "challengeJavaQ"
 */
export function getQuestionModel(mode, language, difficulty = null) {
  const collectionName = buildCollectionName(mode, language, difficulty);

  if (modelCache[collectionName]) {
    return modelCache[collectionName];
  }

  const definition = mode === "learn" ? LearnQuestionSchema : ChallengeQuestionSchema;

  const schema = new mongoose.Schema(definition, {
    timestamps: true,
    collection: collectionName
  });

  // Challenge: compound index — same problem can appear in different phases
  if (mode === "challenge") {
    schema.index({ problemId: 1, phase: 1 }, { unique: true });
  }

  const model = mongoose.model(collectionName, schema);
  modelCache[collectionName] = model;

  return model;
}