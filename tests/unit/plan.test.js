import { describe, it, expect } from 'vitest';
import { EMPTY, place, dimensions } from '../../src/plintha/layout.js';
import { placements } from '../../src/plintha/positions.js';
import { planSvg } from '../../src/plintha/plan.js';

const build = (steps) => steps.reduce((l, [m, s]) => (l ? place(l, m, s) : l), EMPTY);

describe('PLINTHA floor plan', () => {
  it('draws one outline per module and labels the overall size', () => {
    const l = build([['arm_left', 'end'], ['armless', 'end'], ['armless', 'end'], ['arm_right', 'end']]);
    const svg = planSvg(placements(l), dimensions(l));
    expect(svg.match(/class="m /g)).toHaveLength(4);
    expect(svg).toContain('>390 cm<');
    expect(svg).toContain('>100 cm<');
    expect(svg).toMatch(/^<svg[^>]+viewBox=/);
  });
  it('marks a selected module', () => {
    const l = build([['armless', 'end'], ['armless', 'end']]);
    expect(planSvg(placements(l), dimensions(l), { selected: 'main:1' })).toContain('data-id="main:1" class="m is-sel');
  });
  it('shows an empty plan with a prompt', () => {
    expect(planSvg([], { widthCm: 0, depthCm: 0 })).toContain('Add a module');
  });
});
