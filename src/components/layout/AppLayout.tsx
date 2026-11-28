import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  LogOut,
  Menu,
  X,
  LayoutDashboard,
  FileText,
  Package,
  Users,
  Building2,
  UserCog,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { prefetchMasterData, getCompanySettingsCached } from '../../services/masterDataCache';
import { validateGstin } from '../../engine/gstin';
import { FrameBackdrop } from './FrameBackdrop';

/** Admin-only reminder while Company Settings still hold placeholder details (they print on every PDF). */
const CompanySetupWarning: React.FC = () => {
  const [issues, setIssues] = useState<string[]>([]);
  const navigate = useNavigate();
  useEffect(() => {
    const check = (c: Awaited<ReturnType<typeof getCompanySettingsCached>>) => {
      const found: string[] = [];
      if (!c?.gstin || /X{3,}/i.test(c.gstin) || !validateGstin(c.gstin).valid) found.push('GSTIN');
      if (!c?.phones?.length || c.phones.some((p) => /0{5}/.test(p))) found.push('phone numbers');
      const bank = c?.bankDetails;
      if (!bank?.accountNumber || /^0+$|X{3,}/i.test(bank.accountNumber)) found.push('bank details');
      setIssues(found);
    };
    getCompanySettingsCached(check).then(check).catch(() => {});
  }, []);
  if (issues.length === 0) return null;
  return (
    <div className="mb-5 p-3.5 rounded-card border border-amber-200 bg-amber-50 text-amber-900 text-sm flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
      <span className="flex-1">
        <strong className="font-semibold">Company details incomplete:</strong> the {issues.join(', ')} printed on quotation PDFs{' '}
        {issues.length > 1 ? 'are' : 'is'} still a placeholder.
      </span>
      <button
        type="button"
        onClick={() => navigate('/app/settings')}
        className="min-h-[40px] px-3.5 rounded-control bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm shrink-0"
      >
        Fix in Settings
      </button>
    </div>
  );
};

/** RR's existing mark (the "RR" tile), kept and given depth rather than replaced. */
const BrandMark: React.FC<{ size?: 'sm' | 'md' }> = ({ size = 'md' }) => (
  <span
    className={`brand-mark ${size === 'sm' ? 'w-8 h-8 text-[12px]' : 'w-9 h-9 text-[13px]'} shrink-0 rounded-[10px] flex items-center justify-center text-white font-display font-extrabold select-none`}
    aria-hidden="true"
  >
    RR
  </span>
);

