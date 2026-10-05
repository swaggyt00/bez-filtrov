import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { cards } from './data/cards'
import { availableCards, hydrateCardText, pickCardForTurn, validateScenarioPlayers } from './deck'
import { clearGame, loadGame, loadSettings, saveGame, saveSettings } from './storage'
import type {
  CardType,
  GameCard,
  GameSettings,
  GameStage,
  Heat,
  PairingPreference,
  PlayerGender,
  Scenario,
} from './types'

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
    description: 'Узнать друг друга лучше: смешное, личное, поцелуи и неудобная правда.',
    minPlayers: 2,
    maxPlayers: 2,
  },
  sex: {
    title: 'Секс',
    icon: '✦',
    description: 'Для двоих: от лёгкого напряжения до откровенных управляемых сценариев.',
    minPlayers: 2,
    maxPlayers: 2,
  },
  party: {
    title: 'Компания',
    icon: '◉',
    description: '3–6 игроков: выборы, флирт, подколы, алкоголь и реакции всей компании.',
    minPlayers: 3,
    maxPlayers: 6,
  },
  afterdark: {
    title: 'После полуночи',
    icon: '☾',
    description: '3–6 игроков: алкоголь, ночной трэш, стыд, одежда и странные задания.',
    minPlayers: 3,
    maxPlayers: 6,
  },
}

const heatMeta: Record<Heat, { title: string; short: string }> = {
  light: { title: 'Легко', short: '01' },
  hot: { title: 'Горячо', short: '02' },
  hard: { title: 'Жёстко', short: '03' },
}

const heatDescriptions: Record<Scenario, Record<Heat, string>> = {
  couple: {
    light: 'Смешное, привычки, приятные мелочи и лёгкая близость.',
    hot: 'Личнее: ревность, бывшие, границы, поцелуи и неловкие признания.',
    hard: 'Неприятная правда, уязвимость и очень прямые вопросы без разврата.',
  },
  sex: {
    light: 'Взгляд, массаж, шея, ухо и контакт, от которого становится теплее.',
    hot: 'Больше тела и напряжения. Почти переход за черту — но игра держит паузу.',
    hard: 'Прямой разврат, роли и короткие сексуальные сцены, после которых игра продолжается.',
  },
  party: {
    light: 'Юмор, выбор людей, подколы и лёгкие алкогольные задания.',
    hot: 'Больше флирта, неловких парных заданий, признаний и провокаций.',
    hard: 'Максимально смелая компания: личное, телесное и очень неудобные выборы.',
  },
  afterdark: {
    light: 'Алкоголь уже в игре: лёгкий трэш, абсурд и первые неловкие задания.',
    hot: 'Одежда, стыд, странные приказы и более смелые ночные челленджи.',
    hard: 'Бельё, раздевание и максимальный тусовочный трэш — без превращения в Секс.',
  },
}

const heatOrder: Heat[] = ['light', 'hot', 'hard']
const scenarioOrder: Scenario[] = ['couple', 'sex', 'party', 'afterdark']

const pairingLabels: Record<PairingPreference, string> = {
  any: 'со всеми',
  male: 'с мужчинами',
  female: 'с женщинами',
  none: 'ни с кем',
}

type Screen = 'age' | 'setup' | 'game'
type DraftPlayer = {
  name: string
  gender: PlayerGender | null
  pairingPreference: PairingPreference
}

