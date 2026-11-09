import type { Scenario } from '../types'
import { cardIsEligible, scoreCard } from './director'
import type {
  ChainFamily,
  DirectorCard,
  DirectorPick,
  DirectorState,
  RiskLevel,
} from './types'

// One backend for ARCAnum and Без Фильтров, with a separate game-only route.
// The key lives exclusively in Cloudflare; never ship GROQ_API_KEY to GitHub Pages.
export const AI_DIRECTOR_ENDPOINT = 'https://arcanum-tarot-ai.kunicin27522.workers.dev/game/director'
const REQUEST_TIMEOUT_MS = 3200

export interface AIDirectorChoice {
  card: DirectorCard
  intro: string
  addCondition: boolean
}

export interface AIDirectorCandidate {
  id: string
  type: DirectorCard['type']
  chains: ChainFamily[]
  score: number
}

export interface AIDirectorRequest {
  version: 1
  scenario: Scenario
  risk: RiskLevel
  stage: DirectorState['sessionStage']
  tension: number
  chainFamily: ChainFamily | null
  chainDepth: number
  recent: Array<{
    type: DirectorCard['type']
    risk: RiskLevel
    chains: ChainFamily[]
    skipped: boolean
    modifierCount: number
  }>
  allowCondition: boolean
  forceCondition: boolean
  candidates: AIDirectorCandidate[]
}

function sortByScore(a: DirectorPick, b: DirectorPick) {
  return b.score - a.score || a.card.id.localeCompare(b.card.id)
}

/**
 * Only the existing, deterministic Director may approve candidate cards.
 * AI receives IDs and metadata, never the text of private/explicit challenges.
 * Diversity prevents a single card family from monopolizing AI's choices.
 */
export function createAIDirectorShortlist(
  candidates: DirectorCard[],
  state: DirectorState,
  actorIndex: number,
  risk: RiskLevel,
  limit = 12,
): DirectorPick[] {
  const ranked = candidates
    .filter((card) => cardIsEligible(card, state, actorIndex, null, risk))
    .map((card) => ({ card, score: scoreCard(card, state) }))
    .sort(sortByScore)

  const max = Math.max(1, Math.min(16, Math.floor(limit)))
  const result: DirectorPick[] = []
  const chosen = new Set<string>()
  const include = (candidate: DirectorPick) => {
    if (result.length >= max || chosen.has(candidate.card.id)) return
    chosen.add(candidate.card.id)
    result.push(candidate)
  }

  // Preserve the strongest chain continuation, then offer alternatives.
  ranked.slice(0, Math.min(4, max)).forEach(include)
  const types = new Set(result.map((entry) => entry.card.type))
  const chains = new Set(result.flatMap((entry) => entry.card.chains.slice(0, 1)))
  for (const entry of ranked) {
    if (result.length >= max) break
    const primary = entry.card.chains[0]
    if (!types.has(entry.card.type) || (primary && !chains.has(primary))) {
      include(entry)
      types.add(entry.card.type)
      if (primary) chains.add(primary)
    }
  }
  ranked.forEach(include)
  return result
}

export function buildAIDirectorRequest(
  state: DirectorState,
  risk: RiskLevel,
  shortlist: DirectorPick[],
  forceCondition = false,
): AIDirectorRequest {
  const recentlyHadCondition = state.history.slice(-2).some((entry) => (entry.modifierCount ?? 0) > 0)
  const allowCondition = forceCondition || (risk >= 2 && !recentlyHadCondition)
  return {
    version: 1,
    scenario: state.scenario,
    risk,
    stage: state.sessionStage,
    tension: Math.max(0, Math.min(160, state.tension)),
    chainFamily: state.chainFamily,
    chainDepth: Math.max(0, Math.min(20, state.chainDepth)),
    recent: state.history.slice(-8).map((entry) => ({
      type: entry.type,
      risk: entry.risk,
      chains: entry.chains.slice(0, 3),
      skipped: entry.skipped,
      modifierCount: Math.max(0, Math.min(2, entry.modifierCount ?? 0)),
    })),
    allowCondition,
    forceCondition,
    candidates: shortlist.slice(0, 16).map((entry) => ({
      id: entry.card.id,
      type: entry.card.type,
      chains: entry.card.chains.slice(0, 3),
      score: Math.round(entry.score),
    })),
  }
}

/**
 * AI only recommends a card ID. A hallucinated ID or backend failure can NEVER
 * show an unauthorized challenge: this function returns null and the local
 * Director uses its existing pick instead.
 */
export async function requestAIDirectorChoice(
  state: DirectorState,
  risk: RiskLevel,
  shortlist: DirectorPick[],
  options: {
    fetcher?: typeof fetch
    timeoutMs?: number
    endpoint?: string
    forceCondition?: boolean
  } = {},
): Promise<AIDirectorChoice | null> {
  if (shortlist.length < 2) return null
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? REQUEST_TIMEOUT_MS)
  try {
    const response = await (options.fetcher ?? fetch)(options.endpoint ?? AI_DIRECTOR_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildAIDirectorRequest(state, risk, shortlist, options.forceCondition)),
      signal: controller.signal,
    })
    if (!response.ok) return null
    const data: unknown = await response.json()
    if (!data || typeof data !== 'object') return null
    const body = data as { selectedId?: unknown; intro?: unknown; addCondition?: unknown }
    if (typeof body.selectedId !== 'string') return null
    const selected = shortlist.find((entry) => entry.card.id === body.selectedId)
    if (!selected) return null
    // Defend even if someone changes shortlist construction in the future.
    if (
      selected.card.risk !== risk
      || selected.card.scenario !== state.scenario
      || !selected.card.stages.includes(state.sessionStage)
    ) return null
    const intro = typeof body.intro === 'string'
      ? body.intro.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160)
      : ''
    const conditionAllowed = options.forceCondition || (risk >= 2
      && !state.history.slice(-2).some((entry) => (entry.modifierCount ?? 0) > 0))
    return {
      card: selected.card,
      intro,
      addCondition: conditionAllowed && body.addCondition === true,
    }
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}
