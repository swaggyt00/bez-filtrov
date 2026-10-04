import type { CardMechanic, CardType, GameCard, Heat, Scenario } from '../types'

export interface TruthTopic {
  id: string
  label: string
  alcohol?: boolean
}

export interface TruthPattern {
  id: string
  mechanic: CardMechanic
  render: (topic: TruthTopic) => string
}

export interface DareAction {
  id: string
  core: string
  mechanic: CardMechanic
  sexualAction?: boolean
  alcohol?: boolean
  formats?: string[]
}

export interface DareFormat {
  id: string
  render: (action: DareAction) => string
}

function stableHash(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function deterministicOrder<T>(items: T[], key: (item: T) => string, seed: string) {
  return [...items].sort((a, b) => stableHash(`${seed}:${key(a)}`) - stableHash(`${seed}:${key(b)}`))
}

function buildId(scenario: Scenario, heat: Heat, type: CardType, index: number) {
  return `${scenario}-${heat}-${type}-${String(index + 1).padStart(3, '0')}`
}

export function buildTruthDeck(args: {
  scenario: Scenario
  heat: Heat
  count: number
  topics: TruthTopic[]
  patterns: TruthPattern[]
}) {
  const candidates = args.topics.flatMap((topic) =>
    args.patterns.map((pattern) => ({
      text: pattern.render(topic),
      theme: topic.id,
      mechanic: pattern.mechanic,
      alcohol: topic.alcohol,
      key: `${topic.id}:${pattern.id}`,
    })),
  )

  if (candidates.length < args.count) {
    throw new Error(`${args.scenario}/${args.heat}/truth: need ${args.count}, have ${candidates.length}`)
  }

  return deterministicOrder(candidates, (item) => item.key, `${args.scenario}:${args.heat}:truth`)
    .slice(0, args.count)
    .map<GameCard>((item, index) => ({
      id: buildId(args.scenario, args.heat, 'truth', index),
      scenario: args.scenario,
      heat: args.heat,
      type: 'truth',
      text: item.text,
      theme: item.theme,
      mechanic: item.mechanic,
      alcohol: item.alcohol,
    }))
}

export function buildDareDeck(args: {
  scenario: Scenario
  heat: Heat
  count: number
  actions: DareAction[]
  formats: DareFormat[]
}) {
  const candidates = args.actions.flatMap((action) => {
    const allowed = action.formats?.length
      ? args.formats.filter((format) => action.formats?.includes(format.id))
      : args.formats

    return allowed.map((format) => ({
      text: format.render(action),
      theme: action.id,
      mechanic: action.mechanic,
      sexualAction: action.sexualAction,
      alcohol: action.alcohol,
      key: `${action.id}:${format.id}`,
    }))
  })

  if (candidates.length < args.count) {
    throw new Error(`${args.scenario}/${args.heat}/dare: need ${args.count}, have ${candidates.length}`)
  }

  return deterministicOrder(candidates, (item) => item.key, `${args.scenario}:${args.heat}:dare`)
    .slice(0, args.count)
    .map<GameCard>((item, index) => ({
      id: buildId(args.scenario, args.heat, 'dare', index),
      scenario: args.scenario,
      heat: args.heat,
      type: 'dare',
      text: item.text,
      theme: item.theme,
      mechanic: item.mechanic,
      sexualAction: item.sexualAction,
      alcohol: item.alcohol,
    }))
}

export const truthPatterns: TruthPattern[] = [
  { id: 'honest', mechanic: 'confession', render: (topic) => `Если говорить про «${topic.label}» без фильтров: какую правду ты обычно оставляешь при себе?` },
  { id: 'want', mechanic: 'direct', render: (topic) => `Что именно в теме «${topic.label}» тебе хочется сильнее всего прямо сейчас?` },
  { id: 'avoid', mechanic: 'confession', render: (topic) => `Какой вопрос про «${topic.label}» тебе было бы неприятнее всего услышать от {{other.gen}} — и каков честный ответ?` },
  { id: 'change', mechanic: 'direct', render: (topic) => `Что ты {{self.g:хотел|хотела}} бы изменить в теме «${topic.label}», если бы никто тебя за это не осудил?` },
  { id: 'last', mechanic: 'direct', render: (topic) => `Когда «${topic.label}» в последний раз реально повлияла на твоё желание, настроение или выбор? Что произошло?` },
  { id: 'choice', mechanic: 'choice', render: (topic) => `Если выбирать только один вариант в теме «${topic.label}»: что ты оставишь, а от чего спокойно откажешься?` },
  { id: 'secret', mechanic: 'confession', render: (topic) => `Какой секрет или неловкая деталь у тебя связана с темой «${topic.label}»?` },
  { id: 'fantasy', mechanic: 'direct', render: (topic) => `Как выглядел бы твой идеальный сценарий на тему «${topic.label}», если убрать стеснение и бытовые ограничения?` },
  { id: 'partner', mechanic: 'guess', render: (topic) => `Как ты думаешь, что {{other.nom}} {{other.g:ответил|ответила}} бы за тебя на вопрос про «${topic.label}» — и где {{other.g:он|она}} ошибётся?` },
  { id: 'compare', mechanic: 'rank', render: (topic) => `Насколько важна для тебя тема «${topic.label}» по сравнению с другими желаниями? Что стоит выше неё?` },
  { id: 'never', mechanic: 'direct', render: (topic) => `Что в теме «${topic.label}» ты точно не {{self.g:хотел|хотела}} бы повторять — даже если когда-то {{self.g:соглашался|соглашалась}}?` },
  { id: 'today', mechanic: 'direct', render: (topic) => `Что из темы «${topic.label}» ты реально {{self.g:готов|готова}} попробовать или обсудить сегодня, а не когда-нибудь потом?` },
  { id: 'first', mechanic: 'direct', render: (topic) => `Какая первая мысль приходит тебе в голову, когда звучит «${topic.label}»? Не редактируй ответ.` },
  { id: 'more-less', mechanic: 'choice', render: (topic) => `В теме «${topic.label}» тебе сейчас хочется больше, меньше или совсем по-другому? Объясни без дипломатии.` },
]

export const lightDareFormats: DareFormat[] = [
  { id: 'plain', render: (action) => `${action.core}.` },
  { id: 'timed30', render: (action) => `На 30 секунд: ${action.core.charAt(0).toLowerCase()}${action.core.slice(1)}.` },
  { id: 'silent', render: (action) => `Без слов: ${action.core.charAt(0).toLowerCase()}${action.core.slice(1)}.` },
  { id: 'partner-pace', render: (action) => `Пусть {{other.nom}} задаст темп. ${action.core}.` },
  { id: 'countdown', render: (action) => `Три, два, один — ${action.core.charAt(0).toLowerCase()}${action.core.slice(1)}.` },
]

export const hotDareFormats: DareFormat[] = [
  { id: 'plain', render: (action) => `${action.core}.` },
  { id: 'timed60', render: (action) => `На одну минуту: ${action.core.charAt(0).toLowerCase()}${action.core.slice(1)}.` },
  { id: 'timed120', render: (action) => `На две минуты: ${action.core.charAt(0).toLowerCase()}${action.core.slice(1)}.` },
  { id: 'silent', render: (action) => `Без разговоров: ${action.core.charAt(0).toLowerCase()}${action.core.slice(1)}.` },
  { id: 'partner-pace', render: (action) => `Темп выбирает {{other.nom}}. ${action.core}.` },
  { id: 'now', render: (action) => `Не откладывая: ${action.core.charAt(0).toLowerCase()}${action.core.slice(1)}.` },
]

export const hardDareFormats: DareFormat[] = [
  { id: 'plain', render: (action) => `${action.core}.` },
  { id: 'timed2', render: (action) => `Следующие две минуты: ${action.core.charAt(0).toLowerCase()}${action.core.slice(1)}.` },
  { id: 'timed5', render: (action) => `Дай этому пять минут: ${action.core.charAt(0).toLowerCase()}${action.core.slice(1)}.` },
  { id: 'direct', render: (action) => `Без разогрева: ${action.core.charAt(0).toLowerCase()}${action.core.slice(1)}.` },
]
