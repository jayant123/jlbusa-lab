import { test, expect } from '@playwright/test';
import { mockSeed } from './seed-mock.js';

const URL = '/halrune/';
const mock = (page, o) => mockSeed(page, 'seed/halrune.json', o);
const room = (page) => page.locator('#room');

test.describe('HALRUNE', () => {
  test('prices come from Shopify and follow the product and finish', async ({ page }) => {
    await mock(page);
    await page.goto(URL);
    await expect(page.getByTestId('price')).toHaveText('$449');
    await room(page).getByRole('radio', { name: 'Graphite' }).check();
    await expect(page.getByTestId('price')).toHaveText('$479');
    await room(page).getByRole('group', { name: 'Product' }).getByRole('radio', { name: 'Monitor' }).check();
    await expect(page.locator('body')).toHaveAttribute('data-product', 'halrune-monitor');
    await expect(page.getByTestId('room-price')).toHaveText('$1,290');
    const oak = room(page).getByRole('radio', { name: 'Oak' });
    await expect(oak).toBeVisible();
    await oak.click();
    await expect(oak).toBeChecked();
    await expect(page.getByRole('button', { name: 'Sold out' }).first()).toBeDisabled();
    await expect(page.locator('#status')).toContainText('sold out');
  });

  test('the range grid shows every product with a price and opens it in the room', async ({ page }) => {
    await mock(page);
    await page.goto(URL);
    await expect(page.locator('#grid li')).toHaveCount(3);
    await expect(page.locator('[data-from="halrune-buds"]')).toHaveText('From $249');
    await page.locator('#grid').getByRole('button', { name: 'See it in the listening room' }).nth(2).click();
    await expect(page.locator('[data-name]')).toHaveText('HALRUNE Buds');
    await expect(page.locator('#opt-name')).toHaveText('Color');
  });

  test('add to cart and open the concept checkout', async ({ page }) => {
    const shop = await mock(page);
    await page.goto(URL);
    await room(page).getByRole('radio', { name: 'Ash' }).check();
    await page.locator('#room-add').click();
    await expect(page.getByRole('button', { name: /Checkout \(1\)/ })).toBeVisible();
    expect(shop.sent).toHaveLength(1);
    await page.getByRole('button', { name: /Checkout \(1\)/ }).click();
    await expect(page.getByRole('dialog')).toContainText('HALRUNE One');
  });

  test('only the headphones can be taken apart', async ({ page }) => {
    await mock(page);
    await page.goto(URL);
    const products = room(page).getByRole('group', { name: 'Product' });
    await products.getByRole('radio', { name: 'Buds' }).check();
    await expect(page.locator('#explode')).toBeHidden();
    await expect(page.locator('#room-note')).toContainText('case opens');
    await products.getByRole('radio', { name: 'One' }).check();
    await expect(page.locator('#room-note')).toBeHidden();
    await page.getByRole('button', { name: 'Take the headphones apart' }).click();
    await expect(page.getByRole('button', { name: 'Put the headphones back together' })).toHaveAttribute('aria-pressed', 'true');
    await products.getByRole('radio', { name: 'Monitor' }).check();
    await expect(page.locator('#explode')).toBeHidden();
    await products.getByRole('radio', { name: 'One' }).check();
    await expect(page.getByRole('button', { name: 'Take the headphones apart' })).toHaveAttribute('aria-pressed', 'false');
  });

  test('music starts only on Play, then pauses and mutes', async ({ page }) => {
    await mock(page);
    await page.goto(URL);
    const play = page.getByRole('button', { name: 'Play' });
    await expect(play).toHaveAttribute('aria-pressed', 'false');
    await play.click();
    await expect(page.getByRole('button', { name: 'Pause' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Mute' }).click();
    await expect(page.getByRole('button', { name: 'Unmute' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Pause' }).click();
    await expect(page.getByRole('button', { name: 'Play' })).toHaveAttribute('aria-pressed', 'false');
  });

  test('the response chart switches product and says it is demo data', async ({ page }) => {
    await mock(page);
    await page.goto(URL);
    await expect(page.locator('#chart').getByRole('img', { name: /HALRUNE One/ })).toBeVisible();
    await page.locator('#resp-tabs').getByRole('button', { name: 'Monitor' }).click();
    await expect(page.locator('#chart').getByRole('img', { name: /HALRUNE Monitor/ })).toBeVisible();
    await expect(page.locator('#response')).toContainText('not a measurement');
  });

  test('the newsletter form says it is a demo', async ({ page }) => {
    await mock(page);
    await page.goto(URL);
    await page.getByLabel('Email address').fill('ana@example.com');
    await page.getByRole('button', { name: 'Subscribe' }).click();
    await expect(page.locator('#news-msg')).toContainText('demo store');
  });

  test('when Shopify is down the page still renders and offers a retry', async ({ page }) => {
    await mock(page, { failProducts: true });
    await page.goto(URL);
    await expect(page.getByText("Couldn't load prices.")).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Add to cart' }).first()).toBeDisabled();
  });
});
