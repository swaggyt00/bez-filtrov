/**
 * 1,280 deterministic 32-turn games using the REAL Director scoring,
 * stage/consent gates and current full card catalog. No network/provider,
 * no guessed AI output and no user survey. Compare exact repeats against
 * baseline audit; a repeated card is only acceptable when ALL eligible
 * cards for the chosen fire were recently played.
 */
import { cards } from '../src/data/cards'
import { eligibleTargetIndices } from '../src/deck'
import { adaptLegacyDeck } from '../src/v09/legacy-adapter'
import { curatedHighRiskCards } from '../src/v09/curated-risk-three'
import { curatedSexLowRiskCards } from '../src/v09/curated-sex-breathers'
import { socialCallbackCards } from '../src/v09/social-dynamics'
import { sexNativeCards } from '../src/v09/sex-native'
import { cardIsEligible, completeTurn, createDirectorState, pickDirectorCard, tickEffects } from '../src/v09/director'
import type { BoundaryTag, DirectorCard, RiskLevel } from '../src/v09/types'
import type { GameCard, Player, Scenario } from '../src/types'

const fullDeck=[...adaptLegacyDeck(cards),...sexNativeCards,...curatedHighRiskCards,...curatedSexLowRiskCards, ...socialCallbackCards]
const sourceById=new Map(cards.map(card=>[card.id,card]))
const byMode=new Map<Scenario,DirectorCard[]>((
  ['party','afterdark','couple','sex'] as Scenario[]
).map(mode=>[mode,fullDeck.filter(card=>card.scenario===mode)]))
const allBoundaries:BoundaryTag[]=['manual','oral','penetration','spanking','bondage','dom-sub','edging','toys','anal','feet','roleplay']

function random(seed:number){
  let state=seed>>>0
  return ()=>((state=(1664525*state+1013904223)>>>0)/4294967296)
}
function player(index:number,gender:'male'|'female'):Player {
  return {name:'Тестовый игрок '+index,gender,pairingPreference:'any'}
}
function partyProfiles(mode:Scenario,run:number):Player[]{
  const variants= mode==='party'
    ? [['male','female','male','female'],['male','male','male'],['female','female','female'],['male','female','male','female','male','female']]
    :mode==='afterdark'
      ? [['male','female'],['male','male'],['female','female'],['male','female','male','female']]
      :[['male','female']]
  return variants[run%variants.length].map((gender,i)=>player(i,gender as 'male'|'female'))
}
function candidates(mode:Scenario,participants:Player[],actorIndex:number) {
  const actor=participants[actorIndex]
  return (byMode.get(mode)??[]).filter(card=>{
    const source:GameCard|undefined=card.sourceCardId?sourceById.get(card.sourceCardId):undefined
    if(card.sourceCardId&&!source)return false
    if(source?.actorGenders?.length&&!source.actorGenders.includes(actor.gender))return false
    if(source?.minPlayers&&source.minPlayers>participants.length)return false
    if(source?.requiresTarget===false||source?.pairing==='none'||(!source&&card.targetRequired===false))return true
    return source?eligibleTargetIndices(source,participants,actorIndex).length>0:participants.length>1
  })
}

const styles=[
  {name:'balanced-no-skip',low:.34,mid:.67,skip:0},
  {name:'balanced-10skip',low:.34,mid:.67,skip:.10},
  {name:'highrisk-10skip',low:.10,mid:.35,skip:.10},
  {name:'lowrisk-25skip',low:.70,mid:.93,skip:.25},
]
const report: Array<{
  scenario:Scenario;style:string;games:number;turns:number;noEligible:number;
  repeats16:number;avoidableRepeats:number;maxStage:number;
}>=[]
for(const mode of ['party','afterdark','couple','sex'] as Scenario[]){
  for(const style of styles){
    const row={scenario:mode,style:style.name,games:80,turns:0,noEligible:0,
      repeats16:0,avoidableRepeats:0,maxStage:0}
    for(let run=0;run<80;run++){
      const people=partyProfiles(mode,run)
      const rng=random(0xC001 + run*7919 + styles.indexOf(style)*11113
        + (['party','afterdark','couple','sex'] as Scenario[]).indexOf(mode)*33313)
      const boundaries=mode==='sex'&&run%3!==0?allBoundaries:[]
      const clothing=mode==='sex'&&run%4===0?'underwear':'clothed'
      let state=createDirectorState(mode,people,clothing,boundaries)
      for(let turn=0;turn<32;turn++){
        const actor=turn%people.length
        const roll=rng()
        const risk:RiskLevel=roll<style.low?1:roll<style.mid?2:3
        const pool=candidates(mode,people,actor).filter(card=>
          cardIsEligible(card,state,actor,null,risk))
        if(!pool.length){row.noEligible++;break}
        const recent=new Set(state.history.slice(-16).map(entry=>entry.cardId))
        const unused=pool.filter(card=>!recent.has(card.id))
        const choice=pickDirectorCard(pool,state,actor,null,risk,rng)
        if(!choice)throw Error('Unexpected empty Director pick for '+mode+' risk '+risk)
        if(choice.card.risk!==risk)throw Error('Director silently changed fire level')
        if(recent.has(choice.card.id)){
          row.repeats16++
          if(unused.length)row.avoidableRepeats++
        }
        const source=choice.card.sourceCardId?sourceById.get(choice.card.sourceCardId):null
        const targets=source?eligibleTargetIndices(source,people,actor):
          people.map((_,i)=>i).filter(i=>i!==actor)
        const targetIndex=choice.card.targetRequired===false?null:targets[0]??null
        const skipped=rng()<style.skip
        state=completeTurn(tickEffects(state),choice.card,actor,targetIndex,risk,skipped)
        row.maxStage=Math.max(row.maxStage,state.sessionStage)
        row.turns++
      }
    }
    if(row.noEligible)throw Error(JSON.stringify(row)+' — chosen fire had no eligible card')
    if(row.avoidableRepeats)throw Error(JSON.stringify(row)+' — Director repeated despite an alternative')
    report.push(row)
    console.log(JSON.stringify(row))
  }
}
const find=(mode:Scenario,style:string)=>report.find(row=>row.scenario===mode&&row.style===style)!
if(find('party','highrisk-10skip').repeats16>=876)throw Error('Party high-risk repeats failed to improve')
if(find('afterdark','highrisk-10skip').repeats16>=610)throw Error('Afterdark high-risk repeats failed to improve')
if(find('couple','highrisk-10skip').repeats16>=163)throw Error('Couple high-risk repeats failed to improve')
if(find('sex','lowrisk-25skip').repeats16>=430)throw Error('Sex low-risk repeats failed to improve')
console.log('✓ 1,280 authentic local Director games: all chosen risks playable, no avoidable recent repeats')
