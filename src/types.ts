export type CardType = 'truth' | 'dare'
export type Scenario = 'couple' | 'sex' | 'party' | 'afterdark'
export type Heat = 'light' | 'hot' | 'hard' | 'extreme' | 'madness'
export type PlayerGender = 'male' | 'female'
export type GameStage = 'choice' | 'card'

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
