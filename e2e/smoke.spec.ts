import { expect, test, type Page } from '@playwright/test'

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
