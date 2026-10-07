import type { DirectorCard, DirectorState, RiskLevel, TurnModifier } from './types'

const allModifiers: TurnModifier[] = [
  { id: 'blindfold', label: 'С закрытыми глазами', description: 'На время физической части карты закрой глаза.' },
  { id: 'no-hands', label: 'Без рук', description: 'Во время выполнения карты не используй руки.' },
  { id: 'silence', label: 'Без слов', description: 'Во время выполнения карты не разговаривай.' },
  { id: 'partner-controls', label: 'Партнёр задаёт темп', description: 'Темп и момент остановки физического действия выбирает партнёр.' },
  { id: 'keep-position', label: 'Не меняйте положение', description: 'Во время выполнения не меняйте текущее положение тела.' },
]

const needsVision = /(смотри|взгляд|глаз|прочитай|покажи|экран|галере|фото|заметк|карта|мимик|одежд|аксессуар)/i
const needsHands = /(рук|ладон|пальц|запяст|держ|массаж|дроч|стимуляц|сними|надень|возьми|полож|прикосн|косн|обним|открой|напиш|набери|покажи|обмен|поправ|сожми|шл[её]п)/i
const requiresMovement = /(встан|сяд|ляг|перейд|подой|отойд|шаг|танц|пройд|поверн|поз[ауеы]|положени|у стены|догги|миссион|наездниц|ложк|между ног|дистанц)/i
const needsSpeech = /(скажи|шепни|назови|ответь|говори|произнес|вслух|команд|слово|спроси|объясни|расскаж|прочитай|тост)/i
const alreadyControlsTempo = /(зада[её]т|управля|команд|ведущ|темп выбира|полностью управляет|направляет твою руку)/i

export function eligibleTurnModifiers(card: DirectorCard, state: DirectorState) {
  const text = card.text.toLowerCase()
  const physical = card.type === 'dare' && card.chains.some((chain) =>
    ['physical', 'tease', 'kissing', 'control', 'position', 'oral', 'sex', 'fetish', 'dom-sub'].includes(chain),
  )

  return allModifiers.filter((modifier) => {
    if (modifier.id === 'blindfold') return physical && !needsVision.test(text) && !requiresMovement.test(text)
    if (modifier.id === 'no-hands') return physical && !needsHands.test(text)
    if (modifier.id === 'silence') return card.type === 'dare' && !needsSpeech.test(text)
    if (modifier.id === 'partner-controls') {
      return state.scenario === 'sex'
        && state.sessionStage >= 1
        && physical
        && !card.chains.some((chain) => chain === 'control' || chain === 'dom-sub')
        && !alreadyControlsTempo.test(text)
    }
    if (modifier.id === 'keep-position') return Boolean(state.currentPosition) && physical && !requiresMovement.test(text)
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
  const pool = eligibleTurnModifiers(card, state)
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
