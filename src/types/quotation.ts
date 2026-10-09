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
  kgPerMetre?: number;
  densityFactor?: number;
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
  nos: number;
  // Calculated vs Manual state
  perPieceQuantity: number;
  quantity: number;
  isManualQuantity: boolean;
  manualQuantity?: number;
  // Financial breakdown
  discountPct?: number;
  discountAmount?: number;
  taxableAmount: number;
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

export interface Quotation {
  id: string;
  quotationNumber: string; // e.g., RR/QT/26-27/0001
  revision: number; // default 1
  quotationDate?: string; // e.g., "2026-10-08"
  customer: QuotationCustomerSnapshot;
  company?: CompanySettings;
  lines: QuotationLine[];
  taxMode: 'intra' | 'inter'; // 'intra' -> CGST+SGST, 'inter' -> IGST
  // Physical quantity totals - strictly separated per Sprint 1 brief
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
