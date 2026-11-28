import { describe, it, expect } from 'vitest';
import {
  calculateSteelKgPerMetre,
  calculateQuotationLine,
  defaultLengthForShape,
  formatSteelSize,
} from '../engine';
import type { QuotationLineSnapshot } from '../types/quotation';

describe('Steel kg/m — same formulas as maiak-m.bg', () => {
  it('round tube: (OD − t) × t × 0.024649', () => {
    expect(calculateSteelKgPerMetre('ROUND_PIPE', { odMm: 48.3, thicknessMm: 3.2 })).toBe(3.557);
    // maiak-m.bg shows 0.95 for 21.3 × 2
    expect(calculateSteelKgPerMetre('ROUND_PIPE', { odMm: 21.3, thicknessMm: 2 })).toBeCloseTo(0.95, 2);
  });

  it('square tube: t × (0.0314 × A − 0.044877 × t)', () => {
    expect(calculateSteelKgPerMetre('SQUARE_PIPE', { sideMm: 60, thicknessMm: 3.2 })).toBe(5.569);
    expect(calculateSteelKgPerMetre('SQUARE_PIPE', { sideMm: 25, thicknessMm: 1.6 })).toBe(1.141);
    // maiak-m.bg default example: 15 × 1.5 → 0.61 kg/m
    expect(calculateSteelKgPerMetre('SQUARE_PIPE', { sideMm: 15, thicknessMm: 1.5 })).toBeCloseTo(0.61, 2);
  });

  it('rectangular pipe (RHS) equals square pipe when B = H', () => {
    expect(calculateSteelKgPerMetre('RECT_PIPE', { widthMm: 60, heightMm: 60, thicknessMm: 3.2 })).toBe(
      calculateSteelKgPerMetre('SQUARE_PIPE', { sideMm: 60, thicknessMm: 3.2 })
    );
    // same perimeter as 60 × 60 → same weight
    expect(calculateSteelKgPerMetre('RECT_PIPE', { widthMm: 80, heightMm: 40, thicknessMm: 3.2 })).toBe(5.569);
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

  it('round bar d² × 0.0061654, square bar a² × 0.00785', () => {
    expect(calculateSteelKgPerMetre('ROUND_BAR', { diameterMm: 12 })).toBe(0.888);
    expect(calculateSteelKgPerMetre('ROUND_BAR', { diameterMm: 25 })).toBe(3.853);
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

  it('6 m × 10 nos of 60×60×3.2 → 334.14 kg (rounded once)', () => {
    const kgm = calculateSteelKgPerMetre('SQUARE_PIPE', { sideMm: 60, thicknessMm: 3.2 })!;
    const line = calculateQuotationLine({ snapshot: snapshot(kgm), length: { metres: 6 }, nos: 10 }, 'intra');
    expect(line.unit).toBe('Kgs');
    expect(line.perPieceQuantity).toBe(33.41);
    expect(line.quantity).toBe(334.14);
    expect(line.taxableAmount).toBeCloseTo(334.14 * 68, 2);
  });

  it('chequered plate 1250 × 5 at 2.5 m × 4 nos → plate kg = L × W × t × 7.85', () => {
    const kgm = calculateSteelKgPerMetre('CHEQUERED_PLATE', { widthMm: 1250, thicknessMm: 5 })!;
    const line = calculateQuotationLine({ snapshot: snapshot(kgm), length: { metres: 2.5 }, nos: 4 }, 'intra');
    // 2.5 × 1.25 × 5 × 7.85 = 122.66 kg per plate
    expect(line.perPieceQuantity).toBeCloseTo(122.66, 2);
    expect(line.quantity).toBeCloseTo(490.63, 2);
  });
});
