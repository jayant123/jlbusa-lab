import { describe, it, expect, vi } from 'vitest';
import { createStage } from '../../src/kit/stage.js';

const fakeRenderer = () => ({ setPixelRatio: vi.fn(), setSize: vi.fn(), render: vi.fn(), dispose: vi.fn(), setAnimationLoop: vi.fn(), domElement: null });

describe('stage fallback', () => {
  it('emits fallback exactly once when the WebGL context is lost', () => {
    const canvas = document.createElement('canvas');
    const stage = createStage(canvas, { tier: 'mid', createRenderer: () => fakeRenderer() });
    const fn = vi.fn();
    stage.on('fallback', fn);
    canvas.dispatchEvent(new Event('webglcontextlost'));
    canvas.dispatchEvent(new Event('webglcontextlost'));
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('emits fallback when the renderer cannot be created', async () => {
    const canvas = document.createElement('canvas');
    const stage = createStage(canvas, { tier: 'mid', createRenderer: () => { throw new Error('no webgl'); } });
    const fn = vi.fn();
    stage.on('fallback', fn);
    await new Promise((r) => setTimeout(r, 0));
    expect(fn).toHaveBeenCalledTimes(1);
    expect(stage.ok).toBe(false);
  });
});
