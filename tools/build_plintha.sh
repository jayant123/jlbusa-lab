#!/usr/bin/env bash
# Build, compress and check the PLINTHA module set and room.
set -euo pipefail
B=${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}
N=armless,corner,arm_left,arm_right,chaise,ottoman
BB=armless=90x100,corner=100x100,arm_left=105x100,arm_right=105x100,chaise=90x165,ottoman=90x90
mkdir -p public/plintha build
for lod in high mid low; do
  case $lod in high) T=250000; M=5;; mid) T=100000; M=2;; low) T=35000; M=0.9;; esac
  if [ "${SKIP_BLENDER:-0}" != 1 ]; then
    "$B" -b -P blender/plintha_set.py -- --lod $lod --what modules --out build/modules-$lod.raw.glb > build/plintha-$lod.log 2>&1
    npx gltf-transform meshopt build/modules-$lod.raw.glb public/plintha/modules-$lod.glb --level medium > /dev/null
  fi
  node tools/glb_check.mjs public/plintha/modules-$lod.glb --nodes $N --max-tris $T --max-mb $M --bbox $BB
done
for lod in high low; do
  case $lod in high) M=6;; low) M=1.5;; esac
  if [ "${SKIP_BLENDER:-0}" != 1 ]; then
    "$B" -b -P blender/plintha_set.py -- --lod $lod --what room --out build/room-$lod.raw.glb > build/plintha-room-$lod.log 2>&1
    npx gltf-transform meshopt build/room-$lod.raw.glb public/plintha/room-$lod.glb --level medium > /dev/null
  fi
  node tools/glb_check.mjs public/plintha/room-$lod.glb --nodes floor,walls,rug,side_table,floor_lamp --max-mb $M
done
