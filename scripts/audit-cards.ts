import { cards } from '../src/data/cards'
import { renderCardText } from '../src/deck'
import type { CardType, Heat, Player, Scenario } from '../src/types'

declare const process: { exit(code?: number): never }

const scenarios: Scenario[] = ['couple', 'sex', 'party', 'afterdark']
const heats: Heat[] = ['light', 'hot', 'hard']
const types: CardType[] = ['truth', 'dare']
let failed = false
const fail = (message: string) => { failed = true; console.error(`✗ ${message}`) }
const ok = (message: string) => console.log(`✓ ${message}`)

const bannedEditorial = [
  /в теме «/i,
  /на тему «/i,
  /если говорить про «/i,
  /идеальн(?:ый|ая|ое) сценарий на тему/i,
  /сценарий для тебя/i,
  /что для тебя значит/i,
  /\bтемп\b/i,
  /\bдинамик(?:а|у|ой|е)\b/i,
  /без бытовых ограничений/i,
  /вовлечения посторонних/i,
  /какую правду .* оставляешь при себе/i,
  /как ты думаешь, что .* ответил/i,
  /больше, меньше или совсем по-другому/i,
  /не редактируй ответ/i,
  /^дай этому \w+ минут/i,
  /^без разогрева:/i,
  /объясни без дипломатии/i,
  /в рамках этого сценария/i,
  /добавляет возбуждения/i,
  /горячее как/i,
]

const vagueReferents = [
  /\bпопробовать это\b/i,
  /\bсделать это\b/i,
  /\bповторить это\b/i,
  /\bхочешь это\b/i,
  /\bэтот вариант\b/i,
  /\bтакое сейчас\b/i,
]
const dangerousAlcohol = /(залпом|несколько шотов|пей пока|выпей стакан|напейся|до дна|на скорость|пока не опьянеешь)/i
const genericSexExit = /(занимайтесь сексом|перейдите к сексу|начните секс|если хотите,? продолжайте секс)/i

function normalize(text: string) {
  return text.toLowerCase().replace(/\{\{[^}]+\}\}/g, 'x').replace(/[^а-яёa-z0-9]+/gi, ' ').trim()
}

if (cards.length !== 480) fail(`v0.7 должен содержать ровно 480 карточек, найдено ${cards.length}`)

const ids = new Set<string>()
const texts = new Map<string, string>()
const male: Player = { name: 'Алексей', gender: 'male', pairingPreference: 'female' }
const female: Player = { name: 'Катя', gender: 'female', pairingPreference: 'male' }

