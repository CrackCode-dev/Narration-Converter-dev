# Narration Converter – CrackCode Content Generator

The **Narration Converter** is a Node.js–based content generation tool developed for the **CrackCode** gamified learning platform. It transforms raw programming questions from CSV datasets into structured, narrative-driven, multi-language challenges for the CrackCode ecosystem.

The generator operates independently as an offline content preparation tool, ensuring data is ready for both the backend and frontend.

---

## 🚀 Core Capabilities
* **Story-driven question narration** for immersive learning.
* **Multi-language variants** (Python, Java, C++, JavaScript) per question.
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
│   ├── registry/       # Registry Read/Write handlers
│   └── utils/          # Shared utility helpers
├── package.json
└── README.md

⚙️ How to Run
1. Install Dependencies
Bash
npm install
2. Generate Content
Fresh start for Learn Mode (Resets history):

Bash
npm run generate -- --dataset datasetA --input data/input/datasetA.csv --mode learn --reset-registry
Generate next Challenge Phase:

Bash
npm run generate -- --dataset datasetA --input data/input/datasetA.csv --mode challenge --phase 2
🗺️ Future Enhancements
🤖 AI Refinement: Using LLMs to polish the narrative flow.

📊 Difficulty Re-scoring: Dynamic difficulty adjustment based on complexity analysis.

☁️ Cloud Integration: Direct export to MongoDB for seamless platform updates.



Markdown
## ⚙️ How to Run

### 1. Install Dependencies
```bash
npm install
2. Generate Content
Fresh start for Learn Mode (Resets history):

Bash
npm run generate -- --dataset datasetA --input data/input/datasetA.csv --mode learn --reset-registry
Generate next Challenge Phase:

Bash
npm run generate -- --dataset datasetA --input data/input/datasetA.csv --mode challenge --phase 2
🗺️ Future Enhancements
🤖 AI Refinement: Using LLMs to polish the narrative flow.

📊 Difficulty Re-scoring: Dynamic difficulty adjustment based on complexity analysis.

☁️ Cloud Integration: Direct export to MongoDB for seamless platform updates
