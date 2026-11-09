const assert = {
  ok(value: unknown, message = 'assert.ok failed') { if (!value) throw new Error(message) },
  equal(actual: unknown, expected: unknown, message = 'assert.equal failed') {
    if (actual !== expected) throw new Error(`${message}: ${String(actual)} !== ${String(expected)}`)
  },
}

import {
  buildAIDirectorRequest,
  createAIDirectorShortlist,
  requestAIDirectorChoice,
} from '../src/v09/ai-director'
import { createDirectorState, completeTurn } from '../src/v09/director'
import { buildAIModifierRequest, modifierKindsForCard, requestAIModifier, validateAICondition } from '../src/v09/ai-modifier'
import type { DirectorCard } from '../src/v09/types'
import type { Player } from '../src/types'

const players: Player[] = [
  { name:'Максим', gender:'male', pairingPreference:'female' },
  { name:'Рада', gender:'female', pairingPreference:'male' },
]
const state = createDirectorState('sex',players,'clothed',[])
const base: DirectorCard = {
  id:'test-stage0-001',scenario:'sex',type:'dare',risk:3,
  stages:[0],chains:['tease'],text:'Проверьте сцену без показа приватного задания.',
}
const valid: DirectorCard[] = [
  base,
  {...base,id:'test-stage0-002',type:'truth',chains:['confession'],text:'Очень приватный вопрос?'},
  {...base,id:'test-stage0-003',chains:['kissing']},
  {...base,id:'test-stage0-004',chains:['tease']},
]
const invalid: DirectorCard[] = [
  {...base,id:'invalid-stage4',stages:[4]},
  {...base,id:'invalid-risk2',risk:2},
  {...base,id:'invalid-boundary',requires:{boundaries:['oral']}},
  {...base,id:'invalid-othermode',scenario:'party'},
]
const shortlist = createAIDirectorShortlist([...valid,...invalid],state,0,3)
assert.equal(shortlist.length,valid.length,'shortlist should reject all ineligible cards')
assert.ok(shortlist.every(x=>valid.some(y=>y.id===x.card.id)))
assert.ok(shortlist.some(x=>x.card.type==='truth'),'shortlist should include a different card type')

const payload=buildAIDirectorRequest(state,3,shortlist)
const bodyText=JSON.stringify(payload)
assert.ok(!bodyText.includes('Максим'),'no player names may go to the provider')
assert.ok(!bodyText.includes('Рада'),'no player names may go to the provider')
assert.ok(!bodyText.includes('приватн'),'no raw card text may go to the provider')
assert.equal(payload.stage,0)
assert.equal(payload.risk,3)
assert.equal(payload.candidates.length,4)
assert.equal(payload.allowCondition,true)
assert.equal(payload.forceCondition,false)
const afterCondition = completeTurn(state,valid[0],0,1,3,false,['НЕОЖИДАННАЯ ПАУЗА'])
assert.equal(afterCondition.history[0].modifierCount,1)
assert.equal(afterCondition.history[0].modifierLabels?.[0],'НЕОЖИДАННАЯ ПАУЗА')
const cooled = buildAIDirectorRequest(afterCondition,3,shortlist)
assert.equal(cooled.allowCondition,false)
assert.equal(buildAIDirectorRequest(afterCondition,3,shortlist,true).allowCondition,true)

let requests=0
const mockFetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
  requests += 1
  const posted=JSON.parse(String(init?.body))
  assert.equal(posted.risk,3)
  assert.ok(!JSON.stringify(posted).includes('Рада'))
  return new Response(JSON.stringify({
    selectedId:valid[1].id,
    intro:'   Ну что, готовы к новому повороту?   ',
    addCondition:true,
  }),{status:200,headers:{'Content-Type':'application/json'}})
}) as typeof fetch

const selected=await requestAIDirectorChoice(state,3,shortlist,{fetcher:mockFetch})
assert.equal(selected?.card.id,valid[1].id,'AI should choose the requested eligible card')
assert.equal(selected?.intro,'Ну что, готовы к новому повороту?')
assert.equal(selected?.addCondition,true)
assert.equal(requests,1)

const hallucinating = (async () => new Response(JSON.stringify({
  selectedId:'invalid-stage4',intro:'Эта карточка не должна показываться.',
}),{status:200})) as typeof fetch
const unsafe=await requestAIDirectorChoice(state,3,shortlist,{fetcher:hallucinating})
assert.equal(unsafe,null,'AI cannot introduce an unapproved ID')

