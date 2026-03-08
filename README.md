# Narration Converter – CrackCode Content Generator

The **Narration Converter** is a Node.js–based content generation tool developed for the **CrackCode** gamified learning platform. It transforms raw programming questions from CSV datasets into structured, narrative-driven, multi-language challenges for the CrackCode ecosystem.

The generator operates independently as an offline content preparation tool, ensuring data is ready for both the backend and frontend. Generated content can be exported as JSON files or uploaded directly to MongoDB.

---

## 🆕 Recent Updates
* Added a standalone **Upload CLI** (`npm run upload`) to upload existing JSON outputs without regenerating content.
* Added upload filters: `--all`, `--learn`, `--challenge`, `--challenge --phase <N>`, and `--file <path>`.
* Added post-generation upload support via `-u` / `--upload` in the generate flow.
* Added generation overrides for `--language`, `--difficulty`, and `--count`.
* Added output cleanup support with `-clr` / `--clear-outputs`.
* Added scoped registry reset commands: full reset, learn-only reset, and challenge-only reset.
* Upgraded AI refinement with **persona style guides, few-shot conditioning, phrase blacklists, structural enforcement, and JSON repair/retry fallback**.

---

## 🚀 Core Capabilities
* **Story-driven question narration** for immersive learning.
* **Multi-language variants** (Python, Java, C++, JavaScript) per question.
* **AI-powered narrative refinement** using LLMs for enhanced storytelling.
* **Bloom's Taxonomy** tagging for educational tracking.
* **Mode-based selection** (Learn vs. Challenge).
* **Registry-based prevention** of duplicate content across runs.
* **MongoDB upload** with automatic collection routing per mode, language, and difficulty.

---

## ✨ Key Features

### 📖 Narrative Question Generation
Converts plain logic problems into engaging stories. Each programming language follows a distinct thematic arc:

| Language | Narrative Theme |
| :--- | :--- |
| **Python** | Noir Detective storyline |
| **Java** | High Seas Pirate adventure |
| **C++** | Cyberpunk Hacker storyline |
| **JavaScript** | Covert Secret Agent / Spy thriller |

> **Note:** The narrative only affects the flavor text; problem logic remains identical across all versions.

### 🤖 AI Narrative Refinement
The tool integrates an **AI refinement layer** powered by **Groq's LLaMA 3.3 70B** model to polish narrative titles and descriptions. This optional feature enhances storytelling while preserving technical accuracy.

**Personas Supported:**
- **Noir Detective** – Gritty, mysterious, world-weary (Python storylines)
- **Digital Heist Crew** – Slick, confident, tactical (common Java storyline mapping)
- **White Hat Sentinel** – Precise, defensive security tone (common C++ storyline mapping)
- **Covert Secret Agent** – Sleek, cool under pressure, tactical (JavaScript storylines)
- **Helpful Mentor** – Clean, neutral, encouraging (fallback persona)

**Key Features:**
- Difficulty-aware tone adjustment (Easy: encouraging, Medium: focused, Hard: high-stakes)
- Persona-specific style fingerprints (voice, syntax rhythm, metaphor rules) per storyline
- Few-shot persona exemplars to keep title/description quality consistent
- Anti-pattern blacklist + regex AI-ism scrubber for less generic LLM phrasing
- Structural enforcement for 3-part description flow (opening, body, actionable numbered steps)
- Dynamic flavor phrase injection pools for variation without changing task semantics
- Preserves coding task, constraints, and technical details
- Automatic fallback to original content if refinement fails
- Dual-pass resilience: JSON mode call + non-JSON retry with JSON repair extraction
- Rate-limited API calls (30 requests/min)

**Enable with:** `-ai` or `--ai-refine` flag

### 🛠️ Mode Selection
1. **Learn Mode**: Generates a stable set of 45 questions (15 Easy, 15 Medium, 15 Hard) to build structured roadmaps. Supports filtering by difficulty level and language variants.
2. **Challenge Mode**: Releases advanced practice questions in phased batches (e.g., 30 per phase). Contains mixed difficulty levels (Medium and Hard), ensuring no overlap with Learn mode questions.

### ☁️ MongoDB Upload
Generated JSON output files can be uploaded directly to MongoDB, with each file automatically routed to the correct collection based on its content.

**Collection Routing:**

