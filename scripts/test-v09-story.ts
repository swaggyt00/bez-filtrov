import { buildAIDirectorRequest, requestAIDirectorChoice } from '../src/v09/ai-director'
import { completeTurn, createDirectorState, pickDirectorCard, scoreCard } from '../src/v09/director'
import { createDirectorScenePlan, getActiveStoryBeat } from '../src/v09/story'
import type { DirectorCard, DirectorState } from '../src/v09/types'
import type { Player } from '../src/types'

const assert = {
  equal(a:unknown,b:unknown,msg:string) {
    if(a!==b)throw Error(msg+': '+String(a)+' != '+String(b))
  },
  ok(value:unknown,msg:string) {if(!value)throw Error(msg)},
}
const people:Player[]=[
  {name:'Игрок А',gender:'male',pairingPreference:'any'},
  {name:'Игрок Б',gender:'female',pairingPreference:'any'},
  {name:'Игрок В',gender:'male',pairingPreference:'any'},
]
const card=(id:string,chain:DirectorCard['chains'][number],type:'truth'|'dare'='truth'):DirectorCard=>({
  id,scenario:'party',type,risk:2,stages:[0,1,2,3],chains:[chain],
  text:'Приватная карточка, которую нельзя отправлять на сервер.',
})
const opener=card('opener','social')
const develop=card('develop','social')
const twist=card('twist','chaos','dare')
const payoff=card('payoff','social','dare')
const options=[opener,develop,twist,payoff]
const shortlist=options.map(item=>({card:item,score:20}))
const planDraft={beats:[
  {phase:'build',chain:'social',preferredType:'truth'},
  {phase:'twist',chain:'chaos',preferredType:'dare'},
  {phase:'payoff',chain:'social',preferredType:'dare'},
]}
let state=createDirectorState('party',people)
const generated=createDirectorScenePlan(state,opener,shortlist,planDraft)
assert.ok(generated,'valid arc should pass the local allowlist')
state={...state,scenePlan:generated}
assert.equal(getActiveStoryBeat(state),null,'opener should not count as a future beat')

// The arc is planned up-front, but unfolds according to actual completed turns.
state=completeTurn(state,opener,0,1,2)
assert.equal(getActiveStoryBeat(state)?.phase,'build','first beat starts after opener')
assert.ok(scoreCard(develop,state)>scoreCard(twist,state),
  'planned development must change actual card ranking')
assert.equal(pickDirectorCard([develop,twist],state,1,null,2,()=>0)?.card.id,
  'develop','offline Director follows a multi-turn plan')
const request=buildAIDirectorRequest(state,2,shortlist,false,1)
assert.equal(request.activeScene?.chain,'social','AI gets a validated active beat')
assert.equal(request.activeScene?.beatIndex,0,'AI knows which story phase is current')
assert.ok(!JSON.stringify(request).includes('Игрок А'),'names are never sent to AI')
assert.ok(!JSON.stringify(request).includes('Приватная карточка'),'no challenge text is sent')

state=completeTurn(state,develop,1,2,2)
assert.equal(getActiveStoryBeat(state)?.phase,'twist','second beat introduces a turn')
assert.ok(scoreCard(twist,state)>scoreCard(payoff,state),'twist steers selected type and theme')
state=completeTurn(state,twist,2,0,2)
assert.equal(getActiveStoryBeat(state)?.phase,'payoff','third beat returns to narrative hook')
assert.ok(scoreCard(payoff,state)>scoreCard(twist,state),'payoff is preferred')
state=completeTurn(state,payoff,0,1,2)
assert.equal(state.scenePlan,null,'arc expires after its third future completed turn')
assert.equal(getActiveStoryBeat(state),null,'old goals must never stick forever')

