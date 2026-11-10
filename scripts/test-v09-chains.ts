import { createAIDirectorShortlist, requestAIDirectorChoice } from '../src/v09/ai-director'
import {
  abandonUnavailableChain, beginChainSession, chainCaption,
  getActiveChainBeat, preferredChainTarget, validateChainDraft,
} from '../src/v09/chains'
import { completeTurn, createDirectorState, pickDirectorTarget } from '../src/v09/director'
import { createDirectorScenePlan } from '../src/v09/story'
import type { ChainDraft, DirectorCard, DirectorState, RiskLevel } from '../src/v09/types'
import type { Player } from '../src/types'

const ok=(v:unknown,m:string)=>{if(!v)throw Error(m)}
const eq=(a:unknown,b:unknown,m:string)=>{if(a!==b)throw Error(m+': '+String(a)+' != '+String(b))}
const people:Player[]=[
  {name:'Участник А',gender:'male',pairingPreference:'any'},
  {name:'Участник Б',gender:'female',pairingPreference:'any'},
  {name:'Участник В',gender:'male',pairingPreference:'any'},
  {name:'Участник Г',gender:'female',pairingPreference:'any'},
]
const card=(id:string,chain:DirectorCard['chains'][number],type:'truth'|'dare'='truth'):DirectorCard=>({
  id,scenario:'party',type,risk:2,stages:[0,1,2,3],
  chains:[chain],nextHooks:[chain],targetRequired:true,
  text:'Эта карточка остаётся только на устройстве.',
})
const opener=card('opener','social')
const contrast=card('contrast','chaos','dare')
const shortlist=[{card:opener,score:20},{card:contrast,score:17}]
const sceneDraft={beats:[
  {phase:'build',chain:'social',preferredType:'truth'},
  {phase:'twist',chain:'chaos',preferredType:'dare'},
  {phase:'payoff',chain:'social',preferredType:'dare'},
]}
const chainDraft:ChainDraft={
  title:'Ночная эстафета',
  beats:[
    {phase:'build',normalTarget:'opener',boldTarget:'first-target',
      line:'История возвращается к тому, кто положил ей начало.'},
    {phase:'twist',normalTarget:'previous-actor',boldTarget:'previous-target',
      line:'В этой партии инициатива неожиданно меняет адрес.'},
    {phase:'payoff',normalTarget:'first-target',boldTarget:'opener',
      line:'Последний поворот возвращает игроков к началу истории.'},
  ],
}
let state=createDirectorState('party',people)
const scene=createDirectorScenePlan(state,opener,shortlist,sceneDraft)
ok(scene,'existing story planner must produce a valid linked source')
const sanitized=validateChainDraft(state,scene,chainDraft)
ok(sanitized,'original AI title and mechanics should be accepted')
const session=beginChainSession(state,opener,0,1,scene,sanitized)
ok(session,'chain opening binds only real actor/target indices')
state={...state,scenePlan:scene,chainSession:session}
eq(chainCaption(state)?.step,1,'opener shows single inline progress tag')
const stored:DirectorState=JSON.parse(JSON.stringify(state))
eq(stored.chainSession?.title,'Ночная эстафета','save/resume preserves approved story')

state=completeTurn(state,opener,0,1,2)
eq(getActiveChainBeat(state)?.phase,'build','completed opener begins a live Chain')
eq(chainCaption(state)?.step,2,'continuation uses 2/4 without extra button')
eq(preferredChainTarget(state,[0,1],1),0,'low-risk branch returns to real opener')
eq(preferredChainTarget(state,[0,1],3),1,'three-fire branch returns to first eligible target')
eq(preferredChainTarget(state,[2,3],3),null,'no target permission is invented')
eq(preferredChainTarget(state,[0,1,2],2),0,'middle risk follows ordinary branch')
const request=await requestAIDirectorChoice(state,2,
  createAIDirectorShortlist([opener,contrast],state,2,2),
  {actorIndex:2,fetcher:(async(_url,init)=>{
    const body=JSON.parse(String(init?.body))
    ok(!JSON.stringify(body).includes('Участник'),'real names must never reach a provider')
    eq(body.activeChain?.openerActorIndex,0,'provider knows only anonymized cast index')
    eq(body.activeChain?.normalTarget,'opener','remote AI sees precise playable callback')
    return Response.json({selectedId:opener.id,intro:'Продолжение.',addCondition:false})
  }) as typeof fetch})
eq(request?.card.id,opener.id,'old Worker response without chain remains valid')

