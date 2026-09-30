export type SignalChannel = 'telegram' | 'letter' | 'telephone' | 'intercept';
export type SignalVerdict = 'standard' | 'escalate';
export type SignalAid = 'full' | 'reading' | 'dictionary';
export type SignalPhase = 'briefing' | 'decode' | 'feedback' | 'report' | 'failed';

export type SignalRule =
  | { op: 'fact'; fact: string }
  | { op: 'all' | 'any'; rules: SignalRule[] }
  | { op: 'not'; rule: SignalRule };

export interface SignalToken { surface: string; reading: string; meaning: string; fact?: string }

export type SignalEventKind = 'amendment' | 'blackout' | 'priority' | 'visitor' | 'warning';

export interface SignalEvent {
  kind: SignalEventKind;
  headline: string;
  body: string;
  speaker?: string;
  portrait?: 'kuroda' | 'crane' | 'mori';
  ruleText?: string;
  ruleOverride?: SignalRule;
}

export interface SignalStoryBeat {
  speaker: string;
  text: string;
  portrait: 'kuroda' | 'crane' | 'mori';
}

export interface SignalCase {
  id: string;
  channel: SignalChannel;
  japanese: string;
  reading: string;
  english: string;
  tokens: SignalToken[];
  facts: string[];
  decisiveFacts: string[];
  explanation: string;
  practiceIds: string[];
  speaker?: string;
  event?: SignalEvent;
  storyAfter?: string;
}

export interface SignalShift {
  id: string;
  sequence: number;
  department: string;
  title: string;
  location: string;
  briefing: string;
  guidance: string;
  ruleText: string;
  rule: SignalRule;
  aid: SignalAid;
  seconds: number | null;
  delayedFeedback: boolean;
  story?: SignalStoryBeat;
  debrief?: string;
  cases: SignalCase[];
}

export interface SignalDecision {
  caseId: string;
  verdict: SignalVerdict;
  correct: boolean;
  evidenceCorrect: boolean;
  selectedEvidence: string[];
  assisted: boolean;
}

export interface SignalCareer {
  schemaVersion: 1;
  credits: number;
  attempts: number;
  completedShiftIds: string[];
  rank: string;
  commendations: string[];
  strikes: number;
  timerDisabled: boolean;
}

export interface SignalRun {
  version: 3;
  shiftId: string;
  index: number;
  phase: SignalPhase;
  decisions: SignalDecision[];
  selectedEvidence: string[];
  lookedUpTokens: string[];
  paused: boolean;
  remaining: number;
  assisted: boolean;
  daily: boolean;
  career: SignalCareer;
}

export interface LegacyCheckpointState {
  credits?: number;
  attempts?: number;
  cleared?: number[];
  completedLevels?: number[];
}
