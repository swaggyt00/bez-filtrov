const assert = {
  ok(value: unknown, message = 'assert.ok failed') {
    if (!value) throw new Error(message)
  },
}

import { cards } from '../src/data/cards'
import { adaptLegacyDeck } from '../src/v09/legacy-adapter'
import { curatedHighRiskCards } from '../src/v09/curated-risk-three'
import { curatedSexLowRiskCards } from '../src/v09/curated-sex-breathers'
import { socialCallbackCards } from '../src/v09/social-dynamics'
import { sexNativeCards } from '../src/v09/sex-native'
import type { RiskLevel, SessionStage } from '../src/v09/types'
import type { Scenario } from '../src/types'

const legacyDeck = adaptLegacyDeck(cards)
const deck = [...legacyDeck,...sexNativeCards,...curatedHighRiskCards,...curatedSexLowRiskCards, ...socialCallbackCards]
const maxStage: Record<Scenario, SessionStage> = {
  couple: 3,
  party: 3,
  afterdark: 3,
  sex: 4,
}
const scenarios: Scenario[] = ['couple', 'party', 'afterdark', 'sex']
const risks: RiskLevel[] = [1, 2, 3]

for (const scenario of scenarios) {
  for (let stage = 0; stage <= maxStage[scenario]; stage += 1) {
    for (const risk of risks) {
      const count = deck.filter((card) =>
        card.scenario === scenario
        && card.stages.includes(stage as SessionStage)
        && card.risk === risk,
      ).length
      assert.ok(count >= 3, `${scenario}/stage-${stage}/risk-${risk}: director has only ${count} cards`)
      if(scenario !== 'sex' && risk === 3) {
        assert.ok(count >= 30, `${scenario}/stage-${stage}: insufficient reviewed risk-3 variety (${count})`)
      }
      if(scenario === 'sex' && risk === 1 && stage >= 2) {
        assert.ok(count >= 24, `sex/stage-${stage}: low-risk continuity pool too small (${count})`)
      }
    }
  }
}

console.log('✓ v0.9 full playable Director deck has risk coverage for every stage')


const adaptedBySourceId = new Map(deck.map((card) => [card.sourceCardId, card]))
for (const source of cards.filter((card) => card.type === 'truth' && card.scenario !== 'sex')) {
  const adapted = adaptedBySourceId.get(source.id)
  assert.ok(adapted, `missing adapted Truth: ${source.id}`)
  if (!adapted) continue
  if (source.heat === 'light') {
    assert.ok(adapted.risk === 1, `${source.id}: light Truth was inflated to risk ${adapted.risk}`)
  }
  if (source.heat === 'hot') {
    assert.ok(adapted.risk <= 2, `${source.id}: hot Truth was inflated to three fire`)
  }
}

console.log('✓ v0.9 Truth risk has no hash-based three-fire inflation')

const unexpectedRiskThree = legacyDeck.filter(card =>
  card.scenario !== 'sex' && card.risk === 3)
assert.ok(unexpectedRiskThree.length === 0,
  'legacy social Truth/Dare must never claim risk-3 without human semantic review: '
  +unexpectedRiskThree.map(card=>card.sourceCardId).join(', '))

for (const id of [
  'party-light-dare-006','party-light-dare-027','party-hard-truth-008',
  'afterdark-light-dare-003','afterdark-light-dare-024',
  'couple-light-dare-006','couple-light-dare-034','couple-hard-truth-001',
]) {
  const old = legacyDeck.find(card=>card.sourceCardId===id)
  assert.ok(old?.risk !== 3, id+' is a weak card that must not appear at 🔥🔥🔥')
}
assert.ok(curatedHighRiskCards.length===90,'expected exactly 90 explicitly reviewed high-risk cards')
assert.ok(curatedHighRiskCards.every(card=>
  card.risk===3 && card.scenario!=='sex' && card.stages.length===4),
  'reviewed three-fire cards must keep chosen intensity and work in all social stages')
assert.ok(curatedSexLowRiskCards.length===24,'expected 24 stage-safe low-risk sex cards')
assert.ok(curatedSexLowRiskCards.every(card=>
  card.risk===1 && card.scenario==='sex' && [2,3,4].every(stage=>card.stages.includes(stage as SessionStage))
  &&!(card.requires?.boundaries?.length)),
  'new Sex relief cards cannot add new physical-boundary requirements')

const ids=deck.map(card=>card.id)
assert.ok(new Set(ids).size===ids.length,'Director deck IDs must be unique')
console.log('✓ curated semantic risk-3: old hash inflation removed; 90 true high-risk + 24 safe Sex relief cards')

const bySourceId = new Map(cards.map((card) => [card.id, card]))
for (const card of deck) {
  const source = card.sourceCardId ? bySourceId.get(card.sourceCardId) : null
  if (source?.scenario === 'sex' && source.heat === 'hard' && source.sexualAction) {
    assert.ok(
      !/(двадцать|тридцать|сорок) секунд/i.test(card.text),
      `${source.id}: direct sexual action still uses the old short timer: ${card.text}`,
    )
  }
}

console.log('✓ v0.9 direct Sex timers are expanded')
