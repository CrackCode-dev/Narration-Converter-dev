export function makeBeatId(bloomScore) {
  if (bloomScore <= 2) return "beat_01";
  if (bloomScore === 3) return "beat_02";
  if (bloomScore === 4) return "beat_03";
  return "beat_04";
}
