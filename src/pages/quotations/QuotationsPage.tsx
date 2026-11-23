import React, { useState, useEffect } from 'react';
import { getQuotations, getQuotationsFromDevice, updateQuotationStatus } from '../../services/quotationService';
import { useAuth } from '../../hooks/useAuth';
import { useLocation, useNavigate } from 'react-router-dom';
import { QUOTATION_STATUS_LABELS, type Quotation, type QuotationStatus } from '../../types/quotation';
import { QuotationBuilder, type QuotationBuilderSource } from './QuotationBuilder';
import { QuotationPreviewModal, StatusPill } from './QuotationPreviewModal';
import { QuotationPdfActions } from './QuotationPdfActions';
import { draftKey, loadDraft, clearDraft, countDraftLines, type QuoteDraft } from '../../utils/quoteDraft';
import {
  Plus,
  RefreshCw,
  Search,
  Eye,
  AlertCircle,
  Clock,
} from 'lucide-react';

/** "2026-11-21" → "21 Nov 2026" */
function formatQuoteDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function taxLabel(q: Quotation): string {
  if (q.isGstEnabled === false) return 'No GST';
  return q.taxMode === 'intra' ? 'CGST + SGST' : 'IGST';
}

export const QuotationsPage: React.FC = () => {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // View Mode: 'list' | 'builder'
  const [viewMode, setViewMode] = useState<'list' | 'builder'>('list');
  const [builderSource, setBuilderSource] = useState<QuotationBuilderSource | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<QuotationStatus | 'all'>('all');
  const { user, profile, isAdmin } = useAuth();

  const openBuilder = (source?: QuotationBuilderSource) => {
    setBuilderSource(source);
    setPreviewQuotation(null);
    setViewMode('builder');
    window.scrollTo({ top: 0 });
  };

  // "New Quotation" from the dashboard opens the builder straight away
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if ((location.state as { newQuote?: boolean } | null)?.newQuote) {
      openBuilder();
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  // An unsaved new quotation kept on this device: reopen it if the user just
  // navigated away, or offer it if they left with the Back button.
  const newDraftKey = draftKey(user?.uid || 'anon');
  const [pendingDraft, setPendingDraft] = useState<QuoteDraft | null>(null);
  useEffect(() => {
    if (viewMode !== 'list' || !user) return;
    const d = loadDraft(newDraftKey);
    if (d && !d.parked && !(location.state as { newQuote?: boolean } | null)?.newQuote) {
      openBuilder();
      return;
    }
    setPendingDraft(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, user?.uid]);

  const discardPendingDraft = () => {
    clearDraft(newDraftKey);
    setPendingDraft(null);
  };

  const canRevise = (q: Quotation) => isAdmin || q.createdByUid === user?.uid;

  const handleStatusChange = async (q: Quotation, status: QuotationStatus) => {
    await updateQuotationStatus(q.id, status, profile?.name || user?.email || 'Staff');
    setQuotations((list) => list.map((x) => (x.id === q.id ? { ...x, status } : x)));
  };

  // Preview Modal
  const [previewQuotation, setPreviewQuotation] = useState<Quotation | null>(null);

  // Search in saved list
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchQuotations = async () => {
    try {
      setError(null);
      // Show the on-device copy straight away, then refresh from the server.
      const local = await getQuotationsFromDevice();
      if (local.length > 0) {
        setQuotations(local);
        setLoading(false);
      } else {
        setLoading(true);
      }
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
    if (statusFilter !== 'all' && (q.status || 'draft') !== statusFilter) return false;
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
        key={builderSource ? `${builderSource.mode}-${builderSource.quotation.id}` : 'new'}
        source={builderSource}
        onCancel={() => setViewMode('list')}
        onSaved={handleQuotationSaved}
      />
    );
  }

  return (
    <div className="space-y-5">
      {pendingDraft && (
        <div className="anim-fade-up p-3.5 bg-amber-50 border border-amber-200 rounded-card text-amber-900 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          <div className="flex items-start gap-2">
            <Clock className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
            <span>
              <strong className="font-semibold">Unsaved quotation</strong>
              {pendingDraft.customer ? ` for ${pendingDraft.customer.name}` : ''}
              {' · '}
              {countDraftLines(pendingDraft)} item{countDraftLines(pendingDraft) === 1 ? '' : 's'}
              {' · '}
              {new Date(pendingDraft.savedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
            </span>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={discardPendingDraft}
              className="px-3 py-1.5 rounded-control border border-amber-300 bg-white text-amber-900 font-semibold hover:bg-amber-100 transition"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={() => openBuilder()}
              className="px-3 py-1.5 rounded-control bg-brand hover:bg-brand-dark text-white font-semibold transition"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-[26px] sm:text-[30px] leading-tight text-ink">Quotations</h1>
          <p className="text-[13.5px] text-muted mt-1">
            {loading && quotations.length === 0
              ? 'Loading your register…'
              : `${quotations.length} quotation${quotations.length === 1 ? '' : 's'} issued, newest first`}
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={fetchQuotations}
            disabled={loading}
            className="w-11 h-11 shrink-0 flex items-center justify-center text-muted hover:text-ink bg-white hover:bg-surface-2 rounded-[10px] border border-line-strong"
            title="Refresh"
            aria-label="Refresh quotations list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => openBuilder()}
            className="btn-primary flex-1 sm:flex-initial min-h-[44px] inline-flex items-center justify-center gap-2 px-5 text-white rounded-[10px] text-sm font-semibold"
          >
            <Plus className="w-4 h-4" />
            <span>New quotation</span>
          </button>
        </div>
      </div>

      {/* Toolbar: search + status filter */}
      <div className="card p-2 flex flex-col lg:flex-row lg:items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-faint absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            placeholder="Search quotes, customers, GSTIN"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search quotations"
            className="w-full pl-10 pr-3.5 h-10 text-sm rounded-[10px] border border-transparent bg-surface-2 hover:bg-slate-100/70 focus:bg-white text-ink"
          />
        </div>
        <div
          className="flex gap-1 overflow-x-auto no-scrollbar p-1 bg-surface-2 rounded-[10px] shrink-0"
          role="tablist"
          aria-label="Filter by status"
        >
          {(['all', ...Object.keys(QUOTATION_STATUS_LABELS)] as (QuotationStatus | 'all')[]).map((st) => {
            const count = st === 'all' ? quotations.length : quotations.filter((q) => (q.status || 'draft') === st).length;
            const active = statusFilter === st;
            return (
              <button
                key={st}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setStatusFilter(st)}
                className={`shrink-0 h-8 px-3 rounded-[8px] text-[13px] font-medium inline-flex items-center gap-1.5 ${
                  active ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink'
                }`}
              >
                {st === 'all' ? 'All' : QUOTATION_STATUS_LABELS[st]}
                <span className={`tabular-nums text-[12px] ${active ? 'text-brand font-semibold' : 'text-faint'}`}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="card divide-y divide-line overflow-hidden" aria-busy="true" aria-label="Loading quotations">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-5 py-4 flex items-center gap-4 animate-pulse">
              <div className="space-y-2 flex-1">
                <div className="h-4 w-44 bg-surface-2 rounded" />
                <div className="h-3 w-28 bg-surface-2 rounded" />
              </div>
              <div className="h-5 w-24 bg-surface-2 rounded" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="card p-10 text-center">
          <span className="icon-chip bg-rose-50 text-rose-600 mx-auto"><AlertCircle className="w-[18px] h-[18px]" /></span>
          <h3 className="text-[15px] font-semibold text-ink mt-3">Couldn&rsquo;t load quotations</h3>
          <p className="text-[13px] text-muted max-w-md mx-auto mt-1 mb-4">{error}</p>
          <button
            onClick={fetchQuotations}
            className="btn-primary min-h-[44px] inline-flex items-center gap-1.5 px-4 text-white rounded-[10px] text-sm font-semibold"
          >
            <RefreshCw className="w-4 h-4" /> Try again
          </button>
        </div>
      ) : filteredQuotations.length === 0 ? (
        <div className="card p-12 text-center">
          <span className="icon-chip bg-blue-50 text-blue-600 mx-auto"><Clock className="w-[18px] h-[18px]" /></span>
          <h3 className="text-[15px] font-semibold text-ink mt-3">
            {quotations.length === 0 ? 'No quotations yet' : 'Nothing matches that search'}
          </h3>
          <p className="text-[13px] text-muted max-w-md mx-auto mt-1 mb-4">
            {quotations.length === 0
              ? 'Create your first quotation. Prices and GST are worked out as you type.'
              : 'Try a different quote number or customer, or switch the filter back to All.'}
          </p>
          {quotations.length === 0 && (
            <button
              onClick={() => openBuilder()}
              className="btn-primary min-h-[44px] inline-flex items-center gap-1.5 px-4 text-white rounded-[10px] text-sm font-semibold"
            >
              <Plus className="w-4 h-4" /> Create quotation
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Phone: cards */}
          <div className="block md:hidden space-y-3">
            {filteredQuotations.map((quotation, i) => (
              <div key={quotation.id} className="card p-4 space-y-3 anim-row" style={{ animationDelay: `${Math.min(i, 8) * 25}ms` }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-[15px] text-ink leading-snug truncate">{quotation.customer.name}</div>
                    <div className="text-[12.5px] text-muted tabular-nums mt-0.5">
                      {quotation.quotationNumber}
                      {(quotation.revision || 1) > 1 ? ` · Rev ${quotation.revision}` : ''}
                    </div>
                  </div>
                  <StatusPill status={quotation.status} />
                </div>

                <div className="flex items-end justify-between gap-3">
                  <div className="text-[12.5px] text-muted space-y-0.5">
                    <div>{formatQuoteDate(quotation.quotationDate)}</div>
                    <div>
                      {quotation.lines.length} {quotation.lines.length === 1 ? 'item' : 'items'}
                      {Number(quotation.totalKgs) > 0 ? ` · ${Number(quotation.totalKgs).toLocaleString('en-IN', { maximumFractionDigits: 2 })} kg` : ''}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display tabular-nums text-[20px] font-bold text-ink leading-none">
                      ₹{Number(quotation.payableAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-[12px] text-faint mt-1">{taxLabel(quotation)}</div>
                  </div>
                </div>

                <div className="pt-3 border-t border-line flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewQuotation(quotation)}
                    className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 text-[13px] font-semibold text-ink bg-white hover:bg-surface-2 border border-line-strong rounded-[10px]"
                  >
                    <Eye className="w-4 h-4 text-brand" />
                    <span>Open</span>
                  </button>
                  <div className="shrink-0">
                    <QuotationPdfActions quotation={quotation} variant="card" />
                  </div>
                </div>
              </div>
            ))}

            <p className="text-[12.5px] text-muted text-center pt-1">
              Showing {filteredQuotations.length} of {quotations.length}
            </p>
          </div>

          {/* Tablet and desktop: table */}
          <div className="hidden md:block card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13.5px]">
                <thead>
                  <tr className="border-b border-line bg-surface-2/70">
                    <th className="py-3 pl-5 pr-3 font-medium">Quotation</th>
                    <th className="py-3 px-3 font-medium">Customer</th>
                    <th className="py-3 px-3 font-medium">Status</th>
                    <th className="py-3 px-3 font-medium hidden xl:table-cell">Items</th>
                    <th className="py-3 px-3 font-medium text-right">Amount</th>
                    <th className="py-3 pl-3 pr-5 font-medium text-right"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredQuotations.map((quotation, i) => (
                    <tr
                      key={quotation.id}
                      onClick={() => setPreviewQuotation(quotation)}
                      className="group cursor-pointer hover:bg-brand-tint anim-row"
                      style={{ animationDelay: `${Math.min(i, 10) * 20}ms` }}
                    >
                      <td className="py-3.5 pl-5 pr-3 align-middle">
                        <div className="font-semibold text-ink tabular-nums whitespace-nowrap">
                          {quotation.quotationNumber}
                          {(quotation.revision || 1) > 1 && (
                            <span className="ml-1.5 text-[11.5px] font-medium text-muted bg-slate-100 rounded px-1.5 py-0.5">
                              Rev {quotation.revision}
                            </span>
                          )}
                        </div>
                        <div className="text-[12.5px] text-muted mt-0.5 whitespace-nowrap">
                          {formatQuoteDate(quotation.quotationDate)} · by {quotation.createdByName}
                        </div>
                      </td>

                      <td className="py-3.5 px-3 align-middle min-w-[160px]">
                        <div className="font-medium text-ink truncate max-w-[260px]">{quotation.customer.name}</div>
                        <div className="text-[12.5px] text-muted mt-0.5 tabular-nums">
                          {quotation.customer.gstin || 'Unregistered'}
                        </div>
                      </td>

                      <td className="py-3.5 px-3 align-middle">
                        <StatusPill status={quotation.status} />
                      </td>

                      <td className="py-3.5 px-3 align-middle hidden xl:table-cell text-muted whitespace-nowrap">
                        {quotation.lines.length} {quotation.lines.length === 1 ? 'item' : 'items'}
                        {Number(quotation.totalKgs) > 0 && (
                          <div className="text-[12.5px] text-faint tabular-nums">
                            {Number(quotation.totalKgs).toLocaleString('en-IN', { maximumFractionDigits: 2 })} kg
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-3 align-middle text-right whitespace-nowrap">
                        <div className="font-semibold text-ink tabular-nums">
                          ₹{Number(quotation.payableAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-[12px] text-faint mt-0.5">{taxLabel(quotation)}</div>
                      </td>

                      <td className="py-3.5 pl-3 pr-5 align-middle text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <QuotationPdfActions quotation={quotation} variant="table" />
                          <button
                            onClick={() => setPreviewQuotation(quotation)}
                            className="inline-flex items-center gap-1.5 h-8 px-3 text-muted hover:text-ink bg-white hover:bg-surface-2 rounded-[8px] text-[13px] font-medium border border-line-strong"
                            title="Open quotation"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Open</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-5 py-3 border-t border-line text-[12.5px] text-muted">
              Showing {filteredQuotations.length} of {quotations.length}
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewQuotation && (
        <QuotationPreviewModal
          key={previewQuotation.id}
          quotation={previewQuotation}
          onClose={() => setPreviewQuotation(null)}
          onRevise={canRevise(previewQuotation) ? () => openBuilder({ quotation: previewQuotation, mode: 'revise' }) : undefined}
          onDuplicate={() => openBuilder({ quotation: previewQuotation, mode: 'duplicate' })}
          onStatusChange={(st) => handleStatusChange(previewQuotation, st)}
        />
      )}
    </div>
  );
};
