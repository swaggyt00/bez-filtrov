import { buildAIDirectorRequest } from '../src/v09/ai-director'
import {
  bossIsReady, cardIsEligible, completeTurn, createDirectorState, pickDirectorCard,
  pickDirectorTarget, scoreCard,
} from '../src/v09/director'
import { eventRollIsDue } from '../src/v09/ai-events'
import { curatedSexLowRiskCards } from '../src/v09/curated-sex-breathers'
import { socialCallbackCards } from '../src/v09/social-dynamics'
import { planDirectorPacing } from '../src/v09/pacing'
import type { DirectorCard, DirectorState } from '../src/v09/types'
import type { Player } from '../src/types'

const assert = {
  ok(value: unknown, message: string) { if (!value) throw new Error(message) },
  equal(actual: unknown, expected: unknown, message: string) {
    if (actual !== expected) throw new Error(`${message}: ${String(actual)} !== ${String(expected)}`)
  },
}
const players: Player[] = [
  {name:'Игрок А',gender:'male',pairingPreference:'any'},
  {name:'Игрок Б',gender:'female',pairingPreference:'any'},
  {name:'Игрок В',gender:'male',pairingPreference:'any'},
  {name:'Игрок Г',gender:'female',pairingPreference:'any'},
]
const card = (id: string, overrides: Partial<DirectorCard> = {}): DirectorCard => ({
  id,scenario:'party',type:'truth',risk:2,stages:[0,1,2,3],
  text:'Условие без персональных данных.',chains:['social'],nextHooks:['social'],
  ...overrides,
})

// Group mode: three similar rounds should cause an actual thematic/type pivot.
let party = createDirectorState('party',players)
for (let i=0;i<3;i++) party=completeTurn(party,card('old-'+i),i, i===0?1:2,2)
const pivot=planDirectorPacing(party)
assert.equal(pivot.intent,'pivot','repetitive group turns should pivot')
assert.equal(pivot.preferType,'dare','three Truths should prefer Dare')
assert.equal(pivot.avoidChain,'social','repeated social chain should be deprioritized')
const contrast=card('fresh-contrast',{type:'dare',chains:['chaos'],nextHooks:['chaos']})
const repeated=card('fresh-repeat')
assert.ok(scoreCard(contrast,party)>scoreCard(repeated,party),'pivot must affect real card selection')
assert.equal(pickDirectorCard([repeated,contrast],party,3,null,2,()=>0)?.card.id,
  'fresh-contrast','local Director must honor the plan offline')

// Skips are neutral: no tension increase, no forced repeated thread or pop-up.
const beforeSkip=party.tension
party=completeTurn(party,card('skipped'),3,1,2,true)
assert.equal(party.tension,beforeSkip,'skip must not advance numeric pressure')
assert.equal(party.chainFamily,null,'skip must not force another turn in the same chain')
const recovering=planDirectorPacing(party)
assert.equal(recovering.intent,'recover','skip should prompt a different topic')
assert.equal(recovering.suppressOptionalModifier,true,'skip should not yield another extra condition')
assert.equal(eventRollIsDue(party,()=>0),false,'skip must not be followed by a surprise AI event')
const shortList=[{card:contrast,score:100},{card:repeated,score:20}]
const request=buildAIDirectorRequest(party,2,shortList,false,0)
assert.equal(request.allowCondition,false,'recovery should not add an optional AI condition')
assert.equal(request.pacing.intent,'recover','AI receives exact local direction')
assert.equal(request.players[2].targetedRecent,2,'target history should be anonymous numeric metadata')
assert.ok(!JSON.stringify(request).includes('Игрок А'),'no names are sent')
assert.ok(!JSON.stringify(request).includes('Условие без'),'no card text is sent')
assert.equal(pickDirectorTarget([1,2,3],party,()=>0),3,'choose a not-yet-targeted group member')

// Intimate continuity: a physical scene shouldn't randomly pivot into a Q&A.
const sexPlayers=players.slice(0,2)
const kissing=card('kiss',{scenario:'sex',type:'dare',chains:['kissing'],
  nextHooks:['kissing'],stages:[2,3,4]})
