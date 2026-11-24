// Forest settings for the NUITHRA collection (concept alternatives). Everything is procedural: a soft-focus
// forest painted on a canvas behind the bottles, ferns, moss, stone, water, light shafts and fireflies.
// moss: bottles on a mossy boulder in morning sun. pool: a wet stone ledge over a still forest pool.
// dusk: a moss carpet at nightfall with fireflies.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
const R = (a, b) => a + (b - a) * rnd();

function tex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const LOOK = {
  moss: { sky: ['#cfe3a8', '#6f9a4a', '#22381c'], trunk: 'rgba(40,46,30,0.55)', leaf: ['#8fbf5a', '#5d8f3a', '#b9d77a', '#3f6b2a'], glow: 'rgba(255,246,200,0.95)', glowAt: [0.22, 0.12], bokeh: 'rgba(255,250,215,', fog: 0x6e8c55, bg: 0x50703c },
  pool: { sky: ['#9fc4b2', '#3f6d5c', '#0f241e'], trunk: 'rgba(16,30,26,0.6)', leaf: ['#4f8a6a', '#2f5e4a', '#7fb08a', '#1f4535'], glow: 'rgba(220,240,235,0.8)', glowAt: [0.7, 0.2], bokeh: 'rgba(225,245,240,', fog: 0x2f5446, bg: 0x1e3a31 },
  dusk: { sky: ['#2c4a5e', '#13283a', '#05100f'], trunk: 'rgba(3,8,10,0.75)', leaf: ['#1f3d3a', '#16302c', '#2c5048', '#0c1d1b'], glow: 'rgba(150,180,230,0.55)', glowAt: [0.78, 0.1], bokeh: 'rgba(255,214,120,', fog: 0x0a1618, bg: 0x060d10 },
};

// A forest seen with a wide-open lens: trunks and leaves melted into soft shapes, with bokeh where light breaks through.
function forestTex(k) {
  const L = LOOK[k];
  return tex(2048, 1024, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, L.sky[0]); g.addColorStop(0.55, L.sky[1]); g.addColorStop(1, L.sky[2]);
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    const glow = x.createRadialGradient(w * L.glowAt[0], h * L.glowAt[1], 0, w * L.glowAt[0], h * L.glowAt[1], w * 0.45);
    glow.addColorStop(0, L.glow); glow.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = glow; x.fillRect(0, 0, w, h);
    x.filter = 'blur(22px)';
    for (let i = 0; i < 14; i++) { x.fillStyle = L.trunk; const tw = R(30, 140); x.fillRect(R(0, w), -20, tw, h * R(0.7, 1.1)); }
    x.filter = 'blur(30px)';
    for (let i = 0; i < 260; i++) { x.fillStyle = L.leaf[i % 4]; x.globalAlpha = R(0.25, 0.6); x.beginPath(); x.arc(R(0, w), R(0, h * 0.95), R(20, 110), 0, Math.PI * 2); x.fill(); }
    x.globalAlpha = 1;
    x.filter = 'blur(3px)';
    for (let i = 0; i < 140; i++) {
      const near = Math.hypot(rnd() - L.glowAt[0], rnd() - L.glowAt[1]);
      x.fillStyle = `${L.bokeh}${(R(0.12, 0.5) * (1.2 - Math.min(1, near))).toFixed(2)})`;
      x.beginPath(); x.arc(R(0, w), R(0, h * 0.75), R(8, 34), 0, Math.PI * 2); x.fill();
    }
    x.filter = 'none';
  });
}

