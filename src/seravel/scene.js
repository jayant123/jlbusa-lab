// SERAVEL 3D: the Solace ring on dark navy velvet. Visitors swap the metal and the stone, turn the ring, look at the
// stone up close and read their engraving inside the band. Small studio lights all around give the facets fire.
// Glass-like refraction runs on stronger devices. Lighter devices get a bright cut-glass look with sparkle points.
import * as THREE from 'three';
import { createStage } from '../kit/stage.js';
import { METALS, STONES } from './jewels.js';

const S = 10; // the model is in meters. Scale it up so the camera works at a comfortable range.
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

// A jeweler's light tent: two tall soft boxes, a top light and a ring of small bright cards.
function studio() {
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshBasicMaterial({ color: 0x1a2133, side: THREE.BackSide })));
  // A warm floor bounce so the inside of the band never goes black.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshBasicMaterial({ color: 0x4a4238, side: THREE.DoubleSide }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -2; env.add(floor);
  const card = (w, h, k, pos, color = 0xffffff) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  card(0.6, 5, 4, [-3.2, 1, 1.8]);
  card(0.5, 5, 3.4, [3.4, 0.8, 1.2], 0xfff1e2);
  card(3, 0.4, 2, [0, 4.2, 0.5]);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2, y = -0.6 + (i % 3) * 1.2;
    card(0.25 + (i % 2) * 0.2, 0.25 + (i % 3) * 0.2, 5 + (i % 4), [Math.cos(a) * 3.6, y, Math.sin(a) * 3.6]);
  }
  return env;
}

// The stone's own reflections: black with many small hard white lights, so facets flash between dark and bright.
function gemStudio() {
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshBasicMaterial({ color: 0x262a33, side: THREE.BackSide })));
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 220; i++) {
    const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = Math.sqrt(1 - u * u);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.25 + rnd() * 0.6, 0.25 + rnd() * 0.6), new THREE.MeshBasicMaterial({ color: rnd() < 0.3 ? new THREE.Color(0x05060a) : new THREE.Color(1, 0.98, 0.95).multiplyScalar(3 + rnd() * 8), side: THREE.DoubleSide }));
    m.position.set(Math.cos(a) * r * 3.5, u * 3.5, Math.sin(a) * r * 3.5);
    m.lookAt(0, 0, 0);
    env.add(m);
  }
  return env;
}

function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const glint = () => canvasTex(128, 128, (x, w) => {
  const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.15, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, w, w);
  x.globalCompositeOperation = 'lighter';
  x.fillStyle = 'rgba(255,255,255,0.9)';
  x.fillRect(w / 2 - 1, 4, 2, w - 8); x.fillRect(4, w / 2 - 1, w - 8, 2);
});

// Engraving: dark letters on a strip that follows the inside of the band. The canvas is the strip unrolled.
function engravingTex(text) {
  return canvasTex(2048, 128, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    x.fillStyle = 'rgba(30,20,6,0.9)';
    x.font = '500 78px "Hanken Grotesk", system-ui, sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.save();
    x.translate(w / 2, h / 2);
    x.scale(1, -1); // upright when seen through the front of the ring
    x.fillText(text.split('').join(String.fromCharCode(8202)), 0, 4);
    x.restore();
  });
}

