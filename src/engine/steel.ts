import Decimal from 'decimal.js';

/**
 * Structural steel weight engine (IS standard formulas, bare MS steel 7.85 g/cm³).
 *
 * Every shape resolves to a weight per metre (kg/m). The product is then sold as a
 * SECTION_WEIGHT line: per-piece kg = length (m) × kg/m, line kg = per-piece × Nos.
 *
 * All dimensions are in millimetres.
 */

export type SteelShape =
  | 'ROUND_PIPE' // CHS — IS 1161 / IS 4923 style
  | 'SQUARE_PIPE' // SHS — IS 4923
  | 'RECT_PIPE' // RHS — IS 4923
  | 'PLATE'
  | 'CHEQUERED_PLATE'
  | 'FLAT'
  | 'ROUND_BAR'
  | 'SQUARE_BAR'
  | 'CHART'; // Angle / Channel / Beam — kg/m typed from the IS chart

export interface SteelDims {
  odMm?: number; // round pipe outside diameter
  sideMm?: number; // square pipe / square bar side
  widthMm?: number; // rect pipe width, plate / flat width
  heightMm?: number; // rect pipe height
  thicknessMm?: number; // wall / plate / flat thickness
  diameterMm?: number; // round bar diameter
  kgPerSqm?: number; // chequered plate chart weight (optional override)
}

export const STEEL_DENSITY_KG_PER_M_PER_MM2 = new Decimal('0.00785'); // 7.85 g/cm³
// Factors as used by RR's reference calculator (maiak-m.bg), so RR's weights match it:
export const ROUND_PIPE_FACTOR = new Decimal('0.024649'); // 3.14 × 0.00785 (Maiak-M: 0.0314 × 0.00785 × 100)
export const ROUND_BAR_FACTOR = new Decimal('0.0061654'); // π/4 × 0.00785
// Square / rectangular tubes (EN 10219, as Maiak-M): kg/m = t × (0.0157 × (B + H) − 0.044877 × t)
export const TUBE_SIDE_FACTOR = new Decimal('0.0157'); // 2 × 0.00785
export const TUBE_CORNER_FACTOR = new Decimal('0.044877');
export const DEFAULT_STEEL_LENGTH_M = 6;
export const DEFAULT_CHEQUERED_PLATE_LENGTH_M = 2.5;

export const STEEL_SHAPE_LABELS: Record<SteelShape, string> = {
  ROUND_PIPE: 'Round tube (CHS)',
  SQUARE_PIPE: 'Square tube (SHS)',
  RECT_PIPE: 'Rectangular tube (RHS)',
  PLATE: 'MS plate',
  CHEQUERED_PLATE: 'Chequered plate',
  FLAT: 'MS flat',
  ROUND_BAR: 'Round bar',
  SQUARE_BAR: 'Square bar',
  CHART: 'Angle / Channel / Beam (chart kg/m)',
};

/** Which dimension inputs each shape needs (in display order). */
export const STEEL_SHAPE_FIELDS: Record<SteelShape, (keyof SteelDims)[]> = {
  ROUND_PIPE: ['odMm', 'thicknessMm'],
  SQUARE_PIPE: ['sideMm', 'thicknessMm'],
  RECT_PIPE: ['widthMm', 'heightMm', 'thicknessMm'],
  PLATE: ['widthMm', 'thicknessMm'],
  CHEQUERED_PLATE: ['widthMm', 'thicknessMm', 'kgPerSqm'],
  FLAT: ['widthMm', 'thicknessMm'],
  ROUND_BAR: ['diameterMm'],
  SQUARE_BAR: ['sideMm'],
  CHART: [],
};

export const STEEL_DIM_LABELS: Record<keyof SteelDims, string> = {
  odMm: 'Outside dia (mm)',
  sideMm: 'Side (mm)',
  widthMm: 'Width (mm)',
  heightMm: 'Height (mm)',
  thicknessMm: 'Thickness (mm)',
  diameterMm: 'Diameter (mm)',
  kgPerSqm: 'Chart kg/m² (optional)',
};

export function defaultLengthForShape(shape: SteelShape): number {
  return shape === 'CHEQUERED_PLATE' ? DEFAULT_CHEQUERED_PLATE_LENGTH_M : DEFAULT_STEEL_LENGTH_M;
}

