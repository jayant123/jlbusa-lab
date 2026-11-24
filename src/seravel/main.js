// SERAVEL store page. The shop works as plain HTML from the Shopify catalog. The 3D ring joins after the visitor's
// first move and draws only while the ring designer is on screen.
import config from './config.js';
import { createStorefront } from '../kit/storefront.js';
import { fetchProduct, resolveVariant, variantState } from '../kit/catalog.js';
import { createCart } from '../kit/cart.js';
import { mountCheckoutPanel } from '../kit/checkout-panel.js';
import { detectTier, readDevice } from '../kit/tier.js';
import { prefersReducedMotion } from '../kit/env.js';
import { track } from '../kit/track.js';
import { METALS, STONES, PIECES, RING_SIZES, MAX_ENGRAVING, cleanEngraving, ringAttrs, sizeToMm } from './jewels.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const body = document.body;
const reduced = prefersReducedMotion();
const params = new URLSearchParams(location.search);
const RING = 'seravel-solace-ring';
const money = (n, c = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(n);
const slug = (h) => h.replace('seravel-', '');

const ring = { Metal: 'Yellow gold', Stone: 'Diamond', size: '7', engraving: '' };
const other = { 'seravel-halo-pendant': { Metal: 'Yellow gold', Chain: '18 in' }, 'seravel-tide-hoops': { Metal: 'Yellow gold', Size: 'Small' } };
let products = {}, loaded = false, scene = null;

// --- Commerce ---------------------------------------------------------------------
const sf = createStorefront({ domain: config.domain, token: config.token });
const cart = createCart(sf, config.cartKey);
const panel = mountCheckoutPanel($('#panel-root'), { cart, brand: config.brand, bookingUrl: config.bookingUrl, storePassword: config.password });
const status = $('#status'), checkoutBtn = $('#checkout');
$('#consult').href = config.bookingUrl;

async function loadProducts() {
  status.textContent = 'Prices are loading…';
  try {
    const list = await Promise.all(config.handles.map((h) => fetchProduct(sf, h)));
    products = Object.fromEntries(list.map((p) => [p.handle, p]));
    loaded = true;
    status.textContent = '';
  } catch {
    loaded = false;
    status.innerHTML = 'Couldn\'t load prices. <button type="button" class="s-retry">Try again</button>';
    status.querySelector('.s-retry').addEventListener('click', loadProducts);
  }
  render();
}
cart.subscribe(() => { checkoutBtn.textContent = `Checkout (${cart.lines().reduce((s, l) => s + l.qty, 0)})`; });
cart.restore().catch(() => {});
checkoutBtn.addEventListener('click', () => { panel.open(); track('checkout_panel_open'); });
document.addEventListener('click', (e) => {
  if (e.target.closest('.kit-panel__cta')) track('book_call_click');
  if (e.target.closest('.kit-panel__go')) track('real_checkout_click');
  if (e.target.closest('#consult')) track('consult_click');
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
const variant = (h, sel) => (loaded && products[h] ? resolveVariant(products[h], sel) : null);
const ringVariant = () => variant(RING, { Metal: ring.Metal, Stone: ring.Stone });
function addRing(btn, label) {
  const v = ringVariant(), attrs = ringAttrs(ring);
  if (v && attrs) addVariant(btn, v, label, attrs);
}
$('#ring-add').addEventListener('click', (e) => addRing(e.currentTarget, 'Add ring to cart'));
$('#add').addEventListener('click', (e) => addRing(e.currentTarget, 'Add to cart'));

// --- Ring designer ---------------------------------------------------------------
const chip = (group, value, color, sub) => `<label class="s-chip"><input type="radio" name="${group}" value="${value}"${ring[group] === value ? ' checked' : ''}>
  <span class="s-swatch" style="--c:${color}"></span><span class="s-chip-name">${value}</span>${sub ? `<span class="s-chip-sub" data-chip-price="${group}:${value}"></span>` : ''}</label>`;
$('#metals').innerHTML = Object.entries(METALS).map(([k, m]) => chip('Metal', k, m.color, true)).join('');
$('#stones').innerHTML = Object.entries(STONES).map(([k, s]) => chip('Stone', k, s.color, true)).join('');
$('#size').innerHTML = RING_SIZES.map((s) => `<option value="${s}"${s === ring.size ? ' selected' : ''}>US ${s}</option>`).join('');
$('#metals').addEventListener('change', (e) => { ring.Metal = e.target.value; scene?.setMetal(ring.Metal); track('metal', { metal: ring.Metal }); render(); });
$('#stones').addEventListener('change', (e) => { ring.Stone = e.target.value; scene?.setStone(ring.Stone); track('stone', { stone: ring.Stone }); render(); });
$('#size').addEventListener('change', (e) => { ring.size = e.target.value; render(); });
const eng = $('#engraving');
eng.addEventListener('input', () => {
  ring.engraving = cleanEngraving(eng.value);
  scene?.setEngraving(ring.engraving);
  if (ring.engraving) setView('inside');
  render();
});
eng.addEventListener('blur', () => { eng.value = ring.engraving; });
function setView(v) {
  $$('.s-view').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === v)));
  scene?.setView(v);
}
$$('.s-view').forEach((b) => b.addEventListener('click', () => {
  setView(b.dataset.view);
  // Phones: the panel covers the lower screen. Bring the ring back into view when a view is chosen.
  if (innerWidth < 700) $('#design').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
}));

