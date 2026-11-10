import { cardIsEligible } from './director'
import type { AIEventMechanic, ChainFamily, DirectorCard, DirectorEvent, DirectorState, EventMemoryEntry, RiskLevel } from './types'

export const AI_EVENT_ENDPOINT = 'https://arcanum-tarot-ai.kunicin27522.workers.dev/game/event'
const TIMEOUT_MS = 16500
const RISK_LEVELS: RiskLevel[] = [1,2,3]

export const AI_EVENT_MECHANICS: AIEventMechanic[] = [
  'risk-handoff','truth-only','dare-only','mirror-type','contrast-type','change-theme','continue-theme',
]

export interface AIEventRequest {
  version: 1
  scenario: DirectorState['scenario']
  stage: DirectorState['sessionStage']
  tension: number
  turnsPlayed: number
  playersCount: number
  actorIndex: number
  chainFamily: ChainFamily | null
  chainDepth: number
  allowedMechanics: AIEventMechanic[]
  players: Array<{index:number; recentRisks:RiskLevel[]; skippedRecent:number}>
  recent: Array<{
    actorIndex:number
    type: DirectorCard['type']
    risk:RiskLevel
    skipped:boolean
    chains:ChainFamily[]
    modifierCount:number
  }>
  events: EventMemoryEntry[]
}

const forbiddenEventCopy=/(раздев|сними\s+(?:одежд|бель)|поцел|целуй|генитал|оральн|проникнов|массаж|сексом|пей|алкогол|выпей|штраф|наказан|застав|(?:игрок|участник|ты|вы)\s+обязан|не можешь отказаться|не имеешь права|покажи телефон|отправь|опубликуй|сфотографируй)/i

export function eventRollIsDue(state:DirectorState,random:()=>number=Math.random):boolean {
  if(state.turnsPlayed<4||state.turnsPlayed-state.lastEventTurn<3)return false
  const probability=Math.min(0.36,0.18+state.tension/650)
  return Math.max(0,Math.min(0.999999,random()))<probability
}

export function recentThemeSet(state:DirectorState):Set<ChainFamily> {
  return new Set(state.history.slice(-2).flatMap(entry=>entry.chains.slice(0,1)))
}

export function eventMechanicsCompatible(mechanics:AIEventMechanic[]):boolean {
  if(mechanics.length<1||mechanics.length>2)return false
  if(new Set(mechanics).size!==mechanics.length)return false
  if(mechanics.some(key=>!AI_EVENT_MECHANICS.includes(key)))return false
  const typeMechanics=mechanics.filter(x=>['truth-only','dare-only','mirror-type','contrast-type'].includes(x))
  const themeMechanics=mechanics.filter(x=>x==='change-theme'||x==='continue-theme')
  return typeMechanics.length<=1 && themeMechanics.length<=1
}

export function filteredEventCards(
  cards:DirectorCard[],
  state:DirectorState,
  mechanics:AIEventMechanic[],
):DirectorCard[] {
  const last=state.history.at(-1)
  const recentThemes=recentThemeSet(state)
  return cards.filter(card=>{
    if(mechanics.includes('truth-only')&&card.type!=='truth')return false
    if(mechanics.includes('dare-only')&&card.type!=='dare')return false
    if(mechanics.includes('mirror-type')&&last&&card.type!==last.type)return false
    if(mechanics.includes('contrast-type')&&last&&card.type===last.type)return false
    if(mechanics.includes('change-theme')&&recentThemes.has(card.chains[0]))return false
    if(mechanics.includes('continue-theme')&&state.chainFamily&&!card.chains.includes(state.chainFamily))return false
    return true
  })
}

export function eventMechanicsFeasible(
  mechanics:AIEventMechanic[],
  state:DirectorState,
  actorIndex:number,
  cards:DirectorCard[],
):boolean {
  if(!eventMechanicsCompatible(mechanics))return false
  if(mechanics.includes('risk-handoff')&&state.players.length<2)return false
  if((mechanics.includes('mirror-type')||mechanics.includes('contrast-type'))&&!state.history.length)return false
  if(mechanics.includes('change-theme')&&!state.history.length)return false
  if(mechanics.includes('continue-theme')&&!state.chainFamily)return false
  const filtered=filteredEventCards(cards,state,mechanics)
  return RISK_LEVELS.every(risk=>filtered.some(card=>cardIsEligible(card,state,actorIndex,null,risk)))
}

export function allowedAIEventMechanics(state:DirectorState,actorIndex:number,cards:DirectorCard[]):AIEventMechanic[] {
  return AI_EVENT_MECHANICS.filter(key=>eventMechanicsFeasible([key],state,actorIndex,cards))
}

