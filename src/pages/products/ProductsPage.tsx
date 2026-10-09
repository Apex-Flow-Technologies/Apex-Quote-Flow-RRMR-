import React, { useState, useEffect, useMemo, useId } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  getProducts,
  createProduct,
  updateProduct,
} from '../../services/productService';
import { seedDemoDatabase } from '../../services/seedService';
import {
  type Product,
  type QuantityMethod,
  type ProductUnit,
  type CreateProductInput,
  formatQtyMethodLabel,
} from '../../types/product';
import { Decimal } from 'decimal.js';
import {
  Package,
  Plus,
  Sparkles,
  Search,
  Filter,
  Edit2,
  Power,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  X,
  Layers,
  Shield,
} from 'lucide-react';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

const PRODUCT_CATEGORIES = [
  'Crimp',
  'Coloron',
  'Plain',
  'Ridge',
  'L Sheet',
  'Fixing',
  'Pipe',
  'Accessory',
  'Other',
];

interface ProductFormData {
  name: string;
  category: string;
  hsn: string;
  qtyMethod: QuantityMethod;
  unit: ProductUnit;
  ratePerUnit: string;
  baseRate: string;
  minRate: string;
  gstRate: string;
  thicknessMm: string;
  coilWidthM: string;
  densityFactor: string;
  kgPerMetre: string;
  active: boolean;
}

const INITIAL_FORM_STATE: ProductFormData = {
  name: '',
  category: 'Crimp',
  hsn: '72109090',
  qtyMethod: 'SHEET_WEIGHT',
  unit: 'Kgs',
  ratePerUnit: '',
  baseRate: '',
  minRate: '',
  gstRate: '18',
  thicknessMm: '0.47',
  coilWidthM: '1.06',
  densityFactor: '7.968',
  kgPerMetre: '2.34',
  active: true,
};

