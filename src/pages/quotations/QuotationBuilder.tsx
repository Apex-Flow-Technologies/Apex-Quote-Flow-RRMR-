import React, { useState, useEffect, useMemo, useId, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  getCustomersCached,
  getProductsCached,
  getCompanySettingsCached,
} from '../../services/masterDataCache';
import { createQuotation, reviseQuotation } from '../../services/quotationService';
import {
  calculateQuotationTotals,
  determineTaxMode,
  formatRoundOff,
  ENGINE_VERSION,
  type TaxMode,
} from '../../engine';
import type { Customer, CreateCustomerInput } from '../../types/customer';
import { createCustomer } from '../../services/customerService';
import { CustomerFormModal } from '../../components/customers/CustomerFormModal';
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
  rowFromSavedLine,
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
  UserPlus,
} from 'lucide-react';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import {
  type QuoteDraft,
  draftKey,
  loadDraft,
  saveDraft,
  clearDraft,
  parkDraft,
  rowsSignature,
} from '../../utils/quoteDraft';

export interface QuotationBuilderSource {
  quotation: Quotation;
  /** revise = same number, revision + 1; duplicate = new quotation with a new number */
  mode: 'revise' | 'duplicate';
}

interface QuotationBuilderProps {
  onCancel: () => void;
  onSaved: (quotation: Quotation) => void;
  source?: QuotationBuilderSource;
}

