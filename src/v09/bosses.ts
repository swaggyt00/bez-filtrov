import type { BossFamily, BossSession, DirectorState } from './types'

function familyForState(state: DirectorState): BossFamily {
  if (state.scenario === 'party') return 'social'
  if (state.scenario === 'afterdark') return 'chaos'
  if (state.scenario === 'couple') return 'connection'

  const chain = state.chainFamily
  if (chain === 'oral') return 'oral'
  if (chain === 'position') return state.sessionStage >= 4 ? 'sex' : 'position'
  if (chain === 'edging') return 'edging'
  if (chain === 'dom-sub') return 'dom-sub'
  if (chain === 'fetish') return 'fetish'
  if (chain === 'undress') return 'undress'
  if (chain === 'control') return 'control'
  return state.sessionStage >= 4 ? 'sex' : 'tease'
}

function sexPhases(family: BossFamily, stage: number) {
  if (family === 'undress') return [
    'Не меняйте текущую дистанцию. По очереди снимите по одной вещи, не торопясь.',
    'Следующую минуту один ведёт, второй только следует выбранному темпу и положению.',
    'Закончите сцену длинным телесным контактом и останьтесь в новом состоянии одежды.',
  ]
  if (family === 'control' || family === 'dom-sub') return [
    'Текущий ведущий выбирает положение партнёра и задаёт правила на одну минуту.',
    'Добавьте одно ограничение: без рук, закрытые глаза или запрет менять положение.',
    'Поменяйтесь властью ещё на одну минуту, не обнуляя уже начатую сцену.',
  ]
  if (family === 'oral' && stage >= 3) return [
    'Начните с медленного орального teasing без спешки и без резкой смены положения.',
    'Следующую минуту получающий полностью задаёт темп и может в любой момент остановить или замедлить.',
    'Завершите ещё одной минутой в том же направлении или остановитесь, сохранив текущую близость.',
  ]
  if (family === 'edging' && stage >= 3) return [
    'Начните прямую стимуляцию и подведите партнёра близко к пику, затем остановитесь.',
    'После короткой паузы повторите цикл, но темп теперь задаёт получающий.',
    'Третий цикл длится до выбранной вами общей точки остановки — без обязательной кульминации.',
  ]
  if ((family === 'position' || family === 'sex') && stage >= 4) return [
    'Продолжите из текущего положения две минуты, не меняя выбранный темп без команды партнёра.',
    'Смените контроль: тот, кто до этого следовал, теперь выбирает темп и глубину следующей фазы.',
    'Перейдите только в одну логичную соседнюю позу и продолжайте ещё две минуты.',
  ]
  if (family === 'fetish') return [
    'Оставьте текущую сцену и добавьте один заранее разрешённый фетиш-элемент.',
    'Усильте его одним совместимым ограничением или сменой контроля.',
    'Закончите ветку, не вводя новую тему: ещё одна минута только вокруг выбранного фетиша.',
  ]
  return [
    'Продолжайте текущую сцену одну минуту, не меняя её основную идею.',
    'Добавьте одно новое ограничение или смените того, кто ведёт.',
    'Ещё одну минуту усиливайте только уже начатую ветку — без случайного переключения темы.',
  ]
}

export function buildBossSession(state: DirectorState): BossSession {
  const family = familyForState(state)

  if (state.scenario === 'sex') {
    return {
      id: `sex-${family}-${state.turnsPlayed}`,
      family,
      title: family === 'sex' ? 'КУЛЬМИНАЦИЯ' : family.toUpperCase(),
      phases: sexPhases(family, state.sessionStage),
    }
  }

  if (state.scenario === 'couple') {
    return {
      id: `couple-${state.turnsPlayed}`,
      family: 'connection',
      title: 'БЕЗ ФИЛЬТРОВ',
      phases: [
        'Каждый называет одну вещь, которую давно хотел сказать партнёру, но откладывал.',
        'Выберите один из двух ответов и превратите его в конкретное совместное действие прямо сейчас.',
        'Закончите минутой близкого контакта без телефонов и смены темы.',
      ],
    }
  }

  if (state.scenario === 'party') {
    return {
      id: `party-${state.turnsPlayed}`,
      family: 'social',
      title: 'ОБЩИЙ РАУНД',
      phases: [
        'Каждый одновременно указывает на игрока, который чаще всех выбирал безопасный путь.',
        'Выбранный игрок получает риск от группы и выполняет одну карту с дополнительным условием.',
        'После этого право выбрать риск следующему игроку переходит человеку справа.',
      ],
    }
  }

  return {
    id: `afterdark-${state.turnsPlayed}`,
    family: 'chaos',
    title: 'НОЧНОЙ БЕСПРЕДЕЛ',
    phases: [
      'Выберите одного ведущего на ближайшие две минуты.',
      'Ведущий задаёт группе одно телесное или одежное ограничение в рамках уже выбранного режима.',
      'Следующая карта выполняется с этим правилом, после чего ведущий меняется.',
    ],
  }
}
