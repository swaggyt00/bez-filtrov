import type { Category, GameMode } from './types'

export interface ModePreset {
  label: string
  short: string
  description: string
  categories: Category[]
  defaultIntensity: number
  alcoholRule?: boolean
}

export const modePresets: Record<GameMode, ModePreset> = {
  classic: {
    label: 'Классика',
    short: 'Баланс',
    description: 'Смешанная колода: отношения, фантазии, прошлое и хаос.',
    categories: ['relations', 'sex', 'fantasy', 'jealousy', 'past', 'chaos'],
    defaultIntensity: 7,
  },
  couple: {
    label: 'Для пары',
    short: 'Пара',
    description: 'Больше вопросов и заданий, которые имеют смысл в отношениях.',
    categories: ['relations', 'sex', 'fantasy', 'jealousy', 'past'],
    defaultIntensity: 8,
  },
  hardTruth: {
    label: 'Каверзно',
    short: 'Правда',
    description: 'Больше неудобных тем, признаний, прошлого и ревности.',
    categories: ['relations', 'jealousy', 'past', 'fantasy'],
    defaultIntensity: 9,
  },
  intimate: {
    label: 'Интим',
    short: '18+',
    description: 'Фантазии, сексуальные предпочтения и откровенные разговоры.',
    categories: ['sex', 'fantasy', 'relations'],
    defaultIntensity: 9,
  },
  relations: {
    label: 'Про отношения',
    short: 'Глубже',
    description: 'Доверие, ожидания, будущее, прошлое и спорные темы.',
    categories: ['relations', 'past', 'jealousy'],
    defaultIntensity: 8,
  },
  party: {
    label: 'Вечеринка',
    short: 'Party',
    description: 'Больше хаоса и алкогольной тематики без опасных челленджей.',
    categories: ['chaos', 'alcohol', 'relations', 'fantasy'],
    defaultIntensity: 7,
    alcoholRule: true,
  },
}
