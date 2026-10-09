import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getQuotations } from '../../services/quotationService';
import { getCustomers } from '../../services/customerService';
import { getProducts } from '../../services/productService';
import type { Quotation } from '../../types/quotation';
import { QuotationPreviewModal } from '../quotations/QuotationPreviewModal';
import { Plus, ArrowRight } from 'lucide-react';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

export const DashboardPage: React.FC = () => {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [customerCount, setCustomerCount] = useState<number>(0);
  const [activeProductCount, setActiveProductCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [previewQuotation, setPreviewQuotation] = useState<Quotation | null>(null);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true);
        const [quotesData, customersData, productsData] = await Promise.all([
          getQuotations(),
          getCustomers(),
          getProducts(),
        ]);

        setQuotations(quotesData);
        setCustomerCount(customersData.length);
        setActiveProductCount(productsData.filter((p) => p.active !== false).length);
      } catch (err) {
        console.error('Error loading dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  const currentYearMonth = new Date().toISOString().slice(0, 7);
  const thisMonthQuotes = quotations.filter((q) => {
    if (!q.quotationDate) return false;
    return q.quotationDate.startsWith(currentYearMonth);
  });

  const recentQuotations = quotations.slice(0, 5);

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-line pb-4">
        <div>
          <h1 className="text-xl font-bold text-ink tracking-tight">
            Dashboard
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Operational summary of quotations, customers, and product price list
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/app/quotations"
            className="inline-flex items-center justify-center px-4 py-2 bg-brand hover:bg-brand-dark text-white text-xs font-semibold rounded-control shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            <span>New Quotation</span>
          </Link>
        </div>
      </div>

      {/* Operational Summary Strip */}
      <div className="bg-white border border-line-strong rounded-card shadow-xs grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-line">
        {/* Metric 1: Quotations Issued */}
        <div className="p-4 sm:p-5">
          <div className="text-[10.5px] font-semibold text-faint uppercase tracking-wider mb-1">
            Quotations Issued
          </div>
          <div className="font-mono tabular-nums text-2xl font-bold text-ink">
            {loading ? '—' : quotations.length}
          </div>
          <div className="text-[11px] text-muted mt-0.5">
            All-time sales ledger
          </div>
        </div>

        {/* Metric 2: Quotations This Month */}
        <div className="p-4 sm:p-5">
          <div className="text-[10.5px] font-semibold text-faint uppercase tracking-wider mb-1">
            Quotations This Month
          </div>
          <div className="font-mono tabular-nums text-2xl font-bold text-brand">
            {loading ? '—' : thisMonthQuotes.length}
          </div>
          <div className="text-[11px] text-muted mt-0.5">
            Issued in {new Date().toLocaleString('default', { month: 'short', year: 'numeric' })}
          </div>
        </div>

        {/* Metric 3: Customers */}
        <div className="p-4 sm:p-5">
          <div className="text-[10.5px] font-semibold text-faint uppercase tracking-wider mb-1">
            Customers
          </div>
          <div className="font-mono tabular-nums text-2xl font-bold text-ink">
            {loading ? '—' : customerCount}
          </div>
          <div className="text-[11px] text-muted mt-0.5">
            Registered buyers
          </div>
        </div>

        {/* Metric 4: Products in Price List */}
        <div className="p-4 sm:p-5">
          <div className="text-[10.5px] font-semibold text-faint uppercase tracking-wider mb-1">
            Active Products
          </div>
          <div className="font-mono tabular-nums text-2xl font-bold text-ink">
            {loading ? '—' : activeProductCount}
          </div>
          <div className="text-[11px] text-muted mt-0.5">
            Catalog price list
          </div>
        </div>
      </div>

      {/* Recent Quotations Panel */}
      <div className="bg-white border border-line-strong rounded-card shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 bg-surface-2 border-b border-line flex items-center justify-between">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted">
            Recent Quotations
          </h2>
          <Link
            to="/app/quotations"
            className="text-xs font-semibold text-brand hover:text-brand-dark flex items-center gap-1 transition-colors"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="p-10 text-center">
            <LoadingSpinner label="Loading recent quotations..." size="md" />
          </div>
        ) : recentQuotations.length === 0 ? (
          <div className="p-8 text-center text-muted">
            <p className="text-sm font-semibold text-ink">No quotations recorded yet</p>
            <p className="text-xs text-muted mt-0.5 mb-3">
              Create your first roofing quotation to begin the sales register.
            </p>
            <Link
              to="/app/quotations"
              className="inline-flex items-center px-4 py-2 bg-brand hover:bg-brand-dark text-white rounded-control text-xs font-semibold transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              <span>Create First Quotation</span>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface-2 border-b border-line text-faint font-semibold text-[10.5px] uppercase tracking-wider">
                  <th className="py-3 px-4 font-semibold">Quotation No.</th>
                  <th className="py-3 px-4 font-semibold">Date</th>
                  <th className="py-3 px-4 font-semibold">Customer</th>
                  <th className="py-3 px-4 text-center font-semibold">Tax Mode</th>
                  <th className="py-3 px-4 text-right font-semibold">Qty in Nos</th>
                  <th className="py-3 px-4 text-right font-semibold">Total Weight</th>
                  <th className="py-3 px-4 text-right font-semibold">Payable Amount</th>
                  <th className="py-3 px-4 text-center font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {recentQuotations.map((quotation) => (
                  <tr key={quotation.id} className="hover:bg-surface-2/60 transition-colors">
                    <td className="py-3 px-4 font-mono tabular-nums font-bold text-brand">
                      {quotation.quotationNumber}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-[11px] text-muted">
                      {quotation.quotationDate || '—'}
                    </td>
                    <td className="py-3 px-4 font-semibold text-ink">
                      {quotation.customer.name}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block px-2 py-0.5 text-[10px] font-mono font-bold tracking-wider uppercase border border-line-strong bg-surface-2 text-muted rounded-control">
                        {quotation.taxMode === 'intra' ? 'INTRA' : 'INTER'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-muted">
                      {quotation.totalNos != null && quotation.totalNos > 0 ? `${quotation.totalNos} Nos` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-muted">
                      {Number(quotation.totalKgs).toFixed(2)} Kgs
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-ink">
                      ₹{Number(quotation.payableAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => setPreviewQuotation(quotation)}
                        className="text-xs font-semibold text-brand hover:text-brand-dark hover:underline"
                        title="View Quotation Details"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewQuotation && (
        <QuotationPreviewModal
          quotation={previewQuotation}
          onClose={() => setPreviewQuotation(null)}
        />
      )}
    </div>
  );
};
