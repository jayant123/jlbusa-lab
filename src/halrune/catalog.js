// The three HALRUNE products: which 3D model shows each one, its finishes, specs and copy, and a demo response
// curve for the chart. Prices and stock always come from Shopify.
export const ORDER = ['halrune-one', 'halrune-monitor', 'halrune-buds'];

export const FINISH_COLOR = {
  Walnut: '#5a3420', Ash: '#c9b18f', Graphite: '#2c2d30', Oak: '#a57a4c', Black: '#151517', Stone: '#b9b2a6', Ink: '#1b2030',
};

export const PRODUCTS = {
  'halrune-one': {
    name: 'HALRUNE One', kind: 'Open-back headphones', model: 'one', option: 'Finish', values: ['Walnut', 'Ash', 'Graphite'],
    story: 'Open-back headphones for listening at home. The 50 mm drivers sit in cups of solid wood. Sound moves freely through the steel grille. The velour pads come off by hand.',
    specs: [['Driver', '50 mm dynamic'], ['Impedance', '32 ohms'], ['Weight', '380 g'], ['Cable', '1.8 m with a 3.5 mm plug'], ['Cups', 'Solid wood']],
  },
  'halrune-monitor': {
    name: 'HALRUNE Monitor', kind: 'Powered bookshelf speakers', model: 'monitor', option: 'Finish', values: ['Walnut', 'Oak', 'Black'],
    story: 'Powered speakers for a desk or a shelf. Each one has a 5 inch woofer and a silk dome tweeter. The cabinets are veneered by hand. They connect by cable or by Bluetooth.',
    specs: [['Woofer', '5 in paper cone'], ['Tweeter', '1 in silk dome'], ['Power', '2 × 60 W'], ['Inputs', 'Optical, analog and Bluetooth'], ['Size', '18 × 24 × 30 cm each'], ['Sold as', 'A pair']],
  },
  'halrune-buds': {
    name: 'HALRUNE Buds', kind: 'Wireless earbuds', model: 'buds', option: 'Color', values: ['Stone', 'Ink'],
    story: 'Wireless earbuds for every day. The case is glazed ceramic. It charges the buds three times over. Each bud weighs 5 grams.',
    specs: [['Battery', '7 hours, 28 with the case'], ['Driver', '10 mm'], ['Case', 'Glazed ceramic'], ['Water', 'Fine in light rain (IPX4)']],
  },
};

export const optionOf = (handle) => PRODUCTS[handle]?.option;
export const productOf = (handle) => PRODUCTS[handle] || PRODUCTS[ORDER[0]];

// Demo frequency response for the chart. Illustrative data for a fictional brand, not a measurement.
const SHAPE = {
  'halrune-one': (f) => -6 * Math.exp(-((Math.log10(f) - 1.3) ** 2) / 0.04) + 1.6 * Math.exp(-((Math.log10(f) - 3.5) ** 2) / 0.02) - 7 * Math.max(0, Math.log10(f) - 4.1),
  'halrune-monitor': (f) => -10 * Math.max(0, 1.75 - Math.log10(f)) + 1.2 * Math.exp(-((Math.log10(f) - 2) ** 2) / 0.02) - 1.5 * Math.exp(-((Math.log10(f) - 3.4) ** 2) / 0.01) - 5 * Math.max(0, Math.log10(f) - 4.2),
  'halrune-buds': (f) => 3 * Math.exp(-((Math.log10(f) - 1.8) ** 2) / 0.12) + 2 * Math.exp(-((Math.log10(f) - 3.45) ** 2) / 0.015) - 6 * Math.max(0, Math.log10(f) - 4),
};
export function responseCurve(handle, points = 40) {
  const fn = SHAPE[handle] || SHAPE[ORDER[0]];
  return Array.from({ length: points }, (_, i) => {
    const hz = i === points - 1 ? 20000 : i === 0 ? 20 : Math.round(20 * 1000 ** (i / (points - 1)));
    return { hz, db: Math.max(-11.5, Math.min(5.5, fn(hz))) };
  });
}
