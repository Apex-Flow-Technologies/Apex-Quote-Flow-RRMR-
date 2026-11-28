/**
 * "Steel by size" quote lines, like an online steel weight calculator: staff pick the type
 * (plate, pipe, bar, angle, channel, beam…) and fill one box per dimension. The app works
 * out kg per metre, builds a one-off steel product for the line, and it is sold by weight:
 * kg = length (m) × kg/m × Nos. Nothing needs to be pre-loaded in Products.
 *
 * Formulas: mild steel 7.85 g/cm³ (0.00785 kg per metre per mm²). Tube and bar formulas match
 * RR's reference calculator, maiak-m.bg (see engine/steel.ts). Angles use RR's weight card when the size is on it,
 * otherwise t × (A + B − t) × 0.00785. Channels and beams are picked from RR's weight card.
 */
import type { Product } from '../../types/product';
import { calculateSteelKgPerMetreRaw, STEEL_DENSITY_KG_PER_M_PER_MM2 } from '../../engine/steel';
import { ANGLES, BEAMS, CHANNELS, CHEQUERED_PLATES } from '../../data/steelCatalogue';
import { Decimal } from 'decimal.js';

export type SteelSizeKind =
  | 'PLATE'
  | 'CHEQUERED_PLATE'
  | 'ROUND_PIPE'
  | 'SQUARE_PIPE'
  | 'RECT_PIPE'
  | 'ROUND_BAR'
  | 'SQUARE_BAR'
  | 'FLAT'
  | 'EQUAL_ANGLE'
  | 'UNEQUAL_ANGLE'
  | 'CHANNEL'
  | 'BEAM';

export interface SteelSizeField {
  key: string;
  label: string; // full label, e.g. "Thickness"
  short: string; // box caption on desktop, e.g. "t"
  /** Pick from a list instead of typing (channels, beams). */
  options?: string[];
}

export interface SteelSizeKindConfig {
  label: string;
  fields: SteelSizeField[];
  defaultLengthM: number;
  category: string;
  /** kg/m (unrounded) and the item name, or what is wrong. */
  compute: (v: Record<string, number | string>) => { kgPerMetre: Decimal; name: string; hsn: string } | { error: string };
}

const G = STEEL_DENSITY_KG_PER_M_PER_MM2;
const f = (n: number | string) => String(n);
const n = (v: number | string) => Number(v);

// Exact kg/m (not rounded), so length × kg/m matches the reference calculator to the paisa
const engine = (shape: Parameters<typeof calculateSteelKgPerMetreRaw>[0], dims: Parameters<typeof calculateSteelKgPerMetreRaw>[1]) =>
  calculateSteelKgPerMetreRaw(shape, dims);

const T: SteelSizeField = { key: 't', label: 'Thickness', short: 't' };

