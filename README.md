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
