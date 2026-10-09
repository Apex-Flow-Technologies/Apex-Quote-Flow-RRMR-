import React, { useState, useEffect } from 'react';
import { getQuotations } from '../../services/quotationService';
import type { Quotation } from '../../types/quotation';
import { QuotationBuilder } from './QuotationBuilder';
import { QuotationPreviewModal } from './QuotationPreviewModal';
import { QuotationPdfActions } from './QuotationPdfActions';
import {
  FileText,
  Plus,
  RefreshCw,
  Search,
  Eye,
  Calendar,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

export const QuotationsPage: React.FC = () => {
  // State
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // View Mode: 'list' | 'builder'
  const [viewMode, setViewMode] = useState<'list' | 'builder'>('list');

  // Preview Modal
  const [previewQuotation, setPreviewQuotation] = useState<Quotation | null>(null);

  // Search in saved list
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Fetch saved quotations from Firestore
  const fetchQuotations = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getQuotations();
      setQuotations(data);
    } catch (err: unknown) {
      console.error('Error fetching quotations:', err);
      const errMsg = err instanceof Error ? err.message : 'Failed to fetch quotations';
      setError(`Unable to load quotations from database: ${errMsg}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotations();
  }, []);

  // Filtered quotations by search
  const filteredQuotations = quotations.filter((q) => {
    if (!searchQuery.trim()) return true;
    const s = searchQuery.toLowerCase().trim();
    return (
      q.quotationNumber.toLowerCase().includes(s) ||
      q.customer.name.toLowerCase().includes(s) ||
      (q.customer.gstin && q.customer.gstin.toLowerCase().includes(s))
    );
  });

  // Handle successful save from builder
  const handleQuotationSaved = (savedQuotation: Quotation) => {
    setViewMode('list');
    setPreviewQuotation(savedQuotation);
    fetchQuotations();
  };

  // If in builder mode, render QuotationBuilder
  if (viewMode === 'builder') {
    return (
      <QuotationBuilder
        onCancel={() => setViewMode('list')}
        onSaved={handleQuotationSaved}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-300 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#0f2444]" />
            Quotation Register &amp; Ledger
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Official sales quotation records, tax classifications, and verified calculations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('builder')}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#0f2444] hover:bg-[#16335d] text-white rounded-sm text-xs font-bold shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>New Quotation</span>
          </button>

          <button
            onClick={fetchQuotations}
            disabled={loading}
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-sm border border-slate-300 transition"
            title="Refresh quotations list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Search / Filter Bar */}
      <div className="bg-white p-3.5 rounded-sm border border-slate-300 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-lg">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by quote number, customer name, or GSTIN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-sm border border-slate-300 focus:outline-none focus:border-[#0f2444] text-slate-900"
          />
        </div>

        <div className="text-xs text-slate-600 font-medium">
          Total Quotations Recorded: <strong className="text-slate-900 font-mono font-bold">{quotations.length}</strong>
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="bg-white rounded-sm border border-slate-300 p-16 text-center shadow-xs">
          <LoadingSpinner label="Loading quotation register from database..." size="lg" />
        </div>
      ) : error ? (
        <div className="bg-white rounded-sm border border-rose-300 p-8 text-center shadow-xs">
          <AlertCircle className="w-10 h-10 text-rose-600 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-900 mb-1">Failed to Load Quotations</h3>
          <p className="text-xs text-slate-600 max-w-md mx-auto mb-4">{error}</p>
          <button
            onClick={fetchQuotations}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#0f2444] text-white rounded-sm text-xs font-semibold hover:bg-[#16335d] transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      ) : filteredQuotations.length === 0 ? (
        <div className="bg-white rounded-sm border border-dashed border-slate-300 p-12 text-center">
          <Clock className="w-10 h-10 text-slate-400 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-800 mb-1">
            {quotations.length === 0 ? 'No Quotations Issued Yet' : 'No Matching Quotations'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
            {quotations.length === 0
              ? 'Click "+ New Quotation" to open the Quotation Builder with live Decimal precision and sequential numbering.'
              : 'Try clearing your search query to view all records in the register.'}
          </p>
          {quotations.length === 0 && (
            <button
              onClick={() => setViewMode('builder')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#0f2444] text-white rounded-sm text-xs font-bold hover:bg-[#16335d] shadow-xs transition"
            >
              <Plus className="w-4 h-4" /> Create First Quotation
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-sm border border-slate-300 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 px-3.5">Quotation No</th>
                  <th className="py-2.5 px-3.5">Date</th>
                  <th className="py-2.5 px-3.5">Customer Name</th>
                  <th className="py-2.5 px-3.5">GSTIN</th>
                  <th className="py-2.5 px-3.5 text-center">Tax Mode</th>
                  <th className="py-2.5 px-3.5 text-center">Items</th>
                  <th className="py-2.5 px-3.5 text-right">Total Weight</th>
                  <th className="py-2.5 px-3.5 text-right">Payable Amount</th>
                  <th className="py-2.5 px-3.5 text-center">Issued By</th>
                  <th className="py-2.5 px-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredQuotations.map((quotation) => (
                  <tr key={quotation.id} className="hover:bg-slate-50/70 transition">
                    {/* Quotation Number */}
                    <td className="py-2.5 px-3.5">
                      <span className="font-mono font-bold text-[#0f2444] bg-slate-100 px-2 py-0.5 rounded-none border border-slate-300">
                        {quotation.quotationNumber}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="py-2.5 px-3.5 text-slate-700 font-medium">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{quotation.quotationDate || '—'}</span>
                      </div>
                    </td>

                    {/* Customer */}
                    <td className="py-2.5 px-3.5 font-bold text-slate-900">
                      {quotation.customer.name}
                    </td>

                    {/* GSTIN */}
                    <td className="py-2.5 px-3.5 font-mono text-slate-700 font-semibold">
                      {quotation.customer.gstin ? (
                        quotation.customer.gstin
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">Unregistered</span>
                      )}
                    </td>

                    {/* Tax Mode */}
                    <td className="py-2.5 px-3.5 text-center">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded-none text-[10px] font-bold uppercase tracking-wide border ${
                          quotation.taxMode === 'intra'
                            ? 'bg-blue-50 text-blue-900 border-blue-300'
                            : 'bg-purple-50 text-purple-900 border-purple-300'
                        }`}
                      >
                        {quotation.taxMode === 'intra' ? 'INTRA (CGST+SGST)' : 'INTER (IGST)'}
                      </span>
                    </td>

                    {/* Items */}
                    <td className="py-2.5 px-3.5 text-center font-bold text-slate-800">
                      {quotation.lines.length}
                    </td>

                    {/* Total Weight */}
                    <td className="py-2.5 px-3.5 text-right font-mono font-semibold text-slate-800">
                      {Number(quotation.totalKgs).toFixed(2)} Kgs
                    </td>

                    {/* Payable Amount */}
                    <td className="py-2.5 px-3.5 text-right font-mono font-bold text-slate-900">
                      ₹{Number(quotation.payableAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>

                    {/* Created By */}
                    <td className="py-2.5 px-3.5 text-center text-slate-600 text-[11px]">
                      {quotation.createdByName}
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <QuotationPdfActions quotation={quotation} variant="table" />
                        <button
                          onClick={() => setPreviewQuotation(quotation)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-700 hover:text-[#0f2444] hover:bg-slate-100 rounded-sm transition text-xs font-semibold border border-slate-300"
                          title="View Quotation Review & Calculation Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-slate-100 px-4 py-2 border-t border-slate-300 text-xs text-slate-700 font-medium flex justify-between">
            <span>Showing {filteredQuotations.length} of {quotations.length} saved records</span>
          </div>
        </div>
      )}

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
