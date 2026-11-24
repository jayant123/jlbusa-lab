// Top-down floor plan of the layout as an SVG string, in centimeters, drawn like an architect's sketch.
import { WIDTH, DEPTH } from './layout.js';
import { footprint, bounds } from './positions.js';

const LABEL = { armless: 'Armless', corner: 'Corner', arm_left: 'Arm L', arm_right: 'Arm R', chaise: 'Chaise', ottoman: 'Ottoman' };
const cm = (m) => Math.round(m * 100);

export function planSvg(ps, dims, { selected = null } = {}) {
  if (!ps.length) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 220" role="img" aria-label="Empty floor plan">'
      + '<rect class="room" x="10" y="10" width="380" height="200"/><text class="hint" x="200" y="116" text-anchor="middle">Add a module to start</text></svg>';
  }
  const b = bounds(ps);
  const x0 = cm(b.minX), z0 = cm(b.minZ), W = cm(b.maxX) - x0, D = cm(b.maxZ) - z0;
  const pad = 46;
  const vb = `${x0 - pad} ${z0 - pad} ${W + pad * 2} ${D + pad * 2}`;
  let body = '';
  for (const p of ps) {
    const f = footprint(p);
    const x = cm(f.minX), y = cm(f.minZ), w = cm(f.maxX) - x, h = cm(f.maxZ) - y;
    const sel = p.id === selected ? ' is-sel' : '';
    body += `<g data-id="${p.id}" class="m${sel} ${p.kind}"><rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${h - 2}" rx="6"/>`;
    if (p.kind !== 'ottoman') {
      // the back cushion band
      const band = p.rot ? `<rect class="back" x="${x + w - 26}" y="${y + 4}" width="22" height="${h - 8}" rx="5"/>` : `<rect class="back" x="${x + 4}" y="${y + 4}" width="${w - 8}" height="22" rx="5"/>`;
      body += band;
    }
    body += `<text x="${x + w / 2}" y="${y + h / 2 + 4}" text-anchor="middle">${LABEL[p.kind]}</text></g>`;
  }
  const top = z0 - 22, right = x0 + W + 22;
  const dimW = dims.widthCm || W, dimD = dims.depthCm || D;
  body += `<g class="dim"><path d="M${x0} ${top} H${x0 + W} M${x0} ${top - 6} V${top + 6} M${x0 + W} ${top - 6} V${top + 6}"/>`
    + `<text x="${x0 + W / 2}" y="${top - 8}" text-anchor="middle">${dimW} cm</text>`
    + `<path d="M${right} ${z0} V${z0 + dimD} M${right - 6} ${z0} H${right + 6} M${right - 6} ${z0 + dimD} H${right + 6}"/>`
    + `<text x="${right + 10}" y="${z0 + dimD / 2}" transform="rotate(90 ${right + 10} ${z0 + dimD / 2})" text-anchor="middle">${dimD} cm</text></g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" role="img" aria-label="Floor plan, ${dimW} by ${dimD} centimeters">${body}</svg>`;
}

export { WIDTH, DEPTH };
