import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildBottle } from '../../src/nuithra/bottles.js';
import { SCENTS, ORDER } from '../../src/nuithra/scents.js';

const m = new THREE.MeshBasicMaterial();
const mats = { glass: m, metal: m, stone: m, matte: m, silver: m, wood: m };

describe('NUITHRA bottles', () => {
  it('builds every bottle standing on the shelf at a plausible size', () => {
    for (const h of ORDER) {
      const { group, glass, info } = buildBottle(SCENTS[h].shape, SCENTS[h].cap, mats);
      const box = new THREE.Box3().setFromObject(group);
      expect(Math.abs(box.min.y)).toBeLessThan(0.0015);
      expect(info.height).toBeGreaterThan(0.08);
      expect(info.height).toBeLessThan(0.17);
      expect(info.width).toBeLessThan(0.1);
      expect(glass.geometry.attributes.position.count).toBeGreaterThan(30);
      expect(Number.isFinite(box.max.x)).toBe(true);
    }
  });
  it('gives the five bottles five different heights and footprints', () => {
    const dims = ORDER.map((h) => buildBottle(SCENTS[h].shape, SCENTS[h].cap, mats).info);
    expect(new Set(dims.map((d) => d.height.toFixed(3))).size).toBe(5);
    expect(new Set(dims.map((d) => `${d.w.toFixed(3)}x${d.d.toFixed(3)}`)).size).toBe(5);
  });
});
