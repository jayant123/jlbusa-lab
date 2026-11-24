import { describe, it, expect } from 'vitest';
import { detectTier, nextPixelRatio } from '../../src/kit/tier.js';

describe('detectTier', () => {
  it('is low without WebGL2', () => expect(detectTier({ webgl2: false, dpr: 2, mobile: false })).toBe('low'));
  it('is low on a 2 GB phone', () => expect(detectTier({ webgl2: true, deviceMemory: 2, dpr: 3, mobile: true })).toBe('low'));
  it('is high on a strong desktop', () => expect(detectTier({ webgl2: true, deviceMemory: 8, hardwareConcurrency: 8, dpr: 2, mobile: false })).toBe('high'));
  it('is mid on a modern phone', () => expect(detectTier({ webgl2: true, deviceMemory: 6, hardwareConcurrency: 8, dpr: 3, mobile: true })).toBe('mid'));
  it('is mid when the browser hides memory (Safari)', () => expect(detectTier({ webgl2: true, dpr: 2, mobile: false })).toBe('mid'));
});

describe('nextPixelRatio', () => {
  it('steps down when frames are slow', () => expect(nextPixelRatio(1.5, 30, { max: 2 })).toBeCloseTo(1.4));
  it('never goes below the floor', () => expect(nextPixelRatio(0.75, 40, { max: 2 })).toBe(0.75));
  it('steps up when frames are fast, up to max', () => {
    expect(nextPixelRatio(1.5, 8, { max: 2 })).toBeCloseTo(1.55);
    expect(nextPixelRatio(2, 8, { max: 2 })).toBe(2);
  });
  it('holds steady in the comfortable band', () => expect(nextPixelRatio(1.5, 16, { max: 2 })).toBe(1.5));
});

import { createDprGovernor } from '../../src/kit/tier.js';
describe('createDprGovernor', () => {
  const run = (g, frames) => frames.map((ms) => g.window(ms));
  it('never goes above the device pixel ratio or the cap', () => {
    const g = createDprGovernor({ start: 1, min: 0.75, max: 2, device: 1 });
    run(g, Array(40).fill(8.3));
    expect(g.dpr).toBe(1);
  });
  it('drops only after two slow windows in a row', () => {
    const g = createDprGovernor({ start: 1.5, min: 0.75, max: 2, device: 2 });
    g.window(30);
    expect(g.dpr).toBe(1.5);
    g.window(30);
    expect(g.dpr).toBeLessThan(1.5);
  });
  it('settles when frame times alternate around the limit', () => {
    const g = createDprGovernor({ start: 1, min: 0.75, max: 2, device: 2 });
    const seen = run(g, Array.from({ length: 80 }, (_, i) => (i % 2 ? 26 : 8.3)));
    const changes = seen.filter((v, i) => i && v !== seen[i - 1]).length;
    expect(changes).toBeLessThanOrEqual(2);
    const tail = seen.slice(-40);
    expect(new Set(tail).size).toBe(1);
  });
  it('locks after it falls back from a rise, so it does not hunt', () => {
    const g = createDprGovernor({ start: 1, min: 0.75, max: 2, device: 2 });
    run(g, Array(10).fill(8.3)); // rises
    const high = g.dpr;
    expect(high).toBeGreaterThan(1);
    run(g, [30, 30]); // too much: falls back
    const settled = g.dpr;
    expect(settled).toBeLessThan(high);
    run(g, Array(40).fill(8.3));
    expect(g.dpr).toBe(settled);
  });
  it('still drops under sustained load even after locking', () => {
    const g = createDprGovernor({ start: 1.5, min: 0.75, max: 2, device: 2 });
    run(g, Array(10).fill(40));
    expect(g.dpr).toBe(0.75);
  });
  it('changes in coarse steps only', () => {
    const g = createDprGovernor({ start: 2, min: 0.75, max: 2, device: 2 });
    run(g, [30, 30]);
    expect([1.75, 1.5]).toContain(g.dpr);
  });
});
