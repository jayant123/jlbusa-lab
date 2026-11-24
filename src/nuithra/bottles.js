// The five NUITHRA bottles, built in code. Meters, base on y = 0, front facing +z. Each bottle is one 'glass'
// mesh plus its cap parts. The materials are passed in, so the same builder makes the bottle and its reflection.
import * as THREE from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

const crease = (g, a = 0.75) => toCreasedNormals(g, a);

// Extrude a 2D outline (x, z) upward into a solid with rounded top and bottom edges.
function riser(shape, h, bevel, curve = 24, segs = 10) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: h - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: segs, curveSegments: curve });
  g.rotateX(-Math.PI / 2);
  g.translate(0, bevel, 0);
  return crease(g);
}
function roundedRect(w, d, r) {
  const s = new THREE.Shape(), x = w / 2 - r, z = d / 2 - r;
  s.moveTo(-x, -d / 2); s.lineTo(x, -d / 2); s.absarc(x, -z, r, -Math.PI / 2, 0); s.lineTo(w / 2, z);
  s.absarc(x, z, r, 0, Math.PI / 2); s.lineTo(-x, d / 2); s.absarc(-x, z, r, Math.PI / 2, Math.PI); s.lineTo(-w / 2, -z);
  s.absarc(-x, -z, r, Math.PI, Math.PI * 1.5);
  return s;
}
function polygon(n, r, rot = 0) {
  const s = new THREE.Shape();
  for (let i = 0; i < n; i++) { const a = rot + (i / n) * Math.PI * 2; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  s.closePath();
  return s;
}
const lathe = (pts, seg = 64) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);

// Each shape: glass geometry, the height of its neck top, and its footprint (for the light pool and the shadow).
const GLASS = {
  slab() {
    return { geo: riser(roundedRect(0.054, 0.032, 0.009), 0.086, 0.006), top: 0.086, w: 0.054, d: 0.032 };
  },
  moon() {
    // A thick upright disc with a fully rounded rim, lathed so the curve has no seams. It stands on a short foot.
    const R = 0.041, T = 0.0135, r = 0.0105, pts = [[0, T]];
    for (let i = 0; i <= 16; i++) { const a = Math.PI / 2 - (i / 16) * Math.PI; pts.push([R - r + Math.cos(a) * r, Math.sin(a) * T]); }
    pts.push([0, -T]);
    const g = lathe(pts, 96);
    g.rotateX(Math.PI / 2);
    g.translate(0, 0.047 + 0.0035, 0);
    const foot = riser(roundedRect(0.036, 0.024, 0.007), 0.006, 0.0022);
    return { geo: mergeTwo(g, foot), top: 0.0905, w: 0.094, d: 0.027 };
  },
  column() {
    const r = 0.025, h = 0.1;
    const pts = [[0, 0], [r - 0.004, 0], [r, 0.004], [r, h - 0.01], [r - 0.003, h - 0.003], [r - 0.012, h], [0.008, h], [0.008, h + 0.006], [0, h + 0.006]];
    return { geo: crease(lathe(pts, 72), 0.5), top: h + 0.006, w: r * 2, d: r * 2 };
  },
  obelisk() {
    const h = 0.108;
    const g = new THREE.CylinderGeometry(0.0125, 0.0215, h, 6, 1);
    g.translate(0, h / 2, 0);
    return { geo: crease(g.toNonIndexed(), 0.3), top: h, w: 0.043, d: 0.037 };
  },
  octagon() {
    return { geo: riser(polygon(8, 0.039, Math.PI / 8), 0.066, 0.004, 8), top: 0.066, w: 0.078, d: 0.078 };
  },
};

function mergeTwo(a, b) {
  const A = a.index ? a.toNonIndexed() : a, B = b.index ? b.toNonIndexed() : b;
  const g = new THREE.BufferGeometry();
  for (const k of ['position', 'normal']) {
    const x = A.attributes[k].array, y = B.attributes[k].array, out = new Float32Array(x.length + y.length);
    out.set(x); out.set(y, x.length);
    g.setAttribute(k, new THREE.BufferAttribute(out, 3));
  }
  return g;
}

// Caps sit on the neck. Each returns meshes positioned above y = top.
const CAPS = {
  fluted(top, m) {
    const pts = [];
    const n = 32 * 6;
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, r = 0.0155 - 0.00045 * (0.5 - 0.5 * Math.cos(2 * Math.PI * (i % 6) / 6)); pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r)); }
    const cap = new THREE.Mesh(riser(new THREE.Shape(pts), 0.034, 0.0015, 1, 3), m.metal);
    cap.position.y = top + 0.006;
    const collar = new THREE.Mesh(lathe([[0, 0], [0.0098, 0], [0.0102, 0.003], [0.0098, 0.006], [0, 0.006]], 48), m.metal);
    collar.position.y = top;
    return [collar, cap];
  },
  sphere(top, m) {
    const collar = new THREE.Mesh(lathe([[0, 0], [0.008, 0], [0.0085, 0.003], [0.008, 0.005], [0, 0.005]], 48), m.metal);
    collar.position.y = top;
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.0145, 48, 32), m.stone);
    s.position.y = top + 0.005 + 0.0135;
    return [collar, s];
  },
  cube(top, m) {
    const g = new THREE.BoxGeometry(0.03, 0.03, 0.03, 1, 1, 1);
    const c = new THREE.Mesh(riser(roundedRect(0.03, 0.03, 0.002), 0.03, 0.0012, 4, 3), m.matte);
    c.position.y = top;
    c.rotation.y = Math.PI / 4;
    g.dispose();
    return [c];
  },
  spire(top, m) {
    const g = new THREE.CylinderGeometry(0.0006, 0.0082, 0.05, 6, 1);
    g.translate(0, 0.025, 0);
    const s = new THREE.Mesh(crease(g.toNonIndexed(), 0.3), m.silver);
    s.position.y = top;
    return [s];
  },
  disc(top, m) {
    const collar = new THREE.Mesh(lathe([[0, 0], [0.011, 0], [0.011, 0.004], [0, 0.004]], 48), m.metal);
    collar.position.y = top;
    const d = new THREE.Mesh(lathe([[0, 0], [0.024, 0], [0.0255, 0.002], [0.0255, 0.010], [0.024, 0.012], [0, 0.012]], 64), m.wood);
    d.position.y = top + 0.004;
    return [collar, d];
  },
};

const geoCache = new Map(), capCache = new Map();
export function glassShape(shape) {
  if (!geoCache.has(shape)) geoCache.set(shape, GLASS[shape]());
  return geoCache.get(shape);
}

// Build one bottle. mats: { glass, metal, stone, matte, silver, wood }. Returns { group, glass, info }.
export function buildBottle(shape, cap, mats) {
  const info = glassShape(shape);
  const group = new THREE.Group();
  const glass = new THREE.Mesh(info.geo, mats.glass);
  glass.name = 'glass';
  const key = `${cap}@${info.top}`;
  if (!capCache.has(key)) capCache.set(key, CAPS[cap](info.top, mats).map((m) => ({ geo: m.geometry, mat: Object.keys(mats).find((k) => mats[k] === m.material), pos: m.position.clone(), rot: m.rotation.clone() })));
  group.add(glass, ...capCache.get(key).map((c) => { const m = new THREE.Mesh(c.geo, mats[c.mat]); m.position.copy(c.pos); m.rotation.copy(c.rot); return m; }));
  const box = new THREE.Box3().setFromObject(group);
  return { group, glass, info: { ...info, height: box.max.y, width: box.max.x - box.min.x, depth: box.max.z - box.min.z } };
}
