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
