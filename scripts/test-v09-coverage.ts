const assert = {
  ok(value: unknown, message = 'assert.ok failed') {
    if (!value) throw new Error(message)
  },
}

import { cards } from '../src/data/cards'
import { adaptLegacyDeck } from '../src/v09/legacy-adapter'
import type { RiskLevel, SessionStage } from '../src/v09/types'
import type { Scenario } from '../src/types'

const deck = adaptLegacyDeck(cards)
const maxStage: Record<Scenario, SessionStage> = {
  couple: 3,
  party: 3,
  afterdark: 3,
  sex: 4,
}
const scenarios: Scenario[] = ['couple', 'party', 'afterdark', 'sex']
const risks: RiskLevel[] = [1, 2, 3]

for (const scenario of scenarios) {
  for (let stage = 0; stage <= maxStage[scenario]; stage += 1) {
    for (const risk of risks) {
      const count = deck.filter((card) =>
        card.scenario === scenario
        && card.stages.includes(stage as SessionStage)
        && card.risk === risk,
      ).length
      assert.ok(count >= 3, `${scenario}/stage-${stage}/risk-${risk}: legacy adapter has only ${count} cards`)
    }
  }
}

console.log('✓ v0.9 legacy adapter has risk coverage for every stage')
