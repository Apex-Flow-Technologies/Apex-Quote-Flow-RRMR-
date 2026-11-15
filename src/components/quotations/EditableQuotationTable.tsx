import React, { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { Product, QuantityMethod, ProductUnit } from '../../types/product';
import type { QuotationLine, QuotationLineSnapshot } from '../../types/quotation';
import {
  calculateQuotationLine,
  validateLineDraft,
  formatQtyMethodLabel,
  type TaxMode,
  type LengthUnit,
} from '../../engine';
import { Decimal } from 'decimal.js';
import {
  Plus,
  Trash2,
  Copy,
  Search,
  AlertCircle,
  Layers,
  CornerDownLeft,
  SlidersHorizontal,
  RotateCcw,
  X,
  Check,
} from 'lucide-react';

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
}

/** Steel products carry their own default length (6 m, chequered plate 2.5 m). */
function productDefaultLengthM(product?: Product | null): string | undefined {
  if (product && product.qtyMethod === 'SECTION_WEIGHT' && product.defaultLengthM && product.defaultLengthM > 0) {
    return String(product.defaultLengthM);
  }
  return undefined;
}

/** A missing rate on a freshly picked product is a prompt, not an error. */
function isRateHint(row: EditableRowState): boolean {
  return row.validationError === 'Rate must be greater than 0.' && (!row.rate || Number(row.rate) === 0);
}

