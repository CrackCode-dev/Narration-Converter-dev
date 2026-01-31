# Narration-Converter-dev

Narration Converter – CrackCode Content Generator
Overview

The Narration Converter is a Node.js–based content generation tool designed for the CrackCode gamified learning platform.
It converts raw programming questions stored in CSV datasets into structured, narrative-based, multi-language questions that can be directly consumed by the CrackCode backend and frontend.

The tool supports:

Story-driven question narration

Multiple programming languages per question

Bloom’s Taxonomy tagging

Difficulty-based selection

Learn and Challenge modes

Registry-based duplicate prevention

Key Features
1. Narrative Question Generation

Converts plain programming questions into story-based descriptions

Supports different storylines per programming language

Python → Detective narrative

Java → Java-specific storyline

C++ → Pirate narrative

JavaScript → Adventure narrative

2. Multi-Language Variants

Each question is generated with:

Python starter code

Java starter code

C++ starter code

JavaScript starter code

All variants share the same test cases and constraints, ensuring consistency across languages.

3. Learn Mode

Generates a fixed learning set:

15 Easy questions

15 Medium questions

15 Hard questions

Used to build structured learning roadmaps

Avoids repeating questions using a registry

4. Challenge Mode

Generates Hard questions only

Supports phased releases (e.g., 30 questions per phase)

Prevents duplication across phases

Automatically detects when the question pool is exhausted and allows controlled repetition with a warning

5. Registry-Based Duplication Control

The system maintains a local registry to track:

Questions already used in Learn mode

Questions already used in Challenge phases

This ensures:

Learn and Challenge questions never overlap

Consecutive runs do not reuse the same questions unless explicitly reset

Project Structure (High Level)
Narration-Converter-dev/
│
├── data/
│   ├── input/          # CSV datasets
│   ├── output/         # Generated JSON files
│   └── registry/       # Usage registry (duplicate prevention)
│
├── src/
│   ├── cli/            # Command-line interface
│   ├── loaders/        # CSV loading logic
│   ├── normalizer/     # Data normalization
│   ├── classifier/     # Topic & Bloom classification
│   ├── selector/       # Learn & Challenge selection logic
│   ├── narrative/      # Story & narrative generation
│   ├── registry/       # Registry read/write logic
│   └── utils/          # Utility helpers
│
├── templates/          # Narrative templates
├── package.json
└── README.md

Input Format
Supported Inputs

CSV datasets (e.g., custom dataset, LeetCode dataset)

Required CSV Fields

Minimum required fields:

Question ID

Title

Description

Difficulty

Examples

Constraints

Test cases

Different CSV formats are supported through dataset mapping configurations.

Output Format
Learn Output

data/output/learn_programming.json

Contains:

Metadata (dataset, generation time, selection summary)

45 questions (15 Easy, 15 Medium, 15 Hard)

Each question includes:

Original question data

Bloom’s taxonomy level

Story metadata

Examples, constraints, test cases

Language-specific narrative variants

Challenge Output

data/output/challenges_phase_X.json

Contains:

30 Hard questions per phase

No overlap with Learn questions or previous phases

How to Run the Program
1. Install dependencies
npm install
```
Key files:
- CLI: [src/cli/generate.js](src/cli/generate.js)  
- Config: [config/selection_rules.json](config/selection_rules.json)  
- Package metadata: [package.json](package.json)  
- Registry: [data/registry/usage_registry.json](data/registry/usage_registry.json)

## Configure Defaults

Create a `.env` file at the repository root to supply local defaults:
```env
DEFAULT_DATASET=datasetA
DEFAULT_INPUT_PATH=data/input/datasetA.csv
DEFAULT_MODE=learn
```
The CLI will use these defaults when flags are omitted.

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

## 🚩 Command Flag Reference

- `-d`, `--dataset` : The dataset name (e.g., `datasetA`, `leetcode`).  
- `-i`, `--input` : Path to the CSV file (inferred from dataset if omitted).  
- `-m`, `--mode` : `learn` or `challenge`.  
- `-p`, `--phase` : Challenge phase number (default `1`).  
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
- For large CSVs, prefer streaming parsing (`csv-parser` stream) and JSONL outputs to reduce memory.  
- Use an in-memory registry cache with batched writes to reduce disk I/O and speed repeated runs.  
- Consider worker threads for CPU-bound classification/narrative generation and lazy language-variant generation to parallelize work.

---
