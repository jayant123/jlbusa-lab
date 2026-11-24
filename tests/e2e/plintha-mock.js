// PLINTHA Storefront API fixtures built from the seed, so e2e tests never touch the real store.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const seed = JSON.parse(readFileSync(resolve(process.cwd(), 'seed/plintha.json'), 'utf8'));
export const products = Object.fromEntries(seed.products.map((p) => {
  const fabrics = p.options[0].values;
  const variants = fabrics.map((f, i) => ({
    id: `gid://shopify/ProductVariant/${p.handle}-${i}`,
    availableForSale: !(p.inventory.set || []).some((s) => s.when.Fabric === f && s.qty === 0),
    price: { amount: String(p.price.base + (p.price.add.Fabric[f] || 0)), currencyCode: 'USD' },
    selectedOptions: [{ name: 'Fabric', value: f }],
  }));
  return [p.handle, { id: `gid://shopify/Product/${p.handle}`, title: p.title, handle: p.handle,
    options: [{ name: 'Fabric', optionValues: fabrics.map((name) => ({ name })) }], variants: { nodes: variants } }];
}));
const variantById = Object.fromEntries(Object.values(products).flatMap((p) => p.variants.nodes.map((v) => [v.id, { v, p }])));

function cartFrom(lines) {
  const total = lines.reduce((s, l) => s + l.qty * Number(variantById[l.id].v.price.amount), 0);
  return {
    id: 'gid://shopify/Cart/p1', checkoutUrl: 'https://plintha-concept-by-jlb-usa.myshopify.com/cart/c/p1?key=k',
    cost: { totalAmount: { amount: String(total), currencyCode: 'USD' } },
    lines: { nodes: lines.map((l, i) => {
      const { v, p } = variantById[l.id];
      return { id: `gid://shopify/CartLine/${i}`, quantity: l.qty, attributes: [],
        merchandise: { id: v.id, title: v.selectedOptions[0].value, price: v.price, product: { title: p.title }, selectedOptions: v.selectedOptions } };
    }) },
  };
}

export async function mockPlintha(page) {
  const lines = [];
  const sent = [];
  await page.route('**/api/2025-10/graphql.json', async (route) => {
    const { query, variables } = route.request().postDataJSON();
    if (query.includes('product(handle')) return route.fulfill({ json: { data: { product: products[variables.handle] || null } } });
    if (query.includes('cartCreate') || query.includes('cartLinesAdd')) {
      sent.push(variables.lines);
      for (const l of variables.lines) lines.push({ id: l.merchandiseId, qty: l.quantity });
      const key = query.includes('cartCreate') ? 'cartCreate' : 'cartLinesAdd';
      return route.fulfill({ json: { data: { [key]: { cart: cartFrom(lines), userErrors: [] } } } });
    }
    if (query.includes('cart(id')) return route.fulfill({ json: { data: { cart: lines.length ? cartFrom(lines) : null } } });
    return route.fulfill({ json: { data: {} } });
  });
  return { sent };
}
