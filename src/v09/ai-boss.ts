import type { BossSession, DirectorState } from './types'
import { buildBossSession, bossMechanics, validateBossDraft } from './bosses'

export const AI_BOSS_ENDPOINT = 'https://arcanum-tarot-ai.kunicin27522.workers.dev/game/boss'

/**
 * Only anonymized, previously recorded gameplay is shared. Never forward
 * names, raw Truth/Dare texts, private boundaries or spoken answers.
 */
export function buildAIBossRequest(state:DirectorState) {
  return {
    version:1,
    scenario:state.scenario,
    stage:state.sessionStage,
    tension:Math.min(160,Math.max(0,state.tension)),
    turnsPlayed:state.turnsPlayed,
    chainFamily:state.chainFamily,
    playersCount:state.players.length,
    allowedMechanics:bossMechanics[state.scenario].map(phase=>[...phase]),
    recent:state.history.slice(-8).map(entry=>({
      actorIndex:entry.playerIndex,
      targetIndex:entry.targetIndex,
      type:entry.type,risk:entry.risk,skipped:entry.skipped,
      chains:entry.chains.slice(0,3),
    })),
    chainOutcomes:(state.chainHistory??[]).slice(-4).map(entry=>({
      result:entry.result,
      openingChain:entry.openingChain,
    })),
    bossHistory:(state.bossHistory??[]).slice(-4).map(entry=>({
      mechanics:entry.mechanics.slice(0,3),
      outcome:entry.outcome,
    })),
  }
}

export async function requestAIBoss(
  state:DirectorState,
  options:{fetcher?:typeof fetch;endpoint?:string;timeoutMs?:number}={},
):Promise<BossSession|null> {
  const controller=new AbortController()
  const timer=setTimeout(()=>controller.abort(),options.timeoutMs??9000)
  try {
    const response=await (options.fetcher??fetch)(options.endpoint??AI_BOSS_ENDPOINT,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(buildAIBossRequest(state)),
      signal:controller.signal,
    })
    if(!response.ok)return null
    const data:unknown=await response.json()
    const plan=validateBossDraft(state,data)
    return plan?buildBossSession(state,plan):null
  }catch{
    return null
  }finally{clearTimeout(timer)}
}
