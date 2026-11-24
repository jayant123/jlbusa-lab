import { test, expect } from '@playwright/test';
import { mockSeed } from './seed-mock.js';

const URL = '/nuithra/';
const mock = (page, o) => mockSeed(page, 'seed/nuithra.json', o);
const scent = (page, name) => page.getByRole('group', { name: 'Scent' }).getByRole('radio', { name: new RegExp(`^${name}`) }).check();
const size = (page, s) => page.getByRole('group', { name: 'Size' }).getByRole('radio', { name: new RegExp(`^${s}`) }).check();

test.describe('NUITHRA', () => {
  test('prices come from Shopify and follow the scent and size', async ({ page }) => {
    await mock(page);
    await page.goto(URL);
    await expect(page.getByTestId('price')).toHaveText('$140');
    await size(page, '100 ml');
    await expect(page.getByTestId('price')).toHaveText('$210');
    await scent(page, 'Smoke Garden');
    await expect(page.locator('body')).toHaveAttribute('data-scent', 'nuithra-smoke-garden');
    await expect(page.getByRole('button', { name: 'Sold out' }).first()).toBeDisabled();
    await size(page, '30 ml');
    await expect(page.getByTestId('price')).toHaveText('$105');
    await expect(page.getByRole('button', { name: 'Add to cart' }).first()).toBeEnabled();
  });

  test('the notes follow the chosen scent', async ({ page }) => {
    await mock(page);
    await page.goto(URL);
    await expect(page.locator('[data-list="top"]')).toHaveText('Bergamot · Pink pepper');
    await scent(page, 'Fig Night');
    await expect(page.locator('[data-list="heart"]')).toHaveText('Fig · Violet');
    await page.getByRole('button', { name: 'Smoke Garden' }).first().click();
    await expect(page.locator('[data-list="base"]')).toHaveText('Vetiver · Birch');
    await expect(page.getByRole('group', { name: 'Scent' }).getByRole('radio', { name: /^Smoke Garden/ })).toBeChecked();
  });

  test('add a bottle and the discovery set, then open the concept checkout', async ({ page }) => {
    const shop = await mock(page);
    await page.goto(URL);
    await scent(page, 'Fig Night');
    await size(page, '30 ml');
    await page.getByRole('button', { name: 'Add to cart' }).first().click();
    await expect(page.getByRole('button', { name: /Checkout \(1\)/ })).toBeVisible();
    await expect(page.getByTestId('set-price')).toHaveText('$38');
    await page.getByRole('button', { name: 'Add discovery set' }).click();
    await expect(page.getByRole('button', { name: /Checkout \(2\)/ })).toBeVisible();
    expect(shop.sent).toHaveLength(2);
    expect(shop.sent[1][0].attributes).toEqual([{ key: 'Scents', value: 'Fig Night, Amber Hour, Smoke Garden' }]);
    await page.getByRole('button', { name: /Checkout \(2\)/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('NUITHRA Fig Night');
    await expect(dialog).toContainText('NUITHRA Discovery Set');
  });

  test('the test checkout unlocks the store first, then opens the checkout', async ({ page }) => {
    await mock(page);
    await page.goto(URL);
    await page.getByRole('button', { name: 'Add to cart' }).first().click();
    await page.getByRole('button', { name: /Checkout \(1\)/ }).click();
    await page.getByRole('button', { name: /real checkout/ }).click();
    const unlock = page.getByRole('link', { name: /Unlock the test store/ });
    const go = page.getByRole('link', { name: /Open the test checkout/ });
    await expect(unlock).toHaveAttribute('href', 'https://example.myshopify.com/password');
    await expect(go).toHaveAttribute('href', 'https://example.myshopify.com/cart/c/s1?key=k');
    await expect(page.getByRole('dialog')).toContainText('nuithra-demo');
  });

  test('the collection grid shows every scent with a price and opens it', async ({ page }) => {
    await mock(page);
    await page.goto(URL);
    const grid = page.locator('#grid');
    await expect(grid.locator('li')).toHaveCount(5);
    await expect(grid.locator('[data-from="nuithra-vetiver-rain"]')).toHaveText('From $100');
    await grid.getByRole('button', { name: 'View Fig Night' }).click();
    await expect(page.locator('[data-name]')).toHaveText('Fig Night');
    await expect(page.getByRole('group', { name: 'Scent' }).getByRole('radio', { name: /^Fig Night/ })).toBeChecked();
  });

  test('the scent finder suggests a scent and opens it', async ({ page }) => {
    await mock(page);
    await page.goto(URL);
    const quiz = page.locator('#quiz-form');
    await quiz.getByRole('radio', { name: 'In the evening' }).check();
    await quiz.getByRole('radio', { name: 'Wood and smoke' }).check();
    await expect(page.locator('#quiz-result')).toBeEmpty();
    await quiz.getByRole('radio', { name: 'Noticed across a room' }).check();
    await expect(page.locator('#quiz-result')).toContainText('Smoke Garden');
    await page.locator('#quiz-result').getByRole('button', { name: 'See Smoke Garden' }).click();
    await expect(page.locator('body')).toHaveAttribute('data-scent', 'nuithra-smoke-garden');
  });

  test('the newsletter form says it is a demo and sends nothing', async ({ page }) => {
    await mock(page);
    await page.goto(URL);
    await page.getByLabel('Email address').fill('not-an-email');
    await page.getByRole('button', { name: 'Subscribe' }).click();
    await expect(page.locator('#news-msg')).toHaveText('Please enter a valid email address.');
    await page.getByLabel('Email address').fill('ana@example.com');
    await page.getByRole('button', { name: 'Subscribe' }).click();
    await expect(page.locator('#news-msg')).toContainText('demo store');
  });

  test('compares all five scents', async ({ page }) => {
    await mock(page);
    await page.goto(URL);
    const chart = page.getByRole('img', { name: /Scent profiles/ });
    await expect(chart).toBeVisible();
    for (const n of ['Salt Iris', 'Fig Night', 'Amber Hour', 'Smoke Garden', 'Vetiver Rain']) await expect(page.locator('#compare')).toContainText(n);
    await expect(page.locator('#pyramid')).toContainText('Labdanum');
    await expect(page.locator('#pyramid')).toContainText('Oakmoss');
  });

  test('the new scents have their own prices and notes', async ({ page }) => {
    await mock(page);
    await page.goto(URL);
    await scent(page, 'Vetiver Rain');
    await expect(page.getByTestId('price')).toHaveText('$148');
    await expect(page.locator('[data-list="heart"]')).toHaveText('Vetiver · Geranium');
    await expect(page.locator('[data-name]')).toHaveText('Vetiver Rain');
    await scent(page, 'Salt Iris');
    await expect(page.locator('[data-list="top"]')).toHaveText('Sea salt · Pear');
    await expect(page.locator('[data-bottle]')).toContainText('spire');
  });

  test('discovery set: pick any three', async ({ page }) => {
    const shop = await mock(page);
    await page.goto(URL);
    const picks = page.getByRole('group', { name: 'Discovery set scents' });
    const setBtn = page.getByRole('button', { name: 'Add discovery set' });
    await expect(setBtn).toBeEnabled();
    await picks.getByRole('button', { name: /Smoke Garden/ }).click();
    await expect(page.locator('#set-count')).toHaveText('Pick 1 more.');
    await expect(setBtn).toBeDisabled();
    await picks.getByRole('button', { name: /Salt Iris/ }).click();
    await expect(picks.getByRole('button', { name: /Salt Iris/ })).toHaveAttribute('aria-pressed', 'true');
    // A fourth pick replaces the oldest one (Fig Night).
    await picks.getByRole('button', { name: /Vetiver Rain/ }).click();
    await expect(picks.getByRole('button', { name: /Fig Night/ })).toHaveAttribute('aria-pressed', 'false');
    await setBtn.click();
    await expect(page.getByRole('button', { name: /Checkout \(1\)/ })).toBeVisible();
    expect(shop.sent[0][0].attributes).toEqual([{ key: 'Scents', value: 'Salt Iris, Amber Hour, Vetiver Rain' }]);
  });

  test('when Shopify is down the page still renders and offers a retry', async ({ page }) => {
    await mock(page, { failProducts: true });
    await page.goto(URL);
    await expect(page.getByText("Couldn't load prices.")).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add to cart' }).first()).toBeDisabled();
  });

  test('keyboard: reach Add to cart, add, open and close the panel', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard path checked on desktop');
    await mock(page);
    await page.goto(URL);
    await expect(page.getByTestId('price')).toHaveText('$140');
    let found = false;
    for (let i = 0; i < 40 && !found; i++) {
      await page.keyboard.press('Tab');
      found = await page.evaluate(() => document.activeElement?.textContent?.trim() === 'Add to cart');
    }
    expect(found).toBe(true);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: /Checkout \(1\)/ })).toBeVisible();
    await page.getByRole('button', { name: /Checkout \(1\)/ }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
  });
});
