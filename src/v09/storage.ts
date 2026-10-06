import type { PersistedV09Game, V09GameSettings } from './types'

const GAME_KEY = 'bez-filtrov:game:v9'
const SETTINGS_KEY = 'bez-filtrov:settings:v9'

export function loadV09Game(): PersistedV09Game | null {
  try {
    const raw = localStorage.getItem(GAME_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedV09Game
    if (!parsed?.settings?.players?.length || !parsed.director) return null
    return parsed
  } catch {
    return null
  }
}

export function saveV09Game(game: PersistedV09Game) {
  localStorage.setItem(GAME_KEY, JSON.stringify(game))
}

export function clearV09Game() {
  localStorage.removeItem(GAME_KEY)
}

export function loadV09Settings(): V09GameSettings | null {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as V09GameSettings
    if (!parsed?.players?.length || !parsed.scenario) return null
    return parsed
  } catch {
    return null
  }
}

export function saveV09Settings(settings: V09GameSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}