export const AppLayout: React.FC = () => {
  const { profile, user, isAdmin, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Desktop sidebar can fold down to an icon strip; remembered on this device
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('rrmr.sidebarCollapsed') === '1';
    } catch {
      return false;
    }
  });
  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem('rrmr.sidebarCollapsed', c ? '0' : '1');
      } catch {
        /* ignore */
      }
      return !c;
    });
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Warm product / customer / company caches once signed in, so New Quotation opens instantly
  useEffect(() => {
    if (profile?.active) prefetchMasterData();
  }, [profile?.active]);

  // Close the phone menu whenever the page changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const navItems = [
    { to: '/app', label: 'Dashboard', end: true, icon: LayoutDashboard },
    { to: '/app/quotations', label: 'Quotations', icon: FileText },
    { to: '/app/customers', label: 'Customers', icon: Users },
    { to: '/app/products', label: 'Products', adminOnly: true, icon: Package },
    { to: '/app/settings', label: 'Company settings', adminOnly: true, icon: Building2 },
    { to: '/app/users', label: 'Users', adminOnly: true, icon: UserCog },
  ].filter((item) => !item.adminOnly || isAdmin);

  const userName = profile?.name || user?.email?.split('@')[0] || 'User';
  const roleLabel = isAdmin ? 'Administrator' : 'Sales staff';
  const initial = userName.charAt(0).toUpperCase();

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `nav-item group flex items-center gap-3 h-10 px-3 rounded-[10px] text-[13.5px] font-medium ${
      isActive ? 'nav-item-active' : 'text-muted hover:text-ink hover:bg-ink/[0.04]'
    }`;

  const newQuote = (
    <Link
      to="/app/quotations"
      state={{ newQuote: true }}
      className="btn-primary w-full h-10 inline-flex items-center justify-center gap-2 rounded-[10px] text-[13.5px] font-semibold text-white"
    >
      <Plus className="w-4 h-4" />
      New quotation
    </Link>
  );

  const userCard = (
    <div className="flex items-center gap-3 p-2 rounded-[12px]">
      <span className="w-9 h-9 rounded-full bg-brand-soft text-brand font-display font-bold text-sm flex items-center justify-center shrink-0">
        {initial}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-ink truncate">{userName}</div>
        <div className="text-[11.5px] text-muted truncate" title={user?.email || ''}>
          {roleLabel}
        </div>
      </div>
      <button
        type="button"
        onClick={handleLogout}
        className="w-9 h-9 rounded-[10px] flex items-center justify-center text-faint hover:text-danger hover:bg-rose-50 shrink-0"
        title="Sign out"
        aria-label="Sign out"
      >
        <LogOut className="w-4 h-4" />
      </button>
    </div>
  );

  return (
    <div
      className="app-canvas min-h-dvh text-ink font-sans lg:flex"
      style={{ '--sidebar-w': collapsed ? '72px' : '248px' } as React.CSSProperties}
    >
      <FrameBackdrop />
      {/* ── Desktop sidebar (collapsible) ───────────────────────────── */}
      <aside
        className={`sidebar hidden lg:flex no-print shrink-0 h-dvh sticky top-0 flex-col bg-white border-r border-line ${
          collapsed ? 'w-[72px]' : 'w-[248px]'
        }`}
        aria-label="Sidebar"
      >
        <div className={`h-16 flex items-center ${collapsed ? 'justify-center px-0' : 'px-4 gap-3'}`}>
          <Link to="/app" className="flex items-center gap-3 min-w-0" title="RR Metal Roofing">
            <BrandMark />
            {!collapsed && (
              <div className="min-w-0">
                <div className="font-display font-bold text-[15px] text-ink leading-tight truncate">RR Metal Roofing</div>
                <div className="text-[11.5px] text-muted leading-tight">Quotations &amp; billing</div>
              </div>
            )}
          </Link>
          {!collapsed && (
            <button
              type="button"
              onClick={toggleCollapsed}
              className="ml-auto w-8 h-8 rounded-[8px] flex items-center justify-center text-faint hover:text-ink hover:bg-ink/[0.05]"
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="w-[18px] h-[18px]" />
            </button>
          )}
        </div>

        <div className={collapsed ? 'px-3 pt-1 pb-3' : 'px-4 pt-1 pb-4'}>
          {collapsed ? (
            <Link
              to="/app/quotations"
              state={{ newQuote: true }}
              className="btn-primary w-12 h-10 mx-auto flex items-center justify-center rounded-[10px] text-white"
              title="New quotation"
              aria-label="New quotation"
            >
              <Plus className="w-[18px] h-[18px]" />
            </Link>
          ) : (
            newQuote
          )}
        </div>

        <nav className="px-3 flex-1 space-y-0.5 overflow-y-auto" aria-label="Main">
          {navItems.map(({ to, label, end, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={collapsed ? label : undefined}
              aria-label={collapsed ? label : undefined}
              className={(st) => `${navLinkClass(st)} ${collapsed ? 'justify-center px-0' : ''}`}
            >
              <Icon className="nav-icon w-[18px] h-[18px] shrink-0" strokeWidth={1.9} />
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-line">
          {collapsed ? (
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={toggleCollapsed}
                className="w-10 h-10 rounded-[10px] flex items-center justify-center text-faint hover:text-ink hover:bg-ink/[0.05]"
                title="Expand sidebar"
                aria-label="Expand sidebar"
              >
                <PanelLeftOpen className="w-[18px] h-[18px]" />
              </button>
              <span
                className="w-9 h-9 rounded-full bg-brand-soft text-brand font-display font-bold text-sm flex items-center justify-center"
                title={`${userName} · ${roleLabel}`}
              >
                {initial}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="w-10 h-10 rounded-[10px] flex items-center justify-center text-faint hover:text-danger hover:bg-rose-50"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            userCard
          )}
        </div>
      </aside>

      {/* ── Phone / tablet top bar ──────────────────────────────────── */}
      <header className="lg:hidden no-print sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-line">
        <div className="h-14 px-4 sm:px-6 flex items-center justify-between gap-3">
          <Link to="/app" className="flex items-center gap-2.5 min-w-0">
            <BrandMark size="sm" />
            <span className="font-display font-bold text-[15px] text-ink truncate">RR Metal Roofing</span>
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="w-11 h-11 -mr-1.5 flex items-center justify-center rounded-[10px] text-ink hover:bg-ink/[0.05]"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="anim-pop border-t border-line bg-white shadow-lg">
            <nav className="p-3 space-y-0.5" aria-label="Main">
              <div className="pb-2">{newQuote}</div>
              {navItems.map(({ to, label, end, icon: Icon }) => (
                <NavLink key={to} to={to} end={end} className={(s) => `${navLinkClass(s)} h-11`}>
                  <Icon className="nav-icon w-[18px] h-[18px] shrink-0" strokeWidth={1.9} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </nav>
            <div className="px-3 pb-3 pt-1 border-t border-line">{userCard}</div>
          </div>
        )}
      </header>

      {/* ── Content ─────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col">
        <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-5 sm:py-7 lg:py-9">
          {isAdmin && <CompanySetupWarning />}
          <div key={location.pathname} className="anim-page">
            <Outlet />
          </div>
        </main>
        <footer className="no-print w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-5 text-[12px] text-faint">
          RR Metal Roofing · Built by ApexFlow Technologies
        </footer>
      </div>
    </div>
  );
};
