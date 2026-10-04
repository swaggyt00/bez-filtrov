import type {
  BoundaryTopic,
  CardMechanic,
  CardType,
  Category,
  GameCard,
  GameSettings,
  SessionMemory,
  SpecialRound,
} from './types'

const STOP_WORDS = new Set([
  'и','в','во','на','с','со','к','ко','у','о','об','от','до','за','для','по','из','а','но','или','что','как','какой','какая','какое','какие',
  'ты','тебя','тебе','твой','твоя','твои','это','один','одна','одно','если','бы','самый','самая','сейчас','свою','свой','свои','про','при',
])

const topicMatchers: Array<{ topic: BoundaryTopic; patterns: RegExp[] }> = [
  { topic: 'exes', patterns: [/бывш/i, /прошл(ый|ая) партн/i, /предыдущ(ие|их) отнош/i] },
  { topic: 'infidelity', patterns: [/измен/i, /неверн/i, /предательств/i, /обман.*отнош/i] },
  { topic: 'thirdPerson', patterns: [/трет(ий|ья|ьего)/i, /друг(ой|ая) человек/i, /кто-то ещё/i, /втро[её]м/i] },
  { topic: 'comparison', patterns: [/сравн/i, /лучше.*хуже/i, /переоцен/i, /недооцен/i] },
  { topic: 'toys', patterns: [/игруш/i, /девайс/i, /аксессуар.*секс/i] },
  { topic: 'alcohol', patterns: [/алкогол/i, /напит/i, /глоток/i, /навеселе/i, /трезв/i] },
  { topic: 'public', patterns: [/публич/i, /на людях/i, /обществен/i, /при других/i] },
  { topic: 'jealousy', patterns: [/ревн/i, /собственнич/i] },
  { topic: 'explicitSex', patterns: [/секс/i, /интим/i, /возбуж/i, /оргаз/i, /фантази/i, /постел/i] },
  { topic: 'future', patterns: [/будущ/i, /через год/i, /ближайш(ий|ие).*месяц/i, /долгосроч/i] },
]

function tokens(text: string) {
  return new Set(
    text
      .toLowerCase()
      .replace(/\{\{other\}\}/g, 'партнер')
      .replace(/[^а-яёa-z0-9\s-]/gi, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 2 && !STOP_WORDS.has(token)),
  )
}

export function textSimilarity(a: string, b: string) {
  const aa = tokens(a)
  const bb = tokens(b)
  if (!aa.size || !bb.size) return 0
  let intersection = 0
  aa.forEach((token) => {
    if (bb.has(token)) intersection += 1
  })
  return intersection / (aa.size + bb.size - intersection)
}

function weightedRandom<T>(items: Array<{ item: T; weight: number }>): T | undefined {
  const total = items.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0)
  if (total <= 0) return undefined
  let roll = Math.random() * total
  for (const entry of items) {
    roll -= Math.max(0, entry.weight)
    if (roll <= 0) return entry.item
  }
  return items.at(-1)?.item
}

export function getCardTopics(card: GameCard): BoundaryTopic[] {
  const found = new Set<BoundaryTopic>()
  if (card.categories.includes('alcohol')) found.add('alcohol')
  if (card.categories.includes('jealousy')) found.add('jealousy')
  if (card.categories.includes('sex')) found.add('explicitSex')
  if (card.categories.includes('fantasy')) found.add('explicitSex')
  for (const matcher of topicMatchers) {
    if (matcher.patterns.some((pattern) => pattern.test(card.text))) found.add(matcher.topic)
  }
  return [...found]
}

export function getCardMechanic(card: GameCard): CardMechanic {
  if (card.mechanic) return card.mechanic
  const text = card.text.toLowerCase()
  if (/угадай|предположи|предскажи/.test(text)) return 'guess'
  if (/шкал|от 1 до 10|оцени/.test(text)) return 'scale'
  if (/топ[- ]?3|три вещи|три пункта|назови три/.test(text)) return 'top3'
  if (/выбери|что бы ты выбрал|между .* и /.test(text)) return 'choice'
  if (/одновременно|оба .* ответ|каждый .* ответ/.test(text)) return 'simultaneous'
  if (card.type === 'dare' && /вместе|каждый .* по|оба .* сдел/.test(text)) return 'joint'
  return 'standard'
}

function intensityWeight(cardIntensity: number, targetIntensity: number, specialRound: SpecialRound) {
  const effectiveTarget = Math.min(10, targetIntensity + (specialRound === 'boss' ? 1 : 0))
  const gap = effectiveTarget - cardIntensity
  if (gap < -1) return 0
  if (gap === -1) return specialRound === 'boss' ? 2.8 : 0.2
  if (gap === 0) return 11
  if (gap === 1) return 7
  if (gap === 2) return 3.6
  if (gap === 3) return 1.5
  if (gap === 4) return 0.55
  return 0.12
}

