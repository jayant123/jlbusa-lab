// Glasswork for the NUITHRA bottles, drawn on canvases and turned into textures.
// Two layers per bottle. Frost marks acid-etched areas: rough, paler glass that blurs what is behind it.
// Cuts mark engraved lines: grooves that catch the light. Together they give a color map (frost is paler),
// a roughness map (frost scatters) and a normal map (cuts and frost edges have depth).
// Drawing happens in meters on the bottle's surface. Planar bottles use the left half of the canvas for the
// front and the right half for the back. Round bottles wrap the canvas around them with the front at the center.
import * as THREE from 'three';

const SERIF = '"Libre Caslon Display", "Libre Caslon Text", Georgia, serif';
const SANS = '"Schibsted Grotesk", system-ui, sans-serif';

// Surface size in meters per shape: mode, width (or circumference) and height.
export const SURFACE = {
  slab: { mode: 'planar', w: 0.054, h: 0.086 },
  moon: { mode: 'planar', w: 0.082, h: 0.0905 },
  column: { mode: 'wrap', w: 2 * Math.PI * 0.025, h: 0.106 },
  obelisk: { mode: 'wrap', w: 2 * Math.PI * 0.017, h: 0.108 },
  octagon: { mode: 'wrap', w: 2 * Math.PI * 0.039, h: 0.066 },
};

