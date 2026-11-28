/**
 * Quote lines by type, like an online weight calculator: staff pick the type (roofing sheet,
 * flashing, screws, tube, plate, bar, angle, channel, beam…) and fill one box per detail.
 * The app builds a one-off product for the line from those boxes, so nothing needs to be
 * pre-loaded in Products. Rates are always typed on the line.
 *
 * Steel is sold by weight: kg = length (m) × kg/m × Nos. Formulas: mild steel 7.85 g/cm³
 * (0.00785 kg per metre per mm²); tube and bar formulas match RR's reference calculator,
 * maiak-m.bg (see engine/steel.ts). Angles use RR's weight card when the size is on it,
 * otherwise t × (A + B − t) × 0.00785. Channels and beams are picked from RR's weight card.
 * Sheets use the existing Sq.Mtr (length × width factor) and by-weight
 * (coil width × length × thickness × 7.968) methods.
 *
 * Saved quotes keep the type in snapshot.steelShape and the boxes in snapshot.steelSizeDims
 * (names kept from the first, steel-only version so older quotes still open).
 */
import type { Product, QuantityMethod, ProductUnit } from '../../types/product';
import { calculateSteelKgPerMetreRaw, STEEL_DENSITY_KG_PER_M_PER_MM2 } from '../../engine/steel';
import { DEFAULT_DENSITY_FACTOR } from '../../engine/constants';
import { ANGLES, BEAMS, CHANNELS } from '../../data/steelCatalogue';

/** MS chequered plate, kg per m² by thickness (mm), from RR's chart. */
export const CHEQUERED_PLATE_CHART: Record<string, number> = {
  '3': 26.55, '4': 34.4, '5': 42.25, '6': 50.1, '8': 65.8, '10': 83.4, '12': 100.6,
};
/** Thickness not on the chart: plain plate + the chart's 3 kg/m² for the raised pattern. */
export function chequeredKgPerSqm(t: number): Decimal {
  const card = CHEQUERED_PLATE_CHART[String(t)];
  return card ? new Decimal(card) : new Decimal(t).times('7.85').plus(3);
}
import { Decimal } from 'decimal.js';

export type SheetItemKind = 'SHEET_SQM' | 'SHEET_WEIGHT' | 'POLYCARBONATE' | 'FLASHING' | 'FIXING';
export type SteelItemKind =
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
export type SteelSizeKind = SheetItemKind | SteelItemKind;

export type ItemGroup = 'Sheets' | 'Accessories' | 'Steel';

export interface SteelSizeField {
  key: string;
  label: string; // full label, e.g. "Thickness"
  short: string; // box caption on desktop, e.g. "t"
  /** number: a measurement box · combo: pick from suggestions or type anything · select: list only */
  kind?: 'number' | 'combo' | 'select';
  options?: string[];
  unit?: string; // shown after the label, e.g. "mm"; '' for none
  optional?: boolean;
  /** combo whose value must be a number (sheet thickness / coil width on by-weight sheets) */
  numeric?: boolean;
  default?: string;
}

export interface ItemBuild {
  name: string;
  hsn: string;
  kgPerMetre?: Decimal;
  thicknessMm?: number;
  coilWidthM?: number;
}

export interface SteelSizeKindConfig {
  label: string;
  group: ItemGroup;
  method: Extract<QuantityMethod, 'SECTION_WEIGHT' | 'SQM' | 'SHEET_WEIGHT' | 'PIECE'>;
  unit: ProductUnit;
  fields: SteelSizeField[];
  defaultLengthM: number;
  category: string;
  /** The item name, HSN and (steel) kg/m, or what is wrong. */
  compute: (v: Record<string, number | string>) => ItemBuild | { error: string };
}

