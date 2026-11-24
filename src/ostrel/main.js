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
import { cleanEngraving, engravingAttrs, MAX_ENGRAVING } from './engraving.js';

const $ = (s) => document.querySelector(s);
const html = document.documentElement;
const reduced = prefersReducedMotion();
document.body.dataset.scrub = reduced ? 'off' : 'on';

// --- Commerce -------------------------------------------------------------
const sf = createStorefront({ domain: config.domain, token: config.token });
const cart = createCart(sf, config.cartKey);
const panel = mountCheckoutPanel($('#panel-root'), { cart, brand: config.brand, bookingUrl: config.bookingUrl, storePassword: config.password });
const addBtn = $('#add'), checkoutBtn = $('#checkout');
let scene = null;

let prevSel = null;
const cfg = createConfigurator({
  form: $('#options'), priceEl: $('#price'), addBtn, summaryEl: $('#summary'), statusEl: $('#status'),
  onChange(sel) {
    const changed = prevSel && Object.keys(sel).find((k) => sel[k] !== prevSel[k]);
    prevSel = sel;
    scene?.apply(sel);
    if (changed) scene?.focus(changed);
    track('configure', sel);
  },
});
prevSel = cfg.selections();

async function loadProduct() {
  cfg.setLoading();
  try {
    cfg.setProduct(await fetchProduct(sf, config.handle));
  } catch {
    cfg.setFailed(loadProduct);
  }
}
loadProduct();

// Engraving: cleaned as you type, drawn on the 3D caseback and sent to Shopify with the cart line.
const engrave = $('#engrave'), engraveCount = $('#engrave-count');
engrave.addEventListener('input', () => {
  const v = cleanEngraving(engrave.value.replace(/\s+$/, ' '));
  const keepSpace = /\s$/.test(engrave.value) && v.length < MAX_ENGRAVING ? ' ' : '';
  if (engrave.value !== v + keepSpace) engrave.value = v + keepSpace;
  engraveCount.textContent = `${v.length} of ${MAX_ENGRAVING} characters.`;
  scene?.setEngraving(v);
});
engrave.addEventListener('focus', () => scene?.focus('Engraving'));
engrave.addEventListener('blur', () => scene?.focus(null));

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
    const attrs = engravingAttrs(engrave.value);
    await cart.add(v.id, 1, attrs);
    track('add_to_cart', { variant: v.id, value: v.price, currency: v.currencyCode, engraved: !!attrs.Engraving });
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

// Headings and chapters rise into place as they arrive.
if ('IntersectionObserver' in window && !reduced) {
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -12% 0px' });
  document.querySelectorAll('.o-chapter, .o-config h2, .o-specs h2, .o-sheet, .o-deliver, .o-bigmark').forEach((el) => { el.classList.add('rise'); io.observe(el); });
}

// --- Opening sequence -------------------------------------------------------
let introEnded = !html.classList.contains('intro-on');
function endIntro() {
  if (introEnded) return;
  introEnded = true;
  html.classList.add('intro-out');
  setTimeout(() => html.classList.remove('intro-on', 'intro-out'), 1100);
}
if (!introEnded) {
  const skip = () => { scene?.skipIntro(); endIntro(); };
  ['keydown', 'wheel', 'touchstart', 'pointerdown'].forEach((ev) => window.addEventListener(ev, skip, { once: true, passive: true }));
  setTimeout(skip, 6000); // never hold the page behind a slow model
}

