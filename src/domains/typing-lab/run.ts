export interface TypingPrompt {
  id: string;
  japanese: string;
  reading: string;
  meaning: string;
  hint?: string;
}

export function normalizeJapanese(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ");
}

export function scoreTypingAnswer(expected: string, actual: string) {
  const target = normalizeJapanese(expected);
  const answer = normalizeJapanese(actual);
  if (!answer) return { correct: false, accuracy: 0 };
  const distance = levenshtein(target, answer);
  return {
    correct: target === answer,
    accuracy: Math.max(0, Math.round((1 - distance / Math.max(target.length, answer.length)) * 100)),
  };
}

function levenshtein(left: string, right: string) {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = row[0]!;
    row[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const above = row[j]!;
      row[j] = left[i - 1] === right[j - 1]
        ? diagonal
        : Math.min(diagonal + 1, row[j]! + 1, row[j - 1]! + 1);
      diagonal = above;
    }
  }
  return row[right.length]!;
}
