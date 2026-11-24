import { test, expect } from '@playwright/test';
import { mockSeed } from './seed-mock.js';

test.use({ launchOptions: { args: ['--disable-webgl', '--disable-webgl2', '--disable-gpu'] } });

test('without WebGL: the designer still sells the ring', async ({ page }) => {
  await mockSeed(page, 'seed/seravel.json');
  await page.goto('/seravel/?gl');
  await expect(page.getByTestId('ring-price')).toHaveText('$3,300');
  await page.getByRole('button', { name: 'Add ring to cart' }).click();
  await expect(page.getByRole('button', { name: /Checkout \(1\)/ })).toBeVisible();
});
