import Groq from "groq-sdk";
import { log } from "../utils/logger.js";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ═══════════════════════════════════════════════════════════════════
// 1. PERSONA DEFINITIONS — Cultural DNA baked into each archetype
// ═══════════════════════════════════════════════════════════════════

const PERSONA_MAP = {
    "detective_v1": 
        `Noir Detective — World-weary, sharp-eyed, reads between the lines. Speaks in blunt observations and clipped thoughts. Thinks out loud. Trusts patterns over people. Voice shifts by difficulty: at Easy, a grizzled mentor walking a rookie through basics; at Medium, a seasoned investigator revisiting familiar ground; at Hard, a lone veteran on a case nobody else could crack.`,
    "heist_v1": 
        `Heist Crew Specialist — Slick, confident, always three moves ahead. Treats every problem like a job that needs clean execution. Talks in operational shorthand. Respects precision and timing. Voice shifts by difficulty: at Easy, a relaxed crew member running drills at the safehouse; at Medium, a confident planner revisiting a proven playbook; at Hard, the mastermind orchestrating the crew's biggest score yet.`,
    "sentinel_v1": 
        `White Hat Sentinel — Solitary, precise, hyper-aware. Speaks like internal monologue — direct, urgent, addressing the user as if they're inside the system together. Treats every problem as a threat that needs neutralizing. Voice shifts by difficulty: at Easy, a calm instructor running sandbox exercises; at Medium, an alert analyst handling a familiar threat signature; at Hard, the last line of defense during a critical zero-day breach.`,
    "spy_v1": 
        `Covert Field Agent — Economical with words, cool under pressure, everything is need-to-know. Speaks in clipped briefings and measured observations. Trusts protocol but adapts fast. Voice shifts by difficulty: at Easy, a composed instructor running academy simulations; at Medium, a steady handler referencing a past field op; at Hard, a lone operative deep in hostile territory with no extraction plan.`,
    "generic_v1": 
        `Helpful Mentor — Clean, clear, neutral, encouraging. No narrative gimmicks. Speaks directly and warmly. Focuses entirely on making the task understandable.`
};

// ═══════════════════════════════════════════════════════════════════
// 2. ANTI-PATTERN BLACKLIST — Phrases the LLM must never use
// ═══════════════════════════════════════════════════════════════════

const BANNED_PHRASES = [
    // Generic coding challenge openers
    "In this challenge", "In this exercise", "In this task", "In this problem",
    "Your task is to", "Your goal is to", "Your objective is to",
    "The task is to", "The goal is to", "The objective is to",
    "You are tasked with", "You are given", "You are provided with",
    "You will need to", "You will be given", "You need to write",
    // Generic enthusiasm
    "Let's dive in", "Let's get started", "Let's begin",
    "Are you ready?", "Ready to begin?", "Let's go!",
    "dive deep", "dive into",
    // Textbook filler
    "This challenge requires", "This exercise involves", "This problem involves",
    "This operation involves", "This task involves", "This task requires",
    "It's important to note", "It is important to note",
    "It's worth noting", "It is worth noting",
    "It's essential to", "It is essential to",
    "Keep in mind that", "Remember that you need to",
    "Don't forget to", "Make sure to", "Be sure to",
    "Note that", "Please note",
    // Sign-off fluff
    "Good luck!", "Happy coding!", "Good luck and happy coding!",
    "without further ado", "So without further ado",
    // Welcome mats
    "Welcome to", "Welcome back to",
    // Adventure language
    "embark on", "adventure awaits",
    "put your skills to the test", "test your skills",
    "rise to the challenge", "prove your worth",
    // Academic/formal AI-isms
    "Conversely", "Furthermore", "Moreover", "Additionally",
    "In summary", "To summarize", "In conclusion",
    "It should be noted", "It is worth mentioning",
    "akin to", "pertaining to", "with respect to",
    "utilize", "utilization",
    "signifying", "signifies", "denoting", "denotes",
    "indicating that", "suggesting that",
    "thereby", "thus ensuring", "hence",
    "In other words", "That is to say",
    "comprehensive", "robust solution"
];

// Regex patterns for AI-isms that vary in phrasing but share structure.
// These catch rephrased versions that dodge the exact-match banned list.
const AI_ISM_PATTERNS = [
    /\bthe task is\b/gi,
    /\byour (?:task|goal|objective|mission) (?:is|involves|requires)\b/gi,
    /\bthis (?:operation|process|procedure) (?:is|involves)\b/gi,
    /\bis akin to\b/gi,
    /\bcan be (?:achieved|accomplished|done|performed) by\b/gi,
    /\bin order to (?:achieve|accomplish|ensure|determine)\b/gi,
    /\bit is (?:important|essential|crucial|necessary|worth noting) (?:to|that)\b/gi,
    /\bconversely,?\s/gi,
    /\bfurthermore,?\s/gi,
    /\bmoreover,?\s/gi,
    /\badditionally,?\s/gi,
    /\bthereby\b/gi,
    /\bthus\s+(?:ensuring|completing|providing|allowing|enabling)\b/gi,
    /\bsignif(?:ying|ies) (?:that |a )/gi,
    /\bdenot(?:ing|es) (?:that |a )/gi,
];

// ═══════════════════════════════════════════════════════════════════
// 3. CULTURAL DNA FLAVOR POOLS — Randomized per generation
//    2–3 phrases injected each time to force vocabulary variation
// ═══════════════════════════════════════════════════════════════════

