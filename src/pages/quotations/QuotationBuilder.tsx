import React, { useState, useEffect, useMemo, useId, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { getCustomers } from '../../services/customerService';
import { getProducts } from '../../services/productService';
import { getCompanySettings } from '../../services/settingsService';
import { createQuotation } from '../../services/quotationService';
import {
  calculateQuotationLine,
  calculateQuotationTotals,
  determineTaxMode,
  recalculateLineTax,
  formatRoundOff,
  validateLineDraft,
  ENGINE_VERSION,
  type TaxMode,
} from '../../engine';
import type { Customer } from '../../types/customer';
import type { Product, QuantityMethod } from '../../types/product';
import type { CompanySettings } from '../../types/settings';
import type {
  Quotation,
  QuotationLine,
  QuotationLineSnapshot,
  CreateQuotationInput,
} from '../../types/quotation';
import { Decimal } from 'decimal.js';
import {
  ArrowLeft,
  Search,
  Plus,
  Trash2,
  Edit2,
  Save,
  User,
  Building2,
  Calendar,
  AlertCircle,
  CheckCircle2,
  X,
  Package,
  Layers,
  Sparkles,
} from 'lucide-react';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

interface QuotationBuilderProps {
  onCancel: () => void;
  onSaved: (quotation: Quotation) => void;
}

interface LineFormState {
  editingLineId: string | null;
  product: Product | null;
  lengthFeet: string;
  lengthInches: string;
  lengthMetres: string;
  lengthUnit: 'ft_in' | 'metres';
  nos: string;
  rate: string;
  gstRate: string;
  discountPct: string;
  discountAmount: string;
  isManualQuantity: boolean;
  manualQuantity: string;
}

const INITIAL_LINE_FORM: LineFormState = {
  editingLineId: null,
  product: null,
  lengthFeet: '8',
  lengthInches: '0',
  lengthMetres: '6',
  lengthUnit: 'ft_in',
  nos: '1',
  rate: '',
  gstRate: '18',
  discountPct: '',
  discountAmount: '',
  isManualQuantity: false,
  manualQuantity: '',
};

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
  const [lines, setLines] = useState<QuotationLine[]>([]);

  // Customer Search & Selector
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState<boolean>(false);
  const customerSearchRef = useRef<HTMLDivElement>(null);

  // Product Search for Line Form
  const [productSearch, setProductSearch] = useState<string>('');
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState<boolean>(false);
  const productSearchRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        customerSearchRef.current &&
        !customerSearchRef.current.contains(event.target as Node)
      ) {
        setIsCustomerDropdownOpen(false);
      }
      if (
        productSearchRef.current &&
        !productSearchRef.current.contains(event.target as Node)
      ) {
        setIsProductDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Line Form
  const [lineForm, setLineForm] = useState<LineFormState>(INITIAL_LINE_FORM);
  const [lineFormError, setLineFormError] = useState<string | null>(null);

  // Save State
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Accessible unique IDs
  const fieldIdDate = useId();
  const fieldIdFeet = useId();
  const fieldIdInches = useId();
  const fieldIdMetres = useId();
  const fieldIdNos = useId();
  const fieldIdRate = useId();
  const fieldIdGst = useId();
  const fieldIdDiscount = useId();
  const fieldIdManualQty = useId();

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

  // Quotation Document Totals (computed using Phase 2 engine)
  const totals = useMemo(() => {
    return calculateQuotationTotals(lines, taxMode, true);
  }, [lines, taxMode]);

  // Keep line-level tax distributions in sync with active taxMode (CALC-01)
  useEffect(() => {
    setLines((prevLines) => {
      if (prevLines.length === 0) return prevLines;
      return prevLines.map((line) => recalculateLineTax(line, taxMode));
    });
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

  // Filtered products for line draft
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products;
    const q = productSearch.toLowerCase().trim();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.hsn.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }, [products, productSearch]);

  // Select Product into Line Form
  const handleSelectProduct = (product: Product) => {
    setLineForm({
      editingLineId: null,
      product,
      lengthFeet: '8',
      lengthInches: '0',
      lengthMetres: '6',
      lengthUnit: product.qtyMethod === 'SECTION_WEIGHT' ? 'metres' : 'ft_in',
      nos: '1',
      rate: String(product.ratePerUnit),
      gstRate: String(product.gstRate),
      discountPct: '',
      discountAmount: '',
      isManualQuantity: false,
      manualQuantity: '',
    });
    setProductSearch('');
    setIsProductDropdownOpen(false);
    setLineFormError(null);
  };

  // Helper to build a QuotationLineSnapshot from product & current rate
  const buildSnapshot = (product: Product, rateNum: number): QuotationLineSnapshot => {
    return {
      productId: product.id,
      productName: product.name,
      category: product.category,
      hsn: product.hsn,
      qtyMethod: product.qtyMethod as QuantityMethod,
      unit: product.unit,
      thicknessMm: 'thicknessMm' in product ? product.thicknessMm : undefined,
      coilWidthM: 'coilWidthM' in product ? product.coilWidthM : undefined,
      coverWidthM: 'coverWidthM' in product ? product.coverWidthM : undefined,
      kgPerMetre: 'kgPerMetre' in product ? product.kgPerMetre : undefined,
      densityFactor: 'densityFactor' in product ? product.densityFactor : undefined,
      rate: rateNum,
      gstRate: product.gstRate,
    };
  };

  // Real-time calculation preview for current line being edited
  const calculatedLinePreview = useMemo<QuotationLine | null>(() => {
    if (!lineForm.product) return null;

    try {
      const rateNum = lineForm.rate ? new Decimal(lineForm.rate).toNumber() : lineForm.product.ratePerUnit;
      const snapshot = buildSnapshot(lineForm.product, rateNum);

      let lengthParam: { feet?: number; inches?: number; metres?: number } = {};
      if (lineForm.product.qtyMethod === 'SHEET_WEIGHT' || lineForm.lengthUnit === 'ft_in') {
        lengthParam = {
          feet: lineForm.lengthFeet ? Number(lineForm.lengthFeet) : 0,
          inches: lineForm.lengthInches ? Number(lineForm.lengthInches) : 0,
        };
      } else if (lineForm.product.qtyMethod === 'SECTION_WEIGHT' && lineForm.lengthUnit === 'metres') {
        lengthParam = {
          metres: lineForm.lengthMetres ? Number(lineForm.lengthMetres) : 0,
        };
      }

      const nosNum = lineForm.nos ? Number(lineForm.nos) : 1;

      return calculateQuotationLine(
        {
          snapshot,
          length: lengthParam,
          nos: nosNum,
          customRate: rateNum,
          isManualQuantity: lineForm.isManualQuantity,
          manualQuantity: lineForm.isManualQuantity && lineForm.manualQuantity
            ? Number(lineForm.manualQuantity)
            : undefined,
          discountPct: lineForm.discountPct ? Number(lineForm.discountPct) : undefined,
          discountAmount: lineForm.discountAmount ? Number(lineForm.discountAmount) : undefined,
        },
        taxMode
      );
    } catch {
      return null;
    }
  }, [lineForm, taxMode]);

  // Add or Update line in draft list
  const handleSaveLine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lineForm.product) {
      setLineFormError('Please select a product first.');
      return;
    }

    // Unified engine validation (CALC-04, CALC-08)
    const validation = validateLineDraft({
      product: lineForm.product,
      rate: lineForm.rate,
      nos: lineForm.nos,
      lengthUnit: lineForm.lengthUnit,
      lengthFeet: lineForm.lengthFeet,
      lengthInches: lineForm.lengthInches,
      lengthMetres: lineForm.lengthMetres,
      isManualQuantity: lineForm.isManualQuantity,
      manualQuantity: lineForm.manualQuantity,
      discountPct: lineForm.discountPct,
      discountAmount: lineForm.discountAmount,
      calculatedQuantity: calculatedLinePreview?.quantity,
    });

    if (!validation.isValid) {
      setLineFormError(validation.error || 'Invalid line values.');
      return;
    }

    if (!calculatedLinePreview || calculatedLinePreview.quantity <= 0) {
      setLineFormError('Unable to calculate valid line quantity. Check inputs.');
      return;
    }

    if (lineForm.editingLineId) {
      // Update existing line
      setLines((prev) =>
        prev.map((l) =>
          l.id === lineForm.editingLineId ? { ...calculatedLinePreview, id: lineForm.editingLineId! } : l
        )
      );
    } else {
      // Append new line
      setLines((prev) => [...prev, calculatedLinePreview]);
    }

    // Reset line form
    setLineForm(INITIAL_LINE_FORM);
    setLineFormError(null);
  };

  // Edit an existing line in draft list
  const handleEditLine = (line: QuotationLine) => {
    // Find master product if available
    const product = products.find((p) => p.id === line.snapshot.productId) || ({
      id: line.snapshot.productId,
      name: line.snapshot.productName,
      category: line.snapshot.category,
      hsn: line.snapshot.hsn,
      qtyMethod: line.snapshot.qtyMethod,
      unit: line.snapshot.unit,
      ratePerUnit: line.snapshot.rate,
      gstRate: line.snapshot.gstRate,
      active: true,
      thicknessMm: line.snapshot.thicknessMm,
      coilWidthM: line.snapshot.coilWidthM,
      kgPerMetre: line.snapshot.kgPerMetre,
      densityFactor: line.snapshot.densityFactor,
    } as unknown as Product);

    const isPipeInFeet = line.snapshot.qtyMethod === 'SECTION_WEIGHT' && line.lengthFeet !== undefined && line.lengthFeet !== null;
    setLineForm({
      editingLineId: line.id,
      product,
      lengthFeet: line.lengthFeet !== undefined ? String(line.lengthFeet) : '8',
      lengthInches: line.lengthInches !== undefined ? String(line.lengthInches) : '0',
      lengthMetres: line.lengthM !== undefined ? String(line.lengthM) : '6',
      lengthUnit: line.snapshot.qtyMethod === 'SECTION_WEIGHT' ? (isPipeInFeet ? 'ft_in' : 'metres') : 'ft_in',
      nos: String(line.nos),
      rate: String(line.rate),
      gstRate: String(line.gstRate),
      discountPct: line.discountPct !== undefined ? String(line.discountPct) : '',
      discountAmount: line.discountAmount !== undefined ? String(line.discountAmount) : '',
      isManualQuantity: line.isManualQuantity,
      manualQuantity: line.manualQuantity !== undefined ? String(line.manualQuantity) : '',
    });
  };

  // Delete line from draft list
  const handleDeleteLine = (lineId: string) => {
    setLines((prev) => prev.filter((l) => l.id !== lineId));
    if (lineForm.editingLineId === lineId) {
      setLineForm(INITIAL_LINE_FORM);
    }
  };

  // Atomic Save Quotation
  const handleSaveQuotation = async () => {
    if (isSaving) return;

    if (!selectedCustomer) {
      setSaveError('Please select a customer before saving the quotation.');
      return;
    }

    if (lines.length === 0) {
      setSaveError('Quotation must contain at least one line item.');
      return;
    }

    const hasInvalidLine = lines.some((l) => l.quantity <= 0 || l.rate <= 0);
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
        lines,
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
      <div className="bg-white rounded-sm border border-slate-300 p-16 text-center shadow-xs">
        <LoadingSpinner label="Loading customer directory and product catalog..." size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      {/* Top Navigation Header */}
      <div className="border-b border-slate-300 pb-4">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onCancel}
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-sm border border-slate-300 transition"
            title="Return to Quotation Register"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <span>Quotation Preparation Desk</span>
              <span className="text-[10px] font-mono font-bold uppercase text-slate-700 bg-slate-200 px-2 py-0.5 rounded-none border border-slate-300">
                Draft
              </span>
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              Compose roofing quotation with live Decimal-precision weight and GST calculation.
            </p>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {masterError && (
        <div className="p-3 bg-rose-50 border border-rose-300 rounded-sm text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-700" />
          <span>{masterError}</span>
        </div>
      )}

      {saveError && (
        <div className="p-3 bg-rose-50 border border-rose-300 rounded-sm text-rose-900 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-700" />
            <span>{saveError}</span>
          </div>
          <button onClick={() => setSaveError(null)} className="text-rose-400 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {saveSuccessMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-sm text-emerald-900 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span className="font-bold">{saveSuccessMessage}</span>
        </div>
      )}

      {/* Section 1: Customer Selection & Quotation Date */}
      <div className={`bg-white p-4 sm:p-5 rounded-sm border border-slate-300 shadow-xs space-y-4 relative ${isCustomerDropdownOpen ? 'z-40' : 'z-20'}`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Customer Selection */}
          <div className="md:col-span-2 space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
              Customer / Client <span className="text-rose-600">*</span>
            </label>

            {selectedCustomer ? (
              <div className="p-3 rounded-sm border border-slate-300 bg-slate-50 flex items-start justify-between">
                <div className="space-y-1 text-xs">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <User className="w-4 h-4 text-[#0f2444]" />
                    <span>{selectedCustomer.name}</span>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-none bg-blue-100 text-blue-900 border border-blue-300">
                      {taxMode === 'intra' ? 'Intra-State (CGST+SGST)' : 'Inter-State (IGST)'}
                    </span>
                  </div>
                  <div className="text-slate-600 space-x-3 text-[11px]">
                    {selectedCustomer.gstin ? (
                      <span>
                        GSTIN: <strong className="font-mono text-slate-900">{selectedCustomer.gstin}</strong>
                      </span>
                    ) : (
                      <span className="text-slate-500 italic">Unregistered Buyer</span>
                    )}
                    {selectedCustomer.phone && <span>Phone: {selectedCustomer.phone}</span>}
                    {selectedCustomer.city && <span>City: {selectedCustomer.city}</span>}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="text-xs text-[#0f2444] hover:text-blue-800 font-bold underline ml-2"
                >
                  Change
                </button>
              </div>
            ) : (
              <div ref={customerSearchRef} className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
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
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-sm border border-slate-300 focus:outline-none focus:border-[#0f2444] text-slate-900"
                />

                {isCustomerDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-300 rounded-sm shadow-xl z-50 max-h-56 overflow-y-auto">
                    {loadingMasters ? (
                      <div className="p-3 text-xs text-slate-500 text-center">
                        Loading customers...
                      </div>
                    ) : filteredCustomers.length === 0 ? (
                      <div className="p-3 text-xs text-slate-500 text-center">
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
                          className="w-full text-left p-2.5 hover:bg-slate-50 border-b border-slate-200 last:border-0 flex items-center justify-between text-xs transition"
                        >
                          <div>
                            <div className="font-bold text-slate-900">{cust.name}</div>
                            <div className="text-[11px] text-slate-600 font-medium">
                              {cust.gstin ? `GSTIN: ${cust.gstin}` : 'Unregistered'} &bull; {cust.phone || 'No phone'}
                            </div>
                          </div>
                          <span className="text-[10px] text-[#0f2444] font-bold">Select &rarr;</span>
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
            <label htmlFor={fieldIdDate} className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1.5">
              Quotation Date <span className="text-rose-600">*</span>
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id={fieldIdDate}
                type="date"
                value={quotationDate}
                onChange={(e) => setQuotationDate(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-sm border border-slate-300 focus:outline-none focus:border-[#0f2444] font-medium text-slate-900"
              />
            </div>
          </div>
        </div>

        {/* Company Settings Banner */}
        {companySettings && (
          <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between text-[11px] text-slate-600">
            <div className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              <span>Issuing Supplier: <strong className="text-slate-900 font-bold">{companySettings.name}</strong></span>
              <span className="font-mono text-slate-700">({companySettings.gstin})</span>
            </div>
            <div>
              <span>Bank: {companySettings.bankDetails?.bankName} &bull; A/C: {companySettings.bankDetails?.accountNumber}</span>
            </div>
          </div>
        )}
      </div>

      {/* Section 2: Line Item Form (Dynamic for Sheet / Pipe / Piece) */}
      <div className={`bg-white rounded-sm border border-slate-300 shadow-xs relative ${isProductDropdownOpen ? 'z-30' : 'z-20'}`}>
        <div className="p-3.5 bg-slate-100 border-b border-slate-300 flex items-center justify-between rounded-t-sm">
          <div className="flex items-center gap-2 font-bold text-slate-800 text-xs uppercase tracking-wide">
            <Package className="w-4 h-4 text-[#0f2444]" />
            <span>{lineForm.editingLineId ? 'Edit Quotation Line Item' : 'Add Item to Quotation'}</span>
          </div>
          {lineForm.editingLineId && (
            <button
              onClick={() => setLineForm(INITIAL_LINE_FORM)}
              className="text-xs text-slate-600 hover:text-slate-900 underline font-medium"
            >
              Cancel Edit
            </button>
          )}
        </div>

        <form onSubmit={handleSaveLine} className="p-4 sm:p-5 space-y-4 text-xs">
          {lineFormError && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-sm text-rose-900 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-700" />
              <span>{lineFormError}</span>
            </div>
          )}

          {/* Product Picker */}
          {!lineForm.product ? (
            <div ref={productSearchRef} className="relative">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                Select Active Product <span className="text-rose-600">*</span>
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search products by name, category, or HSN code..."
                  value={productSearch}
                  onFocus={() => setIsProductDropdownOpen(true)}
                  onClick={() => setIsProductDropdownOpen(true)}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    setIsProductDropdownOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setIsProductDropdownOpen(false);
                    }
                  }}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-sm border border-slate-300 focus:outline-none focus:border-[#0f2444] text-slate-900 bg-white"
                />

                {isProductDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-300 rounded-sm shadow-xl z-50 max-h-72 overflow-y-auto">
                    {loadingMasters ? (
                      <div className="p-3 text-xs text-slate-500 text-center">
                        Loading products...
                      </div>
                    ) : filteredProducts.length === 0 ? (
                      <div className="p-3 text-xs text-slate-500 text-center">
                        No matching products found.
                      </div>
                    ) : (
                      filteredProducts.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleSelectProduct(p)}
                          className="w-full text-left p-2.5 hover:bg-slate-50 border-b border-slate-200 last:border-0 flex items-center justify-between text-xs transition"
                        >
                          <div className="pr-4 min-w-0">
                            <div className="font-bold text-slate-900 truncate">{p.name}</div>
                            <div className="text-[11px] text-slate-600 mt-0.5 flex items-center gap-1.5 flex-wrap">
                              <span>{p.category}</span>
                              <span>&bull;</span>
                              <span className="font-mono">HSN {p.hsn}</span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-mono font-bold text-slate-900 text-xs">
                              ₹{p.ratePerUnit} / {p.unit}
                            </span>
                            <span className="block text-[10px] text-[#0f2444] font-bold">Select</span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Selected Product Header inside Form */
            <div className="p-3 bg-slate-50 rounded-sm border border-slate-300 flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <span>{lineForm.product.name}</span>
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-none bg-blue-100 text-blue-900 border border-blue-300">
                    {lineForm.product.qtyMethod}
                  </span>
                  <span className="text-[11px] text-slate-600 font-mono">HSN: {lineForm.product.hsn}</span>
                </div>
                <div className="text-[11px] text-slate-600 mt-0.5">
                  {'thicknessMm' in lineForm.product && 'coilWidthM' in lineForm.product && (
                    <span>Thickness: {lineForm.product.thicknessMm}mm &bull; Coil: {lineForm.product.coilWidthM}m &bull; </span>
                  )}
                  {'kgPerMetre' in lineForm.product && (
                    <span>Weight: {lineForm.product.kgPerMetre} kg/m &bull; </span>
                  )}
                  <span>Master Rate: ₹{lineForm.product.ratePerUnit}/{lineForm.product.unit} &bull; GST: {lineForm.product.gstRate}%</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setLineForm((prev) => ({ ...prev, product: null }))}
                className="text-xs text-[#0f2444] hover:text-blue-800 font-bold underline"
              >
                Change Product
              </button>
            </div>
          )}

          {/* Dynamic Inputs (rendered when product is chosen) */}
          {lineForm.product && (
            <div className="space-y-4 pt-1">
              {/* Method-Specific Measurement Inputs */}
              {lineForm.product.qtyMethod === 'SHEET_WEIGHT' && (
                <div className="bg-slate-50 p-3.5 rounded-sm border border-slate-300 space-y-3">
                  <div className="font-bold text-slate-800 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#0f2444]" />
                      <span>Sheet Dimensions (Feet &amp; Inches)</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-normal">
                      Thickness: {lineForm.product.thicknessMm}mm &bull; Coil: {lineForm.product.coilWidthM}m
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label htmlFor={fieldIdFeet} className="block text-[11px] font-bold text-slate-700 mb-1">
                        Length (Feet) <span className="text-rose-600">*</span>
                      </label>
                      <input
                        id={fieldIdFeet}
                        type="number"
                        step="1"
                        min="0"
                        value={lineForm.lengthFeet}
                        onChange={(e) => setLineForm({ ...lineForm, lengthFeet: e.target.value })}
                        placeholder="8"
                        className="w-full py-1.5 px-3 rounded-sm border border-slate-300 bg-white font-mono font-bold text-slate-900"
                      />
                    </div>

                    <div>
                      <label htmlFor={fieldIdInches} className="block text-[11px] font-bold text-slate-700 mb-1">
                        Length (Inches)
                      </label>
                      <input
                        id={fieldIdInches}
                        type="number"
                        step="0.5"
                        min="0"
                        max="11.9"
                        value={lineForm.lengthInches}
                        onChange={(e) => setLineForm({ ...lineForm, lengthInches: e.target.value })}
                        placeholder="0"
                        className="w-full py-1.5 px-3 rounded-sm border border-slate-300 bg-white font-mono text-slate-900"
                      />
                    </div>

                    <div>
                      <label htmlFor={fieldIdNos} className="block text-[11px] font-bold text-slate-700 mb-1">
                        Number of Pieces (Nos) <span className="text-rose-600">*</span>
                      </label>
                      <input
                        id={fieldIdNos}
                        type="number"
                        step="1"
                        min="1"
                        value={lineForm.nos}
                        onChange={(e) => setLineForm({ ...lineForm, nos: e.target.value })}
                        placeholder="1"
                        className="w-full py-1.5 px-3 rounded-sm border border-slate-300 bg-white font-mono font-bold text-slate-900"
                      />
                    </div>

                    <div>
                      <label htmlFor={fieldIdRate} className="block text-[11px] font-bold text-slate-700 mb-1">
                        Rate per Kg (₹) <span className="text-rose-600">*</span>
                      </label>
                      <input
                        id={fieldIdRate}
                        type="number"
                        step="0.01"
                        value={lineForm.rate}
                        onChange={(e) => setLineForm({ ...lineForm, rate: e.target.value })}
                        className="w-full py-1.5 px-3 rounded-sm border border-slate-300 bg-white font-mono font-bold text-slate-900"
                      />
                    </div>
                  </div>
                </div>
              )}

              {lineForm.product.qtyMethod === 'SECTION_WEIGHT' && (
                <div className="bg-slate-50 p-3.5 rounded-sm border border-slate-300 space-y-3">
                  <div className="font-bold text-slate-800 text-xs flex items-center justify-between">
                    <span>MS Pipe / Section Dimensions</span>
                    <div className="text-[11px] flex items-center gap-1.5">
                      <span className="text-slate-600 font-semibold">Unit:</span>
                      <button
                        type="button"
                        onClick={() => setLineForm({ ...lineForm, lengthUnit: 'metres' })}
                        className={`px-2 py-0.5 rounded-none text-xs font-bold uppercase border ${
                          lineForm.lengthUnit === 'metres'
                            ? 'bg-[#0f2444] text-white border-[#0f2444]'
                            : 'bg-white text-slate-700 border-slate-300'
                        }`}
                      >
                        Metres
                      </button>
                      <button
                        type="button"
                        onClick={() => setLineForm({ ...lineForm, lengthUnit: 'ft_in' })}
                        className={`px-2 py-0.5 rounded-none text-xs font-bold uppercase border ${
                          lineForm.lengthUnit === 'ft_in'
                            ? 'bg-[#0f2444] text-white border-[#0f2444]'
                            : 'bg-white text-slate-700 border-slate-300'
                        }`}
                      >
                        Feet / Inches
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {lineForm.lengthUnit === 'metres' ? (
                      <div>
                        <label htmlFor={fieldIdMetres} className="block text-[11px] font-bold text-slate-700 mb-1">
                          Length (Metres) <span className="text-rose-600">*</span>
                        </label>
                        <input
                          id={fieldIdMetres}
                          type="number"
                          step="0.01"
                          min="0.1"
                          value={lineForm.lengthMetres}
                          onChange={(e) => setLineForm({ ...lineForm, lengthMetres: e.target.value })}
                          placeholder="6.0"
                          className="w-full py-1.5 px-3 rounded-sm border border-slate-300 bg-white font-mono font-bold text-slate-900"
                        />
                      </div>
                    ) : (
                      <>
                        <div>
                          <label htmlFor={fieldIdFeet} className="block text-[11px] font-bold text-slate-700 mb-1">
                            Length (Feet) <span className="text-rose-600">*</span>
                          </label>
                          <input
                            id={fieldIdFeet}
                            type="number"
                            step="1"
                            min="0"
                            value={lineForm.lengthFeet}
                            onChange={(e) => setLineForm({ ...lineForm, lengthFeet: e.target.value })}
                            placeholder="20"
                            className="w-full py-1.5 px-3 rounded-sm border border-slate-300 bg-white font-mono font-bold text-slate-900"
                          />
                        </div>
                        <div>
                          <label htmlFor={fieldIdInches} className="block text-[11px] font-bold text-slate-700 mb-1">
                            Length (Inches)
                          </label>
                          <input
                            id={fieldIdInches}
                            type="number"
                            step="0.5"
                            value={lineForm.lengthInches}
                            onChange={(e) => setLineForm({ ...lineForm, lengthInches: e.target.value })}
                            placeholder="0"
                            className="w-full py-1.5 px-3 rounded-sm border border-slate-300 bg-white font-mono text-slate-900"
                          />
                        </div>
                      </>
                    )}

                    <div>
                      <label htmlFor={fieldIdNos} className="block text-[11px] font-bold text-slate-700 mb-1">
                        Nos <span className="text-rose-600">*</span>
                      </label>
                      <input
                        id={fieldIdNos}
                        type="number"
                        step="1"
                        min="1"
                        value={lineForm.nos}
                        onChange={(e) => setLineForm({ ...lineForm, nos: e.target.value })}
                        placeholder="10"
                        className="w-full py-1.5 px-3 rounded-sm border border-slate-300 bg-white font-mono font-bold text-slate-900"
                      />
                    </div>

                    <div>
                      <label htmlFor={fieldIdRate} className="block text-[11px] font-bold text-slate-700 mb-1">
                        Rate per Kg (₹) <span className="text-rose-600">*</span>
                      </label>
                      <input
                        id={fieldIdRate}
                        type="number"
                        step="0.01"
                        value={lineForm.rate}
                        onChange={(e) => setLineForm({ ...lineForm, rate: e.target.value })}
                        className="w-full py-1.5 px-3 rounded-sm border border-slate-300 bg-white font-mono font-bold text-slate-900"
                      />
                    </div>
                  </div>
                </div>
              )}

              {lineForm.product.qtyMethod === 'PIECE' && (
                <div className="bg-slate-50 p-3.5 rounded-sm border border-slate-300 space-y-3">
                  <div className="font-bold text-slate-800 text-xs">Piece Count &amp; Accessories</div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
                    <div>
                      <label htmlFor={fieldIdNos} className="block text-[11px] font-bold text-slate-700 mb-1">
                        Number of Pieces (Nos) <span className="text-rose-600">*</span>
                      </label>
                      <input
                        id={fieldIdNos}
                        type="number"
                        step="1"
                        min="1"
                        value={lineForm.nos}
                        onChange={(e) => setLineForm({ ...lineForm, nos: e.target.value })}
                        placeholder="7"
                        className="w-full py-1.5 px-3 rounded-sm border border-slate-300 bg-white font-mono font-bold text-slate-900"
                      />
                    </div>

                    <div>
                      <label htmlFor={fieldIdRate} className="block text-[11px] font-bold text-slate-700 mb-1">
                        Rate per Piece (₹) <span className="text-rose-600">*</span>
                      </label>
                      <input
                        id={fieldIdRate}
                        type="number"
                        step="0.01"
                        value={lineForm.rate}
                        onChange={(e) => setLineForm({ ...lineForm, rate: e.target.value })}
                        className="w-full py-1.5 px-3 rounded-sm border border-slate-300 bg-white font-mono font-bold text-slate-900"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Discounts & Manual Quantity Override */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200">
                {/* Discount */}
                <div>
                  <label htmlFor={fieldIdDiscount} className="block text-[11px] font-bold text-slate-700 mb-1">
                    Line Discount (₹ Amount)
                  </label>
                  <input
                    id={fieldIdDiscount}
                    type="number"
                    step="0.01"
                    min="0"
                    value={lineForm.discountAmount}
                    onChange={(e) => setLineForm({ ...lineForm, discountAmount: e.target.value, discountPct: '' })}
                    placeholder="0.00"
                    className="w-full py-1.5 px-3 rounded-sm border border-slate-300 font-mono text-xs"
                  />
                </div>

                <div>
                  <label htmlFor={fieldIdGst} className="block text-[11px] font-bold text-slate-700 mb-1">GST Rate (%)</label>
                  <input
                    id={fieldIdGst}
                    type="number"
                    step="0.5"
                    value={lineForm.gstRate}
                    disabled
                    className="w-full py-1.5 px-3 rounded-sm border border-slate-300 bg-slate-100 font-mono font-bold text-slate-700"
                  />
                </div>

                {/* Manual Quantity Override */}
                <div className="space-y-1">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800 pt-1">
                    <input
                      type="checkbox"
                      checked={lineForm.isManualQuantity}
                      onChange={(e) =>
                        setLineForm({
                          ...lineForm,
                          isManualQuantity: e.target.checked,
                          manualQuantity: e.target.checked
                            ? lineForm.manualQuantity || (calculatedLinePreview ? String(calculatedLinePreview.quantity) : '')
                            : '',
                        })
                      }
                      className="rounded-sm border-slate-300 text-[#0f2444] focus:ring-0 h-4 w-4"
                    />
                    <span>Manual Quantity Override</span>
                  </label>

                  {lineForm.isManualQuantity && (
                    <div className="pt-1">
                      <input
                        id={fieldIdManualQty}
                        type="number"
                        step="0.01"
                        value={lineForm.manualQuantity}
                        onChange={(e) => setLineForm({ ...lineForm, manualQuantity: e.target.value })}
                        placeholder={`e.g. 85 (${lineForm.product.unit})`}
                        className="w-full py-1.5 px-3 rounded-sm border border-amber-400 bg-amber-50 font-mono font-bold text-amber-950"
                      />
                      <span className="text-[10px] text-amber-800 font-medium">
                        Bypasses calculated formula for billing. Dimensions remain preserved.
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Real-Time Line Calculation Feedback Box */}
              {calculatedLinePreview && (
                <div className="p-3.5 bg-[#0f2444] text-white rounded-sm flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-5">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Calculated Quantity</span>
                      <span className="font-mono font-bold text-sky-300 text-sm">
                        {calculatedLinePreview.quantity} {calculatedLinePreview.unit}
                        {calculatedLinePreview.isManualQuantity && (
                          <span className="text-[10px] text-amber-300 ml-1 font-normal">(Manual)</span>
                        )}
                      </span>
                    </div>

                    {calculatedLinePreview.perPieceQuantity > 0 && !calculatedLinePreview.isManualQuantity && (
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Per Piece</span>
                        <span className="font-mono text-slate-200 font-semibold">
                          {calculatedLinePreview.perPieceQuantity} {calculatedLinePreview.unit}/pc
                        </span>
                      </div>
                    )}

                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Taxable Value</span>
                      <span className="font-mono text-white font-bold">
                        ₹{Number(calculatedLinePreview.taxableAmount).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Line Total (incl. GST)</span>
                    <span className="font-mono font-bold text-amber-300 text-base">
                      ₹{Number(calculatedLinePreview.totalAmount).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {/* Submit Line Button */}
              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0f2444] hover:bg-[#16335d] text-white rounded-sm font-bold text-xs shadow-xs transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>{lineForm.editingLineId ? 'Update Line in Draft' : 'Add Line to Quotation'}</span>
                </button>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Section 3: Draft Quotation Lines Table */}
      <div className="bg-white rounded-sm border border-slate-300 shadow-xs overflow-hidden relative z-10">
        <div className="p-3.5 bg-slate-100 border-b border-slate-300 flex items-center justify-between">
          <div className="font-bold text-slate-800 text-xs uppercase tracking-wide flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#0f2444]" />
            <span>Quotation Line Items ({lines.length})</span>
          </div>
          {lines.length > 0 && (
            <span className="text-xs text-slate-600 font-medium">
              Tax Mode: <strong className="text-slate-900 font-bold">{taxMode === 'intra' ? 'CGST+SGST (Intra)' : 'IGST (Inter)'}</strong>
            </span>
          )}
        </div>

        {lines.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No line items added yet. Select a product above and click &quot;Add Line to Quotation&quot;.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold text-[11px] uppercase tracking-wider">
                  <th className="py-2.5 px-3 text-center w-8">#</th>
                  <th className="py-2.5 px-3">Product</th>
                  <th className="py-2.5 px-3">Specifications</th>
                  <th className="py-2.5 px-3 text-center">Length</th>
                  <th className="py-2.5 px-3 text-center">Nos</th>
                  <th className="py-2.5 px-3 text-right">Qty</th>
                  <th className="py-2.5 px-3 text-center">Unit</th>
                  <th className="py-2.5 px-3 text-right">Rate (₹)</th>
                  <th className="py-2.5 px-3 text-right">Discount</th>
                  <th className="py-2.5 px-3 text-right">Taxable (₹)</th>
                  <th className="py-2.5 px-3 text-center">GST</th>
                  <th className="py-2.5 px-3 text-right" title="Line taxable amount plus individual rounded GST">Est. Total (₹)*</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {lines.map((line, idx) => (
                  <tr key={line.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 text-center text-slate-500 font-mono text-[11px]">{idx + 1}</td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900">{line.productName}</div>
                      <div className="text-[10px] text-slate-500 font-mono">HSN: {line.hsn}</div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                      {line.snapshot.qtyMethod === 'SHEET_WEIGHT' && (
                        <span>
                          Thick: <strong className="font-mono text-slate-800">{line.snapshot.thicknessMm}mm</strong> &bull; Coil: <strong className="font-mono text-slate-800">{line.snapshot.coilWidthM}m</strong>
                        </span>
                      )}
                      {line.snapshot.qtyMethod === 'SECTION_WEIGHT' && (
                        <span>
                          Section: <strong className="font-mono text-slate-800">{line.snapshot.kgPerMetre} kg/m</strong>
                        </span>
                      )}
                      {line.snapshot.qtyMethod === 'PIECE' && <span>Fixed Piece Accessory</span>}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-medium text-slate-800 text-[11px]">
                      {line.snapshot.qtyMethod === 'SHEET_WEIGHT' && (
                        <span>{line.lengthFeet}&apos; {line.lengthInches ? `${line.lengthInches}"` : '0"'}</span>
                      )}
                      {line.snapshot.qtyMethod === 'SECTION_WEIGHT' && (
                        <span>
                          {line.lengthFeet !== undefined && line.lengthFeet !== null
                            ? `${line.lengthFeet}'${line.lengthInches ? ` ${line.lengthInches}"` : ''}`
                            : `${line.lengthM}m`}
                        </span>
                      )}
                      {line.snapshot.qtyMethod === 'PIECE' && <span className="text-slate-400">—</span>}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold font-mono text-slate-800">{line.nos}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      {Number(line.quantity).toFixed(2)}
                      {line.isManualQuantity && (
                        <span className="block text-[9px] uppercase font-bold text-amber-700">Manual</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center font-semibold text-slate-700 text-[11px]">{line.unit}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-700">₹{Number(line.rate).toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                      {line.discountAmount ? `₹${Number(line.discountAmount).toFixed(2)}` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">
                      ₹{Number(line.taxableAmount).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-700">{line.gstRate}%</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      ₹{Number(line.totalAmount).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleEditLine(line)}
                          className="p-1 text-slate-500 hover:text-[#0f2444] rounded-sm transition"
                          title="Edit Line"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteLine(line.id)}
                          className="p-1 text-slate-500 hover:text-rose-600 rounded-sm transition"
                          title="Remove Line"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500 italic">
              * Note: Line item totals reflect individual half-up GST rounding. Official document GST, Grand Total, and Round-Off are calculated on aggregate taxable turnover per HSN group as mandated by GST statutory rules.
            </div>
          </div>
        )}
      </div>

      {/* Section 4: Live Totals & Summary Card */}
      {lines.length > 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Physical Quantities & Words */}
            <div className="space-y-3">
              <div className="bg-white p-4 rounded-sm border border-slate-300 shadow-xs">
                <div className="font-bold text-slate-700 text-xs uppercase tracking-wider mb-2.5">
                  Physical Quantities Summary
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-sm border border-slate-300">
                    <span className="text-[11px] text-slate-600 font-semibold block uppercase">Total Weight</span>
                    <span className="text-base font-mono font-bold text-[#0f2444]">{totals.totalKgs.toFixed(2)} Kgs</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-sm border border-slate-300">
                    <span className="text-[11px] text-slate-600 font-semibold block uppercase">Total Pieces</span>
                    <span className="text-base font-mono font-bold text-[#0f2444]">{totals.totalNos.toString()} Nos</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-sm border border-slate-300">
                <div className="text-[10px] uppercase font-bold text-slate-700 tracking-wider mb-1">
                  Amount in Words
                </div>
                <div className="text-xs font-bold text-slate-900 italic">{totals.amountInWords}</div>
              </div>
            </div>

            {/* Financial Breakdown Card */}
            <div className="bg-white p-4 rounded-sm border border-slate-300 shadow-xs space-y-2 text-xs">
              <div className="flex justify-between text-slate-700 font-medium">
                <span>Subtotal (Taxable Value):</span>
                <span className="font-mono font-bold text-slate-900">₹{totals.subtotal.toFixed(2)}</span>
              </div>

              {taxMode === 'intra' ? (
                <>
                  <div className="flex justify-between text-slate-600">
                    <span>CGST (Central Tax):</span>
                    <span className="font-mono font-semibold text-slate-900">₹{totals.cgstTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>SGST (State Tax):</span>
                    <span className="font-mono font-semibold text-slate-900">₹{totals.sgstTotal.toFixed(2)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-slate-600">
                  <span>IGST (Integrated Tax):</span>
                  <span className="font-mono font-semibold text-slate-900">₹{totals.igstTotal.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-slate-700 border-t border-slate-200 pt-2 font-medium">
                <span>Grand Total:</span>
                <span className="font-mono font-bold text-slate-900">₹{totals.grandTotal.toFixed(2)}</span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>Round-off:</span>
                <span className="font-mono text-slate-900 font-semibold">
                  {formatRoundOff(totals.roundOff)}
                </span>
              </div>

              <div className="flex justify-between text-sm font-bold bg-[#0f2444] text-white -mx-4 -mb-4 mt-3 p-4 rounded-b-sm">
                <span className="uppercase tracking-wide">Final Payable Amount:</span>
                <span className="text-lg font-mono text-amber-300 font-bold">
                  ₹{totals.payableAmount.toNumber().toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Final Action Bar */}
          <div className="bg-white p-4 rounded-sm border border-slate-300 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-xs text-slate-600">
              {!selectedCustomer ? (
                <span className="text-amber-800 font-medium flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  Select a customer above to finalize and issue this quotation.
                </span>
              ) : (
                <span className="text-slate-600">
                  Ready to issue official quotation for <strong className="text-slate-900 font-bold">{selectedCustomer.name}</strong>.
                </span>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-sm shadow-xs transition"
              >
                Cancel Draft
              </button>
              <button
                type="button"
                onClick={handleSaveQuotation}
                disabled={isSaving || lines.length === 0 || !selectedCustomer}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#0f2444] hover:bg-[#16335d] text-white rounded-sm text-xs font-bold shadow-xs transition disabled:opacity-50 disabled:cursor-not-allowed"
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
