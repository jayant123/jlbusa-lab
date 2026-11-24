// VANTRIK 3D: one shoe on a concrete plinth in a pale studio. It turns slowly and follows a drag through a full
// circle. Part colors ease to the chosen colorway. "Take it apart" lifts the layers apart: outsole, midsole,
// insole and upper.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createStage } from '../kit/stage.js';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
// Which color drives each mesh, and how far each one lifts when the shoe is taken apart (meters).
// Colors follow the material: the overlay panels and the tongue take the upper's color, the thread takes the laces'.
const DRIVE = { upper: 'upper', tongue: 'upper', overlay: 'upper', trim: 'trim', midsole: 'midsole', outsole: 'outsole', laces: 'laces', stitch: 'laces' };
const SHADE = { overlay: 0.8, stitch: 0.92 }; // the runner's mudguard reads a shade deeper than its knit
// Lift follows the part: the sole layers drop, the insole and the whole upper rise.
const LIFT = { outsole: -0.05, midsole: -0.02, sole_stitch: -0.02, insole: 0.035 };
const UPPER_LIFT = 0.085;
const PARTS = ['outsole', 'midsole', 'sole_stitch', 'insole', 'upper', 'overlay', 'trim', 'tongue', 'label', 'laces', 'eyelets', 'stitch', 'perf'];
const partOf = (o) => { for (let n = o; n; n = n.parent) { const k = PARTS.find((p) => n.name === p || n.name.startsWith(`${p}_`) || n.name.startsWith(`${p}.`)); if (k) return k; } return null; };
const VIEW = {
  hero: [[0.08, 0.2, 0.74], [0, 0.05, 0]],
  pdp: [[0.1, 0.19, 0.72], [0, 0.045, 0]],
  custom: [[-0.22, 0.25, 0.66], [0, 0.07, 0]],
};

function blob() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(20,20,18,0.55)'); g.addColorStop(0.55, 'rgba(20,20,18,0.18)'); g.addColorStop(1, 'rgba(20,20,18,0)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

