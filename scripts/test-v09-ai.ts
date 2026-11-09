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
import { buildAIModifierRequest, modifierAxesForCard, requestAIModifier, validateAICondition } from '../src/v09/ai-modifier'
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


const truthCard: DirectorCard = {
  ...base,type:'truth',text:'Какой момент ты хотел бы изменить и почему?',
}
const truthReq=buildAIModifierRequest(truthCard,afterCondition)
assert.equal(truthReq.version,3)
assert.equal(truthReq.scenario,'sex')
assert.ok(truthReq.allowedAxes.includes('specificity'))
assert.ok(truthReq.allowedAxes.includes('reasoning'))
assert.ok(!JSON.stringify(truthReq).includes('Максим'))
assert.ok(!JSON.stringify(truthReq).includes('Рада'))
assert.ok(truthReq.recentLabels.includes('НЕОЖИДАННАЯ ПАУЗА'))
const truthCondition={
  axis:'reasoning',label:'ДВЕ СТОРОНЫ ВОПРОСА',
  description:'В ответе назови две разные причины своего решения и объясни, почему одна из них была важнее другой.',
}
assert.ok(validateAICondition(truthCard,afterCondition,truthCondition))
const truthMock=(async (_url:RequestInfo | URL,init?:RequestInit)=>{
  const req=JSON.parse(String(init?.body))
  assert.equal(req.version,3)
  assert.ok(!JSON.stringify(req).includes('Рада'))
  return Response.json(truthCondition)
}) as typeof fetch
const dynamicTruth=await requestAIModifier(truthCard,afterCondition,{fetcher:truthMock})
assert.equal(dynamicTruth?.id,'ai-original-reasoning')
assert.equal(dynamicTruth?.description,truthCondition.description)

// AI can WRITE an original condition for the actual card; it must not
// merely return one of ten preset mechanics.
const partyState=createDirectorState('party',players,'clothed',[])
const advert:DirectorCard={...base,scenario:'party',type:'dare',
  chains:['social'],text:'Пятнадцать секунд рекламируй ночной перекус как люксовый продукт, используя голос и мимику.'}
const advertAxes=modifierAxesForCard(advert)
assert.ok(advertAxes.includes('sequence'))
assert.ok(advertAxes.includes('precision'))
const original={
  axis:'sequence',label:'ТРИ НОВЫХ АРГУМЕНТА',
  description:'Во время рекламы каждые пять секунд называй новое преимущество перекуса и ни разу не повторяй прилагательные.',
}
assert.ok(validateAICondition(advert,partyState,original))
const mockOriginal=(async (_url:RequestInfo | URL,init?:RequestInit)=>{
  const req=JSON.parse(String(init?.body))
  assert.equal(req.version,3)
  assert.ok(req.cardText.includes('рекламируй ночной перекус'))
  return Response.json(original)
}) as typeof fetch
const dynamic=await requestAIModifier(advert,partyState,{fetcher:mockOriginal})
assert.equal(dynamic?.id,'ai-original-sequence')
assert.equal(dynamic?.label,original.label)
assert.equal(dynamic?.description,original.description)

const afterOriginal=completeTurn(partyState,advert,0,1,2,false,[original.label])
const nextReq=buildAIModifierRequest(advert,afterOriginal)
assert.ok(nextReq.recentLabels.includes(original.label))
assert.equal(validateAICondition(advert,afterOriginal,original),null,'do not repeat the same AI condition')

// Regressions: decorative additions, recycled titles, forbidden actions,
// and contradictory silence in an ad are rejected.
assert.equal(validateAICondition(advert,partyState,{
  axis:'sequence',label:'ТИХИЙ ВЗДОХ',
  description:'После выполнения слегка приподними брови и шёпотом скажи «Вот так», глядя на друзей.',
}),null)
assert.equal(validateAICondition(advert,partyState,{
  ...original,label:'ТОЛЬКО ОДИН ДУБЛЬ',
}),null)
assert.equal(validateAICondition(advert,partyState,{
  ...original,description:'Во время рекламы поцелуй партнёра и обязательно сними одежду на минуту.',
}),null)
assert.equal(validateAICondition(advert,partyState,{
  ...original,description:'Во время рекламы не говори ни одного слова и только смотри на гостей.',
}),null)

const sexDare:DirectorCard={...base,scenario:'sex',type:'dare',
  text:'Поцелуй партнёра в шею на несколько секунд.'}
assert.equal(modifierAxesForCard(sexDare).length,0,'no generated restrictions on intimate physical contact')
const forbiddenResponse=(async()=>Response.json({axis:'reaction',label:'ТИХИЙ ВЗДОХ',
  description:'После выполнения молча приподними брови и произнеси загадочную фразу.'})) as typeof fetch
assert.equal(await requestAIModifier(advert,partyState,{fetcher:forbiddenResponse}),null)
const offline=(async()=>{throw Error('offline')}) as typeof fetch
assert.equal(await requestAIModifier(advert,partyState,{fetcher:offline}),null)

console.log('✓ AI original difficulty: free text, privacy, creativity, no cringe, compatibility, duplicates and fallback passed')
