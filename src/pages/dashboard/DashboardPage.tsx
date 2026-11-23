import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getQuotations, getQuotationsFromDevice } from '../../services/quotationService';
import { getCustomersCached, getProductsCached } from '../../services/masterDataCache';
import type { Quotation } from '../../types/quotation';
import { QuotationPreviewModal, StatusPill } from '../quotations/QuotationPreviewModal';
import { useAuth } from '../../hooks/useAuth';
import { Plus, ArrowRight, TrendingUp, Clock3, Trophy, Users, Package, FileText } from 'lucide-react';

const inr = (n: number) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const TONES = {
  brand: 'bg-blue-50 text-blue-600',
  ok: 'bg-emerald-50 text-emerald-600',
  warn: 'bg-amber-50 text-amber-600',
  ink: 'bg-slate-100 text-slate-600',
} as const;

const Metric: React.FC<{
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon: React.ReactNode;
  tone?: keyof typeof TONES;
  loading?: boolean;
}> = ({ label, value, sub, icon, tone = 'ink', loading }) => (
  <div className="card p-5 min-w-0">
    <div className="flex items-center gap-3">
      <span className={`icon-chip ${TONES[tone]}`}>{icon}</span>
      <span className="text-[13px] font-medium text-muted truncate">{label}</span>
    </div>
    {loading ? (
      <div className="h-8 w-28 mt-4 bg-surface-2 rounded-md animate-pulse" />
    ) : (
      <div className="font-display tabular-nums text-[26px] leading-none font-bold mt-4 truncate text-ink">{value}</div>
    )}
    {sub && <div className="text-[12.5px] text-muted mt-2 truncate">{sub}</div>}
  </div>
);

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

  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  })();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-[13px] text-muted">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1 className="text-[26px] sm:text-[30px] leading-tight text-ink mt-1">
            {firstName ? `${greeting}, ${firstName}` : 'Dashboard'}
          </h1>
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

      {/* Lead with the number the owner opens the app for: this month's quoted value */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="hero-card rounded-card p-6 text-white relative overflow-hidden min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-white/80">Quoted this month</span>
            <TrendingUp className="w-5 h-5 text-white/70" />
          </div>
          {loading ? (
            <div className="h-10 w-40 mt-5 bg-white/15 rounded-md animate-pulse" />
          ) : (
            <div className="font-display tabular-nums text-[34px] sm:text-[38px] leading-none font-extrabold mt-5 truncate">
              {inr(stats.monthValue)}
            </div>
          )}
          <div className="mt-3 text-[13px] text-white/80">
            {stats.monthCount} quotation{stats.monthCount === 1 ? '' : 's'} in{' '}
            {new Date().toLocaleDateString('en-IN', { month: 'long' })}
          </div>
          <div className="mt-6 pt-4 border-t border-white/15 grid grid-cols-2 gap-3 text-[12.5px]">
            <Link to="/app/customers" className="flex items-center gap-2 text-white/85 hover:text-white">
              <Users className="w-4 h-4" />
              <span className="tabular-nums font-semibold text-white">{customerCount ?? '—'}</span> customers
            </Link>
            <Link to="/app/products" className="flex items-center gap-2 text-white/85 hover:text-white">
              <Package className="w-4 h-4" />
              <span className="tabular-nums font-semibold text-white">{activeProductCount ?? '—'}</span> products
            </Link>
          </div>
        </div>

        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Metric
            label="Open quotations"
            icon={<Clock3 className="w-[18px] h-[18px]" />}
            tone="warn"
            loading={loading}
            value={inr(stats.openValue)}
            sub={`${stats.openCount} waiting on the customer (draft or sent)`}
          />
          <Metric
            label="Won this month"
            icon={<Trophy className="w-[18px] h-[18px]" />}
            tone="ok"
            loading={loading}
            value={inr(stats.wonMonthValue)}
            sub={stats.winRate === null ? 'Mark quotes Won or Lost to see your win rate' : `Win rate ${stats.winRate}% of ${stats.decided} decided`}
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between">
          <h2 className="text-[16px] font-bold text-ink">Recent quotations</h2>
          <Link to="/app/quotations" className="text-[13px] font-semibold text-brand hover:text-brand-dark flex items-center gap-1">
            View all <ArrowRight className="w-4 h-4" />
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
            <span className="icon-chip bg-blue-50 text-blue-600 mx-auto"><FileText className="w-[18px] h-[18px]" /></span>
            <p className="text-sm font-semibold text-ink mt-3">No quotations yet</p>
            <p className="text-[13px] text-muted mt-1 mb-4">Your first quotation will show up here.</p>
            <Link to="/app/quotations" state={{ newQuote: true }} className="btn-primary inline-flex items-center gap-1.5 px-4 min-h-[44px] text-white rounded-[10px] text-sm font-semibold">
              <Plus className="w-4 h-4" /> Create quotation
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {recent.map((q, i) => (
              <li key={q.id} className="anim-row" style={{ animationDelay: `${i * 30}ms` }}>
                <button
                  type="button"
                  onClick={() => setPreviewQuotation(q)}
                  className="w-full text-left px-5 py-3.5 hover:bg-surface-2 active:bg-surface-2 flex items-center gap-4"
                >
                  <span className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 font-display font-bold text-[13px] flex items-center justify-center shrink-0">
                    {q.customer.name.trim().charAt(0).toUpperCase() || '?'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-ink text-[14px] truncate">{q.customer.name}</span>
                      <StatusPill status={q.status} />
                    </div>
                    <div className="text-[12.5px] text-muted tabular-nums mt-0.5 truncate">
                      {q.quotationNumber}
                      {(q.revision || 1) > 1 ? ` · Rev ${q.revision}` : ''} · {q.quotationDate || '—'} · {q.lines.length} item
                      {q.lines.length === 1 ? '' : 's'}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="tabular-nums font-semibold text-ink text-[14px]">
                      ₹{Number(q.payableAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    {Number(q.totalKgs) > 0 && (
                      <div className="text-[12px] text-faint tabular-nums">
                        {Number(q.totalKgs).toLocaleString('en-IN', { maximumFractionDigits: 2 })} kg
                      </div>
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
