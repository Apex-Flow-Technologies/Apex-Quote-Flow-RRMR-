import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getQuotations, getQuotationsFromDevice } from '../../services/quotationService';
import { getCustomersCached, getProductsCached } from '../../services/masterDataCache';
import type { Quotation } from '../../types/quotation';
import { QuotationPreviewModal, StatusPill } from '../quotations/QuotationPreviewModal';
import { Plus, ArrowRight } from 'lucide-react';

const inr = (n: number) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

/** "+12%" / "-8%" compared with last month */
function trendText(current: number, previous: number): string {
  if (!previous) return '';
  const pct = Math.round(((current - previous) / previous) * 100);
  return pct === 0 ? 'level' : `${pct > 0 ? 'up' : 'down'} ${Math.abs(pct)}%`;
}

export const DashboardPage: React.FC = () => {

  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [customerCount, setCustomerCount] = useState<number | null>(null);
  const [activeProductCount, setActiveProductCount] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [previewQuotation, setPreviewQuotation] = useState<Quotation | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      // Instant: last-known copy on this device
      const local = await getQuotationsFromDevice();
      if (alive && local.length) {
        setQuotations(local);
        setLoading(false);
      }
      try {
        const fresh = await getQuotations();
        if (alive) setQuotations(fresh);
      } catch (err) {
        console.error('Error loading dashboard quotations:', err);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    getCustomersCached((c) => alive && setCustomerCount(c.length)).then((c) => alive && setCustomerCount(c.length)).catch(() => {});
    const countActive = (p: { active?: boolean }[]) => p.filter((x) => x.active !== false).length;
    getProductsCached((p) => alive && setActiveProductCount(countActive(p))).then((p) => alive && setActiveProductCount(countActive(p))).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const stats = useMemo(() => {
    const ym = new Date().toISOString().slice(0, 7);
    const live = quotations.filter((q) => q.status !== 'cancelled');
    const month = live.filter((q) => q.quotationDate?.startsWith(ym));
    const open = live.filter((q) => (q.status || 'draft') === 'draft' || q.status === 'sent');
    const won = live.filter((q) => q.status === 'won');
    const lost = live.filter((q) => q.status === 'lost');
    const wonMonth = won.filter((q) => q.quotationDate?.startsWith(ym));
    const sum = (list: Quotation[]) => list.reduce((t, q) => t + Number(q.payableAmount || 0), 0);
    const decided = won.length + lost.length;
    return {
      monthCount: month.length,
      monthValue: sum(month),
      openCount: open.length,
      openValue: sum(open),
      wonMonthValue: sum(wonMonth),
      wonMonthCount: wonMonth.length,
      winRate: decided ? Math.round((won.length / decided) * 100) : null,
      decided,
    };
  }, [quotations]);

  // Quoted value for each of the last six months (cancelled quotes left out)
  const monthly = useMemo(() => {
    const live = quotations.filter((q) => q.status !== 'cancelled');
    const now = new Date();
    return Array.from({ length: 6 }, (_, k) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - k), 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const value = live
        .filter((q) => q.quotationDate?.startsWith(key))
        .reduce((t, q) => t + Number(q.payableAmount || 0), 0);
      return { key, label: d.toLocaleDateString('en-IN', { month: 'short' }), value };
    });
  }, [quotations]);

  const recent = quotations.slice(0, 6);

  const monthName = new Date().toLocaleDateString('en-IN', { month: 'long' });
  const peak = Math.max(1, ...monthly.map((m) => m.value));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-[13px] text-muted">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <h1 className="text-[28px] sm:text-[32px] leading-tight text-ink mt-1">{monthName} so far</h1>
        </div>
        <Link
          to="/app/quotations"
          state={{ newQuote: true }}
          className="btn-primary min-h-[44px] inline-flex items-center justify-center gap-2 px-5 text-white text-sm font-semibold rounded-[10px]"
        >
          <Plus className="w-4 h-4" />
          New quotation
        </Link>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Quoted value: the figure, and the last six months as a chart */}
        <section className="card xl:col-span-2 p-6 min-w-0" aria-label="Quoted value by month">
          <div className="flex flex-col md:flex-row md:items-end gap-6">
            <div className="shrink-0">
              <div className="text-[13px] font-medium text-muted">Quoted in {monthName}</div>
              {loading ? (
                <div className="h-14 w-56 mt-3 bg-surface-2 rounded-md animate-pulse" />
              ) : (
                <div className="font-display tabular-nums text-[44px] sm:text-[56px] leading-[1] font-extrabold text-ink mt-2 tracking-tight">
                  {inr(stats.monthValue)}
                </div>
              )}
              <div className="text-[13px] text-muted mt-3">
                {stats.monthCount} quotation{stats.monthCount === 1 ? '' : 's'}
                {monthly.length > 1 && monthly[monthly.length - 2].value > 0 && !loading && (
                  <> · {trendText(stats.monthValue, monthly[monthly.length - 2].value)} on last month</>
                )}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-end gap-2 sm:gap-3 h-36" role="img" aria-label="Quoted value for the last six months">
                {monthly.map((m, i) => {
                  const current = i === monthly.length - 1;
                  const h = loading ? 8 : Math.max(4, Math.round((m.value / peak) * 100));
                  return (
                    <div key={m.key} className="flex-1 min-w-0 h-full flex flex-col justify-end items-center gap-2">
                      <div
                        className={`bar w-full max-w-[44px] rounded-t-[6px] ${current ? 'bg-brand' : 'bg-slate-200 hover:bg-slate-300'}`}
                        style={{ height: `${h}%`, animationDelay: `${i * 50}ms` }}
                        title={`${m.label}: ${inr(m.value)}`}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2 sm:gap-3 mt-2">
                {monthly.map((m, i) => (
                  <div
                    key={m.key}
                    className={`flex-1 text-center text-[12px] ${i === monthly.length - 1 ? 'text-ink font-semibold' : 'text-faint'}`}
                  >
                    {m.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Pipeline: what is still open, what was won */}
        <section className="card p-0 min-w-0 divide-y divide-line" aria-label="Pipeline">
          <div className="p-5">
            <div className="text-[13px] font-medium text-muted">Waiting on customers</div>
            <div className="font-display tabular-nums text-[26px] font-bold text-ink mt-1.5 leading-none">
              {loading ? '…' : inr(stats.openValue)}
            </div>
            <div className="text-[12.5px] text-muted mt-2">{stats.openCount} draft or sent</div>
          </div>
          <div className="p-5">
            <div className="text-[13px] font-medium text-muted">Won in {monthName}</div>
            <div className="font-display tabular-nums text-[26px] font-bold text-ink mt-1.5 leading-none">
              {loading ? '…' : inr(stats.wonMonthValue)}
            </div>
            <div className="text-[12.5px] text-muted mt-2">
              {stats.winRate === null ? 'Mark quotes Won or Lost to track this' : `${stats.winRate}% win rate, ${stats.decided} decided`}
            </div>
          </div>
          <div className="px-5 py-3.5 flex items-center justify-between text-[13px]">
            <Link to="/app/customers" className="text-muted hover:text-ink">
              <span className="tabular-nums font-semibold text-ink">{customerCount ?? '…'}</span> customers
            </Link>
            <Link to="/app/products" className="text-muted hover:text-ink">
              <span className="tabular-nums font-semibold text-ink">{activeProductCount ?? '…'}</span> products
            </Link>
          </div>
        </section>
      </div>

      <section className="card overflow-hidden" aria-label="Recent quotations">
        <div className="px-5 py-4 flex items-center justify-between">
          <h2 className="text-[16px] font-bold text-ink">Recent quotations</h2>
          <Link to="/app/quotations" className="text-[13px] font-semibold text-brand hover:text-brand-dark flex items-center gap-1">
            All quotations <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="divide-y divide-line border-t border-line">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-5 py-4 flex justify-between animate-pulse">
                <div className="space-y-2">
                  <div className="h-4 w-40 bg-surface-2 rounded" />
                  <div className="h-3 w-28 bg-surface-2 rounded" />
                </div>
                <div className="h-5 w-24 bg-surface-2 rounded" />
              </div>
            ))}
          </div>
        ) : recent.length === 0 ? (
          <div className="px-5 py-12 text-center border-t border-line">
            <p className="text-sm font-semibold text-ink">No quotations yet</p>
            <p className="text-[13px] text-muted mt-1 mb-4">Your first quotation will show up here.</p>
            <Link to="/app/quotations" state={{ newQuote: true }} className="btn-primary inline-flex items-center gap-1.5 px-4 min-h-[44px] text-white rounded-[10px] text-sm font-semibold">
              <Plus className="w-4 h-4" /> Create quotation
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {recent.map((q) => (
              <li key={q.id}>
                <button
                  type="button"
                  onClick={() => setPreviewQuotation(q)}
                  className="w-full text-left px-5 py-3.5 hover:bg-surface-2 active:bg-surface-2 flex items-center gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-ink text-[14px] truncate">{q.customer.name}</span>
                      <StatusPill status={q.status} />
                    </div>
                    <div className="text-[12.5px] text-muted tabular-nums mt-0.5 truncate">
                      {q.quotationNumber}
                      {(q.revision || 1) > 1 ? ` · Rev ${q.revision}` : ''} · {q.lines.length} item{q.lines.length === 1 ? '' : 's'}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="tabular-nums font-semibold text-ink text-[14px]">
                      ₹{Number(q.payableAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-[12px] text-faint tabular-nums">{q.quotationDate || ''}</div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {previewQuotation && (
        <QuotationPreviewModal quotation={previewQuotation} onClose={() => setPreviewQuotation(null)} />
      )}
    </div>
  );
};
