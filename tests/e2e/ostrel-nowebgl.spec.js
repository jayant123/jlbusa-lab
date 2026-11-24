import { test, expect } from '@playwright/test';
import { mockShopify } from './shopify-mock.js';

test.use({ launchOptions: { args: ['--disable-webgl', '--disable-webgl2', '--disable-gpu'] } });
const URL = '/ostrel/';
const pick = async (page, group, value) => page.getByRole('group', { name: group }).getByLabel(value, { exact: true }).check();

test('shows stills and the cart still works', async ({ page }) => {
    await mockShopify(page);
    await page.goto(URL);
    await expect(page.locator('.ostrel-still').first()).toBeVisible();
    await pick(page, 'Dial', 'Obsidian');
    await pick(page, 'Case', 'Brushed platinum');
    await pick(page, 'Strap', 'Black calf');
    await page.getByRole('button', { name: 'Add to cart' }).click();
    await expect(page.getByRole('button', { name: /Checkout \(1\)/ })).toBeVisible();
  });
