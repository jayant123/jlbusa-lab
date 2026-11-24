import { describe, it, expect } from 'vitest';
import { EMPTY, place, dimensions, cartLines, count } from '../../src/plintha/layout.js';

const build = (steps) => steps.reduce((l, [m, s]) => (l ? place(l, m, s) : l), EMPTY);
const product = (handle, base) => ({ handle, variants: ['Boucle Chalk', 'Wool Moss', 'Linen Sand', 'Velvet Ink'].map((f, i) => ({ id: `${handle}#${i}`, price: base, available: true, selectedOptions: { Fabric: f } })) });
const products = Object.fromEntries(['armless', 'corner', 'arm-left', 'arm-right', 'chaise', 'ottoman'].map((h) => [`plintha-${h}`, product(`plintha-${h}`, 1000)]));

describe('PLINTHA layout', () => {
  it('a straight sofa with two arms is 390 x 100 cm', () => {
    const l = build([['arm_left', 'end'], ['armless', 'end'], ['armless', 'end'], ['arm_right', 'end']]);
    expect(dimensions(l)).toEqual({ widthCm: 390, depthCm: 100 });
  });
  it('a corner joining two runs makes an L whose depth is 100 + the second run', () => {
    const l = build([['arm_left', 'end'], ['armless', 'end'], ['corner', 'end'], ['armless', 'return'], ['arm_right', 'return']]);
    expect(dimensions(l)).toEqual({ widthCm: 105 + 90 + 100, depthCm: 100 + 90 + 105 });
  });
  it('a chaise at the end makes the sofa deeper', () => {
    const l = build([['arm_left', 'end'], ['armless', 'end'], ['chaise', 'end']]);
    expect(dimensions(l)).toEqual({ widthCm: 105 + 90 + 90, depthCm: 165 });
  });
  it('rejects an arm in the middle of a run', () => {
    const l = build([['arm_left', 'end'], ['armless', 'end']]);
    expect(place(l, 'arm_right', 'start')).toBeNull();
    expect(place(l, 'armless', 'start')).toBeNull(); // would push the left arm inward
    expect(place(build([['armless', 'end']]), 'arm_left', 'end')).toBeNull();
  });
  it('rejects a second corner, a chaise mid-run and more than eight modules', () => {
    const l = build([['armless', 'end'], ['corner', 'end']]);
    expect(place(l, 'corner', 'end')).toBeNull();
    expect(place(build([['armless', 'end'], ['chaise', 'end']]), 'armless', 'end')).toBeNull(); // chaise would be mid-run
    let big = EMPTY;
    for (let i = 0; i < 8; i++) big = place(big, 'armless', 'end');
    expect(count(big)).toBe(8);
    expect(place(big, 'armless', 'end')).toBeNull();
  });
  it('ottomans sit free and do not change the sofa footprint', () => {
    const l = build([['armless', 'end'], ['ottoman', 'free']]);
    expect(dimensions(l)).toEqual({ widthCm: 90, depthCm: 100 });
  });
  it('groups cart lines by module in the chosen fabric', () => {
    const l = build([['arm_left', 'end'], ['armless', 'end'], ['armless', 'end'], ['arm_right', 'end'], ['ottoman', 'free']]);
    expect(cartLines(l, 'Wool Moss', products)).toEqual([
      { variantId: 'plintha-arm-left#1', qty: 1 },
      { variantId: 'plintha-armless#1', qty: 2 },
      { variantId: 'plintha-arm-right#1', qty: 1 },
      { variantId: 'plintha-ottoman#1', qty: 1 },
    ]);
  });
});

import { quote } from '../../src/plintha/layout.js';
describe('PLINTHA quote', () => {
  it('prices every module in the chosen fabric from the store data', () => {
    const l = build([['arm_left', 'end'], ['armless', 'end'], ['armless', 'end'], ['ottoman', 'free']]);
    const priced = { ...products, 'plintha-armless': product('plintha-armless', 1450) };
    expect(quote(l, 'Linen Sand', priced)).toEqual({ amount: 1000 + 2 * 1450 + 1000, currencyCode: 'USD', missing: 0 });
  });
  it('counts modules the store cannot price', () => {
    const l = build([['armless', 'end']]);
    expect(quote(l, 'Linen Sand', {})).toEqual({ amount: 0, currencyCode: 'USD', missing: 1 });
  });
});
