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

export type SheetItemKind = 'SHEET_SQM' | 'PLAIN_SHEET' | 'UPVC_SHEET' | 'TILE_SQM' | 'TILE_KGFT' | 'AIR_VENT' | 'SHEET_KGFT' | 'SHEET_WEIGHT' | 'POLYCARBONATE' | 'FLASHING' | 'RIDGE' | 'PROFILE_RIDGE' | 'GUTTER' | 'RIDGE_GUTTER' | 'FIXING';
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
  /** New lines start with the length in ft + in (sheets) instead of metres. */
  lengthInFeet?: boolean;
  /** Weight is given per foot (kg/ft) rather than worked out per metre. */
  perFoot?: boolean;
  /** Cut from a plain sheet: pieces typed, whole sheets priced by Sq.Mtr (flashing, ridge, gutter). */
  sheetCut?: boolean;
  category: string;
  /** The item name, HSN and (steel) kg/m, or what is wrong. */
  compute: (v: Record<string, number | string>) => ItemBuild | { error: string };
}

// ── Suggestions (staff can always type something else) ─────────────────────────
export const SHEET_BRANDS = ['JSW Colouron+', 'JSW Pragathi+', 'JSW Radiance', 'Tata Durashine', 'Tata Galvalume', 'Amns', 'GI'];
export const SHEET_PROFILES = ['Crimp', 'Arch', 'Profile'];
export const SHEET_THICKNESSES = ['0.30', '0.35', '0.40', '0.45', '0.47', '0.50', '0.55', '0.60'];
export const SHEET_COLOURS = ['Red', 'Blue', 'Green', 'Grey', 'White', 'Off-white', 'Brick red', 'Terracotta', 'Silver', 'Bare'];
export const POLY_THICKNESSES = ['1.5', '2', '3', '4', '6', '8', '10'];
export const POLY_COLOURS = ['Clear', 'Bronze', 'Opal', 'Blue', 'Green', 'Grey'];
export const FLASHING_ITEMS = ['L flashing', 'Ridge', 'Barge L flashing'];
export const RIDGE_GUTTER_ITEMS = ['Ridge', 'Valley gutter', 'Gutter', 'End cap'];
export const RIDGE_ITEMS = ['Ridge'];
export const AIR_VENT_BASES = ['Polycarbonate base', 'Aluminium base'];
export const GUTTER_ITEMS = ['Gutter', 'Barge gutter'];
export const RIDGE_GUTTER_SIZES = ['12x12', '18x18', '24 inch'];
export const FLASHING_SIZES = ['6x6', '8x8', '1x1 ft', '18x18', '24'];
export const FLASHING_LENGTHS = ['8 ft', '10 ft', '12 ft'];
export const FIXING_ITEMS = ['Self drilling screw', 'EPDM washer', 'J bolt', 'Bolt & nut', 'Rivet', 'Silicone sealant'];
export const FIXING_SIZES = ['25 mm', '55 mm', '80 mm', '100 mm'];

const G = STEEL_DENSITY_KG_PER_M_PER_MM2;
const FEET_TO_METRE = new Decimal('0.305');
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
const COLOUR = combo('colour', 'Colour', SHEET_COLOURS);
const SHEET_T = combo('t', 'Thickness', SHEET_THICKNESSES, { unit: 'mm' });
// Empty = the quotation's width factor (shown in the box); type a value to use another on this line
const SHEET_WF = combo('wf', 'Width factor', ['1.06', '1.08'], { numeric: true });
const mm = (t: number | string) => (f(t) ? `${f(t)} mm` : '');

export const STEEL_BRANDS = ['Tata', 'JSW', 'SAIL', 'Jindal', 'Apollo', 'Madhav'];
const STEEL_BRAND = combo('brand', 'Brand', STEEL_BRANDS);

/** Steel types: sizes, then an optional Brand (put in front of the item name, e.g. "Tata MS Square Tube …"). */
const steel = (label: string, category: string, fields: SteelSizeField[], compute: SteelSizeKindConfig['compute'], defaultLengthM = 6): SteelSizeKindConfig => ({
  label,
  group: 'Steel',
  method: 'SECTION_WEIGHT',
  unit: 'Kgs',
  fields: [...fields, STEEL_BRAND],
  defaultLengthM,
  category,
  compute: (v) => {
    const r = compute(v);
    return 'error' in r ? r : { ...r, name: join(v.brand, r.name) };
  },
});

