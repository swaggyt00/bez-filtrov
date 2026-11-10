import { expect, test, type Page } from '@playwright/test'

const AI_ROUTE = '**/game/director'

// Existing game smoke tests must never depend on the external Groq uptime.
// AI success, invalid IDs and network loss are separately exercised below.
test.beforeEach(async ({ page }) => {
  await page.route(AI_ROUTE, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ selectedId:'invalid-ai-card', intro:'Do not show this.' }),
    })
  })
  // Keep unrelated browser tests deterministic and provider-independent.
  await page.route('**/game/event', async (route) => {
    await route.fulfill({status:503,contentType:'application/json',body:'{}'})
  })
})

async function enterSetup(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Мне есть 18' })).toBeVisible()
  await page.getByRole('button', { name: 'Мне есть 18' }).click()
  await expect(page.getByRole('heading', { name: 'Настрой игру' })).toBeVisible()
}

async function setTwoPlayerGenders(page: Page) {
  const toggles = page.locator('.gender-toggle')
  await toggles.nth(0).getByRole('button', { name: 'М', exact: true }).click()
  await toggles.nth(1).getByRole('button', { name: 'Ж', exact: true }).click()
}

async function chooseScenario(page: Page, title: string) {
  await page.locator('.scenario-card').filter({ hasText: title }).click()
}

async function startScenario(page: Page, title: string) {
  await page.getByRole('button', { name: `Начать · ${title}` }).click()
}

async function finishSexBoundaries(page: Page) {
  await expect(page.getByText('СЕКС · ГРАНИЦЫ')).toBeVisible()
  await page.getByRole('button', { name: 'Сохранить и передать' }).click()
  await expect(page.getByRole('heading', { name: /Передай телефон/ })).toBeVisible()
  await page.getByRole('button', { name: /Я Игрок 2/ }).click()
  await page.getByRole('button', { name: 'Сохранить и начать' }).click()
}

async function expectRiskScreen(page: Page) {
  await expect(page.getByText('Карту увидишь', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Риск 1' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Риск 2' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Риск 3' })).toBeVisible()
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
}

test('afterdark starts with two players directly on the risk screen', async ({ page }) => {
  await enterSetup(page)
  await setTwoPlayerGenders(page)
  await chooseScenario(page, 'После полуночи')
  await startScenario(page, 'После полуночи')

  await expect(page.locator('.game-header')).toContainText('После полуночи')
  await expectRiskScreen(page)
  await expectNoHorizontalOverflow(page)
})

test('party blocks two players and starts with three', async ({ page }) => {
  await enterSetup(page)
  await setTwoPlayerGenders(page)
  await chooseScenario(page, 'Компания')

  await startScenario(page, 'Компания')
  await expect(page.locator('.notice')).toContainText('нужно от 3 до 6 игроков')

  await page.getByRole('button', { name: '+ добавить игрока' }).click()
  await page.locator('.gender-toggle').nth(2).getByRole('button', { name: 'М', exact: true }).click()
  await startScenario(page, 'Компания')
  await expectRiskScreen(page)
  await expectNoHorizontalOverflow(page)
})

test('couple has no global heat or truth-dare choice', async ({ page }) => {
  await enterSetup(page)
  await setTwoPlayerGenders(page)
  await chooseScenario(page, 'Пара')

  await expect(page.getByText('Накал')).toHaveCount(0)
  await startScenario(page, 'Пара')
  await expectRiskScreen(page)
  await expect(page.getByRole('button', { name: 'Правда' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Действие' })).toHaveCount(0)
})

test('sex collects private boundaries and starts clothed by default', async ({ page }) => {
  await enterSetup(page)
  await setTwoPlayerGenders(page)
  await chooseScenario(page, 'Секс')
  await expect(page.locator('.start-state-grid button.active')).toHaveText('В одежде')

  await startScenario(page, 'Секс')
  await finishSexBoundaries(page)
  await expectRiskScreen(page)

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('bez-filtrov:game:v9') ?? 'null'))
  expect(stored.director.sessionStage).toBe(0)
  expect(stored.director.players.every((player: { clothing: string }) => player.clothing === 'clothed')).toBeTruthy()
})

test('risk reveal persists the already rendered card across resume', async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0
  })

  await enterSetup(page)
  await setTwoPlayerGenders(page)
  await chooseScenario(page, 'После полуночи')
  await startScenario(page, 'После полуночи')
  await page.getByRole('button', { name: 'Риск 1' }).click()

  const rendered = await page.locator('.card-text').innerText()
  expect(rendered.length).toBeGreaterThan(10)
  await expect(page.locator('.card-topline')).toContainText(/ПРАВДА|ДЕЙСТВИЕ/)

  await page.waitForFunction((expected) => {
    const raw = localStorage.getItem('bez-filtrov:game:v9')
    if (!raw) return false
    return JSON.parse(raw).renderedText === expected
  }, rendered)

  await page.reload()
  await page.getByRole('button', { name: 'Мне есть 18' }).click()
  await page.locator('button.resume-card').click()
  await expect(page.locator('.card-text')).toHaveText(rendered)
})


