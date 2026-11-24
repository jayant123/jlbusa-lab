// WebGL stage shared by the concepts: renderer, camera, environment, GLB loading, adaptive resolution,
// and a single 'fallback' event when 3D can't run (no renderer, lost context, failed load).
import * as THREE from 'three';
import { nextPixelRatio } from './tier.js';

const MAX_DPR = { low: 1, mid: 1.5, high: 2 };

function defaultRenderer(canvas, tier) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: tier !== 'low', alpha: false, powerPreference: 'high-performance' });
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.outputColorSpace = THREE.SRGBColorSpace;
  return r;
}

export function createStage(canvas, { tier = 'mid', envUrl, createRenderer = defaultRenderer, fov = 30 } = {}) {
  const listeners = { fallback: new Set(), frame: new Set() };
  let fellBack = false;
  const fallback = (reason) => {
    if (fellBack) return;
    fellBack = true;
    stage.ok = false;
    listeners.fallback.forEach((fn) => fn(reason));
  };

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.005, 50);
  let renderer = null;
  const stage = { scene, camera, renderer: null, ok: true, tier, three: THREE };

  try {
    renderer = createRenderer(canvas, tier);
    stage.renderer = renderer;
  } catch (e) {
    stage.ok = false;
    queueMicrotask(() => { fellBack = false; fallback(e); });
  }
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault?.(); fallback(new Error('context lost')); });

  let dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR[tier]);
  const resize = () => {
    if (!renderer) return;
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  if (renderer) { resize(); window.addEventListener('resize', resize); }

  let last = 0, acc = 0, n = 0;
  const loop = (t) => {
    const dt = last ? t - last : 16.7;
    last = t;
    acc += dt; n += 1;
    if (n === 30) { // adapt resolution every 30 frames
      const next = nextPixelRatio(dpr, acc / n, { max: MAX_DPR[tier] });
      if (next !== dpr) { dpr = next; resize(); }
      acc = 0; n = 0;
    }
    listeners.frame.forEach((fn) => fn(dt / 1000, t / 1000));
    renderer.render(scene, camera);
  };

  let gltfLoader = null;
  async function loader() {
    if (gltfLoader) return gltfLoader;
    const [{ GLTFLoader }, { KTX2Loader }, { MeshoptDecoder }] = await Promise.all([
      import('three/addons/loaders/GLTFLoader.js'),
      import('three/addons/loaders/KTX2Loader.js'),
      import('three/addons/libs/meshopt_decoder.module.js'),
    ]);
    const ktx2 = new KTX2Loader().setTranscoderPath(`${import.meta.env.BASE_URL}basis/`).detectSupport(renderer);
    gltfLoader = new GLTFLoader().setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);
    return gltfLoader;
  }

  Object.assign(stage, {
    on(event, fn) { listeners[event].add(fn); return () => listeners[event].delete(fn); },
    onFrame(fn) { return stage.on('frame', fn); },
    start() { renderer?.setAnimationLoop(loop); },
    stop() { renderer?.setAnimationLoop(null); },
    resize,
    async load(url) {
      try {
        return await (await loader()).loadAsync(url);
      } catch (e) {
        fallback(e);
        throw e;
      }
    },
    async environment(url, { background = false } = {}) {
      const { HDRLoader } = await import('three/addons/loaders/HDRLoader.js');
      const tex = await new HDRLoader().loadAsync(url);
      tex.mapping = THREE.EquirectangularReflectionMapping;
      scene.environment = tex;
      if (background) scene.background = tex;
      return tex;
    },
    dispose() { stage.stop(); window.removeEventListener('resize', resize); renderer?.dispose(); },
  });
  if (envUrl) stage.environment(envUrl).catch(() => {});
  return stage;
}
