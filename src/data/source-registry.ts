import type { CardSourceRef } from '../types'

export interface CardSourceEntry {
  id: CardSourceRef
  family: string
  title: string
  url: string
  patternNote: string
}

export const CARD_SOURCE_REGISTRY: Record<CardSourceRef, CardSourceEntry> = {
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
