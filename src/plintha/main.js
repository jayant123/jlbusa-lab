// PLINTHA page: the configurator works as plain HTML (list, floor plan, totals, cart) and the 3D room joins it when it can.
// In the room the visitor selects a module, edits it from a floating toolbar, drags it along the sofa and adds pieces at
// the plus marks. Every edit goes through edit.js, so the rules and the undo history are the same with or without 3D.
import config from './config.js';
import { createStorefront } from '../kit/storefront.js';
import { fetchProduct } from '../kit/catalog.js';
import { createCart } from '../kit/cart.js';
import { mountCheckoutPanel } from '../kit/checkout-panel.js';
import { detectTier, readDevice } from '../kit/tier.js';
import { prefersReducedMotion } from '../kit/env.js';
import { track } from '../kit/track.js';
import { EMPTY, WIDTH, DEPTH, MAX_MODULES, place, count, dimensions, cartLines, quote } from './layout.js';
import { FABRICS, encode, decode } from './urlstate.js';
import { placements, footprint, bounds } from './positions.js';
import { planSvg } from './plan.js';
import { KINDS, insertAt, removeId, moveTo, move, swap, duplicate, handles, roomFit, createHistory, PRESETS, indexOfId } from './edit.js';
import { fromPrice, fabricSurcharge, FABRIC_INFO, LAYOUTS, layoutCard } from './store.js';

