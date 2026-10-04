export type CardType = 'truth' | 'dare'
export type Relationship = 'new' | 'dating' | 'longterm' | 'mixed'
export type Category = 'relations' | 'sex' | 'fantasy' | 'jealousy' | 'past' | 'alcohol' | 'chaos'
export type GameMode = 'classic' | 'couple' | 'hardTruth' | 'intimate' | 'relations' | 'party'
export type IntensityStyle = 'ramp' | 'direct'
export type CardMechanic = 'standard' | 'choice' | 'scale' | 'guess' | 'simultaneous' | 'top3' | 'joint'
export type BoundaryTopic = 'exes' | 'infidelity' | 'thirdPerson' | 'comparison' | 'toys' | 'alcohol' | 'public' | 'jealousy' | 'explicitSex' | 'future'
export type CardOutcome = 'completed' | 'skipped' | 'rerolled'
export type SpecialRound = 'boss' | 'duo' | null
export type PlayerGender = 'male' | 'female' | 'unspecified'

export interface GameCard {
  id: string
  type: CardType
  intensity: number
  relationships: Relationship[]
  categories: Category[]
  text: string
  custom?: boolean
  synthetic?: boolean
  sourceCardId?: string
  mechanic?: CardMechanic
}

export interface GameSettings {
  players: string[]
  playerGenders: PlayerGender[]
  relationship: Relationship
  intensity: number
  intensityStyle: IntensityStyle
  categories: Category[]
  mode: GameMode
  hardLimits: BoundaryTopic[]
  softLimits: BoundaryTopic[]
  sessionLength: number | null
  alcoholRule: boolean
  soundEnabled: boolean
  hapticsEnabled: boolean
}

export interface CategoryStat {
  completed: number
  skipped: number
  rerolled: number
}

export interface SessionMemory {
  categoryStats: Record<Category, CategoryStat>
  typePicks: Record<CardType, number>
  mechanicsRecent: CardMechanic[]
  adaptiveOffset: number
  feedback: {
    tooEasy: number
    okay: number
    tooHard: number
  }
}

export interface HistoryEntry {
  id: string
  cardId: string
  cardText: string
  type: CardType
  categories: Category[]
  intensity: number
  mechanic: CardMechanic
  outcome: CardOutcome
  playerIndex: number
  turnNumber: number
  specialRound: SpecialRound
  timestamp: number
}

export interface FollowUpSeed {
  sourceCardId: string
  sourceText: string
  sourceCategories: Category[]
  sourceIntensity: number
  dueTurn: number
}

export interface PersistedGame {
  settings: GameSettings
  currentPlayerIndex: number
  usedCardIds: string[]
  rounds: number
  turnsPlayed: number
  recentCardIds: string[]
  recentCategories: Category[]
  memory: SessionMemory
  history: HistoryEntry[]
  followUps: FollowUpSeed[]
  createdAt: number
}

export interface SavedSession {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  state: PersistedGame
}
