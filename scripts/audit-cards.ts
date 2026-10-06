import { cards } from '../src/data/cards'
import { CARD_SOURCE_REGISTRY } from '../src/data/source-registry'
import { gameplayInteractionKey, renderCardText } from '../src/deck'
import type { CardType, Heat, Player, Scenario } from '../src/types'

declare const process: { exit(code?: number): never }

const scenarios: Scenario[] = ['couple', 'sex', 'party', 'afterdark']
const heats: Heat[] = ['light', 'hot', 'hard']
const types: CardType[] = ['truth', 'dare']
let failed = false
const fail = (message: string) => { failed = true; console.error(`✗ ${message}`) }
const ok = (message: string) => console.log(`✓ ${message}`)

const expectedBucketCounts: Record<Scenario, Record<Heat, number>> = {
  couple: { light: 60, hot: 60, hard: 60 },
  sex: { light: 60, hot: 70, hard: 80 },
  party: { light: 50, hot: 50, hard: 50 },
  afterdark: { light: 60, hot: 60, hard: 60 },
}

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
  /(?<![а-яё])попробовать это(?![а-яё])/i,
  /(?<![а-яё])сделать это(?![а-яё])/i,
  /(?<![а-яё])повторить это(?![а-яё])/i,
  /(?<![а-яё])хочешь это(?![а-яё])/i,
  /(?<![а-яё])этот вариант(?![а-яё])/i,
  /(?<![а-яё])такое сейчас(?![а-яё])/i,
]
const dangerousAlcohol = /(залпом|несколько шотов|пей пока|выпей стакан|напейся|до дна|на скорость|пока не опьянеешь)/i
const genericSexExit = /(занимайтесь сексом|перейдите к сексу|начните секс|если хотите,? продолжайте секс)/i
const speechOnlyDare = [
  /^(?:расскажи|опиши|назови|объясни|сформулируй|ответь|вспомни|перечисли|оцени|признайся|поделись|перескажи)(?=\s|[.,;:!?—-]|$)/i,
  /^выбери[^.!?]{0,160}(?:назови|объясни|оцени|расскажи)(?=\s|[.,;:!?—-]|$)/i,
  /(?:^|\s)мини-дебат/i,
  /(?:^|\s)защити позицию(?=\s|[.,;:!?—-]|$)/i,
  /(?:^|\s)назови три аргумента(?=\s|[.,;:!?—-]|$)/i,
  /(?:^|\s)составь пример сообщения(?=\s|[.,;:!?—-]|$)/i,
  /^скажи группе[^.!?]{0,180}(?:пример|своими словами|что думаешь|как считаешь)(?=\s|[.,;:!?—-]|$)/i,
  /^скажи[^.!?]{0,120}(?:пример такого|своими словами)(?=\s|[.,;:!?—-]|$)/i,
]
const firstPersonOpponentVoice = /(?<![а-яё])(?:я|меня|мне|мной|мною|мой|моя|моё|мое|мои|моего|моей|моему|моим|моими|моих)(?![а-яё])/i
const masculineCurrentPlayerVoice = /(?<![а-яё])ты(?=[^.!?]{0,80}(?:совершал|отправил|искал|сходил|попробовал|выбрал|описал|понял|узнал|предлагал|стал|поставил|доверил|пропустил|предпочёл|начинал|заказал|заменил|ответил|чувствовал|хотел|стеснялся|заметил|пробовал|считал|согласился|жалел|понимал|решился|встретил|нажал|мог|готов|должен|сам|первым|уверен|прав|свободен|согласен)(?![а-яё]))[^.!?]*/i
const masculineTargetAgreement = /\{\{other\.nom\}\}(?=[^.!?]{0,22}(?:узнал|выглядел|спрашивал|показался|замечал|согласен|должен|сам|первым|привлекательным|притягательным|сексуальным|готов|мог|стал|понял|выбрал|решил)(?![а-яё]))[^.!?]*/i

const implicitCurrentPlayerGender = [
  /(?<![а-яё])сам(?=\s+(?:не\s+)?(?:считаешь|предпочитаешь|хотел|замри|наблюдаешь))/i,
  /(?<![а-яё])(?:готов|согласен)(?=\s+(?:обсуждать|выполнить|попробовать))/i,
  /(?<![а-яё])заметил(?![а-яё])/i,
  /остановись первым(?![а-яё])/i,
]

