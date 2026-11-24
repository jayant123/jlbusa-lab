// PLINTHA page: the builder works as plain HTML (list, floor plan, totals, cart) and the 3D room joins it when it can.
import config from './config.js';
import { createStorefront } from '../kit/storefront.js';
import { fetchProduct } from '../kit/catalog.js';
import { createCart } from '../kit/cart.js';
import { mountCheckoutPanel } from '../kit/checkout-panel.js';
import { detectTier, readDevice } from '../kit/tier.js';
import { prefersReducedMotion } from '../kit/env.js';
import { track } from '../kit/track.js';
import { EMPTY, WIDTH, DEPTH, MAX_MODULES, place, remove, count, dimensions, cartLines, quote, handleOf } from './layout.js';
import { FABRICS, encode, decode } from './urlstate.js';
import { placements } from './positions.js';
import { planSvg } from './plan.js';

const $ = (s) => document.querySelector(s);
const body = document.body;
const reduced = prefersReducedMotion();
const NAME = { armless: 'Armless', corner: 'Corner', arm_left: 'Left arm', arm_right: 'Right arm', chaise: 'Chaise', ottoman: 'Ottoman' };
const ORDER = ['armless', 'arm_left', 'arm_right', 'corner', 'chaise', 'ottoman'];
const SWATCH = { 'Boucle Chalk': '#e9e5dc', 'Wool Moss': '#5d6747', 'Linen Sand': '#c8b28c', 'Velvet Ink': '#1f2638' };
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const money = (n, c = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(n);
const build = (steps) => steps.reduce((l, [m, s]) => (l ? place(l, m, s) : l), EMPTY);
const SHOWROOM = build([['arm_left', 'end'], ['armless', 'end'], ['armless', 'end'], ['corner', 'end'], ['armless', 'return'], ['arm_right', 'return'], ['ottoman', 'free']]);

// --- State --------------------------------------------------------------------
const fromUrl = new URLSearchParams(location.search).get('l');
const start = fromUrl ? decode(fromUrl) : { layout: EMPTY, fabric: FABRICS[0] };
let layout = start.layout, fabric = start.fabric, products = {}, loaded = false, scene = null, mode = 'showroom', armed = null;

// --- Commerce -----------------------------------------------------------------
const sf = createStorefront({ domain: config.domain, token: config.token });
const cart = createCart(sf, config.cartKey);
const panel = mountCheckoutPanel($('#panel-root'), { cart, brand: config.brand, bookingUrl: config.bookingUrl, storePassword: config.password });
const addBtn = $('#add'), checkoutBtn = $('#checkout'), status = $('#status');

async function loadProducts() {
  status.textContent = 'Prices are loading…';
  try {
    const list = await Promise.all(config.handles.map((h) => fetchProduct(sf, h)));
    products = Object.fromEntries(list.map((p) => [p.handle, p]));
    loaded = true;
    status.textContent = '';
  } catch {
    status.innerHTML = 'Couldn\'t load prices. <button type="button" class="p-retry">Try again</button>';
    status.querySelector('.p-retry').addEventListener('click', loadProducts);
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

addBtn.addEventListener('click', async () => {
  const lines = cartLines(layout, fabric, products);
  if (!lines.length) return;
  addBtn.disabled = true;
  addBtn.textContent = 'Adding…';
  try {
    await cart.addLines(lines);
    track('add_to_cart', { modules: count(layout), fabric, value: quote(layout, fabric, products).amount });
    addBtn.textContent = 'Added';
    setTimeout(() => { addBtn.textContent = 'Add layout to cart'; render(); }, 1200);
  } catch (e) {
    status.textContent = e.userMessage || "Couldn't update your cart. Try again.";
    addBtn.textContent = 'Add layout to cart';
    render();
  }
});

// --- Builder ------------------------------------------------------------------
const icon = (kind) => {
  const w = WIDTH[kind], d = DEPTH[kind], s = 0.3;
  const back = kind === 'ottoman' ? '' : `<rect x="2" y="2" width="${w * s - 4}" height="7" rx="2" class="i-back"/>`;
  const arms = (kind === 'arm_left' ? `<rect x="2" y="2" width="7" height="${d * s - 4}" rx="2" class="i-back"/>` : '')
    + (kind === 'arm_right' ? `<rect x="${w * s - 9}" y="2" width="7" height="${d * s - 4}" rx="2" class="i-back"/>` : '')
    + (kind === 'corner' ? `<rect x="${w * s - 9}" y="2" width="7" height="${d * s - 4}" rx="2" class="i-back"/>` : '');
  return `<svg viewBox="0 0 ${w * s} ${d * s}" width="${w * s}" height="${d * s}" aria-hidden="true"><rect x="1" y="1" width="${w * s - 2}" height="${d * s - 2}" rx="4"/>${back}${arms}</svg>`;
};
$('#palette').innerHTML = ORDER.map((k) => `<li><button type="button" class="p-mod" data-kind="${k}">
  <span class="p-mod-ico">${icon(k)}</span><span class="p-mod-name"><span class="vh">Add </span>${NAME[k]}</span><span class="p-mod-size" aria-hidden="true">${WIDTH[k]} × ${DEPTH[k]}</span></button></li>`).join('');
$('#fabrics').innerHTML = FABRICS.map((f) => `<label class="p-sw"><input type="radio" name="fabric" value="${f}"${f === fabric ? ' checked' : ''}><span class="p-sw-dot" style="--sw:${SWATCH[f]}"></span><span>${f}</span></label>`).join('');

function defaultSlot(kind) {
  for (const s of ['end', 'return', 'start', 'free']) if (place(layout, kind, s)) return s;
  return null;
}
function why(kind) {
  if (count(layout) >= MAX_MODULES) return 'Eight modules is the most one layout can hold.';
  if (kind === 'corner') return 'A layout takes one corner, at the end of the run.';
  return `There is no open end for the ${NAME[kind].toLowerCase()}. Remove an arm or a chaise first.`;
}
function add(kind, slot = defaultSlot(kind)) {
  const next = slot ? place(layout, kind, slot) : null;
  if (!next) { status.textContent = why(kind); return false; }
  layout = next;
  status.textContent = '';
  track('module_add', { kind, slot });
  render();
  return true;
}
function removeAt(id) {
  const [where, i] = id.split(':');
  const next = remove(layout, where === 'ottoman' ? 'ottoman' : where, Number(i));
  if (next === layout) { status.textContent = 'That piece holds the layout together. Remove the pieces after it first.'; return; }
  layout = next;
  status.textContent = '';
  render();
}

$('#palette').addEventListener('click', (e) => {
  const b = e.target.closest('.p-mod');
  if (!b || dragged) return;
  add(b.dataset.kind);
});
$('#fabrics').addEventListener('change', (e) => {
  fabric = e.target.value;
  scene?.setFabric(fabric);
  track('fabric', { fabric });
  render();
});
$('#list').addEventListener('click', (e) => {
  const r = e.target.closest('.p-rm');
  if (r) removeAt(r.dataset.id);
});
$('#list').addEventListener('keydown', (e) => {
  if ((e.key === 'Delete' || e.key === 'Backspace') && e.target.closest('[data-id]')) {
    e.preventDefault();
    const id = e.target.closest('[data-id]').dataset.id;
    const idx = [...$('#list').children].findIndex((li) => li.dataset.id === id);
    removeAt(id);
    const rest = $('#list').querySelectorAll('.p-row');
    (rest[Math.min(idx, rest.length - 1)] || $('#palette .p-mod'))?.focus();
  }
});
$('#share').addEventListener('click', async () => {
  const url = new URL(location.href);
  url.searchParams.set('l', encode(layout, fabric));
  history.replaceState(null, '', url);
  try { await navigator.clipboard.writeText(url.href); status.textContent = 'Link copied. Anyone with it sees this layout.'; } catch { status.textContent = 'The link is in your address bar. Copy it from there.'; }
  track('share_layout');
});
$('#showroom').addEventListener('click', () => { layout = SHOWROOM; render(); });
$('#clear').addEventListener('click', () => { layout = EMPTY; render(); });
document.querySelectorAll('.p-light-b').forEach((b) => b.addEventListener('click', () => setLight(b.dataset.light === 'evening' ? 1 : 0, true)));

function setLight(v, user) {
  body.dataset.light = v >= 0.5 ? 'evening' : 'day';
  document.querySelectorAll('.p-light-b').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.light === 'evening') === v >= 0.5)));
  scene?.setLight(v);
  if (user) manualLight = v;
}
let manualLight = null;

