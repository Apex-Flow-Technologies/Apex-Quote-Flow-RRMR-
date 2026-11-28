import { describe, it, expect } from 'vitest';
import { parseSteelSize } from '../components/quotations/steelSize';
import { createSteelSizeRow, applySteelSize, computeRowCalculation, rowFromSavedLine } from '../components/quotations/quotationRows';

const sq = (text: string) => parseSteelSize({ shape: 'SQUARE_PIPE', text });

describe('Steel by size: square pipe', () => {
  it('reads the size however it is typed', () => {
    for (const t of ['40x40x1.3', '40 x 40 x 1.3', '40X40X1.3', '40×40×1.3', '40*40*1.3', '40x1.3']) {
      const r = sq(t);
      expect(r.ok, t).toBe(true);
      if (r.ok) {
        expect(r.kgPerMetre, t).toBe(1.546);
        expect(r.name, t).toBe('MS Square Pipe 40 × 40 × 1.3 mm');
      }
    }
  });

  it('matches the IS weight for 60 × 60 × 3.2', () => {
    const r = sq('60x60x3.2');
    expect(r.ok && r.kgPerMetre).toBe(5.5);
  });

  it('explains what is wrong', () => {
    expect(sq('').ok).toBe(false);
    const notSquare = sq('50x25x2');
    expect(!notSquare.ok && notSquare.error).toMatch(/not square/);
    const tooThick = sq('40x40x25');
    expect(!tooThick.ok && tooThick.error).toMatch(/too large/);
    const letters = sq('40xabc');
    expect(!letters.ok && letters.error).toMatch(/numbers/);
  });

  it('6 m × 10 lengths of 40 × 40 × 1.3 at ₹70/kg', () => {
    const row = applySteelSize({ ...createSteelSizeRow(), id: 'r1', steelSize: { shape: 'SQUARE_PIPE', text: '40x40x1.3' }, nos: '10', rate: '70' });
    const { calculatedLine, validationError } = computeRowCalculation(row, 'intra', 1.06, 0.305);
    expect(validationError).toBeNull();
    // weight per length 6 × 1.546 = 9.276 → 9.28 kg; × 10 = 92.8 kg
    expect(calculatedLine!.perPieceQuantity).toBe(9.28);
    expect(calculatedLine!.quantity).toBe(92.8);
    expect(calculatedLine!.taxableAmount).toBe(6496);
    expect(calculatedLine!.productName).toBe('MS Square Pipe 40 × 40 × 1.3 mm');
    expect(calculatedLine!.snapshot.steelSizeText).toBe('40x40x1.3');
  });

  it('a line with no size yet asks for one', () => {
    const row = applySteelSize({ ...createSteelSizeRow(), id: 'r2' });
    const res = computeRowCalculation(row, 'intra', 1.06, 0.305);
    expect(res.calculatedLine).toBeNull();
    expect(res.validationError).toMatch(/Type the size/);
  });

  it('revise brings the typed size back with the same amount', () => {
    const row = applySteelSize({ ...createSteelSizeRow(), id: 'r3', steelSize: { shape: 'SQUARE_PIPE', text: '50x50x2.6' }, nos: '4', rate: '68' });
    const line = computeRowCalculation(row, 'intra', 1.06, 0.305).calculatedLine!;
    const back = rowFromSavedLine(line);
    expect(back.steelSize).toEqual({ shape: 'SQUARE_PIPE', text: '50x50x2.6' });
    const again = computeRowCalculation(back, 'intra', 1.06, 0.305).calculatedLine!;
    expect(again.quantity).toBe(line.quantity);
    expect(again.taxableAmount).toBe(line.taxableAmount);
  });
});