const FLAVOR_POOLS = {
    "detective_v1": {
        "Easy": [
            "The basics never lie — trust your fundamentals.",
            "Every rookie's first lesson: read the scene before you move.",
            "Simple case. Clean evidence. Just connect the dots.",
            "They teach this one at the academy for a reason.",
            "A straightforward lead — follow it, don't overthink it.",
            "The filing cabinet's open. Everything you need is right there.",
            "Textbook setup. The kind they use in training.",
            "No tricks here — just solid, honest detective work.",
            "Start with what you know. Build from there.",
            "The precinct's quiet tonight. Good time to work the fundamentals.",
            "Some cases solve themselves if you just read the evidence right.",
            "Walk before you run, kid. This one's your walk."
        ],
        "Medium": [
            "The pieces are all here — but they don't arrange themselves.",
            "You've seen this pattern before. Dig deeper this time.",
            "The case file's thicker than it looks.",
            "Something here doesn't add up. That's where the answer is.",
            "Pin it to the board. See how the connections form.",
            "Every alibi has a crack — find it.",
            "The witness statements contradict. One of them is lying.",
            "Dust off the old files — you've handled something like this.",
            "The trail forks here. Choose wrong and you're back to square one.",
            "Look past the obvious. The real clue hides underneath.",
            "The clock's ticking on this one. Steady hands, sharp eyes.",
            "Not your first rodeo, but don't get cocky."
        ],
        "Hard": [
            "Cold case. No witnesses. Just you and the data.",
            "The kind of case that keeps you up at three in the morning.",
            "Everyone else hit a dead end. That's why it's on your desk now.",
            "The evidence is tangled. Patience and precision — that's all you've got.",
            "No shortcuts. No hunches. Pure methodical work.",
            "The brass doesn't hand you these unless they've run out of options.",
            "Somewhere in this mess is a thread. Pull it and the whole thing unravels.",
            "You've stared at harder walls than this. But not many.",
            "The case nobody wanted. Now it's yours.",
            "Every false lead costs time you don't have.",
            "This one's going to test everything you've learned.",
            "The file's an inch thick and every page matters."
        ]
    },

    "heist_v1": {
        "Easy": [
            "Quick job. In and out, no complications.",
            "The crew runs these drills half-asleep. Prove you can keep up.",
            "Think of it like picking a simple lock — technique over force.",
            "Safehouse training. Low stakes, but treat it like the real thing.",
            "Every master thief started with small scores like this.",
            "Clean setup. No alarms, no guards. Just the basics.",
            "The kind of gig you run to warm up before the real job.",
            "Even the simplest lock has a mechanism. Learn it.",
            "First rule of the crew: never skip fundamentals.",
            "Practice the small moves. They become muscle memory for the big ones.",
            "Easy score, but sloppy work is sloppy work. Stay clean.",
            "The safehouse simulator. Get it right, every time."
        ],
        "Medium": [
            "The vault's got a few layers this time. Nothing you can't handle.",
            "Similar layout to that downtown job — but the security's been upgraded.",
            "Every phase depends on the one before it. One misstep, the alarm trips.",
            "The clock's running. The guard rotation doesn't wait.",
            "You've seen this security system before. They've patched the easy way in.",
            "The blueprints show a way through — but it's not the obvious path.",
            "Timing is everything on this one. Execute each phase precisely.",
            "The crew handled a smaller version of this job last quarter.",
            "Middle-tier vault. Respectable security. Prove you belong on the crew.",
            "The alarm system has a pattern. Find it, exploit it, move on.",
            "Not the easiest score, but the payout's worth the extra effort.",
            "Three checkpoints between you and the target. Plan accordingly."
        ],
        "Hard": [
            "Triple-layered vault. Biometric locks. Zero margin for error.",
            "The kind of score they'll talk about for years — if you pull it off.",
            "Every crew member is counting on your piece of the plan.",
            "The security team rewrote their protocols after the last breach. Adapt.",
            "One shot. The window closes and it doesn't open again.",
            "The most heavily guarded target the crew has ever attempted.",
            "Fail here and the whole operation collapses. No pressure.",
            "This isn't a drill. This is the job you've been building toward.",
            "The contingency plan has a contingency plan. You'll need both.",
            "The mark's security consultant is former intelligence. Expect surprises.",
            "Precision under pressure — that's what separates the crew from amateurs.",
            "The payout is legendary. So is the difficulty."
        ]
    },

    "sentinel_v1": {
        "Easy": [
            "Routine scan. The system's stable — keep it that way.",
            "Sandbox environment. Safe to test, safe to fail, safe to learn.",
            "Basic protocol. Every certified analyst knows this by heart.",
            "Low-priority alert. Good opportunity to sharpen fundamentals.",
            "The dashboard's green. Run your checks anyway.",
            "Training module loaded. Controlled threat, controlled environment.",
            "System integrity starts with the basics. Run them clean.",
            "Firewall's holding. Time to review the underlying logic.",
            "A clean system log is a thing of beauty. Let's keep it that way.",
            "Foundational scan. The kind you could run in your sleep — but don't.",
            "Every vulnerability starts small. Catch them here.",
            "Boot camp exercise. Simple, but precision matters."
        ],
        "Medium": [
            "Anomaly detected. Pattern matches a known threat variant.",
            "The intrusion detection system flagged something. Your call now.",
            "You've patched a similar vulnerability before. This one's mutated.",
            "System logs show unusual activity. Correlate and respond.",
            "The threat surface is wider than initial scans suggested.",
            "Familiar attack vector, unfamiliar payload. Proceed with caution.",
            "Incident report from a previous sweep matches this signature.",
            "The breach hasn't spread — yet. Contain it before it does.",
            "Secondary systems are clean. Focus on the primary vector.",
            "The pattern is there if you look past the noise.",
            "Alert level elevated. Standard protocols, heightened attention.",
            "Someone's testing the perimeter. Identify and neutralize."
        ],
        "Hard": [
            "Zero-day exploit. No patch exists. You're writing it now.",
            "The attacker is inside the system. Every second matters.",
            "All automated defenses failed. Manual intervention — your intervention.",
            "Critical infrastructure at risk. This isn't a simulation.",
            "The exploit chain is sophisticated. Multiple vectors, coordinated timing.",
            "Root access compromised. Contain, analyze, rebuild.",
            "The threat actor knows the system almost as well as you do.",
            "No playbook covers this one. Improvise from first principles.",
            "The board's watching the uptime counter. It's dropping.",
            "Legacy code created this vulnerability. Modern thinking fixes it.",
            "Every defensive layer between the attacker and core data depends on this.",
            "The kind of breach that ends careers — or makes them."
        ]
    },

    "spy_v1": {
        "Easy": [
            "Standard academy drill. Clean execution, no surprises.",
            "Controlled simulation. The agency runs a hundred of these a year.",
            "Basic tradecraft. The kind of op that builds instinct.",
            "Low-risk assignment. Perfect for field calibration.",
            "The handler's watching. Show them the training took.",
            "Every operative started with missions exactly like this one.",
            "Quiet sector. Simple objective. Execute and report back.",
            "Field manual, chapter one. You've memorized it already.",
            "A clean op in a controlled zone. Focus on form.",
            "No hostiles, no complications. Just the mission.",
            "The agency doesn't deploy agents who can't handle the fundamentals.",
            "Simulation loaded. Prove you're ready for the real thing."
        ],
        "Medium": [
            "New intel came in. It matches an operation from your early field days.",
            "The asset is in position. Extraction parameters have shifted.",
            "Cover's intact, but the window is narrower than the briefing suggested.",
            "Familiar territory, but the local conditions have changed since last time.",
            "HQ flagged this as moderate risk. Trust the assessment, but stay sharp.",
            "The dead drop coordinates check out. Verify the contents.",
            "Your handler ran a similar op years ago. Debrief notes are in the file.",
            "The opposition knows something's happening. They don't know what — yet.",
            "Communication channels are compromised. Work with what you have on-site.",
            "Mid-level clearance assignment. Proves you can operate with partial intel.",
            "Two possible approaches. Both viable. Choose based on your read.",
            "The safe house is secure. Plan your next move carefully."
        ],
        "Hard": [
            "Deep cover. No extraction team. No fallback position.",
            "The mission file is eyes-only. You're the only operative briefed.",
            "Hostile territory. Every data point could be disinformation.",
            "Burned assets, compromised channels. You're operating blind.",
            "The kind of assignment that doesn't officially exist.",
            "If this goes wrong, there's no record of you being here.",
            "Multiple objectives, conflicting timelines, zero room for improvisation.",
            "The agency's best analyst couldn't crack this. They sent you instead.",
            "Every layer of this operation conceals another layer underneath.",
            "Radio silence from HQ. You're on your own judgment now.",
            "The opposition's countermeasures are the most advanced you've encountered.",
            "High-value target. Maximum operational complexity. Proceed."
        ]
    },

    "generic_v1": {
        "Easy": [
            "A solid warmup to reinforce what you already know.",
            "This one builds directly on the core concepts.",
            "Straightforward and clean — great for sharpening the basics.",
            "A good foundation problem before moving to harder territory."
        ],
        "Medium": [
            "A step up from the basics — time to apply what you've practiced.",
            "This pushes your understanding a bit further.",
            "Requires you to combine a few ideas you've already seen.",
            "A practical problem that tests real-world thinking."
        ],
        "Hard": [
            "This one demands deep understanding and careful thought.",
            "No shortcuts here — it rewards precision and thoroughness.",
            "Advanced territory. Take your time and think it through.",
            "The kind of problem that separates familiarity from mastery."
        ]
    }
};

