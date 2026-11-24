#!/usr/bin/env bash
# Build, compress and check the VANTRIK shoes at two detail levels. Blender runs through the shared queue.
set -euo pipefail
mkdir -p public/vantrik build
for kind in runner court; do
  for lod in high low; do
    case $lod in high) T=140000; M=2.5;; low) T=45000; M=1;; esac
    tools/blender_lock.sh blender -b -P blender/vantrik_shoes.py -- --kind $kind --lod $lod --out build/$kind-$lod.raw.glb > build/vantrik-$kind-$lod.log 2>&1
    npx gltf-transform meshopt build/$kind-$lod.raw.glb build/$kind-$lod.m.glb --level medium > /dev/null
    npx gltf-transform webp build/$kind-$lod.m.glb public/vantrik/$kind-$lod.glb > /dev/null
    node tools/glb_check.mjs public/vantrik/$kind-$lod.glb --nodes outsole,midsole,insole,upper,tongue,laces,eyelets,heel_tab,stitch --max-tris $T --max-mb $M
  done
done
