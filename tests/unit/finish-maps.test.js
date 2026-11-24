import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { planarUV, heightToNormal, sunburst, perlage, cotes, grain } from '../../src/ostrel/finish-maps.js';

describe('OSTREL finish maps', () => {
  it('maps a disc in the XZ plane to the unit square, centred', () => {
    const g = new THREE.CircleGeometry(0.016, 32).rotateX(-Math.PI / 2).translate(0.002, 0.006, -0.001);
    planarUV(g);
    const uv = g.attributes.uv;
    let min = 1, max = 0;
    for (let i = 0; i < uv.count; i++) { min = Math.min(min, uv.getX(i), uv.getY(i)); max = Math.max(max, uv.getX(i), uv.getY(i)); }
    expect(min).toBeGreaterThanOrEqual(-1e-6);
    expect(max).toBeLessThanOrEqual(1 + 1e-6);
    expect(uv.getX(0)).toBeCloseTo(0.5, 5);
    expect(uv.getY(0)).toBeCloseTo(0.5, 5);
  });
  it('turns a flat height field into a flat normal map', () => {
    const n = heightToNormal(new Float32Array(16).fill(0.3), 4, 3);
    for (let i = 0; i < 16; i++) expect([n[i * 4], n[i * 4 + 1], n[i * 4 + 2]]).toEqual([128, 128, 255]);
  });
  it('points the sunburst along the radius', () => {
    const d = sunburst(64).image.data;
    const [r, g] = [d[(32 * 64 + 63) * 4], d[(32 * 64 + 63) * 4 + 1]];
    expect(r).toBeGreaterThan(240);
    expect(Math.abs(g - 128)).toBeLessThan(8);
  });
  it('builds tiling detail maps with real relief', () => {
    for (const tex of [perlage(64), cotes(64), grain(64)]) {
      const d = tex.image.data;
      let varied = 0;
      for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - 128) > 10 || Math.abs(d[i + 1] - 128) > 10) varied++;
      expect(varied).toBeGreaterThan(d.length / 4 * 0.1);
      expect(tex.wrapS).toBe(THREE.RepeatWrapping);
    }
  });
});
