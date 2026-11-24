import { describe, it, expect } from 'vitest';
import { largestGap } from '../../src/ostrel/freeband.js';

describe('OSTREL phone framing: largest free band', () => {
  it('finds the gap between the header and a docked card', () => {
    expect(largestGap([[0, 60], [500, 760], [780, 844]], 844)).toEqual([60, 500]);
  });
  it('handles overlapping covers and clamps to the screen', () => {
    expect(largestGap([[-20, 80], [60, 120], [400, 900]], 844)).toEqual([120, 400]);
  });
  it('picks the bigger of two gaps', () => {
    expect(largestGap([[0, 50], [200, 260], [700, 844]], 844)).toEqual([260, 700]);
  });
  it('returns the whole screen when nothing covers it', () => {
    expect(largestGap([], 640)).toEqual([0, 640]);
  });
});
