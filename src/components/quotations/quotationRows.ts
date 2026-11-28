/**
 * Quotation line rows: state shape, construction (new / custom / from a saved line)
 * and the per-row calculation. No React — unit-testable on its own.
 */
import type { Product, QuantityMethod, ProductUnit } from '../../types/product';
import type { QuotationLine, QuotationLineSnapshot } from '../../types/quotation';
import { calculateQuotationLine, validateLineDraft, type TaxMode, type LengthUnit } from '../../engine';
import { Decimal } from 'decimal.js';
import { steelSizeProduct, parseSteelSize, flashingPerSheet, isSheetCut, legacySteelSizeDims, defaultDims, kindHasColour, STEEL_SIZE_KINDS, type SteelSizeInput, type SteelSizeKind } from './steelSize';

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
/** What a line needs when its item type is picked or changed: default boxes and length entry. */
export function itemTypeReset(shape: SteelSizeKind, item?: string): Partial<EditableRowState> {
  const cfg = STEEL_SIZE_KINDS[shape];
  const steel = cfg.method === 'SECTION_WEIGHT' && !cfg.lengthInFeet;
  return {
    steelSize: { shape, dims: defaultDims(shape, item) },
    lengthUnit: steel ? 'metres' : 'ft_in',
    lengthMetres: steel ? String(cfg.defaultLengthM) : '6',
    lengthValue: '',
    isManualQuantity: false,
    manualQuantity: '',
    colour: '',
  };
}

/** Steel lengths can be typed in m, mm, ft, in or ft + in. */
export const STEEL_LENGTH_UNITS: { value: RowLengthUnit; label: string }[] = [
  { value: 'metres', label: 'm' },
  { value: 'mm', label: 'mm' },
  { value: 'ft', label: 'ft' },
  { value: 'in', label: 'in' },
  { value: 'ft_in', label: 'ft + in' },
];

/** The steel line's length in metres as typed (null if nothing usable is typed). */
export function steelLengthMetres(row: EditableRowState, feetToMetre = 0.305): number | null {
  const num = (v?: string) => (v !== undefined && v.trim() !== '' && isFinite(Number(v)) ? Number(v) : null);
  const f = new Decimal(feetToMetre || 0.305);
  switch (row.lengthUnit) {
    case 'metres': {
      const v = num(row.lengthMetres);
      return v;
    }
    case 'mm': {
      const v = num(row.lengthValue);
      return v === null ? null : new Decimal(v).dividedBy(1000).toNumber();
    }
    case 'ft': {
      const v = num(row.lengthValue);
      return v === null ? null : f.times(v).toNumber();
    }
    case 'in': {
      const v = num(row.lengthValue);
      return v === null ? null : f.times(v).dividedBy(12).toNumber();
    }
    case 'ft_in': {
      const ft = num(row.lengthFeet) ?? 0;
      const inch = num(row.lengthInches) ?? 0;
      return ft === 0 && inch === 0 ? null : f.times(new Decimal(ft).plus(new Decimal(inch).dividedBy(12))).toNumber();
    }
    default:
      return null;
  }
}

/** Switch a steel line's length unit, keeping the same length (e.g. 6 m → 6000 mm). */
export function switchSteelLengthUnit(row: EditableRowState, unit: RowLengthUnit, feetToMetre = 0.305): Partial<EditableRowState> {
  const m = steelLengthMetres(row, feetToMetre);
  if (m === null) return { lengthUnit: unit };
  const metres = new Decimal(m);
  const feet = metres.dividedBy(feetToMetre || 0.305);
  const tidy = (d: Decimal, dp: number) => String(Number(d.toDecimalPlaces(dp, Decimal.ROUND_HALF_UP).toString()));
  switch (unit) {
    case 'metres':
      return { lengthUnit: unit, lengthMetres: tidy(metres, 3) };
    case 'mm':
      return { lengthUnit: unit, lengthValue: tidy(metres.times(1000), 1) };
    case 'ft':
      return { lengthUnit: unit, lengthValue: tidy(feet, 3) };
    case 'in':
      return { lengthUnit: unit, lengthValue: tidy(feet.times(12), 2) };
    case 'ft_in': {
      const whole = feet.floor();
      return { lengthUnit: unit, lengthFeet: whole.toString(), lengthInches: tidy(feet.minus(whole).times(12), 2) };
    }
    default:
      return { lengthUnit: unit };
  }
}

/** A new line by item type (sheet, accessory or steel), boxes still to fill. */
export function createSteelSizeRow(shape: SteelSizeKind = 'SHEET_SQM', item?: string): EditableRowState {
  return { ...createInitialRow(), ...itemTypeReset(shape, item) };
}

/** The line's quantity method: from its product, or from its item type before the boxes are filled. */
export function rowMethod(row: Pick<EditableRowState, 'product' | 'steelSize'>): QuantityMethod | undefined {
  if (row.product) return row.product.qtyMethod as QuantityMethod;
  return row.steelSize ? STEEL_SIZE_KINDS[row.steelSize.shape]?.method : undefined;
}

