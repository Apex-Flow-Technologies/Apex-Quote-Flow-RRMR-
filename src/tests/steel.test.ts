import { describe, it, expect } from 'vitest';
import {
  calculateSteelKgPerMetre,
  calculateQuotationLine,
  defaultLengthForShape,
  formatSteelSize,
} from '../engine';
import type { QuotationLineSnapshot } from '../types/quotation';

describe('Steel kg/m — IS formulas vs published charts', () => {
  it('round pipe (CHS): (OD − t) × t × 0.02466', () => {
    expect(calculateSteelKgPerMetre('ROUND_PIPE', { odMm: 48.3, thicknessMm: 3.2 })).toBeCloseTo(3.56, 2);
    expect(calculateSteelKgPerMetre('ROUND_PIPE', { odMm: 33.7, thicknessMm: 2.6 })).toBeCloseTo(1.99, 2);
  });

  it('square pipe (SHS, IS 4923) matches chart within 0.01 kg/m', () => {
    expect(calculateSteelKgPerMetre('SQUARE_PIPE', { sideMm: 60, thicknessMm: 3.2 })).toBeCloseTo(5.5, 2);
    expect(calculateSteelKgPerMetre('SQUARE_PIPE', { sideMm: 150, thicknessMm: 5 })).toBeCloseTo(22.26, 2);
    expect(calculateSteelKgPerMetre('SQUARE_PIPE', { sideMm: 25, thicknessMm: 1.6 })).toBeCloseTo(1.12, 2);
    const kg = calculateSteelKgPerMetre('SQUARE_PIPE', { sideMm: 50, thicknessMm: 2.6 })!;
    expect(Math.abs(kg - 3.74)).toBeLessThanOrEqual(0.011);
  });

  it('rectangular pipe (RHS) equals square pipe when B = H', () => {
    expect(calculateSteelKgPerMetre('RECT_PIPE', { widthMm: 60, heightMm: 60, thicknessMm: 3.2 })).toBe(
      calculateSteelKgPerMetre('SQUARE_PIPE', { sideMm: 60, thicknessMm: 3.2 })
    );
    // 80 × 40 × 3.2 chart ≈ 5.50 kg/m (same perimeter as 60 × 60)
    expect(calculateSteelKgPerMetre('RECT_PIPE', { widthMm: 80, heightMm: 40, thicknessMm: 3.2 })).toBeCloseTo(5.5, 2);
  });

  it('plate / flat: W × t × 0.00785', () => {
    // 1250 mm wide × 5 mm plate → 49.0625 kg/m  (39.25 kg/m²)
    expect(calculateSteelKgPerMetre('PLATE', { widthMm: 1250, thicknessMm: 5 })).toBeCloseTo(49.063, 3);
    expect(calculateSteelKgPerMetre('FLAT', { widthMm: 50, thicknessMm: 6 })).toBeCloseTo(2.355, 3);
  });

  it('chequered plate: plain formula, or chart kg/m² when given', () => {
    expect(calculateSteelKgPerMetre('CHEQUERED_PLATE', { widthMm: 1250, thicknessMm: 5 })).toBeCloseTo(49.063, 3);
    expect(calculateSteelKgPerMetre('CHEQUERED_PLATE', { widthMm: 1250, thicknessMm: 5, kgPerSqm: 42.5 })).toBeCloseTo(53.125, 3);
  });

  it('round bar d² × 0.00617, square bar a² × 0.00785', () => {
    expect(calculateSteelKgPerMetre('ROUND_BAR', { diameterMm: 12 })).toBeCloseTo(0.888, 3);
    expect(calculateSteelKgPerMetre('ROUND_BAR', { diameterMm: 25 })).toBeCloseTo(3.856, 3);
    expect(calculateSteelKgPerMetre('SQUARE_BAR', { sideMm: 20 })).toBeCloseTo(3.14, 3);
  });

  it('rejects missing or impossible dimensions', () => {
    expect(calculateSteelKgPerMetre('ROUND_PIPE', { odMm: 20, thicknessMm: 10 })).toBeNull();
    expect(calculateSteelKgPerMetre('SQUARE_PIPE', { sideMm: 40 })).toBeNull();
    expect(calculateSteelKgPerMetre('PLATE', { widthMm: -5, thicknessMm: 5 })).toBeNull();
    expect(calculateSteelKgPerMetre('CHART', {})).toBeNull();
  });

  it('default lengths: 6 m, chequered plate 2.5 m', () => {
    expect(defaultLengthForShape('SQUARE_PIPE')).toBe(6);
    expect(defaultLengthForShape('CHEQUERED_PLATE')).toBe(2.5);
  });

  it('formats size text', () => {
    expect(formatSteelSize('RECT_PIPE', { widthMm: 80, heightMm: 40, thicknessMm: 3.2 })).toBe('80 × 40 × 3.2');
    expect(formatSteelSize('ROUND_BAR', { diameterMm: 12 })).toBe('Ø12');
  });
});

describe('Steel quotation line — everything billed in Kgs', () => {
  const snapshot = (kgPerMetre: number): QuotationLineSnapshot => ({
    productId: 'p1',
    productName: 'SHS 60 × 60 × 3.2',
    category: 'Pipe',
    hsn: '73066100',
    qtyMethod: 'SECTION_WEIGHT',
    unit: 'Kgs',
    kgPerMetre,
    rate: 68,
    gstRate: 18,
  });

  it('6 m × 10 nos of 60×60×3.2 → 330 kg', () => {
    const kgm = calculateSteelKgPerMetre('SQUARE_PIPE', { sideMm: 60, thicknessMm: 3.2 })!;
    const line = calculateQuotationLine({ snapshot: snapshot(kgm), length: { metres: 6 }, nos: 10 }, 'intra');
    expect(line.unit).toBe('Kgs');
    expect(line.perPieceQuantity).toBeCloseTo(33.0, 2);
    expect(line.quantity).toBeCloseTo(330.0, 1);
    expect(line.taxableAmount).toBeCloseTo(330.0 * 68, 0);
  });

  it('chequered plate 1250 × 5 at 2.5 m × 4 nos → plate kg = L × W × t × 7.85', () => {
    const kgm = calculateSteelKgPerMetre('CHEQUERED_PLATE', { widthMm: 1250, thicknessMm: 5 })!;
    const line = calculateQuotationLine({ snapshot: snapshot(kgm), length: { metres: 2.5 }, nos: 4 }, 'intra');
    // 2.5 × 1.25 × 5 × 7.85 = 122.66 kg per plate
    expect(line.perPieceQuantity).toBeCloseTo(122.66, 2);
    expect(line.quantity).toBeCloseTo(490.64, 2);
  });
});
