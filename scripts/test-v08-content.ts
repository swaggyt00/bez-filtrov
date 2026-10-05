import { cards } from '../src/data/cards'
import { CARD_SOURCE_REGISTRY } from '../src/data/source-registry'
import { renderCardText } from '../src/deck'
import type { CardType, GameCard, Heat, Player, Scenario } from '../src/types'

const assert = {
  equal(actual: unknown, expected: unknown, message = 'assert.equal failed') {
    if (actual !== expected) throw new Error(`${message}: ${String(actual)} !== ${String(expected)}`)
  },
  ok(value: unknown, message = 'assert.ok failed') {
    if (!value) throw new Error(message)
  },
}

const players: Player[] = [
  { name: 'Максим', gender: 'male', pairingPreference: 'female' },
  { name: 'Рада', gender: 'female', pairingPreference: 'male' },
]

function bucket(scenario: Scenario, heat: Heat, type: CardType) {
  return cards.filter((card) => card.scenario === scenario && card.heat === heat && card.type === type)
}

function assertGroundedCard(card: GameCard) {
  assert.ok(Boolean(card.sourceRef), `${card.id}: missing sourceRef`)
  assert.ok(Boolean(card.sourceRef && CARD_SOURCE_REGISTRY[card.sourceRef]), `${card.id}: unknown sourceRef`)
  const targetIndex = card.requiresTarget === false || card.pairing === 'none' ? null : 1
  const rendered = renderCardText(card, players, 0, targetIndex, () => 0.5)
  assert.ok(!rendered.includes('{{'), `${card.id}: unresolved placeholder: ${rendered}`)
}

for (const heat of ['light', 'hot', 'hard'] as const) {
  const truths = bucket('couple', heat, 'truth')
  const dares = bucket('couple', heat, 'dare')
  assert.equal(truths.length, 60, `couple/${heat}/truth count`)
  assert.equal(dares.length, 60, `couple/${heat}/dare count`)
  for (const card of [...truths, ...dares]) assertGroundedCard(card)
}

const sexExpected: Record<Heat, number> = { light: 60, hot: 70, hard: 80 }
for (const heat of ['light', 'hot', 'hard'] as const) {
  const truths = bucket('sex', heat, 'truth')
  const dares = bucket('sex', heat, 'dare')
  assert.equal(truths.length, sexExpected[heat], `sex/${heat}/truth count`)
  assert.equal(dares.length, sexExpected[heat], `sex/${heat}/dare count`)
  for (const card of [...truths, ...dares]) assertGroundedCard(card)
  if (heat === 'hard') {
    for (const card of dares.filter((item) => item.sexualAction)) {
      assert.ok(Boolean(card.scene?.endCondition), `${card.id}: bounded sexualAction requires scene.endCondition`)
    }
  }
}

console.log('✓ v0.8 content corpus checks passed')