const $ = (s) => document.querySelector(s);
const body = document.body;
const reduced = prefersReducedMotion();
const NAME = { armless: 'Armless', corner: 'Corner', arm_left: 'Left arm', arm_right: 'Right arm', chaise: 'Chaise', ottoman: 'Ottoman' };
const SWATCH = { 'Boucle Chalk': '#e9e5dc', 'Wool Moss': '#5d6747', 'Linen Sand': '#c8b28c', 'Velvet Ink': '#1f2638' };
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const money = (n, c = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(n);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const START = PRESETS.find((p) => p.id === 'corner').layout;

// --- State --------------------------------------------------------------------
const fromUrl = new URLSearchParams(location.search).get('l');
const start = fromUrl ? decode(fromUrl) : { layout: START, fabric: FABRICS[0] };
const hist = createHistory(start.layout);
let fabric = start.fabric, products = {}, loaded = false, scene = null, mode = 'showroom', armed = null;
let sel = null, wallCm = 0, buildVisible = false;
const layoutNow = () => hist.now;

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
  const layout = layoutNow();
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

// --- Edits ----------------------------------------------------------------------
const say = (msg) => { status.textContent = msg; const m = $('#sel-msg'); if (m) m.textContent = msg; };
function commit(r, what) {
  if (!r || r.error) { say(r?.error || 'That does not fit.'); return false; }
  hist.push(r.layout);
  sel = r.sel !== undefined ? r.sel : sel;
  say('');
  if (what) track('layout_edit', { what });
  render();
  return true;
}
const ids = (l) => placements(l, { center: false }).map((p) => p.id);
function undo() { hist.undo(); afterHistory(); }
function redo() { hist.redo(); afterHistory(); }
function afterHistory() { if (sel && !ids(layoutNow()).includes(sel)) sel = null; say(''); render(); }
function select(id) {
  sel = id && ids(layoutNow()).includes(id) ? id : null;
  closeMenu();
  say('');
  render();
}

// Palette: add the module at the first open place.
function defaultSlot(kind) {
  for (const s of ['end', 'return', 'start', 'free']) if (place(layoutNow(), kind, s)) return s;
  return null;
}
function why(kind) {
  const l = layoutNow();
  if (count(l) >= MAX_MODULES) return 'Eight modules is the most one layout can hold.';
  if (kind === 'chaise' && [...l.main, ...l.ret].includes('chaise')) return 'A layout takes one chaise.';
  if (kind === 'corner') return 'A layout takes one corner. It goes at the end of the run.';
  return `There is no open end for the ${NAME[kind].toLowerCase()}. Remove an arm or a chaise first.`;
}
function add(kind, slot = defaultSlot(kind)) {
  const l = layoutNow();
  const next = slot ? place(l, kind, slot) : null;
  if (!next) { say(why(kind)); return false; }
  const id = slot === 'start' ? 'main:0' : slot === 'end' ? `main:${next.main.length - 1}` : slot === 'return' ? `ret:${next.ret.length - 1}` : `ottoman:${next.ottomans - 1}`;
  track('module_add', { kind, slot });
  return commit({ layout: next, sel: id });
}

// --- Store sections around the configurator ----------------------------------------
const toBuild = () => $('#build').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
const BLURB = {
  armless: 'The middle of any run. Add as many as the room allows.',
  corner: 'Turns the sofa through 90 degrees. Starts the return run.',
  arm_left: 'Closes the left end of a run with a low wide arm.',
  arm_right: 'Closes the right end of a run with a low wide arm.',
  chaise: 'A long seat to stretch out on. Ends a run.',
  ottoman: 'A free footstool. It also works as an extra seat.',
};
$('#grid').innerHTML = KINDS.map((k) => `<li class="p-card-p">
  <img src="/plintha/stills/module-${k}.webp" alt="The PLINTHA ${NAME[k].toLowerCase()} module in Boucle Chalk on its oak plinth." loading="lazy" width="900" height="1125">
  <div class="p-card-b"><h3>${NAME[k]}</h3><p class="p-card-size">${WIDTH[k]} × ${DEPTH[k]} cm</p><p>${BLURB[k]}</p>
  <p class="p-card-price" data-from="${k}"></p>
  <button type="button" class="p-card-btn" data-add-kind="${k}">Add to your sofa</button></div></li>`).join('');
$('#grid').addEventListener('click', (e) => {
  const b = e.target.closest('[data-add-kind]');
  if (!b) return;
  if (add(b.dataset.addKind)) say(`${NAME[b.dataset.addKind]} added to your layout.`);
  toBuild();
});
function setFabric(f) {
  if (!FABRIC_INFO[f]) return;
  fabric = f;
  const r = document.querySelector(`input[name="fabric"][value="${f}"]`);
  if (r) r.checked = true;
  scene?.setFabric(fabric);
  render();
}
$('#lays').innerHTML = LAYOUTS.map((l, i) => `<li class="p-lay">
  <img src="/plintha/stills/${l.photo}.webp" alt="The ${layoutCard(l, {}).name.toLowerCase()} layout in ${l.fabric}." loading="lazy" width="1200" height="900">
  <div class="p-lay-b"><h3>${layoutCard(l, {}).name} <span>in ${l.fabric}</span></h3><p>${l.note}</p>
  <p class="p-lay-meta"><span data-lay-size="${i}"></span><span data-lay-price="${i}"></span></p>
  <button type="button" class="p-card-btn" data-lay="${i}">Start from this layout</button></div></li>`).join('');
$('#lays').addEventListener('click', (e) => {
  const b = e.target.closest('[data-lay]');
  if (!b) return;
  const l = LAYOUTS[+b.dataset.lay], c = layoutCard(l, products);
  setFabric(l.fabric);
  if (commit({ layout: c.layout, sel: null }, 'layout_card')) say(`${c.name} in ${l.fabric} loaded. Edit any piece.`);
  toBuild();
});
$('#fabs').innerHTML = FABRICS.map((f) => `<li class="p-fab">
  <img src="/plintha/stills/${FABRIC_INFO[f].photo}.webp" alt="Close view of ${f} on a PLINTHA seat cushion." loading="lazy" width="1200" height="900">
  <div class="p-fab-b"><h3><span class="p-sw-dot" style="--sw:${SWATCH[f]}"></span>${f}</h3><p>${FABRIC_INFO[f].made}</p><p>${FABRIC_INFO[f].care}</p>
  <p class="p-fab-price" data-fab-price="${f}"></p>
  <button type="button" class="p-card-btn" data-use-fabric="${f}">Use ${f}</button></div></li>`).join('');
$('#fabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-use-fabric]');
  if (!b) return;
  setFabric(b.dataset.useFabric);
  say(`${b.dataset.useFabric} chosen for every module.`);
  toBuild();
});
$('#news-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $('#news-email'), msg = $('#news-msg');
  if (!input.checkValidity() || !input.value) { msg.textContent = 'Please enter a valid email address.'; input.focus(); return; }
  msg.textContent = 'Thank you. This is a demo store. We did not save your email.';
  input.value = '';
});
function renderStore() {
  document.querySelectorAll('[data-from]').forEach((el) => { const p = fromPrice(products, el.dataset.from); el.textContent = p ? `From ${money(p.amount, p.currencyCode)}` : ''; });
  LAYOUTS.forEach((l, i) => {
    const c = layoutCard(l, products);
    $(`[data-lay-size="${i}"]`).textContent = `${c.modules} modules · ${c.size}`;
    $(`[data-lay-price="${i}"]`).textContent = c.price ? money(c.price.amount, c.price.currencyCode) : '';
  });
  document.querySelectorAll('[data-fab-price]').forEach((el) => {
    const x = fabricSurcharge(products, el.dataset.fabPrice);
    el.textContent = x === null ? '' : x ? `Adds ${money(x)} per module` : 'Included in the module price';
  });
  document.querySelectorAll('[data-use-fabric]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.useFabric === fabric)));
}

// --- Builder markup ---------------------------------------------------------------
const icon = (kind) => {
  const w = WIDTH[kind], d = DEPTH[kind], s = 0.3;
  const back = kind === 'ottoman' ? '' : `<rect x="2" y="2" width="${w * s - 4}" height="7" rx="2" class="i-back"/>`;
  const arms = (kind === 'arm_left' ? `<rect x="2" y="2" width="7" height="${d * s - 4}" rx="2" class="i-back"/>` : '')
    + (kind === 'arm_right' || kind === 'corner' ? `<rect x="${w * s - 9}" y="2" width="7" height="${d * s - 4}" rx="2" class="i-back"/>` : '');
  return `<svg viewBox="0 0 ${w * s} ${d * s}" width="${w * s}" height="${d * s}" aria-hidden="true"><rect x="1" y="1" width="${w * s - 2}" height="${d * s - 2}" rx="4"/>${back}${arms}</svg>`;
};
// A small outline of a whole layout for the preset buttons.
const glyph = (l) => {
  const ps = placements(l);
  const b = bounds(ps);
  const k = 30 / Math.max(b.maxX - b.minX, b.maxZ - b.minZ);
  const r = ps.map((p) => { const f = footprint(p); return `<rect x="${((f.minX - b.minX) * k + 1).toFixed(1)}" y="${((f.minZ - b.minZ) * k + 1).toFixed(1)}" width="${((f.maxX - f.minX) * k - 1).toFixed(1)}" height="${((f.maxZ - f.minZ) * k - 1).toFixed(1)}" rx="1.2"/>`; }).join('');
  return `<svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">${r}</svg>`;
};
$('#presets').innerHTML = PRESETS.map((p) => `<button type="button" class="p-pre" data-preset="${p.id}" aria-pressed="false">${glyph(p.layout)}<span>${p.name}</span></button>`).join('');
$('#palette').innerHTML = KINDS.map((k) => `<li><button type="button" class="p-mod" data-kind="${k}">
  <span class="p-mod-ico">${icon(k)}</span><span class="p-mod-name"><span class="vh">Add </span>${NAME[k]}</span><span class="p-mod-size" aria-hidden="true">${WIDTH[k]} × ${DEPTH[k]}</span></button></li>`).join('');
$('#fabrics').innerHTML = FABRICS.map((f) => `<label class="p-sw"><input type="radio" name="fabric" value="${f}"${f === fabric ? ' checked' : ''}><span class="p-sw-dot" style="--sw:${SWATCH[f]}"></span><span>${f}</span></label>`).join('');
$('.p-sel').insertAdjacentHTML('beforeend', '<p class="p-sel-msg" id="sel-msg" aria-live="polite"></p>');

$('#presets').addEventListener('click', (e) => {
  const b = e.target.closest('.p-pre');
  if (!b) return;
  const p = PRESETS.find((q) => q.id === b.dataset.preset);
  if (commit({ layout: p.layout, sel: null }, 'preset')) say(`${p.name} loaded. Edit any piece.`);
});
$('#palette').addEventListener('click', (e) => {
  const b = e.target.closest('.p-mod');
  if (!b || dragged) return;
  add(b.dataset.kind);
});
$('#fabrics').addEventListener('change', (e) => {
  setFabric(e.target.value);
  track('fabric', { fabric });
});
$('#list').addEventListener('click', (e) => {
  const r = e.target.closest('.p-rm');
  if (r) { commit(removeId(layoutNow(), r.dataset.id), 'delete'); return; }
  const row = e.target.closest('.p-row');
  if (row) select(sel === row.dataset.id ? null : row.dataset.id);
});
$('#plan').addEventListener('click', (e) => { const g = e.target.closest('[data-id]'); if (g) select(g.dataset.id); });
$('#undo').addEventListener('click', () => undo());
$('#redo').addEventListener('click', () => redo());
$('#share').addEventListener('click', async () => {
  const url = new URL(location.href);
  url.searchParams.set('l', encode(layoutNow(), fabric));
  history.replaceState(null, '', url);
  try { await navigator.clipboard.writeText(url.href); say('Link copied. Anyone with it sees this layout.'); } catch { say('The link is in your address bar. Copy it from there.'); }
  track('share_layout');
});
$('#clear').addEventListener('click', () => commit({ layout: EMPTY, sel: null }, 'clear'));
$('#wall').addEventListener('input', (e) => { wallCm = Math.max(0, Math.min(2000, Math.round(Number(e.target.value)) || 0)); render(); });
document.querySelectorAll('.p-light-b').forEach((b) => b.addEventListener('click', () => setLight(b.dataset.light === 'evening' ? 1 : 0, true)));

function setLight(v, user) {
  body.dataset.light = v >= 0.5 ? 'evening' : 'day';
  document.querySelectorAll('.p-light-b').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.light === 'evening') === v >= 0.5)));
  scene?.setLight(v);
  if (user) manualLight = v;
}
let manualLight = null;

