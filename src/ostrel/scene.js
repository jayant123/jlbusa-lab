// OSTREL 3D scene: loads the watch for the device tier, applies finishes per selection, runs the movement,
// and positions parts and camera from the explosion progress t.
import * as THREE from 'three';
import { createStage } from '../kit/stage.js';
import { partOffsets, PARTS } from './explode.js';

const P = (o) => new THREE.MeshPhysicalMaterial(o);
const FINISH = {
  dial: {
    Obsidian: () => P({ color: 0x0c0d10, metalness: 0.4, roughness: 0.3, clearcoat: 0.35, clearcoatRoughness: 0.15 }),
    Champagne: () => P({ color: 0xc4a372, metalness: 0.85, roughness: 0.3, clearcoat: 0.5 }),
    Glacier: () => P({ color: 0xc3d1da, metalness: 0.55, roughness: 0.32, clearcoat: 0.6 }),
  },
  case: {
    'Brushed platinum': () => P({ color: 0xd8d9dc, metalness: 1, roughness: 0.42 }),
    'Polished steel': () => P({ color: 0xeceef1, metalness: 1, roughness: 0.16 }),
    'Black ceramic': () => P({ color: 0x141518, metalness: 0, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 }),
  },
  strap: {
    'Black calf': () => P({ color: 0x121212, roughness: 0.62 }),
    'Cognac calf': () => P({ color: 0x4f2510, roughness: 0.62 }),
  },
};

// Camera keyframes [t, position, target] in meters; the watch axis is +Y.
const VIEWS = [
  [0, [0.022, 0.100, 0.088], [0.0, 0.001, -0.003]],
  [0.55, [0.105, 0.070, 0.112], [0.0, 0.012, 0.0]],
  [1, [0.095, 0.055, 0.070], [-0.002, 0.010, -0.002]],
];
const MACRO = [[0.03, 0.07, 0.06], [-0.003, 0.006, 0.0]];
const CONFIG = [[0.012, 0.115, 0.050], [0.0, 0.0, -0.006]];
const lerp = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);

function viewAt(t) {
  for (let i = 0; i < VIEWS.length - 1; i++) {
    const [t0, p0, g0] = VIEWS[i], [t1, p1, g1] = VIEWS[i + 1];
    if (t <= t1) {
      const k = (t - t0) / (t1 - t0);
      const e = k * k * (3 - 2 * k);
      return [lerp(p0, p1, e), lerp(g0, g1, e)];
    }
  }
  return [VIEWS.at(-1)[1], VIEWS.at(-1)[2]];
}

// Dark studio for reflections: black room, one large overhead softbox, a cool strip and a warm strip.
function studio() {
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshBasicMaterial({ color: 0x050506, side: THREE.BackSide })));
  const panel = (w, h, color, k, pos, look) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(...look);
    env.add(m);
  };
  panel(4, 2.2, 0xffffff, 3.2, [0, 4.5, 0.6], [0, 0, 0]);
  panel(0.5, 6, 0xdfe8ff, 6, [4.6, 1.2, -0.8], [0, 0, 0]);
  panel(0.45, 5, 0xffd9a8, 5, [-4.6, 0.8, 1.4], [0, 0, 0]);
  panel(6, 0.25, 0xffffff, 2, [0, 1.6, -4.8], [0, 0, 0]);
  panel(3.5, 1.6, 0xf4f1ea, 1.4, [2.2, 2.2, 3.6], [0, 0, 0]);
  return env;
}

