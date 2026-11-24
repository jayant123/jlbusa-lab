// PLINTHA modular sofa: a main run (left to right), an optional corner turning into a return run, and free ottomans.
// Arms close a run, a chaise can only sit at an end, one corner at most, eight modules in total.
export const WIDTH = { armless: 90, corner: 100, arm_left: 105, arm_right: 105, chaise: 90, ottoman: 90 };
export const DEPTH = { armless: 100, corner: 100, arm_left: 100, arm_right: 100, chaise: 165, ottoman: 90 };
export const MAX_MODULES = 8;
export const EMPTY = Object.freeze({ main: [], ret: [], ottomans: 0 });

export const count = (l) => l.main.length + l.ret.length + l.ottomans;
const isArm = (m) => m === 'arm_left' || m === 'arm_right';

function validMain(run) {
  const last = run.length - 1;
  const ci = run.indexOf('corner');
  if (run.filter((m) => m === 'corner').length > 1 || (ci >= 0 && ci !== last)) return false;
  return run.every((m, i) => {
    if (m === 'arm_left') return i === 0;
    if (m === 'arm_right') return i === last && ci < 0;
    if (m === 'chaise') return i === 0 || (i === last && ci < 0);
    return true;
  });
}

function validReturn(run) {
  const last = run.length - 1;
  return run.every((m, i) => (m === 'corner' || m === 'ottoman' ? false : isArm(m) || m === 'chaise' ? i === last : true));
}

export function place(layout, module, slot) {
  if (!layout || !(module in WIDTH) || count(layout) >= MAX_MODULES) return null;
  if (module === 'chaise' && [...layout.main, ...layout.ret].includes('chaise')) return null;
  if (module === 'ottoman') return slot === 'free' ? { ...layout, ottomans: layout.ottomans + 1 } : null;
  if (slot === 'start' || slot === 'end') {
    if (slot === 'end' && layout.main.includes('corner')) return null;
    const main = slot === 'start' ? [module, ...layout.main] : [...layout.main, module];
    return validMain(main) ? { ...layout, main } : null;
  }
  if (slot === 'return') {
    if (layout.main.at(-1) !== 'corner') return null;
    const ret = [...layout.ret, module];
    return validReturn(ret) ? { ...layout, ret } : null;
  }
  return null;
}

export function remove(layout, where, index) {
  if (where === 'ottoman') return { ...layout, ottomans: Math.max(0, layout.ottomans - 1) };
  const run = [...layout[where]];
  run.splice(index, 1);
  const next = where === 'main' ? { ...layout, main: run, ret: run.at(-1) === 'corner' ? layout.ret : [] } : { ...layout, ret: run };
  return validMain(next.main) && validReturn(next.ret) ? next : layout;
}

export function dimensions(layout) {
  const widthCm = layout.main.reduce((s, m) => s + WIDTH[m], 0);
  let depthCm = layout.main.length ? Math.max(...layout.main.map((m) => DEPTH[m])) : 0;
  if (layout.main.includes('corner')) depthCm = Math.max(depthCm, 100 + layout.ret.reduce((s, m) => s + WIDTH[m], 0));
  return { widthCm, depthCm };
}

export const handleOf = (m) => `plintha-${m.replace('_', '-')}`;

export function cartLines(layout, fabric, products) {
  const order = [...layout.main, ...layout.ret, ...Array(layout.ottomans).fill('ottoman')];
  const counts = new Map();
  for (const m of order) counts.set(m, (counts.get(m) || 0) + 1);
  const out = [];
  for (const [m, qty] of counts) {
    const v = products[handleOf(m)]?.variants.find((x) => x.selectedOptions.Fabric === fabric);
    if (v) out.push({ variantId: v.id, qty });
  }
  return out;
}

// Total for the layout in the chosen fabric, from the store's variant prices.
export function quote(layout, fabric, products) {
  const order = [...layout.main, ...layout.ret, ...Array(layout.ottomans).fill('ottoman')];
  let amount = 0, missing = 0, currencyCode = 'USD';
  for (const m of order) {
    const v = products[handleOf(m)]?.variants.find((x) => x.selectedOptions.Fabric === fabric);
    if (!v) { missing += 1; continue; }
    amount += v.price;
    if (v.currencyCode) currencyCode = v.currencyCode;
  }
  return { amount, currencyCode, missing };
}
