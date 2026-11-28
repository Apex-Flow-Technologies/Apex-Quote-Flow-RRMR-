/**
 * "Steel by size" quote lines: staff pick a shape and type the size (e.g. 40x40x1.3);
 * the app builds a one-off steel product with the IS weight per metre, so nothing needs
 * to be pre-loaded in Products. Sold by weight like any steel line:
 * kg = length (m) × kg/m × Nos.
 *
 * Only square pipe is switched on for now. To add a shape, add an entry to STEEL_SIZE_SHAPES.
 */
import type { Product } from '../../types/product';
import { calculateSteelKgPerMetre, DEFAULT_STEEL_LENGTH_M, type SteelDims, type SteelShape } from '../../engine/steel';

export interface SteelSizeShapeConfig {
  label: string; // shown on the line, e.g. "Square pipe"
  namePrefix: string; // start of the item name, e.g. "MS Square Pipe"
  placeholder: string;
  hint: string;
  category: string;
  hsn: string;
  /** Typed numbers → dimensions, or a message saying what is wrong. */
  parse: (nums: number[]) => { dims: SteelDims; size: string } | { error: string };
}

const fmt = (n: number) => String(n);

export const STEEL_SIZE_SHAPES: Partial<Record<SteelShape, SteelSizeShapeConfig>> = {
  SQUARE_PIPE: {
    label: 'Square pipe',
    namePrefix: 'MS Square Pipe',
    placeholder: '40x40x1.3',
    hint: 'Side × side × thickness in mm, e.g. 40x40x1.3 (or 40x1.3)',
    category: 'Pipe',
    hsn: '73066100',
    parse: (nums) => {
      let side: number;
      let t: number;
      if (nums.length === 2) [side, t] = nums;
      else if (nums.length === 3) {
        if (nums[0] !== nums[1]) return { error: `${fmt(nums[0])} × ${fmt(nums[1])} is not square. Both sides of a square pipe are the same.` };
        [side, , t] = nums;
      } else return { error: 'Type side × side × thickness, e.g. 40x40x1.3' };
      return { dims: { sideMm: side, thicknessMm: t }, size: `${fmt(side)} × ${fmt(side)} × ${fmt(t)} mm` };
    },
  },
};

export interface SteelSizeInput {
  shape: SteelShape;
  text: string;
}

export type SteelSizeResult =
  | { ok: true; name: string; kgPerMetre: number; dims: SteelDims }
  | { ok: false; error: string };

/** Reads "40x40x1.3", "40 X 40 X 1.3", "40×40×1.3", "40*40*1.3". */
export function parseSteelSize(input: SteelSizeInput): SteelSizeResult {
  const cfg = STEEL_SIZE_SHAPES[input.shape];
  if (!cfg) return { ok: false, error: 'This shape is not available yet.' };
  const text = (input.text || '').trim();
  if (!text) return { ok: false, error: `Type the size, e.g. ${cfg.placeholder}` };
  const parts = text.split(/\s*[x×*]\s*|\s+/i).filter(Boolean);
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !isFinite(n) || n <= 0)) return { ok: false, error: `Use numbers only, e.g. ${cfg.placeholder}` };
  const parsed = cfg.parse(nums);
  if ('error' in parsed) return { ok: false, error: parsed.error };
  const kgPerMetre = calculateSteelKgPerMetre(input.shape, parsed.dims);
  if (!kgPerMetre) return { ok: false, error: 'The thickness is too large for this size.' };
  return { ok: true, name: `${cfg.namePrefix} ${parsed.size}`, kgPerMetre, dims: parsed.dims };
}

/** A one-off steel product for the typed size (not saved to Products). */
export function steelSizeProduct(input: SteelSizeInput, rowId: string, gstRate = 18): Product | null {
  const res = parseSteelSize(input);
  const cfg = STEEL_SIZE_SHAPES[input.shape];
  if (!res.ok || !cfg) return null;
  return {
    id: `steelsize_${rowId}`,
    name: res.name,
    category: cfg.category,
    hsn: cfg.hsn,
    qtyMethod: 'SECTION_WEIGHT',
    unit: 'Kgs',
    ratePerUnit: 0,
    gstRate,
    active: true,
    stockMethod: 'WEIGHT',
    kgPerMetre: res.kgPerMetre,
    steelShape: input.shape,
    steelDims: res.dims,
    thicknessMm: res.dims.thicknessMm,
    defaultLengthM: DEFAULT_STEEL_LENGTH_M,
  } as unknown as Product;
}
