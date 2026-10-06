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

for (const heat of ['light', 'hot', 'hard'] as const) {
  const truths = bucket('party', heat, 'truth')
  const dares = bucket('party', heat, 'dare')
  assert.equal(truths.length, 50, `party/${heat}/truth count`)
  assert.equal(dares.length, 50, `party/${heat}/dare count`)
  for (const card of [...truths, ...dares]) assertGroundedCard(card)
}

for (const heat of ['light', 'hot', 'hard'] as const) {
  const truths = bucket('afterdark', heat, 'truth')
  const dares = bucket('afterdark', heat, 'dare')
  assert.equal(truths.length, 60, `afterdark/${heat}/truth count`)
  assert.equal(dares.length, 60, `afterdark/${heat}/dare count`)
  for (const card of [...truths, ...dares]) assertGroundedCard(card)
  assert.ok(truths.filter((card) => !card.minPlayers || card.minPlayers <= 2).length >= 42, `afterdark/${heat}/truth two-player coverage`)
  assert.ok(dares.filter((card) => !card.minPlayers || card.minPlayers <= 2).length >= 42, `afterdark/${heat}/dare two-player coverage`)
}

const firstImpression = cards.filter((card) => card.scenario === 'couple' && card.heat === 'light' && card.theme === 'first-impression')
assert.ok(firstImpression.length >= 6, 'first-impression family should include both Truth and Dare variants')
assert.equal(new Set(firstImpression.map((card) => card.coreIdea)).size, 1, 'cards from one semantic family must share coreIdea so runtime anti-repeat can suppress near-repeats')

// Truth and Dare are dealt independently; a dare cannot depend on its paired question.
const danglingReference = /^(?:покажи|изобрази|сыграй|произнеси|напо[йи])\s+(?:этот|эту|это|этой|такой|такую)\s/i
const spokenAnswer = /^(?:скажи|расскажи|объясни|назови|опиши|произнеси|сочини|придумай одну фразу|дай .*комплимент|сделай .*речь)\s/i
const numericalRating = /(?:по шкале|из десяти|от одного до десяти|от 1 до 10)/i
assert.ok(danglingReference.test('Изобрази этот страх как трейлер.'), 'must catch a reference to an unseen Truth')
assert.ok(!danglingReference.test('Изобрази работающий бытовой прибор.'), 'standalone mime must remain allowed')
assert.ok(spokenAnswer.test('Скажи группе один пример такого сообщения своими словами.'), 'must catch the reported speech-only Dare')
for (const card of bucket('party', 'light', 'dare')) {
  assert.ok(!danglingReference.test(card.text), `${card.id}: depends on an unseen Truth`)
  assert.ok(!spokenAnswer.test(card.text), `${card.id}: spoken answer instead of an action`)
}
for (const card of [...bucket('party', 'light', 'truth'), ...bucket('party', 'light', 'dare')]) {
  assert.ok(!numericalRating.test(card.text), `${card.id}: ratings are not a game mechanic`)
}

console.log('✓ v0.8 content corpus checks passed')
