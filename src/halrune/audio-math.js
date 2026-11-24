// Pure helpers for the listening room's music and the 3D that moves with it.
export const midiToFreq = (n) => 440 * 2 ** ((n - 69) / 12);

// A slow progression in D minor: Dm9, Bbmaj7, Fmaj7/A, Gm9. Each chord lasts one bar.
export const CHORDS = [
  [50, 57, 60, 64, 65],
  [46, 53, 57, 60, 62],
  [45, 53, 57, 60, 64],
  [43, 50, 53, 57, 62],
];
export const chordAt = (bar) => CHORDS[((bar % CHORDS.length) + CHORDS.length) % CHORDS.length];

// Meters rise quickly and fall slowly, like a VU needle.
export function smoothLevel(prev, target, dt, attack = 0.03, release = 0.3) {
  const tau = target > prev ? attack : release;
  return prev + (target - prev) * (1 - Math.exp(-dt / tau));
}

// Average analyser bins into bass (< 250 Hz), mid (250 Hz to 4 kHz) and treble (> 4 kHz), each 0 to 1.
export function bandLevels(bins, sampleRate, fftSize) {
  const w = sampleRate / fftSize;
  const sum = { bass: [0, 0], mid: [0, 0], treble: [0, 0] };
  let all = 0;
  for (let i = 0; i < bins.length; i++) {
    const hz = i * w, v = bins[i] / 255;
    const k = hz < 250 ? 'bass' : hz < 4000 ? 'mid' : 'treble';
    sum[k][0] += v; sum[k][1] += 1; all += v;
  }
  const avg = (k) => (sum[k][1] ? sum[k][0] / sum[k][1] : 0);
  return { bass: avg('bass'), mid: avg('mid'), treble: avg('treble'), all: bins.length ? all / bins.length : 0 };
}
