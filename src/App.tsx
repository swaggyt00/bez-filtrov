import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { cards } from './data/cards'
import { eligibleTargetIndices, hydrateCardText, renderCardText, validateScenarioPlayers } from './deck'
import { loadSettings as loadLegacySettings } from './storage'
import type { GameCard, PairingPreference, Player, PlayerGender, Scenario } from './types'
import { adaptLegacyDeck } from './v09/legacy-adapter'
import { curatedHighRiskCards } from './v09/curated-risk-three'
import { createAIDirectorShortlist, requestAIDirectorChoice } from './v09/ai-director'
import { requestAIModifier } from './v09/ai-modifier'
import { bossIsReady, cardIsEligible, completeTurn, createDirectorState, pickDirectorCard, pickDirectorTarget, preferUnseenDirectorCards, tickEffects } from './v09/director'
import { maybeCreateCautionEvent } from './v09/director'
import { eventRollIsDue, filteredEventCards, recordEventDecision, requestAIEvent } from './v09/ai-events'
import { eligibleTurnModifiers, pickTurnModifiers } from './v09/modifiers'
import { bossPenaltyFor, buildBossSession, settleBoss } from './v09/bosses'
import { requestAIBoss } from './v09/ai-boss'
import { getActiveStoryBeat } from './v09/story'
import { abandonUnavailableChain, beginChainSession, chainCaption, getActiveChainBeat, preferredChainTarget } from './v09/chains'
import { sexNativeCards } from './v09/sex-native'
import { clearV09Game, loadV09Game, loadV09Settings, saveV09Game, saveV09Settings } from './v09/storage'
import type {
  BoundaryChoice,
  BoundaryTag,
  BossSession,
  BossResult,
  BossPenalty,
  BossLossReason,
  DirectorCard,
  DirectorEvent,
  DirectorState,
  GameView,
  RiskLevel,
  SexStartState,
  TurnModifier,
  V09GameSettings,
} from './v09/types'

type ScenarioMeta = {
  title: string
  icon: string
  description: string
  minPlayers: number
  maxPlayers: number
}

const scenarioMeta: Record<Scenario, ScenarioMeta> = {
  couple: {
    title: 'Пара',
    icon: '♥',
    description: 'Для двоих: личное, смешное, флирт и близость.',
    minPlayers: 2,
    maxPlayers: 2,
  },
  sex: {
    title: 'Секс',
    icon: '✦',
    description: 'Для двоих: скрытая эскалация, фетиши, контроль и секс в разрешённых границах.',
    minPlayers: 2,
    maxPlayers: 2,
  },
  party: {
    title: 'Компания',
    icon: '●',
    description: '3–6 игроков: социальный риск, флирт, кринж и групповые челленджи.',
    minPlayers: 3,
    maxPlayers: 6,
  },
  afterdark: {
    title: 'После полуночи',
    icon: '☾',
    description: '2–6 игроков: ночной хаос, одежда, провокации и временные правила.',
    minPlayers: 2,
    maxPlayers: 6,
  },
}

const scenarioOrder: Scenario[] = ['couple', 'sex', 'party', 'afterdark']
const pairingLabels: Record<PairingPreference, string> = {
  any: 'со всеми',
  male: 'с мужчинами',
  female: 'с женщинами',
  none: 'ни с кем',
}

const boundaryOrder: BoundaryTag[] = [
  'manual',
  'oral',
  'penetration',
  'spanking',
  'bondage',
  'dom-sub',
  'edging',
  'toys',
  'anal',
  'feet',
  'roleplay',
]

const boundaryLabels: Record<BoundaryTag, string> = {
  manual: 'Стимуляция руками',
  oral: 'Оральный секс',
  penetration: 'Проникновение',
  spanking: 'Шлепки',
  bondage: 'Фиксация / bondage',
  'dom-sub': 'Доминирование / подчинение',
  edging: 'Edging / контроль оргазма',
  toys: 'Игрушки',
  anal: 'Анальные практики',
  feet: 'Feet / foot fetish',
  roleplay: 'Ролевые сценарии',
}

const boundaryChoiceLabels: Record<BoundaryChoice, string> = {
  yes: 'Да',
  maybe: 'Может быть',
  no: 'Нет',
}

const sexStartLabels: Record<SexStartState, string> = {
  clothed: 'В одежде',
  underwear: 'В белье',
  nude: 'Раздеты',
}

const directorDeck = [...adaptLegacyDeck(cards), ...sexNativeCards, ...curatedHighRiskCards]
const directorById = new Map(directorDeck.map((card) => [card.id, card]))
const sourceById = new Map(cards.map((card) => [card.id, card]))

type Screen = 'age' | 'setup' | 'boundaries' | 'handover' | 'game'
type DraftPlayer = {
  name: string
  gender: PlayerGender | null
  pairingPreference: PairingPreference
}

function blankBoundaryChoices(): Record<BoundaryTag, BoundaryChoice> {
  return Object.fromEntries(boundaryOrder.map((tag) => [tag, 'no'])) as Record<BoundaryTag, BoundaryChoice>
}

function initialDraftPlayers(): DraftPlayer[] {
  const saved = loadV09Settings()
  const legacy = loadLegacySettings()
  const players = saved?.players?.length ? saved.players : legacy?.players
  if (players?.length) {
    return players.map((player) => ({
      name: player.name,
      gender: player.gender,
      pairingPreference: player.pairingPreference ?? 'any',
    }))
  }
  return [
    { name: 'Игрок 1', gender: null, pairingPreference: 'any' },
    { name: 'Игрок 2', gender: null, pairingPreference: 'any' },
  ]
}