test('AI Director selects only a shortlisted card and persists its narration across resume', async ({ page }) => {
  await page.unroute(AI_ROUTE)
  await page.route(AI_ROUTE, async (route) => {
    const payload = route.request().postDataJSON()
    expect(payload.version).toBe(1)
    expect(payload.scenario).toBe('afterdark')
    expect(payload.stage).toBe(0)
    expect(payload.risk).toBe(1)
    expect(payload.candidates.length).toBeGreaterThan(1)
    expect(JSON.stringify(payload)).not.toContain('Игрок 1')
    expect(JSON.stringify(payload)).not.toContain('Игрок 2')
    expect(payload.candidates.every((item: {id:string}) => !('text' in item))).toBeTruthy()
    const last = payload.candidates[payload.candidates.length - 1]
    await route.fulfill({
      status:200,contentType:'application/json',
      body:JSON.stringify({selectedId:last.id,intro:'На этот раз игра приготовила кое-что интересное.'}),
    })
  })

  await enterSetup(page)
  await setTwoPlayerGenders(page)
  await chooseScenario(page, 'После полуночи')
  await startScenario(page, 'После полуночи')
  await page.getByRole('button', { name:'Риск 1' }).click()
  await expect(page.locator('.ai-intro')).toContainText('На этот раз игра приготовила кое-что интересное.')
  const cardText = await page.locator('.card-text').innerText()
  const saved=await page.evaluate(() => JSON.parse(localStorage.getItem('bez-filtrov:game:v9') ?? 'null'))
  expect(saved.aiWasUsed).toBe(true)
  expect(saved.currentDirectorCardId).toBeTruthy()
  expect(saved.aiIntro).toContain('На этот раз')

  await page.reload()
  await page.getByRole('button',{name:'Мне есть 18'}).click()
  await page.locator('button.resume-card').click()
  await expect(page.locator('.ai-intro')).toContainText('На этот раз')
  await expect(page.locator('.card-text')).toHaveText(cardText)
  await page.getByRole('button',{name:/Выполнено/}).click()
  await expectRiskScreen(page)
})


test('three-fire Director and AI never recycle a played card while fresh cards exist',async({page})=>{
  let firstId=''
  let attempts=0
  await page.unroute(AI_ROUTE)
  await page.route(AI_ROUTE,async route=>{
    attempts++
    const payload=route.request().postDataJSON()
    expect(payload.scenario).toBe('party')
    expect(payload.risk).toBe(3)
    expect(payload.candidates.length).toBeGreaterThan(1)
    expect(payload.candidates.every((entry:{id:string})=>entry.id.startsWith('v09-curated-party-'))).toBe(true)
    if(firstId)expect(payload.candidates.some((entry:{id:string})=>entry.id===firstId)).toBe(false)
    const selected=payload.candidates[0].id
    if(!firstId)firstId=selected
    await route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({selectedId:selected,intro:'Только честный высокий риск.'})})
  })
  await enterSetup(page)
  await setTwoPlayerGenders(page)
  await chooseScenario(page,'Компания')
  await startScenario(page,'Компания')
  await page.getByRole('button',{name:'+ добавить игрока'}).click()
  // The game setup can start with three only after adding a third participant.
  await page.locator('.gender-toggle').nth(2).getByRole('button',{name:'М',exact:true}).click()
  await startScenario(page,'Компания')
  await expectRiskScreen(page)
  await page.getByRole('button',{name:'Риск 3'}).click()
  await expect(page.locator('.card-text')).not.toBeEmpty()
  await expect(page.locator('.card-topline')).toContainText('🔥🔥🔥')
  const first=await page.evaluate(()=>JSON.parse(localStorage.getItem('bez-filtrov:game:v9')||'null')?.currentDirectorCardId)
  expect(first).toBe(firstId)
  await page.getByRole('button',{name:/Выполнено/}).click()
  await expectRiskScreen(page)
  await page.getByRole('button',{name:'Риск 3'}).click()
  await expect(page.locator('.card-text')).not.toBeEmpty()
  await expect(page.locator('.card-topline')).toContainText('🔥🔥🔥')
  const second=await page.evaluate(()=>JSON.parse(localStorage.getItem('bez-filtrov:game:v9')||'null')?.currentDirectorCardId)
  expect(second).not.toBe(firstId)
  expect(attempts).toBe(2)
})