// ═══════════════════════════════════════════════════════════════════
// 4. PERSONA STYLE GUIDES — Body metaphors, step framing, and
//    syntactic quirks (voice fingerprint per persona)
// ═══════════════════════════════════════════════════════════════════

const PERSONA_STYLE_GUIDE = {
    "detective_v1": {
        body: `Weave detective metaphors lightly around technical content:
- Input data → "the evidence", "the case file", "what was left at the scene"
- Function to write → "your investigation method", "the forensic procedure"
- Expected output → "the verdict", "the case conclusion", "what gets filed in the report"
- Constraints/edge cases → "dead ends", "false leads", "red herrings"
- Test cases/examples → "witness statements", "exhibits on record"
ALWAYS keep actual technical terms alongside metaphors. Example: "The evidence (an array of integers) needs sorting..." — never "Sort the evidence" alone.`,

        steps: `Lead into steps with varied detective phrasing — "Work the case like this:", "The investigation runs in order:", "Follow the trail:"
Frame steps as detective actions — "Examine...", "Cross-reference...", "Narrow down...", "Close the case by..." — while keeping technical instructions clear.`,

        voice: `SYNTACTIC FINGERPRINT FOR THIS PERSONA:
- Use sentence fragments. "Cold trail. Dead witnesses. Just the numbers."
- Mix short punchy observations with occasional longer deductions.
- Speak in present tense when describing the problem, past tense when referencing experience.
- Use dashes for asides — the kind of thought that interrupts itself.
- Avoid exclamation marks entirely. Detectives don't get excited.
- Occasionally address the reader as if thinking out loud: "Something's off here." or "Look closer."`
    },

    "heist_v1": {
        body: `Weave heist metaphors lightly around technical content:
- Input data → "the blueprints", "the layout", "the intel"
- Function to write → "the master plan", "your extraction tool", "the workaround"
- Expected output → "the score", "the clean getaway", "what you walk out with"
- Constraints/edge cases → "security measures", "alarms", "tripwires"
- Test cases/examples → "dry runs", "rehearsal scenarios", "simulations the crew ran"
ALWAYS keep actual technical terms alongside metaphors. Example: "The blueprints (a 2D matrix) map the vault layout..." — never "Study the blueprints" alone.`,

        steps: `Lead into steps with varied heist phrasing — "The job breaks down like this:", "Run it phase by phase:", "Here's the playbook:"
Frame steps as heist phases — "Case the...", "Crack the...", "Bypass the...", "Grab the score by..." — while keeping technical instructions clear.`,

        voice: `SYNTACTIC FINGERPRINT FOR THIS PERSONA:
- Confident, forward-moving rhythm. No hesitation.
- Use dashes liberally — the crew talks fast and thinks faster.
- Contractions always. "You've", "don't", "that's", "won't".
- Occasional direct crew-speak: "Here's the thing.", "Bottom line.", "That's the play."
- Sentences lean short-to-medium. No academic paragraphs.
- Numbers and timing feel urgent: "three phases", "two checkpoints", "one shot".`
    },

    "sentinel_v1": {
        body: `Weave cybersecurity metaphors lightly around technical content:
- Input data → "the incoming data stream", "the flagged payload", "the signal"
- Function to write → "the patch", "your defense protocol", "the countermeasure"
- Expected output → "the secured state", "the sanitized output", "a clean system response"
- Constraints/edge cases → "attack vectors", "known exploits", "edge vulnerabilities"
- Test cases/examples → "penetration test results", "threat simulations", "scan outputs"
ALWAYS keep actual technical terms alongside metaphors. Example: "The flagged payload (a string) must be parsed..." — never "Analyze the payload" alone.`,

        steps: `Lead into steps with varied sentinel phrasing — "Incident response sequence:", "Run the protocol:", "Deploy in phases:"
Frame steps as security operations — "Scan the...", "Isolate the...", "Validate the...", "Seal the breach by..." — while keeping technical instructions clear.`,

        voice: `SYNTACTIC FINGERPRINT FOR THIS PERSONA:
- Internal monologue style. Direct address, almost talking to yourself.
- Clipped, precise sentences. "Payload's corrupted. Timestamp doesn't match."
- Use periods where others would use commas — creates urgency through separation.
- Technical language feels native, not forced. This persona lives in terminals.
- Occasional system-speak: "Status: compromised.", "Vector identified.", "Deploying fix."
- No filler words. Every sentence carries information.`
    },

    "spy_v1": {
        body: `Weave espionage metaphors lightly around technical content:
- Input data → "the intelligence briefing", "the intercepted transmission", "the dossier"
- Function to write → "the mission protocol", "your field procedure", "the operation"
- Expected output → "the extracted intel", "the mission deliverable", "what gets sent to HQ"
- Constraints/edge cases → "operational risks", "compromised scenarios", "blown cover situations"
- Test cases/examples → "field simulations", "debriefing records", "prior mission data"
ALWAYS keep actual technical terms alongside metaphors. Example: "The intercepted transmission (an encoded string) must be decoded..." — never "Decode the transmission" alone.`,

        steps: `Lead into steps with varied spy phrasing — "Operational sequence:", "Execute in this order:", "The mission runs as follows:"
Frame steps as mission phases — "Acquire the...", "Decode the...", "Extract the...", "Transmit results by..." — while keeping technical instructions clear.`,

        voice: `SYNTACTIC FINGERPRINT FOR THIS PERSONA:
- Economy of language. Say it once, say it right. No repetition.
- Favor short declarative sentences. "The objective is clear." "Time is limited."
- Use colons and semicolons over conjunctions — briefing-document rhythm.
- Measured tone throughout. Never frantic, never casual.
- Occasional classified-document phrasing: "Parameters as follows.", "Objective:", "Priority: high."
- Contractions are rare. Spies speak precisely.`
    },

    "generic_v1": {
        body: `Keep language clean, clear, and direct. No metaphors:
- Input data → "the input", "the given data"
- Function to write → "your solution", "the function you'll write"
- Expected output → "the expected result", "the correct output"
- Constraints/edge cases → "edge cases to handle", "special conditions"
- Test cases/examples → "examples", "sample cases"
Mentor-like and plain. Focus entirely on making the task crystal clear.`,

        steps: `Lead into steps plainly — "Approach it step by step:", "Break it down like this:", "Here's a clear path forward:"
Frame steps as straightforward instructions — "Start by...", "Next, handle...", "Then process...", "Finally, return..." — prioritizing clarity above all.`,

        voice: `SYNTACTIC FINGERPRINT FOR THIS PERSONA:
- Warm, even tone. Conversational but not chatty.
- Standard sentence structure. No stylistic quirks.
- Clear transitions between ideas.
- Encouraging without being patronizing.`
    }
};

