import React, { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { LogOut, Menu, X, ChevronDown } from 'lucide-react';
import { prefetchMasterData, getCompanySettingsCached } from '../../services/masterDataCache';
import { validateGstin } from '../../engine/gstin';

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
    <div className="mb-4 p-3 rounded-card border border-amber-200 bg-amber-50 text-amber-900 text-sm flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
      <span className="flex-1">
        <strong>Company details incomplete:</strong> the {issues.join(', ')} printed on quotation PDFs {issues.length > 1 ? 'are' : 'is'} still a placeholder.
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

export const AppLayout: React.FC = () => {
  const { profile, user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Warm product / customer / company caches once signed in, so New Quotation opens instantly
  useEffect(() => {
    if (profile?.active) prefetchMasterData();
  }, [profile?.active]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navItems = [
    { to: '/app', label: 'Dashboard', end: true },
    { to: '/app/quotations', label: 'Quotations' },
    { to: '/app/products', label: 'Products', adminOnly: true },
    { to: '/app/customers', label: 'Customers' },
    { to: '/app/settings', label: 'Company Settings', adminOnly: true },
    { to: '/app/users', label: 'Users', adminOnly: true },
  ];

  const userName = profile?.name || user?.email?.split('@')[0] || 'User';
  const roleLabel = isAdmin ? 'Administrator' : 'Sales Staff';

  return (
    <div className="min-h-screen flex flex-col bg-white text-ink font-sans">
      {/* Application Header (White, sticky, thin bottom border, subtle blur) */}
      <header className="w-full sticky top-0 z-30 no-print bg-white/95 backdrop-blur-xs border-b border-line">
        <div className="w-full max-w-[1680px] mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-13">
            {/* Left: Blue square logo & brand text */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
              <div className="w-7 h-7 sm:w-6 sm:h-6 bg-brand rounded-control flex items-center justify-center text-white font-bold text-xs select-none shadow-xs shrink-0">
                RR
              </div>
              <div className="flex items-center gap-2 truncate">
                <span className="font-bold text-xs sm:text-sm tracking-tight text-ink truncate">
                  RR Metal Roofing
                </span>
                <span className="hidden sm:inline-block text-faint text-xs font-normal border-l border-line-strong pl-2.5 shrink-0">
                  Quotations
                </span>
              </div>
            </div>

            {/* Right: Outlined user profile button & quiet logout */}
            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center gap-1.5 text-xs text-muted hover:text-ink h-10 sm:h-auto py-1 px-2 sm:px-2.5 rounded-control border border-line-strong bg-white hover:bg-surface-2 transition-colors focus:outline-none"
                  title="Account details"
                  aria-expanded={userDropdownOpen}
                >
                  {/* Desktop Full Label */}
                  <span className="hidden sm:inline font-medium max-w-[120px] truncate">{userName}</span>
                  <span className="hidden sm:inline text-line-strong">·</span>
                  <span className="hidden sm:inline text-muted text-[11px]">{roleLabel}</span>

                  {/* Mobile Compact Pill */}
                  <span className="sm:hidden flex items-center gap-1">
                    <span className="w-5 h-5 rounded-full bg-brand-soft text-brand font-bold text-[10px] flex items-center justify-center">
                      {userName.charAt(0).toUpperCase()}
                    </span>
                    <span className="text-[11px] font-semibold text-ink">
                      {isAdmin ? 'Admin' : 'Sales'}
                    </span>
                  </span>

                  <ChevronDown className="w-3.5 h-3.5 text-faint ml-0.5 shrink-0" />
                </button>

                {/* Dropdown Menu for Email & Account Details */}
                {userDropdownOpen && (
                  <div
                    onMouseLeave={() => setUserDropdownOpen(false)}
                    className="absolute right-0 top-full mt-1.5 w-60 bg-white text-ink border border-line-strong rounded-control shadow-lg p-3.5 z-50 text-xs animate-in fade-in duration-100"
                  >
                    <div className="text-[10px] font-bold text-faint uppercase tracking-wider mb-1">
                      Signed In User
                    </div>
                    <div className="font-semibold text-ink text-xs mb-0.5">{userName}</div>
                    <div className="font-mono text-[11px] text-muted break-all mb-2.5">
                      {user?.email}
                    </div>
                    <div className="pt-2 border-t border-line flex items-center justify-between text-[11px] text-muted">
                      <span>System Role:</span>
                      <span className="font-semibold text-brand">{roleLabel}</span>
                    </div>
                    <div className="pt-3 mt-3 border-t border-line sm:hidden">
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold text-danger hover:bg-rose-50 rounded-control border border-rose-200 transition"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Quiet Outlined Logout Button (Desktop only, mobile has it in drawer & user dropdown) */}
              <button
                type="button"
                onClick={handleLogout}
                className="hidden sm:flex px-2.5 py-1 text-xs text-muted hover:text-ink border border-line-strong rounded-control bg-white hover:bg-surface-2 transition-colors items-center gap-1"
                title="Sign out of the system"
              >
                <LogOut className="w-3.5 h-3.5 text-faint" />
                <span>Logout</span>
              </button>

              {/* Mobile Menu Toggle Button (Min 44x44 touch area) */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="sm:hidden w-10 h-10 flex items-center justify-center text-muted hover:text-ink border border-line-strong rounded-control bg-white hover:bg-surface-2 transition active:scale-95"
                aria-label="Toggle navigation menu"
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? <X className="w-5 h-5 text-ink" /> : <Menu className="w-5 h-5 text-ink" />}
              </button>
            </div>
          </div>
        </div>

        {/* Tier 2: Tabs beneath Header */}
        <div className="w-full bg-white border-t border-line">
          <div className="w-full max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="hidden sm:flex items-stretch gap-1">
              {navItems.map((item) => {
                const isRestrictedForSales = item.adminOnly && !isAdmin;

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `inline-flex items-center px-4 py-2.5 text-xs font-semibold tracking-wide transition-colors border-b-2 -mb-[1px] ${
                        isActive
                          ? 'text-brand border-brand'
                          : 'text-muted hover:text-ink border-transparent hover:border-line-strong'
                      } ${isRestrictedForSales ? 'opacity-35 pointer-events-none' : ''}`
                    }
                  >
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>

            {/* Mobile Navigation Dropdown */}
            {mobileMenuOpen && (
              <div className="sm:hidden border-t border-line bg-white shadow-lg animate-in slide-in-from-top-2 duration-150">
                <nav className="py-2 px-3 space-y-1">
                  {navItems.map((item) => {
                    const isRestrictedForSales = item.adminOnly && !isAdmin;

                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        onClick={() => setMobileMenuOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center min-h-[44px] px-3.5 py-2.5 text-xs font-semibold rounded-control transition ${
                            isActive
                              ? 'text-brand bg-brand-soft border-l-3 border-brand'
                              : 'text-muted hover:text-ink hover:bg-surface-2'
                          } ${isRestrictedForSales ? 'opacity-35 pointer-events-none' : ''}`
                        }
                      >
                        <span>{item.label}</span>
                        {item.adminOnly && !isAdmin && (
                          <span className="ml-auto text-[10px] text-faint">Admin Only</span>
                        )}
                      </NavLink>
                    );
                  })}

                  {/* Drawer Footer with User Info & Logout */}
                  <div className="pt-3 mt-2 border-t border-line px-1 space-y-2">
                    <div className="text-[11px] text-muted flex items-center justify-between">
                      <span className="truncate">{userName}</span>
                      <span className="font-semibold text-brand text-[10px] bg-brand-soft px-1.5 py-0.5 rounded border border-brand/20">
                        {roleLabel}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        handleLogout();
                      }}
                      className="w-full min-h-[44px] flex items-center justify-center gap-2 text-xs font-semibold text-danger bg-rose-50/60 hover:bg-rose-50 border border-rose-200 rounded-control transition"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </nav>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="flex-1 w-full max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 py-5">
        {isAdmin && <CompanySetupWarning />}
        <Outlet />
      </main>

      {/* Application Footer */}
      <footer className="w-full bg-white border-t border-line py-3.5 text-center text-xs text-muted no-print">
        <div className="w-full max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8">
          RR Metal Roofing · Quotation &amp; Billing System · ApexFlow Technologies
        </div>
      </footer>
    </div>
  );
};