// --- Collection grid and the other pieces -------------------------------------------
const fromPrice = (h) => {
  const vs = products[h]?.variants?.filter((v) => v.available) || [];
  return vs.length ? `From ${money(Math.min(...vs.map((v) => v.price)), vs[0].currencyCode)}` : '';
};
$('#grid').innerHTML = Object.entries(PIECES).map(([h, p]) => `<li class="s-card" data-h="${h}">
  <img src="/seravel/stills/${slug(h)}.webp" alt="The ${p.name}. ${p.line}" loading="lazy" width="800" height="1000">
  <h3>${p.name}</h3><p class="s-card-kind">${p.kind} · 18k gold</p><p class="s-card-line">${p.line}</p>
  <p class="s-card-price" data-from="${h}"></p>
  <a class="s-card-btn" href="${h === RING ? '#design' : '#pieces'}">${h === RING ? 'Design your ring' : `View the ${p.name}`}</a></li>`).join('');

const OPTION = { 'seravel-halo-pendant': ['Metal', 'Chain'], 'seravel-tide-hoops': ['Metal', 'Size'] };
const VALUES = { Metal: Object.keys(METALS), Chain: ['16 in', '18 in', '20 in'], Size: ['Small', 'Medium'] };
$('#piece-list').innerHTML = Object.keys(other).map((h) => `<article class="s-piece" data-h="${h}" aria-labelledby="p-${slug(h)}">
  <img src="/seravel/stills/${slug(h)}.webp" alt="The ${PIECES[h].name}." loading="lazy" width="800" height="1000">
  <div class="s-piece-info"><h3 id="p-${slug(h)}">${PIECES[h].name}</h3><p>${PIECES[h].line}</p>
  ${OPTION[h].map((o) => `<fieldset class="s-group"><legend>${o === 'Size' ? 'Hoop size' : o}</legend><div class="s-chips s-chips-sm">${VALUES[o].map((v) => `<label class="s-chip"><input type="radio" name="${slug(h)}-${o}" value="${v}" data-o="${o}"${other[h][o] === v ? ' checked' : ''}>${o === 'Metal' ? `<span class="s-swatch" style="--c:${METALS[v].color}"></span>` : ''}<span class="s-chip-name">${v}</span></label>`).join('')}</div></fieldset>`).join('')}
  <p class="s-piece-price" data-piece-price="${h}"></p>
  <button type="button" class="s-btn s-piece-add" data-add="${h}" disabled>Add to cart</button>
  <p class="s-status" data-piece-status="${h}" role="status" aria-live="polite"></p></div></article>`).join('');
$('#piece-list').addEventListener('change', (e) => { const h = e.target.closest('.s-piece')?.dataset.h; if (h) { other[h][e.target.dataset.o] = e.target.value; render(); } });
$('#piece-list').addEventListener('click', (e) => {
  const b = e.target.closest('[data-add]');
  if (!b) return;
  const h = b.dataset.add, v = variant(h, other[h]);
  if (v) addVariant(b, v, 'Add to cart', undefined, document.querySelector(`[data-piece-status="${h}"]`));
});
$('#size-table').insertAdjacentHTML('beforeend', `<thead><tr><th scope="col">US size</th><th scope="col">Inside diameter</th></tr></thead><tbody>${RING_SIZES.filter((s) => Number(s) % 1 === 0 || ['5.5', '6.5', '7.5'].includes(s)).map((s) => `<tr><th scope="row">${s}</th><td>${sizeToMm(s)} mm</td></tr>`).join('')}</tbody>`);

