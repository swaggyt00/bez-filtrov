const assert = {
  equal(actual: unknown, expected: unknown, message = 'assert.equal failed') {
    if (actual !== expected) throw new Error(`${message}: ${String(actual)} !== ${String(expected)}`)
  },
  ok(value: unknown, message = 'assert.ok failed') {
    if (!value) throw new Error(message)
  },
}

import {
  bossIsReady,
  cardIsEligible,
  completeTurn,
  createDirectorState,
  maybeCreateCautionEvent,
  pickDirectorCard,
  preferUnseenDirectorCards,
} from '../src/v09/director'
import type { DirectorCard } from '../src/v09/types'
import type { Player } from '../src/types'

const players: Player[] = [
  { name: 'Максим', gender: 'male', pairingPreference: 'female' },
  { name: 'Рада', gender: 'female', pairingPreference: 'male' },
]

const stage0Risk3: DirectorCard = {
  id: 'stage0-risk3',
  scenario: 'sex',
  type: 'dare',
  text: 'Сильный стартовый челлендж.',
  risk: 3,
  stages: [0],
  chains: ['tease'],
  nextHooks: ['tease'],
}

const stage4Risk3: DirectorCard = {
  id: 'stage4-risk3',
  scenario: 'sex',
  type: 'dare',
  text: 'Финальная карта.',
  risk: 3,
  stages: [4],
  chains: ['sex' as never],
}

let state = createDirectorState('sex', players, 'clothed', ['oral', 'penetration'])
assert.equal(state.sessionStage, 0, 'Sex must start at stage 0 while clothed')
assert.ok(cardIsEligible(stage0Risk3, state, 0, 1, 3), 'risk 3 must work inside current stage')
assert.ok(!cardIsEligible(stage4Risk3, state, 0, 1, 3), 'risk 3 must not jump to stage 4')

const picked = pickDirectorCard([stage4Risk3, stage0Risk3], state, 0, 1, 3, () => 0)
assert.equal(picked?.card.id, 'stage0-risk3', 'Director must select only current-stage cards')

for (let i = 0; i < 3; i += 1) {
  state = completeTurn(state, stage0Risk3, 0, 1, 1, false)
}
assert.equal(state.players[0].cautionPressure, 3, 'three cautious accepted turns should build pressure')
assert.equal(maybeCreateCautionEvent(state, 0)?.id, 'partner-chooses-risk', 'caution pressure should unlock hidden event')

const pressureBeforeSkip = state.players[0].cautionPressure
state = completeTurn(state, stage0Risk3, 0, 1, 1, true)
assert.equal(state.players[0].cautionPressure, pressureBeforeSkip, 'skip must never increase caution pressure')

const continuationA: DirectorCard = {
  id: 'control-a',
  scenario: 'sex',
  type: 'dare',
  text: 'A',
  risk: 2,
  stages: [2],
  chains: ['control'],
  nextHooks: ['control'],
}
const continuationB: DirectorCard = {
  id: 'control-b',
  scenario: 'sex',
  type: 'dare',
  text: 'B',
  risk: 2,
  stages: [2],
  chains: ['control'],
  nextHooks: ['control'],
}
const unrelated: DirectorCard = {
  id: 'unrelated',
  scenario: 'sex',
  type: 'dare',
  text: 'C',
  risk: 2,
  stages: [2],
  chains: ['conversation'],
}
state = { ...state, sessionStage: 2, chainFamily: 'control', chainDepth: 3, tension: 70 }
const logical = pickDirectorCard([unrelated, continuationA, continuationB], state, 0, 1, 2, () => 0)
assert.ok(logical?.card.chains.includes('control'), 'Director should prefer a logical chain continuation')
const actualRecentTurns = Array.from({ length: 4 }, (_, i) => ({
  cardId: 'previous-' + i, type: 'dare' as const, risk: 2 as const,
  playerIndex: i % 2, targetIndex: (i + 1) % 2,
  chains: ['control' as const], skipped: false,
}))
assert.ok(bossIsReady({ ...state, turnsPlayed: 10, lastBossTurn: 0, history: actualRecentTurns }),
  'Boss needs a developed chain and several completed recent turns')


const riskThreePool:DirectorCard[] = Array.from({length:21},(_,i)=>({
  id:'three-fire-'+i,scenario:'party',type:'dare',risk:3 as const,
  stages:[0,1,2,3],chains:['social'],text:'Проверяем настоящий сложный вызов.',
}))
const party= createDirectorState('party', [
  {name:'А',gender:'male',pairingPreference:'any'},
  {name:'Б',gender:'female',pairingPreference:'any'},
  {name:'В',gender:'male',pairingPreference:'any'},
])
const completed=Array.from({length:16},(_,i)=>({
  cardId:'three-fire-'+i,type:'dare' as const,risk:3 as const,
  playerIndex:i%3,targetIndex:null,chains:['social' as const],skipped:false,
}))
const withHistory={...party,history:completed,turnsPlayed:16,sessionStage:3 as const}
const fresh=preferUnseenDirectorCards(riskThreePool,withHistory)
assert.equal(fresh.length,5,'full 16-card memory excludes all recently used challenges')
assert.ok(fresh.every(card=>!completed.some(h=>h.cardId===card.id)),
  'selection must not repeat while a fresh card remains')
const notRepeated=pickDirectorCard(riskThreePool,withHistory,0,null,3,()=>0)
assert.ok(notRepeated&&!completed.some(h=>h.cardId===notRepeated.card.id),
  'local Director cannot override the anti-repeat gate with chain scoring')
const smallPool=riskThreePool.slice(0,3)
const exhausted={...withHistory,history:completed.slice(0,3)}
assert.equal(preferUnseenDirectorCards(smallPool,exhausted)[0].id,'three-fire-0',
  'exhausted pool chooses oldest eligible card, not the one from last turn')
assert.equal(pickDirectorCard(smallPool,exhausted,0,null,3,()=>0)?.card.id,'three-fire-0',
  'Director remains playable with no unseen high-risk cards')
assert.equal(pickDirectorCard(smallPool,exhausted,0,null,2),null,
  'never downgrade chosen fire to avoid repeats')

console.log('✓ v0.9 Director foundation tests passed')
