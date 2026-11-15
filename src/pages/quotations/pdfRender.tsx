/**
 * Loaded on demand (dynamic import) so the ~1.5 MB PDF engine is not part of the initial app bundle.
 */
import { pdf } from '@react-pdf/renderer';
import type { Quotation } from '../../types/quotation';
import { QuotationPdfDocument } from './QuotationPdfDocument';

export async function renderQuotationPdfBlob(quotation: Quotation): Promise<Blob> {
  return pdf(<QuotationPdfDocument quotation={quotation} />).toBlob();
}
