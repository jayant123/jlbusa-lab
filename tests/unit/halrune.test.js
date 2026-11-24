import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PRODUCTS, ORDER, optionOf, FINISH_COLOR, responseCurve } from '../../src/halrune/catalog.js';
import { midiToFreq, CHORDS, chordAt, smoothLevel, bandLevels } from '../../src/halrune/audio-math.js';

const seed = JSON.parse(readFileSync(resolve(process.cwd(), 'seed/halrune.json'), 'utf8'));

describe('HALRUNE catalog', () => {
  it('describes every product in the store, and only those', () => {
    expect([...ORDER].sort()).toEqual(seed.products.map((p) => p.handle).sort());
  });
  it('lists the same option values as the store, with a color for every finish', () => {
    for (const p of seed.products) {
      const o = p.options[0];
      expect(optionOf(p.handle)).toBe(o.name);
      expect(PRODUCTS[p.handle].values).toEqual(o.values);
      for (const v of o.values) expect(FINISH_COLOR[v]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
  it('gives each product a model, specs and plain copy', () => {
    for (const h of ORDER) {
      const p = PRODUCTS[h];
      expect(['one', 'monitor', 'buds']).toContain(p.model);
      expect(p.specs.length).toBeGreaterThan(2);
      expect(p.story.length).toBeGreaterThan(40);
    }
  });
  it('draws a demo response curve from 20 Hz to 20 kHz within a few dB', () => {
    const c = responseCurve('halrune-one');
    expect(c[0].hz).toBe(20);
    expect(c[c.length - 1].hz).toBe(20000);
    for (const p of c) { expect(p.db).toBeGreaterThan(-12); expect(p.db).toBeLessThan(6); }
    for (let i = 1; i < c.length; i++) expect(c[i].hz).toBeGreaterThan(c[i - 1].hz);
  });
});

describe('HALRUNE audio math', () => {
  it('turns MIDI notes into frequencies', () => {
    expect(midiToFreq(69)).toBeCloseTo(440, 6);
    expect(midiToFreq(57)).toBeCloseTo(220, 6);
  });
  it('cycles through its chords by bar', () => {
    expect(CHORDS.length).toBeGreaterThan(2);
    expect(chordAt(0)).toBe(CHORDS[0]);
    expect(chordAt(CHORDS.length)).toBe(CHORDS[0]);
    expect(chordAt(1)).toBe(CHORDS[1]);
  });
  it('smooths levels with a fast attack and a slow release', () => {
    expect(smoothLevel(0, 1, 0.016)).toBeGreaterThan(0.3);
    expect(smoothLevel(1, 0, 0.016)).toBeGreaterThan(0.85);
    expect(smoothLevel(0.5, 0.5, 0.016)).toBeCloseTo(0.5, 6);
  });
  it('reads bass, mid and treble from analyser bins', () => {
    const bins = new Uint8Array(64);
    bins.fill(0);
    for (let i = 0; i < 4; i++) bins[i] = 255;
    const l = bandLevels(bins, 48000, 128);
    expect(l.bass).toBeGreaterThan(0.9);
    expect(l.treble).toBe(0);
    expect(bandLevels(new Uint8Array(64), 48000, 128)).toEqual({ bass: 0, mid: 0, treble: 0, all: 0 });
  });
});