/** Flashing lines: pieces typed in Nos → pieces per sheet → sheets to charge (whole sheets). */
export function flashingSheets(
  row: Pick<EditableRowState, 'steelSize' | 'nos'>
): { pieces: number; perSheet: number; girth: number; sheets: number; widthFactor: number } | null {
  const size = row.steelSize;
  if (!size || !isSheetCut(size.shape)) return null;
  const cut = flashingPerSheet(size.dims.size ?? '', Number(size.dims.sheet || 48));
  const pieces = Number(row.nos);
  if ('error' in cut || !(pieces > 0)) return null;
  const wf = Number(size.dims.wf || 1.08);
  return {
    pieces,
    perSheet: cut.perSheet,
    girth: cut.girth,
    sheets: Math.ceil(pieces / cut.perSheet - 1e-9),
    widthFactor: wf > 0 ? wf : 1.08,
  };
}

/** Width factor typed on the line (Sq.Mtr sheets, flashing), if any. */
export function rowWidthOverride(row: Pick<EditableRowState, 'steelSize'>): number | null {
  const v = Number(row.steelSize?.dims.wf);
  return row.steelSize?.dims.wf !== undefined && String(row.steelSize.dims.wf).trim() !== '' && v > 0 ? v : null;
}

/** Width factor shown and used on a line: the line's own box, otherwise the quotation's. */
export function lineWidthFactor(row: Pick<EditableRowState, 'steelSize' | 'product'>, quotationWidth?: number): number {
  const own = rowWidthOverride(row);
  if (own !== null) return own;
  if (isSheetCut(row.steelSize?.shape)) return 1.08;
  if (quotationWidth !== undefined) return quotationWidth;
  const p = row.product as { widthFactor?: number } | null;
  return p?.widthFactor || 1.08;
}

