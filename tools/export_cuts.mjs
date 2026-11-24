// Write the NUITHRA bottle cuts and colors to JSON for the Blender renders, so photos match the live 3D.
import { writeFileSync } from 'node:fs';
import { CUTS } from '../src/nuithra/bottles.js';
import { SCENTS, ORDER } from '../src/nuithra/scents.js';
const out = { order: ORDER, scents: Object.fromEntries(ORDER.map((h) => [h, { name: SCENTS[h].name, shape: SCENTS[h].shape, glass: SCENTS[h].glass, stone: SCENTS[h].stone, metal: SCENTS[h].metal }])), cuts: CUTS };
writeFileSync(process.argv[2] || 'build/nuithra_cuts.json', JSON.stringify(out, null, 1));
console.log('wrote', Object.keys(CUTS).length, 'cuts');
