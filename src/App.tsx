import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { cards } from './data/cards'
import { eligibleTargetIndices, hydrateCardText, renderCardText, validateScenarioPlayers } from './deck'
import { loadSettings as loadLegacySettings } from './storage'
import type { GameCard, PairingPreference, Player, PlayerGender, Scenario } from './types'
import { adaptLegacyDeck } from './v09/legacy-adapter'
import { bossIsReady, completeTurn, createDirectorState, pickDirectorCard, tickEffects } from './v09/director'
import { chooseEventForTurn } from './v09/events'
import { pickTurnModifiers } from './v09/modifiers'
import { buildBossSession } from './v09/bosses'
import { clearV09Game, loadV09Game, loadV09Settings, saveV09Game, saveV09Settings } from './v09/storage'
import type {
  BoundaryChoice,
  BoundaryTag,
  BossSession,
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

const directorDeck = adaptLegacyDeck(cards)
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
  const [notice, setNotice] = useState('')
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

  function beginGame(players: Player[], mutuallyAllowedBoundaries: BoundaryTag[]) {
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
    setPendingEvent(null)
    setBoss(null)
    setBossPhaseIndex(0)
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
    setCurrentDirectorCard(saved.currentDirectorCardId ? directorById.get(saved.currentDirectorCardId) ?? null : null)
    setCurrentRisk(saved.currentRisk)
    setCurrentTargetIndex(saved.currentTargetIndex)
    setRenderedText(saved.renderedText)
    setCurrentModifiers(saved.currentModifiers ?? [])
    setPendingEvent(saved.pendingEvent)
    setBoss(saved.boss)
    setBossPhaseIndex(saved.bossPhaseIndex ?? 0)
    setNotice('')
    setScreen('game')
  }

  function eligibleDirectorCards(event: DirectorEvent | null) {
    if (!settings || !directorState) return [] as DirectorCard[]
    const actor = settings.players[currentPlayerIndex]
    const base = directorDeck.filter((directorCard) => {
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
          ? eligibleTargetIndices(source, settings.players, currentPlayerIndex)
          : settings.players.map((_, index) => index).filter((index) => index !== currentPlayerIndex)
        if (targets.length === 0) return false
      }

      if (event?.forcedChain && !directorCard.chains.includes(event.forcedChain)) return false
      if (event?.forcedBoundary && !directorCard.requires?.boundaries?.includes(event.forcedBoundary)) return false
      return true
    })

    if (base.length) return base

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
        ? eligibleTargetIndices(source, settings.players, currentPlayerIndex).length > 0
        : settings.players.length > 1
    })
  }

  function chooseRisk(risk: RiskLevel) {
    if (!settings || !directorState) return

    const candidates = eligibleDirectorCards(pendingEvent)
    const picked = pickDirectorCard(candidates, directorState, currentPlayerIndex, null, risk)

    if (!picked) {
      setNotice('Director не нашёл логичную карту для текущего состояния. Это нужно поправить в разметке.')
      return
    }

    const source = picked.card.sourceCardId ? sourceById.get(picked.card.sourceCardId) : null
    if (picked.card.sourceCardId && !source) {
      setNotice('Не найден исходник карточки.')
      return
    }

    const targets = source
      ? eligibleTargetIndices(source, settings.players, currentPlayerIndex)
      : picked.card.targetRequired === false
        ? []
        : settings.players.map((_, index) => index).filter((index) => index !== currentPlayerIndex)
    const targetIndex = targets.length ? targets[Math.floor(Math.random() * targets.length)] : null
    const finalText = source
      ? renderCardText({ ...source, text: picked.card.text }, settings.players, currentPlayerIndex, targetIndex)
      : hydrateCardText(picked.card.text, settings.players, currentPlayerIndex, targetIndex)

    let forcedModifierCount = pendingEvent?.modifierCount ?? 0
    if (pendingEvent?.id === 'double-stake' && risk === 2) forcedModifierCount = 2
    if (pendingEvent?.id === 'double-stake' && risk === 3) forcedModifierCount = 0

    setCurrentDirectorCard(picked.card)
    setCurrentRisk(risk)
    setCurrentTargetIndex(targetIndex)
    setRenderedText(finalText)
    setCurrentModifiers(pickTurnModifiers(picked.card, directorState, risk, forcedModifierCount))
    setPendingEvent(null)
    setView('card')
    setNotice('')
    sound('reveal')
  }

  function prepareNextTurn(nextDirector: DirectorState, nextPlayerIndex: number) {
    const event = chooseEventForTurn(nextDirector, nextPlayerIndex)
    setDirectorState(nextDirector)
    setCurrentPlayerIndex(nextPlayerIndex)
    setCurrentDirectorCard(null)
    setCurrentRisk(null)
    setCurrentTargetIndex(null)
    setRenderedText('')
    setCurrentModifiers([])
    setPendingEvent(event)
    setBoss(null)
    setBossPhaseIndex(0)
    setView(event ? 'event' : 'risk')
    setNotice('')
  }

  function completeCurrent(skipped: boolean) {
    if (!settings || !directorState || !currentDirectorCard || currentRisk === null) return
    const base = tickEffects(directorState)
    const nextDirector = completeTurn(
      base,
      currentDirectorCard,
      currentPlayerIndex,
      currentTargetIndex,
      currentRisk,
      skipped,
    )

    if (!skipped && bossIsReady(nextDirector) && Math.random() < 0.5) {
      setDirectorState(nextDirector)
      setBoss(buildBossSession(nextDirector))
      setBossPhaseIndex(0)
      setCurrentDirectorCard(null)
      setCurrentRisk(null)
      setCurrentTargetIndex(null)
      setRenderedText('')
      setCurrentModifiers([])
      setView('boss')
      sound('reveal')
      return
    }

    const nextPlayer = (currentPlayerIndex + 1) % settings.players.length
    prepareNextTurn(nextDirector, nextPlayer)
    sound('tap')
  }

  function acceptEvent() {
    if (!directorState) return
    setDirectorState({ ...directorState, lastEventTurn: directorState.turnsPlayed })
    setView('risk')
    sound('reveal')
  }

  function nextBossPhase() {
    if (!boss || !settings || !directorState) return
    if (bossPhaseIndex < boss.phases.length - 1) {
      setBossPhaseIndex((index) => index + 1)
      sound('reveal')
      return
    }

    const resetDirector: DirectorState = {
      ...directorState,
      lastBossTurn: directorState.turnsPlayed,
      tension: Math.max(8, directorState.tension - 28),
      chainDepth: 0,
    }
    const nextPlayer = (currentPlayerIndex + 1) % settings.players.length
    prepareNextTurn(resetDirector, nextPlayer)
    sound('tap')
  }

  function backToSetup() {
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
    clearV09Game()
    setSettings(null)
    setDirectorState(null)
    setCurrentDirectorCard(null)
    setPendingEvent(null)
    setBoss(null)
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
    ? settings.players.find((_, index) => index !== currentPlayerIndex)?.name
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

        {view !== 'boss' && (
          <>
            <div className="turn-label">ХОД {String(directorState.turnsPlayed + 1).padStart(2, '0')}</div>
            <h1 className="current-player">{currentPlayer.name}</h1>
          </>
        )}

        {view === 'event' && pendingEvent && (
          <section className="event-card">
            <div className="event-kicker">БЕЗ ФИЛЬТРОВ</div>
            <h2>{pendingEvent.title}</h2>
            <p>{pendingEvent.description}</p>
            <button type="button" className="primary-button" onClick={acceptEvent}>Принято</button>
          </section>
        )}

        {view === 'risk' && (
          <section className="risk-panel">
            <p className="choice-kicker">{pendingEvent?.partnerChoosesRisk ? `риск выбирает ${riskChooserName}` : 'выбери риск'}</p>
            <h2>Карту увидишь<br />после выбора.</h2>
            <div className="risk-buttons">
              {([1, 2, 3] as RiskLevel[]).map((risk) => (
                <button
                  type="button"
                  key={risk}
                  className={`risk-button risk-${risk}`}
                  disabled={risk < minimumRisk}
                  onClick={() => chooseRisk(risk)}
                  aria-label={`Риск ${risk}`}
                >
                  <strong>{'🔥'.repeat(risk)}</strong>
                  {pendingEvent?.id === 'double-stake' && risk === 2 && <small>2 условия</small>}
                  {pendingEvent?.id === 'double-stake' && risk === 3 && <small>без гарантии</small>}
                </button>
              ))}
            </div>
            <p className="risk-hint">Огонь определяет риск хода. Стадию сессии Director держит скрытой.</p>
          </section>
        )}

        {view === 'card' && currentDirectorCard && (
          <section className={`game-card ${currentDirectorCard.type === 'dare' ? 'dare-card' : 'truth-card'}`}>
            <div className="card-glow" />
            <div className="card-topline">
              <span>{currentDirectorCard.type === 'truth' ? 'ПРАВДА' : 'ДЕЙСТВИЕ'}</span>
              <span>{currentRisk ? '🔥'.repeat(currentRisk) : ''}</span>
            </div>
            {currentTarget && <div className="target-chip">с {currentTarget.name}</div>}
            <p className="card-text">{renderedText}</p>
            {currentModifiers.length > 0 && (
              <div className="modifier-stack">
                {currentModifiers.map((modifier) => (
                  <div className="modifier-card" key={modifier.id}>
                    <span>УСЛОВИЕ</span>
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
            <div className="boss-kicker">🔥 БЕЗ ФИЛЬТРОВ 🔥</div>
            <h2>{boss.title}</h2>
            <div className="boss-progress">{bossPhaseIndex + 1} / {boss.phases.length}</div>
            <p>{boss.phases[bossPhaseIndex]}</p>
            <button type="button" className="primary-button" onClick={nextBossPhase}>
              {bossPhaseIndex < boss.phases.length - 1 ? 'Следующая фаза' : 'Завершить'}
            </button>
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
