import { authored, authoredDeck } from './factory'

const truth = authoredDeck({
  scenario: 'sex', heat: 'light', type: 'truth', cards: [
    authored('Что сильнее действует на тебя в начале: долгий взгляд или случайное прикосновение?', 'tension', 'look-vs-touch', 'choice', 'intimate-choice', { purpose: 'choice' }),
    authored('Какое место на шее или лице тебе приятнее всего целовать?', 'kiss', 'favorite-gentle-kiss-area', 'desire', 'flirt', { purpose: 'desire' }),
    authored('Тебе больше нравится, когда близость начинается медленно или внезапно?', 'pace', 'slow-vs-sudden-start', 'choice', 'conversation', { purpose: 'choice' }),
    authored('Какой комплимент от партнёра быстрее всего сбивает тебе мысли?', 'compliments', 'compliment-that-distracts', 'desire', 'flirt', { purpose: 'desire' }),
    authored('Есть запах, который у тебя прочно связан с близостью?', 'senses', 'scent-linked-to-closeness', 'story', 'conversation', { purpose: 'story' }),
    authored('Что тебе приятнее: массаж плеч, спины или рук?', 'massage', 'favorite-massage-area', 'choice', 'physical', { purpose: 'choice' }),
    authored('Какой поцелуй тебе нравится больше: короткий и неожиданный или долгий и спокойный?', 'kiss', 'short-vs-long-kiss', 'choice', 'flirt', { purpose: 'choice' }),
    authored('Тебе легче самому начать флирт или дождаться первого шага от партнёра?', 'initiative', 'who-starts-flirt', 'confession', 'conversation', { purpose: 'confession' }),
    authored('Какая деталь одежды на партнёре кажется тебе особенно привлекательной?', 'clothing', 'attractive-clothing-detail', 'desire', 'flirt', { purpose: 'desire' }),
    authored('Что тебе приятнее: когда партнёр говорит что-то на ухо или просто молча приближается?', 'whisper', 'whisper-vs-silence', 'choice', 'tension', { purpose: 'choice' }),
    authored('Какой момент перед поцелуем нравится тебе больше самого поцелуя?', 'anticipation', 'favorite-pre-kiss-moment', 'story', 'tension', { purpose: 'curiosity' }),
    authored('Какое прикосновение кажется тебе самым успокаивающим, но всё равно интимным?', 'touch', 'calm-intimate-touch', 'desire', 'physical', { purpose: 'desire' }),
    authored('Тебе нравится, когда партнёр смотрит прямо в глаза во время близкого контакта?', 'eye-contact', 'eye-contact-during-closeness', 'confession', 'flirt', { purpose: 'confession' }),
    authored('Что сильнее создаёт настроение: музыка, свет или полная тишина?', 'atmosphere', 'mood-maker-choice', 'choice', 'conversation', { purpose: 'choice' }),
    authored('Есть ли у тебя любимый способ обнять партнёра, когда хочется быть особенно близко?', 'hug', 'favorite-close-hug', 'desire', 'physical', { purpose: 'desire' }),
    authored('Что тебе нравится больше: самому притянуть партнёра ближе или когда это делают с тобой?', 'control', 'pull-close-give-or-receive', 'choice', 'intimate-choice', { purpose: 'choice' }),
    authored('Какая часть флирта для тебя важнее всего: слова, взгляд или прикосновения?', 'flirt', 'flirt-language-choice', 'choice', 'conversation', { purpose: 'choice' }),
    authored('Какая твоя любимая мелочь, которая превращает обычный вечер в более интимный?', 'ritual', 'small-intimacy-ritual', 'story', 'conversation', { purpose: 'story' }),
    authored('Тебе приятнее сидеть вплотную или держать небольшую дистанцию и растягивать ожидание?', 'distance', 'close-vs-distance-tension', 'choice', 'tension', { purpose: 'choice' }),
    authored('Какой жест партнёра почти всегда означает для тебя «сейчас будет интересно»?', 'signals', 'signal-of-interest', 'story', 'flirt', { purpose: 'story' }),
  ],
})

