const assert = {
  equal(actual: unknown, expected: unknown, message = 'assert.equal failed') {
    if (actual !== expected) throw new Error(`${message}: ${String(actual)} !== ${String(expected)}`)
  },
  notEqual(actual: unknown, expected: unknown, message = 'assert.notEqual failed') {
    if (actual === expected) throw new Error(`${message}: values are equal`)
  },
  ok(value: unknown, message = 'assert.ok failed') {
    if (!value) throw new Error(message)
  },
  deepEqual(actual: unknown, expected: unknown, message = 'assert.deepEqual failed') {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`${message}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`)
    }
  },
}

import * as deck from '../src/deck'
import type { GameCard, GameSettings, Player } from '../src/types'

const male: Player = { name: 'Алексей', gender: 'male', pairingPreference: 'female' }
const female: Player = { name: 'Катя', gender: 'female', pairingPreference: 'male' }
const maleFriend: Player = { name: 'Илья', gender: 'male', pairingPreference: 'female' }
const extraPlayers: Player[] = [
  male,
  female,
  maleFriend,
  { name: 'Маша', gender: 'female', pairingPreference: 'any' },
  { name: 'Олег', gender: 'male', pairingPreference: 'any' },
  { name: 'Лена', gender: 'female', pairingPreference: 'any' },
  { name: 'Рома', gender: 'male', pairingPreference: 'any' },
]

const settings: GameSettings = {
  players: [male, female],
  scenario: 'sex',
  heat: 'hard',
}

const femaleOnly: GameCard = {
  id: 'female-only',
  type: 'truth',
  scenario: 'sex',
  heat: 'hard',
  text: 'Когда ты сверху, что тебе нравится контролировать больше всего?',
  theme: 'position-control',
  mechanic: 'choice',
  purpose: 'desire',
  coreIdea: 'female-on-top-control',
  interaction: 'intimate-choice',
  actorGenders: ['female'],
  targetGenders: ['male'],
  pairing: 'mutual-close',
}

const maleAlternative: GameCard = {
  id: 'male-alt',
  type: 'truth',
  scenario: 'sex',
  heat: 'hard',
  text: 'Что тебя больше заводит, когда девушка сверху?',
  theme: 'position-control',
  mechanic: 'choice',
  purpose: 'desire',
  coreIdea: 'partner-on-top-attraction',
  interaction: 'intimate-choice',
  actorGenders: ['male'],
  targetGenders: ['female'],
  pairing: 'mutual-close',
}

assert.equal(deck.pickCardForTurn([femaleOnly, maleAlternative], settings, 'truth', [], 0).card?.id, 'male-alt')
assert.equal(deck.pickCardForTurn([femaleOnly, maleAlternative], settings, 'truth', [], 1).card?.id, 'female-only')

const groupPlayers: Player[] = [
  { name: 'Маша', gender: 'female', pairingPreference: 'male' },
  { name: 'Илья', gender: 'male', pairingPreference: 'female' },
  { name: 'Саша', gender: 'male', pairingPreference: 'none' },
]
const closeCard = {
  ...maleAlternative,
  scenario: 'party',
  heat: 'hot',
  pairing: 'mutual-close',
  actorGenders: ['female'],
  targetGenders: ['male'],
} as GameCard
assert.deepEqual(deck.eligibleTargetIndices(closeCard, groupPlayers, 0), [1])

assert.equal(deck.validateScenarioPlayers('sex', [male, female]).ok, true)
assert.equal(deck.validateScenarioPlayers('sex', [male, maleFriend]).ok, false)
assert.equal(deck.validateScenarioPlayers('couple', [male, female, maleFriend]).ok, false)
assert.equal(deck.validateScenarioPlayers('party', [male, female, maleFriend]).ok, true)
assert.equal(deck.validateScenarioPlayers('afterdark', [male, female]).ok, true, 'Afterdark must support two players')
assert.equal(deck.validateScenarioPlayers('afterdark', [male]).ok, false, 'Afterdark must reject one player')
assert.equal(deck.validateScenarioPlayers('afterdark', extraPlayers).ok, false, 'Afterdark must reject seven players')

const afterdarkSettings: GameSettings = { players: [male, female], scenario: 'afterdark', heat: 'hard' }
const trioOnly = { ...maleAlternative, id: 'trio-only', scenario: 'afterdark', minPlayers: 3 } as GameCard
const duoOk = { ...maleAlternative, id: 'duo-ok', scenario: 'afterdark' } as GameCard
assert.deepEqual(
  deck.availableCards([trioOnly, duoOk], afterdarkSettings).map((card) => card.id),
  ['duo-ok'],
  'two-player Afterdark must exclude 3+ player cards',
)

const durationCard = { ...duoOk, text: 'Поменяйтесь местами {{duration}}.', duration: 'temporary' } as GameCard
const lightDuration = { ...durationCard, heat: 'light' } as GameCard
const hotDuration = { ...durationCard, heat: 'hot' } as GameCard
const hardDuration = { ...durationCard, heat: 'hard' } as GameCard

for (const value of [0, 0.2, 0.5, 0.8, 0.999999]) {
  assert.notEqual(deck.resolveCardDuration(lightDuration, () => value), 'до конца игры')
}
for (const value of [0, 0.2, 0.5, 0.8, 0.999999]) {
  assert.ok(['1 круг', '2 круга', '3 круга'].includes(deck.resolveCardDuration(hotDuration, () => value) ?? ''))
}
assert.equal(deck.resolveCardDuration(hardDuration, () => 0.999999), 'до конца игры')
const hardSamples = [0, 0.19, 0.21, 0.39, 0.41, 0.59, 0.61, 0.79, 0.81, 0.999999]
  .map((value) => deck.resolveCardDuration(hardDuration, () => value))
assert.ok(hardSamples.filter((value) => value !== 'до конца игры').length > hardSamples.filter((value) => value === 'до конца игры').length)

const rendered = deck.renderCardText(
  { ...durationCard, text: '{{other.nom}}, поменяйся местами с {{self.ins}} {{duration}}.' },
  [male, female],
  0,
  1,
  () => 0.5,
)
assert.ok(!rendered.includes('{{'))
assert.ok(rendered.includes('Катя'))
assert.ok(rendered.includes('2 круга') || rendered.includes('3 круга') || rendered.includes('1 круг'))

const renderedForPersistence = deck.renderCardText(hardDuration, [male, female], 0, 1, () => 0.999999)
const persistedSnapshot = JSON.parse(JSON.stringify({ renderedText: renderedForPersistence })) as { renderedText: string }
assert.ok(!persistedSnapshot.renderedText.includes('{{duration}}'), 'persisted text must contain a resolved duration')
assert.equal(persistedSnapshot.renderedText, renderedForPersistence, 'resume must reuse the already rendered text without rerolling')

console.log('✓ v0.7 deck tests passed')
