/**
 * Product form: state shape, validation and payload building, shared by the
 * Products page (add / edit a master product) and the quotation builder
 * (add a custom item with the same options). No React — unit-testable.
 */
import { Decimal } from 'decimal.js';
import type { CreateProductInput, Product, ProductUnit, QuantityMethod } from '../../types/product';
import { type SteelShape, type SteelDims, calculateSteelKgPerMetre } from '../../engine/steel';

export const PRODUCT_CATEGORIES = [
  'Sheet',
  'Accessory',
  'Structural',
  'Screw',
  'Crimp',
  'Coloron',
  'Plain',
  'Ridge',
  'L Sheet',
  'Fixing',
  'Pipe',
  'Plate',
  'Bar',
  'Other',
];

export interface ProductFormData {
  name: string;
  category: string;
  hsn: string;
  qtyMethod: QuantityMethod;
  unit: ProductUnit;
  ratePerUnit: string;
  baseRate: string;
  minRate: string;
  gstRate: string;
  thicknessMm: string;
  coilWidthM: string;
  densityFactor: string;
  kgPerMetre: string;
  kgPerPiece: string;
  widthFactor: string;
  steelShape: SteelShape;
  steelDims: Partial<Record<keyof SteelDims, string>>;
  defaultLengthM: string;
  active: boolean;
}

/** Parses the string dimension inputs into numbers (blank → undefined). */
export function parseSteelDims(dims: Partial<Record<keyof SteelDims, string>>): SteelDims {
  const out: SteelDims = {};
  (Object.keys(dims) as (keyof SteelDims)[]).forEach((k) => {
    const v = dims[k];
    if (v !== undefined && v.trim() !== '' && isFinite(Number(v))) out[k] = Number(v);
  });
  return out;
}

export const INITIAL_FORM_STATE: ProductFormData = {
  name: '',
  category: 'Sheet',
  hsn: '72109090',
  qtyMethod: 'SQM',
  unit: 'Sq.Mtr',
  ratePerUnit: '',
  baseRate: '',
  minRate: '',
  gstRate: '18',
  thicknessMm: '0.47',
  coilWidthM: '1.06',
  densityFactor: '7.968',
  kgPerMetre: '2.34',
  kgPerPiece: '',
  widthFactor: '1.08',
  steelShape: 'CHART',
  steelDims: {},
  defaultLengthM: '6',
  active: true,
};

/** Starting point for a custom item on a quote: a simple line, so name + rate is enough. */
export function customItemFormState(name = ''): ProductFormData {
  return {
    ...INITIAL_FORM_STATE,
    name,
    category: 'Other',
    hsn: '73089090',
    qtyMethod: 'CUSTOM',
    unit: 'Nos',
  };
}

export function formDataFromProduct(product: Product): ProductFormData {
  const opt = (v: number | undefined, fallback = '') => (v !== undefined ? String(v) : fallback);
  return {
    name: product.name,
    category: product.category,
    hsn: product.hsn,
    qtyMethod: product.qtyMethod,
    unit: product.unit,
    ratePerUnit: String(product.ratePerUnit),
    baseRate: opt(product.baseRate),
    minRate: opt(product.minRate),
    gstRate: String(product.gstRate),
    thicknessMm: opt('thicknessMm' in product ? product.thicknessMm : undefined),
    coilWidthM: opt('coilWidthM' in product ? product.coilWidthM : undefined),
    densityFactor: opt('densityFactor' in product ? product.densityFactor : undefined, '7.968'),
    kgPerMetre: opt('kgPerMetre' in product ? product.kgPerMetre : undefined),
    kgPerPiece: opt('kgPerPiece' in product ? product.kgPerPiece : undefined),
    widthFactor: opt('widthFactor' in product ? product.widthFactor : undefined, '1.08'),
    steelShape: ('steelShape' in product && product.steelShape) || 'CHART',
    steelDims:
      'steelDims' in product && product.steelDims
        ? Object.fromEntries(
            Object.entries(product.steelDims).map(([k, v]) => [k, v === undefined ? '' : String(v)])
          )
        : {},
    defaultLengthM: opt('defaultLengthM' in product ? product.defaultLengthM : undefined, '6'),
    active: product.active,
  };
}

