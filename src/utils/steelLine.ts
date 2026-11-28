import type { QuotationLine } from '../types/quotation';
import { weightRateText, sheetCutPerSheet, isSheetCut } from '../components/quotations/steelSize';

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
  const kgm = weightRateText(line.snapshot.steelShape, line.snapshot.kgPerMetre, line.snapshot.steelSizeDims);
  if (isSteelByKg(line)) {
    const n = approxLengths(Number(line.quantity), Number(line.perPieceQuantity));
    return n !== null ? `By weight ${sep} ≈ ${n} lengths of ${len} ${sep} ${kgm}` : `By weight ${sep} ${kgm}`;
  }
  return `${len} × ${line.nos} nos ${sep} ${kgm}`;
}

/** Flashing cut from sheets, e.g. "10 pcs · 4 per 48 in sheet = 3 sheets" (null for other lines). Plain characters only: the PDF font has no arrows. */
export function describeFlashingLine(line: QuotationLine, sep = '·'): string | null {
  const dims = line.snapshot.steelSizeDims;
  if (!isSheetCut(line.snapshot.steelShape) || !dims?.pcs) return null;
  const width = Number(dims.sheet || 48);
  const cut = sheetCutPerSheet({ ...dims, sheet: String(width) });
  if ('error' in cut) return null;
  const sheets = Number(line.nos);
  return `${dims.pcs} pcs ${sep} ${cut.perSheet} per ${width} in sheet = ${sheets} sheet${sheets === 1 ? '' : 's'}`;
}