function categoryWeight(card: GameCard, recentCategories: Category[], memory: SessionMemory) {
  const recent = recentCategories.slice(-6)
  const repeats = card.categories.reduce(
    (sum, category) => sum + recent.filter((item) => item === category).length,
    0,
  )
  let weight = Math.max(0.2, 1 - repeats * 0.16)

  const stats = card.categories.map((category) => memory.categoryStats[category])
  const totalCompleted = stats.reduce((sum, stat) => sum + stat.completed, 0)
  const totalSkipped = stats.reduce((sum, stat) => sum + stat.skipped, 0)
  const totalRerolled = stats.reduce((sum, stat) => sum + stat.rerolled, 0)
  const total = totalCompleted + totalSkipped + totalRerolled
  if (total >= 3) {
    const negativeRate = (totalSkipped + totalRerolled * 0.65) / total
    weight *= Math.max(0.45, 1 - negativeRate * 0.5)
  }
  return weight
}

function relationshipWeight(card: GameCard, settings: GameSettings) {
  if (!card.relationships.includes(settings.relationship)) return 0
  if (card.relationships.length === 1) return 1.35
  if (card.relationships.length === 2) return 1.18
  return 1
}

function mechanicWeight(card: GameCard, memory: SessionMemory, specialRound: SpecialRound) {
  const mechanic = getCardMechanic(card)
  const recent = memory.mechanicsRecent.slice(-5)
  const repeats = recent.filter((item) => item === mechanic).length
  let weight = Math.max(0.3, 1 - repeats * 0.2)
  if (specialRound === 'duo' && ['joint', 'simultaneous', 'guess'].includes(mechanic)) weight *= 3.4
  if (specialRound === 'boss' && ['standard', 'scale'].includes(mechanic)) weight *= 0.78
  return weight
}

function boundaryWeight(card: GameCard, settings: GameSettings) {
  const topics = getCardTopics(card)
  if (topics.some((topic) => settings.hardLimits.includes(topic))) return 0
  const softHits = topics.filter((topic) => settings.softLimits.includes(topic)).length
  return softHits ? Math.pow(0.3, softHits) : 1
}

export function availableCards(
  cards: GameCard[],
  settings: GameSettings,
  type?: CardType,
  targetIntensity = settings.intensity,
) {
  return cards.filter((card) => {
    const typeOk = !type || card.type === type
    const relationshipOk = card.relationships.includes(settings.relationship)
    const categoryOk = card.categories.some((category) => settings.categories.includes(category))
    const intensityOk = card.intensity <= Math.min(10, targetIntensity + 1)
    const boundaryOk = boundaryWeight(card, settings) > 0
    return typeOk && relationshipOk && categoryOk && intensityOk && boundaryOk
  })
}

interface PickCardArgs {
  cards: GameCard[]
  settings: GameSettings
  type: CardType
  targetIntensity: number
  usedCardIds: string[]
  recentCardIds: string[]
  recentCategories: Category[]
  memory: SessionMemory
  specialRound: SpecialRound
}

export function pickCard({
  cards,
  settings,
  type,
  targetIntensity,
  usedCardIds,
  recentCardIds,
  recentCategories,
  memory,
  specialRound,
}: PickCardArgs): GameCard | undefined {
  const used = new Set(usedCardIds)
  const recentCards = recentCardIds
    .map((id) => cards.find((card) => card.id === id))
    .filter((card): card is GameCard => Boolean(card))

  let pool = availableCards(cards, settings, type, targetIntensity).filter((card) => !used.has(card.id))

  const diversePool = pool.filter((card) =>
    recentCards.every((recent) => textSimilarity(card.text, recent.text) < 0.4),
  )
  if (diversePool.length >= Math.min(8, pool.length)) pool = diversePool

  const weighted = pool.map((card) => {
    let weight = intensityWeight(card.intensity, targetIntensity, specialRound)
    weight *= relationshipWeight(card, settings)
    weight *= categoryWeight(card, recentCategories, memory)
    weight *= mechanicWeight(card, memory, specialRound)
    weight *= boundaryWeight(card, settings)

    const selectedCategoryHits = card.categories.filter((category) => settings.categories.includes(category)).length
    weight *= 1 + Math.min(0.18, Math.max(0, selectedCategoryHits - 1) * 0.07)

    return { item: card, weight }
  })

  return weightedRandom(weighted)
}

export function primaryCategory(card: GameCard, selected: Category[]): Category {
  return card.categories.find((category) => selected.includes(category)) ?? card.categories[0]
}

export function buildFollowUpCard(source: {
  sourceCardId: string
  sourceText: string
  sourceCategories: Category[]
  sourceIntensity: number
}, type: CardType): GameCard {
  const excerpt = source.sourceText.length > 105 ? `${source.sourceText.slice(0, 102)}…` : source.sourceText
  const text = type === 'truth'
    ? `Продолжение к прошлой теме: «${excerpt}» Что в своём прошлом ответе ты недосказал(а), смягчил(а) или хотел(а) бы уточнить сейчас?`
    : `Продолжение к прошлой теме: «${excerpt}» Сделай один конкретный шаг, который покажет, что ты не просто ответил(а), а действительно услышал(а) эту тему.`

  return {
    id: `followup-${source.sourceCardId}-${Date.now()}`,
    type,
    intensity: Math.min(10, Math.max(5, source.sourceIntensity)),
    relationships: ['new', 'dating', 'longterm', 'mixed'],
    categories: source.sourceCategories,
    text,
    synthetic: true,
    sourceCardId: source.sourceCardId,
  }
}
