export interface AnswerFeedback {
  selected: string;
  answer: string;
  correct: boolean;
  guessed?: boolean;
  explanation?: string;
  word?: { word: string; reading?: string; meaning: string };
  selectedWord?: { word: string; reading?: string; meaning: string };
}

const contrasts: Readonly<Record<string,string>> = {
  'はい|いいえ': 'はい is a polite “yes”; いいえ is a polite “no”. Listen for the opening sound to distinguish them.',
  'いいえ|はい': 'いいえ is a polite “no”; はい is a polite “yes”. The repeated い sound helps distinguish いいえ.',
};

export function feedbackExplanation(value: AnswerFeedback): string {
  if (value.correct && value.guessed) return 'Correct, and marked as a guess. This word will return for practice.';
  if (value.explanation) return value.explanation;
  if (value.correct) return 'You matched the answer. Continue when you are ready.';
  const contrast=contrasts[`${value.word?.word}|${value.selectedWord?.word}`];
  if(contrast)return contrast;
  const describe = (word: NonNullable<AnswerFeedback['word']>) => `${word.word}${word.reading && word.reading !== word.word ? ` (${word.reading})` : ''} means “${word.meaning}”.`;
  if (value.word) return `${describe(value.word)}${value.selectedWord ? ` ${describe(value.selectedWord)}` : ''}`;
  return `The expected answer here is “${value.answer}”. Compare it with your choice before continuing.`;
}