function render() {
  const ps = placements(layout);
  const d = dimensions(layout);
  const n = count(layout);
  body.dataset.fabric = slug(fabric);
  $('#count').textContent = `${n} of ${MAX_MODULES} modules`;
  $('#list').innerHTML = ps.map((p) => `<li class="p-item" data-id="${p.id}"><button type="button" class="p-row" data-id="${p.id}">
      <span class="p-row-name">${NAME[p.kind]}</span><span class="p-row-meta">${fabric} · ${WIDTH[p.kind]} × ${DEPTH[p.kind]} cm</span></button>
      <button type="button" class="p-rm" data-id="${p.id}" aria-label="Remove ${NAME[p.kind].toLowerCase()}">Remove</button></li>`).join('');
  $('#plan').innerHTML = planSvg(ps, d);
  const size = n && (d.widthCm || d.depthCm) ? `${d.widthCm} × ${d.depthCm} cm` : '0 × 0 cm';
  $('#dims').textContent = size;
  $('#bar-dims').textContent = n ? `${n} module${n > 1 ? 's' : ''} · ${size}` : 'No modules yet';
  const q = loaded ? quote(layout, fabric, products) : null;
  const total = q && n ? money(q.amount, q.currencyCode) : '';
  $('#total').textContent = loaded ? (n ? total : '$0') : '';
  $('#bar-total').textContent = total;
  const soldOut = loaded && cartLines(layout, fabric, products).some((l) => !Object.values(products).flatMap((p) => p.variants).find((v) => v.id === l.variantId)?.available);
  addBtn.disabled = !loaded || !n || q.missing > 0 || soldOut;
  if (soldOut) status.textContent = `One of these modules is sold out in ${fabric} in the demo store. Try another fabric.`;
  document.querySelectorAll('.p-mod').forEach((b) => { b.setAttribute('aria-disabled', String(!defaultSlot(b.dataset.kind))); });
  if (mode === 'build') scene?.showLayout(layout);
  if (armed && scene) scene.setGhosts(layout, armed);
}

