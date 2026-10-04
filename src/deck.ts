import type { CardType, GameCard, GameSettings, Player, PlayerGender } from './types'

type NameCase = 'nom' | 'gen' | 'dat' | 'acc' | 'ins' | 'prep'

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
    const endings: Record<Exclude<NameCase, 'nom'>, string> = {
      gen: 'ии', dat: 'ии', acc: 'ию', ins: 'ией', prep: 'ии',
    }
    return stem + endings[grammaticalCase]
  }
  if (lower.endsWith('а')) {
    const stem = name.slice(0, -1)
    const softGen = /[гкхжчшщц]$/i.test(stem)
    const endings: Record<Exclude<NameCase, 'nom'>, string> = {
      gen: softGen ? 'и' : 'ы', dat: 'е', acc: 'у', ins: 'ой', prep: 'е',
    }
    return stem + endings[grammaticalCase]
  }
  if (lower.endsWith('я')) {
    const stem = name.slice(0, -1)
    const endings: Record<Exclude<NameCase, 'nom'>, string> = {
      gen: 'и', dat: 'е', acc: 'ю', ins: 'ей', prep: 'е',
    }
    return stem + endings[grammaticalCase]
  }
  if (lower.endsWith('ь')) {
    const stem = name.slice(0, -1)
    const endings: Record<Exclude<NameCase, 'nom'>, string> = {
      gen: 'и', dat: 'и', acc: 'ь', ins: 'ью', prep: 'и',
    }
    return stem + endings[grammaticalCase]
  }
  return name
}

function maleName(name: string, grammaticalCase: NameCase) {
  const lower = name.toLowerCase()
  if (grammaticalCase === 'nom') return name
  if (lower.endsWith('ий')) {
    const stem = name.slice(0, -2)
    const endings: Record<Exclude<NameCase, 'nom'>, string> = {
      gen: 'ия', dat: 'ию', acc: 'ия', ins: 'ием', prep: 'ии',
    }
    return stem + endings[grammaticalCase]
  }
  if (lower.endsWith('а')) return femaleName(name, grammaticalCase)
  if (lower.endsWith('я')) {
    const stem = name.slice(0, -1)
    const endings: Record<Exclude<NameCase, 'nom'>, string> = {
      gen: 'и', dat: 'е', acc: 'ю', ins: 'ёй', prep: 'е',
    }
    return stem + endings[grammaticalCase]
  }
  if (lower.endsWith('й')) {
    const stem = name.slice(0, -1)
    const endings: Record<Exclude<NameCase, 'nom'>, string> = {
      gen: 'я', dat: 'ю', acc: 'я', ins: 'ем', prep: 'е',
    }
    return stem + endings[grammaticalCase]
  }
  if (lower.endsWith('ь')) {
    const stem = name.slice(0, -1)
    const endings: Record<Exclude<NameCase, 'nom'>, string> = {
      gen: 'я', dat: 'ю', acc: 'я', ins: 'ем', prep: 'е',
    }
    return stem + endings[grammaticalCase]
  }
  if (/[бвгджзклмнпрстфхцчшщ]$/i.test(lower)) {
    const endings: Record<Exclude<NameCase, 'nom'>, string> = {
      gen: 'а', dat: 'у', acc: 'а', ins: 'ом', prep: 'е',
    }
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

export function chooseTargetIndex(players: Player[], currentPlayerIndex: number) {
  const candidates = players.map((_, index) => index).filter((index) => index !== currentPlayerIndex)
  return candidates[Math.floor(Math.random() * candidates.length)] ?? currentPlayerIndex
}

export function hydrateCardText(text: string, players: Player[], currentPlayerIndex: number, targetIndex: number) {
  const self = players[currentPlayerIndex]
  const other = players[targetIndex] ?? players.find((_, index) => index !== currentPlayerIndex) ?? self
  let result = text

  for (const grammaticalCase of ['nom', 'gen', 'dat', 'acc', 'ins', 'prep'] as NameCase[]) {
    result = result.replaceAll(`{{self.${grammaticalCase}}}`, declineName(self.name, self.gender, grammaticalCase))
    result = result.replaceAll(`{{other.${grammaticalCase}}}`, declineName(other.name, other.gender, grammaticalCase))
  }

  result = result.replace(/\{\{self\.g:([^|}]*)\|([^}]*)\}\}/g, (_, male, female) => genderVariant(self, male, female))
  result = result.replace(/\{\{other\.g:([^|}]*)\|([^}]*)\}\}/g, (_, male, female) => genderVariant(other, male, female))
  return result
}

export function availableCards(cards: GameCard[], settings: GameSettings, type?: CardType) {
  return cards.filter((card) => {
    if (type && card.type !== type) return false
    if (card.scenario !== settings.scenario) return false
    if (card.heat !== settings.heat) return false
    if (!settings.alcoholCards && card.alcohol) return false
    return true
  })
}

export function pickCard(cards: GameCard[], settings: GameSettings, type: CardType, usedCardIds: string[]) {
  const bucket = availableCards(cards, settings, type)
  const used = new Set(usedCardIds)
  const fresh = bucket.filter((card) => !used.has(card.id))
  const pool = fresh.length ? fresh : bucket
  if (!pool.length) return { card: undefined, recycled: false }
  const card = pool[Math.floor(Math.random() * pool.length)]
  return { card, recycled: !fresh.length }
}
