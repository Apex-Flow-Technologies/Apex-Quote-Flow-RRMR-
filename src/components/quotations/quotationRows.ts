/**
 * Quotation line rows: state shape, construction (new / custom / from a saved line)
 * and the per-row calculation. No React — unit-testable on its own.
 */
import type { Product, QuantityMethod, ProductUnit } from '../../types/product';
import type { QuotationLine, QuotationLineSnapshot } from '../../types/quotation';
import { calculateQuotationLine, validateLineDraft, type TaxMode, type LengthUnit } from '../../engine';
import { Decimal } from 'decimal.js';
import { steelSizeProduct, parseSteelSize, legacySteelSizeDims, STEEL_SIZE_KINDS, type SteelSizeInput, type SteelSizeKind } from './steelSize';

export type RowLengthUnit = 'ft_in' | 'metres' | 'ft' | 'in' | 'mm' | 'm';

export interface EditableRowState {
  id: string;
  product: Product | null;
  productSearch: string;
  isProductDropdownOpen: boolean;
  highlightedProductIndex: number;
  isCustomItem?: boolean;
  customDescription?: string;
  customUnit?: ProductUnit;
  customHsn?: string;
  lengthValue?: string;
  lengthFeet: string;
  lengthInches: string;
  lengthMetres: string;
  lengthUnit: RowLengthUnit;
  kgPerPiece?: string;
  nos: string;
  rate: string;
  discountAmount: string;
  discountPct: string;
  isManualQuantity: boolean;
  manualQuantity: string;
  calculatedLine: QuotationLine | null;
  validationError: string | null;
  /** Sheet colour typed on the quote line (free text). */
  colour?: string;
  /** "Steel by size" line: the shape and the size as typed (the product is built from it). */
  steelSize?: SteelSizeInput;
}

/** A new "Steel by size" line: 6 m lengths, size still to be typed. */
export function createSteelSizeRow(shape: SteelSizeKind = 'SQUARE_PIPE'): EditableRowState {
  const base = createInitialRow();
  return { ...base, steelSize: { shape, dims: {} }, lengthUnit: 'metres', lengthMetres: String(STEEL_SIZE_KINDS[shape].defaultLengthM) };
}

/** Rebuilds the line's one-off steel product after the size or shape changes. */
export function applySteelSize(row: EditableRowState): EditableRowState {
  if (!row.steelSize) return row;
  const product = steelSizeProduct(row.steelSize, row.id, row.product?.gstRate ?? 18);
  return { ...row, product, productSearch: product ? product.name : '' };
}

/** Methods whose quantity comes from a feet + inches length on the line. */
export function isLengthMethod(method?: QuantityMethod | string): boolean {
  return method === 'SQM' || method === 'AREA' || method === 'RUNNING_LENGTH' || method === 'LENGTH_FT';
}

/**
 * Quotes saved before Sq.Mtr lines took feet + inches stored one length value with a unit
 * (e.g. 17.4 ft). Split it into feet + inches with the same exact length, so a revise gives
 * the same quantity. Metres / mm go through the company's feet-to-metre factor.
 */
export function legacyLengthToFeetInches(value: number, unit: string | undefined, feetToMetre = 0.305): { feet: string; inches: string } {
  let totalFeet: Decimal;
  const v = new Decimal(value || 0);
  if (unit === 'in') totalFeet = v.dividedBy(12);
  else if (unit === 'm') totalFeet = v.dividedBy(feetToMetre);
  else if (unit === 'mm') totalFeet = v.dividedBy(1000).dividedBy(feetToMetre);
  else totalFeet = v;
  if (totalFeet.lte(0)) return { feet: '0', inches: '0' };
  const feet = totalFeet.floor();
  const inches = totalFeet.minus(feet).times(12).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
  return { feet: feet.toString(), inches: inches.toString() };
}

