const assert = {
  equal(actual: unknown, expected: unknown, message = 'assert.equal failed') {
    if (actual !== expected) throw new Error(`${message}: ${String(actual)} !== ${String(expected)}`)
  },
  ok(value: unknown, message = 'assert.ok failed') {
    if (!value) throw new Error(message)
  },
}

import { cards } from '../src/data/cards'
import { hydrateCardText } from '../src/deck'
import { adaptLegacyDeck } from '../src/v09/legacy-adapter'
import { createDirectorState, maybeAdvanceStage, pickDirectorCard } from '../src/v09/director'
import { sexNativeCards } from '../src/v09/sex-native'
import { SEX_THEME_PROFILES, sexProfileForTheme } from '../src/v09/sex-curation'
import type { BoundaryTag, DirectorState, RiskLevel, SessionStage } from '../src/v09/types'
import type { Player } from '../src/types'

const sexSources = cards.filter((card) => card.scenario === 'sex')
const legacy = adaptLegacyDeck(cards).filter((card) => card.scenario === 'sex')
const fullDeck = [...legacy, ...sexNativeCards]

assert.equal(sexSources.length, 420, 'v0.9 must preserve the 420 legacy Sex cards during curation')

const sourceThemes = [...new Set(sexSources.map((card) => card.theme))].sort()
assert.equal(sourceThemes.length, 46, 'Sex corpus must expose 46 curated theme families')
for (const theme of sourceThemes) {
  assert.ok(sexProfileForTheme(theme), `missing Sex profile: ${theme}`)
}
for (const theme of Object.keys(SEX_THEME_PROFILES)) {
  assert.ok(sourceThemes.includes(theme), `stale Sex profile has no legacy theme: ${theme}`)
}

for (const stage of [0, 1, 2, 3, 4] as SessionStage[]) {
  for (const risk of [1, 2, 3] as RiskLevel[]) {
    const count = fullDeck.filter((card) => card.stages.includes(stage) && card.risk === risk).length
    assert.ok(count >= 5, `Sex stage ${stage} / risk ${risk} has only ${count} cards`)
  }
}

const explicitGenital = /(дроч|пенис|вульв|клитор|минет|кунилинг|вагинальн|проникнов|трах)/i
for (const card of legacy) {
  if (card.stages.some((stage) => stage >= 3) && explicitGenital.test(card.text)) {
    assert.ok(
      Boolean(card.requires?.boundaries?.length),
      `${card.id}: explicit late-stage card must carry a boundary tag`,
    )
  }
}

for (const card of legacy.filter((card) => card.sourceCardId?.startsWith('sex-hard-dare'))) {
  if (/(занимайтесь сексом|дроч|минет|кунилинг|проникнов|трах)/i.test(card.text)) {
    assert.ok(
      !/(двадцать|тридцать|сорок) секунд/i.test(card.text),
      `${card.id}: direct Sex action still contains an old micro-timer: ${card.text}`,
    )
  }
}

assert.ok(sexNativeCards.length >= 40, 'native Sex deck must be substantial, not a token patch')
assert.equal(new Set(sexNativeCards.map((card) => card.id)).size, sexNativeCards.length, 'native Sex ids must be unique')

const nativeAmbiguity = [
  /\bэта ветка\b/i,
  /\bэта поза\b/i,
  /\bэтот жест\b/i,
  /\bэтот способ\b/i,
  /\bтакой способ\b/i,
  /\bпродолжай(?:те)?\b/i,
  /\bостанься вплотную\b/i,
  /\bполучающ(?:ий|ая|его|ей)\b/i,
]
for (const card of sexNativeCards) {
  for (const [actorIndex, targetIndex] of [[0, 1], [1, 0]] as const) {
    const rendered = hydrateCardText(card.text, players, actorIndex, targetIndex)
    assert.ok(!/\{\{[^}]+\}\}/.test(rendered), `${card.id}: unresolved template after render: ${rendered}`)
  }
  if (card.type === 'truth') {
    assert.ok(card.text.trim().endsWith('?'), `${card.id}: native Truth must be an explicit question`)
  } else {
    assert.ok(
      nativeAmbiguity.every((pattern) => !pattern.test(card.text)),
      `${card.id}: native Dare contains context-dependent wording: ${card.text}`,
    )
  }
}

console.log('✓ v0.9 native Sex cards are self-contained and render without hidden context')


const expectedNativeBoundaries: BoundaryTag[] = [
  'manual', 'oral', 'penetration', 'spanking', 'bondage', 'dom-sub',
  'edging', 'anal', 'feet', 'roleplay',
]
for (const boundary of expectedNativeBoundaries) {
  assert.ok(
    sexNativeCards.some((card) => card.requires?.boundaries?.includes(boundary)),
    `native Sex deck has no ${boundary} branch`,
  )
}

