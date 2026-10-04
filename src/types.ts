export type CardType = 'truth' | 'dare'
export type Scenario = 'couple' | 'sex' | 'party' | 'afterdark'
export type Heat = 'light' | 'hot' | 'hard'
export type PlayerGender = 'male' | 'female'
export type GameStage = 'choice' | 'card'

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

export type TruthPurpose =
  | 'desire'
  | 'confession'
  | 'experience'
  | 'choice'
  | 'conflict'
  | 'compatibility'
  | 'story'

export interface Player {
  name: string
  gender: PlayerGender
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
  sexualAction?: boolean
  alcohol?: boolean
}

export interface GameSettings {
  players: Player[]
  scenario: Scenario
  heat: Heat
  alcoholCards: boolean
  soundEnabled: boolean
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