// ── Suggestions (staff can always type something else) ─────────────────────────
export const SHEET_BRANDS = ['JSW Colouron+', 'JSW Pragathi+', 'JSW Radiance', 'Tata Durashine', 'Tata Galvalume', 'Amns', 'GI'];
export const SHEET_PROFILES = ['Crimp 8+1', 'Crimp 10+1', 'Plain', 'Trapezoidal', 'Tile profile', 'Corrugated'];
export const SHEET_THICKNESSES = ['0.30', '0.35', '0.40', '0.45', '0.47', '0.50', '0.55', '0.60'];
export const SHEET_COATINGS = ['120 GSM', '150 GSM', 'AZ 70', 'AZ 150', '550 MPA'];
export const SHEET_COLOURS = ['Red', 'Blue', 'Green', 'Grey', 'White', 'Off-white', 'Brick red', 'Terracotta', 'Silver', 'Bare'];
export const POLY_THICKNESSES = ['1.5', '2', '3', '4', '6', '8', '10'];
export const POLY_COLOURS = ['Clear', 'Bronze', 'Opal', 'Blue', 'Green', 'Grey'];
export const FLASHING_ITEMS = ['Ridge', 'Ridge flashing', 'L flashing', 'Valley gutter', 'Gutter', 'Apron flashing', 'End cap'];
export const FLASHING_SIZES = ['6x6', '8x8', '12x12', '18x18', '24 inch'];
export const FLASHING_LENGTHS = ['8 ft', '10 ft', '12 ft'];
export const FIXING_ITEMS = ['Self drilling screw', 'EPDM washer', 'J bolt', 'Bolt & nut', 'Rivet', 'Silicone sealant'];
export const FIXING_SIZES = ['25 mm', '55 mm', '80 mm', '100 mm'];

const G = STEEL_DENSITY_KG_PER_M_PER_MM2;
const f = (v: number | string) => String(v).trim();
const n = (v: number | string) => Number(v);
const join = (...parts: (string | number | undefined)[]) =>
  parts.map((p) => (p === undefined ? '' : String(p).trim())).filter(Boolean).join(' ');

// Exact kg/m (not rounded), so length × kg/m matches the reference calculator to the paisa
const engine = (shape: Parameters<typeof calculateSteelKgPerMetreRaw>[0], dims: Parameters<typeof calculateSteelKgPerMetreRaw>[1]) =>
  calculateSteelKgPerMetreRaw(shape, dims);

const T: SteelSizeField = { key: 't', label: 'Thickness', short: 't' };
const combo = (key: string, label: string, options: string[], extra: Partial<SteelSizeField> = {}): SteelSizeField => ({
  key, label, short: label, kind: 'combo', options, unit: '', optional: true, ...extra,
});
const BRAND = combo('brand', 'Brand', SHEET_BRANDS);
const PROFILE = combo('profile', 'Profile', SHEET_PROFILES);
const COATING = combo('coating', 'Coating', SHEET_COATINGS);
const COLOUR = combo('colour', 'Colour', SHEET_COLOURS);
const SHEET_T = combo('t', 'Thickness', SHEET_THICKNESSES, { unit: 'mm' });
const mm = (t: number | string) => (f(t) ? `${f(t)} mm` : '');

const steel = (label: string, category: string, fields: SteelSizeField[], compute: SteelSizeKindConfig['compute'], defaultLengthM = 6): SteelSizeKindConfig => ({
  label, group: 'Steel', method: 'SECTION_WEIGHT', unit: 'Kgs', fields, defaultLengthM, category, compute,
});

