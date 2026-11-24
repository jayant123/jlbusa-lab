import { test, expect } from '@playwright/test';
import { mockPlintha } from './plintha-mock.js';

const URL = '/plintha/';
const add = (page, name) => page.getByRole('button', { name: `Add ${name}`, exact: true }).click();
const dims = (page) => page.getByTestId('dims');
const rows = (page) => page.getByRole('list', { name: 'Your layout' }).getByRole('listitem');

test.describe('PLINTHA', () => {
  test('tap to build: two armless plus an arm at each end is 390 × 100 cm', async ({ page }) => {
    await mockPlintha(page);
    await page.goto(URL);
    await add(page, 'Armless');
    await add(page, 'Armless');
    await add(page, 'Left arm');
    await add(page, 'Right arm');
    await expect(dims(page)).toHaveText('390 × 100 cm');
    await expect(rows(page)).toHaveCount(4);
    await expect(rows(page).first()).toContainText('Left arm');
    await expect(page.getByTestId('total')).toHaveText('$6,280');
    await expect(page.getByText('Ships in 6-8 weeks (demo)')).toBeVisible();
  });

  test('changing the fabric changes every module', async ({ page }) => {
    await mockPlintha(page);
    await page.goto(URL);
    await add(page, 'Armless');
    await add(page, 'Chaise');
    await page.getByRole('radio', { name: 'Wool Moss' }).check();
    for (const r of await rows(page).all()) await expect(r).toContainText('Wool Moss');
    await expect(page.locator('body')).toHaveAttribute('data-fabric', 'wool-moss');
  });

  test('adds the layout to the cart as grouped lines', async ({ page }) => {
    const shop = await mockPlintha(page);
    await page.goto(URL);
    await add(page, 'Armless');
    await add(page, 'Armless');
    await add(page, 'Right arm');
    await add(page, 'Ottoman');
    await expect(page.getByTestId('total')).not.toHaveText('');
    await page.getByRole('button', { name: 'Add layout to cart' }).click();
    await expect(page.getByRole('button', { name: /Checkout \(4\)/ })).toBeVisible();
    expect(shop.sent).toHaveLength(1);
    expect(shop.sent[0].map((l) => l.quantity).sort()).toEqual([1, 1, 2]);
    await page.getByRole('button', { name: /Checkout \(4\)/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('PLINTHA Armless module');
    await expect(dialog).toContainText('× 2');
  });

  test('a share link reloads the same layout and fabric', async ({ page }) => {
    await mockPlintha(page);
    await page.goto(URL);
    await add(page, 'Armless');
    await add(page, 'Corner');
    await add(page, 'Chaise');
    await page.getByRole('radio', { name: 'Linen Sand' }).check();
    await page.getByRole('button', { name: 'Copy share link' }).click();
    await expect(page).toHaveURL(/[?&]l=/);
    const shared = page.url();
    await page.goto('about:blank');
    await page.goto(shared);
    await expect(rows(page)).toHaveCount(3);
    await expect(dims(page)).toHaveText('190 × 190 cm');
    await expect(page.getByRole('radio', { name: 'Linen Sand' })).toBeChecked();
  });

  test('a tampered link loads only its valid part', async ({ page }) => {
    await mockPlintha(page);
    await page.goto(`${URL}?l=l.a.zz.r.l~x.y~99~not-a-fabric`);
    await expect(rows(page)).toHaveCount(3 + 5);
    await expect(dims(page)).toHaveText('300 × 100 cm');
    await expect(page.getByRole('radio', { name: 'Boucle Chalk' })).toBeChecked();
  });

  test('the day and evening switch keeps the layout', async ({ page }) => {
    await mockPlintha(page);
    await page.goto(URL);
    await add(page, 'Armless');
    await add(page, 'Right arm');
    await page.getByRole('button', { name: 'Evening' }).click();
    await expect(page.locator('body')).toHaveAttribute('data-light', 'evening');
    await expect(dims(page)).toHaveText('195 × 100 cm');
    await page.getByRole('button', { name: 'Day' }).click();
    await expect(page.locator('body')).toHaveAttribute('data-light', 'day');
  });

  test('keyboard: add with Enter, remove with Delete, open and close the panel', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard path checked on desktop');
    await mockPlintha(page);
    await page.goto(URL);
    await page.getByRole('button', { name: 'Add Armless', exact: true }).focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await expect(rows(page)).toHaveCount(2);
    await rows(page).first().getByRole('button').first().focus();
    await page.keyboard.press('Delete');
    await expect(rows(page)).toHaveCount(1);
    await page.getByRole('button', { name: /Checkout/ }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
  });

  test('reduced motion: the room is assembled at once', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockPlintha(page);
    await page.goto(URL);
    await expect(page.locator('body')).toHaveAttribute('data-room', 'assembled');
  });
});
