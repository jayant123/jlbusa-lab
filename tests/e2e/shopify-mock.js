// Routes Storefront API calls to fixtures so e2e tests never touch the real store.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const product = JSON.parse(readFileSync(resolve(process.cwd(), 'tests/fixtures/product-ostrel.json'), 'utf8'));
const variants = product.data.product.variants.nodes;

function cartFrom(lines) {
  const total = lines.reduce((s, l) => s + l.qty * Number(l.v.price.amount), 0);
  return {
    id: 'gid://shopify/Cart/c1', checkoutUrl: 'https://aion-concept-by-jlb-usa.myshopify.com/cart/c/c1?key=k',
    cost: { totalAmount: { amount: String(total), currencyCode: 'USD' } },
    lines: { nodes: lines.map((l, i) => ({ id: `gid://shopify/CartLine/${i}`, quantity: l.qty, attributes: [],
      merchandise: { id: l.v.id, title: l.v.selectedOptions.map((o) => o.value).join(' / '), price: l.v.price,
        product: { title: 'OSTREL Meridian 40' }, selectedOptions: l.v.selectedOptions } })) },
  };
}

export async function mockShopify(page, { failProducts = false } = {}) {
  const lines = [];
  await page.route('**/api/2025-10/graphql.json', async (route) => {
    const { query, variables } = route.request().postDataJSON();
    if (query.includes('product(handle')) {
      if (failProducts) return route.fulfill({ status: 503, body: '{}' });
      return route.fulfill({ json: product });
    }
    if (query.includes('cartCreate') || query.includes('cartLinesAdd')) {
      for (const l of variables.lines) lines.push({ v: variants.find((v) => v.id === l.merchandiseId), qty: l.quantity });
      const key = query.includes('cartCreate') ? 'cartCreate' : 'cartLinesAdd';
      return route.fulfill({ json: { data: { [key]: { cart: cartFrom(lines), userErrors: [] } } } });
    }
    if (query.includes('cart(id')) return route.fulfill({ json: { data: { cart: lines.length ? cartFrom(lines) : null } } });
    return route.fulfill({ json: { data: {} } });
  });
}
