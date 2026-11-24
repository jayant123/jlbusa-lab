// PLINTHA 3D room: a gallery with two tall windows, travertine slabs and a modular sofa on oak plinths.
// The room assembles around the sofa on arrival. In the builder the visitor's layout replaces the showroom sofa,
// modules slide into place, glowing ghost slots show where the next piece can go and the camera reframes.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createStage } from '../kit/stage.js';
import { placements, bounds, ghostSlots } from './positions.js';
import { WIDTH, DEPTH } from './layout.js';

const TEX = '/plintha/tex/';
// Fabric: scan (greyscale weave), tint, roughness, the scan's mean brightness (so the tint lands on its color).
const FABRIC = {
  'Boucle Chalk': { scan: 'Fabric085', tint: 0xeeebe4, rough: 0.95, mean: 0.51 },
  'Wool Moss': { scan: 'Fabric085', tint: 0x6b7552, rough: 0.92, mean: 0.51 },
  'Linen Sand': { scan: 'Fabric032', tint: 0xcdb895, rough: 0.86, mean: 0.57 },
  'Velvet Ink': { scan: 'Fabric032', tint: 0x1d2439, rough: 0.55, mean: 0.57 },
};
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const M = (cm) => cm / 100;

export async function createPlinthaScene(canvas, { tier, reducedMotion, onReady, onFallback, onPick, onGhost, onAssembled }) {
  const stage = createStage(canvas, { tier, fov: 32, createRenderer: (c, tr) => {
    const r = new THREE.WebGLRenderer({ canvas: c, antialias: tr !== 'low', powerPreference: 'high-performance' });
    r.toneMapping = THREE.AgXToneMapping;
    r.toneMappingExposure = 1.0;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.shadowMap.enabled = tr !== 'low';
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    return r;
  } });
  stage.on('fallback', onFallback);
  if (!stage.ok) return null;
  const { scene, camera, renderer } = stage;
  scene.background = new THREE.Color(0xe7e3dc);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;

  // --- Textures and materials -------------------------------------------------
  const loader = new THREE.TextureLoader();
  const tex = (name, srgb, repeat) => {
    const t = loader.load(TEX + name + (tier === 'high' ? '' : '_512') + '.webp');
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const scans = {};
  const scan = (base) => (scans[base] ||= { map: tex(`${base}_Gray`, true, 2), normalMap: tex(`${base}_NormalGL`, false, 2), roughnessMap: tex(`${base}_Roughness`, false, 2) });
  const upholstery = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
  upholstery.normalScale.set(0.9, 0.9);
  const sheen = new THREE.MeshPhysicalMaterial(); // velvet gets a sheen layer
  function setFabricMaterial(name) {
    const f = FABRIC[name] || FABRIC['Boucle Chalk'];
    const s = scan(f.scan);
    const c = new THREE.Color(f.tint).multiplyScalar(1 / (f.mean * 1.3));
    Object.assign(upholstery, { map: s.map, normalMap: s.normalMap, roughnessMap: s.roughnessMap, roughness: f.rough });
    upholstery.color.copy(c);
    upholstery.needsUpdate = true;
    void sheen;
  }
  const oak = new THREE.MeshStandardMaterial({ color: 0x2a1d15, roughness: 0.48 });
  const travertine = new THREE.MeshStandardMaterial({ map: tex('Travertine009_Color', true, 1.9), normalMap: tex('Travertine009_NormalGL', false, 1.9),
    roughnessMap: tex('Travertine009_Roughness', false, 1.9), color: 0xfffaf2, roughness: 0.6 });
  travertine.normalScale.set(0.25, 0.25);
  const plaster = new THREE.MeshStandardMaterial({ map: tex('Plaster001_Color', true, 0.5), normalMap: tex('Plaster001_NormalGL', false, 0.5),
    color: 0xf1ede6, roughness: 0.95 });
  plaster.normalScale.set(0.5, 0.5);
  const rugMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0x8d877d).multiplyScalar(1.2), roughness: 1 });
  const shadeMat = new THREE.MeshStandardMaterial({ color: 0xece6da, roughness: 0.8, emissive: 0xffb36b, emissiveIntensity: 0 });
  const MATS = { upholstery, oak_plinth: oak, travertine, plaster, grout: new THREE.MeshStandardMaterial({ color: 0x8c8379, roughness: 1 }),
    rug: rugMat, lamp_shade: shadeMat, lamp_steel: new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 1, roughness: 0.35 }) };
  const restyle = (root) => root.traverse((o) => {
    if (!o.isMesh) return;
    const m = MATS[o.material.name];
    if (m) o.material = m;
    o.castShadow = true;
    o.receiveShadow = true;
  });

  // --- Load room and modules ----------------------------------------------------
  const [roomG, modG] = await Promise.all([stage.load(`/plintha/room-${tier === 'low' ? 'low' : 'high'}.glb`), stage.load(`/plintha/modules-${tier}.glb`)]);
  restyle(roomG.scene);
  restyle(modG.scene);
  rugMat.map = scan('Fabric085').map;
  rugMat.normalMap = scan('Fabric085').normalMap;
  setFabricMaterial('Boucle Chalk');
  const room = roomG.scene;
  scene.add(room);
  // Loose pieces get a holder so the page can move them while their stored transform stays intact.
  const holder = (name) => { const n = room.getObjectByName(name); const g = new THREE.Group(); room.add(g); if (n) g.add(n); return g; };
  const walls = holder('walls'), rug = holder('rug'), sideTable = holder('side_table'), lamp = holder('floor_lamp');
  room.getObjectByName('floor').castShadow = false;
  const proto = Object.fromEntries(Object.keys(WIDTH).map((k) => [k, modG.scene.getObjectByName(k)]));

  // Ceiling that only casts shadow, so the sun enters through the windows alone.
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(14, 11), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide }));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(5.5, 3.4, 4.3);
  ceiling.castShadow = true;
  scene.add(ceiling);

  // --- Light ------------------------------------------------------------------------
  const hemi = new THREE.HemisphereLight(0xf3efe8, 0x8a8174, 1.4);
  const sun = new THREE.DirectionalLight(0xfff1dc, 4.2);
  sun.position.set(-7.5, 6.2, 5.0); // low sun from the left, through the windows and across the sofa
  sun.target.position.set(1.5, 0, -0.5);
  sun.castShadow = tier !== 'low';
  sun.shadow.mapSize.set(tier === 'high' ? 2048 : 1024, tier === 'high' ? 2048 : 1024);
  Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 22 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 4;
  const lampLight = new THREE.PointLight(0xffb06a, 0, 7, 1.6);
  lampLight.position.set(0, 1.45, 0);
  lamp.add(lampLight);
  const wash = new THREE.SpotLight(0xffc48a, 0, 9, 0.75, 0.9, 1.2);
  wash.position.set(2, 3.2, 3.5);
  wash.target.position.set(2, 0.6, -0.6);
  scene.add(hemi, sun, sun.target, wash, wash.target);
  let light = 0, lightT = 0; // 0 day .. 1 evening

  // --- Modules ------------------------------------------------------------------------
  const pieces = []; // { kind, g, target: {x,z,rot}, alive, born }
  function spawn(kind) {
    const g = new THREE.Group();
    const m = proto[kind].clone();
    g.add(m);
    g.userData.kind = kind;
    scene.add(g);
    return g;
  }
  let shown = null; // the layout on screen
  function showLayout(layout, { drop = true } = {}) {
    shown = layout;
    const ps = placements(layout, { center: false });
    const free = pieces.filter((p) => p.alive);
    const next = [];
    for (const p of ps) {
      // reuse the nearest piece of the same kind, so modules slide rather than pop
      let best = -1, bd = Infinity;
      free.forEach((q, i) => { if (q && q.kind === p.kind) { const d = Math.hypot(q.g.position.x - p.x, q.g.position.z - p.z); if (d < bd) { bd = d; best = i; } } });
      let piece;
      if (best >= 0) { piece = free[best]; free[best] = null; } else {
        piece = { kind: p.kind, g: spawn(p.kind), alive: true, born: performance.now() };
        piece.g.position.set(p.x, drop && !reducedMotion ? 0.9 : 0, p.z);
        piece.g.rotation.y = p.rot;
        pieces.push(piece);
      }
      piece.id = p.id;
      piece.target = { x: p.x, z: p.z, rot: p.rot };
      piece.g.userData.id = p.id;
      next.push(piece);
    }
    for (const q of free) if (q) { q.alive = false; q.dieAt = performance.now(); }
    placeProps(ps);
    frameTarget = fit(ps);
  }
  function placeProps(ps) {
    const b = bounds(ps.length ? ps : [{ kind: 'armless', x: 0, z: 0, rot: 0 }]);
    const mainW = ps.filter((p) => p.where === 'main').reduce((s, p) => s + M(WIDTH[p.kind]), 0) || 1.8;
    rugTarget.set(Math.max(1.2, mainW / 2), 0, Math.min(2.2, b.maxZ) + 0.25);
    tableTarget.set(Math.min(-0.42, b.minX - 0.42), 0, 0.5);
  }
  const rugTarget = new THREE.Vector3(1.6, 0, 1.9), tableTarget = new THREE.Vector3(-0.42, 0, 0.5);
  lamp.position.set(-0.95, 0, -0.2);

  // --- Ghost slots ----------------------------------------------------------------------
  const ghostMat = new THREE.MeshBasicMaterial({ color: 0x4f5b3a, transparent: true, opacity: 0.16, depthWrite: false });
  const ghostEdge = new THREE.LineBasicMaterial({ color: 0x4f5b3a, transparent: true, opacity: 0.85 });
  const ghosts = new THREE.Group();
  scene.add(ghosts);
  let hoverSlot = null;
  function setGhosts(layout, kind) {
    ghosts.clear();
    if (!kind) return;
    for (const s of ghostSlots(layout, kind, { center: false })) {
      const w = M(WIDTH[s.kind]), d = M(DEPTH[s.kind]);
      const geo = new THREE.BoxGeometry(w, 0.44, d);
      geo.translate(w / 2, 0.22, d / 2);
      const box = new THREE.Mesh(geo, ghostMat.clone());
      box.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), ghostEdge));
      box.position.set(s.x, 0.002, s.z);
      box.rotation.y = s.rot;
      box.userData.slot = s.slot;
      ghosts.add(box);
    }
  }

  // --- Camera ---------------------------------------------------------------------------
  const VIEW = {
    hero: { dir: [-0.5, 0.36, 1], pad: 1.6, lift: 0.05 },
    plinth: { dir: [-0.2, 0.08, 1], pad: 0.55, lift: -0.1, aim: 'left' },
    fabric: { dir: [0.15, 0.35, 1], pad: 0.42, lift: 0.05, aim: 'seat' },
    evening: { dir: [0.38, 0.36, 1], pad: 1.2, lift: 0 },
    build: { dir: [-0.1, 0.9, 0.85], pad: 1.25, lift: 0 },
  };
  let view = 'hero', frameTarget = null;
  function fit(ps) {
    const b = bounds(ps.length ? ps : [{ kind: 'armless', x: 0, z: 0, rot: 0 }]);
    return { cx: (b.minX + b.maxX) / 2, cz: (b.minZ + b.maxZ) / 2, w: Math.max(1.8, b.maxX - b.minX), d: Math.max(1.0, b.maxZ - b.minZ), minX: b.minX };
  }
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  function cameraFor(f) {
    const v = VIEW[view];
    const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    const vfov = THREE.MathUtils.degToRad(camera.fov);
    const span = Math.max(f.w / Math.min(aspect, 1.9), f.d * 1.1);
    let dist = (span / 2) / Math.tan(vfov / 2) * v.pad + 0.8;
    let look = new THREE.Vector3(f.cx, 0.35 + v.lift, f.cz);
    if (v.aim === 'left') { look.set(f.minX + 0.4, 0.12, f.cz + 0.45); dist = 1.6; }
    if (v.aim === 'seat') { look.set(f.cx - 0.2, 0.42, Math.min(f.cz, 0.7)); dist = 1.25; }
    const dir = new THREE.Vector3(...v.dir).normalize();
    return [look.clone().addScaledVector(dir, dist), look];
  }
  const narrow = () => canvas.clientWidth < 700;
  function frameView() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    // wide screens keep the copy on the left; phones keep the sofa in the upper part of the screen
    if (w > 900) camera.setViewOffset(w, h, -w * 0.16, 0, w, h); else camera.setViewOffset(w, h, 0, h * (view === 'build' ? 0.3 : 0.2), w, h);
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', frameView);
  frameView();

  // --- Picking ----------------------------------------------------------------------------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function hit(clientX, clientY, objs) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObjects(objs, true)[0];
  }
  const slotAt = (x, y) => { let o = hit(x, y, ghosts.children)?.object; while (o && !o.userData.slot) o = o.parent; return o?.userData.slot || null; };
  const pieceAt = (x, y) => { let o = hit(x, y, pieces.filter((p) => p.alive).map((p) => p.g))?.object; while (o && !o.userData.id) o = o.parent; return o?.userData.id || null; };
  let downAt = null;
  canvas.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
  canvas.addEventListener('pointerup', (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
    const s = slotAt(e.clientX, e.clientY);
    if (s) return onGhost?.(s);
    onPick?.(pieceAt(e.clientX, e.clientY));
  });

  // --- Assembly -------------------------------------------------------------------------
  let assembleAt = reducedMotion ? -1 : null;
  const assembleK = (now) => (assembleAt === -1 ? 1 : assembleAt === null ? 0 : clamp((now - assembleAt) / 2.6));
  let selected = null;

  stage.onFrame((dt, now) => {
    const sm = (rate) => Math.min(1, dt * (reducedMotion ? 60 : rate));
    const ak = assembleK(now);
    if (assembleAt !== null && assembleAt !== -1 && ak >= 1) { assembleAt = -1; onAssembled?.(); }
    // walls rise, the rug unrolls, the props settle
    walls.position.y = -3.6 * (1 - ease(clamp(ak * 1.4)));
    rug.scale.set(Math.max(0.001, ease(clamp(ak * 1.6 - 0.35))), 1, 1);
    rug.position.lerp(rugTarget, sm(5));
    sideTable.position.lerp(tableTarget, sm(5));
    sideTable.position.y = 0.6 * (1 - ease(clamp(ak * 1.5 - 0.5)));
    lamp.position.y = 0.6 * (1 - ease(clamp(ak * 1.5 - 0.55)));

    const tNow = performance.now();
    for (const p of pieces) {
      if (!p.alive) {
        const k = clamp((tNow - p.dieAt) / 350);
        p.g.position.y = -0.5 * ease(k);
        if (k >= 1 && p.g.parent) scene.remove(p.g);
        continue;
      }
      const t = p.target;
      const order = Math.max(0, pieces.indexOf(p));
      const gate = assembleAt === null ? 0 : clamp(ak * 2 - 0.6 - order * 0.04);
      p.g.position.x += (t.x - p.g.position.x) * sm(8);
      p.g.position.z += (t.z - p.g.position.z) * sm(8);
      const yT = gate >= 1 || assembleAt === -1 ? 0 : 0.9 * (1 - ease(gate));
      p.g.position.y += (yT - p.g.position.y) * sm(9);
      p.g.rotation.y += (t.rot - p.g.rotation.y) * sm(8);
    }
    ghosts.children.forEach((gh) => {
      const on = gh.userData.slot === hoverSlot;
      gh.material.opacity = (on ? 0.38 : 0.12) + Math.sin(now * 3) * 0.04;
    });

    light += (lightT - light) * sm(2.5);
    const day = 1 - light;
    sun.intensity = 4.2 * day;
    hemi.intensity = 0.25 + 1.15 * day;
    hemi.color.setRGB(0.95 - 0.1 * light, 0.94 - 0.2 * light, 0.91 - 0.35 * light);
    scene.environmentIntensity = 0.06 + 0.29 * day;
    lampLight.intensity = 9 * light;
    wash.intensity = 22 * light;
    shadeMat.emissiveIntensity = 2.2 * light;
    scene.background.setRGB(0.905 - 0.78 * light, 0.89 - 0.79 * light, 0.862 - 0.79 * light);

    if (frameTarget) {
      const [p, look] = cameraFor(frameTarget);
      const intro = assembleAt === null ? 0 : ak;
      const far = 1 + (1 - ease(intro)) * 0.5;
      p.sub(look).multiplyScalar(far).add(look);
      camPos.lerp(p, camPos.lengthSq() ? sm(2.6) : 1);
      camLook.lerp(look, camLook.lengthSq() ? sm(2.6) : 1);
      camera.position.copy(camPos);
      camera.lookAt(camLook);
    }
  });

  try { await renderer.compileAsync(scene, camera); } catch { renderer.compile(scene, camera); }
  stage.start();
  onReady?.();
  return {
    showLayout,
    setFabric(name) { setFabricMaterial(name); },
    setGhosts(layout, kind) { setGhosts(layout, kind); },
    hoverAt(x, y) { hoverSlot = x == null ? null : slotAt(x, y); return hoverSlot; },
    setView(v) { if (VIEW[v] && v !== view) { view = v; frameView(); } },
    setLight(v) { lightT = clamp(v); },
    select(id) {
      selected = id;
      for (const p of pieces) p.g.traverse((o) => { if (o.isMesh && o.material === upholstery && p.id === id) o.material = upholstery; });
    },
    assemble() {
      if (assembleAt === -1) { onAssembled?.(); return; }
      assembleAt = performance.now() / 1000;
    },
    // screen points for the live dimension lines: front-left, front-right and back-right of the layout
    dimAnchors() {
      if (!shown) return null;
      const ps = placements(shown, { center: false });
      if (!ps.filter((p) => p.where !== 'ottoman').length) return null;
      const b = bounds(ps.filter((p) => p.where !== 'ottoman'));
      const w = canvas.clientWidth, h = canvas.clientHeight;
      const pt = (x, z) => { const v = new THREE.Vector3(x, 0.02, z).project(camera); return { x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * h }; };
      return { a: pt(b.minX, b.maxZ + 0.12), b: pt(b.maxX, b.maxZ + 0.12), c: pt(b.maxX + 0.12, b.minZ), d: pt(b.maxX + 0.12, b.maxZ) };
    },
    get selectedId() { return selected; },
    narrow,
  };
}
