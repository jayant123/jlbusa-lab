import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCart } from '../../src/kit/cart.js';

const cartPayload = (id, lines) => ({
  id, checkoutUrl: `https://x.myshopify.com/cart/c/${id}?key=k`,
  cost: { totalAmount: { amount: String(lines.reduce((s, l) => s + l.q * l.p, 0)), currencyCode: 'USD' } },
  lines: { nodes: lines.map((l, i) => ({ id: `line${i}`, quantity: l.q, attributes: [],
    merchandise: { id: l.v, title: 'Champagne / Polished steel / Cognac calf', price: { amount: String(l.p) },
      product: { title: 'OSTREL Meridian 40' }, selectedOptions: [{ name: 'Dial', value: 'Champagne' }] } })) },
});

function fakeSf(handlers) {
  return { query: vi.fn(async (gql, vars) => {
    for (const [k, fn] of Object.entries(handlers)) if (gql.includes(k)) return fn(vars);
    throw new Error('unexpected query ' + gql.slice(0, 40));
  }) };
}

beforeEach(() => localStorage.clear());

describe('cart', () => {
  it('creates a cart on first add and stores its id', async () => {
    const sf = fakeSf({ cartCreate: () => ({ cartCreate: { cart: cartPayload('c1', [{ v: 'V1', q: 1, p: 4800 }]), userErrors: [] } }) });
    const cart = createCart(sf, 'ostrel.cart');
    await cart.add('V1', 1);
    expect(localStorage.getItem('ostrel.cart')).toBe('c1');
    expect(cart.lines()).toEqual([{ id: 'line0', variantId: 'V1', title: 'OSTREL Meridian 40', options: { Dial: 'Champagne' }, qty: 1, price: 4800, attrs: {} }]);
    expect(cart.total()).toEqual({ amount: 4800, currencyCode: 'USD' });
    expect(cart.checkoutUrl()).toContain('/cart/c/c1');
  });

  it('replaces an expired stored cart with a new one', async () => {
    localStorage.setItem('ostrel.cart', 'old');
    const sf = fakeSf({
      cartLinesAdd: () => ({ cartLinesAdd: { cart: null, userErrors: [{ message: 'The specified cart does not exist.' }] } }),
      'query C': () => ({ cart: null }),
      cartCreate: () => ({ cartCreate: { cart: cartPayload('c2', [{ v: 'V1', q: 1, p: 4800 }]), userErrors: [] } }),
    });
    const cart = createCart(sf, 'ostrel.cart');
    await cart.add('V1', 1);
    expect(localStorage.getItem('ostrel.cart')).toBe('c2');
    expect(cart.lines()).toHaveLength(1);
  });

  it('rejects with a user message and keeps the stored cart when Shopify is down', async () => {
    localStorage.setItem('ostrel.cart', 'c1');
    const sf = { query: vi.fn().mockRejectedValue(Object.assign(new Error('Storefront 503'), { retryable: true })) };
    const cart = createCart(sf, 'ostrel.cart');
    const err = await cart.add('V1', 1).catch((e) => e);
    expect(err.userMessage).toBe("Couldn't update your cart. Try again.");
    expect(localStorage.getItem('ostrel.cart')).toBe('c1');
  });

  it('notifies subscribers and supports quantity changes and removal', async () => {
    const sf = fakeSf({
      cartCreate: () => ({ cartCreate: { cart: cartPayload('c1', [{ v: 'V1', q: 1, p: 100 }]), userErrors: [] } }),
      cartLinesUpdate: () => ({ cartLinesUpdate: { cart: cartPayload('c1', [{ v: 'V1', q: 3, p: 100 }]), userErrors: [] } }),
      cartLinesRemove: () => ({ cartLinesRemove: { cart: cartPayload('c1', []), userErrors: [] } }),
    });
    const cart = createCart(sf, 'k');
    const seen = [];
    cart.subscribe(() => seen.push(cart.lines().length));
    await cart.add('V1', 1);
    await cart.setQty('line0', 3);
    expect(cart.total().amount).toBe(300);
    await cart.remove('line0');
    expect(seen).toEqual([1, 1, 0]);
  });
});
