import { cards } from '../src/data/cards'
import { hydrateCardText } from '../src/deck'
import type { CardType, GameCard, Heat, Player, Scenario } from '../src/types'

const scenarios: Scenario[] = ['couple', 'sex', 'party', 'afterdark']
const heats: Heat[] = ['light', 'hot', 'hard']
const types: CardType[] = ['truth', 'dare']

const minimumPerBucket: Record<Scenario, Record<Heat, number>> = {
  couple: { light: 18, hot: 18, hard: 18 },
  sex: { light: 20, hot: 24, hard: 28 },
  party: { light: 18, hot: 18, hard: 18 },
  afterdark: { light: 18, hot: 18, hard: 18 },
}

let failed = false
const fail = (message: string) => { failed = true; console.error(`✗ ${message}`) }
const ok = (message: string) => console.log(`✓ ${message}`)

const aiMarkers = [
  /в теме «/i,
  /на тему «/i,
  /если говорить про «/i,
  /идеальн(?:ый|ая|ое) сценарий на тему/i,
  /без бытовых ограничений/i,
  /вовлечения посторонних/i,
  /какую правду .* оставляешь при себе/i,
  /как ты думаешь, что .* ответил/i,
  /больше, меньше или совсем по-другому/i,
  /не редактируй ответ/i,
  /^дай этому \w+ минут/i,
  /^следующие \w+ минут(?:ы)?:/i,
  /^без разогрева:/i,
  /^три, два, один/i,
  /объясни без дипломатии/i,
  /в рамках этого сценария/i,
  /добавляет возбуждения/i,
  /горячее как/i,
]

const vagueMarkers = [
  /попробовать это/i,
  /сделать это(?:\s|\?|\.|$)/i,
  /повторить это/i,
  /хочешь это(?:\s|\?|\.|$)/i,
]

const genericSexExit = [
  /занимайтесь сексом/i,
  /перейдите к сексу/i,
  /начните секс/i,
  /продолжать ли к сексу/i,
  /решите,? играть ли дальше/i,
  /если хотите,? продолжайте секс/i,
]

const dangerousAlcohol = /(залпом|несколько шотов|пей пока|выпей стакан|напейся|до дна|на скорость|пока не опьянеешь)/i
const ids = new Set<string>()
const exactTexts = new Map<string, string>()

function normalizedText(text: string) {
  return text
    .toLowerCase()
    .replace(/\{\{[^}]+\}\}/g, 'x')
    .replace(/[^а-яёa-z0-9]+/gi, ' ')
    .trim()
}

