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
