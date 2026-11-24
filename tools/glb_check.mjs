// Asserts a GLB has the required named nodes, stays within a triangle and size budget, and (optionally)
// that named nodes' bounding boxes match expected sizes in centimeters.
// node tools/glb_check.mjs file.glb --nodes a,b,c --max-tris 300000 --max-mb 4 [--bbox name=WxD,name=WxD]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/core';
import { statSync } from 'node:fs';
import { MeshoptDecoder } from 'meshoptimizer';

export async function checkGlb(file, { nodes = [], maxTris = Infinity, maxMb = Infinity, bbox = {} }) {
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  const doc = await io.read(file);
  const root = doc.getRoot();
  const names = new Set(root.listNodes().map((n) => n.getName()));
  const errors = [];
  for (const n of nodes) if (!names.has(n)) errors.push(`missing node ${n}`);
  let tris = 0;
  for (const m of root.listMeshes()) for (const p of m.listPrimitives()) {
    const idx = p.getIndices();
    tris += (idx ? idx.getCount() : p.getAttribute('POSITION').getCount()) / 3;
  }
  if (tris > maxTris) errors.push(`triangles ${tris} > ${maxTris}`);
  const mb = statSync(file).size / 1e6;
  if (mb > maxMb) errors.push(`size ${mb.toFixed(2)} MB > ${maxMb} MB`);
  for (const [name, [w, d]] of Object.entries(bbox)) {
    const node = root.listNodes().find((n) => n.getName() === name);
    if (!node) continue;
    const { min, max } = getBounds(node);
    const W = (max[0] - min[0]) * 100, D = (max[2] - min[2]) * 100;
    if (Math.abs(W - w) > 1 || Math.abs(D - d) > 1) errors.push(`bbox ${name} ${W.toFixed(1)}x${D.toFixed(1)} cm, want ${w}x${d}`);
  }
  return { ok: errors.length === 0, errors, tris, mb };
}

if (process.argv[1]?.endsWith('glb_check.mjs')) {
  const [file, ...rest] = process.argv.slice(2);
  const arg = (k) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : undefined; };
  const bbox = Object.fromEntries((arg('--bbox') || '').split(',').filter(Boolean).map((s) => { const [n, wd] = s.split('='); return [n, wd.split('x').map(Number)]; }));
  try {
    const r = await checkGlb(file, { nodes: (arg('--nodes') || '').split(',').filter(Boolean), maxTris: Number(arg('--max-tris') ?? Infinity), maxMb: Number(arg('--max-mb') ?? Infinity), bbox });
    console.log(r.ok ? 'PASS' : 'FAIL', file, `tris=${r.tris}`, `mb=${r.mb.toFixed(2)}`, ...r.errors);
    process.exit(r.ok ? 0 : 1);
  } catch (e) {
    console.log('FAIL', file, e.message);
    process.exit(1);
  }
}
