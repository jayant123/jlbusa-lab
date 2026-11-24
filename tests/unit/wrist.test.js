import { describe, it, expect } from 'vitest';
import { wristFit, LUG_TO_LUG, CASE_MM } from '../../src/ostrel/wrist.js';

describe('OSTREL wrist check', () => {
  it('knows the watch size', () => {
    expect(CASE_MM).toBe(40);
    expect(LUG_TO_LUG).toBe(47);
  });
  it('estimates the flat top of the wrist from its circumference', () => {
    expect(wristFit(16, 'cm').top).toBeCloseTo(51.2, 1);
    expect(wristFit(6.5, 'in').top).toBeCloseTo(165.1 * 0.32, 1);
  });
  it('says the watch fits a typical wrist', () => {
    const r = wristFit(17, 'cm');
    expect(r.fit).toBe('good');
    expect(r.message).toMatch(/fits/i);
  });
  it('warns when the lugs reach past a small wrist', () => {
    const r = wristFit(13.5, 'cm');
    expect(r.fit).toBe('large');
    expect(r.overhang).toBeGreaterThan(0);
  });
  it('says the watch will look small on a large wrist', () => {
    expect(wristFit(21, 'cm').fit).toBe('small');
  });
  it('rejects sizes outside a human range or bad input', () => {
    expect(wristFit(5, 'cm')).toBeNull();
    expect(wristFit(40, 'cm')).toBeNull();
    expect(wristFit(NaN, 'cm')).toBeNull();
    expect(wristFit(16, 'ft')).toBeNull();
  });
  it('writes messages without commas', () => {
    for (const c of [13, 15, 17, 19, 22]) expect(wristFit(c, 'cm').message).not.toMatch(/,/);
  });
});
