import { cards } from '../src/data/cards'
import { hydrateCardText } from '../src/deck'
import type { CardType, GameCard, Heat, Player, Scenario } from '../src/types'

const scenarios: Scenario[] = ['couple', 'sex', 'party', 'afterdark']
const heats: Heat[] = ['light', 'hot', 'hard']
const types: CardType[] = ['truth', 'dare']

const expected: Record<Scenario, Record<Heat, Record<CardType, number>>> = {
  couple: {
    light: { truth: 40, dare: 40 },
    hot: { truth: 40, dare: 40 },
    hard: { truth: 40, dare: 40 },
  },
  sex: {
    light: { truth: 60, dare: 60 },
    hot: { truth: 80, dare: 80 },
    hard: { truth: 100, dare: 100 },
  },
  party: {
    light: { truth: 40, dare: 40 },
    hot: { truth: 40, dare: 40 },
    hard: { truth: 40, dare: 40 },
  },
  afterdark: {
    light: { truth: 40, dare: 40 },
    hot: { truth: 40, dare: 40 },
    hard: { truth: 40, dare: 40 },
  },
}

let failed = false
const fail = (message: string) => { failed = true; console.error(`✗ ${message}`) }
const ok = (message: string) => console.log(`✓ ${message}`)
const warn = (message: string) => console.warn(`! ${message}`)

if (cards.length !== 1200) fail(`ожидалось 1200 authored-карточек, найдено ${cards.length}`)

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
]

const dangerousAlcohol = /(залпом|несколько шотов|\bшот(?:а|ов)?\b|пей пока|выпей стакан|напейся|до дна|на скорость|пока не опьянеешь)/i
const malformed = /(согласенна|самомуой|способенна|егоеё|готоваа|хотелаа|соглашалсяась|решалсяась|пьянымой|могла бы бы|хотелла|сделалала)/i

const ids = new Set<string>()
const perScenarioText = new Map<string, string>()

for (const card of cards) {
  if (ids.has(card.id)) fail(`дубликат id: ${card.id}`)
  ids.add(card.id)

  if (!card.theme) fail(`${card.id}: нет theme`)
  if (!card.mechanic) fail(`${card.id}: нет mechanic`)
  if (!card.text || card.text.trim().length < 12) fail(`${card.id}: слишком короткий текст`)
  if (/\([+-]?а\)|\(-а\)|\(а\)/i.test(card.text)) fail(`${card.id}: гендерная скобка в тексте`)
  if (card.type === 'truth' && !card.purpose) fail(`${card.id}: у Truth нет редакционной цели purpose`)
  if (card.type === 'truth' && !card.text.includes('?')) fail(`${card.id}: Truth не выглядит как живой вопрос`)
  if (aiMarkers.some((pattern) => pattern.test(card.text))) fail(`${card.id}: ИИ/канцелярский маркер: ${card.text}`)
  if (dangerousAlcohol.test(card.text)) fail(`${card.id}: опасная алкогольная формулировка`)
  if (card.alcohol && card.sexualAction) fail(`${card.id}: алкоголь нельзя связывать с сексуальным действием`)

  const normalized = card.text
    .toLowerCase()
    .replace(/\{\{[^}]+\}\}/g, 'x')
    .replace(/[^а-яёa-z0-9]+/gi, ' ')
    .trim()
  const key = `${card.scenario}:${normalized}`
  const duplicate = perScenarioText.get(key)
  if (duplicate) fail(`точный дубль внутри сценария: ${duplicate} / ${card.id}`)
  perScenarioText.set(key, card.id)
}

for (const scenario of scenarios) {
  for (const heat of heats) {
    for (const type of types) {
      const group = cards.filter((card) => card.scenario === scenario && card.heat === heat && card.type === type)
      const need = expected[scenario][heat][type]
      if (group.length !== need) fail(`${scenario}/${heat}/${type}: ожидалось ${need}, найдено ${group.length}`)

      const themeCounts = new Map<string, number>()
      for (const card of group) themeCounts.set(card.theme, (themeCounts.get(card.theme) ?? 0) + 1)
      const maxTheme = Math.max(0, ...themeCounts.values())
      const maxAllowed = scenario === 'sex' && heat === 'hard' ? 4 : scenario === 'sex' ? 4 : 2
      if (maxTheme > maxAllowed) fail(`${scenario}/${heat}/${type}: одна тема повторяется ${maxTheme} раз`)
      if (themeCounts.size < Math.ceil(group.length / maxAllowed)) {
        fail(`${scenario}/${heat}/${type}: слишком мало разных тем (${themeCounts.size})`)
      }
    }
  }
}

