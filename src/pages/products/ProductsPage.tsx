import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  getProducts,
  createProduct,
  updateProduct,
} from '../../services/productService';
import { seedDemoDatabase } from '../../services/seedService';
import {
  type Product,
  type CreateProductInput,
  formatQtyMethodLabel,
} from '../../types/product';
import { STEEL_SHAPE_LABELS, formatSteelSize } from '../../engine/steel';
import { ProductFormModal } from '../../components/products/ProductFormModal';
import { PRODUCT_CATEGORIES } from '../../components/products/productForm';
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
  const [mobileLimit, setMobileLimit] = useState<number>(40);
  useEffect(() => setMobileLimit(40), [searchQuery, categoryFilter, showInactive]);

  // Modals
  const [isAddEditOpen, setIsAddEditOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Seed Modal
  const [isSeedModalOpen, setIsSeedModalOpen] = useState<boolean>(false);
  const [isSeeding, setIsSeeding] = useState<boolean>(false);

  // Toggle Active Modal
  const [toggleActiveTarget, setToggleActiveTarget] = useState<Product | null>(null);
  const [isToggling, setIsToggling] = useState<boolean>(false);

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
    setIsAddEditOpen(true);
  };

  // Open Modal for Edit
  const handleOpenEditModal = (product: Product) => {
    setEditingProduct(product);
    setIsAddEditOpen(true);
  };

  // Save Add or Edit Product (errors are shown inside the form)
  const handleSaveProduct = async (finalPayload: CreateProductInput) => {
    if (editingProduct) {
      await updateProduct(editingProduct.id, finalPayload);
      setActionMessage({
        type: 'success',
        text: `Product "${finalPayload.name}" updated successfully. Saved quotation snapshots remain protected.`,
      });
    } else {
      await createProduct(finalPayload);
      setActionMessage({
        type: 'success',
        text: `Product "${finalPayload.name}" added to master catalog successfully.`,
      });
    }
    setIsAddEditOpen(false);
    await fetchProducts();
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
              {/* Demo seeding is only offered for an empty catalogue (never next to live products) */}

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
          {/* Phone: compact product cards, 40 at a time */}
          <ul className="md:hidden divide-y divide-line">
            {filteredProducts.slice(0, mobileLimit).map((product) => (
              <li key={product.id} className={`p-3.5 flex gap-3 ${!product.active ? 'opacity-60 bg-surface-2/50' : ''}`}>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-ink text-sm leading-snug break-words">
                    {product.name}
                    {product.isPlaceholder && (
                      <span className="ml-1.5 align-middle text-[9px] font-bold uppercase bg-surface-2 text-muted px-1.5 py-0.5 rounded-control border border-line">
                        Demo
                      </span>
                    )}
                    {!product.active && (
                      <span className="ml-1.5 align-middle text-[9px] font-bold uppercase bg-surface-2 text-muted px-1.5 py-0.5 rounded-control border border-line">
                        Off
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted mt-0.5 flex flex-wrap gap-x-1.5">
                    <span>{product.category}</span>
                    <span>&bull;</span>
                    <span>{formatQtyMethodLabel(product.qtyMethod)}</span>
                    {product.qtyMethod === 'SECTION_WEIGHT' && 'kgPerMetre' in product && (
                      <>
                        <span>&bull;</span>
                        <span className="font-mono">{product.kgPerMetre} kg/m</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                  <span className="font-mono tabular-nums font-bold text-sm text-ink">
                    {product.ratePerUnit > 0 ? `₹${product.ratePerUnit}` : 'Rate on quote'}
                    {product.ratePerUnit > 0 && <span className="text-[10px] text-muted font-normal">/{product.unit}</span>}
                  </span>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(product)}
                      className="min-h-[34px] inline-flex items-center gap-1 px-2.5 rounded-control border border-line-strong text-xs font-semibold text-ink"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-brand" /> Edit
                    </button>
                  )}
                </div>
              </li>
            ))}
            {filteredProducts.length > mobileLimit && (
              <li className="p-3">
                <button
                  type="button"
                  onClick={() => setMobileLimit((n) => n + 40)}
                  className="w-full min-h-[44px] rounded-control border border-line-strong text-sm font-semibold text-brand"
                >
                  Show more ({filteredProducts.length - mobileLimit} left)
                </button>
              </li>
            )}
          </ul>

          <div className="hidden md:block overflow-x-auto">
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
                  const isSqm = product.qtyMethod === 'SQM';
                  const isWeightPerPiece = product.qtyMethod === 'WEIGHT_PER_PIECE';
                  const isCustom = product.qtyMethod === 'CUSTOM';

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
                          {isSqm && (
                            <span>
                              Width factor: <strong className="font-mono tabular-nums text-ink">{'widthFactor' in product && product.widthFactor ? product.widthFactor : 1.08}</strong> &bull; Length × 0.305 × width
                            </span>
                          )}
                          {isWeightPerPiece && 'kgPerPiece' in product && (
                            <span>Weight: <strong className="font-mono tabular-nums text-ink">{product.kgPerPiece} kg/pc</strong></span>
                          )}
                          {isSheet && 'thicknessMm' in product && (
                            <span>
                              Thick: <strong className="font-mono tabular-nums text-ink">{product.thicknessMm}mm</strong> &bull; Coil: <strong className="font-mono tabular-nums text-ink">{product.coilWidthM}m</strong>
                            </span>
                          )}
                          {isPipe && 'kgPerMetre' in product && (
                            <span>
                              {'steelShape' in product && product.steelShape && product.steelShape !== 'CHART' && product.steelDims && (
                                <>{STEEL_SHAPE_LABELS[product.steelShape]} {formatSteelSize(product.steelShape, product.steelDims)} &bull; </>
                              )}
                              Weight: <strong className="font-mono tabular-nums text-ink">{product.kgPerMetre} kg/m</strong>
                              {'defaultLengthM' in product && product.defaultLengthM ? <> &bull; {product.defaultLengthM} m length</> : null}
                            </span>
                          )}
                          {isPiece && <span>Fixed unit count</span>}
                          {isCustom && <span>Custom / Service item</span>}
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
                            isSqm
                              ? 'bg-blue-50 text-blue-900 border-blue-200'
                              : isWeightPerPiece
                              ? 'bg-purple-50 text-purple-900 border-purple-200'
                              : isSheet
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
        <ProductFormModal
          mode="master"
          editingProduct={editingProduct}
          onClose={() => setIsAddEditOpen(false)}
          onSubmit={handleSaveProduct}
        />
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
