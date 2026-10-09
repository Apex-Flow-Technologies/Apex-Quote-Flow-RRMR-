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
    <div className="min-h-screen flex flex-col bg-[#F6F3EE] text-[#222222] font-sans">
      {/* Traditional Industrial Header */}
      <header className="w-full sticky top-0 z-30 no-print">
        {/* Tier 1: Primary Company Brand Strip (Deep Oxide Red) */}
        <div className="w-full bg-[#8B2E1F] text-white border-b border-[#722417]">
          <div className="w-full max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-11 sm:h-12">
              {/* Left: Serif Brand Name & Tagline */}
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="font-serif font-bold text-sm sm:text-base tracking-wide uppercase text-white">
                  RR Metal Roofing
                </span>
                <span className="hidden sm:inline-block text-[#E5C3BC] text-xs font-normal border-l border-[#A84534] pl-3">
                  Quotation &amp; Billing
                </span>
              </div>

              {/* Right: User identity (name + role), dropdown email, quiet logout */}
              <div className="flex items-center gap-2 sm:gap-4">
                {/* User Info with tooltip/dropdown */}
                <div className="relative" ref={userMenuRef}>
                  <button
                    type="button"
                    onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                    onMouseEnter={() => setUserDropdownOpen(true)}
                    className="flex items-center gap-1.5 text-xs text-white hover:text-[#FAF3F1] py-1 px-1.5 rounded-[2px] transition-colors focus:outline-none"
                    title="Account details"
                  >
                    <span className="font-semibold">{userName}</span>
                    <span className="text-[#E5C3BC]">·</span>
                    <span className="text-[#F2DDD9] font-normal">{roleLabel}</span>
                    <ChevronDown className="w-3 h-3 text-[#E5C3BC] ml-0.5" />
                  </button>

                  {/* Dropdown Menu for Email & Account Details */}
                  {userDropdownOpen && (
                    <div
                      onMouseLeave={() => setUserDropdownOpen(false)}
                      className="absolute right-0 top-full mt-1 w-56 bg-white text-[#222222] border border-[#D8D2C8] rounded-[2px] shadow-sm p-3 z-50 text-xs animate-in fade-in duration-100"
                    >
                      <div className="text-[10px] font-bold text-[#847E75] uppercase tracking-wider mb-1">
                        Signed In User
                      </div>
                      <div className="font-mono text-xs text-[#222222] break-all mb-2 font-medium">
                        {user?.email}
                      </div>
                      <div className="pt-2 border-t border-[#E8E3DA] flex items-center justify-between text-[11px] text-[#5A554E]">
                        <span>System Role:</span>
                        <span className="font-bold text-[#8B2E1F]">{roleLabel}</span>
                      </div>
                    </div>
                  )}
                </div>

                <span className="h-4 w-px bg-[#A84534] hidden sm:block" />

                {/* Quiet Logout Link / Button */}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-2.5 py-1 text-xs text-white hover:bg-[#722417] border border-[#A84534] rounded-[2px] transition-colors"
                  title="Sign out of the system"
                >
                  <span className="hidden sm:inline">Logout</span>
                  <LogOut className="w-3.5 h-3.5 sm:hidden inline" />
                </button>

                {/* Mobile Menu Toggle Button */}
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="sm:hidden p-1 text-white hover:bg-[#722417] rounded-[2px] ml-1"
                  aria-label="Toggle navigation menu"
                >
                  {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tier 2: Horizontal Navigation Strip (Off-White / Paper Surface) */}
        <div className="w-full bg-[#FFFFFF] border-b border-[#D8D2C8]">
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
                          ? 'text-[#8B2E1F] border-[#8B2E1F] bg-[#FAF3F1]'
                          : 'text-[#5A554E] hover:text-[#222222] hover:bg-[#F6F3EE] border-transparent'
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
              <nav className="sm:hidden py-2 border-t border-[#E8E3DA] space-y-1">
                {navItems.map((item) => {
                  const isRestrictedForSales = item.adminOnly && !isAdmin;

                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `block px-3 py-2 text-xs font-semibold rounded-[2px] ${
                          isActive
                            ? 'text-[#8B2E1F] bg-[#FAF3F1] font-bold'
                            : 'text-[#5A554E] hover:text-[#222222] hover:bg-[#F6F3EE]'
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

      {/* Main Content Workspace - Paper Ground */}
      <main className="flex-1 w-full max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
        <Outlet />
      </main>

      {/* Traditional Business Footer */}
      <footer className="w-full bg-[#FFFFFF] border-t border-[#D8D2C8] py-2.5 text-center text-xs text-[#847E75] no-print">
        <div className="w-full max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8">
          RR Metal Roofing · Quotation &amp; Billing System · ApexFlow Technologies
        </div>
      </footer>
    </div>
  );
};
