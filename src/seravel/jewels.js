// SERAVEL catalog data for the page and the 3D: how each metal and stone looks, the three pieces, ring sizes and
// the engraving rules. Prices and stock always come from Shopify.
export const METALS = {
  'Yellow gold': { color: '#f2c46c', karat: '18k', note: 'Warm and classic' },
  'White gold': { color: '#dfe2e6', karat: '18k', note: 'Bright and cool' },
  'Rose gold': { color: '#efa98c', karat: '18k', note: 'Soft and pink' },
};

export const STONES = {
  Diamond: { color: '#ffffff', ior: 2.42, dispersion: 0.044, note: 'Lab-grown. 1 carat. G color. VS1 clarity.' },
  Sapphire: { color: '#2340c8', ior: 1.77, dispersion: 0.018, note: 'Ceylon blue. 1 carat. Heat treated.' },
  Emerald: { color: '#1a9a56', ior: 1.57, dispersion: 0.014, note: 'Colombian green. 0.9 carat. Lightly oiled.' },
};

export const PIECES = {
  'seravel-solace-ring': { name: 'Solace Ring', kind: 'Ring', line: 'One stone held in four claws on a slim comfort-fit band.', from: 'Metal' },
  'seravel-halo-pendant': { name: 'Halo Pendant', kind: 'Necklace', line: 'A round stone in a ring of sixteen small diamonds on a cable chain.', from: 'Metal' },
  'seravel-tide-hoops': { name: 'Tide Hoops', kind: 'Earrings', line: 'Hollow hoops with waves cut around them by hand.', from: 'Metal' },
};

// US ring sizes 4 to 10 in half sizes.
export const RING_SIZES = Array.from({ length: 13 }, (_, i) => String(4 + i / 2));

// Inside diameter in mm for a US size: 11.63 mm + 0.8128 mm per size.
export function sizeToMm(size) {
  const n = Number(size);
  if (!RING_SIZES.includes(String(size)) || Number.isNaN(n)) return null;
  return Math.round((11.63 + 0.8128 * n) * 10) / 10;
}

export const MAX_ENGRAVING = 18;
export function cleanEngraving(text) {
  return String(text ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9 &.'-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_ENGRAVING)
    .trim();
}

// Cart line attributes for the ring: the size always, the engraving when there is one.
export function ringAttrs({ size, engraving }) {
  if (!RING_SIZES.includes(String(size))) return null;
  const out = { 'Ring size': `US ${size}` };
  const e = cleanEngraving(engraving);
  if (e) out.Engraving = e;
  return out;
}
