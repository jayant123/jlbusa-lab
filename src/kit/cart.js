// Shopify cart kept by id in localStorage. All prices and totals come from Shopify.
const CART_F = `fragment CartF on Cart {
  id checkoutUrl
  cost { totalAmount { amount currencyCode } }
  lines(first: 100) { nodes { id quantity attributes { key value }
    merchandise { ... on ProductVariant { id title price { amount } product { title } selectedOptions { name value } } } } }
}`;
const M = {
  create: `mutation CartCreateM($lines: [CartLineInput!]) { cartCreate(input: { lines: $lines }) { cart { ...CartF } userErrors { message } } } ${CART_F}`,
  add: `mutation CartAddM($id: ID!, $lines: [CartLineInput!]!) { cartLinesAdd(cartId: $id, lines: $lines) { cart { ...CartF } userErrors { message } } } ${CART_F}`,
  update: `mutation CartUpdateM($id: ID!, $lines: [CartLineUpdateInput!]!) { cartLinesUpdate(cartId: $id, lines: $lines) { cart { ...CartF } userErrors { message } } } ${CART_F}`,
  remove: `mutation CartRemoveM($id: ID!, $ids: [ID!]!) { cartLinesRemove(cartId: $id, lineIds: $ids) { cart { ...CartF } userErrors { message } } } ${CART_F}`,
  get: `query C($id: ID!) { cart(id: $id) { ...CartF } } ${CART_F}`,
};
const USER_MSG = "Couldn't update your cart. Try again.";

const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  del: (k) => { try { localStorage.removeItem(k); } catch { /* private mode */ } },
};

function normalize(c) {
  if (!c) return null;
  return {
    id: c.id,
    checkoutUrl: c.checkoutUrl,
    total: { amount: Number(c.cost.totalAmount.amount), currencyCode: c.cost.totalAmount.currencyCode },
    lines: c.lines.nodes.map((l) => ({
      id: l.id,
      variantId: l.merchandise.id,
      title: l.merchandise.product.title,
      options: Object.fromEntries(l.merchandise.selectedOptions.map((o) => [o.name, o.value])),
      qty: l.quantity,
      price: Number(l.merchandise.price.amount),
      attrs: Object.fromEntries(l.attributes.map((a) => [a.key, a.value])),
    })),
  };
}

export function createCart(sf, storageKey) {
  let state = null;
  const subs = new Set();
  const emit = () => subs.forEach((fn) => fn());

  async function run(fn) {
    try {
      return await fn();
    } catch (e) {
      const err = new Error(e.message);
      err.userMessage = USER_MSG;
      err.cause = e;
      throw err;
    }
  }
  const commit = (c) => { state = normalize(c); if (state) store.set(storageKey, state.id); emit(); return state; };
  const toLines = (variantId, qty, attrs) => [{ merchandiseId: variantId, quantity: qty,
    attributes: Object.entries(attrs || {}).map(([key, value]) => ({ key, value: String(value) })) }];

  async function create(lines) {
    const r = await sf.query(M.create, { lines });
    return commit(r.cartCreate.cart);
  }

  return {
    lines: () => state?.lines ?? [],
    total: () => state?.total ?? { amount: 0, currencyCode: 'USD' },
    checkoutUrl: () => state?.checkoutUrl ?? null,
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    async restore() {
      const id = store.get(storageKey);
      if (!id) return state;
      return run(async () => {
        const r = await sf.query(M.get, { id });
        if (!r.cart) { store.del(storageKey); return null; }
        return commit(r.cart);
      });
    },
    add(variantId, qty = 1, attrs) {
      return run(async () => {
        const id = state?.id ?? store.get(storageKey);
        const lines = toLines(variantId, qty, attrs);
        if (!id) return create(lines);
        const r = await sf.query(M.add, { id, lines });
        if (!r.cartLinesAdd.cart) { store.del(storageKey); return create(lines); }
        return commit(r.cartLinesAdd.cart);
      });
    },
    setQty(lineId, qty) {
      return run(async () => {
        const r = await sf.query(M.update, { id: state.id, lines: [{ id: lineId, quantity: qty }] });
        return commit(r.cartLinesUpdate.cart);
      });
    },
    remove(lineId) {
      return run(async () => {
        const r = await sf.query(M.remove, { id: state.id, ids: [lineId] });
        return commit(r.cartLinesRemove.cart);
      });
    },
  };
}
