import Groq from "groq-sdk";
import { log } from "../utils/logger.js";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const PERSONA_MAP = {
    "detective_v1": 
        "Noir Detective (Gritty, mysterious, world-weary, speaks in short but blunt observations, seen it all,\n uses terms like 'suspect', 'clue', 'lead', 'case', 'witness', 'alibi', 'interrogate', 'trail')",
    "heist_v1": 
        "Digital Heist Crew Member (Slick, Confident, Streetwise, always three steps ahead, treats every problem as a job to be pulled off cleanly, uses terms like 'mark', 'score', 'target', 'getaway', 'vault', 'inside job', 'crew')",
    "sentinel_v1": 
        "White Hat Security Hacker (Solitary, precise, duty-bound defender of digital systems, uses terms like 'breach', 'vulnerability', 'trace', 'patch', 'lockdown', 'threat vector', 'incident response', 'clearance')",
    "spy_v1": 
        "Covert Secret Agent (Sleek, Cool under pressure, tactical, uses terms like 'intel', 'mission', 'asset', 'classified', 'agency', 'extraction', 'cover')",
    "generic_v1": 
        "Helpful Mentor (Clean, clear, neutral, encouraging)"
};

export async function refineVariant(variant, context) {
    if(context.skipAi) return variant.narrative;

    try {
        const { difficulty, topic } = context;
        const { narrative, storyId } = variant;

        const personaInstruction = PERSONA_MAP[storyId] || PERSONA_MAP['generic_v1'];

        const systemPrompt = `You are a Narrative Refinement Assistant.
    OBJECTIVE: Refine the "title" and "description" to match the Persona.
    
    STRICT CONSTRAINTS:
    1. Output strictly valid JSON.
    2. NEVER change the coding task, constraints, or technical details.
    3. NO hints or solution explanations.
    4. Difficulty Tone: 
       - Easy: Encouraging, calm.
       - Medium: Focused, professional.
       - Hard: Serious, high-stakes.
    5. Output Format: { "title": "...", "description": "..." }`;

    const userPrompt = `
    CONTEXT:
    - Persona: ${personaInstruction}
    - Difficulty: ${difficulty}
    - Topic: ${topic}

    ORIGINAL CONTENT:
    Title: "${narrative.title}"
    Description: "${narrative.description}"
    
    TASK: Rewrite the Title and Description in JSON.`;

    const completion = await groq.chat.completions.create({
        messages: [
            {role: "system", content: systemPrompt},
            {role: "user", content: userPrompt},
        ],
        model: "llama-3.3-70b-versatile",
        temperature: 0.7,
        response_format: {type: "json_object"},
    });

    const refeinedData = JSON.parse(completion.choices[0]?.message?.content || "{}");

    if(!refeinedData || !refeinedData.title || !refeinedData.description) {
        log.warn(`[AI-Fail] Invalid JSON for ${variant.variantId}. Reverting.`);
        return narrative;
    }

    return refeinedData;

    } catch (error) {
        log.warn(`[AI-Error] Refinement failed for ${variant.variantId}: ${error.message}. Reverting.`);
        return variant.narrative;
    }
}