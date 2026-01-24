function takeFirstN(list, n) {
  return list.slice(0, n);
}

export function pickLearnProblems({ allProblems, countsPerDifficulty }) {
  const easy = allProblems.filter(p => p.difficulty === "Easy");
  const medium = allProblems.filter(p => p.difficulty === "Medium");
  const hard = allProblems.filter(p => p.difficulty === "Hard");

  const selectedEasy = takeFirstN(easy, countsPerDifficulty.Easy || 0);
  const selectedMedium = takeFirstN(medium, countsPerDifficulty.Medium || 0);
  const selectedHard = takeFirstN(hard, countsPerDifficulty.Hard || 0);

  const selected = [...selectedEasy, ...selectedMedium, ...selectedHard];

  return {
    selected,
    meta: {
      requested: countsPerDifficulty,
      got: {
        Easy: selectedEasy.length,
        Medium: selectedMedium.length,
        Hard: selectedHard.length
      }
    }
  };
}
