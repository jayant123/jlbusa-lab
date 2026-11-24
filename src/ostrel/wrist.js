// Wrist check for the Meridian 40. The flat top of a wrist is roughly a third of its circumference.
// The watch fits when its lug-to-lug length stays inside that flat top.
export const CASE_MM = 40;
export const LUG_TO_LUG = 47;
const TOP_SHARE = 0.32;

export function wristFit(value, unit = 'cm') {
  const mmPer = { cm: 10, in: 25.4 }[unit];
  const v = Number(value);
  if (!mmPer || !Number.isFinite(v)) return null;
  const circ = v * mmPer;
  if (circ < 120 || circ > 260) return null;
  const top = circ * TOP_SHARE;
  const overhang = Math.max(0, LUG_TO_LUG - top);
  let fit = 'good', message = 'The Meridian 40 fits your wrist. The lugs stay inside its flat top.';
  if (overhang > 0) {
    fit = 'large';
    message = `The lugs reach about ${Math.ceil(overhang / 2)} mm past each edge of your wrist. It will feel large.`;
  } else if (LUG_TO_LUG < top * 0.78) {
    fit = 'small';
    message = 'The Meridian 40 fits. It will look on the small side on your wrist.';
  }
  return { circ, top, overhang, fit, message };
}
