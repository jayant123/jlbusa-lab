import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildBottle, gemGeometry } from '../../src/nuithra/bottles.js';
import { SCENTS, ORDER } from '../../src/nuithra/scents.js';

const m = new THREE.MeshBasicMaterial();
const mats = { shell: m, liquid: m, stone: m, metal: m, crystal: m };

describe('NUITHRA bottles', () => {
  it('builds every bottle standing on the shelf at a plausible size', () => {
    for (const h of ORDER) {
      const { group, glass, liquid, info } = buildBottle(SCENTS[h].shape, mats);
      const box = new THREE.Box3().setFromObject(group);
      expect(Math.abs(box.min.y)).toBeLessThan(0.0015);
      expect(info.height).toBeGreaterThan(0.08);
      expect(info.height).toBeLessThan(0.17);
      expect(info.width).toBeLessThan(0.1);
      expect(glass.geometry.attributes.position.count).toBeGreaterThan(60);
      // The perfume sits inside the glass.
      const lb = new THREE.Box3().setFromObject(liquid), gb = new THREE.Box3().setFromObject(glass);
      expect(gb.containsBox(lb)).toBe(true);
    }
  });
  it('gives the five bottles five different heights and footprints', () => {
    const dims = ORDER.map((h) => buildBottle(SCENTS[h].shape, mats).info);
    expect(new Set(dims.map((d) => d.height.toFixed(3))).size).toBe(5);
    expect(new Set(dims.map((d) => `${d.w.toFixed(3)}x${d.d.toFixed(3)}`)).size).toBe(5);
  });
  it('cuts facets that face outward', () => {
    const g = gemGeometry([[0, 0.02], [0.02, 0.03, 0.5], [0.04, 0.02]], 8);
    const p = g.attributes.position, n = g.attributes.normal;
    let outward = 0, sides = 0;
    for (let i = 0; i < p.count; i += 3) {
      const cx = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, cz = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
      if (Math.abs(n.getY(i)) > 0.9) continue;
      sides++;
      if (n.getX(i) * cx + n.getZ(i) * cz > 0) outward++;
    }
    expect(outward).toBe(sides);
  });
});