state=completeTurn(state,opener,2,0,1)
eq(getActiveChainBeat(state)?.phase,'twist','second beat is a real separate action')
eq(preferredChainTarget(state,[0,1,2],2),2,'next beat can relay previous performer')
eq(preferredChainTarget(state,[0,1,2],3),0,'bold risk pivots to previous target')
state=completeTurn(state,contrast,3,2,3)
eq(getActiveChainBeat(state)?.phase,'payoff','third beat returns to earlier chain')
state=completeTurn(state,opener,1,0,2)
eq(state.chainSession,null,'chain ends instead of continuing forever')
eq(state.scenePlan,null,'legacy story plan ends alongside Chain')
eq(state.chainHistory?.at(-1)?.result,'finished','consequence recorded in anonymous memory')
eq(state.chainHistory?.at(-1)?.openingChain,'social','future story can learn which family finished')

// A skip cancels the plot, preserves consent and records a neutral outcome.
let skipped:DirectorState={...createDirectorState('party',people),scenePlan:scene,chainSession:session}
skipped=completeTurn(skipped,opener,0,1,2)
const before=skipped.tension
skipped=completeTurn(skipped,contrast,1,0,2,true)
eq(skipped.chainSession,null,'skip cancels a Chain')
eq(skipped.chainHistory?.at(-1)?.result,'skipped','skip outcome is recorded without blame')
eq(skipped.tension,before,'skip never increases tension as punishment')
eq(chainCaption(skipped),null,'no ghost chain after a skip')
const unavailable=abandonUnavailableChain({...createDirectorState('party',people),scenePlan:scene,chainSession:session})
eq(unavailable.chainSession,null,'unplayable branch is abandoned')
eq(unavailable.chainHistory?.at(-1)?.result,'unavailable','unplayable fork is not disguised as completion')
ok(pickDirectorTarget([2,3],unavailable,()=>0)!==null,'normal target fallback still works')

// Reject malicious or nonoriginal content without changing approved cards.
eq(validateChainDraft(state,scene,{...chainDraft,title:'<script>bad</script>'}),null,
  'HTML injection cannot enter local storage')
eq(validateChainDraft(state,scene,{...chainDraft,title:'Сними бельё'}),null,
  'an unsolicited intimate task cannot be injected as a Chain title')
eq(validateChainDraft(state,scene,{...chainDraft,beats:chainDraft.beats.slice(0,2)}),null,
  'partial AI Chains are never persisted')
const noCommand=validateChainDraft(createDirectorState('party',people),scene,{
  ...chainDraft,beats:chainDraft.beats.map((beat,i)=>i===1?
    {...beat,line:'Скажи тайный пароль, иначе будешь наказан.'}:beat),
})
eq(noCommand?.beats[1].line,'','an unsafe generated bridge is silently omitted')

// The same generator cannot add new intimate practices or new target roles.
const sexPeople=people.slice(0,2)
const sexState=createDirectorState('sex',sexPeople,'underwear',[])
const kiss={...opener,id:'kiss',scenario:'sex' as const,chains:['kissing' as const],stages:[2 as const]}
const sexOptions=[{card:kiss,score:20}]
const sexScene=createDirectorScenePlan(sexState,kiss,sexOptions,{beats:[
  {phase:'build',chain:'kissing',preferredType:'either'},
  {phase:'twist',chain:'kissing',preferredType:'either'},
  {phase:'payoff',chain:'kissing',preferredType:'either'},
]})
ok(sexScene,'intimate continuity baseline exists')
const sexDraft=validateChainDraft(sexState,sexScene,chainDraft)
ok(sexDraft,'valid scene structure may have harmless text')
ok(sexDraft?.beats.every(beat=>beat.normalTarget==='fair'&&beat.boldTarget==='fair'),
  'intimate mode ignores role games and never forces a change of partner')
const newSession=beginChainSession(sexState,kiss,0,1,sexScene,sexDraft)
ok(newSession,'a consent-neutral paired story is possible')

const mock=(async(_url:RequestInfo|URL,init?:RequestInit)=>{
  const sent=JSON.parse(String(init?.body))
  eq(sent.risk,2,'risk never comes from the AI Chain')
  return Response.json({
    selectedId:opener.id,intro:'Завязка.',addCondition:false,
    scenePlan:sceneDraft,chainPlan:chainDraft,
  })
}) as typeof fetch
const choice=await requestAIDirectorChoice(createDirectorState('party',people),2,shortlist,
  {fetcher:mock})
eq(choice?.card.id,opener.id,'card ID is still prevalidated')
eq(choice?.chainDraft?.title,'Ночная эстафета','AI can author an original play-ready Chain')
eq(choice?.scenePlan?.beats.length,3,'old Director story stays compatible')
console.log('✓ AI Chains: cast callbacks, risk fork, replay, skip, stored outcomes, privacy and consent')
