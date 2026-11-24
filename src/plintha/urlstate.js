// Share links: "l.a.c~a.r~1~wool-moss" = main run ~ return run ~ ottomans ~ fabric. Decoding replays every placement
// through the layout rules, so tampered or stale links load their valid part and drop the rest.
import { EMPTY, place } from './layout.js';

export const FABRICS = ['Boucle Chalk', 'Wool Moss', 'Linen Sand', 'Velvet Ink'];
const CODE = { armless: 'a', corner: 'c', arm_left: 'l', arm_right: 'r', chaise: 'h', ottoman: 'o' };
const MOD = Object.fromEntries(Object.entries(CODE).map(([k, v]) => [v, k]));
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

export function encode(layout, fabric) {
  return [layout.main.map((m) => CODE[m]).join('.'), layout.ret.map((m) => CODE[m]).join('.'), layout.ottomans, slug(fabric)].join('~');
}

export function decode(str) {
  let layout = EMPTY;
  const parts = typeof str === 'string' ? str.split('~') : [];
  const run = (codes, slot) => {
    for (const c of (codes || '').split('.')) {
      const next = MOD[c] ? place(layout, MOD[c], slot) : null;
      if (next) layout = next;
    }
  };
  run(parts[0], 'end');
  run(parts[1], 'return');
  const n = Math.min(8, Math.max(0, parseInt(parts[2], 10) || 0));
  for (let i = 0; i < n; i++) layout = place(layout, 'ottoman', 'free') || layout;
  const fabric = FABRICS.find((f) => slug(f) === parts[3]) || FABRICS[0];
  return { layout, fabric };
}
