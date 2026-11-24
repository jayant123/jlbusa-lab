// OSTREL configurator: option groups render immediately from the known option list; prices, availability and
// the variant to add always come from the Shopify product once it loads.
import { resolveVariant, variantState } from '../kit/catalog.js';

export const OPTIONS = [
  { name: 'Dial', values: ['Obsidian', 'Champagne', 'Glacier'], swatch: { Obsidian: '#0d0e10', Champagne: '#c8a874', Glacier: '#c9d6de' } },
  { name: 'Case', values: ['Brushed platinum', 'Polished steel', 'Black ceramic'], swatch: { 'Brushed platinum': '#cfd0d3', 'Polished steel': '#e9eaec', 'Black ceramic': '#151618' } },
  { name: 'Strap', values: ['Black calf', 'Cognac calf', 'Steel bracelet'], swatch: { 'Black calf': '#141414', 'Cognac calf': '#7b4321', 'Steel bracelet': '#b9bbbe' } },
];

const money = (n, c = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(n);
const id = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

export function createConfigurator({ form, priceEl, addBtn, summaryEl, statusEl, onChange }) {
  let product = null;
  let failed = false;
  const sel = Object.fromEntries(OPTIONS.map((o) => [o.name, o.values[0]]));

  form.innerHTML = OPTIONS.map((o) => `
    <fieldset class="o-group" aria-labelledby="lg-${id(o.name)}">
      <legend id="lg-${id(o.name)}">${o.name}</legend>
      <div class="o-choices">${o.values.map((v) => `
        <label class="o-choice">
          <input type="radio" name="${o.name}" value="${v}" ${sel[o.name] === v ? 'checked' : ''}>
          <span class="o-swatch" style="--sw:${o.swatch[v]}"></span><span class="o-choice-t">${v}</span>
        </label>`).join('')}
      </div>
    </fieldset>`).join('');
  form.addEventListener('change', (e) => {
    if (e.target.type !== 'radio') return;
    sel[e.target.name] = e.target.value;
    render();
    onChange?.({ ...sel });
  });

  function current() {
    return product ? resolveVariant(product, sel) : null;
  }

  function render() {
    summaryEl.textContent = OPTIONS.map((o) => sel[o.name]).join(' · ');
    if (failed) {
      priceEl.textContent = '';
      addBtn.disabled = true;
      addBtn.textContent = 'Add to cart';
      return;
    }
    if (!product) {
      priceEl.textContent = '';
      addBtn.disabled = true;
      addBtn.textContent = 'Add to cart';
      statusEl.textContent = 'Prices are loading…';
      return;
    }
    const v = current();
    const state = variantState(v);
    priceEl.textContent = v ? money(v.price, v.currencyCode) : '—';
    addBtn.disabled = state !== 'available';
    addBtn.textContent = state === 'available' ? 'Add to cart' : state === 'soldout' ? 'Sold out' : 'Not available';
    statusEl.textContent = state === 'available' ? '' : state === 'soldout' ? 'This combination is sold out in the demo store.' : 'This combination isn’t offered.';
  }

  render();
  return {
    selections: () => ({ ...sel }),
    variant: current,
    setProduct(p) { product = p; failed = false; render(); },
    setFailed(retry) {
      failed = true;
      render();
      statusEl.innerHTML = 'Couldn\'t load prices. <button type="button" class="o-retry">Try again</button>';
      statusEl.querySelector('.o-retry').addEventListener('click', retry);
    },
    setLoading() { failed = false; product = null; render(); },
    // Preset every group at once (from a build card). Unknown values are ignored.
    setSelections(next) {
      for (const o of OPTIONS) {
        const v = next?.[o.name];
        if (!o.values.includes(v)) continue;
        sel[o.name] = v;
        const r = form.querySelector(`input[name="${o.name}"][value="${v}"]`);
        if (r) r.checked = true;
      }
      render();
      onChange?.({ ...sel });
    },
  };
}
