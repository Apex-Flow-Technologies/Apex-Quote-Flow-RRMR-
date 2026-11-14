/**
 * RR Metal Roofing — structural steel catalogue.
 *
 * Sources:
 *  - Round / square / rectangular pipe sizes: Madhav Pipes brochure (IS 1161 / IS 4923 tables).
 *    Weights are recalculated with the IS formula (the brochure has typos, e.g. 72×72×4.0,
 *    and lists 42.4 OD as "44.4").
 *  - Plates, chequered plates, flats, round / square bars, angles, channels, beams:
 *    RR's own weight card. Angles / channels / beams use the card's kg/m; the rest use the
 *    IS formula (they agree with the card to its 1-decimal rounding).
 *  - Excluded on RR's instruction: MS rails, tee sections, window sections.
 *
 * Every item is sold in Kgs (SECTION_WEIGHT: length m × kg/m × Nos).
 * Rate is left at 0 — steel prices move daily, so staff type the rate on each quote.
 */
import {
  type SteelShape,
  type SteelDims,
  calculateSteelKgPerMetre,
  defaultLengthForShape,
} from '../engine/steel';

export interface SteelCatalogueItem {
  id: string;
  name: string;
  category: 'Pipe' | 'Structural' | 'Plate' | 'Bar';
  hsn: string;
  qtyMethod: 'SECTION_WEIGHT';
  unit: 'Kgs';
  ratePerUnit: number;
  gstRate: number;
  active: boolean;
  isPlaceholder: false;
  stockMethod: 'WEIGHT';
  kgPerMetre: number;
  steelShape: SteelShape;
  steelDims: SteelDims;
  thicknessMm?: number;
  defaultLengthM: number;
}

export const PLATE_WIDTH_MM = 1500;
export const CHEQUERED_PLATE_WIDTH_MM = 1250;

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/\./g, '_').replace(/^-|-$/g, '');

function formulaItem(
  name: string,
  category: SteelCatalogueItem['category'],
  hsn: string,
  shape: SteelShape,
  dims: SteelDims,
  defaultLengthM = defaultLengthForShape(shape)
): SteelCatalogueItem {
  const kg = calculateSteelKgPerMetre(shape, dims);
  if (kg === null) throw new Error(`Invalid steel dims for ${name}`);
  return {
    id: `steel_${slug(name)}`,
    name,
    category,
    hsn,
    qtyMethod: 'SECTION_WEIGHT',
    unit: 'Kgs',
    ratePerUnit: 0,
    gstRate: 18,
    active: true,
    isPlaceholder: false,
    stockMethod: 'WEIGHT',
    kgPerMetre: kg,
    steelShape: shape,
    steelDims: dims,
    thicknessMm: dims.thicknessMm,
    defaultLengthM,
  };
}

function chartItem(
  name: string,
  category: SteelCatalogueItem['category'],
  hsn: string,
  kgPerMetre: number
): SteelCatalogueItem {
  return {
    id: `steel_${slug(name)}`,
    name,
    category,
    hsn,
    qtyMethod: 'SECTION_WEIGHT',
    unit: 'Kgs',
    ratePerUnit: 0,
    gstRate: 18,
    active: true,
    isPlaceholder: false,
    stockMethod: 'WEIGHT',
    kgPerMetre,
    steelShape: 'CHART',
    steelDims: {},
    defaultLengthM: 6,
  };
}

// ── Round pipes (CHS) — OD: thicknesses ───────────────────────────────────────
const ROUND_PIPES: Record<string, number[]> = {
  '21.3': [1.8, 2.0, 2.6, 3.2],
  '26.9': [1.8, 2.0, 2.3, 2.6, 3.2],
  '33.7': [2.0, 2.3, 2.6, 3.2, 4.0],
  '42.4': [2.3, 2.6, 3.2, 3.6, 4.0], // brochure prints 4.0/4.5 but its weights are for 3.6/4.0
  '48.3': [2.3, 2.6, 2.9, 3.2, 3.6, 4.0],
  '60.3': [2.3, 2.6, 2.9, 3.2, 3.6, 4.0, 4.5],
  '76.1': [2.9, 3.2, 3.6, 4.0, 4.5, 5.0], // brochure thickness column is shifted one row
  '88.9': [2.9, 3.2, 4.0, 5.0, 5.4, 5.6],
  '101.6': [3.6, 4.0, 5.0],
  '114.3': [3.2, 3.6, 4.5, 5.4, 6.3],
  '139.7': [3.6, 4.0, 4.5, 5.0, 5.4, 6.3],
  '152.4': [4.5, 5.0, 5.4],
  '165.1': [4.5, 5.0, 5.4, 6.3],
  '168.3': [4.0, 4.5, 5.0, 5.4, 6.3, 7.1, 8.0],
  '193.7': [5.0, 5.4, 5.9, 6.3, 8.0],
  '219.1': [4.5, 5.0, 5.6, 6.3, 8.0],
};

