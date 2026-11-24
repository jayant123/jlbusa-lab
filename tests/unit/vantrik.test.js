import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PARTS, PALETTE, MODELS, SIZES, customAttrs, sizeFor, colorwayOf } from '../../src/vantrik/parts.js';

const seed = JSON.parse(readFileSync(resolve(process.cwd(), 'seed/vantrik.json'), 'utf8'));

describe('VANTRIK parts and colors', () => {
  it('has five customizable parts', () => {
    expect(PARTS.map((p) => p.id)).toEqual(['upper', 'midsole', 'outsole', 'laces', 'trim']);
  });
  it('defines every seed colorway for the two stock models with a palette color per part', () => {
    for (const [handle, m] of Object.entries(MODELS)) {
      const p = seed.products.find((x) => x.handle === handle);
      expect(p).toBeTruthy();
      expect(Object.keys(m.colorways).sort()).toEqual([...p.options.find((o) => o.name === 'Colorway').values].sort());
      for (const cw of Object.values(m.colorways)) for (const part of PARTS) expect(PALETTE[cw[part.id]]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
  it('sizes match the seed', () => {
    for (const p of seed.products) expect(p.options.find((o) => o.name === 'Size').values).toEqual(SIZES.map((s) => s.us));
  });
  it('falls back to the first colorway', () => {
    expect(colorwayOf('vantrik-vk1-runner', 'nope')).toEqual(MODELS['vantrik-vk1-runner'].colorways.Bone);
  });
});

describe('custom pair attributes', () => {
  const ok = { upper: 'Ember', midsole: 'Bone', outsole: 'Night', laces: 'Bone', trim: 'Night' };
  it('maps each part to a named line attribute in a fixed order', () => {
    expect(customAttrs(ok)).toEqual({ Upper: 'Ember', Midsole: 'Bone', Outsole: 'Night', Laces: 'Bone', 'Trim': 'Night' });
    expect(Object.keys(customAttrs({ trim: 'Night', laces: 'Bone', outsole: 'Night', midsole: 'Bone', upper: 'Ember' }))).toEqual(['Upper', 'Midsole', 'Outsole', 'Laces', 'Trim']);
  });
  it('refuses a missing part or a color not in the palette', () => {
    expect(customAttrs({ ...ok, laces: undefined })).toBeNull();
    expect(customAttrs({ ...ok, upper: 'Hot pink' })).toBeNull();
    expect(customAttrs(null)).toBeNull();
  });
});

describe('size guide', () => {
  it('picks the smallest size that fits the foot', () => {
    expect(sizeFor(26.7)).toBe('US 9');
    expect(sizeFor(26.0)).toBe('US 9');
    expect(sizeFor(25.0)).toBe('US 7');
    expect(sizeFor(24.1)).toBe('US 7');
  });
  it('says when the foot is outside the range', () => {
    expect(sizeFor(30.5)).toBeNull();
    expect(sizeFor(20)).toBeNull();
    expect(sizeFor(NaN)).toBeNull();
  });
});
