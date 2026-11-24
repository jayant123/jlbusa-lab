import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { toCsv, parseCsv } from '../../tools/to_csv.mjs';

const seed = (b) => JSON.parse(readFileSync(resolve(process.cwd(), `seed/${b}.json`), 'utf8'));

describe('to_csv', () => {
  it('turns the OSTREL seed into Shopify product CSV rows', () => {
    const rows = parseCsv(toCsv(seed('ostrel')));
    const [header, ...data] = rows;
    for (const h of ['Handle', 'Title', 'Option1 Name', 'Option1 Value', 'Option2 Name', 'Option3 Value', 'Variant Price', 'Variant Inventory Qty', 'Variant Inventory Policy', 'Image Src', 'Status'])
      expect(header).toContain(h);
    expect(data).toHaveLength(27);
    const col = (n) => header.indexOf(n);
    const sold = data.filter((r) => r[col('Variant Inventory Qty')] === '0');
    expect(sold).toHaveLength(1);
    expect(sold[0][col('Variant Inventory Policy')]).toBe('deny');
    expect([sold[0][col('Option1 Value')], sold[0][col('Option2 Value')], sold[0][col('Option3 Value')]]).toEqual(['Glacier', 'Black ceramic', 'Steel bracelet']);
    const champ = data.find((r) => r[col('Option1 Value')] === 'Champagne' && r[col('Option2 Value')] === 'Polished steel' && r[col('Option3 Value')] === 'Cognac calf');
    expect(champ[col('Variant Price')]).toBe('4800.00');
    const avail = data.filter((r) => r[col('Variant Inventory Qty')] !== '0');
    expect(avail.every((r) => r[col('Variant Inventory Tracker')] === '' && r[col('Variant Inventory Policy')] === 'continue')).toBe(true);
    expect(sold[0][col('Variant Inventory Tracker')]).toBe('shopify');
    expect(data[0][col('Title')]).toBe('OSTREL Meridian 40');
    expect(data[1][col('Title')]).toBe('');
  });

  it('turns the PLINTHA seed into 24 variant rows with one sold out', () => {
    const [header, ...data] = parseCsv(toCsv(seed('plintha')));
    const col = (n) => header.indexOf(n);
    expect(data).toHaveLength(24);
    const sold = data.filter((r) => r[col('Variant Inventory Qty')] === '0');
    expect(sold).toHaveLength(1);
    expect(sold[0][col('Handle')]).toBe('plintha-ottoman');
    expect(sold[0][col('Variant Inventory Policy')]).toBe('deny');
    expect(new Set(data.map((r) => r[col('Handle')])).size).toBe(6);
  });
});
