import fs from 'node:fs'

const dataDir = new URL('../src/data/', import.meta.url)
const source = fs.readdirSync(dataDir)
  .filter((name) => /^cards-part-\d+\.ts$/.test(name))
  .sort()
  .map((name) => fs.readFileSync(new URL(name, dataDir), 'utf8'))
  .join('\n')
const blockRe = /\{\s*id: '([^']+)',\s*type: '(truth|dare)',\s*intensity: (\d+),\s*relationships: \[([^\]]*)\],\s*categories: \[([^\]]*)\],\s*text: '((?:\\'|[^'])*)',\s*\},/gs
const cards = [...source.matchAll(blockRe)].map((match) => ({
  id: match[1], type: match[2], intensity: Number(match[3]),
  relationships: [...match[4].matchAll(/'([^']+)'/g)].map((m) => m[1]),
  categories: [...match[5].matchAll(/'([^']+)'/g)].map((m) => m[1]),
  text: match[6].replaceAll("\\'", "'"),
}))

const validRelationships = new Set(['new', 'dating', 'longterm', 'mixed'])
const validCategories = new Set(['relations', 'sex', 'fantasy', 'jealousy', 'past', 'alcohol', 'chaos'])
const fail = (message) => { console.error(`✗ ${message}`); process.exitCode = 1 }
const warn = (message) => console.warn(`! ${message}`)

if (cards.length !== 500) fail(`ожидалось 500 встроенных карточек, найдено ${cards.length}`)
const ids = new Set(cards.map((card) => card.id))
if (ids.size !== cards.length) fail('есть дублирующиеся id')

const normalizedTexts = new Map()
for (const card of cards) {
  const normalized = card.text.toLowerCase().replace(/[^а-яёa-z0-9]+/gi, ' ').trim()
  if (normalizedTexts.has(normalized)) fail(`точный дубль текста: ${normalizedTexts.get(normalized)} и ${card.id}`)
  normalizedTexts.set(normalized, card.id)
  if (card.intensity < 1 || card.intensity > 10) fail(`${card.id}: уровень вне диапазона 1–10`)
  if (!card.relationships.length || card.relationships.some((item) => !validRelationships.has(item))) fail(`${card.id}: некорректный формат отношений`)
  if (!card.categories.length || card.categories.some((item) => !validCategories.has(item))) fail(`${card.id}: некорректная категория`)
}

for (let level = 1; level <= 10; level += 1) {
  for (const type of ['truth', 'dare']) {
    const count = cards.filter((card) => card.intensity === level && card.type === type).length
    if (count !== 25) fail(`уровень ${level}, ${type}: ожидалось 25, найдено ${count}`)
  }
}

const stop = new Set(['как','что','это','для','тебя','тебе','твой','твоя','твои','или','при','если','один','одна','свой','свои','про','без'])
const tokens = (text) => new Set(text.toLowerCase().replace(/\{\{other\}\}/g, 'партнер').replace(/[^а-яёa-z0-9\s-]/gi, ' ').split(/\s+/).filter((word) => word.length > 2 && !stop.has(word)))
const sim = (a, b) => {
  const aa = tokens(a); const bb = tokens(b); let common = 0
  for (const token of aa) if (bb.has(token)) common += 1
  return common / Math.max(1, aa.size + bb.size - common)
}

let maxPair = { score: 0, a: '', b: '' }
for (let level = 1; level <= 10; level += 1) {
  for (const type of ['truth', 'dare']) {
    const group = cards.filter((card) => card.intensity === level && card.type === type)
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const score = sim(group[i].text, group[j].text)
        if (score > maxPair.score) maxPair = { score, a: group[i].id, b: group[j].id }
        if (score >= 0.62) fail(`слишком похожие карточки ${group[i].id} и ${group[j].id} (${score.toFixed(2)})`)
      }
    }
  }
}

function mechanic(text, type) {
  const value = text.toLowerCase()
  if (/угадай|предположи|предскажи/.test(value)) return 'guess'
  if (/шкал|от 1 до 10|оцени/.test(value)) return 'scale'
  if (/топ[- ]?3|три вещи|три пункта|назови три/.test(value)) return 'top3'
  if (/выбери|что бы ты выбрал|между .* и /.test(value)) return 'choice'
  if (/одновременно|оба .* ответ|каждый .* ответ/.test(value)) return 'simultaneous'
  if (type === 'dare' && /вместе|каждый .* по|оба .* сдел/.test(value)) return 'joint'
  return 'standard'
}

const mechanics = new Map()
for (const card of cards) mechanics.set(mechanic(card.text, card.type), (mechanics.get(mechanic(card.text, card.type)) ?? 0) + 1)
if (mechanics.size < 5) fail(`слишком мало типов механик: ${mechanics.size}`)

const dangerousAlcohol = /(залпом|несколько шотов|\bшот(а|ов)?\b|пей пока|выпей стакан|напейся|до дна)/i
for (const card of cards) if (dangerousAlcohol.test(card.text)) fail(`${card.id}: потенциально опасная алкогольная формулировка`)

const categoryCounts = Object.fromEntries([...validCategories].map((category) => [category, cards.filter((card) => card.categories.includes(category)).length]))
for (const [category, count] of Object.entries(categoryCounts)) if (count < 15) warn(`категория ${category}: всего ${count} карточек`)

const highLongterm = cards.filter((card) => card.intensity >= 9 && card.relationships.includes('longterm')).length
if (highLongterm < 80) fail(`мало карточек 9–10 для долгих отношений: ${highLongterm}`)

const truth = cards.filter((card) => card.type === 'truth').length
const dare = cards.filter((card) => card.type === 'dare').length
console.log(`✓ ${cards.length} встроенных карточек: ${truth} правда / ${dare} действие`)
console.log('✓ по 25 карточек каждого типа на каждом уровне')
console.log(`✓ максимальная token-схожесть внутри одного уровня/типа: ${maxPair.score.toFixed(2)} (${maxPair.a}/${maxPair.b})`)
console.log(`✓ механики: ${[...mechanics.entries()].map(([name, count]) => `${name}=${count}`).join(', ')}`)
console.log(`✓ категории: ${Object.entries(categoryCounts).map(([name, count]) => `${name}=${count}`).join(', ')}`)
console.log(`✓ карточек 9–10 для долгих отношений: ${highLongterm}`)
console.log('✓ опасные алкогольные формулировки не найдены')
if (!process.exitCode) console.log('✓ аудит пройден')
