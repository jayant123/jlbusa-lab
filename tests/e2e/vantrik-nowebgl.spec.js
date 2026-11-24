import { test, expect } from '@playwright/test';
import { mockSeed } from './seed-mock.js';

test.use({ launchOptions: { args: ['--disable-webgl', '--disable-webgl2', '--disable-gpu'] } });

test('without WebGL the shop and the designer still work', async ({ page }) => {
  await mockSeed(page, 'seed/vantrik.json');
  await page.goto('/vantrik/?gl');
  await expect(page.locator('body')).toHaveClass(/no-gl/);
  await expect(page.getByTestId('price')).toHaveText('$165');
  await page.getByRole('button', { name: 'Add to cart' }).first().click();
  await expect(page.getByRole('button', { name: /Checkout \(1\)/ })).toBeVisible();
});
