import { test, expect } from '@playwright/test';
import { mockPlintha } from './plintha-mock.js';

test.use({ launchOptions: { args: ['--disable-webgl', '--disable-webgl2', '--disable-gpu'] } });

test('without WebGL: stills, a list builder and a working cart', async ({ page }) => {
  await mockPlintha(page);
  await page.goto('/plintha/');
  await expect(page.locator('.plintha-still').first()).toBeVisible();
  await page.getByRole('button', { name: 'Add Armless', exact: true }).click();
  await page.getByRole('button', { name: 'Add Right arm', exact: true }).click();
  await expect(page.getByTestId('dims')).toHaveText('195 × 100 cm');
  await expect(page.locator('.p-plan svg')).toBeVisible();
  await page.getByRole('button', { name: 'Add layout to cart' }).click();
  await expect(page.getByRole('button', { name: /Checkout \(2\)/ })).toBeVisible();
});
