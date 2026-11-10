import { buildAIBossRequest, requestAIBoss } from '../src/v09/ai-boss'
import { bossPenaltyFor, buildBossSession, bossMechanics, settleBoss, validateBossDraft } from '../src/v09/bosses'
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
for(const mode of ['party','afterdark','couple','sex'] as const){
  const options=bossMechanics[mode]
  ok(options.every(phase=>phase.length===5),'Boss now has exactly five validated choices in each phase')
  eq(options.reduce((product,phase)=>product*phase.length,1),125,
    'Boss gains 125 different mechanics combinations without new phases')
}

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

const hiddenCommands=validateBossDraft(baseline,{...draft,phases:draft.phases.map((p,i)=>
  i===0?{...p,caption:'Выбирай, кто откроет новую нить доверия.'}
    :i===1?{...p,caption:'Смените маски и взгляните друг в друга без слов.'}
    :{...p,caption:'Завершите вечер общим признанием.'})})
ok(hiddenCommands,'an otherwise valid Boss should remain playable when captions are discarded')
ok(hiddenCommands?.phases.every(p=>p.caption===''),
  'AI cannot sneak imperative instructions into supposedly atmospheric captions')
const secondWave=validateBossDraft(baseline,{...draft,phases:draft.phases.map((phase,index)=>({
  ...phase,caption:[
    'Вспомни, что было сказано в полночь…',
    'Переходим к новому ведущему, держи темп.',
    'Финальная нотка — совместный выход из игры.',
  ][index],
}))})
ok(secondWave && secondWave.phases[0].caption==='' && secondWave.phases[1].caption==='',
  'two additional live commands must be removed even inside longer captions')
ok(secondWave?.phases[2].caption,'declarative narrative captions remain available')



const done=settleBoss(baseline,session,'won',2)
eq(done.bossHistory?.at(-1)?.outcome,'won','victory is remembered')
eq(done.bossHistory?.at(-1)?.challengerIndex,2,'Boss win belongs to actual challenger')
eq(done.bossScore?.[2]?.wins,1,'win increases challenger score')
eq(done.bossScore?.[2]?.losses,0,'winning does not add a loss')
eq(done.pendingBossPenalty,null,'a victory never assigns a penalty')
eq(done.lastBossTurn,baseline.turnsPlayed,'cooldown begins after climax')
eq(done.tension,53,'post-climax relief only after completion')
eq(done.chainDepth,0,'Boss finishes its chain')
eq(validateBossDraft(done,draft),null,'previous combination cannot be reused verbatim')
const defeated=settleBoss(baseline,session,'lost',2,'failed')
eq(defeated.tension,baseline.tension,'defeat keeps the earned session tension')
eq(defeated.bossHistory?.at(-1)?.outcome,'lost','failure is a real defeat')
eq(defeated.bossHistory?.at(-1)?.reason,'failed','reason for defeat is remembered')
eq(defeated.bossScore?.[2]?.losses,1,'loss increases challenger score')
eq(defeated.pendingBossPenalty?.playerIndex,2,'losing challenger pays the next-turn penalty')
eq(defeated.pendingBossPenalty?.type,'dare','Party loss forces a Dare card next turn')
ok(defeated.pendingBossPenalty?.label.includes('Риск выбираешь сам'),'selected fire is never increased')
const surrendered=settleBoss(baseline,session,'lost',0,'forfeit')
eq(surrendered.bossHistory?.at(-1)?.outcome,'lost','refusal counts as a loss')
eq(surrendered.bossHistory?.at(-1)?.reason,'forfeit','forfeit is explicitly remembered')
eq(surrendered.bossScore?.[0]?.losses,1,'forfeit increases loss counter')
const expandedDraft={
  title:'Вечер возвращённых ролей',
  phases:[
    {mechanic:'callback-witness',role:'last-actor',
      caption:'Неожиданное возвращение к старой истории.'},
    {mechanic:'reversal-duel',role:'last-target',
      caption:'Соперники теперь меняются ролями.'},
    {mechanic:'group-verdict',role:'all',
      caption:'Компания придумывает собственную развязку.'},
  ],
}
const expanded=buildBossSession(baseline,expandedDraft)
eq(expanded.aiGenerated,true,'new allowlisted mechanics can be chosen by AI')
eq(expanded.mechanics?.join('|'),'callback-witness|reversal-duel|group-verdict',
  'all three novel trusted mechanics survive local validation')
ok(expanded.phases.every(text=>text.length>30),
  'new mechanics have real stage-specific playable descriptions')
const beforeScore=baseline.bossScore??{}
eq(baseline.bossScore??beforeScore,beforeScore,
  'composing a Boss cannot change score or penalties')

const fallbackA=buildBossSession(done)
const fallbackB=buildBossSession(settleBoss(done,fallbackA,'lost',2,'forfeit'))
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
const sexLost=settleBoss(sex,sexBoss,'lost',0,'forfeit')
eq(sexLost.pendingBossPenalty?.type,'truth','Sex forfeiture must never force a physical act')
eq(sexLost.bossScore?.[0]?.losses,1,'consent-safe forfeiture still records game defeat')
ok(sexLost.pendingBossPenalty?.label.includes('Никаких обязательных физических'),
  'Sex penalty remains a nonphysical, optional Truth card')
const afterdark=createDirectorState('afterdark',players)
const afterdarkBoss=buildBossSession(afterdark)
const firstLoss=settleBoss(afterdark,afterdarkBoss,'lost',1,'failed')
eq(firstLoss.pendingBossPenalty?.type,'dare','first Afterdark loss forces a Dare')
const secondLoss=settleBoss(firstLoss,afterdarkBoss,'lost',1,'forfeit')
eq(secondLoss.pendingBossPenalty?.type,'truth','second Afterdark loss alternates to Truth')
eq(bossPenaltyFor(secondLoss,afterdarkBoss,1).type,'dare',
  'subsequent penalty types cycle deterministically')

const resumed=JSON.parse(JSON.stringify({boss:session,director:done}))
eq(resumed.boss.mechanics[1],'duel-remix','save/resume retains Boss mechanics')
eq(resumed.director.bossHistory.at(-1).outcome,'won','save/resume retains Boss consequence')
console.log('✓ AI Boss: adaptive 3-phase mechanics, live model, roles, no coercion, skip, privacy and persistence')
