// Practice exams come in Easy, Medium and Hard versions; list them in that order.
// Titles without a difficulty sort after them (and keep their other order).
export function difficultyRank(title: string) {
  if (/\bEasy\b/i.test(title)) return 0;
  if (/\bMedium\b/i.test(title)) return 1;
  if (/\bHard\b/i.test(title)) return 2;
  return 3;
}
