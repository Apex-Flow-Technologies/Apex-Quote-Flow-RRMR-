import { describe, it, expect } from 'vitest';
import {
  createInitialRow,
  createCustomRow,
  computeRowCalculation,
  rowFromSavedLine,
  type EditableRowState,
} from '../components/quotations/EditableQuotationTable';
import type { Product } from '../types/product';

const sheet = { id: 's1', name: 'JSW COLOURON 0.47', category: 'Coloron', hsn: '72109090', qtyMethod: 'SHEET_WEIGHT', unit: 'Kgs', ratePerUnit: 114, gstRate: 18, active: true, thicknessMm: 0.47, coilWidthM: 1.06 } as Product;
const sqm = { id: 'q1', name: 'CRIMP 8+1', category: 'Crimp', hsn: '72109090', qtyMethod: 'SQM', unit: 'Sq.Mtr', ratePerUnit: 450, gstRate: 18, active: true, widthFactor: 1.08 } as Product;
const pipe = { id: 'p1', name: 'MS Square Pipe 60 × 60 × 3.2 mm', category: 'Pipe', hsn: '73066100', qtyMethod: 'SECTION_WEIGHT', unit: 'Kgs', ratePerUnit: 68, gstRate: 18, active: true, kgPerMetre: 5.5 } as Product;
const piece = { id: 'n1', name: 'SCREW 55MM', category: 'Screw', hsn: '73181400', qtyMethod: 'PIECE', unit: 'Nos', ratePerUnit: 4, gstRate: 18, active: true } as Product;

const calc = (r: EditableRowState) => ({ ...r, ...computeRowCalculation(r, 'intra', 1.08, 0.305) });

describe('Revise / duplicate: saved line → editable row → same line', () => {
  const cases: [string, EditableRowState][] = [
    ['sheet 12ft 6in × 11', { ...createInitialRow('a', sheet), lengthFeet: '12', lengthInches: '6', nos: '11' }],
    ['sqm 17.4 ft × 10 with 5% discount', { ...createInitialRow('b', sqm), lengthValue: '17.4', lengthUnit: 'ft', nos: '10', discountPct: '5' }],
    ['pipe 5.5 m × 4, rate edited', { ...createInitialRow('c', pipe), lengthMetres: '5.5', nos: '4', rate: '71.5' }],
    ['pipe in ft/in', { ...createInitialRow('d', pipe), lengthUnit: 'ft_in', lengthFeet: '20', lengthInches: '0', nos: '2' }],
    ['piece × 250', { ...createInitialRow('e', piece), nos: '250' }],
    ['manual override', { ...createInitialRow('f', sheet), nos: '3', isManualQuantity: true, manualQuantity: '31.5' }],
    ['custom item', { ...createCustomRow('Transport charges', '1500', '1', 'Nos'), id: 'g' }],
  ];

  for (const [label, row] of cases) {
    it(label, () => {
      const original = calc(row).calculatedLine!;
      expect(original).toBeTruthy();
      const rebuilt = calc(rowFromSavedLine(original)).calculatedLine!;
      expect(rebuilt).toBeTruthy();
      expect(rebuilt.quantity).toBe(original.quantity);
      expect(rebuilt.unit).toBe(original.unit);
      expect(rebuilt.rate).toBe(original.rate);
      expect(rebuilt.taxableAmount).toBe(original.taxableAmount);
      expect(rebuilt.totalAmount).toBe(original.totalAmount);
      expect(rebuilt.productName).toBe(original.productName);
    });
  }
});
