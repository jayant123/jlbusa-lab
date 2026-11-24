// The five NUITHRA fragrances. Each has its own bottle shape and its own color of glass. The glass color is the
// color of the juice. Prices and stock always come from Shopify.
export const TIERS = ['top', 'heart', 'base'];
export const TIER_LABEL = { top: 'Top notes', heart: 'Heart notes', base: 'Base notes' };
export const TIER_TIME = { top: 'First 15 minutes', heart: 'The first hours', base: 'Six hours and on' };
export const FAMILIES = ['Fresh', 'Floral', 'Spice', 'Wood', 'Sweet'];
export const SIZES = ['30 ml', '50 ml', '100 ml'];
export const SHAPES = ['slab', 'moon', 'column', 'obelisk', 'octagon'];
const SCALE = { '30 ml': 0.84, '50 ml': 1, '100 ml': 1.2 };

export const ORDER = ['nuithra-salt-iris', 'nuithra-fig-night', 'nuithra-amber-hour', 'nuithra-smoke-garden', 'nuithra-vetiver-rain'];

export const SCENTS = {
  'nuithra-amber-hour': {
    name: 'Amber Hour', mood: 'Warm and resinous', glass: '#d77a1c', shape: 'slab', cap: 'fluted',
    bottle: 'A heavy slab of amber glass under a fluted gold cap.',
    notes: { top: ['Bergamot', 'Pink pepper'], heart: ['Iris', 'Labdanum'], base: ['Amber', 'Vanilla', 'Tonka'] },
    profile: { Fresh: 2, Floral: 2, Spice: 3, Wood: 2, Sweet: 5 },
  },
  'nuithra-fig-night': {
    name: 'Fig Night', mood: 'Green and milky', glass: '#8a2f6e', shape: 'moon', cap: 'sphere',
    bottle: 'A full moon of plum glass with a polished stone stopper.',
    notes: { top: ['Fig leaf', 'Cardamom'], heart: ['Fig', 'Violet'], base: ['Cedar', 'White musk'] },
    profile: { Fresh: 4, Floral: 3, Spice: 2, Wood: 3, Sweet: 2 },
  },
  'nuithra-smoke-garden': {
    name: 'Smoke Garden', mood: 'Smoky and floral', glass: '#a08a78', shape: 'column', cap: 'cube',
    bottle: 'A thick column of smoked glass under a black cube.',
    notes: { top: ['Black tea', 'Saffron'], heart: ['Rose', 'Incense'], base: ['Vetiver', 'Birch'] },
    profile: { Fresh: 1, Floral: 3, Spice: 4, Wood: 5, Sweet: 1 },
  },
  'nuithra-salt-iris': {
    name: 'Salt Iris', mood: 'Cool and powdery', glass: '#8fa2e6', shape: 'obelisk', cap: 'spire',
    bottle: 'A tall faceted obelisk of pale iris glass with a silver spire.',
    notes: { top: ['Sea salt', 'Pear'], heart: ['Iris', 'Ambrette'], base: ['Driftwood', 'Musk'] },
    profile: { Fresh: 4, Floral: 4, Spice: 1, Wood: 2, Sweet: 2 },
  },
  'nuithra-vetiver-rain': {
    name: 'Vetiver Rain', mood: 'Green and earthy', glass: '#2f8a5a', shape: 'octagon', cap: 'disc',
    bottle: 'A low octagon of bottle-green glass under an oak disc.',
    notes: { top: ['Grapefruit', 'Petitgrain'], heart: ['Vetiver', 'Geranium'], base: ['Oakmoss', 'Cedar'] },
    profile: { Fresh: 4, Floral: 1, Spice: 2, Wood: 5, Sweet: 1 },
  },
};

export const scentOf = (handle) => SCENTS[handle] || SCENTS[ORDER[0]];
export const sizeScale = (size) => SCALE[size] ?? 1;

// The discovery set holds three 8 ml sprays. The visitor picks any three. Names go on the cart line in display order.
export function discoveryAttrs(picks) {
  if (!Array.isArray(picks) || picks.length !== 3 || new Set(picks).size !== 3 || !picks.every((h) => SCENTS[h])) return null;
  return { Scents: ORDER.filter((h) => picks.includes(h)).map((h) => SCENTS[h].name).join(', ') };
}