export const STEEL_SIZE_KINDS: Record<SteelSizeKind, SteelSizeKindConfig> = {
  // ── Sheets ───────────────────────────────────────────────────────────────────
  SHEET_SQM: {
    label: 'Roofing sheet (Sq.Mtr)',
    group: 'Sheets',
    method: 'SQM',
    unit: 'Sq.Mtr',
    fields: [BRAND, PROFILE, SHEET_T, COATING, COLOUR],
    defaultLengthM: 0,
    category: 'Sheet',
    compute: ({ brand, profile, t, coating }) => ({ name: join(brand, profile, mm(t), coating) || 'Roofing sheet', hsn: '72109090' }),
  },
  SHEET_WEIGHT: {
    label: 'Roofing sheet (by weight)',
    group: 'Sheets',
    method: 'SHEET_WEIGHT',
    unit: 'Kgs',
    fields: [
      BRAND,
      PROFILE,
      { ...SHEET_T, optional: false, numeric: true },
      combo('coil', 'Coil width', ['1.06', '1.22'], { unit: 'm', optional: false, numeric: true, default: '1.06' }),
      COATING,
      COLOUR,
    ],
    defaultLengthM: 0,
    category: 'Sheet',
    compute: ({ brand, profile, t, coil, coating }) => {
      if (n(t) >= 5) return { error: 'Sheet thickness is in mm, e.g. 0.47.' };
      if (n(coil) >= 3) return { error: 'Coil width is in metres, e.g. 1.06.' };
      return { name: join(brand, profile, mm(t), coating) || 'Roofing sheet', hsn: '72109090', thicknessMm: n(t), coilWidthM: n(coil) };
    },
  },
  POLYCARBONATE: {
    label: 'Polycarbonate sheet',
    group: 'Sheets',
    method: 'SQM',
    unit: 'Sq.Mtr',
    fields: [combo('t', 'Thickness', POLY_THICKNESSES, { unit: 'mm' }), combo('colour', 'Colour', POLY_COLOURS)],
    defaultLengthM: 0,
    category: 'Sheet',
    compute: ({ t }) => ({ name: join('Polycarbonate sheet', mm(t)), hsn: '39206110' }),
  },
  // ── Accessories (priced per piece) ───────────────────────────────────────────
  FLASHING: {
    label: 'Ridge / flashing / gutter',
    group: 'Accessories',
    method: 'PIECE',
    unit: 'Nos',
    fields: [
      combo('item', 'Item', FLASHING_ITEMS, { optional: false }),
      combo('size', 'Size', FLASHING_SIZES),
      combo('length', 'Length', FLASHING_LENGTHS),
      BRAND,
      SHEET_T,
      COLOUR,
    ],
    defaultLengthM: 0,
    category: 'Flashing',
    compute: ({ item, size, length, brand, t }) => ({
      name: join(brand, item, f(size).replace(/x/gi, ' × '), mm(t)) + (f(length) ? ` – ${f(length)}` : ''),
      hsn: '72109090',
    }),
  },
  FIXING: {
    label: 'Screws & fixings',
    group: 'Accessories',
    method: 'PIECE',
    unit: 'Nos',
    fields: [combo('item', 'Item', FIXING_ITEMS, { optional: false }), combo('size', 'Size', FIXING_SIZES)],
    defaultLengthM: 0,
    category: 'Fixing',
    compute: ({ item, size }) => ({ name: join(item, size), hsn: '73181500' }),
  },
  // ── Steel (sold by weight) ───────────────────────────────────────────────────
  PLATE: steel('Plate', 'Plate', [T, { key: 'w', label: 'Width', short: 'W' }], ({ t, w }) => ({
    kgPerMetre: new Decimal(n(w)).times(n(t)).times(G), name: `MS Plate ${f(t)} mm (${f(w)} wide)`, hsn: '72085190',
  }), 2.5),
  CHEQUERED_PLATE: steel('Chequered plate', 'Plate', [T, { key: 'w', label: 'Width', short: 'W' }], ({ t, w }) => {
    // kg = kg/m² (chart) × width (m) × length (m)
    const kg = new Decimal(n(w)).dividedBy(1000).times(chequeredKgPerSqm(n(t)));
    return { kgPerMetre: kg, name: `MS Chequered Plate ${f(t)} mm (${f(w)} wide)`, hsn: '72084000' };
  }, 2.5),
  ROUND_PIPE: steel('Round tube', 'Tube', [{ key: 'd', label: 'Outside dia (OD)', short: 'OD' }, T], ({ d, t }) => {
    if (n(t) * 2 >= n(d)) return { error: 'The thickness is too large for this OD.' };
    return { kgPerMetre: engine('ROUND_PIPE', { odMm: n(d), thicknessMm: n(t) })!, name: `MS Round Tube ${f(d)} OD × ${f(t)} mm`, hsn: '73063090' };
  }),
  SQUARE_PIPE: steel('Square tube', 'Tube', [{ key: 'a', label: 'Side', short: 'A' }, T], ({ a, t }) => {
    const kg = engine('SQUARE_PIPE', { sideMm: n(a), thicknessMm: n(t) });
    if (!kg) return { error: 'The thickness is too large for this size.' };
    return { kgPerMetre: kg, name: `MS Square Tube ${f(a)} × ${f(a)} × ${f(t)} mm`, hsn: '73066100' };
  }),
  RECT_PIPE: steel('Rectangular tube', 'Tube', [{ key: 'a', label: 'Width', short: 'A' }, { key: 'b', label: 'Height', short: 'B' }, T], ({ a, b, t }) => {
    const kg = engine('RECT_PIPE', { widthMm: n(a), heightMm: n(b), thicknessMm: n(t) });
    if (!kg) return { error: 'The thickness is too large for this size.' };
    return { kgPerMetre: kg, name: `MS Rectangular Tube ${f(a)} × ${f(b)} × ${f(t)} mm`, hsn: '73066100' };
  }),
  ROUND_BAR: steel('Round bar', 'Bar', [{ key: 'd', label: 'Diameter', short: 'Ø' }], ({ d }) => ({
    kgPerMetre: engine('ROUND_BAR', { diameterMm: n(d) })!, name: `MS Round Bar ${f(d)} mm`, hsn: '72149990',
  })),
  SQUARE_BAR: steel('Square bar', 'Bar', [{ key: 'a', label: 'Side', short: 'A' }], ({ a }) => ({
    kgPerMetre: engine('SQUARE_BAR', { sideMm: n(a) })!, name: `MS Square Bar ${f(a)} mm`, hsn: '72149990',
  })),
  FLAT: steel('Flat', 'Bar', [{ key: 'w', label: 'Width', short: 'W' }, T], ({ w, t }) => ({
    kgPerMetre: new Decimal(n(w)).times(n(t)).times(G), name: `MS Flat ${f(w)} × ${f(t)} mm`, hsn: '72149990',
  })),
  EQUAL_ANGLE: steel('Angle', 'Structural', [{ key: 'a', label: 'Side', short: 'A' }, T], ({ a, t }) => {
    if (n(t) >= n(a)) return { error: 'The thickness must be less than the side.' };
    const card = ANGLES[`${f(a)}x${f(a)}x${f(t)}`];
    const kg = card ? new Decimal(card) : new Decimal(n(t)).times(new Decimal(n(a)).times(2).minus(n(t))).times(G);
    return { kgPerMetre: kg, name: `MS Angle ${f(a)} × ${f(a)} × ${f(t)} mm`, hsn: n(a) < 80 ? '72162100' : '72164000' };
  }),
  UNEQUAL_ANGLE: steel('Unequal angle', 'Structural', [{ key: 'a', label: 'Side A', short: 'A' }, { key: 'b', label: 'Side B', short: 'B' }, T], ({ a, b, t }) => {
    if (n(t) >= Math.min(n(a), n(b))) return { error: 'The thickness must be less than both sides.' };
    const kg = new Decimal(n(t)).times(new Decimal(n(a)).plus(n(b)).minus(n(t))).times(G);
    return { kgPerMetre: kg, name: `MS Angle ${f(a)} × ${f(b)} × ${f(t)} mm`, hsn: Math.max(n(a), n(b)) < 80 ? '72162100' : '72164000' };
  }),
  CHANNEL: steel('Channel (ISMC)', 'Structural', [{ key: 'size', label: 'Size (depth × flange)', short: 'Size', kind: 'select', unit: '', options: Object.keys(CHANNELS) }], ({ size }) => {
    const kg = CHANNELS[f(size)];
    if (!kg) return { error: 'Pick a channel size.' };
    return { kgPerMetre: new Decimal(kg), name: `MS Channel ISMC ${f(size).replace('x', ' × ')}`, hsn: '72163100' };
  }),
  BEAM: steel('Beam (ISMB)', 'Structural', [{ key: 'size', label: 'Size (depth × flange)', short: 'Size', kind: 'select', unit: '', options: Object.keys(BEAMS) }], ({ size }) => {
    const kg = BEAMS[f(size)];
    if (!kg) return { error: 'Pick a beam size.' };
    return { kgPerMetre: new Decimal(kg), name: `MS Beam ISMB ${f(size).replace('x', ' × ')}`, hsn: '72163200' };
  }),
};

