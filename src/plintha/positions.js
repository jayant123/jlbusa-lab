// Where each module stands, in meters (glTF axes: x to the right, z toward the viewer). A module's origin is its
// back-left floor corner. Return-run modules turn -90° so their backs face right. The composition is centered on x = 0.
import { WIDTH, DEPTH, place } from './layout.js';

const M = (cm) => cm / 100;
const OTTOMAN_GAP = 0.45;

export function placements(layout, { center = true } = {}) {
  const out = [];
  let x = 0;
  layout.main.forEach((kind, index) => { out.push({ id: `main:${index}`, kind, where: 'main', index, x, z: 0, rot: 0 }); x += M(WIDTH[kind]); });
  const mainW = x;
  let z = M(DEPTH.corner);
  layout.ret.forEach((kind, index) => { out.push({ id: `ret:${index}`, kind, where: 'ret', index, x: mainW, z, rot: -Math.PI / 2 }); z += M(WIDTH[kind]); });
  if (layout.ottomans) {
    const front = layout.main.length ? Math.max(...layout.main.map((k) => M(DEPTH[k]))) : 0;
    const w = M(WIDTH.ottoman), gap = 0.1, n = layout.ottomans;
    const span = n * w + (n - 1) * gap;
    const cx = mainW / 2;
    for (let i = 0; i < n; i++) out.push({ id: `ottoman:${i}`, kind: 'ottoman', where: 'ottoman', index: i, x: cx - span / 2 + i * (w + gap), z: front + OTTOMAN_GAP, rot: 0 });
  }
  if (!center || !out.length) return out;
  const b = bounds(out);
  const dx = -(b.minX + b.maxX) / 2;
  return out.map((p) => ({ ...p, x: p.x + dx }));
}

// Floor rectangle a placed module covers.
export function footprint(p) {
  const w = M(WIDTH[p.kind]), d = M(DEPTH[p.kind]);
  return p.rot ? { minX: p.x - d, maxX: p.x, minZ: p.z, maxZ: p.z + w } : { minX: p.x, maxX: p.x + w, minZ: p.z, maxZ: p.z + d };
}

export function bounds(ps) {
  if (!ps.length) return { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
  return ps.map(footprint).reduce((a, f) => ({ minX: Math.min(a.minX, f.minX), maxX: Math.max(a.maxX, f.maxX), minZ: Math.min(a.minZ, f.minZ), maxZ: Math.max(a.maxZ, f.maxZ) }));
}

// Where `module` could go next, shown in the current (centered) frame.
export function ghostSlots(layout, module, { center = true } = {}) {
  const now = placements(layout, { center: false });
  const offset = !center ? 0 : now.length ? placements(layout)[0].x - now[0].x : -M(WIDTH[module]) / 2;
  const slots = [];
  for (const slot of ['start', 'end', 'return', 'free']) {
    if (slot === 'start' && !layout.main.length) continue;
    const next = place(layout, module, slot);
    if (!next) continue;
    const after = placements(next, { center: false });
    const p = slot === 'start' ? after[0] : slot === 'end' ? after[next.main.length - 1]
      : slot === 'return' ? after.find((q) => q.where === 'ret' && q.index === next.ret.length - 1) : after.at(-1);
    const shift = slot === 'start' ? M(WIDTH[module]) : 0;
    slots.push({ slot, kind: module, x: p.x - shift + offset, z: p.z, rot: p.rot });
  }
  return slots;
}
