import type { CardSourceRef } from '../types'

export interface CardSourceEntry {
  id: CardSourceRef
  family: string
  title: string
  url: string
  patternNote: string
}

export const CARD_SOURCE_REGISTRY: Record<CardSourceRef, CardSourceEntry> = {
  'spinwheel-public-bank': {
    id: 'spinwheel-public-bank', family: 'Play Spin Wheel',
    title: 'Truth or Dare Questions: 150 Best Truths & Dares',
    url: 'https://playspinwheel.com/blog/truth-or-dare-questions',
    patternNote: 'Reviewed 2026-10-06. Selected short classic challenges, with bounded durations.',
  },
  'openers-public-bank': {
    id: 'openers-public-bank', family: 'Openers',
    title: '50 Truth or Dare Questions (and Dares) You Can Use Anywhere',
    url: 'https://openers.app/truth-or-dare-questions',
    patternNote: 'Reviewed 2026-10-06. Selected short confession and performance ideas; physical performances retained.',
  },
  'truthordarego-public-bank': {
    id: 'truthordarego-public-bank', family: 'Truth or Dare Go',
    title: '400+ Truth or Dare Questions for Every Group & Occasion',
    url: 'https://truthordarego.com/blog/truth-or-dare-questions',
    patternNote: 'Reviewed 2026-10-06. Selected easy standalone challenges and everyday embarrassing questions.',
  },
  'guessy-public-bank': {
    id: 'guessy-public-bank', family: 'Party Games by Guessy',
    title: '50 Truth or Dare questions and dares for your party',
    url: 'https://partijatekok.hu/en/blog/truth-or-dare-questions/',
    patternNote: 'Reviewed 2026-10-06. Selected short party questions and visible actions; private photos stay optional.',
  },
  'allpartygames-public-bank': {
    id: 'allpartygames-public-bank', family: 'AllPartyGames',
    title: 'Truth or Dare Questions & Online Game',
    url: 'https://allpartygames.com/games/truth-or-dare/',
    patternNote: 'Reviewed 2026-10-06. Selected commonplace funny questions and party actions; no raw catalog import.',
  },
  'psycat-public-bank': {
    id: 'psycat-public-bank', family: 'PsyCat Games',
    title: '450+ Best Truth or Dare Questions',
    url: 'https://psycatgames.com/magazine/party-games/truth-or-dare/',
    patternNote: 'Reviewed 2026-10-06. Selected commonplace confession and physical challenge ideas; independent Russian wording, not a database export.',
  },
  'tableparty-public-bank': {
    id: 'tableparty-public-bank', family: 'Table Party',
    title: 'Truth or Dare Questions: 100+ Truths and 100+ Dares',
    url: 'https://tableparty.io/truth-or-dare-questions',
    patternNote: 'Reviewed 2026-10-06. Short no-equipment and coordination challenges; standalone instructions without scoring.',
  },
  'truthordaregame-public-bank': {
    id: 'truthordaregame-public-bank', family: 'TruthOrDareGame',
    title: '500+ Truth or Dare Questions',
    url: 'https://truthordaregame.net/questions',
    patternNote: 'Reviewed 2026-10-06. Selected performance and friendship ideas; no wholesale deck copy, ratings or public posts.',
  },
  'xdares-couples-bank': {
    id: 'xdares-couples-bank', family: 'Xdares',
    title: 'Truth or Dare for Couples: 150+ Romantic, Flirty & Spicy Questions',
    url: 'https://blog.xdares.com/truth-or-dare-for-couples/',
    patternNote: 'Reviewed 2026-10-06. Selected relationship questions and date-night actions, with explicit targets and completion conditions.',
  },
  'original-editorial': {
    id: 'original-editorial', family: 'Bez Filtrov editorial',
    title: 'Independent editorial cards and commonplace party challenges',
    url: 'https://github.com/swaggyt00/bez-filtrov/blob/v0.8-content-rebuild/docs/content-research-2026-10-06.md',
    patternNote: 'Original combinations and commonplace game mechanics. Not attributed to a competitor card or represented as a licensed import.',
  },
  'foreplay-guide': {
    id: 'foreplay-guide',
    family: 'The Foreplay Game',
    title: 'Truth or Dare Questions for Couples: From Sweet to Spicy',
    url: 'https://www.theforeplaygame.com/guides/truth-or-dare-questions-for-couples',
    patternNote: 'Four-step escalation from warm-up to explicit couple Truth/Dare mechanics; target-facing prompts and bounded timed dares.',
  },
  'foreplay-free-game': {
    id: 'foreplay-free-game',
    family: 'The Foreplay Game',
    title: 'Truth or Dare — free web game',
    url: 'https://www.theforeplaygame.com/truth-or-dare',
    patternNote: 'Public category/taxonomy structure used for interaction coverage and heat progression.',
  },
  'smush-couples-bank': {
    id: 'smush-couples-bank',
    family: 'Smush',
    title: '130 Truth or Dare Questions for Couples',
    url: 'https://www.smushapp.com/resources/truth-or-dare-questions',
    patternNote: 'Mild/medium/wild couple prompts with short spoken copy, eye contact, kissing, massage, clothing and timed actions.',
  },
  'wargamer-spicy-bank': {
    id: 'wargamer-spicy-bank',
    family: 'Wargamer',
    title: '250 spicy Truth or Dare questions for couples, FWBs, and dirty game nights',
    url: 'https://www.wargamer.com/truth-or-dare/questions',
    patternNote: 'Large public bank covering romantic, flirty, spicy, red-hot, kinky and group challenge patterns.',
  },
  'xdares-dirty-bank': {
    id: 'xdares-dirty-bank',
    family: 'Xdares',
    title: '200+ Dirty Truth or Dare Questions for Adults',
    url: 'https://blog.xdares.com/dirty-truth-or-dare-questions/',
    patternNote: 'Adult confession, fantasy, risky-memory, group-choice and couple challenge patterns across mild to extreme intensity.',
  },
  'xdares-adult-bank': {
    id: 'xdares-adult-bank',
    family: 'Xdares',
    title: '200+ Adult Truth or Dare Questions',
    url: 'https://blog.xdares.com/adult-truth-or-dare-questions/',
    patternNote: 'Party-oriented funny, embarrassing, naughty, deep-confession and drinking-game patterns for adult groups.',
  },
  'spiced-couple-bank': {
    id: 'spiced-couple-bank',
    family: 'Spiced Couple',
    title: 'Truth or Dare for Couples: 50 Juicy Questions + Free Online Version',
    url: 'https://spicedcouple.com/blog/truth-or-dare-for-couples/',
    patternNote: 'Couple intimacy patterns centered on vulnerability, first-kiss recreation, massage, eye contact and date-night actions.',
  },
}

export function getCardSource(sourceRef: CardSourceRef) {
  return CARD_SOURCE_REGISTRY[sourceRef]
}