/** Rebuilds the line's one-off product after a box or the type changes. */
export function applySteelSize(row: EditableRowState): EditableRowState {
  if (!row.steelSize) return row;
  const product = steelSizeProduct(row.steelSize, row.id, row.product?.gstRate ?? 18);
  const colour = kindHasColour(row.steelSize.shape) ? (row.steelSize.dims.colour ?? '') : row.colour;
  return { ...row, product, productSearch: product ? product.name : '', colour };
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
export function lineLengthText(line: Pick<QuotationLine, 'lengthValue' | 'lengthUnit' | 'lengthFeet' | 'lengthInches' | 'lengthM'>): string {
  if (line.lengthValue !== undefined && line.lengthValue !== null) return `${line.lengthValue} ${line.lengthUnit || 'ft'}`;
  if ((line.lengthFeet === undefined || line.lengthFeet === null) && line.lengthM) return `${line.lengthM} m`;
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
  // Sheets and steel come back in the unit the length was typed in
  const typedUnit =
    line.lengthValue !== undefined && line.lengthValue !== null && ['mm', 'ft', 'in', 'm'].includes(line.lengthUnit || '')
      ? (line.lengthUnit as 'mm' | 'ft' | 'in' | 'm')
      : null;
  const hasFeet = line.lengthFeet !== undefined && line.lengthFeet !== null;
  if (snap.qtyMethod === 'SQM' || snap.qtyMethod === 'SHEET_WEIGHT' || snap.qtyMethod === 'SECTION_WEIGHT') {
    if (typedUnit) lengthUnit = typedUnit === 'm' ? 'metres' : typedUnit;
    else if (snap.qtyMethod === 'SECTION_WEIGHT') lengthUnit = hasFeet ? 'ft_in' : 'metres';
    else lengthUnit = hasFeet || !line.lengthM ? 'ft_in' : 'metres';
  }

  return {
    ...base,
    ...(snap.steelShape && (snap.steelSizeDims || snap.steelSizeText)
      ? {
          steelSize: {
            shape: snap.steelShape as SteelSizeKind,
            dims: snap.steelSizeDims ? { ...snap.steelSizeDims } : legacySteelSizeDims(snap.steelShape, snap.steelSizeText || ''),
            hsn: snap.hsn,
          },
        }
      : {}),
    colour: line.colour ?? '',
    rate: str(line.rate),
    // flashing: Nos was the sheets charged; staff typed the pieces
    nos: isSheetCut(snap.steelShape) && snap.steelSizeDims?.pcs ? snap.steelSizeDims.pcs : str(line.nos, '1'),
    lengthUnit,
    lengthValue: typedUnit && typedUnit !== 'm' ? str(line.lengthValue) : '',
    lengthFeet: str(line.lengthFeet, base.lengthFeet),
    lengthInches: str(line.lengthInches, '0'),
    lengthMetres: typedUnit === 'm' ? str(line.lengthValue) : str(line.lengthM, base.lengthMetres),
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
  if (result.calculatedLine && colour && (isSheetLike(row.product) || kindHasColour(row.steelSize?.shape))) {
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

    const cut = flashingSheets(row);
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
            steelSizeDims: {
              ...Object.fromEntries(Object.entries(row.steelSize.dims).filter(([k]) => k !== 'pcs').map(([k, v]) => [k, String(v).trim()])),
              // flashing: the pieces typed (the line's Nos is the sheets charged)
              ...(cut ? { pcs: String(cut.pieces) } : {}),
            },
          }
        : {}),
    };

    let lengthParam: { feet?: number; inches?: number; metres?: number; value?: number; unit?: LengthUnit } = {};
    let lengthVal: number | undefined;
    let lengthU: LengthUnit | undefined;

    // Sheets (Sq.Mtr / by weight) and steel take the length in m, mm, ft, in or ft + in
    const method = row.product.qtyMethod;
    const num = (v?: string) => ((v ?? '').trim() !== '' ? Number(v) : 0);
    const takesUnit = method === 'SQM' || method === 'SHEET_WEIGHT' || method === 'SECTION_WEIGHT';
    if (takesUnit && row.lengthUnit === 'metres') {
      lengthParam = { metres: num(row.lengthMetres) };
    } else if (takesUnit && (row.lengthUnit === 'mm' || row.lengthUnit === 'ft' || row.lengthUnit === 'in' || row.lengthUnit === 'm')) {
      // Kept on the line too, so the quote shows the length as typed (e.g. 2500 mm)
      lengthVal = num(row.lengthValue);
      lengthU = row.lengthUnit;
      lengthParam = { value: lengthVal, unit: lengthU };
    } else if (method === 'SQM' || method === 'SHEET_WEIGHT' || row.lengthUnit === 'ft_in') {
      lengthParam = { feet: num(row.lengthFeet), inches: num(row.lengthInches) };
    }

    const kgPerPieceVal = row.kgPerPiece && row.kgPerPiece.trim() !== ''
      ? Number(row.kgPerPiece.trim())
      : ('kgPerPiece' in row.product ? row.product.kgPerPiece : undefined);

    const nosNum = cut ? cut.sheets : row.nos.trim() !== '' ? Number(row.nos) : 1;

    const effectiveWidthFactor = cut ? cut.widthFactor : rowWidthOverride(row) ?? widthFactor ?? ('widthFactor' in row.product && row.product.widthFactor ? row.product.widthFactor : 1.08);
    const effectiveFeetToMetre = feetToMetre ?? (row.product.qtyMethod === 'SQM' ? 0.305 : undefined);

    const calcLine = calculateQuotationLine(
      {
        id: row.id,
        snapshot,
        roundPerPieceDown: Boolean(cut),
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

/**
 * The line's working in plain words, e.g.
 * "12 pcs ÷ 4 a sheet = 3 sheets · 8 ft = 2.44 m × 1.08 = 2.63 Sq.Mtr a sheet × 3 = 7.89 Sq.Mtr".
 */
export function workingText(row: EditableRowState): string | null {
  const l = row.calculatedLine;
  if (!l || !row.steelSize || l.isManualQuantity) return null;
  const cfg = STEEL_SIZE_KINDS[row.steelSize.shape];
  const num = (v: number | undefined, dp = 4) => String(Number(Number(v || 0).toFixed(dp)));
  const len = lineLengthText(l);
  const metres = num(l.lengthM);
  const lenM = /\bm$/.test(len) && !/mm$/.test(len) ? len : `${len} = ${metres} m`;
  if (cfg.method === 'SQM') {
    const wf = num(l.widthFactor, 3);
    const cut = flashingSheets(row);
    if (cut) {
      return `${cut.pieces} pcs ÷ ${cut.perSheet} a sheet = ${cut.sheets} sheet${cut.sheets === 1 ? '' : 's'} · ${lenM} × ${wf} = ${num(l.perPieceQuantity, 2)} Sq.Mtr a sheet × ${cut.sheets} = ${num(l.quantity, 2)} Sq.Mtr`;
    }
    return `${lenM} × ${wf} = ${num(l.unroundedQuantity ? l.unroundedQuantity / l.nos : l.perPieceQuantity)} Sq.Mtr each × ${l.nos} = ${num(l.quantity, 2)} Sq.Mtr`;
  }
  if (cfg.method === 'SECTION_WEIGHT') {
    const kgm = l.snapshot.kgPerMetre || 0;
    if (cfg.perFoot) {
      const ft = num((l.lengthM || 0) / 0.305);
      const kgft = row.steelSize.dims.kgft || num(kgm * 0.305, 3);
      return `${len}${/ft$/.test(len) && !/in/.test(len) ? '' : ` = ${ft} ft`} × ${kgft} kg/ft = ${num(l.perPieceQuantity, 2)} kg each × ${l.nos} = ${num(l.quantity, 2)} kg`;
    }
    return `${lenM} × ${num(kgm, 3)} kg/m = ${num(l.perPieceQuantity, 2)} kg each × ${l.nos} = ${num(l.quantity, 2)} kg`;
  }
  if (cfg.method === 'SHEET_WEIGHT') {
    return `${num(l.perPieceQuantity, 2)} kg each × ${l.nos} = ${num(l.quantity, 2)} kg`;
  }
  return null;
}