test('a failed AI call still reveals a valid card without extra setup', async ({ page }) => {
  await page.unroute(AI_ROUTE)
  await page.route(AI_ROUTE, async (route) => route.abort('failed'))

  await enterSetup(page)
  await setTwoPlayerGenders(page)
  await chooseScenario(page, 'Пара')
  await startScenario(page, 'Пара')
  await page.getByRole('button', { name:'Риск 1' }).click()
  await expect(page.locator('.card-text')).not.toBeEmpty()
  await expect(page.locator('.ai-intro')).toHaveCount(0)
  await expect(page.locator('.card-topline')).toContainText('🔥')
  await page.getByRole('button', {name:/Выполнено/}).click()
  await expectRiskScreen(page)
})


test('AI writes a card-specific modifier, saves it and pauses twists on the next turn', async ({page}) => {
  await page.unroute(AI_ROUTE)
  let directorCalls=0
  let modifierCalls=0
  await page.route(AI_ROUTE,async route=>{
    directorCalls++
    const payload=route.request().postDataJSON()
    expect(payload.scenario).toBe('afterdark')
    expect(payload.stage).toBe(0)
    if(directorCalls===1){
      expect(payload.risk).toBe(2)
      expect(payload.allowCondition).toBe(true)
    }else{
      expect(payload.risk).toBe(3)
      expect(payload.allowCondition).toBe(false)
      expect(payload.recent.some((entry:{modifierCount?:number}) => entry.modifierCount===1)).toBe(true)
    }
    const selected=directorCalls===1
      ? payload.candidates.find((candidate:{id:string})=>candidate.id==='v09:afterdark-light-dare-015')
      : payload.candidates[0]
    expect(selected).toBeTruthy()
    await route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({
        selectedId:selected.id,intro:'Попробуем новый поворот игры.',
        addCondition:true,
      }),
    })
  })
  await page.route('**/game/modifier',async route=>{
    modifierCalls++
    const payload=route.request().postDataJSON()
    expect(payload.cardType).toBe('dare')
    expect(payload.scenario).toBe('afterdark')
    expect(payload.version).toBe(3)
    expect(payload.allowedAxes).toContain('sequence')
    expect(payload.allowedAxes).not.toContain('reaction')
    expect(payload.cardText.length).toBeGreaterThan(20)
    expect(JSON.stringify(payload)).not.toContain('Игрок 1')
    expect(JSON.stringify(payload)).not.toContain('Игрок 2')
    await route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({
        axis:'sequence',
        label:'ТРИ НОВЫХ АРГУМЕНТА',
        description:'Во время рекламы выбранного элемента ночи каждые пять секунд называй новое преимущество. Ни разу не повторяй прилагательные.',
      }),
    })
  })

  await enterSetup(page)
  await setTwoPlayerGenders(page)
  await chooseScenario(page,'После полуночи')
  await startScenario(page,'После полуночи')
  await page.getByRole('button',{name:'Риск 2'}).click()
  await expect(page.locator('.modifier-card')).toHaveCount(1)
  await expect(page.locator('.modifier-card span')).toContainText('AI-УСЛОВИЕ')
  await expect(page.locator('.modifier-card strong')).toHaveText('ТРИ НОВЫХ АРГУМЕНТА')
  const cardText=await page.locator('.card-text').innerText()
  await page.waitForFunction(()=>{
    const saved=JSON.parse(localStorage.getItem('bez-filtrov:game:v9')??'null')
    return saved?.currentModifiers?.[0]?.label==='ТРИ НОВЫХ АРГУМЕНТА'
  })
  await page.reload()
  await page.getByRole('button',{name:'Мне есть 18'}).click()
  await page.locator('button.resume-card').click()
  await expect(page.locator('.card-text')).toHaveText(cardText)
  await expect(page.locator('.modifier-card strong')).toHaveText('ТРИ НОВЫХ АРГУМЕНТА')
  await page.getByRole('button',{name:/Выполнено/}).click()
  await page.getByRole('button',{name:'Риск 3'}).click()
  await expect(page.locator('.card-text')).not.toBeEmpty()
  await expect(page.locator('.modifier-card')).toHaveCount(0)
  expect(directorCalls).toBe(2)
  expect(modifierCalls).toBe(1)
})


