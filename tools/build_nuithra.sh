#!/usr/bin/env bash
# Build, compress and check the NUITHRA bottle at two detail levels.
set -euo pipefail
B=${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}
mkdir -p public/nuithra build
for lod in high low; do
  case $lod in high) T=120000; M=2;; low) T=30000; M=0.6;; esac
  "$B" -b -P blender/nuithra_bottle.py -- --lod $lod --out build/bottle-$lod.raw.glb > build/nuithra-$lod.log 2>&1
  npx gltf-transform meshopt build/bottle-$lod.raw.glb public/nuithra/bottle-$lod.glb --level medium > /dev/null
  node tools/glb_check.mjs public/nuithra/bottle-$lod.glb --nodes glass,liquid,collar,cap --max-tris $T --max-mb $M
done
