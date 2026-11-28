import { describe, it, expect } from 'vitest';
import {
  createInitialRow,
  computeRowCalculation,
  rowFromSavedLine,
  legacyLengthToFeetInches,
  lineLengthText,
} from '../components/quotations/quotationRows';
import type { Product } from '../types/product';

const sqm = { id: 'q1', name: 'CRIMP 8+1', category: 'Crimp', hsn: '72109090', qtyMethod: 'SQM', unit: 'Sq.Mtr', ratePerUnit: 420, gstRate: 18, active: true, widthFactor: 1.08 } as Product;

describe('Sq.Mtr lines take feet + inches', () => {
  it('17 ft 4 in × 10 at width 1.06', () => {
    const row = { ...createInitialRow('a', sqm), lengthFeet: '17', lengthInches: '4', nos: '10' };
    const { calculatedLine, validationError } = computeRowCalculation(row, 'intra', 1.06, 0.305);
    expect(validationError).toBeNull();
    // (17 + 4/12) ft × 0.305 = 5.28666… m; × 1.06 = 5.6038… ; × 10 = 56.04
    expect(calculatedLine!.quantity).toBe(56.04);
    expect(lineLengthText(calculatedLine!)).toBe('17 ft 4 in');
  });

  it('inches only is a valid length', () => {
    const row = { ...createInitialRow('b', sqm), lengthFeet: '', lengthInches: '9' };
    expect(computeRowCalculation(row, 'intra', 1.06, 0.305).validationError).toBeNull();
  });

  it('zero length is rejected', () => {
    const row = { ...createInitialRow('c', sqm), lengthFeet: '0', lengthInches: '0' };
    expect(computeRowCalculation(row, 'intra', 1.06, 0.305).validationError).toBe('Length must be greater than 0.');
  });

  it('old saved lines (one value + unit) revise to the same quantity', () => {
    for (const [value, unit] of [['17.4', 'ft'], ['210', 'in'], ['5.3', 'm'], ['5300', 'mm']] as const) {
      const old = { ...createInitialRow('d', sqm), lengthValue: value, lengthUnit: unit, nos: '10' };
      const line = computeRowCalculation(old, 'intra', 1.06, 0.305).calculatedLine!;
      const again = computeRowCalculation(rowFromSavedLine(line), 'intra', 1.06, 0.305).calculatedLine!;
      expect(again.quantity, `${value} ${unit}`).toBe(line.quantity);
    }
  });

  it('splits old values into feet + inches', () => {
    expect(legacyLengthToFeetInches(17.4, 'ft')).toEqual({ feet: '17', inches: '4.8' });
    expect(legacyLengthToFeetInches(210, 'in')).toEqual({ feet: '17', inches: '6' });
  });
});

import { migrateDraftRow } from '../utils/quoteDraft';

describe('Drafts saved before feet + inches', () => {
  it('a 17.4 ft draft line reopens as 17 ft 4.8 in and prices the same', () => {
    const old = { ...createInitialRow('d1', sqm), lengthValue: '17.4', lengthUnit: 'ft' as const, nos: '10' };
    const before = computeRowCalculation(old, 'intra', 1.06, 0.305).calculatedLine!;
    const migrated = migrateDraftRow(old);
    expect(migrated.lengthFeet).toBe('17');
    expect(migrated.lengthInches).toBe('4.8');
    expect(migrated.lengthValue).toBe('');
    const after = computeRowCalculation(migrated, 'intra', 1.06, 0.305).calculatedLine!;
    expect(after.quantity).toBe(before.quantity);
  });
});
