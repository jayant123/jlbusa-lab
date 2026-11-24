// Storefront API fixtures built from a concept's seed, so e2e tests never touch the real store.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const combos = (options) => options.reduce((acc, o) => acc.flatMap((a) => o.values.map((v) => ({ ...a, [o.name]: v }))), [{}]);
const matches = (when, sel) => Object.entries(when).every(([k, v]) => sel[k] === v);

export function productsFrom(seedFile) {
  const seed = JSON.parse(readFileSync(resolve(process.cwd(), seedFile), 'utf8'));
  return Object.fromEntries(seed.products.map((p) => {
    const variants = combos(p.options).map((sel, i) => ({
      id: `gid://shopify/ProductVariant/${p.handle}-${i}`,
      availableForSale: !(p.inventory.set || []).some((s) => matches(s.when, sel) && s.qty === 0),
      price: { amount: String(p.options.reduce((s, o) => s + (p.price.add?.[o.name]?.[sel[o.name]] ?? 0), p.price.base ?? 0)), currencyCode: 'USD' },
      selectedOptions: Object.entries(sel).map(([name, value]) => ({ name, value })),
    }));
    return [p.handle, { id: `gid://shopify/Product/${p.handle}`, title: p.title, handle: p.handle,
      options: p.options.map((o) => ({ name: o.name, optionValues: o.values.map((name) => ({ name })) })), variants: { nodes: variants } }];
  }));
}

export async function mockSeed(page, seedFile, { failProducts = false } = {}) {
  const products = productsFrom(seedFile);
  const byId = Object.fromEntries(Object.values(products).flatMap((p) => p.variants.nodes.map((v) => [v.id, { v, p }])));
  const lines = [], sent = [];
  const cart = () => ({
    id: 'gid://shopify/Cart/s1', checkoutUrl: 'https://example.myshopify.com/cart/c/s1?key=k',
    cost: { totalAmount: { amount: String(lines.reduce((s, l) => s + l.qty * Number(byId[l.id].v.price.amount), 0)), currencyCode: 'USD' } },
    lines: { nodes: lines.map((l, i) => ({ id: `gid://shopify/CartLine/${i}`, quantity: l.qty, attributes: [],
      merchandise: { id: l.id, title: byId[l.id].v.selectedOptions.map((o) => o.value).join(' / '), price: byId[l.id].v.price,
        product: { title: byId[l.id].p.title }, selectedOptions: byId[l.id].v.selectedOptions } })) },
  });
  await page.route('**/api/2025-10/graphql.json', async (route) => {
    const { query, variables } = route.request().postDataJSON();
    if (query.includes('product(handle')) {
      if (failProducts) return route.fulfill({ status: 503, body: '{}' });
      return route.fulfill({ json: { data: { product: products[variables.handle] || null } } });
    }
    if (query.includes('cartCreate') || query.includes('cartLinesAdd')) {
      sent.push(variables.lines);
      for (const l of variables.lines) lines.push({ id: l.merchandiseId, qty: l.quantity });
      const key = query.includes('cartCreate') ? 'cartCreate' : 'cartLinesAdd';
      return route.fulfill({ json: { data: { [key]: { cart: cart(), userErrors: [] } } } });
    }
    if (query.includes('cart(id')) return route.fulfill({ json: { data: { cart: lines.length ? cart() : null } } });
    return route.fulfill({ json: { data: {} } });
  });
  return { sent };
}