export const ITEM_GROUPS: { group: ItemGroup; kinds: SteelSizeKind[] }[] = [
  { group: 'Sheets', kinds: ['SHEET_SQM', 'SHEET_WEIGHT', 'POLYCARBONATE'] },
  { group: 'Accessories', kinds: ['FLASHING', 'FIXING'] },
  {
    group: 'Steel',
    // Unequal angle is not offered (RR's choice); quotes that already have one still open
    kinds: ['SQUARE_PIPE', 'RECT_PIPE', 'ROUND_PIPE', 'PLATE', 'CHEQUERED_PLATE', 'FLAT', 'ROUND_BAR', 'SQUARE_BAR', 'EQUAL_ANGLE', 'CHANNEL', 'BEAM'],
  },
];
export const STEEL_SIZE_KIND_ORDER: SteelSizeKind[] = ITEM_GROUPS.flatMap((g) => g.kinds);

/** The unit shown after a field's label: steel measurement boxes are in mm unless set. */
export function fieldUnit(fd: SteelSizeField): string {
  if (fd.unit !== undefined) return fd.unit;
  return fd.kind === 'select' ? '' : 'mm';
}

export function kindHasColour(shape?: string): boolean {
  const cfg = shape ? STEEL_SIZE_KINDS[shape as SteelSizeKind] : undefined;
  return Boolean(cfg?.fields.some((fd) => fd.key === 'colour'));
}