// ═══════════════════════════════════════════════════════════════════
// 5. FEW-SHOT EXAMPLES — One hand-crafted reference per persona
//    The LLM pattern-matches voice from these, not just rules
// ═══════════════════════════════════════════════════════════════════

const FEW_SHOT_EXAMPLES = {
    "detective_v1": {
        original_title: "Reverse a String",
        original_description: "Write a function that takes a string as input and returns the string reversed.",
        refined_title: "The Backwards Witness",
        refined_description: `The academy covered this one. Basics — but basics keep you alive out here.\n\nA witness statement (a string) landed on your desk, and something's wrong — it reads backwards. Every character has been flipped end to end. Write a function that takes this string as input and returns it reversed. The full statement needs reconstructing, character by character, first to last becoming last to first.\n\nWork the scene:\n1. Take in the witness statement — your input string.\n2. Walk through the characters from the end back to the start.\n3. Build the corrected statement one character at a time.\n4. Hand back the reversed string as your output.`
    },

    "heist_v1": {
        original_title: "Reverse a String",
        original_description: "Write a function that takes a string as input and returns the string reversed.",
        refined_title: "The Flip Job",
        refined_description: `Quick drill at the safehouse — the kind you run before breakfast.\n\nThe crew intercepted a coded message (a string), but it's been flipped. Every character reads back to front. Write a function that takes this string as input and returns it reversed. First character goes to the end, last character comes to the front — the whole sequence gets mirrored.\n\nThe playbook:\n1. Grab the input string — that's your intercepted message.\n2. Run through the characters from the tail end back to the start.\n3. Stack them into a new sequence as you go.\n4. Hand off the reversed string. Clean job, no traces.`
    },

    "sentinel_v1": {
        original_title: "Reverse a String",
        original_description: "Write a function that takes a string as input and returns the string reversed.",
        refined_title: "Payload Inversion",
        refined_description: `Sandbox exercise. The kind they load on day one of certification.\n\nAn incoming data stream (a string) arrived inverted — every character is in reverse order. Write a function that takes this string as input and returns it reversed. The stream needs restoring: last byte becomes first, first becomes last. Full character-level inversion.\n\nRun the protocol:\n1. Accept the corrupted string as your input stream.\n2. Traverse the characters from the final position backward.\n3. Reconstruct the original sequence into a new output.\n4. Return the corrected string. System restored.`
    },

    "spy_v1": {
        original_title: "Reverse a String",
        original_description: "Write a function that takes a string as input and returns the string reversed.",
        refined_title: "Signal Inversion",
        refined_description: `Academy simulation. Standard field exercise; every recruit completes this one.\n\nAn intercepted signal (a string) arrived reversed — characters read back to front, rendering the intelligence unreadable. Write a function that takes this string as input and returns it reversed. Each character must be repositioned: first to last, last to first. Full sequence inversion.\n\nOperational sequence:\n1. Receive the garbled string — your intercepted signal.\n2. Process characters from the end of the string to the beginning.\n3. Assemble the corrected sequence in order.\n4. Return the restored string to HQ.`
    },

    "generic_v1": {
        original_title: "Reverse a String",
        original_description: "Write a function that takes a string as input and returns the string reversed.",
        refined_title: "Reverse a String",
        refined_description: `A good foundational exercise — you've got the skills for this.\n\nWrite a function that takes a string as input and returns the string reversed. The first character becomes the last, the last becomes the first, and every character in between shifts accordingly.\n\nApproach it step by step:\n1. Accept the input string.\n2. Iterate through the characters from the end to the beginning.\n3. Build a new string from the characters in that reversed order.\n4. Return the reversed string as your result.`
    }
};