// --- Selection toolbar -------------------------------------------------------------------
const selBar = $('#sel');
selBar.addEventListener('click', (e) => {
  const b = e.target.closest('.p-sb');
  if (!b || !sel) return;
  const l = layoutNow();
  const act = b.dataset.act;
  if (act === 'close') { select(null); return; }
  if (act === 'left' || act === 'right') { commit(move(l, sel, act === 'left' ? -1 : 1), 'move'); return; }
  if (act === 'dup') { commit(duplicate(l, sel), 'duplicate'); return; }
  if (act === 'del') { commit(removeId(l, sel), 'delete'); return; }
  if (act === 'swap') openMenu(b, { swapOf: sel });
});
function renderSel() {
  const l = layoutNow();
  const p = sel && placements(l, { center: false }).find((q) => q.id === sel);
  selBar.hidden = !p || !buildVisible;
  if (!p) return;
  $('#sel-name').textContent = NAME[p.kind];
  $('#sel-size').textContent = `${WIDTH[p.kind]} × ${DEPTH[p.kind]} cm · ${fabric}`;
  const ret = p.where === 'ret';
  $('#sel-left').textContent = ret ? 'Toward corner' : 'Move left';
  $('#sel-right').textContent = ret ? 'Away from corner' : 'Move right';
  const ott = p.where === 'ottoman';
  selBar.querySelectorAll('[data-act="left"],[data-act="right"],[data-act="swap"]').forEach((b) => { b.hidden = ott; });
}

