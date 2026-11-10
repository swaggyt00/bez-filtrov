import type {
  ChainBeat, ChainDraft, ChainOutcome, ChainTargetRule, DirectorCard,
  DirectorChainSession, DirectorScenePlan, DirectorState, RiskLevel, ScenePhase,
} from './types'
import { getActiveStoryBeat } from './story'

const phases: ScenePhase[] = ['build', 'twist', 'payoff']
const rules: ChainTargetRule[] = [
  'fair', 'opener', 'first-target', 'previous-actor', 'previous-target',
]
const unsafeCopy = /[{}<>\r\n\u0000-\u001f]|https?:|www\.|@|#|(?:обязан|застав|прикаж|накаж|сними\s+бель|занимайся\s+сексом|поцелуй|трах|минет|кунилинг|проникнов|обнажи|согласие\s+не\s+нужно|не\s+сможешь\s+отказ)/i
const actionCommands = /^(?:сделай|назови|скажи|покажи|подойди|потрогай|сними|выбери|ответь|выполни|целуй|попроси|начни|заставь)\b/i

function safeLine(value: unknown, max: number, min: number): string | null {
  if (typeof value !== 'string' || value !== value.trim()) return null
  if (value.length < min || value.length > max || unsafeCopy.test(value) || actionCommands.test(value)) return null
  return value
}

/** A generated chain is a non-instructional layer over already approved cards. */
export function validateChainDraft(
  state: DirectorState,
  scenePlan: DirectorScenePlan | null,
  value: unknown,
): ChainDraft | null {
  if (!scenePlan || !value || typeof value !== 'object') return null
  const item = value as { title?: unknown; beats?: unknown }
  const title = safeLine(item.title, 55, 6)
  if (!title || !Array.isArray(item.beats) || item.beats.length !== 3) return null
  const beats: ChainBeat[] = []
  for (let index = 0; index < phases.length; index++) {
    const raw: unknown = item.beats[index]
    if (!raw || typeof raw !== 'object') return null
    const beat = raw as Record<string, unknown>
    if (beat.phase !== phases[index]
        || !rules.includes(beat.normalTarget as ChainTargetRule)
        || !rules.includes(beat.boldTarget as ChainTargetRule)) return null
    // Non-instructional flavor text is optional: an unsafe line is simply
    // discarded, never added to the live challenge.
    const line = safeLine(beat.line, 125, 12) ?? ''
    beats.push({
      phase: phases[index],
      normalTarget: state.scenario === 'sex' ? 'fair' : beat.normalTarget as ChainTargetRule,
      boldTarget: state.scenario === 'sex' ? 'fair' : beat.boldTarget as ChainTargetRule,
      line,
    })
  }
  return { title, beats }
}

export function beginChainSession(
  state: DirectorState,
  opener: DirectorCard,
  actorIndex: number,
  targetIndex: number | null,
  plan: DirectorScenePlan | null,
  draft: ChainDraft | null,
): DirectorChainSession | null {
  if (!plan || !draft || plan.openerCardId !== opener.id
      || plan.originTurn !== state.turnsPlayed
      || !Number.isInteger(actorIndex) || actorIndex < 0 || actorIndex >= state.players.length
      || (targetIndex !== null && (!Number.isInteger(targetIndex) || targetIndex < 0
        || targetIndex >= state.players.length || targetIndex === actorIndex))) return null
  if (!validateChainDraft(state, plan, draft)) return null
  // Only accept an actual linked storyline, not a prediction about players.
  return {
    originTurn: plan.originTurn,
    openerCardId: opener.id,
    openerActorIndex: actorIndex,
    openerTargetIndex: targetIndex,
    title: draft.title,
    beats: draft.beats.map(beat => ({ ...beat })),
  }
}

export interface ActiveChainBeat extends ChainBeat {
  originTurn: number
  index: number
  title: string
}