test('rejected AI creativity produces NO canned or decorative condition', async ({page}) => {
  await page.unroute(AI_ROUTE)
  await page.route(AI_ROUTE,async route=>{
    const request=route.request().postDataJSON()
    const selected=request.candidates.find((item:{id:string})=>item.id==='v09:afterdark-light-dare-015')
    expect(selected).toBeTruthy()
    await route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({selectedId:selected.id,intro:'Сложнее, но по делу.',addCondition:true})})
  })
  await page.route('**/game/modifier',async route=>{
    await route.fulfill({status:422,contentType:'application/json',
      body:JSON.stringify({error:'Не прошло проверку реальной сложности.'})})
  })
  await enterSetup(page)
  await setTwoPlayerGenders(page)
  await chooseScenario(page,'После полуночи')
  await startScenario(page,'После полуночи')
  await page.getByRole('button',{name:'Риск 2'}).click()
  await expect(page.locator('.card-text')).not.toBeEmpty()
  await expect(page.locator('.modifier-card')).toHaveCount(0)
  await expect(page.locator('.ai-intro')).toBeVisible()
})


test('AI Events use real turn mechanics and remember accepted events across reload',async({page})=>{
  await page.addInitScript(()=>{Math.random=()=>0})
  await page.unroute('**/game/event')
  let eventRequests=0
  let generatedMechanics:string[]=[]
  await page.route('**/game/event',async route=>{
    eventRequests++
    const data=route.request().postDataJSON()
    expect(data.version).toBe(1)
    expect(data.scenario).toBe('afterdark')
    expect(data.turnsPlayed).toBe(4)
    expect(data.recent).toHaveLength(4)
    expect(data.playersCount).toBe(2)
    expect(data.allowedMechanics).toContain('risk-handoff')
    expect(data.players[0].recentRisks).toContain(2)
    expect(JSON.stringify(data)).not.toContain('Игрок 1')
    expect(JSON.stringify(data)).not.toContain('Игрок 2')
    generatedMechanics=data.allowedMechanics.includes('truth-only')
      ?['risk-handoff','truth-only']:['risk-handoff']
    const description=generatedMechanics.includes('truth-only')
      ?'Следующий по кругу игрок выбирает уровень риска, а следующая карточка обязательно будет «Правда» — сменим темп уже сыгранных испытаний.'
      :'Следующий по кругу игрок выбирает уровень риска вместо текущего участника. Теперь решение о следующем ходе переходит соседу.'
    await route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({title:'Ночной захват управления',description,mechanics:generatedMechanics}),
    })
  })
  await enterSetup(page)
  await setTwoPlayerGenders(page)
  await chooseScenario(page,'После полуночи')
  await startScenario(page,'После полуночи')
  for(let i=0;i<4;i++){
    await page.getByRole('button',{name:'Риск 2'}).click()
    await expect(page.locator('.card-text')).toBeVisible()
    await page.getByRole('button',{name:/Выполнено/}).click()
  }
  await expect(page.locator('.event-card')).toBeVisible()
  await expect(page.locator('.event-kicker')).toContainText('AI EVENT')
  await expect(page.locator('.event-card h2')).toHaveText('Ночной захват управления')
  expect(eventRequests).toBe(1)
  await page.waitForFunction(()=>{
    const data=JSON.parse(localStorage.getItem('bez-filtrov:game:v9')??'null')
    return data?.pendingEvent?.aiGenerated===true&&data?.view==='event'
  })
  await page.reload()
  await page.getByRole('button',{name:'Мне есть 18'}).click()
  await page.locator('button.resume-card').click()
  await expect(page.locator('.event-card h2')).toHaveText('Ночной захват управления')
  await page.getByRole('button',{name:'Принято'}).click()
  await expect(page.getByText('риск выбирает',{exact:false})).toBeVisible()
  await page.waitForFunction(()=>{
    const data=JSON.parse(localStorage.getItem('bez-filtrov:game:v9')??'null')
    return data?.director?.eventHistory?.length===1
  })
  const afterAccept=await page.evaluate(()=>JSON.parse(localStorage.getItem('bez-filtrov:game:v9')??'null'))
  expect(afterAccept.director.eventHistory[0].accepted).toBe(true)
  expect(afterAccept.director.eventHistory[0].mechanics).toEqual(generatedMechanics)
  expect(afterAccept.director.lastEventTurn).toBe(4)
  await page.getByRole('button',{name:'Риск 1'}).click()
  await expect(page.locator('.card-text')).not.toBeEmpty()
  if(generatedMechanics.includes('truth-only')){
    await expect(page.locator('.card-topline')).toContainText('ПРАВДА')
  }
})

