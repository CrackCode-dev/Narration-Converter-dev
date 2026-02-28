import { pickDeterministic } from "../utils/simpleHash.js";

function getTemplateId(storyId, topic, mode) {
  return `${storyId}_${topic}_${mode}_01`;
}

function getPhraseBank(storyId, mode) {
  const commonLearn = [
    "Here's your next task.",
    "Let's move to the next clue.",
    "Time for your next training step.",
    "You've got a new lead to follow.",
    "A fresh report just came in.",
    "Your next assignment is ready.",
    "A new challenge has been queued for you.",
    "The next problem is on your desk.",
    "Your mentor has left you a new task.",
    "Time to put your skills to work.",
    "Another step forward in your training.",
    "A new objective has been assigned.",
    "Your next drill is ready to begin.",
    "The next problem awaits your attention.",
    "Pick up where you left off — new task ahead."
  ];

  const commonChallenge = [
    "This one is high stakes.",
    "This challenge won't be easy.",
    "You'll need to be precise here.",
    "No room for mistakes on this one.",
    "This is a serious test of skill.",
    "Every detail matters here.",
    "Push yourself - this one demands it.",
    "The pressure is on. Perform.",
    "This is not the time for guessing.",
    "Your sharpest thinking is required.",
    "There is no shortcut through this one.",
    "Stay focused - complexity is ahead.",
    "This problem separates good from great.",
    "Bring everything you have to this one.",
    "The difficulty is real. So is the reward."
  ];

  const detectiveLearn = [
    "Detective, a new case note arrives.",
    "Detective, your evidence board needs an update.",
    "Detective, the next lead is waiting.",
    "Detective, you're back at the crime scene.",
    "Detective, you've found a suspicious pattern.",
    "Detective, a witness has come forward with new information.",
    "Detective, the case file has a new entry.",
    "Detective, HQ flagged this for your attention.",
    "Detective, a fresh clue has surfaced.",
    "Detective, the trail goes cold without your analysis.",
    "Detective, your notebook is open to a new page.",
    "Detective, the inspector assigned you this case.",
    "Detective, the lab results just came back.",
    "Detective, your instincts led you here for a reason.",
    "Detective, another piece of the puzzle has emerged."
  ];

  const detectiveChallenge = [
    "Detective, this case could collapse if you fail.",
    "Detective, the suspect is one step ahead.",
    "Detective, time is running out.",
    "Detective, you must verify every detail.",
    "Detective, one wrong move ruins the trail.",
    "Detective, the pressure from above is mounting.",
    "Detective, the evidence is fragile - handle it carefully.",
    "Detective, the courtroom is waiting for your findings.",
    "Detective, your reputation is on the line.",
    "Detective, the killer knows you're closing in.",
    "Detective, every second you delay costs the case.",
    "Detective, this is the most complex case of your career.",
    "Detective, the chief is watching this one personally.",
    "Detective, a false lead now means the suspect walks free.",
    "Detective, solve this before the trail goes cold forever."
  ];

  const heistLearn = [
    "Crew, a new target has been scouted.",
    "Crew, the blueprints just came in.",
    "Crew, the inside man flagged a new opportunity.",
    "Crew, the mark's schedule has been mapped out.",
    "Crew, a fresh job is on the table.",
    "Crew, the planner left you a new assignment.",
    "Crew, recon on the next vault is ready.",
    "Crew, a low-risk practice run has been lined up.",
    "Crew, the fixer needs this solved before the job.",
    "Crew, the next drill is loaded in the simulator.",
    "Crew, the digital lock schematic needs analysis.",
    "Crew, the front operation needs a working system.",
    "Crew, a test run on the backup server is authorized.",
    "Crew, the safecracker left notes you need to decode.",
    "Crew, the getaway route depends on cracking this first."
  ];

  const heistChallenge = [
    "Crew, the vault closes in minutes.",
    "Crew, the security system just upgraded - adapt.",
    "Crew, one wrong move triggers the silent alarm.",
    "Crew, the window to execute is closing fast.",
    "Crew, the mark has a counter-intrusion AI running.",
    "Crew, the backup guard rotation starts soon.",
    "Crew, there is no second attempt on this job.",
    "Crew, every second inside increases the risk.",
    "Crew, the entire score depends on this step.",
    "Crew, the rival crew is hitting the same vault tonight.",
    "Crew, the inside man's cover breaks if this takes too long.",
    "Crew, the digital trail must be clean - no traces.",
    "Crew, the getaway driver is already waiting.",
    "Crew, the client pulls the contract if this fails.",
    "Crew, precision is the only thing standing between you and the score."
  ];

  const spyLearn = [
    "Agent, your next briefing has arrived.",
    "Agent, the mission file is now open.",
    "Agent, HQ has a new objective for you.",
    "Agent, your handler left new intelligence.",
    "Agent, a new operation has been authorized.",
    "Agent, the dossier on your next target is ready.",
    "Agent, a coded message arrived from the field.",
    "Agent, your cover identity needs a new skill.",
    "Agent, the training room has a new simulation loaded.",
    "Agent, intelligence suggests a new pattern of activity.",
    "Agent, your gadget specialist left you a new tool.",
    "Agent, the safe house received a new assignment.",
    "Agent, surveillance footage requires your analysis.",
    "Agent, your next extraction point needs preparation.",
    "Agent, the cipher team needs your help decoding this."
  ];

  const spyChallenge = [
    "Agent, this mission is classified critical.",
    "Agent, failure is not an option here.",
    "Agent, the enemy is watching your every move.",
    "Agent, one mistake burns the entire operation.",
    "Agent, the clock is already ticking.",
    "Agent, your cover is at risk if you move too slowly.",
    "Agent, the target suspects they are being watched.",
    "Agent, extraction is impossible if the alarm is triggered.",
    "Agent, double agents are watching for any errors.",
    "Agent, the fate of the entire network rests on this.",
    "Agent, communications go dark after this transmission.",
    "Agent, the enemy has your last known position.",
    "Agent, this operation cannot leave a trace behind.",
    "Agent, your backup has been compromised - you're alone.",
    "Agent, the window for success is closing rapidly."
  ];

  const sentinelLearn = [
    "Ghost, someone out there needs your help.",
    "Ghost, an anonymous tip just hit your terminal.",
    "Ghost, the vulnerable have no one else to call.",
    "Ghost, you picked up a distress signal on the dark net.",
    "Ghost, a new threat is targeting ordinary people.",
    "Ghost, your scanner flagged something the system ignored.",
    "Ghost, nobody sent you here. Your conscience did.",
    "Ghost, the underground channel posted a cry for help.",
    "Ghost, you work off the grid for a reason. Now use it.",
    "Ghost, your tools are sharp and the cause is clear.",
    "Ghost, a new pattern of predatory attacks has surfaced.",
    "Ghost, no payment, no contract, just a problem to solve.",
    "Ghost, the people the system failed are counting on this.",
    "Ghost, your next move is yours alone to decide.",
    "Ghost, another injustice the authorities chose to ignore."
  ];

  const sentinelChallenge = [
    "Ghost, the heist crew is moments away from the score.",
    "Ghost, real people lose everything if you fail this.",
    "Ghost, no backup, no authority, just you and the problem.",
    "Ghost, the crew has more resources and you have more principle.",
    "Ghost, the system will not act, so you must.",
    "Ghost, the attacker is deep inside and moving fast.",
    "Ghost, you made a promise to the people on the other side of this.",
    "Ghost, the trail goes cold if you do not move right now.",
    "Ghost, corporations will not fix this. You will.",
    "Ghost, the crew did not expect anyone to fight back.",
    "Ghost, leave no trace of yourself, only of your work.",
    "Ghost, this one is personal. Someone you know is the target.",
    "Ghost, the clock is running and no one is coming to help you.",
    "Ghost, do it right, do it clean, do it for the right reasons.",
    "Ghost, when it is done the world will not know your name. That is the point."
  ];

  const base = mode === "challenge" ? commonChallenge : commonLearn;

  if(!storyId) return base;
  
  if (storyId === "detective_v1") return base.concat(mode === "challenge" ? detectiveChallenge : detectiveLearn);
  if (storyId === "heist_v1") return base.concat(mode === "challenge" ? heistChallenge : heistLearn);
  if (storyId === "spy_v1") return base.concat(mode === "challenge" ? spyChallenge : spyLearn);
  if (storyId === "sentinel_v1") return base.concat(mode === "challenge" ? sentinelChallenge : sentinelLearn);

  // other stories fall back to base
  return base;
}

export function buildNarrative({ storyId, mode, topic, problemId, originalTitle, originalDescription, language, skipAi }) {
  const templateId = getTemplateId(storyId, topic, mode);
  const effectiveStoryId = skipAi ? null : storyId;  // if skipping AI, also skip story-specific phrasing to keep it more neutral
  const phrase = pickDeterministic(getPhraseBank(effectiveStoryId, mode), `${problemId}_${language}_${mode}_${topic}`);

  // Keep the original meaning, add a story wrapper
  const narrativeTitle = `${phrase} (${topic})`;
  const narrativeText =
    `${phrase}\n\n` +
    `Task: ${originalTitle}\n` +
    `${originalDescription}\n\n` +
    (mode === "challenge"
      ? "Use the given test cases to validate your solution."
      : "Focus on writing a clear solution before checking test cases.");

  return {
    templateId,
    narrative: {
      title: narrativeTitle,
      description: narrativeText
    }
  };
}