export async function createSeravelScene(canvas, { tier, reducedMotion, onReady, onFallback, dragSurfaces = [] }) {
  const stage = createStage(canvas, { tier, fov: 26, minDpr: 1, createRenderer: (c) => {
    const r = new THREE.WebGLRenderer({ canvas: c, antialias: true, powerPreference: 'high-performance' });
    r.toneMapping = THREE.AgXToneMapping;
    r.toneMappingExposure = 1.15;
    r.outputColorSpace = THREE.SRGBColorSpace;
    return r;
  } });
  stage.on('fallback', onFallback);
  if (!stage.ok) return null;
  const { scene, camera, renderer } = stage;
  const rich = tier !== 'low';
  scene.background = new THREE.Color(0x070b16);
  scene.fog = new THREE.Fog(0x070b16, 1.2, 3.2);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(studio(), 0.01).texture;
  const gemEnv = pmrem.fromScene(gemStudio(), 0).texture;

  // Velvet: a dark navy floor that falls off into the background.
  const velvet = new THREE.Mesh(new THREE.CircleGeometry(3, 64), new THREE.MeshStandardMaterial({ color: 0x0d1526, roughness: 1, envMapIntensity: 0.05 }));
  velvet.rotation.x = -Math.PI / 2;
  const key = new THREE.SpotLight(0xfff4ea, 18, 6, 0.5, 0.9, 1.4);
  key.position.set(-0.6, 1.2, 0.9);
  const rim = new THREE.PointLight(0xbcd0ff, 2, 3, 1.5);
  rim.position.set(0.5, 0.5, -0.6);
  scene.add(velvet, key, key.target, rim, new THREE.HemisphereLight(0x8090b0, 0x05070d, 0.25));
  const pool = new THREE.Mesh(new THREE.CircleGeometry(0.42, 48), new THREE.MeshBasicMaterial({ color: 0x182340, transparent: true, opacity: 0.35, depthWrite: false }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.0005;
  scene.add(pool);

  // Ring.
  const gltf = await stage.load(`/seravel/ring-${tier === 'low' ? 'low' : 'high'}.glb`);
  const ring = gltf.scene;
  ring.scale.setScalar(S);
  const holder = new THREE.Group();
  holder.add(ring);
  scene.add(holder);
  const metal = new THREE.MeshPhysicalMaterial({ color: METALS['Yellow gold'].color, metalness: 1, roughness: 0.1, envMapIntensity: 2.2 });
  // A live scene cannot trace light bouncing inside a cut stone. So the stone is drawn as a bright mirror-cut gem:
  // every facet reflects the studio cards, with a thin film for the rainbow fire. Colored stones add their tint.
  // High and mid tiers: a real transmissive stone like the NUITHRA glass. It refracts the velvet and the gold under
  // it, splits light into color with dispersion and reflects the jeweler's light tent. A mirrored inner layer behind it
  // adds the bright second bounce that a cut stone shows. The low tier keeps the cheaper two-layer mirror cut.
  const stone = rich
    ? new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 1, thickness: 0.06, ior: 2.42, roughness: 0, dispersion: 1.0,
        specularIntensity: 1, envMap: gemEnv, envMapIntensity: 2.6, attenuationColor: 0xffffff, attenuationDistance: 1, flatShading: true })
    : new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 1, roughness: 0, envMapIntensity: 3.2, envMap: gemEnv,
        iridescence: 0.45, iridescenceIOR: 2.2, iridescenceThicknessRange: [250, 700], flatShading: true, transparent: true, opacity: 0.72, depthWrite: false });
  const stoneBack = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 1, roughness: 0, envMapIntensity: rich ? 1.1 : 4.2, envMap: gemEnv,
    side: THREE.BackSide, flatShading: true, envMapRotation: new THREE.Euler(0.9, 2.1, 0.4), iridescence: 0.35, iridescenceIOR: 2.0 });
  let stoneMesh = null;
  const backs = [];
  ring.traverse((o) => {
    if (!o.isMesh) return;
    if (o.name.startsWith('stone') || o.parent?.name === 'stone') {
      o.material = stone; stoneMesh = o; o.renderOrder = 3;
      const b = new THREE.Mesh(o.geometry, stoneBack);
      b.renderOrder = 2;
      backs.push([o, b]);
    } else o.material = metal;
  });
  for (const [o, b] of backs) o.add(b);
  // The ring stands on its band. Lift it so the bottom of the band rests on the velvet.
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(holder);
  holder.position.y = -box.min.y;
  const top = box.max.y - box.min.y;
  const bandR = 0.00865 * S;
  scene.updateMatrixWorld(true);

  // Sparkle: small star glints on the crown that flare as the ring turns past the lights.
  const sparkGeo = new THREE.BufferGeometry();
  const N = 9, sp = new Float32Array(N * 3), seed = [];
  const stoneTop = new THREE.Box3().setFromObject(stoneMesh || ring);
  const sc = stoneTop.getCenter(new THREE.Vector3()), sr = (stoneTop.max.x - stoneTop.min.x) / 2;
  for (let i = 0; i < N; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * sr * 0.85;
    seed.push({ a, r, ph: Math.random() * 6.28, k: 0.6 + Math.random() * 0.8 });
  }
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const sizes = new Float32Array(N);
  sparkGeo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  const sparkMat = new THREE.PointsMaterial({ map: glint(), size: 0.014, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, sizeAttenuation: true, color: 0xffffff });
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  sparks.renderOrder = 10;
  scene.add(sparks);

  // Engraving strip on the inside of the band.
  let engraveTex = engravingTex('');
  // The band's axis points at the camera (glTF -Z) and its center is the holder origin. The strip covers the
  // lower inside of the band, where the inside view looks.
  const strip = new THREE.Mesh(new THREE.CylinderGeometry(bandR * 0.998, bandR * 0.998, 0.0012 * S, 96, 1, true, -Math.PI * 0.45, Math.PI * 0.9),
    new THREE.MeshBasicMaterial({ map: engraveTex, transparent: true, depthWrite: false, side: THREE.BackSide }));
  strip.rotation.x = Math.PI / 2;
  holder.add(strip);

  // --- Views: [position, target] in the ring's frame (band center at y = bandR + band thickness). -------------
  const cy = holder.position.y; // band center height above the velvet
  const VIEW = {
    front: [[0.22, top * 0.8, 0.82], [0, top * 0.55, 0]],
    macro: [[0.08, top + 0.22, 0.36], [0, top - 0.035, 0]],
    inside: [[0.0, cy + 0.05, 0.27], [0, cy - bandR * 0.9, 0]],
    top: [[0.0, top + 0.5, 0.06], [0, top - 0.05, 0]],
  };
  let view = 'front';

  // --- State and interaction -----------------------------------------------------------------------------------
  const metalT = new THREE.Color(METALS['Yellow gold'].color);
  let yaw = 0.5, yawVel = 0, drag = null;
  const fine = matchMedia('(pointer: fine)').matches && !reducedMotion;
  let ptr = [0, 0], tilt = [0, 0], active = true;
  if (fine) window.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') ptr = [e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1]; });
  const SKIP = 'input,button,a,label,select,textarea,summary,.kit-panel,.s-config';
  for (const el of dragSurfaces) el.addEventListener('pointerdown', (e) => { if (!e.button && !e.target.closest(SKIP)) drag = { id: e.pointerId, x: e.clientX, y: e.clientY, yaw, on: false, lx: e.clientX }; });
  window.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    if (!drag.on && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(e.clientY - drag.y) * 1.2) drag.on = true;
    if (!drag.on) return;
    yaw = drag.yaw + dx * 0.01;
    yawVel = (e.clientX - drag.lx) * 0.01;
    drag.lx = e.clientX;
  });
  window.addEventListener('pointerup', () => { drag = null; });

  function setMetal(name) { metalT.set((METALS[name] || METALS['Yellow gold']).color); }
  function setStone(name) {
    const s = STONES[name] || STONES.Diamond;
    const c = new THREE.Color(s.color);
    const diamond = name === 'Diamond';
    if (rich) {
      stone.ior = s.ior;
      stone.dispersion = diamond ? 1.0 : 0.4;
      stone.attenuationColor.set(0xffffff).lerp(c, diamond ? 0 : 1);
      stone.attenuationDistance = diamond ? 1 : 0.03;
      stone.color.set(0xffffff).lerp(c, diamond ? 0 : 0.25);
    } else {
      stone.color.set(0xffffff).lerp(c, diamond ? 0 : 0.7);
      stone.iridescence = diamond ? 0.45 : 0.15;
    }
    stoneBack.color.set(0xffffff).lerp(c, diamond ? 0 : 0.95);
    stoneBack.emissive.copy(c).multiplyScalar(diamond ? 0 : 0.25);
    stoneBack.iridescence = diamond ? 0.35 : 0.05;
    sparkMat.color.set(diamond ? 0xffffff : new THREE.Color(0xffffff).lerp(c, 0.35));
  }
  function setEngraving(text) {
    engraveTex.dispose();
    engraveTex = engravingTex(text || '');
    strip.material.map = engraveTex;
    strip.material.needsUpdate = true;
  }

  // Phones: the ring sits in the top half, above the controls.
  function frame() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w > 900) camera.setViewOffset(w, h, -w * 0.2, 0, w, h); else camera.setViewOffset(w, h, 0, h * 0.22, w, h);
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', frame);
  frame();
  const far = () => (canvas.clientWidth < 700 ? (view === "front" ? 2.2 : 1.6) : 1);

  const camPos = new THREE.Vector3(...VIEW.front[0]), camLook = new THREE.Vector3(...VIEW.front[1]);
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), view3 = new THREE.Vector3(), lightDirs = [new THREE.Vector3(-0.6, 0.6, 0.5).normalize(), new THREE.Vector3(0.7, 0.4, 0.3).normalize(), new THREE.Vector3(0, 1, 0.2).normalize()];
  stage.onFrame((dt, now) => {
    const sm = (rate) => Math.min(1, dt * (reducedMotion ? 60 : rate));
    metal.color.lerp(metalT, sm(4));
    if (!drag) { yaw += yawVel; yawVel *= 0.92; if (!reducedMotion && view !== 'inside' && Math.abs(yawVel) < 0.001) yaw += dt * 0.18; }
    const yawT = view === 'inside' ? 0 : yaw;
    holder.rotation.y += (yawT - holder.rotation.y) * (view === 'inside' ? sm(4) : 1);
    tilt = [tilt[0] + (ptr[0] - tilt[0]) * sm(3), tilt[1] + (ptr[1] - tilt[1]) * sm(3)];

    const [p, g] = VIEW[view];
    tmp.set(...g);
    tmp2.set(...p).sub(tmp).multiplyScalar(far()).add(tmp);
    tmp2.x += tilt[0] * -0.03; tmp2.y += tilt[1] * -0.02;
    camPos.lerp(tmp2, sm(2.6));
    camLook.lerp(tmp, sm(2.6));
    camera.position.copy(camPos);
    camera.lookAt(camLook);

    // Glints: each one flares when its facet would bounce a light into the camera.
    view3.copy(camera.position).sub(sc).normalize();
    seed.forEach((s, i) => {
      const a = s.a + holder.rotation.y;
      sp[i * 3] = Math.cos(a) * s.r;
      sp[i * 3 + 1] = sc.y + 0.004 + Math.sin(s.ph) * 0.002;
      sp[i * 3 + 2] = Math.sin(a) * s.r;
      const nrm = tmp.set(Math.cos(a + s.ph) * 0.6, 1, Math.sin(a + s.ph) * 0.6).normalize();
      let f = 0;
      for (const L of lightDirs) {
        const h = tmp2.copy(L).add(view3).normalize();
        f = Math.max(f, Math.pow(clamp(h.dot(nrm)), 60 * s.k));
      }
      sizes[i] = f;
      if (f < 0.35) sp[i * 3 + 1] = -10; // only facets that flash show a glint
    });
    sparkGeo.attributes.position.needsUpdate = true;
    const glow = seed.reduce((m, _, i) => Math.max(m, sizes[i]), 0);
    sparkMat.opacity = view === 'inside' ? 0 : 0.95;
    sparkMat.size = ((view === 'macro' ? 0.008 : 0.014) + glow * 0.01) * (canvas.clientWidth < 700 ? 1.8 : 1); // phones sit farther back
  });

  try { await renderer.compileAsync(scene, camera); } catch { renderer.compile(scene, camera); }
  stage.start();
  onReady?.();
  return {
    setMetal, setStone, setEngraving,
    setView(v) { if (VIEW[v]) view = v; },
    setActive(on) { if (on !== active) { active = on; on ? stage.start() : stage.stop(); } },
  };
}
