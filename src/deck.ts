import type {
  CardInteraction,
  CardType,
  DurationValue,
  GameCard,
  GameSettings,
  PairingPreference,
  Player,
  PlayerGender,
  Scenario,
} from './types'

type NameCase = 'nom' | 'gen' | 'dat' | 'acc' | 'ins' | 'prep'
type ObliqueCase = Exclude<NameCase, 'nom'>

const irregularMaleNames: Record<string, Record<ObliqueCase, string>> = {
  павел: { gen: 'павла', dat: 'павлу', acc: 'павла', ins: 'павлом', prep: 'павле' },
  лев: { gen: 'льва', dat: 'льву', acc: 'льва', ins: 'львом', prep: 'льве' },
  петр: { gen: 'петра', dat: 'петру', acc: 'петра', ins: 'петром', prep: 'петре' },
}

const durationPools: Record<GameCard['heat'], DurationValue[]> = {
  light: ['1 круг', '1 круг', '2 круга'],
  hot: ['1 круг', '2 круга', '2 круга', '3 круга'],
  hard: ['2 круга', '2 круга', '3 круга', '3 круга', 'до конца игры'],
}

function preserveCase(original: string, value: string) {
  if (!original) return value
  return original[0] === original[0].toUpperCase()
    ? value.charAt(0).toUpperCase() + value.slice(1)
    : value
}

function femaleName(name: string, grammaticalCase: NameCase) {
  const lower = name.toLowerCase()
  if (grammaticalCase === 'nom') return name
  if (lower.endsWith('ия')) {
    const stem = name.slice(0, -2)
    const endings: Record<ObliqueCase, string> = { gen: 'ии', dat: 'ии', acc: 'ию', ins: 'ией', prep: 'ии' }
    return stem + endings[grammaticalCase]
  }
  if (lower.endsWith('а')) {
    const stem = name.slice(0, -1)
    const softGen = /[гкхжчшщц]$/i.test(stem)
    const endings: Record<ObliqueCase, string> = { gen: softGen ? 'и' : 'ы', dat: 'е', acc: 'у', ins: 'ой', prep: 'е' }
    return stem + endings[grammaticalCase]
  }
  if (lower.endsWith('я')) {
    const stem = name.slice(0, -1)
    const endings: Record<ObliqueCase, string> = { gen: 'и', dat: 'е', acc: 'ю', ins: 'ей', prep: 'е' }
    return stem + endings[grammaticalCase]
  }
  if (lower.endsWith('ь')) {
    const stem = name.slice(0, -1)
    const endings: Record<ObliqueCase, string> = { gen: 'и', dat: 'и', acc: 'ь', ins: 'ью', prep: 'и' }
    return stem + endings[grammaticalCase]
  }
  return name
}

function maleName(name: string, grammaticalCase: NameCase) {
  const lower = name.toLowerCase()
  if (grammaticalCase === 'nom') return name
  const irregular = irregularMaleNames[lower.replaceAll('ё', 'е')]
  if (irregular) return irregular[grammaticalCase]
  if (lower.endsWith('ий')) {
    const stem = name.slice(0, -2)
    const endings: Record<ObliqueCase, string> = { gen: 'ия', dat: 'ию', acc: 'ия', ins: 'ием', prep: 'ии' }
    return stem + endings[grammaticalCase]
  }
  if (lower.endsWith('ей')) {
    const stem = name.slice(0, -2)
    const endings: Record<ObliqueCase, string> = { gen: 'ея', dat: 'ею', acc: 'ея', ins: 'еем', prep: 'ее' }
    return stem + endings[grammaticalCase]
  }
  if (lower.endsWith('а')) return femaleName(name, grammaticalCase)
  if (lower.endsWith('я')) {
    const stem = name.slice(0, -1)
    const endings: Record<ObliqueCase, string> = { gen: 'и', dat: 'е', acc: 'ю', ins: 'ёй', prep: 'е' }
    return stem + endings[grammaticalCase]
  }
  if (lower.endsWith('й') || lower.endsWith('ь')) {
    const stem = name.slice(0, -1)
    const endings: Record<ObliqueCase, string> = { gen: 'я', dat: 'ю', acc: 'я', ins: 'ем', prep: 'е' }
    return stem + endings[grammaticalCase]
  }
  if (/[бвгджзклмнпрстфхцчшщ]$/i.test(lower)) {
    const endings: Record<ObliqueCase, string> = { gen: 'а', dat: 'у', acc: 'а', ins: 'ом', prep: 'е' }
    return name + endings[grammaticalCase]
  }
  return name
}

