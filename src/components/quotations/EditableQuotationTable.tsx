import React, { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { Product, QuantityMethod } from '../../types/product';
import type { QuotationLine, QuotationLineSnapshot } from '../../types/quotation';
import {
  calculateQuotationLine,
  validateLineDraft,
  formatQtyMethodLabel,
  type TaxMode,
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

export interface EditableRowState {
  id: string;
  product: Product | null;
  productSearch: string;
  isProductDropdownOpen: boolean;
  highlightedProductIndex: number;
  lengthFeet: string;
  lengthInches: string;
  lengthMetres: string;
  lengthUnit: 'ft_in' | 'metres';
  nos: string;
  rate: string;
  discountAmount: string;
  discountPct: string;
  isManualQuantity: boolean;
  manualQuantity: string;
  calculatedLine: QuotationLine | null;
  validationError: string | null;
}

export function createInitialRow(customId?: string, product?: Product): EditableRowState {
  const id = customId || `row_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const defaultRate = product ? String(product.ratePerUnit) : '';
  const defaultUnit = product?.qtyMethod === 'SECTION_WEIGHT' ? 'metres' : 'ft_in';

  return {
    id,
    product: product || null,
    productSearch: product ? product.name : '',
    isProductDropdownOpen: false,
    highlightedProductIndex: 0,
    lengthFeet: '8',
    lengthInches: '0',
    lengthMetres: '6',
    lengthUnit: defaultUnit,
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

export function computeRowCalculation(
  row: EditableRowState,
  taxMode: TaxMode
): { calculatedLine: QuotationLine | null; validationError: string | null } {
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
      densityFactor: 'densityFactor' in row.product ? row.product.densityFactor : undefined,
      rate: rateNum,
      gstRate: row.product.gstRate,
    };

    let lengthParam: { feet?: number; inches?: number; metres?: number } = {};
    if (row.product.qtyMethod === 'SHEET_WEIGHT' || row.lengthUnit === 'ft_in') {
      lengthParam = {
        feet: row.lengthFeet.trim() !== '' ? Number(row.lengthFeet) : 0,
        inches: row.lengthInches.trim() !== '' ? Number(row.lengthInches) : 0,
      };
    } else if (row.product.qtyMethod === 'SECTION_WEIGHT' && row.lengthUnit === 'metres') {
      lengthParam = {
        metres: row.lengthMetres.trim() !== '' ? Number(row.lengthMetres) : 0,
      };
    }

    const nosNum = row.nos.trim() !== '' ? Number(row.nos) : 1;

    const calcLine = calculateQuotationLine(
      {
        id: row.id,
        snapshot,
        length: lengthParam,
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
  onRowsChange: (newRows: EditableRowState[]) => void;
  onAddRow: () => void;
  onRemoveRow: (id: string) => void;
  onDuplicateRow: (id: string) => void;
}

export const EditableQuotationTable: React.FC<EditableQuotationTableProps> = ({
  products,
  taxMode,
  rows,
  onRowsChange,
  onAddRow,
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

  const updateDropdownPosition = useCallback(() => {
    if (!openRow) {
      setDropdownPos(null);
      return;
    }
    const inputEl = inputRefs.current.get(`${openRow.id}_productSearch`);
    if (!inputEl) {
      setDropdownPos(null);
      return;
    }

    const rect = inputEl.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      setDropdownPos(null);
      return;
    }

    const dropdownWidth = Math.max(rect.width, 340);
    let left = rect.left;
    if (left + dropdownWidth > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - dropdownWidth - 12);
    }

    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const desiredHeight = 240;

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
        top: rect.top - maxHeight - 4,
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
      const handleScrollOrResize = () => {
        updateDropdownPosition();
      };
      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);
      return () => {
        window.removeEventListener('scroll', handleScrollOrResize, true);
        window.removeEventListener('resize', handleScrollOrResize);
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
        const { calculatedLine, validationError } = computeRowCalculation(updated, taxMode);
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
    if (!row.product) return null;
    const mockRow: EditableRowState = {
      ...row,
      isManualQuantity: false,
      manualQuantity: '',
    };
    const { calculatedLine } = computeRowCalculation(mockRow, taxMode);
    return calculatedLine ? calculatedLine.quantity : null;
  };

  const handleOpenManualOverride = (row: EditableRowState) => {
    if (!row.product || !row.calculatedLine) return;
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

  const handleSelectProduct = (rowId: string, product: Product) => {
    onRowsChange(
      rows.map((r) => {
        if (r.id !== rowId) return r;
        const defaultRate = String(product.ratePerUnit);
        const defaultUnit = product.qtyMethod === 'SECTION_WEIGHT' ? 'metres' : 'ft_in';
        const updated: EditableRowState = {
          ...r,
          product,
          productSearch: product.name,
          isProductDropdownOpen: false,
          rate: defaultRate,
          lengthUnit: defaultUnit,
          lengthFeet: r.lengthFeet || '8',
          lengthInches: r.lengthInches || '0',
          lengthMetres: r.lengthMetres || '6',
          nos: r.nos || '1',
        };
        const { calculatedLine, validationError } = computeRowCalculation(updated, taxMode);
        return {
          ...updated,
          calculatedLine,
          validationError,
        };
      })
    );

    // Auto-advance focus to the next field (Feet, Metres, or Nos)
    setTimeout(() => {
      const row = rows.find((r) => r.id === rowId);
      if (!row) return;
      if (product.qtyMethod === 'SHEET_WEIGHT') {
        inputRefs.current.get(`${rowId}_lengthFeet`)?.focus();
      } else if (product.qtyMethod === 'SECTION_WEIGHT') {
        inputRefs.current.get(`${rowId}_lengthMetres`)?.focus();
      } else {
        inputRefs.current.get(`${rowId}_nos`)?.focus();
      }
    }, 50);
  };

  const getFilteredProducts = (query: string) => {
    if (!query.trim()) return products.slice(0, 15);
    const q = query.toLowerCase().trim();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.hsn.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    ).slice(0, 15);
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
          const lastSearch = nextRowInputs.filter(([k]) => k.endsWith('_productSearch')).pop();
          if (lastSearch) lastSearch[1]?.focus();
        }, 60);
      } else {
        // Move to the next row's product or first editable field
        const nextRow = rows[rowIndex + 1];
        if (nextRow) {
          if (!nextRow.product) {
            inputRefs.current.get(`${nextRow.id}_productSearch`)?.focus();
          } else {
            inputRefs.current.get(`${nextRow.id}_nos`)?.focus();
          }
        }
      }
    }
  };

  return (
    <div className="bg-white rounded-card border border-line-strong shadow-xs overflow-hidden relative z-20">
      {/* Header bar */}
      <div className="p-4 bg-surface-2 border-b border-line flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-brand" />
          <span className="font-bold text-ink text-xs uppercase tracking-wider">
            Quotation Line Items ({rows.filter((r) => r.calculatedLine !== null).length} items)
          </span>
          <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-control bg-brand-soft text-brand border border-brand/20">
            {taxMode === 'intra' ? 'CGST+SGST (Intra)' : 'IGST (Inter)'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onAddRow}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand hover:bg-brand-dark text-white rounded-control font-semibold text-xs shadow-xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add item</span>
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto min-w-full">
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
                        </div>
                      )}

                      {/* Row-level validation message */}
                      {row.validationError && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-danger font-medium">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span>{row.validationError}</span>
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Dimensions / Measurement Input */}
                  <td className="py-3 px-3 align-top">
                    {isSheet ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <div className="flex items-center gap-1">
                            <input
                              ref={(el) => {
                                if (el) inputRefs.current.set(`${row.id}_lengthFeet`, el);
                                else inputRefs.current.delete(`${row.id}_lengthFeet`);
                              }}
                              type="number"
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
                      `₹${Number(row.calculatedLine.taxableAmount).toFixed(2)}`
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

      {/* Table Footer with Quick Add Button and Keyboard Hints */}
      <div className="p-3 bg-surface-2 border-t border-line flex flex-wrap items-center justify-between gap-3 text-xs">
        <button
          type="button"
          onClick={onAddRow}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-surface-2 text-ink border border-line-strong rounded-control font-semibold text-xs shadow-xs transition"
        >
          <Plus className="w-3.5 h-3.5 text-brand" />
          <span>Add item row</span>
        </button>

        <div className="flex items-center gap-2 text-muted text-[11px]">
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
                <span className="font-semibold text-ink text-xs">{activeManualRow.product?.name}</span>
              </div>

              {/* Current Calculated Quantity Display */}
              <div className="p-2.5 rounded-control bg-surface-2 border border-line space-y-1">
                <span className="text-[10.5px] text-muted block font-medium">Calculated from dimensions:</span>
                <div className="font-mono tabular-nums font-bold text-ink text-sm">
                  {getCalculatedQuantityFromDimensions(activeManualRow) !== null
                    ? `${Number(getCalculatedQuantityFromDimensions(activeManualRow)).toFixed(2)} ${activeManualRow.product?.unit}`
                    : '—'}
                </div>
                {activeManualRow.calculatedLine && activeManualRow.calculatedLine.perPieceQuantity > 0 && (
                  <span className="text-[10px] text-faint font-mono block">
                    Formula: {activeManualRow.calculatedLine.perPieceQuantity} {activeManualRow.product?.unit}/pc × {activeManualRow.nos} pcs
                  </span>
                )}
              </div>

              {/* Editable Manual Quantity Field */}
              <div className="space-y-1">
                <label htmlFor="manual-qty-input" className="block text-xs font-semibold text-ink">
                  Override Quantity ({activeManualRow.product?.unit})
                </label>
                <input
                  id="manual-qty-input"
                  type="number"
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
                    className="px-3 py-1.5 text-xs font-semibold text-muted hover:text-ink bg-white hover:bg-surface-2 border border-line-strong rounded-control transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1 px-4 py-1.5 bg-brand hover:bg-brand-dark text-white rounded-control text-xs font-semibold shadow-xs transition"
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
                      className="inline-flex items-center gap-1 text-[11px] text-brand hover:text-brand-dark font-semibold transition"
                    >
                      <RotateCcw className="w-3 h-3" />
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
          className="bg-white border border-line-strong rounded-control shadow-xl overflow-y-auto divide-y divide-line animate-in fade-in zoom-in-95 duration-100"
        >
          {getFilteredProducts(openRow.productSearch).length === 0 ? (
            <div className="p-3 text-xs text-muted text-center">
              No active products match.
            </div>
          ) : (
            getFilteredProducts(openRow.productSearch).map((p, pIdx) => (
              <div
                key={p.id}
                role="option"
                aria-selected={pIdx === openRow.highlightedProductIndex}
                data-product-index={pIdx}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelectProduct(openRow.id, p);
                }}
                className={`p-2.5 cursor-pointer text-xs flex items-center justify-between transition ${
                  pIdx === openRow.highlightedProductIndex
                    ? 'bg-brand-soft text-brand-deep font-semibold'
                    : 'hover:bg-surface-2 text-ink'
                }`}
              >
                <div className="pr-2 min-w-0">
                  <div className="font-semibold truncate">{p.name}</div>
                  <div className="text-[10px] text-muted flex items-center gap-1.5">
                    <span>{p.category}</span>
                    <span>&bull;</span>
                    <span className="font-mono">HSN {p.hsn}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-mono tabular-nums font-bold text-xs text-ink">
                    ₹{p.ratePerUnit}
                  </span>
                  <span className="block text-[9px] text-muted">/{p.unit}</span>
                </div>
              </div>
            ))
          )}
        </div>,
        document.body
      )}
    </div>
  );
};
