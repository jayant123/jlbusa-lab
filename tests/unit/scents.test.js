import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SCENTS, TIERS, FAMILIES, SIZES, sizeScale, scentOf, botanicalCount } from '../../src/nuithra/scents.js';

const seed = JSON.parse(readFileSync(resolve(process.cwd(), 'seed/nuithra.json'), 'utf8'));

describe('NUITHRA scents', () => {
  it('describes every fragrance in the store, and only those', () => {
    const handles = seed.products.filter((p) => p.type === 'Eau de parfum').map((p) => p.handle);
    expect(Object.keys(SCENTS).sort()).toEqual(handles.sort());
  });
  it('gives each fragrance notes, botanicals and a full profile for top, heart and base', () => {
    expect(TIERS).toEqual(['top', 'heart', 'base']);
    for (const s of Object.values(SCENTS)) {
      for (const t of TIERS) {
        expect(s.notes[t].length).toBeGreaterThan(0);
        expect(s.botanicals[t].length).toBeGreaterThan(0);
      }
      expect(Object.keys(s.profile).sort()).toEqual([...FAMILIES].sort());
      Object.values(s.profile).forEach((v) => expect(v).toBeGreaterThanOrEqual(0) && expect(v).toBeLessThanOrEqual(5));
      expect(s.liquid).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
  it('matches the notes written in the store descriptions', () => {
    for (const p of seed.products.filter((q) => SCENTS[q.handle])) {
      for (const t of TIERS) for (const n of SCENTS[p.handle].notes[t]) expect(p.body.toLowerCase()).toContain(n.toLowerCase());
    }
  });
  it('scales the bottle by size', () => {
    expect(SIZES).toEqual(['30 ml', '50 ml', '100 ml']);
    expect(sizeScale('50 ml')).toBe(1);
    expect(sizeScale('30 ml')).toBeLessThan(1);
    expect(sizeScale('100 ml')).toBeGreaterThan(1);
    expect(sizeScale('nonsense')).toBe(1);
  });
  it('falls back to the first fragrance for unknown handles', () => {
    expect(scentOf('nope')).toBe(SCENTS['nuithra-amber-hour']);
  });
  it('uses fewer botanicals on lighter devices', () => {
    const s = SCENTS['nuithra-amber-hour'].botanicals.top[0];
    expect(botanicalCount(s, 'high')).toBe(s.n);
    expect(botanicalCount(s, 'low')).toBeLessThan(s.n);
    expect(botanicalCount(s, 'low')).toBeGreaterThan(0);
  });
});
