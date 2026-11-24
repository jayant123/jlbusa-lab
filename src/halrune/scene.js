// HALRUNE listening room in 3D. A wall of oak slats, a walnut credenza, a warm lamp. On the credenza: a pair of
// Monitor speakers, the One headphones on a stand and the Buds in their open case. Visitors pick a product, change
// its finish and take the headphones apart. When music plays the woofer cones push, the tweeters breathe and the
// light strip and the lamp follow the level.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createStage } from '../kit/stage.js';
import { FINISH_COLOR, ORDER, PRODUCTS } from './catalog.js';
import { smoothLevel } from './audio-math.js';

const TOP = 0.52; // credenza top
const SPEAKER_X = 0.62;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
// Wood grain: long wavy lines over a base color, a little lighter and darker.
const grainCache = {};
function grain(hex) {
  if (grainCache[hex]) return grainCache[hex];
  const base = new THREE.Color(hex);
  const t = canvasTex(512, 512, (x, w, h) => {
    x.fillStyle = `#${base.getHexString()}`; x.fillRect(0, 0, w, h);
    let s = 3;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 140; i++) {
      const y0 = rnd() * h, amp = 4 + rnd() * 10, dark = rnd() < 0.7;
      const c = dark ? base.clone().multiplyScalar(0.55) : base.clone().lerp(new THREE.Color(1, 0.92, 0.8), 0.18);
      x.strokeStyle = `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${dark ? 0.18 + rnd() * 0.2 : 0.12 + rnd() * 0.12})`;
      x.lineWidth = 0.6 + rnd() * 2.4;
      x.beginPath();
      for (let px = 0; px <= w; px += 8) { const yy = y0 + Math.sin(px * 0.012 + i) * amp + Math.sin(px * 0.05 + i * 2) * 1.5; px ? x.lineTo(px, yy) : x.moveTo(px, yy); }
      x.stroke();
    }
  });
  grainCache[hex] = t;
  return t;
}
// Perforated grille: one round hole per tile, repeated across the disc.
const holes = () => canvasTex(64, 64, (x, w) => { x.fillStyle = '#fff'; x.fillRect(0, 0, w, w); x.fillStyle = '#000'; x.beginPath(); x.arc(w / 2, w / 2, w * 0.3, 0, Math.PI * 2); x.fill(); }, false);

