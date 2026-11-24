// Pure pixel generators for the OSTREL finishes. No three.js here, so a worker can run them off the main thread.
export function heightToNormal(h, size, strength) {
  const out = new Uint8Array(size * size * 4);
  const at = (x, y) => h[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * strength, dy = (at(x, y + 1) - at(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1);
    const i = (y * size + x) * 4;
    out[i] = Math.round((-dx / l) * 127.5 + 127.5);
    out[i + 1] = Math.round((-dy / l) * 127.5 + 127.5);
    out[i + 2] = Math.round((1 / l) * 127.5 + 127.5);
    out[i + 3] = 255;
  }
  return out;
}

// Sunburst: the anisotropy direction points along the radius from the dial centre.
export function sunburstData(size = 512) {
  const d = new Uint8Array(size * size * 4), c = (size - 1) / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = x - c, dy = y - c, l = Math.hypot(dx, dy) || 1, i = (y * size + x) * 4;
    d[i] = Math.round((dx / l) * 127.5 + 127.5);
    d[i + 1] = Math.round((dy / l) * 127.5 + 127.5);
    d[i + 2] = 255;
    d[i + 3] = 255;
  }
  return d;
}

// Perlage: rows of overlapping spiral circles. Each pixel shows the last circle drawn over it.
export function perlageData(size = 256, cells = 6) {
  const h = new Float32Array(size * size), s = size / cells, r = s * 0.78;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let best = null;
    const gy = Math.floor(y / s), gx = Math.floor(x / s);
    for (let j = gy - 1; j <= gy + 1; j++) for (let i = gx - 1; i <= gx + 1; i++) {
      const cx = (i + 0.5) * s, cy = (j + 0.5) * s, dd = Math.hypot(x - cx, y - cy);
      if (dd < r) { const order = j * 1000 + i; if (!best || order > best.order) best = { order, dd, a: Math.atan2(y - cy, x - cx) }; }
    }
    h[y * size + x] = best ? 0.5 + 0.5 * Math.cos(best.dd * 1.4 + best.a * 0.6) * (1 - best.dd / r) : 0;
  }
  return heightToNormal(h, size, 1.6);
}

// Côtes de Genève: broad parallel ridges with soft valleys.
export function cotesData(size = 256, stripes = 5) {
  const h = new Float32Array(size * size), p = size / stripes;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const f = ((x + y * 0.08) % p) / p;
    const k = 2 * f - 1;
    h[y * size + x] = (1 - k * k) * 6 + Math.sin(y * 0.9 + x * 0.3) * 0.04;
  }
  return heightToNormal(h, size, 1.2);
}

// Leather grain: pebbled cells from jittered points (distance to the nearest point).
export function grainData(size = 256, cells = 24, seed = 7) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const pts = [];
  for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) pts.push([(i + rnd()) * size / cells, (j + rnd()) * size / cells]);
  const h = new Float32Array(size * size), c = size / cells;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let m = Infinity;
    const gx = Math.floor(x / c), gy = Math.floor(y / c);
    for (let j = gy - 1; j <= gy + 1; j++) for (let i = gx - 1; i <= gx + 1; i++) {
      const jj = (j + cells) % cells, ii = (i + cells) % cells;
      const [px, py] = pts[jj * cells + ii];
      const ox = px + (i < 0 ? -size : i >= cells ? size : 0), oy = py + (j < 0 ? -size : j >= cells ? size : 0);
      m = Math.min(m, Math.hypot(x - ox, y - oy));
    }
    h[y * size + x] = Math.min(1, m / (c * 0.7));
  }
  return heightToNormal(h, size, 2.2);
}
