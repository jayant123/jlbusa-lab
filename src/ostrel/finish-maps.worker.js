// Generates the OSTREL finish maps off the main thread.
import { sunburstData, perlageData, cotesData, grainData } from './finish-data.js';

const GEN = { sun: sunburstData, perl: perlageData, cotes: cotesData, grain: grainData };
self.onmessage = (e) => {
  const out = {};
  for (const [k, n] of Object.entries(e.data)) out[k] = GEN[k](n);
  self.postMessage(out, Object.values(out).map((d) => d.buffer));
};