/** Validate saved state again so old/malformed local storage cannot inject copy. */
export function getActiveChainBeat(state: DirectorState): ActiveChainBeat | null {
  const session = state.chainSession
  const sceneBeat = getActiveStoryBeat(state)
  if (!session || !sceneBeat || !state.scenePlan
      || session.originTurn !== state.scenePlan.originTurn
      || session.openerCardId !== state.scenePlan.openerCardId
      || session.originTurn < 0 || !Number.isInteger(session.originTurn)
      || !Number.isInteger(session.openerActorIndex)
      || session.openerActorIndex < 0 || session.openerActorIndex >= state.players.length
      || (session.openerTargetIndex !== null && session.openerTargetIndex !== undefined
        && (!Number.isInteger(session.openerTargetIndex)
          || session.openerTargetIndex < 0 || session.openerTargetIndex >= state.players.length))
      || !Array.isArray(session.beats) || session.beats.length !== 3) return null
  const title = safeLine(session.title, 55, 6)
  const beat = session.beats[sceneBeat.beatIndex]
  if (!title || !beat || beat.phase !== sceneBeat.phase
      || !rules.includes(beat.normalTarget) || !rules.includes(beat.boldTarget)) return null
  return {
    title,
    originTurn: session.originTurn,
    index: sceneBeat.beatIndex,
    phase: beat.phase,
    normalTarget: state.scenario === 'sex' ? 'fair' : beat.normalTarget,
    boldTarget: state.scenario === 'sex' ? 'fair' : beat.boldTarget,
    line: safeLine(beat.line, 125, 12) ?? '',
  }
}

function chainOutcome(
  state: DirectorState,
  result: ChainOutcome['result'],
): ChainOutcome | null {
  const chain = state.chainSession
  const openingChain = state.scenePlan?.beats[0]?.chain
  if (!chain || !safeLine(chain.title,55,6)
      || !openingChain || !/^[a-z-]{2,35}$/.test(openingChain)) return null
  return {
    turn: state.turnsPlayed,
    title: chain.title,
    result,
    openingChain,
  }
}

/** A skipped card ends the plot with no penalty. The next turn starts clean. */
export function settleChainAfterTurn(
  previous: DirectorState,
  next: DirectorState,
  skipped: boolean,
): DirectorState {
  if (!previous.chainSession) return { ...next, chainSession: null }
  const ended = skipped || !next.scenePlan
  if (!ended) return { ...next, chainSession: previous.chainSession }
  const outcome = chainOutcome(previous, skipped ? 'skipped' : 'finished')
  return {
    ...next, chainSession: null,
    chainHistory: outcome ? [...(previous.chainHistory ?? []), outcome].slice(-8) : (previous.chainHistory ?? []),
  }
}

/** A risk, stage or Event may leave no valid card for the story's next beat. */
export function abandonUnavailableChain(state: DirectorState): DirectorState {
  if (!state.chainSession) return state
  const outcome = chainOutcome(state, 'unavailable')
  return {
    ...state, chainSession: null, scenePlan: null,
    chainHistory: outcome ? [...(state.chainHistory ?? []), outcome].slice(-8) : (state.chainHistory ?? []),
  }
}

export function preferredChainTarget(
  state: DirectorState,
  eligible: number[],
  risk: RiskLevel,
): number | null {
  if (state.scenario === 'sex' || !eligible.length) return null
  const active = getActiveChainBeat(state)
  const chain = state.chainSession
  if (!active || !chain) return null
  const rule = risk === 3 ? active.boldTarget : active.normalTarget
  const previous = state.history.at(-1)
  const desired = rule === 'opener' ? chain.openerActorIndex
    : rule === 'first-target' ? chain.openerTargetIndex
    : rule === 'previous-actor' ? previous?.playerIndex
    : rule === 'previous-target' ? previous?.targetIndex
    : null
  return typeof desired === 'number' && eligible.includes(desired) ? desired : null
}

/** Derive a clean, public-friendly caption from actual stored game progress. */
export function chainCaption(state: DirectorState): {title: string; step: number; line: string} | null {
  const chain = state.chainSession
  if (!chain || !safeLine(chain.title,55,6)) return null
  if (state.turnsPlayed === chain.originTurn) return { title: chain.title, step: 1, line: '' }
  const active = getActiveChainBeat(state)
  if (!active) return null
  return { title: active.title, step: active.index + 2, line: active.line }
}
