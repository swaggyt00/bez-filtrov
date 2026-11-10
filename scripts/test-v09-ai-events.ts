import { cardIsEligible, createDirectorState } from '../src/v09/director'
import {
  allowedAIEventMechanics,
  buildAIEventRequest,
  eventMechanicsCompatible,
  eventMechanicsFeasible,
  eventRollIsDue,
  filteredEventCards,
  recordEventDecision,
  requestAIEvent,
  validateAIEvent,
} from '../src/v09/ai-events'
import type { DirectorCard, DirectorState, RiskLevel } from '../src/v09/types'
import type { Player } from '../src/types'

function assert(ok:unknown,message:string):asserts ok {if(!ok)throw Error(message)}
function eq(actual:unknown,expected:unknown,message:string) {
  if(actual!==expected)throw Error(message+' got '+String(actual)+' expected '+String(expected))
}
const players:Player[]=[
  {name:'Максим',gender:'male',pairingPreference:'female'},
  {name:'Вика',gender:'female',pairingPreference:'male'},
]
const base=createDirectorState('afterdark',players)
const state:DirectorState={
  ...base,turnsPlayed:7,tension:39,lastEventTurn:0,
  chainFamily:'social',chainDepth:2,
  players:base.players.map((player,index)=>({...player,riskHistory:index===0?[1,2,1]:[3,2]})),
  history:[
    {cardId:'old-1',type:'truth',risk:1,playerIndex:0,targetIndex:1,chains:['confession'],skipped:false},
    {cardId:'old-2',type:'dare',risk:2,playerIndex:1,targetIndex:0,chains:['social'],skipped:false,modifierCount:1},
    {cardId:'old-3',type:'dare',risk:3,playerIndex:0,targetIndex:1,chains:['social'],skipped:true},
  ],
}
const cards:DirectorCard[]=[]
for (const risk of [1,2,3] as RiskLevel[]) {
  for(const type of ['truth','dare'] as const){
    for(const chain of ['social','connection'] as const){
      cards.push({
        id:'test-'+risk+'-'+type+'-'+chain,
        scenario:'afterdark',type,risk,stages:[0],
        chains:[chain],text:'Пройдите безопасное игровое испытание, сохраняя собственные границы.',
      })
    }
  }
}
const stageZero={...state,sessionStage:0 as const}
assert(eventRollIsDue(stageZero,()=>0),'event probability should trigger after four turns')
assert(!eventRollIsDue({...stageZero,turnsPlayed:3},()=>0),'no events early')
assert(!eventRollIsDue({...stageZero,lastEventTurn:6},()=>0),'event cooldown blocks repeat')
assert(!eventRollIsDue(stageZero,()=>0.99),'a high random value means no event')

const allowed=allowedAIEventMechanics(stageZero,1,cards)
assert(allowed.includes('risk-handoff'),'handoff should be possible for 2 players')
assert(allowed.includes('truth-only'),'Truth available for each risk')
assert(allowed.includes('dare-only'),'Dare available for each risk')
assert(allowed.includes('change-theme'),'connection provides alternative theme')
assert(allowed.includes('continue-theme'),'social chain can be continued')
assert(allowed.includes('contrast-type'),'recent Dare can be contrasted')
assert(eventMechanicsCompatible(['risk-handoff','truth-only']),'compatible event')
assert(!eventMechanicsCompatible(['truth-only','dare-only']),'two competing types invalid')
assert(!eventMechanicsCompatible(['continue-theme','change-theme']),'conflicting themes invalid')
assert(!eventMechanicsCompatible(['risk-handoff','risk-handoff']),'duplicate mechanics invalid')
assert(eventMechanicsFeasible(['risk-handoff','truth-only'],stageZero,1,cards),'pair has valid card for each risk')
assert(!eventMechanicsFeasible(['truth-only','dare-only'],stageZero,1,cards),'unplayable combination rejected')
const allRiskCards=filteredEventCards(cards,stageZero,['truth-only','change-theme'])
assert(allRiskCards.length===3,'only unseen-chain Truth cards should remain')
for(const risk of [1,2,3] as RiskLevel[]){
  assert(allRiskCards.some(card=>cardIsEligible(card,stageZero,1,null,risk)),'event cannot hide a selectable fire level')
}