const dare = authoredDeck({
  scenario: 'sex', heat: 'light', type: 'dare', cards: [
    authored('Смотри {{other.dat}} в глаза двадцать секунд. Никаких слов и телефона.', 'eye-contact', 'silent-twenty-second-stare', 'timed', 'tension', { pairing: 'any' }),
    authored('Сделай {{other.dat}} медленный массаж плеч до следующего хода.', 'massage', 'slow-shoulder-massage', 'timed', 'physical', { pairing: 'any' }),
    authored('Поцелуй {{other.acc}} в шею один раз и сразу отстранись.', 'kiss', 'single-neck-kiss-light', 'direct', 'tension', { pairing: 'any' }),
    authored('Легко прикуси мочку уха {{other.gen}} и сразу прошепчи любой комплимент.', 'ear', 'earlobe-bite-plus-compliment', 'direct', 'flirt', { pairing: 'any' }),
    authored('Положи ладони {{other.gen}} себе на талию и останьтесь так десять секунд.', 'touch', 'hands-on-waist-light', 'timed', 'physical', { pairing: 'any' }),
    authored('Проведи пальцами по волосам {{other.gen}} и закончи прикосновение на шее.', 'touch', 'hair-to-neck-touch', 'direct', 'physical', { pairing: 'any' }),
    authored('Скажи {{other.dat}} на ухо одну фразу, от которой тебе самому было бы приятно смутиться.', 'whisper', 'whisper-blushing-line', 'direct', 'flirt', { pairing: 'any' }),
    authored('Пусть {{other.nom}} выберет: поцелуй в лоб, щёку или шею. Выполни выбор медленно.', 'choice', 'partner-picks-gentle-kiss', 'partner-choice', 'physical', { pairing: 'any' }),
    authored('Обними {{other.acc}} сзади и не отпускай пятнадцать секунд.', 'hug', 'back-hug-fifteen', 'timed', 'physical', { pairing: 'any' }),
    authored('Проведи большим пальцем по нижней губе {{other.gen}}, затем убери руку. Больше ничего.', 'tension', 'thumb-over-lip', 'direct', 'tension', { pairing: 'any' }),
    authored('Сядьте так близко, чтобы колени касались друг друга. Оставайтесь так один ход.', 'closeness', 'knees-touch-one-turn', 'timed', 'physical', { pairing: 'any' }),
    authored('Назови {{other.dat}} одну деталь внешности, на которую сегодня уже несколько раз смотрел.', 'appearance', 'admit-looked-at-detail', 'confession', 'flirt', { pairing: 'any' }),
    authored('Пусть {{other.nom}} закроет глаза. Коснись его или её лица в трёх местах и попроси угадать порядок.', 'senses', 'three-face-touches', 'direct', 'physical', { pairing: 'any' }),
    authored('Медленно проведи ладонью от плеча {{other.gen}} до кисти и переплети пальцы.', 'touch', 'shoulder-to-hand-touch', 'direct', 'physical', { pairing: 'any' }),
    authored('Поцелуй {{other.acc}} так, чтобы поцелуй закончился раньше, чем хотелось бы.', 'kiss', 'stop-kiss-early', 'direct', 'tension', { pairing: 'any' }),
    authored('Пусть {{other.nom}} выберет песню. Один куплет танцуйте максимально близко, но без спешки.', 'dance', 'close-dance-one-verse', 'timed', 'flirt', { pairing: 'any' }),
    authored('Скажи {{other.dat}} одну вещь, которую особенно нравится чувствовать рядом с ним или ней.', 'confession', 'say-favorite-feeling-near-partner', 'confession', 'conversation', { pairing: 'any' }),
    authored('Легко поцелуй {{other.acc}} у линии челюсти и сразу вернись на своё место.', 'kiss', 'jawline-kiss-return', 'direct', 'tension', { pairing: 'any' }),
    authored('Возьми {{other.acc}} за подбородок, удерживай взгляд пять секунд и отпусти первым.', 'eye-contact', 'chin-hold-five-seconds', 'timed', 'tension', { pairing: 'any' }),
    authored('Выберите по одной вещи, которая сегодня делает друг друга особенно привлекательными. Говоришь первым.', 'attraction', 'mutual-attraction-detail', 'confession', 'flirt', { pairing: 'any' }),
  ],
})

export const sexLightCards = [...truth, ...dare]