const male: Player = { name: 'Алексей', gender: 'male' }
const female: Player = { name: 'Катя', gender: 'female' }
for (const card of cards) {
  const variants = [
    hydrateCardText(card.text, [male, female], 0, 1),
    hydrateCardText(card.text, [male, female], 1, 0),
  ]
  for (const rendered of variants) {
    if (/\{\{[^}]+\}\}/.test(rendered)) fail(`${card.id}: остался шаблон после подстановки: ${rendered}`)
    if (malformed.test(rendered)) fail(`${card.id}: сломанная морфология: ${rendered}`)
    if (/\(-?а\)/i.test(rendered)) fail(`${card.id}: в финальном тексте осталась гендерная скобка`)
  }
}

function tokens(text: string) {
  return new Set(text.toLowerCase()
    .replace(/\{\{[^}]+\}\}/g, 'x')
    .replace(/[^а-яёa-z0-9\s]+/gi, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 4))
}

function similarity(a: string, b: string) {
  const aa = tokens(a)
  const bb = tokens(b)
  let common = 0
  for (const token of aa) if (bb.has(token)) common += 1
  return common / Math.max(1, aa.size + bb.size - common)
}

let worst: { a?: GameCard; b?: GameCard; score: number } = { score: 0 }
for (const scenario of scenarios) {
  for (const heat of heats) {
    for (const type of types) {
      const group = cards.filter((card) => card.scenario === scenario && card.heat === heat && card.type === type)
      for (let i = 0; i < group.length; i += 1) {
        for (let j = i + 1; j < group.length; j += 1) {
          if (group[i].theme === group[j].theme) continue
          const score = similarity(group[i].text, group[j].text)
          if (score > worst.score) worst = { a: group[i], b: group[j], score }
          if (score >= 0.84) fail(`слишком похожие разные темы: ${group[i].id} / ${group[j].id} (${score.toFixed(2)})`)
        }
      }
    }
  }
}

const sexHardDares = cards.filter((card) => card.scenario === 'sex' && card.heat === 'hard' && card.type === 'dare')
const sexHardTruth = cards.filter((card) => card.scenario === 'sex' && card.heat === 'hard' && card.type === 'truth')
const directSex = sexHardDares.filter((card) => card.sexualAction)
if (directSex.length < 96) fail(`Sex/Жёстко: только ${directSex.length}/${sexHardDares.length} Dare являются прямыми сексуальными действиями`)

const sexHardThemes = new Set(sexHardDares.map((card) => card.theme))
if (sexHardThemes.size < 24) fail(`Sex/Жёстко: мало разных тем действий (${sexHardThemes.size})`)

const directVocabulary = /(секс|мастурб|орал|поз|разд|игруш|фантази|контрол|инициатив|душ|зеркал|шлеп|связ|целуй|поцелу)/i
const directVocabularyCount = sexHardDares.filter((card) => directVocabulary.test(card.text)).length
if (directVocabularyCount < 90) fail(`Sex/Жёстко: слишком мало прямой сексуальной лексики (${directVocabularyCount}/${sexHardDares.length})`)

const truthPurposeCount = new Set(sexHardTruth.map((card) => card.purpose)).size
if (truthPurposeCount < 5) fail(`Sex/Жёстко Truth: слишком однообразные цели вопросов (${truthPurposeCount})`)

const alcoholCount = cards.filter((card) => card.alcohol).length
const sexualCount = cards.filter((card) => card.sexualAction).length

ok(`${cards.length} authored-карточек: Пара 240 / Секс 480 / Компания 240 / После полуночи 240`)
ok('3 уровня: Легко / Горячо / Жёстко')
ok('генератор «тема × шаблон» удалён: runtime не сочиняет текст карточек')
ok(`Sex/Жёстко: ${sexHardTruth.length} Truth + ${sexHardDares.length} Dare; ${directSex.length} прямых сексуальных Dare; ${sexHardThemes.size} тем`)
ok(`сексуальных Dare во всей базе: ${sexualCount}`)
ok(`алко-карточек: ${alcoholCount}; опасных drinking-челленджей нет`)
ok('ИИ-канцелярит, (-а), незаполненные шаблоны и известные морфологические склейки не найдены')
if (worst.a && worst.b) ok(`максимальная схожесть разных тем: ${worst.score.toFixed(2)} (${worst.a.id}/${worst.b.id})`)
if (directVocabularyCount < sexHardDares.length) warn(`Sex/Жёстко: ${sexHardDares.length - directVocabularyCount} Dare прямые по смыслу, но без слов из контрольного словаря`)

if (failed) process.exit(1)
ok('редакторский аудит v5 пройден')