// --- Drag from the palette into the room (desktop) ------------------------------------
let dragged = false, drag = null;
const chip = document.createElement('div');
chip.className = 'p-chip';
document.body.appendChild(chip);
$('#palette').addEventListener('pointerover', (e) => { const b = e.target.closest('.p-mod'); if (b && scene && e.pointerType === 'mouse') { armed = b.dataset.kind; scene.setGhosts(layout, armed); } });
$('#palette').addEventListener('pointerleave', () => { if (!drag) { armed = null; scene?.setGhosts(layout, null); } });
$('#palette').addEventListener('pointerdown', (e) => {
  const b = e.target.closest('.p-mod');
  if (!b || e.pointerType !== 'mouse' || !scene) return;
  drag = { kind: b.dataset.kind, x: e.clientX, y: e.clientY, on: false };
  dragged = false;
});
window.addEventListener('pointermove', (e) => {
  if (!drag) return;
  if (!drag.on && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 8) {
    drag.on = true; dragged = true; armed = drag.kind;
    scene.setGhosts(layout, armed);
    chip.textContent = NAME[drag.kind];
    body.classList.add('is-dragging');
  }
  if (!drag.on) return;
  chip.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 14}px)`;
  const s = scene.hoverAt(e.clientX, e.clientY);
  chip.classList.toggle('is-over', !!s);
});
window.addEventListener('pointerup', (e) => {
  if (!drag) return;
  if (drag.on) {
    const s = scene.hoverAt(e.clientX, e.clientY);
    if (s) add(drag.kind, s); else status.textContent = 'Drop the module on one of the outlined spots.';
    scene.hoverAt(null);
    body.classList.remove('is-dragging');
    setTimeout(() => { dragged = false; }, 0);
  }
  drag = null;
});

// --- Live dimension lines over the 3D room ----------------------------------------------
const dimSvg = $('.p-dims');
function drawDims() {
  requestAnimationFrame(drawDims);
  if (!scene || mode !== 'build' || !count(layout)) { dimSvg.innerHTML = ''; return; }
  const a = scene.dimAnchors();
  if (!a) { dimSvg.innerHTML = ''; return; }
  const d = dimensions(layout);
  const tick = (p, q) => { const dx = q.x - p.x, dy = q.y - p.y, l = Math.hypot(dx, dy) || 1, nx = -dy / l * 7, ny = dx / l * 7; return `M${p.x - nx} ${p.y - ny} L${p.x + nx} ${p.y + ny} M${q.x - nx} ${q.y - ny} L${q.x + nx} ${q.y + ny}`; };
  const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const m1 = mid(a.a, a.b), m2 = mid(a.c, a.d);
  dimSvg.innerHTML = `<path d="M${a.a.x} ${a.a.y} L${a.b.x} ${a.b.y} ${tick(a.a, a.b)}"/><text x="${m1.x}" y="${m1.y + 22}" text-anchor="middle">${d.widthCm} cm</text>`
    + (layout.ret.length ? `<path d="M${a.c.x} ${a.c.y} L${a.d.x} ${a.d.y} ${tick(a.c, a.d)}"/><text x="${m2.x + 12}" y="${m2.y}">${d.depthCm} cm</text>` : '');
}

// --- 3D --------------------------------------------------------------------------------
function fallback() {
  body.classList.add('no-gl');
  body.classList.remove('gl-ready');
  body.dataset.room = 'assembled';
}
async function start3d() {
  const device = readDevice();
  const tier = detectTier(device);
  if (!device.webgl2) return fallback();
  try {
    const { createPlinthaScene } = await import('./scene.js');
    scene = await createPlinthaScene($('#gl'), {
      tier, reducedMotion: reduced, onFallback: fallback,
      onReady: () => requestAnimationFrame(() => body.classList.add('gl-ready')),
      onAssembled: () => { body.dataset.room = 'assembled'; },
      onGhost: (slot) => { if (armed) add(armed, slot); },
      onPick: () => {},
    });
    if (!scene) return fallback();
    scene.setFabric(fabric);
    scene.showLayout(SHOWROOM, { drop: false });
    scene.assemble();
    requestAnimationFrame(drawDims);
    await scrollDrive();
  } catch {
    fallback();
  }
}

// Scroll: each chapter picks a camera view. The evening chapter scrubs the light. The builder swaps in your layout.
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
  const direct = () => {
    if (!st.build) return;
    const inBuild = st.build.isActive;
    if (inBuild !== (mode === 'build')) {
      mode = inBuild ? 'build' : 'showroom';
      body.dataset.mode = mode;
      scene.showLayout(inBuild ? layout : SHOWROOM);
      if (!inBuild) { armed = null; scene.setGhosts(layout, null); }
    }
    let view = 'hero';
    for (const k of ['plinth', 'fabric', 'evening']) if (st[k].isActive) view = k;
    if (inBuild) view = 'build';
    scene.setView(view);
    if (inBuild) { if (manualLight !== null) setLight(manualLight); else setLight(0); }
    else setLight(st.evening.isActive ? Math.min(1, st.evening.progress * 1.8) : 0);
  };
  for (const k of ['plinth', 'fabric', 'evening']) st[k] = ScrollTrigger.create({ trigger: `#${k}`, start: 'top 60%', end: 'bottom 40%', onUpdate: direct, onToggle: direct });
  st.build = ScrollTrigger.create({ trigger: '#build', start: 'top 70%', end: 'bottom top', onUpdate: direct, onToggle: direct });
  direct();
}

render();
loadProducts();
const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 200));
if (document.readyState === 'complete') idle(start3d);
else window.addEventListener('load', () => idle(start3d));
if (reduced) body.dataset.room = 'assembled';