const unavailable = (async () => new Response('{}',{status:503})) as typeof fetch
assert.equal(await requestAIDirectorChoice(state,3,shortlist,{fetcher:unavailable}),null)

const rejected = (async () => { throw new Error('offline') }) as typeof fetch
assert.equal(await requestAIDirectorChoice(state,3,shortlist,{fetcher:rejected}),null)

const hanging = ((_: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve,reject) => {
  init?.signal?.addEventListener('abort',()=>reject(new Error('aborted')),{once:true})
})) as typeof fetch
const start=Date.now()
assert.equal(await requestAIDirectorChoice(state,3,shortlist,{fetcher:hanging,timeoutMs:10}),null)
assert.ok(Date.now()-start<1500,'timeout must restore local Director quickly')

const single=await requestAIDirectorChoice(state,3,shortlist.slice(0,1),{fetcher:mockFetch})
assert.equal(single,null,'AI request must be omitted when choice is singular')
assert.equal(requests,1)

console.log('✓ AI Director shortlist, ID validation, privacy and offline fallback passed')


const sexCard: DirectorCard = {
  ...base, text:'Смотри на {{other.acc}} пять секунд и затем спокойно остановись.',
}
const request=buildAIModifierRequest(sexCard,afterCondition)
assert.equal(request.scenario,'sex')
assert.equal(request.allowedKinds.join(','),'reaction')
assert.ok(!JSON.stringify(request).includes('Максим'))
assert.ok(!JSON.stringify(request).includes('Рада'))
assert.ok(!JSON.stringify(request).includes('{{'))
assert.ok(request.cardText.includes('[партнёр]'))
assert.ok(request.recentLabels.includes('НЕОЖИДАННАЯ ПАУЗА'))

const aiCondition={
  kind:'reaction',
  label:'НЕОЖИДАННАЯ ПАУЗА',
  description:'После выполнения выдержи пять секунд тишины и покажи мимикой, что в этом ходе было самым неожиданным.',
}
assert.ok(validateAICondition(sexCard,aiCondition))
const validModifierFetch = (async (_url:RequestInfo | URL,init?:RequestInit) => {
  const req = JSON.parse(String(init?.body))
  assert.ok(!JSON.stringify(req).includes('Рада'))
  assert.equal(req.allowedKinds[0],'reaction')
  return Response.json(aiCondition)
}) as typeof fetch
const dynamic=await requestAIModifier(sexCard,afterCondition,{fetcher:validModifierFetch})
assert.equal(dynamic?.id,'ai-reaction')
assert.equal(dynamic?.label,'НЕОЖИДАННАЯ ПАУЗА')
assert.ok(dynamic?.description.startsWith('После выполнения'))

const forbiddenModifier={...aiCondition,description:'После выполнения поцелуй партнёра в губы и сними одежду на одну минуту.'}
assert.equal(validateAICondition(sexCard,forbiddenModifier),null)
assert.equal(validateAICondition(sexCard,{...aiCondition,kind:'performance'}),null)
assert.equal(validateAICondition(sexCard,{...aiCondition,description:'Сделай что-то интересное.'}),null)
const mimeCard:DirectorCard={...base,scenario:'party',type:'dare',
  text:'Молча изобрази смешную сцену в течение пятнадцати секунд.'}
assert.ok(modifierKindsForCard(mimeCard).includes('performance'))
assert.equal(validateAICondition(mimeCard,{
  kind:'performance',label:'РАЗГОВОРЧИВОЕ ШОУ',
  description:'Во время выполнения говори громко и изображай невозмутимого ведущего шоу.',
}),null)
const truthCard:DirectorCard={...base,type:'truth',text:'Какой момент ты скрывал?'}
assert.equal(modifierKindsForCard(truthCard).join(','),'followup')
assert.ok(validateAICondition(truthCard,{
  kind:'followup',label:'ЗАПРЕТНАЯ ДЕТАЛЬ',
  description:'После ответа добавь одну конкретную деталь, которую до сих пор было неловко произносить вслух.',
}))

const badDynamicFetch=(async()=>Response.json(forbiddenModifier)) as typeof fetch
assert.equal(await requestAIModifier(sexCard,state,{fetcher:badDynamicFetch}),null)
const offlineDynamicFetch=(async()=>{throw Error('offline')}) as typeof fetch
assert.equal(await requestAIModifier(sexCard,state,{fetcher:offlineDynamicFetch}),null)

console.log('✓ AI dynamic modifier: authored text, privacy, forbidden actions, cooldown and fallback passed')
