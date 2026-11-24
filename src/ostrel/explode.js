// Axial explosion of the OSTREL watch, driven by scroll progress t (0 assembled .. 1 exploded).
// Offsets are meters along the watch axis (same table as blender/stills.py). Upper parts lead, so the watch opens
// from the crystal downward; reversing t reassembles it in the opposite order.
export const EXPLODE = {
  crystal: 0.030, bezel: 0.024, hands_second: 0.019, hands_minute: 0.016, hands_hour: 0.013, dial: 0.009,
  balance_wheel: 0.005, gear_train: 0.0045, escape_wheel: 0.004, movement_plate: 0,
  case: -0.010, crown: -0.010, strap_top: -0.010, strap_bottom: -0.010, bracelet_top: -0.010, bracelet_bottom: -0.010,
};
export const PARTS = Object.keys(EXPLODE);

const ORDER = ['crystal', 'bezel', 'hands_second', 'hands_minute', 'hands_hour', 'dial', 'balance_wheel', 'gear_train', 'escape_wheel'];
const SPIN = { crystal: 0.35, bezel: -0.25 }; // radians of turn while lifting

const clamp = (v) => Math.min(1, Math.max(0, v));
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

function delayOf(k) {
  const i = ORDER.indexOf(k);
  return i < 0 ? 0.25 : i * 0.045; // parts outside the stack (case, straps) move with the dial
}

export function partOffsets(t) {
  const tt = clamp(t);
  const out = {};
  for (const k of PARTS) {
    const d = delayOf(k);
    const p = ease(clamp((tt - d) / (1 - d - 0.12)));
    out[k] = { z: EXPLODE[k] * p + 0, rot: (SPIN[k] || 0) * p + 0 };
  }
  return out;
}
