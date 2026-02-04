export function simpleHashToNumber(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
}

// Unsigned Right Shift (>>>): Fills the leftmost bits with zeros, 
// regardless of whether the number was positive or negative.
// and give positive to divide 

export function pickDeterministic(list, keyText) {//list: array of items to choose from, keyText: string used to determine which item to pick
  if (!list.length) return "";
  const n = simpleHashToNumber(keyText);
  return list[n % list.length];
}

