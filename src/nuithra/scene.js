// NUITHRA 3D scene: the bottle on a lacquer plinth in a dark aubergine room. Three rings of botanicals orbit it,
// one per stage of the scent (top, heart, base). Scroll brings one ring forward at a time. Switching fragrance
// swirls the old botanicals out and the new ones in while the juice changes color. Size scales the bottle.
import * as THREE from 'three';
import { createStage } from '../kit/stage.js';
import { TIERS, scentOf, sizeScale, botanicalCount } from './scents.js';

const P = (o) => new THREE.MeshPhysicalMaterial(o);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const lerp = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);

// Ring layout per stage: height above the plinth, radius and turn speed (radians per second).
const RING = { top: { y: 0.142, r: 0.085, spin: 0.22 }, heart: { y: 0.082, r: 0.105, spin: -0.16 }, base: { y: 0.026, r: 0.092, spin: 0.12 } };
// Camera views: position, target.
const VIEW = {
  hero: [[0.05, 0.12, 0.42], [0, 0.07, 0]],
  top: [[0.03, 0.2, 0.3], [0, 0.135, 0]],
  heart: [[-0.06, 0.1, 0.32], [0, 0.08, 0]],
  base: [[0.04, 0.03, 0.31], [0, 0.03, 0]],
  shop: [[0.1, 0.11, 0.4], [0, 0.07, 0]],
};

// --- Botanical geometry (built once, shared by every instance) ---------------------
function bent(w, h, bend, taper, segs = 8) {
  const g = new THREE.PlaneGeometry(w, h, 4, segs);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), t = y / h + 0.5;
    p.setX(i, x * (1 - taper * Math.abs(t - 0.45) * 1.6));
    p.setZ(i, bend * (x * x * 30 + (t - 0.5) * (t - 0.5) * h * 1.2));
  }
  g.computeVertexNormals();
  return g;
}
function strip(len, w, curl) {
  const pts = [];
  for (let i = 0; i <= 16; i++) { const a = (i / 16) * curl; pts.push(new THREE.Vector3(Math.sin(a) * len / curl, i / 16 * w * 0.2, (1 - Math.cos(a)) * len / curl)); }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, w, 3, false);
}
function curve(len, r, wiggle) {
  const pts = [];
  for (let i = 0; i <= 10; i++) pts.push(new THREE.Vector3((i / 10 - 0.5) * len, Math.sin(i * 1.3) * wiggle, Math.cos(i * 0.9) * wiggle));
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, r, 5, false);
}
const GEO = {
  berry: () => new THREE.SphereGeometry(0.0026, 14, 10),
  citrus: () => new THREE.SphereGeometry(0.0055, 20, 14),
  petal: () => bent(0.013, 0.019, 0.45, 0.55),
  leaf: () => bent(0.012, 0.024, 0.25, 0.75),
  resin: () => new THREE.IcosahedronGeometry(0.0042, 0),
  pod: () => curve(0.032, 0.0016, 0.002),
  bean: () => new THREE.SphereGeometry(0.0042, 14, 10).scale(1.7, 0.75, 0.8),
  cardamom: () => new THREE.SphereGeometry(0.0036, 12, 10).scale(1.5, 0.9, 0.9),
  thread: () => curve(0.016, 0.00045, 0.0012),
  shaving: () => strip(0.03, 0.0035, 3.2),
  puff: () => new THREE.IcosahedronGeometry(0.0065, 2),
  root: () => curve(0.03, 0.0007, 0.004),
  bark: () => bent(0.012, 0.028, 0.9, 0.05),
};
const geoCache = {};
const geoOf = (k) => (geoCache[k] ||= GEO[k]());
function matOf(b, rich) {
  const c = new THREE.Color(b.color);
  if (!rich) return new THREE.MeshStandardMaterial({ color: c, roughness: b.kind === 'resin' ? 0.25 : 0.6, transparent: true, opacity: b.kind === 'puff' ? 0.55 : 1, depthWrite: b.kind !== 'puff', side: b.kind === 'petal' || b.kind === 'leaf' || b.kind === 'bark' ? THREE.DoubleSide : THREE.FrontSide, emissive: b.kind === 'resin' ? c.clone().multiplyScalar(0.18) : 0x000000 });
  if (b.kind === 'resin') return P({ color: c, roughness: 0.18, transmission: 0.0, clearcoat: 1, sheen: 0, transparent: true, opacity: 1, emissive: c.clone().multiplyScalar(0.18) });
  if (b.kind === 'puff') return P({ color: c, roughness: 1, transparent: true, opacity: 0.55, depthWrite: false });
  if (b.kind === 'petal' || b.kind === 'leaf' || b.kind === 'bark') return P({ color: c, roughness: 0.7, sheen: 0.6, sheenColor: c.clone().lerp(new THREE.Color(1, 1, 1), 0.4), side: THREE.DoubleSide, transparent: true, opacity: 1 });
  return P({ color: c, roughness: 0.55, clearcoat: b.kind === 'berry' || b.kind === 'citrus' ? 0.5 : 0, transparent: true, opacity: 1 });
}

