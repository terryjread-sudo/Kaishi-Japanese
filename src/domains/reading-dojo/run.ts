export interface ReadingWord {
  id: string;
  word: string;
  reading: string;
  meaning: string;
}

export interface ReadingQuestion {
  prompt: string;
  answers: string[];
  correct: number;
  explanation: string;
}

export interface ReadingPassage {
  id: string;
  title: string;
  source: "original" | "public-domain";
  level: string;
  japanese: string[];
  translation: string[];
  vocabulary: ReadingWord[];
  questions: ReadingQuestion[];
}

export function scoreReadingAnswer(question: ReadingQuestion, answer: number) {
  return answer === question.correct;
}

export function passageProgressKey(passageId: string) {
  return `reading:${passageId}`;
}
