import type { GameSettings, Heat, PersistedGame } from './types'

const GAME_KEY = 'bez-filtrov:game:v5'
const SETTINGS_KEY = 'bez-filtrov:settings:v5'
const OLD_SETTINGS_KEYS = ['bez-filtrov:settings:v4', 'bez-filtrov:settings:v3']

function normalizeHeat(value: unknown): Heat {
  if (value === 'light' || value === 'hot' || value === 'hard') return value
  if (value === 'extreme' || value === 'madness') return 'hard'
  return 'hot'
}

function normalizeSettings(value: unknown): GameSettings | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Partial<GameSettings> & { heat?: unknown }
  if (!Array.isArray(raw.players) || raw.players.length < 2) return null
  if (!['couple', 'sex', 'party', 'afterdark'].includes(String(raw.scenario))) return null

  return {
    players: raw.players,
    scenario: raw.scenario as GameSettings['scenario'],
    heat: normalizeHeat(raw.heat),
    alcoholCards: Boolean(raw.alcoholCards),
    soundEnabled: raw.soundEnabled !== false,
  }
}

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
    const current = localStorage.getItem(SETTINGS_KEY)
    if (current) return normalizeSettings(JSON.parse(current))

    for (const key of OLD_SETTINGS_KEYS) {
      const old = localStorage.getItem(key)
      if (!old) continue
      const migrated = normalizeSettings(JSON.parse(old))
      if (migrated) {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(migrated))
        return migrated
      }
    }
    return null
  } catch {
    return null
  }
}

export function saveSettings(settings: GameSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}
