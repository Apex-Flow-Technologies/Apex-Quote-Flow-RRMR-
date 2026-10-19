import Decimal from 'decimal.js';

export interface LineMoneyCalculationParams {
  quantity: number | string | Decimal;
  unroundedQuantity?: number | string | Decimal;
  rate: number | string | Decimal;
  discountPct?: number | string | Decimal;
  discountAmount?: number | string | Decimal;
}

export interface LineMoneyResult {
  grossAmount: Decimal;
  unroundedGrossAmount: Decimal;
  discountAmount: Decimal;
  unroundedDiscountAmount: Decimal;
  taxableAmount: Decimal;
  unroundedTaxableAmount: Decimal;
}

/**
 * Calculates line gross amount, discount, and taxable amount.
 * Retains full precision internally for aggregation while rounding to 2 decimals for display.
 */
export function calculateLineAmounts(params: LineMoneyCalculationParams): LineMoneyResult {
  const rate = new Decimal(params.rate || 0);
  const exactQty = params.unroundedQuantity !== undefined && params.unroundedQuantity !== null && params.unroundedQuantity !== ''
    ? new Decimal(params.unroundedQuantity)
    : new Decimal(params.quantity || 0);

  const exactGross = exactQty.times(rate);
  const gross = exactGross.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  let exactDiscount = new Decimal(0);
  if (params.discountPct !== undefined && params.discountPct !== null && params.discountPct !== '') {
    const pct = new Decimal(params.discountPct);
    if (pct.isPositive()) {
      exactDiscount = exactGross.times(pct).dividedBy(100);
    }
  } else if (params.discountAmount !== undefined && params.discountAmount !== null && params.discountAmount !== '') {
    const dAmt = new Decimal(params.discountAmount);
    if (dAmt.isPositive()) {
      exactDiscount = dAmt;
    }
  }

  // Ensure discount is non-negative and does not exceed gross amount
  if (exactDiscount.isNegative()) {
    exactDiscount = new Decimal(0);
  } else if (exactDiscount.greaterThan(exactGross)) {
    exactDiscount = exactGross;
  }

  const discount = exactDiscount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const exactTaxable = exactGross.minus(exactDiscount);
  const taxable = exactTaxable.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return {
    grossAmount: gross,
    unroundedGrossAmount: exactGross,
    discountAmount: discount,
    unroundedDiscountAmount: exactDiscount,
    taxableAmount: taxable,
    unroundedTaxableAmount: exactTaxable,
  };
}


/**
 * Formats round-off amount according to standard Indian financial presentation.
 * Displays negative as -₹0.36, positive as +₹0.04, and zero as ₹0.00.
 */
export function formatRoundOff(roundOff?: number | string | Decimal): string {
  const dec = new Decimal(roundOff || 0).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  if (dec.isZero()) {
    return '₹0.00';
  }
  if (dec.isNegative()) {
    return `-₹${dec.abs().toFixed(2)}`;
  }
  return `+₹${dec.toFixed(2)}`;
}
