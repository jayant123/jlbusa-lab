// NUITHRA page: the shop works as plain HTML from the Shopify catalog. The 3D bottle and its botanicals join after first paint.
import config from './config.js';
import { createStorefront } from '../kit/storefront.js';
import { fetchProduct, resolveVariant, variantState } from '../kit/catalog.js';
import { createCart } from '../kit/cart.js';
import { mountCheckoutPanel } from '../kit/checkout-panel.js';
import { detectTier, readDevice } from '../kit/tier.js';
import { prefersReducedMotion } from '../kit/env.js';
import { track } from '../kit/track.js';
import { SCENTS, TIERS, TIER_LABEL, FAMILIES, SIZES, scentOf } from './scents.js';

const $ = (s) => document.querySelector(s);
const body = document.body;
const reduced = prefersReducedMotion();
const SET = 'nuithra-discovery-set';
const money = (n, c = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(n);
const HANDLES = Object.keys(SCENTS);

let handle = HANDLES[0], size = '50 ml', products = {}, loaded = false, scene = null;

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

async function addVariant(btn, v, label) {
  btn.disabled = true;
  btn.textContent = 'Adding…';
  try {
    await cart.add(v.id, 1);
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
setBtn.addEventListener('click', () => { const v = products[SET]?.variants[0]; if (v) addVariant(setBtn, v, 'Add discovery set'); });

// --- Controls ---------------------------------------------------------------------
const swatch = (h) => `<span class="n-dot" style="--c:${SCENTS[h].liquid}"></span>`;
$('#scents').innerHTML = HANDLES.map((h) => `<label class="n-opt"><input type="radio" name="scent" value="${h}"${h === handle ? ' checked' : ''}>${swatch(h)}
  <span class="n-opt-name">${SCENTS[h].name}</span><span class="n-opt-sub">${SCENTS[h].mood}</span></label>`).join('');
$('#sizes').innerHTML = SIZES.map((s) => `<label class="n-opt n-size"><input type="radio" name="size" value="${s}"${s === size ? ' checked' : ''}>
  <span class="n-opt-name">${s}</span><span class="n-opt-sub" data-size-price="${s}"></span></label>`).join('');
$('#quick').innerHTML = HANDLES.map((h) => `<button type="button" class="n-chip" data-h="${h}" aria-pressed="${h === handle}">${swatch(h)}${SCENTS[h].name}</button>`).join('');

function setScent(h) {
  if (!SCENTS[h] || h === handle) return;
  handle = h;
  const r = document.querySelector(`input[name="scent"][value="${h}"]`);
  if (r) r.checked = true;
  scene?.setScent(h, size);
  track('scent', { scent: SCENTS[h].name });
  render();
}
$('#scents').addEventListener('change', (e) => setScent(e.target.value));
$('#quick').addEventListener('click', (e) => { const b = e.target.closest('.n-chip'); if (b) setScent(b.dataset.h); });
$('#sizes').addEventListener('change', (e) => { size = e.target.value; scene?.setSize(size); render(); });

// Comparison: five families, one bar per scent.
function compareSvg() {
  const W = 420, rowH = 34, left = 64, barW = (W - left - 10) / 5;
  const hs = HANDLES;
  let s = `<svg viewBox="0 0 ${W} ${FAMILIES.length * rowH + 34}" role="img" aria-label="Scent profiles: ${hs.map((h) => SCENTS[h].name).join(', ')}">`;
  FAMILIES.forEach((f, i) => {
    const y = 10 + i * rowH;
    s += `<text class="fam" x="0" y="${y + 14}">${f}</text>`;
    hs.forEach((h, j) => {
      const v = SCENTS[h].profile[f];
      s += `<rect x="${left}" y="${y + j * 7}" width="${(v / 5) * barW * 5}" height="5" rx="2.5" fill="${SCENTS[h].liquid}" class="${h === handle ? 'on' : ''}"/>`;
    });
  });
  s += `<g class="key">${hs.map((h, j) => `<circle cx="${left + j * 120 + 5}" cy="${FAMILIES.length * rowH + 22}" r="5" fill="${SCENTS[h].liquid}"/><text x="${left + j * 120 + 15}" y="${FAMILIES.length * rowH + 26}">${SCENTS[h].name}</text>`).join('')}</g></svg>`;
  return s;
}
$('#pyramid').innerHTML = `<thead><tr><th scope="col">Stage</th>${HANDLES.map((h) => `<th scope="col">${SCENTS[h].name}</th>`).join('')}</tr></thead><tbody>`
  + TIERS.map((t) => `<tr><th scope="row">${TIER_LABEL[t]}</th>${HANDLES.map((h) => `<td>${SCENTS[h].notes[t].join(', ')}</td>`).join('')}</tr>`).join('') + '</tbody>';

function render() {
  const s = scentOf(handle);
  body.dataset.scent = handle;
  for (const t of TIERS) document.querySelector(`[data-list="${t}"]`).textContent = s.notes[t].join(' · ');
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
  const set = products[SET]?.variants[0];
  $('#set-price').textContent = set ? money(set.price, set.currencyCode) : '';
  setBtn.disabled = !set || !set.available;
}

// --- 3D ---------------------------------------------------------------------------
function fallback() { body.classList.add('no-gl'); body.classList.remove('gl-ready'); }
async function start3d() {
  const device = readDevice();
  const tier = detectTier(device);
  if (!device.webgl2) return fallback();
  try {
    const { createNuithraScene } = await import('./scene.js');
    scene = await createNuithraScene($('#gl'), {
      tier, reducedMotion: reduced, onFallback: fallback,
      dragSurfaces: [...document.querySelectorAll('.n-hero, .n-shop')],
      onReady: () => requestAnimationFrame(() => body.classList.add('gl-ready')),
    });
    if (!scene) return fallback();
    scene.setScent(handle, size);
    scene.setSize(size);
    await scrollDrive();
  } catch {
    fallback();
  }
}

// Scroll: each stage brings its ring of botanicals forward. The shop frames the bottle.
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
  const st = {};
  const bell = (p) => Math.min(1, p / 0.25) * Math.min(1, (1 - p) / 0.25);
  const direct = () => {
    if (!st.shop) return;
    const focus = {};
    let view = 'hero';
    for (const t of TIERS) { focus[t] = st[t].isActive ? bell(st[t].progress) : 0; if (focus[t] > 0.3) view = t; }
    if (st.shop.isActive) view = 'shop';
    scene.setFocus(focus);
    scene.setView(view);
  };
  for (const t of TIERS) st[t] = ScrollTrigger.create({ trigger: `.n-tier[data-tier="${t}"]`, start: 'top 65%', end: 'bottom 35%', onUpdate: direct, onToggle: direct });
  st.shop = ScrollTrigger.create({ trigger: '#shop', start: 'top 60%', end: 'bottom top', onUpdate: direct, onToggle: direct });
  direct();
}

render();
loadProducts();
const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 200));
if (document.readyState === 'complete') idle(start3d);
else window.addEventListener('load', () => idle(start3d));
