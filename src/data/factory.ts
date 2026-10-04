import type { CardMechanic, CardType, GameCard, Heat, Scenario, TruthPurpose } from '../types'

export interface AuthoredGroup {
  theme: string
  mechanic: CardMechanic
  texts: string[]
  purpose?: TruthPurpose
  sexualAction?: boolean
  alcohol?: boolean
}

function buildId(scenario: Scenario, heat: Heat, type: CardType, index: number) {
  return `${scenario}-${heat}-${type}-${String(index + 1).padStart(3, '0')}`
}

export function group(
  theme: string,
  mechanic: CardMechanic,
  texts: string[],
  options: Pick<AuthoredGroup, 'purpose' | 'sexualAction' | 'alcohol'> = {},
): AuthoredGroup {
  return { theme, mechanic, texts, ...options }
}

export function authoredDeck(args: {
  scenario: Scenario
  heat: Heat
  type: CardType
  groups: AuthoredGroup[]
}) {
  const entries = args.groups.flatMap((item) =>
    item.texts.map((text) => ({
      text: text.trim(),
      theme: item.theme,
      mechanic: item.mechanic,
      purpose: item.purpose,
      sexualAction: item.sexualAction,
      alcohol: item.alcohol,
    })),
  )

  return entries.map<GameCard>((item, index) => ({
    id: buildId(args.scenario, args.heat, args.type, index),
    scenario: args.scenario,
    heat: args.heat,
    type: args.type,
    text: item.text,
    theme: item.theme,
    mechanic: item.mechanic,
    purpose: item.purpose,
    sexualAction: item.sexualAction,
    alcohol: item.alcohol,
  }))
}
