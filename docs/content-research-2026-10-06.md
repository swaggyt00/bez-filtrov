# Конкурентный корпус карточек — 6 октября 2026

## Правило v0.8

Основная колода больше не использует `original-editorial`.
Каждая карточка v0.8 обязана иметь внешний `sourceRef` из публичной
подборки Truth or Dare. CI падает, если в колоду снова попадает
`original-editorial`.

Это не дословный импорт чужих текстов. Публичные подборки используются
как корпус игровых идей, механик и уровней интенсивности; русские тексты
адаптируются под структуру «Без фильтров», роли игроков, согласие,
ограничения режимов и отсутствие рейтингов.

## Статус полного ребилда

Контентный ребилд завершён: **1440 / 1440 карточек** находятся в новой v0.8-базе.

| Режим | Light | Hot | Hard | Всего карточек |
| --- | ---: | ---: | ---: | ---: |
| Пара | 120 | 120 | 120 | 360 |
| Секс | 120 | 140 | 160 | 420 |
| Компания | 100 | 100 | 100 | 300 |
| После полуночи | 120 | 120 | 120 | 360 |
| **Итого** | **460** | **480** | **500** | **1440** |

Все четыре режима прошли повторную классификацию по сценарию и уровню.
Точные дубли между бакетами удалены. Основная v0.8-колода не содержит
`original-editorial` и speech-only Dare.

## Источники корпуса

| Источник | Что берём в корпус |
| --- | --- |
| PsyCat Games | party Truth, пантомима, движение, одежда, смешные испытания |
| Table Party | timed/no-equipment/group/phone dares, координация и сценки |
| Openers | silly/performance/group dares, неловкие признания |
| Truth or Dare Go | easy/funny/embarrassing/flirty Truth и easy/bold/phone/creative Dare |
| AllPartyGames | крупный общий party-корпус |
| TruthOrDareGame | friendship/performance/social patterns |
| Play Spin Wheel | короткие классические Truth/Dare |
| Party Games by Guessy | party memories, фото, причёски, танцы |
| Xdares: Adult | funny/naughty/spicy/deep/drinking/social-risk patterns |
| Xdares: Dirty | mild → medium → spicy → extreme adult dare escalation |
| Xdares: Couples | relationship, romance, intimacy and couple escalation |
| Wargamer | romantic/flirty/spicy adult Truth/Dare and group-party mechanics |
| Smush | mild/medium/wild couple mechanics |
| Spiced Couple | romantic/spicy couple dares and relationship prompts |
| The Foreplay Game | level-based couple escalation from warm-up to explicit |

## Классификация перед импортом

Карточка сначала классифицируется, затем попадает в колоду.

### Компания

- **Light** — смешные признания, координация, пантомима, подиум,
  предметы, простые телефонные и групповые испытания.
- **Hot** — флирт, неловкие свидания, дейтинг/телефон, танцы,
  мягкие поцелуи и контакт с согласием, обычные глотки напитка.
- **Hard** — социальная неловкость и экспозиция, более смелый
  флирт, телефон, одежда/стайлинг, контакт и групповой контроль.
- Sex-only темы запрещены автоматическим аудитом для всего Party.

### После полуночи

- **Light** — алкогольная атмосфера, ночной абсурд, временные правила,
  телефон, музыка и лёгкая неловкость.
- **Hot** — более сильный флирт, одежда, танцы, поцелуи, доверие,
  парные и групповые night-party механики.
- **Hard** — максимум тусовочного трэша: снятие/обмен допустимых
  слоёв одежды, более неловкий контакт, временный контроль и хаос.
- Прямые сексуальные действия по-прежнему не относятся к Afterdark.

### Пара

- **Light** — воспоминания, забота, юмор, ритуалы, свидания.
- **Hot** — флирт, поцелуи, привлекательность, ревность, границы.
- **Hard** — уязвимость, сложные разговоры, доверие и более сильная
  романтическая перчинка, но без прямых Sex-сцен.

### Секс

- **Light** — взгляд, поцелуи, массаж, безопасные прикосновения,
  ожидание и обратная связь.
- **Hot** — больше телесности, фантазий, контроля, игрушек как темы,
  но без прямой sexualAction-сцены.
- **Hard** — единственный бакет, где разрешены прямые сексуальные
  действия. Такие карточки обязаны иметь ограниченную сцену и
  `endCondition`.

## Dare quality gate

Dare не считается действием, если оно сводится к разговору:
«расскажи», «назови», «объясни», «скажи группе», «защити позицию»
и похожие формулировки без конкретного игрового действия.

После полного прохода:
- удалён `original-editorial` из типов и registry;
- пересобраны `Couple Light / Hot / Hard`;
- пересобраны `Party Light / Hot / Hard`;
- пересобраны `Afterdark Light / Hot / Hard`;
- пересобраны `Sex Light / Hot / Hard`;
- заменены speech-only и idea-only Dare;
- удалены точные дубли между всеми 12 бакетами;
- сексуальные семьи, ошибочно лежавшие в Party, удалены;
- прямые sexualAction-сцены разрешены только в `Sex / Hard` и имеют `endCondition`;
- старые pre-v8 сессии инвалидированы и не могут вернуть удалённый текст;
- внутри новой v8-сессии уже показанный текст карточки сохраняется без повторной рандомизации;
- сохранённая партия использует ключ `bez-filtrov:game:v8`.

## Проверки

CI проверяет:
- ровно 1440 карточек и размеры каждого бакета;
- уникальные ID и тексты;
- валидные внешние `sourceRef`;
- отсутствие `original-editorial`;
- перспективу текущего игрока и gender-safe шаблоны;
- speech-only Dare;
- границы Party vs Sex;
- алкогольные ограничения;
- Sex/Hard sexualAction и обязательный `endCondition`;
- разнообразие тем, coreIdea и interaction;
- рендер шаблонов и E2E/build.


## Последний зелёный прогон

На полном контентном состоянии перед этим документирующим коммитом:
- `v0.8 provenance + deck tests` — passed;
- `v0.8 content corpus checks` — passed;
- структурный аудит — **1440 карточек passed**;
- редакторский аудит — passed;
- Playwright — **5/5 passed**.


## Concrete-action QA pass

Manual QA removed abstract prop/symbol/scale Dare patterns and tightened Sex wording to explicit, concrete adult actions. The audit now blocks regressions of those patterns.