export const RIDGE_SIZES = ['1x1 ft', '1.5x1.5 ft', '12x12', '18x18'];
export const GUTTER_SIZES = ['18', '24', '30', '36'];

/** A sheet-cut item (ridge, gutter): same boxes and pricing as flashing; the item is picked in the main dropdown. */
/**
 * Width a sheet-cut piece uses across the sheet, in inches, from the line's boxes:
 * Side A + Side B (or one Girth box) in inches or feet. Older lines kept one "6x6" text box.
 */
export function sheetCutGirthInches(dims: Record<string, string>): number | null {
  const a = Number(dims.a);
  if (dims.a !== undefined && String(dims.a).trim() !== '') {
    const b = dims.b !== undefined && String(dims.b).trim() !== '' ? Number(dims.b) : 0;
    if (!(a > 0) || !(b >= 0)) return null;
    return (a + b) * (dims.su === 'ft' ? 12 : 1);
  }
  return dims.size ? flashingGirthInches(dims.size) : null;
}

/** Older sheet-cut lines kept one size text ("6x6", "1x1 ft", "24"); split it into Side A / Side B / unit. */
export function migrateSheetCutDims(shape: string, dims: Record<string, string>): Record<string, string> {
  if (!isSheetCut(shape) || !dims.size || (dims.a !== undefined && String(dims.a).trim() !== '')) return dims;
  const text = dims.size.toLowerCase();
  const nums = (text.match(/\d+(\.\d+)?/g) || []).slice(0, 2);
  if (!nums.length) return dims;
  const inFeet = /ft|feet|'/.test(text) || nums.every((v) => Number(v) <= 3);
  const { size: _old, ...rest } = dims; // eslint-disable-line @typescript-eslint/no-unused-vars
  return { ...rest, a: nums[0], ...(nums[1] ? { b: nums[1] } : {}), su: inFeet ? 'ft' : 'in' };
}

/** "6 × 6 in", "1.5 × 1.5 ft", "24 in" for the item name. */
function sheetCutSizeText(dims: Record<string, string>): string {
  const unit = dims.su === 'ft' ? 'ft' : 'in';
  if (dims.a !== undefined && String(dims.a).trim() !== '') {
    return dims.b !== undefined && String(dims.b).trim() !== '' ? `${f(dims.a)} × ${f(dims.b)} ${unit}` : `${f(dims.a)} ${unit}`;
  }
  return f(dims.size ?? '').replace(/\s*x\s*/gi, ' × ');
}

/** Pieces per sheet from the line's boxes (see sheetCutGirthInches). */
export function sheetCutPerSheet(dims: Record<string, string>): { girth: number; perSheet: number } | { error: string } {
  const girth = sheetCutGirthInches(dims);
  if (!girth) return { error: 'Enter the size.' };
  const width = Number(dims.sheet || 48);
  if (!(width > 0)) return { error: 'Enter the sheet width in inches, e.g. 48.' };
  const perSheet = Math.floor(width / girth + 1e-9);
  if (perSheet < 1) return { error: `A ${Number(girth.toFixed(2))} in piece is wider than the ${width} in sheet.` };
  return { girth, perSheet };
}

const SIDE_UNIT = (def: 'in' | 'ft'): SteelSizeField => ({ key: 'su', label: 'Size in', short: 'Unit', kind: 'select', unit: '', options: ['in', 'ft'], default: def });

/** A sheet-cut item (flashing, ridge, gutter): sizes, then the sheet; the item is picked in the main dropdown. */
function sheetCut(label: string, sides: 'AB' | 'AB_optionalB', unitDefault: 'in' | 'ft'): SteelSizeKindConfig {
  // Gutter: Side B can be left empty when only the girth is known
  const sizeFields: SteelSizeField[] = [
    { key: 'a', label: 'Side A', short: 'A', unit: '' },
    { key: 'b', label: 'Side B', short: 'B', unit: '', optional: sides === 'AB_optionalB' },
    SIDE_UNIT(unitDefault),
  ];
  return {
    label,
    group: 'Accessories',
    method: 'SQM',
    unit: 'Sq.Mtr',
    fields: [
      ...sizeFields,
      combo('sheet', 'Sheet width', ['48'], { unit: 'in', optional: false, numeric: true, default: '48' }),
      combo('wf', 'Width factor', ['1.08', '1.28'], { optional: false, numeric: true, default: '1.08' }),
      BRAND,
      SHEET_T,
      COLOUR,
    ],
    defaultLengthM: 0,
    lengthInFeet: true,
    sheetCut: true,
    category: 'Flashing',
    compute: (v) => {
      const dims = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, String(x)]));
      const cut = sheetCutPerSheet(dims);
      if ('error' in cut) return { error: cut.error };
      return { name: join(v.brand, v.item, sheetCutSizeText(dims), mm(v.t)), hsn: '72109090' };
    },
  };
}

