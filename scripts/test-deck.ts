import assert from 'node:assert/strict'
import * as deck from '../src/deck'
import type { GameCard, GameSettings, Player } from '../src/types'

const male: Player = { name: 'Алексей', gender: 'male', pairingPreference: 'female' } as Player
const female: Player = { name: 'Катя', gender: 'female', pairingPreference: 'male' } as Player
const maleFriend: Player = { name: 'Илья', gender: 'male', pairingPreference: 'female' } as Player

const settings: GameSettings = {
  players: [male, female],
  scenario: 'sex',
  heat: 'hard',
} as GameSettings

assert.equal(typeof (deck as Record<string, unknown>).pickCardForTurn, 'function', 'deck must export pickCardForTurn')
assert.equal(typeof (deck as Record<string, unknown>).eligibleTargetIndices, 'function', 'deck must export eligibleTargetIndices')
assert.equal(typeof (deck as Record<string, unknown>).validateScenarioPlayers, 'function', 'deck must export validateScenarioPlayers')

const pickCardForTurn = (deck as any).pickCardForTurn as Function
const eligibleTargetIndices = (deck as any).eligibleTargetIndices as Function
const validateScenarioPlayers = (deck as any).validateScenarioPlayers as Function

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
} as GameCard

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
} as GameCard

const malePick = pickCardForTurn([femaleOnly, maleAlternative], settings, 'truth', [], 0)
assert.equal(malePick.card?.id, 'male-alt', 'male player must not receive female-role card')
assert.equal(malePick.targetIndex, 1, 'male player should target compatible female partner')

const femalePick = pickCardForTurn([femaleOnly, maleAlternative], settings, 'truth', [], 1)
assert.equal(femalePick.card?.id, 'female-only', 'female player should receive female-role card')
assert.equal(femalePick.targetIndex, 0, 'female player should target compatible male partner')

const groupPlayers: Player[] = [
  { name: 'Маша', gender: 'female', pairingPreference: 'male' } as Player,
  { name: 'Илья', gender: 'male', pairingPreference: 'female' } as Player,
  { name: 'Саша', gender: 'male', pairingPreference: 'none' } as Player,
]
const closeCard = {
  ...maleAlternative,
  scenario: 'party',
  heat: 'hot',
  pairing: 'mutual-close',
  actorGenders: ['female'],
  targetGenders: ['male'],
} as GameCard
assert.deepEqual(eligibleTargetIndices(closeCard, groupPlayers, 0), [1], 'mutual-close target must respect both players preferences')

assert.equal(validateScenarioPlayers('sex', [male, female]).ok, true, 'sex supports one male + one female')
assert.equal(validateScenarioPlayers('sex', [male, maleFriend]).ok, false, 'sex rejects same-gender pair in current release')
assert.equal(validateScenarioPlayers('couple', [male, female, maleFriend]).ok, false, 'couple is strictly two players')
assert.equal(validateScenarioPlayers('party', [male, female, maleFriend]).ok, true, 'party supports 3+ players')

const repeated: GameCard = {
  ...maleAlternative,
  id: 'repeat-core',
  coreIdea: 'same-core',
} as GameCard
const freshIdea: GameCard = {
  ...maleAlternative,
  id: 'fresh-core',
  coreIdea: 'fresh-core',
  interaction: 'confession',
} as GameCard
const oldSameCore: GameCard = {
  ...maleAlternative,
  id: 'old-core',
  coreIdea: 'same-core',
} as GameCard
const result = pickCardForTurn([repeated, freshIdea, oldSameCore], settings, 'truth', ['old-core'], 0)
assert.equal(result.card?.id, 'fresh-core', 'recent coreIdea should be avoided when a genuinely different idea is available')

console.log('✓ v0.6 role-aware deck tests passed')