// ── Square pipes (SHS, IS 4923) — side: thicknesses ───────────────────────────
const SQUARE_PIPES: Record<string, number[]> = {
  '25': [1.6, 2.0, 2.6, 3.2],
  '32': [2.0, 2.6, 3.2],
  '38': [2.0, 2.6, 3.2, 4.0],
  '40': [2.6, 2.9, 3.2, 4.0],
  '50': [2.6, 2.9, 3.2, 3.6, 4.5],
  '60': [2.6, 2.9, 3.2, 4.0, 4.8],
  '72': [3.2, 4.0, 4.8],
  '80': [3.2, 4.0, 4.8],
  '91.5': [3.6, 4.5, 5.4],
  '113.5': [4.8, 5.4],
  '132': [4.8, 5.4],
  '150': [4.0, 5.0, 6.0, 7.0, 8.0],
  '180': [4.0, 5.0, 6.0, 7.0, 8.0],
};

// ── Rectangular pipes (RHS, IS 4923) — "W×H": thicknesses ─────────────────────
const RECT_PIPES: Record<string, number[]> = {
  '50x25': [2.0, 2.6, 3.2, 4.0],
  '60x40': [2.6, 2.9, 3.6, 4.5],
  '66x33': [2.6, 2.9, 3.6, 4.5],
  '80x40': [2.6, 2.9, 3.2, 4.0, 4.8],
  '96x48': [3.2, 4.0, 4.8],
  '100x50': [3.2, 4.0],
  '120x60': [3.2, 3.6, 4.5],
  '122x61': [3.6, 4.5, 5.4],
  '145x82': [4.8, 5.4],
  '172x92': [4.8, 5.4],
  '200x100': [4.0, 5.0, 6.0, 7.0, 8.0],
};

// ── Plates (weight card) — thickness mm ───────────────────────────────────────
const PLATES = [5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 32, 36, 40, 45, 50, 56, 63];

// ── Chequered plates (weight card, kg/m²) ─────────────────────────────────────
const CHEQUERED_PLATES: Record<string, number> = { '5': 43.5, '6': 52.3, '7': 61.3, '10': 83.4, '12': 100.6 };

// ── Flats (weight card) — "W×T" ───────────────────────────────────────────────
const FLATS = [
  '12x3', '12x5', '20x3', '20x5', '20x6', '25x3', '25x6', '25x10', '25x12',
  '32x3', '32x6', '32x10', '40x3', '40x6', '40x10', '40x12',
  '50x3', '50x6', '50x8', '50x10', '50x12', '50x16', '53x16',
  '65x6', '65x8', '65x10', '65x12',
  '75x6', '75x8', '75x10', '75x12', '75x16', '75x20', '75x25',
  '100x6', '100x8', '100x10', '100x12', '100x16', '100x20', '100x25',
];

// ── Round & square bars (weight card) — size mm ───────────────────────────────
const BARS = [6, 8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 32, 36, 40, 45, 50, 56, 63, 80, 90, 100, 110, 125, 140, 160, 180, 200];

// ── Equal angles (weight card kg/m) ───────────────────────────────────────────
const ANGLES: Record<string, number> = {
  '19x19x3': 0.9, '25x25x3': 1.1, '25x25x6': 2.2, '32x32x3': 1.6, '35x35x5': 2.6, '35x35x6': 3.0,
  '40x40x3': 1.8, '40x40x5': 3.0, '40x40x6': 3.5, '45x45x5': 3.4, '45x45x6': 4.0, '50x50x6': 4.5,
  '65x65x6': 5.8, '65x65x8': 7.7, '65x65x10': 9.4, '75x75x6': 6.8, '75x75x8': 8.9, '75x75x10': 11.0,
  '80x80x6': 7.3, '90x90x6': 8.2, '90x90x8': 10.8, '90x90x10': 13.4, '90x90x12': 15.8,
  '100x100x6': 9.2, '100x100x8': 12.1, '100x100x10': 14.9, '100x100x12': 17.7,
  '110x110x8': 13.4, '110x110x10': 16.5, '110x110x12': 19.6,
  '130x130x10': 19.7, '130x130x12': 23.4, '130x130x15': 28.9,
  '150x150x10': 22.8, '150x150x12': 27.2, '150x150x16': 35.7, '150x150x20': 44.1,
};

