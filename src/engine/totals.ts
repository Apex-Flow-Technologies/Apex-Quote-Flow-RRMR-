import Decimal from 'decimal.js';
import type { ProductUnit } from '../types/product';
import type { TaxGroupSummary } from '../types/quotation';
import { calculateTaxForGroup, type TaxMode } from './tax';
import { amountToIndianWords } from './words';

export interface QuotationLineTotalInput {
  hsn: string;
  unit: ProductUnit;
  quantity: number | string | Decimal;
  taxableAmount: number | string | Decimal;
  gstRate: number | string | Decimal;
}

export interface QuotationTotalsResult {
  // Quantities totalled strictly per unit (BR-11, D-03)
  totalKgs: Decimal;
  totalNos: Decimal;
  totalSqMtr: Decimal;
  totalRMtr: Decimal;
  totalFt: Decimal;
  // Financial totals
  subtotal: Decimal;
  cgstTotal: Decimal;
  sgstTotal: Decimal;
  igstTotal: Decimal;
  totalTax: Decimal;
  taxSummary: TaxGroupSummary[];
  grandTotal: Decimal;
  roundOff: Decimal;
  payableAmount: Decimal;
  amountInWords: string;
}

/**
 * Calculates complete quotation document totals:
 * - Quantities grouped strictly by unit (Kgs and Nos never summed)
 * - Taxes grouped by (HSN, rate) and rounded per group
 * - Grand total, whole-rupee round-off, and Indian amount in words
 */
export function calculateQuotationTotals(
  lines: QuotationLineTotalInput[],
  taxMode: TaxMode,
  enableRoundOff = true
): QuotationTotalsResult {
  let totalKgs = new Decimal(0);
  let totalNos = new Decimal(0);
  let totalSqMtr = new Decimal(0);
  let totalRMtr = new Decimal(0);
  let totalFt = new Decimal(0);
  let subtotal = new Decimal(0);

  // Map to group taxable amounts by `hsn_rate`
  const taxGroups = new Map<string, { hsn: string; gstRate: Decimal; taxable: Decimal }>();

  for (const line of lines) {
    const qty = new Decimal(line.quantity || 0);
    const taxable = new Decimal(line.taxableAmount || 0);
    const gstRate = new Decimal(line.gstRate || 0);

    // Sum quantities strictly by unit
    switch (line.unit) {
      case 'Kgs':
        totalKgs = totalKgs.plus(qty);
        break;
      case 'Nos':
        totalNos = totalNos.plus(qty);
        break;
      case 'Sq.Mtr':
        totalSqMtr = totalSqMtr.plus(qty);
        break;
      case 'R.Mtr':
        totalRMtr = totalRMtr.plus(qty);
        break;
      case 'Ft':
        totalFt = totalFt.plus(qty);
        break;
    }

    subtotal = subtotal.plus(taxable);

    // Accumulate tax group
    const groupKey = `${line.hsn || 'DEFAULT'}_${gstRate.toString()}`;
    const existing = taxGroups.get(groupKey);
    if (existing) {
      existing.taxable = existing.taxable.plus(taxable);
    } else {
      taxGroups.set(groupKey, {
        hsn: line.hsn || '',
        gstRate,
        taxable,
      });
    }
  }

  // Calculate tax per group
  let cgstTotal = new Decimal(0);
  let sgstTotal = new Decimal(0);
  let igstTotal = new Decimal(0);
  const taxSummary: TaxGroupSummary[] = [];

  for (const group of taxGroups.values()) {
    const groupTax = calculateTaxForGroup(group.taxable, group.gstRate, taxMode);

    cgstTotal = cgstTotal.plus(groupTax.cgstAmount);
    sgstTotal = sgstTotal.plus(groupTax.sgstAmount);
    igstTotal = igstTotal.plus(groupTax.igstAmount);

    taxSummary.push({
      hsn: group.hsn,
      gstRate: group.gstRate.toNumber(),
      taxableAmount: group.taxable.toNumber(),
      cgstAmount: groupTax.cgstAmount.toNumber(),
      sgstAmount: groupTax.sgstAmount.toNumber(),
      igstAmount: groupTax.igstAmount.toNumber(),
      totalTax: groupTax.totalTax.toNumber(),
    });
  }

  const totalTax = cgstTotal.plus(sgstTotal).plus(igstTotal);
  const grandTotal = subtotal.plus(totalTax);

  let payableAmount = grandTotal;
  let roundOff = new Decimal(0);

  if (enableRoundOff) {
    // Nearest whole rupee
    payableAmount = grandTotal.round();
    roundOff = payableAmount.minus(grandTotal);
  }

  const words = amountToIndianWords(payableAmount);

  return {
    totalKgs: totalKgs.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    totalNos: totalNos.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    totalSqMtr: totalSqMtr.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    totalRMtr: totalRMtr.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    totalFt: totalFt.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    subtotal: subtotal.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    cgstTotal: cgstTotal.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    sgstTotal: sgstTotal.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    igstTotal: igstTotal.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    totalTax: totalTax.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    taxSummary,
    grandTotal: grandTotal.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    roundOff: roundOff.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    payableAmount: payableAmount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    amountInWords: words,
  };
}
