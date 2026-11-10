import type {
  DirectorCard, DirectorPick, DirectorScenePlan, DirectorState,
  SceneBeat, ScenePhase, ScenePreferredType,
} from './types'

const phases: ScenePhase[] = ['build', 'twist', 'payoff']
const types: ScenePreferredType[] = ['truth', 'dare', 'either']
const allowedChains = new Set([
  'conversation','confession','flirt','connection','physical','tease',
  'kissing','undress','control','manual','oral','position','edging',
  'dom-sub','fetish','roleplay','sex','social','embarrassment','chaos',
])
const intimateFamilies = new Set([
  'physical','kissing','undress','control','manual','oral',
  'position','edging','dom-sub','fetish','roleplay','sex',
])

export interface ActiveStoryBeat extends SceneBeat {
  originTurn: number
  beatIndex: number
}

/** The private plan is an aspiration, never a locked card, consent or risk. */
export function getActiveStoryBeat(state: DirectorState): ActiveStoryBeat | null {
  const scene = state.scenePlan
  if (!scene || !Number.isInteger(scene.originTurn) || !Array.isArray(scene.beats)
      || scene.beats.length !== 3 || state.history.at(-1)?.skipped) return null
  const index = state.turnsPlayed - scene.originTurn - 1
  if (!Number.isInteger(index) || index < 0 || index >= phases.length) return null
  const beat = scene.beats[index]
  if (!beat || beat.phase !== phases[index] || !types.includes(beat.preferredType)
      || typeof beat.chain !== 'string' || !allowedChains.has(beat.chain)) return null
  return {
    phase:beat.phase,chain:beat.chain,preferredType:beat.preferredType,
    originTurn:scene.originTurn,beatIndex:index,
  }
}

/**
 * Only accept three bounded future beats using themes from the already
 * eligible shortlist. No prose, future challenges, names or new boundaries.
 */
export function createDirectorScenePlan(
  state: DirectorState,
  card: DirectorCard,
  shortlist: DirectorPick[],
  proposed: unknown,
): DirectorScenePlan | null {
  if (!proposed || typeof proposed !== 'object' || state.scenePlan && getActiveStoryBeat(state)) return null
  const beats = (proposed as {beats?: unknown}).beats
  if (!Array.isArray(beats) || beats.length !== 3) return null
  const allowed = new Set(shortlist.flatMap(entry => entry.card.chains))
  const validated: SceneBeat[] = []
  for (let index=0;index<3;index++) {
    const item = beats[index]
    if (!item || typeof item !== 'object') return null
    const beat = item as Record<string, unknown>
    if (beat.phase !== phases[index] || typeof beat.chain !== 'string'
        || !allowed.has(beat.chain as DirectorCard['chains'][number])
        || !allowedChains.has(beat.chain)
        || !types.includes(beat.preferredType as ScenePreferredType)) return null
    // During physical intimacy, a planned twist must never prescribe a new
    // activity family. Continuing the current approved theme is the default.
    if (state.scenario === 'sex' && state.sessionStage >= 2
        && intimateFamilies.has(card.chains[0]) && beat.chain !== card.chains[0]) return null
    validated.push({
      phase:beat.phase as ScenePhase,chain:beat.chain as SceneBeat['chain'],
      preferredType:beat.preferredType as ScenePreferredType,
    })
  }
  // A narrative only counts as a story if the opening thread returns in
  // its development and payoff. Otherwise it is just three unrelated cards.
  const openingThemes=new Set([...card.chains,...(card.nextHooks??[])])
  if (!openingThemes.has(validated[0].chain) || !openingThemes.has(validated[2].chain)) return null
  return { originTurn:state.turnsPlayed, openerCardId:card.id, beats:validated }
}

/** Advance by completed game turns, never by wall clock. A skip cancels. */
export function expireDirectorScenePlan(
  state: DirectorState, skipped: boolean,
): DirectorScenePlan | null {
  if (skipped || !state.scenePlan) return null
  const scene = state.scenePlan
  if (!Number.isInteger(scene.originTurn) || state.turnsPlayed > scene.originTurn + 3) return null
  return scene
}
