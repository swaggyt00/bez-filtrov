import type {
  CardInteraction,
  CardMechanic,
  CardScene,
  CardSourceRef,
  GameCard,
  Heat,
  PairingRule,
  PlayerGender,
  Scenario,
  TruthPurpose,
} from '../../types'

export interface GroundedPairOptions {
  truthPurpose?: TruthPurpose
  truthMechanic?: CardMechanic
  dareMechanic?: CardMechanic
  truthInteraction?: CardInteraction
  dareInteraction?: CardInteraction
  pairing?: PairingRule
  requiresTarget?: boolean
  actorGenders?: PlayerGender[]
  targetGenders?: PlayerGender[]
  alcohol?: boolean
  minPlayers?: number
  duration?: 'temporary'
  sexualAction?: boolean
  scene?: CardScene
}

export interface GroundedPair extends GroundedPairOptions {
  sourceRef: CardSourceRef
  theme: string
  truth: string
  dare: string
}

const truthMechanics: CardMechanic[] = ['choice', 'confession', 'story', 'compatibility', 'desire', 'experience', 'rank', 'conflict']
const truthInteractions: CardInteraction[] = ['conversation', 'confession', 'flirt', 'intimate-choice', 'tension', 'humor', 'social-choice']
const truthPurposes: TruthPurpose[] = ['curiosity', 'desire', 'choice', 'story', 'compatibility', 'values', 'experience', 'confession']
const dareMechanics: CardMechanic[] = ['direct', 'physical', 'timed', 'partner-choice', 'roleplay', 'social', 'control']
const dareInteractions: CardInteraction[] = ['physical', 'flirt', 'tension', 'humor', 'social-choice', 'roleplay', 'control']

export function family(
  sourceRef: CardSourceRef,
  theme: string,
  entries: Array<[truth: string, dare: string]>,
  options: GroundedPairOptions = {},
): GroundedPair[] {
  return entries.map(([truth, dare]) => ({ sourceRef, theme, truth, dare, ...options }))
}

function targetDefaults(scenario: Scenario, text: string, explicitPairing?: PairingRule, explicitRequiresTarget?: boolean) {
  const requiresTarget = explicitRequiresTarget ?? text.includes('{{other.')
  const pairing = explicitPairing ?? (requiresTarget ? (scenario === 'couple' || scenario === 'sex' ? 'mutual-close' : 'any') : 'none')
  return { requiresTarget, pairing }
}

export function buildGroundedPairDeck(args: {
  scenario: Scenario
  heat: Heat
  pairs: GroundedPair[]
}): GameCard[] {
  const truths = args.pairs.map<GameCard>((item, index) => {
    const targeting = targetDefaults(args.scenario, item.truth, item.pairing, item.requiresTarget)
    return {
      id: `${args.scenario}-${args.heat}-truth-${String(index + 1).padStart(3, '0')}`,
      scenario: args.scenario,
      heat: args.heat,
      type: 'truth',
      text: item.truth.trim(),
      theme: item.theme,
      coreIdea: `${args.scenario}-${args.heat}-${item.theme}-truth-${index + 1}`,
      mechanic: item.truthMechanic ?? truthMechanics[index % truthMechanics.length],
      interaction: item.truthInteraction ?? truthInteractions[index % truthInteractions.length],
      purpose: item.truthPurpose ?? truthPurposes[index % truthPurposes.length],
      actorGenders: item.actorGenders,
      targetGenders: item.targetGenders,
      pairing: targeting.pairing,
      requiresTarget: targeting.requiresTarget,
      sourceRef: item.sourceRef,
      minPlayers: item.minPlayers,
    }
  })

  const dares = args.pairs.map<GameCard>((item, index) => {
    const targeting = targetDefaults(args.scenario, item.dare, item.pairing, item.requiresTarget)
    return {
      id: `${args.scenario}-${args.heat}-dare-${String(index + 1).padStart(3, '0')}`,
      scenario: args.scenario,
      heat: args.heat,
      type: 'dare',
      text: item.dare.trim(),
      theme: item.theme,
      coreIdea: `${args.scenario}-${args.heat}-${item.theme}-dare-${index + 1}`,
      mechanic: item.dareMechanic ?? dareMechanics[index % dareMechanics.length],
      interaction: item.dareInteraction ?? dareInteractions[index % dareInteractions.length],
      actorGenders: item.actorGenders,
      targetGenders: item.targetGenders,
      pairing: targeting.pairing,
      requiresTarget: targeting.requiresTarget,
      sourceRef: item.sourceRef,
      alcohol: item.alcohol,
      minPlayers: item.minPlayers,
      duration: item.duration,
      sexualAction: item.sexualAction,
      scene: item.scene,
    }
  })

  return [...truths, ...dares]
}
