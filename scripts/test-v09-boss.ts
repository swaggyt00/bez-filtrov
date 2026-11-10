import { buildAIBossRequest, requestAIBoss } from '../src/v09/ai-boss'
import { buildBossSession, bossMechanics, settleBoss, validateBossDraft } from '../src/v09/bosses'
import { createDirectorState } from '../src/v09/director'
import type { DirectorState } from '../src/v09/types'
import type { Player } from '../src/types'

const eq=(a:unknown,b:unknown,m:string)=>{if(a!==b)throw Error(m+': '+String(a)+' != '+String(b))}
const ok=(v:unknown,m:string)=>{if(!v)throw Error(m)}
const players:Player[]=[
  {name:'Участник А',gender:'male',pairingPreference:'any'},
  {name:'Участник Б',gender:'female',pairingPreference:'any'},
  {name:'Участник В',gender:'male',pairingPreference:'any'},
]
const draft={
  title:'Возвращение ночного ведущего',
  phases:[
    {mechanic:'callback-spotlight',role:'last-actor',
      caption:'Прошлая тема неожиданно возвращается на первый план.'},
    {mechanic:'duel-remix',role:'last-target',
      caption:'Теперь история поворачивает в другую сторону.'},
    {mechanic:'ensemble-remix',role:'all',
      caption:'Финал собирает воедино самые смешные моменты.'},
  ],
}
const history=Array.from({length:4},(_,i)=>({
  cardId:'played-'+i,type:i%2?'truth' as const:'dare' as const,
  risk:2 as const,playerIndex:i%3,targetIndex:(i+1)%3,
  chains:['social' as const],skipped:false,
}))
const baseline:DirectorState={
  ...createDirectorState('party',players),
  sessionStage:2,tension:81,turnsPlayed:13,lastBossTurn:1,chainDepth:4,
  chainFamily:'social',history,chainHistory:[
    {turn:12,title:'Ночная эстафета',result:'finished',openingChain:'social'},
  ],
}
eq(bossMechanics.party[0][0],'callback-spotlight','client mechanic catalog stays stable')
ok(validateBossDraft(baseline,draft),'valid creative Boss should pass three-phase allowlist')
const session=buildBossSession(baseline,draft)
eq(session.title,draft.title,'original title appears in game')
eq(session.aiGenerated,true,'genuine AI Boss marked as such')
eq(session.phases.length,3,'three phases are playable')
ok(session.phases[0].includes('Участник А'),'phase uses real most recent actor')
ok(session.phases[1].includes('Участник Б'),'twist returns to real previous target')
ok(session.phases[2].includes('Все желающие'),'finale engages the group')
ok(!session.phases.join('|').includes('Прошлая тема неожиданно'),'AI caption must never become unvetted challenge text')
eq(session.phaseCaptions?.[1],draft.phases[1].caption,'non-instructional captions retained separately')

eq(validateBossDraft(baseline,{...draft,phases:draft.phases.slice(0,2)}),null,'partial Boss blocked')
eq(validateBossDraft(baseline,{...draft,title:'<script>new instruction</script>'}),null,'injection blocked')
eq(validateBossDraft(baseline,{...draft,phases:draft.phases.map((p,i)=>
  i===2?{...p,mechanic:'invent-new-rule'}:p)}),null,'invented action blocked')
eq(validateBossDraft(baseline,{...draft,phases:draft.phases.map((p,i)=>
  i===1?{...p,role:'both'}:p)}),null,'invalid target role blocked')
eq(validateBossDraft(baseline,{...draft,phases:draft.phases.map((p,i)=>
  i===0?{...p,mechanic:'duel-remix'}:p)}),null,'phase-specific whitelist enforced')
const sanitized=validateBossDraft(baseline,{...draft,phases:draft.phases.map((p,i)=>
  i===1?{...p,caption:'Сними бельё и сделай это немедленно.'}:p)})
eq(sanitized?.phases[1].caption,'','unreviewed AI actions never enter captions')

