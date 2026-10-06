import type {
  ActiveEffect,
  BoundaryTag,
  ChainFamily,
  ClothingState,
  DirectorCard,
  DirectorEvent,
  DirectorHistoryEntry,
  DirectorPick,
  DirectorState,
  RiskLevel,
  SessionStage,
} from './types'
import type { Player, Scenario } from '../types'

const clothingRank: Record<ClothingState, number> = {
  clothed: 0,
  'partially-undressed': 1,
  underwear: 2,
  'partially-nude': 3,
  nude: 4,
}

const stageTensionThreshold: Record<SessionStage, number> = {
  0: 18,
  1: 42,
  2: 72,
  3: 108,
  4: Number.POSITIVE_INFINITY,
}

const stageMinTurns: Record<SessionStage, number> = {
  0: 3,
  1: 6,
  2: 9,
  3: 12,
  4: Number.POSITIVE_INFINITY,
}

const maxStageByScenario: Record<Scenario, SessionStage> = {
  couple: 3,
  party: 3,
  afterdark: 3,
  sex: 4,
}

export function initialStageForClothing(clothing: ClothingState): SessionStage {
  if (clothing === 'nude' || clothing === 'partially-nude') return 2
  if (clothing === 'underwear') return 2
  return 0
}

export function createDirectorState(
  scenario: Scenario,
  players: Player[],
  clothing: ClothingState = 'clothed',
  mutuallyAllowedBoundaries: BoundaryTag[] = [],
): DirectorState {
  return {
    scenario,
    sessionStage: scenario === 'sex' ? initialStageForClothing(clothing) : 0,
    tension: 0,
    chainFamily: null,
    chainDepth: 0,
    currentPosition: null,
    leaderIndex: null,
    players: players.map((player) => ({
      player,
      clothing,
      riskHistory: [],
      cautionPressure: 0,
      activeEffectIds: [],
    })),
    activeEffects: [],
    mutuallyAllowedBoundaries,
    history: [],
    turnsPlayed: 0,
    lastEventTurn: -99,
    lastBossTurn: -99,
  }
}

function hasRequiredBoundaries(card: DirectorCard, state: DirectorState) {
  const required = card.requires?.boundaries ?? []
  return required.every((tag) => state.mutuallyAllowedBoundaries.includes(tag))
}

function clothingAllowed(card: DirectorCard, state: DirectorState, actorIndex: number, targetIndex: number | null) {
  const required = card.requires?.clothing
  if (!required?.length) return true
  const actor = state.players[actorIndex]
  const target = targetIndex === null ? null : state.players[targetIndex]
  return required.includes(actor.clothing) && (!target || required.includes(target.clothing))
}

function effectsCompatible(card: DirectorCard, state: DirectorState) {
  const activeIds = new Set(state.activeEffects.map((effect) => effect.id))
  if (card.requires?.requiredEffects?.some((id) => !activeIds.has(id))) return false
  if (card.requires?.forbiddenEffects?.some((id) => activeIds.has(id))) return false
  return true
}

export function cardIsEligible(
  card: DirectorCard,
  state: DirectorState,
  actorIndex: number,
  targetIndex: number | null,
  risk: RiskLevel,
) {
  if (card.scenario !== state.scenario) return false
  if (!card.stages.includes(state.sessionStage)) return false
  if (card.risk !== risk) return false
  if ((card.requires?.minPlayers ?? 2) > state.players.length) return false
  if (!hasRequiredBoundaries(card, state)) return false
  if (!clothingAllowed(card, state, actorIndex, targetIndex)) return false
  if (!effectsCompatible(card, state)) return false
  if (card.requires?.positions?.length && !card.requires.positions.includes(state.currentPosition ?? '')) return false
  if (card.targetRequired && targetIndex === null) return false
  return true
}

function recentEntries(state: DirectorState, count: number) {
  return state.history.slice(-count)
}

export function scoreCard(card: DirectorCard, state: DirectorState) {
  let score = 0
  const recent = recentEntries(state, 10)

  if (state.chainFamily && card.chains.includes(state.chainFamily)) score += 42
  if (state.chainFamily && card.nextHooks?.includes(state.chainFamily)) score += 12
  if (state.currentPosition && card.requires?.positions?.includes(state.currentPosition)) score += 24

  const last = recent.at(-1)
  if (last && last.chains.some((chain) => card.chains.includes(chain))) score += 18

  const sameCardRecently = recent.some((entry) => entry.cardId === card.id)
  if (sameCardRecently) score -= 100

  const samePrimaryChain = recent.slice(-3).filter((entry) => entry.chains[0] === card.chains[0]).length
  if (samePrimaryChain >= 3 && card.chains[0] !== state.chainFamily) score -= 18

  if (state.currentPosition && card.requires?.positions?.length === 0) score -= 8

  return score
}

function normalizedRandom(random: () => number) {
  const value = random()
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(0.999999999999, value))
}

export function pickDirectorCard(
  cards: DirectorCard[],
  state: DirectorState,
  actorIndex: number,
  targetIndex: number | null,
  risk: RiskLevel,
  random: () => number = Math.random,
): DirectorPick | null {
  const scored = cards
    .filter((card) => cardIsEligible(card, state, actorIndex, targetIndex, risk))
    .map((card) => ({ card, score: scoreCard(card, state) }))
    .sort((a, b) => b.score - a.score)

  if (!scored.length) return null
  const top = scored.slice(0, Math.min(5, scored.length))
  const index = Math.floor(normalizedRandom(random) * top.length)
  return top[index] ?? top[0]
}