const players: Player[] = [
  { name: 'Максим', gender: 'male', pairingPreference: 'female' },
  { name: 'Рада', gender: 'female', pairingPreference: 'male' },
]

function stateAt(stage: SessionStage, boundaries: BoundaryTag[], clothing: 'clothed' | 'underwear' = 'underwear') {
  const state = createDirectorState('sex', players, clothing, boundaries)
  return {
    ...state,
    sessionStage: stage,
    tension: 140,
    turnsPlayed: 30,
  } as DirectorState
}

for (const boundary of ['manual', 'oral', 'penetration'] as BoundaryTag[]) {
  const state = stateAt(4, [boundary])
  for (const risk of [1, 2, 3] as RiskLevel[]) {
    const picked = pickDirectorCard(fullDeck, state, 0, 1, risk, () => 0)
    assert.ok(picked, `stage 4 deadlock: only ${boundary} allowed, risk ${risk}`)
    assert.ok(
      !picked?.card.requires?.boundaries?.some((tag) => tag !== boundary),
      `stage 4 ${boundary}/risk-${risk} selected incompatible boundary ${picked?.card.id}`,
    )
  }
}

const stage3Boundaries: BoundaryTag[] = [
  'manual', 'oral', 'penetration', 'spanking', 'bondage', 'dom-sub',
  'edging', 'toys', 'anal', 'feet', 'roleplay',
]
for (const boundary of stage3Boundaries) {
  const state = stateAt(3, [boundary], 'underwear')
  for (const risk of [1, 2, 3] as RiskLevel[]) {
    assert.ok(
      pickDirectorCard(fullDeck, state, 0, 1, risk, () => 0),
      `stage 3 deadlock: only ${boundary} allowed, risk ${risk}`,
    )
  }
}

let noBoundaries = stateAt(2, [], 'underwear')
assert.equal(maybeAdvanceStage(noBoundaries).sessionStage, 2, 'Sex must stay at stage 2 with no advanced boundaries')

let roleplayOnly = stateAt(2, ['roleplay'], 'underwear')
roleplayOnly = maybeAdvanceStage(roleplayOnly)
assert.equal(roleplayOnly.sessionStage, 3, 'roleplay should be allowed to open stage 3')
roleplayOnly = { ...roleplayOnly, tension: 160, turnsPlayed: 40 }
assert.equal(maybeAdvanceStage(roleplayOnly).sessionStage, 3, 'roleplay alone must not open full sexual stage 4')

let manualOnly = stateAt(3, ['manual'], 'underwear')
assert.equal(maybeAdvanceStage(manualOnly).sessionStage, 4, 'manual boundary should support full stage 4')

console.log('✓ v0.9 Sex curation, boundary and risk coverage passed')


const threeFireTruths = fullDeck.filter((card) => card.type === 'truth' && card.risk === 3)
assert.equal(threeFireTruths.length, 23, `three-fire Sex Truth pool must stay explicitly curated, got ${threeFireTruths.length}`)
assert.ok(
  threeFireTruths.every((card) => !card.sourceCardId),
  'legacy Sex Truths must never become three-fire just because of their index inside a family',
)
assert.ok(
  threeFireTruths.every((card) => card.id.startsWith('v09-native-sex-truth3-')),
  'every three-fire Sex Truth must come from the explicitly curated truth3 pool',
)

const weakThreeFireWording = [
  'Какой жест {{other.gen}} сильнее всего привлекает внимание?',
  'Какую вещь на {{other.prep}} тебе сильнее всего хочется снять самому',
  'Что тебе хотелось бы попросить у {{other.gen}} сегодня, но самому первым произнести это было бы стремно?',
  'Какое конкретное действие от {{other.gen}} заставило бы тебя сейчас подумать',
  'Что ты хотел бы услышать от {{other.gen}} во время секса, но никогда прямо об этом не просил?',
  'какую позу, темп и роль ты хочешь прямо сейчас',
  'Что тебе хотелось бы позволить {{other.dat}} сделать с тобой сегодня, чего раньше между вами ещё не было?',
]
for (const wording of weakThreeFireWording) {
  assert.ok(
    threeFireTruths.every((card) => !card.text.includes(wording)),
    `weak/generic wording leaked into three-fire Sex Truths: ${wording}`,
  )
}
for (const stage of [0, 1, 2, 3, 4] as SessionStage[]) {
  const count = threeFireTruths.filter((card) => card.stages.includes(stage)).length
  assert.ok(count >= 4, `Sex stage ${stage} has only ${count} intentional three-fire Truths`)
}

const weakGestureTruth = legacy.find((card) => card.text.includes('Какой жест {{other.gen}} сильнее всего привлекает внимание?'))
assert.ok(weakGestureTruth, 'fixture truth about attractive gesture must exist')
assert.ok((weakGestureTruth?.risk ?? 3) <= 2, 'generic attraction Truth must never be three-fire')

console.log('✓ v0.9 three-fire Truths are intentional native disclosures')
