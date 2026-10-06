import type { GameSettings, Heat, PairingPreference, PersistedGame, Player } from './types'

const GAME_KEY = 'bez-filtrov:game:v8'
const SETTINGS_KEY = 'bez-filtrov:settings:v6'
const OLD_SETTINGS_KEYS = ['bez-filtrov:settings:v5', 'bez-filtrov:settings:v4', 'bez-filtrov:settings:v3']

function normalizeHeat(value: unknown): Heat {
  if (value === 'light' || value === 'hot' || value === 'hard') return value
  if (value === 'extreme' || value === 'madness') return 'hard'
  return 'hot'
}

function normalizePreference(value: unknown): PairingPreference {
  if (value === 'male' || value === 'female' || value === 'any' || value === 'none') return value
  return 'any'
}

function normalizePlayers(value: unknown): Player[] | null {
  if (!Array.isArray(value) || value.length < 2) return null
  const players: Array<Player | null> = value
    .filter((player) => player && typeof player === 'object')
    .map((player) => {
      const raw = player as Partial<Player>
      if (raw.gender !== 'male' && raw.gender !== 'female') return null
      const normalized: Player = {
        name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : 'Игрок',
        gender: raw.gender,
        pairingPreference: normalizePreference(raw.pairingPreference),
      }
      return normalized
    })
  const validPlayers = players.filter((player): player is Player => player !== null)
  return validPlayers.length >= 2 ? validPlayers : null
}

function normalizeSettings(value: unknown): GameSettings | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Partial<GameSettings> & { heat?: unknown }
  const players = normalizePlayers(raw.players)
  if (!players) return null
  if (!['couple', 'sex', 'party', 'afterdark'].includes(String(raw.scenario))) return null

  return {
    players,
    scenario: raw.scenario as GameSettings['scenario'],
    heat: normalizeHeat(raw.heat),
  }
}

export function loadGame(): PersistedGame | null {
  try {
    const raw = localStorage.getItem(GAME_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedGame
    const settings = normalizeSettings(parsed?.settings)
    if (!settings) return null
    return { ...parsed, settings }
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
