// The five NUITHRA bottles, built in code like cut gemstones. Meters, base on y = 0, front facing +z.
// Each bottle has a clear faceted glass shell, the colored perfume inside it, a gold collar set with rows of
// crystals and a cut-stone stopper. Materials are passed in, so the same builder makes the bottle and its reflection.
import * as THREE from 'three';

// A faceted solid of revolution. rings: [y, r, twist] from bottom to top. twist 0.5 turns a ring by half a facet,
// which turns the band between it and its neighbor into triangular crown facets. sx and sz stretch the cut.
// rot turns the whole cut so a flat facet faces the front.
export function gemGeometry(rings, n, { sx = 1, sz = 1, rot = 0, top = true, bottom = true } = {}) {
  const pos = [];
  const pt = (ring, i) => {
    const [y, r, tw = 0] = ring, a = ((i + tw) / n) * Math.PI * 2 + rot;
    return [Math.sin(a) * r * sx, y, Math.cos(a) * r * sz];
  };
  const tri = (a, b, c, out) => {
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const nx = ab[1] * ac[2] - ab[2] * ac[1], ny = ab[2] * ac[0] - ab[0] * ac[2], nz = ab[0] * ac[1] - ab[1] * ac[0];
    const cx = (a[0] + b[0] + c[0]) / 3, cy = (a[1] + b[1] + c[1]) / 3, cz = (a[2] + b[2] + c[2]) / 3;
    const flip = out ? nx * out[0] + ny * out[1] + nz * out[2] < 0 : nx * cx + nz * cz < 0;
    pos.push(...a, ...(flip ? c : b), ...(flip ? b : c));
    return cy;
  };
  for (let k = 0; k < rings.length - 1; k++) {
    const A = rings[k], B = rings[k + 1];
    const same = Math.abs((A[2] || 0) - (B[2] || 0)) < 1e-6;
    for (let i = 0; i < n; i++) {
      const a0 = pt(A, i), a1 = pt(A, i + 1), b0 = pt(B, i), b1 = pt(B, i + 1);
      if (same) { tri(a0, b0, a1); tri(a1, b0, b1); continue; }
      const later = (B[2] || 0) > (A[2] || 0);
      if (later) { tri(a0, b0, a1); tri(a1, b0, b1); } else { tri(a0, b1, a1); tri(a0, b0, b1); }
    }
  }
  const cap = (ring, up) => {
    const c = [0, ring[0], 0];
    for (let i = 0; i < n; i++) tri(c, pt(ring, i), pt(ring, i + 1), [0, up ? 1 : -1, 0]);
  };
  if (bottom) cap(rings[0], false);
  if (top) cap(rings[rings.length - 1], true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals(); // non-indexed, so every facet is flat
  return g;
}

// Radius of a profile at height y (for the perfume inside).
function radiusAt(rings, y) {
  for (let k = 0; k < rings.length - 1; k++) {
    const [y0, r0] = rings[k], [y1, r1] = rings[k + 1];
    if (y >= y0 && y <= y1) return r0 + (r1 - r0) * ((y - y0) / Math.max(1e-6, y1 - y0));
  }
  return rings[rings.length - 1][1];
}
// The perfume: the inside of the shell, a wall thickness in from the glass, from the top of the solid base to the fill line.
function liquidGeometry(rings, n, opts, { base, fill, wall }) {
  const ys = [base, ...rings.map((r) => r[0]).filter((y) => y > base && y < fill), fill];
  const inner = ys.map((y) => {
    const tw = rings.reduce((t, r) => (r[0] <= y ? r[2] || 0 : t), 0);
    return [y, Math.max(0.002, radiusAt(rings, y) - wall), tw];
  });
  return gemGeometry(inner, n, opts);
}

// Each cut: shell rings, facet count, options, where the perfume sits, the neck top, and the stopper and collar.
const CUTS = {
  // Amber Hour: the crown. An eight-sided body that widens to a shoulder of kite facets.
  crown: {
    n: 8, rings: [[0, 0.021], [0.004, 0.025], [0.046, 0.031], [0.058, 0.031, 0.5], [0.07, 0.019], [0.077, 0.0105, 0.5], [0.082, 0.0095, 0.5]],
    liquid: { base: 0.007, fill: 0.06, wall: 0.0035 }, top: 0.082,
    stone: { n: 8, rings: [[0, 0.006], [0.01, 0.016], [0.013, 0.016, 0.5], [0.022, 0.0085], [0.024, 0.0075, 0.5]] }, collar: { r: 0.0105, rows: 3 },
  },
  // Fig Night: a faceted orb, flattened front to back, cut like a round brilliant.
  orb: {
    n: 12, opts: { sz: 0.62 }, rings: [[0, 0.016], [0.004, 0.026], [0.016, 0.036, 0.5], [0.034, 0.041], [0.052, 0.038, 0.5], [0.066, 0.029], [0.075, 0.016, 0.5], [0.079, 0.008, 0.5]],
    liquid: { base: 0.005, fill: 0.058, wall: 0.004 }, top: 0.079,
    stone: { n: 10, rings: [[0, 0.004], [0.004, 0.011], [0.009, 0.0145, 0.5], [0.016, 0.0145], [0.022, 0.011, 0.5], [0.026, 0.005]] }, collar: { r: 0.0088, rows: 1 },
  },
  // Smoke Garden: a six-sided tower with a stepped shoulder.
  tower: {
    n: 6, opts: { rot: Math.PI / 6 }, rings: [[0, 0.019], [0.004, 0.0225], [0.078, 0.0225], [0.084, 0.019, 0.5], [0.09, 0.0125], [0.095, 0.0085, 0.5]],
    liquid: { base: 0.008, fill: 0.074, wall: 0.0035 }, top: 0.095,
    stone: { n: 6, opts: { rot: Math.PI / 6 }, rings: [[0, 0.013], [0.022, 0.0155], [0.026, 0.0115, 0.5], [0.028, 0.006, 0.5]] }, collar: { r: 0.0095, rows: 1 },
  },
  // Salt Iris: a tall six-sided spire that narrows to a long crown.
  spire: {
    n: 6, rings: [[0, 0.019], [0.004, 0.022], [0.064, 0.018], [0.084, 0.012, 0.5], [0.098, 0.0075], [0.102, 0.007]],
    liquid: { base: 0.007, fill: 0.07, wall: 0.003 }, top: 0.102,
    stone: { n: 6, rings: [[0, 0.004], [0.006, 0.0105], [0.011, 0.011, 0.5], [0.048, 0.0006, 0.5]] }, collar: { r: 0.0085, rows: 2 },
  },
  // Vetiver Rain: a wide emerald cut with stepped tiers at the base and the shoulder.
  emerald: {
    n: 8, opts: { sx: 1.45, sz: 0.85, rot: Math.PI / 8 }, rings: [[0, 0.019], [0.003, 0.0235], [0.007, 0.026], [0.048, 0.026], [0.054, 0.023], [0.059, 0.018], [0.063, 0.0125], [0.066, 0.0095]],
    liquid: { base: 0.006, fill: 0.05, wall: 0.0035 }, top: 0.066,
    stone: { n: 8, opts: { sx: 1.35, sz: 0.85, rot: Math.PI / 8 }, rings: [[0, 0.009], [0.005, 0.0145], [0.012, 0.0145], [0.016, 0.011], [0.018, 0.008]] }, collar: { r: 0.0105, rows: 1 },
  },
};
export const CUT_NAMES = Object.keys(CUTS);

const cache = new Map();
function parts(cut) {
  if (cache.has(cut)) return cache.get(cut);
  const C = CUTS[cut];
  const shell = gemGeometry(C.rings, C.n, C.opts);
  const liquid = liquidGeometry(C.rings, C.n, C.opts, C.liquid);
  const stone = gemGeometry(C.stone.rings, C.stone.n, C.stone.opts);
  // Collar: a gold band with rows of crystals around it, and a thin gold lip under the stone.
  const rows = C.collar.rows, band = 0.0011 + rows * 0.0022;
  const collar = new THREE.CylinderGeometry(C.collar.r, C.collar.r, band, 40, 1);
  collar.translate(0, band / 2, 0);
  const lip = new THREE.CylinderGeometry(C.collar.r * 1.12, C.collar.r * 1.12, 0.0012, 40, 1);
  lip.translate(0, band + 0.0006, 0);
  const gem = new THREE.OctahedronGeometry(0.00095, 0);
  gem.scale(1, 0.7, 1);
  const per = Math.round((2 * Math.PI * C.collar.r) / 0.0021);
  const set = [];
  for (let k = 0; k < rows; k++) for (let i = 0; i < per; i++) {
    const a = ((i + (k % 2) * 0.5) / per) * Math.PI * 2;
    set.push(new THREE.Matrix4().compose(new THREE.Vector3(Math.sin(a) * (C.collar.r + 0.0002), 0.0012 + k * 0.0022, Math.cos(a) * (C.collar.r + 0.0002)),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, a, 0, 'YXZ')), new THREE.Vector3(1, 1, 1)));
  }
  const p = { shell, liquid, stone, collar, lip, gem, set, band, C };
  cache.set(cut, p);
  return p;
}

