// Store content around the configurator: module prices, fabric surcharges and the ready-made layouts.
// Every price comes from the Shopify variants. Nothing here holds a price of its own.
import { handleOf, quote, dimensions, count } from './layout.js';
import { PRESETS } from './edit.js';

// The lowest price among the module's variants that can be bought.
export function fromPrice(products, kind) {
  const vs = (products[handleOf(kind)]?.variants || []).filter((v) => v.available !== false);
  if (!vs.length) return null;
  const v = vs.reduce((a, b) => (b.price < a.price ? b : a));
  return { amount: v.price, currencyCode: v.currencyCode || 'USD' };
}

// What one module costs extra in a fabric, compared with the first fabric. Read from the armless module.
export function fabricSurcharge(products, fabric) {
  const vs = products[handleOf('armless')]?.variants || [];
  const base = vs.find((v) => v.selectedOptions.Fabric === 'Boucle Chalk');
  const this_ = vs.find((v) => v.selectedOptions.Fabric === fabric);
  if (!base || !this_) return null;
  return this_.price - base.price;
}

export const FABRIC_INFO = {
  'Boucle Chalk': { made: 'Wool and cotton boucle with a looped surface.', care: 'Cold gentle wash. Hides marks and pet hair well.', photo: 'fabric-Boucle-Chalk' },
  'Wool Moss': { made: 'Tightly woven pure wool in a deep green.', care: 'Cold gentle wash. Warm in winter and hard wearing.', photo: 'fabric-Wool-Moss' },
  'Linen Sand': { made: 'Washed Belgian-style linen in a warm sand.', care: 'Cold wash. It softens and creases a little over time.', photo: 'fabric-Linen-Sand' },
  'Velvet Ink': { made: 'Cotton velvet with a short dense pile.', care: 'Dry clean only. Brush the pile with a soft brush.', photo: 'fabric-Velvet-Ink' },
};

// Ready-made layouts shown as photos. Each one loads a preset in a fabric.
export const LAYOUTS = [
  { preset: 'corner', fabric: 'Wool Moss', photo: 'layout-corner-moss', note: 'Room for five. Fits a wall of 4.5 m.' },
  { preset: 'u', fabric: 'Velvet Ink', photo: 'layout-u-ink', note: 'A chaise at one end and a corner at the other.' },
  { preset: 'chaise', fabric: 'Linen Sand', photo: 'layout-chaise-sand', note: 'Four seats and a long chaise to stretch out on.' },
];

export function layoutCard(l, products) {
  const p = PRESETS.find((q) => q.id === l.preset);
  const d = dimensions(p.layout);
  const q = quote(p.layout, l.fabric, products);
  return {
    name: p.name, layout: p.layout, modules: count(p.layout),
    size: `${d.widthCm} × ${d.depthCm} cm`,
    price: q.missing || !q.amount ? null : { amount: q.amount, currencyCode: q.currencyCode },
  };
}