test('players can skip AI Events without punishment or stale event rules',async({page})=>{
  await page.addInitScript(()=>{Math.random=()=>0})
  await page.unroute('**/game/event')
  await page.route('**/game/event',async route=>{
    const data=route.request().postDataJSON()
    expect(data.allowedMechanics).toContain('risk-handoff')
    await route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({
        title:'Ночная смена рулевого',
        description:'Следующий по кругу участник получает право выбрать уровень риска для этого хода вместо текущего игрока; отказаться от события можно без последствий.',
        mechanics:['risk-handoff'],
      }),
    })
  })
  await enterSetup(page)
  await setTwoPlayerGenders(page)
  await chooseScenario(page,'После полуночи')
  await startScenario(page,'После полуночи')
  for(let i=0;i<4;i++){
    await page.getByRole('button',{name:'Риск 2'}).click()
    await expect(page.locator('.card-text')).toBeVisible()
    await page.getByRole('button',{name:/Выполнено/}).click()
  }
  await expect(page.locator('.event-card')).toBeVisible()
  await page.getByRole('button',{name:'Пропустить событие'}).click()
  await expectRiskScreen(page)
  await expect(page.getByText('риск выбирает',{exact:false})).toHaveCount(0)
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('bez-filtrov:game:v9')??'null'))
  expect(saved?.director?.eventHistory?.[0]?.accepted).toBe(false)
  expect(saved?.pendingEvent).toBeNull()
  await page.getByRole('button',{name:'Риск 1'}).click()
  await expect(page.locator('.card-text')).not.toBeEmpty()
})


test('slow AI event can be canceled instantly, and its late result is ignored',async({page})=>{
  await page.addInitScript(()=>{Math.random=()=>0})
  await page.unroute('**/game/event')
  let requests=0
  await page.route('**/game/event',async route=>{
    requests++
    await page.waitForTimeout(1100)
    try {
      await route.fulfill({status:200,contentType:'application/json',
        body:JSON.stringify({
          title:'Запоздалый переход инициативы',
          description:'Следующий игрок по кругу выбирает риск вместо текущего участника; порядок очередей остаётся прежним до завершения карточки.',
          mechanics:['risk-handoff'],
        })})
    }catch{
      // The user intentionally aborted the in-flight HTTP request.
    }
  })
  await enterSetup(page)
  await setTwoPlayerGenders(page)
  await chooseScenario(page,'После полуночи')
  await startScenario(page,'После полуночи')
  for(let i=0;i<4;i++){
    await page.getByRole('button',{name:'Риск 2'}).click()
    await expect(page.locator('.card-text')).toBeVisible()
    await page.getByRole('button',{name:/Выполнено/}).click()
  }
  await expect(page.getByRole('button',{name:'Играть дальше без ожидания'})).toBeVisible()
  await page.getByRole('button',{name:'Играть дальше без ожидания'}).click()
  await expect(page.getByRole('button',{name:'Риск 1'})).toBeEnabled()
  await page.waitForTimeout(1200)
  await expect(page.locator('.event-card')).toHaveCount(0)
  expect(requests).toBe(1)
  await page.getByRole('button',{name:'Риск 1'}).click()
  await expect(page.locator('.card-text')).not.toBeEmpty()
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('bez-filtrov:game:v9')??'null'))
  expect(saved?.pendingEvent).toBeNull()
})