/** Boxes filled in when a type is picked (e.g. coil width 1.06). */
export function defaultDims(shape: SteelSizeKind): Record<string, string> {
  const dims: Record<string, string> = {};
  for (const fd of STEEL_SIZE_KINDS[shape].fields) if (fd.default) dims[fd.key] = fd.default;
  return dims;
}

export interface SteelSizeInput {
  shape: SteelSizeKind;
  /** One value per box, as typed (key → text). */
  dims: Record<string, string>;
  /** HSN typed on the line (otherwise the type's default). */
  hsn?: string;
}

export type SteelSizeResult =
  | { ok: true; name: string; hsn: string; kgPerMetre?: number; thicknessMm?: number; coilWidthM?: number }
  | { ok: false; error: string; missing?: boolean };

export function parseSteelSize(input: SteelSizeInput): SteelSizeResult {
  const cfg = STEEL_SIZE_KINDS[input.shape];
  if (!cfg) return { ok: false, error: 'Pick the item type.' };
  const text = (k: string) => String(input.dims?.[k] ?? '').trim();
  const empty = cfg.fields.filter((fd) => !fd.optional && !text(fd.key));
  if (empty.length) {
    return { ok: false, missing: true, error: `Enter ${empty.map((fd) => fd.label.toLowerCase()).join(', ')}.` };
  }
  const values: Record<string, number | string> = {};
  for (const fd of cfg.fields) {
    const raw = text(fd.key);
    const isNumber = (fd.kind ?? 'number') === 'number' || fd.numeric;
    if (!isNumber || (fd.optional && !raw)) {
      values[fd.key] = raw;
      continue;
    }
    const v = Number(raw);
    if (!isFinite(v) || v <= 0) return { ok: false, error: `${fd.label} must be a number greater than 0.` };
    values[fd.key] = v;
  }
  const res = cfg.compute(values);
  if ('error' in res) return { ok: false, error: res.error };
  const hsn = (input.hsn ?? '').trim() || res.hsn;
  if (cfg.method === 'SECTION_WEIGHT') {
    if (!res.kgPerMetre || !res.kgPerMetre.isFinite() || res.kgPerMetre.lte(0)) return { ok: false, error: 'Check the sizes.' };
    return { ok: true, name: res.name, hsn, kgPerMetre: res.kgPerMetre.toDecimalPlaces(6, Decimal.ROUND_HALF_UP).toNumber() };
  }
  return { ok: true, name: res.name, hsn, thicknessMm: res.thicknessMm, coilWidthM: res.coilWidthM };
}

/** Old lines saved with one size box ("40x40x1.3", square tube only) → separate boxes. */
export function legacySteelSizeDims(shape: string, text: string): Record<string, string> {
  const nums = text.split(/\s*[x×*]\s*|\s+/i).filter(Boolean);
  if (shape === 'SQUARE_PIPE') {
    if (nums.length === 2) return { a: nums[0], t: nums[1] };
    if (nums.length === 3) return { a: nums[0], t: nums[2] };
  }
  return {};
}

/** A one-off product for the line's type and boxes (not saved to Products). Rate is typed on the line. */
export function steelSizeProduct(input: SteelSizeInput, rowId: string, gstRate = 18): Product | null {
  const res = parseSteelSize(input);
  const cfg = STEEL_SIZE_KINDS[input.shape];
  if (!res.ok || !cfg) return null;
  const base = {
    id: `steelsize_${rowId}`,
    name: res.name,
    category: cfg.category,
    hsn: res.hsn,
    qtyMethod: cfg.method,
    unit: cfg.unit,
    ratePerUnit: 0,
    gstRate,
    active: true,
  };
  if (cfg.method === 'SECTION_WEIGHT') {
    return { ...base, stockMethod: 'WEIGHT', kgPerMetre: res.kgPerMetre, defaultLengthM: cfg.defaultLengthM } as unknown as Product;
  }
  if (cfg.method === 'SHEET_WEIGHT') {
    return {
      ...base,
      stockMethod: 'WEIGHT',
      thicknessMm: res.thicknessMm,
      coilWidthM: res.coilWidthM,
      densityFactor: DEFAULT_DENSITY_FACTOR.toNumber(),
    } as unknown as Product;
  }
  return { ...base, stockMethod: cfg.method === 'PIECE' ? 'PIECE' : 'NONE' } as unknown as Product;
}