export function buildAIEventRequest(
  state:DirectorState,actorIndex:number,allowedMechanics:AIEventMechanic[],
):AIEventRequest {
  return {
    version:1,
    scenario:state.scenario,
    stage:state.sessionStage,
    tension:Math.max(0,Math.min(180,state.tension)),
    turnsPlayed:Math.max(0,Math.min(1000,state.turnsPlayed)),
    playersCount:state.players.length,
    actorIndex,
    chainFamily:state.chainFamily,
    chainDepth:Math.max(0,Math.min(40,state.chainDepth)),
    allowedMechanics,
    // Only numeric turn history. No spoken answers, names or card text leave the device.
    players:state.players.map((player,index)=>({
      index,recentRisks:player.riskHistory.slice(-5),
      skippedRecent:state.history.slice(-12).filter(x=>x.playerIndex===index&&x.skipped).length,
    })),
    recent:state.history.slice(-12).map(entry=>({
      actorIndex:entry.playerIndex,
      type:entry.type,risk:entry.risk,skipped:entry.skipped,
      chains:entry.chains.slice(0,2),modifierCount:Math.max(0,Math.min(2,entry.modifierCount??0)),
    })),
    events:(state.eventHistory??[]).slice(-8).map(entry=>({
      turn:entry.turn,title:entry.title.slice(0,60),
      mechanics:entry.mechanics.slice(0,2),accepted:entry.accepted,
    })),
  }
}

export function validateAIEvent(
  state:DirectorState,
  actorIndex:number,
  cards:DirectorCard[],
  allowedMechanics:AIEventMechanic[],
  value:unknown,
):DirectorEvent|null {
  if(!value||typeof value!=='object')return null
  const item=value as Record<string,unknown>
  if(!Array.isArray(item.mechanics)||item.mechanics.some(x=>typeof x!=='string'))return null
  const mechanics=item.mechanics as AIEventMechanic[]
  if(!mechanics.every(x=>allowedMechanics.includes(x))||!eventMechanicsFeasible(mechanics,state,actorIndex,cards))return null
  if(typeof item.title!=='string'||typeof item.description!=='string')return null
  const title=item.title.replace(/\s+/g,' ').trim()
  const description=item.description.replace(/\s+/g,' ').trim()
  if(title.length<7||title.length>55||description.length<55||description.length>230)return null
  if(/[<>\r\n\u0000-\u001f{}]/.test(item.title+item.description))return null
  if(/https?:|www\.|@|#/.test(title+description))return null
  if(forbiddenEventCopy.test(title+description))return null
  if((state.eventHistory??[]).slice(-3).some(x=>x.title.toLocaleLowerCase('ru')===title.toLocaleLowerCase('ru')))return null
  if((state.eventHistory??[]).slice(-2).some(x=>
    x.mechanics.length===mechanics.length
    && x.mechanics.every(key=>mechanics.includes(key))
  ))return null

  const last=state.history.at(-1)
  let forcedType:DirectorEvent['forcedType']
  if(mechanics.includes('truth-only'))forcedType='truth'
  if(mechanics.includes('dare-only'))forcedType='dare'
  if(mechanics.includes('mirror-type'))forcedType=last?.type
  if(mechanics.includes('contrast-type'))forcedType=last?.type==='truth'?'dare':'truth'
  return {
    id:'ai-event-'+state.turnsPlayed+'-'+mechanics.join('-'),
    family:mechanics.includes('risk-handoff')?'control'
      :mechanics.some(x=>x.endsWith('theme'))?'continuation':'wildcard',
    title,description,
    targetPlayerIndex:actorIndex,
    partnerChoosesRisk:mechanics.includes('risk-handoff')||undefined,
    forcedType,
    forcedChain:mechanics.includes('continue-theme')?state.chainFamily??undefined:undefined,
    avoidRecentChains:mechanics.includes('change-theme')||undefined,
    aiGenerated:true,
    aiMechanics:mechanics,
    remainingTurns:1,
  }
}

export async function requestAIEvent(
  state:DirectorState,
  actorIndex:number,
  cards:DirectorCard[],
  options:{fetcher?:typeof fetch; endpoint?:string; timeoutMs?:number}={},
):Promise<DirectorEvent|null> {
  const allowed=allowedAIEventMechanics(state,actorIndex,cards)
  if(!allowed.length)return null
  const controller=new AbortController()
  const timeout=setTimeout(()=>controller.abort(),options.timeoutMs??TIMEOUT_MS)
  try{
    const response=await (options.fetcher??fetch)(options.endpoint??AI_EVENT_ENDPOINT,{
      method:'POST',headers:{'Content-Type':'application/json'},
      signal:controller.signal,
      body:JSON.stringify(buildAIEventRequest(state,actorIndex,allowed)),
    })
    if(!response.ok)return null
    return validateAIEvent(state,actorIndex,cards,allowed,await response.json())
  }catch{return null}
  finally{clearTimeout(timeout)}
}

export function recordEventDecision(
  state:DirectorState,event:DirectorEvent,accepted:boolean,
):DirectorState {
  const memory:EventMemoryEntry={
    turn:state.turnsPlayed,title:event.title.slice(0,55),
    mechanics:event.aiMechanics??[],accepted,
  }
  return {
    ...state,
    lastEventTurn:state.turnsPlayed,
    eventHistory:[...(state.eventHistory??[]),memory].slice(-16),
  }
}
