import type { CardType } from '../types'
import type { ChainFamily, DirectorState } from './types'

export type DirectorPace = 'explore' | 'develop' | 'pivot' | 'recover' | 'breather'

/**
 * The app knows ONLY game actions (completion, skips, risk, card metadata).
 * It must never pretend it observed laughter, arousal, spoken answers, or consent.
 */
export interface DirectorPacingPlan {
  intent: DirectorPace
  momentum: number
  preferType: CardType | null
  focusChain: ChainFamily | null
  avoidChain: ChainFamily | null
  suppressOptionalModifier: boolean
}

const physicalChains = new Set<ChainFamily>([
  'physical', 'kissing', 'undress', 'control', 'manual', 'oral',
  'position', 'edging', 'dom-sub', 'fetish', 'roleplay', 'sex',
])

export function planDirectorPacing(state: DirectorState): DirectorPacingPlan {
  const history = state.history.slice(-6)
  const last = history.at(-1)
  let momentum = 0
  for (let i = history.length - 1; i >= 0 && !history[i].skipped; i--) {
    momentum = Math.min(3, momentum + 1)
  }
  const base: DirectorPacingPlan = {
    intent: 'explore',
    momentum,
    preferType: null,
    focusChain: null,
    avoidChain: null,
    suppressOptionalModifier: false,
  }
  if (!last) return base

  // A skipped card is only a skip: no shame, "cowardice", or guessed emotion.
  // Give the next turn a different topic without resetting the physical scene.
  if (last.skipped) return {
    ...base, intent: 'recover', avoidChain: last.chains[0] ?? null,
    suppressOptionalModifier: true,
  }

  // During an established intimate scene, coherence beats generic variety.
  if (state.scenario === 'sex' && state.sessionStage >= 2
      && state.chainFamily && physicalChains.has(state.chainFamily)) {
    return {
      ...base, intent: 'develop', focusChain: state.chainFamily,
      suppressOptionalModifier: true,
    }
  }

  const completed = history.filter(entry => !entry.skipped)
  const lastThree = history.slice(-3)
  const typeStreak = lastThree.length === 3
    && lastThree.every(entry => !entry.skipped && entry.type === last.type)
  const chainStreak = lastThree.length === 3 && last.chains.length > 0
    && lastThree.every(entry => !entry.skipped && entry.chains[0] === last.chains[0])

  // Parties benefit from changing the social pattern, not recycling one gimmick.
  if ((state.scenario === 'party' || state.scenario === 'afterdark')
      && (typeStreak || chainStreak)) {
    return {
      ...base, intent: 'pivot',
      preferType: typeStreak ? (last.type === 'truth' ? 'dare' : 'truth') : null,
      avoidChain: chainStreak ? last.chains[0] : null,
    }
  }

  // A relief beat is STILL at the player's chosen risk; never downgrade the fires.
  if (completed.length >= 2
      && history.slice(-2).every(entry => !entry.skipped && entry.risk === 3)) {
    return { ...base, intent: 'breather', preferType: 'truth', suppressOptionalModifier: true }
  }

  if (momentum >= 2 && state.chainFamily && state.chainDepth >= 2) {
    return { ...base, intent: 'develop', focusChain: state.chainFamily }
  }

  return base
}
