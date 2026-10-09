import Decimal from 'decimal.js';
import type { QuantityMethod } from '../types/product';
import { DEFAULT_DENSITY_FACTOR } from './constants';
import { toMetres, type LengthInput } from './length';

export interface QuantityCalculationParams {
  method: QuantityMethod;
  length?: LengthInput;
  nos?: number | string | Decimal;
  // Sheet specific
  coilWidthM?: number | string | Decimal;
  thicknessMm?: number | string | Decimal;
  densityFactor?: number | string | Decimal;
  // Section / Pipe specific
  kgPerMetre?: number | string | Decimal;
  // Manual override
  isManual?: boolean;
  manualQuantity?: number | string | Decimal;
}

export interface QuantityResult {
  perPieceQuantity: Decimal;
  lineQuantity: Decimal;
  isManual: boolean;
  unit: 'Kgs' | 'Nos' | 'Sq.Mtr' | 'R.Mtr' | 'Ft';
}

/**
 * Calculates per-piece quantity based on product geometry and method.
 * Rounded half-up to 2 decimals per specification §5.5 and BR-04.
 */
export function calculatePerPieceQuantity(params: QuantityCalculationParams): Decimal {
  const { method } = params;

  switch (method) {
    case 'SHEET_WEIGHT': {
      const coilWidth = new Decimal(params.coilWidthM || 0);
      const thickness = new Decimal(params.thicknessMm || 0);
      const density = new Decimal(params.densityFactor || DEFAULT_DENSITY_FACTOR);
      const lengthM = toMetres(params.length || {});

      if (coilWidth.lte(0) || thickness.lte(0) || lengthM.lte(0) || density.lte(0)) {
        return new Decimal(0);
      }

      // Formula: coilWidthM × lengthM × thicknessMm × densityFactor
      const rawWeight = coilWidth.times(lengthM).times(thickness).times(density);
      return rawWeight.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    }

    case 'SECTION_WEIGHT': {
      const kgPerM = new Decimal(params.kgPerMetre || 0);
      const lengthM = toMetres(params.length || {});

      if (kgPerM.lte(0) || lengthM.lte(0)) {
        return new Decimal(0);
      }

      // Formula: lengthM × kgPerMetre
      const rawWeight = lengthM.times(kgPerM);
      return rawWeight.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    }

    case 'AREA': {
      const width = new Decimal(params.coilWidthM || 0);
      const lengthM = toMetres(params.length || {});
      if (width.lte(0) || lengthM.lte(0)) {
        return new Decimal(0);
      }
      const rawArea = width.times(lengthM);
      return rawArea.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    }

    case 'RUNNING_LENGTH': {
      const lengthM = toMetres(params.length || {});
      if (lengthM.lte(0)) {
        return new Decimal(0);
      }
      return lengthM.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    }

    case 'LENGTH_FT': {
      const len = params.length || {};
      const f = new Decimal(len.feet || 0);
      const i = new Decimal(len.inches || 0);
      if (f.isNegative() || i.isNegative() || (f.isZero() && i.isZero())) {
        return new Decimal(0);
      }
      return f.plus(i.dividedBy(12)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    }

    case 'PIECE':
    default:
      return new Decimal(1);
  }
}

/**
 * Calculates total line quantity with manual override support.
 * Line quantity is calculated as: perPieceQuantity × nos (rounded to 2 decimal places).
 */
export function calculateLineQuantity(params: QuantityCalculationParams): QuantityResult {
  const perPiece = calculatePerPieceQuantity(params);
  const rawNos = params.nos !== undefined && params.nos !== null ? new Decimal(params.nos) : new Decimal(1);
  const nos = rawNos.isNegative() ? new Decimal(0) : rawNos;

  let defaultUnit: QuantityResult['unit'] = 'Kgs';
  if (params.method === 'PIECE') {
    defaultUnit = 'Nos';
  } else if (params.method === 'AREA') {
    defaultUnit = 'Sq.Mtr';
  } else if (params.method === 'RUNNING_LENGTH') {
    defaultUnit = 'R.Mtr';
  } else if (params.method === 'LENGTH_FT') {
    defaultUnit = 'Ft';
  }

  if (params.isManual && params.manualQuantity !== undefined && params.manualQuantity !== null && params.manualQuantity !== '') {
    const rawManual = new Decimal(params.manualQuantity);
    const manualQty = (rawManual.isNegative() ? new Decimal(0) : rawManual).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    return {
      perPieceQuantity: perPiece,
      lineQuantity: manualQty,
      isManual: true,
      unit: defaultUnit,
    };
  }

  // Auto derivation: roundedPerPiece × nos, to 2 decimals (BR-04)
  const lineQty = perPiece.times(nos).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return {
    perPieceQuantity: perPiece,
    lineQuantity: lineQty,
    isManual: false,
    unit: defaultUnit,
  };
}