// ═══════════════════════════════════════════════════════════════════
// 6. STRUCTURAL TEMPLATES — Style variation WITHIN the three sections
//    The three-section format (opening, body, steps) is always guaranteed.
//    Templates vary HOW each section is delivered, not WHETHER it exists.
// ═══════════════════════════════════════════════════════════════════

const STRUCTURAL_TEMPLATES = [
    {
        id: "direct_opening",
        instruction: `Opening Statement: A single declarative persona-flavored sentence. Set the mood with a sharp, direct observation. No questions, no exclamations — just a statement that drops the user into the persona's world.
Problem Body: Present the technical content in a single flowing passage. Weave persona metaphors around — not over — the technical details.
Detailed Steps: Open with a short persona-flavored lead-in line, then a numbered list of 3–6 actionable steps.`
    },
    {
        id: "situational_opening",
        instruction: `Opening Statement: Paint a one-sentence situational snapshot — put the user in a specific moment or scenario that fits the persona and difficulty. Make it feel like the middle of a scene, not the start of an exercise.
Problem Body: Present the technical content in a single flowing passage. Weave persona metaphors around — not over — the technical details.
Detailed Steps: Open with a short persona-flavored lead-in line, then a numbered list of 3–6 actionable steps.`
    },
    {
        id: "callback_opening",
        instruction: `Opening Statement: Reference a past experience relevant to the difficulty level — a previous case, job, mission, or training exercise — in one or two sentences. Make the user feel like they've been here before.
Problem Body: Present the technical content in a single flowing passage. Weave persona metaphors around — not over — the technical details.
Detailed Steps: Open with a short persona-flavored lead-in line, then a numbered list of 3–6 actionable steps.`
    }
];

// ═══════════════════════════════════════════════════════════════════
// 7. HELPER UTILITIES
// ═══════════════════════════════════════════════════════════════════

/** Pick `count` random items from an array (Fisher-Yates partial shuffle) */
function pickRandom(arr, count) {
    const pool = [...arr];
    const picks = [];
    for (let i = 0; i < Math.min(count, pool.length); i++) {
        const idx = Math.floor(Math.random() * (pool.length - i)) + i;
        [pool[i], pool[idx]] = [pool[idx], pool[i]];
        picks.push(pool[i]);
    }
    return picks;
}

/** Pick one random item from an array */
function pickOne(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

/** 
 * Attempt to repair malformed JSON from LLM output.
 * Handles: literal newlines in strings, markdown fences, unescaped quotes,
 * and raw text with embedded JSON.
 */
function repairJSON(raw) {
    if (!raw || typeof raw !== 'string') return null;

    let text = raw.trim();

    // Strip markdown fences if present
    text = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    text = text.replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

    // ── Strategy 1: Direct parse (works if JSON is already valid) ──
    try {
        return JSON.parse(text);
    } catch (e) { /* continue */ }

    // ── Strategy 2: Character-level repair (fix newlines inside string values) ──
    try {
        const repaired = fixNewlinesInStrings(text);
        return JSON.parse(repaired);
    } catch (e) { /* continue */ }

    // ── Strategy 3: Regex extraction (pull title and description directly) ──
    try {
        // Even if the JSON structure is broken, we can often extract the values
        const titleMatch = text.match(/"title"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
        const descMatch = text.match(/"description"\s*:\s*"((?:[^"\\]|\\[\s\S])*)"\s*\}?/s);

        if (titleMatch && descMatch) {
            const title = titleMatch[1];
            // Clean the description: replace any literal newlines with \n escape
            const desc = descMatch[1].replace(/\r?\n/g, '\\n');
            const rebuilt = JSON.stringify({ title, description: desc });
            return JSON.parse(rebuilt);
        }
    } catch (e) { /* continue */ }

    // ── Strategy 4: Line-by-line reconstruction ──
    try {
        // Find lines that look like "key": "value" and reconstruct
        const lines = text.split('\n');
        let title = null;
        let descParts = [];
        let inDesc = false;

        for (const line of lines) {
            const titleLine = line.match(/"title"\s*:\s*"(.+?)"\s*,?\s*$/);
            if (titleLine) {
                title = titleLine[1];
                continue;
            }

            const descStart = line.match(/"description"\s*:\s*"(.*)$/);
            if (descStart) {
                inDesc = true;
                descParts.push(descStart[1]);
                continue;
            }

            if (inDesc) {
                // Check if this line ends the description
                const endMatch = line.match(/^(.*?)"\s*\}?\s*$/);
                if (endMatch) {
                    descParts.push(endMatch[1]);
                    inDesc = false;
                } else {
                    descParts.push(line);
                }
            }
        }

        if (title && descParts.length > 0) {
            const desc = descParts.join('\\n');
            const rebuilt = JSON.stringify({ title, description: desc });
            return JSON.parse(rebuilt);
        }
    } catch (e) { /* continue */ }

    return null;
}

/**
 * Fix literal newlines inside JSON string values using character-by-character parsing.
 * Also handles unescaped control characters.
 */
function fixNewlinesInStrings(text) {
    let inString = false;
    let escaped = false;
    let result = '';

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];

        if (escaped) {
            result += ch;
            escaped = false;
            continue;
        }

        if (ch === '\\') {
            result += ch;
            escaped = true;
            continue;
        }

        if (ch === '"') {
            inString = !inString;
            result += ch;
            continue;
        }

        if (inString) {
            if (ch === '\n') { result += '\\n'; continue; }
            if (ch === '\r') { continue; }
            if (ch === '\t') { result += '\\t'; continue; }
        }

        result += ch;
    }

    return result;
}

