import Decimal from 'decimal.js';
import { FT_TO_M, DEFAULT_FEET_TO_METRE } from './constants';

export type LengthUnit = 'ft' | 'in' | 'mm' | 'm';

export interface LengthInput {
  feet?: number | string | Decimal;
  inches?: number | string | Decimal;
  metres?: number | string | Decimal;
  value?: number | string | Decimal;
  unit?: LengthUnit;
}

/**
 * Normalizes length in feet and inches into total Decimal feet.
 * Formula: feet + (inches / 12)
 */
export function normalizeFeetAndInches(
  feet?: number | string | Decimal,
  inches?: number | string | Decimal
): Decimal {
  const f = feet ? new Decimal(feet) : new Decimal(0);
  const i = inches ? new Decimal(inches) : new Decimal(0);

  if (f.isNegative() || i.isNegative() || (f.isZero() && i.isZero())) {
    return new Decimal(0);
  }

  return f.plus(i.dividedBy(12));
}

/**
 * Converts length with unit (ft, in, mm, m) into exact Decimal metres.
 * Formulas per Sprint 2 Brief:
 * - Feet: length × feetToMetre (defaults to 0.305)
 * - Inches: (length / 12) × feetToMetre
 * - Millimetres: length / 1000
 * - Metres: length
 * All intermediate values maintain arbitrary precision (never rounded prematurely).
 */
export function convertLengthToMetres(
  length: number | string | Decimal,
  unit: LengthUnit = 'ft',
  feetToMetre: number | string | Decimal = DEFAULT_FEET_TO_METRE
): Decimal {
  const len = new Decimal(length || 0);
  if (len.lte(0)) {
    return new Decimal(0);
  }

  const factor = new Decimal(feetToMetre || DEFAULT_FEET_TO_METRE);

  switch (unit) {
    case 'ft':
      return len.times(factor);
    case 'in':
      return len.dividedBy(12).times(factor);
    case 'mm':
      return len.dividedBy(1000);
    case 'm':
      return len;
    default:
      return len.times(factor);
  }
}

/**
 * Converts length (feet + inches OR direct metres OR single value+unit) into exact Decimal metres.
 * Formula: lengthFt * (feetToMetre || 0.3048)
 * Per BR-02: intermediate values are NEVER rounded.
 */
export function toMetres(
  input: LengthInput,
  feetToMetre?: number | string | Decimal
): Decimal {
  if (input.value !== undefined && input.value !== null && input.value !== '' && input.unit) {
    return convertLengthToMetres(input.value, input.unit, feetToMetre || DEFAULT_FEET_TO_METRE);
  }

  if (input.metres !== undefined && input.metres !== null && input.metres !== '') {
    const m = new Decimal(input.metres);
    return m.isNegative() ? new Decimal(0) : m;
  }

  const conversionFactor = feetToMetre ? new Decimal(feetToMetre) : FT_TO_M;
  const lengthFt = normalizeFeetAndInches(input.feet, input.inches);
  return lengthFt.times(conversionFactor);
}
