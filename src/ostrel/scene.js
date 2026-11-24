// OSTREL 3D scene: loads the watch for the device tier and applies finishes per selection. It runs the movement in
// real time. Scroll state drives the explosion (t), the night mode (lume) and the flip to the caseback. The
// configurator can point the camera at the part being changed. Visitors can drag to turn the watch.
import * as THREE from 'three';
import { createStage } from '../kit/stage.js';
import { partOffsets, PARTS } from './explode.js';
import { planarUV, buildMaps } from './finish-maps.js';

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
const LUME = new THREE.Color(0x8dffa6);

// Camera keyframes [t, position, target] in meters. The watch axis is +Y.
const VIEWS = [
  [0, [0.022, 0.100, 0.088], [0.0, 0.001, -0.003]],
  [0.55, [0.105, 0.070, 0.112], [0.0, 0.012, 0.0]],
  [1, [0.095, 0.055, 0.070], [-0.002, 0.010, -0.002]],
];
const MACRO = [[0.03, 0.07, 0.06], [-0.003, 0.006, 0.0]];
const CONFIG = [[0.012, 0.115, 0.050], [0.0, 0.0, -0.006]];
const NIGHT = [[0.010, 0.088, 0.052], [0.0, 0.003, -0.002]];
const FOCUS = {
  Dial: [[0.004, 0.074, 0.036], [0.0, 0.006, -0.002]],
  Case: [[0.080, 0.030, 0.050], [0.0, 0.004, 0.0]],
  Strap: [[0.050, 0.090, 0.125], [0.0, 0.0, 0.018]],
  Engraving: [[0.010, 0.105, 0.046], [0.0, 0.0, -0.004]],
  // Close views used for detail review (?debug). Not reachable from the page UI.
  Hands: [[0.002, 0.040, 0.016], [0.0, 0.007, 0.0]],
  Crown: [[0.050, 0.020, 0.016], [0.018, 0.005, 0.0]],
  Lugs: [[0.030, 0.030, 0.050], [0.010, 0.004, 0.018]],
};
// Phones: how big the subject is in each view (meters). The camera backs off until it fits the free area.
const SUBJECT = { Dial: 0.024, Case: 0.03, Strap: 0.05, Engraving: 0.03, config: 0.03, night: 0.028 };
const FILL = 0.86, TAN = Math.tan((28 / 2) * Math.PI / 180);
// Label anchors: height above the part origin and radius from the axis, in meters.
const ANCHOR = {
  crystal: [0.0122, 0.010], bezel: [0.0108, 0.0195], hands_minute: [0.0074, 0.008], dial: [0.0063, 0.0166],
  balance_wheel: [0.0042, 0.003], movement_plate: [0.0030, 0.0160], case: [0.0050, 0.0200],
};
const lerp = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

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

// Text set on a circle around angle a (radians, canvas space). Top arcs read clockwise and bottom arcs read counter.
function arcText(ctx, text, cx, cy, r, a, bottom) {
  const spacing = 0.14 * parseFloat(ctx.font.match(/(\d+)px/)[1]);
  const chars = [...text];
  const widths = chars.map((ch) => ctx.measureText(ch).width + spacing);
  const total = widths.reduce((s, w) => s + w, 0) - spacing;
  const dir = bottom ? -1 : 1;
  let ang = a - dir * total / (2 * r);
  chars.forEach((ch, i) => {
    const mid = ang + dir * (widths[i] - spacing) / (2 * r);
    ctx.save();
    ctx.translate(cx + r * Math.cos(mid), cy + r * Math.sin(mid));
    ctx.rotate(mid + dir * Math.PI / 2);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    ang += dir * widths[i] / r;
  });
}

const RING_IN = 0.0124, RING_OUT = 0.0183;
function drawCaseback(canvas, personal) {
  const ctx = canvas.getContext('2d');
  const S = canvas.width, c = S / 2, k = c / RING_OUT;
  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '500 50px "IBM Plex Mono", ui-monospace, monospace';
  const r = ((RING_IN + RING_OUT) / 2) * k;
  arcText(ctx, 'OSTREL · MERIDIAN 40 · Nº 0417', c, c, r, -Math.PI / 2, false);
  arcText(ctx, personal || 'SAPPHIRE · 100 M · AUTOMATIC', c, c, r, Math.PI / 2, true);
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#fff';
  for (const rr of [RING_IN + 0.0006, RING_OUT - 0.0007]) { ctx.beginPath(); ctx.arc(c, c, rr * k, 0, Math.PI * 2); ctx.stroke(); }
  ctx.globalAlpha = 1;
}

