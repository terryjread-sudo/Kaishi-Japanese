export type SenseiErrorTag = 'meaning' | 'particle' | 'kana';
export type SenseiVerdict = 'correct' | 'needs-correction';
export type SenseiShiftPhase = 'desk' | 'correction' | 'summary' | 'passed' | 'failed';

export interface SenseiWord {
  id: string;
  word: string;
  reading: string;
  meaning: string;
  wordAudio?: string;
}

export interface SenseiWordProgress {
  due?: number;
  strength?: number;
  deskMisses?: number;
}

export interface PupilProfile {
  id: string;
  name: string;
  role: string;
  portrait: string;
  encouragement: string;
  concern: string;
}

export interface HomeworkLine {
  id: string;
  wordId: string;
  japanese: string;
  reading: string;
  meaning: string;
  correctJapanese: string;
  correctReading: string;
  correctMeaning: string;
  isCorrect: boolean;
  errorTag?: SenseiErrorTag;
  explanation: string;
  audio?: string;
}

export interface HomeworkSubmission {
  id: string;
  pupil: PupilProfile;
  subject: string;
  paperAsset: string;
  lines: HomeworkLine[];
}

export interface GradeDecision {
  verdict: SenseiVerdict;
  errorTag?: SenseiErrorTag;
}

export interface PaperResult {
  correct: number;
  total: number;
  mistakes: string[];
  reviewed: boolean;
}

export interface SenseiShiftState {
  schemaVersion: 1;
  shiftId: string;
  dateKey: string;
  phase: SenseiShiftPhase;
  currentIndex: number;
  submissions: HomeworkSubmission[];
  decisions: Record<string, GradeDecision>;
  paperResults: Record<string, PaperResult>;
  reputation: number;
  quota: { total: number; submitted: number };
  guided?: boolean;
  startedAt: number;
  deadlineAt: number;
  missedLineIds: string[];
}
