export type CardType = 'truth' | 'dare'
export type Scenario = 'couple' | 'sex' | 'party' | 'afterdark'
export type Heat = 'light' | 'hot' | 'hard'
export type PlayerGender = 'male' | 'female'
export type GameStage = 'choice' | 'card'
export type PairingPreference = 'male' | 'female' | 'any' | 'none'
export type PairingRule = 'none' | 'any' | 'mutual-close'
export type DurationValue = '1 круг' | '2 круга' | '3 круга' | 'до конца игры'
export type CardSourceRef =
  | 'foreplay-guide'
  | 'foreplay-free-game'
  | 'smush-couples-bank'
  | 'wargamer-spicy-bank'
  | 'xdares-dirty-bank'
  | 'xdares-adult-bank'
  | 'spiced-couple-bank'
  | 'psycat-public-bank'
  | 'tableparty-public-bank'
  | 'truthordaregame-public-bank'
  | 'xdares-couples-bank'
  | 'original-editorial'
  | 'spinwheel-public-bank'
  | 'openers-public-bank'
  | 'truthordarego-public-bank'
  | 'guessy-public-bank'
  | 'allpartygames-public-bank'

export type CardMechanic =
  | 'direct'
  | 'choice'
  | 'rank'
  | 'confession'
  | 'story'
  | 'compatibility'
  | 'conflict'
  | 'desire'
  | 'experience'
  | 'timed'
  | 'partner-choice'
  | 'roleplay'
  | 'control'
  | 'private'
  | 'group'
  | 'position'
  | 'masturbation'
  | 'sex'
  | 'physical'
  | 'embarrassment'
  | 'social'
  | 'clothing'
  | 'alcohol'

export type CardInteraction =
  | 'conversation'
  | 'confession'
  | 'humor'
  | 'flirt'
  | 'physical'
  | 'intimate-choice'
  | 'tension'
  | 'social-choice'
  | 'group-reaction'
  | 'embarrassment'
  | 'clothing'
  | 'alcohol'
  | 'roleplay'
  | 'control'
  | 'sexual-scene'

export type TruthPurpose =
  | 'desire'
  | 'confession'
  | 'experience'
  | 'choice'
  | 'conflict'
  | 'compatibility'
  | 'story'
  | 'curiosity'
  | 'values'

export interface Player {
  name: string
  gender: PlayerGender
  pairingPreference?: PairingPreference
}

export interface CardScene {
  kind?: string
  hook?: string
  objective?: string
  endCondition: string
  props?: string[]
}

export interface GameCard {
  id: string
  type: CardType
  scenario: Scenario
  heat: Heat
  text: string
  theme: string
  mechanic: CardMechanic
  purpose?: TruthPurpose
  coreIdea?: string
  interaction?: CardInteraction
  actorGenders?: PlayerGender[]
  targetGenders?: PlayerGender[]
  actorRole?: string
  targetRole?: string
  pairing?: PairingRule
  requiresTarget?: boolean
  scene?: CardScene
  sexualAction?: boolean
  alcohol?: boolean
  minPlayers?: number
  duration?: 'temporary'
  sourceRef?: CardSourceRef
}

export interface GameSettings {
  players: Player[]
  scenario: Scenario
  heat: Heat
  alcoholCards?: boolean
  soundEnabled?: boolean
}

export interface PersistedGame {
  settings: GameSettings
  currentPlayerIndex: number
  usedCardIds: string[]
  turnsPlayed: number
  stage: GameStage
  currentCardId: string | null
  currentTargetIndex: number | null
  renderedText: string
  notice: string
  updatedAt: number
}