function pos(v: number | undefined): Decimal | null {
  if (v === undefined || v === null || !isFinite(v) || v <= 0) return null;
  return new Decimal(v);
}

/**
 * Unrounded kg/m for a shape, or null if the dimensions are missing / impossible.
 */
export function calculateSteelKgPerMetreRaw(shape: SteelShape, dims: SteelDims): Decimal | null {
  const t = pos(dims.thicknessMm);

  switch (shape) {
    case 'ROUND_PIPE': {
      const od = pos(dims.odMm);
      if (!od || !t || t.times(2).gte(od)) return null;
      return od.minus(t).times(t).times(ROUND_PIPE_FACTOR);
    }

    case 'SQUARE_PIPE':
    case 'RECT_PIPE': {
      const b = shape === 'SQUARE_PIPE' ? pos(dims.sideMm) : pos(dims.widthMm);
      const h = shape === 'SQUARE_PIPE' ? pos(dims.sideMm) : pos(dims.heightMm);
      if (!b || !h || !t || t.times(2).gte(Decimal.min(b, h))) return null;
      // EN 10219 (as Maiak-M): t × (0.0157 × (B + H) − 0.044877 × t)
      return t.times(TUBE_SIDE_FACTOR.times(b.plus(h)).minus(TUBE_CORNER_FACTOR.times(t)));
    }

    case 'PLATE':
    case 'FLAT': {
      const w = pos(dims.widthMm);
      if (!w || !t) return null;
      return w.times(t).times(STEEL_DENSITY_KG_PER_M_PER_MM2);
    }

    case 'CHEQUERED_PLATE': {
      const w = pos(dims.widthMm);
      if (!w) return null;
      const chart = pos(dims.kgPerSqm);
      if (chart) return w.dividedBy(1000).times(chart);
      if (!t) return null;
      return w.times(t).times(STEEL_DENSITY_KG_PER_M_PER_MM2);
    }

    case 'ROUND_BAR': {
      const d = pos(dims.diameterMm);
      if (!d) return null;
      return d.pow(2).times(ROUND_BAR_FACTOR);
    }

    case 'SQUARE_BAR': {
      const a = pos(dims.sideMm);
      if (!a) return null;
      return a.pow(2).times(STEEL_DENSITY_KG_PER_M_PER_MM2);
    }

    case 'CHART':
    default:
      return null;
  }
}

/** kg/m rounded to 3 decimals (stored on the product as kgPerMetre). */
/** kg/m for display: up to 3 decimals, e.g. 3.588 (the line itself keeps the exact value). */
export function formatKgPerMetre(kgPerMetre: number | string | undefined | null): string {
  const v = Number(kgPerMetre);
  if (!isFinite(v)) return '';
  return String(Number(v.toFixed(3)));
}

export function calculateSteelKgPerMetre(shape: SteelShape, dims: SteelDims): number | null {
  const raw = calculateSteelKgPerMetreRaw(shape, dims);
  return raw ? raw.toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toNumber() : null;
}

/** Short size text, e.g. "48.3 OD × 3.2", "60 × 60 × 3.2", "1250 × 5". */
export function formatSteelSize(shape: SteelShape, dims: SteelDims): string {
  const n = (v?: number) => (v === undefined ? '?' : String(v));
  switch (shape) {
    case 'ROUND_PIPE':
      return `${n(dims.odMm)} OD × ${n(dims.thicknessMm)}`;
    case 'SQUARE_PIPE':
      return `${n(dims.sideMm)} × ${n(dims.sideMm)} × ${n(dims.thicknessMm)}`;
    case 'RECT_PIPE':
      return `${n(dims.widthMm)} × ${n(dims.heightMm)} × ${n(dims.thicknessMm)}`;
    case 'PLATE':
    case 'CHEQUERED_PLATE':
    case 'FLAT':
      return `${n(dims.widthMm)} × ${n(dims.thicknessMm)}`;
    case 'ROUND_BAR':
      return `Ø${n(dims.diameterMm)}`;
    case 'SQUARE_BAR':
      return `${n(dims.sideMm)} × ${n(dims.sideMm)}`;
    default:
      return '';
  }
}
