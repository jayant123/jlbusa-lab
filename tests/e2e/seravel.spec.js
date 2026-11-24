import { test, expect } from '@playwright/test';
import { mockSeed } from './seed-mock.js';

const URL = '/seravel/';
const mock = (page, o) => mockSeed(page, 'seed/seravel.json', o);
const pick = (page, group, name) => page.getByRole('group', { name: group }).getByRole('radio', { name: new RegExp(`^${name}`) }).first().check();

test.describe('SERAVEL', () => {
  test('ring price follows metal and stone from Shopify', async ({ page }) => {
    await mock(page);
    await page.goto(URL);
    await expect(page.getByTestId('ring-price')).toHaveText('$3,300');
    await pick(page, 'Stone', 'Sapphire');
    await expect(page.getByTestId('ring-price')).toHaveText('$2,500');
    await pick(page, 'Metal', 'White gold');
    await expect(page.getByTestId('price')).toHaveText('$2,550');
    await pick(page, 'Metal', 'Rose gold');
    await pick(page, 'Stone', 'Emerald');
    await expect(page.getByRole('button', { name: 'Sold out' }).first()).toBeDisabled();
    await expect(page.locator('#status')).toContainText('sold out');
  });

  test('size and engraving travel with the ring as line attributes', async ({ page }) => {
    const shop = await mock(page);
    await page.goto(URL);
    await page.getByRole('combobox', { name: 'Ring size' }).selectOption('6.5');
    await expect(page.locator('#size-mm')).toHaveText('16.9 mm inside');
    await page.getByLabel(/Engraving inside the band/).fill('always yours <3');
    await expect(page.locator('#eng-count')).toHaveText('14 of 18');
    await page.getByRole('button', { name: 'Add ring to cart' }).click();
    await expect(page.getByRole('button', { name: /Checkout \(1\)/ })).toBeVisible();
    expect(shop.sent[0][0].attributes).toEqual([{ key: 'Ring size', value: 'US 6.5' }, { key: 'Engraving', value: 'ALWAYS YOURS 3' }]);
  });

  test('pendant and hoops can be bought with their own options', async ({ page }) => {
    const shop = await mock(page);
    await page.goto(URL);
    const pendant = page.locator('.s-piece[data-h="seravel-halo-pendant"]');
    await expect(pendant.locator('[data-piece-price]')).toHaveText('$1,190');
    await pendant.getByRole('radio', { name: '20 in' }).check();
    await expect(pendant.locator('[data-piece-price]')).toHaveText('$1,230');
    await pendant.getByRole('button', { name: 'Add to cart' }).click();
    const hoops = page.locator('.s-piece[data-h="seravel-tide-hoops"]');
    await hoops.getByRole('radio', { name: 'Medium' }).check();
    await expect(hoops.locator('[data-piece-price]')).toHaveText('$840');
    await hoops.getByRole('button', { name: 'Add to cart' }).click();
    await expect(page.getByRole('button', { name: /Checkout \(2\)/ })).toBeVisible();
    expect(shop.sent).toHaveLength(2);
    await page.getByRole('button', { name: /Checkout \(2\)/ }).click();
    await expect(page.getByRole('dialog')).toContainText('SERAVEL Tide Hoops');
  });

  test('the collection shows three pieces with from prices', async ({ page }) => {
    await mock(page);
    await page.goto(URL);
    await expect(page.locator('#grid li')).toHaveCount(3);
    await expect(page.locator('[data-from="seravel-solace-ring"]')).toHaveText('From $2,500');
    await expect(page.locator('[data-from="seravel-tide-hoops"]')).toHaveText('From $690');
  });

  test('the size table and the demo newsletter', async ({ page }) => {
    await mock(page);
    await page.goto(URL);
    await expect(page.locator('#size-table')).toContainText('17.3 mm');
    await page.getByLabel('Email address').fill('nope');
    await page.getByRole('button', { name: 'Subscribe' }).click();
    await expect(page.locator('#news-msg')).toHaveText('Please enter a valid email address.');
    await page.getByLabel('Email address').fill('a@example.com');
    await page.getByRole('button', { name: 'Subscribe' }).click();
    await expect(page.locator('#news-msg')).toContainText('demo store');
  });

  test('when Shopify is down the page still renders and offers a retry', async ({ page }) => {
    await mock(page, { failProducts: true });
    await page.goto(URL);
    await expect(page.getByText("Couldn't load prices.")).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add ring to cart' })).toBeDisabled();
  });
});
