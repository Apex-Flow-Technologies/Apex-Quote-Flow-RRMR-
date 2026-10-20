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
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // View Mode: 'list' | 'builder'
  const [viewMode, setViewMode] = useState<'list' | 'builder'>('list');

  // Preview Modal
  const [previewQuotation, setPreviewQuotation] = useState<Quotation | null>(null);

  // Search in saved list
  const [searchQuery, setSearchQuery] = useState<string>('');

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

  const filteredQuotations = quotations.filter((q) => {
    if (!searchQuery.trim()) return true;
    const s = searchQuery.toLowerCase().trim();
    return (
      q.quotationNumber.toLowerCase().includes(s) ||
      q.customer.name.toLowerCase().includes(s) ||
      (q.customer.gstin && q.customer.gstin.toLowerCase().includes(s))
    );
  });

  const handleQuotationSaved = (savedQuotation: Quotation) => {
    setViewMode('list');
    setPreviewQuotation(savedQuotation);
    fetchQuotations();
  };

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-line pb-4">
        <div>
          <h1 className="text-xl font-bold text-ink flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand" />
            <span>Quotations</span>
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Quotation register, tax breakdown, and customer history
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setViewMode('builder')}
            className="flex-1 sm:flex-initial min-h-[44px] inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-brand hover:bg-brand-dark active:scale-[0.99] text-white rounded-control text-xs font-semibold shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>New Quotation</span>
          </button>

          <button
            onClick={fetchQuotations}
            disabled={loading}
            className="w-11 h-11 shrink-0 flex items-center justify-center text-muted hover:text-ink hover:bg-surface-2 rounded-control border border-line-strong transition active:scale-95"
            title="Refresh quotations list"
            aria-label="Refresh quotations list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Search / Filter Bar */}
      <div className="bg-white p-3 sm:p-3.5 rounded-card border border-line-strong shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 w-full sm:max-w-lg">
          <Search className="w-4 h-4 text-faint absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by quote number, customer name, or GSTIN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-3.5 h-11 text-sm rounded-control border border-line-strong focus:border-brand focus:ring-3 focus:ring-brand/15 text-ink bg-white"
          />
        </div>

        <div className="text-xs text-muted font-medium flex items-center justify-between sm:justify-end gap-2">
          <span>Total Quotations:</span>
          <span className="font-mono tabular-nums font-bold text-ink bg-surface-2 px-2 py-0.5 rounded border border-line">
            {quotations.length}
          </span>
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="bg-white rounded-card border border-line-strong p-16 text-center shadow-xs">
          <LoadingSpinner label="Loading quotation register from database..." size="lg" />
        </div>
      ) : error ? (
        <div className="bg-white rounded-card border border-rose-200 p-8 text-center shadow-xs">
          <AlertCircle className="w-10 h-10 text-danger mx-auto mb-2" />
          <h3 className="text-sm font-bold text-ink mb-1">Failed to Load Quotations</h3>
          <p className="text-xs text-muted max-w-md mx-auto mb-4">{error}</p>
          <button
            onClick={fetchQuotations}
            className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 bg-brand text-white rounded-control text-xs font-semibold hover:bg-brand-dark transition shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      ) : filteredQuotations.length === 0 ? (
        <div className="bg-white rounded-card border border-dashed border-line-strong p-10 sm:p-12 text-center">
          <Clock className="w-10 h-10 text-faint mx-auto mb-2" />
          <h3 className="text-sm font-bold text-ink mb-1">
            {quotations.length === 0 ? 'No Quotations Issued Yet' : 'No Matching Quotations'}
          </h3>
          <p className="text-xs text-muted max-w-md mx-auto mb-4">
            {quotations.length === 0
              ? 'Click "+ New Quotation" to create your first quotation with live calculations.'
              : 'Try clearing your search query to view all records in the register.'}
          </p>
          {quotations.length === 0 && (
            <button
              onClick={() => setViewMode('builder')}
              className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 bg-brand text-white rounded-control text-xs font-semibold hover:bg-brand-dark shadow-xs transition"
            >
              <Plus className="w-4 h-4" /> Create First Quotation
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Mobile Card Presentation (< 768px) */}
          <div className="block md:hidden space-y-3">
            {filteredQuotations.map((quotation) => (
              <div
                key={quotation.id}
                className="bg-white rounded-card border border-line-strong p-3.5 shadow-xs space-y-3 transition hover:border-brand/40"
              >
                {/* Card Top Header: Quotation Number Badge & Date */}
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono tabular-nums font-bold text-xs text-brand bg-brand-soft px-2.5 py-1 rounded-control border border-brand/20 select-all shrink-0">
                    {quotation.quotationNumber}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs text-muted font-medium font-mono tabular-nums shrink-0">
                    <Calendar className="w-3.5 h-3.5 text-faint" />
                    <span>{quotation.quotationDate || '—'}</span>
                  </div>
                </div>

                {/* Customer Info & Details */}
                <div>
                  <div className="font-bold text-sm text-ink leading-snug">
                    {quotation.customer.name}
                  </div>
                  <div className="text-xs text-muted mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                    {quotation.customer.gstin ? (
                      <span className="font-mono text-[11px] bg-surface-2 px-1.5 py-0.5 rounded border border-line break-all">
                        GSTIN: <strong className="text-ink font-semibold">{quotation.customer.gstin}</strong>
                      </span>
                    ) : (
                      <span className="text-faint text-[11px] italic">Unregistered Buyer</span>
                    )}
                    <span className="text-line-strong">&bull;</span>
                    <span className="text-[11px] text-muted">
                      {quotation.lines.length} {quotation.lines.length === 1 ? 'item' : 'items'}
                    </span>
                    <span className="text-line-strong">&bull;</span>
                    <span className="text-[11px] font-mono text-muted">
                      {Number(quotation.totalKgs).toFixed(2)} Kgs
                    </span>
                  </div>
                </div>

                {/* Status & Total Amount Box */}
                <div className="pt-2.5 border-t border-line flex items-center justify-between gap-2">
                  <div>
                    <span
                      className={`inline-block px-2 py-0.5 rounded-control text-[10px] font-mono font-bold uppercase tracking-wide border ${
                        quotation.isGstEnabled === false
                          ? 'bg-surface-2 text-muted border-line'
                          : quotation.taxMode === 'intra'
                            ? 'bg-brand-soft text-brand border-brand/20'
                            : 'bg-purple-50 text-purple-700 border-purple-200'
                      }`}
                    >
                      {quotation.isGstEnabled === false
                        ? 'NO GST'
                        : quotation.taxMode === 'intra'
                          ? 'INTRA (CGST+SGST)'
                          : 'INTER (IGST)'}
                    </span>
                    <div className="text-[10px] text-faint mt-0.5 truncate max-w-[140px]">
                      By {quotation.createdByName}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-faint block">
                      Total Payable
                    </span>
                    <span className="text-lg font-mono tabular-nums font-bold text-brand">
                      ₹{Number(quotation.payableAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Card Action Buttons (Min 44px touch targets) */}
                <div className="pt-2.5 border-t border-line flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewQuotation(quotation)}
                    className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-ink bg-white hover:bg-surface-2 active:bg-surface-2 border border-line-strong rounded-control shadow-xs transition"
                    title="View quotation review and calculation details"
                  >
                    <Eye className="w-4 h-4 text-brand" />
                    <span>View Details</span>
                  </button>

                  <div className="shrink-0">
                    <QuotationPdfActions quotation={quotation} variant="card" />
                  </div>
                </div>
              </div>
            ))}

            <div className="p-3 bg-surface-2 rounded-control border border-line text-xs text-muted font-medium text-center">
              Showing {filteredQuotations.length} of {quotations.length} saved records
            </div>
          </div>

          {/* Desktop Table Presentation (>= 768px) */}
          <div className="hidden md:block bg-white rounded-card border border-line-strong shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-surface-2 border-b border-line text-faint font-semibold uppercase tracking-wider text-[10.5px]">
                    <th className="py-3 px-3.5 font-semibold">Quotation No</th>
                    <th className="py-3 px-3.5 font-semibold">Date</th>
                    <th className="py-3 px-3.5 font-semibold">Customer Name</th>
                    <th className="py-3 px-3.5 font-semibold">GSTIN</th>
                    <th className="py-3 px-3.5 text-center font-semibold">Tax Mode</th>
                    <th className="py-3 px-3.5 text-center font-semibold">Items</th>
                    <th className="py-3 px-3.5 text-right font-semibold">Total Weight</th>
                    <th className="py-3 px-3.5 text-right font-semibold">Total Payable</th>
                    <th className="py-3 px-3.5 text-center font-semibold">Issued By</th>
                    <th className="py-3 px-3.5 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredQuotations.map((quotation) => (
                    <tr key={quotation.id} className="hover:bg-surface-2/60 transition">
                      {/* Quotation Number */}
                      <td className="py-3 px-3.5">
                        <span className="font-mono tabular-nums font-bold text-brand bg-brand-soft px-2 py-0.5 rounded-control border border-brand/20">
                          {quotation.quotationNumber}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="py-3 px-3.5 text-muted font-medium font-mono tabular-nums">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-faint" />
                          <span>{quotation.quotationDate || '—'}</span>
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="py-3 px-3.5 font-semibold text-ink">
                        {quotation.customer.name}
                      </td>

                      {/* GSTIN */}
                      <td className="py-3 px-3.5 font-mono text-muted font-medium">
                        {quotation.customer.gstin ? (
                          quotation.customer.gstin
                        ) : (
                          <span className="text-faint italic text-[11px]">Unregistered</span>
                        )}
                      </td>

                      {/* Tax Mode */}
                      <td className="py-3 px-3.5 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-control text-[10px] font-mono font-bold uppercase tracking-wide border ${
                            quotation.isGstEnabled === false
                              ? 'bg-surface-2 text-muted border-line'
                              : quotation.taxMode === 'intra'
                                ? 'bg-brand-soft text-brand border-brand/20'
                                : 'bg-purple-50 text-purple-700 border-purple-200'
                          }`}
                        >
                          {quotation.isGstEnabled === false
                            ? 'NO GST'
                            : quotation.taxMode === 'intra'
                              ? 'INTRA (CGST+SGST)'
                              : 'INTER (IGST)'}
                        </span>
                      </td>

                      {/* Items */}
                      <td className="py-3 px-3.5 text-center font-semibold text-ink">
                        {quotation.lines.length}
                      </td>

                      {/* Total Weight */}
                      <td className="py-3 px-3.5 text-right font-mono tabular-nums font-medium text-muted">
                        {Number(quotation.totalKgs).toFixed(2)} Kgs
                      </td>

                      {/* Total Payable */}
                      <td className="py-3 px-3.5 text-right font-mono tabular-nums font-bold text-ink">
                        ₹{Number(quotation.payableAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Created By */}
                      <td className="py-3 px-3.5 text-center text-muted text-[11px]">
                        {quotation.createdByName}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <QuotationPdfActions quotation={quotation} variant="table" />
                          <button
                            onClick={() => setPreviewQuotation(quotation)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-muted hover:text-ink hover:bg-surface-2 rounded-control transition text-xs font-semibold border border-line-strong"
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

            <div className="bg-surface-2 px-4 py-2.5 border-t border-line text-xs text-muted font-medium flex justify-between">
              <span>Showing {filteredQuotations.length} of {quotations.length} saved records</span>
            </div>
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
