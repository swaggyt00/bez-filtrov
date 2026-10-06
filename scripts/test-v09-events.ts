const assert = {
  equal(actual: unknown, expected: unknown, message = 'assert.equal failed') {
    if (actual !== expected) throw new Error(`${message}: ${String(actual)} !== ${String(expected)}`)
  },
  ok(value: unknown, message = 'assert.ok failed') {
    if (!value) throw new Error(message)
  },
}

import { buildBossSession } from '../src/v09/bosses'
import { completeTurn, createDirectorState, maybeAdvanceStage, maybeCreateCautionEvent } from '../src/v09/director'
import { pickTurnModifiers } from '../src/v09/modifiers'
import type { DirectorCard, DirectorState } from '../src/v09/types'
import type { Player } from '../src/types'

const players: Player[] = [
  { name: 'Максим', gender: 'male', pairingPreference: 'female' },
  { name: 'Рада', gender: 'female', pairingPreference: 'male' },
]

const safeCard: DirectorCard = {
  id: 'safe',
  scenario: 'sex',
  type: 'dare',
  text: 'Поцелуй партнёра.',
  risk: 1,
  stages: [0, 1, 2],
  chains: ['kissing'],
  nextHooks: ['kissing'],
}

let state = createDirectorState('sex', players, 'clothed', [])
state = { ...state, sessionStage: 2, tension: 100, turnsPlayed: 20 }
assert.equal(maybeAdvanceStage(state).sessionStage, 2, 'Sex must not enter direct-contact stages without an allowed sexual boundary')

state = createDirectorState('sex', players, 'underwear', ['manual'])
state = { ...state, sessionStage: 2, tension: 100, turnsPlayed: 20 }
assert.equal(maybeAdvanceStage(state).sessionStage, 3, 'allowed direct sexual boundary should unlock stage 3')

let cautious = createDirectorState('sex', players, 'clothed', [])
for (let i = 0; i < 3; i += 1) cautious = completeTurn(cautious, safeCard, 0, 1, 1, false)
assert.equal(maybeCreateCautionEvent(cautious, 0)?.id, 'partner-chooses-risk')

const physicalCard: DirectorCard = {
  id: 'physical',
  scenario: 'sex',
  type: 'dare',
  text: 'Двигайся ближе к партнёру и не меняй темп.',
  risk: 3,
  stages: [1],
  chains: ['physical'],
}
const modState = { ...createDirectorState('sex', players), sessionStage: 1 as const }
const mods = pickTurnModifiers(physicalCard, modState, 3, 1, () => 0)
assert.equal(mods.length, 1, 'forced modifier must be applied')
assert.ok(Boolean(mods[0]?.label), 'modifier must have a visible label')

const bossState: DirectorState = {
  ...createDirectorState('sex', players, 'underwear', ['oral']),
  sessionStage: 3,
  chainFamily: 'oral',
  chainDepth: 4,
  tension: 80,
  turnsPlayed: 12,
}
const boss = buildBossSession(bossState)
assert.equal(boss.family, 'oral')
assert.equal(boss.phases.length, 3)
assert.ok(boss.phases.every((phase) => phase.length > 20), 'boss phases must be real steps, not labels')

console.log('✓ v0.9 events/modifiers/boss tests passed')
