import type { GameSettings, PersistedGame } from './types'

const GAME_KEY = 'bez-filtrov:game:v3'
const SETTINGS_KEY = 'bez-filtrov:settings:v3'

export function loadGame(): PersistedGame | null {
  try {
    const raw = localStorage.getItem(GAME_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedGame
    return parsed?.settings?.players?.length >= 2 ? parsed : null
  } catch {
    return null
  }
}

export function saveGame(game: PersistedGame) {
  localStorage.setItem(GAME_KEY, JSON.stringify(game))
}

export function clearGame() {
  localStorage.removeItem(GAME_KEY)
}

export function loadSettings(): GameSettings | null {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    return raw ? JSON.parse(raw) as GameSettings : null
  } catch {
    return null
  }
}

export function saveSettings(settings: GameSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}
