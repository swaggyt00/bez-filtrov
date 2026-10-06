import { maybeCreateCautionEvent } from './director'
import type { BoundaryTag, DirectorEvent, DirectorState } from './types'

function normalizedRandom(random: () => number) {
  const value = random()
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(0.999999999999, value))
}

function choose<T>(items: T[], random: () => number): T | null {
  if (!items.length) return null
  return items[Math.floor(normalizedRandom(random) * items.length)] ?? items[0]
}

export function chooseEventForTurn(
  state: DirectorState,
  actorIndex: number,
  random: () => number = Math.random,
): DirectorEvent | null {
  const caution = maybeCreateCautionEvent(state, actorIndex)
  if (caution) return caution
  if (state.turnsPlayed < 4 || state.turnsPlayed - state.lastEventTurn < 3) return null

  const probability = Math.min(0.28, 0.07 + state.tension / 420)
  if (normalizedRandom(random) >= probability) return null

  const events: DirectorEvent[] = [
    {
      id: 'partner-chooses-risk',
      family: 'control',
      title: 'ПЕРЕХВАТ',
      description: 'В этот ход уровень риска за игрока выбирает партнёр.',
      targetPlayerIndex: actorIndex,
      partnerChoosesRisk: true,
      remainingTurns: 1,
    },
    {
      id: 'forced-modifier',
      family: 'constraint',
      title: 'УСЛОВИЕ',
      description: 'Следующая карта обязательно получит случайное дополнительное условие.',
      targetPlayerIndex: actorIndex,
      modifierCount: 1,
      remainingTurns: 1,
    },
    {
      id: 'double-stake',
      family: 'wildcard',
      title: 'ДВОЙНАЯ СТАВКА',
      description: '🔥🔥 получает два условия. 🔥🔥🔥 — без гарантированных условий.',
      targetPlayerIndex: actorIndex,
      remainingTurns: 1,
    },
  ]

  if (state.currentPosition) {
    events.push({
      id: 'continue-scene',
      family: 'continuation',
      title: 'НЕ СБРАСЫВАЙТЕ СЦЕНУ',
      description: 'Следующая карта должна продолжить текущее положение и уже начатую цепочку.',
      targetPlayerIndex: actorIndex,
      forcedChain: state.chainFamily ?? undefined,
      remainingTurns: 1,
    })
  }

  if (state.scenario === 'sex' && state.sessionStage >= 2 && state.mutuallyAllowedBoundaries.length) {
    const tag = choose(state.mutuallyAllowedBoundaries, random) as BoundaryTag | null
    if (tag) {
      events.push({
        id: `fetish-${tag}`,
        family: 'fetish',
        title: 'ФЕТИШ-ВЕТКА',
        description: 'Следующие ходы Director попробует развить одну из взаимно разрешённых тем.',
        targetPlayerIndex: actorIndex,
        forcedChain: 'fetish',
        forcedBoundary: tag,
        remainingTurns: 1,
      })
    }
  }

  return choose(events, random)
}
