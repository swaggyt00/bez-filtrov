import type { GameCard, Heat } from '../types'
import type { BoundaryTag, ChainFamily, ClothingState, DirectorCard, RiskLevel, SessionStage } from './types'
import { curateSexLegacyCard } from './sex-curation'

const stageMap: Record<GameCard['scenario'], Record<Heat, SessionStage[]>> = {
  couple: { light: [0, 1], hot: [1, 2], hard: [2, 3] },
  party: { light: [0, 1], hot: [1, 2], hard: [2, 3] },
  afterdark: { light: [0, 1], hot: [1, 2], hard: [2, 3] },
  sex: { light: [0, 1], hot: [1, 2], hard: [3, 4] },
}

function inferChain(card: GameCard): ChainFamily {
  const value = [card.interaction, card.mechanic, card.theme, card.text].join(' ').toLowerCase()
  if (/edging|эдж|останов.*пик|близко к оргазм/.test(value)) return 'edging'
  if (/dom|sub|подчин|доминир|власть/.test(value)) return 'dom-sub'
  if (/oral|кунилинг|минет|соси|лижи.*(?:вульв|клитор|пенис)/.test(value)) return 'oral'
  if (/position|поз|догги|наездниц|миссионер|ложк/.test(value)) return 'position'
  if (/fetish|фетиш|стоп|feet|ступн|стопы/.test(value)) return 'fetish'
  if (/control|контрол|команд|ведущ|ведом|темп/.test(value)) return 'control'
  if (/clothing|одежд|бель|сними|раздень/.test(value)) return 'undress'
  if (/kiss|поцел/.test(value)) return 'kissing'
  if (/flirt|флирт|tension|напряж/.test(value)) return 'tease'
  if (/embarrass|нелов|кринж/.test(value)) return 'embarrassment'
  if (/social|group|групп/.test(value)) return 'social'
  if (/physical|физ|прикос|обним|массаж/.test(value)) return 'physical'
  if (/confession|призн|story|conversation|правд/.test(value)) return 'confession'
  return card.scenario === 'party' || card.scenario === 'afterdark' ? 'chaos' : 'conversation'
}

function idHash(id: string) {
  let value = 0
  for (const char of id) value = (value * 31 + char.charCodeAt(0)) >>> 0
  return value
}

function riskWithinLegacyBucket(card: GameCard): RiskLevel {
  const text = card.text.toLowerCase()
  let score = 1

  if (card.type === 'truth' && ['conflict', 'desire', 'experience'].includes(card.purpose ?? '')) score = 2
  if (['control', 'roleplay', 'position', 'clothing', 'embarrassment'].includes(card.mechanic)) score = Math.max(score, 2)
  if (card.type === 'dare' && ['physical', 'control', 'sexual-scene', 'clothing', 'embarrassment'].includes(card.interaction ?? '')) score = Math.max(score, 2)

  if (
    card.sexualAction
    || /пенис|вульв|вагин|клитор|минет|кунилинг|проникнов|трах|69|догги|наездниц|миссионер|раздень|сними бель|голышом/.test(text)
  ) score = 3

  // A Truth's risk must come from its content, never from its id/hash. The old
  // lottery could turn a generic preference question into a three-fire reveal.
  // Keep legacy heat as a hard ceiling for questions; only semantically explicit
  // Hard truths may reach risk 3 before scenario-specific curation is applied.
  if (card.type === 'truth') {
    if (card.heat === 'light') return 1
    if (card.heat === 'hot') return Math.min(2, score) as RiskLevel
    return Math.min(3, score) as RiskLevel
  }

  const hash = idHash(card.id)
  if (score === 1 && hash % 7 === 0) score = 3
  else if (score === 1 && hash % 3 === 0) score = 2
  else if (score === 2 && hash % 9 === 0) score = 3

  return Math.min(3, score) as RiskLevel
}

