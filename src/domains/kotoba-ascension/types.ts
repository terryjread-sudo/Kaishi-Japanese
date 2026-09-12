export type AscensionNodeType = 'combat' | 'elite' | 'rest' | 'shop' | 'boss';
export type CardRole = 'noun' | 'verb' | 'adjective' | 'other';
export type CardKind = 'word' | 'particle';
export type RunPhase = 'map' | 'combat' | 'rest' | 'shop' | 'boss' | 'victory' | 'defeat';

export interface AscensionWord {
  id: string;
  word: string;
  reading: string;
  meaning: string;
  role?: CardRole;
  topicId?: string;
  wordAudio?: string;
}

export interface AscensionCard {
  id: string;
  wordId?: string;
  text: string;
  reading?: string;
  meaning?: string;
  role: CardRole;
  kind: CardKind;
  particle?: string;
  mastery: number;
}

export interface AscensionNode {
  id: string;
  layer: number;
  type: AscensionNodeType;
  label: string;
  connections: string[];
}

export interface AscensionMap {
  seed: number;
  nodes: AscensionNode[];
  currentNodeId: string;
}

export interface AscensionResources {
  hp: number;
  maxHp: number;
  energy: number;
  maxEnergy: number;
  focus: number;
  maxFocus: number;
  adventurePoints: number;
}

export interface AscensionEnemy {
  id: string;
  name: string;
  meaning: string;
  maxHp: number;
  hp: number;
  telegraph: number;
  elite?: boolean;
  boss?: boolean;
}

export interface AscensionRunState {
  schemaVersion: 1;
  runId: string;
  topicId: string;
  prologue: boolean;
  phase: RunPhase;
  map: AscensionMap;
  resources: AscensionResources;
  deck: AscensionCard[];
  hand: AscensionCard[];
  discard: AscensionCard[];
  enemy?: AscensionEnemy;
  turn: number;
  wins: number;
  pendingMessage: string;
  selectedCardIds: string[];
}

export interface ChainResult {
  outcome: 'full' | 'partial' | 'fizzle';
  damage: number;
  block: number;
  energySpent: number;
  focusSpent: number;
  explanation: string;
}
