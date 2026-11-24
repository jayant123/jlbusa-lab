#!/usr/bin/env bash
# Build, compress and check the OSTREL watch at three detail levels.
set -euo pipefail
B=${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}
N=case,bezel,crystal,dial,hands_hour,hands_minute,hands_second,movement_plate,balance_wheel,escape_wheel,gear_train,crown,strap_top,strap_bottom
mkdir -p public/ostrel build
for lod in high mid low; do
  case $lod in high) T=300000; M=4;; mid) T=120000; M=1.8;; low) T=40000; M=0.8;; esac
  "$B" -b -P blender/ostrel_watch.py -- --lod $lod --out build/watch-$lod.raw.glb > build/blender-$lod.log 2>&1
  npx gltf-transform meshopt build/watch-$lod.raw.glb public/ostrel/watch-$lod.glb --level medium > /dev/null
  node tools/glb_check.mjs public/ostrel/watch-$lod.glb --nodes $N --max-tris $T --max-mb $M
done
