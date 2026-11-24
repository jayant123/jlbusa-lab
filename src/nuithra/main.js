// NUITHRA page: the shop works as plain HTML from the Shopify catalog. The 3D collection joins after first paint.
import config from './config.js';
import { createStorefront } from '../kit/storefront.js';
import { fetchProduct, resolveVariant, variantState } from '../kit/catalog.js';
import { createCart } from '../kit/cart.js';
import { mountCheckoutPanel } from '../kit/checkout-panel.js';
import { detectTier, readDevice } from '../kit/tier.js';
import { prefersReducedMotion } from '../kit/env.js';
import { track } from '../kit/track.js';
import { SCENTS, ORDER, TIERS, TIER_LABEL, FAMILIES, SIZES, scentOf, discoveryAttrs } from './scents.js';

const $ = (s) => document.querySelector(s);
const body = document.body;
const reduced = prefersReducedMotion();
const params = new URLSearchParams(location.search);
const SET = 'nuithra-discovery-set';
const money = (n, c = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(n);

let handle = SCENTS[params.get('scent')] ? params.get('scent') : 'nuithra-amber-hour';
let size = '50 ml', products = {}, loaded = false, scene = null;
let picks = ORDER.slice(1, 4);

// --- Commerce ---------------------------------------------------------------------
const sf = createStorefront({ domain: config.domain, token: config.token });
const cart = createCart(sf, config.cartKey);
const panel = mountCheckoutPanel($('#panel-root'), { cart, brand: config.brand, bookingUrl: config.bookingUrl, storePassword: config.password });
const addBtn = $('#add'), setBtn = $('#set-add'), checkoutBtn = $('#checkout'), status = $('#status');

async function loadProducts() {
  status.textContent = 'Prices are loading…';
  try {
    const list = await Promise.all(config.handles.map((h) => fetchProduct(sf, h)));
    products = Object.fromEntries(list.map((p) => [p.handle, p]));
    loaded = true;
    status.textContent = '';
  } catch {
    loaded = false;
    status.innerHTML = 'Couldn\'t load prices. <button type="button" class="n-retry">Try again</button>';
    status.querySelector('.n-retry').addEventListener('click', loadProducts);
  }
  render();
}
const renderCount = () => { checkoutBtn.textContent = `Checkout (${cart.lines().reduce((s, l) => s + l.qty, 0)})`; };
cart.subscribe(renderCount);
cart.restore().catch(() => {});
checkoutBtn.addEventListener('click', () => { panel.open(); track('checkout_panel_open'); });
document.addEventListener('click', (e) => {
  if (e.target.closest('.kit-panel__cta')) track('book_call_click');
  if (e.target.closest('.kit-panel__go')) track('real_checkout_click');
});

async function addVariant(btn, v, label, attrs) {
  btn.disabled = true;
  btn.textContent = 'Adding…';
  try {
    await cart.add(v.id, 1, attrs);
    track('add_to_cart', { variant: v.id, value: v.price, currency: v.currencyCode });
    btn.textContent = 'Added';
    setTimeout(() => { btn.textContent = label; render(); }, 1200);
  } catch (e) {
    status.textContent = e.userMessage || "Couldn't update your cart. Try again.";
    btn.textContent = label;
    render();
  }
}
const current = () => (loaded && products[handle] ? resolveVariant(products[handle], { Size: size }) : null);
addBtn.addEventListener('click', () => { const v = current(); if (v) addVariant(addBtn, v, 'Add to cart'); });
setBtn.addEventListener('click', () => {
  const v = products[SET]?.variants[0], attrs = discoveryAttrs(picks);
  if (v && attrs) addVariant(setBtn, v, 'Add discovery set', attrs);
});

// --- Controls ---------------------------------------------------------------------
const swatch = (h) => `<span class="n-dot" style="--c:${SCENTS[h].glass}"></span>`;
$('#scents').innerHTML = ORDER.map((h) => `<label class="n-opt"><input type="radio" name="scent" value="${h}"${h === handle ? ' checked' : ''}>${swatch(h)}
  <span class="n-opt-name">${SCENTS[h].name}</span><span class="n-opt-sub">${SCENTS[h].mood}</span></label>`).join('');
$('#sizes').innerHTML = SIZES.map((s) => `<label class="n-opt n-size"><input type="radio" name="size" value="${s}"${s === size ? ' checked' : ''}>
  <span class="n-opt-name">${s}</span><span class="n-opt-sub" data-size-price="${s}"></span></label>`).join('');
$('#quick').innerHTML = ORDER.map((h) => `<button type="button" class="n-chip" data-h="${h}" aria-pressed="${h === handle}">${swatch(h)}${SCENTS[h].name}</button>`).join('');
$('#picks').innerHTML = ORDER.map((h) => `<button type="button" class="n-pick" data-h="${h}" aria-pressed="false">${swatch(h)}<span class="n-sr">Include </span>${SCENTS[h].name}</button>`).join('');

function setScent(h) {
  if (!SCENTS[h] || h === handle) return;
  handle = h;
  const r = document.querySelector(`input[name="scent"][value="${h}"]`);
  if (r) r.checked = true;
  scene?.setScent(h);
  track('scent', { scent: SCENTS[h].name });
  render();
}
$('#scents').addEventListener('change', (e) => setScent(e.target.value));
$('#quick').addEventListener('click', (e) => { const b = e.target.closest('.n-chip'); if (b) setScent(b.dataset.h); });
$('#sizes').addEventListener('change', (e) => { size = e.target.value; scene?.setSize(size); render(); });
// Discovery set: up to three picks. A fourth pick replaces the oldest one.
$('#picks').addEventListener('click', (e) => {
  const b = e.target.closest('.n-pick');
  if (!b) return;
  const h = b.dataset.h;
  picks = picks.includes(h) ? picks.filter((p) => p !== h) : [...picks, h].slice(-3);
  render();
});

// Comparison: five families, one bar per scent.
function compareSvg() {
  const W = 420, bar = 5, gap = 3, rowH = ORDER.length * (bar + gap) + 14, left = 64, max = W - left - 10;
  const keyY = FAMILIES.length * rowH + 22;
  let s = `<svg viewBox="0 0 ${W} ${keyY + 46}" role="img" aria-label="Scent profiles: ${ORDER.map((h) => SCENTS[h].name).join(', ')}">`;
  FAMILIES.forEach((f, i) => {
    const y = 8 + i * rowH;
    s += `<text class="fam" x="0" y="${y + 16}">${f}</text>`;
    ORDER.forEach((h, j) => {
      const v = SCENTS[h].profile[f];
      s += `<rect x="${left}" y="${y + j * (bar + gap)}" width="${(v / 5) * max}" height="${bar}" rx="2.5" fill="${SCENTS[h].glass}" class="${h === handle ? 'on' : ''}"/>`;
    });
  });
  s += `<g class="key">${ORDER.map((h, j) => { const x = (j % 3) * 140, y = keyY + Math.floor(j / 3) * 22; return `<circle cx="${x + 5}" cy="${y}" r="5" fill="${SCENTS[h].glass}"/><text x="${x + 15}" y="${y + 4}">${SCENTS[h].name}</text>`; }).join('')}</g></svg>`;
  return s;
}
$('#pyramid').innerHTML = `<thead><tr><th scope="col">Stage</th>${ORDER.map((h) => `<th scope="col">${SCENTS[h].name}</th>`).join('')}</tr></thead><tbody>`
  + TIERS.map((t) => `<tr><th scope="row">${TIER_LABEL[t]}</th>${ORDER.map((h) => `<td>${SCENTS[h].notes[t].join(', ')}</td>`).join('')}</tr>`).join('') + '</tbody>';

function render() {
  const s = scentOf(handle);
  body.dataset.scent = handle;
  body.style.setProperty('--n-glass', s.glass);
  for (const t of TIERS) document.querySelector(`[data-list="${t}"]`).textContent = s.notes[t].join(' · ');
  $('[data-name]').textContent = s.name;
  $('[data-mood]').textContent = s.mood;
  $('[data-bottle]').textContent = s.bottle;
  document.querySelectorAll('.n-chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.h === handle)));
  $('#bar-name').textContent = s.name;
  $('#bar-size').textContent = size;
  $('#compare').innerHTML = compareSvg();
  const v = current();
  const st = variantState(v);
  $('#price').textContent = v ? money(v.price, v.currencyCode) : '';
  addBtn.disabled = !loaded || st !== 'available';
  addBtn.textContent = !loaded ? 'Add to cart' : st === 'available' ? 'Add to cart' : st === 'soldout' ? 'Sold out' : 'Not available';
  if (loaded && st === 'soldout') status.textContent = `${s.name} ${size} is sold out in the demo store. Try another size.`;
  else if (loaded) status.textContent = '';
  document.querySelectorAll('[data-size-price]').forEach((el) => {
    const sv = loaded && products[handle] ? resolveVariant(products[handle], { Size: el.dataset.sizePrice }) : null;
    el.textContent = sv ? (sv.available ? money(sv.price, sv.currencyCode) : 'Sold out') : '';
  });
  document.querySelectorAll('.n-pick').forEach((b) => b.setAttribute('aria-pressed', String(picks.includes(b.dataset.h))));
  const left = 3 - picks.length;
  $('#set-count').textContent = left ? `Pick ${left} more.` : 'Your three are set.';
  const set = products[SET]?.variants[0];
  $('#set-price').textContent = set ? money(set.price, set.currencyCode) : '';
  setBtn.disabled = !set || !set.available || !discoveryAttrs(picks);
}

// --- 3D ---------------------------------------------------------------------------
function fallback() { body.classList.add('no-gl'); body.classList.remove('gl-ready'); }
async function start3d() {
  const device = readDevice();
  const tier = params.get('tier') || detectTier(device);
  if (!device.webgl2) return fallback();
  try {
    const { createNuithraScene } = await import('./scene.js');
    scene = await createNuithraScene($('#gl'), {
      tier, reducedMotion: reduced, onFallback: fallback, still: params.has('still'),
      dragSurfaces: [...document.querySelectorAll('.n-hero, .n-chapter, .n-shop')],
      onPick: (h) => { setScent(h); track('bottle_pick', { scent: SCENTS[h].name }); },
      onReady: () => requestAnimationFrame(() => body.classList.add('gl-ready')),
    });
    if (!scene) return fallback();
    scene.setScent(handle);
    scene.setSize(size);
    await scrollDrive();
  } catch {
    fallback();
  }
}

// Scroll: each chapter has its own camera view. The shop frames the chosen bottle.
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
  const triggers = [];
  const direct = () => {
    if (triggers.length < 4) return;
    const on = triggers.filter((t) => t.st.isActive).pop();
    const v = on ? on.view : 'hero';
    body.dataset.view = v;
    scene.setView(v);
  };
  for (const el of document.querySelectorAll('.n-chapter')) {
    triggers.push({ view: el.dataset.view, st: ScrollTrigger.create({ trigger: el, start: 'top 55%', end: 'bottom 45%', onToggle: direct }) });
  }
  triggers.push({ view: 'shop', st: ScrollTrigger.create({ trigger: '#shop', start: 'top 60%', end: 'bottom top', onToggle: direct }) });
  direct();
}

render();
loadProducts();
// The 3D collection is heavy to set up. The poster is a render of the same scene, so it waits for the visitor's
// first move (scroll, touch, pointer or key) and then takes over. ?gl starts it straight away (used by tests and stills).
let started = false;
const kick = () => {
  if (started) return;
  started = true;
  WAKE.forEach((ev) => window.removeEventListener(ev, kick, true));
  (window.requestIdleCallback || ((fn) => setTimeout(fn, 1)))(start3d, { timeout: 300 });
};
const WAKE = ['pointermove', 'pointerdown', 'touchstart', 'wheel', 'scroll', 'keydown'];
WAKE.forEach((ev) => window.addEventListener(ev, kick, { capture: true, passive: true }));
if (params.has('gl') || params.has('still')) window.addEventListener('load', kick);
