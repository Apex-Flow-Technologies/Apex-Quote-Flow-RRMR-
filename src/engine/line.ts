import Decimal from 'decimal.js';
import type { QuotationLine, QuotationLineSnapshot } from '../types/quotation';
import { toMetres, type LengthInput } from './length';
import { calculateLineQuantity } from './quantity';
import { calculateLineAmounts } from './money';
import { calculateTaxForGroup, type TaxMode } from './tax';

export interface LineBuilderInput {
  id?: string;
  snapshot: QuotationLineSnapshot;
  length?: LengthInput;
  nos: number | string | Decimal;
  isManualQuantity?: boolean;
  manualQuantity?: number | string | Decimal;
  customRate?: number | string | Decimal;
  discountPct?: number | string | Decimal;
  discountAmount?: number | string | Decimal;
}

/**
 * Derives a full QuotationLine from a snapshot and dimension/quantity inputs.
 */
export function calculateQuotationLine(
  input: LineBuilderInput,
  taxMode: TaxMode
): QuotationLine {
  const { snapshot } = input;
  const nosDecimal = new Decimal(input.nos || 1);
  const rateDecimal = input.customRate !== undefined && input.customRate !== null && input.customRate !== ''
    ? new Decimal(input.customRate)
    : new Decimal(snapshot.rate);

  const lengthM = toMetres(input.length || {});

  const qtyResult = calculateLineQuantity({
    method: snapshot.qtyMethod,
    length: input.length,
    nos: nosDecimal,
    coilWidthM: snapshot.coilWidthM,
    thicknessMm: snapshot.thicknessMm,
    densityFactor: snapshot.densityFactor,
    kgPerMetre: snapshot.kgPerMetre,
    isManual: Boolean(input.isManualQuantity),
    manualQuantity: input.manualQuantity,
  });

  const moneyResult = calculateLineAmounts({
    quantity: qtyResult.lineQuantity,
    rate: rateDecimal,
    discountPct: input.discountPct,
    discountAmount: input.discountAmount,
  });

  const taxResult = calculateTaxForGroup(moneyResult.taxableAmount, snapshot.gstRate, taxMode);
  const totalAmount = moneyResult.taxableAmount.plus(taxResult.totalTax);

  return {
    id: input.id || `line_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    snapshot,
    lengthFeet: input.length?.feet !== undefined ? Number(input.length.feet) : undefined,
    lengthInches: input.length?.inches !== undefined ? Number(input.length.inches) : undefined,
    lengthM: lengthM.toNumber(),
    nos: nosDecimal.toNumber(),
    perPieceQuantity: qtyResult.perPieceQuantity.toNumber(),
    quantity: qtyResult.lineQuantity.toNumber(),
    isManualQuantity: qtyResult.isManual,
    manualQuantity: input.manualQuantity !== undefined ? Number(input.manualQuantity) : undefined,
    discountPct: input.discountPct !== undefined ? Number(input.discountPct) : undefined,
    discountAmount: moneyResult.discountAmount.toNumber(),
    taxableAmount: moneyResult.taxableAmount.toNumber(),
    cgstAmount: taxResult.cgstAmount.toNumber(),
    sgstAmount: taxResult.sgstAmount.toNumber(),
    igstAmount: taxResult.igstAmount.toNumber(),
    totalAmount: totalAmount.toNumber(),
    // Mirror fields
    productName: snapshot.productName,
    hsn: snapshot.hsn,
    unit: snapshot.unit,
    rate: rateDecimal.toNumber(),
    gstRate: snapshot.gstRate,
  };
}

/**
 * Recalculates tax components for an existing QuotationLine when taxMode changes
 * (e.g., when the customer is selected, switched, or removed).
 * Returns a new QuotationLine without mutating the original object.
 */
export function recalculateLineTax(
  line: QuotationLine,
  taxMode: TaxMode
): QuotationLine {
  const taxResult = calculateTaxForGroup(line.taxableAmount, line.snapshot.gstRate, taxMode);
  const totalAmount = new Decimal(line.taxableAmount).plus(taxResult.totalTax);

  return {
    ...line,
    cgstAmount: taxResult.cgstAmount.toNumber(),
    sgstAmount: taxResult.sgstAmount.toNumber(),
    igstAmount: taxResult.igstAmount.toNumber(),
    totalAmount: totalAmount.toNumber(),
  };
}

export interface LineValidationInput {
  product?: {
    id: string;
    name: string;
    qtyMethod: string;
    ratePerUnit: number;
    unit: string;
  } | null;
  rate?: number | string | Decimal;
  nos?: number | string | Decimal;
  lengthUnit?: 'ft_in' | 'metres';
  lengthFeet?: number | string | Decimal;
  lengthInches?: number | string | Decimal;
  lengthMetres?: number | string | Decimal;
  isManualQuantity?: boolean;
  manualQuantity?: number | string | Decimal;
  discountPct?: number | string | Decimal;
  discountAmount?: number | string | Decimal;
  calculatedQuantity?: number | string | Decimal;
}

export interface LineValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates quotation line inputs before draft addition or update.
 * Prevents invalid, negative, missing, non-numeric, or zero-dimension/quantity lines.
 */
export function validateLineDraft(params: LineValidationInput): LineValidationResult {
  if (!params.product) {
    return { isValid: false, error: 'Please select a product first.' };
  }

  // Rate validation
  if (
    params.rate === undefined ||
    params.rate === null ||
    (typeof params.rate === 'string' && params.rate.trim() === '')
  ) {
    return { isValid: false, error: 'Rate must be greater than 0.' };
  }
  try {
    const rateDec = new Decimal(params.rate);
    if (rateDec.lte(0)) {
      return { isValid: false, error: 'Rate must be greater than 0.' };
    }
  } catch {
    return { isValid: false, error: 'Please enter valid numeric values.' };
  }

  // Nos validation
  if (
    params.nos === undefined ||
    params.nos === null ||
    (typeof params.nos === 'string' && params.nos.trim() === '')
  ) {
    return { isValid: false, error: 'Nos must be at least 1.' };
  }
  try {
    const nosDec = new Decimal(params.nos);
    if (nosDec.lte(0)) {
      return { isValid: false, error: 'Nos must be at least 1.' };
    }
  } catch {
    return { isValid: false, error: 'Please enter valid numeric values.' };
  }

  // Dimension validation for dimension-dependent products
  const method = params.product.qtyMethod;
  if (method === 'SHEET_WEIGHT' || (method === 'SECTION_WEIGHT' && params.lengthUnit === 'ft_in')) {
    const fRaw = params.lengthFeet;
    const iRaw = params.lengthInches;
    if (
      (fRaw === undefined || fRaw === null || (typeof fRaw === 'string' && fRaw.trim() === '')) &&
      (iRaw === undefined || iRaw === null || (typeof iRaw === 'string' && iRaw.trim() === ''))
    ) {
      return { isValid: false, error: 'Length must be greater than 0.' };
    }
    const fStr = typeof fRaw === 'string' ? fRaw.trim() : (fRaw !== undefined && fRaw !== null ? String(fRaw) : '0');
    const iStr = typeof iRaw === 'string' ? iRaw.trim() : (iRaw !== undefined && iRaw !== null ? String(iRaw) : '0');

    try {
      const feetDec = new Decimal(fStr === '' ? 0 : fStr);
      const inchesDec = new Decimal(iStr === '' ? 0 : iStr);
      if (feetDec.isNegative() || inchesDec.isNegative()) {
        return { isValid: false, error: 'Length dimensions cannot be negative.' };
      }
      if (feetDec.isZero() && inchesDec.isZero()) {
        return { isValid: false, error: 'Length must be greater than 0.' };
      }
    } catch {
      return { isValid: false, error: 'Please enter valid numeric values.' };
    }
  } else if (method === 'SECTION_WEIGHT' && params.lengthUnit === 'metres') {
    const mRaw = params.lengthMetres;
    if (mRaw === undefined || mRaw === null || (typeof mRaw === 'string' && mRaw.trim() === '')) {
      return { isValid: false, error: 'Length in metres must be greater than 0.' };
    }
    try {
      const metresDec = new Decimal(mRaw);
      if (metresDec.lte(0)) {
        return { isValid: false, error: 'Length in metres must be greater than 0.' };
      }
    } catch {
      return { isValid: false, error: 'Please enter valid numeric values.' };
    }
  }

  // Discount validation
  if (
    params.discountAmount !== undefined &&
    params.discountAmount !== null &&
    (typeof params.discountAmount !== 'string' || params.discountAmount.trim() !== '')
  ) {
    try {
      const discDec = new Decimal(params.discountAmount);
      if (discDec.isNegative()) {
        return { isValid: false, error: 'Discount cannot be negative.' };
      }
    } catch {
      return { isValid: false, error: 'Please enter valid numeric values.' };
    }
  }

  if (
    params.discountPct !== undefined &&
    params.discountPct !== null &&
    (typeof params.discountPct !== 'string' || params.discountPct.trim() !== '')
  ) {
    try {
      const pctDec = new Decimal(params.discountPct);
      if (pctDec.isNegative()) {
        return { isValid: false, error: 'Discount percentage cannot be negative.' };
      }
    } catch {
      return { isValid: false, error: 'Please enter valid numeric values.' };
    }
  }

  // Manual quantity validation
  if (params.isManualQuantity) {
    if (
      params.manualQuantity === undefined ||
      params.manualQuantity === null ||
      (typeof params.manualQuantity === 'string' && params.manualQuantity.trim() === '')
    ) {
      return { isValid: false, error: 'Manual quantity must be greater than 0.' };
    }
    try {
      const manualDec = new Decimal(params.manualQuantity);
      if (manualDec.lte(0)) {
        return { isValid: false, error: 'Manual quantity must be greater than 0.' };
      }
    } catch {
      return { isValid: false, error: 'Please enter valid numeric values.' };
    }
  }

  // Calculated quantity guard (prevents zero-quantity lines)
  if (params.calculatedQuantity !== undefined && params.calculatedQuantity !== null) {
    try {
      const qtyDec = new Decimal(params.calculatedQuantity);
      if (qtyDec.lte(0)) {
        return { isValid: false, error: 'Line quantity must be greater than 0.' };
      }
    } catch {
      return { isValid: false, error: 'Line quantity must be greater than 0.' };
    }
  }

  return { isValid: true };
}
