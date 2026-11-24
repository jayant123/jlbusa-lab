import { test, expect } from '@playwright/test';
import { mockSeed } from './seed-mock.js';

test.use({ launchOptions: { args: ['--disable-webgl', '--disable-webgl2', '--disable-gpu'] } });

test('without WebGL: the still shows and the shop works', async ({ page }) => {
  await mockSeed(page, 'seed/nuithra.json');
  await page.goto('/nuithra/');
  await expect(page.locator('.nuithra-still').first()).toBeVisible();
  await expect(page.getByTestId('price')).toHaveText('$140');
  await page.getByRole('button', { name: 'Add to cart' }).first().click();
  await expect(page.getByRole('button', { name: /Checkout \(1\)/ })).toBeVisible();
});
