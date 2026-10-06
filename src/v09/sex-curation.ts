import type { GameCard } from '../types'
import type { BoundaryTag, ChainFamily, DirectorCard, RiskLevel, SessionStage } from './types'

type SexThemeProfile = {
  stages: SessionStage[]
  chain: ChainFamily
  nextHooks: ChainFamily[]
  truthRisk: RiskLevel[]
  dareRisk: RiskLevel[]
  boundaries?: BoundaryTag[]
  tensionDelta?: number
}

const LIGHT_TRUTH: RiskLevel[] = [1, 1, 2, 2, 1]
const LIGHT_DARE: RiskLevel[] = [1, 2, 2, 3, 2]
const MID_TRUTH: RiskLevel[] = [1, 2, 2, 3, 2]
const MID_DARE: RiskLevel[] = [2, 2, 3, 3, 2]
const HOT_TRUTH: RiskLevel[] = [2, 2, 3, 2, 3]
const HOT_DARE: RiskLevel[] = [2, 3, 3, 2, 3]
const HARD_TRUTH_4: RiskLevel[] = [2, 3, 2, 3]
const HARD_DARE_4: RiskLevel[] = [2, 3, 3, 3]
const EXPLICIT_TRUTH_4: RiskLevel[] = [2, 2, 3, 3]
const EXPLICIT_DARE_4: RiskLevel[] = [1, 2, 3, 3]

function profile(
  stages: SessionStage[],
  chain: ChainFamily,
  nextHooks: ChainFamily[],
  truthRisk: RiskLevel[],
  dareRisk: RiskLevel[],
  boundaries?: BoundaryTag[],
  tensionDelta?: number,
): SexThemeProfile {
  return { stages, chain, nextHooks, truthRisk, dareRisk, boundaries, tensionDelta }
}

export const SEX_THEME_PROFILES: Record<string, SexThemeProfile> = {
  // Stage 0 — anticipation, permission, first tension.
  'anticipation-light': profile([0], 'tease', ['kissing'], LIGHT_TRUTH, LIGHT_DARE),
  'voice-flirt-light': profile([0, 1], 'tease', ['kissing'], LIGHT_TRUTH, LIGHT_DARE),
  'body-attraction-light': profile([0, 1], 'confession', ['tease'], MID_TRUTH, LIGHT_DARE),
  'setting-light': profile([0], 'conversation', ['tease'], LIGHT_TRUTH, LIGHT_DARE),
  'initiation-light': profile([0, 1], 'tease', ['kissing'], LIGHT_TRUTH, MID_DARE),
  'eye-contact-light': profile([0], 'tease', ['kissing'], LIGHT_TRUTH, MID_DARE),
  'boundaries-light': profile([0, 1], 'control', ['tease'], LIGHT_TRUTH, LIGHT_DARE, undefined, -1),

  // Stage 1 — kissing, touch, body contact, first clothing tension.
  'touch-light': profile([1], 'physical', ['tease'], LIGHT_TRUTH, MID_DARE),
  'kissing-light': profile([1], 'kissing', ['physical'], MID_TRUTH, HOT_DARE),
  'outfit-light': profile([1, 2], 'undress', ['tease'], MID_TRUTH, MID_DARE),
  'teasing-light': profile([1], 'tease', ['kissing'], MID_TRUTH, HOT_DARE),
  'slow-dance-light': profile([1], 'physical', ['tease'], LIGHT_TRUTH, MID_DARE),

  // Stage 1–2 — foreplay becomes concrete.
  'foreplay-timing': profile([1, 2], 'physical', ['tease'], MID_TRUTH, HOT_DARE),
  'fantasy-sharing-hot': profile([1, 2], 'confession', ['roleplay'], HOT_TRUTH, MID_DARE),
  'body-feedback-hot': profile([2], 'control', ['physical'], MID_TRUTH, HOT_DARE),
  'dirty-talk-hot': profile([2], 'control', ['tease'], HOT_TRUTH, HOT_DARE),
  'places-hot': profile([2], 'roleplay', ['tease'], MID_TRUTH, MID_DARE),
  'blindfold-senses-hot': profile([2], 'control', ['physical'], MID_TRUTH, HOT_DARE),
  'masturbation-talk-hot': profile([2], 'tease', ['manual'], HOT_TRUTH, HOT_DARE),

  // Stage 2 — explicit staging without direct sex.
  'position-preference': profile([2], 'position', ['control'], MID_TRUTH, HOT_DARE),
  'oral-preferences': profile([2], 'tease', ['oral'], HOT_TRUTH, HOT_DARE, ['oral']),
  'rough-soft-hot': profile([2], 'control', ['dom-sub'], HOT_TRUTH, HOT_DARE),
  'control-dynamic-hot': profile([2], 'control', ['dom-sub'], HOT_TRUTH, HOT_DARE, ['dom-sub']),
  'teasing-hot': profile([2], 'tease', ['undress'], HOT_TRUTH, HOT_DARE),
  'toys-talk-hot': profile([2], 'fetish', ['fetish'], HOT_TRUTH, HOT_DARE, ['toys']),
  'roleplay-hot': profile([2], 'roleplay', ['control'], HOT_TRUTH, HOT_DARE, ['roleplay']),

  // Stage 2–3 — kink/fetish branches begin to dominate.
  'watching-being-watched': profile([2, 3], 'fetish', ['tease'], HARD_TRUTH_4, HARD_DARE_4),
  'group-fantasy': profile([2, 3], 'roleplay', ['tease'], HARD_TRUTH_4, HARD_DARE_4, ['roleplay']),
  'porn-erotica': profile([2, 3], 'fetish', ['tease'], HARD_TRUTH_4, HARD_DARE_4),
  'secret-fantasy': profile([2, 3], 'confession', ['fetish'], HARD_TRUTH_4, HARD_DARE_4),
  'boundary-shift': profile([2, 3], 'control', ['tease'], HARD_TRUTH_4, HARD_DARE_4),
  'public-risk-fantasy': profile([2, 3], 'roleplay', ['tease'], HARD_TRUTH_4, HARD_DARE_4, ['roleplay']),
  'confession-hard': profile([2, 3], 'confession', ['tease'], HARD_TRUTH_4, HARD_DARE_4),
  'orgasm-talk': profile([2, 3], 'edging', ['edging'], HARD_TRUTH_4, HARD_DARE_4, ['edging']),
  'explicit-kissing-scene': profile([2, 3], 'kissing', ['physical'], EXPLICIT_TRUTH_4, EXPLICIT_DARE_4),

  // Stage 3 — direct sexual contact or negotiated kink.
  'dominance-submission': profile([3], 'dom-sub', ['control'], HARD_TRUTH_4, HARD_DARE_4, ['dom-sub']),
  'bondage-curiosity': profile([3], 'fetish', ['dom-sub'], HARD_TRUTH_4, HARD_DARE_4, ['bondage']),
  'anal-curiosity': profile([3], 'fetish', ['fetish'], HARD_TRUTH_4, HARD_DARE_4, ['anal']),
  'impact-play-talk': profile([3], 'fetish', ['control'], HARD_TRUTH_4, HARD_DARE_4, ['spanking']),
  'toys-hard': profile([3], 'fetish', ['control'], HARD_TRUTH_4, HARD_DARE_4, ['toys']),
  'roleplay-hard': profile([3], 'roleplay', ['dom-sub'], HARD_TRUTH_4, HARD_DARE_4, ['roleplay']),
  'surrender-hard': profile([3], 'dom-sub', ['control'], HARD_TRUTH_4, HARD_DARE_4, ['dom-sub']),
  'explicit-touch-scene': profile([3, 4], 'physical', ['manual'], EXPLICIT_TRUTH_4, EXPLICIT_DARE_4, ['manual']),
  'explicit-oral-scene': profile([3, 4], 'oral', ['oral'], EXPLICIT_TRUTH_4, EXPLICIT_DARE_4, ['oral']),

  // Stage 4 — penetration and fully explicit continuation.
  'explicit-position-scene': profile([4], 'sex', ['position'], EXPLICIT_TRUTH_4, EXPLICIT_DARE_4, ['penetration']),
  'explicit-control-scene': profile([3, 4], 'control', ['sex'], EXPLICIT_TRUTH_4, EXPLICIT_DARE_4),
}