/** "17 ft 4 in" from a saved line (or the old single value, e.g. "17.4 ft"). */
export function lineLengthText(line: Pick<QuotationLine, 'lengthValue' | 'lengthUnit' | 'lengthFeet' | 'lengthInches'>): string {
  if (line.lengthValue !== undefined && line.lengthValue !== null) return `${line.lengthValue} ${line.lengthUnit || 'ft'}`;
  const inches = Number(line.lengthInches || 0);
  return `${line.lengthFeet || 0} ft${inches ? ` ${inches} in` : ''}`;
}

/** Roofing sheets get a colour box on the quote line. */
export function isSheetLike(product?: Product | null): boolean {
  if (!product) return false;
  return product.qtyMethod === 'SHEET_WEIGHT' || product.qtyMethod === 'SQM' || /sheet/i.test(product.category || '');
}

/** Steel products carry their own default length (6 m, chequered plate 2.5 m). */
export function productDefaultLengthM(product?: Product | null): string | undefined {
  if (product && product.qtyMethod === 'SECTION_WEIGHT' && product.defaultLengthM && product.defaultLengthM > 0) {
    return String(product.defaultLengthM);
  }
  return undefined;
}

/** A missing rate on a freshly picked product is a prompt, not an error. */
export function isRateHint(row: EditableRowState): boolean {
  return row.validationError === 'Rate must be greater than 0.' && (!row.rate || Number(row.rate) === 0);
}

export function createInitialRow(customId?: string, product?: Product): EditableRowState {
  const id = customId || `row_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const defaultRate = product && product.ratePerUnit > 0 ? String(product.ratePerUnit) : '';
  let defaultUnit: RowLengthUnit = 'ft_in';
  if (product?.qtyMethod === 'SECTION_WEIGHT') {
    defaultUnit = 'metres';
  }
  const defaultKgPerPiece = product && 'kgPerPiece' in product && product.kgPerPiece ? String(product.kgPerPiece) : '';

  return {
    id,
    product: product || null,
    productSearch: product ? product.name : '',
    isProductDropdownOpen: false,
    highlightedProductIndex: 0,
    isCustomItem: false,
    customDescription: '',
    customUnit: 'Nos',
    customHsn: '73089090',
    lengthValue: '',
    lengthFeet: '8',
    lengthInches: '0',
    lengthMetres: productDefaultLengthM(product) ?? '6',
    lengthUnit: defaultUnit,
    kgPerPiece: defaultKgPerPiece,
    nos: '1',
    rate: defaultRate,
    discountAmount: '',
    discountPct: '',
    isManualQuantity: false,
    manualQuantity: '',
    calculatedLine: null,
    validationError: null,
  };
}

/**
 * Rebuilds an editable row from a saved quotation line (used by Revise / Duplicate).
 * The product is rebuilt from the line's snapshot, so the quoted geometry and rate are kept
 * even if the product master changed since.
 */
export function rowFromSavedLine(line: QuotationLine): EditableRowState {
  const snap = line.snapshot;
  const str = (v: number | undefined | null, fallback = '') => (v === undefined || v === null ? fallback : String(v));
  const discount = {
    discountPct: line.discountPct ? String(line.discountPct) : '',
    discountAmount: !line.discountPct && line.discountAmount ? String(line.discountAmount) : '',
  };
  const manual = {
    isManualQuantity: Boolean(line.isManualQuantity),
    manualQuantity: line.isManualQuantity ? str(line.manualQuantity ?? line.quantity) : '',
  };

  if (snap.qtyMethod === 'CUSTOM' && snap.productId.startsWith('custom_')) {
    return {
      ...createCustomRow(snap.productName, str(line.rate), str(line.nos, '1'), snap.unit),
      customHsn: snap.hsn,
      ...discount,
      ...manual,
    };
  }

  const product = {
    id: snap.productId,
    name: snap.productName,
    category: snap.category,
    hsn: snap.hsn,
    qtyMethod: snap.qtyMethod,
    unit: snap.unit,
    ratePerUnit: snap.rate,
    gstRate: snap.gstRate,
    active: true,
    thicknessMm: snap.thicknessMm,
    coilWidthM: snap.coilWidthM,
    coverWidthM: snap.coverWidthM,
    widthFactor: snap.widthFactor,
    kgPerMetre: snap.kgPerMetre,
    kgPerPiece: snap.kgPerPiece,
    densityFactor: snap.densityFactor,
  } as unknown as Product;

  const base = createInitialRow(undefined, product);
  let lengthUnit: RowLengthUnit = base.lengthUnit;
  // Old Sq.Mtr lines kept one value + unit; turn it into feet + inches of the same length
  const legacySqm =
    snap.qtyMethod === 'SQM' && line.lengthValue !== undefined && line.lengthValue !== null
      ? legacyLengthToFeetInches(line.lengthValue, line.lengthUnit, snap.feetToMetre || 0.305)
      : null;
  if (snap.qtyMethod === 'SQM') {
    lengthUnit = 'ft_in';
  } else if (snap.qtyMethod === 'SECTION_WEIGHT') {
    lengthUnit = line.lengthFeet !== undefined && line.lengthFeet !== null ? 'ft_in' : 'metres';
  } else if (snap.qtyMethod === 'SHEET_WEIGHT') {
    lengthUnit = 'ft_in';
  }

  return {
    ...base,
    ...(snap.steelShape && (snap.steelSizeDims || snap.steelSizeText)
      ? {
          steelSize: {
            shape: snap.steelShape as SteelSizeKind,
            dims: snap.steelSizeDims ? { ...snap.steelSizeDims } : legacySteelSizeDims(snap.steelShape, snap.steelSizeText || ''),
          },
        }
      : {}),
    colour: line.colour ?? '',
    rate: str(line.rate),
    nos: str(line.nos, '1'),
    lengthUnit,
    lengthValue: '',
    lengthFeet: legacySqm ? legacySqm.feet : str(line.lengthFeet, base.lengthFeet),
    lengthInches: legacySqm ? legacySqm.inches : str(line.lengthInches, '0'),
    lengthMetres: str(line.lengthM, base.lengthMetres),
    kgPerPiece: str(line.kgPerPiece ?? snap.kgPerPiece, base.kgPerPiece),
    ...discount,
    ...manual,
  };
}

export function createCustomRow(description = '', rate = '', nos = '1', unit: ProductUnit = 'Nos'): EditableRowState {
  const id = `row_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  return {
    id,
    product: null,
    productSearch: description,
    isProductDropdownOpen: false,
    highlightedProductIndex: 0,
    isCustomItem: true,
    customDescription: description,
    customUnit: unit,
    customHsn: '73089090',
    lengthValue: '',
    lengthFeet: '0',
    lengthInches: '0',
    lengthMetres: '0',
    lengthUnit: 'ft',
    kgPerPiece: '',
    nos: nos || '1',
    rate: rate || '',
    discountAmount: '',
    discountPct: '',
    isManualQuantity: false,
    manualQuantity: '',
    calculatedLine: null,
    validationError: null,
  };
}

