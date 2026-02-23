# Narration Converter – CrackCode Content Generator

The **Narration Converter** is a Node.js–based content generation tool developed for the **CrackCode** gamified learning platform. It transforms raw programming questions from CSV datasets into structured, narrative-driven, multi-language challenges for the CrackCode ecosystem.

The generator operates independently as an offline content preparation tool, ensuring data is ready for both the backend and frontend.

---

## 🚀 Core Capabilities
* **Story-driven question narration** for immersive learning.
* **Multi-language variants** (Python, Java, C++, JavaScript) per question.
* **AI-powered narrative refinement** using LLMs for enhanced storytelling.
* **Bloom’s Taxonomy** tagging for educational tracking.
* **Mode-based selection** (Learn vs. Challenge).
* **Registry-based prevention** of duplicate content across runs.

---

## ✨ Key Features

### 📖 Narrative Question Generation
Converts plain logic problems into engaging stories. Each programming language follows a distinct thematic arc:

| Language | Narrative Theme |
| :--- | :--- |
| **Python** | Detective / Noir storyline |
| **Java** | Cyber-security / Enterprise storyline |
| **C++** | Pirate / High-seas adventure |
| **JavaScript** | Modern Quest / Web-space adventure |

> **Note:** The narrative only affects the flavor text; problem logic remains identical across all versions.

### 🤖 AI Narrative Refinement
The tool integrates an **AI refinement layer** powered by **Groq's LLaMA 3.3 70B** model to polish narrative titles and descriptions. This optional feature enhances storytelling while preserving technical accuracy.

**Personas Supported:**
- **Detective (Noir)** – Gritty, mysterious (Python storylines)
- **Pirate (High Seas)** – Adventure, risk-taking (C++ storylines)
- **Cyberpunk (Hacker)** – Dystopian, neon-lit (Java storylines)
- **Spy (Secret Agent)** – Sleek, tactical (JavaScript storylines)
- **Generic Mentor** – Clean, neutral, encouraging

**Key Features:**
- Difficulty-aware tone adjustment (Easy: encouraging, Medium: focused, Hard: high-stakes)
- Preserves coding task, constraints, and technical details
- Automatic fallback to original content if refinement fails
- Rate-limited API calls (30 requests/min) with retry logic

**Enable with:** `--ai` or `--ai-refine` flag

### 🛠️ Mode Selection
1. **Learn Mode**: Generates a stable set of 45 questions (15 Easy, 15 Medium, 15 Hard) to build structured roadmaps.
2. **Challenge Mode**: Focuses on advanced practice with **Hard** questions only, released in phased batches (e.g., 30 per phase).

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
│   ├── loaders/        # CSV loading & parsing
│   ├── normalizer/     # Data cleaning & normalization
│   ├── classifier/     # Topic & Bloom classification
│   ├── selector/       # Learn & Challenge selection logic
│   ├── narrative/      # Story and template engines
│   ├── refinement/     # AI refinement engine
│   ├── registry/       # Registry Read/Write handlers
│   └── utils/          # Shared utility helpers
├── package.json
└── README.md
```

Key files:
- CLI: [src/cli/generate.js](src/cli/generate.js)  
- AI Refinement: [src/refinement/refinerEngine.js](src/refinement/refinerEngine.js)  
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
```

**API Key Setup:**
1. Sign up at [Groq Console](https://console.groq.com)
2. Generate an API key
3. Add `GROQ_API_KEY` to your `.env` file

The CLI will use these defaults when flags are omitted.

---
## 🏃 Execution Commands

The program supports two main execution styles: Shortcuts for common tasks and Manual Flags for full control.

### 1. Shortcut Commands
Add short npm scripts (example to paste into the `scripts` object in [package.json](package.json)):
```json
"scripts": {
	"generate": "node src/cli/generate.js",
	"gen:learn": "node src/cli/generate.js -- --mode learn",
	"gen:learn:reset": "node src/cli/generate.js -- --mode learn --reset-registry",
	"gen:challenge": "node src/cli/generate.js -- --mode challenge"
}
```
Examples (using defaults from `.env` or passing dataset):
```bash
npm run gen:learn
npm run gen:learn:reset -- --dataset datasetA
npm run gen:challenge -- --dataset datasetA --phase 1

# With AI refinement enabled
npm run gen:learn -- --ai
npm run gen:challenge -- --dataset datasetA --phase 1 --ai-refine
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

## 🚩 Command Flag Reference

- `-d`, `--dataset` : The dataset name (e.g., `datasetA`, `leetcode`).  
- `-i`, `--input` : Path to the CSV file (inferred from dataset if omitted).  
- `-m`, `--mode` : `learn` or `challenge`.  
- `-p`, `--phase` : Challenge phase number (default `1`).  
- `--ai`, `--ai-refine` : Enable AI narrative refinement (requires `GROQ_API_KEY`).  
- `-R`, `--reset-registry` : Clears full usage registry.  
- `-rl`, `--reset-learn-only` : Clears only Learn mode history.  
- `-rc`, `--reset-challenges-only` : Clears only Challenge mode history.

## 📁 Program Structure & Logic (summary)

- Learn Mode: Balanced roadmap — 15 Easy, 15 Medium, 15 Hard. Avoids repeats via registry.  
- Challenge Mode: Produces Hard questions only, split into phases (30 per phase). Ensures no overlap with Learn or past phases.  
- Narrative Generation: Creates language variants for Python, Java, C++, and JavaScript.  
- Registry: `data/registry/usage_registry.json` tracks used questions to prevent duplicates unless manually reset.

## Outputs

- Learn output: `data/output/learn_programming.json` — 45 questions (15 Easy, 15 Medium, 15 Hard).  
- Challenge output: `data/output/challenges_phase_X.json` — 30 Hard questions per phase.  
- Registry file: `data/registry/usage_registry.json` prevents duplicates across runs.

## Tips to Shorten Workflow Further

- Add dataset-specific npm scripts (e.g., `gen:learn:datasetA`) in [package.json](package.json) for one-command runs.  
- Create an optional tiny wrapper CLI `src/cli/short.js` that maps short aliases (`l`, `c`) to full flags so you can run `npm run nc -- l datasetA r`.  
- Use defaults in `.env` so `npm run gen:learn` is sufficient for most runs.

## Developer Notes & Optimizations

- The CLI forwards extra flags after `--` to the script; use that to override defaults.  
- **AI Rate Limiting:** The refiner enforces 1 request per 2 seconds (30 RPM max) to respect Groq API limits.  
- For large CSVs, prefer streaming parsing (`csv-parser` stream) and JSONL outputs to reduce memory.  
- Use an in-memory registry cache with batched writes to reduce disk I/O and speed repeated runs.  
- Consider worker threads for CPU-bound classification/narrative generation and lazy language-variant generation to parallelize work.

---

## 🗺️ Future Enhancements

📊 **Difficulty Re-scoring:** Dynamic difficulty adjustment based on complexity analysis.  
☁️ **Cloud Integration:** Direct export to MongoDB for seamless platform updates.  
🎯 **Custom Persona Editor:** UI-based tool to create and manage custom narrative personas.  
🔍 **Analytics Dashboard:** Track question usage, difficulty distribution, and engagement metrics.