const done=settleBoss(baseline,session,false)
eq(done.bossHistory?.at(-1)?.outcome,'finished','completion is remembered')
eq(done.lastBossTurn,baseline.turnsPlayed,'cooldown begins after climax')
eq(done.tension,53,'post-climax relief only after completion')
eq(done.chainDepth,0,'Boss finishes its chain')
eq(validateBossDraft(done,draft),null,'previous combination cannot be reused verbatim')
const skipped=settleBoss(baseline,session,true)
eq(skipped.tension,baseline.tension,'skip does not punish or alter game tension')
eq(skipped.bossHistory?.at(-1)?.outcome,'skipped','skip memory is neutral')
const fallbackA=buildBossSession(done)
const fallbackB=buildBossSession(settleBoss(done,fallbackA,true))
ok(fallbackA.phases.every(s=>typeof s==='string'&&s.length>20),'offline finale is fully playable')
ok(fallbackA.mechanics?.join('|')!==fallbackB.mechanics?.join('|'),'fallback avoids repeating same mechanics')
ok(!fallbackA.aiGenerated,'fallback is never falsely attributed to AI')

const payload=buildAIBossRequest(baseline)
ok(!JSON.stringify(payload).includes('Участник А'),'player names never leave device')
ok(!JSON.stringify(payload).includes('Ночная эстафета'),'private chain name never leaves device')
ok(!JSON.stringify(payload).includes('played-0'),'raw card IDs never leave device')
eq(payload.chainOutcomes[0].openingChain,'social','AI sees grounded completed chain family')
eq(payload.allowedMechanics.length,3,'client sends only whitelisted phase catalogs')
const mock=(response:unknown,status=200)=>(async (_url:RequestInfo|URL,options?:RequestInit)=>{
  const req=JSON.parse(String(options?.body))
  eq(req.scenario,'party','no crossover into Tarot')
  eq(req.playersCount,3,'anonymous group count')
  return Response.json(response,{status})
}) as typeof fetch
const generated=await requestAIBoss(baseline,{fetcher:mock(draft)})
eq(generated?.aiGenerated,true,'accepted AI draft becomes a real Boss session')
eq(generated?.title,draft.title,'title passed')
eq(await requestAIBoss(baseline,{fetcher:mock({title:'Bad',phases:[]})}),null,
  'invalid model result uses local fallback')
eq(await requestAIBoss(baseline,{fetcher:mock({error:'Provider cooldown'},503)}),null,
  '503 keeps game playable through fallback')

// A sexual Boss can ONLY vary the currently mutually agreed atmosphere;
// the model may not create a new practice, body target or forced timer.
const sex=createDirectorState('sex',players.slice(0,2),'underwear',['manual'])
const sexDraft={
  title:'Близость без таймера',
  phases:[
    {mechanic:'resume-consented',role:'both',caption:'Остаётесь в комфортной атмосфере.'},
    {mechanic:'trade-initiative',role:'both',caption:'Мягкое изменение инициативы.'},
    {mechanic:'open-ending',role:'both',caption:'Свободное завершение вашего вечера.'},
  ],
}
const sexBoss=buildBossSession(sex,sexDraft)
eq(sexBoss.aiGenerated,true,'stage-independent consent-safe sex Boss')
ok(sexBoss.phases.every(p=>!/(оральн|проникновени|сними бельё|оргазм обязателен|на колени)/i.test(p)),
  'no new intimate act/position can be invented by Boss')
ok(sexBoss.phases.every(p=>!/(одну минуту|две минуты|секунд)/i.test(p)),
  'intimate Boss is never a timer workout')
eq(validateBossDraft(sex,{...sexDraft,phases:sexDraft.phases.map((p,i)=>
  i===1?{...p,role:'last-target'}:p)}),null,'partner must not be changed in Sex')
const resumed=JSON.parse(JSON.stringify({boss:session,director:done}))
eq(resumed.boss.mechanics[1],'duel-remix','save/resume retains Boss mechanics')
eq(resumed.director.bossHistory.at(-1).outcome,'finished','save/resume retains Boss consequence')
console.log('✓ AI Boss: adaptive 3-phase mechanics, live model, roles, no coercion, skip, privacy and persistence')