// Dark room with warm strips for reflections in the glass.
function studio() {
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshBasicMaterial({ color: 0x0c0509, side: THREE.BackSide })));
  const panel = (w, h, color, k, pos) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  panel(3, 1.6, 0xfff4ea, 2.6, [-2.4, 3.4, 2.2]);
  panel(0.4, 5, 0xffb26b, 4.5, [3.8, 0.8, -2.4]);
  panel(0.3, 4, 0xd77a9a, 2.2, [-4.2, 0.6, -1.6]);
  panel(5, 0.3, 0xffffff, 1.5, [0, 1.6, 4.6]);
  return env;
}

function labelCanvas(name, size) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 384;
  const x = c.getContext('2d');
  x.clearRect(0, 0, 512, 384);
  x.fillStyle = 'rgba(255,248,240,0.9)';
  x.textAlign = 'center';
  x.font = '400 58px "Libre Caslon Display", "Libre Caslon Text", Georgia, serif';
  x.fillText('NUITHRA', 256, 150);
  x.fillRect(206, 178, 100, 2);
  x.font = '500 30px "Schibsted Grotesk", system-ui, sans-serif';
  x.fillText(name.toUpperCase().split('').join(String.fromCharCode(8202)), 256, 236);
  x.font = '400 24px "Schibsted Grotesk", system-ui, sans-serif';
  x.fillText(`Eau de parfum · ${size}`, 256, 290);
  return c;
}