export function declineName(name: string, gender: PlayerGender, grammaticalCase: NameCase) {
  const trimmed = name.trim()
  if (!trimmed || !/[а-яё]$/i.test(trimmed)) return trimmed
  const declined = gender === 'female' ? femaleName(trimmed, grammaticalCase) : maleName(trimmed, grammaticalCase)
  return preserveCase(trimmed, declined)
}

function genderVariant(player: Player, male: string, female: string) {
  return player.gender === 'female' ? female : male
}

export function hydrateCardText(text: string, players: Player[], currentPlayerIndex: number, targetIndex: number | null) {
  const self = players[currentPlayerIndex]
  const other = targetIndex === null
    ? players.find((_, index) => index !== currentPlayerIndex) ?? self
    : players[targetIndex] ?? players.find((_, index) => index !== currentPlayerIndex) ?? self
  let result = text

  for (const grammaticalCase of ['nom', 'gen', 'dat', 'acc', 'ins', 'prep'] as NameCase[]) {
    result = result.replaceAll(`{{self.${grammaticalCase}}}`, declineName(self.name, self.gender, grammaticalCase))
    result = result.replaceAll(`{{other.${grammaticalCase}}}`, declineName(other.name, other.gender, grammaticalCase))
  }

  result = result.replace(/\{\{self\.g:([^|}]*)\|([^}]*)\}\}/g, (_, male, female) => genderVariant(self, male, female))
  result = result.replace(/\{\{other\.g:([^|}]*)\|([^}]*)\}\}/g, (_, male, female) => genderVariant(other, male, female))
  return result
}

export function resolveCardDuration(card: GameCard, random: () => number = Math.random): DurationValue | null {
  if (card.duration !== 'temporary') return null
  const pool = durationPools[card.heat]
  const value = random()
  const normalized = Number.isFinite(value) ? Math.max(0, Math.min(0.999999999999, value)) : 0
  return pool[Math.floor(normalized * pool.length)] ?? pool[0]
}

export function renderCardText(
  card: GameCard,
  players: Player[],
  currentPlayerIndex: number,
  targetIndex: number | null,
  random: () => number = Math.random,
) {
  let result = hydrateCardText(card.text, players, currentPlayerIndex, targetIndex)
  if (card.duration === 'temporary') {
    const duration = resolveCardDuration(card, random)
    if (duration) result = result.replaceAll('{{duration}}', duration)
  }
  return result
}

function genderAllowed(allowed: PlayerGender[] | undefined, gender: PlayerGender) {
  return !allowed?.length || allowed.includes(gender)
}

function preferenceAllows(preference: PairingPreference | undefined, gender: PlayerGender) {
  const value = preference ?? 'any'
  if (value === 'any') return true
  if (value === 'none') return false
  return value === gender
}

export function eligibleTargetIndices(card: GameCard, players: Player[], currentPlayerIndex: number) {
  if (card.requiresTarget === false || card.pairing === 'none') return []

  const actor = players[currentPlayerIndex]
  const pairing = card.pairing ?? 'any'
  return players
    .map((player, index) => ({ player, index }))
    .filter(({ index }) => index !== currentPlayerIndex)
    .filter(({ player }) => genderAllowed(card.targetGenders, player.gender))
    .filter(({ player }) => {
      if (pairing !== 'mutual-close') return true
      return preferenceAllows(actor.pairingPreference, player.gender)
        && preferenceAllows(player.pairingPreference, actor.gender)
    })
    .map(({ index }) => index)
}

export function validateScenarioPlayers(scenario: Scenario, players: Player[]) {
  if (scenario === 'couple' || scenario === 'sex') {
    if (players.length !== 2) return { ok: false, message: 'Для этого режима нужны ровно два игрока.' }
    const genders = new Set(players.map((player) => player.gender))
    if (!(genders.has('male') && genders.has('female'))) {
      return { ok: false, message: 'В этой версии режим рассчитан на пару мужчина + женщина.' }
    }
    return { ok: true, message: '' }
  }

  if (scenario === 'party') {
    if (players.length < 3 || players.length > 6) {
      return { ok: false, message: 'Для режима «Компания» нужно от 3 до 6 игроков.' }
    }
    return { ok: true, message: '' }
  }

  if (players.length < 2 || players.length > 6) {
    return { ok: false, message: 'Для режима «После полуночи» нужно от 2 до 6 игроков.' }
  }
  return { ok: true, message: '' }
}

