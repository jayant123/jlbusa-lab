// VANTRIK shoe data: the parts a visitor can color, the palette, the stock colorways and the size chart.
// Prices and stock always come from Shopify.
export const PARTS = [
  { id: 'upper', label: 'Upper' },
  { id: 'midsole', label: 'Midsole' },
  { id: 'outsole', label: 'Outsole' },
  { id: 'laces', label: 'Laces' },
  { id: 'trim', label: 'Trim' },
];

export const PALETTE = {
  Bone: '#e8e2d4', Chalk: '#f4f2ec', Fog: '#b9bcbd', Graphite: '#3a3c40', Night: '#15171b',
  Ember: '#d4481c', Volt: '#c9de3c', Moss: '#4e5c38', Navy: '#1e2b46', Sky: '#9bc2dd', Oxblood: '#5b1a1e', Clay: '#b5704f',
};

export const MODELS = {
  'vantrik-vk1-runner': {
    name: 'VK-1 Runner', kind: 'runner', line: 'Knit runner',
    colorways: {
      Bone: { upper: 'Bone', midsole: 'Chalk', outsole: 'Graphite', laces: 'Chalk', trim: 'Ember' },
      Ember: { upper: 'Ember', midsole: 'Bone', outsole: 'Night', laces: 'Bone', trim: 'Night' },
      Night: { upper: 'Night', midsole: 'Graphite', outsole: 'Night', laces: 'Night', trim: 'Volt' },
      Moss: { upper: 'Moss', midsole: 'Bone', outsole: 'Clay', laces: 'Bone', trim: 'Clay' },
    },
  },
  'vantrik-vk2-court': {
    name: 'VK-2 Court', kind: 'court', line: 'Leather court',
    colorways: {
      Chalk: { upper: 'Chalk', midsole: 'Chalk', outsole: 'Fog', laces: 'Chalk', trim: 'Navy' },
      Navy: { upper: 'Navy', midsole: 'Chalk', outsole: 'Chalk', laces: 'Navy', trim: 'Chalk' },
      Oxblood: { upper: 'Oxblood', midsole: 'Bone', outsole: 'Clay', laces: 'Oxblood', trim: 'Bone' },
    },
  },
};
export const CUSTOM = 'vantrik-custom-pair';
export const CUSTOM_START = { upper: 'Sky', midsole: 'Chalk', outsole: 'Ember', laces: 'Chalk', trim: 'Ember' };

// Foot length in cm for each US men's size.
export const SIZES = [
  { us: 'US 7', cm: 25.0 }, { us: 'US 8', cm: 25.9 }, { us: 'US 9', cm: 26.7 },
  { us: 'US 10', cm: 27.5 }, { us: 'US 11', cm: 28.4 }, { us: 'US 12', cm: 29.2 },
];

export const colorwayOf = (handle, name) => {
  const m = MODELS[handle];
  return m?.colorways[name] || Object.values(m?.colorways || {})[0];
};

// The custom pair's colors as cart line attributes, in part order. null if any part is missing or off-palette.
export function customAttrs(colors) {
  if (!colors) return null;
  const out = {};
  for (const p of PARTS) {
    if (!PALETTE[colors[p.id]]) return null;
    out[p.label] = colors[p.id];
  }
  return out;
}

// The smallest size that fits a foot of this length. Feet a size below the chart start at US 7. null outside.
export function sizeFor(cm) {
  if (!Number.isFinite(cm) || cm < 24 || cm > SIZES[SIZES.length - 1].cm) return null;
  return SIZES.find((s) => s.cm >= cm)?.us ?? null;
}