export function createInitialRow(customId?: string, product?: Product): EditableRowState {
  const id = customId || `row_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const defaultRate = product && product.ratePerUnit > 0 ? String(product.ratePerUnit) : '';
  let defaultUnit: RowLengthUnit = 'ft_in';
  if (product?.qtyMethod === 'SECTION_WEIGHT') {
    defaultUnit = 'metres';
  } else if (product?.qtyMethod === 'SQM') {
    defaultUnit = 'ft';
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
    lengthValue: product?.qtyMethod === 'SQM' ? '17.4' : '',
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
      return { calculatedLine: null, validationError: validation.error || 'Invalid line values' };
    }

    return { calculatedLine: calcLine, validationError: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Invalid numeric values';
    return { calculatedLine: null, validationError: msg };
  }
}

interface DropdownPosition {
  top: number;
  left: number;
  width: number;
  placement: 'bottom' | 'top';
  maxHeight: number;
}

interface EditableQuotationTableProps {
  products: Product[];
  taxMode: TaxMode;
  rows: EditableRowState[];
  widthFactor?: number;
  feetToMetre?: number;
  onRowsChange: (newRows: EditableRowState[]) => void;
  onAddRow: () => void;
  onAddCustomRow?: () => void;
  onRemoveRow: (id: string) => void;
  onDuplicateRow: (id: string) => void;
}

export const EditableQuotationTable: React.FC<EditableQuotationTableProps> = ({
  products,
  taxMode,
  rows,
  widthFactor,
  feetToMetre,
  onRowsChange,
  onAddRow,
  onAddCustomRow,
  onRemoveRow,
  onDuplicateRow,
}) => {
  const dropdownRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const portalDropdownRef = useRef<HTMLDivElement | null>(null);

  // Manual Quantity Override Modal State
  const [activeManualRowId, setActiveManualRowId] = useState<string | null>(null);
  const [tempManualQty, setTempManualQty] = useState<string>('');
  const [manualModalError, setManualModalError] = useState<string | null>(null);

  // Product Autocomplete Dropdown Portal Positioning State
  const [dropdownPos, setDropdownPos] = useState<DropdownPosition | null>(null);

  const openRow = rows.find((r) => r.isProductDropdownOpen) || null;

  const getActiveInput = (key: string): HTMLInputElement | undefined => {
    const mob = inputRefs.current.get(`${key}_mobile`);
    if (mob && mob.offsetParent !== null) return mob;
    const desk = inputRefs.current.get(key);
    if (desk && desk.offsetParent !== null) return desk;
    return mob || desk;
  };

  const updateDropdownPosition = useCallback(() => {
    if (!openRow) {
      setDropdownPos(null);
      return;
    }
    const inputEl = getActiveInput(`${openRow.id}_productSearch`);
    if (!inputEl) {
      setDropdownPos(null);
      return;
    }

    const rect = inputEl.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      setDropdownPos(null);
      return;
    }

    // Use the visual viewport where available: on phones the on-screen keyboard shrinks it,
    // and layout-viewport numbers would place the list under the keyboard.
    const vv = window.visualViewport;
    const viewW = document.documentElement.clientWidth || window.innerWidth;
    const viewTop = vv ? vv.offsetTop : 0;
    const viewBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;

    const isSmallScreen = viewW < 640;
    const padding = isSmallScreen ? 10 : 12;
    // Phones: span the screen width (minus gutters) so names are not truncated.
    const dropdownWidth = isSmallScreen
      ? viewW - padding * 2
      : Math.min(viewW - padding * 2, Math.max(rect.width, 360));

    let left = isSmallScreen ? padding : rect.left;
    if (left + dropdownWidth > viewW - padding) {
      left = Math.max(padding, viewW - dropdownWidth - padding);
    }
    if (left < padding) {
      left = padding;
    }

    const spaceBelow = viewBottom - rect.bottom - 8;
    const spaceAbove = rect.top - viewTop - 8;
    const desiredHeight = isSmallScreen ? 300 : 320;

    if (spaceBelow >= 160 || spaceBelow >= spaceAbove) {
      const maxHeight = Math.min(desiredHeight, Math.max(spaceBelow, 120));
      setDropdownPos({
        top: rect.bottom + 4,
        left,
        width: dropdownWidth,
        placement: 'bottom',
        maxHeight,
      });
    } else {
      const maxHeight = Math.min(desiredHeight, Math.max(spaceAbove, 120));
      setDropdownPos({
        top: Math.max(viewTop + 8, rect.top - maxHeight - 4),
        left,
        width: dropdownWidth,
        placement: 'top',
        maxHeight,
      });
    }
  }, [openRow]);

  useEffect(() => {
    if (openRow) {
      updateDropdownPosition();
      const handleScrollOrResize = (e?: Event) => {
        // Scrolling the list itself must not trigger a re-position
        if (e && e.target instanceof Node && portalDropdownRef.current?.contains(e.target)) return;
        updateDropdownPosition();
      };
      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);
      window.visualViewport?.addEventListener('resize', handleScrollOrResize);
      window.visualViewport?.addEventListener('scroll', handleScrollOrResize);
      return () => {
        window.removeEventListener('scroll', handleScrollOrResize, true);
        window.removeEventListener('resize', handleScrollOrResize);
        window.visualViewport?.removeEventListener('resize', handleScrollOrResize);
        window.visualViewport?.removeEventListener('scroll', handleScrollOrResize);
      };
    } else {
      setDropdownPos(null);
    }
  }, [openRow, updateDropdownPosition]);

  // Scroll highlighted suggestion into view
  useEffect(() => {
    if (openRow && openRow.isProductDropdownOpen && portalDropdownRef.current) {
      const highlightedEl = portalDropdownRef.current.querySelector(
        `[data-product-index="${openRow.highlightedProductIndex}"]`
      );
      if (highlightedEl) {
        highlightedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [openRow?.highlightedProductIndex, openRow?.isProductDropdownOpen]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      // Do not close if clicking inside the portal dropdown
      if (portalDropdownRef.current && portalDropdownRef.current.contains(target)) {
        return;
      }
      let clickedInsideInput = false;
      dropdownRefs.current.forEach((el) => {
        if (el && el.contains(target)) {
          clickedInsideInput = true;
        }
      });
      if (!clickedInsideInput) {
        onRowsChange(
          rows.map((r) => (r.isProductDropdownOpen ? { ...r, isProductDropdownOpen: false } : r))
        );
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [rows, onRowsChange]);

  // Handle Escape key to cancel manual quantity modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeManualRowId) {
        setActiveManualRowId(null);
        setManualModalError(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeManualRowId]);

  const updateRow = (rowId: string, updates: Partial<EditableRowState>) => {
    onRowsChange(
      rows.map((r) => {
        if (r.id !== rowId) return r;
        const updated = { ...r, ...updates };
        const { calculatedLine, validationError } = computeRowCalculation(updated, taxMode, widthFactor, feetToMetre);
        return {
          ...updated,
          calculatedLine,
          validationError,
        };
      })
    );
  };

  const activeManualRow = rows.find((r) => r.id === activeManualRowId) || null;

  const getCalculatedQuantityFromDimensions = (row: EditableRowState): number | null => {
    if (!row.product && !row.isCustomItem) return null;
    const mockRow: EditableRowState = {
      ...row,
      isManualQuantity: false,
      manualQuantity: '',
    };
    const { calculatedLine } = computeRowCalculation(mockRow, taxMode, widthFactor, feetToMetre);
    return calculatedLine ? calculatedLine.quantity : null;
  };

  const handleOpenManualOverride = (row: EditableRowState) => {
    if ((!row.product && !row.isCustomItem) || !row.calculatedLine) return;
    const defaultVal = row.isManualQuantity && row.manualQuantity
      ? row.manualQuantity
      : String(row.calculatedLine.quantity);
    setActiveManualRowId(row.id);
    setTempManualQty(defaultVal);
    setManualModalError(null);
  };

  const handleApplyManualQuantity = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeManualRow) return;

    const trimmed = tempManualQty.trim();
    if (trimmed === '') {
      setManualModalError('Please enter a quantity value.');
      return;
    }

    try {
      const dec = new Decimal(trimmed);
      if (!dec.isFinite() || dec.isNaN() || dec.lte(0)) {
        setManualModalError('Quantity must be greater than 0.');
        return;
      }
      updateRow(activeManualRow.id, {
        isManualQuantity: true,
        manualQuantity: trimmed,
      });
      setActiveManualRowId(null);
      setManualModalError(null);
    } catch {
      setManualModalError('Please enter a valid numeric quantity.');
    }
  };

  const handleResetToCalculated = () => {
    if (!activeManualRow) return;
    updateRow(activeManualRow.id, {
      isManualQuantity: false,
      manualQuantity: '',
    });
    setActiveManualRowId(null);
    setManualModalError(null);
  };

  const handleCancelManualModal = () => {
    setActiveManualRowId(null);
    setManualModalError(null);
  };

  const handleConvertToCustom = (rowId: string, description: string) => {
    onRowsChange(
      rows.map((r) => {
        if (r.id !== rowId) return r;
        const updated: EditableRowState = {
          ...r,
          product: null,
          productSearch: description,
          isProductDropdownOpen: false,
          isCustomItem: true,
          customDescription: description,
          customUnit: 'Nos',
          customHsn: '73089090',
          nos: r.nos || '1',
          rate: r.rate || '',
        };
        const { calculatedLine, validationError } = computeRowCalculation(updated, taxMode, widthFactor, feetToMetre);
        return {
          ...updated,
          calculatedLine,
          validationError,
        };
      })
    );

    setTimeout(() => {
      getActiveInput(`${rowId}_rate`)?.focus();
    }, 50);
  };

  const handleSelectProduct = (rowId: string, product: Product) => {
    onRowsChange(
      rows.map((r) => {
        if (r.id !== rowId) return r;
        const defaultRate = product.ratePerUnit > 0 ? String(product.ratePerUnit) : '';
        let defaultUnit: RowLengthUnit = 'ft_in';
        if (product.qtyMethod === 'SECTION_WEIGHT') {
          defaultUnit = 'metres';
        } else if (product.qtyMethod === 'SQM') {
          defaultUnit = 'ft';
        }
        const defaultKgPerPiece = 'kgPerPiece' in product && product.kgPerPiece ? String(product.kgPerPiece) : '';

        const updated: EditableRowState = {
          ...r,
          isCustomItem: false,
          product,
          productSearch: product.name,
          isProductDropdownOpen: false,
          rate: defaultRate,
          lengthUnit: defaultUnit,
          lengthValue: r.lengthValue || '17.4',
          kgPerPiece: defaultKgPerPiece || r.kgPerPiece || '',
          lengthFeet: r.lengthFeet || '8',
          lengthInches: r.lengthInches || '0',
          lengthMetres: productDefaultLengthM(product) ?? (r.lengthMetres || '6'),
          nos: r.nos || '1',
        };
        const { calculatedLine, validationError } = computeRowCalculation(updated, taxMode, widthFactor, feetToMetre);
        return {
          ...updated,
          calculatedLine,
          validationError,
        };
      })
    );

    // Auto-advance focus to the next field (Feet, Metres, or Nos)
    setTimeout(() => {
      if (product.qtyMethod === 'SQM') {
        getActiveInput(`${rowId}_lengthValue`)?.focus();
      } else if (product.qtyMethod === 'WEIGHT_PER_PIECE') {
        getActiveInput(`${rowId}_nos`)?.focus();
      } else if (product.qtyMethod === 'SHEET_WEIGHT') {
        getActiveInput(`${rowId}_lengthFeet`)?.focus();
      } else if (product.qtyMethod === 'SECTION_WEIGHT') {
        getActiveInput(`${rowId}_lengthMetres`)?.focus();
      } else {
        getActiveInput(`${rowId}_nos`)?.focus();
      }
    }, 50);
  };

  const getFilteredProducts = (query: string) => {
    if (!query.trim()) return products.slice(0, 15);
    // Token search: every word must appear somewhere ("60 square 3.2", "angle 50x6", "ismc 100").
    const norm = (s: string) =>
      s.toLowerCase().replace(/[×*]/g, 'x').replace(/(\d)\s*x\s*(?=\d)/g, '$1 ');
    const tokens = norm(query).split(/[\s,]+/).filter(Boolean);
    const isNum = (t: string) => /^\d+(\.\d+)?$/.test(t);
    return products.filter((p) => {
      const text = `${norm(p.name)} ${norm(p.category)}`;
      const words = text.split(/[\s()]+/).filter(Boolean);
      return tokens.every((t) => {
        if (t.length >= 4 && /^\d+$/.test(t) && p.hsn.startsWith(t)) return true; // HSN search
        // Numbers match whole sizes only ("12" ≠ "125"; "3.2" = "3.2"); words match anywhere.
        return isNum(t) ? words.some((w) => w === t || Number(w) === Number(t)) : text.includes(t);
      });
    }).slice(0, 25);
  };

  const handleKeyDownProductSearch = (
    e: React.KeyboardEvent<HTMLInputElement>,
    row: EditableRowState,
    filtered: Product[]
  ) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!row.isProductDropdownOpen) {
        updateRow(row.id, { isProductDropdownOpen: true, highlightedProductIndex: 0 });
      } else {
        const nextIndex = Math.min(row.highlightedProductIndex + 1, filtered.length - 1);
        updateRow(row.id, { highlightedProductIndex: nextIndex });
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (row.isProductDropdownOpen) {
        const prevIndex = Math.max(row.highlightedProductIndex - 1, 0);
        updateRow(row.id, { highlightedProductIndex: prevIndex });
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (row.isProductDropdownOpen && filtered.length > 0) {
        const selected = filtered[row.highlightedProductIndex] || filtered[0];
        handleSelectProduct(row.id, selected);
      } else if (filtered.length === 1) {
        handleSelectProduct(row.id, filtered[0]);
      } else if (row.productSearch.trim()) {
        handleConvertToCustom(row.id, row.productSearch.trim());
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      updateRow(row.id, { isProductDropdownOpen: false });
    }
  };

  const handleKeyDownRate = (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIndex: number
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (rowIndex === rows.length - 1) {
        // Last row: append a new row and focus it!
        onAddRow();
        setTimeout(() => {
          const nextRowInputs = Array.from(inputRefs.current.entries());
          const lastSearch = nextRowInputs.filter(([k]) => k.includes('_productSearch') && !k.endsWith('_mobile')).pop() ||
            nextRowInputs.filter(([k]) => k.includes('_productSearch')).pop();
          if (lastSearch) lastSearch[1]?.focus();
        }, 60);
      } else {
        // Move to the next row's product or first editable field
        const nextRow = rows[rowIndex + 1];
        if (nextRow) {
          if (nextRow.isCustomItem) {
            getActiveInput(`${nextRow.id}_customDesc`)?.focus();
          } else if (!nextRow.product) {
            getActiveInput(`${nextRow.id}_productSearch`)?.focus();
          } else {
            getActiveInput(`${nextRow.id}_nos`)?.focus();
          }
        }
      }
    }
  };

  return (
    <div className="bg-white rounded-card border border-line-strong shadow-xs overflow-hidden relative z-20">
      {/* Header bar */}
      <div className="p-3.5 sm:p-4 bg-surface-2 border-b border-line flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Layers className="w-4 h-4 text-brand shrink-0" />
          <span className="font-bold text-ink text-xs uppercase tracking-wider">
            Quotation Line Items ({rows.filter((r) => r.calculatedLine !== null).length} items)
          </span>
          <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-control bg-brand-soft text-brand border border-brand/20">
            {taxMode === 'intra' ? 'CGST+SGST (Intra)' : 'IGST (Inter)'}
          </span>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={onAddCustomRow ? onAddCustomRow : () => onRowsChange([...rows, createCustomRow()])}
            className="flex-1 sm:flex-initial min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white hover:bg-surface-2 text-ink border border-line-strong rounded-control font-semibold text-xs shadow-xs transition"
          >
            <Plus className="w-3.5 h-3.5 text-brand" />
            <span>Custom Item</span>
          </button>
          <button
            type="button"
            onClick={onAddRow}
            className="flex-1 sm:flex-initial min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-brand hover:bg-brand-dark text-white rounded-control font-semibold text-xs shadow-xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add item</span>
          </button>
        </div>
      </div>

      {/* Desktop Table View (hidden on mobile, visible on md and up) */}
      <div className="hidden md:block overflow-x-auto min-w-full">
        <table className="w-full text-left border-collapse text-xs min-w-[920px]">
          <thead>
            <tr className="bg-surface-2/70 border-b border-line text-faint font-semibold text-[10.5px] uppercase tracking-wider">
              <th className="py-2.5 px-3 text-center w-10">#</th>
              <th className="py-2.5 px-3 w-[260px]">Product / Description</th>
              <th className="py-2.5 px-3 w-[180px]">Dimensions / Length</th>
              <th className="py-2.5 px-3 text-center w-[75px]">Nos</th>
              <th className="py-2.5 px-3 text-right w-[110px]">Quantity</th>
              <th className="py-2.5 px-3 text-right w-[95px]">Rate (₹)</th>
              <th className="py-2.5 px-3 text-right w-[130px]">Amount before GST</th>
              <th className="py-2.5 px-3 text-center w-[70px]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row, index) => {
              const filtered = getFilteredProducts(row.productSearch);
              const isCustom = Boolean(row.isCustomItem);
              const isSqm = row.product?.qtyMethod === 'SQM';
              const isWeightPerPiece = row.product?.qtyMethod === 'WEIGHT_PER_PIECE';
              const isSheet = row.product?.qtyMethod === 'SHEET_WEIGHT';
              const isPipe = row.product?.qtyMethod === 'SECTION_WEIGHT';
              const isPiece = row.product?.qtyMethod === 'PIECE';
              const hasError = Boolean(row.validationError);

              return (
                <tr
                  key={row.id}
                  className={`hover:bg-brand-tint/20 transition ${
                    hasError ? 'bg-rose-50/20' : ''
                  }`}
                >
                  {/* Row Number */}
                  <td className="py-3 px-3 text-center font-mono text-muted text-[11px] align-top pt-4">
                    {index + 1}
                  </td>

                  {/* Product Search & Selection */}
                  <td className="py-3 px-3 align-top">
                    {isCustom ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded-control bg-amber-50 text-amber-800 border border-amber-300 shrink-0">
                            Custom
                          </span>
                          <input
                            ref={(el) => {
                              if (el) inputRefs.current.set(`${row.id}_customDesc`, el);
                              else inputRefs.current.delete(`${row.id}_customDesc`);
                            }}
                            type="text"
                            placeholder="Custom item name / description..."
                            value={row.customDescription || ''}
                            onChange={(e) => updateRow(row.id, { customDescription: e.target.value })}
                            className="w-full py-1.5 px-2 text-xs font-semibold rounded-control border border-line-strong focus:border-brand focus:ring-1 focus:ring-brand text-ink bg-white"
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-muted gap-2">
                          <div className="flex items-center gap-1">
                            <span className="text-faint">HSN:</span>
                            <input
                              type="text"
                              placeholder="73089090"
                              value={row.customHsn || ''}
                              onChange={(e) => updateRow(row.id, { customHsn: e.target.value })}
                              className="w-20 py-0.5 px-1.5 text-[10.5px] font-mono rounded-control border border-line text-ink bg-surface-2 focus:bg-white focus:border-brand"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              updateRow(row.id, {
                                isCustomItem: false,
                                product: null,
                                productSearch: '',
                                isProductDropdownOpen: true,
                              })
                            }
                            className="text-brand hover:underline font-semibold"
                          >
                            Catalog &rarr;
                          </button>
                        </div>
                        {row.validationError && (
                          <div className={isRateHint(row) ? "p-2 bg-brand-soft border border-brand/20 rounded-control text-brand-deep text-xs flex items-center gap-1.5" : "mt-1 flex items-center gap-1 text-[10px] text-danger font-medium"}>
                            <AlertCircle className="w-3 h-3 shrink-0" />
                            <span>{isRateHint(row) ? 'Enter the rate to price this line.' : row.validationError}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div
                        ref={(el) => {
                          if (el) dropdownRefs.current.set(row.id, el);
                          else dropdownRefs.current.delete(row.id);
                        }}
                        className="relative"
                      >
                        {!row.product ? (
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-faint absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                              ref={(el) => {
                                if (el) inputRefs.current.set(`${row.id}_productSearch`, el);
                                else inputRefs.current.delete(`${row.id}_productSearch`);
                              }}
                              type="text"
                              placeholder="Type product name or HSN..."
                              value={row.productSearch}
                              onFocus={() => updateRow(row.id, { isProductDropdownOpen: true })}
                              onClick={() => updateRow(row.id, { isProductDropdownOpen: true })}
                              onChange={(e) =>
                                updateRow(row.id, {
                                  productSearch: e.target.value,
                                  isProductDropdownOpen: true,
                                  highlightedProductIndex: 0,
                                })
                              }
                              onKeyDown={(e) => handleKeyDownProductSearch(e, row, filtered)}
                              aria-autocomplete="list"
                              aria-expanded={row.isProductDropdownOpen}
                              aria-controls={row.isProductDropdownOpen ? `product-dropdown-${row.id}` : undefined}
                              aria-haspopup="listbox"
                              className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-control border border-line-strong focus:border-brand focus:ring-1 focus:ring-brand text-ink bg-white font-medium"
                            />
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-ink text-xs truncate" title={row.product.name}>
                                {row.product.name}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  updateRow(row.id, {
                                    product: null,
                                    productSearch: '',
                                    isProductDropdownOpen: true,
                                  })
                                }
                                className="text-[10px] text-brand hover:text-brand-dark font-semibold underline shrink-0 ml-1"
                                title="Select a different product"
                              >
                                Change
                              </button>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-muted">
                              <span className="px-1.5 py-0.5 rounded-control bg-surface-2 border border-line font-mono">
                                HSN: {row.product.hsn}
                              </span>
                              <span className="px-1.5 py-0.5 rounded-control bg-brand-soft text-brand border border-brand/20 font-medium">
                                {formatQtyMethodLabel(row.product.qtyMethod)}
                              </span>
                            </div>
                            {isSheet && 'thicknessMm' in row.product && 'coilWidthM' in row.product && (
                              <div className="text-[10px] text-faint">
                                Thick: {row.product.thicknessMm}mm &bull; Coil: {row.product.coilWidthM}m
                              </div>
                            )}
                            {isPipe && 'kgPerMetre' in row.product && (
                              <div className="text-[10px] text-faint">
                                Section: {row.product.kgPerMetre} kg/m
                              </div>
                            )}
                            {isWeightPerPiece && 'kgPerPiece' in row.product && (
                              <div className="text-[10px] text-faint">
                                Weight: {row.product.kgPerPiece} kg/pc
                              </div>
                            )}
                          </div>
                        )}

                        {/* Row-level validation message */}
                        {row.validationError && (
                          <div className={isRateHint(row) ? "p-2 bg-brand-soft border border-brand/20 rounded-control text-brand-deep text-xs flex items-center gap-1.5" : "mt-1 flex items-center gap-1 text-[10px] text-danger font-medium"}>
                            <AlertCircle className="w-3 h-3 shrink-0" />
                            <span>{isRateHint(row) ? 'Enter the rate to price this line.' : row.validationError}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Dimensions / Measurement Input */}
                  <td className="py-3 px-3 align-top">
                    {isCustom ? (
                      <div className="space-y-1 pt-1">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-faint font-medium">Unit:</span>
                          <select
                            value={row.customUnit || 'Nos'}
                            onChange={(e) => updateRow(row.id, { customUnit: e.target.value as ProductUnit })}
                            className="py-1 px-1.5 text-xs font-semibold rounded-control border border-line-strong bg-white text-ink focus:border-brand"
                          >
                            <option value="Nos">Nos</option>
                            <option value="Sq.Mtr">Sq.Mtr</option>
                            <option value="Kgs">Kgs</option>
                            <option value="Ft">Ft</option>
                            <option value="R.Mtr">R.Mtr</option>
                            <option value="Metre">Metre</option>
                          </select>
                        </div>
                      </div>
                    ) : isSqm ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <input
                            ref={(el) => {
                              if (el) inputRefs.current.set(`${row.id}_lengthValue`, el);
                              else inputRefs.current.delete(`${row.id}_lengthValue`);
                            }}
                            type="number"
                            inputMode="decimal"
                            step="any"
                            min="0"
                            value={row.lengthValue ?? ''}
                            placeholder="17.4"
                            onChange={(e) => updateRow(row.id, { lengthValue: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                inputRefs.current.get(`${row.id}_nos`)?.focus();
                              }
                            }}
                            className="w-16 py-1.5 px-2 text-center text-xs font-mono tabular-nums font-bold rounded-control border border-line-strong focus:border-brand focus:ring-1 focus:ring-brand text-ink bg-white"
                            title="Length value"
                          />
                          <select
                            value={row.lengthUnit && ['ft', 'in', 'mm', 'm'].includes(row.lengthUnit) ? row.lengthUnit : 'ft'}
                            onChange={(e) => updateRow(row.id, { lengthUnit: e.target.value as LengthUnit })}
                            className="py-1.5 px-1 text-xs font-semibold rounded-control border border-line-strong bg-surface-2 text-ink focus:border-brand"
                            title="Length unit"
                          >
                            <option value="ft">ft</option>
                            <option value="in">in</option>
                            <option value="mm">mm</option>
                            <option value="m">m</option>
                          </select>
                        </div>
                        <div className="text-[10px] text-faint">
                          Width: {widthFactor ?? ('widthFactor' in (row.product || {}) && (row.product as any).widthFactor ? (row.product as any).widthFactor : 1.08)}
                        </div>
                      </div>
                    ) : isWeightPerPiece ? (
                      <div className="flex items-center gap-1.5 pt-1">
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          value={row.kgPerPiece ?? ''}
                          placeholder="40.00"
                          onChange={(e) => updateRow(row.id, { kgPerPiece: e.target.value })}
                          className="w-16 py-1.5 px-2 text-center text-xs font-mono tabular-nums font-bold rounded-control border border-line-strong focus:border-brand focus:ring-1 focus:ring-brand text-ink bg-white"
                          title="Weight per piece in kg"
                        />
                        <span className="font-semibold text-muted text-xs">kg/pc</span>
                      </div>
                    ) : isSheet ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <div className="flex items-center gap-1">
                            <input
                              ref={(el) => {
                                if (el) inputRefs.current.set(`${row.id}_lengthFeet`, el);
                                else inputRefs.current.delete(`${row.id}_lengthFeet`);
                              }}
                              type="number"
                              inputMode="numeric"
                              step="1"
                              min="0"
                              value={row.lengthFeet}
                              onChange={(e) => updateRow(row.id, { lengthFeet: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  inputRefs.current.get(`${row.id}_lengthInches`)?.focus();
                                }
                              }}
                              className="w-14 py-1.5 px-2 text-center text-xs font-mono tabular-nums font-bold rounded-control border border-line-strong focus:border-brand focus:ring-1 focus:ring-brand text-ink bg-white"
                              title="Length in Feet"
                            />
                            <span className="font-semibold text-muted text-xs">ft</span>
                          </div>

                          <div className="flex items-center gap-1">
                            <input
                              ref={(el) => {
                                if (el) inputRefs.current.set(`${row.id}_lengthInches`, el);
                                else inputRefs.current.delete(`${row.id}_lengthInches`);
                              }}
                              type="number"
                              inputMode="decimal"
                              step="0.5"
                              min="0"
                              max="11.9"
                              value={row.lengthInches}
                              onChange={(e) => updateRow(row.id, { lengthInches: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  inputRefs.current.get(`${row.id}_nos`)?.focus();
                                }
                              }}
                              className="w-12 py-1.5 px-1.5 text-center text-xs font-mono tabular-nums font-bold rounded-control border border-line-strong focus:border-brand focus:ring-1 focus:ring-brand text-ink bg-white"
                              title="Length in Inches"
                            />
                            <span className="font-semibold text-muted text-xs">in</span>
                          </div>
                        </div>
                      </div>
                    ) : isPipe ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          {row.lengthUnit === 'metres' ? (
                            <div className="flex items-center gap-1">
                              <input
                                ref={(el) => {
                                  if (el) inputRefs.current.set(`${row.id}_lengthMetres`, el);
                                  else inputRefs.current.delete(`${row.id}_lengthMetres`);
                                }}
                                type="number"
                                inputMode="decimal"
                                step="0.01"
                                min="0.1"
                                value={row.lengthMetres}
                                onChange={(e) => updateRow(row.id, { lengthMetres: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    inputRefs.current.get(`${row.id}_nos`)?.focus();
                                  }
                                }}
                                className="w-16 py-1.5 px-2 text-center text-xs font-mono tabular-nums font-bold rounded-control border border-line-strong focus:border-brand focus:ring-1 focus:ring-brand text-ink bg-white"
                                title="Length in Metres"
                              />
                              <span className="font-semibold text-muted text-xs">m</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <input
                                ref={(el) => {
                                  if (el) inputRefs.current.set(`${row.id}_lengthFeet`, el);
                                  else inputRefs.current.delete(`${row.id}_lengthFeet`);
                                }}
                                type="number"
                                inputMode="numeric"
                                step="1"
                                min="0"
                                value={row.lengthFeet}
                                onChange={(e) => updateRow(row.id, { lengthFeet: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    inputRefs.current.get(`${row.id}_lengthInches`)?.focus();
                                  }
                                }}
                                className="w-14 py-1.5 px-2 text-center text-xs font-mono tabular-nums font-bold rounded-control border border-line-strong focus:border-brand focus:ring-1 focus:ring-brand text-ink bg-white"
                                title="Length in Feet"
                              />
                              <span className="font-semibold text-muted text-xs">ft</span>
                              <input
                                ref={(el) => {
                                  if (el) inputRefs.current.set(`${row.id}_lengthInches`, el);
                                  else inputRefs.current.delete(`${row.id}_lengthInches`);
                                }}
                                type="number"
                                inputMode="decimal"
                                step="0.5"
                                min="0"
                                max="11.9"
                                value={row.lengthInches}
                                onChange={(e) => updateRow(row.id, { lengthInches: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    inputRefs.current.get(`${row.id}_nos`)?.focus();
                                  }
                                }}
                                className="w-12 py-1.5 px-1.5 text-center text-xs font-mono tabular-nums font-bold rounded-control border border-line-strong focus:border-brand focus:ring-1 focus:ring-brand text-ink bg-white"
                                title="Length in Inches"
                              />
                              <span className="font-semibold text-muted text-xs">in</span>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              updateRow(row.id, {
                                lengthUnit: row.lengthUnit === 'metres' ? 'ft_in' : 'metres',
                              })
                            }
                            className="text-[10px] px-1.5 py-0.5 rounded-control bg-surface-2 border border-line text-muted hover:text-ink font-semibold"
                            title="Toggle between metres and feet/inches"
                          >
                            {row.lengthUnit === 'metres' ? '⇄ ft/in' : '⇄ m'}
                          </button>
                        </div>
                      </div>
                    ) : isPiece ? (
                      <div className="text-muted text-xs pt-1.5">—</div>
                    ) : (
                      <div className="text-faint text-xs pt-1.5">Direct</div>
                    )}
                  </td>

                  {/* Nos Input */}
                  <td className="py-3 px-3 text-center align-top">
                    <input
                      ref={(el) => {
                        if (el) inputRefs.current.set(`${row.id}_nos`, el);
                        else inputRefs.current.delete(`${row.id}_nos`);
                      }}
                      type="number"
                      inputMode="numeric"
                      step="1"
                      min="1"
                      value={row.nos}
                      onChange={(e) => updateRow(row.id, { nos: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          inputRefs.current.get(`${row.id}_rate`)?.focus();
                        }
                      }}
                      className="w-14 py-1.5 px-1.5 text-center text-xs font-mono tabular-nums font-bold rounded-control border border-line-strong focus:border-brand focus:ring-1 focus:ring-brand text-ink bg-white"
                      title="Number of pieces (Nos)"
                    />
                  </td>

                  {/* Quantity & Unit */}
                  <td className="py-3 px-3 text-right align-top">
                    {row.calculatedLine ? (
                      <div className="group/qty">
                        <div className="flex items-center justify-end gap-1.5">
                          <div className="text-right">
                            <div className="font-mono tabular-nums font-bold text-ink text-xs">
                              {Number(row.calculatedLine.quantity).toFixed(2)}{' '}
                              <span className="font-medium text-muted text-[11px]">{row.calculatedLine.unit}</span>
                            </div>
                            {row.calculatedLine.perPieceQuantity > 0 && !row.isManualQuantity && (
                              <div className="text-[10px] text-faint font-mono tabular-nums">
                                {row.calculatedLine.perPieceQuantity} {row.calculatedLine.unit}/pc
                              </div>
                            )}
                          </div>

                          {/* Compact Edit / Override Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenManualOverride(row)}
                            className={`p-1 rounded-control transition shrink-0 ${
                              row.isManualQuantity
                                ? 'text-warn bg-amber-50 hover:bg-amber-100 border border-warn/30'
                                : 'text-muted hover:text-brand hover:bg-surface-2 opacity-60 group-hover/qty:opacity-100 border border-transparent hover:border-line-strong'
                            }`}
                            title={row.isManualQuantity ? 'Edit manual quantity override' : 'Override quantity manually'}
                            aria-label="Override quantity manually"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {row.isManualQuantity && (
                          <div className="flex items-center justify-end mt-1">
                            <button
                              type="button"
                              onClick={() => handleOpenManualOverride(row)}
                              className="text-[9px] uppercase font-bold text-warn bg-amber-50 hover:bg-amber-100 px-1.5 py-0.5 rounded-control border border-warn/30 cursor-pointer inline-flex items-center gap-1"
                              title="Manual override active. Click to edit or return to calculated."
                            >
                              <span>Manual</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-faint text-xs">—</span>
                    )}
                  </td>

                  {/* Rate Input */}
                  <td className="py-3 px-3 text-right align-top">
                    <div className="relative inline-block w-20">
                      <input
                        ref={(el) => {
                          if (el) inputRefs.current.set(`${row.id}_rate`, el);
                          else inputRefs.current.delete(`${row.id}_rate`);
                        }}
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        value={row.rate}
                        placeholder={row.product ? String(row.product.ratePerUnit) : '0.00'}
                        onChange={(e) => updateRow(row.id, { rate: e.target.value })}
                        onKeyDown={(e) => handleKeyDownRate(e, index)}
                        className="w-full py-1.5 px-2 text-right text-xs font-mono tabular-nums font-bold rounded-control border border-line-strong focus:border-brand focus:ring-1 focus:ring-brand text-ink bg-white"
                        title="Rate per unit (₹). Press Enter to add next line."
                      />
                    </div>
                  </td>

                  {/* Amount before GST */}
                  <td className="py-3 px-3 text-right align-top font-mono tabular-nums font-bold text-ink text-xs pt-4">
                    {row.calculatedLine ? (
                      `₹${Number(row.calculatedLine.taxableAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    ) : (
                      <span className="text-faint font-normal">—</span>
                    )}
                  </td>

                  {/* Row Actions */}
                  <td className="py-3 px-3 text-center align-top pt-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => onDuplicateRow(row.id)}
                        className="p-1 text-muted hover:text-brand rounded-control transition"
                        title="Duplicate this row"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveRow(row.id)}
                        disabled={rows.length === 1 && !row.product}
                        className="p-1 text-muted hover:text-danger rounded-control transition disabled:opacity-30 disabled:hover:text-muted"
                        title="Delete row"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View (visible on mobile, hidden on md and up) */}
      <div className="block md:hidden divide-y divide-line">
        {rows.map((row, index) => {
          const filtered = getFilteredProducts(row.productSearch);
          const isCustom = Boolean(row.isCustomItem);
          const isSqm = row.product?.qtyMethod === 'SQM';
          const isWeightPerPiece = row.product?.qtyMethod === 'WEIGHT_PER_PIECE';
          const isSheet = row.product?.qtyMethod === 'SHEET_WEIGHT';
          const isPipe = row.product?.qtyMethod === 'SECTION_WEIGHT';
          const hasError = Boolean(row.validationError);

          return (
            <div
              key={`mobile_${row.id}`}
              className={`p-3.5 space-y-3 transition ${
                hasError ? 'bg-rose-50/20' : 'bg-white'
              }`}
            >
              {/* Card Header: Item #, Method Badge, Manual Pill, Actions */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <span className="w-6 h-6 rounded-full bg-surface-2 border border-line-strong flex items-center justify-center font-mono text-[11px] font-bold text-ink shrink-0">
                    {index + 1}
                  </span>
                  {isCustom ? (
                    <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-control bg-amber-50 text-amber-800 border border-amber-300 shrink-0">
                      Custom Item
                    </span>
                  ) : row.product ? (
                    <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-control bg-brand-soft text-brand border border-brand/20 shrink-0">
                      {formatQtyMethodLabel(row.product.qtyMethod)}
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-control bg-surface-2 text-muted border border-line shrink-0">
                      Select Item
                    </span>
                  )}
                  {row.isManualQuantity && (
                    <button
                      type="button"
                      onClick={() => handleOpenManualOverride(row)}
                      className="text-[9px] uppercase font-bold text-warn bg-amber-50 hover:bg-amber-100 px-1.5 py-0.5 rounded-control border border-warn/30 cursor-pointer inline-flex items-center gap-1 shrink-0"
                    >
                      <SlidersHorizontal className="w-2.5 h-2.5" />
                      <span>Manual Override</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onDuplicateRow(row.id)}
                    className="w-9 h-9 flex items-center justify-center text-muted hover:text-brand hover:bg-surface-2 rounded-control border border-line transition"
                    title="Duplicate this item"
                    aria-label={`Duplicate item ${index + 1}`}
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveRow(row.id)}
                    disabled={rows.length === 1 && !row.product}
                    className="w-9 h-9 flex items-center justify-center text-muted hover:text-danger hover:bg-rose-50 rounded-control border border-line transition disabled:opacity-30 disabled:hover:text-muted"
                    title="Delete this item"
                    aria-label={`Delete item ${index + 1}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Product / Description Field */}
              {isCustom ? (
                <div className="space-y-2">
                  <label className="block text-[10.5px] font-semibold text-faint uppercase tracking-wider">
                    Item Description <span className="text-danger">*</span>
                  </label>
                  <input
                    ref={(el) => {
                      if (el) inputRefs.current.set(`${row.id}_customDesc_mobile`, el);
                      else inputRefs.current.delete(`${row.id}_customDesc_mobile`);
                    }}
                    type="text"
                    placeholder="Custom item description..."
                    value={row.customDescription || ''}
                    onChange={(e) => updateRow(row.id, { customDescription: e.target.value })}
                    className="w-full h-11 px-3 text-sm font-semibold rounded-control border border-line-strong focus:border-brand focus:ring-2 focus:ring-brand/20 text-ink bg-white"
                  />
                  <div className="flex items-center justify-between text-xs gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-faint text-[11px] font-semibold">HSN:</span>
                      <input
                        type="text"
                        placeholder="73089090"
                        value={row.customHsn || ''}
                        onChange={(e) => updateRow(row.id, { customHsn: e.target.value })}
                        className="w-24 h-8 px-2 text-xs font-mono rounded-control border border-line text-ink bg-surface-2 focus:bg-white focus:border-brand"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        updateRow(row.id, {
                          isCustomItem: false,
                          product: null,
                          productSearch: '',
                          isProductDropdownOpen: true,
                        })
                      }
                      className="min-h-[36px] text-xs text-brand hover:underline font-semibold"
                    >
                      Select Catalog Item &rarr;
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  ref={(el) => {
                    if (el) dropdownRefs.current.set(`${row.id}_mobile`, el);
                    else dropdownRefs.current.delete(`${row.id}_mobile`);
                  }}
                  className="space-y-1.5"
                >
                  <label className="block text-[10.5px] font-semibold text-faint uppercase tracking-wider">
                    Product <span className="text-danger">*</span>
                  </label>
                  {!row.product ? (
                    <div className="relative">
                      <Search className="w-4 h-4 text-faint absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        ref={(el) => {
                          if (el) inputRefs.current.set(`${row.id}_productSearch_mobile`, el);
                          else inputRefs.current.delete(`${row.id}_productSearch_mobile`);
                        }}
                        type="text"
                        placeholder="Search product name or HSN..."
                        value={row.productSearch}
                        onFocus={() => updateRow(row.id, { isProductDropdownOpen: true })}
                        onClick={() => updateRow(row.id, { isProductDropdownOpen: true })}
                        onChange={(e) =>
                          updateRow(row.id, {
                            productSearch: e.target.value,
                            isProductDropdownOpen: true,
                            highlightedProductIndex: 0,
                          })
                        }
                        onKeyDown={(e) => handleKeyDownProductSearch(e, row, filtered)}
                        className="w-full pl-9 pr-3 h-11 text-sm rounded-control border border-line-strong focus:border-brand focus:ring-2 focus:ring-brand/20 text-ink bg-white font-medium"
                      />
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-control bg-surface-2 border border-line flex items-center justify-between gap-2">
                      <div className="min-w-0 space-y-0.5">
                        <div className="font-bold text-ink text-sm leading-snug break-words" title={row.product.name}>
                          {row.product.name}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-muted">
                          <span className="font-mono">HSN: {row.product.hsn}</span>
                          <span>&bull;</span>
                          <span>{row.product.category}</span>
                          {isSheet && 'thicknessMm' in row.product && (
                            <>
                              <span>&bull;</span>
                              <span>{row.product.thicknessMm}mm</span>
                            </>
                          )}
                          {isPipe && 'kgPerMetre' in row.product && (
                            <>
                              <span>&bull;</span>
                              <span>{row.product.kgPerMetre} kg/m</span>
                            </>
                          )}
                          {isWeightPerPiece && 'kgPerPiece' in row.product && (
                            <>
                              <span>&bull;</span>
                              <span>{row.product.kgPerPiece} kg/pc</span>
                            </>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          updateRow(row.id, {
                            product: null,
                            productSearch: '',
                            isProductDropdownOpen: true,
                          })
                        }
                        className="min-h-[38px] text-xs text-brand hover:text-brand-dark font-semibold underline shrink-0 px-1"
                      >
                        Change
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Validation error */}
              {row.validationError && (
                <div className={isRateHint(row) ? "p-2 bg-brand-soft border border-brand/20 rounded-control text-brand-deep text-xs flex items-center gap-1.5" : "p-2 bg-rose-50 border border-rose-200 rounded-control text-danger text-xs flex items-center gap-1.5"}>
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{isRateHint(row) ? 'Enter the rate to price this line.' : row.validationError}</span>
                </div>
              )}

              {/* Dimensions Section (if applicable) */}
              {isCustom ? (
                <div className="flex items-center justify-between gap-3 pt-1">
                  <label className="text-xs font-semibold text-muted">Measurement Unit:</label>
                  <select
                    value={row.customUnit || 'Nos'}
                    onChange={(e) => updateRow(row.id, { customUnit: e.target.value as ProductUnit })}
                    className="h-10 px-3 text-xs font-semibold rounded-control border border-line-strong bg-white text-ink focus:border-brand"
                  >
                    <option value="Nos">Nos</option>
                    <option value="Sq.Mtr">Sq.Mtr</option>
                    <option value="Kgs">Kgs</option>
                    <option value="Ft">Ft</option>
                    <option value="R.Mtr">R.Mtr</option>
                    <option value="Metre">Metre</option>
                  </select>
                </div>
              ) : isSqm ? (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10.5px] font-semibold text-faint uppercase tracking-wider">
                      Length Dimension
                    </label>
                    <span className="text-[11px] text-muted">
                      Width: {widthFactor ?? ('widthFactor' in (row.product || {}) && (row.product as any).widthFactor ? (row.product as any).widthFactor : 1.08)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      ref={(el) => {
                        if (el) inputRefs.current.set(`${row.id}_lengthValue_mobile`, el);
                        else inputRefs.current.delete(`${row.id}_lengthValue_mobile`);
                      }}
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min="0"
                      value={row.lengthValue ?? ''}
                      placeholder="17.4"
                      onChange={(e) => updateRow(row.id, { lengthValue: e.target.value })}
                      className="flex-1 min-w-0 w-full h-10 px-3 text-center text-sm font-mono tabular-nums font-bold rounded-control border border-line-strong focus:border-brand focus:ring-2 focus:ring-brand/20 text-ink bg-white"
                      title="Length value"
                    />
                    <select
                      value={row.lengthUnit && ['ft', 'in', 'mm', 'm'].includes(row.lengthUnit) ? row.lengthUnit : 'ft'}
                      onChange={(e) => updateRow(row.id, { lengthUnit: e.target.value as LengthUnit })}
                      className="w-20 h-10 px-2 text-xs font-semibold rounded-control border border-line-strong bg-surface-2 text-ink focus:border-brand"
                    >
                      <option value="ft">ft</option>
                      <option value="in">in</option>
                      <option value="mm">mm</option>
                      <option value="m">m</option>
                    </select>
                  </div>
                </div>
              ) : isWeightPerPiece ? (
                <div className="flex items-center justify-between gap-3 pt-1">
                  <label className="text-xs font-semibold text-muted">Weight per Piece:</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      value={row.kgPerPiece ?? ''}
                      placeholder="40.00"
                      onChange={(e) => updateRow(row.id, { kgPerPiece: e.target.value })}
                      className="w-24 h-10 px-2 text-center text-sm font-mono tabular-nums font-bold rounded-control border border-line-strong focus:border-brand focus:ring-2 focus:ring-brand/20 text-ink bg-white"
                    />
                    <span className="font-semibold text-muted text-xs">kg/pc</span>
                  </div>
                </div>
              ) : isSheet ? (
                <div className="space-y-1.5 pt-1">
                  <label className="text-[10.5px] font-semibold text-faint uppercase tracking-wider">
                    Sheet Length
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-1.5">
                      <input
                        ref={(el) => {
                          if (el) inputRefs.current.set(`${row.id}_lengthFeet_mobile`, el);
                          else inputRefs.current.delete(`${row.id}_lengthFeet_mobile`);
                        }}
                        type="number"
                        inputMode="numeric"
                        step="1"
                        min="0"
                        value={row.lengthFeet}
                        onChange={(e) => updateRow(row.id, { lengthFeet: e.target.value })}
                        className="flex-1 min-w-0 w-full h-10 px-2 text-center text-sm font-mono tabular-nums font-bold rounded-control border border-line-strong focus:border-brand focus:ring-2 focus:ring-brand/20 text-ink bg-white"
                        placeholder="8"
                      />
                      <span className="font-semibold text-muted text-xs">ft</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        ref={(el) => {
                          if (el) inputRefs.current.set(`${row.id}_lengthInches_mobile`, el);
                          else inputRefs.current.delete(`${row.id}_lengthInches_mobile`);
                        }}
                        type="number"
                        inputMode="decimal"
                        step="0.5"
                        min="0"
                        max="11.9"
                        value={row.lengthInches}
                        onChange={(e) => updateRow(row.id, { lengthInches: e.target.value })}
                        className="flex-1 min-w-0 w-full h-10 px-2 text-center text-sm font-mono tabular-nums font-bold rounded-control border border-line-strong focus:border-brand focus:ring-2 focus:ring-brand/20 text-ink bg-white"
                        placeholder="0"
                      />
                      <span className="font-semibold text-muted text-xs">in</span>
                    </div>
                  </div>
                </div>
              ) : isPipe ? (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10.5px] font-semibold text-faint uppercase tracking-wider">
                      Pipe Length
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        updateRow(row.id, {
                          lengthUnit: row.lengthUnit === 'metres' ? 'ft_in' : 'metres',
                        })
                      }
                      className="min-h-[30px] text-[11px] px-2 py-0.5 rounded-control bg-surface-2 border border-line text-brand font-semibold"
                    >
                      {row.lengthUnit === 'metres' ? 'Switch to ft/in' : 'Switch to metres'}
                    </button>
                  </div>
                  {row.lengthUnit === 'metres' ? (
                    <div className="flex items-center gap-2">
                      <input
                        ref={(el) => {
                          if (el) inputRefs.current.set(`${row.id}_lengthMetres_mobile`, el);
                          else inputRefs.current.delete(`${row.id}_lengthMetres_mobile`);
                        }}
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0.1"
                        value={row.lengthMetres}
                        onChange={(e) => updateRow(row.id, { lengthMetres: e.target.value })}
                        className="flex-1 min-w-0 w-full h-10 px-3 text-center text-sm font-mono tabular-nums font-bold rounded-control border border-line-strong focus:border-brand focus:ring-2 focus:ring-brand/20 text-ink bg-white"
                        placeholder="6.0"
                      />
                      <span className="font-semibold text-muted text-xs">m</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center gap-1.5">
                        <input
                          ref={(el) => {
                            if (el) inputRefs.current.set(`${row.id}_lengthFeet_mobile`, el);
                            else inputRefs.current.delete(`${row.id}_lengthFeet_mobile`);
                          }}
                          type="number"
                          inputMode="numeric"
                          step="1"
                          min="0"
                          value={row.lengthFeet}
                          onChange={(e) => updateRow(row.id, { lengthFeet: e.target.value })}
                          className="flex-1 min-w-0 w-full h-10 px-2 text-center text-sm font-mono tabular-nums font-bold rounded-control border border-line-strong focus:border-brand focus:ring-2 focus:ring-brand/20 text-ink bg-white"
                          placeholder="20"
                        />
                        <span className="font-semibold text-muted text-xs">ft</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          ref={(el) => {
                            if (el) inputRefs.current.set(`${row.id}_lengthInches_mobile`, el);
                            else inputRefs.current.delete(`${row.id}_lengthInches_mobile`);
                          }}
                          type="number"
                          inputMode="decimal"
                          step="0.5"
                          min="0"
                          max="11.9"
                          value={row.lengthInches}
                          onChange={(e) => updateRow(row.id, { lengthInches: e.target.value })}
                          className="flex-1 min-w-0 w-full h-10 px-2 text-center text-sm font-mono tabular-nums font-bold rounded-control border border-line-strong focus:border-brand focus:ring-2 focus:ring-brand/20 text-ink bg-white"
                          placeholder="0"
                        />
                        <span className="font-semibold text-muted text-xs">in</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              {/* Pieces (Nos) and Rate Grid */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="block text-[10.5px] font-semibold text-faint uppercase tracking-wider">
                    Pieces (Nos) <span className="text-danger">*</span>
                  </label>
                  <input
                    ref={(el) => {
                      if (el) inputRefs.current.set(`${row.id}_nos_mobile`, el);
                      else inputRefs.current.delete(`${row.id}_nos_mobile`);
                    }}
                    type="number"
                    inputMode="numeric"
                    step="1"
                    min="1"
                    value={row.nos}
                    onChange={(e) => updateRow(row.id, { nos: e.target.value })}
                    className="w-full h-10 px-2.5 text-center text-sm font-mono tabular-nums font-bold rounded-control border border-line-strong focus:border-brand focus:ring-2 focus:ring-brand/20 text-ink bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10.5px] font-semibold text-faint uppercase tracking-wider">
                    Rate / Unit (₹)
                  </label>
                  <input
                    ref={(el) => {
                      if (el) inputRefs.current.set(`${row.id}_rate_mobile`, el);
                      else inputRefs.current.delete(`${row.id}_rate_mobile`);
                    }}
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={row.rate}
                    placeholder={row.product ? String(row.product.ratePerUnit) : '0.00'}
                    onChange={(e) => updateRow(row.id, { rate: e.target.value })}
                    className="w-full h-10 px-2.5 text-right text-sm font-mono tabular-nums font-bold rounded-control border border-line-strong focus:border-brand focus:ring-2 focus:ring-brand/20 text-ink bg-white"
                  />
                </div>
              </div>

              {/* Calculated Summary Box */}
              <div className="p-3 bg-surface-2 rounded-control border border-line flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-[10px] text-faint font-semibold uppercase tracking-wider block">
                    Total Quantity
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono tabular-nums font-bold text-ink text-sm">
                      {row.calculatedLine
                        ? `${Number(row.calculatedLine.quantity).toFixed(2)} ${row.calculatedLine.unit}`
                        : '—'}
                    </span>
                    {row.calculatedLine && (
                      <button
                        type="button"
                        onClick={() => handleOpenManualOverride(row)}
                        className="p-1 rounded-control text-muted hover:text-brand hover:bg-white border border-transparent hover:border-line-strong transition"
                        title="Override quantity manually"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] text-faint font-semibold uppercase tracking-wider block">
                    Taxable Amount
                  </span>
                  <span className="font-mono tabular-nums font-bold text-brand text-base">
                    {row.calculatedLine
                      ? `₹${Number(row.calculatedLine.taxableAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : '—'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Table Footer with Quick Add Button and Keyboard Hints */}
      <div className="p-3.5 bg-surface-2 border-t border-line flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={onAddRow}
            className="w-full sm:w-auto min-h-[44px] sm:min-h-[36px] inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-white hover:bg-surface-2 text-ink border border-line-strong rounded-control font-semibold text-xs shadow-xs transition"
          >
            <Plus className="w-4 h-4 text-brand" />
            <span>+ Add Item Row</span>
          </button>
          <button
            type="button"
            onClick={onAddCustomRow ? onAddCustomRow : () => onRowsChange([...rows, createCustomRow()])}
            className="w-full sm:w-auto min-h-[44px] sm:min-h-[36px] inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-white hover:bg-surface-2 text-ink border border-line-strong rounded-control font-semibold text-xs shadow-xs transition"
          >
            <Plus className="w-4 h-4 text-brand" />
            <span>Custom Item</span>
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-muted text-[11px]">
          <span className="flex items-center gap-1">
            <CornerDownLeft className="w-3 h-3 text-brand" />
            <span className="font-medium">Press <strong className="font-semibold text-ink">Enter</strong> on Rate to add next row</span>
          </span>
          <span>&bull;</span>
          <span><strong className="font-semibold text-ink">Tab</strong> navigates fields</span>
          <span>&bull;</span>
          <span><strong className="font-semibold text-ink">Esc</strong> closes suggestions</span>
        </div>
      </div>

      {/* Manual Quantity Override Modal */}
      {activeManualRow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs animate-in fade-in duration-100"
          onClick={handleCancelManualModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="manual-qty-title"
        >
          <div
            className="bg-white rounded-card shadow-lg border border-line-strong max-w-sm w-full overflow-hidden animate-in zoom-in-95 duration-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 bg-surface-2 border-b border-line flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-brand" />
                <h3 id="manual-qty-title" className="font-bold text-xs text-ink uppercase tracking-wider">
                  Manual Quantity Override
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCancelManualModal}
                className="p-1 text-muted hover:text-ink rounded-control transition"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleApplyManualQuantity} className="p-4 space-y-4 text-xs">
              <div>
                <span className="text-[10px] text-faint uppercase font-bold tracking-wider block">Product</span>
                <span className="font-semibold text-ink text-xs">
                  {activeManualRow.isCustomItem ? activeManualRow.customDescription || 'Custom Item' : activeManualRow.product?.name}
                </span>
              </div>

              {/* Current Calculated Quantity Display */}
              <div className="p-2.5 rounded-control bg-surface-2 border border-line space-y-1">
                <span className="text-[10.5px] text-muted block font-medium">Calculated from dimensions:</span>
                <div className="font-mono tabular-nums font-bold text-ink text-sm">
                  {getCalculatedQuantityFromDimensions(activeManualRow) !== null
                    ? `${Number(getCalculatedQuantityFromDimensions(activeManualRow)).toFixed(2)} ${activeManualRow.isCustomItem ? (activeManualRow.customUnit || 'Nos') : activeManualRow.product?.unit}`
                    : '—'}
                </div>
                {activeManualRow.calculatedLine && activeManualRow.calculatedLine.perPieceQuantity > 0 && (
                  <span className="text-[10px] text-faint font-mono block">
                    Formula: {activeManualRow.calculatedLine.perPieceQuantity} {activeManualRow.isCustomItem ? (activeManualRow.customUnit || 'Nos') : activeManualRow.product?.unit}/pc × {activeManualRow.nos} pcs
                  </span>
                )}
              </div>

              {/* Editable Manual Quantity Field */}
              <div className="space-y-1">
                <label htmlFor="manual-qty-input" className="block text-xs font-semibold text-ink">
                  Override Quantity ({activeManualRow.isCustomItem ? (activeManualRow.customUnit || 'Nos') : activeManualRow.product?.unit})
                </label>
                <input
                  id="manual-qty-input"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0.01"
                  autoFocus
                  value={tempManualQty}
                  onChange={(e) => {
                    setTempManualQty(e.target.value);
                    if (manualModalError) setManualModalError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      handleCancelManualModal();
                    }
                  }}
                  className="w-full py-2 px-3 text-sm font-mono tabular-nums font-bold rounded-control border border-line-strong focus:border-brand focus:ring-1 focus:ring-brand text-ink bg-white"
                  placeholder="e.g. 85.00"
                />
                {manualModalError && (
                  <div className="flex items-center gap-1 text-[11px] text-danger font-medium mt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{manualModalError}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="pt-2 flex flex-col gap-2">
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleCancelManualModal}
                    className="min-h-[40px] px-3.5 py-2 text-xs font-semibold text-muted hover:text-ink bg-white hover:bg-surface-2 border border-line-strong rounded-control transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 bg-brand hover:bg-brand-dark text-white rounded-control text-xs font-semibold shadow-xs transition"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Apply</span>
                  </button>
                </div>

                {activeManualRow.isManualQuantity && (
                  <div className="border-t border-line pt-2 text-center">
                    <button
                      type="button"
                      onClick={handleResetToCalculated}
                      className="min-h-[38px] inline-flex items-center gap-1 text-xs text-brand hover:text-brand-dark font-semibold transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Return to calculated quantity</span>
                    </button>
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Product Autocomplete Dropdown Portaled to document.body */}
      {typeof document !== 'undefined' && openRow && dropdownPos && createPortal(
        <div
          ref={portalDropdownRef}
          role="listbox"
          id={`product-dropdown-${openRow.id}`}
          style={{
            position: 'fixed',
            top: `${dropdownPos.top}px`,
            left: `${dropdownPos.left}px`,
            width: `${dropdownPos.width}px`,
            maxHeight: `${dropdownPos.maxHeight}px`,
            zIndex: 9999,
          }}
          className="bg-white border border-line-strong rounded-card shadow-xl overflow-y-auto overscroll-contain touch-pan-y divide-y divide-line animate-in fade-in zoom-in-95 duration-100"
        >
          {getFilteredProducts(openRow.productSearch).length === 0 ? (
            <div className="p-3.5 text-xs text-muted text-center space-y-2.5">
              <div>No catalog products match &quot;{openRow.productSearch}&quot;.</div>
              {openRow.productSearch.trim() && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    handleConvertToCustom(openRow.id, openRow.productSearch.trim());
                  }}
                  className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-brand text-white rounded-control font-semibold text-xs hover:bg-brand-dark transition shadow-xs w-full"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add &quot;{openRow.productSearch.trim()}&quot; as custom item</span>
                </button>
              )}
            </div>
          ) : (
            <>
              {getFilteredProducts(openRow.productSearch).map((p, pIdx) => (
                <div
                  key={p.id}
                  role="option"
                  aria-selected={pIdx === openRow.highlightedProductIndex}
                  data-product-index={pIdx}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    handleSelectProduct(openRow.id, p);
                  }}
                  className={`min-h-[44px] p-3 cursor-pointer text-xs flex items-center justify-between transition ${
                    pIdx === openRow.highlightedProductIndex
                      ? 'bg-brand-soft text-brand-deep font-semibold'
                      : 'hover:bg-surface-2 text-ink active:bg-surface-2'
                  }`}
                >
                  <div className="pr-2 min-w-0">
                    <div className="font-semibold text-[13px] sm:text-xs leading-snug break-words">{p.name}</div>
                    <div className="text-[10.5px] text-muted flex flex-wrap items-center gap-x-1.5">
                      <span>{p.category}</span>
                      <span>&bull;</span>
                      {p.qtyMethod === 'SECTION_WEIGHT' && 'kgPerMetre' in p && p.kgPerMetre ? (
                        <span className="font-mono">{p.kgPerMetre} kg/m</span>
                      ) : (
                        <span className="font-mono">HSN {p.hsn}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {p.ratePerUnit > 0 ? (
                      <>
                        <span className="font-mono tabular-nums font-bold text-xs text-ink">₹{p.ratePerUnit}</span>
                        <span className="block text-[9px] text-muted">/{p.unit}</span>
                      </>
                    ) : (
                      <span className="text-[10px] font-semibold text-muted">per {p.unit}</span>
                    )}
                  </div>
                </div>
              ))}
              {openRow.productSearch.trim() && (
                <div
                  className="min-h-[44px] p-3 border-t border-line bg-surface-2/60 hover:bg-surface-2 active:bg-surface-2 cursor-pointer text-xs flex items-center justify-between text-brand font-semibold"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    handleConvertToCustom(openRow.id, openRow.productSearch.trim());
                  }}
                >
                  <span className="flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add &quot;{openRow.productSearch.trim()}&quot; as custom item</span>
                  </span>
                  <span className="text-[10px] text-muted font-normal font-mono">Custom</span>
                </div>
              )}
            </>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};
