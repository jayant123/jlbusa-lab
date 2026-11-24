// VANTRIK store page. The shop works as plain HTML from the Shopify catalog. The 3D shoe joins after the visitor's
// first move. It shows in the product section and in the custom designer.
import config from './config.js';
import { createStorefront } from '../kit/storefront.js';
import { fetchProduct, resolveVariant, variantState } from '../kit/catalog.js';
import { createCart } from '../kit/cart.js';
import { mountCheckoutPanel } from '../kit/checkout-panel.js';
import { detectTier, readDevice } from '../kit/tier.js';
import { prefersReducedMotion } from '../kit/env.js';
import { track } from '../kit/track.js';
import { PARTS, PALETTE, MODELS, CUSTOM, CUSTOM_START, SIZES, colorwayOf, customAttrs, sizeFor } from './parts.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const body = document.body;
const reduced = prefersReducedMotion();
const params = new URLSearchParams(location.search);
const money = (n, c = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(n);
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

const COPY = {
  'vantrik-vk1-runner': {
    desc: 'A light runner for long days. The knit upper stretches where your foot bends. The foam is thick under the heel and thinner at the toe.',
    materials: 'Upper: recycled polyester knit with a coated mudguard. Overlays: synthetic suede, stitched. Midsole: EVA blend foam. Outsole: rubber that wraps up the toe and heel. Laces: cotton.',
  },
  'vantrik-vk2-court': {
    desc: 'A low court shoe in full-grain leather. The rubber cupsole is stitched to the upper. It looks better after a few months of wear.',
    materials: 'Upper: full-grain cow leather with a perforated toe box. Lining: cotton canvas. Cupsole: natural rubber stitched to the upper. Laces: waxed cotton.',
  },
};

let model = MODELS[params.get('shoe')] ? params.get('shoe') : 'vantrik-vk1-runner';
let cw = Object.keys(MODELS[model].colorways)[0];
let size = 'US 9', custom = { ...CUSTOM_START }, customSize = 'US 9', part = 'upper';
let products = {}, loaded = false, scene = null, view = 'hero', exploded = false;

// --- Commerce ---------------------------------------------------------------------
const sf = createStorefront({ domain: config.domain, token: config.token });
const cart = createCart(sf, config.cartKey);
const panel = mountCheckoutPanel($('#panel-root'), { cart, brand: config.brand, bookingUrl: config.bookingUrl, storePassword: config.password });
const addBtns = [$('#add'), $('#pdp-add')], customBtn = $('#custom-add'), checkoutBtn = $('#checkout'), status = $('#status');

async function loadProducts() {
  status.textContent = 'Prices are loading…';
  try {
    const list = await Promise.all(config.handles.map((h) => fetchProduct(sf, h)));
    products = Object.fromEntries(list.map((p) => [p.handle, p]));
    loaded = true;
    status.textContent = '';
  } catch {
    loaded = false;
    status.innerHTML = 'Couldn\'t load prices. <button type="button" class="v-retry">Try again</button>';
    status.querySelector('.v-retry').addEventListener('click', loadProducts);
  }
  render();
}
cart.subscribe(() => { checkoutBtn.textContent = `Checkout (${cart.lines().reduce((s, l) => s + l.qty, 0)})`; });
cart.restore().catch(() => {});
checkoutBtn.addEventListener('click', () => { panel.open(); track('checkout_panel_open'); });
document.addEventListener('click', (e) => {
  if (e.target.closest('.kit-panel__cta')) track('book_call_click');
  if (e.target.closest('.kit-panel__go')) track('real_checkout_click');
});

async function addVariant(btn, v, label, attrs, out = status) {
  btn.disabled = true;
  btn.textContent = 'Adding…';
  try {
    await cart.add(v.id, 1, attrs);
    track('add_to_cart', { variant: v.id, value: v.price, currency: v.currencyCode });
    btn.textContent = 'Added';
    setTimeout(() => { btn.textContent = label; render(); }, 1200);
  } catch (e) {
    out.textContent = e.userMessage || "Couldn't update your cart. Try again.";
    btn.textContent = label;
    render();
  }
}
const current = () => (loaded && products[model] ? resolveVariant(products[model], { Colorway: cw, Size: size }) : null);
const currentCustom = () => (loaded && products[CUSTOM] ? resolveVariant(products[CUSTOM], { Size: customSize }) : null);
addBtns.forEach((b) => b.addEventListener('click', () => { const v = current(); if (v) addVariant(b, v, 'Add to cart'); }));
customBtn.addEventListener('click', () => {
  const v = currentCustom(), attrs = customAttrs(custom);
  if (v && attrs) addVariant(customBtn, v, 'Add custom pair', attrs, $('#custom-status'));
});

// --- Controls ---------------------------------------------------------------------
const chip = (hex) => `<span class="v-sw" style="--c:${hex}"></span>`;
const cards = [];
for (const [h, m] of Object.entries(MODELS)) for (const name of Object.keys(m.colorways)) cards.push({ h, name, img: `${m.kind}-${slug(name)}` });
$('#grid').innerHTML = cards.map((c) => `<li class="v-card">
  <img src="/vantrik/photos/${c.img}.webp" alt="${MODELS[c.h].name} in ${c.name}." loading="lazy" width="900" height="1125">
  <div class="v-card-body"><h3>${MODELS[c.h].name}</h3><p class="v-card-cw">${c.name}</p><p class="v-card-price" data-price-of="${c.h}"></p>
  <button type="button" class="v-card-btn" data-open="${c.h}" data-cw="${c.name}">View ${MODELS[c.h].name} in ${c.name}</button></div></li>`).join('')
  + `<li class="v-card v-card-custom"><img src="/vantrik/photos/custom.webp" alt="A custom VK-1 in sky blue, white and orange." loading="lazy" width="900" height="1125">
  <div class="v-card-body"><h3>Custom VK-1</h3><p class="v-card-cw">Your colors</p><p class="v-card-price" data-price-of="${CUSTOM}"></p>
  <a class="v-card-btn" href="#custom">Design your pair</a></div></li>`;
$('#models').innerHTML = Object.entries(MODELS).map(([h, m]) => `<label class="v-opt"><input type="radio" name="model" value="${h}"${h === model ? ' checked' : ''}><span>${m.name}</span></label>`).join('');
$('#sizes').innerHTML = SIZES.map((s) => `<label class="v-opt v-size"><input type="radio" name="size" value="${s.us}"${s.us === size ? ' checked' : ''}><span>${s.us.replace('US ', '')}</span></label>`).join('');
$('#custom-size').innerHTML = SIZES.map((s) => `<option${s.us === customSize ? ' selected' : ''}>${s.us}</option>`).join('');
$('#parts').innerHTML = PARTS.map((p) => `<button type="button" role="tab" class="v-part" data-part="${p.id}" aria-selected="${p.id === part}">${chip('var(--pc)')}${p.label}</button>`).join('');
$('#palette').innerHTML = Object.entries(PALETTE).map(([n, hex]) => `<button type="button" role="radio" class="v-color" data-color="${n}" aria-checked="false" aria-label="${n}" title="${n}">${chip(hex)}</button>`).join('');
$('#size-table').innerHTML = `<caption class="v-sr">VANTRIK sizes and foot length</caption><thead><tr><th scope="col">US men</th><th scope="col">US women</th><th scope="col">EU</th><th scope="col">Foot length</th></tr></thead><tbody>`
  + SIZES.map((s, i) => `<tr><th scope="row">${s.us.replace('US ', '')}</th><td>${8.5 + i}</td><td>${40 + i}</td><td>${s.cm.toFixed(1)} cm</td></tr>`).join('') + '</tbody>';

function renderColorways() {
  $('#colorways').innerHTML = Object.entries(MODELS[model].colorways).map(([n, c]) => `<label class="v-opt v-cw"><input type="radio" name="cw" value="${n}"${n === cw ? ' checked' : ''}>${chip(PALETTE[c.upper])}<span>${n}</span></label>`).join('');
}
function openShoe(h, name) {
  model = h;
  cw = MODELS[h].colorways[name] ? name : Object.keys(MODELS[h].colorways)[0];
  const r = document.querySelector(`input[name="model"][value="${h}"]`);
  if (r) r.checked = true;
  renderColorways();
  showShoe();
  render();
}
$('#grid').addEventListener('click', (e) => {
  const b = e.target.closest('[data-open]');
  if (!b) return;
  openShoe(b.dataset.open, b.dataset.cw);
  track('view_item', { item: `${MODELS[model].name} ${cw}` });
  $('#shoe').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
});
$('#models').addEventListener('change', (e) => openShoe(e.target.value));
$('#colorways').addEventListener('change', (e) => { cw = e.target.value; showShoe(); render(); });
$('#sizes').addEventListener('change', (e) => { size = e.target.value; render(); });
$('#custom-size').addEventListener('change', (e) => { customSize = e.target.value; render(); });
$('#parts').addEventListener('click', (e) => { const b = e.target.closest('.v-part'); if (b) { part = b.dataset.part; render(); } });
$('#palette').addEventListener('click', (e) => {
  const b = e.target.closest('.v-color');
  if (!b) return;
  custom = { ...custom, [part]: b.dataset.color };
  showShoe();
  render();
});
// Arrow keys move through the palette like a radio group.
$('#palette').addEventListener('keydown', (e) => {
  if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
  e.preventDefault();
  const names = Object.keys(PALETTE), i = names.indexOf(custom[part]);
  const next = names[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : names.length - 1)) % names.length];
  custom = { ...custom, [part]: next };
  showShoe();
  render();
  document.querySelector(`.v-color[data-color="${next}"]`)?.focus();
});
$('#explode').addEventListener('click', () => {
  exploded = !exploded;
  $('#explode').setAttribute('aria-pressed', String(exploded));
  $('#explode').textContent = exploded ? 'Put it back together' : 'Take it apart';
  $('#layers').hidden = !exploded;
  scene?.setExploded(exploded);
  track('explode', { on: exploded });
});
$('#fit-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const cm = parseFloat($('#foot').value.replace(',', '.'));
  const s = sizeFor(cm);
  $('#fit-out').textContent = s ? `Go for ${s}. That size fits a foot up to ${SIZES.find((x) => x.us === s).cm.toFixed(1)} cm long.` : 'We make US 7 to US 12. Check the number and try again.';
  $$('#size-table tbody tr').forEach((tr, i) => tr.classList.toggle('on', SIZES[i].us === s));
});
$('#news-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $('#news-email'), msg = $('#news-msg');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.value)) { msg.textContent = 'Please enter a valid email address.'; input.focus(); return; }
  msg.textContent = 'Thank you. This is a demo store. We did not save your email.';
  input.value = '';
});

