#!/usr/bin/env bash
# Build, compress and check the HALRUNE products at two detail levels. Blender runs through the shared queue.
set -euo pipefail
B=${BLENDER:-blender}
mkdir -p public/halrune build
nodes() { case $1 in one) echo cup_l,cup_r,grille_l,grille_r,pad_l,pad_r,driver_l,driver_r,magnet_l,magnet_r,baffle_l,baffle_r,band_steel,band_leather,yoke_l,yoke_r,cable;; monitor) echo cabinet,baffle_front,woofer_cone,woofer_surround,dust_cap,tweeter_dome,port;; buds) echo case_base,case_lid,bud_l,bud_r,seam,status_light;; esac; }
for prod in one monitor buds; do
  for lod in high low; do
    case $lod in high) T=260000; M=3;; low) T=70000; M=1;; esac
    tools/blender_lock.sh "$B" -b -P blender/halrune_models.py -- --product $prod --lod $lod --out build/halrune-$prod-$lod.raw.glb > build/halrune-$prod-$lod.log 2>&1
    npx gltf-transform weld build/halrune-$prod-$lod.raw.glb build/halrune-$prod-$lod.w.glb > /dev/null
    npx gltf-transform meshopt build/halrune-$prod-$lod.w.glb public/halrune/$prod-$lod.glb --level medium > /dev/null
    node tools/glb_check.mjs public/halrune/$prod-$lod.glb --nodes $(nodes $prod) --max-tris $T --max-mb $M
  done
done
