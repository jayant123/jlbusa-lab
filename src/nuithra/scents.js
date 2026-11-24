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
    story: 'A warm scent for cold evenings. It opens with bergamot and pink pepper. Iris and labdanum come next. Amber and vanilla stay on the skin for hours.',
    name: 'Amber Hour', mood: 'Warm and resinous', glass: '#d77a1c', shape: 'slab', cap: 'fluted',
    bottle: 'A heavy slab of amber glass under a fluted gold cap.',
    notes: { top: ['Bergamot', 'Pink pepper'], heart: ['Iris', 'Labdanum'], base: ['Amber', 'Vanilla', 'Tonka'] },
    profile: { Fresh: 2, Floral: 2, Spice: 3, Wood: 2, Sweet: 5 },
  },
  'nuithra-fig-night': {
    story: 'Green and soft at first. Fig leaf and cardamom open it. Ripe fig and violet sit at the heart. Cedar and white musk keep it close to the skin.',
    name: 'Fig Night', mood: 'Green and milky', glass: '#8a2f6e', shape: 'moon', cap: 'sphere',
    bottle: 'A full moon of plum glass with a polished stone stopper.',
    notes: { top: ['Fig leaf', 'Cardamom'], heart: ['Fig', 'Violet'], base: ['Cedar', 'White musk'] },
    profile: { Fresh: 4, Floral: 3, Spice: 2, Wood: 3, Sweet: 2 },
  },
  'nuithra-smoke-garden': {
    story: 'Roses in a room where incense has burned. Black tea and saffron start it. The smoke settles into vetiver and birch.',
    name: 'Smoke Garden', mood: 'Smoky and floral', glass: '#a08a78', shape: 'column', cap: 'cube',
    bottle: 'A thick column of smoked glass under a black cube.',
    notes: { top: ['Black tea', 'Saffron'], heart: ['Rose', 'Incense'], base: ['Vetiver', 'Birch'] },
    profile: { Fresh: 1, Floral: 3, Spice: 4, Wood: 5, Sweet: 1 },
  },
  'nuithra-salt-iris': {
    story: 'Clean and cool like air by the sea. Sea salt and pear open it. Powdery iris sits at the heart. Driftwood and musk finish it.',
    name: 'Salt Iris', mood: 'Cool and powdery', glass: '#8fa2e6', shape: 'obelisk', cap: 'spire',
    bottle: 'A tall faceted obelisk of pale iris glass with a silver spire.',
    notes: { top: ['Sea salt', 'Pear'], heart: ['Iris', 'Ambrette'], base: ['Driftwood', 'Musk'] },
    profile: { Fresh: 4, Floral: 4, Spice: 1, Wood: 2, Sweet: 2 },
  },
  'nuithra-vetiver-rain': {
    story: 'The smell of a garden after rain. Grapefruit opens it. Vetiver and geranium follow. Oakmoss and cedar give it a green and earthy base.',
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

// Scent finder: three questions. The answer to "which do you like" counts most.
export const QUIZ = [
  { id: 'when', q: 'When will you wear it most?', answers: [
    { id: 'day', label: 'During the day', score: { 'nuithra-salt-iris': 1, 'nuithra-vetiver-rain': 1, 'nuithra-fig-night': 1 } },
    { id: 'evening', label: 'In the evening', score: { 'nuithra-amber-hour': 1, 'nuithra-smoke-garden': 1 } },
    { id: 'both', label: 'Both', score: {} },
  ] },
  { id: 'like', q: 'Which of these do you like?', answers: [
    { id: 'fresh', label: 'Fresh and clean', score: { 'nuithra-salt-iris': 3, 'nuithra-vetiver-rain': 3 } },
    { id: 'flowers', label: 'Soft flowers', score: { 'nuithra-fig-night': 3, 'nuithra-salt-iris': 2 } },
    { id: 'warm', label: 'Warm and sweet', score: { 'nuithra-amber-hour': 3, 'nuithra-fig-night': 1 } },
    { id: 'wood', label: 'Wood and smoke', score: { 'nuithra-smoke-garden': 3, 'nuithra-vetiver-rain': 3 } },
  ] },
  { id: 'strength', q: 'How strong should it be?', answers: [
    { id: 'soft', label: 'Close to the skin', score: { 'nuithra-salt-iris': 1, 'nuithra-fig-night': 1 } },
    { id: 'strong', label: 'Noticed across a room', score: { 'nuithra-amber-hour': 1, 'nuithra-smoke-garden': 1 } },
  ] },
];

export function suggest(answers) {
  if (!QUIZ.every((q) => answers?.[q.id])) return null;
  const total = Object.fromEntries(ORDER.map((h) => [h, 0]));
  for (const q of QUIZ) {
    const a = q.answers.find((x) => x.id === answers[q.id]);
    if (!a) return null;
    for (const [h, v] of Object.entries(a.score)) total[h] += v;
  }
  return ORDER.reduce((best, h) => (total[h] > total[best] ? h : best), ORDER[0]);
}