function familySize(card: GameCard) {
  if (card.heat === 'hard') return 4
  return 5
}

function localFamilyIndex(card: GameCard) {
  const match = card.id.match(/-(\d{3})$/)
  const absolute = match ? Number(match[1]) : 1
  const size = familySize(card)
  return Math.max(0, (absolute - 1) % size)
}

function pickRisk(pattern: RiskLevel[], index: number): RiskLevel {
  return pattern[index % pattern.length] ?? 2
}

function mergeBoundaries(base: BoundaryTag[] | undefined, extra: BoundaryTag[] | undefined) {
  const values = [...(base ?? []), ...(extra ?? [])]
  return values.length ? [...new Set(values)] : undefined
}

export function curateSexLegacyCard(source: GameCard, base: DirectorCard): DirectorCard {
  if (source.scenario !== 'sex') return base
  const themeProfile = SEX_THEME_PROFILES[source.theme]
  if (!themeProfile) {
    throw new Error(`Missing v0.9 Sex profile for theme "${source.theme}" (${source.id})`)
  }

  const index = localFamilyIndex(source)
  const risk = source.type === 'truth'
    ? pickRisk(themeProfile.truthRisk, index)
    : pickRisk(themeProfile.dareRisk, index)

  const boundaries = mergeBoundaries(base.requires?.boundaries, themeProfile.boundaries)
  const effects = {
    ...(base.effects ?? {}),
    ...(themeProfile.tensionDelta ? { tensionDelta: themeProfile.tensionDelta } : {}),
  }

  return {
    ...base,
    risk,
    stages: themeProfile.stages,
    chains: [themeProfile.chain],
    nextHooks: themeProfile.nextHooks,
    requires: {
      ...(base.requires ?? {}),
      boundaries,
    },
    effects: Object.keys(effects).length ? effects : undefined,
  }
}

export function sexProfileForTheme(theme: string) {
  return SEX_THEME_PROFILES[theme] ?? null
}
