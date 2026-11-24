import { describe, it, expect } from 'vitest';
import { EMPTY, place, dimensions } from '../../src/plintha/layout.js';
import { check, insertAt, removeId, moveTo, move, swap, duplicate, handles, roomFit, createHistory, PRESETS, indexOfId, idAt } from '../../src/plintha/edit.js';

const L = (main, ret = [], ottomans = 0) => ({ main, ret, ottomans });

describe('PLINTHA editing', () => {
  it('checks the rules with a reason', () => {
    expect(check(L(['arm_left', 'armless', 'arm_right']))).toBeNull();
    expect(check(L(['armless', 'arm_left']))).toMatch(/left arm/i);
    expect(check(L(['arm_right', 'armless']))).toMatch(/right arm/i);
    expect(check(L(['chaise', 'armless', 'chaise']))).toMatch(/one chaise/i);
    expect(check(L(['armless', 'chaise', 'armless']))).toMatch(/chaise/i);
    expect(check(L(['armless', 'corner'], ['armless', 'corner']))).toMatch(/one corner/i);
    expect(check(L(Array(8).fill('armless'), [], 1))).toMatch(/eight/i);
    expect(check(L(['armless', 'corner'], ['arm_right', 'armless']))).toMatch(/arm/i);
  });

  it('inserts anywhere the rules allow and selects the new piece', () => {
    const r = insertAt(L(['arm_left', 'arm_right']), 1, 'armless');
    expect(r.layout.main).toEqual(['arm_left', 'armless', 'arm_right']);
    expect(r.sel).toBe('main:1');
    expect(insertAt(L(['arm_left', 'arm_right']), 0, 'armless').error).toMatch(/left arm/i);
    const c = insertAt(L(['armless', 'armless']), 2, 'corner');
    expect(c.layout).toEqual(L(['armless', 'armless', 'corner']));
    const ret = insertAt(c.layout, 3, 'arm_right');
    expect(ret.layout.ret).toEqual(['arm_right']);
    expect(ret.sel).toBe('ret:0');
    expect(insertAt(L(['armless']), 'ottoman', 'ottoman').layout.ottomans).toBe(1);
    expect(insertAt(L(Array(8).fill('armless')), 0, 'armless').error).toMatch(/eight/i);
  });

  it('removes a piece and folds the return into a straight run when the corner goes', () => {
    expect(removeId(L(['armless', 'armless']), 'main:0').layout.main).toEqual(['armless']);
    const r = removeId(L(['armless', 'corner'], ['armless', 'arm_right']), 'main:1');
    expect(r.layout).toEqual(L(['armless', 'armless', 'arm_right']));
    expect(removeId(L(['armless'], [], 2), 'ottoman:1').layout.ottomans).toBe(1);
  });

  it('moves a piece along the run and across the corner', () => {
    const l = L(['arm_left', 'armless', 'chaise']);
    expect(move(l, 'main:2', -1).error).toMatch(/chaise/i);
    const k = L(['arm_left', 'armless', 'armless', 'corner'], ['arm_right']);
    const across = move(k, 'main:2', 1);
    expect(across.layout).toEqual(L(['arm_left', 'armless', 'corner'], ['armless', 'arm_right']));
    expect(across.sel).toBe('ret:0');
    const corner = move(k, 'main:3', -1);
    expect(corner.layout).toEqual(L(['arm_left', 'armless', 'corner'], ['armless', 'arm_right']));
    expect(move(L(['armless', 'armless']), 'main:1', 1).error).toMatch(/end/i);
    expect(move(L(['armless'], [], 1), 'ottoman:0', 1).error).toMatch(/ottoman/i);
    expect(moveTo(L(['armless', 'chaise']), 'main:1', 0).layout.main).toEqual(['chaise', 'armless']);
  });

  it('swaps a module type when the result is valid', () => {
    expect(swap(L(['armless', 'armless']), 'main:1', 'arm_right').layout.main).toEqual(['armless', 'arm_right']);
    expect(swap(L(['armless', 'armless']), 'main:0', 'arm_right').error).toMatch(/right arm/i);
    const s = swap(L(['armless', 'armless']), 'main:1', 'corner');
    expect(s.layout).toEqual(L(['armless', 'corner']));
    expect(swap(L(['armless']), 'main:0', 'ottoman').error).toMatch(/ottoman/i);
    expect(swap(L(['armless', 'corner'], ['armless']), 'main:1', 'armless').layout).toEqual(L(['armless', 'armless', 'armless']));
  });

  it('duplicates next to the original', () => {
    const d = duplicate(L(['arm_left', 'armless', 'arm_right']), 'main:1');
    expect(d.layout.main).toEqual(['arm_left', 'armless', 'armless', 'arm_right']);
    expect(d.sel).toBe('main:2');
    expect(duplicate(L(['arm_left', 'armless']), 'main:0').error).toMatch(/left arm/i);
    expect(duplicate(L(['chaise', 'armless']), 'main:0').error).toMatch(/one chaise/i);
    expect(duplicate(L(['armless'], [], 1), 'ottoman:0').layout.ottomans).toBe(2);
  });

  it('maps ids to sequence positions both ways', () => {
    const l = L(['armless', 'corner'], ['armless', 'arm_right']);
    expect(indexOfId(l, 'ret:1')).toBe(3);
    expect(idAt(l, 2)).toBe('ret:0');
    expect(idAt(l, 1)).toBe('main:1');
  });

  it('offers insert handles at the open ends only', () => {
    expect(handles(EMPTY).map((h) => h.side)).toEqual(['first']);
    expect(handles(L(['armless'])).map((h) => h.side)).toEqual(['start', 'end', 'ottoman']);
    const closed = handles(L(['arm_left', 'armless', 'arm_right']));
    expect(closed.map((h) => h.side)).toEqual(['ottoman']);
    const corner = handles(L(['armless', 'corner'], ['armless']));
    expect(corner.map((h) => h.side)).toEqual(['start', 'return', 'ottoman']);
    expect(corner.find((h) => h.side === 'return').pos).toBe(3);
    expect(corner.find((h) => h.side === 'start').kinds).toContain('arm_left');
    expect(corner.find((h) => h.side === 'start').kinds).not.toContain('arm_right');
  });

  it('checks the fit against a wall with 60 cm to spare', () => {
    const l = L(['arm_left', 'armless', 'arm_right']); // 300 cm
    expect(roomFit(l, 360)).toEqual({ wallCm: 360, widthCm: 300, spareCm: 60, sideCm: 30, fits: true });
    expect(roomFit(l, 340).fits).toBe(false);
    expect(roomFit(l, 0)).toBeNull();
    expect(roomFit(EMPTY, 300)).toBeNull();
  });

  it('undo and redo walk the history and a new edit drops the redo branch', () => {
    const h = createHistory(EMPTY);
    const a = L(['armless']), b = L(['armless', 'armless']), c = L(['chaise']);
    h.push(a); h.push(b);
    expect(h.canUndo).toBe(true);
    expect(h.undo()).toBe(a);
    expect(h.undo()).toBe(EMPTY);
    expect(h.canUndo).toBe(false);
    expect(h.undo()).toBe(EMPTY);
    expect(h.redo()).toBe(a);
    h.push(c);
    expect(h.canRedo).toBe(false);
    expect(h.now).toBe(c);
    h.push(c);
    expect(h.undo()).toBe(a); // pushing the same state twice adds no step
  });

  it('every preset is a valid layout', () => {
    expect(PRESETS.map((p) => p.name)).toEqual(['Straight three-seat', 'Corner sofa', 'U shape', 'Chaise sofa', 'Lounge island']);
    for (const p of PRESETS) expect(check(p.layout), p.name).toBeNull();
    expect(dimensions(PRESETS[0].layout).widthCm).toBe(300);
  });

  it('the palette rule refuses a second chaise too', () => {
    expect(place(L(['chaise', 'armless']), 'chaise', 'end')).toBeNull();
  });
});
