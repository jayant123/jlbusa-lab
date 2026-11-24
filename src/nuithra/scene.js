// NUITHRA 3D scene: five bottles of colored glass on a ledge of polished black stone. A warm light behind them
// sweeps along the row. Where it passes through a bottle the stone takes that bottle's color. The chosen bottle
// steps forward. Scroll moves the camera between the collection, a close look at the glass, the colored light
// on the stone and the shop. Size scales the chosen bottle.
import * as THREE from 'three';
import { createStage } from '../kit/stage.js';
import { ORDER, SCENTS, sizeScale } from './scents.js';
import { buildBottle } from './bottles.js';
import { buildSetting } from './settings.js';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const WHITE = new THREE.Color(1, 1, 1);
const THICK = { slab: 0.032, moon: 0.027, column: 0.05, obelisk: 0.036, octagon: 0.07 };
const LABEL = { slab: [0.045, 0.0162], moon: [0.05, 0.0137], column: [0.05, 0.0254], octagon: [0.032, 0.0402] };

// Studio for reflections: tall soft boxes left and right draw long highlights down the glass edges.
function studio() {
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshBasicMaterial({ color: 0x060305, side: THREE.BackSide })));
  const panel = (w, h, color, k, pos) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(0, 0.5, 0);
    env.add(m);
  };
  panel(0.5, 6, 0xfff6ee, 5, [-3.2, 1.2, 1.6]);
  panel(0.4, 6, 0xffd2a0, 4, [3.4, 1, 1.2]);
  panel(4, 0.25, 0xffffff, 1.4, [0, 3.6, 2.6]);
  return env;
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// The wall behind the ledge: near black with a low band of warm light that the glass refracts.
const wallTex = () => canvasTex(1024, 512, (x, w, h) => {
  x.fillStyle = '#060305'; x.fillRect(0, 0, w, h);
  // A low band of warm light behind the shelf.
  const g = x.createLinearGradient(0, h * 0.45, 0, h);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.55, 'rgba(150,60,30,0.55)'); g.addColorStop(0.78, 'rgba(255,170,100,0.9)'); g.addColorStop(1, 'rgba(255,220,180,1)');
  x.fillStyle = g; x.fillRect(0, h * 0.45, w, h * 0.55);
  // Tall soft slits of light. Seen through the glass they bend, which is what makes glass read as glass.
  for (const [cx, a] of [[0.3, 0.55], [0.43, 0.8], [0.57, 0.8], [0.7, 0.55]]) {
    const sg = x.createLinearGradient(w * cx - 26, 0, w * cx + 26, 0);
    sg.addColorStop(0, 'rgba(255,230,200,0)'); sg.addColorStop(0.5, `rgba(255,236,214,${a})`); sg.addColorStop(1, 'rgba(255,230,200,0)');
    x.fillStyle = sg; x.fillRect(w * cx - 26, h * 0.2, 52, h * 0.8);
  }
  const fade = x.createRadialGradient(w / 2, h, 10, w / 2, h, w * 0.6);
  fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(6,3,5,1)');
  x.fillStyle = fade; x.fillRect(0, 0, w, h);
});
// Light thrown through colored glass: a bright rim near the bottle, two caustic lines, and a soft tail.
const poolTex = () => canvasTex(128, 256, (x, w, h) => {
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.25, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.beginPath(); x.moveTo(w * 0.2, 0); x.bezierCurveTo(w * 0.1, h * 0.4, 0, h * 0.8, w * 0.5, h); x.bezierCurveTo(w, h * 0.8, w * 0.9, h * 0.4, w * 0.8, 0); x.fill();
  x.globalCompositeOperation = 'lighter';
  x.strokeStyle = 'rgba(255,255,255,0.9)'; x.lineWidth = 2.2; x.shadowColor = '#fff'; x.shadowBlur = 6;
  for (const [a, b] of [[0.28, 0.42], [0.72, 0.58]]) { x.beginPath(); x.moveTo(w * a, 2); x.bezierCurveTo(w * a, h * 0.3, w * b, h * 0.45, w * 0.5, h * 0.75); x.stroke(); }
  x.lineWidth = 1; x.strokeStyle = 'rgba(255,255,255,0.5)';
  for (let i = 0; i < 6; i++) { const s = 0.3 + i * 0.08; x.beginPath(); x.moveTo(w * s, 6); x.quadraticCurveTo(w * (s + 0.05), h * 0.3, w * 0.5, h * (0.45 + i * 0.04)); x.stroke(); }
});
const blobTex = (inner, outer) => canvasTex(128, 128, (x, w) => {
  const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  g.addColorStop(0, inner); g.addColorStop(1, outer);
  x.fillStyle = g; x.fillRect(0, 0, w, w);
});
function labelTex(name) {
  return canvasTex(512, 256, (x, w, h) => {
    x.fillStyle = 'rgba(255,250,244,0.92)';
    x.textAlign = 'center';
    x.font = '400 92px "Libre Caslon Display", "Libre Caslon Text", Georgia, serif';
    x.fillText('NUITHRA', w / 2, h * 0.5);
    x.font = '500 40px "Schibsted Grotesk", system-ui, sans-serif';
    x.fillText(name.toUpperCase().split('').join(String.fromCharCode(8202)), w / 2, h * 0.82);
  });
}