// A skip cancels any future arc immediately without new interaction screens.
let skipped:DirectorState={...createDirectorState('party',people),scenePlan:generated}
skipped=completeTurn(skipped,opener,0,1,2)
skipped=completeTurn(skipped,develop,1,0,2,true)
assert.equal(skipped.scenePlan,null,'skips reset a storyline without punishment')
assert.equal(getActiveStoryBeat(skipped),null,'skip cannot silently enforce a plot')
assert.equal(getActiveStoryBeat(createDirectorState('party',people)),null,'old saves remain compatible')

// Invalid story metadata cannot insert an unseen theme, dangerous new actions,
// unknown steps or pseudo-instructions.
assert.equal(createDirectorScenePlan(createDirectorState('party',people),opener,shortlist,
  {beats:[...planDraft.beats.slice(0,2),{...planDraft.beats[2],chain:'fetish'}]}),
  null,'unlisted theme is rejected')
assert.equal(createDirectorScenePlan(createDirectorState('party',people),opener,shortlist,
  {beats:[{...planDraft.beats[0],phase:'payoff'},...planDraft.beats.slice(1)]}),
  null,'out-of-order phases are rejected')
assert.equal(createDirectorScenePlan(createDirectorState('party',people),opener,shortlist,
  {beats:planDraft.beats.slice(0,2)}),null,'truncated arcs are rejected')

// Sex scenes are kept within the current physical activity family; new
// intimate practices may never be silently introduced by the story planner.
const sexPlayers=people.slice(0,2)
const kiss:DirectorCard={...opener,id:'kiss',scenario:'sex',chains:['kissing'],risk:2,stages:[2]}
const oral:DirectorCard={...kiss,id:'oral',chains:['oral']}
const sexState:DirectorState={...createDirectorState('sex',sexPlayers,'underwear',[]),sessionStage:2}
const sexOptions=[{card:kiss,score:10},{card:oral,score:9}]
const sexBad={beats:[
  {phase:'build',chain:'kissing',preferredType:'either'},
  {phase:'twist',chain:'oral',preferredType:'either'},
  {phase:'payoff',chain:'kissing',preferredType:'either'},
]}
assert.equal(createDirectorScenePlan(sexState,kiss,sexOptions,sexBad),null,
  'AI cannot route a physical sex scene into a new practice')
const sexGood={beats:sexBad.beats.map(beat=>({...beat,chain:'kissing'}))}
assert.ok(createDirectorScenePlan(sexState,kiss,sexOptions,sexGood),
  'allowed current physical family may be developed')

// A malicious/poor AI plan must not invalidate an otherwise eligible card.
const mock=(scenePlan:unknown)=>(async (_url:RequestInfo|URL,init?:RequestInit)=>{
  const sent=JSON.parse(String(init?.body))
  assert.equal(sent.risk,2,'risk belongs to player, not the plan')
  return Response.json({selectedId:opener.id,intro:'Продолжаем историю.',addCondition:false,scenePlan})
}) as typeof fetch
const accepted=await requestAIDirectorChoice(createDirectorState('party',people),2,shortlist,
  {fetcher:mock(planDraft)})
assert.equal(accepted?.card.id,opener.id,'AI selection stays within shortlist')
assert.equal(accepted?.scenePlan?.beats.length,3,'AI plan should survive validation')
const rejected=await requestAIDirectorChoice(createDirectorState('party',people),2,shortlist,
  {fetcher:mock({beats:sexBad.beats.map(beat=>({...beat,chain:'unknown'}))})})
assert.equal(rejected?.card.id,opener.id,'bad plan should not block card selection')
assert.equal(rejected?.scenePlan,null,'bad plan must not reach storage')
const restored:DirectorState=JSON.parse(JSON.stringify({
  ...createDirectorState('party',people),scenePlan:generated,turnsPlayed:1,
}))
assert.equal(getActiveStoryBeat(restored)?.phase,'build','story survives save/resume')

console.log('✓ AI Director story arcs: planning, three-turn replay, skip, privacy, boundaries and fallback')
