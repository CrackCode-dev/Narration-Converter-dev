import fs from "fs";

export function loadUsageRegistry(filePath) {
  if (!fs.existsSync(filePath)) {
    return { learnUsedProblemIds: [], challengeUsedHardProblemIds: [], phasesCompleted: 0 };
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function saveUsageRegistry(filePath, registry) {
  fs.writeFileSync(filePath, JSON.stringify(registry, null, 2), "utf8");
}

export function getLearnUsedSet(registry) {
  return new Set(registry.learnUsedProblemIds || []);
}

export function getChallengeUsedHardSet(registry) {
  return new Set(registry.challengeUsedHardProblemIds || []);
}

export function addLearnUsed(registry, problemIds) {
  const s = new Set(registry.learnUsedProblemIds || []);
  for (const id of problemIds) s.add(id);
  registry.learnUsedProblemIds = Array.from(s);
}

export function addChallengeUsedHard(registry, problemIds, phase) {
  const s = new Set(registry.challengeUsedHardProblemIds || []);
  for (const id of problemIds) s.add(id);
  registry.challengeUsedHardProblemIds = Array.from(s);
  registry.phasesCompleted = Math.max(registry.phasesCompleted || 0, phase);
}