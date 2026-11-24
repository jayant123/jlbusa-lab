// HALRUNE store page. The shop works as plain HTML from the Shopify catalog. The 3D listening room loads after the
// visitor's first move and draws only while the room is on screen. Music plays only after a click on Play.
import config from './config.js';
import { createStorefront } from '../kit/storefront.js';
import { fetchProduct, resolveVariant, variantState } from '../kit/catalog.js';
import { createCart } from '../kit/cart.js';
import { mountCheckoutPanel } from '../kit/checkout-panel.js';
import { detectTier, readDevice } from '../kit/tier.js';
import { prefersReducedMotion } from '../kit/env.js';
import { track } from '../kit/track.js';
import { PRODUCTS, ORDER, FINISH_COLOR, productOf, responseCurve } from './catalog.js';
import { bandLevels } from './audio-math.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const body = document.body;
const reduced = prefersReducedMotion();
const params = new URLSearchParams(location.search);
const money = (n, c = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(n);

const NOTE = {
  'halrune-monitor': 'Press Play and watch the woofers move with the bass.',
  'halrune-buds': 'The case opens when you choose the Buds. Each charge lasts 7 hours.',
};
let handle = PRODUCTS[params.get('p')] ? params.get('p') : ORDER[0];
const choice = Object.fromEntries(ORDER.map((h) => [h, PRODUCTS[h].values[0]]));
let products = {}, loaded = false, scene = null, music = null, exploded = false, chartFor = ORDER[0];

// --- Commerce ---------------------------------------------------------------------
const sf = createStorefront({ domain: config.domain, token: config.token });
const cart = createCart(sf, config.cartKey);
const panel = mountCheckoutPanel($('#panel-root'), { cart, brand: config.brand, bookingUrl: config.bookingUrl, storePassword: config.password });
const addBtns = [$('#add'), $('#room-add')], checkoutBtn = $('#checkout'), status = $('#status');

async function loadProducts() {
  status.textContent = 'Prices are loading…';
  try {
    const list = await Promise.all(config.handles.map((h) => fetchProduct(sf, h)));
    products = Object.fromEntries(list.map((p) => [p.handle, p]));
    loaded = true;
    status.textContent = '';
  } catch {
    loaded = false;
    status.innerHTML = 'Couldn\'t load prices. <button type="button" class="h-retry">Try again</button>';
    status.querySelector('.h-retry').addEventListener('click', loadProducts);
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

const current = () => (loaded && products[handle] ? resolveVariant(products[handle], { [productOf(handle).option]: choice[handle] }) : null);
async function addVariant(btn, v) {
  btn.disabled = true;
  btn.textContent = 'Adding…';
  try {
    await cart.add(v.id, 1);
    track('add_to_cart', { variant: v.id, value: v.price, currency: v.currencyCode });
    btn.textContent = 'Added';
    setTimeout(() => { btn.textContent = 'Add to cart'; render(); }, 1200);
  } catch (e) {
    status.textContent = e.userMessage || "Couldn't update your cart. Try again.";
    btn.textContent = 'Add to cart';
    render();
  }
}
addBtns.forEach((b) => b.addEventListener('click', () => { const v = current(); if (v) addVariant(b, v); }));

// --- Controls ---------------------------------------------------------------------
const dot = (c) => `<span class="h-dot" style="--c:${c}"></span>`;
const fromPrice = (h) => {
  const vs = products[h]?.variants?.filter((v) => v.available) || [];
  return vs.length ? `From ${money(Math.min(...vs.map((v) => v.price)), vs[0].currencyCode)}` : '';
};
$('#grid').innerHTML = ORDER.map((h) => { const p = PRODUCTS[h], slug = h.replace('halrune-', ''); return `<li class="h-card-p">
  <img src="/halrune/stills/${slug}.webp" alt="The ${p.name}. ${p.kind}." loading="lazy" width="800" height="1000">
  <div class="h-card-body"><p class="h-card-kind">${p.kind}</p><h3>${p.name}</h3>
  <div class="h-swatches" role="img" aria-label="${p.option === 'Finish' ? 'Finishes' : 'Colors'}: ${p.values.join(', ')}">${p.values.map((v) => `<span style="--c:${FINISH_COLOR[v]}"></span>`).join('')}</div>
  <p class="h-card-price" data-from="${h}"></p>
  <button type="button" class="h-card-btn" data-open="${h}">See it in the listening room</button></div></li>`; }).join('');
$('#products').innerHTML = ORDER.map((h) => `<label class="h-opt"><input type="radio" name="product" value="${h}"${h === handle ? ' checked' : ''}>${PRODUCTS[h].name.replace('HALRUNE ', '')}</label>`).join('');
$('#resp-tabs').innerHTML = ORDER.map((h) => `<button type="button" data-chart="${h}" aria-pressed="${h === chartFor}">${PRODUCTS[h].name.replace('HALRUNE ', '')}</button>`).join('');

function renderFinishes() {
  const p = productOf(handle);
  $('#opt-name').textContent = p.option;
  $('#finishes').innerHTML = p.values.map((v) => `<label class="h-opt"><input type="radio" name="finish" value="${v}"${v === choice[handle] ? ' checked' : ''}>${dot(FINISH_COLOR[v])}${v}</label>`).join('');
}
function setProduct(h) {
  if (!PRODUCTS[h]) return;
  handle = h;
  const r = document.querySelector(`input[name="product"][value="${h}"]`);
  if (r) r.checked = true;
  if (h !== 'halrune-one' && exploded) setExploded(false);
  scene?.select(h);
  scene?.setView('product');
  renderFinishes();
  track('product', { product: PRODUCTS[h].name });
  render();
}
function setExploded(on) {
  exploded = on;
  $('#explode').setAttribute('aria-pressed', String(on));
  $('#explode').textContent = on ? 'Put the headphones back together' : 'Take the headphones apart';
  scene?.explode(on);
}
$('#products').addEventListener('change', (e) => setProduct(e.target.value));
$('#finishes').addEventListener('change', (e) => { choice[handle] = e.target.value; scene?.setFinish(handle, e.target.value); render(); });
$('#explode').addEventListener('click', () => { setExploded(!exploded); track('explode', { on: exploded }); });
$('#grid').addEventListener('click', (e) => {
  const b = e.target.closest('[data-open]');
  if (!b) return;
  setProduct(b.dataset.open);
  $('#room').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
});
$('#resp-tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-chart]'); if (b) { chartFor = b.dataset.chart; renderChart(); } });
$('#news-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $('#news-email'), msg = $('#news-msg');
  if (!input.checkValidity() || !input.value) { msg.textContent = 'Please enter a valid email address.'; input.focus(); return; }
  msg.textContent = 'Thank you. This is a demo store. We did not save your email.';
  input.value = '';
});