export async function createHalruneScene(canvas, { tier, reducedMotion, onReady, onFallback, onPick, dragSurfaces = [] }) {
  const stage = createStage(canvas, { tier, fov: 32, shouldRender: () => active, createRenderer: (c) => {
    const r = new THREE.WebGLRenderer({ canvas: c, antialias: true, powerPreference: 'high-performance' });
    r.toneMapping = THREE.AgXToneMapping;
    r.toneMappingExposure = 1.05;
    r.outputColorSpace = THREE.SRGBColorSpace;
    return r;
  } });
  stage.on('fallback', onFallback);
  if (!stage.ok) return null;
  const { scene, camera, renderer } = stage;
  let active = true;
  scene.background = new THREE.Color(0x0d0e0f);
  scene.fog = new THREE.Fog(0x0d0e0f, 3.2, 7);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;

  // --- Room -------------------------------------------------------------------------------------------------------
  const hemi = new THREE.HemisphereLight(0xcfd8e0, 0x1a1410, 0.35);
  const key = new THREE.DirectionalLight(0xfff2e6, 1.6);
  key.position.set(-1.2, 2.2, 2.2);
  const lamp = new THREE.PointLight(0xff9a4a, 2.5, 4, 1.6);
  lamp.position.set(1.25, 1.0, -0.35);
  scene.add(hemi, key, lamp);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.MeshStandardMaterial({ color: 0x1b1714, roughness: 0.42, metalness: 0 }));
  floor.rotation.x = -Math.PI / 2;
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x111213, roughness: 0.9 });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(8, 3), wallMat);
  wall.position.set(0, 1.5, -0.64);
  const oak = grain(FINISH_COLOR.Oak);
  const slatMat = new THREE.MeshStandardMaterial({ map: oak, roughness: 0.6, color: 0x9a8a78 });
  const slats = new THREE.InstancedMesh(new RoundedBoxGeometry(0.028, 2.6, 0.03, 2, 0.004), slatMat, 81);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 81; i++) slats.setMatrixAt(i, m4.makeTranslation((i - 40) * 0.045, 1.3, -0.6));
  // A strip of warm light along the top of the credenza wall. It follows the music.
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.012), new THREE.MeshBasicMaterial({ color: 0xff7a35, toneMapped: false }));
  strip.position.set(0, TOP + 0.62, -0.58);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.9), new THREE.MeshBasicMaterial({ color: 0xffa35a, transparent: true, opacity: 0.6, toneMapped: false }));
  glow.position.set(1.25, 0.95, -0.55);
  const credenza = new THREE.Mesh(new RoundedBoxGeometry(1.8, TOP, 0.45, 3, 0.012), new THREE.MeshStandardMaterial({ map: grain(FINISH_COLOR.Walnut), roughness: 0.42, color: 0xb59a88 }));
  credenza.position.set(0, TOP / 2, -0.25);
  scene.add(floor, wall, slats, strip, glow, credenza);
  // Headphone stand: walnut base, steel rod, leather saddle.
  const steel = new THREE.MeshStandardMaterial({ color: 0xd4d6da, metalness: 1, roughness: 0.22 });
  const standG = new THREE.Group();
  const sBase = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.012, 64), credenza.material);
  sBase.position.y = 0.006;
  const sRod = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.25, 24), steel);
  sRod.position.y = 0.137;
  const sad = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.006, 16, 48, Math.PI), new THREE.MeshStandardMaterial({ color: 0x1a1512, roughness: 0.55 }));
  sad.position.y = 0.219;
  standG.add(sBase, sRod, sad);
  standG.position.set(0, TOP, -0.18);
  scene.add(standG);

  // --- Products ---------------------------------------------------------------------------------------------------
  const lod = tier === 'low' ? 'low' : 'high';
  const [one, mon, bud] = await Promise.all(['one', 'monitor', 'buds'].map((m) => stage.load(`/halrune/${m}-${lod}.glb`)));
  const holeTex = holes();
  function dress(root, handle) {
    const mats = {};
    const tex = (name) => {
      if (mats[name]) return mats[name];
      let m;
      switch (name) {
        case 'wood': case 'cabinet': m = new THREE.MeshPhysicalMaterial({ roughness: 0.4, clearcoat: 0.45, clearcoatRoughness: 0.2 }); break;
        case 'steel': m = steel; break;
        case 'leather': m = new THREE.MeshStandardMaterial({ color: 0x15110f, roughness: 0.55 }); break;
        case 'pad': m = new THREE.MeshPhysicalMaterial({ color: 0x141415, roughness: 0.95, sheen: 1, sheenColor: new THREE.Color(0x777a80), sheenRoughness: 0.6 }); break;
        case 'stitch': m = new THREE.MeshStandardMaterial({ color: 0xa79d8d, roughness: 0.8 }); break;
        case 'grille': {
          const t = holeTex.clone(); t.needsUpdate = true; t.repeat.set(50, 50);
          m = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, metalness: 1, roughness: 0.4, alphaMap: t, alphaTest: 0.5, side: THREE.DoubleSide });
          break;
        }
        case 'baffle': case 'trim': m = new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.55 }); break;
        case 'driver': m = new THREE.MeshStandardMaterial({ color: 0xcfc9bd, metalness: 0.7, roughness: 0.28 }); break;
        case 'magnet': m = new THREE.MeshStandardMaterial({ color: 0xa8aaae, metalness: 1, roughness: 0.15 }); break;
        case 'cable': m = new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.75 }); break;
        case 'cone': m = new THREE.MeshStandardMaterial({ color: 0x1d1d1e, roughness: 0.85 }); break;
        case 'surround': m = new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 0.6 }); break;
        case 'dome': m = new THREE.MeshStandardMaterial({ color: 0xd8d2c6, roughness: 0.65 }); break;
        case 'ceramic': m = new THREE.MeshPhysicalMaterial({ roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.28, sheen: 0.3, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xffffff) }); break;
        case 'bud': m = new THREE.MeshPhysicalMaterial({ roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.1 }); break;
        case 'seam': m = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 }); break;
        case 'led': m = new THREE.MeshBasicMaterial({ color: 0x5cff9a, toneMapped: false }); break;
        case 'tip': m = new THREE.MeshStandardMaterial({ color: 0x2a2a2c, roughness: 0.75 }); break;
        case 'mark': m = new THREE.MeshStandardMaterial({ color: 0x8f8a82, roughness: 0.6 }); break;
        default: m = new THREE.MeshStandardMaterial({ color: 0x777777 });
      }
      mats[name] = m;
      return m;
    };
    const nodes = {};
    root.traverse((o) => {
      if (o.name) nodes[o.name] = o;
      if (o.isMesh) { o.material = tex(o.material.name.replace(/\.\d+$/, '')); o.userData.handle = handle; }
    });
    // Compressed meshes keep a scale on their node, so motion multiplies the stored scale and adds to the stored position.
    for (const o of Object.values(nodes)) { o.userData.base = o.position.clone(); o.userData.baseScale = o.scale.clone(); }
    return { root, mats, nodes, handle };
  }
  function setFinish(p, value) {
    const hex = FINISH_COLOR[value] || '#777777';
    for (const k of ['wood', 'cabinet']) if (p.mats[k]) { p.mats[k].map = grain(hex); p.mats[k].color.set(0xffffff); p.mats[k].needsUpdate = true; }
    for (const k of ['ceramic', 'bud']) if (p.mats[k]) p.mats[k].color.set(hex);
  }

  const headphones = dress(one.scene, 'halrune-one');
  for (const n of ['cable', 'plug']) if (headphones.nodes[n]) headphones.nodes[n].visible = false; // off the cable on the stand
  const hpG = new THREE.Group(); hpG.add(headphones.root);
  hpG.position.set(0, TOP + 0.27 - 0.192, -0.18);
  hpG.rotation.y = -0.2;
  const monR = mon.scene.clone(true); // clone before dressing so both keep the named source materials
  const speakers = [-1, 1].map((s) => {
    const sp = dress(s < 0 ? mon.scene : monR, 'halrune-monitor');
    const g = new THREE.Group(); g.add(sp.root);
    g.position.set(s * SPEAKER_X, TOP, -0.25);
    g.rotation.y = -s * 0.21;
    sp.group = g;
    return sp;
  });
  const budsP = dress(bud.scene, 'halrune-buds');
  const budG = new THREE.Group(); budG.add(budsP.root);
  budG.position.set(0.24, TOP, -0.08);
  budG.rotation.y = -0.44;
  budG.scale.setScalar(1.6);
  scene.add(hpG, budG, ...speakers.map((s) => s.group));
  const groups = { 'halrune-one': hpG, 'halrune-monitor': speakers[1].group, 'halrune-buds': budG };

  // --- State, views and motion --------------------------------------------------------------------------------------
  let selected = ORDER[0], view = 'room', explodeT = 0, explodeK = 0, lidK = 0;
  let levels = { bass: 0, mid: 0, treble: 0, all: 0 }, smooth = { bass: 0, mid: 0, treble: 0, all: 0 };
  const EXPLODE = { pad: -0.075, stitch: -0.075, driver: -0.032, baffle: -0.012, magnet: 0.022, grille: 0.06 };
  // On phones the pair moves closer together so the whole set fits a tall, narrow frame.
  function layout() {
    const n = canvas.clientWidth < 700;
    speakers.forEach((sp, i) => sp.group.position.setX((i ? 1 : -1) * (n ? 0.31 : SPEAKER_X)));
    budG.position.setX(n ? 0.17 : 0.24);
  }
  const VIEWS = {
    room: [[0, 1.0, 2.35], [0, 0.72, -0.2]],
    roomNarrow: [[0, 0.88, 1.32], [0, 0.66, -0.2]],
    'halrune-one': [[0.32, 0.86, 0.75], [0, 0.66, -0.18]],
    exploded: [[0.05, 0.84, 0.62], [0, 0.66, -0.18]],
    'halrune-monitor': [[1.05, 0.9, 0.95], [0.6, 0.66, -0.25]],
    'halrune-monitorNarrow': [[0.62, 0.86, 0.72], [0.31, 0.66, -0.25]],
    'halrune-budsNarrow': [[0.3, 0.76, 0.26], [0.17, 0.55, -0.08]],
    'halrune-buds': [[0.42, 0.78, 0.28], [0.24, 0.55, -0.08]],
  };
  const narrow = () => canvas.clientWidth < 700;
  function frame() {
    layout();
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w > 900) camera.setViewOffset(w, h, -w * (view === 'room' ? 0.14 : 0.2), 0, w, h); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', frame);
  frame();

  // Pointer: drag to swing the camera a little, tap a product to choose it.
  let yaw = 0, yawT = 0, drag = null;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const pickables = [hpG, budG, ...speakers.map((s) => s.group)];
  const hit = (e) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObjects(pickables, true)[0]?.object.userData.handle || null;
  };
  const SKIP = 'input,button,a,label,select,textarea,summary,.kit-panel,.h-panel,.h-card';
  for (const el of dragSurfaces) el.addEventListener('pointerdown', (e) => { if (!e.button && !e.target.closest(SKIP)) drag = { id: e.pointerId, x: e.clientX, y: e.clientY, yaw: yawT, on: false }; });
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') document.body.classList.toggle('h-over', !e.target.closest(SKIP) && !!hit(e));
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    if (!drag.on && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(e.clientY - drag.y) * 1.2) drag.on = true;
    if (drag.on) yawT = clamp(drag.yaw + dx * 0.004, -0.5, 0.5);
  });
  window.addEventListener('pointerup', (e) => { if (drag && !drag.on && e.pointerId === drag.id) { const h = hit(e); if (h) onPick?.(h); } drag = null; });

  const cam = { pos: new THREE.Vector3(...VIEWS.room[0]), look: new THREE.Vector3(...VIEWS.room[1]) };
  const tp = new THREE.Vector3(), tl = new THREE.Vector3(), pivot = new THREE.Vector3();
  stage.onFrame((dt, now) => {
    const sm = (rate) => Math.min(1, dt * (reducedMotion ? 60 : rate));
    explodeK += (explodeT - explodeK) * sm(3);
    lidK += ((selected === 'halrune-buds' ? 1 : 0.35) - lidK) * sm(2.5);
    for (const k of Object.keys(levels)) smooth[k] = smoothLevel(smooth[k], levels[k], Math.min(dt, 0.05));
    // Exploded headphones: each part slides along its cup's axis.
    for (const [name, o] of Object.entries(headphones.nodes)) {
      const part = name.split('_')[0];
      if (!(part in EXPLODE) || !o.userData.base) continue;
      const s = name.endsWith('_l') ? -1 : 1;
      const push = part === 'driver' ? -s * smooth.bass * 0.0015 * (reducedMotion ? 0.25 : 1) : 0;
      o.position.x = o.userData.base.x + EXPLODE[part] * s * explodeK + push;
    }
    // The music moves the speakers. Woofer cones push out on the bass. Tweeter domes breathe with the treble.
    const motion = reducedMotion ? 0.25 : 1;
    for (const sp of speakers) {
      for (const n of ['woofer_cone', 'dust_cap']) { const o = sp.nodes[n]; if (o?.userData.base) o.position.z = o.userData.base.z + smooth.bass * 0.006 * motion; }
      const d = sp.nodes.tweeter_dome;
      if (d?.userData.baseScale) d.scale.z = d.userData.baseScale.z * (1 + smooth.treble * 0.4 * motion);
    }
    if (budsP.nodes.case_lid) budsP.nodes.case_lid.rotation.x = -lidK * 1.7;
    strip.material.color.setRGB(1, 0.48, 0.2).multiplyScalar(0.25 + smooth.all * 3.2);
    glow.material.opacity = 0.35 + smooth.mid * 0.9;
    lamp.intensity = 1.8 + smooth.bass * 3 * motion;
    // Camera: lerp to the view, swung a little by dragging.
    yaw += (yawT - yaw) * sm(4);
    const key2 = view === 'room' ? 'room' : view === 'exploded' ? 'exploded' : selected;
    const [p, l] = VIEWS[narrow() && VIEWS[key2 + 'Narrow'] ? key2 + 'Narrow' : key2];
    tl.set(...l); tp.set(...p);
    if (narrow() && key2 !== 'room') tp.sub(tl).multiplyScalar(1.1).add(tl);
    pivot.copy(tl);
    tp.sub(pivot).applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw + (reducedMotion ? 0 : Math.sin(now * 0.15) * 0.03)).add(pivot);
    cam.pos.lerp(tp, sm(2.2));
    cam.look.lerp(tl, sm(2.2));
    camera.position.copy(cam.pos);
    camera.lookAt(cam.look);
  });

  for (const h of ORDER) setFinish(h === 'halrune-monitor' ? speakers[0] : h === 'halrune-one' ? headphones : budsP, PRODUCTS[h].values[0]);
  setFinish(speakers[1], PRODUCTS['halrune-monitor'].values[0]);
  try { await renderer.compileAsync(scene, camera); } catch { renderer.compile(scene, camera); }
  stage.start();
  onReady?.();
  return {
    select(h) { if (PRODUCTS[h]) { selected = h; if (h !== 'halrune-one') explodeT = 0; } },
    setView(v) { view = v; frame(); },
    setFinish(h, value) {
      if (h === 'halrune-monitor') speakers.forEach((s) => setFinish(s, value));
      else setFinish(h === 'halrune-one' ? headphones : budsP, value);
    },
    explode(on) { explodeT = on ? 1 : 0; view = on ? 'exploded' : view === 'exploded' ? 'product' : view; frame(); },
    setLevels(l) { levels = l; },
    setActive(on) { active = on; },
    groups,
  };
}