export function availableCards(cards: GameCard[], settings: GameSettings, type?: CardType) {
  return cards.filter((card) => {
    if (type && card.type !== type) return false
    if (card.scenario !== settings.scenario) return false
    if (card.heat !== settings.heat) return false
    if (card.minPlayers && card.minPlayers > settings.players.length) return false
    if ((settings.scenario === 'couple' || settings.scenario === 'sex') && card.alcohol) return false
    return true
  })
}

function actorCanUse(card: GameCard, player: Player) {
  return genderAllowed(card.actorGenders, player.gender)
}

function cardHasEligibleTarget(card: GameCard, players: Player[], currentPlayerIndex: number) {
  if (card.requiresTarget === false || card.pairing === 'none') return true
  return eligibleTargetIndices(card, players, currentPlayerIndex).length > 0
}

function semanticKey(card: GameCard) {
  return card.coreIdea || card.theme
}

export function gameplayInteractionKey(card: GameCard): CardInteraction | string {
  if (card.type !== 'dare') return card.interaction || card.mechanic

  const text = card.text.toLowerCase()
  if (/(телефон|заметк|экран|галере|соцсет|эмодзи|календар|карт[аеуы]|сообщени)/i.test(text)) return 'device'
  if (/(поцел|массаж|прикос|обним|ласк|колен|ладон|запяст|касани|целуй)/i.test(text)) return 'physical'
  if (/(стоп[- ]?(?:жест|сигнал|слово)|контрол|команд|ведущ|ведом|дистанц|границ|шкал[аеуы]|темп|давлени)/i.test(text)) return 'control'
  if (/(танц|поз[аеуы]|изобраз|сыграй|сыграйте|разыграй|сцен[аеуы]|рол[ьи]|парод|реклам|напой|подиум|стоп-кадр)/i.test(text)) return 'performance'
  if (/(группа|остальные|все одновременно|по кругу|игрок справа|игрок слева)/i.test(text)) return 'group-reaction'
  if (/(выбери игрока|согласн(?:ого|ый) игрок|\{\{other\.)/i.test(text)) return 'partner-choice'
  return card.interaction || card.mechanic
}

function interactionKey(card: GameCard): CardInteraction | string {
  return gameplayInteractionKey(card)
}

export function pickCardForTurn(
  cards: GameCard[],
  settings: GameSettings,
  type: CardType,
  usedCardIds: string[],
  currentPlayerIndex: number,
) {
  const actor = settings.players[currentPlayerIndex]
  const bucket = availableCards(cards, settings, type)
    .filter((card) => actorCanUse(card, actor))
    .filter((card) => cardHasEligibleTarget(card, settings.players, currentPlayerIndex))

  const used = new Set(usedCardIds)
  const fresh = bucket.filter((card) => !used.has(card.id))
  const basePool = fresh.length ? fresh : bucket
  if (!basePool.length) return { card: undefined, targetIndex: null, recycled: false }

  const byId = new Map(cards.map((card) => [card.id, card]))
  const recent = usedCardIds.slice(-12).map((id) => byId.get(id)).filter((card): card is GameCard => Boolean(card))
  const recentCoreIdeas = new Set(recent.slice(-8).map(semanticKey))
  const recentInteractions = new Set(recent.slice(-3).map(interactionKey))

  const noCoreRepeat = basePool.filter((card) => !recentCoreIdeas.has(semanticKey(card)))
  const corePool = noCoreRepeat.length ? noCoreRepeat : basePool
  const noInteractionRepeat = corePool.filter((card) => !recentInteractions.has(interactionKey(card)))
  const pool = noInteractionRepeat.length ? noInteractionRepeat : corePool

  const card = pool[Math.floor(Math.random() * pool.length)]
  if (!card) return { card: undefined, targetIndex: null, recycled: !fresh.length }
  const targets = eligibleTargetIndices(card, settings.players, currentPlayerIndex)
  const targetIndex = targets.length ? targets[Math.floor(Math.random() * targets.length)] : null
  return { card, targetIndex, recycled: !fresh.length }
}

// Backward-compatible wrapper while older callers migrate.
export function pickCard(cards: GameCard[], settings: GameSettings, type: CardType, usedCardIds: string[]) {
  const bucket = availableCards(cards, settings, type)
  const used = new Set(usedCardIds)
  const fresh = bucket.filter((card) => !used.has(card.id))
  const pool = fresh.length ? fresh : bucket
  const card = pool[Math.floor(Math.random() * pool.length)]
  return { card, recycled: Boolean(card) && !fresh.length }
}

export function chooseTargetIndex(players: Player[], currentPlayerIndex: number) {
  const candidates = players.map((_, index) => index).filter((index) => index !== currentPlayerIndex)
  return candidates[Math.floor(Math.random() * candidates.length)] ?? currentPlayerIndex
}
