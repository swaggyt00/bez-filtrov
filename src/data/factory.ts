import type {
  CardInteraction,
  CardMechanic,
  CardScene,
  CardType,
  GameCard,
  Heat,
  PairingRule,
  PlayerGender,
  Scenario,
  TruthPurpose,
} from '../types'

export interface AuthoredCardSeed {
  text: string
  theme: string
  coreIdea: string
  mechanic: CardMechanic
  interaction: CardInteraction
  purpose?: TruthPurpose
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
}

function buildId(scenario: Scenario, heat: Heat, type: CardType, index: number) {
  return `${scenario}-${heat}-${type}-${String(index + 1).padStart(3, '0')}`
}

export function authored(
  text: string,
  theme: string,
  coreIdea: string,
  mechanic: CardMechanic,
  interaction: CardInteraction,
  options: Omit<AuthoredCardSeed, 'text' | 'theme' | 'coreIdea' | 'mechanic' | 'interaction'> = {},
): AuthoredCardSeed {
  return { text: text.trim(), theme, coreIdea, mechanic, interaction, ...options }
}

export function authoredDeck(args: {
  scenario: Scenario
  heat: Heat
  type: CardType
  cards: AuthoredCardSeed[]
}) {
  return args.cards.map<GameCard>((item, index) => ({
    id: buildId(args.scenario, args.heat, args.type, index),
    scenario: args.scenario,
    heat: args.heat,
    type: args.type,
    ...item,
  }))
}
