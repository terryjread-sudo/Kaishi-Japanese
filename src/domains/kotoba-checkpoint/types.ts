export type CheckpointSkill = 'kana' | 'numbers' | 'listening' | 'vocabulary' | 'reading' | 'grammar' | 'compound';
export type Verdict = 'approve' | 'deny';

export interface CheckpointLevel {
  id: number;
  title: string;
  location: string;
  skill: CheckpointSkill;
  rule: string;
  guidance: string;
  aid: 'full' | 'romaji' | 'minimal';
  seconds: number;
  travellers: number;
}

export interface CheckpointDocument {
  label: string;
  japanese: string;
  romaji: string;
  english: string;
}

export interface CheckpointCase {
  id: string;
  traveller: string;
  portrait: string;
  city: string;
  passport: CheckpointDocument;
  entry: CheckpointDocument;
  question?: { japanese: string; romaji: string; english: string; answer: string };
  ruleId: string;
  expected: Verdict;
  explanation: string;
  practiceIds: string[];
}

export interface CheckpointRun {
  version: 2;
  level: number;
  index: number;
  cases: CheckpointCase[];
  correct: number;
  mistakes: string[];
  paused: boolean;
  remaining: number;
  phase: 'briefing' | 'inspect' | 'feedback' | 'report' | 'failed';
  credits: number;
  completedLevels: number[];
}

export interface CheckpointLearnerWord {
  id: string;
  word: string;
  reading: string;
  meaning: string;
  wordAudio?: string;
}
