import { describe, it, expect } from 'vitest';
import { financialYearFor, counterDocIdFor } from '../engine/financialYear';

describe('Financial year (April → March)', () => {
  it('splits on 1 April', () => {
    expect(financialYearFor('2027-03-31')).toBe('26-27');
    expect(financialYearFor('2027-04-01')).toBe('27-28');
    expect(financialYearFor('2026-04-01')).toBe('26-27');
    expect(financialYearFor('2026-11-15')).toBe('26-27');
    expect(financialYearFor('2099-12-31')).toBe('99-00');
  });

  it('accepts Date objects', () => {
    expect(financialYearFor(new Date(2027, 0, 10))).toBe('26-27');
    expect(financialYearFor(new Date(2027, 5, 10))).toBe('27-28');
  });

  it('26-27 keeps the original counter document; later years get their own', () => {
    expect(counterDocIdFor('26-27')).toBe('quotation');
    expect(counterDocIdFor('27-28')).toBe('quotation-27-28');
  });
});