function App() {
  const previousSettings = loadV09Settings()
  const [screen, setScreen] = useState<Screen>('age')
  const [draftPlayers, setDraftPlayers] = useState<DraftPlayer[]>(initialDraftPlayers)
  const [scenario, setScenario] = useState<Scenario>(previousSettings?.scenario ?? 'sex')
  const [sexStartState, setSexStartState] = useState<SexStartState>(previousSettings?.sexStartState ?? 'clothed')
  const [settings, setSettings] = useState<V09GameSettings | null>(null)
  const [directorState, setDirectorState] = useState<DirectorState | null>(null)
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0)
  const [view, setView] = useState<GameView>('risk')
  const [currentDirectorCard, setCurrentDirectorCard] = useState<DirectorCard | null>(null)
  const [currentRisk, setCurrentRisk] = useState<RiskLevel | null>(null)
  const [currentTargetIndex, setCurrentTargetIndex] = useState<number | null>(null)
  const [renderedText, setRenderedText] = useState('')
  const [currentModifiers, setCurrentModifiers] = useState<TurnModifier[]>([])
  const [pendingEvent, setPendingEvent] = useState<DirectorEvent | null>(null)
  const [boss, setBoss] = useState<BossSession | null>(null)
  const [bossPhaseIndex, setBossPhaseIndex] = useState(0)
  const [bossResult, setBossResult] = useState<BossResult | null>(null)
  const [appliedBossPenalty, setAppliedBossPenalty] = useState<BossPenalty | null>(null)
  const [bossBusy, setBossBusy] = useState(false)
  const bossEpoch = useRef(0)
  const [notice, setNotice] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [aiEventBusy, setAiEventBusy] = useState(false)
  const aiEventAbort = useRef<AbortController | null>(null)
  const [aiIntro, setAiIntro] = useState('')
  const [aiWasUsed, setAiWasUsed] = useState(false)
  const aiEpoch = useRef(0)
  const aiBusyRef = useRef(false)
  const [preparedPlayers, setPreparedPlayers] = useState<Player[] | null>(null)
  const [boundaryStep, setBoundaryStep] = useState(0)
  const [boundaryDrafts, setBoundaryDrafts] = useState<Record<number, Record<BoundaryTag, BoundaryChoice>>>({})
  const [boundaryChoices, setBoundaryChoices] = useState<Record<BoundaryTag, BoundaryChoice>>(blankBoundaryChoices)
  const audioRef = useRef<AudioContext | null>(null)
  const savedGame = useMemo(() => loadV09Game(), [screen])

  const currentPlayer = settings?.players[currentPlayerIndex] ?? null
  const currentTarget = settings && currentTargetIndex !== null ? settings.players[currentTargetIndex] : null
  const groupScenario = scenario === 'party' || scenario === 'afterdark'

  useEffect(() => {
    if (screen !== 'game' || !settings || !directorState) return
    saveV09Game({
      settings,
      director: directorState,
      currentPlayerIndex,
      view,
      currentDirectorCardId: currentDirectorCard?.id ?? null,
      currentSourceCardId: currentDirectorCard?.sourceCardId ?? null,
      currentRisk,
      currentTargetIndex,
      renderedText,
      currentModifiers,
      pendingEvent,
      boss,
      bossPhaseIndex,
      bossResult,
      appliedBossPenalty,
      aiIntro,
      aiWasUsed,
      updatedAt: Date.now(),
    })
  }, [
    screen,
    settings,
    directorState,
    currentPlayerIndex,
    view,
    currentDirectorCard,
    currentRisk,
    currentTargetIndex,
    renderedText,
    currentModifiers,
    pendingEvent,
    boss,
    bossPhaseIndex,
    bossResult,
    appliedBossPenalty,
    aiIntro,
    aiWasUsed,
  ])

  function sound(kind: 'tap' | 'reveal') {
    try {
      const ctx = audioRef.current ?? new window.AudioContext()
      audioRef.current = ctx
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()
      oscillator.frequency.value = kind === 'reveal' ? 360 : 240
      gain.gain.setValueAtTime(0.0001, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.028, ctx.currentTime + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.09)
      oscillator.connect(gain).connect(ctx.destination)
      oscillator.start()
      oscillator.stop(ctx.currentTime + 0.1)
    } catch {
      // Decorative audio must never block the game.
    }
  }

  function updatePlayerName(index: number, value: string) {
    setDraftPlayers((players) => players.map((player, i) => i === index ? { ...player, name: value } : player))
  }

  function updatePlayerGender(index: number, gender: PlayerGender) {
    setDraftPlayers((players) => players.map((player, i) => i === index ? { ...player, gender } : player))
    sound('tap')
  }

  function updatePlayerPreference(index: number, pairingPreference: PairingPreference) {
    setDraftPlayers((players) => players.map((player, i) => i === index ? { ...player, pairingPreference } : player))
  }

  function addPlayer() {
    if (!groupScenario || draftPlayers.length >= 6) return
    setDraftPlayers((players) => [
      ...players,
      { name: `Игрок ${players.length + 1}`, gender: null, pairingPreference: 'any' },
    ])
  }

  function removePlayer(index: number) {
    if (draftPlayers.length <= 2) return
    setDraftPlayers((players) => players.filter((_, i) => i !== index))
  }

  function buildPlayers(): Player[] | null {
    const names = draftPlayers.map((player, index) => player.name.trim() || `Игрок ${index + 1}`)
    if (new Set(names.map((name) => name.toLocaleLowerCase('ru'))).size !== names.length) {
      setNotice('Имена игроков должны отличаться.')
      return null
    }
    if (draftPlayers.some((player) => !player.gender)) {
      setNotice('Укажи пол каждого игрока.')
      return null
    }

    const players: Player[] = draftPlayers.map((player, index) => ({
      name: names[index],
      gender: player.gender as PlayerGender,
      pairingPreference: player.pairingPreference,
    }))
    const validation = validateScenarioPlayers(scenario, players)
    if (!validation.ok) {
      setNotice(validation.message)
      return null
    }
    return players
  }

  function stopPendingAI() {
    aiEpoch.current += 1
    bossEpoch.current += 1
    setBossBusy(false)
    aiEventAbort.current?.abort()
    aiEventAbort.current = null
    aiBusyRef.current = false
    setAiEventBusy(false)
    setAiBusy(false)
  }

  function beginGame(players: Player[], mutuallyAllowedBoundaries: BoundaryTag[]) {
    stopPendingAI()
    const nextSettings: V09GameSettings = {
      players,
      scenario,
      sexStartState,
      mutuallyAllowedBoundaries,
    }
    const director = createDirectorState(
      scenario,
      players,
      scenario === 'sex' ? sexStartState : 'clothed',
      mutuallyAllowedBoundaries,
    )

    clearV09Game()
    saveV09Settings(nextSettings)
    setSettings(nextSettings)
    setDirectorState(director)
    setCurrentPlayerIndex(0)
    setView('risk')
    setCurrentDirectorCard(null)
    setCurrentRisk(null)
    setCurrentTargetIndex(null)
    setRenderedText('')
    setCurrentModifiers([])
    setAiIntro('')
    setAiWasUsed(false)
    setPendingEvent(null)
    setBoss(null)
    setBossPhaseIndex(0)
    setBossResult(null)
    setAppliedBossPenalty(null)
    setNotice('')
    setScreen('game')
    sound('reveal')
  }

  function requestStart() {
    const players = buildPlayers()
    if (!players) return
    if (scenario !== 'sex') {
      beginGame(players, [])
      return
    }

    setPreparedPlayers(players)
    setBoundaryStep(0)
    setBoundaryDrafts({})
    setBoundaryChoices(blankBoundaryChoices())
    setScreen('boundaries')
  }

  function saveBoundaryStep() {
    if (!preparedPlayers) return
    const nextDrafts = { ...boundaryDrafts, [boundaryStep]: boundaryChoices }
    setBoundaryDrafts(nextDrafts)

    if (boundaryStep < preparedPlayers.length - 1) {
      setBoundaryStep((step) => step + 1)
      setBoundaryChoices(blankBoundaryChoices())
      setScreen('handover')
      return
    }

    const mutual = boundaryOrder.filter((tag) =>
      preparedPlayers.every((_, index) => nextDrafts[index]?.[tag] !== 'no'),
    )
    beginGame(preparedPlayers, mutual)
  }

  function resumeGame() {
    stopPendingAI()
    const saved = loadV09Game()
    if (!saved) return
    setSettings(saved.settings)
    setDirectorState(saved.director)
    setDraftPlayers(saved.settings.players.map((player) => ({
      name: player.name,
      gender: player.gender,
      pairingPreference: player.pairingPreference ?? 'any',
    })))
    setScenario(saved.settings.scenario)
    setSexStartState(saved.settings.sexStartState)
    setCurrentPlayerIndex(Math.min(saved.currentPlayerIndex, saved.settings.players.length - 1))
    setView(saved.view)
    const resumedCard = saved.currentDirectorCardId ? directorById.get(saved.currentDirectorCardId) ?? null : null
    setCurrentDirectorCard(resumedCard)
    // The card is authoritative. A save created before a risk re-audit may contain
    // an obsolete currentRisk value for the same card id.
    setCurrentRisk(resumedCard ? resumedCard.risk : saved.currentRisk)
    setCurrentTargetIndex(saved.currentTargetIndex)
    setRenderedText(saved.renderedText)
    // Old prewritten v2 or decorative v1 AI extras do not survive a resume.
    // Only the new, reviewed original AI instructions are retained.
    setCurrentModifiers((saved.currentModifiers ?? []).filter((modifier) =>
      !modifier.id.startsWith('ai-') || modifier.id.startsWith('ai-original-'),
    ))
    setAiIntro(saved.aiIntro ?? '')
    setAiWasUsed(saved.aiWasUsed ?? false)
    setPendingEvent(saved.pendingEvent)
    setBoss(saved.boss)
    setBossPhaseIndex(saved.bossPhaseIndex ?? 0)
    setBossResult(saved.bossResult ?? null)
    setAppliedBossPenalty(saved.appliedBossPenalty ?? null)
    setNotice('')
    setScreen('game')
  }

  function eligibleDirectorCards(
    event: DirectorEvent | null,
    targetState: DirectorState | null = directorState,
    actorIndex = currentPlayerIndex,
  ) {
    if (!settings || !targetState) return [] as DirectorCard[]
    const actor = settings.players[actorIndex]
    const recentChain = new Set(targetState.history.slice(-2).flatMap((entry) => entry.chains.slice(0, 1)))
    const eventDeck = event?.aiGenerated
      ? filteredEventCards(directorDeck, targetState, event.aiMechanics ?? [])
      : directorDeck
    const base = eventDeck.filter((directorCard) => {
      if (directorCard.scenario !== settings.scenario) return false
      const source = directorCard.sourceCardId ? sourceById.get(directorCard.sourceCardId) : null
      if (directorCard.sourceCardId && !source) return false
      if (source?.actorGenders?.length && !source.actorGenders.includes(actor.gender)) return false
      if (source?.minPlayers && source.minPlayers > settings.players.length) return false

      const needsTarget = source
        ? source.requiresTarget !== false && source.pairing !== 'none'
        : directorCard.targetRequired !== false
      if (needsTarget) {
        const targets = source
          ? eligibleTargetIndices(source, settings.players, actorIndex)
          : settings.players.map((_, index) => index).filter((index) => index !== actorIndex)
        if (targets.length === 0) return false
      }

      if (event?.forcedType && directorCard.type !== event.forcedType) return false
      if (event?.avoidRecentChains && recentChain.has(directorCard.chains[0])) return false
      if (event?.forcedChain && !directorCard.chains.includes(event.forcedChain)) return false
      if (event?.forcedBoundary && !directorCard.requires?.boundaries?.includes(event.forcedBoundary)) return false
      return true
    })

    if (base.length || event?.aiGenerated) return base

    return directorDeck.filter((directorCard) => {
      if (directorCard.scenario !== settings.scenario) return false
      const source = directorCard.sourceCardId ? sourceById.get(directorCard.sourceCardId) : null
      if (directorCard.sourceCardId && !source) return false
      if (source?.actorGenders?.length && !source.actorGenders.includes(actor.gender)) return false
      if (source?.minPlayers && source.minPlayers > settings.players.length) return false
      const needsTarget = source
        ? source.requiresTarget !== false && source.pairing !== 'none'
        : directorCard.targetRequired !== false
      if (!needsTarget) return true
      return source
        ? eligibleTargetIndices(source, settings.players, actorIndex).length > 0
        : settings.players.length > 1
    })
  }

  async function chooseRisk(risk: RiskLevel) {
    if (!settings || !directorState || aiBusyRef.current) return

    let forcedModifierCount = pendingEvent?.modifierCount ?? 0
    if (pendingEvent?.id === 'double-stake' && risk === 2) forcedModifierCount = 2
    if (pendingEvent?.id === 'double-stake' && risk === 3) forcedModifierCount = 0

    const baseCandidates = eligibleDirectorCards(pendingEvent)
    const candidates = forcedModifierCount > 0
      ? baseCandidates.filter((card) => eligibleTurnModifiers(card, directorState).length >= forcedModifierCount)
      : baseCandidates
    // The chosen fire, stage, consent and any active penalty are nonnegotiable.
    // First select eligible cards, then avoid repeats across the FULL pool;
    // never let a narrow Chain preference reintroduce old cards.
    const riskCandidates = candidates.filter(card =>
      cardIsEligible(card, directorState, currentPlayerIndex, null, risk))
    const penalty = directorState.pendingBossPenalty
    const penaltyForTurn = penalty?.playerIndex === currentPlayerIndex ? penalty : null
    const compatiblePenaltyCards = penaltyForTurn
      ? riskCandidates.filter(card => card.type === penaltyForTurn.type)
      : []
    const appliedPenalty = compatiblePenaltyCards.length > 0 ? penaltyForTurn : null
    const eligiblePool = appliedPenalty ? compatiblePenaltyCards : riskCandidates
    const freshPool = preferUnseenDirectorCards(eligiblePool, directorState)

    // A scripted next beat is a strong preference among fresh eligible cards,
    // not a reason to show a recently completed challenge again.
    const beat = getActiveStoryBeat(directorState)
    const chainMatches = beat && !pendingEvent ? freshPool.filter(card =>
      card.chains.includes(beat.chain)) : []
    const stateForTurn = pendingEvent || (beat && chainMatches.length === 0)
      ? abandonUnavailableChain(directorState)
      : directorState
    const preferredMatches = beat?.preferredType === 'either'
      ? chainMatches
      : chainMatches.filter(card => card.type === beat?.preferredType)
    const playableCandidates = chainMatches.length
      ? (preferredMatches.length ? preferredMatches : chainMatches)
      : freshPool
    const fallback = pickDirectorCard(playableCandidates, stateForTurn, currentPlayerIndex, null, risk)

    if (!fallback) {
      setNotice(
        forcedModifierCount > 0
          ? 'Director не нашёл карту с совместимыми условиями для этого риска. Это нужно поправить в разметке.'
          : 'Director не нашёл логичную карту для текущего состояния. Это нужно поправить в разметке.',
      )
      return
    }

    const epoch = ++aiEpoch.current
    aiBusyRef.current = true
    setAiBusy(true)
    const shortlist = createAIDirectorShortlist(playableCandidates, stateForTurn, currentPlayerIndex, risk)
    const aiChoice = await requestAIDirectorChoice(
      stateForTurn, risk, shortlist, {
        forceCondition: forcedModifierCount > 0,
        actorIndex: currentPlayerIndex,
      },
    )
    if (epoch !== aiEpoch.current) return

    // A remote model cannot introduce a new card or change intensity/boundaries.
    // If the request times out, keep the old local Director behavior.
    const card = aiChoice?.card ?? fallback.card
    const source = card.sourceCardId ? sourceById.get(card.sourceCardId) : null
    if (card.sourceCardId && !source) {
      setNotice('Не найден исходник карточки.')
      return
    }

    const targets = source
      ? eligibleTargetIndices(source, settings.players, currentPlayerIndex)
      : card.targetRequired === false
        ? []
        : settings.players.map((_, index) => index).filter((index) => index !== currentPlayerIndex)
    const targetIndex = preferredChainTarget(stateForTurn, targets, risk)
      ?? pickDirectorTarget(targets, stateForTurn)
    const finalText = source
      ? renderCardText({ ...source, text: card.text }, settings.players, currentPlayerIndex, targetIndex)
      : hydrateCardText(card.text, settings.players, currentPlayerIndex, targetIndex)

    // A valid extra must be a newly authored, verified difficulty rule.
    // No arbitrary canned modifier is substituted when AI creativity fails.
    // Only explicitly forced legacy Events retain their compatibility fallback.
    const fallbackModifiers = pickTurnModifiers(card, stateForTurn, card.risk, forcedModifierCount)
    let modifiers: TurnModifier[] = forcedModifierCount > 0 && !aiChoice ? fallbackModifiers : []
    if (aiChoice && (aiChoice.addCondition || forcedModifierCount > 0)) {
      const custom = await requestAIModifier(card, stateForTurn)
      if (epoch !== aiEpoch.current) return
      if (custom) {
        modifiers = [custom]
        if (forcedModifierCount > 1) {
          const equivalentLegacyId: Record<string, string> = {
            'ai-dare-silence': 'silence',
            'ai-dare-no-hands': 'no-hands',
            'ai-dare-eyes-closed': 'blindfold',
            'ai-dare-keep-position': 'keep-position',
          }
          const additional = fallbackModifiers.find((item) =>
            item.id !== equivalentLegacyId[custom.id],
          )
          if (additional) modifiers.push(additional)
        }
      } else {
        modifiers = forcedModifierCount > 0 ? fallbackModifiers : []
      }
    }

    aiBusyRef.current = false
    setAiBusy(false)
    // A live Chain owns three subsequent actions and target callbacks.
    // Retain it across AI calls; use a fresh AI blueprint only at the opener.
    const continuing = getActiveStoryBeat(stateForTurn)
    const newPlan = continuing ? stateForTurn.scenePlan ?? null : (aiChoice?.scenePlan ?? null)
    const newChain = continuing ? stateForTurn.chainSession ?? null
      : beginChainSession(stateForTurn, card, currentPlayerIndex, targetIndex,
        newPlan, aiChoice?.chainDraft ?? null)
    setDirectorState({
      ...stateForTurn,
      scenePlan: newPlan,
      chainSession: newChain,
      pendingBossPenalty:appliedPenalty ? null : stateForTurn.pendingBossPenalty,
    })
    setAppliedBossPenalty(appliedPenalty)
    setCurrentDirectorCard(card)
    setCurrentRisk(card.risk)
    setCurrentTargetIndex(targetIndex)
    setRenderedText(finalText)
    setCurrentModifiers(modifiers)
    setAiIntro(aiChoice?.intro ?? '')
    setAiWasUsed(Boolean(aiChoice))
    setPendingEvent(null)
    setView('card')
    setNotice('')
    sound('reveal')
  }

  async function prepareNextTurn(nextDirector: DirectorState, nextPlayerIndex: number) {
    stopPendingAI()
    setDirectorState(nextDirector)
    setCurrentPlayerIndex(nextPlayerIndex)
    setCurrentDirectorCard(null)
    setCurrentRisk(null)
    setCurrentTargetIndex(null)
    setRenderedText('')
    setCurrentModifiers([])
    setAiIntro('')
    setAiWasUsed(false)
    setPendingEvent(null)
    setBoss(null)
    setBossPhaseIndex(0)
    setBossResult(null)
    setAppliedBossPenalty(null)
    setView('risk')
    setNotice('')

    // No pop-up Events/caution interruptions in the middle of a Chain.
    if (getActiveChainBeat(nextDirector) || nextDirector.pendingBossPenalty) return
    // Safety-driven legacy caution events still work if AI is unavailable.
    // Optional creative AI events are generated at eligible intervals only.
    const caution = maybeCreateCautionEvent(nextDirector, nextPlayerIndex)
    if (caution) {
      setPendingEvent(caution)
      setView('event')
      return
    }
    if (!eventRollIsDue(nextDirector)) return

    const candidates = eligibleDirectorCards(null, nextDirector, nextPlayerIndex)
    const epoch = ++aiEpoch.current
    const abort = new AbortController()
    aiEventAbort.current = abort
    aiBusyRef.current = true
    setAiEventBusy(true)
    setAiBusy(true)
    const event = await requestAIEvent(nextDirector, nextPlayerIndex, candidates, {signal:abort.signal})
    if (epoch !== aiEpoch.current) return
    aiEventAbort.current = null
    aiBusyRef.current = false
    setAiEventBusy(false)
    setAiBusy(false)
    if (event) {
      setPendingEvent(event)
      setView('event')
      sound('reveal')
    }
    // Failure or invalid AI mechanics: simply continue with the normal turn.
  }

  async function beginBoss(nextDirector:DirectorState) {
    // The existing safe local finale is retained as a fail-open fallback.
    // Never change a phase after users have started the Boss.
    const epoch=++bossEpoch.current
    setDirectorState({ ...nextDirector, scenePlan:null, chainSession:null })
    setBoss({ ...buildBossSession(nextDirector),challengerIndex:currentPlayerIndex })
    setBossPhaseIndex(0)
    setBossResult(null)
    setBossBusy(true)
    setCurrentDirectorCard(null)
    setCurrentRisk(null)
    setCurrentTargetIndex(null)
    setRenderedText('')
    setCurrentModifiers([])
    setView('boss')
    sound('reveal')
    const generated=await requestAIBoss(nextDirector,{timeoutMs:8500})
    if(epoch!==bossEpoch.current)return
    if(generated)setBoss({ ...generated,challengerIndex:currentPlayerIndex })
    setBossBusy(false)
  }

  function completeCurrent(skipped: boolean) {
    if (!settings || !directorState || !currentDirectorCard) return
    const base = tickEffects(directorState)
    const resolvedRisk = currentDirectorCard.risk
    const nextDirector = completeTurn(
      base,
      currentDirectorCard,
      currentPlayerIndex,
      currentTargetIndex,
      resolvedRisk,
      skipped,
      currentModifiers.map((item) => item.label),
    )

    if (!skipped && bossIsReady(nextDirector)
        && !nextDirector.pendingBossPenalty
        && !getActiveStoryBeat(nextDirector) && Math.random() < 0.5) {
      void beginBoss(nextDirector)
      return
    }

    const nextPlayer = (currentPlayerIndex + 1) % settings.players.length
    prepareNextTurn(nextDirector, nextPlayer)
    sound('tap')
  }

  function acceptEvent() {
    if (!directorState || !pendingEvent) return
    setDirectorState(recordEventDecision(directorState, pendingEvent, true))
    setView('risk')
    sound('reveal')
  }

  function skipEvent() {
    if (!directorState || !pendingEvent) return
    setDirectorState(recordEventDecision(directorState, pendingEvent, false))
    setPendingEvent(null)
    setView('risk')
    sound('tap')
  }

  function resolveBoss(outcome:'won'|'lost',reason:BossLossReason|null=null) {
    if(!boss||!settings||!directorState||bossBusy||view!=='boss')return
    bossEpoch.current += 1
    setBossBusy(false)
    const challengerIndex = boss.challengerIndex ?? currentPlayerIndex
    const nextDirector=settleBoss(directorState,boss,outcome,challengerIndex,reason)
    const result:BossResult={
      outcome,reason:outcome==='lost'?reason:null,challengerIndex,
      penalty:outcome==='lost'?nextDirector.pendingBossPenalty??null:null,
    }
    setDirectorState(nextDirector)
    setBossResult(result)
    setView('boss-result')
    sound('reveal')
  }

  function nextBossPhase() {
    if (!boss || !settings || !directorState || bossBusy) return
    if (bossPhaseIndex < boss.phases.length - 1) {
      setBossPhaseIndex((index) => index + 1)
      sound('reveal')
      return
    }
    resolveBoss('won')
  }

  function continueAfterBoss() {
    if(!settings||!directorState||!bossResult||view!=='boss-result')return
    const nextPlayer=(bossResult.challengerIndex+1)%settings.players.length
    void prepareNextTurn(directorState,nextPlayer)
    sound('tap')
  }

  function backToSetup() {
    stopPendingAI()
    if (settings) {
      setDraftPlayers(settings.players.map((player) => ({
        name: player.name,
        gender: player.gender,
        pairingPreference: player.pairingPreference ?? 'any',
      })))
      setScenario(settings.scenario)
      setSexStartState(settings.sexStartState)
    }
    setScreen('setup')
  }

  function newGameFromScratch() {
    stopPendingAI()
    clearV09Game()
    setSettings(null)
    setDirectorState(null)
    setCurrentDirectorCard(null)
    setPendingEvent(null)
    setBoss(null)
    setBossResult(null)
    setAppliedBossPenalty(null)
    setNotice('')
    setScreen('setup')
  }

  if (screen === 'age') {
    return (
      <main className="app-shell center-screen">
        <section className="age-screen">
          <div className="brand-mark">БЕЗ ФИЛЬТРОВ</div>
          <h1>Риск выбираешь ты.<br />Карту — игра.</h1>
          <p className="lead">18+. Каждая сессия запоминает ваши решения и сама повышает ставки.</p>
          <div className="age-orb">18+</div>
          <p className="safety-note">Любую карту можно пропустить. Пропуск и границы никогда не считаются «трусостью».</p>
          <button className="primary-button" onClick={() => setScreen('setup')}>Мне есть 18</button>
        </section>
      </main>
    )
  }

  if (screen === 'handover' && preparedPlayers) {
    const player = preparedPlayers[boundaryStep]
    return (
      <main className="app-shell center-screen">
        <section className="handover-screen">
          <div className="brand-mark">ЛИЧНО</div>
          <h1>Передай телефон<br />{player?.name}</h1>
          <p>Предыдущие ответы скрыты. Сейчас настраиваются только личные границы этого игрока.</p>
          <button className="primary-button" onClick={() => setScreen('boundaries')}>Я {player?.name}</button>
        </section>
      </main>
    )
  }

  if (screen === 'boundaries' && preparedPlayers) {
    const player = preparedPlayers[boundaryStep]
    return (
      <main className="app-shell setup-shell boundary-shell">
        <header className="setup-header">
          <div>
            <div className="brand-mark">СЕКС · ГРАНИЦЫ</div>
            <h1>{player?.name}</h1>
          </div>
          <span className="mini-18">18+</span>
        </header>
        <p className="boundary-intro">Отметь только для себя. Второй игрок не увидит несовпавшие ответы.</p>
        <section className="setup-block boundary-list">
          {boundaryOrder.map((tag) => (
            <div className="boundary-row" key={tag}>
              <strong>{boundaryLabels[tag]}</strong>
              <div className="boundary-options">
                {(Object.keys(boundaryChoiceLabels) as BoundaryChoice[]).map((choice) => (
                  <button
                    type="button"
                    key={choice}
                    className={boundaryChoices[tag] === choice ? 'active' : ''}
                    onClick={() => setBoundaryChoices((value) => ({ ...value, [tag]: choice }))}
                  >
                    {boundaryChoiceLabels[choice]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>
        <button className="primary-button start-button" onClick={saveBoundaryStep}>
          {boundaryStep < preparedPlayers.length - 1 ? 'Сохранить и передать' : 'Сохранить и начать'}
        </button>
      </main>
    )
  }

  if (screen === 'setup') {
    return (
      <main className="app-shell setup-shell">
        <header className="setup-header">
          <div>
            <div className="brand-mark">БЕЗ ФИЛЬТРОВ</div>
            <h1>Настрой игру</h1>
          </div>
          <span className="mini-18">18+</span>
        </header>

        {savedGame && (
          <button className="resume-card" onClick={resumeGame}>
            <span>Продолжить</span>
            <strong>{scenarioMeta[savedGame.settings.scenario].title}</strong>
            <small>{savedGame.settings.players.map((player) => player.name).join(' · ')} · ход {savedGame.director.turnsPlayed + 1}</small>
          </button>
        )}

        <section className="setup-block players-block">
          <div className="block-title"><h2>Игроки</h2><span>{draftPlayers.length}/6</span></div>
          <div className="player-list">
            {draftPlayers.map((player, index) => (
              <div className="player-entry" key={index}>
                <div className="player-row">
                  <span className="player-index">{String(index + 1).padStart(2, '0')}</span>
                  <input value={player.name} maxLength={18} onChange={(event: ChangeEvent<HTMLInputElement>) => updatePlayerName(index, event.target.value)} aria-label={`Имя игрока ${index + 1}`} />
                  <div className="gender-toggle" aria-label={`Пол игрока ${index + 1}`}>
                    <button type="button" className={player.gender === 'male' ? 'active' : ''} onClick={() => updatePlayerGender(index, 'male')}>М</button>
                    <button type="button" className={player.gender === 'female' ? 'active' : ''} onClick={() => updatePlayerGender(index, 'female')}>Ж</button>
                  </div>
                  {draftPlayers.length > 2 && <button type="button" className="remove-button" onClick={() => removePlayer(index)} aria-label="Удалить игрока">×</button>}
                </div>
                {groupScenario && (
                  <label className="pairing-preference">
                    <span>Близкие задания</span>
                    <select value={player.pairingPreference} onChange={(event: ChangeEvent<HTMLSelectElement>) => updatePlayerPreference(index, event.target.value as PairingPreference)}>
                      {(Object.keys(pairingLabels) as PairingPreference[]).map((value) => <option key={value} value={value}>{pairingLabels[value]}</option>)}
                    </select>
                  </label>
                )}
              </div>
            ))}
          </div>
          {groupScenario && draftPlayers.length < 6 && <button type="button" className="text-button" onClick={addPlayer}>+ добавить игрока</button>}
        </section>

        <section className="setup-block">
          <div className="block-title"><h2>Режим</h2><span>сложность выбирается каждым ходом</span></div>
          <div className="scenario-grid">
            {scenarioOrder.map((item) => (
              <button
                type="button"
                key={item}
                className={`scenario-card ${scenario === item ? 'active' : ''}`}
                onClick={() => { setScenario(item); setNotice(''); sound('tap') }}
              >
                <span className="scenario-icon">{scenarioMeta[item].icon}</span>
                <strong>{scenarioMeta[item].title}</strong>
                <small>{scenarioMeta[item].description}</small>
              </button>
            ))}
          </div>
        </section>

        {scenario === 'sex' && (
          <section className="setup-block">
            <div className="block-title"><h2>Как начинаете</h2><span>по умолчанию — в одежде</span></div>
            <div className="start-state-grid">
              {(Object.keys(sexStartLabels) as SexStartState[]).map((state) => (
                <button
                  type="button"
                  key={state}
                  className={sexStartState === state ? 'active' : ''}
                  onClick={() => setSexStartState(state)}
                >
                  {sexStartLabels[state]}
                </button>
              ))}
            </div>
            <p className="setup-hint no-indent">После старта каждый игрок отдельно отметит сексуальные границы. Совпадения останутся скрыты внутри Director.</p>
          </section>
        )}

        <section className="director-note">
          <strong>🔥 вместо Light / Hot / Hard</strong>
          <span>На каждом ходу сначала выбираешь риск, а уже потом узнаёшь — Правда или Действие. Director запоминает последствия и строит продолжение.</span>
        </section>

        {notice && <div className="notice">{notice}</div>}
        <button className="primary-button start-button" onClick={requestStart}>Начать · {scenarioMeta[scenario].title}</button>
      </main>
    )
  }

  if (!settings || !directorState || !currentPlayer) return null

  const riskChooserName = pendingEvent?.partnerChoosesRisk
    ? settings.players[(currentPlayerIndex + 1) % settings.players.length]?.name
    : currentPlayer.name
  const minimumRisk: RiskLevel = pendingEvent?.id === 'double-stake' ? 2 : pendingEvent?.forcedMinimumRisk ?? 1

  return (
    <main className="app-shell game-shell game-v09">
      <header className="game-header">
        <button type="button" className="ghost-button" onClick={backToSetup}>← настройки</button>
        <span>{scenarioMeta[settings.scenario].title}</span>
        <button type="button" className="ghost-button" onClick={newGameFromScratch}>сброс</button>
      </header>

      <section className="turn-area">
        {directorState.activeEffects.length > 0 && (
          <div className="effect-strip">
            {directorState.activeEffects.map((effect) => <span key={effect.id}>{effect.label}</span>)}
          </div>
        )}
        {directorState.leaderIndex !== null && (
          <div className="effect-strip"><span>♛ {settings.players[directorState.leaderIndex]?.name} ведёт</span></div>
        )}

        {view !== 'boss' && view !== 'boss-result' && (
          <>
            <div className="turn-label">ХОД {String(directorState.turnsPlayed + 1).padStart(2, '0')}</div>
            <h1 className="current-player">{currentPlayer.name}</h1>
          </>
        )}

        {view === 'event' && pendingEvent && (
          <section className="event-card">
            <div className="event-kicker">{pendingEvent.aiGenerated ? '✦ AI EVENT' : 'БЕЗ ФИЛЬТРОВ'}</div>
            <h2>{pendingEvent.title}</h2>
            <p>{pendingEvent.description}</p>
            <button type="button" className="primary-button" onClick={acceptEvent}>Принято</button>
             <div className="secondary-actions one-action">
               <button type="button" onClick={skipEvent}>Пропустить событие</button>
             </div>
          </section>
        )}

        {view === 'risk' && (
          <section className="risk-panel">
            {directorState.pendingBossPenalty && (
              <div className="boss-stakes-notice" role="status">
                <strong>☠ ПРОИГРАННЫЙ BOSS · ШТРАФ</strong>
                <p>{settings.players[directorState.pendingBossPenalty.playerIndex]?.name}: {directorState.pendingBossPenalty.label}</p>
                {settings.scenario==='sex' && <small>Отказ от любого действия и остановка близости всегда возможны.</small>}
              </div>
            )}
            <p className="choice-kicker">{pendingEvent?.partnerChoosesRisk ? `риск выбирает ${riskChooserName}` : 'выбери риск'}</p>
            <h2>Карту увидишь<br />после выбора.</h2>
            <div className="risk-buttons">
              {([1, 2, 3] as RiskLevel[]).map((risk) => (
                <button
                  type="button"
                  key={risk}
                  className={`risk-button risk-${risk}`}
                  disabled={risk < minimumRisk || aiBusy}
                  onClick={() => chooseRisk(risk)}
                  aria-label={`Риск ${risk}`}
                >
                  <strong>{'🔥'.repeat(risk)}</strong>
                  {pendingEvent?.id === 'double-stake' && risk === 2 && <small>2 условия</small>}
                  {pendingEvent?.id === 'double-stake' && risk === 3 && <small>без гарантии</small>}
                </button>
              ))}
            </div>
            <p className="risk-hint" role="status">{aiBusy
              ? aiEventBusy ? 'AI Director придумывает неожиданное событие…' : 'AI Director выбирает карточку…'
              : 'Огонь определяет риск хода. Стадию сессии Director держит скрытой.'}</p>
            {aiEventBusy && (
              <div className="secondary-actions one-action">
                <button type="button" onClick={stopPendingAI}>Играть дальше без ожидания</button>
              </div>
            )}
          </section>
        )}

        {view === 'card' && currentDirectorCard && (
          <section className={`game-card ${currentDirectorCard.type === 'dare' ? 'dare-card' : 'truth-card'}`}>
            <div className="card-glow" />
            <div className="card-topline">
              <span>{currentDirectorCard.type === 'truth' ? 'ПРАВДА' : 'ДЕЙСТВИЕ'}</span>
              <span>{'🔥'.repeat(currentDirectorCard.risk)}</span>
            </div>
            {currentTarget && <div className="target-chip">с {currentTarget.name}</div>}
            {appliedBossPenalty && (
              <div className="boss-stakes-notice boss-stakes-inline">
                <strong>☠ ШТРАФНЫЙ ХОД</strong>
                <p>{appliedBossPenalty.label}</p>
              </div>
            )}
            {chainCaption(directorState!) && (
              <div className="chain-caption">
                <strong>✦ AI CHAIN · {chainCaption(directorState!)?.title} · {chainCaption(directorState!)?.step}/4</strong>
                {chainCaption(directorState!)?.line && settings.scenario !== 'sex'
                  && <small>{chainCaption(directorState!)?.line}</small>}
              </div>
            )}
            {aiWasUsed && aiIntro && !chainCaption(directorState!) && <p className="ai-intro">✦ AI DIRECTOR · {aiIntro}</p>}
            <p className="card-text">{renderedText}</p>
            {currentModifiers.length > 0 && (
              <div className="modifier-stack">
                {currentModifiers.map((modifier) => (
                  <div className="modifier-card" key={modifier.id}>
                    <span>{modifier.id.startsWith('ai-') ? '✦ AI-УСЛОВИЕ' : 'УСЛОВИЕ'}</span>
                    <strong>{modifier.label}</strong>
                    <small>{modifier.description}</small>
                  </div>
                ))}
              </div>
            )}
            <p className="pass-copy">Пропуск не влияет на скрытую оценку осторожности.</p>
            <button type="button" className="primary-button card-next" onClick={() => completeCurrent(false)}>Выполнено <span>→</span></button>
            <div className="secondary-actions one-action">
              <button type="button" onClick={() => completeCurrent(true)}>Пропустить</button>
            </div>
          </section>
        )}

        {view === 'boss' && boss && (
          <section className="boss-card">
            {bossBusy ? (
              <>
                <div className="boss-kicker">✦ AI BOSS EVENT</div>
                <h2>Кульминация партии</h2>
                <p>Director связывает уже сыгранные ходы в финальное событие…</p>
                <button type="button" className="primary-button" onClick={() => {
                  bossEpoch.current += 1
                  setBossBusy(false)
                }}>Начать без ожидания</button>
              </>
            ) : (
              <>
                <div className="boss-kicker">{boss.aiGenerated ? '✦ AI BOSS EVENT' : '🔥 БЕЗ ФИЛЬТРОВ 🔥'}</div>
                <h2>{boss.title}</h2>
                <div className="boss-stakes-notice">
                  <strong>НА КОНУ · {settings.players[boss.challengerIndex??currentPlayerIndex]?.name}</strong>
                  <p>Три фазы. Победа — в статистику. Провал или отказ — поражение.</p>
                  <p>{bossPenaltyFor(directorState,boss,boss.challengerIndex??currentPlayerIndex).label}</p>
                </div>
                <div className="boss-progress">{bossPhaseIndex + 1} / {boss.phases.length}</div>
                {boss.phaseCaptions?.[bossPhaseIndex] && settings.scenario!=='sex'
                  && <small className="boss-caption">{boss.phaseCaptions[bossPhaseIndex]}</small>}
                <p>{boss.phases[bossPhaseIndex]}</p>
                <button type="button" className="primary-button" onClick={nextBossPhase}>
                  {bossPhaseIndex < boss.phases.length - 1 ? 'Фаза выполнена' : 'Boss побеждён'}
                </button>
                <div className="secondary-actions boss-failure-actions">
                  <button type="button" onClick={() => resolveBoss('lost','failed')}>Не справился</button>
                  <button type="button" onClick={() => resolveBoss('lost','forfeit')}>Сдаться — поражение</button>
                </div>
              </>
            )}
          </section>
        )}

        {view === 'boss-result' && bossResult && (
          <section className="boss-card boss-result-card">
            <div className="boss-kicker">{bossResult.outcome==='won'?'✦ ПОБЕДА':'☠ ПОРАЖЕНИЕ'}</div>
            <h2>{bossResult.outcome==='won'?'BOSS ПОВЕРЖЕН':'BOSS ВЫИГРАЛ'}</h2>
            <p className="boss-result-player">{settings.players[bossResult.challengerIndex]?.name}</p>
            {bossResult.outcome==='lost' && (
              <div className="boss-stakes-notice" role="status">
                <strong>ШТРАФ ЗА ПРОИГРЫШ</strong>
                <p>{bossResult.penalty?.label??'Поражение записано в статистику.'}</p>
                <small>{bossResult.reason==='forfeit'
                  ? 'Отказ записан как поражение Boss.'
                  : 'Невыполненная фаза записана как поражение Boss.'}</small>
                {settings.scenario==='sex' && <small>Никакого обязательного секса или нового физического действия.</small>}
              </div>
            )}
            {bossResult.outcome==='won' && <p>Три фазы пройдены. Победа записана в статистику.</p>}
            <div className="boss-score" aria-label="Статистика Boss">
              <span>ПОБЕДЫ: {directorState.bossScore?.[bossResult.challengerIndex]?.wins??0}</span>
              <span>ПОРАЖЕНИЯ: {directorState.bossScore?.[bossResult.challengerIndex]?.losses??0}</span>
            </div>
            <button type="button" className="primary-button" onClick={continueAfterBoss}>Продолжить игру</button>
          </section>
        )}

        {notice && <div className="notice compact">{notice}</div>}
      </section>

      <footer className="players-strip" aria-label="Игроки">
        {settings.players.map((player, index) => (
          <span key={`${player.name}-${index}`} className={index === currentPlayerIndex ? 'active' : ''}>{player.name}</span>
        ))}
      </footer>
    </main>
  )
}

export default App