const mossTex = (dark) => tex(512, 512, (x, w, h) => {
  x.fillStyle = dark ? '#16261a' : '#3d5a24'; x.fillRect(0, 0, w, h);
  const greens = dark ? ['#1f3a26', '#2a4a30', '#123020', '#355a3a'] : ['#5f8a2e', '#7aa53a', '#4a7224', '#8fb848', '#36561c'];
  for (let i = 0; i < 26000; i++) { x.fillStyle = greens[i % greens.length]; x.globalAlpha = R(0.4, 1); x.fillRect(R(0, w), R(0, h), R(1, 3), R(1, 3)); }
  x.globalAlpha = 1;
});
const stoneTex = (wet) => tex(512, 512, (x, w, h) => {
  x.fillStyle = wet ? '#2b3230' : '#7d7d72'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 9000; i++) { const v = R(-30, 30); x.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 250 : 0},${Math.abs(v) / 300})`; x.fillRect(R(0, w), R(0, h), R(1, 5), R(1, 5)); }
});
const radial = (inner, outer) => tex(256, 256, (x, w) => { const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, inner); g.addColorStop(1, outer); x.fillStyle = g; x.fillRect(0, 0, w, w); });

// One fern frond: a stem that rises and arches, with paired leaflets. Each leaflet is a curved lens shape that
// tapers to a point and droops a little. Leaflets shrink toward the tip.
function frondGeo(len = 0.26, n = 28) {
  const P = (t) => new THREE.Vector3(0, Math.sin(t * Math.PI * 0.62) * len * 0.5, t * len);
  const pos = [], col = [];
  const K = 5; // segments along each leaflet
  for (let i = 1; i < n; i++) {
    const t = i / n, c = P(t), dir = P(Math.min(1, t + 0.01)).sub(P(Math.max(0, t - 0.01))).normalize();
    const L = len * 0.15 * (1 - t * 0.82) * Math.min(1, t / 0.1);
    const W = L * 0.22;
    for (const s of [-1, 1]) {
      const side = new THREE.Vector3(s, 0, 0);
      const pts = [];
      for (let k = 0; k <= K; k++) {
        const u = k / K;
        const mid = c.clone().addScaledVector(side, L * u).addScaledVector(dir, L * 0.35 * u).add(new THREE.Vector3(0, -L * 0.45 * u * u, 0));
        const w = W * Math.sin(Math.PI * Math.min(1, u * 1.1));
        pts.push([mid.clone().addScaledVector(dir, w), mid.clone().addScaledVector(dir, -w)]);
      }
      const shade = 0.75 + 0.25 * t;
      for (let k = 0; k < K; k++) {
        const [a1, b1] = pts[k], [a2, b2] = pts[k + 1];
        for (const v of [a1, b1, a2, a2, b1, b2]) { pos.push(v.x, v.y, v.z); col.push(shade, shade, shade); }
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

function ferns(clumps, color, dark) {
  const geo = frondGeo();
  const mat = new THREE.MeshStandardMaterial({ color, vertexColors: true, roughness: 0.7, side: THREE.DoubleSide, emissive: new THREE.Color(color).multiplyScalar(dark ? 0.02 : 0.08) });
  const per = 9, mesh = new THREE.InstancedMesh(geo, mat, clumps.length * per);
  const o = new THREE.Object3D(), tint = new THREE.Color();
  let i = 0;
  for (const [x, z, s] of clumps) {
    for (let k = 0; k < per; k++) {
      o.position.set(x + R(-0.01, 0.01), 0, z + R(-0.01, 0.01));
      o.rotation.set(R(-0.35, -0.1), (k / per) * Math.PI * 2 + R(-0.3, 0.3), 0, 'YXZ');
      o.scale.setScalar(s * R(0.7, 1.15));
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
      mesh.setColorAt(i, tint.set(color).multiplyScalar(R(0.75, 1.2)));
      i++;
    }
  }
  return mesh;
}

function mossMound(x, z, rx, ry, rz, mat) {
  const g = new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const n = 1 + 0.08 * Math.sin(p.getX(i) * 9) * Math.cos(p.getZ(i) * 7); p.setXYZ(i, p.getX(i) * n, p.getY(i) * n, p.getZ(i) * n); }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  m.scale.set(rx, ry, rz);
  m.position.set(x, -0.002, z);
  return m;
}

function shafts(n, color, opacity) {
  const t = tex(64, 512, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    const v = x.createLinearGradient(0, 0, 0, h); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(0.3, 'rgba(0,0,0,1)'); v.addColorStop(1, 'rgba(0,0,0,0)');
    x.globalCompositeOperation = 'destination-in'; x.fillStyle = v; x.fillRect(0, 0, w, h);
  });
  const grp = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(R(0.05, 0.14), 1.1), new THREE.MeshBasicMaterial({ map: t, color, transparent: true, opacity: opacity * R(0.5, 1), blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    m.position.set(-0.35 + i * 0.13 + R(-0.04, 0.04), 0.32, -0.28 + R(-0.05, 0.05));
    m.rotation.z = -0.55;
    grp.add(m);
  }
  return grp;
}

function fireflies(n) {
  const pos = new Float32Array(n * 3), seed = [];
  for (let i = 0; i < n; i++) { seed.push([R(-0.6, 0.6), R(0.01, 0.3), R(-0.45, 0.2), R(0, 6.28), R(0.3, 1)]); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ map: radial('rgba(255,240,170,1)', 'rgba(255,200,80,0)'), color: 0xffe08a, size: 0.018, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const pts = new THREE.Points(g, m);
  pts.userData.update = (t) => {
    seed.forEach(([x, y, z, ph, sp], i) => {
      pos[i * 3] = x + Math.sin(t * 0.3 * sp + ph) * 0.03;
      pos[i * 3 + 1] = y + Math.sin(t * 0.5 * sp + ph * 2) * 0.02;
      pos[i * 3 + 2] = z + Math.cos(t * 0.25 * sp + ph) * 0.03;
    });
    g.attributes.position.needsUpdate = true;
    m.opacity = 0.75 + 0.25 * Math.sin(t * 2.1);
  };
  pts.userData.update(0);
  return pts;
}

export function buildSetting(kind, { scene }) {
  const L = LOOK[kind];
  if (!L) return null;
  const grp = new THREE.Group();
  const updates = [];
  scene.background = new THREE.Color(L.bg);
  scene.fog = new THREE.Fog(L.fog, 0.75, 2.1);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.6), new THREE.MeshBasicMaterial({ map: forestTex(kind), fog: false }));
  back.position.set(0, 0.42, -0.9);
  grp.add(back);
  const dark = kind === 'dusk';
  const moss = new THREE.MeshStandardMaterial({ map: mossTex(dark), roughness: 1, color: dark ? 0x9aa6a0 : 0xffffff });
  moss.map.wrapS = moss.map.wrapT = THREE.RepeatWrapping;
  moss.map.repeat.set(3, 3);
  moss.bumpMap = moss.map; moss.bumpScale = 1.5;

  if (kind === 'moss') {
    // A long flat boulder, mossy at its edges, with ferns behind and to the sides.
    const st = stoneTex(false); st.wrapS = st.wrapT = THREE.RepeatWrapping;
    const slab = new THREE.Mesh(new RoundedBoxGeometry(0.78, 0.09, 0.26, 4, 0.03), new THREE.MeshStandardMaterial({ map: st, roughness: 0.85, bumpMap: st, bumpScale: 2 }));
    slab.position.set(0, -0.045, -0.02);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(4, 3), moss);
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.085;
    grp.add(slab, ground,
      mossMound(-0.42, 0.0, 0.07, 0.035, 0.12, moss), mossMound(0.44, -0.05, 0.08, 0.04, 0.12, moss), mossMound(-0.15, -0.17, 0.2, 0.03, 0.05, moss),
      ferns([[-0.5, -0.16, 1.0], [0.55, -0.24, 1.1], [-0.15, -0.42, 1.25], [0.25, -0.5, 1.3], [0.68, 0.04, 0.75], [-0.7, 0.0, 0.85]], 0x6aa03c, false),
      shafts(6, 0xfff3c4, 0.22));
    grp.children[0].position.y = 0.42;
  } else if (kind === 'pool') {
    // A narrow wet ledge of dark stone. Still water in front holds the reflections. Mist lies on the water.
    const st = stoneTex(true); st.wrapS = st.wrapT = THREE.RepeatWrapping;
    const ledge = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.06, 0.16, 4, 0.015), new THREE.MeshPhysicalMaterial({ map: st, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.1 }));
    ledge.position.set(0, -0.03, -0.04);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(4, 3), new THREE.MeshStandardMaterial({ color: 0x0a1a16, roughness: 0.04, metalness: 0.2, transparent: true, opacity: 0.82 }));
    water.rotation.x = -Math.PI / 2; water.position.y = -0.03;
    const mist = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.3), new THREE.MeshBasicMaterial({ map: radial('rgba(230,245,240,0.55)', 'rgba(230,245,240,0)'), transparent: true, depthWrite: false, fog: false }));
    mist.position.set(0, 0.02, -0.5);
    const bank = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.2), moss);
    bank.rotation.x = -Math.PI / 2; bank.position.set(0, -0.028, -0.72);
    grp.add(ledge, water, mist, bank,
      mossMound(-0.5, -0.06, 0.1, 0.05, 0.08, moss), mossMound(0.5, -0.08, 0.12, 0.05, 0.08, moss),
      ferns([[-0.58, -0.18, 1.3], [0.6, -0.22, 1.3], [-0.25, -0.55, 1.6], [0.3, -0.6, 1.6]], 0x3f7f5a, false),
      shafts(4, 0xe6fff5, 0.12));
  } else {
    // A carpet of moss at nightfall. Ferns in silhouette. Fireflies drift between the bottles.
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(4, 3), moss);
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.001;
    const ff = fireflies(70);
    updates.push(ff.userData.update);
    grp.add(ground,
      mossMound(-0.36, 0.06, 0.12, 0.05, 0.1, moss), mossMound(0.38, -0.02, 0.14, 0.06, 0.12, moss), mossMound(0, -0.2, 0.3, 0.05, 0.07, moss),
      ferns([[-0.48, -0.1, 1.3], [0.5, -0.16, 1.4], [-0.1, -0.38, 1.6], [0.25, -0.42, 1.5], [-0.62, 0.08, 1.1], [0.66, 0.06, 1.1]], 0x2c5a40, true),
      ff);
    scene.add(new THREE.HemisphereLight(0x6c8cc8, 0x0a1410, 0.4));
  }
  scene.add(grp);
  return { group: grp, update: (t) => updates.forEach((u) => u(t)), dark };
}
