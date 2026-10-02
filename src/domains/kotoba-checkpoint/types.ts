export type SignalChannel = 'telegram' | 'letter' | 'telephone' | 'intercept';
export type SignalVerdict = 'standard' | 'escalate';
export type SignalAid = 'full' | 'reading' | 'dictionary';
export type SignalPhase = 'briefing' | 'decode' | 'feedback' | 'report' | 'failed';
export type SignalConfidence = 'uncertain' | 'fair' | 'confident';
export type SignalOperationalAction = 'monitor' | 'verify' | 'dispatch';
export type SignalSpecialisation = 'linguist' | 'listener' | 'field' | 'cryptographer';
export type SignalDebriefMode = 'guided' | 'operational' | 'sealed';
export type SignalEvidenceStatus = 'confirmed' | 'doubtful' | 'contradiction';
export type SignalUrgency = 'routine' | 'priority' | 'urgent';
export type SignalVerificationAction = 'dictionary' | 'slow-replay' | 'source-check' | 'translation' | 'director-hint';

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
  urgency?: SignalUrgency;
  arrivalDelay?: number;
  investigationThread?: string;
  location?: string;
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
  confidence?: SignalConfidence;
  operationalAction?: SignalOperationalAction;
  expired?: boolean;
  verificationSpent?: number;
  quickFiled?: boolean;
}

export interface SignalWordMemory {
  surface: string;
  reading: string;
  meaning: string;
  encounters: number;
  independentRecalls: number;
  assistedRecalls: number;
  misses: number;
  readingStrength: number;
  listeningStrength: number;
  markedForPractice: boolean;
}

export interface SignalRelationships {
  mori: number;
  kuroda: number;
  crane: number;
}

export interface SignalSourceRecord {
  name: string;
  reports: number;
  accurateFilings: number;
  lastClaim: string;
}

export interface SignalInvestigation {
  facts: string[];
  doubtfulFacts: string[];
  contradictions: string[];
  sources: Record<string, SignalSourceRecord>;
  operationalActions: SignalOperationalAction[];
  threads: Record<string, SignalThreadRecord>;
}

export interface SignalThreadRecord {
  id: string;
  reports: number;
  accurateFilings: number;
  facts: string[];
  locations: string[];
  lastUpdated: number;
}

export interface SignalArchiveEntry {
  shiftId: string;
  title: string;
  cleared: boolean;
  independentFilings: number;
  collectedAt: number;
}

export interface SignalCareer {
  schemaVersion: 2;
  credits: number;
  attempts: number;
  completedShiftIds: string[];
  rank: string;
  commendations: string[];
  strikes: number;
  timerDisabled: boolean;
  wordMemory: Record<string, SignalWordMemory>;
  relationships: SignalRelationships;
  specialisation?: SignalSpecialisation;
  equippedTools: string[];
  debriefMode: SignalDebriefMode;
  investigation: SignalInvestigation;
  archive: SignalArchiveEntry[];
}

export interface SignalRun {
  version: 4;
  shiftId: string;
  index: number;
  phase: SignalPhase;
  decisions: SignalDecision[];
  selectedEvidence: string[];
  lookedUpTokens: string[];
  paused: boolean;
  remaining: number;
  assisted: boolean;
  recalledTokens?: string[];
  confidence?: SignalConfidence;
  evidenceStatus?: Record<string, SignalEvidenceStatus>;
  readingVisible?: boolean;
  translationVisible?: boolean;
  daily: boolean;
  career: SignalCareer;
  queuedCaseIds: string[];
  unreleasedCaseIds: string[];
  expiredCaseIds: string[];
  activeCaseId?: string;
  queueAge: Record<string, number>;
  nextArrivalIn: number;
  verification: number;
  maxVerification: number;
  verificationSpent: number;
  equipmentUses: Record<string, number>;
  quickFiledCaseIds: string[];
  elapsed: number;
}

export interface LegacyCheckpointState {
  credits?: number;
  attempts?: number;
  cleared?: number[];
  completedLevels?: number[];
}