export const QuotationBuilder: React.FC<QuotationBuilderProps> = ({
  onCancel,
  onSaved,
  source,
}) => {
  const isRevise = source?.mode === 'revise';
  const { user, profile } = useAuth();

  // Unsaved draft kept on this device, so leaving the page does not lose the quote
  const draftSource = source
    ? { mode: source.mode, quotationId: source.quotation.id, revision: source.quotation.revision || 1 }
    : undefined;
  const dKey = draftKey(user?.uid || 'anon', draftSource);
  const [restoredDraft] = useState<QuoteDraft | null>(() => loadDraft(dKey));
  const [showRestoredNotice, setShowRestoredNotice] = useState<boolean>(Boolean(restoredDraft));
  const isSavedRef = useRef<boolean>(false);
  // True while the restored draft is in use (then every change is kept)
  const fromDraftRef = useRef<boolean>(Boolean(restoredDraft));
  const initialRows = (): EditableRowState[] =>
    source && source.quotation.lines.length > 0
      ? source.quotation.lines.map((l) => rowFromSavedLine(l))
      : [createInitialRow()];

  // Master Data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [loadingMasters, setLoadingMasters] = useState<boolean>(true);
  const [masterError, setMasterError] = useState<string | null>(null);

  // Quotation Document Metadata
  const freshDate = isRevise && source?.quotation.quotationDate ? source.quotation.quotationDate : new Date().toISOString().split('T')[0];
  const freshWidthFactor = source?.quotation.widthFactor ? String(source.quotation.widthFactor) : '1.08';
  const freshAdvance = isRevise && source?.quotation.advanceAmount ? String(source.quotation.advanceAmount) : '';
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(restoredDraft?.customer ?? null);
  const [quotationDate, setQuotationDate] = useState<string>(restoredDraft?.quotationDate ?? freshDate);
  const [widthFactor, setWidthFactor] = useState<string>(restoredDraft?.widthFactor ?? freshWidthFactor);
  const [isGstEnabled, setIsGstEnabled] = useState<boolean>(
    restoredDraft?.isGstEnabled ?? source?.quotation.isGstEnabled ?? true
  );
  const [advanceAmount, setAdvanceAmount] = useState<string>(restoredDraft?.advanceAmount ?? freshAdvance);

  // Editable Table Rows (restored draft, else pre-filled from the source quotation when revising / duplicating)
  const [rows, setRows] = useState<EditableRowState[]>(() =>
    restoredDraft && restoredDraft.rows.length > 0 ? restoredDraft.rows : initialRows()
  );
  // A revise / duplicate is only worth keeping as a draft once something was changed
  const [sourceBaseline] = useState<string>(() => rowsSignature(initialRows()));

  // Customer Search & Selector
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState<boolean>(false);
  const customerSearchRef = useRef<HTMLDivElement>(null);
  const [isNewCustomerOpen, setIsNewCustomerOpen] = useState<boolean>(false);

  // New customer straight from the quotation: saved to Customers, then picked
  const handleCreateCustomer = async (payload: CreateCustomerInput) => {
    const id = await createCustomer(payload);
    const created = { ...payload, id } as Customer;
    setCustomers((prev) => [...prev.filter((c) => c.id !== id), created].sort((a, b) => a.name.localeCompare(b.name)));
    setSelectedCustomer(created);
    setCustomerSearch('');
    setIsCustomerDropdownOpen(false);
    setIsNewCustomerOpen(false);
  };

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
        // Cached (instant) with background refresh from the server
        const [loadedCustomers, loadedProducts, loadedCompany] = await Promise.all([
          getCustomersCached((fresh) => setCustomers(fresh)),
          getProductsCached((fresh) => setProducts(fresh.filter((p) => p.active))),
          getCompanySettingsCached((fresh) => setCompanySettings(fresh)),
        ]);
        setCustomers(loadedCustomers);
        if (restoredDraft?.customer) {
          // Use the latest copy of the customer the draft was for
          const fresh = loadedCustomers.find((x) => x.id && x.id === restoredDraft.customer?.id);
          if (fresh) setSelectedCustomer(fresh);
        } else if (source) {
          const c = source.quotation.customer;
          const match = loadedCustomers.find((x) => x.id && x.id === c.id);
          setSelectedCustomer(match || ({ id: c.id || '', name: c.name, gstin: c.gstin, phone: c.phone, address: c.address } as Customer));
        }
        // Only active products can be added to new quotes
        setProducts(loadedProducts.filter((p) => p.active));
        setCompanySettings(loadedCompany);
        if (loadedCompany?.defaultWidthFactor && !source?.quotation.widthFactor && !restoredDraft) {
          setWidthFactor(String(loadedCompany.defaultWidthFactor));
        }
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

  const wfNum = useMemo(() => {
    const parsed = Number(widthFactor);
    return !isNaN(parsed) && parsed > 0 ? parsed : 1.08;
  }, [widthFactor]);

  const feetToMetreNum = useMemo(() => {
    return companySettings?.feetToMetre ?? 0.305;
  }, [companySettings?.feetToMetre]);

  // Keep the unsaved quote on this device as it is typed
  useEffect(() => {
    if (isSavedRef.current) return;
    if (source && !fromDraftRef.current) {
      const unchanged =
        rowsSignature(rows) === sourceBaseline &&
        (selectedCustomer?.id || '') === (source.quotation.customer.id || '') &&
        quotationDate === freshDate &&
        advanceAmount === freshAdvance &&
        isGstEnabled === (source.quotation.isGstEnabled ?? true);
      if (unchanged) return;
    }
    saveDraft(dKey, {
      source: draftSource,
      customer: selectedCustomer,
      quotationDate,
      widthFactor,
      isGstEnabled,
      advanceAmount,
      rows,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, selectedCustomer, quotationDate, widthFactor, isGstEnabled, advanceAmount]);

  const handleBack = () => {
    parkDraft(dKey);
    onCancel();
  };

  const handleDiscardDraft = () => {
    clearDraft(dKey);
    fromDraftRef.current = false;
    setShowRestoredNotice(false);
    setRows(initialRows());
    setQuotationDate(freshDate);
    setAdvanceAmount(freshAdvance);
    setIsGstEnabled(source?.quotation.isGstEnabled ?? true);
    setWidthFactor(
      source?.quotation.widthFactor
        ? String(source.quotation.widthFactor)
        : companySettings?.defaultWidthFactor
          ? String(companySettings.defaultWidthFactor)
          : '1.08'
    );
    if (source) {
      const c = source.quotation.customer;
      const match = customers.find((x) => x.id && x.id === c.id);
      setSelectedCustomer(match || ({ id: c.id || '', name: c.name, gstin: c.gstin, phone: c.phone, address: c.address } as Customer));
    } else {
      setSelectedCustomer(null);
    }
  };

  // Valid lines derived from editable table rows
  const validLines = useMemo(() => {
    return rows
      .map((r) => r.calculatedLine)
      .filter((l): l is QuotationLine => l !== null);
  }, [rows]);

  // Quotation Document Totals (computed using Phase 2 engine)
  const totals = useMemo(() => {
    const advNum = advanceAmount.trim() !== '' ? Number(advanceAmount) : undefined;
    const enableRoundOff = companySettings?.enableRoundOff ?? false;
    return calculateQuotationTotals(
      validLines,
      taxMode,
      enableRoundOff,
      isGstEnabled,
      advNum ?? 0
    );
  }, [validLines, taxMode, companySettings?.enableRoundOff, advanceAmount, isGstEnabled]);

  // Keep row calculations in sync with active taxMode and quotation parameters
  useEffect(() => {
    setRows((prev) =>
      prev.map((r) => {
        const { calculatedLine, validationError } = computeRowCalculation(r, taxMode, wfNum, feetToMetreNum);
        return { ...r, calculatedLine, validationError };
      })
    );
  }, [taxMode, wfNum, feetToMetreNum]);

  const handleWidthFactorChange = (val: string) => {
    setWidthFactor(val);
    const parsed = Number(val);
    const effectiveWf = !isNaN(parsed) && parsed > 0 ? parsed : 1.08;
    setRows((prev) =>
      prev.map((r) => {
        const { calculatedLine, validationError } = computeRowCalculation(r, taxMode, effectiveWf, feetToMetreNum);
        return { ...r, calculatedLine, validationError };
      })
    );
  };

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

    const hasIncompleteRow = rows.some((r) => (r.product || r.isCustomItem) && (!r.calculatedLine || r.validationError));
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

      const advNum = advanceAmount.trim() !== '' ? Number(advanceAmount) : undefined;

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
        widthFactor: wfNum,
        feetToMetre: feetToMetreNum,
        isGstEnabled,
        advanceAmount: advNum,
        balanceDue: totals.balanceDue ? totals.balanceDue.toNumber() : undefined,
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

      const result =
        isRevise && source
          ? await reviseQuotation(source.quotation, quotationPayload, profile?.name || user?.email || 'Sales Team')
          : await createQuotation(quotationPayload);
      if (isRevise && source) quotationPayload.revision = (source.quotation.revision || 1) + 1;
      // Saved: the device draft is no longer needed
      isSavedRef.current = true;
      clearDraft(dKey);

      setSaveSuccessMessage(
        isRevise
          ? `Revision ${quotationPayload.revision} of ${result.quotationNumber} saved.`
          : `Quotation ${result.quotationNumber} saved successfully.`
      );

      const completeSavedQuote: Quotation = {
        ...quotationPayload,
        status: isRevise ? source?.quotation.status || 'draft' : 'draft',
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
    <div className="space-y-5 pb-28 md:pb-8">
      {/* Top Navigation Header */}
      <div className="border-b border-line pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-10 h-10 flex items-center justify-center text-muted hover:text-ink hover:bg-surface-2 rounded-control border border-line-strong transition shrink-0"
            title="Return to Quotation Register"
            aria-label="Return to Quotation Register"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-ink tracking-tight flex items-center gap-2">
              <span>
                {isRevise
                  ? `Revise ${source?.quotation.quotationNumber}`
                  : source
                    ? 'New quotation (copy)'
                    : 'New quotation'}
              </span>
              <span className="text-[10px] font-mono font-bold uppercase text-brand bg-brand-soft px-2 py-0.5 rounded-control border border-brand/20">
                {isRevise ? `Rev ${(source?.quotation.revision || 1) + 1}` : 'Draft'}
              </span>
            </h1>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {showRestoredNotice && restoredDraft && (
        <div className="anim-fade-up p-3 bg-brand-soft border border-brand/20 rounded-control text-brand-deep text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-brand" />
            <span>
              Restored your unsaved quotation from{' '}
              <strong className="font-semibold">
                {new Date(restoredDraft.savedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
              </strong>
              .
            </span>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={handleDiscardDraft}
              className="px-3 py-1.5 rounded-control border border-brand/30 bg-white text-brand-deep font-semibold hover:bg-brand-tint transition"
            >
              Discard draft
            </button>
            <button
              type="button"
              onClick={() => setShowRestoredNotice(false)}
              aria-label="Hide message"
              className="p-1 text-brand-deep/60 hover:text-brand-deep"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

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
      <div className={`bg-white p-3.5 sm:p-5 rounded-card border border-line-strong shadow-xs space-y-4 relative ${isCustomerDropdownOpen ? 'z-40' : 'z-20'}`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Customer Selection */}
          <div className="md:col-span-2 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="block text-[10.5px] font-semibold text-faint uppercase tracking-wider">
                Customer / Client <span className="text-danger">*</span>
              </label>
              <button
                type="button"
                onClick={() => setIsNewCustomerOpen(true)}
                className="press inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:text-brand-dark px-2 py-1 rounded-control hover:bg-brand-soft transition"
              >
                <UserPlus className="w-3.5 h-3.5" />
                New customer
              </button>
            </div>

            {selectedCustomer ? (
              <div className="p-3 sm:p-3.5 rounded-control border border-line-strong bg-surface-2 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1 text-xs">
                  <div className="font-bold text-ink flex flex-wrap items-center gap-2">
                    <User className="w-4 h-4 text-brand shrink-0" />
                    <span className="text-sm">{selectedCustomer.name}</span>
                    <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-control bg-brand-soft text-brand border border-brand/20">
                      {taxMode === 'intra' ? 'Intra-State (CGST+SGST)' : 'Inter-State (IGST)'}
                    </span>
                  </div>
                  <div className="text-muted flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
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
                  type="button"
                  onClick={() => setSelectedCustomer(null)}
                  className="min-h-[38px] text-xs text-brand hover:text-brand-dark font-semibold underline self-start sm:self-auto shrink-0"
                >
                  Change
                </button>
              </div>
            ) : (
              <div ref={customerSearchRef} className="relative">
                <Search className="w-4 h-4 text-faint absolute left-3.5 top-1/2 -translate-y-1/2" />
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
                  className="w-full pl-10 pr-3.5 h-11 text-sm rounded-control border border-line-strong focus:border-brand focus:ring-3 focus:ring-brand/15 text-ink bg-white"
                />

                {isCustomerDropdownOpen && (
                  <div className="anim-pop absolute left-0 right-0 top-full mt-1.5 bg-white border border-line-strong rounded-control shadow-lg z-50 max-h-64 overflow-y-auto">
                    {!loadingMasters && (
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setIsNewCustomerOpen(true)}
                        className="sticky top-0 z-10 w-full text-left px-3 py-2.5 bg-brand-tint hover:bg-brand-soft border-b border-line flex items-center gap-2 text-xs font-semibold text-brand transition min-h-[44px]"
                      >
                        <UserPlus className="w-4 h-4 shrink-0" />
                        {customerSearch.trim() ? <span>Add &quot;{customerSearch.trim()}&quot; as a new customer</span> : <span>Add a new customer</span>}
                      </button>
                    )}
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
                          className="w-full text-left p-3 hover:bg-surface-2 border-b border-line last:border-0 flex items-center justify-between text-xs transition min-h-[44px]"
                        >
                          <div>
                            <div className="font-semibold text-ink text-xs">{cust.name}</div>
                            <div className="text-[11px] text-muted">
                              {cust.gstin ? `GSTIN: ${cust.gstin}` : 'Unregistered'} &bull; {cust.phone || 'No phone'}
                            </div>
                          </div>
                          <span className="text-[10px] text-brand font-bold shrink-0 ml-2">Select &rarr;</span>
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
              <Calendar className="w-4 h-4 text-faint absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id={fieldIdDate}
                type="date"
                value={quotationDate}
                onChange={(e) => setQuotationDate(e.target.value)}
                className="w-full pl-10 pr-3 h-11 text-sm rounded-control border border-line-strong focus:border-brand focus:ring-3 focus:ring-brand/15 font-mono tabular-nums text-ink bg-white max-w-full"
              />
            </div>
          </div>
        </div>

        {/* Quotation Parameters & Options Bar */}
        <div className="pt-3 border-t border-line flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-4">
            {/* Width Factor */}
            <div className="flex items-center justify-between sm:justify-start gap-2 bg-surface-2 sm:bg-transparent p-2 sm:p-0 rounded-control border border-line sm:border-0">
              <label htmlFor="quote-width-factor" className="text-xs font-semibold text-ink">
                Width factor:
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  id="quote-width-factor"
                  type="number"
                  inputMode="decimal"
                  step="0.001"
                  min="0.1"
                  value={widthFactor}
                  onChange={(e) => handleWidthFactorChange(e.target.value)}
                  className="w-20 h-9 py-1 px-2 text-center text-xs font-mono tabular-nums font-bold rounded-control border border-line-strong focus:border-brand focus:ring-1 focus:ring-brand text-ink bg-white"
                  placeholder="1.08"
                  title="Quotation-level default width factor for sheet SQM"
                />
                <span className="text-[11px] text-muted">(default 1.08)</span>
              </div>
            </div>

            <div className="hidden sm:block h-4 w-px bg-line" />

            {/* GST Toggle */}
            <label className="flex items-center justify-between sm:justify-start gap-2.5 cursor-pointer select-none bg-surface-2 sm:bg-transparent p-2 sm:p-0 rounded-control border border-line sm:border-0 min-h-[40px]">
              <span className="font-semibold text-ink text-xs">
                {isGstEnabled ? 'GST 18% Enabled' : 'No GST (Exempt / Direct)'}
              </span>
              <div className="relative inline-flex items-center">
                <input
                  type="checkbox"
                  checked={isGstEnabled}
                  onChange={(e) => setIsGstEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-line-strong peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-line after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand"></div>
              </div>
            </label>
          </div>

          <div className="text-[11px] text-muted text-right sm:text-left">
            Length conversion: <strong className="font-mono text-ink">1 ft = {feetToMetreNum} m</strong>
          </div>
        </div>
      </div>

      {/* Section 2: Editable Quotation Lines Table */}
      <EditableQuotationTable
        products={products}
        taxMode={taxMode}
        rows={rows}
        widthFactor={wfNum}
        feetToMetre={feetToMetreNum}
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
              <div className="bg-white p-3.5 sm:p-5 rounded-card border border-line-strong shadow-xs">
                <div className="font-bold text-muted text-[10.5px] uppercase tracking-wider mb-2.5">
                  Quantity Summary
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 text-xs">
                  {totals.totalSqMtr.gt(0) && (
                    <div className="p-2.5 sm:p-3 bg-surface-2 rounded-control border border-line-strong">
                      <span className="text-[10px] sm:text-[10.5px] text-faint font-semibold block uppercase tracking-wider">Total Area</span>
                      <span className="text-sm sm:text-base font-mono tabular-nums font-bold text-ink">{totals.totalSqMtr.toFixed(2)} Sq.Mtr</span>
                    </div>
                  )}
                  {totals.totalKgs.gt(0) && (
                    <div className="p-2.5 sm:p-3 bg-surface-2 rounded-control border border-line-strong">
                      <span className="text-[10px] sm:text-[10.5px] text-faint font-semibold block uppercase tracking-wider">Total Weight</span>
                      <span className="text-sm sm:text-base font-mono tabular-nums font-bold text-ink">{totals.totalKgs.toFixed(2)} Kgs</span>
                    </div>
                  )}
                  {totals.totalNos.gt(0) && (
                    <div className="p-2.5 sm:p-3 bg-surface-2 rounded-control border border-line-strong col-span-2 sm:col-span-1">
                      <span className="text-[10px] sm:text-[10.5px] text-faint font-semibold block uppercase tracking-wider">Qty in Nos</span>
                      <span className="text-sm sm:text-base font-mono tabular-nums font-bold text-ink">{totals.totalNos.toString()} Nos</span>
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

                {isGstEnabled ? (
                  taxMode === 'intra' ? (
                    <>
                      <div className="flex justify-between text-muted">
                        <span>CGST (Central Tax 9%):</span>
                        <span className="font-mono tabular-nums font-semibold text-ink">₹{totals.cgstTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-muted">
                        <span>SGST (State Tax 9%):</span>
                        <span className="font-mono tabular-nums font-semibold text-ink">₹{totals.sgstTotal.toFixed(2)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between text-muted">
                      <span>IGST (Integrated Tax 18%):</span>
                      <span className="font-mono tabular-nums font-semibold text-ink">₹{totals.igstTotal.toFixed(2)}</span>
                    </div>
                  )
                ) : (
                  <div className="flex justify-between text-muted text-[11px] italic">
                    <span>GST (Not Applicable):</span>
                    <span className="font-mono tabular-nums">₹0.00</span>
                  </div>
                )}

                <div className="flex justify-between text-muted border-t border-line pt-2">
                  <span>Grand Total:</span>
                  <span className="font-mono tabular-nums font-semibold text-ink">₹{totals.grandTotal.toFixed(2)}</span>
                </div>

                {companySettings?.enableRoundOff && (
                  <div className="flex justify-between text-muted">
                    <span>Round-off:</span>
                    <span className="font-mono tabular-nums text-ink">
                      {formatRoundOff(totals.roundOff)}
                    </span>
                  </div>
                )}

                {/* Advance Amount Input */}
                <div className="flex items-center justify-between text-muted border-t border-line pt-2 gap-2">
                  <span className="font-medium text-ink">Advance Received (₹):</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={advanceAmount}
                    placeholder="0.00"
                    onChange={(e) => setAdvanceAmount(e.target.value)}
                    className="w-28 sm:w-32 h-10 py-1.5 px-2.5 text-right font-mono tabular-nums font-bold text-xs sm:text-sm rounded-control border border-line-strong focus:border-brand focus:ring-2 focus:ring-brand/20 text-ink bg-white"
                  />
                </div>
              </div>

              {/* Total Payable & Balance Due Banners */}
              <div className="border-t border-line bg-surface-2/60 p-4 space-y-2">
                <div className="flex justify-between items-baseline gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted shrink-0">Total payable:</span>
                  <span className="text-xl sm:text-[25px] font-mono tabular-nums text-brand font-bold text-right truncate">
                    ₹{totals.payableAmount.toNumber().toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {advanceAmount.trim() !== '' && Number(advanceAmount) > 0 && totals.balanceDue && (
                  <div className="flex justify-between items-baseline pt-2 border-t border-line gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-900 shrink-0">Balance due:</span>
                    <span className="text-lg sm:text-[20px] font-mono tabular-nums text-amber-900 font-bold text-right truncate">
                      ₹{totals.balanceDue.toNumber().toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Final Action Bar */}
          <div className="bg-white p-3.5 sm:p-4 rounded-card border border-line-strong shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleBack}
                className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 text-xs font-semibold text-muted hover:text-ink bg-white hover:bg-surface-2 border border-line-strong rounded-control shadow-xs transition flex items-center justify-center"
              >
                Cancel Draft
              </button>
              <button
                type="button"
                onClick={handleSaveQuotation}
                disabled={isSaving || validLines.length === 0 || !selectedCustomer}
                className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-brand hover:bg-brand-dark text-white rounded-control text-xs font-semibold shadow-xs transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <LoadingSpinner size="sm" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>{isRevise ? 'Save Revision' : 'Save Quotation'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phone: always-visible total + save */}
      <div className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-white/95 backdrop-blur border-t border-line-strong shadow-[0_-6px_20px_rgba(16,24,40,0.08)] px-4 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[10.5px] text-muted font-semibold uppercase tracking-wider truncate">
            {validLines.length} item{validLines.length === 1 ? '' : 's'}
            {totals.totalKgs.toNumber() > 0 ? ` · ${totals.totalKgs.toNumber().toFixed(2)} kg` : ''}
          </div>
          <div className="font-mono tabular-nums font-bold text-lg text-brand leading-tight truncate">
            ₹{totals.payableAmount.toNumber().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <button
          type="button"
          onClick={handleSaveQuotation}
          disabled={isSaving || validLines.length === 0 || !selectedCustomer}
          className="min-h-[46px] inline-flex items-center justify-center gap-1.5 px-5 bg-brand hover:bg-brand-dark text-white rounded-control text-sm font-semibold shadow-xs disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'Saving…' : !selectedCustomer ? 'Pick customer' : isRevise ? 'Save revision' : 'Save'}
        </button>
      </div>

      {isNewCustomerOpen && (
        <CustomerFormModal
          initialName={customerSearch.trim()}
          subtitle="Saved to Customers and picked for this quotation."
          onClose={() => setIsNewCustomerOpen(false)}
          onSubmit={handleCreateCustomer}
        />
      )}
    </div>
  );
};