const fromPrice = (h) => {
  const vs = products[h]?.variants?.filter((v) => v.available) || [];
  return vs.length ? `From ${money(Math.min(...vs.map((v) => v.price)), vs[0].currencyCode)}` : '';
};
const hexes = (colors) => Object.fromEntries(PARTS.map((p) => [p.id, PALETTE[colors[p.id]]]));

function showShoe() {
  if (!scene) return;
  if (view === 'custom') scene.setShoe('runner', hexes(custom));
  else scene.setShoe(MODELS[model].kind, hexes(colorwayOf(model, cw)));
}

function render() {
  const m = MODELS[model];
  body.dataset.model = model;
  $('[data-name]').textContent = m.name;
  $('[data-line]').textContent = m.line;
  $('[data-cw-name]').textContent = cw;
  $('[data-desc]').textContent = COPY[model].desc;
  $('[data-materials]').textContent = COPY[model].materials;
  $('#bar-name').textContent = m.name;
  $('#bar-sub').textContent = `${cw} · ${size}`;
  const v = current(), st = variantState(v);
  const price = v ? money(v.price, v.currencyCode) : '';
  $('#price').textContent = price;
  $('#pdp-price').textContent = price;
  addBtns.forEach((b) => {
    b.disabled = !loaded || st !== 'available';
    if (b.textContent !== 'Adding…' && b.textContent !== 'Added') b.textContent = !loaded || st === 'available' ? 'Add to cart' : st === 'soldout' ? 'Sold out' : 'Not available';
  });
  if (loaded && st === 'soldout') status.textContent = `${m.name} in ${cw} is sold out in ${size}. Try another size.`;
  else if (loaded) status.textContent = '';
  $$('[data-price-of]').forEach((el) => { el.textContent = fromPrice(el.dataset.priceOf); });
  // Custom designer.
  $$('.v-part').forEach((b) => {
    b.setAttribute('aria-selected', String(b.dataset.part === part));
    b.style.setProperty('--pc', PALETTE[custom[b.dataset.part]]);
  });
  $$('.v-color').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.color === custom[part])));
  $$('.v-color').forEach((b) => { b.tabIndex = b.dataset.color === custom[part] ? 0 : -1; });
  $('#recipe').textContent = PARTS.map((p) => `${p.label}: ${custom[p.id]}`).join(' · ');
  const cv = currentCustom();
  $('#custom-price').textContent = cv ? money(cv.price, cv.currencyCode) : '';
  if (customBtn.textContent !== 'Adding…' && customBtn.textContent !== 'Added') customBtn.disabled = !cv || !cv.available || !customAttrs(custom);
}

