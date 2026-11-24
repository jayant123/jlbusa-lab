import { describe, it, expect } from 'vitest';
import { fromPrice, fabricSurcharge, LAYOUTS, layoutCard, FABRIC_INFO } from '../../src/plintha/store.js';
import { FABRICS } from '../../src/plintha/urlstate.js';
import { PRESETS } from '../../src/plintha/edit.js';

const v = (fabric, price, available = true) => ({ id: `v-${fabric}-${price}`, price, currencyCode: 'USD', available, selectedOptions: { Fabric: fabric } });
const prod = (base) => ({ variants: [v('Boucle Chalk', base), v('Wool Moss', base + 120), v('Linen Sand', base + 60), v('Velvet Ink', base + 180)] });
const products = { 'plintha-armless': prod(1450), 'plintha-corner': prod(1650), 'plintha-arm-left': prod(1750), 'plintha-arm-right': prod(1750), 'plintha-chaise': prod(1950), 'plintha-ottoman': prod(850) };

describe('PLINTHA store helpers', () => {
  it('gives the lowest available price of a module', () => {
    expect(fromPrice(products, 'armless')).toEqual({ amount: 1450, currencyCode: 'USD' });
    const sold = { 'plintha-armless': { variants: [v('Boucle Chalk', 1450, false), v('Wool Moss', 1570)] } };
    expect(fromPrice(sold, 'armless')).toEqual({ amount: 1570, currencyCode: 'USD' });
    expect(fromPrice({}, 'armless')).toBeNull();
  });
  it('works out the extra cost of a fabric per module from the store prices', () => {
    expect(fabricSurcharge(products, 'Boucle Chalk')).toBe(0);
    expect(fabricSurcharge(products, 'Wool Moss')).toBe(120);
    expect(fabricSurcharge(products, 'Velvet Ink')).toBe(180);
    expect(fabricSurcharge({}, 'Wool Moss')).toBeNull();
  });
  it('describes every fabric', () => {
    expect(Object.keys(FABRIC_INFO).sort()).toEqual([...FABRICS].sort());
    for (const f of FABRICS) { expect(FABRIC_INFO[f].made.length).toBeGreaterThan(5); expect(FABRIC_INFO[f].care.length).toBeGreaterThan(5); }
  });
  it('builds ready-made layout cards from the presets with size and price', () => {
    expect(LAYOUTS.length).toBe(3);
    for (const l of LAYOUTS) { expect(PRESETS.some((p) => p.id === l.preset)).toBe(true); expect(FABRICS).toContain(l.fabric); }
    const c = layoutCard(LAYOUTS[0], products);
    expect(c.size).toMatch(/^\d+ × \d+ cm$/);
    expect(c.price.amount).toBeGreaterThan(0);
    expect(c.modules).toBeGreaterThan(2);
    expect(layoutCard(LAYOUTS[0], {}).price).toBeNull();
  });
});
