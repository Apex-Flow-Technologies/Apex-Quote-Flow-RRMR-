import { describe, it, expect } from 'vitest';
import { parseSteelSize, legacySteelSizeDims, STEEL_SIZE_KINDS, STEEL_SIZE_KIND_ORDER, type SteelSizeKind } from '../components/quotations/steelSize';
import { createSteelSizeRow, applySteelSize, computeRowCalculation, rowFromSavedLine } from '../components/quotations/quotationRows';

const kg = (shape: SteelSizeKind, dims: Record<string, string>) => {
  const r = parseSteelSize({ shape, dims });
  if (!r.ok) throw new Error(`${shape}: ${r.error}`);
  return r;
};

describe('Steel by size: weight per metre for each type', () => {
  const cases: [SteelSizeKind, Record<string, string>, number, string][] = [
    ['SQUARE_PIPE', { a: '40', t: '1.3' }, 1.546, 'MS Square Pipe 40 × 40 × 1.3 mm'],
    ['SQUARE_PIPE', { a: '60', t: '3.2' }, 5.5, 'MS Square Pipe 60 × 60 × 3.2 mm'],
    ['RECT_PIPE', { a: '80', b: '40', t: '3' }, 5.187, 'MS Rectangular Pipe 80 × 40 × 3 mm'],
    ['ROUND_PIPE', { d: '21.3', t: '2' }, 0.952, 'MS Round Pipe 21.3 OD × 2 mm'], // Maiak-M shows 0.95
    ['PLATE', { t: '5', w: '1250' }, 49.063, 'MS Plate 5 mm (1250 wide)'],
    ['CHEQUERED_PLATE', { t: '6', w: '1250' }, 65.375, 'Chequered Plate 6 mm (1250 wide)'], // RR card 52.3 kg/m²
    ['CHEQUERED_PLATE', { t: '8', w: '1250' }, 78.5, 'Chequered Plate 8 mm (1250 wide)'], // not on the card: formula
    ['ROUND_BAR', { d: '16' }, 1.58, 'MS Round Bar 16 mm'],
    ['SQUARE_BAR', { a: '12' }, 1.13, 'MS Square Bar 12 mm'],
    ['FLAT', { w: '50', t: '6' }, 2.355, 'MS Flat 50 × 6 mm'],
    ['EQUAL_ANGLE', { a: '50', t: '6' }, 4.5, 'MS Angle 50 × 50 × 6 mm'], // RR card
    ['EQUAL_ANGLE', { a: '55', t: '5' }, 4.121, 'MS Angle 55 × 55 × 5 mm'], // formula
    ['UNEQUAL_ANGLE', { a: '75', b: '50', t: '6' }, 5.605, 'MS Angle 75 × 50 × 6 mm'],
    ['CHANNEL', { size: '100x50' }, 9.6, 'MS Channel ISMC 100 × 50'],
    ['BEAM', { size: '200x100' }, 25.9, 'MS Beam ISMB 200 × 100'],
  ];
  for (const [shape, dims, kgm, name] of cases) {
    it(`${shape} ${JSON.stringify(dims)}`, () => {
      const r = kg(shape, dims);
      expect(r.kgPerMetre).toBe(kgm);
      expect(r.name).toBe(name);
    });
  }

  it('every type in the picker has boxes and a formula', () => {
    expect(STEEL_SIZE_KIND_ORDER).toHaveLength(Object.keys(STEEL_SIZE_KINDS).length);
    for (const k of STEEL_SIZE_KIND_ORDER) expect(STEEL_SIZE_KINDS[k].fields.length).toBeGreaterThan(0);
  });
});

describe('Steel by size: mistakes are explained', () => {
  it('empty boxes ask for the sizes (not shown as an error)', () => {
    const r = parseSteelSize({ shape: 'RECT_PIPE', dims: { a: '80' } });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.missing).toBe(true);
      expect(r.error).toBe('Enter height, thickness.');
    }
  });
  it('impossible sizes', () => {
    const pipe = parseSteelSize({ shape: 'ROUND_PIPE', dims: { d: '10', t: '6' } });
    expect(!pipe.ok && pipe.error).toMatch(/too large/);
    const angle = parseSteelSize({ shape: 'EQUAL_ANGLE', dims: { a: '40', t: '40' } });
    expect(!angle.ok && angle.error).toMatch(/less than the side/);
    const neg = parseSteelSize({ shape: 'FLAT', dims: { w: '-5', t: '6' } });
    expect(!neg.ok && neg.error).toMatch(/greater than 0/);
  });
});

describe('Steel by size: on a quote line', () => {
  it('6 m × 10 lengths of 40 × 40 × 1.3 at ₹70/kg', () => {
    const row = applySteelSize({ ...createSteelSizeRow(), id: 'r1', steelSize: { shape: 'SQUARE_PIPE', dims: { a: '40', t: '1.3' } }, nos: '10', rate: '70' });
    const { calculatedLine, validationError } = computeRowCalculation(row, 'intra', 1.06, 0.305);
    expect(validationError).toBeNull();
    // weight per length 6 × 1.546 = 9.276 → 9.28 kg; × 10 = 92.8 kg
    expect(calculatedLine!.quantity).toBe(92.8);
    expect(calculatedLine!.taxableAmount).toBe(6496);
    expect(calculatedLine!.snapshot.steelSizeDims).toEqual({ a: '40', t: '1.3' });
  });

  it('a plate line starts at 2.5 m', () => {
    expect(createSteelSizeRow('PLATE').lengthMetres).toBe('2.5');
  });

  it('revise brings the boxes back with the same amount', () => {
    const row = applySteelSize({ ...createSteelSizeRow('RECT_PIPE'), id: 'r3', steelSize: { shape: 'RECT_PIPE', dims: { a: '80', b: '40', t: '3' } }, nos: '4', rate: '68' });
    const line = computeRowCalculation(row, 'intra', 1.06, 0.305).calculatedLine!;
    const back = rowFromSavedLine(line);
    expect(back.steelSize).toEqual({ shape: 'RECT_PIPE', dims: { a: '80', b: '40', t: '3' } });
    const again = computeRowCalculation(back, 'intra', 1.06, 0.305).calculatedLine!;
    expect(again.quantity).toBe(line.quantity);
    expect(again.taxableAmount).toBe(line.taxableAmount);
  });

  it('older single-box lines open in separate boxes', () => {
    expect(legacySteelSizeDims('SQUARE_PIPE', '40x40x1.3')).toEqual({ a: '40', t: '1.3' });
    expect(legacySteelSizeDims('SQUARE_PIPE', '40 x 1.3')).toEqual({ a: '40', t: '1.3' });
  });
});