function normalize(text: string) {
  return text.toLowerCase().replace(/\{\{[^}]+\}\}/g, 'x').replace(/[^а-яёa-z0-9]+/gi, ' ').trim()
}

function stripQuotedSpeech(text: string) {
  return text
    .replace(/«[^»]*»/g, '')
    .replace(/“[^”]*”/g, '')
    .replace(/"[^"]*"/g, '')
}

function hasPerspectiveLeak(text: string) {
  return firstPersonOpponentVoice.test(stripQuotedSpeech(text))
}

function stripGenderVariants(text: string) {
  return text.replace(/\{\{(?:self|other)\.g:[^|}]*\|[^}]*\}\}/g, '')
}

function hasCurrentPlayerGenderLeak(text: string) {
  return masculineCurrentPlayerVoice.test(stripGenderVariants(text))
}

function hasTargetGenderLeak(text: string) {
  return masculineTargetAgreement.test(stripGenderVariants(text))
}

const dareSpeechSelfChecks = [
  { text: 'Расскажи историю за двадцать секунд.', bad: true },
  { text: 'Назови три причины.', bad: true },
  { text: 'Скажи группе один пример такого сообщения своими словами.', bad: true },
  { text: 'Выбери игрока и объясни свой выбор.', bad: true },
  { text: 'Выбери {{other.acc}} и назови одну деталь одежды.', bad: true },
  { text: 'Выбери жест и ответь тем же жестом прямо сейчас.', bad: false },
  { text: 'Выбери игрока и удерживай взгляд пятнадцать секунд.', bad: false },
  { text: 'Станцуй двадцать секунд.', bad: false },
]
for (const fixture of dareSpeechSelfChecks) {
  const actual = speechOnlyDare.some((pattern) => pattern.test(fixture.text.replace(/\{\{[^}]+\}\}/g, 'PLAYER')))
  if (actual !== fixture.bad) fail(`self-check Dare speech mismatch: ${fixture.text}`)
}

const perspectiveSelfChecks = [
  { text: 'Что я делаю, что для тебя выглядит как флирт?', bad: true },
  { text: 'Что тебе приятнее во время поцелуя: когда я смотрю на тебя или закрываю глаза?', bad: true },
  { text: 'Поцелуй меня в шею.', bad: true },
  { text: 'Что {{other.nom}} делает с другими людьми, что тебе кажется флиртом?', bad: false },
  { text: 'Поцелуй {{other.acc}} в шею.', bad: false },
  { text: 'Скажи {{other.dat}}: «Я хочу повторить наш первый поцелуй».', bad: false },
]
for (const fixture of perspectiveSelfChecks) {
  if (hasPerspectiveLeak(fixture.text) !== fixture.bad) {
    fail(`self-check perspective mismatch: ${fixture.text}`)
  }
}

const genderSelfChecks = [
  { text: 'Какой фильм ты выбрал бы для свидания?', currentBad: true, targetBad: false },
  { text: 'Какой фильм хотелось бы выбрать для свидания?', currentBad: false, targetBad: false },
  { text: '{{other.nom}} согласен на короткий поцелуй.', currentBad: false, targetBad: true },
  { text: '{{other.nom}} {{other.g:согласен|согласна}} на короткий поцелуй.', currentBad: false, targetBad: false },
]
for (const fixture of genderSelfChecks) {
  if (hasCurrentPlayerGenderLeak(fixture.text) !== fixture.currentBad) {
    fail(`self-check current-player gender mismatch: ${fixture.text}`)
  }
  if (hasTargetGenderLeak(fixture.text) !== fixture.targetBad) {
    fail(`self-check target gender mismatch: ${fixture.text}`)
  }
}