function inferBoundaries(card: GameCard): BoundaryTag[] {
  if (card.scenario !== 'sex') return []
  const text = card.text.toLowerCase()
  const result: BoundaryTag[] = []
  if (/(?:дроч|стимул.*(?:пенис|вульв|клитор)|ласкай.*(?:пенис|вульв|клитор)|рук.*(?:пенис|вульв|клитор))/i.test(text)) result.push('manual')
  if (/минет|кунилинг|оральн|соси|лижи.*(?:вульв|клитор|пенис)|69/.test(text)) result.push('oral')
  if (/проникнов|трах|догги|наездниц|миссионер|вагинальн/.test(text)) result.push('penetration')
  if (/шлеп|шлёп|spank/.test(text)) result.push('spanking')
  if (/свяж|завяж|bondage|фиксац/.test(text)) result.push('bondage')
  if (/доминир|подчин|ведом|власть|dom|sub/.test(text)) result.push('dom-sub')
  if (/эдж|edging|близко к оргазм|останов.*пик/.test(text)) result.push('edging')
  if (/игрушк|вибратор|дилдо/.test(text)) result.push('toys')
  if (/анал/.test(text)) result.push('anal')
  if (/ступн|стопы|feet|фут-фетиш/.test(text)) result.push('feet')
  if (/ролевая|роль|roleplay/.test(text)) result.push('roleplay')
  return [...new Set(result)]
}

function normalizeLegacyText(card: GameCard) {
  if (card.scenario !== 'sex' || card.heat !== 'hard' || !card.sexualAction) return card.text

  const penetration = /вагинальн|проникнов|занимайтесь сексом|трахай/i.test(card.text)
  let text = card.text

  if (penetration) {
    text = text
      .replaceAll('до сорока секунд', 'до трёх минут')
      .replaceAll('не дольше тридцати секунд', 'не дольше двух минут')
      .replaceAll('сорок секунд', 'три минуты')
      .replaceAll('тридцать секунд', 'две минуты')
      .replaceAll('двадцать секунд', 'полторы минуты')
  } else {
    text = text
      .replaceAll('до сорока секунд', 'до двух минут')
      .replaceAll('не дольше тридцати секунд', 'не дольше полутора минут')
      .replaceAll('сорок секунд', 'две минуты')
      .replaceAll('тридцать секунд', 'полторы минуты')
      .replaceAll('двадцать секунд', 'одну минуту')
  }

  return text
}

function inferPosition(text: string) {
  const value = text.toLowerCase()
  if (/догги/.test(value)) return 'doggy'
  if (/наездниц/.test(value)) return 'rider'
  if (/миссионер/.test(value)) return 'missionary'
  if (/ложк/.test(value)) return 'spoons'
  if (/на колен|коленях/.test(value)) return 'kneeling'
  if (/сверху/.test(value)) return 'on-top'
  if (/к стен|у стен/.test(value)) return 'against-wall'
  if (/сидя|сяд/.test(value)) return 'sitting'
  if (/л[яе]г|лёжа|лежа/.test(value)) return 'lying'
  if (/встан|стоя/.test(value)) return 'standing'
  return null
}

function clothingAfter(card: GameCard): ClothingState | null {
  if (card.scenario !== 'sex' || card.type !== 'dare') return null
  if (!/(сними|снять|раздень|раздеться|останься без|в белье|голышом|голая|голый)/i.test(card.text)) return null
  if (card.heat === 'light') return 'partially-undressed'
  if (card.heat === 'hot') return 'underwear'
  return 'partially-nude'
}

export function adaptLegacyCard(card: GameCard): DirectorCard {
  const chain = inferChain(card)
  const boundaries = inferBoundaries(card)
  const position = card.type === 'dare' ? inferPosition(card.text) : null
  const clothing = clothingAfter(card)
  const targetsOther = /\{\{other\.|партн[её]р/i.test(card.text)
  const effects: DirectorCard['effects'] = {}

  if (position) effects.position = position
  if (card.mechanic === 'control') effects.leader = 'actor'
  if (clothing) {
    if (targetsOther && /сними с|раздень|пусть .* сним/i.test(card.text)) effects.targetClothing = clothing
    else effects.actorClothing = clothing
  }

  const base: DirectorCard = {
    id: `v09:${card.id}`,
    sourceCardId: card.id,
    scenario: card.scenario,
    type: card.type,
    text: normalizeLegacyText(card),
    risk: riskWithinLegacyBucket(card),
    stages: stageMap[card.scenario][card.heat],
    chains: [chain],
    nextHooks: [chain],
    requires: {
      minPlayers: card.minPlayers,
      boundaries: boundaries.length ? boundaries : undefined,
    },
    effects: Object.keys(effects).length ? effects : undefined,
    targetRequired: card.requiresTarget !== false && card.pairing !== 'none',
  }

  return card.scenario === 'sex' ? curateSexLegacyCard(card, base) : base
}

export function adaptLegacyDeck(cards: GameCard[]) {
  return cards.map(adaptLegacyCard)
}