let sex=createDirectorState('sex',sexPlayers,'underwear',['manual'])
sex=completeTurn(sex,kissing,0,1,2)
sex=completeTurn(sex,kissing,1,0,2)
const intimate=planDirectorPacing(sex)
assert.equal(intimate.intent,'develop','physical scene should stay coherent')
assert.equal(intimate.focusChain,'kissing','keep the scene topic')
assert.equal(intimate.suppressOptionalModifier,true,'no distracting optional conditions mid-scene')
const intimacyRequest=buildAIDirectorRequest(sex,2,[
  {card:kissing,score:42},{card:card('question',{scenario:'sex',chains:['confession'],stages:[2]}),score:10},
])
assert.equal(intimacyRequest.allowCondition,false,'optional modifier must be disabled mid-scene')

// A gentle card may interrupt the app but must not abruptly terminate an
// ongoing *consented* intimacy thread or invent new physical progress.
const sceneBridge=curatedSexLowRiskCards.find(x=>x.sceneBridge)
assert.ok(sceneBridge,'at least one low-fire continuation should exist')
const unrelated=card('unrelated-low',{scenario:'sex',risk:1,type:'dare',
  chains:['conversation'],stages:[2,3,4]})
assert.ok(scoreCard(sceneBridge!,sex)>scoreCard(unrelated,sex),
  'in-scene Dare preferred over switching to an interview after physical contact')
const afterBridge=completeTurn(sex,sceneBridge!,0,1,1)
assert.equal(afterBridge.chainFamily,sex.chainFamily,
  'a gentle bridge cannot silently reset an already consensual intimate scene')
assert.equal(afterBridge.chainDepth,sex.chainDepth,
  'gentle bridge is not fake progress through physical intimacy')
assert.equal(afterBridge.currentPosition,sex.currentPosition,
  'soft bridge cannot assume participants changed physical position')
const afterBridgeSkip=completeTurn(sex,sceneBridge!,0,1,1,true)
assert.equal(afterBridgeSkip.chainFamily,null,'skip still immediately cancels thread')
assert.equal(afterBridgeSkip.sessionStage,sex.sessionStage,
  'refusal cannot force stage escalation')

// A social callback must have real completed history, not made-up backstory.
const callback=socialCallbackCards.find(x=>x.scenario==='party')!
const empty=createDirectorState('party',players)
assert.equal(cardIsEligible(callback,empty,0,null,2),false,
  'a previous-round callback is ineligible before anyone has played')
let socialHistory=empty
for(let i=0;i<3;i++)socialHistory=completeTurn(socialHistory,card('played-'+i),i,null,2)
assert.equal(cardIsEligible(callback,socialHistory,0,null,2),true,
  'social comeback becomes eligible only after three actual completed rounds')
assert.equal(cardIsEligible(callback,socialHistory,0,null,1),false,
  'new social card cannot change requested fire intensity')
let allSkipped=empty
for(let i=0;i<4;i++)allSkipped=completeTurn(allSkipped,card('skip-'+i),i%4,null,2,true)
assert.equal(cardIsEligible(callback,allSkipped,0,null,2),false,
  'skipped actions are not invented as completed social stories')

// Low-risk sex must not automatically escalate through hidden stages just
// because many cards were completed; one higher risk is a voluntary choice.
let slow=createDirectorState('sex',sexPlayers,'clothed',['oral'])
const soft=card('soft',{scenario:'sex',risk:1,chains:['tease'],stages:[0,1]})
for(let i=0;i<9;i++)slow=completeTurn(slow,soft,i%2,1-i%2,1)
assert.equal(slow.sessionStage,0,'low-fire completions alone must not escalate the sex stage')
const stronger=card('stronger',{scenario:'sex',risk:2,chains:['tease'],stages:[0,1]})
slow=completeTurn(slow,stronger,0,1,2)
assert.equal(slow.sessionStage,1,'explicit accepted higher-risk turn can unlock next stage')

// A Boss isn't triggered from high tension and counters alone; it needs recent
// completed turns and actual group participation.
let bosses: DirectorState={...createDirectorState('party',players),sessionStage:2,
  tension:80,chainDepth:3,chainFamily:'social' as const,turnsPlayed:9,lastBossTurn:0}
assert.equal(bossIsReady(bosses),false,'raw tension/counters alone must not cause a Boss')
for(let i=0;i<4;i++)bosses=completeTurn(bosses,card('boss-'+i),0,1,2)
assert.equal(bossIsReady(bosses),false,'no group Boss after only one actor played')
bosses=completeTurn(bosses,card('boss-other'),2,1,2)
assert.ok(bossIsReady(bosses),'Boss should unlock after meaningful multi-player participation')

console.log('✓ Director 2.0 pacing, offline selection, fair targets, privacy, no prompts, skip and boss gates')
