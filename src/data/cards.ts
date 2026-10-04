import type { CardType, GameCard, Heat, Scenario } from '../types'
import couple from './cards-couple-v3.json'
import sex from './cards-sex-v3.json'
import party from './cards-party-v3.json'
import afterdark from './cards-afterdark-v3.json'

type RawCard = { type: CardType; heat: Heat; text: string }

const sources: Record<Scenario, RawCard[]> = {
  couple: couple as RawCard[],
  sex: sex as RawCard[],
  party: party as RawCard[],
  afterdark: afterdark as RawCard[],
}

export const cards: GameCard[] = (Object.entries(sources) as Array<[Scenario, RawCard[]]>).flatMap(([scenario, entries]) =>
  entries.map((entry, index) => ({
    id: `${scenario}-${entry.heat}-${entry.type}-${String(index + 1).padStart(2, '0')}`,
    scenario,
    type: entry.type,
    heat: entry.heat,
    text: entry.text,
    alcohol: /алкогол|пья|глоток|напит/i.test(entry.text),
  })),
)
