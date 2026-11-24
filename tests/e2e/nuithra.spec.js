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
    await expect(page.getByRole('button', { name: 'Sold out' })).toBeDisabled();
    await size(page, '30 ml');
    await expect(page.getByTestId('price')).toHaveText('$105');
    await expect(page.getByRole('button', { name: 'Add to cart' })).toBeEnabled();
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
    await page.getByRole('button', { name: 'Add to cart' }).click();
    await expect(page.getByRole('button', { name: /Checkout \(1\)/ })).toBeVisible();
    await expect(page.getByTestId('set-price')).toHaveText('$38');
    await page.getByRole('button', { name: 'Add discovery set' }).click();
    await expect(page.getByRole('button', { name: /Checkout \(2\)/ })).toBeVisible();
    expect(shop.sent).toHaveLength(2);
    await page.getByRole('button', { name: /Checkout \(2\)/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('NUITHRA Fig Night');
    await expect(dialog).toContainText('NUITHRA Discovery Set');
  });

  test('compares all three scents', async ({ page }) => {
    await mock(page);
    await page.goto(URL);
    const chart = page.getByRole('img', { name: /Scent profiles/ });
    await expect(chart).toBeVisible();
    for (const n of ['Amber Hour', 'Fig Night', 'Smoke Garden']) await expect(page.locator('#compare')).toContainText(n);
    await expect(page.locator('#pyramid')).toContainText('Labdanum');
  });

  test('when Shopify is down the page still renders and offers a retry', async ({ page }) => {
    await mock(page, { failProducts: true });
    await page.goto(URL);
    await expect(page.getByText("Couldn't load prices.")).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add to cart' })).toBeDisabled();
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
