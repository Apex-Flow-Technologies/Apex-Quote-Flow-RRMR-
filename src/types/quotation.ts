import type { QuantityMethod, ProductUnit } from './product';
import type { CompanySettings } from './settings';

export interface QuotationLineSnapshot {
  productId: string;
  productName: string;
  category: string;
  hsn: string;
  qtyMethod: QuantityMethod;
  unit: ProductUnit;
  // Specific geometry preserved at time of quote
  thicknessMm?: number;
  coilWidthM?: number;
  coverWidthM?: number;
  widthFactor?: number;
  kgPerMetre?: number;
  kgPerPiece?: number;
  densityFactor?: number;
  feetToMetre?: number;
  rate: number;
  gstRate: number; // e.g. 18
}

export interface QuotationLine {
  id: string;
  // Preserved product snapshot
  snapshot: QuotationLineSnapshot;
  // Dimensions for this quote line
  lengthFeet?: number;
  lengthInches?: number;
  lengthM?: number;
  lengthValue?: number;
  lengthUnit?: 'ft' | 'in' | 'mm' | 'm';
  widthFactor?: number;
  kgPerPiece?: number;
  nos: number;
  // Calculated vs Manual state
  perPieceQuantity: number;
  quantity: number;
  unroundedQuantity?: number;
  isManualQuantity: boolean;
  manualQuantity?: number;
  // Financial breakdown
  discountPct?: number;
  discountAmount?: number;
  taxableAmount: number;
  unroundedTaxableAmount?: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
  // Convenience top-level mirror fields for fast table rendering
  productName: string;
  hsn: string;
  unit: ProductUnit;
  rate: number;
  gstRate: number;
  /** Sheet colour typed on the quote line (free text). */
  colour?: string;
}

export interface QuotationCustomerSnapshot {
  id?: string;
  name: string;
  gstin?: string;
  stateCode?: string;
  phone?: string;
  address?: string;
}

export interface TaxGroupSummary {
  hsn: string;
  gstRate: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTax: number;
}

export type QuotationStatus = 'draft' | 'sent' | 'won' | 'lost' | 'cancelled';

export const QUOTATION_STATUS_LABELS: Record<QuotationStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  won: 'Won',
  lost: 'Lost',
  cancelled: 'Cancelled',
};

export interface Quotation {
  id: string;
  quotationNumber: string; // e.g., RR/QT/26-27/0001
  revision: number; // default 1, +1 on every revise (same quotation number)
  status?: QuotationStatus; // default 'draft' (older quotes have none → treated as draft)
  statusUpdatedAt?: string | number | Record<string, unknown>;
  statusUpdatedBy?: string;
  revisedAt?: string | number | Record<string, unknown>;
  revisedByName?: string;
  quotationDate?: string; // e.g., "2026-10-08"
  customer: QuotationCustomerSnapshot;
  company?: CompanySettings;
  lines: QuotationLine[];
  taxMode: 'intra' | 'inter'; // 'intra' -> CGST+SGST, 'inter' -> IGST
  widthFactor?: number; // per-quotation width factor (defaults to 1.08)
  feetToMetre?: number; // metric conversion factor (defaults to 0.305)
  isGstEnabled?: boolean; // quotation-level switch for including/excluding GST (default true)
  advanceAmount?: number; // optional advance paid
  balanceDue?: number; // total - advance
  // Physical quantity totals - strictly separated per Sprint 1 & 2 brief
  totalKgs: number;
  totalNos: number;
  totalSqMtr?: number;
  totalRMtr?: number;
  totalFt?: number;
  // Financial totals
  subtotal: number;
  docDiscountAmount?: number;
  taxableValue: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  totalTax: number;
  taxSummary: TaxGroupSummary[];
  grandTotal: number;
  roundOff: number;
  payableAmount: number;
  amountInWords: string;
  // Metadata & Audit
  terms?: string[];
  validUntil?: string;
  createdByUid: string;
  createdByName: string;
  engineVersion?: string;
  createdAt: string | number | Record<string, unknown>;
  updatedAt?: string | number | Record<string, unknown>;
}

export type CreateQuotationInput = Omit<Quotation, 'id' | 'quotationNumber' | 'createdAt' | 'updatedAt'>;
