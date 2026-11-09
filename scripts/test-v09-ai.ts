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
import { buildAIModifierRequest, DIFFICULTY_RULES, modifierKindsForCard, requestAIModifier, validateAICondition } from '../src/v09/ai-modifier'
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
  ...base,type:'truth',text:'Что ты предпочёл бы скрыть от окружающих и почему?',
}
const request=buildAIModifierRequest(truthCard,afterCondition)
assert.equal(request.version,2)
assert.equal(request.scenario,'sex')
assert.ok(request.allowedKinds.includes('truth-details'))
assert.ok(request.allowedKinds.includes('truth-fast'))
assert.ok(!request.allowedKinds.includes('truth-reason'))
assert.ok(!JSON.stringify(request).includes('Максим'))
assert.ok(!JSON.stringify(request).includes('Рада'))
assert.ok(request.recentLabels.includes('НЕОЖИДАННАЯ ПАУЗА'))

const truthCondition={kind:'truth-details',...DIFFICULTY_RULES['truth-details']}
assert.ok(validateAICondition(truthCard,afterCondition,truthCondition))
const validModifierFetch = (async (_url:RequestInfo | URL,init?:RequestInit) => {
  const req = JSON.parse(String(init?.body))
  assert.equal(req.version,2)
  assert.ok(!JSON.stringify(req).includes('Рада'))
  assert.ok(req.allowedKinds.includes('truth-details'))
  return Response.json(truthCondition)
}) as typeof fetch
const dynamic=await requestAIModifier(truthCard,afterCondition,{fetcher:validModifierFetch})
assert.equal(dynamic?.id,'ai-truth-details')
assert.equal(dynamic?.label,'ДВЕ КОНКРЕТНЫЕ ДЕТАЛИ')
assert.ok(dynamic?.description.includes('две конкретные детали'))

// The old eyebrow / sigh / whispered line is not a difficulty mechanic.
const cringy={kind:'reaction',label:'ТИХИЙ ВЗДОХ',
  description:'После выполнения приподними брови, вздохни и скажи короткую фразу.'}
assert.equal(validateAICondition(truthCard,afterCondition,cringy),null)
assert.equal(validateAICondition(truthCard,afterCondition,{
  ...truthCondition,description:'После ответа удивлённо подними брови и скажи вот так.',
}),null)

const partyState=createDirectorState('party',players,'clothed',[])
const advert:DirectorCard={...base,scenario:'party',type:'dare',
  chains:['social'],text:'Пятнадцать секунд рекламируй ночной перекус как люксовый продукт, используя голос и мимику.'}
const advertKinds=modifierKindsForCard(advert,partyState)
assert.ok(advertKinds.includes('dare-one-take'))
assert.ok(advertKinds.includes('dare-quick-start'))
assert.ok(advertKinds.includes('dare-no-pause'))
assert.ok(!advertKinds.includes('dare-silence'),'AI cannot require silence when advertising requires speech')
const chosenDifficulty={kind:'dare-one-take',...DIFFICULTY_RULES['dare-one-take']}
assert.ok(validateAICondition(advert,partyState,chosenDifficulty))
assert.equal(validateAICondition(advert,partyState,{
  ...chosenDifficulty,description:'После выполнения слегка подними брови.',
}),null)
assert.equal(validateAICondition(advert,partyState,{
  ...chosenDifficulty,kind:'dare-eyes-closed',
}),null)

const mockDare=(async ()=>Response.json(chosenDifficulty)) as typeof fetch
assert.equal((await requestAIModifier(advert,partyState,{fetcher:mockDare}))?.id,'ai-dare-one-take')
const afterDare=completeTurn(partyState,advert,0,1,2,false,['ТОЛЬКО ОДИН ДУБЛЬ'])
const nextRequest=buildAIModifierRequest(advert,afterDare)
assert.ok(!nextRequest.allowedKinds.includes('dare-one-take'),'do not repeat difficulty from previous turn')
assert.equal(validateAICondition(advert,afterDare,chosenDifficulty),null)

const pausedCard:DirectorCard={...advert,text:'Покажи сцену, затем сделай паузу и подожди реакции остальных.'}
assert.ok(!modifierKindsForCard(pausedCard,partyState).includes('dare-no-pause'))
const silentCard:DirectorCard={...advert,text:'Молча изобрази случайную сцену без слов.'}
assert.ok(modifierKindsForCard(silentCard,partyState).includes('dare-one-take'))
assert.equal(modifierKindsForCard(silentCard,partyState).includes('dare-no-pause'),true)

const sexDare:DirectorCard={...base,scenario:'sex',type:'dare',
  text:'Пять секунд смотри на партнёра, не меняя положения.'}
const sexKinds=modifierKindsForCard(sexDare,state)
assert.ok(!sexKinds.includes('dare-one-take'))
assert.ok(!sexKinds.includes('dare-quick-start'))
assert.ok(!sexKinds.includes('dare-silence'))
assert.ok(!sexKinds.includes('dare-eyes-closed'))

const badDynamicFetch=(async()=>Response.json(cringy)) as typeof fetch
assert.equal(await requestAIModifier(advert,partyState,{fetcher:badDynamicFetch}),null)
const offlineDynamicFetch=(async()=>{throw Error('offline')}) as typeof fetch
assert.equal(await requestAIModifier(advert,partyState,{fetcher:offlineDynamicFetch}),null)

console.log('✓ AI difficulty: strict mechanics, no post-action cringe, privacy, contradictions and cooldown passed')