export async function createNuithraScene(canvas, { tier, reducedMotion, onReady, onFallback, dragSurfaces = [] }) {
  const stage = createStage(canvas, { tier, fov: 30, createRenderer: (c, tr) => {
    const r = new THREE.WebGLRenderer({ canvas: c, antialias: tr !== 'low', powerPreference: 'high-performance' });
    r.toneMapping = THREE.AgXToneMapping;
    r.toneMappingExposure = 1.15;
    r.outputColorSpace = THREE.SRGBColorSpace;
    return r;
  } });
  stage.on('fallback', onFallback);
  if (!stage.ok) return null;
  const { scene, camera, renderer } = stage;
  scene.background = new THREE.Color(0x140a12);
  scene.fog = new THREE.Fog(0x140a12, 0.6, 1.6);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(studio(), 0.03).texture;
  scene.environmentIntensity = 1.1;
  const key = new THREE.SpotLight(0xfff1e4, 6, 2, 0.5, 0.8, 1.5);
  key.position.set(-0.3, 0.6, 0.35);
  key.target.position.set(0, 0.06, 0);
  const rim = new THREE.PointLight(0xffa860, 1.6, 1.2, 1.4);
  rim.position.set(0.12, 0.12, -0.25);
  const glow = new THREE.PointLight(0xffb070, 0.6, 0.5, 1.4);
  glow.position.set(0, 0.06, -0.05);
  scene.add(key, key.target, rim, glow, new THREE.HemisphereLight(0x6a4a5c, 0x120810, 0.5));

  // Plinth: a dark lacquer drum with a soft reflection.
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.03, 96), P({ color: 0x1a0a15, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.06 }));
  plinth.position.y = -0.015;
  const back = new THREE.Mesh(new THREE.SphereGeometry(2.5, 48, 24), new THREE.MeshBasicMaterial({ color: 0x1b0c18, side: THREE.BackSide }));
  // Warm halo behind the bottle: the glass refracts it, as in the studio still.
  const hc = document.createElement('canvas'); hc.width = hc.height = 256;
  const hx = hc.getContext('2d'); const gr = hx.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  hx.fillStyle = gr; hx.fillRect(0, 0, 256, 256);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(hc), transparent: true, depthWrite: false, color: 0xd98a40, fog: false }));
  halo.position.set(0, 0.08, -0.22);
  scene.add(plinth, back, halo);

  // Bottle.
  const gltf = await stage.load(`/nuithra/bottle-${tier === 'low' ? 'low' : 'high'}.glb`);
  const bottle = gltf.scene;
  const bottleG = new THREE.Group();
  bottleG.add(bottle);
  scene.add(bottleG);
  const glassRefract = tier === 'high'; // refraction costs a second render pass, so lighter devices get reflective glass
  const glass = glassRefract
    ? P({ color: 0xffffff, transmission: 1, thickness: 0.012, ior: 1.5, roughness: 0.02, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.2, specularIntensity: 1 })
    : P({ color: 0xffffff, transparent: true, opacity: 0.18, roughness: 0.02, clearcoat: 1, depthWrite: false });
  const liquid = glassRefract
    ? P({ color: new THREE.Color('#b5601a'), roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03, emissive: new THREE.Color('#b5601a'), emissiveIntensity: 0.32 })
    : P({ color: new THREE.Color('#b5601a'), roughness: 0.1, transparent: true, opacity: 0.85 });
  const gold = P({ color: 0xd9b16e, metalness: 1, roughness: 0.22 });
  const lacquer = P({ color: 0x1f0619, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.05 });
  bottle.traverse((o) => {
    if (!o.isMesh) return;
    const n = o.material.name;
    if (n === 'glass_bottle') { o.material = glass; o.renderOrder = 3; }
    if (n === 'liquid') { o.material = liquid; o.renderOrder = 2; }
    if (n === 'gold_collar') o.material = gold;
    if (n === 'cap_lacquer') o.material = lacquer;
  });
  // Label on the front face of the glass.
  let labelTex = null;
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.036, 0.027), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }));
  label.position.set(0, 0.05, 0.0183);
  label.renderOrder = 4;
  bottleG.add(label);
  function drawLabel(name, size) {
    labelTex?.dispose();
    labelTex = new THREE.CanvasTexture(labelCanvas(name, size));
    labelTex.colorSpace = THREE.SRGBColorSpace;
    labelTex.anisotropy = 8;
    label.material.map = labelTex;
    label.material.needsUpdate = true;
  }

  // --- Botanical rings ---------------------------------------------------------------------
  const rings = {}; // tier -> { group, meshes: [{ mesh, data: [{a, y, r, s, tumble}] }] }
  for (const t of TIERS) { rings[t] = { group: new THREE.Group(), meshes: [], out: [] }; scene.add(rings[t].group); }
  const dummy = new THREE.Object3D();
  function buildRings(scent, swirlIn) {
    for (const t of TIERS) {
      const ring = rings[t];
      ring.out.push(...ring.meshes.map((m) => ({ ...m, born: performance.now() / 1000 })));
      ring.meshes = [];
      const R = RING[t];
      for (const b of scent.botanicals[t]) {
        const n = botanicalCount(b, tier);
        const mesh = new THREE.InstancedMesh(geoOf(b.kind), matOf(b, tier === 'high'), n);
        mesh.frustumCulled = false;
        const data = [];
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + Math.random() * 0.4 + (b.kind.length * 0.37);
          data.push({ a, y: R.y + (Math.random() - 0.5) * 0.03, r: R.r + (Math.random() - 0.5) * 0.03, s: (b.size || 1) * (0.75 + Math.random() * 0.5),
            tumble: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6), spin: 0.3 + Math.random() * 0.8 });
        }
        ring.group.add(mesh);
        ring.meshes.push({ mesh, data, born: swirlIn ? performance.now() / 1000 : -10 });
      }
    }
  }

  // --- State -----------------------------------------------------------------------------------
  let scent = null, size = '50 ml', scale = 1, scaleT = 1, view = 'hero', focus = { top: 0, heart: 0, base: 0 };
  const liquidColor = new THREE.Color('#b5601a'), liquidT = new THREE.Color('#b5601a');
  function setScent(handle, sz = size) {
    const s = scentOf(handle);
    const first = !scent;
    scent = s;
    size = sz;
    liquidT.set(s.liquid);
    if (first) liquidColor.copy(liquidT);
    drawLabel(s.name, size);
    buildRings(s, !first);
  }
  function setSize(sz) { size = sz; scaleT = sizeScale(sz); if (scent) drawLabel(scent.name, sz); }

  // Composition: the bottle sits right of the copy on wide screens and high on phones.
  function frame() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w > 900) camera.setViewOffset(w, h, -w * 0.18, 0, w, h); else camera.setViewOffset(w, h, 0, h * 0.24, w, h);
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', frame);
  frame();
  const narrowDist = () => (canvas.clientWidth < 600 ? 1.45 : canvas.clientWidth < 900 ? 1.2 : 1);

  // Pointer: tilt toward the cursor, drag to turn.
  const fine = matchMedia('(pointer: fine)').matches && !reducedMotion;
  let ptr = [0, 0], tilt = [0, 0], yaw = 0, yawVel = 0, drag = null;
  if (fine) window.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') ptr = [e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1]; });
  const SKIP = 'input,button,a,label,select,textarea,.kit-panel';
  for (const el of dragSurfaces) el.addEventListener('pointerdown', (e) => { if (!e.button && !e.target.closest(SKIP)) drag = { id: e.pointerId, x: e.clientX, y: e.clientY, yaw, on: false, lx: e.clientX }; });
  window.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    if (!drag.on && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(e.clientY - drag.y) * 1.2) drag.on = true;
    if (!drag.on) return;
    yaw = drag.yaw + dx * 0.009;
    yawVel = (e.clientX - drag.lx) * 0.009;
    drag.lx = e.clientX;
  });
  window.addEventListener('pointerup', () => { drag = null; });

  const camPos = new THREE.Vector3(...VIEW.hero[0]), camLook = new THREE.Vector3(...VIEW.hero[1]);
  stage.onFrame((dt, now) => {
    const sm = (rate) => Math.min(1, dt * (reducedMotion ? 60 : rate));
    scale += (scaleT - scale) * sm(5);
    bottleG.scale.setScalar(scale);
    liquidColor.lerp(liquidT, sm(3));
    liquid.color.copy(liquidColor).multiplyScalar(glassRefract ? 0.42 : 1);
    if (glassRefract) liquid.emissive.copy(liquidColor);
    halo.material.color.copy(liquidColor).lerp(new THREE.Color(0xffc890), 0.5);
    glow.color.copy(liquidColor).lerp(new THREE.Color(0xffffff), 0.35);
    if (!drag) { yaw += yawVel; yawVel *= 0.9; }
    tilt = lerp(tilt, fine ? ptr : [0, 0], sm(3));
    bottleG.rotation.y = yaw + tilt[0] * 0.35 + (reducedMotion ? 0 : Math.sin(now * 0.25) * 0.08);

    for (const t of TIERS) {
      const R = RING[t], f = focus[t];
      const ring = rings[t];
      ring.group.rotation.y = reducedMotion ? 0 : now * R.spin * (0.6 + f * 0.8);
      const draw = (entry, outK) => {
        const { mesh, data, born } = entry;
        const k = outK ?? ease(clamp((now - born) / 1.4));
        const reach = outK != null ? 1 + outK * 1.6 : 0.4 + 0.6 * k;
        data.forEach((d, i) => {
          const r = d.r * (1 - f * 0.18) * scale * reach;
          dummy.position.set(Math.cos(d.a) * r, d.y * scale + (reducedMotion ? 0 : Math.sin(now * d.spin + d.a) * 0.004), Math.sin(d.a) * r);
          dummy.rotation.set(d.tumble.x + now * d.spin * 0.3, d.tumble.y + now * d.spin * 0.2, d.tumble.z);
          dummy.scale.setScalar(d.s * (outK != null ? 1 - outK : k) * (1 + f * 0.25));
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
        });
        mesh.instanceMatrix.needsUpdate = true;
        const anyFocus = focus.top + focus.heart + focus.base;
        mesh.material.opacity = (mesh.material.userData.base ??= mesh.material.opacity) * (anyFocus > 0.05 ? 0.25 + 0.75 * f : 1);
      };
      ring.meshes.forEach((e) => draw(e));
      ring.out = ring.out.filter((e) => {
        const k = clamp((now - e.born) / 0.9);
        if (k >= 1) { ring.group.remove(e.mesh); e.mesh.material.dispose(); return false; }
        draw(e, ease(k));
        return true;
      });
    }

    const [p, g] = VIEW[view];
    const look = new THREE.Vector3(...g).multiplyScalar(scale);
    const pos = new THREE.Vector3(...p).sub(new THREE.Vector3(...g)).multiplyScalar(narrowDist() * (0.92 + scale * 0.08)).add(look);
    pos.applyAxisAngle(new THREE.Vector3(0, 1, 0), tilt[0] * -0.05);
    pos.y += tilt[1] * -0.02;
    camPos.lerp(pos, sm(2.4));
    camLook.lerp(look, sm(2.4));
    camera.position.copy(camPos);
    camera.lookAt(camLook);
  });

  try { await renderer.compileAsync(scene, camera); } catch { renderer.compile(scene, camera); }
  stage.start();
  onReady?.();
  return {
    setScent,
    setSize,
    setView(v) { if (VIEW[v]) view = v; },
    setFocus(f) { focus = { top: 0, heart: 0, base: 0, ...f }; },
  };
}
