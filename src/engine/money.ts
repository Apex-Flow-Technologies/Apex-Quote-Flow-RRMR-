import Decimal from 'decimal.js';

export interface LineMoneyCalculationParams {
  quantity: number | string | Decimal;
  rate: number | string | Decimal;
  discountPct?: number | string | Decimal;
  discountAmount?: number | string | Decimal;
}

export interface LineMoneyResult {
  grossAmount: Decimal;
  discountAmount: Decimal;
  taxableAmount: Decimal;
}

/**
 * Calculates line gross amount, discount, and taxable amount.
 * All steps use Decimal and round half-up to 2 decimals per §5.4 and §5.5.
 */
export function calculateLineAmounts(params: LineMoneyCalculationParams): LineMoneyResult {
  const qty = new Decimal(params.quantity || 0);
  const rate = new Decimal(params.rate || 0);

  const gross = qty.times(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  let discount = new Decimal(0);
  if (params.discountPct !== undefined && params.discountPct !== null && params.discountPct !== '') {
    const pct = new Decimal(params.discountPct);
    if (pct.isPositive()) {
      discount = gross.times(pct).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    }
  } else if (params.discountAmount !== undefined && params.discountAmount !== null && params.discountAmount !== '') {
    const dAmt = new Decimal(params.discountAmount);
    if (dAmt.isPositive()) {
      discount = dAmt.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    }
  }

  // Ensure discount is non-negative and does not exceed gross amount
  if (discount.isNegative()) {
    discount = new Decimal(0);
  } else if (discount.greaterThan(gross)) {
    discount = gross;
  }

  const taxable = gross.minus(discount);

  return {
    grossAmount: gross,
    discountAmount: discount,
    taxableAmount: taxable,
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
