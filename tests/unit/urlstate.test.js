import { describe, it, expect } from 'vitest';
import { EMPTY, place, count } from '../../src/plintha/layout.js';
import { encode, decode } from '../../src/plintha/urlstate.js';

const build = (steps) => steps.reduce((l, [m, s]) => place(l, m, s), EMPTY);

describe('PLINTHA share links', () => {
  it('round-trips a layout and fabric', () => {
    const l = build([['arm_left', 'end'], ['armless', 'end'], ['corner', 'end'], ['chaise', 'return'], ['ottoman', 'free']]);
    const s = encode(l, 'Velvet Ink');
    expect(decode(s)).toEqual({ layout: l, fabric: 'Velvet Ink' });
  });
  it('drops unknown modules, invalid placements and anything past eight', () => {
    const d = decode('l.zz.a.c.c.a.a.a.a.a.a.a~~0~linen-sand');
    expect(d.layout.main).toEqual(['arm_left', 'armless', 'corner']);
    expect(count(d.layout)).toBeLessThanOrEqual(8);
    expect(d.fabric).toBe('Linen Sand');
  });
  it('falls back to defaults for garbage input', () => {
    expect(decode('%%%')).toEqual({ layout: EMPTY, fabric: 'Boucle Chalk' });
    expect(decode(undefined)).toEqual({ layout: EMPTY, fabric: 'Boucle Chalk' });
  });
});
