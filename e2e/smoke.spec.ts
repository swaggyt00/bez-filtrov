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

async function chooseHeat(page: Page, title: string) {
  await page.locator('.heat-row').filter({ hasText: title }).click()
}

async function startScenario(page: Page, title: string) {
  await page.getByRole('button', { name: `Начать · ${title}` }).click()
  await expect(page.locator('.game-header')).toContainText(title)
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
}

test('afterdark starts with two players and choice heading is readable', async ({ page }) => {
  await enterSetup(page)
  await setTwoPlayerGenders(page)
  await chooseScenario(page, 'После полуночи')
  await chooseHeat(page, 'Жёстко')

  await expect(page.locator('.deck-size')).toContainText('60 правд')
  await expect(page.locator('.deck-size')).toContainText('60 действий')
  await startScenario(page, 'После полуночи')

  await expect(page.locator('.choice-title')).toHaveText(/Правда\s*или действие\?/)
  await expectNoHorizontalOverflow(page)
})

test('party blocks two players and starts with three', async ({ page }) => {
  await enterSetup(page)
  await setTwoPlayerGenders(page)
  await chooseScenario(page, 'Компания')

  await page.getByRole('button', { name: 'Начать · Компания' }).click()
  await expect(page.locator('.notice')).toContainText('нужно от 3 до 6 игроков')

  await page.getByRole('button', { name: '+ добавить игрока' }).click()
  await page.locator('.gender-toggle').nth(2).getByRole('button', { name: 'М', exact: true }).click()
  await startScenario(page, 'Компания')
  await expectNoHorizontalOverflow(page)
})

for (const title of ['Пара', 'Секс']) {
  test(`${title} starts for a male/female pair`, async ({ page }) => {
    await enterSetup(page)
    await setTwoPlayerGenders(page)
    await chooseScenario(page, title)
    await startScenario(page, title)
    await expect(page.locator('.choice-buttons')).toBeVisible()
  })
}

test('temporary duration resolves once and survives resume', async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0
  })

  await enterSetup(page)
  await setTwoPlayerGenders(page)
  await chooseScenario(page, 'После полуночи')
  await chooseHeat(page, 'Жёстко')
  await startScenario(page, 'После полуночи')

  await page.locator('.dare-choice').click()

  let rendered = ''
  for (let attempt = 0; attempt < 60; attempt += 1) {
    rendered = await page.locator('.card-text').innerText()
    if (rendered.includes('Правило действует')) break
    await page.getByRole('button', { name: 'Другая карта' }).click()
  }

  expect(rendered).toContain('Правило действует')
  expect(rendered).not.toContain('{{duration}}')
  await page.waitForFunction((expected) => {
    const raw = localStorage.getItem('bez-filtrov:game:v6')
    if (!raw) return false
    return JSON.parse(raw).renderedText === expected
  }, rendered)

  await page.reload()
  await page.getByRole('button', { name: 'Мне есть 18' }).click()
  await page.locator('button.resume-card').click()
  await expect(page.locator('.card-text')).toHaveText(rendered)
})