export const ProductsPage: React.FC = () => {
  const { isAdmin } = useAuth();

  // State
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [showInactive, setShowInactive] = useState<boolean>(false);

  // Modals
  const [isAddEditOpen, setIsAddEditOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<ProductFormData>(INITIAL_FORM_STATE);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Seed Modal
  const [isSeedModalOpen, setIsSeedModalOpen] = useState<boolean>(false);
  const [isSeeding, setIsSeeding] = useState<boolean>(false);

  // Toggle Active Modal
  const [toggleActiveTarget, setToggleActiveTarget] = useState<Product | null>(null);
  const [isToggling, setIsToggling] = useState<boolean>(false);

  // Generate unique IDs for form field accessibility
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
  const fieldIdBaseRate = useId();
  const fieldIdMinRate = useId();

  // Load products from Firestore
  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getProducts();
      // Sort alphabetically by category then name
      data.sort((a, b) => {
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        return a.name.localeCompare(b.name);
      });
      setProducts(data);
    } catch (err: unknown) {
      console.error('Error fetching products:', err);
      const errMsg = err instanceof Error ? err.message : 'Failed to fetch products';
      setError(`Unable to load products from database: ${errMsg}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Filtered products calculation
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Inactive filter
      if (!showInactive && !p.active) return false;

      // Category filter
      if (categoryFilter !== 'ALL' && p.category.toLowerCase() !== categoryFilter.toLowerCase()) {
        return false;
      }

      // Search query
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesHsn = p.hsn.toLowerCase().includes(q);
        const matchesCategory = p.category.toLowerCase().includes(q);
        if (!matchesName && !matchesHsn && !matchesCategory) return false;
      }

      return true;
    });
  }, [products, showInactive, categoryFilter, searchQuery]);

  // Handle Seeding Demo Products
  const handleSeedProducts = async () => {
    try {
      setIsSeeding(true);
      const result = await seedDemoDatabase();
      setIsSeedModalOpen(false);
      setActionMessage({
        type: 'success',
        text: `Demo catalog check complete: ${result.productsSeeded} new demo item(s) synchronized.`,
      });
      await fetchProducts();
    } catch (err: unknown) {
      console.error('Seeding error:', err);
      const errMsg = err instanceof Error ? err.message : 'Seeding failed';
      setActionMessage({
        type: 'error',
        text: `Failed to seed demo database: ${errMsg}`,
      });
    } finally {
      setIsSeeding(false);
    }
  };

  // Open Modal for Add
  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setFormData(INITIAL_FORM_STATE);
    setFormErrors({});
    setIsAddEditOpen(true);
  };

  // Open Modal for Edit
  const handleOpenEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      category: product.category,
      hsn: product.hsn,
      qtyMethod: product.qtyMethod,
      unit: product.unit,
      ratePerUnit: String(product.ratePerUnit),
      baseRate: product.baseRate !== undefined ? String(product.baseRate) : '',
      minRate: product.minRate !== undefined ? String(product.minRate) : '',
      gstRate: String(product.gstRate),
      thicknessMm:
        'thicknessMm' in product && product.thicknessMm !== undefined
          ? String(product.thicknessMm)
          : '',
      coilWidthM:
        'coilWidthM' in product && product.coilWidthM !== undefined
          ? String(product.coilWidthM)
          : '',
      densityFactor:
        'densityFactor' in product && product.densityFactor !== undefined
          ? String(product.densityFactor)
          : '7.968',
      kgPerMetre:
        'kgPerMetre' in product && product.kgPerMetre !== undefined
          ? String(product.kgPerMetre)
          : '',
      active: product.active,
    });
    setFormErrors({});
    setIsAddEditOpen(true);
  };

  // Handle method change in form
  const handleMethodChange = (newMethod: QuantityMethod) => {
    let newUnit: ProductUnit = 'Kgs';
    if (newMethod === 'PIECE') {
      newUnit = 'Nos';
    } else if (newMethod === 'AREA') {
      newUnit = 'Sq.Mtr';
    } else if (newMethod === 'RUNNING_LENGTH') {
      newUnit = 'R.Mtr';
    } else if (newMethod === 'LENGTH_FT') {
      newUnit = 'Ft';
    }

    setFormData((prev) => ({
      ...prev,
      qtyMethod: newMethod,
      unit: newUnit,
    }));
  };

  // Form validation
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Product name is required';
    }

    if (!formData.hsn.trim()) {
      errors.hsn = 'HSN code is required';
    }

    // Rate validation
    try {
      if (!formData.ratePerUnit || formData.ratePerUnit.trim() === '') {
        errors.ratePerUnit = 'Rate per unit is required';
      } else {
        const rateDec = new Decimal(formData.ratePerUnit);
        if (rateDec.lte(0) || !rateDec.isFinite()) {
          errors.ratePerUnit = 'Rate per unit must be greater than 0';
        }
      }
    } catch {
      errors.ratePerUnit = 'Invalid numeric rate';
    }

    // GST validation
    try {
      if (formData.gstRate.trim() === '') {
        errors.gstRate = 'GST rate is required';
      } else {
        const gstDec = new Decimal(formData.gstRate);
        if (gstDec.lt(0) || !gstDec.isFinite()) {
          errors.gstRate = 'GST rate cannot be negative';
        }
      }
    } catch {
      errors.gstRate = 'Invalid numeric GST percentage';
    }

    // Method-specific validation
    if (formData.qtyMethod === 'SHEET_WEIGHT') {
      try {
        if (!formData.thicknessMm || formData.thicknessMm.trim() === '') {
          errors.thicknessMm = 'Thickness is required for sheet calculation';
        } else {
          const t = new Decimal(formData.thicknessMm);
          if (t.lte(0) || !t.isFinite()) {
            errors.thicknessMm = 'Thickness must be greater than 0 mm';
          }
        }
      } catch {
        errors.thicknessMm = 'Invalid thickness number';
      }

      try {
        if (!formData.coilWidthM || formData.coilWidthM.trim() === '') {
          errors.coilWidthM = 'Coil width is required for sheet calculation';
        } else {
          const w = new Decimal(formData.coilWidthM);
          if (w.lte(0) || !w.isFinite()) {
            errors.coilWidthM = 'Coil width must be greater than 0 m';
          }
        }
      } catch {
        errors.coilWidthM = 'Invalid coil width number';
      }
    } else if (formData.qtyMethod === 'SECTION_WEIGHT') {
      try {
        if (!formData.kgPerMetre || formData.kgPerMetre.trim() === '') {
          errors.kgPerMetre = 'Weight per metre is required for pipe calculation';
        } else {
          const kg = new Decimal(formData.kgPerMetre);
          if (kg.lte(0) || !kg.isFinite()) {
            errors.kgPerMetre = 'Weight per metre must be greater than 0 kg/m';
          }
        }
      } catch {
        errors.kgPerMetre = 'Invalid weight per metre number';
      }
    }

    // Optional Base & Min rates validation
    if (formData.baseRate.trim() !== '') {
      try {
        const br = new Decimal(formData.baseRate);
        if (br.lt(0)) errors.baseRate = 'Base rate cannot be negative';
      } catch {
        errors.baseRate = 'Invalid base rate number';
      }
    }

    if (formData.minRate.trim() !== '') {
      try {
        const mr = new Decimal(formData.minRate);
        if (mr.lt(0)) errors.minRate = 'Min rate cannot be negative';
      } catch {
        errors.minRate = 'Invalid min rate number';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit Add or Edit Product
  const handleSubmitProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setIsSubmitting(true);

      const basePayload = {
        name: formData.name.trim(),
        category: formData.category.trim(),
        hsn: formData.hsn.trim(),
        ratePerUnit: new Decimal(formData.ratePerUnit).toNumber(),
        gstRate: new Decimal(formData.gstRate).toNumber(),
        unit: formData.unit,
        active: formData.active,
        baseRate: formData.baseRate.trim() ? new Decimal(formData.baseRate).toNumber() : undefined,
        minRate: formData.minRate.trim() ? new Decimal(formData.minRate).toNumber() : undefined,
      };

      let finalPayload: CreateProductInput;

      if (formData.qtyMethod === 'SHEET_WEIGHT') {
        finalPayload = {
          ...basePayload,
          qtyMethod: 'SHEET_WEIGHT',
          thicknessMm: new Decimal(formData.thicknessMm).toNumber(),
          coilWidthM: new Decimal(formData.coilWidthM).toNumber(),
          densityFactor: formData.densityFactor.trim()
            ? new Decimal(formData.densityFactor).toNumber()
            : 7.968,
          stockMethod: 'WEIGHT',
        };
      } else if (formData.qtyMethod === 'SECTION_WEIGHT') {
        finalPayload = {
          ...basePayload,
          qtyMethod: 'SECTION_WEIGHT',
          kgPerMetre: new Decimal(formData.kgPerMetre).toNumber(),
          stockMethod: 'WEIGHT',
        };
      } else if (formData.qtyMethod === 'PIECE') {
        finalPayload = {
          ...basePayload,
          qtyMethod: 'PIECE',
          stockMethod: 'PIECE',
        };
      } else {
        finalPayload = {
          ...basePayload,
          qtyMethod: formData.qtyMethod,
          stockMethod: 'NONE',
        };
      }

      if (editingProduct) {
        await updateProduct(editingProduct.id, finalPayload);
        setActionMessage({
          type: 'success',
          text: `Product "${formData.name}" updated successfully. Saved quotation snapshots remain protected.`,
        });
      } else {
        await createProduct(finalPayload);
        setActionMessage({
          type: 'success',
          text: `Product "${formData.name}" added to master catalog successfully.`,
        });
      }

      setIsAddEditOpen(false);
      await fetchProducts();
    } catch (err: unknown) {
      console.error('Error saving product:', err);
      const errMsg = err instanceof Error ? err.message : 'Failed to save product';
      setFormErrors({ submit: errMsg });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Active Status
  const handleConfirmToggleActive = async () => {
    if (!toggleActiveTarget) return;

    try {
      setIsToggling(true);
      const newStatus = !toggleActiveTarget.active;
      await updateProduct(toggleActiveTarget.id, { active: newStatus });
      setActionMessage({
        type: 'success',
        text: `Product "${toggleActiveTarget.name}" is now ${newStatus ? 'active' : 'inactive'}.`,
      });
      setToggleActiveTarget(null);
      await fetchProducts();
    } catch (err: unknown) {
      console.error('Toggle active error:', err);
      const errMsg = err instanceof Error ? err.message : 'Status update failed';
      setActionMessage({
        type: 'error',
        text: `Failed to update product status: ${errMsg}`,
      });
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-line pb-4">
        <div>
          <h1 className="text-xl font-bold text-ink flex items-center gap-2">
            <Package className="w-5 h-5 text-brand" />
            Product Master Catalog
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Roofing sheets, MS pipes, accessories, and unit measurement rates.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              <button
                onClick={() => setIsSeedModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-surface-2 text-ink rounded-control text-xs font-semibold border border-line-strong shadow-xs transition"
                title="Synchronize standard 20 demo catalogue products if missing"
              >
                <Sparkles className="w-3.5 h-3.5 text-warn" />
                <span>Seed Demo Products</span>
              </button>

              <button
                onClick={handleOpenAddModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-brand hover:bg-brand-dark text-white rounded-control text-xs font-bold shadow-xs transition"
              >
                <Plus className="w-4 h-4" />
                <span>Add Product</span>
              </button>
            </>
          )}

          <button
            onClick={fetchProducts}
            disabled={loading}
            className="p-1.5 text-muted hover:text-ink hover:bg-surface-2 rounded-control border border-line-strong transition"
            title="Refresh product list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Action Banner / Notification */}
      {actionMessage && (
        <div
          className={`p-3 rounded-control flex items-center justify-between text-xs font-medium border ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-muted hover:text-ink p-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Role notice if sales user */}
      {!isAdmin && (
        <div className="bg-amber-50 border border-amber-200 p-3 rounded-control flex items-center gap-2 text-xs text-amber-900">
          <Shield className="w-4 h-4 text-warn shrink-0" />
          <span>
            Sales View: Product catalog is read-only. Rates and master specifications can only be modified by administrators.
          </span>
        </div>
      )}

      {/* Filters and Search Bar */}
      <div className="bg-white p-3.5 rounded-card border border-line shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-lg">
          <Search className="w-4 h-4 text-faint absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by product name, HSN code, or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-control border border-line-strong focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand text-ink bg-white"
          />
        </div>

        {/* Category & Status Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <Filter className="w-3.5 h-3.5 text-faint" />
            <span className="font-semibold text-ink">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-xs py-1.5 px-2 rounded-control border border-line-strong bg-white focus:outline-none focus:border-brand font-medium text-ink"
            >
              <option value="ALL">All Categories</option>
              {PRODUCT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-xs font-semibold text-muted cursor-pointer select-none border-l pl-3 border-line">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded-control border-line-strong text-brand focus:ring-0 h-3.5 w-3.5"
            />
            <span className="text-ink">Show Inactive Items</span>
          </label>
        </div>
      </div>

      {/* Product Content / Table */}
      {loading ? (
        <div className="bg-white rounded-card border border-line p-16 text-center shadow-xs">
          <LoadingSpinner label="Loading product catalog from database..." size="lg" />
        </div>
      ) : error ? (
        <div className="bg-white rounded-card border border-rose-200 p-8 text-center shadow-xs">
          <AlertCircle className="w-10 h-10 text-rose-600 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-ink mb-1">Failed to Load Products</h3>
          <p className="text-xs text-muted max-w-md mx-auto mb-4">{error}</p>
          <button
            onClick={fetchProducts}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-brand text-white rounded-control text-xs font-semibold hover:bg-brand-dark transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry Connection
          </button>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white rounded-card border border-dashed border-line-strong p-12 text-center">
          <Layers className="w-10 h-10 text-faint mx-auto mb-2" />
          <h3 className="text-sm font-bold text-ink mb-1">
            {products.length === 0 ? 'No Products in Database' : 'No Matching Products'}
          </h3>
          <p className="text-xs text-muted max-w-md mx-auto mb-4">
            {products.length === 0
              ? 'Your product master is currently empty. You can seed standard demo products or create custom items.'
              : 'Try clearing your search query or category filter.'}
          </p>
          {products.length === 0 && isAdmin && (
            <button
              onClick={() => setIsSeedModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-brand text-white rounded-control text-xs font-bold hover:bg-brand-dark shadow-xs transition"
            >
              <Sparkles className="w-3.5 h-3.5" /> Seed 20 Demo Products
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-card border border-line shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface-2 border-b border-line text-faint font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 px-3.5">Product Description</th>
                  <th className="py-2.5 px-3.5">Category</th>
                  <th className="py-2.5 px-3.5">HSN Code</th>
                  <th className="py-2.5 px-3.5">Calculation Method</th>
                  <th className="py-2.5 px-3.5 text-center">Unit</th>
                  <th className="py-2.5 px-3.5 text-right">Rate / Unit</th>
                  <th className="py-2.5 px-3.5 text-center">GST</th>
                  <th className="py-2.5 px-3.5 text-center">Status</th>
                  <th className="py-2.5 px-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredProducts.map((product) => {
                  const isSheet = product.qtyMethod === 'SHEET_WEIGHT';
                  const isPipe = product.qtyMethod === 'SECTION_WEIGHT';
                  const isPiece = product.qtyMethod === 'PIECE';

                  return (
                    <tr
                      key={product.id}
                      className={`hover:bg-brand-tint/40 transition ${
                        !product.active ? 'bg-surface-2/50 opacity-60' : ''
                      }`}
                    >
                      {/* Name & Subtext */}
                      <td className="py-2.5 px-3.5">
                        <div className="font-bold text-ink flex items-center gap-1.5">
                          {product.name}
                          {product.isPlaceholder && (
                            <span className="text-[9px] font-bold uppercase bg-surface-2 text-muted px-1.5 py-0.5 rounded-control border border-line" title="Standard Demo Item">
                              Demo
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted mt-0.5">
                          {isSheet && 'thicknessMm' in product && (
                            <span>
                              Thick: <strong className="font-mono tabular-nums text-ink">{product.thicknessMm}mm</strong> &bull; Coil: <strong className="font-mono tabular-nums text-ink">{product.coilWidthM}m</strong>
                            </span>
                          )}
                          {isPipe && 'kgPerMetre' in product && (
                            <span>Weight: <strong className="font-mono tabular-nums text-ink">{product.kgPerMetre} kg/m</strong></span>
                          )}
                          {isPiece && <span>Fixed unit count</span>}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-2.5 px-3.5">
                        <span className="inline-block px-2 py-0.5 rounded-control text-[11px] font-medium bg-surface-2 text-muted border border-line">
                          {product.category}
                        </span>
                      </td>

                      {/* HSN */}
                      <td className="py-2.5 px-3.5 font-mono tabular-nums text-muted font-medium">{product.hsn}</td>

                      {/* Quantity Method */}
                      <td className="py-2.5 px-3.5">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-control text-[10px] font-bold uppercase tracking-wider border ${
                            isSheet
                              ? 'bg-brand-soft text-brand-dark border-brand/20'
                              : isPipe
                              ? 'bg-amber-50 text-amber-900 border-amber-200'
                              : isPiece
                              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                              : 'bg-surface-2 text-muted border-line'
                          }`}
                        >
                          {formatQtyMethodLabel(product.qtyMethod)}
                        </span>
                      </td>

                      {/* Unit */}
                      <td className="py-2.5 px-3.5 text-center font-medium text-ink">
                        {product.unit}
                      </td>

                      {/* Rate */}
                      <td className="py-2.5 px-3.5 text-right font-mono tabular-nums font-semibold text-ink">
                        ₹{Number(product.ratePerUnit).toFixed(2)}
                      </td>

                      {/* GST */}
                      <td className="py-2.5 px-3.5 text-center font-mono tabular-nums text-muted">
                        {product.gstRate}%
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3.5 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-control text-[10px] font-bold uppercase tracking-wider border ${
                            product.active
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {product.active ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3.5 text-right">
                        {isAdmin ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEditModal(product)}
                              className="p-1.5 text-muted hover:text-brand hover:bg-brand-soft rounded-control border border-line transition"
                              title="Edit product parameters & rate"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setToggleActiveTarget(product)}
                              className={`p-1.5 rounded-control border border-line transition ${
                                product.active
                                  ? 'text-muted hover:text-danger hover:bg-rose-50'
                                  : 'text-muted hover:text-ok hover:bg-emerald-50'
                              }`}
                              title={product.active ? 'Deactivate product' : 'Reactivate product'}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-faint text-[11px] italic">Read-only</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Footer with Summary */}
          <div className="bg-surface-2 px-4 py-2.5 border-t border-line flex items-center justify-between text-xs text-muted font-medium">
            <span>
              Showing {filteredProducts.length} of {products.length} products
            </span>
            <span className="text-[11px] font-semibold">
              Active: <span className="text-ok">{products.filter((p) => p.active).length}</span> &bull; Inactive:{' '}
              <span className="text-danger">{products.filter((p) => !p.active).length}</span>
            </span>
          </div>
        </div>
      )}

      {/* =========================================================================
          ADD / EDIT PRODUCT MODAL
         ========================================================================= */}
      {isAddEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-ink/40 backdrop-blur-xs">
          <div className="bg-white rounded-card shadow-xl border border-line max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            {/* Modal Header */}
            <div className="p-4 bg-surface-2 border-b border-line flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-ink">
                  {editingProduct ? `Edit Product: ${editingProduct.name}` : 'Add New Product Master'}
                </h3>
                <p className="text-[11px] text-muted">
                  {editingProduct
                    ? 'Updating master rates will apply to new quotes. Saved quotation lines preserve snapshots.'
                    : 'Configure product attributes and measurement formula for accurate quotation calculations.'}
                </p>
              </div>
              <button
                onClick={() => setIsAddEditOpen(false)}
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
                    disabled={!!editingProduct}
                    onChange={(e) => handleMethodChange(e.target.value as QuantityMethod)}
                    className="w-full py-1.5 px-3 rounded-control border border-line-strong bg-white font-medium text-ink focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand disabled:bg-surface-2 disabled:text-muted"
                  >
                    <option value="SHEET_WEIGHT">Sheet · by weight (Thickness × Coil Width)</option>
                    <option value="SECTION_WEIGHT">Pipe · by weight (kg per metre)</option>
                    <option value="PIECE">Per piece (Fixed Nos rate)</option>
                    <option value="AREA">By area (Sq.Mtr)</option>
                    <option value="RUNNING_LENGTH">By running metre (R.Mtr)</option>
                    <option value="LENGTH_FT">By feet (Ft)</option>
                    <option value="MANUAL">Manual</option>
                  </select>
                  {editingProduct && (
                    <span className="text-[10px] text-muted mt-0.5 block">Calculation method is locked on edit.</span>
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
                    <span>Pipe / Section Weight Parameters</span>
                    <span className="text-[10px] text-muted font-normal">
                      Formula: Length (ft) × 0.3048 × Weight per Metre (kg/m)
                    </span>
                  </div>

                  <div>
                    <label htmlFor={fieldIdKgPerMetre} className="block text-[11px] font-semibold text-faint uppercase tracking-wider mb-1">
                      Weight per Metre (kg/m) <span className="text-danger">*</span>
                    </label>
                    <input
                      id={fieldIdKgPerMetre}
                      type="number"
                      step="0.01"
                      value={formData.kgPerMetre}
                      onChange={(e) => setFormData({ ...formData, kgPerMetre: e.target.value })}
                      placeholder="e.g. 2.34 (from IS 4923 table)"
                      className="w-full py-1.5 px-3 rounded-control border border-line-strong bg-white font-mono tabular-nums font-semibold text-ink focus:outline-none focus:border-brand max-w-xs"
                    />
                    {formErrors.kgPerMetre && (
                      <p className="text-danger text-[10px] mt-0.5">{formErrors.kgPerMetre}</p>
                    )}
                  </div>
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

              {/* Optional Rate Limits & Active Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-line">
                <div>
                  <label htmlFor={fieldIdBaseRate} className="block text-[11px] font-semibold text-faint uppercase tracking-wider mb-1">Base Rate (₹)</label>
                  <input
                    id={fieldIdBaseRate}
                    type="number"
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

              {/* Modal Actions */}
              <div className="pt-3 border-t border-line flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddEditOpen(false)}
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
                    <span>{editingProduct ? 'Save Changes' : 'Create Product Master'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          SEED DEMO CONFIRMATION MODAL
         ========================================================================= */}
      {isSeedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-ink/40 backdrop-blur-xs">
          <div className="bg-white rounded-card shadow-xl border border-line max-w-md w-full p-5 animate-in fade-in zoom-in-95 duration-100">
            <div className="w-10 h-10 bg-amber-50 text-warn rounded-control flex items-center justify-center mb-3 border border-amber-200">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-ink mb-1">
              Synchronize Standard Demo Catalog
            </h3>
            <p className="text-xs text-muted mb-3 leading-relaxed">
              This action verifies and writes the 20 official demo products (Crimp sheets, Colour-coated sheets, Ridges, Pipes, and Accessories) to the database.
            </p>
            <div className="bg-surface-2 p-3 rounded-control text-xs text-muted border border-line space-y-1 mb-4">
              <div className="font-semibold text-ink uppercase tracking-wider text-[10px]">Safety &amp; Idempotency Guarantee:</div>
              <p className="text-[11px] text-muted">
                &bull; Only missing demo items will be created.<br />
                &bull; Existing customized rates or products will <strong>NEVER</strong> be overwritten.<br />
                &bull; Quotation counter will be initialized safely if absent.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setIsSeedModalOpen(false)}
                disabled={isSeeding}
                className="px-3.5 py-1.5 text-xs font-semibold text-muted hover:text-ink bg-white hover:bg-surface-2 border border-line-strong rounded-control transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSeedProducts}
                disabled={isSeeding}
                className="px-4 py-1.5 text-xs font-bold text-white bg-brand hover:bg-brand-dark rounded-control shadow-xs transition flex items-center gap-1.5"
              >
                {isSeeding ? (
                  <>
                    <LoadingSpinner size="sm" />
                    <span>Synchronizing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-white" />
                    <span>Confirm &amp; Synchronize</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TOGGLE ACTIVE STATUS CONFIRMATION MODAL
         ========================================================================= */}
      {toggleActiveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-ink/40 backdrop-blur-xs">
          <div className="bg-white rounded-card shadow-xl border border-line max-w-sm w-full p-5 animate-in fade-in zoom-in-95 duration-100">
            <div
              className={`w-10 h-10 rounded-control flex items-center justify-center mb-3 border ${
                toggleActiveTarget.active
                  ? 'bg-rose-50 text-danger border-rose-200'
                  : 'bg-emerald-50 text-ok border-emerald-200'
              }`}
            >
              <Power className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-ink mb-1">
              {toggleActiveTarget.active ? 'Deactivate Product?' : 'Reactivate Product?'}
            </h3>
            <p className="text-xs text-muted mb-4 leading-relaxed">
              {toggleActiveTarget.active ? (
                <>
                  Are you sure you want to deactivate <strong className="text-ink">{toggleActiveTarget.name}</strong>?
                  Deactivated products will not appear in the quotation builder.
                  <br /><br />
                  <span className="text-[11px] text-faint">
                    Existing quotations containing this item remain unaffected as they store frozen snapshots.
                  </span>
                </>
              ) : (
                <>
                  Reactivate <strong className="text-ink">{toggleActiveTarget.name}</strong> to make it selectable for new quotations.
                </>
              )}
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setToggleActiveTarget(null)}
                disabled={isToggling}
                className="px-3.5 py-1.5 text-xs font-semibold text-muted hover:text-ink bg-white hover:bg-surface-2 border border-line-strong rounded-control transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmToggleActive}
                disabled={isToggling}
                className={`px-4 py-1.5 text-xs font-bold text-white rounded-control shadow-xs transition flex items-center gap-1.5 ${
                  toggleActiveTarget.active
                    ? 'bg-danger hover:bg-red-700'
                    : 'bg-ok hover:bg-green-700'
                }`}
              >
                {isToggling ? (
                  <>
                    <LoadingSpinner size="sm" />
                    <span>Updating...</span>
                  </>
                ) : (
                  <span>{toggleActiveTarget.active ? 'Deactivate' : 'Reactivate'}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
