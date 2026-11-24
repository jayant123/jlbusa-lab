// The three NUITHRA fragrances: notes per stage, the botanicals that stand for them in the 3D scene, the juice
// color and a five-family profile for the comparison chart. Prices and stock always come from Shopify.
export const TIERS = ['top', 'heart', 'base'];
export const TIER_LABEL = { top: 'Top notes', heart: 'Heart notes', base: 'Base notes' };
export const TIER_TIME = { top: 'First 15 minutes', heart: 'The first hours', base: 'Six hours and on' };
export const FAMILIES = ['Fresh', 'Floral', 'Spice', 'Wood', 'Sweet'];
export const SIZES = ['30 ml', '50 ml', '100 ml'];
const SCALE = { '30 ml': 0.84, '50 ml': 1, '100 ml': 1.24 };

// Botanical kinds are generated in the scene: berry, citrus, petal, resin, pod, bean, leaf, cardamom, thread, shaving, puff, root, bark.
export const SCENTS = {
  'nuithra-amber-hour': {
    name: 'Amber Hour', mood: 'Warm and resinous', liquid: '#b5601a',
    notes: { top: ['Bergamot', 'Pink pepper'], heart: ['Iris', 'Labdanum'], base: ['Amber', 'Vanilla', 'Tonka'] },
    botanicals: {
      top: [{ kind: 'citrus', color: '#b8c25a', n: 8 }, { kind: 'berry', color: '#d9727f', n: 14 }],
      heart: [{ kind: 'petal', color: '#8b7bd1', n: 12 }, { kind: 'resin', color: '#9a4a12', n: 8 }],
      base: [{ kind: 'resin', color: '#d38422', n: 10 }, { kind: 'pod', color: '#2e1b12', n: 6 }, { kind: 'bean', color: '#3a2216', n: 10 }],
    },
    profile: { Fresh: 2, Floral: 2, Spice: 3, Wood: 2, Sweet: 5 },
  },
  'nuithra-fig-night': {
    name: 'Fig Night', mood: 'Green and milky', liquid: '#6e3a52',
    notes: { top: ['Fig leaf', 'Cardamom'], heart: ['Fig', 'Violet'], base: ['Cedar', 'White musk'] },
    botanicals: {
      top: [{ kind: 'leaf', color: '#4e6b3a', n: 8, size: 1.6 }, { kind: 'cardamom', color: '#a8b67c', n: 12 }],
      heart: [{ kind: 'berry', color: '#5b2a49', n: 6, size: 2.4 }, { kind: 'petal', color: '#6c3f8f', n: 12 }],
      base: [{ kind: 'shaving', color: '#b98b5e', n: 10 }, { kind: 'puff', color: '#f2ece4', n: 10 }],
    },
    profile: { Fresh: 4, Floral: 3, Spice: 2, Wood: 3, Sweet: 2 },
  },
  'nuithra-smoke-garden': {
    name: 'Smoke Garden', mood: 'Smoky and floral', liquid: '#6a4423',
    notes: { top: ['Black tea', 'Saffron'], heart: ['Rose', 'Incense'], base: ['Vetiver', 'Birch'] },
    botanicals: {
      top: [{ kind: 'leaf', color: '#2a2f1f', n: 14, size: 0.7 }, { kind: 'thread', color: '#c8361d', n: 16 }],
      heart: [{ kind: 'petal', color: '#a3233a', n: 14 }, { kind: 'resin', color: '#3b2a24', n: 8 }],
      base: [{ kind: 'root', color: '#8e7350', n: 10 }, { kind: 'bark', color: '#e6e0d2', n: 8 }],
    },
    profile: { Fresh: 1, Floral: 3, Spice: 4, Wood: 5, Sweet: 1 },
  },
};

export const scentOf = (handle) => SCENTS[handle] || SCENTS['nuithra-amber-hour'];
export const sizeScale = (size) => SCALE[size] ?? 1;
export const botanicalCount = (b, tier) => (tier === 'high' ? b.n : Math.max(2, Math.round(b.n * (tier === 'mid' ? 0.6 : 0.4))));
