import Decimal from 'decimal.js';
import { TAMIL_NADU_STATE_CODE } from './constants';

export type TaxMode = 'intra' | 'inter';

export interface TaxGroupInput {
  hsn: string;
  gstRate: number | string | Decimal;
  taxableAmount: number | string | Decimal;
}

export interface TaxGroupResult {
  hsn: string;
  gstRate: Decimal;
  taxableAmount: Decimal;
  cgstAmount: Decimal;
  sgstAmount: Decimal;
  igstAmount: Decimal;
  totalTax: Decimal;
}

/**
 * Determines tax mode (intra-state vs inter-state) based on GSTIN state prefixes.
 * Per §5.6: first 2 digits of GSTIN represent state code (33 = Tamil Nadu).
 */
export function determineTaxMode(
  customerGstin?: string,
  companyGstin?: string
): TaxMode {
  if (!customerGstin || customerGstin.trim().length < 2) {
    // Unregistered customer defaults to intra-state per BR-10
    return 'intra';
  }

  const customerClean = customerGstin.trim();

  // Validate that the first 2 characters are numeric digits representing an Indian GSTIN state code
  if (!/^\d{2}/.test(customerClean)) {
    // Non-numeric or descriptive GSTIN values (e.g. "Unregistered", "URP", "N/A") default to intra-state
    return 'intra';
  }

  const customerState = customerClean.slice(0, 2);

  const companyClean = companyGstin ? companyGstin.trim() : '';
  const companyState = companyClean.length >= 2 && /^\d{2}/.test(companyClean)
    ? companyClean.slice(0, 2)
    : TAMIL_NADU_STATE_CODE;

  return customerState === companyState ? 'intra' : 'inter';
}

/**
 * Calculates tax for a specific (HSN, GST Rate) group.
 * Tax is computed per group and rounded half-up to 2 decimals per §5.5 and BR-08.
 */
export function calculateTaxForGroup(
  taxableAmount: number | string | Decimal,
  gstRate: number | string | Decimal,
  taxMode: TaxMode
): TaxGroupResult {
  const taxable = new Decimal(taxableAmount || 0);
  const rate = new Decimal(gstRate || 0);

  if (taxable.isZero() || rate.isZero()) {
    return {
      hsn: '',
      gstRate: rate,
      taxableAmount: taxable,
      cgstAmount: new Decimal(0),
      sgstAmount: new Decimal(0),
      igstAmount: new Decimal(0),
      totalTax: new Decimal(0),
    };
  }

  if (taxMode === 'intra') {
    const halfRate = rate.dividedBy(2);
    // CGST = taxable * (gstRate / 2 / 100)
    const cgst = taxable.times(halfRate).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    // SGST = taxable * (gstRate / 2 / 100)
    const sgst = taxable.times(halfRate).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const totalTax = cgst.plus(sgst);

    return {
      hsn: '',
      gstRate: rate,
      taxableAmount: taxable,
      cgstAmount: cgst,
      sgstAmount: sgst,
      igstAmount: new Decimal(0),
      totalTax,
    };
  } else {
    // IGST = taxable * (gstRate / 100)
    const igst = taxable.times(rate).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    return {
      hsn: '',
      gstRate: rate,
      taxableAmount: taxable,
      cgstAmount: new Decimal(0),
      sgstAmount: new Decimal(0),
      igstAmount: igst,
      totalTax: igst,
    };
  }
}