// UVs that match the drawing: planar front and back halves, or a wrap with the front at u = 0.5.
export function surfaceUV(g, shape) {
  const S = SURFACE[shape], p = g.attributes.position, n = g.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (S.mode === 'planar') {
      const back = n.getZ(i) < -0.2;
      const u = Math.min(1, Math.max(0, x / S.w + 0.5));
      uv[i * 2] = back ? 0.5 + (1 - u) * 0.5 : u * 0.5;
    } else {
      uv[i * 2] = Math.atan2(x, z) / (Math.PI * 2) + 0.5;
    }
    uv[i * 2 + 1] = Math.min(1, Math.max(0, y / S.h));
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

// Text in meters: draw at 100 px and scale down, since browsers handle tiny font sizes poorly.
function text(x, str, cx, cy, size, font, spacing = 0) {
  const k = size / 100;
  x.save();
  x.translate(cx, cy);
  x.scale(k, k);
  x.font = `100px ${font}`;
  x.textBaseline = 'middle';
  const sp = spacing / k;
  const chars = [...str], widths = chars.map((c) => x.measureText(c).width);
  let pos = -(widths.reduce((a, b) => a + b, 0) + sp * (chars.length - 1)) / 2;
  x.textAlign = 'left';
  chars.forEach((c, i) => { x.fillText(c, pos, 0); pos += widths[i] + sp; });
  x.restore();
}

// Each design draws into the frost (F) and cut (C) contexts. Units are meters, y grows downward from the top.
// front: true for the front half (planar) or the whole wrap. back: the back half of planar bottles.
const DESIGNS = {
  // Amber Hour: an Art Deco sunburst rising from the base inside an engraved frame. The name is frosted.
  slab(F, C, { w, h, name, side }) {
    C.lineWidth = 0.0005;
    C.beginPath(); C.roundRect(0.0045, 0.006, w - 0.009, h - 0.012, 0.004); C.stroke();
    C.beginPath(); C.roundRect(0.0062, 0.0078, w - 0.0124, h - 0.0156, 0.003); C.stroke();
    C.save(); C.beginPath(); C.roundRect(0.0062, 0.0078, w - 0.0124, h - 0.0156, 0.003); C.clip();
    C.lineWidth = 0.00045;
    for (let i = 0; i <= 26; i++) { const a = Math.PI * (0.08 + 0.84 * (i / 26)); C.beginPath(); C.moveTo(w / 2, h - 0.006); C.lineTo(w / 2 - Math.cos(a) * 0.07, h - 0.006 - Math.sin(a) * 0.07); C.stroke(); }
    C.restore();
    F.fillRect(0.0045, h - 0.012, w - 0.009, 0.006);
    if (side === 'back') return;
    // A clear oval cartouche over the rays, with the name frosted inside it.
    for (const ctx of [C, F]) { ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.ellipse(w / 2, h * 0.4, 0.019, 0.011, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    C.lineWidth = 0.0005; C.beginPath(); C.ellipse(w / 2, h * 0.4, 0.019, 0.011, 0, 0, Math.PI * 2); C.stroke();
    text(F, 'NUITHRA', w / 2, h * 0.39, 0.0052, SERIF, 0.0009);
    text(F, name.toUpperCase(), w / 2, h * 0.4 + 0.0055, 0.0021, SANS, 0.0006);
  },
  // Fig Night: fine engraved rings like ripples. A frosted center disc carries the name in clear glass.
  moon(F, C, { w, h, name, side }) {
    const cx = w / 2, cy = h - 0.0505;
    C.lineWidth = 0.00035;
    for (let r = 0.015; r < 0.0365; r += 0.0019) { C.beginPath(); C.arc(cx, cy, r, 0, Math.PI * 2); C.stroke(); }
    F.lineWidth = 0.002; F.beginPath(); F.arc(cx, cy, 0.0385, 0, Math.PI * 2); F.stroke();
    if (side === 'back') return;
    F.beginPath(); F.arc(cx, cy, 0.0128, 0, Math.PI * 2); F.fill();
    F.save(); F.globalCompositeOperation = 'destination-out';
    text(F, 'NUITHRA', cx, cy - 0.001, 0.0042, SERIF, 0.0006);
    text(F, name.toUpperCase(), cx, cy + 0.0045, 0.0018, SANS, 0.0005);
    F.restore();
    C.lineWidth = 0.0004; C.beginPath(); C.arc(cx, cy, 0.0135, 0, Math.PI * 2); C.stroke();
  },
  // Smoke Garden: deep vertical flutes all around. A frosted band at the front holds the name in clear glass.
  column(F, C, { w, h, name }) {
    C.lineWidth = 0.0013;
    for (let x = 0.002; x < w; x += 0.0042) { C.beginPath(); C.moveTo(x, 0.022); C.lineTo(x, h - 0.012); C.stroke(); }
    F.fillRect(0, h - 0.008, w, 0.008);
    for (const ctx of [C]) { ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.fillRect(w / 2 - 0.022, h * 0.47, 0.044, 0.018); ctx.restore(); }
    F.fillRect(w / 2 - 0.022, h * 0.47, 0.044, 0.018);
    F.save(); F.globalCompositeOperation = 'destination-out';
    text(F, 'NUITHRA', w / 2, h * 0.47 + 0.0072, 0.0046, SERIF, 0.0008);
    text(F, name.toUpperCase(), w / 2, h * 0.47 + 0.0135, 0.002, SANS, 0.0006);
    F.restore();
  },
  // Salt Iris: acid-etched frost that fades up from the base, crossed by engraved wave lines.
  obelisk(F, C, { w, h, name }) {
    const g = F.createLinearGradient(0, h, 0, h * 0.42);
    g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    F.fillStyle = g; F.fillRect(0, h * 0.42, w, h * 0.58);
    C.lineWidth = 0.0004;
    for (let y = h * 0.35; y < h - 0.004; y += 0.0032) {
      C.beginPath();
      for (let x = 0; x <= w; x += 0.001) { const yy = y + Math.sin(x * 420 + y * 900) * 0.0011; x ? C.lineTo(x, yy) : C.moveTo(x, yy); }
      C.stroke();
    }
    F.fillStyle = '#fff';
    F.save(); F.globalCompositeOperation = 'destination-out'; F.fillRect(w / 2 - 0.012, h - 0.024, 0.024, 0.012); F.restore();
    C.save(); C.globalCompositeOperation = 'destination-out'; C.fillRect(w / 2 - 0.012, h - 0.024, 0.024, 0.012); C.restore();
    text(F, 'NUITHRA', w / 2, h - 0.0195, 0.0036, SERIF, 0.0006);
    text(F, name.toUpperCase(), w / 2, h - 0.014, 0.0015, SANS, 0.0004);
  },
  // Vetiver Rain: blades of grass engraved around the base. A frosted shoulder band. The name sits in a clear panel.
  octagon(F, C, { w, h, name }) {
    let s = 11;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    C.lineWidth = 0.0005;
    for (let i = 0; i < 150; i++) {
      const x0 = rnd() * w, top = h - 0.018 - rnd() * 0.03, lean = (rnd() - 0.5) * 0.014;
      C.beginPath(); C.moveTo(x0, h - 0.004); C.quadraticCurveTo(x0 + lean * 0.3, (h + top) / 2, x0 + lean, top); C.stroke();
    }
    F.fillRect(0, 0.003, w, 0.007);
    F.fillRect(0, h - 0.004, w, 0.004);
    const px = w / 2 - 0.016, py = h * 0.3, pw = 0.032, ph = 0.016;
    C.save(); C.globalCompositeOperation = 'destination-out'; C.fillRect(px, py, pw, ph); C.restore();
    C.lineWidth = 0.0004; C.strokeRect(px, py, pw, ph);
    text(F, 'NUITHRA', w / 2, py + 0.0065, 0.0046, SERIF, 0.0008);
    text(F, name.toUpperCase(), w / 2, py + 0.0122, 0.0019, SANS, 0.0006);
  },
};

// Build the three textures for one bottle. res is the canvas height in pixels.
export function etchMaps(shape, name, tint, res = 512) {
  const S = SURFACE[shape];
  const W = res * 2, H = res;
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const fc = mk(), cc = mk();
  const F = fc.getContext('2d'), C = cc.getContext('2d');
  for (const ctx of [F, C]) { ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff'; }
  const draw = (x0, xw, side) => {
    for (const ctx of [F, C]) { ctx.save(); ctx.beginPath(); ctx.rect(x0, 0, xw, H); ctx.clip(); ctx.setTransform(xw / S.w, 0, 0, H / S.h, x0, 0); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff'; }
    DESIGNS[shape](F, C, { w: S.w, h: S.h, name, side });
    for (const ctx of [F, C]) ctx.restore();
  };
  if (S.mode === 'planar') { draw(0, W / 2, 'front'); draw(W / 2, W / 2, 'back'); }
  else draw(0, W, 'front');

  const f = F.getImageData(0, 0, W, H).data, c = C.getImageData(0, 0, W, H).data;
  // Height: grooves go down, frost sits a little lower than clear glass. Blur the cuts a touch for round edges.
  const height = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) height[i] = -(c[i * 4 + 3] / 255) * 1.0 - (f[i * 4 + 3] / 255) * 0.18;
  const blur = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let sum = 0, n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H) { sum += height[yy * W + xx]; n++; } }
    blur[y * W + x] = sum / n;
  }
  const tintC = new THREE.Color(tint);
  const col = new ImageData(W, H), rough = new ImageData(W, H), nrm = new ImageData(W, H);
  const k = 2.2 * (res / 512);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, fr = f[i * 4 + 3] / 255, cu = c[i * 4 + 3] / 255;
    const frost = Math.max(fr, cu * 0.6);
    col.data[i * 4] = 255 * (tintC.r + (1 - tintC.r) * frost * 0.7);
    col.data[i * 4 + 1] = 255 * (tintC.g + (1 - tintC.g) * frost * 0.7);
    col.data[i * 4 + 2] = 255 * (tintC.b + (1 - tintC.b) * frost * 0.7);
    col.data[i * 4 + 3] = 255;
    const r = 255 * Math.min(1, 0.03 + fr * 0.5 + cu * 0.28);
    rough.data[i * 4] = rough.data[i * 4 + 1] = rough.data[i * 4 + 2] = r; rough.data[i * 4 + 3] = 255;
    const hl = blur[y * W + Math.max(0, x - 1)], hr = blur[y * W + Math.min(W - 1, x + 1)];
    const hu = blur[Math.max(0, y - 1) * W + x], hd = blur[Math.min(H - 1, y + 1) * W + x];
    let nx = (hl - hr) * k, ny = (hd - hu) * k, nz = 1;
    const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
    nrm.data[i * 4] = (nx * 0.5 + 0.5) * 255; nrm.data[i * 4 + 1] = (ny * 0.5 + 0.5) * 255; nrm.data[i * 4 + 2] = (nz * 0.5 + 0.5) * 255; nrm.data[i * 4 + 3] = 255;
  }
  const tex = (img, srgb) => {
    const cv = mk(); cv.getContext('2d').putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(cv);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  };
  return { map: tex(col, true), roughnessMap: tex(rough, false), normalMap: tex(nrm, false) };
}
