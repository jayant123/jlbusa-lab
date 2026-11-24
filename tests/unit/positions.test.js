import { describe, it, expect } from 'vitest';
import { EMPTY, place } from '../../src/plintha/layout.js';
import { placements, bounds, ghostSlots } from '../../src/plintha/positions.js';

const build = (steps) => steps.reduce((l, [m, s]) => (l ? place(l, m, s) : l), EMPTY);
const near = (a, b) => expect(a).toBeCloseTo(b, 6);

describe('PLINTHA positions', () => {
  it('a straight run sits edge to edge from x = 0', () => {
    const p = placements(build([['arm_left', 'end'], ['armless', 'end'], ['armless', 'end'], ['arm_right', 'end']]), { center: false });
    expect(p.map((m) => m.kind)).toEqual(['arm_left', 'armless', 'armless', 'arm_right']);
    [0, 1.05, 1.95, 2.85].forEach((x, i) => near(p[i].x, x));
    expect(p.every((m) => m.z === 0 && m.rot === 0)).toBe(true);
  });

  it('a return run turns the corner and runs forward with its back to the right', () => {
    const p = placements(build([['armless', 'end'], ['corner', 'end'], ['armless', 'return'], ['arm_right', 'return']]), { center: false });
    near(p[1].x, 0.9);
    expect(p[2]).toMatchObject({ kind: 'armless', where: 'ret', index: 0 });
    near(p[2].x, 1.9); near(p[2].z, 1.0); near(p[2].rot, -Math.PI / 2);
    near(p[3].x, 1.9); near(p[3].z, 1.9);
  });

  it('ottomans sit in front of the main run, centered', () => {
    const p = placements(build([['armless', 'end'], ['armless', 'end'], ['ottoman', 'free']]), { center: false });
    const o = p.find((m) => m.kind === 'ottoman');
    near(o.x, 0.45); near(o.z, 1.45);
  });

  it('centers the composition on x = 0 by default', () => {
    const b = bounds(placements(build([['armless', 'end'], ['armless', 'end'], ['arm_right', 'end']])));
    near((b.minX + b.maxX) / 2, 0);
    near(b.maxX - b.minX, 2.85);
  });

  it('offers only the slots the rules allow, in the current frame', () => {
    expect(ghostSlots(EMPTY, 'armless').map((g) => g.slot)).toEqual(['end']);
    near(ghostSlots(EMPTY, 'armless')[0].x, -0.45);
    const one = build([['armless', 'end']]);
    expect(ghostSlots(one, 'arm_left').map((g) => g.slot)).toEqual(['start']);
    near(ghostSlots(one, 'arm_left')[0].x, -0.45 - 1.05);
    expect(ghostSlots(one, 'arm_right').map((g) => g.slot)).toEqual(['end']);
    const cornered = build([['armless', 'end'], ['corner', 'end']]);
    expect(ghostSlots(cornered, 'armless').map((g) => g.slot)).toEqual(['start', 'return']);
    expect(ghostSlots(one, 'ottoman').map((g) => g.slot)).toEqual(['free']);
  });

  it('can work in the room frame, where the run starts at x = 0', () => {
    const one = build([['armless', 'end']]);
    near(ghostSlots(one, 'arm_left', { center: false })[0].x, -1.05);
    near(ghostSlots(one, 'armless', { center: false }).find((g) => g.slot === 'end').x, 0.9);
    near(ghostSlots(EMPTY, 'armless', { center: false })[0].x, 0);
  });

  it('offers nothing once eight modules are placed', () => {
    const full = build(Array(8).fill(['armless', 'end']));
    expect(ghostSlots(full, 'armless')).toEqual([]);
  });
});