export const STEEL_SIZE_KINDS: Record<SteelSizeKind, SteelSizeKindConfig> = {
  PLATE: {
    label: 'Plate',
    fields: [T, { key: 'w', label: 'Width', short: 'W' }],
    defaultLengthM: 2.5,
    category: 'Plate',
    compute: ({ t, w }) => {
      return { kgPerMetre: new Decimal(n(w)).times(n(t)).times(G), name: `MS Plate ${f(t)} mm (${f(w)} wide)`, hsn: '72085190' };
    },
  },
  CHEQUERED_PLATE: {
    label: 'Chequered plate',
    fields: [T, { key: 'w', label: 'Width', short: 'W' }],
    defaultLengthM: 2.5,
    category: 'Plate',
    compute: ({ t, w }) => {
      const card = CHEQUERED_PLATES[f(t)];
      const kg = card ? new Decimal(n(w)).dividedBy(1000).times(card) : new Decimal(n(w)).times(n(t)).times(G);
      return { kgPerMetre: kg, name: `Chequered Plate ${f(t)} mm (${f(w)} wide)`, hsn: '72084000' };
    },
  },
  ROUND_PIPE: {
    label: 'Round tube',
    fields: [{ key: 'd', label: 'Outside dia (OD)', short: 'OD' }, T],
    defaultLengthM: 6,
    category: 'Tube',
    compute: ({ d, t }) => {
      if (n(t) * 2 >= n(d)) return { error: 'The thickness is too large for this OD.' };
      return { kgPerMetre: engine('ROUND_PIPE', { odMm: n(d), thicknessMm: n(t) })!, name: `MS Round Tube ${f(d)} OD × ${f(t)} mm`, hsn: '73063090' };
    },
  },
  SQUARE_PIPE: {
    label: 'Square tube',
    fields: [{ key: 'a', label: 'Side', short: 'A' }, T],
    defaultLengthM: 6,
    category: 'Tube',
    compute: ({ a, t }) => {
      const kg = engine('SQUARE_PIPE', { sideMm: n(a), thicknessMm: n(t) });
      if (!kg) return { error: 'The thickness is too large for this size.' };
      return { kgPerMetre: kg, name: `MS Square Tube ${f(a)} × ${f(a)} × ${f(t)} mm`, hsn: '73066100' };
    },
  },
  RECT_PIPE: {
    label: 'Rectangular tube',
    fields: [{ key: 'a', label: 'Width', short: 'A' }, { key: 'b', label: 'Height', short: 'B' }, T],
    defaultLengthM: 6,
    category: 'Tube',
    compute: ({ a, b, t }) => {
      const kg = engine('RECT_PIPE', { widthMm: n(a), heightMm: n(b), thicknessMm: n(t) });
      if (!kg) return { error: 'The thickness is too large for this size.' };
      return { kgPerMetre: kg, name: `MS Rectangular Tube ${f(a)} × ${f(b)} × ${f(t)} mm`, hsn: '73066100' };
    },
  },
  ROUND_BAR: {
    label: 'Round bar',
    fields: [{ key: 'd', label: 'Diameter', short: 'Ø' }],
    defaultLengthM: 6,
    category: 'Bar',
    compute: ({ d }) => ({ kgPerMetre: engine('ROUND_BAR', { diameterMm: n(d) })!, name: `MS Round Bar ${f(d)} mm`, hsn: '72149990' }),
  },
  SQUARE_BAR: {
    label: 'Square bar',
    fields: [{ key: 'a', label: 'Side', short: 'A' }],
    defaultLengthM: 6,
    category: 'Bar',
    compute: ({ a }) => ({ kgPerMetre: engine('SQUARE_BAR', { sideMm: n(a) })!, name: `MS Square Bar ${f(a)} mm`, hsn: '72149990' }),
  },
  FLAT: {
    label: 'Flat',
    fields: [{ key: 'w', label: 'Width', short: 'W' }, T],
    defaultLengthM: 6,
    category: 'Bar',
    compute: ({ w, t }) => ({ kgPerMetre: new Decimal(n(w)).times(n(t)).times(G), name: `MS Flat ${f(w)} × ${f(t)} mm`, hsn: '72149990' }),
  },
  EQUAL_ANGLE: {
    label: 'Equal angle',
    fields: [{ key: 'a', label: 'Side', short: 'A' }, T],
    defaultLengthM: 6,
    category: 'Structural',
    compute: ({ a, t }) => {
      if (n(t) >= n(a)) return { error: 'The thickness must be less than the side.' };
      const card = ANGLES[`${f(a)}x${f(a)}x${f(t)}`];
      const kg = card ? new Decimal(card) : new Decimal(n(t)).times(new Decimal(n(a)).times(2).minus(n(t))).times(G);
      return { kgPerMetre: kg, name: `MS Angle ${f(a)} × ${f(a)} × ${f(t)} mm`, hsn: n(a) < 80 ? '72162100' : '72164000' };
    },
  },
  UNEQUAL_ANGLE: {
    label: 'Unequal angle',
    fields: [{ key: 'a', label: 'Side A', short: 'A' }, { key: 'b', label: 'Side B', short: 'B' }, T],
    defaultLengthM: 6,
    category: 'Structural',
    compute: ({ a, b, t }) => {
      if (n(t) >= Math.min(n(a), n(b))) return { error: 'The thickness must be less than both sides.' };
      const kg = new Decimal(n(t)).times(new Decimal(n(a)).plus(n(b)).minus(n(t))).times(G);
      return { kgPerMetre: kg, name: `MS Angle ${f(a)} × ${f(b)} × ${f(t)} mm`, hsn: Math.max(n(a), n(b)) < 80 ? '72162100' : '72164000' };
    },
  },
  CHANNEL: {
    label: 'Channel (ISMC)',
    fields: [{ key: 'size', label: 'Size (depth × flange)', short: 'Size', options: Object.keys(CHANNELS) }],
    defaultLengthM: 6,
    category: 'Structural',
    compute: ({ size }) => {
      const kg = CHANNELS[f(size)];
      if (!kg) return { error: 'Pick a channel size.' };
      return { kgPerMetre: new Decimal(kg), name: `MS Channel ISMC ${f(size).replace('x', ' × ')}`, hsn: '72163100' };
    },
  },
  BEAM: {
    label: 'Beam (ISMB)',
    fields: [{ key: 'size', label: 'Size (depth × flange)', short: 'Size', options: Object.keys(BEAMS) }],
    defaultLengthM: 6,
    category: 'Structural',
    compute: ({ size }) => {
      const kg = BEAMS[f(size)];
      if (!kg) return { error: 'Pick a beam size.' };
      return { kgPerMetre: new Decimal(kg), name: `MS Beam ISMB ${f(size).replace('x', ' × ')}`, hsn: '72163200' };
    },
  },
};