// Gold rotor under the movement, seen through the sapphire caseback.
function rotor() {
  const s = new THREE.Shape();
  s.absarc(0, 0, 0.0152, Math.PI * 0.02, Math.PI * 0.98, false);
  s.absarc(0, 0, 0.0034, Math.PI * 0.98, Math.PI * 0.02, true);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.00028, bevelEnabled: true, bevelThickness: 0.00004, bevelSize: 0.00004, bevelSegments: 1, curveSegments: 48 });
  g.rotateX(Math.PI / 2);
  planarUV(g);
  const armMat = P({ color: 0xd9b67a, metalness: 1, roughness: 0.26, clearcoat: 0.4 });
  const arm = new THREE.Mesh(g, armMat);
  arm.userData.cotes = true;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.0034, 0.0034, 0.00045, 40), P({ color: 0xe6c68e, metalness: 1, roughness: 0.34 }));
  const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.0011, 0.0011, 0.0006, 24), P({ color: 0x23356e, metalness: 1, roughness: 0.25 }));
  screw.position.y = -0.0002;
  hub.position.y = -0.0001;
  const grp = new THREE.Group();
  grp.add(arm, hub, screw);
  grp.position.y = 0.00165;
  return grp;
}

export async function createOstrelScene(canvas, { tier, onReady, onFallback, reducedMotion, intro = false, dragSurfaces = [] }) {
  // The hands and indices are fractions of a millimeter wide. At low resolution their
  // edges step visibly, so this scene renders up to 2x, never drops below 1x and multisamples on every tier.
  // Draw only when something on screen changes. At rest that is the seconds hand, eight steps a second.
  let dirty = true, active = true;
  const stage = createStage(canvas, { tier, fov: 28, maxDpr: tier === 'low' ? 1.5 : 2, minDpr: 1, quickStart: true, shouldRender: () => { if (!active) return false; const d = dirty; dirty = false; return d; }, createRenderer: (c) => {
    const r = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true, powerPreference: 'high-performance' });
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = intro ? 0 : 1.05;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.setClearColor(0x000000, 0);
    return r;
  } });
  stage.on('fallback', onFallback);
  if (!stage.ok) return null;
  const { scene, camera, renderer } = stage;

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(studio(), 0.02).texture;
  const ENV = 1.35;
  scene.environmentIntensity = ENV;
  const key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(0.3, 0.5, 0.2);
  const rim = new THREE.DirectionalLight(0xffd6a0, 1.4);
  rim.position.set(-0.4, 0.2, -0.3);
  scene.add(key, rim);

  const gltf = await stage.load(`/ostrel/watch-${tier === 'low' ? 'low' : tier === 'mid' ? 'mid' : 'high'}.glb`);
  const root = gltf.scene;
  // spin (drag and tilt) holds flip (caseback) which holds the watch. The flip pivots around the middle of the case.
  const spin = new THREE.Group(), flip = new THREE.Group();
  flip.position.y = 0.0055;
  root.position.y = -0.0055;
  flip.add(root);
  spin.add(flip);
  scene.add(spin);
  const nodes = Object.fromEntries(PARTS.map((k) => [k, root.getObjectByName(k)]).filter(([, v]) => v));
  const base = Object.fromEntries(Object.entries(nodes).map(([k, n]) => [k, { y: n.position.y, ry: n.rotation.y }]));
  // Parts are stored quantized (each node has its own scale and offset). Measure each part's axis in watch meters,
  // and give runtime additions a holder that works in watch meters while still moving with the part.
  root.updateMatrixWorld(true);
  const axis = {};
  for (const [k, n] of Object.entries(nodes)) {
    const c = new THREE.Box3().setFromObject(n).getCenter(new THREE.Vector3());
    axis[k] = [c.x, c.z];
  }
  const holder = (n) => {
    const g = new THREE.Group();
    g.scale.setScalar(1 / n.scale.x);
    g.position.copy(n.position).multiplyScalar(-1 / n.scale.x);
    n.add(g);
    return g;
  };
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (o.material.name === 'glass_crystal') {
      // Reflection-only glass: transparent body with environment highlights on top (no transmission pass).
      o.material = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.05, roughness: 0.02, metalness: 0,
        clearcoat: 1, clearcoatRoughness: 0.02, depthWrite: false });
      o.renderOrder = 2;
    }
  });
  const slots = (name) => { const out = []; root.traverse((o) => { if (o.isMesh && o.material.name === name) out.push(o); }); return out; };
  const dialMeshes = slots('dial_finish'), caseMeshes = [...slots('case_finish')], bezelMeshes = slots('bezel_finish'), strapMeshes = slots('strap_finish');
  const lumeMats = [...new Set(slots('lume').map((o) => o.material))];
  lumeMats.forEach((m) => { m.emissive = LUME.clone(); m.emissiveIntensity = 0; });
  // Finishes: sunburst dial, leather grain, perlage on the plate, Côtes de Genève on the bridges and rotor.
  let maps = null;
  const decorate = (group, m) => {
    if (!maps) return m;
    if (group === 'dial') { m.anisotropy = 0.85; m.anisotropyMap = maps.sun; m.roughness = Math.max(0.22, m.roughness); }
    if (group === 'strap') { m.normalMap = maps.grain.clone(); m.normalMap.repeat.set(16, 16); m.normalScale.set(0.32, 0.32); }
    return m;
  };
  const cache = {};
  const mat = (group, value) => (cache[group + value] ||= decorate(group, FINISH[group][value]()));

  // The finishes arrive from a worker after the first frames. They are compiled off screen, then swapped in.
  async function upgrade() {
    const m = await buildMaps(tier);
    if (!m) return;
    const swaps = [];
    const normal = (mesh, tex, repeat, scale) => {
      const mm = mesh.material.clone();
      mm.normalMap = tex.clone();
      mm.normalMap.repeat.set(repeat, repeat);
      mm.normalScale.set(scale, scale);
      swaps.push([mesh, mm]);
    };
    [...dialMeshes, ...strapMeshes, ...slots('movement_rhodium'), ...slots('bridge_rhodium')].forEach((o) => planarUV(o.geometry));
    slots('movement_rhodium').forEach((o) => normal(o, m.perl, 3.2, 0.5));
    slots('bridge_rhodium').forEach((o) => normal(o, m.cotes, 1.6, 0.7));
    rot.traverse((o) => { if (o.isMesh && o.userData.cotes) normal(o, m.cotes, 1.4, 0.8); });
    maps = m;
    for (const [k, v] of Object.entries(cache)) decorate(k.startsWith('dial') ? 'dial' : k.startsWith('strap') ? 'strap' : 'case', v);
    const warm = new THREE.Scene();
    warm.environment = scene.environment;
    warm.add(...swaps.map(([mesh, mm]) => new THREE.Mesh(mesh.geometry, mm)), ...Object.values(cache).map((mm) => new THREE.Mesh(dialMeshes[0]?.geometry || new THREE.BufferGeometry(), mm)));
    Object.values(cache).forEach((mm) => { mm.needsUpdate = true; });
    try { await renderer.compileAsync(warm, camera); } catch { /* compiled on first draw instead */ }
    swaps.forEach(([mesh, mm]) => { mesh.material = mm; });
    dirty = true;
  }

  // Engraved caseback ring and the rotor behind the sapphire window.
  const engCanvas = document.createElement('canvas');
  engCanvas.width = engCanvas.height = 1024;
  const engTex = new THREE.CanvasTexture(engCanvas);
  engTex.colorSpace = THREE.SRGBColorSpace;
  engTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const engMat = new THREE.MeshPhysicalMaterial({ map: engTex, transparent: true, color: 0x5a5c60, metalness: 0.6, roughness: 0.7,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const ringGeo = new THREE.RingGeometry(RING_IN, RING_OUT, 128);
  ringGeo.rotateX(Math.PI / 2);
  const ring = new THREE.Mesh(ringGeo, engMat);
  ring.position.y = -0.00002;
  if (nodes.case) holder(nodes.case).add(ring);
  let personal = '';
  const redraw = () => { drawCaseback(engCanvas, personal); engTex.needsUpdate = true; };
  if (document.fonts?.status === 'loaded') redraw(); else { redraw(); document.fonts?.ready.then(redraw); }
  const rot = rotor();
  if (nodes.movement_plate) holder(nodes.movement_plate).add(rot);

  let t = 0, tTarget = 0, macro = false, configView = false, focusKey = null;
  let night = 0, nightT = 0, flipV = 0, flipT = 0;
  const setT = (v) => { tTarget = clamp(v); };

  function apply(sel) {
    dialMeshes.forEach((m) => { m.material = mat('dial', sel.Dial); });
    caseMeshes.forEach((m) => { m.material = mat('case', sel.Case); });
    const polished = sel.Case === 'Black ceramic' ? mat('case', 'Black ceramic') : mat('case', 'Polished steel');
    bezelMeshes.forEach((m) => { m.material = polished; });
    engMat.color.set(sel.Case === 'Black ceramic' ? 0x8a8c90 : 0x5a5c60);
    const bracelet = sel.Strap === 'Steel bracelet';
    ['strap_top', 'strap_bottom'].forEach((k) => { if (nodes[k]) nodes[k].visible = !bracelet; });
    ['bracelet_top', 'bracelet_bottom'].forEach((k) => { if (nodes[k]) nodes[k].visible = bracelet; });
    if (!bracelet) strapMeshes.forEach((m) => { m.material = mat('strap', sel.Strap); });
  }

  // Composition: on wide screens the watch sits right of the copy.
  // On phones the page reports the free band of screen (not covered by the header, a card, the option panel or the
  // purchase bar). The watch is centered in that band and the camera backs off until the subject fits it.
  let dist = 1, narrow = false, free = null, offY = 0;
  function frame() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    narrow = w <= 900;
    if (!narrow) { camera.setViewOffset(w, h, -w * 0.2, 0, w, h); dist = 1; camera.updateProjectionMatrix(); return; }
    if (!free) free = { top: h * 0.1, bottom: h * 0.55 };
    camera.setViewOffset(w, h, 0, offY, w, h);
    camera.updateProjectionMatrix();
  }
  function fitTargets(len) {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const band = Math.max(80, free.bottom - free.top);
    let R = configView ? (SUBJECT[focusKey] || SUBJECT.config) : 0.028 + 0.014 * ease(clamp(t));
    if (!configView && night > 0.01) R += (SUBJECT.night - R) * ease(night);
    R += 0.008 * ease(flipV); // turned over, the lugs and strap swing wide
    const D = R / (FILL * TAN * Math.min(band, w) / h);
    return { dist: D / Math.max(1e-4, len), off: h / 2 - (free.top + free.bottom) / 2 };
  }
  window.addEventListener('resize', () => { frame(); dirty = true; });
  frame();

  // Pointer: the watch leans toward a mouse cursor in the opening view. Dragging sideways turns it.
  const fine = matchMedia('(pointer: fine)').matches && !reducedMotion;
  let ptr = [0, 0], tilt = [0, 0], tiltGain = 0, yaw = 0, yawVel = 0, drag = null;
  if (fine) window.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') ptr = [e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1]; });
  const SKIP = 'input,button,a,label,select,textarea,.o-choice,.kit-panel';
  for (const el of dragSurfaces) {
    el.addEventListener('pointerdown', (e) => {
      if (e.button || e.target.closest(SKIP)) return;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, yaw, on: false, lx: e.clientX, lt: performance.now() };
    });
  }
  window.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.on && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.2) { drag.on = true; document.body.classList.add('is-turning'); }
    if (!drag.on) return;
    const now = performance.now();
    yaw = drag.yaw + dx * 0.0105;
    yawVel = ((e.clientX - drag.lx) * 0.0105) / Math.max(8, now - drag.lt) * 16.7;
    drag.lx = e.clientX;
    drag.lt = now;
  });
  const endDrag = () => { if (drag?.on) document.body.classList.remove('is-turning'); drag = null; };
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);

  // Opening sequence: exposure rises from black while a light sweeps across the bezel and the camera glides in.
  let introAt = intro ? -1 : null, introDone = null;
  const introK = (now) => (introAt === null ? 1 : introAt < 0 ? 0 : clamp((now - introAt) / 2.8));

  let rotorA = 0, lastSig = [];
  const tmp = new THREE.Vector3(), camRight = new THREE.Vector3();
  stage.onFrame((dt, now) => {
    const sm = (rate) => Math.min(1, dt * (reducedMotion ? 30 : rate));
    t += (tTarget - t) * sm(6);
    night += (nightT - night) * sm(3.5);
    const wantFlip = configView && focusKey === 'Engraving' ? 1 : flipT;
    flipV += (wantFlip - flipV) * sm(4);

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

    // Turning: inertia after a drag. The watch drifts home once its section is gone.
    if (!drag) {
      yaw += yawVel;
      yawVel *= 0.92;
      if (t > 0.04 && !configView && flipV < 0.5 && night < 0.5) yaw *= 1 - sm(2.5);
    }
    rotorA += yawVel * 4 + Math.sin(now * 0.9) * 0.004 * flipV;
    rot.rotation.y = rotorA;
    const inHero = t < 0.04 && !configView && flipV < 0.05 && night < 0.05;
    tiltGain += ((fine && inHero ? 1 : 0) - tiltGain) * sm(3);
    tilt = lerp(tilt, ptr, sm(4));
    spin.rotation.y = yaw + tilt[0] * 0.32 * tiltGain;
    flip.rotation.x = -Math.PI * ease(flipV) + tilt[1] * 0.1 * tiltGain;

    // Light follows the cursor in the opening view and goes down for the night chapter.
    const ik = introK(now);
    const day = 1 - night * 0.94;
    key.position.set(0.3 + tilt[0] * 0.45 * tiltGain - (1 - ease(ik)) * 0.9, 0.5, 0.2 + tilt[1] * 0.3 * tiltGain);
    key.intensity = 1.2 * day;
    rim.intensity = 1.4 * (1 - night * 0.85);
    scene.environmentIntensity = ENV * day;
    lumeMats.forEach((mm) => { mm.emissiveIntensity = night * 2.6; });
    renderer.toneMappingExposure = 1.05 * ease(ik);
    if (introAt !== null && introAt >= 0 && ik >= 1) { introAt = null; introDone?.(); }

    let [p, g] = viewAt(t);
    if (night > 0.001) [p, g] = [lerp(p, NIGHT[0], ease(night)), lerp(g, NIGHT[1], ease(night))];
    if (macro) [p, g] = MACRO;
    if (configView) [p, g] = FOCUS[focusKey] || CONFIG;
    const tgtV = new THREE.Vector3(...g);
    if (narrow && free) {
      const ft = fitTargets(Math.hypot(p[0] - g[0], p[1] - g[1], p[2] - g[2]));
      const k = sm(5);
      const nd = dist + (ft.dist - dist) * k, no = offY + (ft.off - offY) * k;
      if (Math.abs(nd - dist) > 1e-4 || Math.abs(no - offY) > 0.05) { dist = nd; offY = no; frame(); dirty = true; }
    }
    const far = 1 + (1 - ease(ik)) * 1.4;
    const posV = new THREE.Vector3(...p).sub(tgtV).multiplyScalar(dist * far).add(tgtV);
    camera.position.lerp(posV, ik < 1 ? 1 : 0.08);
    camera.lookAt(...g);
    camera.updateMatrixWorld();
    // Something moved? The movement is only on show when the watch is open or turned over.
    const sig = [camera.position.x, camera.position.y, camera.position.z, spin.rotation.y, flip.rotation.x, Math.floor(s * 8), t, night,
      renderer.toneMappingExposure, key.position.x, key.position.z];
    if (t > 0.002 || flipV > 0.002 || sig.some((v, i) => Math.abs(v - (lastSig[i] ?? Infinity)) > 1e-6)) dirty = true;
    lastSig = sig;
  });

  const [p0, g0] = viewAt(0);
  camera.position.set(...p0);
  camera.lookAt(...g0);
  // Compile shaders off the main thread where the browser allows it, then start drawing.
  try { await renderer.compileAsync(scene, camera); } catch { renderer.compile(scene, camera); }
  stage.start();
  onReady?.();
  if (tier !== 'low' && !location.search.includes('nomaps')) {
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 300));
    idle(() => upgrade().catch(() => {}), { timeout: 4000 });
  }
  const touch = (fn) => (...a) => { dirty = true; return fn(...a); };
  return {
    apply: touch(apply),
    setT: touch(setT),
    // The canvas draws only while a 3D section is on screen.
    setFree(top, bottom) { if (!free || Math.abs(free.top - top) > 0.5 || Math.abs(free.bottom - bottom) > 0.5) { free = { top, bottom }; dirty = true; } },
    setActive(on) { if (on && !active) dirty = true; active = on; },
    setConfigView(on) { configView = on; if (on) tTarget = 0; dirty = true; },
    setMacro(on) { macro = on; },
    setNight(v) { nightT = clamp(v); },
    setFlip(v) { flipT = clamp(v); },
    focus(k) { focusKey = k; },
    setEngraving(text) { if (text !== personal) { personal = text; redraw(); dirty = true; } },
    playIntro() {
      if (introAt === null) return Promise.resolve();
      introAt = performance.now() / 1000;
      return new Promise((res) => { introDone = res; });
    },
    skipIntro() { introAt = null; introDone?.(); },
    state: () => ({ t, night, flip: flipV }),
    debug: { nodes, ring, rot, root, camera, scene },
    // Screen positions of label anchors on each part's rim, on the side that faces right on screen.
    anchors(keys, side = 1) {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      camRight.setFromMatrixColumn(camera.matrixWorld, 0);
      const out = {};
      for (const k of keys) {
        const n = nodes[k];
        if (!n || !ANCHOR[k]) continue;
        const [hh, r] = ANCHOR[k];
        root.localToWorld(tmp.set(axis[k][0], hh + n.position.y - base[k].y, axis[k][1]));
        tmp.addScaledVector(camRight, r * side);
        tmp.project(camera);
        out[k] = { x: (tmp.x + 1) / 2 * w, y: (1 - tmp.y) / 2 * h };
      }
      return out;
    },
  };
}