// --- Part labels (desktop) --------------------------------------------------
const LABELS = [
  ['crystal', 'Sapphire crystal', 'Domed with AR coating'],
  ['bezel', 'Bezel', 'Polished steel'],
  ['hands_minute', 'Hands', 'Three levels'],
  ['dial', 'Dial', 'Sunburst finish'],
  ['balance_wheel', 'Balance', 'Beats at 4 Hz'],
  ['movement_plate', 'Movement', '70-hour reserve'],
  ['case', 'Case', '40 × 11.5 mm'],
];
const labelsRoot = $('.o-labels'), leaders = $('.o-leaders');
const labelEls = LABELS.map(([k, name, spec]) => {
  const el = document.createElement('div');
  el.className = 'o-label';
  el.innerHTML = `<b>${name}</b><span>${spec}</span>`;
  labelsRoot.appendChild(el);
  return { k, el };
});
function drawLabels() {
  requestAnimationFrame(drawLabels);
  if (!scene) return;
  const { t, night, flip } = scene.state();
  const show = innerWidth > 900 && t > 0.45 && night < 0.1 && flip < 0.1;
  labelsRoot.classList.toggle('on', show);
  if (!show) return;
  // Labels sit in the open space between the chapter copy and the watch, right-aligned to a column.
  const a = scene.anchors(LABELS.map(([k]) => k), -1);
  const colR = Math.min(...Object.values(a).map((p) => p.x)) - 64;
  const copyR = (document.querySelector('.o-track .o-chapter')?.getBoundingClientRect().right || 480) + 24;
  if (colR - 170 < copyR) { labelsRoot.classList.remove('on'); return; }
  const rows = labelEls.filter(({ k }) => a[k]).map(({ k, el }) => ({ k, el, ax: a[k].x, ay: a[k].y, y: a[k].y })).sort((p, q) => p.ay - q.ay);
  for (let i = 1; i < rows.length; i++) rows[i].y = Math.max(rows[i].y, rows[i - 1].y + 46);
  let paths = '';
  for (const r of rows) {
    r.el.style.transform = `translate(${(colR - r.el.offsetWidth).toFixed(1)}px, ${(r.y - 18).toFixed(1)}px)`;
    paths += `<path d="M${r.ax.toFixed(1)} ${r.ay.toFixed(1)} L${(colR + 34).toFixed(1)} ${r.y.toFixed(1)} L${(colR + 8).toFixed(1)} ${r.y.toFixed(1)}"/><circle cx="${r.ax.toFixed(1)}" cy="${r.ay.toFixed(1)}" r="2.5"/>`;
  }
  leaders.innerHTML = paths;
}

// --- 3D ---------------------------------------------------------------------
function fallback() {
  document.body.classList.add('no-gl');
  document.body.classList.remove('gl-ready');
  endIntro();
}

async function start3d() {
  const device = readDevice();
  const tier = detectTier(device);
  if (!device.webgl2) return fallback();
  try {
    const { createOstrelScene } = await import('./scene.js');
    scene = await createOstrelScene($('#gl'), {
      tier, reducedMotion: reduced, onFallback: fallback, intro: !introEnded,
      dragSurfaces: [...document.querySelectorAll('.o-hero, .o-back, .o-config')],
      onReady: () => requestAnimationFrame(() => document.body.classList.add('gl-ready')),
    });
    if (!scene) return fallback();
    if (/[?&]debug/.test(location.search)) window.__ostrel = scene;
    scene.apply(cfg.selections());
    scene.setEngraving(cleanEngraving(engrave.value));
    scene.setT(explodeT);
    if (!introEnded) { endIntro(); scene.playIntro(); }
    requestAnimationFrame(drawLabels);
    await scrollDrive();
  } catch {
    fallback();
  }
}

// Scroll director: each section owns one piece of the watch's state.
async function scrollDrive() {
  const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')]);
  gsap.registerPlugin(ScrollTrigger);
  if (!reduced) {
    const { default: Lenis } = await import('lenis');
    const lenis = new Lenis({ lerp: 0.1 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  const ramp = (p) => Math.min(1, p / 0.3) * Math.min(1, (1 - p) / 0.2);
  const st = {};
  const direct = () => {
    if (!st.config) return; // triggers fire while they are being created
    const night = st.night.isActive ? ramp(st.night.progress) : 0;
    const flip = st.back.isActive ? ramp(st.back.progress) : 0;
    const inConfig = st.config.isActive;
    scene.setNight(night);
    scene.setFlip(flip);
    scene.setConfigView(inConfig);
    document.body.dataset.night = night > 0.5 ? '1' : '0';
    if (st.track.isActive) setExplode(st.track.progress);
    else if (explodeT !== 0) setExplode(0);
  };
  const mk = (trigger, start, end) => ScrollTrigger.create({ trigger, start, end, onUpdate: direct, onToggle: direct });
  st.track = mk('.o-track', 'top 75%', 'bottom 70%');
  st.night = mk('.o-night', 'top 70%', 'bottom 30%');
  st.back = mk('.o-back', 'top 70%', 'bottom 30%');
  st.config = mk('.o-config', 'top 55%', 'bottom 40%');
  direct();
}

const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 200));
if (document.readyState === 'complete') idle(start3d);
else window.addEventListener('load', () => idle(start3d));