/** Post-processing: catch AI-isms that slip through the prompt */
function postProcess(text) {
    let cleaned = text;

    // Pass 1: Remove exact banned phrases (case-insensitive)
    for (const phrase of BANNED_PHRASES) {
        const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        cleaned = cleaned.replace(regex, '');
    }

    // Pass 2: Remove fuzzy AI-ism patterns
    for (const pattern of AI_ISM_PATTERNS) {
        cleaned = cleaned.replace(pattern, '');
    }

    // Pass 3: Clean up artifacts from removal
    cleaned = cleaned.replace(/\s{2,}/g, ' ');          // collapse double spaces
    cleaned = cleaned.replace(/^\s*,\s*/gm, '');         // orphaned leading commas
    cleaned = cleaned.replace(/\.\s*\./g, '.');          // double periods
    cleaned = cleaned.replace(/,\s*\./g, '.');           // comma before period
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');        // collapse triple+ newlines
    cleaned = cleaned.replace(/^\s+/gm, (match) =>      // preserve intentional newlines but trim spaces
        match.includes('\n') ? match : '');
    cleaned = cleaned.trim();

    return cleaned;
}

/** 
 * Enforce the three-section structure in the description.
 * Always checks for BOTH section breaks independently:
 *   Break 1: between opening statement and problem body
 *   Break 2: between problem body and detailed steps
 */
function enforceStructure(description) {
    let text = description;

    // ── STEP 1: Ensure break before the numbered steps section ──
    // Detect the steps lead-in + numbered list pattern and ensure \n\n precedes it.
    // Common patterns from real output:
    //   "...sentence. Follow the trail:\n1. ..."
    //   "...sentence. Deploy in phases:\n1. ..."  
    //   "...sentence.\nThe playbook:\n1. ..."
    //   "...sentence. 1. ..."

    // Find where the steps block begins: a lead-in ending in ":" before "1." or just "1." after body
    const stepsRegex = /([.!?:])(\s*\n?\s*)((?:[A-Z][^\n:]{0,60}:\s*\n\s*)?1\.\s)/;
    const stepsMatch = text.match(stepsRegex);

    if (stepsMatch && stepsMatch.index !== undefined) {
        const matchStart = stepsMatch.index;
        const punctuation = stepsMatch[1];
        const gap = stepsMatch[2];
        const stepsContent = stepsMatch[3];

        // Check if there's a lead-in line (e.g., "Follow the trail:")
        const hasLeadIn = /^[A-Z]/.test(stepsContent);

        if (!gap.includes('\n\n')) {
            let cutPoint;
            if (hasLeadIn && punctuation !== ':') {
                // Break after the sentence that precedes the lead-in line
                cutPoint = matchStart + 1;
            } else if (punctuation === ':') {
                // The colon IS the lead-in ending — find the sentence before the lead-in
                // Walk backwards to find the actual sentence end before the lead-in phrase
                const beforeColon = text.slice(0, matchStart);
                const lastSentenceEnd = beforeColon.match(/.*[.!?]/s);
                if (lastSentenceEnd) {
                    cutPoint = lastSentenceEnd[0].length;
                } else {
                    cutPoint = matchStart + 1;
                }
            } else {
                cutPoint = matchStart + 1;
            }

            const before = text.slice(0, cutPoint).trimEnd();
            const after = text.slice(cutPoint).trimStart();
            text = before + '\n\n' + after;
        }
    }

    // ── STEP 2: Ensure break after the opening statement ──
    // The opening is 1–2 short thematic sentences at the very start (no tech content).
    // Find the boundary where technical content begins.

    const techIndicators = /(?:given\s+(?:a|an)|write\s+a|you\s+(?:have|receive|get|are\s+given)|implement|create\s+a|the\s+(?:crew|evidence|blueprints|intel|incoming|intercepted|dossier|flagged|function|input)|an?\s+(?:array|string|list|function|matrix|graph|tree|integer|int|object|hash|map|set|linked|node|stack|queue|binary|sorted|unsorted))/i;

    // Count current \n\n breaks
    const breaks = text.split('\n\n');

    if (breaks.length < 3) {
        // We need to find where the opening ends and body begins
        // Look for sentence boundaries in the first ~400 chars
        const searchZone = text.slice(0, 400);
        const sentenceEnds = [...searchZone.matchAll(/[.!?](?:\s+|\n)/g)];

        for (const match of sentenceEnds) {
            if (match.index === undefined) continue;
            const candidateSplit = match.index + 1;
            const beforeSplit = text.slice(0, candidateSplit).trim();
            const afterSplit = text.slice(candidateSplit).trim();

            // Skip if this split point is already at a \n\n
            const nearbyText = text.slice(Math.max(0, match.index - 1), match.index + match[0].length + 1);
            if (nearbyText.includes('\n\n')) continue;

            // If what comes after looks technical, insert the break here
            if (techIndicators.test(afterSplit.slice(0, 100)) && beforeSplit.length > 10) {
                text = beforeSplit + '\n\n' + afterSplit;
                break;
            }

            // Also break if the opening is just 1–2 short sentences (< 150 chars)
            // and we haven't found tech indicators yet but the opening looks complete
            if (beforeSplit.length > 10 && beforeSplit.length < 150 && !techIndicators.test(beforeSplit)) {
                const nextSentenceStart = afterSplit.slice(0, 100);
                if (techIndicators.test(nextSentenceStart) || /^[A-Z]/.test(nextSentenceStart)) {
                    text = beforeSplit + '\n\n' + afterSplit;
                    break;
                }
            }
        }
    }

    // ── STEP 3: Final cleanup — ensure no triple+ newlines ──
    text = text.replace(/\n{3,}/g, '\n\n');

    return text;
}

