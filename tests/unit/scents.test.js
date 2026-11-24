import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SCENTS, ORDER, TIERS, FAMILIES, SIZES, SHAPES, sizeScale, scentOf, discoveryAttrs } from '../../src/nuithra/scents.js';

const seed = JSON.parse(readFileSync(resolve(process.cwd(), 'seed/nuithra.json'), 'utf8'));

describe('NUITHRA scents', () => {
  it('describes every fragrance in the store, and only those', () => {
    const handles = seed.products.filter((p) => p.type === 'Eau de parfum').map((p) => p.handle);
    expect(Object.keys(SCENTS).sort()).toEqual(handles.sort());
    expect([...ORDER].sort()).toEqual(handles.sort());
    expect(ORDER).toHaveLength(5);
  });
  it('gives each fragrance its own glass color and its own bottle shape', () => {
    const glass = ORDER.map((h) => SCENTS[h].glass);
    const shapes = ORDER.map((h) => SCENTS[h].shape);
    glass.forEach((g) => expect(g).toMatch(/^#[0-9a-f]{6}$/i));
    expect(new Set(glass).size).toBe(5);
    expect(new Set(shapes).size).toBe(5);
    shapes.forEach((s) => expect(SHAPES).toContain(s));
  });
  it('gives each fragrance notes and a full profile for top, heart and base', () => {
    expect(TIERS).toEqual(['top', 'heart', 'base']);
    for (const s of Object.values(SCENTS)) {
      for (const t of TIERS) expect(s.notes[t].length).toBeGreaterThan(0);
      expect(Object.keys(s.profile).sort()).toEqual([...FAMILIES].sort());
      Object.values(s.profile).forEach((v) => { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(5); });
      expect(s.bottle.length).toBeGreaterThan(10);
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
    expect(scentOf('nope')).toBe(SCENTS[ORDER[0]]);
  });
  it('builds the discovery set attribute from exactly three different scents', () => {
    const [a, b, c, d] = ORDER;
    expect(discoveryAttrs([a, b, c])).toEqual({ Scents: `${SCENTS[a].name}, ${SCENTS[b].name}, ${SCENTS[c].name}` });
    expect(discoveryAttrs([c, a, b]).Scents.split(', ')).toEqual([SCENTS[a].name, SCENTS[b].name, SCENTS[c].name]);
    expect(discoveryAttrs([a, b])).toBeNull();
    expect(discoveryAttrs([a, b, c, d])).toBeNull();
    expect(discoveryAttrs([a, a, b])).toBeNull();
    expect(discoveryAttrs([a, b, 'nope'])).toBeNull();
  });
});

import { suggest, QUIZ } from '../../src/nuithra/scents.js';
describe('scent finder', () => {
  it('asks three questions with answers that all point somewhere', () => {
    expect(QUIZ).toHaveLength(3);
    for (const q of QUIZ) for (const a of q.answers) expect(Object.keys(a.score).every((h) => SCENTS[h])).toBe(true);
  });
  it('suggests a warm evening scent for warm, evening and strong', () => {
    expect(suggest({ when: 'evening', like: 'warm', strength: 'strong' })).toBe('nuithra-amber-hour');
  });
  it('suggests Salt Iris for fresh, daytime and soft', () => {
    expect(suggest({ when: 'day', like: 'fresh', strength: 'soft' })).toBe('nuithra-salt-iris');
  });
  it('suggests Smoke Garden for wood and smoke in the evening', () => {
    expect(suggest({ when: 'evening', like: 'wood', strength: 'strong' })).toBe('nuithra-smoke-garden');
  });
  it('returns null until every question is answered', () => {
    expect(suggest({ when: 'day', like: 'fresh' })).toBeNull();
  });
});