function initialDraftPlayers(): DraftPlayer[] {
  const saved = loadSettings()
  if (saved?.players?.length >= 2) {
    return saved.players.map((player) => ({
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
  const previousSettings = loadSettings()
  const [screen, setScreen] = useState<Screen>('age')
  const [draftPlayers, setDraftPlayers] = useState<DraftPlayer[]>(initialDraftPlayers)
  const [scenario, setScenario] = useState<Scenario>(previousSettings?.scenario ?? 'sex')
  const [heat, setHeat] = useState<Heat>(previousSettings?.heat ?? 'hot')
  const [settings, setSettings] = useState<GameSettings | null>(null)
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0)
  const [usedCardIds, setUsedCardIds] = useState<string[]>([])
  const [turnsPlayed, setTurnsPlayed] = useState(0)
  const [stage, setStage] = useState<GameStage>('choice')
  const [currentCard, setCurrentCard] = useState<GameCard | null>(null)
  const [currentTargetIndex, setCurrentTargetIndex] = useState<number | null>(null)
  const [renderedText, setRenderedText] = useState('')
  const [notice, setNotice] = useState('')
  const audioRef = useRef<AudioContext | null>(null)
  const savedGame = useMemo(() => loadGame(), [screen])

  const currentPlayer = settings?.players[currentPlayerIndex]
  const groupScenario = scenario === 'party' || scenario === 'afterdark'
  const visibleCards = useMemo(
    () => cards.filter((card) => card.scenario === scenario && card.heat === heat),
    [scenario, heat],
  )
  const truthCount = visibleCards.filter((card) => card.type === 'truth').length
  const dareCount = visibleCards.filter((card) => card.type === 'dare').length

  useEffect(() => {
    if (screen !== 'game' || !settings) return
    saveGame({
      settings,
      currentPlayerIndex,
      usedCardIds,
      turnsPlayed,
      stage,
      currentCardId: currentCard?.id ?? null,
      currentTargetIndex,
      renderedText,
      notice,
      updatedAt: Date.now(),
    })
  }, [screen, settings, currentPlayerIndex, usedCardIds, turnsPlayed, stage, currentCard, currentTargetIndex, renderedText, notice])

  function sound(kind: 'tap' | 'reveal') {
    try {
      const ctx = audioRef.current ?? new window.AudioContext()
      audioRef.current = ctx
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = kind === 'reveal' ? 390 : 260
      gain.gain.setValueAtTime(0.0001, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.035, ctx.currentTime + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.1)
      osc.connect(gain).connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.11)
    } catch {
      // Sound is decorative and never blocks the game.
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

  function buildSettings(): GameSettings | null {
    const names = draftPlayers.map((player, index) => player.name.trim() || `Игрок ${index + 1}`)
    if (new Set(names.map((name) => name.toLocaleLowerCase('ru'))).size !== names.length) {
      setNotice('Имена игроков должны отличаться.')
      return null
    }
    if (draftPlayers.some((player) => !player.gender)) {
      setNotice('Укажи пол каждого игрока — он нужен, чтобы карточки попадали правильному человеку.')
      return null
    }

    const players = draftPlayers.map((player, index) => ({
      name: names[index],
      gender: player.gender as PlayerGender,
      pairingPreference: player.pairingPreference,
    }))
    const validation = validateScenarioPlayers(scenario, players)
    if (!validation.ok) {
      setNotice(validation.message)
      return null
    }

    return { players, scenario, heat }
  }

  function startGame() {
    const nextSettings = buildSettings()
    if (!nextSettings) return
    if (!availableCards(cards, nextSettings).length) {
      setNotice('В этой комбинации нет карточек. Это баг колоды, а не твоя проблема.')
      return
    }
    clearGame()
    saveSettings(nextSettings)
    setSettings(nextSettings)
    setCurrentPlayerIndex(0)
    setUsedCardIds([])
    setTurnsPlayed(0)
    setStage('choice')
    setCurrentCard(null)
    setCurrentTargetIndex(null)
    setRenderedText('')
    setNotice('')
    setScreen('game')
    sound('reveal')
  }

  function resumeGame() {
    const saved = loadGame()
    if (!saved) return
    const restoredCard = saved.currentCardId ? cards.find((card) => card.id === saved.currentCardId) ?? null : null
    setSettings(saved.settings)
    setDraftPlayers(saved.settings.players.map((player) => ({
      name: player.name,
      gender: player.gender,
      pairingPreference: player.pairingPreference ?? 'any',
    })))
    setScenario(saved.settings.scenario)
    setHeat(saved.settings.heat)
    setCurrentPlayerIndex(Math.min(saved.currentPlayerIndex, saved.settings.players.length - 1))
    setUsedCardIds(saved.usedCardIds ?? [])
    setTurnsPlayed(saved.turnsPlayed ?? 0)
    setCurrentCard(restoredCard)
    setCurrentTargetIndex(saved.currentTargetIndex ?? null)
    setRenderedText(restoredCard ? saved.renderedText : '')
    setStage(restoredCard && saved.stage === 'card' ? 'card' : 'choice')
    setNotice(saved.notice ?? '')
    setScreen('game')
  }

  function choose(type: CardType) {
    if (!settings) return
    let nextUsed = usedCardIds
    let result = pickCardForTurn(cards, settings, type, nextUsed, currentPlayerIndex)
    if (!result.card) {
      setNotice('Для этого игрока сейчас не нашлось подходящей карты. Попробуй другой тип или проверь настройки игроков.')
      return
    }

    if (result.recycled) {
      const bucketIds = new Set(availableCards(cards, settings, type).map((card) => card.id))
      nextUsed = nextUsed.filter((id) => !bucketIds.has(id))
      result = pickCardForTurn(cards, settings, type, nextUsed, currentPlayerIndex)
      setNotice(`${type === 'truth' ? 'Правды' : 'Действия'} этой колоды закончились — перемешал только её.`)
    } else {
      setNotice('')
    }

    if (!result.card) return
    setCurrentCard(result.card)
    setCurrentTargetIndex(result.targetIndex)
    setRenderedText(hydrateCardText(result.card.text, settings.players, currentPlayerIndex, result.targetIndex))
    setUsedCardIds([...nextUsed, result.card.id])
    setStage('card')
    sound('reveal')
  }

  function nextTurn() {
    if (!settings) return
    setCurrentPlayerIndex((index) => (index + 1) % settings.players.length)
    setTurnsPlayed((turns) => turns + 1)
    setCurrentCard(null)
    setCurrentTargetIndex(null)
    setRenderedText('')
    setStage('choice')
    setNotice('')
    sound('tap')
  }

  function reroll() {
    if (!currentCard) return
    choose(currentCard.type)
  }

  function backToSetup() {
    if (settings) {
      setDraftPlayers(settings.players.map((player) => ({
        name: player.name,
        gender: player.gender,
        pairingPreference: player.pairingPreference ?? 'any',
      })))
      setScenario(settings.scenario)
      setHeat(settings.heat)
    }
    setScreen('setup')
  }

  function newGameFromScratch() {
    clearGame()
    setSettings(null)
    setCurrentCard(null)
    setRenderedText('')
    setNotice('')
    setStage('choice')
    setScreen('setup')
  }

  if (screen === 'age') {
    return (
      <main className="app-shell center-screen">
        <section className="age-screen">
          <div className="brand-mark">БЕЗ ФИЛЬТРОВ</div>
          <h1>Правда.<br />Или действие.</h1>
          <p className="lead">18+. Для взрослых людей, которые сами выбрали зайти дальше обычных вопросов.</p>
          <div className="age-orb">18+</div>
          <p className="safety-note">Любую карту можно заменить или пропустить. Никаких объяснений не требуется.</p>
          <button className="primary-button" onClick={() => setScreen('setup')}>Мне есть 18</button>
        </section>
      </main>
    )
  }

  if (screen === 'setup') {
    return (
      <main className="app-shell setup-shell">
        <header className="setup-header">
          <div><div className="brand-mark">БЕЗ ФИЛЬТРОВ</div><h1>Кто играет?</h1></div>
          <span className="mini-18">18+</span>
        </header>

        {savedGame && (
          <button className="resume-card" onClick={resumeGame}>
            <span>Продолжить игру</span>
            <strong>{scenarioMeta[savedGame.settings.scenario].title} · {heatMeta[savedGame.settings.heat].title}</strong>
            <small>{savedGame.settings.players.map((player) => player.name).join(' · ')} · ход {savedGame.turnsPlayed + 1}</small>
          </button>
        )}

        <section className="setup-block players-block">
          <div className="block-title"><h2>Игроки</h2><span>{draftPlayers.length}/6</span></div>
          <div className="player-list">
            {draftPlayers.map((player, index) => (
              <div className="player-entry" key={index}>
                <div className="player-row">
                  <span className="player-index">{index + 1}</span>
                  <input value={player.name} maxLength={18} onChange={(event: ChangeEvent<HTMLInputElement>) => updatePlayerName(index, event.target.value)} aria-label={`Имя игрока ${index + 1}`} />
                  <div className="gender-toggle" aria-label={`Пол игрока ${index + 1}`}>
                    <button className={player.gender === 'male' ? 'active' : ''} onClick={() => updatePlayerGender(index, 'male')}>М</button>
                    <button className={player.gender === 'female' ? 'active' : ''} onClick={() => updatePlayerGender(index, 'female')}>Ж</button>
                  </div>
                  {draftPlayers.length > 2 && <button className="remove-button" onClick={() => removePlayer(index)} aria-label="Удалить игрока">×</button>}
                </div>
                {groupScenario && (
                  <label className="pairing-preference">
                    <span>Интимные задания</span>
                    <select
                      value={player.pairingPreference}
                      onChange={(event: ChangeEvent<HTMLSelectElement>) => updatePlayerPreference(index, event.target.value as PairingPreference)}
                      aria-label={`Интимные задания игрока ${index + 1}`}
                    >
                      {(Object.keys(pairingLabels) as PairingPreference[]).map((value) => (
                        <option key={value} value={value}>{pairingLabels[value]}</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            ))}
          </div>
          {groupScenario && draftPlayers.length < 6 && <button className="text-button" onClick={addPlayer}>+ добавить игрока</button>}
          {groupScenario && <p className="setup-hint">Эта настройка влияет только на близкие парные задания. Обычные вопросы и приколы остаются для всей компании.</p>}
        </section>

        <section className="setup-block">
          <div className="block-title"><h2>Сценарий</h2></div>
          <div className="scenario-grid">
            {scenarioOrder.map((item) => (
              <button key={item} className={`scenario-card ${scenario === item ? 'active' : ''}`} onClick={() => { setScenario(item); setNotice(''); sound('tap') }}>
                <span className="scenario-icon">{scenarioMeta[item].icon}</span>
                <strong>{scenarioMeta[item].title}</strong>
                <small>{scenarioMeta[item].description}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="setup-block">
          <div className="block-title"><h2>Накал</h2><span>три реально разных уровня</span></div>
          <div className="heat-list">
            {heatOrder.map((item) => (
              <button key={item} className={`heat-row heat-${item} ${heat === item ? 'active' : ''}`} onClick={() => { setHeat(item); setNotice(''); sound('tap') }}>
                <span className="heat-number">{heatMeta[item].short}</span>
                <span className="heat-copy"><strong>{heatMeta[item].title}</strong><small>{heatDescriptions[scenario][item]}</small></span>
                <span className="heat-dot" />
              </button>
            ))}
          </div>
          <div className="deck-size">В этой колоде: <strong>{truthCount} правд</strong> · <strong>{dareCount} действий</strong></div>
        </section>

        {notice && <div className="notice">{notice}</div>}
        <button className="primary-button start-button" onClick={startGame}>Начать · {scenarioMeta[scenario].title} · {heatMeta[heat].title}</button>
      </main>
    )
  }

  if (!settings || !currentPlayer) return null

  return (
    <main className={`app-shell game-shell game-${settings.heat}`}>
      <header className="game-header">
        <button className="ghost-button" onClick={backToSetup}>← настройки</button>
        <span>{scenarioMeta[settings.scenario].title} · {heatMeta[settings.heat].title}</span>
        <button className="ghost-button" onClick={newGameFromScratch}>сброс</button>
      </header>

      <section className="turn-area">
        <div className="turn-label">Ходит</div>
        <h1 className="current-player">{currentPlayer.name}</h1>
        <div className="gender-caption">{currentPlayer.gender === 'male' ? 'Мужчина' : 'Женщина'} · ход {turnsPlayed + 1}</div>

        {stage === 'choice' ? (
          <>
            <p className="choice-title">Правда или действие?</p>
            <div className="choice-buttons">
              <button className="truth-choice" onClick={() => choose('truth')}><span>П</span><strong>Правда</strong></button>
              <button className="dare-choice" onClick={() => choose('dare')}><span>Д</span><strong>Действие</strong></button>
            </div>
          </>
        ) : (
          <section className={`game-card ${currentCard?.type === 'dare' ? 'dare-card' : 'truth-card'}`}>
            <div className="card-topline">
              <span>{currentCard?.type === 'truth' ? 'ПРАВДА' : 'ДЕЙСТВИЕ'}</span>
              <span>{heatMeta[settings.heat].title.toUpperCase()}</span>
            </div>
            <p className="card-text">{renderedText}</p>
            <p className="pass-copy">Не хочешь — меняй или пропускай. Без оправданий.</p>
            <button className="primary-button" onClick={nextTurn}>Готово → следующий</button>
            <div className="secondary-actions">
              <button onClick={reroll}>Другая карта</button>
              <button onClick={nextTurn}>Пропустить</button>
            </div>
          </section>
        )}

        {notice && <div className="notice compact">{notice}</div>}
      </section>

      <footer className="players-strip">
        {settings.players.map((player, index) => (
          <span key={`${player.name}-${index}`} className={index === currentPlayerIndex ? 'active' : ''}>{player.name}</span>
        ))}
      </footer>
    </main>
  )
}

export default App
