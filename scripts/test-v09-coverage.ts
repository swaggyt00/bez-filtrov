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


const adaptedBySourceId = new Map(deck.map((card) => [card.sourceCardId, card]))
for (const source of cards.filter((card) => card.type === 'truth' && card.scenario !== 'sex')) {
  const adapted = adaptedBySourceId.get(source.id)
  assert.ok(adapted, `missing adapted Truth: ${source.id}`)
  if (!adapted) continue
  if (source.heat === 'light') {
    assert.ok(adapted.risk === 1, `${source.id}: light Truth was inflated to risk ${adapted.risk}`)
  }
  if (source.heat === 'hot') {
    assert.ok(adapted.risk <= 2, `${source.id}: hot Truth was inflated to three fire`)
  }
}

console.log('✓ v0.9 Truth risk has no hash-based three-fire inflation')

const expectedLegacyThreeFireTruthIds = [
  'afterdark-hard-truth-001',
  'afterdark-hard-truth-002',
  'afterdark-hard-truth-003',
  'afterdark-hard-truth-004',
  'afterdark-hard-truth-008',
  'afterdark-hard-truth-010',
  'afterdark-hard-truth-013',
  'couple-hard-truth-001',
  'couple-hard-truth-003',
  'couple-hard-truth-004',
  'couple-hard-truth-005',
  'couple-hard-truth-014',
  'couple-hard-truth-015',
  'couple-hard-truth-016',
  'couple-hard-truth-018',
  'party-hard-truth-006',
  'party-hard-truth-008',
  'party-hard-truth-016',
  'party-hard-truth-019',
]
const actualLegacyThreeFireTruthIds = deck
  .filter((card) => card.scenario !== 'sex' && card.type === 'truth' && card.risk === 3)
  .map((card) => card.sourceCardId)
  .filter((id): id is string => Boolean(id))
  .sort()
assert.ok(
  JSON.stringify(actualLegacyThreeFireTruthIds) === JSON.stringify(expectedLegacyThreeFireTruthIds),
  `three-fire legacy Truth allowlist drifted: ${actualLegacyThreeFireTruthIds.join(', ')}`,
)

console.log('✓ v0.9 legacy three-fire Truths are manual allowlist only')


const bySourceId = new Map(cards.map((card) => [card.id, card]))
for (const card of deck) {
  const source = card.sourceCardId ? bySourceId.get(card.sourceCardId) : null
  if (source?.scenario === 'sex' && source.heat === 'hard' && source.sexualAction) {
    assert.ok(
      !/(двадцать|тридцать|сорок) секунд/i.test(card.text),
      `${source.id}: direct sexual action still uses the old short timer: ${card.text}`,
    )
  }
}

console.log('✓ v0.9 direct Sex timers are expanded')
