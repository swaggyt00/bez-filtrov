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
      ? payload.candidates.find((candidate:{id:string})=>candidate.id==='v09:afterdark-light-dare-002')
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
        description:'Во время рекламы каждые пять секунд называй новое преимущество перекуса и ни разу не повторяй прилагательные.',
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
    const selected=request.candidates.find((item:{id:string})=>item.id==='v09:afterdark-light-dare-002')
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
