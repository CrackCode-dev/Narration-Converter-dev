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

2. Generate Learn questions (fresh start)
npm run generate -- --dataset datasetA --input data/input/datasetA.csv --mode learn --reset-registry

3. Generate another Learn set (no repetition)
npm run generate -- --dataset datasetA --input data/input/datasetA.csv --mode learn

4. Generate Challenge questions (Phase 1)
npm run generate -- --dataset datasetA --input data/input/datasetA.csv --mode challenge --phase 1

5. Generate next Challenge phase
npm run generate -- --dataset datasetA --input data/input/datasetA.csv --mode challenge --phase 2

Reset Behavior

--reset-registry clears all previously used question records

Reset must be explicitly triggered

The program never resets automatically

Design Decisions
Why a Separate Generator?

Keeps content generation independent of the main platform

Allows offline testing and dataset experimentation

Enables future AI integration without affecting production code

Why Shared Test Cases?

Ensures consistent evaluation across programming languages

Simplifies judge integration (e.g., Judge0)

Why Registry-Based Tracking?

Guarantees no duplicate questions across modes and phases

Enables controlled content release

Future Enhancements

AI-assisted narrative refinement

Smarter topic classification

Difficulty re-scoring

Batch-based Learn versions

Integration with cloud databases (MongoDB)

Direct export into CrackCode backend