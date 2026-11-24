import { test, expect } from '@playwright/test';
import { mockPlintha } from './plintha-mock.js';

const URL = '/plintha/';
const add = (page, name) => page.getByRole('button', { name: `Add ${name}`, exact: true }).click();
const dims = (page) => page.getByTestId('dims');
const rows = (page) => page.getByRole('list', { name: 'Your layout' }).getByRole('listitem');
// The configurator opens on the corner sofa. Most tests start from an empty layout.
async function fresh(page) {
  await page.goto(URL);
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(rows(page)).toHaveCount(0);
}

test.describe('PLINTHA', () => {
  test('tap to build: two armless plus an arm at each end is 390 × 100 cm', async ({ page }) => {
    await mockPlintha(page);
    await fresh(page);
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
    await fresh(page);
    await add(page, 'Armless');
    await add(page, 'Chaise');
    await page.getByRole('radio', { name: 'Wool Moss' }).check();
    for (const r of await rows(page).all()) await expect(r).toContainText('Wool Moss');
    await expect(page.locator('body')).toHaveAttribute('data-fabric', 'wool-moss');
  });

  test('adds the layout to the cart as grouped lines', async ({ page }) => {
    const shop = await mockPlintha(page);
    await fresh(page);
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
    await fresh(page);
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
    await fresh(page);
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
    await fresh(page);
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

  test('opens on the corner sofa and loads a preset in one click', async ({ page }) => {
    await mockPlintha(page);
    await page.goto(URL);
    await expect(rows(page)).toHaveCount(6);
    await expect(page.getByRole('button', { name: 'Corner sofa' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Straight three-seat' }).click();
    await expect(dims(page)).toHaveText('300 × 100 cm');
    await page.getByRole('button', { name: 'U shape' }).click();
    await expect(rows(page)).toHaveCount(6);
    await expect(dims(page)).toHaveText('370 × 295 cm');
  });

  test('select a module and edit it from the toolbar', async ({ page }) => {
    await mockPlintha(page);
    await page.goto(URL);
    await page.getByRole('button', { name: 'Straight three-seat' }).click();
    await rows(page).nth(1).getByRole('button').first().click();
    const bar = page.getByRole('toolbar', { name: 'Selected module' });
    await expect(bar).toBeVisible();
    await expect(bar).toContainText('Armless');
    await bar.getByRole('button', { name: 'Duplicate' }).click();
    await expect(rows(page)).toHaveCount(4);
    await expect(dims(page)).toHaveText('390 × 100 cm');
    await bar.getByRole('button', { name: 'Move right' }).click();
    await expect(page.getByRole('status')).toContainText('right arm');
    await expect(rows(page).nth(3)).toContainText('Right arm');
    await bar.getByRole('button', { name: 'Swap' }).click();
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem', { name: /Left arm/ })).toHaveAttribute('aria-disabled', 'true');
    await expect(menu.getByRole('menuitem', { name: /Chaise/ })).toContainText('A chaise only sits at the end of a run.');
    await menu.getByRole('menuitem', { name: /Chaise/ }).click({ force: true });
    await expect(page.getByRole('status')).toContainText('chaise');
    await menu.getByRole('menuitem', { name: /Corner/ }).click();
    await expect(menu).toBeHidden();
    await expect(dims(page)).toHaveText('295 × 205 cm');
    await bar.getByRole('button', { name: 'Delete' }).click();
    await expect(rows(page)).toHaveCount(3);
    await expect(bar).toBeHidden();
  });

  test('a module crosses the corner into the return', async ({ page }) => {
    await mockPlintha(page);
    await page.goto(URL);
    await rows(page).nth(2).getByRole('button').first().click(); // the second armless, beside the corner
    const bar = page.getByRole('toolbar', { name: 'Selected module' });
    await bar.getByRole('button', { name: 'Move right' }).click();
    await expect(dims(page)).toHaveText('295 × 385 cm');
    await expect(bar.getByRole('button', { name: 'Toward corner' })).toBeVisible();
  });

  test('undo and redo with buttons and keys', async ({ page, isMobile }) => {
    await mockPlintha(page);
    await page.goto(URL);
    await page.getByRole('button', { name: 'Straight three-seat' }).click();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(dims(page)).toHaveText('385 × 295 cm');
    await page.getByRole('button', { name: 'Redo' }).click();
    await expect(dims(page)).toHaveText('300 × 100 cm');
    test.skip(isMobile, 'keyboard shortcuts checked on desktop');
    await page.getByRole('button', { name: 'Clear', exact: true }).click();
    await page.keyboard.press('ControlOrMeta+z');
    await expect(dims(page)).toHaveText('300 × 100 cm');
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await expect(rows(page)).toHaveCount(0);
  });

  test('keyboard: arrows move the selected module and Escape deselects', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard path checked on desktop');
    await mockPlintha(page);
    await page.goto(URL);
    await page.getByRole('button', { name: 'Chaise sofa' }).click();
    await rows(page).nth(1).getByRole('button').first().click();
    await page.keyboard.press('ArrowRight');
    await expect(rows(page).nth(2)).toHaveClass(/is-sel/);
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('status')).toContainText('chaise');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('toolbar', { name: 'Selected module' })).toBeHidden();
  });

  test('plus marks add a piece at an open end', async ({ page }) => {
    await mockPlintha(page);
    await fresh(page);
    await page.getByRole('button', { name: 'Add the first module' }).click();
    await page.getByRole('menuitem', { name: /Armless/ }).click();
    await page.getByRole('button', { name: 'Add at the left end' }).click();
    await page.getByRole('menuitem', { name: /Left arm/ }).click();
    await page.getByRole('button', { name: 'Add at the right end' }).click();
    await expect(page.getByRole('menuitem', { name: /Left arm/ })).toHaveAttribute('aria-disabled', 'true');
    await page.getByRole('menuitem', { name: /Corner/ }).click();
    await page.getByRole('button', { name: 'Add to the return' }).click();
    await page.getByRole('menuitem', { name: /Right arm/ }).click();
    await expect(dims(page)).toHaveText('295 × 205 cm');
    await page.getByRole('button', { name: 'Add an ottoman' }).click();
    await expect(rows(page)).toHaveCount(5);
  });

  test('refuses a second chaise and a ninth module with a reason', async ({ page }) => {
    await mockPlintha(page);
    await page.goto(URL);
    await page.getByRole('button', { name: 'Chaise sofa' }).click();
    await expect(page.getByRole('button', { name: 'Add Chaise', exact: true })).toHaveAttribute('aria-disabled', 'true');
    await page.getByRole('button', { name: 'Add Chaise', exact: true }).click({ force: true });
    await expect(page.getByRole('status')).toHaveText('A layout takes one chaise.');
    await page.getByRole('button', { name: 'Lounge island' }).click();
    for (let i = 0; i < 3; i++) await add(page, 'Ottoman');
    await page.getByRole('button', { name: 'Add Ottoman', exact: true }).click({ force: true });
    await expect(page.getByRole('status')).toHaveText('Eight modules is the most one layout can hold.');
  });

  test('checks the fit against a wall', async ({ page }) => {
    await mockPlintha(page);
    await page.goto(URL);
    await page.getByRole('button', { name: 'Straight three-seat' }).click();
    await page.getByLabel('Wall length').fill('340');
    await expect(page.locator('#fit')).toHaveText('Too tight. Only 40 cm to spare. Leave at least 60 cm.');
    await page.getByLabel('Wall length').fill('420');
    await expect(page.locator('#fit')).toHaveText('It fits. 120 cm to spare on this wall.');
    await expect(page.locator('.p-plan .wall')).toContainText('Wall 420 cm');
  });
});