export const STEEL_SIZE_KINDS: Record<SteelSizeKind, SteelSizeKindConfig> = {
  // ── Sheets ───────────────────────────────────────────────────────────────────
  SHEET_SQM: {
    label: 'Roofing sheet (Sq.Mtr)',
    group: 'Sheets',
    method: 'SQM',
    unit: 'Sq.Mtr',
    fields: [BRAND, PROFILE, SHEET_T, SHEET_WF, COLOUR],
    defaultLengthM: 0,
    category: 'Sheet',
    compute: ({ brand, profile, t }) => ({ name: join(brand, profile, mm(t)) || 'Roofing sheet', hsn: '72109090' }),
  },
  // RR's way: weight per sheet = length in feet × kg per foot (e.g. 126 in ÷ 12 × 1.24 = 13.02 kg).
  // Sold by weight like steel: kg/m = kg/ft ÷ 0.305, so length (m) × kg/m = length (ft) × kg/ft.
  // Plain (flat) sheet: same Sq.Mtr formula as roofing sheet, no profile
  PLAIN_SHEET: {
    label: 'Plain sheet',
    group: 'Sheets',
    method: 'SQM',
    unit: 'Sq.Mtr',
    fields: [BRAND, SHEET_T, SHEET_WF, COLOUR],
    defaultLengthM: 0,
    category: 'Sheet',
    compute: ({ brand, t }) => ({ name: join(brand, 'Plain sheet', mm(t)), hsn: '72109090' }),
  },
  SHEET_KGFT: {
    label: 'Roofing sheet (by weight)',
    group: 'Sheets',
    method: 'SECTION_WEIGHT',
    unit: 'Kgs',
    fields: [
      BRAND,
      PROFILE,
      combo('kgft', 'Weight per foot', ['1.24'], { unit: 'kg/ft', optional: false, numeric: true, default: '1.24' }),
      COLOUR,
    ],
    defaultLengthM: 0,
    lengthInFeet: true,
    perFoot: true,
    category: 'Sheet',
    compute: ({ brand, profile, kgft }) => {
      if (n(kgft) >= 50) return { error: 'Weight per ft is in kg, e.g. 1.24.' };
      return { name: join(brand, profile) || 'Roofing sheet', hsn: '72109090', kgPerMetre: new Decimal(n(kgft)).dividedBy(FEET_TO_METRE) };
    },
  },
  // UPVC sheet: same Sq.Mtr formula as roofing sheet
  UPVC_SHEET: {
    label: 'UPVC sheet',
    group: 'Sheets',
    method: 'SQM',
    unit: 'Sq.Mtr',
    fields: [BRAND, combo('t', 'Thickness', ['2', '2.5', '3'], { unit: 'mm' }), SHEET_WF, COLOUR],
    defaultLengthM: 0,
    category: 'Sheet',
    compute: ({ brand, t }) => ({ name: join(brand, 'UPVC sheet', mm(t)), hsn: '39204900' }),
  },
  // Tile sheet: by Sq.Mtr (like roofing sheet) or by weight (length in ft × kg per foot)
  TILE_SQM: {
    label: 'Tile sheet (Sq.Mtr)',
    group: 'Sheets',
    method: 'SQM',
    unit: 'Sq.Mtr',
    fields: [BRAND, SHEET_T, SHEET_WF, COLOUR],
    defaultLengthM: 0,
    category: 'Sheet',
    compute: ({ brand, t }) => ({ name: join(brand, 'Tile sheet', mm(t)), hsn: '72109090' }),
  },
  TILE_KGFT: {
    label: 'Tile sheet (by weight)',
    group: 'Sheets',
    method: 'SECTION_WEIGHT',
    unit: 'Kgs',
    fields: [BRAND, combo('kgft', 'Weight per foot', ['1.24'], { unit: 'kg/ft', optional: false, numeric: true, default: '1.24' }), COLOUR],
    defaultLengthM: 0,
    lengthInFeet: true,
    perFoot: true,
    category: 'Sheet',
    compute: ({ brand, kgft }) => {
      if (n(kgft) >= 50) return { error: 'Weight per ft is in kg, e.g. 1.24.' };
      return { name: join(brand, 'Tile sheet'), hsn: '72109090', kgPerMetre: new Decimal(n(kgft)).dividedBy(FEET_TO_METRE) };
    },
  },
  // Air vent: priced per piece; the base is always one of the two
  AIR_VENT: {
    label: 'Air vent',
    group: 'Accessories',
    method: 'PIECE',
    unit: 'Nos',
    fields: [
      { key: 'base', label: 'Base', short: 'Base', kind: 'select', unit: '', options: AIR_VENT_BASES, default: AIR_VENT_BASES[0] },
      combo('size', 'Size', ['24 inch', '600 mm']),
      BRAND,
    ],
    defaultLengthM: 0,
    category: 'Air vent',
    compute: ({ base, size, brand }) => {
      if (!AIR_VENT_BASES.includes(String(base))) return { error: 'Choose the base: polycarbonate or aluminium.' };
      return { name: `${join(brand, 'Air vent', size)} – ${String(base).toLowerCase()}`, hsn: '84145990' };
    },
  },
  // Earlier by-weight sheet (thickness × coil width × 7.968); no longer offered, older quotes still open
  SHEET_WEIGHT: {
    label: 'Roofing sheet (by thickness)',
    group: 'Sheets',
    method: 'SHEET_WEIGHT',
    unit: 'Kgs',
    fields: [
      BRAND,
      PROFILE,
      { ...SHEET_T, optional: false, numeric: true },
      combo('coil', 'Coil width', ['1.06', '1.22'], { unit: 'm', optional: false, numeric: true, default: '1.06' }),
      COLOUR,
    ],
    defaultLengthM: 0,
    category: 'Sheet',
    compute: ({ brand, profile, t, coil }) => {
      if (n(t) >= 5) return { error: 'Sheet thickness is in mm, e.g. 0.47.' };
      if (n(coil) >= 3) return { error: 'Coil width is in metres, e.g. 1.06.' };
      return { name: join(brand, profile, mm(t)) || 'Roofing sheet', hsn: '72109090', thicknessMm: n(t), coilWidthM: n(coil) };
    },
  },
  POLYCARBONATE: {
    label: 'Polycarbonate sheet',
    group: 'Sheets',
    method: 'SQM',
    unit: 'Sq.Mtr',
    fields: [combo('t', 'Thickness', POLY_THICKNESSES, { unit: 'mm' }), SHEET_WF, combo('colour', 'Colour', POLY_COLOURS)],
    defaultLengthM: 0,
    category: 'Sheet',
    compute: ({ t }) => ({ name: join('Polycarbonate sheet', mm(t)), hsn: '39206110' }),
  },
  // ── Accessories (priced per piece) ───────────────────────────────────────────
  // Cut from a plain sheet (8 ft × 4 ft): pieces per sheet = sheet width ÷ (side A + side B).
  // Staff type the pieces in Nos; the sheets used are priced by area:
  // Sq.Mtr per sheet = sheet length (ft) × 0.305 × width factor (1.08), rounded down to 2 decimals, × sheets
  // e.g. 8 × 0.305 × 1.08 = 2.6352 → 2.63 a sheet; 3 sheets = 7.89
  FLASHING: sheetCut('Flashing (cut from sheet)', 'AB', 'in'),
  // Earlier combined type; no longer offered, older quotes still open
  RIDGE_GUTTER: {
    label: 'Ridge / gutter',
    group: 'Accessories',
    method: 'PIECE',
    unit: 'Nos',
    fields: [
      combo('item', 'Ridge / gutter type', RIDGE_GUTTER_ITEMS, { optional: false }),
      combo('size', 'Size', RIDGE_GUTTER_SIZES),
      combo('length', 'Length', FLASHING_LENGTHS),
      BRAND,
      SHEET_T,
      COLOUR,
    ],
    defaultLengthM: 0,
    category: 'Flashing',
    compute: ({ item, size, length, brand, t }) => ({
      name: join(brand, item, f(size).replace(/\s*x\s*/gi, ' × '), mm(t)) + (f(length) ? ` – ${f(length)}` : ''),
      hsn: '72109090',
    }),
  },
  // Ridge and gutter are cut from the same 8 ft × 4 ft sheet as flashing:
  // pieces per sheet = 48 in ÷ width used (1 × 1 ft ridge → 2; 1.5 × 1.5 ft → 1; gutter over 24 in → 1)
  RIDGE: sheetCut('Ridge', 'AB', 'ft'),
  GUTTER: sheetCut('Gutter', 'AB_optionalB', 'in'),
  // Profile ridge: priced on the length of the sheet only (no A × B, not cut from the 48 in sheet)
  PROFILE_RIDGE: {
    label: 'Profile ridge',
    group: 'Accessories',
    method: 'SQM',
    unit: 'Sq.Mtr',
    fields: [SHEET_WF, BRAND, SHEET_T, COLOUR],
    defaultLengthM: 0,
    lengthInFeet: true,
    category: 'Flashing',
    compute: ({ brand, t }) => ({ name: join(brand, 'Profile ridge', mm(t)), hsn: '72109090' }),
  },
  FIXING: {
    label: 'Screws & fixings',
    group: 'Accessories',
    method: 'PIECE',
    unit: 'Nos',
    fields: [combo('item', 'Screw / fixing type', FIXING_ITEMS, { optional: false }), combo('size', 'Size', FIXING_SIZES)],
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

/** Items picked straight from the main dropdown (the line then has no separate "type" box). */
export const ITEM_PRESETS: Partial<Record<SteelSizeKind, string[]>> = {
  FLASHING: FLASHING_ITEMS,
  RIDGE: RIDGE_ITEMS,
  GUTTER: GUTTER_ITEMS,
};

export interface ItemOption {
  value: string; // "FLASHING::L flashing" or a plain type, e.g. "SQUARE_PIPE"
  kind: SteelSizeKind;
  item?: string;
  label: string;
}
const opt = (kind: SteelSizeKind): ItemOption => ({ value: kind, kind, label: STEEL_SIZE_KINDS[kind].label });
const presets = (kind: SteelSizeKind): ItemOption[] =>
  (ITEM_PRESETS[kind] || []).map((item) => ({ value: `${kind}::${item}`, kind, item, label: item }));

/** The main dropdown, grouped. */
export const ITEM_GROUPS: { group: string; options: ItemOption[] }[] = [
  { group: 'Sheets', options: (['SHEET_SQM', 'PLAIN_SHEET', 'SHEET_KGFT', 'POLYCARBONATE', 'UPVC_SHEET', 'TILE_SQM', 'TILE_KGFT'] as SteelSizeKind[]).map(opt) },
  { group: 'Flashing (cut from sheet)', options: presets('FLASHING') },
  { group: 'Ridge', options: [...presets('RIDGE'), opt('PROFILE_RIDGE')] },
  { group: 'Gutter (cut from sheet)', options: presets('GUTTER') },
  { group: 'Air vent', options: [opt('AIR_VENT')] },
  { group: 'Fixings', options: [opt('FIXING')] },
  {
    group: 'Steel',
    // Unequal angle is not offered (RR's choice); quotes that already have one still open
    options: (['SQUARE_PIPE', 'RECT_PIPE', 'ROUND_PIPE', 'PLATE', 'CHEQUERED_PLATE', 'FLAT', 'ROUND_BAR', 'SQUARE_BAR', 'EQUAL_ANGLE', 'CHANNEL', 'BEAM'] as SteelSizeKind[]).map(opt),
  },
];
export const STEEL_SIZE_KIND_ORDER: SteelSizeKind[] = [...new Set(ITEM_GROUPS.flatMap((g) => g.options.map((o) => o.kind)))];

/** Dropdown value for a line: the type, plus the item for preset types. */
export function itemOptionValue(shape: SteelSizeKind, dims: Record<string, string>): string {
  return ITEM_PRESETS[shape] ? `${shape}::${dims.item ?? ''}` : shape;
}
export function parseItemOptionValue(value: string): { kind: SteelSizeKind; item?: string } {
  const [kind, item] = value.split('::');
  return { kind: kind as SteelSizeKind, item };
}

/** The unit shown after a field's label: steel measurement boxes are in mm unless set. */
export function fieldUnit(fd: SteelSizeField): string {
  if (fd.unit !== undefined) return fd.unit;
  return fd.kind === 'select' ? '' : 'mm';
}

export function isSheetCut(shape?: string): boolean {
  return Boolean(shape && STEEL_SIZE_KINDS[shape as SteelSizeKind]?.sheetCut);
}

export function kindHasColour(shape?: string): boolean {
  const cfg = shape ? STEEL_SIZE_KINDS[shape as SteelSizeKind] : undefined;
  return Boolean(cfg?.fields.some((fd) => fd.key === 'colour'));
}

/**
 * Width a flashing uses across the sheet, in inches: side A + side B ("6x6" → 12, "18x18" → 36),
 * or one number for a gutter's girth ("24" → 24). Sizes in feet ("1x1 ft", or both sides 3 or less) × 12.
 */
export function flashingGirthInches(size: string): number | null {
  const text = (size || '').toLowerCase();
  const nums = (text.match(/\d+(\.\d+)?/g) || []).map(Number).filter((v) => v > 0);
  if (!nums.length) return null;
  const sides = nums.slice(0, 2);
  const inFeet = /ft|feet|'/.test(text) || sides.every((v) => v <= 3);
  const girth = sides.reduce((a, b) => a + b, 0);
  return inFeet ? girth * 12 : girth;
}

/** How many pieces of this size come out of one sheet of the given width (inches). */
export function flashingPerSheet(size: string, sheetWidthIn: number): { girth: number; perSheet: number } | { error: string } {
  const girth = flashingGirthInches(size);
  if (!girth) return { error: 'Type the size, e.g. 6x6 or 1x1 ft.' };
  if (!(sheetWidthIn > 0)) return { error: 'Enter the sheet width in inches, e.g. 48.' };
  const perSheet = Math.floor(sheetWidthIn / girth + 1e-9);
  if (perSheet < 1) return { error: `A ${girth} in piece is wider than the ${sheetWidthIn} in sheet.` };
  return { girth, perSheet };
}

/** "1.24 kg/ft" for sheets sold per foot, "3.588 kg/m" for steel. */
export function weightRateText(shape: string | undefined, kgPerMetre: number | undefined, dims?: Record<string, string>): string {
  const cfg = shape ? STEEL_SIZE_KINDS[shape as SteelSizeKind] : undefined;
  if (cfg?.perFoot) {
    const typed = dims?.kgft?.trim();
    const kgft = typed || (kgPerMetre ? String(Number((kgPerMetre * 0.305).toFixed(3))) : '');
    return `${kgft} kg/ft`;
  }
  const v = Number(kgPerMetre);
  return isFinite(v) ? `${Number(v.toFixed(3))} kg/m` : '';
}

/** Boxes filled in when a type is picked (e.g. coil width 1.06); preset types start on their first item. */
export function defaultDims(shape: SteelSizeKind, item?: string): Record<string, string> {
  const dims: Record<string, string> = {};
  const presetItems = ITEM_PRESETS[shape];
  if (presetItems) dims.item = item ?? presetItems[0];
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
  input = { ...input, dims: migrateSheetCutDims(input.shape, input.dims || {}) };
  const cfg = STEEL_SIZE_KINDS[input.shape];
  if (!cfg) return { ok: false, error: 'Pick the item type.' };
  const text = (k: string) => String(input.dims?.[k] ?? '').trim();
  const empty = cfg.fields.filter((fd) => !fd.optional && !text(fd.key));
  if (empty.length) {
    return { ok: false, missing: true, error: `Enter ${empty.map((fd) => fd.label.toLowerCase()).join(', ')}.` };
  }
  const values: Record<string, number | string> = Object.fromEntries(Object.entries(input.dims || {}).map(([k, v]) => [k, String(v ?? '').trim()]));
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
    return { ok: true, name: res.name, hsn, kgPerMetre: res.kgPerMetre.toDecimalPlaces(10, Decimal.ROUND_HALF_UP).toNumber() };
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
