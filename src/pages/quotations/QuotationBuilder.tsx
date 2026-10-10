import React, { useState, useEffect, useMemo, useId, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { getCustomers } from '../../services/customerService';
import { getProducts } from '../../services/productService';
import { getCompanySettings } from '../../services/settingsService';
import { createQuotation } from '../../services/quotationService';
import {
  calculateQuotationTotals,
  determineTaxMode,
  formatRoundOff,
  ENGINE_VERSION,
  type TaxMode,
} from '../../engine';
import type { Customer } from '../../types/customer';
import type { Product } from '../../types/product';
import type { CompanySettings } from '../../types/settings';
import type {
  Quotation,
  QuotationLine,
  CreateQuotationInput,
} from '../../types/quotation';
import {
  EditableQuotationTable,
  createInitialRow,
  computeRowCalculation,
  type EditableRowState,
} from '../../components/quotations/EditableQuotationTable';
import {
  ArrowLeft,
  Search,
  Save,
  User,
  Calendar,
  AlertCircle,
  CheckCircle2,
  X,
} from 'lucide-react';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

interface QuotationBuilderProps {
  onCancel: () => void;
  onSaved: (quotation: Quotation) => void;
}

export const QuotationBuilder: React.FC<QuotationBuilderProps> = ({
  onCancel,
  onSaved,
}) => {
  const { user, profile } = useAuth();

  // Master Data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [loadingMasters, setLoadingMasters] = useState<boolean>(true);
  const [masterError, setMasterError] = useState<string | null>(null);

  // Quotation Document Metadata
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [quotationDate, setQuotationDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Editable Table Rows
  const [rows, setRows] = useState<EditableRowState[]>([createInitialRow()]);

  // Customer Search & Selector
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState<boolean>(false);
  const customerSearchRef = useRef<HTMLDivElement>(null);

  // Close customer dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        customerSearchRef.current &&
        !customerSearchRef.current.contains(event.target as Node)
      ) {
        setIsCustomerDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Save State
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Accessible unique IDs
  const fieldIdDate = useId();

  // Load masters on mount
  useEffect(() => {
    const loadMasters = async () => {
      try {
        setLoadingMasters(true);
        setMasterError(null);
        const [loadedCustomers, loadedProducts, loadedCompany] = await Promise.all([
          getCustomers(),
          getProducts(),
          getCompanySettings(),
        ]);
        setCustomers(loadedCustomers);
        // Only active products can be added to new quotes
        setProducts(loadedProducts.filter((p) => p.active));
        setCompanySettings(loadedCompany);
      } catch (err: unknown) {
        console.error('Failed to load masters for quotation builder:', err);
        const msg = err instanceof Error ? err.message : 'Error loading catalog/customer data';
        setMasterError(msg);
      } finally {
        setLoadingMasters(false);
      }
    };

    loadMasters();
  }, []);

  // Tax Mode calculation
  const taxMode: TaxMode = useMemo(() => {
    return determineTaxMode(selectedCustomer?.gstin, companySettings?.gstin);
  }, [selectedCustomer?.gstin, companySettings?.gstin]);

  // Valid lines derived from editable table rows
  const validLines = useMemo(() => {
    return rows
      .map((r) => r.calculatedLine)
      .filter((l): l is QuotationLine => l !== null);
  }, [rows]);

  // Quotation Document Totals (computed using Phase 2 engine)
  const totals = useMemo(() => {
    return calculateQuotationTotals(validLines, taxMode, true);
  }, [validLines, taxMode]);

  // Keep row calculations in sync with active taxMode
  useEffect(() => {
    setRows((prev) =>
      prev.map((r) => {
        const { calculatedLine, validationError } = computeRowCalculation(r, taxMode);
        return { ...r, calculatedLine, validationError };
      })
    );
  }, [taxMode]);

  // Filtered customer list for selection
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers;
    const q = customerSearch.toLowerCase().trim();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.gstin && c.gstin.toLowerCase().includes(q)) ||
        (c.phone && c.phone.toLowerCase().includes(q))
    );
  }, [customers, customerSearch]);

  // Row Management
  const handleAddRow = () => {
    setRows((prev) => [...prev, createInitialRow()]);
  };

  const handleRemoveRow = (id: string) => {
    setRows((prev) => {
      const next = prev.filter((r) => r.id !== id);
      return next.length === 0 ? [createInitialRow()] : next;
    });
  };

  const handleDuplicateRow = (id: string) => {
    setRows((prev) => {
      const target = prev.find((r) => r.id === id);
      if (!target) return prev;
      const duplicated: EditableRowState = {
        ...target,
        id: `row_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      };
      return [...prev, duplicated];
    });
  };

  // Atomic Save Quotation
  const handleSaveQuotation = async () => {
    if (isSaving) return;

    if (!selectedCustomer) {
      setSaveError('Please select a customer before saving the quotation.');
      return;
    }

    if (validLines.length === 0) {
      setSaveError('Quotation must contain at least one valid line item.');
      return;
    }

    const hasIncompleteRow = rows.some((r) => r.product && (!r.calculatedLine || r.validationError));
    if (hasIncompleteRow) {
      setSaveError('Please correct line errors before saving the quotation.');
      return;
    }

    const hasInvalidLine = validLines.some((l) => l.quantity <= 0 || l.rate <= 0);
    if (hasInvalidLine) {
      setSaveError('Quotation contains invalid line items with zero quantity or rate.');
      return;
    }

    if (!companySettings) {
      setSaveError('Company settings must be configured before issuing quotations.');
      return;
    }

    try {
      setIsSaving(true);
      setSaveError(null);

      const quotationPayload: CreateQuotationInput = {
        revision: 1,
        quotationDate,
        customer: {
          id: selectedCustomer.id,
          name: selectedCustomer.name,
          gstin: selectedCustomer.gstin,
          phone: selectedCustomer.phone,
          address: selectedCustomer.address,
        },
        company: companySettings,
        lines: validLines,
        taxMode,
        totalKgs: totals.totalKgs.toNumber(),
        totalNos: totals.totalNos.toNumber(),
        totalSqMtr: totals.totalSqMtr.toNumber(),
        totalRMtr: totals.totalRMtr.toNumber(),
        totalFt: totals.totalFt.toNumber(),
        subtotal: totals.subtotal.toNumber(),
        taxableValue: totals.subtotal.toNumber(),
        cgstTotal: totals.cgstTotal.toNumber(),
        sgstTotal: totals.sgstTotal.toNumber(),
        igstTotal: totals.igstTotal.toNumber(),
        totalTax: totals.totalTax.toNumber(),
        taxSummary: totals.taxSummary,
        grandTotal: totals.grandTotal.toNumber(),
        roundOff: totals.roundOff.toNumber(),
        payableAmount: totals.payableAmount.toNumber(),
        amountInWords: totals.amountInWords,
        terms: companySettings.defaultTerms || [],
        createdByUid: user?.uid || 'anonymous',
        createdByName: profile?.name || user?.email || 'Sales Team',
        engineVersion: ENGINE_VERSION,
      };

      const result = await createQuotation(quotationPayload);

      setSaveSuccessMessage(`Quotation ${result.quotationNumber} saved successfully.`);

      const completeSavedQuote: Quotation = {
        ...quotationPayload,
        id: result.id,
        quotationNumber: result.quotationNumber,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Notify parent to open preview or switch view
      setTimeout(() => {
        onSaved(completeSavedQuote);
      }, 1000);
    } catch (err: unknown) {
      console.error('[QuotationBuilder] Save quotation error:', err);
      setSaveError('Unable to save quotation. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loadingMasters) {
    return (
      <div className="bg-white rounded-card border border-line-strong p-16 text-center shadow-xs">
        <LoadingSpinner label="Loading customer directory and product catalog..." size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      {/* Top Navigation Header */}
      <div className="border-b border-line pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="p-1.5 text-muted hover:text-ink hover:bg-surface-2 rounded-control border border-line-strong transition"
            title="Return to Quotation Register"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-ink tracking-tight flex items-center gap-2.5">
              <span>New quotation</span>
              <span className="text-[10px] font-mono font-bold uppercase text-brand bg-brand-soft px-2 py-0.5 rounded-control border border-brand/20">
                Draft
              </span>
            </h1>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {masterError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-control text-danger text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-danger" />
          <span>{masterError}</span>
        </div>
      )}

      {saveError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-control text-danger text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-danger" />
            <span>{saveError}</span>
          </div>
          <button onClick={() => setSaveError(null)} className="text-danger/60 hover:text-danger">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {saveSuccessMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-control text-ok text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-ok shrink-0" />
          <span className="font-semibold">{saveSuccessMessage}</span>
        </div>
      )}

      {/* Section 1: Customer Selection & Quotation Date */}
      <div className={`bg-white p-4 sm:p-5 rounded-card border border-line-strong shadow-xs space-y-4 relative ${isCustomerDropdownOpen ? 'z-40' : 'z-20'}`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Customer Selection */}
          <div className="md:col-span-2 space-y-1.5">
            <label className="block text-[10.5px] font-semibold text-faint uppercase tracking-wider">
              Customer / Client <span className="text-danger">*</span>
            </label>

            {selectedCustomer ? (
              <div className="p-3.5 rounded-control border border-line-strong bg-surface-2 flex items-start justify-between">
                <div className="space-y-1 text-xs">
                  <div className="font-bold text-ink flex items-center gap-2">
                    <User className="w-4 h-4 text-brand" />
                    <span>{selectedCustomer.name}</span>
                    <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-control bg-brand-soft text-brand border border-brand/20">
                      {taxMode === 'intra' ? 'Intra-State (CGST+SGST)' : 'Inter-State (IGST)'}
                    </span>
                  </div>
                  <div className="text-muted space-x-3 text-[11px]">
                    {selectedCustomer.gstin ? (
                      <span>
                        GSTIN: <strong className="font-mono text-ink font-semibold">{selectedCustomer.gstin}</strong>
                      </span>
                    ) : (
                      <span className="text-faint italic">Unregistered Buyer</span>
                    )}
                    {selectedCustomer.phone && <span>Phone: {selectedCustomer.phone}</span>}
                    {selectedCustomer.city && <span>City: {selectedCustomer.city}</span>}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="text-xs text-brand hover:text-brand-dark font-semibold underline ml-2"
                >
                  Change
                </button>
              </div>
            ) : (
              <div ref={customerSearchRef} className="relative">
                <Search className="w-4 h-4 text-faint absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search customer by name, GSTIN, or phone..."
                  value={customerSearch}
                  onFocus={() => setIsCustomerDropdownOpen(true)}
                  onClick={() => setIsCustomerDropdownOpen(true)}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    setIsCustomerDropdownOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setIsCustomerDropdownOpen(false);
                    }
                  }}
                  className="w-full pl-9 pr-3 py-2 text-[13.5px] rounded-control border border-line-strong focus:border-brand focus:ring-3 focus:ring-brand/15 text-ink bg-white"
                />

                {isCustomerDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-line-strong rounded-control shadow-lg z-50 max-h-56 overflow-y-auto">
                    {loadingMasters ? (
                      <div className="p-3 text-xs text-muted text-center">
                        Loading customers...
                      </div>
                    ) : filteredCustomers.length === 0 ? (
                      <div className="p-3 text-xs text-muted text-center">
                        No customers match &quot;{customerSearch}&quot;.
                      </div>
                    ) : (
                      filteredCustomers.map((cust) => (
                        <button
                          key={cust.id}
                          type="button"
                          onClick={() => {
                            setSelectedCustomer(cust);
                            setIsCustomerDropdownOpen(false);
                            setCustomerSearch('');
                          }}
                          className="w-full text-left p-3 hover:bg-surface-2 border-b border-line last:border-0 flex items-center justify-between text-xs transition"
                        >
                          <div>
                            <div className="font-semibold text-ink">{cust.name}</div>
                            <div className="text-[11px] text-muted">
                              {cust.gstin ? `GSTIN: ${cust.gstin}` : 'Unregistered'} &bull; {cust.phone || 'No phone'}
                            </div>
                          </div>
                          <span className="text-[10px] text-brand font-bold">Select &rarr;</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quotation Date */}
          <div>
            <label htmlFor={fieldIdDate} className="block text-[10.5px] font-semibold text-faint uppercase tracking-wider mb-1.5">
              Quotation Date <span className="text-danger">*</span>
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-faint absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id={fieldIdDate}
                type="date"
                value={quotationDate}
                onChange={(e) => setQuotationDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-[13.5px] rounded-control border border-line-strong focus:border-brand focus:ring-3 focus:ring-brand/15 font-mono tabular-nums text-ink bg-white"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Editable Quotation Lines Table */}
      <EditableQuotationTable
        products={products}
        taxMode={taxMode}
        rows={rows}
        onRowsChange={setRows}
        onAddRow={handleAddRow}
        onRemoveRow={handleRemoveRow}
        onDuplicateRow={handleDuplicateRow}
      />

      {/* Section 3: Live Totals & Summary Card */}
      {validLines.length > 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Physical Quantities & Words */}
            <div className="space-y-3">
              <div className="bg-white p-4 sm:p-5 rounded-card border border-line-strong shadow-xs">
                <div className="font-bold text-muted text-[10.5px] uppercase tracking-wider mb-2.5">
                  Quantity
                </div>
                <div className={`grid ${totals.totalNos.gt(0) ? 'grid-cols-2' : 'grid-cols-1'} gap-3 text-xs`}>
                  <div className="p-3 bg-surface-2 rounded-control border border-line-strong">
                    <span className="text-[10.5px] text-faint font-semibold block uppercase tracking-wider">Total Weight</span>
                    <span className="text-base font-mono tabular-nums font-bold text-ink">{totals.totalKgs.toFixed(2)} Kgs</span>
                  </div>
                  {totals.totalNos.gt(0) && (
                    <div className="p-3 bg-surface-2 rounded-control border border-line-strong">
                      <span className="text-[10.5px] text-faint font-semibold block uppercase tracking-wider">Qty in Nos</span>
                      <span className="text-base font-mono tabular-nums font-bold text-ink">{totals.totalNos.toString()} Nos</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Amount in Words (pale-blue box with blue left border) */}
              <div className="bg-brand-soft border-l-4 border-l-brand border border-line-strong p-3.5 rounded-control">
                <div className="text-[10.5px] uppercase font-bold text-faint tracking-wider mb-1">
                  Amount in Words
                </div>
                <div className="text-xs font-semibold text-ink italic leading-relaxed">{totals.amountInWords}</div>
              </div>
            </div>

            {/* Financial Breakdown Card (White card, clean label/value rows, grand total bold blue) */}
            <div className="bg-white border border-line-strong rounded-card shadow-xs overflow-hidden flex flex-col justify-between">
              <div className="p-4 space-y-2 text-xs">
                <div className="flex justify-between text-muted">
                  <span>Subtotal (Taxable Value):</span>
                  <span className="font-mono tabular-nums font-semibold text-ink">₹{totals.subtotal.toFixed(2)}</span>
                </div>

                {taxMode === 'intra' ? (
                  <>
                    <div className="flex justify-between text-muted">
                      <span>CGST (Central Tax):</span>
                      <span className="font-mono tabular-nums font-semibold text-ink">₹{totals.cgstTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted">
                      <span>SGST (State Tax):</span>
                      <span className="font-mono tabular-nums font-semibold text-ink">₹{totals.sgstTotal.toFixed(2)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between text-muted">
                    <span>IGST (Integrated Tax):</span>
                    <span className="font-mono tabular-nums font-semibold text-ink">₹{totals.igstTotal.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between text-muted border-t border-line pt-2">
                  <span>Grand Total:</span>
                  <span className="font-mono tabular-nums font-semibold text-ink">₹{totals.grandTotal.toFixed(2)}</span>
                </div>

                <div className="flex justify-between text-muted">
                  <span>Round-off:</span>
                  <span className="font-mono tabular-nums text-ink">
                    {formatRoundOff(totals.roundOff)}
                  </span>
                </div>
              </div>

              {/* Total Payable banner (Clean surface background with ~25px blue grand total) */}
              <div className="flex justify-between items-baseline border-t border-line bg-surface-2/60 p-4">
                <span className="text-xs font-bold uppercase tracking-wider text-muted">Total payable:</span>
                <span className="text-[25px] font-mono tabular-nums text-brand font-bold">
                  ₹{totals.payableAmount.toNumber().toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Final Action Bar */}
          <div className="bg-white p-4 rounded-card border border-line-strong shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-xs text-muted">
              {!selectedCustomer ? (
                <span className="text-warn font-medium flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-warn shrink-0" />
                  Select a customer above to finalize and issue this quotation.
                </span>
              ) : (
                <span className="text-muted">
                  Ready to issue official quotation for <strong className="text-ink font-semibold">{selectedCustomer.name}</strong>.
                </span>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-xs font-semibold text-muted hover:text-ink bg-white hover:bg-surface-2 border border-line-strong rounded-control shadow-xs transition"
              >
                Cancel Draft
              </button>
              <button
                type="button"
                onClick={handleSaveQuotation}
                disabled={isSaving || validLines.length === 0 || !selectedCustomer}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-brand hover:bg-brand-dark text-white rounded-control text-xs font-semibold shadow-xs transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <LoadingSpinner size="sm" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Quotation</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
