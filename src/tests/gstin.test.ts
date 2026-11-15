import { describe, it, expect } from 'vitest';
import { validateGstin, gstinChecksumChar } from '../engine/gstin';

describe('GSTIN validation', () => {
  it('accepts valid GSTINs (published examples)', () => {
    expect(validateGstin('27AAPFU0939F1ZV').valid).toBe(true); // GSTN sample
    expect(validateGstin('29AAGCB7383J1Z4').valid).toBe(true);
    expect(validateGstin('  27aapfu0939f1zv ').valid).toBe(true); // trimmed, case-insensitive
    expect(validateGstin('27AAPFU0939F1ZV').stateCode).toBe('27');
  });

  it('blank is allowed (unregistered buyer)', () => {
    expect(validateGstin('').valid).toBe(true);
    expect(validateGstin(undefined).valid).toBe(true);
  });

  it('rejects bad length, state code, format and check digit', () => {
    expect(validateGstin('27AAPFU0939F1Z').error).toMatch(/15 characters/);
    expect(validateGstin('3AAADDSFJJDCDFS').error).toMatch(/state code/);
    expect(validateGstin('45AAPFU0939F1ZV').error).toMatch(/not a valid GST state code/);
    expect(validateGstin('33XXXXX0000X1ZX').error).toMatch(/check digit/);
    expect(validateGstin('27AAPFU0939F1ZA').error).toMatch(/check digit/);
    expect(validateGstin('27AAPF00939F1ZV').error).toMatch(/format/);
  });

  it('checksum helper', () => {
    expect(gstinChecksumChar('27AAPFU0939F1Z')).toBe('V');
  });
});