export async function createNuithraScene(canvas, { tier, reducedMotion, onReady, onFallback, onPick, dragSurfaces = [], still = false, setting = null }) {
  const stage = createStage(canvas, { tier, fov: 28, createRenderer: (c, tr) => {
    const r = new THREE.WebGLRenderer({ canvas: c, antialias: true, powerPreference: 'high-performance' });
    r.toneMapping = THREE.AgXToneMapping;
    r.toneMappingExposure = 1.2;
    r.outputColorSpace = THREE.SRGBColorSpace;
    return r;
  } });
  stage.on('fallback', onFallback);
  if (!stage.ok) return null;
  const { scene, camera, renderer } = stage;
  const rich = tier !== 'low'; // real refraction needs a second pass. Low tier gets tinted, reflective glass.
  scene.background = new THREE.Color(0x070406);
  const pmrem = new THREE.PMREMGenerator(renderer);
  await new Promise((r) => setTimeout(r, 0));
  scene.environment = pmrem.fromScene(studio(), 0.02).texture;
  scene.environmentIntensity = 1;

  const key = new THREE.SpotLight(0xfff0e2, 3.5, 3, 0.55, 0.9, 1.2);
  key.position.set(-0.35, 0.6, 0.5);
  const back = new THREE.SpotLight(0xffc48a, 0.9, 2, 0.32, 0.9, 1.2);
  back.position.set(0, 0.32, -0.32);
  scene.add(key, key.target, back, back.target, new THREE.HemisphereLight(0x5a4450, 0x0a0508, 0.35));

  // Wall, ledge and the stone's reflection.
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.8), new THREE.MeshBasicMaterial({ map: wallTex(), fog: false }));
  wall.position.set(0, 0.4, -0.5);
  const stone = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.85), new THREE.MeshStandardMaterial({ color: 0x040203, roughness: 0.08, metalness: 0, envMapIntensity: 0.12, transparent: true, opacity: 0.9 }));
  stone.rotation.x = -Math.PI / 2;
  stone.position.set(0, 0, -0.175);
  stone.renderOrder = 2;
  const lip = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.4), new THREE.MeshStandardMaterial({ color: 0x0d080b, roughness: 0.4 }));
  lip.position.set(0, -0.2, 0.25);
  const edge = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.0012), new THREE.MeshBasicMaterial({ color: 0x8a6a58 }));
  edge.position.set(0, -0.0006, 0.2502);
  // The wall's glow reflected in the stone.
  const wallRefl = new THREE.Mesh(wall.geometry, new THREE.MeshBasicMaterial({ map: wall.material.map, transparent: true, opacity: 0.55, depthWrite: false }));
  wallRefl.scale.y = -1;
  wallRefl.position.set(0, -0.4, -0.5);
  scene.add(wall, wallRefl, stone, lip, edge);
  // Optional forest setting (concept alternatives). It replaces the wall and the stone shelf.
  const forest = setting ? buildSetting(setting, { scene }) : null;
  if (forest) {
    [wall, wallRefl, stone, lip, edge].forEach((m) => { m.visible = false; });
    if (forest.dark) { key.color.set(0x9fb8ff); key.intensity = 1.6; }
    else { key.color.set(0xfff1d0); key.intensity = 5; key.position.set(-0.5, 0.8, 0.3); }
  }

  // --- Bottles -------------------------------------------------------------------------------------------------
  const metal = new THREE.MeshPhysicalMaterial({ color: 0xd8b06a, metalness: 1, roughness: 0.2 });
  const shared = {
    metal,
    stone: new THREE.MeshPhysicalMaterial({ color: 0x2a0c22, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04 }),
    matte: new THREE.MeshStandardMaterial({ color: 0x0c0b0b, roughness: 0.62 }),
    silver: new THREE.MeshPhysicalMaterial({ color: 0xdfe2ea, metalness: 1, roughness: 0.12 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x8a5a34, roughness: 0.55 }),
  };
  const mirror = (m) => new THREE.MeshBasicMaterial({ color: (m.color || WHITE).clone().multiplyScalar(0.35), transparent: true, opacity: 0.5, depthWrite: false });
  const mirrorShared = Object.fromEntries(Object.entries(shared).map(([k, m]) => [k, mirror(m)]));
  const pool = poolTex(), shadow = blobTex('rgba(0,0,0,0.85)', 'rgba(0,0,0,0)'), glowT = blobTex('rgba(255,255,255,0.9)', 'rgba(255,255,255,0)');

  function glassMat(hex, shape) {
    const c = new THREE.Color(hex);
    if (rich) {
      return new THREE.MeshPhysicalMaterial({ color: WHITE.clone().lerp(c, 0.55), transmission: 1, thickness: THICK[shape], ior: 1.5, roughness: 0.01,
        attenuationColor: c, attenuationDistance: THICK[shape] * 2.2, specularIntensity: 1, envMapIntensity: 1.5, dispersion: tier === 'high' ? 0.25 : 0,
        emissive: c, emissiveIntensity: 0 });
    }
    return new THREE.MeshPhysicalMaterial({ color: c, transparent: true, opacity: 0.8, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2, emissive: c, emissiveIntensity: 0.3 });
  }

  const pause = () => new Promise((r) => setTimeout(r, 0));
  const bottles = [];
  for (const handle of ORDER) {
    await pause();
    bottles.push((() => {
    const s = SCENTS[handle];
    const color = new THREE.Color(s.glass);
    const mats = { ...shared, glass: glassMat(s.glass, s.shape) };
    const { group, glass, info } = buildBottle(s.shape, s.cap, mats);
    const holder = new THREE.Group();
    holder.add(group);
    glass.userData.handle = handle;
    if (LABEL[s.shape]) {
      const [y, z] = LABEL[s.shape];
      const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.015), new THREE.MeshBasicMaterial({ map: labelTex(s.name), transparent: true, depthWrite: false, opacity: 0.85 }));
      lab.position.set(0, y, z);
      lab.renderOrder = 5;
      group.add(lab);
    }
    const refl = buildBottle(s.shape, s.cap, { ...mirrorShared, glass: new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(0.8), transparent: true, opacity: 0.42, depthWrite: false }) }).group;
    refl.scale.y = -1;
    holder.add(refl);
    if (setting && setting !== 'pool') refl.visible = false;
    // Light pool in front of the bottle, contact shadow under it, glow behind it.
    const lightPool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, -0.5, 0).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: pool, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    lightPool.position.y = 0.0006;
    lightPool.renderOrder = 3;
    const contact = new THREE.Mesh(new THREE.PlaneGeometry(info.w * 1.5, info.d * 1.9).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: shadow, transparent: true, depthWrite: false, opacity: 0.7 }));
    contact.position.y = 0.0004;
    contact.renderOrder = 3;
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshBasicMaterial({ map: glowT, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    glow.position.set(0, info.height * 0.45, -0.05);
    holder.add(lightPool, contact, glow);
    scene.add(holder);
    return { handle, s, color, holder, group, glass, info, lightPool, contact, glow, pos: new THREE.Vector3(), fwd: 0, scale: 1, yaw: 0, lit: 0 };
    })());
  }
  await pause();
  const glassMeshes = bottles.map((b) => b.glass);

  // Layout: a gentle arc on wide screens. On phones the row tightens and staggers so the five fit.
  let narrow = false;
  function layout() {
    narrow = canvas.clientWidth < 700;
    bottles.forEach((b, i) => {
      const k = i - 2;
      if (narrow) b.pos.set(k * 0.07, 0, k % 2 ? -0.06 : -Math.abs(k) * 0.015);
      else b.pos.set(k * 0.115, 0, -k * k * 0.012);
    });
  }

  // --- State ---------------------------------------------------------------------------------------------------
  let selected = 2, size = '50 ml', view = 'hero', lightX = 0, t0 = performance.now() / 1000;
  const idx = (h) => Math.max(0, ORDER.indexOf(h));
  function setScent(handle) { selected = idx(handle); }
  function setSize(s) { size = s; }

  // Camera views: [position, target] around the chosen bottle (b) or the row.
  function viewOf(v) {
    const b = bottles[selected].pos, f = 0.05;
    const n = narrow;
    switch (v) {
      case 'glass': return [[b.x + 0.1, 0.085, b.z + f + (n ? 0.42 : 0.3)], [b.x, 0.062, b.z + f]];
      case 'light': return [[b.x * 0.4 - 0.05, 0.075, n ? 0.95 : 0.6], [b.x * 0.4, 0.045, 0.06]];
      case 'notes': return [[b.x - 0.05, 0.085, b.z + f + (n ? 0.48 : 0.34)], [b.x, 0.062, b.z + f]];
      case 'shop': return n ? [[b.x * 0.6, 0.12, 0.9], [b.x * 0.6, 0.06, 0]] : [[b.x * 0.5, 0.12, 0.72], [b.x * 0.6, 0.058, 0]];
      default: return n ? [[0, 0.17, 1.35], [0, 0.06, -0.03]] : [[0.02, 0.15, 1.05], [0.02, 0.085, 0]];
    }
  }

  // Composition: the row sits right of the copy on wide screens and high on phones.
  function frame() {
    layout();
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w > 900) camera.setViewOffset(w, h, -w * 0.21, 0, w, h); else camera.setViewOffset(w, h, 0, h * 0.2, w, h);
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', frame);
  frame();

  // Pointer: tilt toward the cursor, drag to turn the chosen bottle, tap a bottle to choose it.
  const fine = matchMedia('(pointer: fine)').matches && !reducedMotion;
  let ptr = [0, 0], tilt = [0, 0], drag = null, yawVel = 0;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const hit = (e) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObjects(glassMeshes, false)[0]?.object.userData.handle || null;
  };
  const SKIP = 'input,button,a,label,select,textarea,.kit-panel,.n-panel,.n-card,.n-hero-copy';
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') {
      if (fine) ptr = [e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1];
      document.body.classList.toggle('n-over-bottle', !e.target.closest(SKIP) && !!hit(e));
    }
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    if (!drag.on && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(e.clientY - drag.y) * 1.2) drag.on = true;
    if (!drag.on) return;
    bottles[selected].yaw = drag.yaw + dx * 0.009;
    yawVel = (e.clientX - drag.lx) * 0.009;
    drag.lx = e.clientX;
  });
  for (const el of dragSurfaces) {
    el.addEventListener('pointerdown', (e) => { if (!e.button && !e.target.closest(SKIP)) drag = { id: e.pointerId, x: e.clientX, y: e.clientY, yaw: bottles[selected].yaw, on: false, lx: e.clientX }; });
  }
  window.addEventListener('pointerup', (e) => {
    if (drag && !drag.on && e.pointerId === drag.id) { const h = hit(e); if (h) onPick?.(h); }
    drag = null;
  });

  // --- Frame ---------------------------------------------------------------------------------------------------
  const cam = { pos: new THREE.Vector3(...viewOf('hero')[0]), look: new THREE.Vector3(...viewOf('hero')[1]) };
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  stage.onFrame((dt, now) => {
    const sm = (rate) => Math.min(1, dt * (reducedMotion ? 60 : rate));
    const t = now - t0;
    forest?.update(t);
    // The back light sweeps the row in the hero and settles behind the chosen bottle elsewhere.
    const sweep = view === 'hero' || view === 'light';
    const target = still ? bottles[selected].pos.x * 0.6 : sweep && !reducedMotion ? Math.sin(t * 0.32) * (narrow ? 0.16 : 0.26) : bottles[selected].pos.x;
    lightX += (target - lightX) * sm(view === 'hero' ? 6 : 2);
    back.position.set(lightX, 0.3, -0.34);
    back.target.position.set(lightX, 0, 0.12);
    key.target.position.copy(bottles[selected].pos);
    tilt = [tilt[0] + ((fine ? ptr[0] : 0) - tilt[0]) * sm(3), tilt[1] + ((fine ? ptr[1] : 0) - tilt[1]) * sm(3)];

    bottles.forEach((b, i) => {
      const on = i === selected;
      const fwdT = on && view !== 'hero' ? 0.05 : on ? 0.02 : 0;
      b.fwd += (fwdT - b.fwd) * sm(4);
      b.scale += ((on ? sizeScale(size) : 1) - b.scale) * sm(5);
      if (!on && !reducedMotion) b.yaw += (Math.sin(t * 0.2 + i) * 0.25 - b.yaw) * sm(0.6);
      if (on && !drag) { b.yaw += yawVel; yawVel *= 0.92; if (!reducedMotion && !still && Math.abs(yawVel) < 0.0005) b.yaw += dt * 0.12; }
      b.holder.position.set(b.pos.x, 0, b.pos.z + b.fwd);
      b.group.scale.setScalar(b.scale);
      b.group.rotation.y = b.yaw + (on ? tilt[0] * 0.25 : 0);
      b.holder.children[1].scale.set(b.scale, -b.scale, b.scale);
      b.holder.children[1].rotation.y = b.group.rotation.y;
      // How much light passes through this bottle: closeness to the back light, plus a lift when chosen.
      const d = (b.pos.x - lightX) / (narrow ? 0.06 : 0.085);
      const litT = 0.22 + 0.9 * Math.exp(-d * d) + (on ? 0.25 : 0);
      b.lit += (litT - b.lit) * sm(5);
      const boost = view === 'light' ? 1.7 : 1;
      const len = (0.06 + b.info.height * 0.9) * (view === 'light' ? 1.5 : 1);
      b.lightPool.scale.set(b.info.w * 1.35 * b.scale, 1, len * b.scale);
      b.lightPool.rotation.y = Math.atan2(b.pos.x - lightX, 0.4) * 0.8;
      b.lightPool.material.opacity = clamp(b.lit * 0.75 * boost);
      b.glow.material.opacity = clamp(b.lit * (rich ? 0.38 : 0.5));
      b.glow.lookAt(cam.pos);
      if (rich) b.glass.material.emissiveIntensity = b.lit * 0.12;
      else b.glass.material.emissiveIntensity = 0.12 + b.lit * 0.35;
    });

    const [p, g] = viewOf(view);
    tmp.set(...p); tmp2.set(...g);
    tmp.x += tilt[0] * -0.02; tmp.y += tilt[1] * -0.012;
    cam.pos.lerp(tmp, sm(2.2));
    cam.look.lerp(tmp2, sm(2.2));
    camera.position.copy(cam.pos);
    camera.lookAt(cam.look);
  });

  try { await renderer.compileAsync(scene, camera); } catch { renderer.compile(scene, camera); }
  stage.start();
  onReady?.();
  return {
    setScent,
    setSize,
    setView(v) { view = v; },
  };
}
