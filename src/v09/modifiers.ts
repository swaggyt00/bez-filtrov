import type { DirectorCard, DirectorState, RiskLevel, TurnModifier } from './types'

const allModifiers: TurnModifier[] = [
  { id: 'blindfold', label: 'С закрытыми глазами', description: 'Физическая часть карты выполняется без визуального контроля.' },
  { id: 'no-hands', label: 'Без рук', description: 'Выполни карту, не используя руки, если это физически возможно.' },
  { id: 'silence', label: 'Без слов', description: 'Во время выполнения нельзя разговаривать.' },
  { id: 'partner-controls', label: 'Партнёр задаёт темп', description: 'Темп и момент остановки выбирает партнёр.' },
  { id: 'keep-position', label: 'Не меняйте положение', description: 'Выполняйте карту из текущего положения.' },
]

function eligible(card: DirectorCard, state: DirectorState) {
  const text = card.text.toLowerCase()
  const physical = card.type === 'dare' && card.chains.some((chain) =>
    ['physical', 'tease', 'kissing', 'control', 'position', 'oral', 'sex', 'fetish', 'dom-sub'].includes(chain),
  )

  return allModifiers.filter((modifier) => {
    if (modifier.id === 'blindfold') return physical && !/(смотри|взгляд|глаз)/i.test(text)
    if (modifier.id === 'no-hands') return physical && !/(рук|ладон|держ|массаж|дроч|пальц)/i.test(text)
    if (modifier.id === 'silence') return card.type === 'dare' && !/(скажи|шепни|назови|ответь|говори)/i.test(text)
    if (modifier.id === 'partner-controls') return state.scenario === 'sex' && state.sessionStage >= 1 && physical
    if (modifier.id === 'keep-position') return Boolean(state.currentPosition) && physical
    return false
  })
}

function normalizedRandom(random: () => number) {
  const value = random()
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(0.999999999999, value))
}

export function pickTurnModifiers(
  card: DirectorCard,
  state: DirectorState,
  risk: RiskLevel,
  forcedCount = 0,
  random: () => number = Math.random,
) {
  const pool = eligible(card, state)
  if (!pool.length) return []

  let count = forcedCount
  if (!count) {
    if (risk === 2 && normalizedRandom(random) < 0.28) count = 1
    if (risk === 3 && normalizedRandom(random) < 0.68) count = normalizedRandom(random) < 0.18 ? 2 : 1
  }
  if (!count) return []

  const result: TurnModifier[] = []
  const candidates = [...pool]
  while (candidates.length && result.length < Math.min(2, count)) {
    const index = Math.floor(normalizedRandom(random) * candidates.length)
    const [picked] = candidates.splice(index, 1)
    if (picked) result.push(picked)
  }
  return result
}
