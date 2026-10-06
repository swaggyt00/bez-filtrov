import type { CardType, Player, Scenario } from '../types'

export type RiskLevel = 1 | 2 | 3
export type SessionStage = 0 | 1 | 2 | 3 | 4
export type ClothingState = 'clothed' | 'partially-undressed' | 'underwear' | 'partially-nude' | 'nude'
export type EventFamily = 'control' | 'constraint' | 'continuation' | 'wildcard' | 'fetish'
export type BossFamily =
  | 'tease'
  | 'control'
  | 'undress'
  | 'oral'
  | 'position'
  | 'edging'
  | 'dom-sub'
  | 'fetish'
  | 'sex'
  | 'connection'
  | 'social'
  | 'chaos'

export type ChainFamily =
  | 'conversation'
  | 'confession'
  | 'flirt'
  | 'connection'
  | 'physical'
  | 'tease'
  | 'kissing'
  | 'undress'
  | 'control'
  | 'oral'
  | 'position'
  | 'edging'
  | 'dom-sub'
  | 'fetish'
  | 'sex'
  | 'social'
  | 'embarrassment'
  | 'chaos'

export type BoundaryTag =
  | 'oral'
  | 'penetration'
  | 'spanking'
  | 'bondage'
  | 'dom-sub'
  | 'edging'
  | 'toys'
  | 'anal'
  | 'feet'
  | 'roleplay'

export interface PlayerDirectorState {
  player: Player
  clothing: ClothingState
  riskHistory: RiskLevel[]
  cautionPressure: number
  activeEffectIds: string[]
}

export interface ActiveEffect {
  id: string
  label: string
  family: EventFamily
  playerIndex?: number
  remainingTurns: number
}

export interface DirectorHistoryEntry {
  cardId: string
  type: CardType
  risk: RiskLevel
  playerIndex: number
  targetIndex: number | null
  chains: ChainFamily[]
  skipped: boolean
}

export interface DirectorState {
  scenario: Scenario
  sessionStage: SessionStage
  tension: number
  chainFamily: ChainFamily | null
  chainDepth: number
  currentPosition: string | null
  leaderIndex: number | null
  players: PlayerDirectorState[]
  activeEffects: ActiveEffect[]
  mutuallyAllowedBoundaries: BoundaryTag[]
  history: DirectorHistoryEntry[]
  turnsPlayed: number
  lastEventTurn: number
  lastBossTurn: number
}

export interface CardRequirements {
  minPlayers?: number
  clothing?: ClothingState[]
  positions?: string[]
  boundaries?: BoundaryTag[]
  requiredEffects?: string[]
  forbiddenEffects?: string[]
}

export interface CardEffects {
  position?: string | null
  leader?: 'actor' | 'target' | 'clear'
  actorClothing?: ClothingState
  targetClothing?: ClothingState
  addEffects?: ActiveEffect[]
  tensionDelta?: number
}

export interface DirectorCard {
  id: string
  scenario: Scenario
  type: CardType
  text: string
  risk: RiskLevel
  stages: SessionStage[]
  chains: ChainFamily[]
  requires?: CardRequirements
  effects?: CardEffects
  nextHooks?: ChainFamily[]
  sourceCardId?: string
  targetRequired?: boolean
}

export interface DirectorEvent {
  id: string
  family: EventFamily
  title: string
  description: string
  targetPlayerIndex?: number
  forcedMinimumRisk?: RiskLevel
  partnerChoosesRisk?: boolean
  modifierCount?: number
  forcedChain?: ChainFamily
  forcedBoundary?: BoundaryTag
  remainingTurns: number
}

export interface BossTemplate {
  id: string
  scenario: Scenario
  family: BossFamily
  minStage: SessionStage
  minChainDepth: number
  minTension: number
  phases: number
}

export interface DirectorPick {
  card: DirectorCard
  score: number
}


export type BoundaryChoice = 'yes' | 'maybe' | 'no'
export type SexStartState = 'clothed' | 'underwear' | 'nude'
export type GameView = 'risk' | 'card' | 'event' | 'boss'

export interface V09GameSettings {
  players: Player[]
  scenario: Scenario
  sexStartState: SexStartState
  mutuallyAllowedBoundaries: BoundaryTag[]
}

export interface TurnModifier {
  id: string
  label: string
  description: string
}

export interface BossSession {
  id: string
  family: BossFamily
  title: string
  phases: string[]
}

export interface PersistedV09Game {
  settings: V09GameSettings
  director: DirectorState
  currentPlayerIndex: number
  view: GameView
  currentDirectorCardId: string | null
  currentSourceCardId: string | null
  currentRisk: RiskLevel | null
  currentTargetIndex: number | null
  renderedText: string
  currentModifiers: TurnModifier[]
  pendingEvent: DirectorEvent | null
  boss: BossSession | null
  bossPhaseIndex: number
  updatedAt: number
}
