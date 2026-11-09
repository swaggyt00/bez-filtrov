import type { DirectorCard, DirectorState, TurnModifier } from './types'
import { eligibleTurnModifiers } from './modifiers'

export const AI_MODIFIER_ENDPOINT = 'https://arcanum-tarot-ai.kunicin27522.workers.dev/game/modifier'
const REQUEST_TIMEOUT_MS = 3200

/**
 * v2: AI may choose an actual difficulty mechanic, NEVER improvise arbitrary
 * post-task gestures or dialogue. Local rule rendering makes the difficulty
 * objective and independent of the model's prose.
 */
export const DIFFICULTY_RULES = {
  'truth-details': {
    label: 'ДВЕ КОНКРЕТНЫЕ ДЕТАЛИ',
    description: 'В ответе назови минимум две конкретные детали. Общих фраз без подробностей недостаточно.',
  },
  'truth-reason': {
    label: 'ОБЪЯСНИ СВОЙ ВЫБОР',
    description: 'Помимо ответа обязательно объясни одну конкретную причину, почему выбрал именно этот вариант.',
  },
  'truth-fast': {
    label: 'ОТВЕТ БЕЗ ПОДГОТОВКИ',
    description: 'Дай первый содержательный ответ в течение десяти секунд после прочтения вопроса.',
  },
  'dare-one-take': {
    label: 'ТОЛЬКО ОДИН ДУБЛЬ',
    description: 'Выполни основное задание с первой попытки: без репетиций, повторов и перезапуска.',
  },
  'dare-no-pause': {
    label: 'БЕЗ ПАУЗ',
    description: 'Выполни всё основное задание непрерывно: без пауз и остановок для обдумывания. Прервать можно в любой момент.',
  },
  'dare-quick-start': {
    label: 'ПЯТЬ СЕКУНД НА СТАРТ',
    description: 'Приступи к основному заданию не позднее чем через пять секунд после прочтения, без подготовки.',
  },
  'dare-silence': {
    label: 'НИ ОДНОГО СЛОВА',
    description: 'Выполни основное задание без слов и пояснений. Стоп-сигнал и отказ всегда разрешены.',
  },
  'dare-no-hands': {
    label: 'РУКИ НЕ ПОМОГАЮТ',
    description: 'Выполни основное задание без использования рук. При необходимости можно остановиться.',
  },
  'dare-eyes-closed': {
    label: 'ВСЛЕПУЮ',
    description: 'Выполни основное задание с закрытыми глазами, не меняя места. Если неудобно — остановись.',
  },
  'dare-keep-position': {
    label: 'БЕЗ СМЕНЫ ПОЛОЖЕНИЯ',
    description: 'Выполни основное задание, сохраняя текущее положение тела. Можно прекратить в любой момент.',
  },
} as const

export type AIDifficultyKind = keyof typeof DIFFICULTY_RULES

export interface AIModifierRequest {
  version: 2
  scenario: DirectorCard['scenario']
  stage: DirectorState['sessionStage']
  risk: DirectorCard['risk']
  cardType: DirectorCard['type']
  chains: string[]
  cardText: string
  allowedKinds: AIDifficultyKind[]
  recentLabels: string[]
}

export interface AICondition {
  kind: AIDifficultyKind
  label: string
  description: string
}

const performanceAction =
  /(танц|разыгра|изобраз|пантомим|реклам|парод|сыгра|спой|пой |театрал|подиум|позир|сцен[уаые]|покажи походк|покажи.*мимик|расскаж|произнес|прочитай|объясни|тост)/i
const pauseRequired = /(пауза|паузу|паузами|останов|замри|замереть|замри|задерж|подожди|дождись|по очереди|чередуй|сначала.*затем)/i

export function modifierKindsForCard(card: DirectorCard, state: DirectorState): AIDifficultyKind[] {
  if (card.type === 'truth') {
    const kinds: AIDifficultyKind[] = ['truth-details', 'truth-fast']
    if (!/почему|по какой причине|объясни|что заставило|чем обусловлен/i.test(card.text)) {
      kinds.push('truth-reason')
    }
    return kinds
  }

  const valid = new Set(eligibleTurnModifiers(card, state).map((item) => item.id))
  const kinds: AIDifficultyKind[] = []

  // An immediate deadline or one-shot challenge is appropriate only for
  // NON-intimate performance. Never rush an action involving touch/consent.
  if (card.scenario !== 'sex' && performanceAction.test(card.text)) {
    kinds.push('dare-one-take', 'dare-quick-start')
    if (!pauseRequired.test(card.text)) kinds.push('dare-no-pause')
  }

  // Reuse the existing per-card compatibility checks for physical constraints.
  // The sex mode does not receive blindfolded or silent constraints: stop
  // signals must remain easy, and nobody's movement or vision is restricted.
  if (card.scenario !== 'sex' && valid.has('silence')) kinds.push('dare-silence')
  if (valid.has('no-hands')) kinds.push('dare-no-hands')
  if (card.scenario !== 'sex' && valid.has('blindfold')) kinds.push('dare-eyes-closed')
  if (valid.has('keep-position')) kinds.push('dare-keep-position')

  return kinds
}

export function buildAIModifierRequest(card: DirectorCard, state: DirectorState): AIModifierRequest {
  const recentLabels = state.history
    .slice(-10)
    .flatMap((entry) => entry.modifierLabels ?? [])
    .filter((label) => !/[{}<>]/.test(label))
    .slice(-5)
    .map((label) => label.slice(0, 50))

  return {
    version: 2,
    scenario: card.scenario,
    stage: state.sessionStage,
    risk: card.risk,
    cardType: card.type,
    chains: card.chains.slice(0, 3),
    cardText: card.text.replace(/\{\{[^}]+\}\}/g, '[партнёр]').trim().slice(0, 550),
    // A recently used difficulty cannot appear again immediately.
    allowedKinds: modifierKindsForCard(card, state)
      .filter((kind) => !recentLabels.includes(DIFFICULTY_RULES[kind].label)),
    recentLabels,
  }
}

export function validateAICondition(card: DirectorCard, state: DirectorState, value: unknown): AICondition | null {
  if (!value || typeof value !== 'object') return null
  const data = value as Record<string, unknown>
  if (typeof data.kind !== 'string' || !(data.kind in DIFFICULTY_RULES)) return null
  const kind = data.kind as AIDifficultyKind
  if (!buildAIModifierRequest(card, state).allowedKinds.includes(kind)) return null

  const expected = DIFFICULTY_RULES[kind]
  // Reject creative model text instead of ever showing unverified instructions.
  if (data.label !== expected.label || data.description !== expected.description) return null
  return {kind, ...expected}
}

export async function requestAIModifier(
  card: DirectorCard,
  state: DirectorState,
  options: { fetcher?: typeof fetch; timeoutMs?: number; endpoint?: string } = {},
): Promise<TurnModifier | null> {
  const request = buildAIModifierRequest(card, state)
  if (!request.allowedKinds.length) return null

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? REQUEST_TIMEOUT_MS)
  try {
    const response = await (options.fetcher ?? fetch)(options.endpoint ?? AI_MODIFIER_ENDPOINT, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(request),
      signal: controller.signal,
    })
    if (!response.ok) return null
    const parsed = validateAICondition(card, state, await response.json())
    if (!parsed) return null
    return {id: 'ai-' + parsed.kind, label: parsed.label, description: parsed.description}
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}