// ── Channels ISMC (weight card kg/m) ──────────────────────────────────────────
const CHANNELS: Record<string, number> = {
  '75x40': 7.1, '100x50': 9.6, '125x65': 13.7, '150x75': 16.8, '175x75': 19.6, '200x75': 22.3,
  '225x80': 26.1, '250x80': 30.5, '300x90': 36.3, '350x100': 42.7, '400x100': 50.1,
};

// ── Beams ISMB / RS joist (weight card kg/m) ──────────────────────────────────
const BEAMS: Record<string, number> = {
  '100x50': 8.34, '110x100': 23.0, '125x70': 13.2, '150x75': 15.0, '175x85': 19.5, '200x100': 25.9,
  '225x100': 31.3, '250x125': 38.1, '300x140': 45.0, '350x140': 52.9, '400x140': 62.6,
  '450x150': 73.1, '500x180': 87.7, '600x210': 122.6,
};

const x = (s: string) => s.split('x').map(Number);
const fmt = (n: number) => String(n);

export function buildSteelCatalogue(): SteelCatalogueItem[] {
  const items: SteelCatalogueItem[] = [];

  for (const [od, ts] of Object.entries(ROUND_PIPES)) {
    for (const t of ts) {
      items.push(formulaItem(`MS Round Pipe ${od} OD × ${fmt(t)} mm`, 'Pipe', '73063090', 'ROUND_PIPE', { odMm: Number(od), thicknessMm: t }));
    }
  }
  for (const [side, ts] of Object.entries(SQUARE_PIPES)) {
    for (const t of ts) {
      items.push(formulaItem(`MS Square Pipe ${side} × ${side} × ${fmt(t)} mm`, 'Pipe', '73066100', 'SQUARE_PIPE', { sideMm: Number(side), thicknessMm: t }));
    }
  }
  for (const [size, ts] of Object.entries(RECT_PIPES)) {
    const [w, h] = x(size);
    for (const t of ts) {
      items.push(formulaItem(`MS Rectangular Pipe ${w} × ${h} × ${fmt(t)} mm`, 'Pipe', '73066100', 'RECT_PIPE', { widthMm: w, heightMm: h, thicknessMm: t }));
    }
  }
  for (const t of PLATES) {
    items.push(formulaItem(`MS Plate ${t} mm (${PLATE_WIDTH_MM} wide)`, 'Plate', '72085190', 'PLATE', { widthMm: PLATE_WIDTH_MM, thicknessMm: t }));
  }
  for (const [t, kgSqm] of Object.entries(CHEQUERED_PLATES)) {
    items.push(formulaItem(`Chequered Plate ${t} mm (${CHEQUERED_PLATE_WIDTH_MM} wide)`, 'Plate', '72084000', 'CHEQUERED_PLATE', {
      widthMm: CHEQUERED_PLATE_WIDTH_MM,
      thicknessMm: Number(t),
      kgPerSqm: kgSqm,
    }));
  }
  for (const size of FLATS) {
    const [w, t] = x(size);
    items.push(formulaItem(`MS Flat ${w} × ${t} mm`, 'Bar', '72149990', 'FLAT', { widthMm: w, thicknessMm: t }));
  }
  for (const d of BARS) {
    items.push(formulaItem(`MS Round Bar ${d} mm`, 'Bar', '72149990', 'ROUND_BAR', { diameterMm: d }));
  }
  for (const a of BARS) {
    items.push(formulaItem(`MS Square Bar ${a} mm`, 'Bar', '72149990', 'SQUARE_BAR', { sideMm: a }));
  }
  for (const [size, kg] of Object.entries(ANGLES)) {
    const [a, , t] = x(size);
    items.push(chartItem(`MS Angle ${a} × ${a} × ${t} mm`, 'Structural', a < 80 ? '72162100' : '72164000', kg));
  }
  for (const [size, kg] of Object.entries(CHANNELS)) {
    const [h, b] = x(size);
    items.push(chartItem(`MS Channel ISMC ${h} × ${b}`, 'Structural', '72163100', kg));
  }
  for (const [size, kg] of Object.entries(BEAMS)) {
    const [h, b] = x(size);
    items.push(chartItem(`MS Beam ISMB ${h} × ${b}`, 'Structural', '72163200', kg));
  }

  return items;
}