for (const card of cards) {
  if (ids.has(card.id)) fail(`дубликат id: ${card.id}`)
  ids.add(card.id)
  if (card.text.trim().length < 10) fail(`${card.id}: слишком короткий текст`)
  if (!card.theme || !card.coreIdea || !card.interaction || !card.mechanic) fail(`${card.id}: неполные semantic metadata`)
  if (card.type === 'truth' && !card.purpose) fail(`${card.id}: Truth без purpose`)
  if (bannedEditorial.some((pattern) => pattern.test(card.text))) fail(`${card.id}: запрещённая ИИ/абстрактная формулировка: ${card.text}`)
  if (vagueReferents.some((pattern) => pattern.test(card.text))) fail(`${card.id}: потерян предмет вопроса/действия: ${card.text}`)
  if (/\([+-]?а\)|\(-а\)|\(а\)/i.test(card.text)) fail(`${card.id}: гендерная скобка в тексте`)
  if (genericSexExit.test(card.text)) fail(`${card.id}: карта выключает игру вместо ограниченного действия`)
  if (card.alcohol && dangerousAlcohol.test(card.text)) fail(`${card.id}: опасная алкогольная формулировка`)
  if ((card.scenario === 'couple' || card.scenario === 'sex') && card.alcohol) fail(`${card.id}: алкоголь не относится к ${card.scenario}`)
  if (card.sexualAction && card.scenario !== 'sex') fail(`${card.id}: sexualAction разрешён только в Sex`)
  if (card.scenario === 'sex' && card.heat !== 'hard' && card.sexualAction) fail(`${card.id}: прямой sexualAction разрешён только в Sex/Hard`)
  if (card.alcohol && card.sexualAction) fail(`${card.id}: нельзя связывать алкоголь и sexualAction`)
  if (card.scenario === 'sex' && card.heat === 'hard' && card.type === 'dare' && card.sexualAction && !card.scene?.endCondition) {
    fail(`${card.id}: Sex/Hard sexual Dare должен иметь endCondition`)
  }
  if (card.minPlayers !== undefined && (!Number.isInteger(card.minPlayers) || card.minPlayers < 2 || card.minPlayers > 6)) {
    fail(`${card.id}: minPlayers должен быть целым числом 2–6`)
  }
  const hasDurationToken = card.text.includes('{{duration}}')
  if (hasDurationToken !== (card.duration === 'temporary')) {
    fail(`${card.id}: {{duration}} и duration:'temporary' должны использоваться вместе`)
  }
  if (/сними (?:свой )?(?:лифчик|бюстгальтер)/i.test(card.text) && !card.actorGenders?.includes('female')) {
    fail(`${card.id}: собственный лифчик требует female actor metadata`)
  }
  const textKey = `${card.scenario}:${normalize(card.text)}`
  const duplicate = texts.get(textKey)
  if (duplicate) fail(`точный дубль текста: ${duplicate} / ${card.id}`)
  texts.set(textKey, card.id)

  const targetIndex = card.requiresTarget === false || card.pairing === 'none' ? null : 1
  const rendered = renderCardText(card, [male, female], 0, targetIndex, () => 0.5)
  if (/\{\{[^}]+\}\}/.test(rendered)) fail(`${card.id}: после renderCardText остался шаблон: ${rendered}`)
}

for (const scenario of scenarios) {
  for (const heat of heats) {
    for (const type of types) {
      const bucket = cards.filter((card) => card.scenario === scenario && card.heat === heat && card.type === type)
      if (bucket.length !== 20) fail(`${scenario}/${heat}/${type}: нужно ровно 20, найдено ${bucket.length}`)
      const coreCounts = new Map<string, number>()
      const interactions = new Set<string>()
      const themes = new Set<string>()
      for (const card of bucket) {
        coreCounts.set(card.coreIdea ?? card.theme, (coreCounts.get(card.coreIdea ?? card.theme) ?? 0) + 1)
        interactions.add(card.interaction ?? card.mechanic)
        themes.add(card.theme)
      }
      if (Math.max(0, ...coreCounts.values()) > 2) fail(`${scenario}/${heat}/${type}: одна coreIdea повторяется чаще двух раз`)
      if (interactions.size < 3) fail(`${scenario}/${heat}/${type}: мало разных interaction (${interactions.size})`)
      if (themes.size < 7) fail(`${scenario}/${heat}/${type}: мало разных тем (${themes.size})`)
      if (scenario === 'afterdark') {
        const twoPlayer = bucket.filter((card) => !card.minPlayers || card.minPlayers <= 2)
        if (twoPlayer.length < 12) fail(`afterdark/${heat}/${type}: для двух игроков доступно только ${twoPlayer.length}/20`)
      }
    }
  }
}

const sexHardDares = cards.filter((card) => card.scenario === 'sex' && card.heat === 'hard' && card.type === 'dare')
const sexualScenes = sexHardDares.filter((card) => card.sexualAction && card.scene?.endCondition)
if (sexualScenes.length < 10) fail(`Sex/Hard: нужно минимум 10 ограниченных sexualAction-сцен, найдено ${sexualScenes.length}`)

ok(`${cards.length} карточек прошли структурный аудит v0.7`)
if (failed) process.exit(1)
ok('редакторский аудит v0.7 пройден')
