import Decimal from 'decimal.js';
import { FT_TO_M } from './constants';

export interface LengthInput {
  feet?: number | string | Decimal;
  inches?: number | string | Decimal;
  metres?: number | string | Decimal;
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
 * Converts length (feet + inches OR direct metres) into exact Decimal metres.
 * Formula: lengthFt * 0.3048
 * Per BR-02: intermediate values are NEVER rounded.
 */
export function toMetres(input: LengthInput): Decimal {
  if (input.metres !== undefined && input.metres !== null && input.metres !== '') {
    const m = new Decimal(input.metres);
    return m.isNegative() ? new Decimal(0) : m;
  }

  const lengthFt = normalizeFeetAndInches(input.feet, input.inches);
  return lengthFt.times(FT_TO_M);
}