test('AI Chain appears inline, survives reload, and a skip takes the nonpunitive branch',async({page})=>{
  await page.unroute(AI_ROUTE)
  let calls=0
  let openingChain=''
  await page.route(AI_ROUTE,async route=>{
    calls++
    const req=route.request().postDataJSON()
    expect(JSON.stringify(req)).not.toContain('Игрок 1')
    expect(JSON.stringify(req)).not.toContain('Игрок 2')
    const selected=req.candidates[0]
    expect(selected).toBeTruthy()
    const primary=selected.chains[0]
    if(calls===1)openingChain=primary
    const other=req.candidates.flatMap((c:{chains:string[]})=>c.chains)
      .find((chain:string)=>!selected.chains.includes(chain))??primary
    if(calls===2){
      expect(req.chainOutcomes).toEqual([{result:'skipped',openingChain}])
      expect(req.activeChain).toBeNull()
    }
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      selectedId:selected.id,intro:'Сегодня история получит продолжение.',addCondition:false,
      scenePlan:{beats:[
        {phase:'build',chain:primary,preferredType:'either'},
        {phase:'twist',chain:other,preferredType:'either'},
        {phase:'payoff',chain:primary,preferredType:'either'},
      ]},
      chainPlan:{
        title:'Ночная эстафета',
        beats:[
          {phase:'build',normalTarget:'opener',boldTarget:'first-target',
            line:'История возвращается к тому, кто начал этот раунд.'},
          {phase:'twist',normalTarget:'previous-actor',boldTarget:'previous-target',
            line:'Теперь положение участников в истории меняется.'},
          {phase:'payoff',normalTarget:'first-target',boldTarget:'opener',
            line:'Последний поворот возвращает нас к самому началу.'},
        ],
      },
    })})
  })
  await enterSetup(page)
  await setTwoPlayerGenders(page)
  await chooseScenario(page,'После полуночи')
  await startScenario(page,'После полуночи')
  await page.getByRole('button',{name:'Риск 2'}).click()
  await expect(page.locator('.chain-caption')).toContainText('Ночная эстафета')
  await expect(page.locator('.chain-caption')).toContainText('1/4')
  await expect(page.locator('.card-text')).not.toBeEmpty()
  await page.waitForFunction(()=>{
    const saved=JSON.parse(localStorage.getItem('bez-filtrov:game:v9')||'null')
    return saved?.director?.chainSession?.title==='Ночная эстафета'
  })
  await page.reload()
  await page.getByRole('button',{name:'Мне есть 18'}).click()
  await page.locator('button.resume-card').click()
  await expect(page.locator('.chain-caption')).toContainText('Ночная эстафета')
  await page.getByRole('button',{name:'Пропустить'}).click()
  await expectRiskScreen(page)
  await page.waitForFunction(()=>{
    const saved=JSON.parse(localStorage.getItem('bez-filtrov:game:v9')||'null')
    return saved?.director?.chainHistory?.at(-1)?.result==='skipped'
  })
  const afterSkip=await page.evaluate(()=>JSON.parse(localStorage.getItem('bez-filtrov:game:v9')||'null'))
  expect(afterSkip.director.chainSession).toBeNull()
  expect(afterSkip.director.scenePlan).toBeNull()
  expect(afterSkip.director.tension).toBe(0)
  await page.getByRole('button',{name:'Риск 2'}).click()
  await expect(page.locator('.card-text')).not.toBeEmpty()
  expect(calls).toBe(2)
})

test('Sex stage-0 🔥🔥🔥 remains safe when live AI returns 503',async({page})=>{
  await page.unroute(AI_ROUTE)
  let requests=0
  await page.route(AI_ROUTE,async route=>{
    requests++
    const request=route.request().postDataJSON()
    expect(request.scenario).toBe('sex')
    expect(request.stage).toBe(0)
    expect(request.risk).toBe(3)
    await route.fulfill({status:503,contentType:'application/json',
      body:JSON.stringify({error:'Временная недоступность AI-провайдера.'})})
  })
  await enterSetup(page)
  await setTwoPlayerGenders(page)
  await chooseScenario(page,'Секс')
  await startScenario(page,'Секс')
  await finishSexBoundaries(page)
  await page.getByRole('button',{name:'Риск 3'}).click()
  await expect(page.locator('.card-text')).not.toBeEmpty()
  await expect(page.locator('.card-topline')).toContainText('🔥🔥🔥')
  await expect(page.locator('.ai-intro')).toHaveCount(0)
  await expect(page.locator('.chain-caption')).toHaveCount(0)
  await expect(page.locator('.modifier-card')).toHaveCount(0)
  await page.waitForFunction(()=>{
    const s=JSON.parse(localStorage.getItem('bez-filtrov:game:v9')||'null')
    return s?.view==='card'&&s?.currentDirectorCardId
  })
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('bez-filtrov:game:v9')||'null'))
  expect(saved.aiWasUsed).toBe(false)
  expect(saved.director.sessionStage).toBe(0)
  expect(saved.currentRisk).toBe(3)
  expect(saved.director.scenePlan).toBeNull()
  expect(saved.director.chainSession??null).toBeNull()
  expect(requests).toBe(1)
  await page.getByRole('button',{name:/Выполнено/}).click()
  await expectRiskScreen(page)
})


