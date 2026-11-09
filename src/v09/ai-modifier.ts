import type { DirectorCard, DirectorState, TurnModifier } from './types'

export const AI_MODIFIER_ENDPOINT = 'https://arcanum-tarot-ai.kunicin27522.workers.dev/game/modifier'
const REQUEST_TIMEOUT_MS = 5800

/** Categories are creative directions, NOT a list of prepared conditions. */
export type DifficultyAxis = 'specificity' | 'reasoning' | 'verbal-rule'
  | 'precision' | 'sequence' | 'constraint' | 'tempo'

export interface AIModifierRequest {
  version: 3
  scenario: DirectorCard['scenario']
  stage: DirectorState['sessionStage']
  risk: DirectorCard['risk']
  cardType: DirectorCard['type']
  chains: string[]
  cardText: string
  allowedAxes: DifficultyAxis[]
  recentLabels: string[]
}

export interface AICondition {
  axis: DifficultyAxis
  label: string
  description: string
}

const performative = /(танц|разыгра|изобраз|пантомим|реклам|парод|сыгра|спой|театрал|подиум|позир|сцен[уаые]|покажи походк|покажи.*мимик|расскаж|произнес|прочитай|объясни|тост|представь гостя|спектак)/i
const intimatePhysical = /(поцел|целуй|губ|прикосн|косн|касай|трог|обним|массаж|стимуляц|раздев|сними.*одежд|бель[еёя]|оральн|минет|кунилинг|проникнов|генитал|секс|оргазм|шл[её]п|свяж|удуш)/i
const forbidden = /(поцел|целуй|прикосн|косн|касай|трог|обним|массаж|раздев|раздет|сними\s+(?:бель|одежд|трус|лиф)|оральн|минет|кунилинг|стимуляц|генитал|аналь|проникнов|оргазм|шл[её]п|удуш|свяж|пей|выпей|алкогол|оштраф|наказан|застав|обязан|не можешь отказаться|не имеешь права отказаться|отправ|опубликуй|сфотограф|запиши на видео|покажи переписк)/i
const decorative = /(после (?:выполнения|завершения|окончания|этого)|подними бров|приподними бров|вздохни|подмигни|подмигивай|сделай (?:театральный|загадочный) (?:жест|взгляд)|шепни\s*[«"]|скажи\s*[«"]вот так)/i
const hardening = /(кажд|без\s|ни разу|никак|не повтор|не использ|не упомин|не называ|не делай|не останав|только|ровно|минимум|не менее|не больше|максимум|обязательно.*(?:две|два|три|четыре)|одновременн|чередуй|за\s+\d|в течение\s+\d|раз в\s+\d|до конца|по очереди|при каждом|вс[её]\s+время|сразу|последовательно|двумя|тремя|конкретн)/i
const cannedTitles = new Set([
  'ДВЕ КОНКРЕТНЫЕ ДЕТАЛИ','ОБЪЯСНИ СВОЙ ВЫБОР','ОТВЕТ БЕЗ ПОДГОТОВКИ',
  'ТОЛЬКО ОДИН ДУБЛЬ','БЕЗ ПАУЗ','ПЯТЬ СЕКУНД НА СТАРТ',
  'НИ ОДНОГО СЛОВА','РУКИ НЕ ПОМОГАЮТ','ВСЛЕПУЮ','БЕЗ СМЕНЫ ПОЛОЖЕНИЯ',
])

/** Do not impose new conditions on explicit physical intimacy. */
export function modifierAxesForCard(card: DirectorCard): DifficultyAxis[] {
  if (card.type === 'truth') return ['specificity','reasoning','verbal-rule']
  if (card.scenario === 'sex' && intimatePhysical.test(card.text)) return []
  if (performative.test(card.text) && card.scenario !== 'sex') {
    return ['precision','sequence','constraint','tempo']
  }
  return ['precision','constraint']
}

export function buildAIModifierRequest(card: DirectorCard, state: DirectorState): AIModifierRequest {
  return {
    version: 3,
    scenario: card.scenario,
    stage: state.sessionStage,
    risk: card.risk,
    cardType: card.type,
    chains: card.chains.slice(0,3),
    cardText: card.text.replace(/\{\{[^}]+\}\}/g,'[партнёр]').trim().slice(0,550),
    allowedAxes: modifierAxesForCard(card),
    recentLabels: state.history.slice(-10)
      .flatMap((entry) => entry.modifierLabels ?? [])
      .filter((label) => !/[{}<>]/.test(label))
      .slice(-6).map((label) => label.slice(0,50)),
  }
}

/** Local defense-in-depth; the server also does independent AI review. */
export function validateAICondition(card: DirectorCard, state: DirectorState, value: unknown): AICondition | null {
  if (!value || typeof value !== 'object') return null
  const data = value as Record<string, unknown>
  if (typeof data.axis !== 'string' || !modifierAxesForCard(card).includes(data.axis as DifficultyAxis)) return null
  if (typeof data.label !== 'string' || typeof data.description !== 'string') return null
  const label = data.label.trim().replace(/\s+/g,' ')
  const description = data.description.trim().replace(/\s+/g,' ')
  if (label.length < 6 || label.length > 48 || description.length < 55 || description.length > 205) return null
  if (/[\n\r<>\u0000-\u001f{}]/.test(data.label + data.description)) return null
  if (/https?:|www\.|@|#|\*/i.test(label + description)) return null
  if (cannedTitles.has(label.toUpperCase())) return null
  if (state.history.slice(-10).flatMap((entry)=>entry.modifierLabels ?? [])
    .some((old)=>old.toLowerCase()===label.toLowerCase())) return null
  if (forbidden.test(description) || decorative.test(description) || !hardening.test(description)) return null
  if (/(дольше чем|продли|увеличь длительност|ещ[её] минут|вместо основного|замени задание)/i.test(description)) return null
  if (/(молча|без слов|не говори|не произноси)/i.test(description)
      && /(скажи|произнес|говори|реклам|расскаж|спой|прочитай|объясни|тост|вслух|диалог)/i.test(card.text)) return null
  if (/(закрой глаза|закрытыми глазами|вслепую)/i.test(description)) return null
  if (card.scenario === 'sex' && /(за\s+\d+\s*(?:секунд|минут)|не останавливай|без останов)/i.test(description)) return null
  return {axis:data.axis as DifficultyAxis,label,description}
}

export async function requestAIModifier(
  card: DirectorCard,
  state: DirectorState,
  options: {fetcher?: typeof fetch; timeoutMs?: number; endpoint?: string} = {},
): Promise<TurnModifier | null> {
  const request = buildAIModifierRequest(card,state)
  if (!request.allowedAxes.length) return null
  const controller = new AbortController()
  const timeout = setTimeout(()=>controller.abort(),options.timeoutMs ?? REQUEST_TIMEOUT_MS)
  try {
    const response = await (options.fetcher ?? fetch)(options.endpoint ?? AI_MODIFIER_ENDPOINT,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(request),
      signal:controller.signal,
    })
    if (!response.ok) return null
    const candidate = validateAICondition(card,state,await response.json())
    if (!candidate) return null
    return {id:'ai-original-'+candidate.axis,label:candidate.label,description:candidate.description}
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}
