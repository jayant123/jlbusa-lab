// Device quality tiers and adaptive render resolution.
export function detectTier({ webgl2, deviceMemory, hardwareConcurrency, dpr, mobile }) {
  if (!webgl2) return 'low';
  if (mobile && deviceMemory != null && deviceMemory <= 3) return 'low';
  if (!mobile && deviceMemory >= 8 && hardwareConcurrency >= 8) return 'high';
  return 'mid';
}

export function nextPixelRatio(current, frameMs, { min = 0.75, max, targetMs = 16.7 } = {}) {
  let next = current;
  if (frameMs > targetMs * 1.25) next = current - 0.1;
  else if (frameMs < targetMs * 0.8) next = current + 0.05;
  return Math.round(Math.min(max, Math.max(min, next)) * 100) / 100;
}

// Adaptive resolution that settles. The old rule moved a little every 30 frames and could hunt back and forth.
// Each step resized the canvas and made fine textures shimmer. This governor:
// - never renders above the screen's own pixel ratio,
// - moves in 0.25 steps,
// - drops only after two slow windows in a row and rises only after four fast ones,
// - stops rising for good once a rise had to be taken back.
// window(ms) takes the average frame time of one window and returns the pixel ratio to use.
export function createDprGovernor({ start, min = 0.75, max = 2, device = 1, targetMs = 16.7 }) {
  const top = Math.max(min, Math.min(max, device));
  const clamp = (v) => Math.round(Math.min(top, Math.max(min, v)) * 100) / 100;
  let dpr = clamp(start), slow = 0, fast = 0, lastMove = 0, locked = false;
  return {
    get dpr() { return dpr; },
    set(v) { dpr = clamp(v); slow = 0; fast = 0; },
    window(ms) {
      if (ms > targetMs * 1.35) { slow += 1; fast = 0; } else if (ms < targetMs * 0.75) { fast += 1; slow = 0; } else { slow = 0; fast = 0; }
      if (slow >= 2) {
        const next = clamp(dpr - 0.25);
        if (next !== dpr) { if (lastMove > 0) locked = true; dpr = next; lastMove = -1; }
        slow = 0;
      } else if (fast >= 4 && !locked) {
        const next = clamp(dpr + 0.25);
        if (next !== dpr) { dpr = next; lastMove = 1; }
        fast = 0;
      }
      return dpr;
    },
  };
}

export function readDevice() {
  const c = document.createElement('canvas');
  let webgl2 = false;
  try { webgl2 = !!c.getContext('webgl2'); } catch { webgl2 = false; }
  return {
    webgl2,
    deviceMemory: navigator.deviceMemory,
    hardwareConcurrency: navigator.hardwareConcurrency,
    dpr: window.devicePixelRatio || 1,
    mobile: matchMedia('(pointer: coarse)').matches || /Mobi|Android|iPhone/i.test(navigator.userAgent),
  };
}
