// Product data and variant resolution, always from the store (never hardcoded prices).
const PRODUCT_Q = `query P($handle: String!) {
  product(handle: $handle) {
    id title handle
    options { name optionValues { name } }
    variants(first: 250) { nodes { id availableForSale price { amount currencyCode } selectedOptions { name value } } }
  }
}`;

export async function fetchProduct(sf, handle) {
  const { product } = await sf.query(PRODUCT_Q, { handle });
  if (!product) throw new Error(`Product not found: ${handle}`);
  return {
    id: product.id,
    title: product.title,
    handle: product.handle,
    options: product.options.map((o) => ({ name: o.name, values: o.optionValues.map((v) => v.name) })),
    variants: product.variants.nodes.map((v) => ({
      id: v.id,
      price: Number(v.price.amount),
      currencyCode: v.price.currencyCode,
      available: v.availableForSale,
      selectedOptions: Object.fromEntries(v.selectedOptions.map((o) => [o.name, o.value])),
    })),
  };
}

export function resolveVariant(product, selections) {
  if (!product.options.every((o) => selections[o.name] != null)) return null;
  return product.variants.find((v) => product.options.every((o) => v.selectedOptions[o.name] === selections[o.name])) ?? null;
}

export function variantState(variant) {
  if (!variant) return 'unavailable';
  return variant.available ? 'available' : 'soldout';
}