export const STEEL_SIZE_KIND_ORDER: SteelSizeKind[] = [
  'SQUARE_PIPE', 'RECT_PIPE', 'ROUND_PIPE', 'PLATE', 'CHEQUERED_PLATE', 'FLAT',
  'ROUND_BAR', 'SQUARE_BAR', 'EQUAL_ANGLE', 'UNEQUAL_ANGLE', 'CHANNEL', 'BEAM',
];

export interface SteelSizeInput {
  shape: SteelSizeKind;
  /** One value per box, as typed (key → text). */
  dims: Record<string, string>;
}

export type SteelSizeResult =
  | { ok: true; name: string; kgPerMetre: number; hsn: string }
  | { ok: false; error: string; missing?: boolean };

export function parseSteelSize(input: SteelSizeInput): SteelSizeResult {
  const cfg = STEEL_SIZE_KINDS[input.shape];
  if (!cfg) return { ok: false, error: 'Pick the steel type.' };
  const values: Record<string, number | string> = {};
  const empty = cfg.fields.filter((fd) => !(input.dims?.[fd.key] ?? '').trim());
  if (empty.length) {
    return { ok: false, missing: true, error: `Enter ${empty.map((fd) => fd.label.toLowerCase()).join(', ')}.` };
  }
  for (const fd of cfg.fields) {
    const raw = input.dims[fd.key].trim();
    if (fd.options) {
      values[fd.key] = raw;
      continue;
    }
    const v = Number(raw);
    if (!isFinite(v) || v <= 0) return { ok: false, error: `${fd.label} must be a number greater than 0.` };
    values[fd.key] = v;
  }
  const res = cfg.compute(values);
  if ('error' in res) return { ok: false, error: res.error };
  if (!res.kgPerMetre || !res.kgPerMetre.isFinite() || res.kgPerMetre.lte(0)) return { ok: false, error: 'Check the sizes.' };
  return { ok: true, name: res.name, hsn: res.hsn, kgPerMetre: res.kgPerMetre.toDecimalPlaces(6, Decimal.ROUND_HALF_UP).toNumber() };
}

/** Old lines saved with one size box ("40x40x1.3", square pipe only) → separate boxes. */
export function legacySteelSizeDims(shape: string, text: string): Record<string, string> {
  const nums = text.split(/\s*[x×*]\s*|\s+/i).filter(Boolean);
  if (shape === 'SQUARE_PIPE') {
    if (nums.length === 2) return { a: nums[0], t: nums[1] };
    if (nums.length === 3) return { a: nums[0], t: nums[2] };
  }
  return {};
}

/** A one-off steel product for the typed size (not saved to Products). */
export function steelSizeProduct(input: SteelSizeInput, rowId: string, gstRate = 18): Product | null {
  const res = parseSteelSize(input);
  const cfg = STEEL_SIZE_KINDS[input.shape];
  if (!res.ok || !cfg) return null;
  return {
    id: `steelsize_${rowId}`,
    name: res.name,
    category: cfg.category,
    hsn: res.hsn,
    qtyMethod: 'SECTION_WEIGHT',
    unit: 'Kgs',
    ratePerUnit: 0,
    gstRate,
    active: true,
    stockMethod: 'WEIGHT',
    kgPerMetre: res.kgPerMetre,
    defaultLengthM: cfg.defaultLengthM,
  } as unknown as Product;
}