for (const card of cards) {
  if (ids.has(card.id)) fail(`дубликат id: ${card.id}`)
  ids.add(card.id)

  if (!card.text || card.text.trim().length < 12) fail(`${card.id}: слишком короткий текст`)
  if (!card.theme) fail(`${card.id}: нет theme`)
  if (!card.coreIdea) fail(`${card.id}: нет coreIdea`)
  if (!card.interaction) fail(`${card.id}: нет interaction`)
  if (!card.mechanic) fail(`${card.id}: нет mechanic`)
  if (card.type === 'truth' && !card.purpose) fail(`${card.id}: у Truth нет purpose`)
  if (/\{\{(?:self|other)\.g:/.test(card.text)) fail(`${card.id}: гендерная морфология не должна собираться шаблоном`)
  if (/\([+-]?а\)|\(-а\)|\(а\)/i.test(card.text)) fail(`${card.id}: гендерная скобка в тексте`)
  if (aiMarkers.some((pattern) => pattern.test(card.text))) fail(`${card.id}: ИИ/канцелярский маркер: ${card.text}`)
  if (vagueMarkers.some((pattern) => pattern.test(card.text))) fail(`${card.id}: потерян предмет вопроса/действия: ${card.text}`)
  if (genericSexExit.some((pattern) => pattern.test(card.text))) fail(`${card.id}: действие выключает игру вместо сценария: ${card.text}`)

  if ((card.scenario === 'couple' || card.scenario === 'sex') && card.alcohol) {
    fail(`${card.id}: алкоголь не относится к режиму ${card.scenario}`)
  }
  if (card.sexualAction && card.scenario !== 'sex') fail(`${card.id}: прямой сексуальный action разрешён только в режиме sex`)
  if (card.scenario === 'sex' && card.heat !== 'hard' && card.sexualAction) {
    fail(`${card.id}: Light/Hot должны держать напряжение без прямого сексуального action`)
  }
  if (card.alcohol && dangerousAlcohol.test(card.text)) fail(`${card.id}: опасная алкогольная формулировка`)
  if (card.alcohol && card.sexualAction) fail(`${card.id}: алкоголь нельзя связывать с сексуальным действием`)

  if (card.scenario === 'sex' && card.heat === 'hard' && card.type === 'dare' && card.sexualAction) {
    if (!card.scene?.endCondition) fail(`${card.id}: Sex/Hard sexualAction должен быть мини-сценой с точкой возврата`)
  }

  if (card.pairing === 'mutual-close' && card.requiresTarget === false) fail(`${card.id}: mutual-close требует второго игрока`)
  if (/наездниц/i.test(card.text)) {
    const hasFemaleRole = card.actorGenders?.includes('female') || card.targetGenders?.includes('female')
    if (!hasFemaleRole) fail(`${card.id}: «наездница» не привязана к женской роли`)
  }
  if (/сними (?:свой )?(?:лифчик|бюстгальтер)/i.test(card.text) && !card.actorGenders?.includes('female')) {
    fail(`${card.id}: действие с собственным лифчиком должно быть female-only`)
  }

  const key = `${card.scenario}:${normalizedText(card.text)}`
  const duplicate = exactTexts.get(key)
  if (duplicate) fail(`точный дубль внутри сценария: ${duplicate} / ${card.id}`)
  exactTexts.set(key, card.id)
}

for (const scenario of scenarios) {
  for (const heat of heats) {
    for (const type of types) {
      const bucket = cards.filter((card) => card.scenario === scenario && card.heat === heat && card.type === type)
      const minimum = minimumPerBucket[scenario][heat]
      if (bucket.length < minimum) fail(`${scenario}/${heat}/${type}: нужно минимум ${minimum}, найдено ${bucket.length}`)

      const coreCounts = new Map<string, number>()
      const interactions = new Set<string>()
      const themes = new Set<string>()
      for (const card of bucket) {
        if (card.coreIdea) coreCounts.set(card.coreIdea, (coreCounts.get(card.coreIdea) ?? 0) + 1)
        if (card.interaction) interactions.add(card.interaction)
        themes.add(card.theme)
      }
      const maxCore = Math.max(0, ...coreCounts.values())
      if (maxCore > 2) fail(`${scenario}/${heat}/${type}: одна coreIdea повторяется ${maxCore} раз`)
      if (interactions.size < 3) fail(`${scenario}/${heat}/${type}: мало разных interaction (${interactions.size})`)
      if (themes.size < Math.min(8, Math.ceil(bucket.length / 3))) fail(`${scenario}/${heat}/${type}: мало разных тем (${themes.size})`)
    }
  }
}

const sexHardDares = cards.filter((card) => card.scenario === 'sex' && card.heat === 'hard' && card.type === 'dare')
const hardSexual = sexHardDares.filter((card) => card.sexualAction)
const hardScenes = sexHardDares.filter((card) => card.scene?.endCondition)
if (hardSexual.length < Math.ceil(sexHardDares.length * 0.65)) {
  fail(`Sex/Hard: прямых сексуальных мини-сцен слишком мало (${hardSexual.length}/${sexHardDares.length})`)
}
if (hardScenes.length < Math.ceil(sexHardDares.length * 0.75)) {
  fail(`Sex/Hard: слишком мало управляемых сцен с возвратом в игру (${hardScenes.length}/${sexHardDares.length})`)
}

const partyCards = cards.filter((card) => card.scenario === 'party')
const afterdarkCards = cards.filter((card) => card.scenario === 'afterdark')
const partyAlcohol = partyCards.filter((card) => card.alcohol).length
const afterdarkAlcohol = afterdarkCards.filter((card) => card.alcohol).length
if (partyAlcohol < Math.ceil(partyCards.length * 0.08)) fail(`Компания: алкоголь почти не участвует в концепции (${partyAlcohol}/${partyCards.length})`)
if (afterdarkAlcohol < Math.ceil(afterdarkCards.length * 0.2)) fail(`После полуночи: алкоголь должен быть заметной частью режима (${afterdarkAlcohol}/${afterdarkCards.length})`)

const male: Player = { name: 'Алексей', gender: 'male', pairingPreference: 'female' }
const female: Player = { name: 'Катя', gender: 'female', pairingPreference: 'male' }
for (const card of cards) {
  const variants = [
    hydrateCardText(card.text, [male, female], 0, 1),
    hydrateCardText(card.text, [male, female], 1, 0),
  ]
  for (const rendered of variants) {
    if (/\{\{[^}]+\}\}/.test(rendered)) fail(`${card.id}: остался незаполненный шаблон: ${rendered}`)
  }
}

ok(`${cards.length} карточек v0.6 прошли структурный аудит`)
ok('гендерная роль, coreIdea и interaction проверяются до релиза')
ok('разврат изолирован в Sex/Hard; Light/Hot работают через эскалацию')
ok('Компания и После полуночи включают алкоголь как часть концепции')
ok('Sex/Hard проверяется как набор мини-сцен, а не «идите ебаться»')

if (failed) process.exit(1)
ok('редакторский аудит v0.6 пройден')