// ═══════════════════════════════════════════════════════════════════
// 8. LLM CALL HELPERS — JSON mode + fallback without JSON mode
// ═══════════════════════════════════════════════════════════════════

/**
 * Attempt 1: Call with Groq's json_object response format.
 * If Groq rejects the JSON, try to salvage from failed_generation.
 */
async function callWithJSONMode(systemPrompt, userPrompt, variantId) {
    let rawContent = null;

    try {
        const completion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.7,
            frequency_penalty: 0.3,
            response_format: { type: "json_object" },
        });
        rawContent = completion.choices[0]?.message?.content || null;
    } catch (apiError) {
        // Extract failed_generation from Groq's json_validate_failed error
        let failedGen = extractFailedGeneration(apiError);

        if (failedGen) {
            log.warn(`[AI-JSONFix] Groq JSON validation failed for ${variantId}. Attempting repair...`);
            rawContent = failedGen;
        } else {
            log.warn(`[AI-JSONMode] Call failed for ${variantId}: ${apiError.message}`);
            return null;
        }
    }

    return repairJSON(rawContent);
}

/**
 * Attempt 2: Call WITHOUT json_object mode.
 * The model outputs free text, and we extract JSON from it.
 */
async function callWithoutJSONMode(systemPrompt, userPrompt, variantId) {
    try {
        const completion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt + '\n\nIMPORTANT: Output ONLY the JSON object on a single line. No markdown, no explanation.' },
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.6,
            frequency_penalty: 0.3,
        });

        const rawContent = completion.choices[0]?.message?.content || null;
        if (!rawContent) return null;

        const result = repairJSON(rawContent);
        if (result) {
            log.warn(`[AI-Retry] Successfully recovered ${variantId} on retry.`);
        }
        return result;
    } catch (retryError) {
        log.warn(`[AI-Retry] Retry also failed for ${variantId}: ${retryError.message}`);
        return null;
    }
}

/**
 * Extract the failed_generation content from a Groq API error.
 * Handles multiple SDK error shapes.
 */
function extractFailedGeneration(apiError) {
    // Path 1: Direct property (Groq SDK structured error)
    if (apiError?.error?.failed_generation) {
        return apiError.error.failed_generation;
    }

    // Path 2: Nested body
    if (apiError?.body?.error?.failed_generation) {
        return apiError.body.error.failed_generation;
    }

    // Path 3: Parse from stringified error message
    if (apiError?.message) {
        try {
            const jsonMatch = apiError.message.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return parsed?.error?.failed_generation || parsed?.failed_generation || null;
            }
        } catch (e) { /* ignore */ }
    }

    return null;
}

// ═══════════════════════════════════════════════════════════════════
// 9. MAIN REFINEMENT FUNCTION
// ═══════════════════════════════════════════════════════════════════

