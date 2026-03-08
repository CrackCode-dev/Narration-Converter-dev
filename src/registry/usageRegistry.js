import fs from "fs";

export function loadUsageRegistry(filePath) {
  if (!fs.existsSync(filePath)) {
    return { learnUsedProblemIds: [], challengeUsedProblemIds: [], phasesCompleted: 0 };
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function saveUsageRegistry(filePath, registry) {
  fs.writeFileSync(filePath, JSON.stringify(registry, null, 2), "utf8");
}

export function getLearnUsedSet(registry) {
  return new Set(registry.learnUsedProblemIds || []);
}

export function getChallengeUsedSet(registry) {
  return new Set(registry.challengeUsedProblemIds || []);
}

export function addLearnUsed(registry, problemIds) {
  const s = new Set(registry.learnUsedProblemIds || []);
  for (const id of problemIds) s.add(id);
  registry.learnUsedProblemIds = Array.from(s);
}

export function addChallengeUsed(registry, problemIds, phase) {
  const s = new Set(registry.challengeUsedProblemIds || []);
  for (const id of problemIds) s.add(id);
  registry.challengeUsedProblemIds = Array.from(s);
  registry.phasesCompleted = Math.max(registry.phasesCompleted || 0, phase);
}
/**
 * Reset options (ONLY run if user explicitly passes flags)
 */
export function resetRegistryAll(registry) {
  registry.learnUsedProblemIds = [];
  registry.challengeUsedProblemIds = [];
  registry.phasesCompleted = 0;
  return registry;
}

export function resetRegistryLearnOnly(registry) {
  registry.learnUsedProblemIds = [];
  return registry;
}

export function resetRegistryChallengesOnly(registry) {
  registry.challengeUsedProblemIds = [];
  registry.phasesCompleted = 0;
  return registry;
}