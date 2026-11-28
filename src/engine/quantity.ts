import Decimal from 'decimal.js';
import type { QuantityMethod, ProductUnit } from '../types/product';
import { DEFAULT_DENSITY_FACTOR, DEFAULT_FEET_TO_METRE, DEFAULT_WIDTH_FACTOR } from './constants';
import { toMetres, convertLengthToMetres, type LengthInput, type LengthUnit } from './length';

export interface QuantityCalculationParams {
  method: QuantityMethod;
  length?: LengthInput;
  nos?: number | string | Decimal;
  // Sprint 2 SQM parameters
  lengthValue?: number | string | Decimal;
  lengthUnit?: LengthUnit;
  widthFactor?: number | string | Decimal;
  feetToMetre?: number | string | Decimal;
  // Sprint 2 Structural steel parameters
  kgPerPiece?: number | string | Decimal;
  // Custom item unit
  customUnit?: ProductUnit;
  // Sheet specific (legacy)
  coilWidthM?: number | string | Decimal;
  thicknessMm?: number | string | Decimal;
  densityFactor?: number | string | Decimal;
  // Section / Pipe specific (legacy)
  kgPerMetre?: number | string | Decimal;
  // Manual override
  isManual?: boolean;
  manualQuantity?: number | string | Decimal;
}

export interface QuantityResult {
  perPieceQuantity: Decimal;
  unroundedPerPieceQuantity: Decimal;
  lineQuantity: Decimal;
  unroundedLineQuantity: Decimal;
  isManual: boolean;
  unit: ProductUnit;
}

/**
 * Calculates per-piece quantity based on product geometry and method.
 */
