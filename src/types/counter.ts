export interface QuotationCounter {
  next: number;
  financialYear: string; // e.g., '26-27'
  prefix: string; // e.g., 'RR/QT'
  updatedAt?: string | number | Record<string, unknown>;
}
