import React, { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { LogOut, Menu, X, ChevronDown } from 'lucide-react';

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
  ];

  const userName = profile?.name || user?.email?.split('@')[0] || 'User';
  const roleLabel = isAdmin ? 'Administrator' : 'Sales Staff';

  return (
    <div className="min-h-screen flex flex-col bg-white text-ink font-sans">
      {/* Application Header (White, sticky, thin bottom border, subtle blur) */}
      <header className="w-full sticky top-0 z-30 no-print bg-white/95 backdrop-blur-xs border-b border-line">
        <div className="w-full max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-13">
            {/* Left: Blue square logo & brand text */}
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 bg-brand rounded-control flex items-center justify-center text-white font-bold text-xs select-none shadow-xs">
                RR
              </div>
              <div className="flex items-center gap-2.5">
                <span className="font-bold text-sm tracking-tight text-ink">
                  RR Metal Roofing
                </span>
                <span className="hidden sm:inline-block text-faint text-xs font-normal border-l border-line-strong pl-2.5">
                  Quotations
                </span>
              </div>
            </div>

            {/* Right: Outlined user profile button & quiet logout */}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center gap-1.5 text-xs text-muted hover:text-ink py-1 px-2.5 rounded-control border border-line-strong bg-white hover:bg-surface-2 transition-colors focus:outline-none"
                  title="Account details"
                >
                  <span className="font-medium">{userName}</span>
                  <span className="text-line-strong">·</span>
                  <span className="text-muted text-[11px]">{roleLabel}</span>
                  <ChevronDown className="w-3 h-3 text-faint ml-0.5" />
                </button>

                {/* Dropdown Menu for Email & Account Details */}
                {userDropdownOpen && (
                  <div
                    onMouseLeave={() => setUserDropdownOpen(false)}
                    className="absolute right-0 top-full mt-1.5 w-56 bg-white text-ink border border-line-strong rounded-control shadow-sm p-3 z-50 text-xs animate-in fade-in duration-100"
                  >
                    <div className="text-[10px] font-bold text-faint uppercase tracking-wider mb-1">
                      Signed In User
                    </div>
                    <div className="font-mono text-xs text-ink break-all mb-2 font-medium">
                      {user?.email}
                    </div>
                    <div className="pt-2 border-t border-line flex items-center justify-between text-[11px] text-muted">
                      <span>System Role:</span>
                      <span className="font-semibold text-brand">{roleLabel}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Quiet Outlined Logout Button */}
              <button
                type="button"
                onClick={handleLogout}
                className="px-2.5 py-1 text-xs text-muted hover:text-ink border border-line-strong rounded-control bg-white hover:bg-surface-2 transition-colors flex items-center gap-1"
                title="Sign out of the system"
              >
                <LogOut className="w-3.5 h-3.5 text-faint" />
                <span className="hidden sm:inline">Logout</span>
              </button>

              {/* Mobile Menu Toggle Button */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="sm:hidden p-1.5 text-muted hover:text-ink border border-line-strong rounded-control ml-1"
                aria-label="Toggle navigation menu"
              >
                {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4 text-ink" />}
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
              <nav className="sm:hidden py-2 border-t border-line space-y-1">
                {navItems.map((item) => {
                  const isRestrictedForSales = item.adminOnly && !isAdmin;

                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `block px-3 py-2 text-xs font-semibold rounded-control ${
                          isActive
                            ? 'text-brand bg-brand-soft'
                            : 'text-muted hover:text-ink hover:bg-surface-2'
                        } ${isRestrictedForSales ? 'opacity-35 pointer-events-none' : ''}`
                      }
                    >
                      {item.label}
                    </NavLink>
                  );
                })}
              </nav>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="flex-1 w-full max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 py-5">
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
