// Seed JSON -> Shopify product import CSV. Sold-out variants are tracked at 0 (deny); every other variant is
// untracked so it stays available (Shopify's importer ignores per-variant quantities on new stores).  node tools/to_csv.mjs seed/ostrel.json > ostrel.csv
import { readFileSync } from 'node:fs';

const HEADER = ['Handle', 'Title', 'Body (HTML)', 'Vendor', 'Type', 'Tags', 'Published',
  'Option1 Name', 'Option1 Value', 'Option2 Name', 'Option2 Value', 'Option3 Name', 'Option3 Value',
  'Variant SKU', 'Variant Grams', 'Variant Inventory Tracker', 'Variant Inventory Qty', 'Variant Inventory Policy',
  'Variant Fulfillment Service', 'Variant Price', 'Variant Requires Shipping', 'Variant Taxable', 'Image Src', 'Image Position', 'Status'];

const cell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const matches = (when, sel) => Object.entries(when).every(([k, v]) => sel[k] === v);

function combos(options) {
  return options.reduce((acc, o) => acc.flatMap((a) => o.values.map((v) => ({ ...a, [o.name]: v }))), [{}]);
}

export function toCsv(seed) {
  const out = [HEADER];
  for (const p of seed.products) {
    const variants = combos(p.options).filter((sel) => !(p.exclude || []).some((w) => matches(w, sel)));
    variants.forEach((sel, i) => {
      const price = p.options.reduce((s, o) => s + (p.price.add?.[o.name]?.[sel[o.name]] ?? 0), p.price.base ?? 0);
      const inv = (p.inventory.set || []).find((x) => matches(x.when, sel));
      const qty = inv ? inv.qty : p.inventory.default;
      const sku = [p.handle, ...p.options.map((o) => sel[o.name])].join('-').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const first = i === 0;
      const img = (p.images || [])[i];
      out.push([p.handle, first ? p.title : '', first ? p.body : '', first ? seed.vendor : '', first ? p.type : '', first ? `concept,${seed.brand.toLowerCase()}` : '', first ? 'TRUE' : '',
        ...[0, 1, 2].flatMap((k) => (p.options[k] ? [first ? p.options[k].name : '', sel[p.options[k].name]] : ['', ''])),
        sku, p.grams ?? 0, qty === 0 ? 'shopify' : '', qty === 0 ? 0 : '', qty === 0 ? 'deny' : 'continue', 'manual', price.toFixed(2), 'TRUE', 'TRUE', img || '', img ? i + 1 : '', first ? 'active' : '']);
    });
  }
  return out.map((r) => r.map(cell).join(',')).join('\n') + '\n';
}

export function parseCsv(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}

if (process.argv[1]?.endsWith('to_csv.mjs') && process.argv[2]) process.stdout.write(toCsv(JSON.parse(readFileSync(process.argv[2], 'utf8'))));
