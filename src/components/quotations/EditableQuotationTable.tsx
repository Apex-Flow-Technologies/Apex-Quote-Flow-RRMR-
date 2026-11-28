import React, { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { Product, ProductUnit, CreateProductInput } from '../../types/product';
import { isTypedQuantityMethod } from '../../types/product';
import { ProductFormModal } from '../products/ProductFormModal';
import { oneOffProduct } from '../products/productForm';
import { createProduct } from '../../services/productService';
import { useAuth } from '../../hooks/useAuth';
import { formatQtyMethodLabel, type TaxMode } from '../../engine';
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

export {
  type RowLengthUnit,
  type EditableRowState,
  createInitialRow,
  createCustomRow,
  createSteelSizeRow,
  rowFromSavedLine,
  computeRowCalculation,
} from './quotationRows';
import { searchProducts } from './productSearch';
import {
  type RowLengthUnit,
  type EditableRowState,
  createInitialRow,
  computeRowCalculation,
  isRateHint,
  productDefaultLengthM,
  weightPreview,
  isLengthMethod,
  isSheetLike,
  createCustomRow,
  applySteelSize,
  itemTypeReset,
  rowMethod,
  flashingSheets,
  lineWidthFactor,
  workingText,
  STEEL_LENGTH_UNITS,
  switchSteelLengthUnit,
} from './quotationRows';
import { formatKgPerMetre } from '../../engine/steel';
import { STEEL_SIZE_KINDS, STEEL_SIZE_KIND_ORDER, ITEM_GROUPS, fieldUnit, weightRateText, parseSteelSize, type SteelSizeKind } from './steelSize';
import { SUGGESTED_UNITS } from '../../types/product';
import { approxLengths } from '../../utils/steelLine';

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

  // Custom Item: the same form as adding a product
  const { isAdmin } = useAuth();
  const [isCustomModalOpen, setIsCustomModalOpen] = useState<boolean>(false);

  const handleAddCustomItem = async (payload: CreateProductInput, opts: { saveToMaster: boolean }) => {
    let product: Product;
    if (opts.saveToMaster) {
      const id = await createProduct(payload);
      product = { ...payload, id } as Product;
    } else {
      product = oneOffProduct(payload);
    }
    const base = createInitialRow(undefined, product);
    const { calculatedLine, validationError } = computeRowCalculation(base, taxMode, widthFactor, feetToMetre);
    const newRow: EditableRowState = { ...base, calculatedLine, validationError };
    // Fill the empty last row if there is one, otherwise add a new line
    const last = rows[rows.length - 1];
    const lastIsBlank = last && !last.product && !last.isCustomItem && !last.steelSize && !last.productSearch.trim();
    onRowsChange(lastIsBlank ? [...rows.slice(0, -1), newRow] : [...rows, newRow]);
    setIsCustomModalOpen(false);
  };

  // Custom item: an inline line where staff type the name, unit, quantity and rate
  const handleAddCustomLine = () => {
    const newRow = createCustomRow();
    onRowsChange([...rows, newRow]);
    setTimeout(() => getActiveInput(`${newRow.id}_customDesc`)?.focus(), 50);
  };

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

  /** Steel lines: sell by number of lengths, or type the weight in kg directly. */
  const setSteelEntry = (row: EditableRowState, mode: 'lengths' | 'kg') => {
    if (mode === 'kg') {
      if (row.isManualQuantity) return;
      const wp = weightPreview(row, widthFactor, feetToMetre);
      updateRow(row.id, { isManualQuantity: true, manualQuantity: wp ? String(wp.quantity) : '', nos: '1' });
    } else {
      if (!row.isManualQuantity) return;
      updateRow(row.id, { isManualQuantity: false, manualQuantity: '' });
    }
  };

  const updateRow = (rowId: string, updates: Partial<EditableRowState>) => {
    onRowsChange(
      rows.map((r) => {
        if (r.id !== rowId) return r;
        // A new size (or shape) on a "Steel by size" line rebuilds its steel product
        const updated = 'steelSize' in updates ? applySteelSize({ ...r, ...updates }) : { ...r, ...updates };
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
          lengthValue: '',
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
      if (product.qtyMethod === 'WEIGHT_PER_PIECE') {
        getActiveInput(`${rowId}_nos`)?.focus();
      } else if (product.qtyMethod === 'SHEET_WEIGHT' || product.qtyMethod === 'SQM') {
        getActiveInput(`${rowId}_lengthFeet`)?.focus();
      } else if (product.qtyMethod === 'SECTION_WEIGHT') {
        getActiveInput(`${rowId}_lengthMetres`)?.focus();
      } else {
        getActiveInput(`${rowId}_nos`)?.focus();
      }
    }, 50);
  };

  const getFilteredProducts = (query: string) => searchProducts(products, query);

  /** Item type picker + one box per detail (desktop cell or phone card). */
  const renderSteelSize = (row: EditableRowState, mobile: boolean) => {
    const size = row.steelSize!;
    const cfg = STEEL_SIZE_KINDS[size.shape];
    const parsed = parseSteelSize(size);
    const kgm = row.product && 'kgPerMetre' in row.product ? row.product.kgPerMetre : undefined;
    const sizeError = !parsed.ok && !parsed.missing ? parsed.error : null;
    const setDim = (key: string, value: string) => updateRow(row.id, { steelSize: { ...size, dims: { ...size.dims, [key]: value } } });
    const boxClass = mobile
      ? 'w-full h-10 px-2 text-sm font-semibold tabular-nums rounded-control border border-line-strong focus:border-brand focus:ring-2 focus:ring-brand/20 text-ink bg-white'
      : 'w-full py-1.5 px-1.5 text-xs font-semibold tabular-nums rounded-control border border-line-strong focus:border-brand focus:ring-1 focus:ring-brand text-ink bg-white';
    const cols = cfg.fields.length === 1 ? 'grid-cols-1' : cfg.fields.length === 2 || (mobile && cfg.fields.length > 3) ? 'grid-cols-2' : 'grid-cols-3';
    return (
      <div className={mobile ? 'space-y-2' : 'space-y-1.5'}>
        <select
          value={size.shape}
          onChange={(e) => {
            const shape = e.target.value as SteelSizeKind;
            updateRow(row.id, itemTypeReset(shape));
            setTimeout(() => getActiveInput(`${row.id}_steel_${STEEL_SIZE_KINDS[shape].fields[0].key}`)?.focus(), 30);
          }}
          className={
            mobile
              ? 'w-full h-10 px-2.5 text-sm font-semibold rounded-control border border-line-strong bg-white text-ink focus:border-brand'
              : 'w-full py-1.5 px-2 text-xs font-semibold rounded-control border border-line-strong bg-white text-ink focus:border-brand'
          }
          aria-label="Item type"
        >
          {!STEEL_SIZE_KIND_ORDER.includes(size.shape) && <option value={size.shape}>{cfg.label}</option>}
          {ITEM_GROUPS.map((g) => (
            <optgroup key={g.group} label={g.group}>
              {g.kinds.map((k) => (
                <option key={k} value={k}>
                  {STEEL_SIZE_KINDS[k].label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <div className={`grid gap-1.5 ${cols}`}>
          {cfg.fields.map((fd, i) => {
            const refKey = `${row.id}_steel_${fd.key}${mobile ? '_mobile' : ''}`;
            const next = cfg.fields[i + 1];
            const unit = fieldUnit(fd);
            const kind = fd.kind ?? 'number';
            const listId = `rr-dl-${row.id}-${fd.key}${mobile ? '-m' : ''}`;
            const onEnter = (e: React.KeyboardEvent) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              if (next) getActiveInput(`${row.id}_steel_${next.key}`)?.focus();
              else (getActiveInput(`${row.id}_lengthMetres`) || getActiveInput(`${row.id}_lengthFeet`) || getActiveInput(`${row.id}_nos`))?.focus();
            };
            return (
              <label key={fd.key} className="block min-w-0">
                <span className="block text-[11px] text-muted mb-0.5 truncate" title={fd.label}>
                  {fd.label}
                  {unit && ` (${unit})`}
                  {!fd.optional && kind !== 'number' && <span className="text-danger"> *</span>}
                </span>
                {kind === 'select' ? (
                  <select value={size.dims[fd.key] ?? ''} onChange={(e) => setDim(fd.key, e.target.value)} className={boxClass} aria-label={fd.label}>
                    <option value="">Pick…</option>
                    {(fd.options || []).map((o) => (
                      <option key={o} value={o}>
                        {o.replace(/x/g, ' × ')}
                      </option>
                    ))}
                  </select>
                ) : (
                  <>
                    <input
                      ref={(el) => {
                        if (el) inputRefs.current.set(refKey, el);
                        else inputRefs.current.delete(refKey);
                      }}
                      type={kind === 'number' ? 'number' : 'text'}
                      inputMode={kind === 'number' || fd.numeric ? 'decimal' : undefined}
                      step={kind === 'number' ? 'any' : undefined}
                      min={kind === 'number' ? '0' : undefined}
                      list={kind === 'combo' ? listId : undefined}
                      autoComplete="off"
                      value={size.dims[fd.key] ?? (fd.key === 'wf' ? String(lineWidthFactor(row, widthFactor)) : '')}
                      onChange={(e) => setDim(fd.key, e.target.value)}
                      onKeyDown={onEnter}
                      className={`${boxClass} ${kind === 'number' ? 'text-center' : ''}`}
                      aria-label={unit ? `${fd.label} in ${unit}` : fd.label}
                      title={unit ? `${fd.label} (${unit})` : fd.label}
                    />
                    {kind === 'combo' && (
                      <datalist id={listId}>
                        {(fd.options || []).map((o) => (
                          <option key={o} value={o} />
                        ))}
                      </datalist>
                    )}
                  </>
                )}
              </label>
            );
          })}
        </div>
        <div className="text-[11px] text-muted leading-snug">
          {row.product ? (
            <>
              <span className="text-ink font-medium">{row.product.name}</span>
              {kgm !== undefined && <span className="tabular-nums"> · {weightRateText(size.shape, kgm, size.dims)}</span>}
              {(() => {
                const working = workingText(row);
                return working ? <span className="block tabular-nums text-ink mt-0.5">{working}</span> : null;
              })()}
            </>
          ) : sizeError ? (
            <span className="text-danger font-medium">{sizeError}</span>
          ) : cfg.method === 'SECTION_WEIGHT' ? (
            'Enter the sizes; the weight is worked out.'
          ) : (
            'Pick from the list or type your own.'
          )}
        </div>
        <label className="flex items-center gap-1.5 text-[11px] text-muted">
          HSN
          <input
            type="text"
            inputMode="numeric"
            value={size.hsn ?? row.product?.hsn ?? ''}
            placeholder={row.product?.hsn}
            onChange={(e) => updateRow(row.id, { steelSize: { ...size, hsn: e.target.value } })}
            className={`${mobile ? 'w-28 h-8' : 'w-24 py-0.5'} px-1.5 text-[11px] tabular-nums rounded-control border border-line bg-surface-2 text-ink focus:bg-white focus:border-brand`}
            aria-label="HSN code"
          />
        </label>
        {/* The phone card shows line errors itself */}
        {!mobile && row.product && row.validationError && (
          <div className={isRateHint(row) ? 'p-2 bg-brand-soft border border-brand/20 rounded-control text-brand-deep text-xs flex items-center gap-1.5' : 'flex items-center gap-1 text-[11px] text-danger font-medium'}>
            <AlertCircle className="w-3 h-3 shrink-0" />
            <span>{isRateHint(row) ? `Enter the rate per ${cfg.unit === 'Kgs' ? 'kg' : cfg.unit} to price this line.` : row.validationError}</span>
          </div>
        )}
      </div>
    );
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
          const isFirstBox = ([k]: [string, HTMLInputElement]) => k.includes('_productSearch') || k.includes('_steel_');
          const lastSearch = nextRowInputs.filter((e) => isFirstBox(e) && !e[0].endsWith('_mobile')).pop() ||
            nextRowInputs.filter(isFirstBox).pop();
          if (lastSearch) lastSearch[1]?.focus();
        }, 60);
      } else {
        // Move to the next row's product or first editable field
        const nextRow = rows[rowIndex + 1];
        if (nextRow) {
          if (nextRow.isCustomItem) {
            getActiveInput(`${nextRow.id}_customDesc`)?.focus();
          } else if (nextRow.steelSize) {
            getActiveInput(`${nextRow.id}_steel_${STEEL_SIZE_KINDS[nextRow.steelSize.shape].fields[0].key}`)?.focus();
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
            onClick={handleAddCustomLine}
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

      <datalist id="rr-line-units">
        {SUGGESTED_UNITS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>

      {/* Desktop Table View (hidden on mobile, visible on md and up) */}
      <div className="hidden md:block overflow-x-auto min-w-full">
        <table className="w-full text-left border-collapse text-xs min-w-[1000px]">
          <thead>
            <tr className="bg-surface-2/70 border-b border-line text-faint font-semibold text-[10.5px] uppercase tracking-wider">
              <th className="py-2.5 px-3 text-center w-10">#</th>
              <th className="py-2.5 px-3 w-[340px]">Item & sizes</th>
              <th className="py-2.5 px-3 w-[180px]">Length of each piece</th>
              <th className="py-2.5 px-3 text-center w-[75px]">Pieces</th>
              <th className="py-2.5 px-3 text-right w-[110px]">Billed qty</th>
              <th className="py-2.5 px-3 text-right w-[95px]">Rate ₹ / unit</th>
              <th className="py-2.5 px-3 text-right w-[130px]">Amount before GST</th>
              <th className="py-2.5 px-3 text-center w-[70px]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row, index) => {
              const filtered = getFilteredProducts(row.productSearch);
              const isCustom = Boolean(row.isCustomItem);
              const method = rowMethod(row);
              const isSqm = method === 'SQM';
              const isWeightPerPiece = method === 'WEIGHT_PER_PIECE';
              const isSheet = method === 'SHEET_WEIGHT';
              const isPipe = method === 'SECTION_WEIGHT';
              const isPiece = method === 'PIECE';
              const takesLengthUnit = isPipe || isSqm || isSheet; // m / mm / ft / in / ft + in
              const isFeetInches = !takesLengthUnit && isLengthMethod(method);
              const takesColour = isSheetLike(row.product) && !row.steelSize; // type lines have their own Colour box
              const hasError = Boolean(row.validationError);

              return (
                <tr
                  key={row.id}
                  className={`anim-row hover:bg-brand-tint/20 transition ${
                    hasError ? 'bg-rose-50/20' : ''
                  }`}
                >
                  {/* Row Number */}
                  <td className="py-3 px-3 text-center font-mono text-muted text-[11px] align-top pt-4">
                    {index + 1}
                  </td>

                  {/* Product Search & Selection */}
                  <td className="py-3 px-3 align-top">
                    {row.steelSize ? (
                      renderSteelSize(row, false)
                    ) : isCustom ? (
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
                                Section: {formatKgPerMetre(row.product.kgPerMetre)} kg/m
                              </div>
                            )}
                            {isWeightPerPiece && 'kgPerPiece' in row.product && (
                              <div className="text-[10px] text-faint">
                                Weight: {row.product.kgPerPiece} kg/pc
                              </div>
                            )}
                            {takesColour && (
                              <input
                                type="text"
                                value={row.colour ?? ''}
                                onChange={(e) => updateRow(row.id, { colour: e.target.value })}
                                placeholder="Colour (e.g. Blue, Brick Red)"
                                aria-label="Sheet colour"
                                maxLength={60}
                                className="mt-1 w-full max-w-[220px] py-1 px-2 text-xs rounded-control border border-line-strong focus:border-brand focus:ring-1 focus:ring-brand text-ink bg-white"
                              />
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
                          <input
                            type="text"
                            list="rr-line-units"
                            value={row.customUnit ?? 'Nos'}
                            onChange={(e) => updateRow(row.id, { customUnit: e.target.value as ProductUnit })}
                            className="w-20 py-1 px-1.5 text-xs font-semibold rounded-control border border-line-strong bg-white text-ink focus:border-brand"
                            aria-label="Unit"
                          />
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
                    ) : isFeetInches ? (
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
                        {isSqm && <div className="text-[10px] text-faint">Width: {lineWidthFactor(row, widthFactor)}</div>}
                      </div>
                    ) : takesLengthUnit ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          {row.lengthUnit !== 'ft_in' ? (
                            <div className="flex items-center gap-1">
                              <input
                                ref={(el) => {
                                  if (el) inputRefs.current.set(`${row.id}_lengthMetres`, el);
                                  else inputRefs.current.delete(`${row.id}_lengthMetres`);
                                }}
                                type="number"
                                inputMode="decimal"
                                step="any"
                                min="0"
                                value={row.lengthUnit === 'metres' ? row.lengthMetres : row.lengthValue ?? ''}
                                onChange={(e) => updateRow(row.id, row.lengthUnit === 'metres' ? { lengthMetres: e.target.value } : { lengthValue: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    inputRefs.current.get(`${row.id}_nos`)?.focus();
                                  }
                                }}
                                className="w-16 py-1.5 px-2 text-center text-xs font-mono tabular-nums font-bold rounded-control border border-line-strong focus:border-brand focus:ring-1 focus:ring-brand text-ink bg-white"
                                title="Length"
                              />
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

                          <select
                            value={row.lengthUnit}
                            onChange={(e) => updateRow(row.id, switchSteelLengthUnit(row, e.target.value as RowLengthUnit, feetToMetre))}
                            className="py-1 px-1 text-xs font-semibold rounded-control border border-line-strong bg-surface-2 text-ink focus:border-brand"
                            aria-label="Length unit"
                            title="Length unit"
                          >
                            {STEEL_LENGTH_UNITS.map((u) => (
                              <option key={u.value} value={u.value}>
                                {u.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        {isSqm && <div className="text-[10px] text-faint">Width: {lineWidthFactor(row, widthFactor)}</div>}
                      </div>
                    ) : isPiece ? (
                      <div className="text-muted text-xs pt-1.5">—</div>
                    ) : isTypedQuantityMethod(row.product?.qtyMethod) ? (
                      <div className="text-faint text-xs pt-1.5">Typed quantity</div>
                    ) : (
                      <div className="text-faint text-xs pt-1.5">Direct</div>
                    )}
                  </td>

                  {/* Nos Input */}
                  <td className="py-3 px-3 text-center align-top">
                    {isPipe && (
                      <div className="flex justify-center mb-1">
                        <div role="radiogroup" aria-label="Sell by" className="inline-flex p-0.5 bg-surface-2 border border-line rounded-control">
                          {(['lengths', 'kg'] as const).map((m) => {
                            const on = (m === 'kg') === row.isManualQuantity;
                            return (
                              <button
                                key={m}
                                type="button"
                                role="radio"
                                aria-checked={on}
                                onClick={() => setSteelEntry(row, m)}
                                title={m === 'kg' ? 'Type the weight in kg' : 'Enter number of lengths'}
                                className={`px-1.5 py-0.5 text-[10px] rounded-[4px] font-semibold ${on ? 'bg-white text-brand shadow-xs' : 'text-muted'}`}
                              >
                                {m === 'kg' ? 'kg' : 'pcs'}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {isPipe && row.isManualQuantity ? (
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        value={row.manualQuantity}
                        placeholder="kg"
                        onChange={(e) => updateRow(row.id, { manualQuantity: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            inputRefs.current.get(`${row.id}_rate`)?.focus();
                          }
                        }}
                        className="w-[72px] py-1.5 px-1.5 text-center text-xs font-mono tabular-nums font-bold rounded-control border border-brand/40 focus:border-brand focus:ring-1 focus:ring-brand text-ink bg-white"
                        title="Weight in kg"
                      />
                    ) : (
                    <input
                      ref={(el) => {
                        if (el) inputRefs.current.set(`${row.id}_nos`, el);
                        else inputRefs.current.delete(`${row.id}_nos`);
                      }}
                      type="number"
                      inputMode={isTypedQuantityMethod(row.product?.qtyMethod) ? 'decimal' : 'numeric'}
                      step={isTypedQuantityMethod(row.product?.qtyMethod) ? 'any' : '1'}
                      min={isTypedQuantityMethod(row.product?.qtyMethod) ? '0' : '1'}
                      value={row.nos}
                      onChange={(e) => updateRow(row.id, { nos: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          inputRefs.current.get(`${row.id}_rate`)?.focus();
                        }
                      }}
                      className={`${isTypedQuantityMethod(row.product?.qtyMethod) ? 'w-[72px]' : 'w-14'} py-1.5 px-1.5 text-center text-xs font-mono tabular-nums font-bold rounded-control border border-line-strong focus:border-brand focus:ring-1 focus:ring-brand text-ink bg-white`}
                      title={row.product?.qtyMethod === 'SECTION_WEIGHT' ? 'Number of lengths (pieces)' : isTypedQuantityMethod(row.product?.qtyMethod) ? `Quantity (${row.product?.unit})` : 'Number of pieces (Nos)'}
                    />
                    )}
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
                            {row.calculatedLine.perPieceQuantity > 0 && !row.isManualQuantity && !flashingSheets(row) && (
                              <div className="text-[10px] text-faint font-mono tabular-nums">
                                {row.calculatedLine.perPieceQuantity} {row.calculatedLine.unit}/pc
                              </div>
                            )}
                            {isPipe && row.isManualQuantity && approxLengths(row.calculatedLine.quantity, row.calculatedLine.perPieceQuantity) !== null && (
                              <div className="text-[10px] text-faint font-mono tabular-nums">
                                ≈ {approxLengths(row.calculatedLine.quantity, row.calculatedLine.perPieceQuantity)} lengths
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

                        {row.isManualQuantity && !isPipe && (
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
                    ) : (() => {
                      const wp = weightPreview(row, widthFactor, feetToMetre);
                      return wp ? (
                        <div className="text-right">
                          <div className="font-mono tabular-nums font-bold text-ink text-xs">
                            {wp.quantity.toFixed(2)} <span className="font-medium text-muted text-[11px]">{wp.unit}</span>
                          </div>
                          <div className="text-[10px] text-faint font-mono tabular-nums">{wp.perPiece} {wp.unit}/pc</div>
                        </div>
                      ) : (
                        <span className="text-faint text-xs">—</span>
                      );
                    })()}
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
                        placeholder={row.product && row.product.ratePerUnit > 0 ? String(row.product.ratePerUnit) : /^kg/i.test(row.product?.unit || '') ? '₹ per kg' : 'Enter rate'}
                        onChange={(e) => updateRow(row.id, { rate: e.target.value })}
                        onKeyDown={(e) => handleKeyDownRate(e, index)}
                        className="w-full py-1.5 px-2 text-right text-xs font-mono tabular-nums font-bold rounded-control border border-line-strong focus:border-brand focus:ring-1 focus:ring-brand text-ink bg-white"
                        title={`Rate per ${row.product && !row.isCustomItem ? (/^kg/i.test(row.product.unit) ? 'kg' : row.product.unit) : 'unit'} (₹). Press Enter to add next line.`}
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
          const method = rowMethod(row);
          const isSqm = method === 'SQM';
          const isWeightPerPiece = method === 'WEIGHT_PER_PIECE';
          const isSheet = method === 'SHEET_WEIGHT';
          const isPipe = method === 'SECTION_WEIGHT';
          const takesLengthUnit = isPipe || isSqm || isSheet; // m / mm / ft / in / ft + in
              const isFeetInches = !takesLengthUnit && isLengthMethod(method);
          const takesColour = isSheetLike(row.product) && !row.steelSize; // type lines have their own Colour box
          const hasError = Boolean(row.validationError);

          return (
            <div
              key={`mobile_${row.id}`}
              className={`anim-row p-3.5 space-y-3 transition ${
                hasError ? 'bg-rose-50/20' : 'bg-white'
              }`}
            >
              {/* Card Header: Item #, Method Badge, Manual Pill, Actions */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <span className="w-6 h-6 rounded-full bg-surface-2 border border-line-strong flex items-center justify-center font-mono text-[11px] font-bold text-ink shrink-0">
                    {index + 1}
                  </span>
                  {row.steelSize ? (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-control bg-brand-soft text-brand border border-brand/20 shrink-0">
                      {STEEL_SIZE_KINDS[row.steelSize.shape].label}
                    </span>
                  ) : isCustom ? (
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
              {row.steelSize ? (
                renderSteelSize(row, true)
              ) : isCustom ? (
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
                              <span>{formatKgPerMetre(row.product.kgPerMetre)} kg/m</span>
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
                  <input
                    type="text"
                    list="rr-line-units"
                    value={row.customUnit ?? 'Nos'}
                    onChange={(e) => updateRow(row.id, { customUnit: e.target.value as ProductUnit })}
                    className="w-28 h-10 px-3 text-xs font-semibold rounded-control border border-line-strong bg-white text-ink focus:border-brand"
                    aria-label="Unit"
                  />
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
              ) : isFeetInches ? (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10.5px] font-semibold text-faint uppercase tracking-wider">
                      {isSheet || isSqm ? 'Sheet Length' : 'Length'}
                    </label>
                    {isSqm && <span className="text-[11px] text-muted">Width: {lineWidthFactor(row, widthFactor)}</span>}
                  </div>
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
              ) : takesLengthUnit ? (
                <div className="space-y-1.5 pt-1">
                  {isPipe && (
                  <div className="flex items-center justify-between gap-2 pb-1.5">
                    <span className="text-[10.5px] font-semibold text-faint uppercase tracking-wider">Sell by</span>
                    <div role="radiogroup" aria-label="Sell by" className="inline-flex p-0.5 bg-surface-2 border border-line rounded-control">
                    {(['lengths', 'kg'] as const).map((m) => {
                      const on = (m === 'kg') === row.isManualQuantity;
                      return (
                        <button
                          key={m}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => setSteelEntry(row, m)}
                          className={`min-h-[34px] text-xs px-2.5 rounded-[5px] font-semibold transition ${on ? 'bg-white text-brand shadow-xs border border-line-strong' : 'text-muted border border-transparent'}`}
                        >
                          {m === 'kg' ? 'By kg' : 'By lengths'}
                        </button>
                      );
                    })}
                  </div>
                  </div>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[10.5px] font-semibold text-faint uppercase tracking-wider">
                      {row.isManualQuantity ? 'Bar length' : isSqm || isSheet ? 'Sheet length' : 'Length'}
                      {isSqm && <span className="ml-2 normal-case tracking-normal font-normal text-muted">Width: {lineWidthFactor(row, widthFactor)}</span>}
                    </label>
                    <select
                            value={row.lengthUnit}
                            onChange={(e) => updateRow(row.id, switchSteelLengthUnit(row, e.target.value as RowLengthUnit, feetToMetre))}
                            className="h-9 px-2 text-xs font-semibold rounded-control border border-line-strong bg-surface-2 text-ink focus:border-brand"
                            aria-label="Length unit"
                            title="Length unit"
                          >
                            {STEEL_LENGTH_UNITS.map((u) => (
                              <option key={u.value} value={u.value}>
                                {u.label}
                              </option>
                            ))}
                          </select>
                  </div>
                  {row.lengthUnit !== 'ft_in' ? (
                    <div className="flex items-center gap-2">
                      <input
                        ref={(el) => {
                          if (el) inputRefs.current.set(`${row.id}_lengthMetres_mobile`, el);
                          else inputRefs.current.delete(`${row.id}_lengthMetres_mobile`);
                        }}
                        type="number"
                        inputMode="decimal"
                        step="any"
                        min="0"
                        value={row.lengthUnit === 'metres' ? row.lengthMetres : row.lengthValue ?? ''}
                        onChange={(e) => updateRow(row.id, row.lengthUnit === 'metres' ? { lengthMetres: e.target.value } : { lengthValue: e.target.value })}
                        className="flex-1 min-w-0 w-full h-10 px-3 text-center text-sm font-mono tabular-nums font-bold rounded-control border border-line-strong focus:border-brand focus:ring-2 focus:ring-brand/20 text-ink bg-white"
                        placeholder="6"
                      />
                      <span className="font-semibold text-muted text-xs">{row.lengthUnit === 'metres' ? 'm' : row.lengthUnit}</span>
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

              {takesColour && (
                <div className="space-y-1">
                  <label htmlFor={`${row.id}_colour_mobile`} className="block text-[10.5px] font-semibold text-faint uppercase tracking-wider">
                    Sheet Colour
                  </label>
                  <input
                    id={`${row.id}_colour_mobile`}
                    type="text"
                    value={row.colour ?? ''}
                    onChange={(e) => updateRow(row.id, { colour: e.target.value })}
                    placeholder="e.g. Blue, Brick Red"
                    maxLength={60}
                    className="w-full h-10 px-3 text-sm rounded-control border border-line-strong focus:border-brand focus:ring-2 focus:ring-brand/20 text-ink bg-white"
                  />
                </div>
              )}

              {/* Pieces (Nos) and Rate Grid */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                {isPipe && row.isManualQuantity ? (
                <div className="space-y-1">
                  <label className="block text-[10.5px] font-semibold text-faint uppercase tracking-wider">
                    Weight (kg) <span className="text-danger">*</span>
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={row.manualQuantity}
                    placeholder="e.g. 500"
                    onChange={(e) => updateRow(row.id, { manualQuantity: e.target.value })}
                    className="w-full h-10 px-2.5 text-center text-sm font-mono tabular-nums font-bold rounded-control border border-line-strong focus:border-brand focus:ring-2 focus:ring-brand/20 text-ink bg-white"
                  />
                </div>
                ) : (
                <div className="space-y-1">
                  <label className="block text-[10.5px] font-semibold text-faint uppercase tracking-wider">
                    {row.product?.qtyMethod === 'SECTION_WEIGHT' ? 'No. of lengths' : isTypedQuantityMethod(row.product?.qtyMethod) ? `Quantity (${row.product?.unit})` : 'Pieces (Nos)'} <span className="text-danger">*</span>
                  </label>
                  <input
                    ref={(el) => {
                      if (el) inputRefs.current.set(`${row.id}_nos_mobile`, el);
                      else inputRefs.current.delete(`${row.id}_nos_mobile`);
                    }}
                    type="number"
                    inputMode={isTypedQuantityMethod(row.product?.qtyMethod) ? 'decimal' : 'numeric'}
                    step={isTypedQuantityMethod(row.product?.qtyMethod) ? 'any' : '1'}
                    min={isTypedQuantityMethod(row.product?.qtyMethod) ? '0' : '1'}
                    value={row.nos}
                    onChange={(e) => updateRow(row.id, { nos: e.target.value })}
                    className="w-full h-10 px-2.5 text-center text-sm font-mono tabular-nums font-bold rounded-control border border-line-strong focus:border-brand focus:ring-2 focus:ring-brand/20 text-ink bg-white"
                  />
                </div>
                )}

                <div className="space-y-1">
                  <label className="block text-[10.5px] font-semibold text-faint uppercase tracking-wider">
                    {row.product && !row.isCustomItem ? `Rate / ${/^kg/i.test(row.product.unit) ? 'kg' : row.product.unit} (₹)` : 'Rate / Unit (₹)'}
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
                    placeholder={row.product && row.product.ratePerUnit > 0 ? String(row.product.ratePerUnit) : /^kg/i.test(row.product?.unit || '') ? '₹ per kg' : 'Enter rate'}
                    onChange={(e) => updateRow(row.id, { rate: e.target.value })}
                    className="w-full h-10 px-2.5 text-right text-sm font-mono tabular-nums font-bold rounded-control border border-line-strong focus:border-brand focus:ring-2 focus:ring-brand/20 text-ink bg-white"
                  />
                </div>
              </div>

              {/* Calculated Summary Box */}
              <div className="p-3 bg-surface-2 rounded-control border border-line flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-[10px] text-faint font-semibold uppercase tracking-wider block">
                    {row.product?.qtyMethod === 'SECTION_WEIGHT' ? 'Total Weight' : 'Total Quantity'}
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono tabular-nums font-bold text-ink text-sm">
                      {(() => {
                        if (row.calculatedLine) return `${Number(row.calculatedLine.quantity).toFixed(2)} ${row.calculatedLine.unit}`;
                        const wp = weightPreview(row, widthFactor, feetToMetre);
                        return wp ? `${wp.quantity.toFixed(2)} ${wp.unit}` : '—';
                      })()}
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
                  {(() => {
                    const wp = weightPreview(row, widthFactor, feetToMetre);
                    if (!wp) return null;
                    if (row.isManualQuantity) {
                      if (!isPipe) return null;
                      const n = approxLengths(wp.quantity, wp.perPiece);
                      return n === null ? null : (
                        <span className="block text-[11px] text-muted font-mono tabular-nums mt-0.5">
                          ≈ {n} lengths ({wp.perPiece} kg each)
                        </span>
                      );
                    }
                    return (
                      <span className="block text-[11px] text-muted font-mono tabular-nums mt-0.5">
                        {wp.perPiece} kg per length × {row.nos || 1}
                      </span>
                    );
                  })()}
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
            <span>Add Item Row</span>
          </button>
          <button
            type="button"
            onClick={handleAddCustomLine}
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
                        <span className="font-mono">{formatKgPerMetre(p.kgPerMetre)} kg/m</span>
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

      {isCustomModalOpen && (
        <ProductFormModal
          mode="quote"
          canSaveToMaster={isAdmin}
          onClose={() => setIsCustomModalOpen(false)}
          onSubmit={handleAddCustomItem}
        />
      )}
    </div>
  );
};
