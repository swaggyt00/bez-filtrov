import type { GameCard, SavedSession } from './types'

const SESSIONS_KEY = 'truth-or-dare-18:sessions:v2'
const CUSTOM_CARDS_KEY = 'truth-or-dare-18:custom-cards:v2'

export function loadSessions(): SavedSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as SavedSession[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveSessions(sessions: SavedSession[]) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions.slice(0, 12)))
}

export function loadCustomCards(): GameCard[] {
  try {
    const raw = localStorage.getItem(CUSTOM_CARDS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as GameCard[]
    return Array.isArray(parsed) ? parsed.filter((card) => card.custom) : []
  } catch {
    return []
  }
}

export function saveCustomCards(cards: GameCard[]) {
  localStorage.setItem(CUSTOM_CARDS_KEY, JSON.stringify(cards.filter((card) => card.custom)))
}
