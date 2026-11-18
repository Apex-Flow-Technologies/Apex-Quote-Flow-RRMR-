import React, { useState, useMemo, useId } from 'react';
import { Decimal } from 'decimal.js';
import { AlertCircle, X } from 'lucide-react';
import type { Product, QuantityMethod, CreateProductInput } from '../../types/product';
import {
  type SteelShape,
  STEEL_SHAPE_LABELS,
  STEEL_SHAPE_FIELDS,
  STEEL_DIM_LABELS,
  defaultLengthForShape,
} from '../../engine/steel';
import { LoadingSpinner } from '../common/LoadingSpinner';
import {
  type ProductFormData,
  INITIAL_FORM_STATE,
  customItemFormState,
  formDataFromProduct,
  unitForMethod,
  computeFormSteelKgPerMetre,
  validateProductForm,
  buildProductPayload,
} from './productForm';

interface ProductFormModalProps {
  /** 'master' = Products page (add / edit). 'quote' = custom item on a quotation. */
  mode: 'master' | 'quote';
  /** Product being edited (master mode only). */
  editingProduct?: Product | null;
  /** Pre-filled name for a quote custom item. */
  initialName?: string;
  /** Quote mode: show "Also save to Products" (admins only). */
  canSaveToMaster?: boolean;
  onClose: () => void;
  /** Throw to show the error in the form. */
  onSubmit: (payload: CreateProductInput, opts: { saveToMaster: boolean }) => Promise<void>;
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  mode,
  editingProduct = null,
  initialName = '',
  canSaveToMaster = false,
  onClose,
  onSubmit,
}) => {
  const isQuote = mode === 'quote';
  const [formData, setFormData] = useState<ProductFormData>(() =>
    editingProduct ? formDataFromProduct(editingProduct) : isQuote ? customItemFormState(initialName) : INITIAL_FORM_STATE
  );
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [saveToMaster, setSaveToMaster] = useState<boolean>(false);
  /** Base / min rate and Active only matter for the Products list. */
  const showMasterFields = !isQuote || saveToMaster;

  const fieldIdCategory = useId();
  const fieldIdQtyMethod = useId();
  const fieldIdName = useId();
  const fieldIdHsn = useId();
  const fieldIdRate = useId();
  const fieldIdGst = useId();
  const fieldIdThickness = useId();
  const fieldIdCoilWidth = useId();
  const fieldIdDensity = useId();
  const fieldIdKgPerMetre = useId();
  const fieldIdSteelShape = useId();
  const fieldIdDefaultLength = useId();
  const fieldIdWidthFactor = useId();
  const fieldIdKgPerPiece = useId();
  const fieldIdBaseRate = useId();
  const fieldIdMinRate = useId();

  // Live kg/m from the IS formula for the steel shape currently in the form
  const computedSteelKgPerMetre = useMemo(
    () => computeFormSteelKgPerMetre(formData),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [formData.qtyMethod, formData.steelShape, formData.steelDims]
  );

  const handleSteelShapeChange = (shape: SteelShape) => {
    setFormData((prev) => ({
      ...prev,
      steelShape: shape,
      steelDims: {},
      defaultLengthM: String(defaultLengthForShape(shape)),
    }));
  };

  const handleMethodChange = (newMethod: QuantityMethod) => {
    setFormData((prev) => ({ ...prev, qtyMethod: newMethod, unit: unitForMethod(newMethod) }));
  };

  const handleSubmitProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateProductForm(formData);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    try {
      setIsSubmitting(true);
      await onSubmit(buildProductPayload(formData), { saveToMaster: isQuote && saveToMaster });
    } catch (err: unknown) {
      console.error('Error saving product:', err);
      setFormErrors({ submit: err instanceof Error ? err.message : 'Failed to save product' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-ink/40 backdrop-blur-xs">
          <div className="bg-white rounded-card shadow-xl border border-line max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            {/* Modal Header */}
            <div className="p-4 bg-surface-2 border-b border-line flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-ink">
                  {isQuote ? 'Add Custom Item' : editingProduct ? `Edit Product: ${editingProduct.name}` : 'Add New Product Master'}
                </h3>
                <p className="text-[11px] text-muted">
                  {isQuote
                    ? 'Same options as a product. Used on this quotation only, unless you also save it to Products.'
                    : editingProduct
                    ? 'Updating master rates will apply to new quotes. Saved quotation lines preserve snapshots.'
                    : 'Configure product attributes and measurement formula for accurate quotation calculations.'}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="text-muted hover:text-ink p-1 rounded-control"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSubmitProduct} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
              {formErrors.submit && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-control text-rose-900 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-700" />
                  <span>{formErrors.submit}</span>
                </div>
              )}

              {/* Row 1: Quantity Method & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor={fieldIdQtyMethod} className="block text-[11px] font-semibold text-faint uppercase tracking-wider mb-1">
                    Calculation Method <span className="text-danger">*</span>
                  </label>
                  <select
                    id={fieldIdQtyMethod}
                    value={formData.qtyMethod}
                    onChange={(e) => handleMethodChange(e.target.value as QuantityMethod)}
                    className="w-full py-1.5 px-3 rounded-control border border-line-strong bg-white font-medium text-ink focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand disabled:bg-surface-2 disabled:text-muted"
                  >
                    <option value="SQM">Square Metre · Sq.Mtr (Length × Width Factor)</option>
                    <option value="WEIGHT_PER_PIECE">Structural Steel · kg/pc (Fixed piece weight)</option>
                    <option value="PIECE">Per piece (Fixed Nos rate)</option>
                    <option value="CUSTOM">Custom line / Service charge</option>
                    <option value="SHEET_WEIGHT">Sheet · by weight (Thickness × Coil Width)</option>
                    <option value="SECTION_WEIGHT">Steel / Pipe · by weight (kg per metre)</option>
                    <option value="AREA">By area (Sq.Mtr)</option>
                    <option value="RUNNING_LENGTH">By running metre (R.Mtr)</option>
                    <option value="LENGTH_FT">By feet (Ft)</option>
                    <option value="MANUAL">Manual</option>
                  </select>
                  {editingProduct && (
                    <span className="text-[10px] text-muted mt-0.5 block">
                      Note: Changing calculation method affects how quantities are calculated for new quotation lines.
                    </span>
                  )}
                </div>

                <div>
                  <label htmlFor={fieldIdCategory} className="block text-[11px] font-semibold text-faint uppercase tracking-wider mb-1">
                    Category <span className="text-danger">*</span>
                  </label>
                  <input
                    id={fieldIdCategory}
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="e.g. Crimp, Coloron, Pipe, Fixing"
                    className="w-full py-1.5 px-3 rounded-control border border-line-strong focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand text-ink font-medium"
                  />
                </div>
              </div>

              {/* Row 2: Product Name */}
              <div>
                <label htmlFor={fieldIdName} className="block text-[11px] font-semibold text-faint uppercase tracking-wider mb-1">
                  Product Name <span className="text-danger">*</span>
                </label>
                <input
                  id={fieldIdName}
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. JSW C+ CRIMP SHEET 8+1"
                  className={`w-full py-1.5 px-3 rounded-control border ${
                    formErrors.name ? 'border-rose-400 bg-rose-50/30' : 'border-line-strong'
                  } focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand text-ink font-semibold`}
                />
                {formErrors.name && (
                  <p className="text-danger text-[11px] mt-0.5">{formErrors.name}</p>
                )}
              </div>

              {/* Row 3: HSN Code & Rate & GST */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor={fieldIdHsn} className="block text-[11px] font-semibold text-faint uppercase tracking-wider mb-1">
                    HSN Code <span className="text-danger">*</span>
                  </label>
                  <input
                    id={fieldIdHsn}
                    type="text"
                    value={formData.hsn}
                    onChange={(e) => setFormData({ ...formData, hsn: e.target.value })}
                    placeholder="72109090"
                    className={`w-full py-1.5 px-3 rounded-control border font-mono tabular-nums font-semibold ${
                      formErrors.hsn ? 'border-rose-400 bg-rose-50/30' : 'border-line-strong'
                    } focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand text-ink`}
                  />
                  {formErrors.hsn && (
                    <p className="text-danger text-[11px] mt-0.5">{formErrors.hsn}</p>
                  )}
                </div>

                <div>
                  <label htmlFor={fieldIdRate} className="block text-[11px] font-semibold text-faint uppercase tracking-wider mb-1">
                    Rate per {formData.unit} (₹) <span className="text-danger">*</span>
                  </label>
                  <input
                    id={fieldIdRate}
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={formData.ratePerUnit}
                    onChange={(e) => setFormData({ ...formData, ratePerUnit: e.target.value })}
                    placeholder="117.00"
                    className={`w-full py-1.5 px-3 rounded-control border font-mono tabular-nums font-bold ${
                      formErrors.ratePerUnit ? 'border-rose-400 bg-rose-50/30' : 'border-line-strong'
                    } focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand text-ink`}
                  />
                  {formErrors.ratePerUnit && (
                    <p className="text-danger text-[11px] mt-0.5">{formErrors.ratePerUnit}</p>
                  )}
                </div>

                <div>
                  <label htmlFor={fieldIdGst} className="block text-[11px] font-semibold text-faint uppercase tracking-wider mb-1">
                    GST Rate (%) <span className="text-danger">*</span>
                  </label>
                  <input
                    id={fieldIdGst}
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    min="0"
                    value={formData.gstRate}
                    onChange={(e) => setFormData({ ...formData, gstRate: e.target.value })}
                    placeholder="18"
                    className={`w-full py-1.5 px-3 rounded-control border font-mono tabular-nums font-bold ${
                      formErrors.gstRate ? 'border-rose-400 bg-rose-50/30' : 'border-line-strong'
                    } focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand text-ink`}
                  />
                  {formErrors.gstRate && (
                    <p className="text-danger text-[11px] mt-0.5">{formErrors.gstRate}</p>
                  )}
                </div>
              </div>

              {/* Method-Specific Dynamic Fields */}
              {formData.qtyMethod === 'SQM' && (
                <div className="bg-surface-2 p-3.5 rounded-card border border-line space-y-3">
                  <div className="font-semibold text-ink text-xs flex items-center justify-between">
                    <span>Square Metre Parameters</span>
                    <span className="text-[10px] text-muted font-normal">
                      Formula: Length (ft) × 0.305 × Width Factor (1.08) × Nos = Sq.Mtr
                    </span>
                  </div>

                  {isQuote && !saveToMaster ? (
                    <p className="text-[11px] text-muted">Uses this quotation&rsquo;s width factor. Enter the length on the quote line.</p>
                  ) : (
                  <div>
                    <label htmlFor={fieldIdWidthFactor} className="block text-[11px] font-semibold text-faint uppercase tracking-wider mb-1">
                      Width Factor (default 1.08) <span className="text-danger">*</span>
                    </label>
                    <input
                      id={fieldIdWidthFactor}
                      type="number"
                      inputMode="decimal"
                      step="0.001"
                      value={formData.widthFactor}
                      onChange={(e) => setFormData({ ...formData, widthFactor: e.target.value })}
                      placeholder="1.08"
                      className="w-full py-1.5 px-3 rounded-control border border-line-strong bg-white font-mono tabular-nums font-semibold text-ink focus:outline-none focus:border-brand max-w-xs"
                    />
                    {formErrors.widthFactor && (
                      <p className="text-danger text-[10px] mt-0.5">{formErrors.widthFactor}</p>
                    )}
                  </div>
                  )}
                </div>
              )}

              {formData.qtyMethod === 'WEIGHT_PER_PIECE' && (
                <div className="bg-surface-2 p-3.5 rounded-card border border-line space-y-3">
                  <div className="font-semibold text-ink text-xs flex items-center justify-between">
                    <span>Structural Steel / Weight per Piece Parameters</span>
                    <span className="text-[10px] text-muted font-normal">
                      Formula: Nos × kg/pc = Total Weight (Kgs)
                    </span>
                  </div>

                  <div>
                    <label htmlFor={fieldIdKgPerPiece} className="block text-[11px] font-semibold text-faint uppercase tracking-wider mb-1">
                      Weight per Piece (kg/pc) <span className="text-danger">*</span>
                    </label>
                    <input
                      id={fieldIdKgPerPiece}
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={formData.kgPerPiece}
                      onChange={(e) => setFormData({ ...formData, kgPerPiece: e.target.value })}
                      placeholder="e.g. 40.00 (from structural steel weight chart)"
                      className="w-full py-1.5 px-3 rounded-control border border-line-strong bg-white font-mono tabular-nums font-semibold text-ink focus:outline-none focus:border-brand max-w-xs"
                    />
                    {formErrors.kgPerPiece && (
                      <p className="text-danger text-[10px] mt-0.5">{formErrors.kgPerPiece}</p>
                    )}
                  </div>
                </div>
              )}

              {formData.qtyMethod === 'SHEET_WEIGHT' && (
                <div className="bg-surface-2 p-3.5 rounded-card border border-line space-y-3">
                  <div className="font-semibold text-ink text-xs flex items-center justify-between">
                    <span>Sheet Weight Parameters</span>
                    <span className="text-[10px] text-muted font-normal">
                      Formula: Length (ft) × 0.3048 × Coil Width × Thickness × Density Factor
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label htmlFor={fieldIdThickness} className="block text-[11px] font-semibold text-faint uppercase tracking-wider mb-1">
                        Thickness (mm) <span className="text-danger">*</span>
                      </label>
                      <input
                        id={fieldIdThickness}
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={formData.thicknessMm}
                        onChange={(e) => setFormData({ ...formData, thicknessMm: e.target.value })}
                        placeholder="0.47"
                        className="w-full py-1.5 px-3 rounded-control border border-line-strong bg-white font-mono tabular-nums font-semibold text-ink focus:outline-none focus:border-brand"
                      />
                      {formErrors.thicknessMm && (
                        <p className="text-danger text-[10px] mt-0.5">{formErrors.thicknessMm}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor={fieldIdCoilWidth} className="block text-[11px] font-semibold text-faint uppercase tracking-wider mb-1">
                        Coil Width (m) <span className="text-danger">*</span>
                      </label>
                      <input
                        id={fieldIdCoilWidth}
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={formData.coilWidthM}
                        onChange={(e) => setFormData({ ...formData, coilWidthM: e.target.value })}
                        placeholder="1.06"
                        className="w-full py-1.5 px-3 rounded-control border border-line-strong bg-white font-mono tabular-nums font-semibold text-ink focus:outline-none focus:border-brand"
                      />
                      {formErrors.coilWidthM && (
                        <p className="text-danger text-[10px] mt-0.5">{formErrors.coilWidthM}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor={fieldIdDensity} className="block text-[11px] font-semibold text-faint uppercase tracking-wider mb-1">
                        Density Factor (kg/m²/mm)
                      </label>
                      <input
                        id={fieldIdDensity}
                        type="number"
                        inputMode="decimal"
                        step="0.001"
                        value={formData.densityFactor}
                        onChange={(e) => setFormData({ ...formData, densityFactor: e.target.value })}
                        placeholder="7.968"
                        className="w-full py-1.5 px-3 rounded-control border border-line-strong bg-white font-mono tabular-nums font-semibold text-ink focus:outline-none focus:border-brand"
                      />
                    </div>
                  </div>
                </div>
              )}

              {formData.qtyMethod === 'SECTION_WEIGHT' && (
                <div className="bg-surface-2 p-3.5 rounded-card border border-line space-y-3">
                  <div className="font-semibold text-ink text-xs flex items-center justify-between">
                    <span>Steel / Section Weight Parameters</span>
                    <span className="text-[10px] text-muted font-normal">
                      Kgs = Length (m) × kg/m × Nos
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor={fieldIdSteelShape} className="block text-[11px] font-semibold text-faint uppercase tracking-wider mb-1">
                        Steel Shape
                      </label>
                      <select
                        id={fieldIdSteelShape}
                        value={formData.steelShape}
                        onChange={(e) => handleSteelShapeChange(e.target.value as SteelShape)}
                        className="w-full py-1.5 px-3 rounded-control border border-line-strong bg-white font-medium text-ink focus:outline-none focus:border-brand"
                      >
                        {(Object.keys(STEEL_SHAPE_LABELS) as SteelShape[]).map((s) => (
                          <option key={s} value={s}>{STEEL_SHAPE_LABELS[s]}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor={fieldIdDefaultLength} className="block text-[11px] font-semibold text-faint uppercase tracking-wider mb-1">
                        Default Length (m)
                      </label>
                      <input
                        id={fieldIdDefaultLength}
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={formData.defaultLengthM}
                        onChange={(e) => setFormData({ ...formData, defaultLengthM: e.target.value })}
                        placeholder="6"
                        className="w-full py-1.5 px-3 rounded-control border border-line-strong bg-white font-mono tabular-nums text-ink focus:outline-none focus:border-brand"
                      />
                      <span className="text-[10px] text-muted mt-0.5 block">Pre-filled on quotes; editable per line.</span>
                      {formErrors.defaultLengthM && (
                        <p className="text-danger text-[10px] mt-0.5">{formErrors.defaultLengthM}</p>
                      )}
                    </div>
                  </div>

                  {formData.steelShape !== 'CHART' ? (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {STEEL_SHAPE_FIELDS[formData.steelShape].map((key) => (
                          <div key={key}>
                            <label className="block text-[11px] font-semibold text-faint uppercase tracking-wider mb-1">
                              {STEEL_DIM_LABELS[key]}
                              <input
                                type="number"
                                inputMode="decimal"
                                step="0.01"
                                value={formData.steelDims[key] ?? ''}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    steelDims: { ...formData.steelDims, [key]: e.target.value },
                                  })
                                }
                                className="mt-1 w-full py-1.5 px-3 rounded-control border border-line-strong bg-white font-mono tabular-nums text-ink normal-case tracking-normal font-normal focus:outline-none focus:border-brand"
                              />
                            </label>
                          </div>
                        ))}
                      </div>
                      <div className="text-xs text-ink">
                        Weight per metre (IS formula):{' '}
                        <strong className="font-mono tabular-nums">
                          {computedSteelKgPerMetre !== null ? `${computedSteelKgPerMetre} kg/m` : '—'}
                        </strong>
                        {computedSteelKgPerMetre !== null && formData.defaultLengthM.trim() !== '' && Number(formData.defaultLengthM) > 0 && (
                          <span className="text-muted">
                            {' '}&bull; {formData.defaultLengthM} m piece ≈{' '}
                            {new Decimal(computedSteelKgPerMetre).times(formData.defaultLengthM).toDecimalPlaces(2).toString()} kg
                          </span>
                        )}
                      </div>
                      {formErrors.steelDims && (
                        <p className="text-danger text-[10px] mt-0.5">{formErrors.steelDims}</p>
                      )}
                    </>
                  ) : (
                    <div>
                      <label htmlFor={fieldIdKgPerMetre} className="block text-[11px] font-semibold text-faint uppercase tracking-wider mb-1">
                        Weight per Metre (kg/m) <span className="text-danger">*</span>
                      </label>
                      <input
                        id={fieldIdKgPerMetre}
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={formData.kgPerMetre}
                        onChange={(e) => setFormData({ ...formData, kgPerMetre: e.target.value })}
                        placeholder="From IS chart, e.g. ISA 50×50×6 = 4.5"
                        className="w-full py-1.5 px-3 rounded-control border border-line-strong bg-white font-mono tabular-nums font-semibold text-ink focus:outline-none focus:border-brand max-w-xs"
                      />
                      {formErrors.kgPerMetre && (
                        <p className="text-danger text-[10px] mt-0.5">{formErrors.kgPerMetre}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {formData.qtyMethod === 'PIECE' && (
                <div className="bg-surface-2 p-3.5 rounded-card border border-line text-xs text-muted">
                  <div className="font-semibold text-ink mb-1">Piece / Accessory Item</div>
                  <p>
                    Calculated by direct quantity count (Nos). Measurement fields such as thickness and coil width are not required.
                  </p>
                </div>
              )}

              {isQuote && canSaveToMaster && (
                <label className="flex items-start gap-2 cursor-pointer pt-2 border-t border-line">
                  <input
                    type="checkbox"
                    checked={saveToMaster}
                    onChange={(e) => setSaveToMaster(e.target.checked)}
                    className="mt-0.5 rounded-control border-line-strong text-brand focus:ring-0 h-4 w-4"
                  />
                  <span>
                    <span className="font-semibold text-ink">Also save to Products</span>
                    <span className="block text-[11px] text-muted">So it can be picked from the list on future quotes.</span>
                  </span>
                </label>
              )}

              {/* Optional Rate Limits & Active Status */}
              {showMasterFields && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-line">
                <div>
                  <label htmlFor={fieldIdBaseRate} className="block text-[11px] font-semibold text-faint uppercase tracking-wider mb-1">Base Rate (₹)</label>
                  <input
                    id={fieldIdBaseRate}
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={formData.baseRate}
                    onChange={(e) => setFormData({ ...formData, baseRate: e.target.value })}
                    placeholder="Optional"
                    className="w-full py-1.5 px-3 rounded-control border border-line-strong font-mono tabular-nums text-xs text-ink focus:outline-none focus:border-brand"
                  />
                </div>

                <div>
                  <label htmlFor={fieldIdMinRate} className="block text-[11px] font-semibold text-faint uppercase tracking-wider mb-1">Min Rate (₹)</label>
                  <input
                    id={fieldIdMinRate}
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={formData.minRate}
                    onChange={(e) => setFormData({ ...formData, minRate: e.target.value })}
                    placeholder="Optional"
                    className="w-full py-1.5 px-3 rounded-control border border-line-strong font-mono tabular-nums text-xs text-ink focus:outline-none focus:border-brand"
                  />
                </div>

                <div className="flex items-center pt-4">
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-ink">
                    <input
                      type="checkbox"
                      checked={formData.active}
                      onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                      className="rounded-control border-line-strong text-brand focus:ring-0 h-4 w-4"
                    />
                    <span>Active Product</span>
                  </label>
                </div>
              </div>
              )}

              {/* Modal Actions */}
              <div className="pt-3 border-t border-line flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-muted hover:text-ink bg-white hover:bg-surface-2 border border-line-strong rounded-control font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-brand hover:bg-brand-dark text-white rounded-control font-bold shadow-xs transition disabled:opacity-60 flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <LoadingSpinner size="sm" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{isQuote ? 'Add to Quotation' : editingProduct ? 'Save Changes' : 'Create Product Master'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
  );
};
