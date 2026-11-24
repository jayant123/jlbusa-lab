// Procedural watchmaking finishes, generated in a worker so they cost no download and no main-thread time:
// a sunburst dial (anisotropy direction map), perlage on the main plate, Côtes de Genève stripes on the bridges and
// rotor, and leather grain on the straps.
import * as THREE from 'three';
import { heightToNormal, sunburstData, perlageData, cotesData, grainData } from './finish-data.js';

export { heightToNormal };

// Planar UVs on the watch face plane (x, z), centred and scaled so the larger extent spans 0..1.
export function planarUV(geo) {
  geo.computeBoundingBox();
  const b = geo.boundingBox, cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2;
  const span = Math.max(b.max.x - b.min.x, b.max.z - b.min.z) || 1;
  const p = geo.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = (p.getX(i) - cx) / span + 0.5;
    uv[i * 2 + 1] = (p.getZ(i) - cz) / span + 0.5;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

export function toTexture(data, size, { clamp = false } = {}) {
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.colorSpace = THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

export const SIZES = (tier) => ({ sun: tier === 'high' ? 1024 : 512, perl: 256, cotes: 256, grain: 256 });
const GEN = { sun: sunburstData, perl: perlageData, cotes: cotesData, grain: grainData };
export const sunburst = (n = 512) => toTexture(sunburstData(n), n, { clamp: true });
export const perlage = (n = 256) => toTexture(perlageData(n), n);
export const cotes = (n = 256) => toTexture(cotesData(n), n);
export const grain = (n = 256) => toTexture(grainData(n), n);

// Build all maps in a worker. Resolves to { sun, perl, cotes, grain } textures, or null if workers fail.
export function buildMaps(tier) {
  const sizes = SIZES(tier);
  const finish = (raw) => Object.fromEntries(Object.entries(raw).map(([k, d]) => [k, toTexture(d, sizes[k], { clamp: k === 'sun' })]));
  return new Promise((resolve) => {
    let w;
    try { w = new Worker(new URL('./finish-maps.worker.js', import.meta.url), { type: 'module' }); } catch { resolve(finish(Object.fromEntries(Object.entries(sizes).map(([k, n]) => [k, GEN[k](n)])))); return; }
    w.onmessage = (e) => { w.terminate(); resolve(finish(e.data)); };
    w.onerror = () => { w.terminate(); resolve(null); };
    w.postMessage(sizes);
  });
}