// --- Module menu: insert at a plus mark or swap ------------------------------------------
const menu = $('#menu');
let menuFor = null, menuFrom = null;
function openMenu(from, opts) {
  const l = layoutNow();
  menuFor = opts;
  menuFrom = from;
  const kinds = opts.swapOf ? KINDS.filter((k) => k !== 'ottoman') : KINDS;
  const cur = opts.swapOf ? placements(l, { center: false }).find((q) => q.id === opts.swapOf)?.kind : null;
  menu.innerHTML = `<p class="p-menu-h">${opts.swapOf ? `Swap the ${NAME[cur].toLowerCase()} for` : 'Add here'}</p>` + kinds.map((k) => {
    const r = opts.swapOf ? (k === cur ? { error: 'It is this module now.' } : swap(l, opts.swapOf, k)) : insertAt(l, opts.pos, k);
    return `<button type="button" role="menuitem" class="p-mi" data-kind="${k}"${r.error ? ' aria-disabled="true"' : ''}>${icon(k)}<span class="p-mi-t"><span>${NAME[k]}</span><small>${r.error || `${WIDTH[k]} × ${DEPTH[k]} cm`}</small></span></button>`;
  }).join('');
  menu.hidden = false;
  placeMenu();
  (menu.querySelector('.p-mi:not([aria-disabled])') || menu.querySelector('.p-mi'))?.focus();
}
function placeMenu() {
  if (menu.hidden || !menuFrom) return;
  if (innerWidth <= 640) { menu.style.left = ''; menu.style.top = ''; menu.classList.add('is-sheet'); return; }
  menu.classList.remove('is-sheet');
  const r = menuFrom.getBoundingClientRect();
  const w = menu.offsetWidth, h = menu.offsetHeight;
  const x = r.left + r.width / 2 - w / 2;
  let y = r.bottom + 8;
  if (y + h > innerHeight - 90) y = r.top - h - 8;
  menu.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, x))}px`;
  menu.style.top = `${Math.max(70, y)}px`;
}
function closeMenu(focusBack) {
  if (menu.hidden) return;
  menu.hidden = true;
  if (focusBack && menuFrom?.isConnected) menuFrom.focus();
  menuFor = null;
}
menu.addEventListener('click', (e) => {
  const b = e.target.closest('.p-mi');
  if (!b || !menuFor) return;
  const l = layoutNow();
  const k = b.dataset.kind;
  const what = menuFor.swapOf ? 'swap' : 'insert';
  if (b.getAttribute('aria-disabled') === 'true') { say(b.querySelector('small').textContent); return; }
  const r = menuFor.swapOf ? swap(l, menuFor.swapOf, k) : insertAt(l, menuFor.pos, k);
  closeMenu();
  commit(r, what);
});
menu.addEventListener('keydown', (e) => {
  const items = [...menu.querySelectorAll('.p-mi')];
  const i = items.indexOf(document.activeElement);
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus(); }
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenu(true); }
  if (e.key === 'Tab') closeMenu();
});
document.addEventListener('pointerdown', (e) => { if (!menu.hidden && !menu.contains(e.target) && !menuFrom?.contains(e.target)) closeMenu(); });

// --- Plus marks: in the room and in the panel ----------------------------------------------
const END_LABEL = { first: 'Add the first module', start: 'Add at the left end', end: 'Add at the right end', return: 'Add to the return', ottoman: 'Add an ottoman' };
function onHandle(btn) {
  const h = handles(layoutNow()).find((q) => String(q.pos) === btn.dataset.pos);
  if (!h) return;
  if (h.side === 'ottoman') { commit(insertAt(layoutNow(), 'ottoman', 'ottoman'), 'insert'); return; }
  openMenu(btn, { pos: h.pos });
}
$('#ends').addEventListener('click', (e) => { const b = e.target.closest('.p-end'); if (b) onHandle(b); });
const handleBox = $('#handles');
handleBox.addEventListener('click', (e) => { const b = e.target.closest('.p-plus'); if (b) onHandle(b); });
let handleWorld = []; // [{pos, side, x, y, z}] in the room's frame
function handlePoints(l) {
  return handles(l).map((h) => {
    const kind = h.side === 'ottoman' ? 'ottoman' : h.kinds[0];
    const r = insertAt(l, h.pos, kind);
    const p = r.layout && placements(r.layout, { center: false }).find((q) => q.id === r.sel);
    if (!p) return null;
    const f = footprint(p);
    const shift = h.pos === 0 && h.side !== 'first' ? WIDTH[kind] / 100 : 0;
    return { ...h, x: (f.minX + f.maxX) / 2 - shift, y: 0.3, z: (f.minZ + f.maxZ) / 2 };
  }).filter(Boolean);
}

// --- Render -------------------------------------------------------------------------------
function render() {
  renderStore();
  const layout = layoutNow();
  const ps = placements(layout);
  const d = dimensions(layout);
  const n = count(layout);
  body.dataset.fabric = slug(fabric);
  $('#count').textContent = `${n} of ${MAX_MODULES} modules`;
  $('#list').innerHTML = ps.map((p) => `<li class="p-item${p.id === sel ? ' is-sel' : ''}" data-id="${p.id}"><button type="button" class="p-row" data-id="${p.id}" aria-pressed="${p.id === sel}">
      <span class="p-row-name">${NAME[p.kind]}</span><span class="p-row-meta">${fabric} · ${WIDTH[p.kind]} × ${DEPTH[p.kind]} cm</span></button>
      <button type="button" class="p-rm" data-id="${p.id}" aria-label="Remove ${NAME[p.kind].toLowerCase()}">Remove</button></li>`).join('');
  $('#ends').innerHTML = handles(layout).map((h) => `<button type="button" class="p-end" data-pos="${h.pos}"${h.side === 'ottoman' ? '' : ' aria-haspopup="menu"'}><span aria-hidden="true">+</span>${END_LABEL[h.side]}</button>`).join('');
  $('#plan').innerHTML = planSvg(ps, d, { selected: sel, wallCm });
  const size = n && (d.widthCm || d.depthCm) ? `${d.widthCm} × ${d.depthCm} cm` : '0 × 0 cm';
  $('#dims').textContent = size;
  $('#bar-dims').textContent = n ? `${n} module${n > 1 ? 's' : ''} · ${size}` : 'No modules yet';
  const q = loaded ? quote(layout, fabric, products) : null;
  const total = q && n ? money(q.amount, q.currencyCode) : '';
  $('#total').textContent = loaded ? (n ? total : '$0') : '';
  $('#bar-total').textContent = total;
  const soldOut = loaded && cartLines(layout, fabric, products).some((l) => !Object.values(products).flatMap((p) => p.variants).find((v) => v.id === l.variantId)?.available);
  addBtn.disabled = !loaded || !n || q.missing > 0 || soldOut;
  if (soldOut) say(`One of these modules is sold out in ${fabric} in the demo store. Try another fabric.`);
  document.querySelectorAll('.p-mod').forEach((b) => { b.setAttribute('aria-disabled', String(!defaultSlot(b.dataset.kind))); });
  document.querySelectorAll('.p-pre').forEach((b) => b.setAttribute('aria-pressed', String(same(PRESETS.find((p) => p.id === b.dataset.preset).layout, layout))));
  $('#undo').disabled = !hist.canUndo;
  $('#redo').disabled = !hist.canRedo;
  const fit = roomFit(layout, wallCm);
  const fitEl = $('#fit');
  fitEl.className = `p-fit-out${fit ? (fit.fits ? ' is-ok' : ' is-bad') : ''}`;
  fitEl.textContent = !fit ? (wallCm ? 'Add a module to check the fit.' : 'Enter your wall to check the fit.')
    : fit.fits ? `It fits. ${fit.spareCm} cm to spare on this wall.`
      : fit.spareCm >= 0 ? `Too tight. Only ${fit.spareCm} cm to spare. Leave at least 60 cm.` : `Too long by ${-fit.spareCm} cm for this wall.`;
  handleWorld = handlePoints(layout);
  handleBox.innerHTML = handleWorld.map((h) => `<button type="button" class="p-plus" data-pos="${h.pos}" tabindex="-1" aria-hidden="true"><span>+</span></button>`).join('');
  if (mode === 'build') { scene?.showLayout(layout); scene?.select(sel); }
  if (armed && scene) scene.setGhosts(layout, armed);
  renderSel();
}

// --- Keyboard -------------------------------------------------------------------------------
window.addEventListener('keydown', (e) => {
  const t = e.target;
  // A key pressed on a control inside the configurator always counts. The visibility flag can lag behind a scroll.
  if (!buildVisible && !t.closest?.('#build')) return;
  const typing = t.closest?.('input,textarea,select,[contenteditable]');
  const mod = e.metaKey || e.ctrlKey;
  if (mod && !typing && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
  if (mod && !typing && e.key === 'y') { e.preventDefault(); redo(); return; }
  if (typing || mod || document.querySelector('.kit-panel[open], dialog[open]')) return;
  const rowId = t.closest?.('#list [data-id]')?.dataset.id;
  if (e.key === 'Delete' || e.key === 'Backspace') {
    const id = rowId || sel;
    if (!id) return;
    e.preventDefault();
    const idx = [...$('#list').children].findIndex((li) => li.dataset.id === id);
    commit(removeId(layoutNow(), id), 'delete');
    if (rowId) { const rest = $('#list').querySelectorAll('.p-row'); (rest[Math.min(idx, rest.length - 1)] || $('#palette .p-mod'))?.focus(); }
    return;
  }
  if (e.key === 'Escape' && sel && menu.hidden) { select(null); return; }
  if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && sel && !t.closest?.('#menu')) {
    e.preventDefault();
    commit(move(layoutNow(), sel, e.key === 'ArrowLeft' ? -1 : 1), 'move');
  }
});

// The view tools and plus marks show only while the configurator covers the middle of the screen.
new IntersectionObserver(([en]) => body.classList.toggle('tools-on', en.isIntersecting), { rootMargin: '-40% 0px -40% 0px' }).observe($('#build'));
new IntersectionObserver(([en]) => { buildVisible = en.isIntersecting; body.classList.toggle('in-build', buildVisible); if (!buildVisible) closeMenu(); renderSel(); }, { threshold: 0.05 }).observe($('#build'));

// --- Drag from the palette into the room (desktop) ------------------------------------
let dragged = false, drag = null;
const chip = document.createElement('div');
chip.className = 'p-chip';
document.body.appendChild(chip);
$('#palette').addEventListener('pointerover', (e) => { const b = e.target.closest('.p-mod'); if (b && scene && mode === 'build' && e.pointerType === 'mouse') { armed = b.dataset.kind; scene.setGhosts(layoutNow(), armed); } });
$('#palette').addEventListener('pointerleave', () => { if (!drag) { armed = null; scene?.setGhosts(layoutNow(), null); } });
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
    scene.setGhosts(layoutNow(), armed);
    chip.textContent = NAME[drag.kind];
    body.classList.add('is-dragging');
  }
  if (!drag.on) return;
  chip.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 14}px)`;
  chip.classList.toggle('is-over', !!scene.hoverAt(e.clientX, e.clientY));
});
window.addEventListener('pointerup', (e) => {
  if (!drag) return;
  if (drag.on) {
    const s = scene.hoverAt(e.clientX, e.clientY);
    if (s) add(drag.kind, s); else say('Drop the module on one of the outlined spots.');
    scene.hoverAt(null);
    body.classList.remove('is-dragging');
    setTimeout(() => { dragged = false; }, 0);
  }
  drag = null;
});