// --- 3D ---------------------------------------------------------------------------
function fallback() { body.classList.add('no-gl'); body.classList.remove('gl-ready'); }
async function start3d() {
  const device = readDevice();
  const tier = params.get('tier') || detectTier(device);
  if (!device.webgl2) return fallback();
  try {
    const { createVantrikScene } = await import('./scene.js');
    scene = await createVantrikScene($('#gl'), {
      tier, reducedMotion: reduced, onFallback: fallback, still: params.has('still'),
      dragSurfaces: $$('[data-3d]'),
      onReady: () => requestAnimationFrame(() => body.classList.add('gl-ready')),
    });
    if (!scene) return fallback();
    showShoe();
    if (params.has('still')) { window.__vantrik = scene; return; }
    watch3d();
    scrollDrive();
  } catch (e) {
    console.error(e);
    fallback();
  }
}

// The canvas sits behind the page. It only draws while a 3D section is on screen. The view follows the section.
function watch3d() {
  const seen = new Map();
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) seen.set(en.target, en.intersectionRatio);
    const best = [...seen.entries()].filter(([, r]) => r > 0.25).sort((a, b) => b[1] - a[1])[0];
    const on = [...seen.values()].some((r) => r > 0);
    scene.setActive(on);
    body.classList.toggle('v-3d-on', !!best);
    if (best && best[0].dataset.view !== view) {
      view = best[0].dataset.view;
      body.dataset.view = view;
      scene.setView(view);
      showShoe();
    }
  }, { threshold: [0, 0.25, 0.5, 0.75] });
  $$('[data-3d]').forEach((el) => io.observe(el));
}
async function scrollDrive() {
  if (reduced) return;
  const { default: Lenis } = await import('lenis');
  const lenis = new Lenis({ lerp: 0.1 });
  const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
}

renderColorways();
render();
loadProducts();
// The 3D shoe waits for the visitor's first move (scroll, touch, pointer or key). ?gl starts it at once.
let started = false;
const WAKE = ['pointermove', 'pointerdown', 'touchstart', 'wheel', 'scroll', 'keydown'];
const kick = () => {
  if (started) return;
  started = true;
  WAKE.forEach((ev) => window.removeEventListener(ev, kick, true));
  (window.requestIdleCallback || ((fn) => setTimeout(fn, 1)))(start3d, { timeout: 300 });
};
WAKE.forEach((ev) => window.addEventListener(ev, kick, { capture: true, passive: true }));
if (params.has('gl') || params.has('still')) window.addEventListener('load', kick);
