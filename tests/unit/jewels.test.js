import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { METALS, STONES, PIECES, RING_SIZES, cleanEngraving, ringAttrs, sizeToMm, MAX_ENGRAVING } from '../../src/seravel/jewels.js';

const seed = JSON.parse(readFileSync(resolve(process.cwd(), 'seed/seravel.json'), 'utf8'));
const opt = (h, name) => seed.products.find((p) => p.handle === h).options.find((o) => o.name === name).values;

describe('SERAVEL catalog', () => {
  it('describes every piece in the store, and only those', () => {
    expect(Object.keys(PIECES).sort()).toEqual(seed.products.map((p) => p.handle).sort());
  });
  it('has a look for every metal and stone the store sells', () => {
    expect(Object.keys(METALS).sort()).toEqual([...opt('seravel-solace-ring', 'Metal')].sort());
    expect(Object.keys(STONES).sort()).toEqual([...opt('seravel-solace-ring', 'Stone')].sort());
    for (const m of Object.values(METALS)) expect(m.color).toMatch(/^#[0-9a-f]{6}$/i);
    for (const s of Object.values(STONES)) { expect(s.color).toMatch(/^#[0-9a-f]{6}$/i); expect(s.ior).toBeGreaterThan(1.5); }
  });
});

describe('engraving', () => {
  it('keeps letters, digits, spaces and & . \' - and makes them upper case', () => {
    expect(cleanEngraving("a&b. o'k-1")).toBe("A&B. O'K-1");
  });
  it('drops anything else and squeezes spaces', () => {
    expect(cleanEngraving('  hi   <there>! ')).toBe('HI THERE');
    expect(cleanEngraving('émile')).toBe('MILE');
  });
  it('stops at 18 characters', () => {
    expect(MAX_ENGRAVING).toBe(18);
    expect(cleanEngraving('ABCDEFGHIJKLMNOPQRSTUV')).toHaveLength(18);
  });
  it('handles empty and odd input', () => {
    expect(cleanEngraving('')).toBe('');
    expect(cleanEngraving(null)).toBe('');
    expect(cleanEngraving('!!!')).toBe('');
  });
});

describe('ring size', () => {
  it('offers US 4 to 10 in half sizes', () => {
    expect(RING_SIZES[0]).toBe('4');
    expect(RING_SIZES.at(-1)).toBe('10');
    expect(RING_SIZES).toContain('6.5');
    expect(RING_SIZES).toHaveLength(13);
  });
  it('converts a US size to the inside diameter in mm', () => {
    expect(sizeToMm('7')).toBeCloseTo(17.3, 1);
    expect(sizeToMm('4')).toBeCloseTo(14.9, 1);
    expect(sizeToMm('10')).toBeCloseTo(19.8, 1);
    expect(sizeToMm('x')).toBeNull();
  });
  it('sends the size and any engraving as cart line attributes', () => {
    expect(ringAttrs({ size: '6.5', engraving: 'always' })).toEqual({ 'Ring size': 'US 6.5', Engraving: 'ALWAYS' });
    expect(ringAttrs({ size: '7', engraving: '   ' })).toEqual({ 'Ring size': 'US 7' });
    expect(ringAttrs({ size: '99', engraving: '' })).toBeNull();
  });
});
