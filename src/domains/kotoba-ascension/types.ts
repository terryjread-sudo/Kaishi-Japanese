export type AscensionNodeType = 'combat' | 'elite' | 'rest' | 'shop' | 'event' | 'treasure' | 'boss';
export type CardRole = 'noun' | 'verb' | 'adjective' | 'other';
export type CardKind = 'word' | 'particle';
export type EnemyIntent = 'attack' | 'ward' | 'confuse';
export type RunPhase = 'map' | 'combat' | 'rest' | 'shop' | 'event' | 'reward' | 'boss' | 'victory' | 'defeat';

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
  cost: number;
  upgradeLevel: number;
}

export interface AscensionRelic {
  id: string;
  name: string;
  description: string;
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
  intent: EnemyIntent;
  phase: number;
  elite?: boolean;
  boss?: boolean;
}

export interface AscensionRunState {
  schemaVersion: 2;
  runId: string;
  topicId: string;
  prologue: boolean;
  phase: RunPhase;
  map: AscensionMap;
  resources: AscensionResources;
  deck: AscensionCard[];
  drawPile: AscensionCard[];
  hand: AscensionCard[];
  discard: AscensionCard[];
  rewardPool: AscensionCard[];
  rewardChoices: AscensionCard[];
  rewardRelic?: AscensionRelic;
  relics: AscensionRelic[];
  block: number;
  enemy?: AscensionEnemy;
  turn: number;
  wins: number;
  pendingMessage: string;
  selectedCardIds: string[];
  eventId?: string;
}

export interface ChainResult {
  outcome: 'full' | 'partial' | 'fizzle';
  damage: number;
  block: number;
  energySpent: number;
  focusSpent: number;
  explanation: string;
}
