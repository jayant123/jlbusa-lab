import { test, expect } from '@playwright/test';
import { mockSeed } from './seed-mock.js';

test.use({ launchOptions: { args: ['--disable-webgl', '--disable-webgl2', '--disable-gpu'] } });

test('without WebGL: the still shows and the shop works', async ({ page }) => {
  await mockSeed(page, 'seed/halrune.json');
  await page.goto('/halrune/?gl');
  await expect(page.locator('.h-hero-photo')).toBeVisible();
  await expect(page.getByTestId('price')).toHaveText('$449');
  await page.locator('#add').click();
  await expect(page.getByRole('button', { name: /Checkout \(1\)/ })).toBeVisible();
});