// Frequency response chart: log frequency on x, decibels on y. Demo data.
function renderChart() {
  $$('#resp-tabs button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.chart === chartFor)));
  const W = 760, H = 260, L = 44, R = 12, T = 12, B = 30;
  const c = responseCurve(chartFor);
  const x = (hz) => L + ((Math.log10(hz) - Math.log10(20)) / 3) * (W - L - R);
  const y = (db) => T + ((6 - db) / 18) * (H - T - B);
  const pts = c.map((p) => `${x(p.hz).toFixed(1)},${y(p.db).toFixed(1)}`).join(' ');
  const xt = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
  const lab = (hz) => (hz >= 1000 ? `${hz / 1000}k` : `${hz}`);
  $('#chart').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Demo frequency response for the ${PRODUCTS[chartFor].name}, from 20 Hz to 20 kHz">
    <g class="grid">${xt.map((hz) => `<line x1="${x(hz)}" x2="${x(hz)}" y1="${T}" y2="${H - B}"/>`).join('')}${[6, 0, -6, -12].map((d) => `<line x1="${L}" x2="${W - R}" y1="${y(d)}" y2="${y(d)}"/>`).join('')}</g>
    <line class="zero" x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}"/>
    <polygon class="area" points="${x(20)},${y(-12)} ${pts} ${x(20000)},${y(-12)}"/>
    <polyline class="curve" points="${pts}"/>
    ${xt.map((hz) => `<text x="${x(hz)}" y="${H - 10}" text-anchor="middle">${lab(hz)}</text>`).join('')}
    ${[6, 0, -6, -12].map((d) => `<text x="${L - 8}" y="${y(d) + 4}" text-anchor="end">${d > 0 ? '+' : ''}${d} dB</text>`).join('')}
  </svg>`;
}

function render() {
  const p = productOf(handle);
  body.dataset.product = handle;
  $('[data-name]').textContent = p.name;
  $('[data-kind]').textContent = p.kind;
  $('[data-story]').textContent = p.story;
  $('#specs').innerHTML = p.specs.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  // Taking apart is a headphones feature. Other products get a short note instead.
  $('#explode').hidden = handle !== 'halrune-one';
  $('#room-note').hidden = handle === 'halrune-one';
  $('#room-note').textContent = NOTE[handle] || '';
  $('#bar-name').textContent = p.name;
  $('#bar-opt').textContent = choice[handle];
  const v = current(), st = variantState(v);
  const price = v ? money(v.price, v.currencyCode) : '';
  $('#price').textContent = price;
  $('#room-price').textContent = price;
  addBtns.forEach((b) => {
    b.disabled = !loaded || st !== 'available';
    if (b.textContent !== 'Adding…' && b.textContent !== 'Added') b.textContent = !loaded || st === 'available' ? 'Add to cart' : st === 'soldout' ? 'Sold out' : 'Not available';
  });
  if (loaded && st === 'soldout') status.textContent = `The ${p.name} in ${choice[handle]} is sold out in the demo store. Try another finish.`;
  else if (loaded) status.textContent = '';
  $$('[data-from]').forEach((el) => { el.textContent = fromPrice(el.dataset.from); });
}

// --- Music ------------------------------------------------------------------------
const meters = ['#meter-bass', '#meter-mid', '#meter-treble'].map((s) => $(s));
let raf = 0, bins = null;
function meterLoop() {
  if (!music?.playing) { meters.forEach((m) => m.style.setProperty('--v', 0)); scene?.setLevels({ bass: 0, mid: 0, treble: 0, all: 0 }); raf = 0; return; }
  music.analyser.getByteFrequencyData(bins);
  const l = bandLevels(bins.subarray(0, 512), music.sampleRate, music.analyser.fftSize);
  const k = music.muted ? 0 : 1.6;
  meters[0].style.setProperty('--v', Math.min(1, l.bass * k));
  meters[1].style.setProperty('--v', Math.min(1, l.mid * k * 1.6));
  meters[2].style.setProperty('--v', Math.min(1, l.treble * k * 4));
  scene?.setLevels(music.muted ? { bass: 0, mid: 0, treble: 0, all: 0 } : { bass: l.bass * 1.4, mid: l.mid * 2, treble: l.treble * 5, all: l.all * 2 });
  raf = requestAnimationFrame(meterLoop);
}
$('#play').addEventListener('click', async () => {
  if (!music) {
    const { createMusic } = await import('./audio.js');
    music = createMusic();
    if (!music) { status.textContent = 'This browser cannot play the demo music.'; return; }
    bins = new Uint8Array(music.analyser.frequencyBinCount);
  }
  if (music.playing) music.stop(); else await music.start();
  $('#play').setAttribute('aria-pressed', String(music.playing));
  $('#play').textContent = music.playing ? 'Pause' : 'Play';
  track('music', { playing: music.playing });
  if (music.playing && !raf) meterLoop();
});
$('#mute').addEventListener('click', () => {
  const m = $('#mute').getAttribute('aria-pressed') !== 'true';
  $('#mute').setAttribute('aria-pressed', String(m));
  $('#mute').textContent = m ? 'Unmute' : 'Mute';
  music?.setMuted(m);
});

// --- 3D ---------------------------------------------------------------------------
function fallback() { body.classList.add('no-gl'); body.classList.remove('gl-ready'); }
async function start3d() {
  const device = readDevice();
  const tier = params.get('tier') || detectTier(device);
  if (!device.webgl2) return fallback();
  try {
    const { createHalruneScene } = await import('./scene.js');
    scene = await createHalruneScene($('#gl'), {
      tier, reducedMotion: reduced, onFallback: fallback, dragSurfaces: [$('#room')],
      onPick: (h) => { setProduct(h); track('pick', { product: PRODUCTS[h].name }); },
      onReady: () => requestAnimationFrame(() => body.classList.add('gl-ready')),
    });
    if (!scene) return fallback();
    for (const h of ORDER) scene.setFinish(h, choice[h]);
    scene.select(handle);
    if (params.has('still')) { window.__halrune = scene; return; }
    const io = new IntersectionObserver((en) => { const on = en.some((e) => e.isIntersecting); scene.setActive(on); });
    io.observe($('#room'));
  } catch {
    fallback();
  }
}

renderFinishes();
renderChart();
render();
loadProducts();
// The 3D room loads on the visitor's first move. ?gl starts it at once (tests and stills).
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
