import type { DirectorCard, DirectorState, TurnModifier } from './types'

export const AI_MODIFIER_ENDPOINT = 'https://arcanum-tarot-ai.kunicin27522.workers.dev/game/modifier'
const REQUEST_TIMEOUT_MS = 3200

export type AIModifierKind = 'followup' | 'performance' | 'reaction'

export interface AIModifierRequest {
  version: 1
  scenario: DirectorCard['scenario']
  stage: DirectorState['sessionStage']
  risk: DirectorCard['risk']
  cardType: DirectorCard['type']
  chains: string[]
  cardText: string
  allowedKinds: AIModifierKind[]
  recentLabels: string[]
}

export interface AICondition {
  kind: AIModifierKind
  label: string
  description: string
}

// Performance twists only apply to acting, dancing and theatrical challenges.
// Other Dare cards may receive only a short post-action reaction, with no
// changes to the underlying action, timing, clothes or physical contact.
const performanceAction = /(танц|разыгра|изобраз|пантомим|реклам|парод|сыгра|спой|пой|театрал|подиум|позир|сцен[уаые]|покажи походк|покажи.*мимик)/i
const forbiddenNewAction = /(раздев|раздет|сними(?:те)?\s+(?:одежд|бель|лиф|трус|вещ)|целуй|поцелу|тронь|трогай|трогайте|прикосн|косн(?:ись|итесь)|обним|массаж|генитал|вагин|аналь|проникнов|оральн|минет|кунилинг|оргазм|стимуляц|шл[её]п|свяж|связыв|удуш|алкогол|выпей|напиток|телефон|фотограф|видео|снимай на камеру|отправ|опубликуй|запиши голос|сделай фото|застав|обязательн|штраф|наказан|не имеешь права|ты должен)/i
const forbiddenExtraRule = /(не (?:используй|используйте) рук|не (?:двигай|двигайтесь)|закр(?:ой|ойте) глаза|смени(?:те)? позу|держи(?:те)? глаза закрыт|не говори(?:те)?|поменяй(?:тесь)? ролями|не (?:останавливай|останавливайтесь))/i

export function modifierKindsForCard(card: DirectorCard): AIModifierKind[] {
  if (card.type === 'truth') return ['followup']
  const options: AIModifierKind[] = ['reaction']
  if (card.scenario !== 'sex' && performanceAction.test(card.text)) options.push('performance')
  return options
}

export function buildAIModifierRequest(card: DirectorCard, state: DirectorState): AIModifierRequest {
  return {
    version: 1,
    scenario: card.scenario,
    stage: state.sessionStage,
    risk: card.risk,
    cardType: card.type,
    chains: card.chains.slice(0, 3),
    // Never send players' names, personalized answers or other session secrets.
    // The generator sees the fixed authoring text with placeholders anonymized.
    cardText: card.text.replace(/\{\{[^}]+\}\}/g, '[партнёр]').trim().slice(0, 550),
    allowedKinds: modifierKindsForCard(card),
    recentLabels: state.history
      .slice(-10)
      .flatMap((entry) => entry.modifierLabels ?? [])
      .filter((label) => !/[{}<>]/.test(label))
      .slice(-5)
      .map((label) => label.slice(0, 50)),
  }
}

export function validateAICondition(
  card: DirectorCard,
  value: unknown,
): AICondition | null {
  if (!value || typeof value !== 'object') return null
  const data = value as Record<string, unknown>
  if (typeof data.kind !== 'string' || !modifierKindsForCard(card).includes(data.kind as AIModifierKind)) return null
  if (typeof data.label !== 'string' || typeof data.description !== 'string') return null
  const label = data.label.trim().replace(/\s+/g, ' ')
  const description = data.description.trim().replace(/\s+/g, ' ')
  if (label.length < 4 || label.length > 40 || description.length < 40 || description.length > 190) return null
  if (/[\n\r<>\u0000-\u001f{}]/.test(data.label + data.description)) return null
  if (/https?:|www\.|@|#|\*/i.test(label + description)) return null
  if (forbiddenNewAction.test(description) || forbiddenExtraRule.test(description)) return null
  if (/^\s*(?:пожалуйста|если хотите|можно попробовать)/i.test(description)) return null
  if (data.kind === 'followup' && !/^После ответа[, ]/i.test(description)) return null
  if (data.kind === 'reaction' && !/^После выполнения[, ]/i.test(description)) return null
  if (data.kind === 'performance' && !/^Во время выполнения[, ]/i.test(description)) return null
  // Never append a spoken line to an explicitly silent action.
  if (card.type === 'dare' && /(без слов|молча|не разговаривая)/i.test(card.text)
    && /(?:скажи|произнеси|голосом|вслух|расскажи|назови)/i.test(description)) return null
  // A new condition cannot change the card's timing, risk, target or physical action.
  if (/(вместо (?:этого|основного)|замени|отмени|пропусти|дополнительно раздень|на одну минуту|на две минуты)/i.test(description)) return null
  return {kind: data.kind as AIModifierKind,label,description}
}

export async function requestAIModifier(
  card: DirectorCard,
  state: DirectorState,
  options: {
    fetcher?: typeof fetch
    timeoutMs?: number
    endpoint?: string
  } = {},
): Promise<TurnModifier | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? REQUEST_TIMEOUT_MS)
  try {
    const response = await (options.fetcher ?? fetch)(options.endpoint ?? AI_MODIFIER_ENDPOINT, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(buildAIModifierRequest(card, state)),
      signal: controller.signal,
    })
    if (!response.ok) return null
    const data: unknown = await response.json()
    const parsed = validateAICondition(card,data)
    if (!parsed) return null
    return {
      id: 'ai-' + parsed.kind,
      label: parsed.label,
      description: parsed.description,
    }
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}
