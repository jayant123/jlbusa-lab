export function hasWebGL() {
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; }
}
export function prefersReducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