if (cards.length !== 1440) fail(`v0.8 должен содержать ровно 1440 карточек, найдено ${cards.length}`)

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
  if (!card.sourceRef || !(card.sourceRef in CARD_SOURCE_REGISTRY)) fail(`${card.id}: отсутствует или неизвестен sourceRef`)
  if (card.sourceRef === 'original-editorial') fail(`${card.id}: v0.8 допускает только внешний конкурентный sourceRef`)
  if (hasPerspectiveLeak(card.text)) fail(`${card.id}: сломана перспектива игрока (opponent-voice first person): ${card.text}`)
  if (hasCurrentPlayerGenderLeak(card.text)) fail(`${card.id}: мужской род захардкожен для текущего игрока: ${card.text}`)
  if (hasTargetGenderLeak(card.text)) fail(`${card.id}: мужской род захардкожен для динамического target: ${card.text}`)
  if (implicitCurrentPlayerGender.some((pattern) => pattern.test(stripGenderVariants(stripQuotedSpeech(card.text))))) fail(`${card.id}: неявный мужской род захардкожен для текущего игрока: ${card.text}`)
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
  if (card.type === 'dare' && speechOnlyDare.some((pattern) => pattern.test(card.text.replace(/\{\{[^}]+\}\}/g, 'PLAYER')))) {
    fail(`${card.id}: Dare сводится к разговору вместо игрового действия: ${card.text}`)
  }
  if (card.type === 'truth' && !card.text.trim().endsWith('?')) fail(`${card.id}: Truth должен быть явным вопросом: ${card.text}`)
  const textKey = normalize(card.text)
  const duplicate = texts.get(textKey)
  if (duplicate) fail(`точный дубль текста: ${duplicate} / ${card.id}`)
  texts.set(textKey, card.id)

  const targetIndex = card.requiresTarget === false || card.pairing === 'none' ? null : 1
  const rendered = renderCardText(card, [male, female], 0, targetIndex, () => 0.5)
  if (/\{\{[^}]+\}\}/.test(rendered)) fail(`${card.id}: после renderCardText остался шаблон: ${rendered}`)
}

const coverageSummary: Record<string, { count: number; sourceFamilies: string[]; twoPlayerEligible?: number }> = {}

for (const scenario of scenarios) {
  for (const heat of heats) {
    for (const type of types) {
      const bucket = cards.filter((card) => card.scenario === scenario && card.heat === heat && card.type === type)
      const expected = expectedBucketCounts[scenario][heat]
      if (bucket.length !== expected) fail(`${scenario}/${heat}/${type}: нужно ровно ${expected}, найдено ${bucket.length}`)
      const coreCounts = new Map<string, number>()
      const interactions = new Set<string>()
      const themes = new Set<string>()
      const sourceFamilies = new Set<string>()
      for (const card of bucket) {
        coreCounts.set(card.coreIdea ?? card.theme, (coreCounts.get(card.coreIdea ?? card.theme) ?? 0) + 1)
        interactions.add(gameplayInteractionKey(card))
        themes.add(card.theme)
        if (card.sourceRef && CARD_SOURCE_REGISTRY[card.sourceRef]) sourceFamilies.add(CARD_SOURCE_REGISTRY[card.sourceRef].family)
      }
      if (Math.max(0, ...coreCounts.values()) > 5) fail(`${scenario}/${heat}/${type}: одна coreIdea повторяется чаще пяти раз`)
      if (interactions.size < 4) fail(`${scenario}/${heat}/${type}: мало разных interaction (${interactions.size})`)
      if (themes.size < Math.min(10, Math.max(1, Math.floor(expected / 6)))) fail(`${scenario}/${heat}/${type}: мало разных тем (${themes.size})`)
      if (bucket.length && sourceFamilies.size < 2) fail(`${scenario}/${heat}/${type}: весь бакет опирается меньше чем на две source family`)

      const key = `${scenario}/${heat}/${type}`
      coverageSummary[key] = { count: bucket.length, sourceFamilies: [...sourceFamilies].sort() }
      if (scenario === 'afterdark') {
        const twoPlayer = bucket.filter((card) => !card.minPlayers || card.minPlayers <= 2)
        const minimum = Math.ceil(expected * 0.7)
        coverageSummary[key].twoPlayerEligible = twoPlayer.length
        if (twoPlayer.length < minimum) fail(`afterdark/${heat}/${type}: для двух игроков доступно только ${twoPlayer.length}/${expected}, нужно минимум ${minimum}`)
      }
    }
  }
}

const sexHardDares = cards.filter((card) => card.scenario === 'sex' && card.heat === 'hard' && card.type === 'dare')
const sexualScenes = sexHardDares.filter((card) => card.sexualAction && card.scene?.endCondition)
if (sexHardDares.length === 80 && sexualScenes.length < 20) fail(`Sex/Hard: нужно минимум 20 ограниченных sexualAction-сцен, найдено ${sexualScenes.length}`)

console.log('v0.8 bucket/source coverage:', JSON.stringify(coverageSummary, null, 2))
if (failed) process.exit(1)
ok(`${cards.length} карточек прошли структурный аудит v0.8`)
ok('редакторский аудит v0.8 пройден')