/** The unit that goes with each calculation method. */
export function unitForMethod(method: QuantityMethod): ProductUnit {
  if (method === 'PIECE' || method === 'CUSTOM' || method === 'MANUAL') return 'Nos';
  if (method === 'AREA' || method === 'SQM') return 'Sq.Mtr';
  if (method === 'RUNNING_LENGTH') return 'R.Mtr';
  if (method === 'LENGTH_FT') return 'Ft';
  return 'Kgs';
}

/** Live kg/m from the IS formula for the steel shape in the form (null if not applicable). */
export function computeFormSteelKgPerMetre(formData: ProductFormData): number | null {
  if (formData.qtyMethod !== 'SECTION_WEIGHT' || formData.steelShape === 'CHART') return null;
  return calculateSteelKgPerMetre(formData.steelShape, parseSteelDims(formData.steelDims));
}

/** Returns field → message; empty when the form is valid. */
export function validateProductForm(formData: ProductFormData): Record<string, string> {
  const errors: Record<string, string> = {};
  const computedSteelKgPerMetre = computeFormSteelKgPerMetre(formData);

  if (!formData.name.trim()) errors.name = 'Product name is required';
  if (!formData.hsn.trim()) errors.hsn = 'HSN code is required';

  try {
    if (!formData.ratePerUnit || formData.ratePerUnit.trim() === '') {
      errors.ratePerUnit = 'Rate per unit is required';
    } else {
      const rateDec = new Decimal(formData.ratePerUnit);
      if (rateDec.lte(0) || !rateDec.isFinite()) errors.ratePerUnit = 'Rate per unit must be greater than 0';
    }
  } catch {
    errors.ratePerUnit = 'Invalid numeric rate';
  }

  try {
    if (formData.gstRate.trim() === '') {
      errors.gstRate = 'GST rate is required';
    } else {
      const gstDec = new Decimal(formData.gstRate);
      if (gstDec.lt(0) || !gstDec.isFinite()) errors.gstRate = 'GST rate cannot be negative';
    }
  } catch {
    errors.gstRate = 'Invalid numeric GST percentage';
  }

  const positive = (value: string, field: string, missing: string, notPositive: string, invalid: string) => {
    try {
      if (!value || value.trim() === '') {
        errors[field] = missing;
      } else {
        const d = new Decimal(value);
        if (d.lte(0) || !d.isFinite()) errors[field] = notPositive;
      }
    } catch {
      errors[field] = invalid;
    }
  };

  const checkDefaultLength = () => {
    const len = Number(formData.defaultLengthM);
    if (formData.defaultLengthM.trim() !== '' && (!isFinite(len) || len <= 0)) {
      errors.defaultLengthM = 'Default length must be greater than 0 m';
    }
  };

  if (formData.qtyMethod === 'WEIGHT_PER_PIECE') {
    positive(formData.kgPerPiece, 'kgPerPiece', 'Kg per piece is required for structural calculation',
      'Kg per piece must be greater than 0', 'Invalid kg per piece number');
  } else if (formData.qtyMethod === 'SHEET_WEIGHT') {
    positive(formData.thicknessMm, 'thicknessMm', 'Thickness is required for sheet calculation',
      'Thickness must be greater than 0 mm', 'Invalid thickness number');
    positive(formData.coilWidthM, 'coilWidthM', 'Coil width is required for sheet calculation',
      'Coil width must be greater than 0 m', 'Invalid coil width number');
  } else if (formData.qtyMethod === 'SECTION_WEIGHT' && formData.steelShape !== 'CHART') {
    if (computedSteelKgPerMetre === null) {
      errors.steelDims = 'Enter valid dimensions — weight per metre could not be calculated';
    }
    checkDefaultLength();
  } else if (formData.qtyMethod === 'SECTION_WEIGHT') {
    checkDefaultLength();
    positive(formData.kgPerMetre, 'kgPerMetre', 'Weight per metre is required for pipe calculation',
      'Weight per metre must be greater than 0 kg/m', 'Invalid weight per metre number');
  }

  if ((formData.qtyMethod === 'MANUAL' || formData.qtyMethod === 'CUSTOM') && !String(formData.unit || '').trim()) {
    errors.unit = 'Enter a unit, e.g. Nos, Set, Lot';
  }

  for (const field of ['baseRate', 'minRate'] as const) {
    if (formData[field].trim() !== '') {
      try {
        if (new Decimal(formData[field]).lt(0)) {
          errors[field] = `${field === 'baseRate' ? 'Base' : 'Min'} rate cannot be negative`;
        }
      } catch {
        errors[field] = `Invalid ${field === 'baseRate' ? 'base' : 'min'} rate number`;
      }
    }
  }

  return errors;
}