export async function refineVariant(variant, context) {
    if (context.skipAi) return variant.narrative;

    try {
        const { difficulty, topic } = context;
        const { narrative, storyId, variantId } = variant;

        // Extract language from variant metadata or variantId
        const language = variant.language
            || (variantId ? variantId.split('_')[0] : null)
            || null;

        // ── Resolve persona configuration ──
        const personaKey = PERSONA_MAP[storyId] ? storyId : 'generic_v1';
        const personaInstruction = PERSONA_MAP[personaKey];
        const styleGuide = PERSONA_STYLE_GUIDE[personaKey];
        const fewShot = FEW_SHOT_EXAMPLES[personaKey];

        // ── Randomize flavor phrases (2–3 per generation) ──
        const flavorPool = FLAVOR_POOLS[personaKey]?.[difficulty] || FLAVOR_POOLS[personaKey]?.['Easy'] || [];
        const selectedFlavors = pickRandom(flavorPool, 3);

        // ── Randomize structural template ──
        const template = pickOne(STRUCTURAL_TEMPLATES);

        // ── Language-specific notes ──
        const languageBodyNote = language
            ? `Use technical terminology and idioms specific to ${language} (e.g., ${language}-specific data types, standard library references, common conventions). Frame examples using ${language} syntax where the original does so.`
            : 'Use technical terminology appropriate to the programming language implied by the task.';

        const languageStepsNote = language
            ? `Where helpful, reference ${language}-specific constructs, built-in functions, or idiomatic patterns so the user knows what tools are available to them in ${language}.`
            : '';

        // ── Build the system prompt ──
        const systemPrompt = `You are a narrative writer for a gamified coding platform. You write in-character descriptions that make coding challenges feel alive — without ever sacrificing technical clarity.

PERSONA:
${personaInstruction}

THE GOLDEN RULE: Narrative flavor ENHANCES comprehension. After reading your output, a programmer must understand the coding task MORE clearly than from the plain original. If flavor and clarity conflict, clarity wins — always.

DESCRIPTION FORMAT (mandatory — always follow this three-section structure):
The description MUST contain exactly three sections. In the JSON string, separate each section with exactly TWO newlines (\\n\\n). This creates a visible blank line between sections.

The structure in the JSON string MUST look exactly like this (all on one line):
"<opening statement text>\\n\\n<problem body text>\\n\\n<steps lead-in>\\n1. <step>\\n2. <step>"

1. OPENING STATEMENT — One or two sentences maximum. Purely thematic and persona-flavored. Sets the mood and references the user's experience level. Contains NO technical content whatsoever. NO first-person anecdotes or memories (never "I recall...", "I remember..."). This is a statement ABOUT the user's situation, not the narrator's backstory. Ends with a period. Then \\n\\n before the next section.

2. PROBLEM BODY — The core coding task. Every technical detail, constraint, input/output specification, and example from the original MUST be preserved here — but stated ONCE. Do not rephrase or restate the same requirement in different words. Persona flavor wraps around the technical content but never replaces it. Keep it tight: 2–4 sentences of technical content with light persona flavor. Ends with a period or closing detail. Then \\n\\n before the next section.

3. DETAILED STEPS — A brief persona-flavored lead-in line followed by \\n, then each numbered step on its own line separated by \\n. Format: "<lead-in line>\\n1. <step one>\\n2. <step two>\\n3. <step three>" and so on for 3–6 steps. Each step is a concrete, actionable instruction. No solution code.

STYLE VARIATION FOR THIS GENERATION:
${template.instruction}

PROBLEM BODY GUIDE:
${styleGuide.body}
${languageBodyNote}
CRITICAL: State the task once, clearly. Do not paraphrase the same requirement multiple times. If you've said "return 1 if found, return 0 if not" — that's done, move on. The body should be CONCISE: ideally 2–4 sentences of technical content wrapped in light persona flavor.

STEPS GUIDE:
${styleGuide.steps}
${languageStepsNote}
Each step must be a REAL problem-solving action — not filler. Bad steps: "Get familiar with the array", "Review the test cases", "Make sure your solution works". Good steps: "Iterate through the sorted array comparing each element to the target", "Track available bill counts using variables for $5 and $10 denominations". If you can only write 3 genuinely useful steps, write 3 — never pad to fill a quota.

VOICE & RHYTHM:
${styleGuide.voice}

FLAVOR PHRASES — Pick only ONE of these and weave it naturally into the OPENING STATEMENT. Never place flavor phrases in the problem body or steps. Never use multiple flavor phrases in the same section. The phrase should feel like a natural part of the character's voice, not a quote dropped in:
${selectedFlavors.map((f, i) => `  ${i + 1}. "${f}"`).join('\n')}

BANNED PHRASES AND PATTERNS — NEVER use any of these. They sound AI-generated and break immersion:
Exact phrases: ${BANNED_PHRASES.map(p => `"${p}"`).join(', ')}
Also avoid these patterns: "is akin to", "can be achieved by", "in order to achieve/ensure/determine", any sentence starting with "Conversely", "Furthermore", "Moreover", "Additionally", any use of "thereby", "thus ensuring/completing", "signifying/denoting that". Write like a human character, not a textbook.

FORMAT:
- Output a single line of strictly valid JSON: { "title": "...", "description": "..." }
- The entire JSON must be on ONE LINE. Do NOT insert actual line breaks inside string values.
- To represent line breaks in the description text, use the two-character escape sequence \\n (backslash + n). For section breaks use \\n\\n (backslash-n backslash-n). These are ESCAPE CHARACTERS inside the JSON string, NOT real newlines.
- The title should be short, punchy, persona-flavored, and hint at the coding topic.

CONSTRAINTS:
1. NEVER remove, simplify, or obscure any technical detail, constraint, input/output spec, or example from the original.
2. NO solution hints beyond the step breakdown.
3. For Easy and Medium difficulty: absolute clarity is the priority. Light narrative only.
4. Vary your sentence lengths. Mix short punchy lines with longer explanations. Avoid writing sentences of uniform length.
5. The description string MUST contain exactly two \\n\\n (escaped double newlines) — one between the opening statement and problem body, one between the problem body and detailed steps. Use \\n between numbered steps. These are escape sequences inside the JSON string, never actual line breaks.
6. CONCISENESS: State each technical requirement ONCE. Never restate the same task in different words. If the original says "return 1 if found, 0 if not", say it once — do not rephrase it as a second or third sentence. The problem body should be shorter or equal in length to the original description, never significantly longer.
7. STEP QUALITY: Every numbered step must describe a concrete problem-solving action. NEVER include meta-steps like "Review the test cases", "Practice your solution", "Make sure it works", "Test your code", or "Verify the output matches". Steps guide how to SOLVE the problem, not how to check your homework.
8. NEVER add first-person anecdotes or memories (e.g., "I recall a past mission where..."). The opening is a thematic statement about the user's level — not the narrator's autobiography.

REFERENCE EXAMPLE — This is the quality and voice standard for this persona:
Original Title: "${fewShot.original_title}"
Original Description: "${fewShot.original_description}"
Refined Title: "${fewShot.refined_title}"
Refined Description: "${fewShot.refined_description}"

Match this voice and quality. Do NOT reuse any phrasing from this example in your output.`;

        // ── Build the user prompt ──
        const userPrompt = `DIFFICULTY: ${difficulty}
TOPIC: ${topic}${language ? `\nLANGUAGE: ${language}` : ''}

ORIGINAL CONTENT:
Title: "${narrative.title}"
Description: "${narrative.description}"

Rewrite as valid JSON. Preserve every technical detail. The conversion must make the question easier to understand, not harder.`;

        // ── Call the LLM (with error recovery and retry) ──
        let refinedData = null;

        // Attempt 1: json_object mode (strict)
        refinedData = await callWithJSONMode(systemPrompt, userPrompt, variant.variantId);

        // Attempt 2: If JSON mode failed, retry without json_object constraint
        if (!refinedData) {
            log.warn(`[AI-Retry] Retrying ${variant.variantId} without json_object mode...`);
            refinedData = await callWithoutJSONMode(systemPrompt, userPrompt, variant.variantId);
        }

        if (!refinedData || !refinedData.title || !refinedData.description) {
            log.warn(`[AI-Fail] All attempts failed for ${variant.variantId}. Reverting.`);
            return narrative;
        }

        // ── Post-process to catch any remaining AI-isms ──
        refinedData.title = postProcess(refinedData.title);
        refinedData.description = postProcess(refinedData.description);

        // ── Enforce three-section line breaks if the LLM missed them ──
        refinedData.description = enforceStructure(refinedData.description);

        return refinedData;

    } catch (error) {
        log.warn(`[AI-Error] Refinement failed for ${variant.variantId}: ${error.message}. Reverting.`);
        return variant.narrative;
    }
}