| File Pattern | Target Collection | Example |
| :--- | :--- | :--- |
| `learn_programming_{difficulty}_{language}.json` | `learn{Language}{Difficulty}Q` | `learnPythonEasyQ` |
| `challenges_phase_{N}_{language}.json` | `challenge{Language}Q` | `challengePythonQ` |

**Learn mode** produces up to 12 collections (4 languages × 3 difficulties). Each question is routed based on its difficulty and variant language.

**Challenge mode** produces up to 4 collections (1 per language). All phases are stored in the same collection, with a `phase` field distinguishing them.

**Key behaviors:**
- Uses `findOneAndUpdate` with upsert — safe to re-run without creating duplicates.
- Learn upsert key: `{ problemId }` — one entry per problem per collection.
- Challenge upsert key: `{ problemId, phase }` — same problem can appear in different phases.
- Separate Mongoose schemas for learn (includes `story`) and challenge (includes `beatId`, `phase`).
- Target collection is determined from item data, not filenames.

> **Current behavior note:** The uploader currently routes using the first variant language (`item.variants[0].language`).
> For predictable MongoDB routing, generate/export **single-language batches** (for example `--language python` or `--language java`) before uploading.

---

## 📂 Project Structure
```text
Narration-Converter-dev/
├── data/
│   ├── input/          # Raw CSV datasets (LeetCode, etc.)
│   ├── output/         # Generated JSON production files
│   └── registry/       # Usage registry (JSON tracking)
├── src/
│   ├── cli/            # Command-line interface logic
│   │   ├── generate.js # Main generation CLI
│   │   └── upload.js   # Standalone upload CLI
│   ├── db/             # Database layer
│   │   ├── connection.js   # MongoDB connect/disconnect
│   │   └── models/
│   │       └── question.js # Mongoose schemas + collection router
│   ├── loaders/        # CSV loading & parsing
│   ├── normalizer/     # Data cleaning & normalization
│   ├── classifier/     # Topic & Bloom classification
│   ├── selector/       # Learn & Challenge selection logic
│   ├── narrative/      # Story and template engines
│   ├── refinement/     # AI refinement engine
│   ├── registry/       # Registry Read/Write handlers
│   ├── uploader/       # JSON-to-MongoDB upload logic
│   │   └── uploadFromJson.js
│   └── utils/          # Shared utility helpers
├── config/
│   ├── dataset_mappings/   # Per-dataset column mappings
│   ├── selection_rules.json
│   └── stories.json
├── package.json
└── README.md
```

Key files:
- Generation CLI: [src/cli/generate.js](src/cli/generate.js)
- Upload CLI: [src/cli/upload.js](src/cli/upload.js)
- AI Refinement: [src/refinement/refinerEngine.js](src/refinement/refinerEngine.js)
- DB Connection: [src/db/connection.js](src/db/connection.js)
- Question Schemas: [src/db/models/question.js](src/db/models/question.js)
- Upload Logic: [src/uploader/uploadFromJson.js](src/uploader/uploadFromJson.js)
- Config: [config/selection_rules.json](config/selection_rules.json)
- Package metadata: [package.json](package.json)
- Registry: [data/registry/usage_registry.json](data/registry/usage_registry.json)

---

## ⚙️ Configuration

Create a `.env` file at the repository root to supply local defaults:
```env
DEFAULT_DATASET=datasetA
DEFAULT_INPUT_PATH=data/input/datasetA.csv
DEFAULT_MODE=learn

# AI Refinement (Optional)
GROQ_API_KEY=your_groq_api_key_here

# MongoDB (Required for --upload flag and standalone upload CLI)
MONGO_URI=mongodb://localhost:27017/narration-converter
```