export async function createVantrikScene(canvas, { tier, reducedMotion, onReady, onFallback, dragSurfaces = [], still = false }) {
  let active = true;
  const stage = createStage(canvas, { tier, fov: 30, minDpr: 1, shouldRender: () => active, createRenderer: (c) => {
    const r = new THREE.WebGLRenderer({ canvas: c, antialias: true, powerPreference: 'high-performance' });
    r.toneMapping = THREE.AgXToneMapping;
    r.toneMappingExposure = 1.05;
    r.outputColorSpace = THREE.SRGBColorSpace;
    return r;
  } });
  stage.on('fallback', onFallback);
  if (!stage.ok) return null;
  const { scene, camera, renderer } = stage;
  const bg = new THREE.Color(0xdedfda);
  scene.background = bg;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.85;
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(-0.4, 0.8, 0.5);
  scene.add(key, new THREE.HemisphereLight(0xffffff, 0x9a9890, 0.5));

  // Plinth: a low concrete disc with a soft shadow on top.
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.225, 0.04, 96), new THREE.MeshStandardMaterial({ color: 0xc9c9c3, roughness: 0.92 }));
  plinth.position.y = -0.02;
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.2), new THREE.MeshBasicMaterial({ map: blob(), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.0006;
  const floor = new THREE.Mesh(new THREE.CircleGeometry(3, 64), new THREE.MeshStandardMaterial({ color: 0xd4d5cf, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.04;
  scene.add(plinth, shadow, floor);

  // Shoes: load both, keep one visible.
  const lod = tier === 'low' ? 'low' : 'high';
  const [runG, courtG] = await Promise.all([stage.load(`/vantrik/runner-${lod}.glb`), stage.load(`/vantrik/court-${lod}.glb`)]);
  const rich = tier !== 'low';
  const knitUpper = (gltf) => { let k = false; gltf.scene.traverse((o) => { if (o.isMesh && o.material.name === 'upper' && o.material.roughness > 0.7) k = true; }); return k; };
  function prep(gltf) {
    const isKnit = knitUpper(gltf);
    const root = new THREE.Group();
    const spin = new THREE.Group();
    const box = new THREE.Box3().setFromObject(gltf.scene);
    gltf.scene.position.x = -(box.min.x + box.max.x) / 2;
    gltf.scene.position.z = -(box.min.z + box.max.z) / 2;
    spin.add(gltf.scene);
    root.add(spin);
    const parts = [];
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      const name = partOf(o);
      const src = o.material;
      const m = rich ? new THREE.MeshPhysicalMaterial() : new THREE.MeshStandardMaterial();
      m.name = src.name;
      m.color.copy(src.color);
      m.roughness = src.roughness;
      m.metalness = src.metalness;
      if (src.normalMap) { m.normalMap = src.normalMap; m.normalScale.set(0.9, 0.9); }
      const knit = src.normalMap && src.roughness > 0.7;
      if (rich && knit && ['upper', 'tongue'].includes(src.name)) { m.sheen = 0.55; m.sheenRoughness = 0.5; m.sheenColor.set(0xffffff); }
      if (rich && !knit && ['upper', 'overlay', 'trim'].includes(src.name)) { m.clearcoat = 0.25; m.clearcoatRoughness = 0.45; }
      o.material = m;
      const shade = src.name === 'overlay' && isKnit ? SHADE.overlay : src.name === 'stitch' ? SHADE.stitch : 1;
      parts.push({ mesh: o, part: name, drive: DRIVE[src.name] ?? null, shade, lift: LIFT[name] ?? UPPER_LIFT, base: o.position.y, target: m.color.clone() });
    });
    return { root, spin, parts };
  }
  const shoes = { runner: prep(runG), court: prep(courtG) };
  scene.add(shoes.runner.root, shoes.court.root);
  shoes.court.root.visible = false;

  let kind = 'runner', view = 'hero', yaw = -0.5, yawVel = 0, drag = null, explode = 0, explodeT = 0, fade = 1;
  const camPos = new THREE.Vector3(...VIEW.hero[0]), camLook = new THREE.Vector3(...VIEW.hero[1]);

  function setShoe(k, colors) {
    if (k !== kind) { kind = k; fade = 0; }
    for (const [name, s] of Object.entries(shoes)) {
      s.root.visible = name === kind;
      for (const p of s.parts) if (p.drive && colors[p.drive]) p.target.set(colors[p.drive]).multiplyScalar(p.shade);
    }
  }

  // Wide screens put the shoe right of the panel. Phones put it above the panel.
  function frame() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w > 900) camera.setViewOffset(w, h, view === 'hero' ? 0 : -w * 0.22, 0, w, h);
    else camera.setViewOffset(w, h, 0, view === 'hero' ? 0 : h * 0.22, w, h);
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', frame);
  frame();
  const dist = () => (canvas.clientWidth < 600 ? 2.05 : canvas.clientWidth < 900 ? 1.4 : 1);

  // Drag anywhere in a 3D section to turn the shoe through a full circle.
  const SKIP = 'input,button,a,label,select,textarea,summary,.kit-panel,.v-panel';
  for (const el of dragSurfaces) {
    el.addEventListener('pointerdown', (e) => { if (!e.button && !e.target.closest(SKIP)) drag = { id: e.pointerId, x: e.clientX, y: e.clientY, yaw, on: false, lx: e.clientX }; });
  }
  window.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    if (!drag.on && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(e.clientY - drag.y) * 1.2) drag.on = true;
    if (!drag.on) return;
    yaw = drag.yaw + dx * 0.011;
    yawVel = (e.clientX - drag.lx) * 0.011;
    drag.lx = e.clientX;
  });
  window.addEventListener('pointerup', () => { drag = null; });

  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  stage.onFrame((dt) => {
    const sm = (rate) => Math.min(1, dt * (reducedMotion ? 60 : rate));
    if (!drag) {
      yaw += yawVel;
      yawVel *= 0.94;
      if (!reducedMotion && !still && Math.abs(yawVel) < 0.0004) yaw += dt * 0.18;
    }
    explode += ((view === 'custom' ? explodeT : 0) - explode) * sm(4); // apart only in the designer
    fade = Math.min(1, fade + dt * 3);
    const s = shoes[kind];
    s.spin.rotation.y = yaw;
    s.root.scale.setScalar(0.92 + 0.08 * ease(fade));
    s.root.position.y = 0.06 * ease(clamp(explode));
    const ex = ease(clamp(explode));
    for (const p of s.parts) {
      p.mesh.material.color.lerp(p.target, sm(6));
      p.mesh.position.y = p.base + p.lift * ex;
    }
    shadow.material.opacity = 1 - ex * 0.6;
    const [pp, gg] = VIEW[view] || VIEW.pdp;
    tmp.set(...pp).sub(tmp2.set(...gg)).multiplyScalar(dist() * (1 + ex * 0.25)).add(tmp2);
    tmp2.y += ex * 0.02;
    camPos.lerp(tmp, sm(2.5));
    camLook.lerp(tmp2, sm(2.5));
    camera.position.copy(camPos);
    camera.lookAt(camLook);
  });

  try { await renderer.compileAsync(scene, camera); } catch { renderer.compile(scene, camera); }
  stage.start();
  onReady?.();
  return {
    setShoe,
    setView(v) { view = v; frame(); },
    setExploded(on) { explodeT = on ? 1 : 0; },
    setActive(on) { active = on; },
    setYaw(y) { yaw = y; },
  };
}