export function computeRowCalculation(
  row: EditableRowState,
  taxMode: TaxMode,
  widthFactor?: number,
  feetToMetre?: number
): { calculatedLine: QuotationLine | null; validationError: string | null } {
  const result = computeRowCalculationInner(row, taxMode, widthFactor, feetToMetre);
  const colour = row.colour?.trim();
  if (result.calculatedLine && colour && isSheetLike(row.product)) {
    return { ...result, calculatedLine: { ...result.calculatedLine, colour } };
  }
  return result;
}

function computeRowCalculationInner(
  row: EditableRowState,
  taxMode: TaxMode,
  widthFactor?: number,
  feetToMetre?: number
): { calculatedLine: QuotationLine | null; validationError: string | null } {
  // 1. Handle Custom Line Item
  if (row.isCustomItem) {
    if (!row.customDescription || row.customDescription.trim() === '') {
      return { calculatedLine: null, validationError: 'Enter custom item description' };
    }
    const nosNum = row.nos.trim() !== '' ? Number(row.nos) : 1;
    if (isNaN(nosNum) || nosNum <= 0) {
      return { calculatedLine: null, validationError: 'Quantity must be greater than 0' };
    }
    let rateNum = 0;
    if (row.rate.trim() !== '') {
      const decRate = new Decimal(row.rate.trim());
      if (decRate.isFinite() && !decRate.isNaN()) {
        rateNum = decRate.toNumber();
      } else {
        return { calculatedLine: null, validationError: 'Invalid rate value' };
      }
    }

    const snapshot: QuotationLineSnapshot = {
      productId: `custom_${row.id}`,
      productName: row.customDescription.trim(),
      category: 'Custom',
      hsn: row.customHsn?.trim() || '73089090',
      qtyMethod: 'CUSTOM',
      unit: row.customUnit || 'Nos',
      rate: rateNum,
      gstRate: 18,
    };

    const calcLine = calculateQuotationLine(
      {
        id: row.id,
        snapshot,
        nos: nosNum,
        customRate: rateNum,
        isManualQuantity: row.isManualQuantity,
        manualQuantity: row.isManualQuantity && row.manualQuantity.trim() !== ''
          ? Number(row.manualQuantity)
          : undefined,
        discountAmount: row.discountAmount.trim() !== '' ? Number(row.discountAmount) : undefined,
        discountPct: row.discountPct.trim() !== '' ? Number(row.discountPct) : undefined,
      },
      taxMode
    );

    return { calculatedLine: calcLine, validationError: null };
  }

  // 2. Handle Catalog Product Line Item
  if (!row.product) {
    if (row.steelSize) {
      const res = parseSteelSize(row.steelSize);
      // Empty boxes are not an error yet; the line shows a hint until the sizes are in
      return { calculatedLine: null, validationError: res.ok || res.missing ? null : res.error };
    }
    return { calculatedLine: null, validationError: null };
  }

  try {
    let rateNum = row.product.ratePerUnit;
    if (row.rate.trim() !== '') {
      const decRate = new Decimal(row.rate.trim());
      if (decRate.isFinite() && !decRate.isNaN()) {
        rateNum = decRate.toNumber();
      } else {
        return { calculatedLine: null, validationError: 'Invalid rate value' };
      }
    }

    const snapshot: QuotationLineSnapshot = {
      productId: row.product.id,
      productName: row.product.name,
      category: row.product.category,
      hsn: row.product.hsn,
      qtyMethod: row.product.qtyMethod as QuantityMethod,
      unit: row.product.unit,
      thicknessMm: 'thicknessMm' in row.product ? row.product.thicknessMm : undefined,
      coilWidthM: 'coilWidthM' in row.product && row.product.coilWidthM ? row.product.coilWidthM : ('coverWidthM' in row.product ? row.product.coverWidthM : undefined),
      coverWidthM: 'coverWidthM' in row.product ? row.product.coverWidthM : undefined,
      kgPerMetre: 'kgPerMetre' in row.product ? row.product.kgPerMetre : undefined,
      kgPerPiece: 'kgPerPiece' in row.product ? row.product.kgPerPiece : undefined,
      densityFactor: 'densityFactor' in row.product ? row.product.densityFactor : undefined,
      rate: rateNum,
      gstRate: row.product.gstRate,
      widthFactor: 'widthFactor' in row.product ? row.product.widthFactor : undefined,
      ...(row.steelSize
        ? {
            steelShape: row.steelSize.shape,
            steelSizeDims: Object.fromEntries(Object.entries(row.steelSize.dims).map(([k, v]) => [k, String(v).trim()])),
          }
        : {}),
    };

    let lengthParam: { feet?: number; inches?: number; metres?: number } = {};
    let lengthVal: number | undefined;
    let lengthU: LengthUnit | undefined;

    if (row.product.qtyMethod === 'SQM') {
      if (row.lengthValue && row.lengthValue.trim() !== '') {
        const parsedVal = Number(row.lengthValue.trim());
        if (!isNaN(parsedVal)) {
          lengthVal = parsedVal;
          lengthU = (['ft', 'in', 'mm', 'm'].includes(row.lengthUnit) ? row.lengthUnit : 'ft') as LengthUnit;
        }
      } else if (row.lengthFeet.trim() !== '' || row.lengthInches.trim() !== '') {
        lengthParam = {
          feet: row.lengthFeet.trim() !== '' ? Number(row.lengthFeet) : 0,
          inches: row.lengthInches.trim() !== '' ? Number(row.lengthInches) : 0,
        };
      }
    } else if (row.product.qtyMethod === 'SHEET_WEIGHT' || row.lengthUnit === 'ft_in') {
      lengthParam = {
        feet: row.lengthFeet.trim() !== '' ? Number(row.lengthFeet) : 0,
        inches: row.lengthInches.trim() !== '' ? Number(row.lengthInches) : 0,
      };
    } else if (row.product.qtyMethod === 'SECTION_WEIGHT' && row.lengthUnit === 'metres') {
      lengthParam = {
        metres: row.lengthMetres.trim() !== '' ? Number(row.lengthMetres) : 0,
      };
    }

    const kgPerPieceVal = row.kgPerPiece && row.kgPerPiece.trim() !== ''
      ? Number(row.kgPerPiece.trim())
      : ('kgPerPiece' in row.product ? row.product.kgPerPiece : undefined);

    const nosNum = row.nos.trim() !== '' ? Number(row.nos) : 1;

    const effectiveWidthFactor = widthFactor ?? ('widthFactor' in row.product && row.product.widthFactor ? row.product.widthFactor : 1.08);
    const effectiveFeetToMetre = feetToMetre ?? (row.product.qtyMethod === 'SQM' ? 0.305 : undefined);

    const calcLine = calculateQuotationLine(
      {
        id: row.id,
        snapshot,
        length: lengthParam,
        lengthValue: lengthVal,
        lengthUnit: lengthU,
        widthFactor: effectiveWidthFactor,
        feetToMetre: effectiveFeetToMetre,
        kgPerPiece: kgPerPieceVal,
        nos: nosNum,
        customRate: rateNum,
        isManualQuantity: row.isManualQuantity,
        manualQuantity: row.isManualQuantity && row.manualQuantity.trim() !== ''
          ? Number(row.manualQuantity)
          : undefined,
        discountAmount: row.discountAmount.trim() !== '' ? Number(row.discountAmount) : undefined,
        discountPct: row.discountPct.trim() !== '' ? Number(row.discountPct) : undefined,
      },
      taxMode
    );

    const validation = validateLineDraft({
      product: row.product,
      rate: row.rate,
      nos: row.nos,
      lengthUnit: row.lengthUnit,
      lengthFeet: row.lengthFeet,
      lengthInches: row.lengthInches,
      lengthMetres: row.lengthMetres,
      isManualQuantity: row.isManualQuantity,
      manualQuantity: row.manualQuantity,
      discountAmount: row.discountAmount,
      discountPct: row.discountPct,
      calculatedQuantity: calcLine.quantity,
    });

    if (!validation.isValid) {
      if (row.product.qtyMethod === 'SECTION_WEIGHT' && row.isManualQuantity && validation.error === 'Manual quantity must be greater than 0.') {
        return { calculatedLine: null, validationError: 'Enter the weight in kg.' };
      }
      return { calculatedLine: null, validationError: validation.error || 'Invalid line values' };
    }

    return { calculatedLine: calcLine, validationError: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Invalid numeric values';
    return { calculatedLine: null, validationError: msg };
  }
}

/**
 * Weight preview for a by-weight (steel) row before a rate is entered.
 * Runs the same calculation with a placeholder rate so the kg shown matches what will be saved.
 */
export function weightPreview(
  row: EditableRowState,
  widthFactor?: number,
  feetToMetre?: number
): { quantity: number; unit: string; perPiece: number } | null {
  if (row.isCustomItem || !row.product || row.product.qtyMethod !== 'SECTION_WEIGHT') return null;
  if (row.calculatedLine) {
    return { quantity: row.calculatedLine.quantity, unit: row.calculatedLine.unit, perPiece: row.calculatedLine.perPieceQuantity };
  }
  const { calculatedLine } = computeRowCalculation({ ...row, rate: '1' }, 'intra', widthFactor, feetToMetre);
  return calculatedLine
    ? { quantity: calculatedLine.quantity, unit: calculatedLine.unit, perPiece: calculatedLine.perPieceQuantity }
    : null;
}