// --- In the room: tap to select, drag a module to reorder, drag the room to orbit ----------------
function roomPointer(canvas) {
  let g = null; // the gesture in progress
  const center = (p) => { const f = footprint(p); return { x: (f.minX + f.maxX) / 2, z: (f.minZ + f.maxZ) / 2 }; };
  canvas.addEventListener('pointerdown', (e) => {
    if (mode !== 'build' || drag) return;
    const id = scene.pieceAt(e.clientX, e.clientY);
    const at = scene.floorAt(e.clientX, e.clientY);
    g = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, id, at, moved: false, mouse: e.pointerType === 'mouse', kind: null, target: null };
    if (g.mouse) canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (mode !== 'build') return;
    if (!g) {
      if (e.pointerType === 'mouse') canvas.style.cursor = scene.pieceAt(e.clientX, e.clientY) ? 'pointer' : 'grab';
      return;
    }
    if (!g.moved && Math.hypot(e.clientX - g.x, e.clientY - g.y) > 6) {
      g.moved = true;
      g.kind = g.mouse && g.id && g.at && !g.id.startsWith('ottoman') ? 'move' : 'orbit';
      if (g.kind === 'move') {
        if (sel !== g.id) select(g.id);
        const p = placements(layoutNow(), { center: false }).find((q) => q.id === g.id);
        g.offset = { x: p.x - g.at.x, z: p.z - g.at.z };
        g.grab = { x: center(p).x - p.x, z: center(p).z - p.z };
        body.classList.add('is-moving');
      }
    }
    if (!g.moved) return;
    if (g.kind === 'orbit') {
      scene.orbitBy(e.clientX - g.lx, g.mouse ? e.clientY - g.ly : 0);
      g.lx = e.clientX; g.ly = e.clientY;
      syncViewButtons();
      return;
    }
    const at = scene.floorAt(e.clientX, e.clientY);
    if (!at) return;
    const here = { x: at.x + g.offset.x, z: at.z + g.offset.z };
    scene.drag(g.id, here);
    // snap to the valid place along the sofa nearest the pointer
    const l = layoutNow();
    const seqLen = l.main.length + l.ret.length;
    let best = null;
    for (let pos = 0; pos < seqLen; pos++) {
      const r = moveTo(l, g.id, pos);
      if (r.error) continue;
      const p = placements(r.layout, { center: false }).find((q) => q.id === r.sel);
      const c = center(p);
      const dd = Math.hypot(c.x - (here.x + g.grab.x), c.z - (here.z + g.grab.z));
      if (!best || dd < best.d) best = { d: dd, pos, p };
    }
    g.target = best;
    scene.setSnap(best ? best.p : null);
  });
  const end = (e, cancel) => {
    if (!g) return;
    const was = g;
    g = null;
    body.classList.remove('is-moving');
    if (was.kind === 'move') {
      scene.drag(null);
      scene.setSnap(null);
      const l = layoutNow();
      if (!cancel && was.target && was.target.pos !== indexOfId(l, was.id)) commit(moveTo(l, was.id, was.target.pos), 'drag');
      else render();
      return;
    }
    if (cancel || was.moved) return;
    const slot = armed ? scene.slotAt(e.clientX, e.clientY) : null;
    if (slot) { add(armed, slot); return; }
    const id = scene.pieceAt(e.clientX, e.clientY);
    select(id && id === sel ? null : id);
  };
  canvas.addEventListener('pointerup', (e) => end(e, false));
  canvas.addEventListener('pointercancel', (e) => end(e, true));
  canvas.addEventListener('wheel', (e) => {
    if (mode !== 'build' || !e.ctrlKey) return; // a trackpad pinch zooms. A plain wheel keeps scrolling the page.
    e.preventDefault();
    scene.zoomBy(Math.exp(e.deltaY * 0.01));
  }, { passive: false });
}

