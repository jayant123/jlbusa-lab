import { describe, it, expect } from 'vitest';
import { partOffsets, PARTS } from '../../src/ostrel/explode.js';

describe('partOffsets', () => {
  it('is fully assembled at t=0', () => {
    for (const [k, v] of Object.entries(partOffsets(0))) expect(v.z, k).toBe(0);
  });
  it('separates crystal above dial above movement at t=1', () => {
    const o = partOffsets(1);
    expect(o.crystal.z).toBeGreaterThan(o.dial.z);
    expect(o.dial.z).toBeGreaterThan(o.movement_plate.z);
    expect(o.movement_plate.z).toBeGreaterThanOrEqual(0);
    expect(o.case.z).toBeLessThan(0);
  });
  it('lies strictly between the end states at t=0.5 for every moving part', () => {
    const a = partOffsets(0), m = partOffsets(0.5), b = partOffsets(1);
    for (const k of PARTS) {
      if (b[k].z === 0) continue;
      const lo = Math.min(a[k].z, b[k].z), hi = Math.max(a[k].z, b[k].z);
      expect(m[k].z, k).toBeGreaterThan(lo);
      expect(m[k].z, k).toBeLessThan(hi);
    }
  });
  it('clamps t outside 0..1', () => {
    expect(partOffsets(-1).crystal.z).toBe(0);
    expect(partOffsets(2).crystal.z).toBe(partOffsets(1).crystal.z);
  });
});