export function calculatePerPieceQuantity(params: QuantityCalculationParams): Decimal {
  const { method } = params;

  switch (method) {
    case 'SQM': {
      let lengthM: Decimal;
      if (params.lengthValue !== undefined && params.lengthValue !== null && params.lengthValue !== '' && params.lengthUnit) {
        lengthM = convertLengthToMetres(params.lengthValue, params.lengthUnit, params.feetToMetre || DEFAULT_FEET_TO_METRE);
      } else {
        lengthM = toMetres(params.length || {}, params.feetToMetre || DEFAULT_FEET_TO_METRE);
      }
      const width = new Decimal(params.widthFactor ?? DEFAULT_WIDTH_FACTOR);
      if (lengthM.lte(0) || width.lte(0)) {
        return new Decimal(0);
      }
      return lengthM.times(width);
    }

    case 'WEIGHT_PER_PIECE': {
      const kg = new Decimal(params.kgPerPiece || 0);
      return kg.isNegative() ? new Decimal(0) : kg;
    }

    case 'SHEET_WEIGHT': {
      const coilWidth = new Decimal(params.coilWidthM || 0);
      const thickness = new Decimal(params.thicknessMm || 0);
      const density = new Decimal(params.densityFactor || DEFAULT_DENSITY_FACTOR);
      const lengthM = toMetres(params.length || {}, params.feetToMetre || undefined);

      if (coilWidth.lte(0) || thickness.lte(0) || lengthM.lte(0) || density.lte(0)) {
        return new Decimal(0);
      }

      // Formula: coilWidthM × lengthM × thicknessMm × densityFactor
      const rawWeight = coilWidth.times(lengthM).times(thickness).times(density);
      return rawWeight.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    }

    case 'SECTION_WEIGHT': {
      const kgPerM = new Decimal(params.kgPerMetre || 0);
      const lengthM = toMetres(params.length || {}, params.feetToMetre || undefined);

      if (kgPerM.lte(0) || lengthM.lte(0)) {
        return new Decimal(0);
      }

      // Formula: lengthM × kgPerMetre
      const rawWeight = lengthM.times(kgPerM);
      return rawWeight.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    }

    case 'AREA': {
      const width = new Decimal(params.coilWidthM ?? params.widthFactor ?? 0);
      let lengthM: Decimal;
      if (params.lengthValue !== undefined && params.lengthValue !== null && params.lengthValue !== '' && params.lengthUnit) {
        lengthM = convertLengthToMetres(params.lengthValue, params.lengthUnit, params.feetToMetre || DEFAULT_FEET_TO_METRE);
      } else {
        lengthM = toMetres(params.length || {}, params.feetToMetre || undefined);
      }
      if (width.lte(0) || lengthM.lte(0)) {
        return new Decimal(0);
      }
      const rawArea = width.times(lengthM);
      return rawArea.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    }

    case 'RUNNING_LENGTH': {
      const lengthM = toMetres(params.length || {}, params.feetToMetre || undefined);
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

    case 'CUSTOM':
    case 'PIECE':
    default:
      return new Decimal(1);
  }
}

/**
 * Calculates total line quantity with manual override support.
 * Keeps full unrounded precision for aggregation while providing 2-decimal rounded values for display.
 */
export function calculateLineQuantity(params: QuantityCalculationParams): QuantityResult {
  const rawNos = params.nos !== undefined && params.nos !== null ? new Decimal(params.nos) : new Decimal(1);
  const nos = rawNos.isNegative() ? new Decimal(0) : rawNos;

  let defaultUnit: ProductUnit = 'Kgs';
  if (params.method === 'SQM' || params.method === 'AREA') {
    defaultUnit = 'Sq.Mtr';
  } else if (params.method === 'WEIGHT_PER_PIECE') {
    defaultUnit = 'Kgs';
  } else if (params.method === 'PIECE') {
    defaultUnit = 'Nos';
  } else if (params.method === 'CUSTOM' || params.method === 'MANUAL') {
    defaultUnit = params.customUnit || 'Nos';
  } else if (params.method === 'RUNNING_LENGTH') {
    defaultUnit = 'R.Mtr';
  } else if (params.method === 'LENGTH_FT') {
    defaultUnit = 'Ft';
  }

  // Handle manual override
  if (params.isManual && params.manualQuantity !== undefined && params.manualQuantity !== null && params.manualQuantity !== '') {
    const rawManual = new Decimal(params.manualQuantity);
    const manualQty = rawManual.isNegative() ? new Decimal(0) : rawManual;
    const roundedManual = manualQty.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const perPiece = calculatePerPieceQuantity(params);
    return {
      perPieceQuantity: perPiece.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
      unroundedPerPieceQuantity: perPiece,
      lineQuantity: roundedManual,
      unroundedLineQuantity: manualQty,
      isManual: true,
      unit: defaultUnit,
    };
  }

  // Sprint 2 SQM calculation: lengthM × widthFactor × quantity
  if (params.method === 'SQM') {
    let lengthM: Decimal;
    if (params.lengthValue !== undefined && params.lengthValue !== null && params.lengthValue !== '' && params.lengthUnit) {
      lengthM = convertLengthToMetres(params.lengthValue, params.lengthUnit, params.feetToMetre || DEFAULT_FEET_TO_METRE);
    } else {
      lengthM = toMetres(params.length || {}, params.feetToMetre || DEFAULT_FEET_TO_METRE);
    }
    const width = new Decimal(params.widthFactor ?? DEFAULT_WIDTH_FACTOR);
    const perPieceArea = lengthM.times(width);
    const totalArea = perPieceArea.times(nos);

    return {
      perPieceQuantity: perPieceArea.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
      unroundedPerPieceQuantity: perPieceArea,
      lineQuantity: totalArea.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
      unroundedLineQuantity: totalArea,
      isManual: false,
      unit: 'Sq.Mtr',
    };
  }

  // Sprint 2 WEIGHT_PER_PIECE: kgPerPiece × quantity
  if (params.method === 'WEIGHT_PER_PIECE') {
    const kg = new Decimal(params.kgPerPiece || 0);
    const totalKg = kg.times(nos);

    return {
      perPieceQuantity: kg.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
      unroundedPerPieceQuantity: kg,
      lineQuantity: totalKg.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
      unroundedLineQuantity: totalKg,
      isManual: false,
      unit: 'Kgs',
    };
  }

  // Steel by weight: length × kg/m × Nos, rounded once at the end (as RR's reference calculator)
  if (params.method === 'SECTION_WEIGHT') {
    const kgPerM = new Decimal(params.kgPerMetre || 0);
    const lengthM = toMetres(params.length || {}, params.feetToMetre || undefined);
    const perPiece = kgPerM.lte(0) || lengthM.lte(0) ? new Decimal(0) : lengthM.times(kgPerM);
    const total = perPiece.times(nos);
    return {
      perPieceQuantity: perPiece.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
      unroundedPerPieceQuantity: perPiece,
      lineQuantity: total.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
      unroundedLineQuantity: total,
      isManual: false,
      unit: 'Kgs',
    };
  }

  // Sprint 2 PIECE: quantity
  if (params.method === 'PIECE') {
    return {
      perPieceQuantity: new Decimal(1),
      unroundedPerPieceQuantity: new Decimal(1),
      lineQuantity: nos.toDecimalPlaces(0, Decimal.ROUND_HALF_UP),
      unroundedLineQuantity: nos,
      isManual: false,
      unit: 'Nos',
    };
  }

  // CUSTOM / MANUAL: user-entered quantity and unit
  if (params.method === 'CUSTOM' || params.method === 'MANUAL') {
    return {
      perPieceQuantity: new Decimal(1),
      unroundedPerPieceQuantity: new Decimal(1),
      lineQuantity: nos.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
      unroundedLineQuantity: nos,
      isManual: false,
      unit: defaultUnit,
    };
  }

  // Legacy fallback (SHEET_WEIGHT, SECTION_WEIGHT, etc.)
  const perPiece = calculatePerPieceQuantity(params);
  const lineQty = perPiece.times(nos).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return {
    perPieceQuantity: perPiece,
    unroundedPerPieceQuantity: perPiece,
    lineQuantity: lineQty,
    unroundedLineQuantity: perPiece.times(nos),
    isManual: false,
    unit: defaultUnit,
  };
}