function syncViewButtons() {
  const top = !!scene?.top;
  $('#view-top').setAttribute('aria-pressed', String(top));
  $('#view-3d').setAttribute('aria-pressed', String(!top));
}
$('#view-3d').addEventListener('click', () => { scene?.setTop(false); syncViewButtons(); });
$('#view-top').addEventListener('click', () => { scene?.setTop(true); syncViewButtons(); track('top_view'); });
$('#rot-l').addEventListener('click', () => { scene?.orbitBy(-70, 0); syncViewButtons(); });
$('#rot-r').addEventListener('click', () => { scene?.orbitBy(70, 0); syncViewButtons(); });
$('#zoom-in').addEventListener('click', () => scene?.zoomBy(0.85));
$('#zoom-out').addEventListener('click', () => scene?.zoomBy(1 / 0.85));
$('#view-reset').addEventListener('click', () => { scene?.resetView(); syncViewButtons(); });

// --- Per frame: dimension lines, plus marks and the floating toolbar follow the room --------------
const dimSvg = $('.p-dims');
const floating = () => scene && mode === 'build' && innerWidth > 640;
// Narrow screens: tell the camera which band of the screen is free of the header, tools, panel, sheets and bar.
const shown = (el) => el && !el.hidden && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden';
function safeArea() {
  if (!scene || mode !== 'build') return null;
  if (innerWidth > 900) {
    // Wide screens: the panel sits on the left. The sofa fits the space to its right.
    const pr = $('.p-panel').getBoundingClientRect();
    const top = Math.max($('.p-top').getBoundingClientRect().bottom, shown($('#tools')) ? $('#tools').getBoundingClientRect().bottom : 0) + 10;
    return { top, bottom: $('.p-bar').getBoundingClientRect().top - 10, left: Math.max(0, pr.right) + 10 };
  }
  let top = $('.p-top').getBoundingClientRect().bottom;
  const tools = $('#tools');
  if (shown(tools)) top = Math.max(top, tools.getBoundingClientRect().bottom);
  let bottom = $('.p-bar').getBoundingClientRect().top;
  for (const el of [$('.p-panel'), selBar, $('#menu')]) {
    if (!shown(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.height && r.top < bottom && r.bottom > top + 40) bottom = Math.min(bottom, r.top);
  }
  return { top: top + 10, bottom: Math.max(top + 120, bottom - 10) };
}
let lastSafe = '';
function frame() {
  requestAnimationFrame(frame);
  if (scene) {
    const a = safeArea();
    const key = a ? `${Math.round(a.top)}:${Math.round(a.bottom)}` : '';
    if (key !== lastSafe) { lastSafe = key; scene.setSafeArea(a); }
  }
  const layout = layoutNow();
  const live = scene && mode === 'build';
  body.classList.toggle('sel-float', !!(floating() && sel));
  const btns = handleBox.children;
  for (let i = 0; i < btns.length; i++) {
    const h = handleWorld[i];
    if (!live || !h) { btns[i].style.opacity = '0'; continue; }
    const s = scene.project(h.x, h.y, h.z);
    btns[i].style.opacity = s.front ? '' : '0';
    btns[i].style.transform = `translate(${Math.round(s.x)}px, ${Math.round(s.y)}px)`;
  }
  if (floating() && sel && !selBar.hidden) {
    const p = placements(layout, { center: false }).find((q) => q.id === sel);
    if (p) {
      const f = footprint(p);
      const s = scene.project((f.minX + f.maxX) / 2, 0.95, (f.minZ + f.maxZ) / 2);
      const w = selBar.offsetWidth, h = selBar.offsetHeight;
      const minX = Math.min(innerWidth - w - 12, 500);
      const x = Math.max(minX, Math.min(innerWidth - w - 12, s.x - w / 2));
      const y = Math.max(134, Math.min(innerHeight - h - 96, s.y - h - 24));
      selBar.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    }
  } else selBar.style.transform = '';
  placeMenu();
  if (!live || !count(layout) || scene.top) { dimSvg.innerHTML = ''; return; }
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
  const tier = new URLSearchParams(location.search).get('tier') || detectTier(device);
  if (!device.webgl2) return fallback();
  try {
    const { createPlinthaScene } = await import('./scene.js');
    scene = await createPlinthaScene($('#gl'), {
      tier, reducedMotion: reduced, onFallback: fallback,
      onReady: () => requestAnimationFrame(() => body.classList.add('gl-ready')),
      onAssembled: () => { body.dataset.room = 'assembled'; },
    });
    if (!scene) return fallback();
    scene.setFabric(fabric);
    scene.showLayout(layoutNow(), { drop: false });
    scene.assemble();
    roomPointer($('#gl'));
    requestAnimationFrame(frame);
    await scrollDrive();
  } catch {
    fallback();
  }
}

// Scroll: the room only shows inside the configurator. Entering it swaps in your layout. Leaving it stops drawing.
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
  let st = null;
  const direct = () => {
    if (!st) return;
    const inBuild = st.isActive;
    scene.setActive?.(inBuild);
    body.classList.toggle('p-3d-on', inBuild);
    if (inBuild !== (mode === 'build')) {
      mode = inBuild ? 'build' : 'showroom';
      body.dataset.mode = mode;
      scene.showLayout(layoutNow());
      scene.select(inBuild ? sel : null);
      if (!inBuild) { armed = null; scene.setGhosts(layoutNow(), null); closeMenu(); }
      renderSel();
    }
    scene.setView('build');
    setLight(manualLight !== null ? manualLight : 0);
  };
  st = ScrollTrigger.create({ trigger: '#build', start: 'top bottom', end: 'bottom top', onUpdate: direct, onToggle: direct });
  direct();
}

render();
loadProducts();
// The 3D room is heavy to set up. It waits for the visitor's first move (scroll, touch, pointer or key).
// ?gl starts it straight away (tests and screenshots).
let started = false;
const WAKE = ['pointermove', 'pointerdown', 'touchstart', 'wheel', 'scroll', 'keydown'];
const kick = () => {
  if (started) return;
  started = true;
  WAKE.forEach((ev) => window.removeEventListener(ev, kick, true));
  (window.requestIdleCallback || ((fn) => setTimeout(fn, 1)))(start3d, { timeout: 300 });
};
WAKE.forEach((ev) => window.addEventListener(ev, kick, { capture: true, passive: true }));
if (new URLSearchParams(location.search).has('gl')) window.addEventListener('load', kick);
if (reduced) body.dataset.room = 'assembled';
