import { cards } from '../src/data/cards'
import { hydrateCardText } from '../src/deck'
import type { CardType, GameCard, Heat, Player, Scenario } from '../src/types'

const scenarios: Scenario[] = ['couple', 'sex', 'party', 'afterdark']
const heats: Heat[] = ['light', 'hot', 'hard']
const types: CardType[] = ['truth', 'dare']

const expected: Record<Scenario, Record<Heat, Record<CardType, number>>> = {
  couple: {
    light: { truth: 80, dare: 80 }, hot: { truth: 80, dare: 80 }, hard: { truth: 80, dare: 80 },
  },
  sex: {
    light: { truth: 100, dare: 100 }, hot: { truth: 120, dare: 120 }, hard: { truth: 140, dare: 140 },
  },
  party: {
    light: { truth: 80, dare: 80 }, hot: { truth: 80, dare: 80 }, hard: { truth: 80, dare: 80 },
  },
  afterdark: {
    light: { truth: 90, dare: 90 }, hot: { truth: 90, dare: 90 }, hard: { truth: 90, dare: 90 },
  },
}

let failed = false
const fail = (message: string) => { failed = true; console.error(`✗ ${message}`) }
const ok = (message: string) => console.log(`✓ ${message}`)
const warn = (message: string) => console.warn(`! ${message}`)

if (cards.length !== 2220) fail(`ожидалось 2220 карточек, найдено ${cards.length}`)

const ids = new Set<string>()
const normalizedTexts = new Map<string, string>()
for (const card of cards) {
  if (ids.has(card.id)) fail(`дубликат id: ${card.id}`)
  ids.add(card.id)

  if (!card.theme) fail(`${card.id}: нет theme`)
  if (!card.mechanic) fail(`${card.id}: нет mechanic`)
  if (!card.text || card.text.trim().length < 18) fail(`${card.id}: слишком короткий текст`)
  if (/\([+-]?а\)|\(-а\)|\(а\)/i.test(card.text)) fail(`${card.id}: гендерная скобка в тексте`)

  const normalized = card.text
    .toLowerCase()
    .replace(/\{\{[^}]+\}\}/g, 'x')
    .replace(/[^а-яёa-z0-9]+/gi, ' ')
    .trim()
  const scopedKey = `${card.scenario}:${normalized}`
  const duplicate = normalizedTexts.get(scopedKey)
  if (duplicate) fail(`точный дубль внутри сценария: ${duplicate} / ${card.id}`)
  normalizedTexts.set(scopedKey, card.id)
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
      if (maxTheme > 8) fail(`${scenario}/${heat}/${type}: одна тема повторяется ${maxTheme} раз`)
      if (themeCounts.size < Math.min(14, Math.floor(group.length / 5))) {
        fail(`${scenario}/${heat}/${type}: слишком мало разных тем (${themeCounts.size})`)
      }
    }
  }
}

const male: Player = { name: 'Алексей', gender: 'male' }
const female: Player = { name: 'Катя', gender: 'female' }
const malformed = /(согласенна|самомуой|способенна|егоеё|готоваа|хотелаа|соглашалсяась|решалсяась|пьянымой)/i
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

const dangerousAlcohol = /(залпом|несколько шотов|\bшот(а|ов)?\b|пей пока|выпей стакан|напейся|до дна|на скорость|пока не опьянеешь)/i
for (const card of cards) {
  if (dangerousAlcohol.test(card.text)) fail(`${card.id}: опасная алкогольная формулировка`)
  if (card.alcohol && card.sexualAction) fail(`${card.id}: алкоголь нельзя связывать с сексуальным действием`)
}

const sexHardDares = cards.filter((card) => card.scenario === 'sex' && card.heat === 'hard' && card.type === 'dare')
const directSex = sexHardDares.filter((card) => card.sexualAction)
if (directSex.length < 130) fail(`Sex/Жёстко: только ${directSex.length}/${sexHardDares.length} Dare помечены реальным сексуальным действием`)

const sexHardThemes = new Set(sexHardDares.map((card) => card.theme))
if (sexHardThemes.size < 30) fail(`Sex/Жёстко: мало разных тем действий (${sexHardThemes.size})`)
const sexHardMechanics = new Set(sexHardDares.map((card) => card.mechanic))
if (sexHardMechanics.size < 8) fail(`Sex/Жёстко: мало разных механик (${sexHardMechanics.size})`)

const directVocabulary = /(секс|мастурб|орал|поз|разд|игруш|фантази|контрол|инициатив|душ|зеркал)/i
const directVocabularyCount = sexHardDares.filter((card) => directVocabulary.test(card.text)).length
if (directVocabularyCount < 115) fail(`Sex/Жёстко: слишком мало прямых Dare (${directVocabularyCount}/${sexHardDares.length})`)

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
          if (score >= 0.86) fail(`слишком похожие разные темы: ${group[i].id} / ${group[j].id} (${score.toFixed(2)})`)
        }
      }
    }
  }
}

const alcoholCount = cards.filter((card) => card.alcohol).length
const sexualCount = cards.filter((card) => card.sexualAction).length

ok(`${cards.length} карточек: Пара 480 / Секс 720 / Компания 480 / После полуночи 540`)
ok('только 3 уровня: Легко / Горячо / Жёстко')
ok(`Sex/Жёстко: ${sexHardDares.length} Dare, ${directSex.length} прямых сексуальных действий, ${sexHardThemes.size} тем, ${sexHardMechanics.size} механик`)
ok(`сексуальных Dare во всей базе: ${sexualCount}`)
ok(`алко-карточек: ${alcoholCount}; опасных drinking-челленджей нет`)
ok('проверены мужская и женская подстановка имён/формулировок')
if (worst.a && worst.b) ok(`максимальная схожесть между разными темами: ${worst.score.toFixed(2)} (${worst.a.id}/${worst.b.id})`)

if (failed) process.exit(1)
if (directVocabularyCount < sexHardDares.length) warn(`Sex/Жёстко: ${sexHardDares.length - directVocabularyCount} карточек прямые по действию, но без ключевых слов словаря`)
ok('аудит v4 пройден')
