#!/usr/bin/env bash
# Build, compress and check the SERAVEL ring at two detail levels. Blender runs through the shared render queue.
set -euo pipefail
mkdir -p public/seravel build
for lod in high low; do
  case $lod in high) T=200000; M=1.5;; low) T=60000; M=0.6;; esac
  tools/blender_lock.sh blender -b -P blender/seravel_jewelry.py -- --piece ring --lod $lod --out build/ring-$lod.raw.glb > build/seravel-$lod.log 2>&1
  npx gltf-transform meshopt build/ring-$lod.raw.glb public/seravel/ring-$lod.glb --level medium > /dev/null
  node tools/glb_check.mjs public/seravel/ring-$lod.glb --nodes band,head,stone --max-tris $T --max-mb $M
done