const payload=buildAIEventRequest(stageZero,1,allowed)
eq(payload.version,1,'API version')
eq(payload.playersCount,2,'player count')
eq(payload.actorIndex,1,'actor id')
const json=JSON.stringify(payload)
assert(!json.includes('Максим'),'real names must never reach provider')
assert(!json.includes('Вика'),'real names must never reach provider')
assert(!json.includes('Пройдите безопасное'),'raw card texts must never reach provider')
assert(payload.recent[1].modifierCount===1,'model sees past modifier count')
assert(payload.recent[2].skipped,'model sees skips, not answers')

const candidate={
  title:'Тайная передача штурвала',
  description:'Следующий по кругу игрок выбирает уровень риска, а карточка обязана быть «Правда», чтобы изменить темп предыдущих испытаний.',
  mechanics:['risk-handoff','truth-only'],
}
const event=validateAIEvent(stageZero,1,cards,allowed,candidate)
assert(event,'valid creative event is accepted')
assert(event.aiGenerated,'AI badge must be preserved')
assert(event.partnerChoosesRisk,'real risk handoff is applied')
eq(event.forcedType,'truth','real Truth-only mechanic')
assert(filteredEventCards(cards,stageZero,event.aiMechanics??[]).every(card=>card.type==='truth'),'card restriction is enforced')

const skippable=validateAIEvent(stageZero,1,cards,allowed,{
  title:'Ночная смена рулевого',
  description:'Следующий по кругу участник получает право выбрать уровень риска для этого хода вместо текущего игрока; отказаться от события можно без последствий.',
  mechanics:['risk-handoff'],
})
assert(skippable,'non-coercive event must be accepted by local validator')

const impossible=validateAIEvent(stageZero,1,cards,allowed,{
  ...candidate,mechanics:['truth-only','dare-only'],
})
eq(impossible,null,'contradictory AI mechanics cannot be applied')
eq(validateAIEvent(stageZero,1,cards,allowed,{
  ...candidate,description:'Всё это весело, но теперь сними одежду и поцелуй соседа.',
}),null,'unsafe sexual action rejected')

const memory=recordEventDecision(stageZero,event,true)
eq(memory.lastEventTurn,stageZero.turnsPlayed,'event cooldown advanced')
eq(memory.eventHistory?.length,1,'memory stored')
eq(memory.eventHistory?.[0]?.title,event.title,'title persisted')
eq(memory.eventHistory?.[0]?.accepted,true,'accept status persisted')
const memoPayload=buildAIEventRequest(memory,1,allowed)
assert(memoPayload.events[0]?.title===event.title,'next event sees recent event history')
eq(recordEventDecision(memory,event,false).eventHistory?.[1]?.accepted,false,'skipped events remembered')
assert(!eventRollIsDue(memory,()=>0),'recent event throttles new events')

const mock=(async (_url:RequestInfo|URL,init?:RequestInit)=>{
  const request=JSON.parse(String(init?.body))
  assert(!JSON.stringify(request).includes('Вика'),'no private names in request')
  assert(request.allowedMechanics.includes('truth-only'),'prevalidated effects only')
  return Response.json(candidate)
}) as typeof fetch
const live=await requestAIEvent(stageZero,1,cards,{fetcher:mock})
eq(live?.title,candidate.title,'client accepts valid model output')
const bad=(async()=>Response.json({...candidate,mechanics:['invent-unknown-rule']})) as typeof fetch
eq(await requestAIEvent(stageZero,1,cards,{fetcher:bad}),null,'hallucinated rule rejected')
const gone=(async()=>new Response('{}',{status:429})) as typeof fetch
eq(await requestAIEvent(stageZero,1,cards,{fetcher:gone}),null,'API 429 silently continues party')
const fail=(async()=>{throw Error('offline')}) as typeof fetch
eq(await requestAIEvent(stageZero,1,cards,{fetcher:fail}),null,'network fallback')
const hang=((_url:RequestInfo|URL,init?:RequestInit)=>new Promise<Response>((_resolve,reject)=>{
  init?.signal?.addEventListener('abort',()=>reject(Error('aborted')),{once:true})
})) as typeof fetch
eq(await requestAIEvent(stageZero,1,cards,{fetcher:hang,timeoutMs:12}),null,'timed-out event does not block party')

console.log('✓ AI events: original mechanics, continuity, consent, 3 risks, memory and offline fallback passed')