/** Builds the product record from a valid form. */
export function buildProductPayload(formData: ProductFormData): CreateProductInput {
  const computedSteelKgPerMetre = computeFormSteelKgPerMetre(formData);
  const basePayload = {
    name: formData.name.trim(),
    category: formData.category.trim(),
    hsn: formData.hsn.trim(),
    ratePerUnit: new Decimal(formData.ratePerUnit).toNumber(),
    gstRate: new Decimal(formData.gstRate).toNumber(),
    unit: String(formData.unit || '').trim() || 'Nos',
    active: formData.active,
    baseRate: formData.baseRate.trim() ? new Decimal(formData.baseRate).toNumber() : undefined,
    minRate: formData.minRate.trim() ? new Decimal(formData.minRate).toNumber() : undefined,
  };

  if (formData.qtyMethod === 'SQM') {
    return {
      ...basePayload,
      qtyMethod: 'SQM',
      unit: 'Sq.Mtr',
      widthFactor: formData.widthFactor.trim() ? new Decimal(formData.widthFactor).toNumber() : 1.08,
      stockMethod: 'PIECE',
    };
  }
  if (formData.qtyMethod === 'WEIGHT_PER_PIECE') {
    return {
      ...basePayload,
      qtyMethod: 'WEIGHT_PER_PIECE',
      unit: 'Kgs',
      kgPerPiece: formData.kgPerPiece.trim() ? new Decimal(formData.kgPerPiece).toNumber() : 0,
      stockMethod: 'WEIGHT',
    };
  }
  if (formData.qtyMethod === 'SHEET_WEIGHT') {
    return {
      ...basePayload,
      qtyMethod: 'SHEET_WEIGHT',
      thicknessMm: new Decimal(formData.thicknessMm).toNumber(),
      coilWidthM: new Decimal(formData.coilWidthM).toNumber(),
      densityFactor: formData.densityFactor.trim() ? new Decimal(formData.densityFactor).toNumber() : 7.968,
      stockMethod: 'WEIGHT',
    };
  }
  if (formData.qtyMethod === 'SECTION_WEIGHT') {
    const isFormulaShape = formData.steelShape !== 'CHART';
    const dims = parseSteelDims(formData.steelDims);
    return {
      ...basePayload,
      qtyMethod: 'SECTION_WEIGHT',
      unit: 'Kgs',
      kgPerMetre: isFormulaShape && computedSteelKgPerMetre !== null
        ? computedSteelKgPerMetre
        : new Decimal(formData.kgPerMetre).toNumber(),
      steelShape: formData.steelShape,
      steelDims: isFormulaShape ? dims : {},
      thicknessMm: isFormulaShape ? dims.thicknessMm : undefined,
      defaultLengthM: formData.defaultLengthM.trim() ? Number(formData.defaultLengthM) : 6,
      stockMethod: 'WEIGHT',
    };
  }
  if (formData.qtyMethod === 'PIECE') {
    return { ...basePayload, qtyMethod: 'PIECE', stockMethod: 'PIECE' };
  }
  return { ...basePayload, qtyMethod: formData.qtyMethod, stockMethod: 'NONE' } as CreateProductInput;
}

/**
 * A product that lives only on one quotation (not saved to the Products list).
 * The id must not start with "custom_": that prefix marks the old simple custom lines.
 */
export function oneOffProduct(payload: CreateProductInput): Product {
  const id = `oneoff_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  return { ...payload, id } as Product;
}
