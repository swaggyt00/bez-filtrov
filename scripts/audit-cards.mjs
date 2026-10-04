import fs from 'node:fs'

const scenarios = ['couple', 'sex', 'party', 'afterdark']
const heats = ['light', 'hot', 'hard', 'extreme', 'madness']
const types = ['truth', 'dare']
const fail = (message) => { console.error(`✗ ${message}`); process.exitCode = 1 }

const cards = scenarios.flatMap((scenario) => {
  const url = new URL(`../src/data/cards-${scenario}-v3.json`, import.meta.url)
  const entries = JSON.parse(fs.readFileSync(url, 'utf8'))
  return entries.map((entry, index) => ({ ...entry, scenario, id: `${scenario}-${entry.heat}-${entry.type}-${index + 1}` }))
})

if (cards.length !== 200) fail(`ожидалось 200 карточек v3, найдено ${cards.length}`)

const normalized = new Map()
for (const card of cards) {
  if (!types.includes(card.type)) fail(`${card.id}: неизвестный тип ${card.type}`)
  if (!heats.includes(card.heat)) fail(`${card.id}: неизвестный уровень ${card.heat}`)
  if (typeof card.text !== 'string' || card.text.trim().length < 20) fail(`${card.id}: слишком короткий текст`)
  if (/\([+-]?а\)|\(-а\)|\(а\)/i.test(card.text)) fail(`${card.id}: найдена уродливая гендерная скобка`)
  if (/\b(назови|расскажи|признайся|ответь|обсуди)\b/i.test(card.text) && card.type === 'dare' && /^(назови|расскажи|признайся|ответь|обсуди)/i.test(card.text)) {
    fail(`${card.id}: действие начинается как обычный вопрос/разговор`)
  }
  const key = card.text.toLowerCase().replace(/\{\{[^}]+\}\}/g, 'x').replace(/[^а-яёa-z0-9]+/gi, ' ').trim()
  if (normalized.has(key)) fail(`точный дубль: ${normalized.get(key)} и ${card.id}`)
  normalized.set(key, card.id)
}

for (const scenario of scenarios) {
  for (const heat of heats) {
    for (const type of types) {
      const count = cards.filter((card) => card.scenario === scenario && card.heat === heat && card.type === type).length
      if (count !== 5) fail(`${scenario}/${heat}/${type}: ожидалось 5, найдено ${count}`)
    }
  }
}

const dangerousAlcohol = /(залпом|несколько шотов|\bшот(а|ов)?\b|пей пока|выпей стакан|напейся|до дна|на скорость)/i
for (const card of cards) if (dangerousAlcohol.test(card.text)) fail(`${card.id}: потенциально опасная алкогольная формулировка`)

const physical = /(поцел|массаж|одежд|завяжи|глаз|тело|поз|прикос|объят|колен|движ|дразн|спин|тал|ше|плеч|бед)/i
const highSexDares = cards.filter((card) => card.scenario === 'sex' && ['hard', 'extreme', 'madness'].includes(card.heat) && card.type === 'dare')
const physicalHighSex = highSexDares.filter((card) => physical.test(card.text)).length
if (physicalHighSex < 13) fail(`режим Sex на высоких уровнях недостаточно телесный: ${physicalHighSex}/${highSexDares.length}`)

const explicitHighTruths = cards.filter((card) => ['extreme', 'madness'].includes(card.heat) && card.type === 'truth' && /(секс|пересп|фантази|измен|возбуж|постел|желан)/i.test(card.text)).length
if (explicitHighTruths < 25) fail(`слишком мало реально жёстких Truth на верхних уровнях: ${explicitHighTruths}`)

const highDares = cards.filter((card) => ['extreme', 'madness'].includes(card.heat) && card.type === 'dare')
const physicalHighDares = highDares.filter((card) => physical.test(card.text)).length
if (physicalHighDares < 27) fail(`слишком мало телесных Dare на верхних уровнях: ${physicalHighDares}/${highDares.length}`)

const alcoholCards = cards.filter((card) => /алкогол|пья|глоток|напит/i.test(card.text)).length

console.log(`✓ ${cards.length} карточек v3`)
console.log('✓ 4 сценария × 5 уровней × 5 Truth + 5 Dare')
console.log(`✓ Sex hard/extreme/madness: ${physicalHighSex}/${highSexDares.length} телесных Dare`)
console.log(`✓ верхние уровни: ${physicalHighDares}/${highDares.length} телесных Dare`)
console.log(`✓ жёстких Truth с прямой взрослой тематикой: ${explicitHighTruths}`)
console.log(`✓ алкогольных карточек: ${alcoholCards}; опасных drinking-челленджей нет`)
console.log('✓ форматов вроде «встретил(-а)» нет')
if (!process.exitCode) console.log('✓ аудит v3 пройден')
