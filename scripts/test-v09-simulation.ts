const assert = {
  ok(value: unknown, message = 'assert.ok failed') {
    if (!value) throw new Error(message)
  },
}

import { cards } from '../src/data/cards'
import { eligibleTargetIndices } from '../src/deck'
import { adaptLegacyDeck } from '../src/v09/legacy-adapter'
import { sexNativeCards } from '../src/v09/sex-native'
import { completeTurn, createDirectorState, pickDirectorCard, tickEffects } from '../src/v09/director'
import type { BoundaryTag, RiskLevel } from '../src/v09/types'
import type { Player, Scenario } from '../src/types'

const deck = [...adaptLegacyDeck(cards), ...sexNativeCards]
const sourceById = new Map(cards.map((card) => [card.id, card]))
const allBoundaries: BoundaryTag[] = [
  'manual', 'oral', 'penetration', 'spanking', 'bondage', 'dom-sub',
  'edging', 'toys', 'anal', 'feet', 'roleplay',
]

function player(name: string, gender: 'male' | 'female'): Player {
  return { name, gender, pairingPreference: 'any' }
}

const profiles: { label: string; scenario: Scenario; players: Player[] }[] = [
  { label: 'couple-mf', scenario: 'couple', players: [player('М', 'male'), player('Ж', 'female')] },
  { label: 'sex-mf', scenario: 'sex', players: [player('М', 'male'), player('Ж', 'female')] },
  { label: 'party-mixed', scenario: 'party', players: [player('М1', 'male'), player('Ж1', 'female'), player('М2', 'male'), player('Ж2', 'female')] },
  { label: 'party-men', scenario: 'party', players: [player('М1', 'male'), player('М2', 'male'), player('М3', 'male')] },
  { label: 'party-women', scenario: 'party', players: [player('Ж1', 'female'), player('Ж2', 'female'), player('Ж3', 'female')] },
  { label: 'afterdark-mixed', scenario: 'afterdark', players: [player('М', 'male'), player('Ж', 'female')] },
  { label: 'afterdark-men', scenario: 'afterdark', players: [player('М1', 'male'), player('М2', 'male')] },
  { label: 'afterdark-women', scenario: 'afterdark', players: [player('Ж1', 'female'), player('Ж2', 'female')] },
]

function candidatePool(scenario: Scenario, players: Player[], actorIndex: number) {
  const actor = players[actorIndex]
  return deck.filter((directorCard) => {
    if (directorCard.scenario !== scenario) return false
    const source = directorCard.sourceCardId ? sourceById.get(directorCard.sourceCardId) : null
    if (directorCard.sourceCardId && !source) return false
    if (source?.actorGenders?.length && !source.actorGenders.includes(actor.gender)) return false
    if (source?.minPlayers && source.minPlayers > players.length) return false
    const needsTarget = source
      ? source.requiresTarget !== false && source.pairing !== 'none'
      : directorCard.targetRequired !== false
    return !needsTarget || (source
      ? eligibleTargetIndices(source, players, actorIndex).length > 0
      : players.length > 1)
  })
}

for (const profile of profiles) {
  let state = createDirectorState(
    profile.scenario,
    profile.players,
    'clothed',
    profile.scenario === 'sex' ? allBoundaries : [],
  )

  for (let turn = 0; turn < 36; turn += 1) {
    const actorIndex = turn % profile.players.length
    const risk = ([1, 2, 3] as RiskLevel[])[turn % 3]
    const candidates = candidatePool(profile.scenario, profile.players, actorIndex)
    const picked = pickDirectorCard(candidates, state, actorIndex, null, risk, () => ((turn * 37) % 97) / 97)

    assert.ok(
      picked,
      `${profile.label}: Director deadlocked on turn ${turn + 1}, stage ${state.sessionStage}, risk ${risk}`,
    )
    if (!picked) break

    const source = picked.card.sourceCardId ? sourceById.get(picked.card.sourceCardId) : null
    const targets = source
      ? eligibleTargetIndices(source, profile.players, actorIndex)
      : picked.card.targetRequired === false
        ? []
        : profile.players.map((_, index) => index).filter((index) => index !== actorIndex)
    const targetIndex = targets[0] ?? null
    state = completeTurn(tickEffects(state), picked.card, actorIndex, targetIndex, risk, false)
  }

  assert.ok(state.turnsPlayed === 36, `${profile.label}: simulation did not finish`)
}

console.log('✓ v0.9 36-turn session simulations passed')
