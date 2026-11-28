import type { QuotationLine } from '../types/quotation';
import { formatKgPerMetre } from '../engine/steel';

/** A steel (by-weight) line where the salesperson typed the kg instead of a number of lengths. */
export function isSteelByKg(line: Pick<QuotationLine, 'isManualQuantity' | 'snapshot'>): boolean {
  return line.snapshot.qtyMethod === 'SECTION_WEIGHT' && Boolean(line.isManualQuantity);
}

/** Roughly how many bar lengths a kg figure works out to (1 decimal), or null if unknown. */
export function approxLengths(kg: number, kgPerLength: number): number | null {
  if (!(kg > 0) || !(kgPerLength > 0)) return null;
  return Math.round((kg / kgPerLength) * 10) / 10;
}

/** Description under the product name for a steel line, e.g. "6m × 3 nos · 11.672 kg/m". */
export function describeSteelLine(line: QuotationLine, sep = '·'): string {
  const len =
    line.lengthValue !== undefined && line.lengthValue !== null && line.lengthUnit
      ? `${line.lengthValue} ${line.lengthUnit}`
      : line.lengthFeet !== undefined && line.lengthFeet !== null
        ? `${line.lengthFeet}'${line.lengthInches ? ` ${line.lengthInches}"` : ''}`
        : `${line.lengthM || 0}m`;
  const kgm = `${formatKgPerMetre(line.snapshot.kgPerMetre)} kg/m`;
  if (isSteelByKg(line)) {
    const n = approxLengths(Number(line.quantity), Number(line.perPieceQuantity));
    return n !== null ? `By weight ${sep} ≈ ${n} lengths of ${len} ${sep} ${kgm}` : `By weight ${sep} ${kgm}`;
  }
  return `${len} × ${line.nos} nos ${sep} ${kgm}`;
}