async function primeEligibleBoss(page:Page) {
  await page.addInitScript(()=>{Math.random=()=>0})
  await page.unroute(AI_ROUTE)
  let openerChain='social'
  await page.route(AI_ROUTE,async route=>{
    const payload=route.request().postDataJSON()
    const selected=payload.candidates.find((c:{id:string})=>c.id==='v09:afterdark-light-dare-015')
      ??payload.candidates[0]
    openerChain=selected.chains[0]
    await route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({selectedId:selected.id,intro:'Начало финальной истории.',addCondition:false})})
  })
  await enterSetup(page)
  await setTwoPlayerGenders(page)
  await chooseScenario(page,'После полуночи')
  await startScenario(page,'После полуночи')
  await page.getByRole('button',{name:'Риск 2'}).click()
  await expect(page.locator('.card-text')).not.toBeEmpty()
  await page.evaluate((chain)=>{
    const key='bez-filtrov:game:v9'
    const saved=JSON.parse(localStorage.getItem(key)??'null')
    saved.director.sessionStage=2
    saved.director.tension=92
    saved.director.turnsPlayed=12
    saved.director.lastBossTurn=0
    saved.director.chainDepth=4
    saved.director.chainFamily=chain
    saved.director.scenePlan=null
    saved.director.chainSession=null
    saved.director.history=Array.from({length:4},(_,i)=>({
      cardId:'completed-boss-'+i,
      type:'dare',risk:2,
      playerIndex:i%2,targetIndex:(i+1)%2,
      chains:[chain],skipped:false,
    }))
    saved.director.chainHistory=[{
      title:'Ночная эстафета',turn:11,result:'finished',openingChain:chain,
    }]
    localStorage.setItem(key,JSON.stringify(saved))
  },openerChain)
  await page.reload()
  await page.getByRole('button',{name:'Мне есть 18'}).click()
  await page.locator('button.resume-card').click()
  await expect(page.locator('.card-text')).not.toBeEmpty()
}

test('AI Boss refusal records defeat and next-turn penalty after save and resume',async({page})=>{
  let bossCalls=0
  await page.route('**/game/boss',async route=>{
    bossCalls++
    const payload=route.request().postDataJSON()
    expect(payload.scenario).toBe('afterdark')
    expect(payload.stage).toBeGreaterThanOrEqual(2)
    expect(payload.playersCount).toBe(2)
    expect(payload.recent.length).toBeGreaterThanOrEqual(4)
    expect(payload.chainOutcomes.at(-1)?.result).toBe('finished')
    expect(payload.allowedMechanics[0]).toHaveLength(5)
    expect(payload.allowedMechanics[0]).toContain('volunteer-spotlight')
    expect(payload.allowedMechanics[1]).toContain('mask-swap')
    expect(payload.allowedMechanics[2]).toContain('midnight-verdict')
    expect(JSON.stringify(payload)).not.toContain('Игрок 1')
    expect(JSON.stringify(payload)).not.toContain('Ночная эстафета')
    await route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({
        title:'Возвращение ночного ведущего',
        phases:[
          {mechanic:'volunteer-spotlight',role:'last-actor',
            caption:'Прошлая история возвращается в неожиданном жанре.'},
          {mechanic:'mask-swap',role:'last-target',
            caption:'Теперь прежняя инициатива меняет хозяина.'},
          {mechanic:'midnight-verdict',role:'all',
            caption:'Финал собирает необычные моменты вечера.'},
        ],
      }),
    })
  })
  await primeEligibleBoss(page)
  await page.getByRole('button',{name:/Выполнено/}).click()
  await expect(page.locator('.boss-card h2')).toHaveText('Возвращение ночного ведущего')
  await expect(page.locator('.boss-kicker')).toContainText('AI BOSS EVENT')
  await expect(page.locator('.boss-progress')).toHaveText('1 / 3')
  await expect(page.locator('.boss-stakes-notice')).toContainText('НА КОНУ')
  await expect(page.locator('.boss-stakes-notice')).toContainText('Штрафный ход')
  const first=await page.locator('.boss-card > p').innerText()
  expect(first.length).toBeGreaterThan(40)
  await page.waitForFunction(()=>{
    const saved=JSON.parse(localStorage.getItem('bez-filtrov:game:v9')||'null')
    return saved?.boss?.aiGenerated===true&&saved?.view==='boss'
  })
  await page.reload()
  await page.getByRole('button',{name:'Мне есть 18'}).click()
  await page.locator('button.resume-card').click()
  await expect(page.locator('.boss-card h2')).toHaveText('Возвращение ночного ведущего')
  await expect(page.locator('.boss-card > p')).toHaveText(first)
  await page.getByRole('button',{name:'Фаза выполнена'}).click()
  await expect(page.locator('.boss-progress')).toHaveText('2 / 3')
  await expect(page.locator('.boss-card > p')).not.toHaveText(first)
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('bez-filtrov:game:v9')||'null')?.director?.tension)
  await page.getByRole('button',{name:'Сдаться — поражение'}).click()
  await expect(page.locator('.boss-result-card h2')).toHaveText('BOSS ВЫИГРАЛ')
  await expect(page.locator('.boss-result-card')).toContainText('ШТРАФ ЗА ПРОИГРЫШ')
  await expect(page.locator('.boss-result-card')).toContainText('ПОРАЖЕНИЯ: 1')
  await page.waitForFunction(()=>{
    const s=JSON.parse(localStorage.getItem('bez-filtrov:game:v9')||'null')
    return s?.director?.bossHistory?.at(-1)?.outcome==='lost'
      &&s?.director?.pendingBossPenalty?.type==='dare'
      &&s?.view==='boss-result'
  })
  await page.reload()
  await page.getByRole('button',{name:'Мне есть 18'}).click()
  await page.locator('button.resume-card').click()
  await expect(page.locator('.boss-result-card')).toContainText('ШТРАФ ЗА ПРОИГРЫШ')
  const result=await page.evaluate(()=>JSON.parse(localStorage.getItem('bez-filtrov:game:v9')||'null'))
  expect(result.director.tension).toBe(before)
  expect(result.director.bossHistory.at(-1).reason).toBe('forfeit')
  expect(result.director.bossHistory.at(-1).mechanics).toEqual([
    'volunteer-spotlight','mask-swap','midnight-verdict',
  ])
  expect(result.director.bossScore[0].losses).toBe(1)
  await page.getByRole('button',{name:'Продолжить игру'}).click()
  await expectRiskScreen(page)
  // The loser is player 0; player 1's normal turn happens first.
  await page.getByRole('button',{name:'Риск 1'}).click()
  await expect(page.locator('.card-text')).not.toBeEmpty()
  await page.getByRole('button',{name:/Выполнено/}).click()
  await expectRiskScreen(page)
  await expect(page.locator('.risk-panel .boss-stakes-notice')).toContainText('ШТРАФ')
  await page.getByRole('button',{name:'Риск 2'}).click()
  await expect(page.locator('.card-topline')).toContainText('ДЕЙСТВИЕ')
  await expect(page.locator('.boss-stakes-inline')).toContainText('ШТРАФНЫЙ ХОД')
  const penalized=await page.evaluate(()=>JSON.parse(localStorage.getItem('bez-filtrov:game:v9')||'null'))
  expect(penalized.director.pendingBossPenalty).toBeNull()
  expect(penalized.appliedBossPenalty?.type).toBe('dare')
  expect(penalized.currentRisk).toBe(2)
  expect(bossCalls).toBe(1)
})