export async function createOstrelScene(canvas, { tier, onReady, onFallback, reducedMotion }) {
  const stage = createStage(canvas, { tier, fov: 28, createRenderer: (c, tr) => {
    const r = new THREE.WebGLRenderer({ canvas: c, antialias: tr !== 'low', alpha: true, powerPreference: 'high-performance' });
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.setClearColor(0x000000, 0);
    return r;
  } });
  stage.on('fallback', onFallback);
  if (!stage.ok) return null;
  const { scene, camera, renderer } = stage;

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(studio(), 0.02).texture;
  scene.environmentIntensity = 1.35;
  const key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(0.3, 0.5, 0.2);
  const rim = new THREE.DirectionalLight(0xffd6a0, 1.4);
  rim.position.set(-0.4, 0.2, -0.3);
  scene.add(key, rim);

  const gltf = await stage.load(`/ostrel/watch-${tier === 'low' ? 'low' : tier === 'mid' ? 'mid' : 'high'}.glb`);
  const root = gltf.scene;
  scene.add(root);
  const nodes = Object.fromEntries(PARTS.map((k) => [k, root.getObjectByName(k)]).filter(([, v]) => v));
  const base = Object.fromEntries(Object.entries(nodes).map(([k, n]) => [k, { y: n.position.y, ry: n.rotation.y }]));
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (o.material.name === 'glass_crystal') {
      // Reflection-only glass: transparent body, environment highlights on top (no transmission pass).
      o.material = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.05, roughness: 0.02, metalness: 0,
        clearcoat: 1, clearcoatRoughness: 0.02, depthWrite: false });
      o.renderOrder = 2;
    }
  });
  const slots = (name) => { const out = []; root.traverse((o) => { if (o.isMesh && o.material.name === name) out.push(o); }); return out; };
  const dialMeshes = slots('dial_finish'), caseMeshes = [...slots('case_finish')], bezelMeshes = slots('bezel_finish'), strapMeshes = slots('strap_finish');
  const cache = {};
  const mat = (group, value) => (cache[group + value] ||= FINISH[group][value]());

  let t = 0, tTarget = 0, macro = false, configView = false;
  const setT = (v) => { tTarget = Math.min(1, Math.max(0, v)); };

  function apply(sel) {
    dialMeshes.forEach((m) => { m.material = mat('dial', sel.Dial); });
    caseMeshes.forEach((m) => { m.material = mat('case', sel.Case); });
    const polished = sel.Case === 'Black ceramic' ? mat('case', 'Black ceramic') : mat('case', 'Polished steel');
    bezelMeshes.forEach((m) => { m.material = polished; });
    const bracelet = sel.Strap === 'Steel bracelet';
    ['strap_top', 'strap_bottom'].forEach((k) => { if (nodes[k]) nodes[k].visible = !bracelet; });
    ['bracelet_top', 'bracelet_bottom'].forEach((k) => { if (nodes[k]) nodes[k].visible = bracelet; });
    if (!bracelet) strapMeshes.forEach((m) => { m.material = mat('strap', sel.Strap); });
  }

  // Composition: on wide screens the watch sits right of the copy.
  let dist = 1;
  function frame() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w > 900) { camera.setViewOffset(w, h, -w * 0.2, 0, w, h); dist = 1; }
    else { camera.setViewOffset(w, h, 0, h * 0.2, w, h); dist = w < 600 ? 1.45 : 1.2; }
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', frame);
  frame();

  let yaw = 0;
  stage.onFrame((dt, now) => {
    t += (tTarget - t) * Math.min(1, dt * (reducedMotion ? 30 : 6));
    const off = partOffsets(t);
    for (const [k, n] of Object.entries(nodes)) {
      n.position.y = base[k].y + off[k].z;
      if (off[k].rot) n.rotation.y = base[k].ry + off[k].rot;
    }
    const d = new Date();
    const s = d.getSeconds() + d.getMilliseconds() / 1000;
    const m = d.getMinutes() + s / 60;
    const hr = (d.getHours() % 12) + m / 60;
    if (nodes.hands_second) nodes.hands_second.rotation.y = -(Math.floor(s * 8) / 8) * (Math.PI / 30);
    if (nodes.hands_minute) nodes.hands_minute.rotation.y = -m * (Math.PI / 30);
    if (nodes.hands_hour) nodes.hands_hour.rotation.y = -hr * (Math.PI / 6);
    if (nodes.balance_wheel) nodes.balance_wheel.rotation.y = Math.sin(now * Math.PI * 8) * 1.4;
    if (nodes.escape_wheel) nodes.escape_wheel.rotation.y = -(Math.floor(now * 8)) * (Math.PI / 15) * 0.5;
    if (nodes.gear_train) nodes.gear_train.rotation.y = -now * 0.05;
    let [p, g] = viewAt(t);
    if (macro) [p, g] = MACRO;
    if (configView) [p, g] = CONFIG;
    const tgtV = new THREE.Vector3(...g);
    const posV = new THREE.Vector3(...p).sub(tgtV).multiplyScalar(dist).add(tgtV).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    camera.position.lerp(posV, 0.08);
    camera.lookAt(...g);
  });

  // Touch/mouse rotate only while inspecting.
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => { if (macro) drag = { x: e.clientX, yaw }; });
  window.addEventListener('pointermove', (e) => { if (drag) yaw = drag.yaw + (e.clientX - drag.x) * 0.008; });
  window.addEventListener('pointerup', () => { drag = null; });

  const [p0, g0] = viewAt(0);
  camera.position.set(...p0);
  camera.lookAt(...g0);
  stage.start();
  renderer.compile(scene, camera);
  onReady?.();
  return {
    apply,
    setT,
    setConfigView(on) { configView = on; if (on) tTarget = 0; },
    setMacro(on) { macro = on; canvas.style.pointerEvents = on ? 'auto' : 'none'; if (!on) yaw = 0; },
  };
}
