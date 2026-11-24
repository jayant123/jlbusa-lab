import { test, expect } from '@playwright/test';
import { mockShopify } from './shopify-mock.js';

const URL = '/ostrel/';
const pick = async (page, group, value) => page.getByRole('group', { name: group }).getByLabel(value, { exact: true }).check();

test.describe('OSTREL', () => {
  test('purchase controls work before the 3D model loads', async ({ page }) => {
    await page.route('**/*.glb', () => {}); // never resolves
    await mockShopify(page);
    await page.goto(URL);
    await expect(page.getByRole('button', { name: 'Add to cart' })).toBeVisible();
    await page.getByRole('group', { name: 'Dial' }).getByLabel('Champagne', { exact: true }).focus();
    await expect(page.getByRole('group', { name: 'Dial' }).getByLabel('Champagne', { exact: true })).toBeFocused();
  });

  test('configure, add to cart and open the concept checkout', async ({ page }) => {
    await mockShopify(page);
    await page.goto(URL);
    await pick(page, 'Dial', 'Champagne');
    await pick(page, 'Case', 'Polished steel');
    await pick(page, 'Strap', 'Cognac calf');
    await expect(page.getByTestId('price')).toHaveText('$4,800');
    await page.getByRole('button', { name: 'Add to cart' }).click();
    await expect(page.getByRole('button', { name: /Checkout \(1\)/ })).toBeVisible();
    await page.getByRole('button', { name: /Checkout \(1\)/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Champagne');
    await expect(dialog.getByRole('link', { name: 'Book a call' })).toHaveAttribute('href', /M8KowYvfgMMB7YiGggLu/);
  });

  test('engraving is cleaned, shown and sent to Shopify as a line attribute', async ({ page }) => {
    await mockShopify(page);
    const sent = [];
    page.on('request', (r) => { if (r.url().includes('graphql.json') && r.postData()?.includes('Cart')) sent.push(r.postDataJSON().variables); });
    await page.goto(URL);
    const field = page.getByLabel('Engraving');
    await field.fill('j.s. <3 2026!!');
    await expect(field).toHaveValue('J.S. 3 2026');
    await expect(page.getByText('11 of 14 characters')).toBeVisible();
    await page.getByRole('button', { name: 'Add to cart' }).click();
    await expect(page.getByRole('button', { name: /Checkout \(1\)/ })).toBeVisible();
    expect(sent.at(-1).lines[0].attributes).toEqual([{ key: 'Engraving', value: 'J.S. 3 2026' }]);
    await page.getByRole('button', { name: /Checkout \(1\)/ }).click();
    await expect(page.getByRole('dialog')).toContainText('Engraving: J.S. 3 2026');
  });

  test('no engraving sends no attribute', async ({ page }) => {
    await mockShopify(page);
    const sent = [];
    page.on('request', (r) => { if (r.url().includes('graphql.json') && r.postData()?.includes('Cart')) sent.push(r.postDataJSON().variables); });
    await page.goto(URL);
    await page.getByRole('button', { name: 'Add to cart' }).click();
    await expect(page.getByRole('button', { name: /Checkout \(1\)/ })).toBeVisible();
    expect(sent.at(-1).lines[0].attributes).toEqual([]);
  });

  test('sold out and missing combinations cannot be added', async ({ page }) => {
    await mockShopify(page);
    await page.goto(URL);
    await pick(page, 'Dial', 'Glacier');
    await pick(page, 'Case', 'Black ceramic');
    await pick(page, 'Strap', 'Steel bracelet');
    await expect(page.getByRole('button', { name: 'Sold out' })).toBeDisabled();
    await pick(page, 'Strap', 'Cognac calf');
    await expect(page.getByRole('button', { name: 'Not available' })).toBeDisabled();
  });

  test('when Shopify is down the page still renders and offers a retry', async ({ page }) => {
    await mockShopify(page, { failProducts: true });
    await page.goto(URL);
    await expect(page.getByText("Couldn't load prices.")).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add to cart' })).toBeDisabled();
    await expect(page.locator('canvas, .ostrel-still').first()).toBeAttached();
  });

  test('reduced motion: no scroll scrub, step buttons drive the explosion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockShopify(page);
    await page.goto(URL);
    await expect(page.locator('body')).toHaveAttribute('data-scrub', 'off');
    await page.getByRole('button', { name: 'Show the movement' }).click();
    await expect(page.locator('body')).toHaveAttribute('data-explode', '1');
    await page.getByRole('button', { name: 'Reassemble' }).click();
    await expect(page.locator('body')).toHaveAttribute('data-explode', '0');
  });

  test('keyboard: reach Add to cart, add, open and close the panel', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard path checked on desktop');
    await mockShopify(page);
    await page.goto(URL);
    await expect(page.getByTestId('price')).not.toHaveText('');
    let found = false;
    for (let i = 0; i < 40 && !found; i++) {
      await page.keyboard.press('Tab');
      found = await page.evaluate(() => document.activeElement?.textContent?.trim() === 'Add to cart');
    }
    expect(found).toBe(true);
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: /Checkout \(1\)/ }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
  });
});


test('build cards show Shopify prices and preset the configurator', async ({ page }) => {
  await mockShopify(page);
  await page.goto('/ostrel/');
  const grid = page.locator('#grid');
  await expect(grid.locator('li')).toHaveCount(4);
  await expect(grid.locator('[data-build-price="obsidian"]')).toHaveText('$6,400');
  await expect(grid.locator('[data-build-price="champagne"]')).toHaveText('$4,800');
  const glacier = await grid.locator('[data-build-price="glacier"]').textContent();
  await grid.getByRole('button', { name: 'Start from Glacier' }).click();
  await expect(page.locator('#options input[name="Dial"][value="Glacier"]')).toBeChecked();
  await expect(page.locator('#options input[name="Strap"][value="Steel bracelet"]')).toBeChecked();
  await expect(page.getByTestId('price')).toHaveText(glacier);
});

test('wrist check draws the watch on the wrist and warns on a small wrist', async ({ page }) => {
  await mockShopify(page);
  await page.goto('/ostrel/');
  await page.getByLabel('Wrist size').fill('17');
  await page.locator('#wrist').getByRole('button', { name: 'Check' }).click();
  await expect(page.locator('#wrist-out')).toContainText('fits your wrist');
  await expect(page.locator('#wrist-out svg')).toBeVisible();
  await page.getByLabel('Wrist size').fill('13.5');
  await page.locator('#wrist').getByRole('button', { name: 'Check' }).click();
  await expect(page.locator('[data-fit="large"]')).toContainText('feel large');
  await page.getByLabel('Wrist size').fill('3');
  await page.locator('#wrist').getByRole('button', { name: 'Check' }).click();
  await expect(page.locator('#wrist-out')).toContainText('Enter a wrist size');
});

test('the newsletter form says it is a demo and sends nothing', async ({ page }) => {
  await mockShopify(page);
  await page.goto('/ostrel/');
  await page.getByLabel('Email address').fill('nope');
  await page.getByRole('button', { name: 'Subscribe' }).click();
  await expect(page.locator('#news-msg')).toHaveText('Please enter a valid email address.');
  await page.getByLabel('Email address').fill('ana@example.com');
  await page.getByRole('button', { name: 'Subscribe' }).click();
  await expect(page.locator('#news-msg')).toContainText('demo store');
});