test('an unavailable AI Boss immediately falls back to a playable local 3-phase finale',async({page})=>{
  await page.route('**/game/boss',async route=>{
    await route.fulfill({status:503,contentType:'application/json',
      body:JSON.stringify({error:'Provider cooldown'})})
  })
  await primeEligibleBoss(page)
  await page.getByRole('button',{name:/Выполнено/}).click()
  await expect(page.locator('.boss-card .boss-progress')).toHaveText('1 / 3')
  await expect(page.locator('.boss-card > p')).not.toBeEmpty()
  await expect(page.locator('.boss-kicker')).not.toContainText('AI BOSS EVENT')
  await page.waitForFunction(()=>{
    const s=JSON.parse(localStorage.getItem('bez-filtrov:game:v9')||'null')
    return s?.boss?.aiGenerated===false
  })
  await page.getByRole('button',{name:'Фаза выполнена'}).click()
  await expect(page.locator('.boss-progress')).toHaveText('2 / 3')
  await page.getByRole('button',{name:'Фаза выполнена'}).click()
  await expect(page.locator('.boss-progress')).toHaveText('3 / 3')
  await page.getByRole('button',{name:'Boss побеждён'}).click()
  await expect(page.locator('.boss-result-card h2')).toHaveText('BOSS ПОВЕРЖЕН')
  await expect(page.locator('.boss-result-card')).toContainText('ПОБЕДЫ: 1')
  await page.waitForFunction(()=>{
    const s=JSON.parse(localStorage.getItem('bez-filtrov:game:v9')||'null')
    return s?.director?.bossHistory?.at(-1)?.outcome==='won'
      &&s?.director?.bossScore?.[0]?.wins===1
  })
  const won=await page.evaluate(()=>JSON.parse(localStorage.getItem('bez-filtrov:game:v9')||'null'))
  expect(won.director.pendingBossPenalty??null).toBeNull()
  await page.getByRole('button',{name:'Продолжить игру'}).click()
  await expectRiskScreen(page)
})
