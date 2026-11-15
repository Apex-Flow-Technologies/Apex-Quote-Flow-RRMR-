import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getQuotations, getQuotationsFromDevice } from '../../services/quotationService';
import { getCustomersCached, getProductsCached } from '../../services/masterDataCache';
import type { Quotation } from '../../types/quotation';
import { QuotationPreviewModal, StatusPill } from '../quotations/QuotationPreviewModal';
import { useAuth } from '../../hooks/useAuth';
import { Plus, ArrowRight, TrendingUp, Clock3, Trophy, Users, Package } from 'lucide-react';

const inr = (n: number) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const Metric: React.FC<{
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon: React.ReactNode;
  tone?: 'brand' | 'ok' | 'warn' | 'ink';
  loading?: boolean;
}> = ({ label, value, sub, icon, tone = 'ink', loading }) => {
  const toneCls = { brand: 'text-brand', ok: 'text-emerald-700', warn: 'text-amber-700', ink: 'text-ink' }[tone];
  return (
    <div className="bg-white border border-line-strong rounded-card p-4 shadow-xs min-w-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10.5px] font-semibold text-faint uppercase tracking-wider truncate">{label}</span>
        <span className="text-faint shrink-0">{icon}</span>
      </div>
      {loading ? (
        <div className="h-7 w-20 mt-1.5 bg-surface-2 rounded animate-pulse" />
      ) : (
        <div className={`font-mono tabular-nums text-xl sm:text-2xl font-bold mt-1 truncate ${toneCls}`}>{value}</div>
      )}
      {sub && <div className="text-[11px] text-muted mt-0.5 truncate">{sub}</div>}
    </div>
  );
};

export const DashboardPage: React.FC = () => {
  const { profile } = useAuth();
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

  const recent = quotations.slice(0, 6);
  const firstName = (profile?.name || '').split(' ')[0];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
            {firstName ? `Hello, ${firstName}` : 'Dashboard'}
          </h1>
          <p className="text-xs text-muted mt-0.5">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <Link
          to="/app/quotations"
          state={{ newQuote: true }}
          className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-4 bg-brand hover:bg-brand-dark text-white text-sm font-semibold rounded-control shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Quotation
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric
          label="This month"
          icon={<TrendingUp className="w-4 h-4" />}
          tone="brand"
          loading={loading}
          value={inr(stats.monthValue)}
          sub={`${stats.monthCount} quotation${stats.monthCount === 1 ? '' : 's'}`}
        />
        <Metric
          label="Open (draft + sent)"
          icon={<Clock3 className="w-4 h-4" />}
          tone="warn"
          loading={loading}
          value={inr(stats.openValue)}
          sub={`${stats.openCount} awaiting a decision`}
        />
        <Metric
          label="Won this month"
          icon={<Trophy className="w-4 h-4" />}
          tone="ok"
          loading={loading}
          value={inr(stats.wonMonthValue)}
          sub={stats.winRate === null ? 'Mark quotes Won / Lost to see win rate' : `Win rate ${stats.winRate}% (${stats.decided} decided)`}
        />
        <div className="grid grid-rows-2 gap-3">
          <Link to="/app/customers" className="bg-white border border-line-strong rounded-card px-4 py-2.5 shadow-xs flex items-center justify-between hover:border-brand/40">
            <span className="text-xs text-muted flex items-center gap-1.5"><Users className="w-4 h-4 text-faint" /> Customers</span>
            <span className="font-mono font-bold text-ink">{customerCount ?? '—'}</span>
          </Link>
          <Link to="/app/products" className="bg-white border border-line-strong rounded-card px-4 py-2.5 shadow-xs flex items-center justify-between hover:border-brand/40">
            <span className="text-xs text-muted flex items-center gap-1.5"><Package className="w-4 h-4 text-faint" /> Products</span>
            <span className="font-mono font-bold text-ink">{activeProductCount ?? '—'}</span>
          </Link>
        </div>
      </div>

      <div className="bg-white border border-line-strong rounded-card shadow-xs overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 border-b border-line flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink">Recent quotations</h2>
          <Link to="/app/quotations" className="text-xs font-semibold text-brand hover:text-brand-dark flex items-center gap-1">
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="divide-y divide-line">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-4 flex justify-between animate-pulse">
                <div className="space-y-2">
                  <div className="h-4 w-40 bg-surface-2 rounded" />
                  <div className="h-3 w-28 bg-surface-2 rounded" />
                </div>
                <div className="h-5 w-24 bg-surface-2 rounded" />
              </div>
            ))}
          </div>
        ) : recent.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm font-semibold text-ink">No quotations yet</p>
            <p className="text-xs text-muted mt-0.5 mb-3">Create your first quotation to start the register.</p>
            <Link to="/app/quotations" className="inline-flex items-center gap-1 px-4 min-h-[44px] bg-brand text-white rounded-control text-sm font-semibold">
              <Plus className="w-4 h-4" /> Create quotation
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {recent.map((q) => (
              <li key={q.id}>
                <button
                  type="button"
                  onClick={() => setPreviewQuotation(q)}
                  className="w-full text-left px-4 sm:px-5 py-3.5 hover:bg-surface-2/60 active:bg-surface-2 transition flex items-center gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-ink text-sm truncate">{q.customer.name}</span>
                      <StatusPill status={q.status} />
                    </div>
                    <div className="text-[11px] text-muted font-mono mt-0.5 truncate">
                      {q.quotationNumber}
                      {(q.revision || 1) > 1 ? ` · R${q.revision}` : ''} · {q.quotationDate || '—'} · {q.lines.length} item
                      {q.lines.length === 1 ? '' : 's'}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono tabular-nums font-bold text-ink text-sm">
                      ₹{Number(q.payableAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    {Number(q.totalKgs) > 0 && (
                      <div className="text-[11px] text-faint font-mono">{Number(q.totalKgs).toFixed(2)} kg</div>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {previewQuotation && (
        <QuotationPreviewModal quotation={previewQuotation} onClose={() => setPreviewQuotation(null)} />
      )}
    </div>
  );
};
