import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createStorefront, StorefrontError } from '../../src/kit/storefront.js';
import { fetchProduct, resolveVariant, variantState } from '../../src/kit/catalog.js';

const raw = JSON.parse(readFileSync(resolve(process.cwd(), 'tests/fixtures/product-ostrel.json'), 'utf8'));
const res = (status, body) => ({ ok: status < 400, status, json: async () => body });
const sfWith = (...responses) => {
  const f = vi.fn();
  responses.forEach((r) => f.mockResolvedValueOnce(r));
  vi.stubGlobal('fetch', f);
  return { f, sf: createStorefront({ domain: 'x.myshopify.com', token: 't', retryDelayMs: 1 }) };
};
afterEach(() => vi.unstubAllGlobals());

describe('catalog', () => {
  it('normalizes a product and resolves full selections', async () => {
    const { sf } = sfWith(res(200, raw));
    const p = await fetchProduct(sf, 'ostrel-meridian-40');
    expect(p.options.map((o) => o.name)).toEqual(['Dial', 'Case', 'Strap']);
    expect(p.variants).toHaveLength(26);
    const v = resolveVariant(p, { Dial: 'Champagne', Case: 'Polished steel', Strap: 'Cognac calf' });
    expect(v.price).toBe(4800);
    expect(v.currencyCode).toBe('USD');
    expect(variantState(v)).toBe('available');
  });
  it('returns null for a partial selection', async () => {
    const { sf } = sfWith(res(200, raw));
    const p = await fetchProduct(sf, 'ostrel-meridian-40');
    expect(resolveVariant(p, { Dial: 'Champagne', Case: 'Polished steel' })).toBeNull();
  });
  it('reports sold out and unavailable combinations', async () => {
    const { sf } = sfWith(res(200, raw));
    const p = await fetchProduct(sf, 'ostrel-meridian-40');
    expect(variantState(resolveVariant(p, { Dial: 'Glacier', Case: 'Black ceramic', Strap: 'Steel bracelet' }))).toBe('soldout');
    expect(variantState(resolveVariant(p, { Dial: 'Glacier', Case: 'Black ceramic', Strap: 'Cognac calf' }))).toBe('unavailable');
  });
});

describe('storefront client', () => {
  it('sends the public token and retries once after a 429', async () => {
    const { f, sf } = sfWith(res(429, {}), res(200, { data: { shop: { name: 'S' } } }));
    const out = await sf.query('{shop{name}}');
    expect(out.shop.name).toBe('S');
    expect(f).toHaveBeenCalledTimes(2);
    expect(f.mock.calls[0][0]).toBe('https://x.myshopify.com/api/2025-10/graphql.json');
    expect(f.mock.calls[0][1].headers['X-Shopify-Storefront-Access-Token']).toBe('t');
  });
  it('rejects with a retryable StorefrontError after two 500s', async () => {
    const { sf } = sfWith(res(500, {}), res(500, {}));
    const err = await sf.query('{shop{name}}').catch((e) => e);
    expect(err).toBeInstanceOf(StorefrontError);
    expect(err.retryable).toBe(true);
    expect(err.status).toBe(500);
  });
  it('rejects when fetch itself fails (offline)', async () => {
    const f = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', f);
    const sf = createStorefront({ domain: 'x.myshopify.com', token: 't', retryDelayMs: 1 });
    const err = await sf.query('{shop{name}}').catch((e) => e);
    expect(err).toBeInstanceOf(StorefrontError);
    expect(err.retryable).toBe(true);
  });
  it('surfaces GraphQL errors as non-retryable', async () => {
    const { sf } = sfWith(res(200, { errors: [{ message: 'bad field' }] }));
    const err = await sf.query('{nope}').catch((e) => e);
    expect(err.retryable).toBe(false);
    expect(err.message).toContain('bad field');
  });
});