function clampPressure(value: number) {
  return Math.max(0, Math.min(6, value))
}

function riskTension(risk: RiskLevel) {
  if (risk === 1) return 3
  if (risk === 2) return 7
  return 12
}

function clothingGateAllowsNextStage(state: DirectorState, nextStage: SessionStage) {
  if (state.scenario !== 'sex') return true
  const minimumClothingRank = Math.min(...state.players.map((player) => clothingRank[player.clothing]))
  if (nextStage <= 1) return true
  if (nextStage === 2) return minimumClothingRank >= 1
  if (nextStage === 3) return minimumClothingRank >= 2
  return minimumClothingRank >= 3
}

export function maybeAdvanceStage(state: DirectorState): DirectorState {
  const maxStage = maxStageByScenario[state.scenario]
  if (state.sessionStage >= maxStage) return state
  const current = state.sessionStage
  const next = (current + 1) as SessionStage
  if (state.tension < stageTensionThreshold[current]) return state
  if (state.turnsPlayed < stageMinTurns[current]) return state
  if (!clothingGateAllowsNextStage(state, next)) return state
  return { ...state, sessionStage: next }
}

function applyEffectList(effects: ActiveEffect[], additions: ActiveEffect[] = []) {
  const byId = new Map(effects.map((effect) => [effect.id, effect]))
  for (const effect of additions) byId.set(effect.id, effect)
  return [...byId.values()]
}

export function completeTurn(
  state: DirectorState,
  card: DirectorCard,
  actorIndex: number,
  targetIndex: number | null,
  risk: RiskLevel,
  skipped = false,
) {
  const players = state.players.map((player, index) => {
    if (index !== actorIndex) return { ...player }
    const nextHistory = [...player.riskHistory, risk].slice(-8)
    const nextPressure = skipped
      ? player.cautionPressure
      : risk === 1
        ? clampPressure(player.cautionPressure + 1)
        : risk === 2
          ? clampPressure(player.cautionPressure - 1)
          : clampPressure(player.cautionPressure - 2)
    return { ...player, riskHistory: nextHistory, cautionPressure: nextPressure }
  })

  if (!skipped && card.effects?.actorClothing) players[actorIndex].clothing = card.effects.actorClothing
  if (!skipped && targetIndex !== null && card.effects?.targetClothing) players[targetIndex].clothing = card.effects.targetClothing

  const historyEntry: DirectorHistoryEntry = {
    cardId: card.id,
    type: card.type,
    risk,
    playerIndex: actorIndex,
    targetIndex,
    chains: card.chains,
    skipped,
  }

  let next: DirectorState = {
    ...state,
    players,
    turnsPlayed: state.turnsPlayed + 1,
    history: [...state.history, historyEntry].slice(-80),
    tension: skipped ? state.tension : state.tension + riskTension(risk) + (card.effects?.tensionDelta ?? 0),
    activeEffects: skipped
      ? state.activeEffects
      : applyEffectList(state.activeEffects, card.effects?.addEffects),
  }

  if (!skipped) {
    const primary = card.nextHooks?.[0] ?? card.chains[0] ?? null
    next.chainDepth = primary && primary === state.chainFamily ? state.chainDepth + 1 : primary ? 1 : 0
    next.chainFamily = primary
    if ('position' in (card.effects ?? {})) next.currentPosition = card.effects?.position ?? null
    if (card.effects?.leader === 'actor') next.leaderIndex = actorIndex
    if (card.effects?.leader === 'target') next.leaderIndex = targetIndex
    if (card.effects?.leader === 'clear') next.leaderIndex = null
  }

  next = maybeAdvanceStage(next)
  return next
}

export function tickEffects(state: DirectorState): DirectorState {
  const activeEffects = state.activeEffects
    .map((effect) => ({ ...effect, remainingTurns: effect.remainingTurns - 1 }))
    .filter((effect) => effect.remainingTurns > 0)
  return { ...state, activeEffects }
}

export function maybeCreateCautionEvent(state: DirectorState, actorIndex: number): DirectorEvent | null {
  const player = state.players[actorIndex]
  if (!player || player.cautionPressure < 3) return null
  if (state.turnsPlayed - state.lastEventTurn < 3) return null

  if (player.cautionPressure >= 5) {
    return {
      id: 'double-stake',
      family: 'wildcard',
      title: 'ДВОЙНАЯ СТАВКА',
      description: 'Выбирай: 🔥🔥 с двумя условиями или 🔥🔥🔥 без условий.',
      targetPlayerIndex: actorIndex,
      modifierCount: 2,
      remainingTurns: 1,
    }
  }

  return {
    id: 'partner-chooses-risk',
    family: 'control',
    title: 'ПЕРЕХВАТ',
    description: 'В этот ход уровень риска выбирает партнёр.',
    targetPlayerIndex: actorIndex,
    partnerChoosesRisk: true,
    remainingTurns: 1,
  }
}

export function bossIsReady(state: DirectorState) {
  if (state.turnsPlayed - state.lastBossTurn < 6) return false
  if (state.chainDepth < 3) return false
  if (state.tension < 55) return false
  return state.sessionStage >= 2
}

export function minimumClothingState(states: ClothingState[]) {
  return states.reduce((min, state) => clothingRank[state] < clothingRank[min] ? state : min, states[0] ?? 'clothed')
}
