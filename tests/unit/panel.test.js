import { describe, it, expect, beforeEach } from 'vitest';
import { mountCheckoutPanel } from '../../src/kit/checkout-panel.js';

const cart = {
  lines: () => [{ id: 'l1', variantId: 'V1', title: 'OSTREL Meridian 40', options: { Dial: 'Champagne', Case: 'Polished steel' }, qty: 1, price: 4800, attrs: {} }],
  total: () => ({ amount: 4800, currencyCode: 'USD' }),
  checkoutUrl: () => 'https://x.myshopify.com/cart/c/c1?key=k',
  subscribe: () => () => {},
};
const BOOK = 'https://portal.jlbusa.com/widget/booking/M8KowYvfgMMB7YiGggLu';

let root, opener, panel;
beforeEach(() => {
  document.body.innerHTML = '<button id="co">Checkout</button><div id="root"></div>';
  root = document.getElementById('root');
  opener = document.getElementById('co');
  panel = mountCheckoutPanel(root, { cart, brand: 'OSTREL', bookingUrl: BOOK, storePassword: 'demo-pass' });
  opener.focus();
  panel.open();
});

describe('concept checkout panel', () => {
  it('shows the lines, total and the call link', () => {
    const d = root.querySelector('[role="dialog"]');
    expect(d.getAttribute('aria-modal')).toBe('true');
    expect(d.textContent).toContain('OSTREL Meridian 40');
    expect(d.textContent).toContain('Champagne');
    expect(d.textContent).toContain('$4,800');
    const book = [...d.querySelectorAll('a')].find((a) => a.textContent.includes('Book a call'));
    expect(book.href).toBe(BOOK);
  });

  it('keeps the password hidden until the real-checkout link is used', () => {
    const d = root.querySelector('[role="dialog"]');
    expect(d.textContent).not.toContain('demo-pass');
    const btn = [...d.querySelectorAll('button')].find((b) => b.textContent.includes("See Shopify's real checkout (test mode)"));
    btn.click();
    expect(d.textContent).toContain('demo-pass');
    const go = [...d.querySelectorAll('a')].find((a) => a.href.includes('/cart/c/c1'));
    expect(go).toBeTruthy();
  });

  it('closes on Escape and returns focus to the opener', () => {
    const d = root.querySelector('[role="dialog"]');
    d.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(root.querySelector('[role="dialog"]').hidden).toBe(true);
    expect(document.activeElement).toBe(opener);
  });

  it('traps Tab focus inside the dialog', () => {
    const d = root.querySelector('[role="dialog"]');
    const f = [...d.querySelectorAll('a[href],button:not([disabled])')];
    f[f.length - 1].focus();
    d.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement).toBe(f[0]);
  });
});