**API Key Setup:**
1. Sign up at [Groq Console](https://console.groq.com)
2. Generate an API key
3. Add `GROQ_API_KEY` to your `.env` file

**MongoDB Setup:**
1. Ensure MongoDB is running locally, or use a MongoDB Atlas connection string
2. Add `MONGO_URI` to your `.env` file
3. Install Mongoose: `npm install mongoose`

The CLI will use these defaults when flags are omitted.

---
## 🏃 Execution Commands

The program supports two main execution styles: Shortcuts for common tasks and Manual Flags for full control.

### 1. Shortcut Commands
Add short npm scripts (example to paste into the `scripts` object in [package.json](package.json)):
```json
"scripts": {
	"generate": "node src/cli/generate.js",
	"upload": "node src/cli/upload.js",
	"gen:learn": "npm run generate -- -m learn",
	"gen:challenge": "npm run generate -- -m challenge"
}
```
Examples (using defaults from `.env` or passing dataset):
```bash
npm run gen:learn
npm run generate -- -m learn --reset-registry --dataset datasetA
npm run gen:challenge -- --dataset datasetA --phase 1

# With AI refinement enabled
npm run gen:learn -- --ai
npm run gen:challenge -- --dataset datasetA --phase 1 --ai-refine

# Generate and upload to MongoDB
npm run gen:learn -- --upload
npm run gen:challenge -- --dataset datasetA --phase 1 --upload
```

### 2. Manual Commands (with Flags)
Use the base `generate` script and pass flags after `--` to override defaults.

- Generate Learn (explicit):
```bash
npm run generate -- --dataset datasetA --input data/input/datasetA.csv --mode learn
```
- Generate Learn and reset registry:
```bash
npm run generate -- --mode learn --reset-registry
```
- Generate Challenge phase 2:
```bash
npm run generate -- --mode challenge --phase 2 --dataset datasetA
```
- Generate with AI refinement:
```bash
npm run generate -- --mode learn --ai
npm run generate -- --mode challenge --phase 1 --ai-refine
```
- Generate and upload to MongoDB:
```bash
npm run generate -- --mode learn --upload
npm run generate -- --mode learn --difficulty Easy --language python --upload
npm run generate -- --mode challenge --phase 1 --upload
```

### 3. Standalone Upload (from existing JSON files)

Upload previously generated output files without re-running generation:

```bash
# Upload all output files (learn + challenge)
npm run upload -- --all

# Upload only learn files
npm run upload -- --learn

# Upload only challenge files (all phases)
npm run upload -- --challenge

# Upload a specific challenge phase
npm run upload -- --challenge --phase 2

# Upload a single specific file
npm run upload -- --file data/output/learn_programming_easy_python.json

# Override output directory
npm run upload -- --all --dir data/output/
```

## 🚩 Command Flag Reference

### Generation Flags (`npm run generate`)

**Core Flags:**
- `-d`, `--dataset` : The dataset name (e.g., `datasetA`, `leetcode`).
- `-i`, `--input` : Path to the CSV file (inferred from dataset if omitted).
- `-m`, `--mode` : `learn` or `challenge`.
- `-p`, `--phase` : Challenge phase number (default `1`).

**Learn Mode Options:**
- `-diff`, `--difficulty` : Filter by difficulty level (`Easy`, `Medium`, or `Hard`) for Learn mode only.
- `-c`, `--count` : Override the number of questions to select (Learn mode only).
- `-lang`, `--language` : Override language selection to generate variants for a specific language.

**AI Refinement:**
- `-ai`, `--ai-refine` : Enable AI narrative refinement (requires `GROQ_API_KEY`).

**Registry Management:**
- `-R`, `--reset-registry` : Clears full usage registry.
- `-rl`, `--reset-learn-only` : Clears only Learn mode history.
- `-rc`, `--reset-challenges-only` : Clears only Challenge mode history.

**Output Management:**
- `-clr`, `--clear-outputs <type>` : Clear previously generated output files.
  - Valid types: `all`, `learn`, `learn:easy`, `learn:medium`, `learn:hard`, `learn:hard:python`, `learn:hard:java`, `learn:hard:cpp`, `learn:hard:javascript`, `challenge:phase<N>`

**Upload:**
- `-u`, `--upload` : Upload generated output files to MongoDB after writing JSON.

**Examples:**
```bash
# Clear all Learn outputs
npm run generate -- -m learn -clr learn

# Clear only Learn Easy outputs
npm run generate -- -m learn -clr learn:easy

# Clear Challenge Phase 1 outputs
npm run generate -- -m challenge -clr challenge:phase1

# Clear all outputs
npm run generate -- -m learn -clr all
```

### Upload Flags (`npm run upload`)

- `-a`, `--all` : Upload all learn + challenge files.
- `-l`, `--learn` : Upload all learn files.
- `-ch`, `--challenge` : Upload all challenge files.
- `-p`, `--phase <N>` : Upload only a specific challenge phase (use with `--challenge`).
- `-f`, `--file <path>` : Upload a single specific file.
- `--dir <path>` : Override output directory (default: `data/output/`).

---

## 📁 Program Structure & Logic (summary)

- **Learn Mode**: Balanced roadmap — 15 Easy, 15 Medium, 15 Hard (or filtered by difficulty). Supports single-language variant generation. Avoids repeats via registry.
- **Challenge Mode**: Produces Medium and Hard questions, split into phases (30 per phase). Supports single-language override and ensures no overlap with Learn-used questions or previous challenge phases.
- **Narrative Generation**: Creates language variants for Python, Java, C++, and JavaScript with story-specific personas.
- **AI Refinement**: Optionally refines narrative titles and descriptions using LLM with rate limiting (max 30 requests/minute).
- **AI Safety & Robustness**: Cleans banned generic phrasing, repairs malformed model JSON, and enforces consistent output structure before persisting.
- **Registry**: `data/registry/usage_registry.json` tracks used questions to prevent duplicates unless manually reset.
- **Upload**: Routes each output JSON file to MongoDB collections using mode, language, and difficulty with upsert semantics. For reliable language-specific routing, use single-language output files.

---

## Outputs

- **Learn output**: `data/output/learn_programming.json` — 45 questions (15 Easy, 15 Medium, 15 Hard) with all language variants.
- **Filtered Learn outputs**: When using `--difficulty` filter, outputs like `data/output/learn_programming_easy.json`, `learn_programming_medium.json`, etc.
- **Language-specific outputs**: When using `--language` filter, outputs like `data/output/learn_programming_hard_python.json`, etc.
- **Challenge output**: `data/output/challenges_phase_X.json` — 30 questions (Medium and Hard mix) per phase with all language variants.
- **Language-specific challenge outputs**: When using `--language` filter, outputs like `data/output/challenges_phase_1_python.json`, etc.
- **Registry file**: `data/registry/usage_registry.json` prevents duplicates across runs and tracks Learn vs. Challenge usage separately.

### MongoDB Collections (when using `--upload`)

**Learn collections** (up to 12):

| Collection | Content |
| :--- | :--- |
| `learnPythonEasyQ` | Easy Python questions |
| `learnPythonMediumQ` | Medium Python questions |
| `learnPythonHardQ` | Hard Python questions |
| `learnJavaEasyQ` | Easy Java questions |
| `learnJavaMediumQ` | Medium Java questions |
| `learnJavaHardQ` | Hard Java questions |
| `learnCppEasyQ` | Easy C++ questions |
| `learnCppMediumQ` | Medium C++ questions |
| `learnCppHardQ` | Hard C++ questions |
| `learnJavascriptEasyQ` | Easy JavaScript questions |
| `learnJavascriptMediumQ` | Medium JavaScript questions |
| `learnJavascriptHardQ` | Hard JavaScript questions |

**Challenge collections** (up to 4):

| Collection | Content |
| :--- | :--- |
| `challengePythonQ` | All phases, Python |
| `challengeJavaQ` | All phases, Java |
| `challengeCppQ` | All phases, C++ |
| `challengeJavascriptQ` | All phases, JavaScript |

---

## Tips to Shorten Workflow Further

- Add dataset-specific npm scripts (e.g., `gen:learn:datasetA`) in [package.json](package.json) for one-command runs.  
- Create an optional tiny wrapper CLI `src/cli/short.js` that maps short aliases (`l`, `c`) to full flags so you can run `npm run nc -- l datasetA r`.  
- Use defaults in `.env` so `npm run gen:learn` is sufficient for most runs.
- Use the `-clr` flag to quickly clean up outputs before generating fresh batches.
- Use `npm run upload -- --all` to bulk-upload existing outputs without regenerating.

---

- The CLI forwards extra flags after `--` to the script; use that to override defaults.  
- **AI Rate Limiting:** The refiner enforces 1 request per 2 seconds (30 RPM max) to respect Groq API limits.  
- For large CSVs, prefer streaming parsing (`csv-parser` stream) and JSONL outputs to reduce memory.  
- Use an in-memory registry cache with batched writes to reduce disk I/O and speed repeated runs.  
- Consider worker threads for CPU-bound classification/narrative generation and lazy language-variant generation to parallelize work.