// Newsletter: a demo. Nothing is sent anywhere.
$('#news-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $('#news-email'), msg = $('#news-msg');
  if (!input.checkValidity() || !input.value) { msg.textContent = 'Please enter a valid email address.'; input.focus(); return; }
  msg.textContent = 'Thank you. This is a demo store. We did not save your email.';
  input.value = '';
});

function render() {
  const v = ringVariant(), st = variantState(v);
  const price = v ? money(v.price, v.currencyCode) : '';
  $('#ring-price').textContent = price;
  $('#price').textContent = price;
  $('#ring-note').textContent = `${ring.Metal} · ${ring.Stone}`;
  $('#bar-sub').textContent = `${ring.Metal} · ${ring.Stone} · US ${ring.size}`;
  $('#stone-note').textContent = STONES[ring.Stone].note;
  $('#size-mm').textContent = `${sizeToMm(ring.size)} mm inside`;
  $('#eng-count').textContent = `${ring.engraving.length} of ${MAX_ENGRAVING}`;
  const ok = loaded && st === 'available';
  for (const b of [$('#ring-add'), $('#add')]) {
    b.disabled = !ok;
    if (!['Adding…', 'Added'].includes(b.textContent)) b.textContent = !loaded || st === 'available' ? (b.id === 'add' ? 'Add to cart' : 'Add ring to cart') : st === 'soldout' ? 'Sold out' : 'Not available';
  }
  if (loaded && st === 'soldout') status.textContent = `${ring.Metal} with ${ring.Stone.toLowerCase()} is sold out in the demo store. Try another stone.`;
  else if (loaded) status.textContent = '';
  $$('[data-chip-price]').forEach((el) => {
    const [g, val] = el.dataset.chipPrice.split(':');
    const cv = variant(RING, { ...{ Metal: ring.Metal, Stone: ring.Stone }, [g]: val });
    el.textContent = cv ? (cv.available ? money(cv.price, cv.currencyCode) : 'Sold out') : '';
  });
  $$('[data-from]').forEach((el) => { el.textContent = fromPrice(el.dataset.from); });
  for (const h of Object.keys(other)) {
    const pv = variant(h, other[h]), ps = variantState(pv);
    document.querySelector(`[data-piece-price="${h}"]`).textContent = pv ? money(pv.price, pv.currencyCode) : '';
    const b = document.querySelector(`[data-add="${h}"]`);
    b.disabled = !loaded || ps !== 'available';
    if (!['Adding…', 'Added'].includes(b.textContent)) b.textContent = !loaded || ps === 'available' ? 'Add to cart' : 'Sold out';
  }
}

// --- 3D ---------------------------------------------------------------------------
function fallback() { body.classList.add('no-gl'); body.classList.remove('gl-ready'); }
async function start3d() {
  const device = readDevice();
  const tier = params.get('tier') || detectTier(device);
  if (!device.webgl2) return fallback();
  try {
    const { createSeravelScene } = await import('./scene.js');
    scene = await createSeravelScene($('#gl'), {
      tier, reducedMotion: reduced, onFallback: fallback, dragSurfaces: $$('[data-3d]'),
      onReady: () => requestAnimationFrame(() => body.classList.add('gl-ready')),
    });
    if (!scene) return fallback();
    scene.setMetal(ring.Metal);
    scene.setStone(ring.Stone);
    scene.setEngraving(ring.engraving);
    if (params.has('still')) { window.__seravel = scene; return; }
    const io = new IntersectionObserver((en) => {
      const on = en.some((x) => x.isIntersecting);
      scene.setActive(on);
      body.classList.toggle('s-3d-on', on);
    }, { threshold: 0.05 });
    io.observe($('#design'));
  } catch {
    fallback();
  }
}

render();
loadProducts();
// The 3D ring is heavy to set up. It waits for the visitor's first move. ?gl starts it straight away (tests, stills).
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
