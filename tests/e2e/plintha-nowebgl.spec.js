import { test, expect } from '@playwright/test';
import { mockPlintha } from './plintha-mock.js';

test.use({ launchOptions: { args: ['--disable-webgl', '--disable-webgl2', '--disable-gpu'] } });

test('without WebGL: stills, a list builder and a working cart', async ({ page }) => {
  await mockPlintha(page);
  await page.goto('/plintha/');
  await expect(page.locator('.plintha-still').first()).toBeVisible();
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await page.getByRole('button', { name: 'Add Armless', exact: true }).click();
  await page.getByRole('button', { name: 'Add Right arm', exact: true }).click();
  await expect(page.getByTestId('dims')).toHaveText('195 × 100 cm');
  await expect(page.locator('.p-plan svg')).toBeVisible();
  await page.getByRole('button', { name: 'Add layout to cart' }).click();
  await expect(page.getByRole('button', { name: /Checkout \(2\)/ })).toBeVisible();
});

test('without WebGL: the list edits the layout through the same toolbar', async ({ page }) => {
  await mockPlintha(page);
  await page.goto('/plintha/');
  await page.getByRole('button', { name: 'Straight three-seat' }).click();
  await page.getByRole('list', { name: 'Your layout' }).getByRole('listitem').nth(1).getByRole('button').first().click();
  const bar = page.getByRole('toolbar', { name: 'Selected module' });
  await expect(bar).toBeVisible();
  await bar.getByRole('button', { name: 'Duplicate' }).click();
  await expect(page.getByTestId('dims')).toHaveText('390 × 100 cm');
  await bar.getByRole('button', { name: 'Swap' }).click();
  await page.getByRole('menuitem', { name: /Corner/ }).click();
  await expect(page.getByTestId('dims')).toHaveText('295 × 205 cm');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByTestId('dims')).toHaveText('390 × 100 cm');
});