// Build one bottle. mats: { shell, liquid, stone, metal, crystal }. Returns { group, glass, info }.
export function buildBottle(cut, mats) {
  const p = parts(cut), C = p.C;
  const group = new THREE.Group();
  const glass = new THREE.Mesh(p.shell, mats.shell);
  glass.name = 'glass';
  glass.renderOrder = 4;
  const liquid = new THREE.Mesh(p.liquid, mats.liquid);
  liquid.renderOrder = 2;
  const collar = new THREE.Mesh(p.collar, mats.metal);
  const lip = new THREE.Mesh(p.lip, mats.metal);
  const gems = new THREE.InstancedMesh(p.gem, mats.crystal, p.set.length);
  p.set.forEach((m, i) => gems.setMatrixAt(i, m));
  const neck = new THREE.Group();
  neck.position.y = C.top - 0.002;
  neck.add(collar, lip, gems);
  const stone = new THREE.Mesh(p.stone, mats.stone);
  stone.position.y = C.top - 0.002 + p.band + 0.0012;
  stone.renderOrder = 3;
  group.add(liquid, glass, neck, stone);
  const box = new THREE.Box3().setFromObject(group);
  const info = { top: C.top, height: box.max.y, width: box.max.x - box.min.x, depth: box.max.z - box.min.z, w: box.max.x - box.min.x, d: box.max.z - box.min.z };
  return { group, glass, liquid, stone, info };
}
