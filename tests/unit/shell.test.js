import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FOOTER = 'Concept by JLB USA. Fictional brand. Products and prices are demo data.';
const pages = ['index.html', 'ostrel/index.html', 'plintha/index.html'];

describe('page shells', () => {
  for (const p of pages) {
    it(`${p} is noindex, carries the footer and no service prices`, () => {
      const html = readFileSync(resolve(process.cwd(), p), 'utf8');
      expect(html).toContain('<meta name="robots" content="noindex">');
      expect(html).toContain(FOOTER);
      expect(html).not.toMatch(/\$\s?\d/);
    });
  }
});
