import type { GameCard, Heat } from '../types'
import type { ChainFamily, DirectorCard, RiskLevel, SessionStage } from './types'

const stageMap: Record<GameCard['scenario'], Record<Heat, SessionStage[]>> = {
  couple: {
    light: [0, 1],
    hot: [1, 2],
    hard: [2, 3],
  },
  party: {
    light: [0, 1],
    hot: [1, 2],
    hard: [2, 3],
  },
  afterdark: {
    light: [0, 1],
    hot: [1, 2],
    hard: [2, 3],
  },
  sex: {
    light: [0, 1],
    hot: [1, 2],
    hard: [3, 4],
  },
}

function inferChain(card: GameCard): ChainFamily {
  const value = [card.interaction, card.mechanic, card.theme].join(' ').toLowerCase()
  if (/oral|minet|кунилинг|минет/.test(value)) return 'oral'
  if (/position|поз/.test(value)) return 'position'
  if (/control|контрол|команд|ведущ|ведом/.test(value)) return 'control'
  if (/clothing|одежд|бель/.test(value)) return 'undress'
  if (/kiss|поцел/.test(value)) return 'kissing'
  if (/flirt|флирт|tension/.test(value)) return 'tease'
  if (/embarrass|нелов|кринж/.test(value)) return 'embarrassment'
  if (/social|group|групп/.test(value)) return 'social'
  if (/physical|физ/.test(value)) return 'physical'
  if (/confession|призн|story|conversation/.test(value)) return 'confession'
  return card.scenario === 'party' || card.scenario === 'afterdark' ? 'chaos' : 'conversation'
}

function riskWithinLegacyBucket(card: GameCard): RiskLevel {
  const text = card.text.toLowerCase()
  let score = 1
  if (card.mechanic === 'control' || card.mechanic === 'roleplay' || card.mechanic === 'position') score += 1
  if (card.sexualAction || /сними|раздень|поцел|пах|груд|ягод|пенис|вульв|клитор|минет|кунилинг|догги|наездниц|миссионер|69/.test(text)) score += 1
  return Math.min(3, score) as RiskLevel
}

export function adaptLegacyCard(card: GameCard): DirectorCard {
  const chain = inferChain(card)
  return {
    id: `v09:${card.id}`,
    sourceCardId: card.id,
    scenario: card.scenario,
    type: card.type,
    text: card.text,
    risk: riskWithinLegacyBucket(card),
    stages: stageMap[card.scenario][card.heat],
    chains: [chain],
    nextHooks: [chain],
    requires: {
      minPlayers: card.minPlayers,
    },
    targetRequired: card.requiresTarget !== false && card.pairing !== 'none',
  }
}

export function adaptLegacyDeck(cards: GameCard[]) {
  return cards.map(adaptLegacyCard)
}
