import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getQuotations } from '../../services/quotationService';
import { getCustomers } from '../../services/customerService';
import { getProducts } from '../../services/productService';
import type { Quotation } from '../../types/quotation';
import { QuotationPreviewModal } from '../quotations/QuotationPreviewModal';
import {
  Plus,
  ArrowRight,
} from 'lucide-react';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

export const DashboardPage: React.FC = () => {

  // State
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

  // Compute this month's quotations
  const currentYearMonth = new Date().toISOString().slice(0, 7); // e.g. "2026-10"
  const thisMonthQuotes = quotations.filter((q) => {
    if (!q.quotationDate) return false;
    return q.quotationDate.startsWith(currentYearMonth);
  });

  const recentQuotations = quotations.slice(0, 5);

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#D8D2C8] pb-3.5">
        <div>
          <h1 className="font-serif text-lg sm:text-xl font-bold text-[#222222] tracking-normal">
            Sales Desk Dashboard
          </h1>
          <p className="text-xs text-[#5A554E] mt-0.5">
            Summary of sales quotations, customer register, and price list items
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/app/quotations"
            className="inline-flex items-center justify-center px-4 py-2 bg-[#8B2E1F] hover:bg-[#722417] text-white text-xs font-semibold rounded-[2px] transition-colors"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            <span>New Quotation</span>
          </Link>
        </div>
      </div>

      {/* Compact Operational Summary Strip */}
      <div className="bg-white border border-[#D8D2C8] rounded-[2px] grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#D8D2C8]">
        {/* Metric 1: Quotations Issued */}
        <div className="p-3 sm:p-4">
          <div className="text-[11px] font-semibold text-[#5A554E] uppercase tracking-wider mb-1">
            Quotations Issued
          </div>
          <div className="font-mono text-xl sm:text-2xl font-bold text-[#222222]">
            {loading ? '—' : quotations.length}
          </div>
          <div className="text-[11px] text-[#847E75] mt-0.5">
            All-time sales ledger
          </div>
        </div>

        {/* Metric 2: Quotations This Month */}
        <div className="p-3 sm:p-4">
          <div className="text-[11px] font-semibold text-[#5A554E] uppercase tracking-wider mb-1">
            Quotations This Month
          </div>
          <div className="font-mono text-xl sm:text-2xl font-bold text-[#8B2E1F]">
            {loading ? '—' : thisMonthQuotes.length}
          </div>
          <div className="text-[11px] text-[#847E75] mt-0.5">
            Issued in {new Date().toLocaleString('default', { month: 'short', year: 'numeric' })}
          </div>
        </div>

        {/* Metric 3: Customers */}
        <div className="p-3 sm:p-4">
          <div className="text-[11px] font-semibold text-[#5A554E] uppercase tracking-wider mb-1">
            Customers
          </div>
          <div className="font-mono text-xl sm:text-2xl font-bold text-[#222222]">
            {loading ? '—' : customerCount}
          </div>
          <div className="text-[11px] text-[#847E75] mt-0.5">
            Buyer directory records
          </div>
        </div>

        {/* Metric 4: Products in Price List */}
        <div className="p-3 sm:p-4">
          <div className="text-[11px] font-semibold text-[#5A554E] uppercase tracking-wider mb-1">
            Products in Price List
          </div>
          <div className="font-mono text-xl sm:text-2xl font-bold text-[#222222]">
            {loading ? '—' : activeProductCount}
          </div>
          <div className="text-[11px] text-[#847E75] mt-0.5">
            Active catalog items
          </div>
        </div>
      </div>

      {/* Recent Quotations Ledger Panel */}
      <div className="bg-white border border-[#D8D2C8] rounded-[2px] overflow-hidden">
        <div className="px-4 py-2.5 bg-[#FAF8F5] border-b border-[#D8D2C8] flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#222222]">
            Recent Quotations
          </h2>
          <Link
            to="/app/quotations"
            className="text-xs font-semibold text-[#8B2E1F] hover:underline flex items-center gap-1 transition-colors"
          >
            <span>View All Quotations</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {loading ? (
          <div className="p-10 text-center">
            <LoadingSpinner label="Loading recent quotations..." size="md" />
          </div>
        ) : recentQuotations.length === 0 ? (
          <div className="p-8 text-center text-[#5A554E]">
            <p className="text-sm font-semibold text-[#222222]">No quotations recorded yet</p>
            <p className="text-xs text-[#847E75] mt-0.5 mb-3">
              Create your first roofing quotation to begin the sales register.
            </p>
            <Link
              to="/app/quotations"
              className="inline-flex items-center px-3.5 py-1.5 bg-[#8B2E1F] hover:bg-[#722417] text-white rounded-[2px] text-xs font-semibold transition-colors"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              <span>Create First Quotation</span>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#EFECE6] border-b border-[#D8D2C8] text-[#5A554E] font-semibold text-[11px] uppercase tracking-wider">
                  <th className="py-2.5 px-4 font-semibold">Quotation No.</th>
                  <th className="py-2.5 px-4 font-semibold">Date</th>
                  <th className="py-2.5 px-4 font-semibold">Customer</th>
                  <th className="py-2.5 px-4 text-center font-semibold">Tax Mode</th>
                  <th className="py-2.5 px-4 text-right font-semibold">Total Nos</th>
                  <th className="py-2.5 px-4 text-right font-semibold">Total Weight</th>
                  <th className="py-2.5 px-4 text-right font-semibold">Payable Amount</th>
                  <th className="py-2.5 px-4 text-center font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E3DA]">
                {recentQuotations.map((quotation) => (
                  <tr key={quotation.id} className="hover:bg-[#FAF8F5] transition-colors">
                    <td className="py-2.5 px-4 font-mono font-bold text-[#8B2E1F]">
                      {quotation.quotationNumber}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[11px] text-[#5A554E]">
                      {quotation.quotationDate || '—'}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-[#222222]">
                      {quotation.customer.name}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span className="inline-block px-1.5 py-0.5 text-[10px] font-mono font-bold tracking-wider uppercase border border-[#D8D2C8] bg-[#F6F3EE] text-[#5A554E] rounded-[2px]">
                        {quotation.taxMode === 'intra' ? 'INTRA' : 'INTER'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-[#5A554E]">
                      {quotation.totalNos != null ? `${quotation.totalNos} pcs` : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-[#5A554E]">
                      {Number(quotation.totalKgs).toFixed(2)} kg
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-[#222222]">
                      ₹{Number(quotation.payableAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => setPreviewQuotation(quotation)}
                        className="text-xs font-semibold text-[#8B2E1F] hover:underline"
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
