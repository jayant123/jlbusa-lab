import { test, expect } from '@playwright/test';
import { mockSeed } from './seed-mock.js';

const URL = '/vantrik/';
const mock = (page, o) => mockSeed(page, 'seed/vantrik.json', o);
const radio = (page, group, name) => page.getByRole('group', { name: group }).getByRole('radio', { name, exact: true });

test.describe('VANTRIK', () => {
  test('prices come from Shopify and follow the shoe, colorway and size', async ({ page }) => {
    await mock(page);
    await page.goto(URL);
    await expect(page.getByTestId('price')).toHaveText('$165');
    await radio(page, 'Shoe', 'VK-2 Court').check();
    await expect(page.locator('[data-name]')).toHaveText('VK-2 Court');
    await expect(page.getByTestId('price')).toHaveText('$150');
    await radio(page, 'Colorway', 'Oxblood').check();
    await expect(page.locator('#bar-sub')).toHaveText('Oxblood · US 9');
  });

  test('a sold-out size is refused with a message', async ({ page }) => {
    await mock(page);
    await page.goto(URL);
    await radio(page, 'Colorway', 'Ember').check();
    await expect(page.getByRole('button', { name: 'Sold out' }).first()).toBeDisabled();
    await expect(page.locator('#status')).toContainText('sold out');
    await radio(page, 'Size', '10').check();
    await expect(page.getByRole('button', { name: 'Add to cart' }).first()).toBeEnabled();
  });

  test('the grid opens a shoe in its colorway', async ({ page }) => {
    await mock(page);
    await page.goto(URL);
    await expect(page.locator('#grid li')).toHaveCount(8);
    await expect(page.locator('[data-price-of="vantrik-custom-pair"]').first()).toHaveText('From $205');
    await page.getByRole('button', { name: 'View VK-1 Runner in Moss' }).click();
    await expect(page.locator('[data-cw-name]')).toHaveText('Moss');
    await expect(radio(page, 'Colorway', 'Moss')).toBeChecked();
  });

  test('design a custom pair and send its colors with the cart line', async ({ page }) => {
    const shop = await mock(page);
    await page.goto(URL);
    await page.getByRole('tab', { name: /Midsole/ }).click();
    await page.getByRole('radiogroup', { name: 'Color' }).getByRole('radio', { name: 'Volt' }).click();
    await page.getByRole('tab', { name: /Laces/ }).click();
    await page.getByRole('radiogroup', { name: 'Color' }).getByRole('radio', { name: 'Night' }).click();
    await expect(page.locator('#recipe')).toContainText('Midsole: Volt');
    await page.getByRole('combobox', { name: 'Custom pair size' }).selectOption('US 11');
    await expect(page.getByTestId('custom-price')).toHaveText('$205');
    await page.getByRole('button', { name: 'Add custom pair' }).click();
    await expect(page.getByRole('button', { name: /Checkout \(1\)/ })).toBeVisible();
    expect(shop.sent[0][0].attributes).toEqual([
      { key: 'Upper', value: 'Sky' }, { key: 'Midsole', value: 'Volt' }, { key: 'Outsole', value: 'Ember' },
      { key: 'Laces', value: 'Night' }, { key: 'Trim', value: 'Ember' },
    ]);
    await page.getByRole('button', { name: /Checkout \(1\)/ }).click();
    await expect(page.getByRole('dialog')).toContainText('Midsole: Volt');
  });

  test('take it apart shows the layers', async ({ page }) => {
    await mock(page);
    await page.goto(URL);
    const b = page.getByRole('button', { name: 'Take it apart' });
    await b.click();
    await expect(page.getByRole('button', { name: 'Put it back together' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#layers')).toBeVisible();
  });

  test('the fit guide suggests a size', async ({ page }) => {
    await mock(page);
    await page.goto(URL);
    await page.getByLabel('Foot length in cm').fill('26.2');
    await page.getByRole('button', { name: 'Find my size' }).click();
    await expect(page.locator('#fit-out')).toContainText('Go for US 9');
    await page.getByLabel('Foot length in cm').fill('33');
    await page.getByRole('button', { name: 'Find my size' }).click();
    await expect(page.locator('#fit-out')).toContainText('We make US 7 to US 12');
  });

  test('the newsletter is a demo and saves nothing', async ({ page }) => {
    await mock(page);
    await page.goto(URL);
    await page.getByLabel('Email address').fill('nope');
    await page.getByRole('button', { name: 'Sign up' }).click();
    await expect(page.locator('#news-msg')).toHaveText('Please enter a valid email address.');
    await page.getByLabel('Email address').fill('sam@example.com');
    await page.getByRole('button', { name: 'Sign up' }).click();
    await expect(page.locator('#news-msg')).toContainText('demo store');
  });

  test('when Shopify is down the page offers a retry', async ({ page }) => {
    await mock(page, { failProducts: true });
    await page.goto(URL);
    await expect(page.getByText("Couldn't load prices.")).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add to cart' }).first()).toBeDisabled();
  });
});
