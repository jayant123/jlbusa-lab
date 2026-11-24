// OSTREL page: commerce first (works without 3D), then the scene streams in after first paint.
import config from './config.js';
import { createStorefront } from '../kit/storefront.js';
import { fetchProduct } from '../kit/catalog.js';
import { createCart } from '../kit/cart.js';
import { mountCheckoutPanel } from '../kit/checkout-panel.js';
import { detectTier, readDevice } from '../kit/tier.js';
import { prefersReducedMotion } from '../kit/env.js';
import { track } from '../kit/track.js';
import { createConfigurator } from './configurator.js';

const $ = (s) => document.querySelector(s);
const reduced = prefersReducedMotion();
document.body.dataset.scrub = reduced ? 'off' : 'on';

// --- Commerce -------------------------------------------------------------
const sf = createStorefront({ domain: config.domain, token: config.token });
const cart = createCart(sf, config.cartKey);
const panel = mountCheckoutPanel($('#panel-root'), { cart, brand: config.brand, bookingUrl: config.bookingUrl, storePassword: config.password });
const addBtn = $('#add'), checkoutBtn = $('#checkout');
let scene = null;

const cfg = createConfigurator({
  form: $('#options'), priceEl: $('#price'), addBtn, summaryEl: $('#summary'), statusEl: $('#status'),
  onChange(sel) { scene?.apply(sel); track('configure', sel); },
});

async function loadProduct() {
  cfg.setLoading();
  try {
    cfg.setProduct(await fetchProduct(sf, config.handle));
  } catch {
    cfg.setFailed(loadProduct);
  }
}
loadProduct();

const renderCount = () => { checkoutBtn.textContent = `Checkout (${cart.lines().reduce((s, l) => s + l.qty, 0)})`; };
cart.subscribe(renderCount);
cart.restore().catch(() => {});

addBtn.addEventListener('click', async () => {
  const v = cfg.variant();
  if (!v) return;
  addBtn.disabled = true;
  const label = addBtn.textContent;
  addBtn.textContent = 'Adding…';
  try {
    await cart.add(v.id, 1);
    track('add_to_cart', { variant: v.id, value: v.price, currency: v.currencyCode });
    addBtn.textContent = 'Added';
    setTimeout(() => { addBtn.textContent = label; addBtn.disabled = false; }, 1200);
  } catch (e) {
    $('#status').textContent = e.userMessage || "Couldn't update your cart. Try again.";
    addBtn.textContent = label;
    addBtn.disabled = false;
  }
});
checkoutBtn.addEventListener('click', () => { panel.open(); track('checkout_panel_open'); });
document.addEventListener('click', (e) => {
  if (e.target.closest('.kit-panel__cta')) track('book_call_click');
  if (e.target.closest('.kit-panel__go')) track('real_checkout_click');
});

// --- Explosion controls (work with or without 3D) ---------------------------
let explodeT = 0;
function setExplode(t) {
  explodeT = t;
  document.body.dataset.explode = t >= 0.5 ? '1' : '0';
  scene?.setT(t);
}
document.querySelectorAll('.o-step').forEach((b) => b.addEventListener('click', () => {
  setExplode(Number(b.dataset.go));
  scene?.setMacro(false);
}));

// --- 3D ---------------------------------------------------------------------
function fallback() {
  document.body.classList.add('no-gl');
  document.body.classList.remove('gl-ready');
}

async function start3d() {
  const device = readDevice();
  const tier = detectTier(device);
  if (!device.webgl2) return fallback();
  try {
    const { createOstrelScene } = await import('./scene.js');
    scene = await createOstrelScene($('#gl'), {
      tier, reducedMotion: reduced, onFallback: fallback,
      onReady: () => requestAnimationFrame(() => document.body.classList.add('gl-ready')),
    });
    if (!scene) return fallback();
    scene.apply(cfg.selections());
    scene.setT(explodeT);
    if (!reduced) await scrollDrive();
  } catch {
    fallback();
  }
}

async function scrollDrive() {
  const [{ gsap }, { ScrollTrigger }, { default: Lenis }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger'), import('lenis')]);
  gsap.registerPlugin(ScrollTrigger);
  const lenis = new Lenis({ lerp: 0.1 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  let inConfig = false;
  ScrollTrigger.create({
    trigger: '.o-track', start: 'top 75%', end: 'bottom 85%', scrub: true,
    onUpdate: (st) => { if (!inConfig) setExplode(st.progress); },
  });
  ScrollTrigger.create({
    trigger: '.o-config', start: 'top 55%', end: 'bottom top',
    onToggle: (st) => { inConfig = st.isActive; scene.setConfigView(inConfig); if (inConfig) setExplode(0); else setExplode(1); },
  });
}

const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 200));
if (document.readyState === 'complete') idle(start3d);
else window.addEventListener('load', () => idle(start3d));
