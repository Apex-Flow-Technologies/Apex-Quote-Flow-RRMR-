import React, { useState } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { LoginBackground } from './LoginBackground';

export const LoginPage: React.FC = () => {
  const { user, status, login, loading, authError, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const redirectPath = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/app';

  // If already logged in and active, forward to app
  if (status === 'authenticated' && user) {
    return <Navigate to={redirectPath} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (!email || !password) {
      return;
    }

    setSubmitting(true);
    const success = await login(email, password);
    setSubmitting(false);

    if (success) {
      navigate(redirectPath, { replace: true });
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col justify-center items-center p-4 sm:p-6 overflow-hidden font-sans">
      {/* Industrial Roofing & Quotation Background */}
      <LoginBackground />

      {/* Smoked-Glass Nameplate Login Card (Centered, 420px max-width, 12px radius) */}
      <div className="w-[92%] sm:w-full max-w-[420px] rounded-[12px] overflow-hidden relative z-10 login-glass-panel animate-in fade-in zoom-in-95 duration-200">
        {/* Subtle Diagonal Sheen Overlay (12% opacity) */}
        <div
          className="absolute inset-0 rounded-[12px] pointer-events-none z-10"
          style={{
            background:
              'linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0) 45%)',
          }}
          aria-hidden="true"
        />

        {/* Faint Corrugated Sheet Texture across card body */}
        <div
          className="absolute inset-0 rounded-[12px] pointer-events-none z-10 opacity-[0.035]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, #FFFFFF 0px, #FFFFFF 1px, transparent 1px, transparent 3px)',
          }}
          aria-hidden="true"
        />

        {/* Inner Frame Line (inset 8px, hidden on small screens) */}
        <div
          className="hidden md:block absolute inset-[8px] rounded-[8px] border border-white/[0.08] pointer-events-none z-20"
          aria-hidden="true"
        />

        {/* Corner Fastener Dots (metal plate fasteners, hidden on small screens) */}
        <div
          className="hidden md:block absolute top-[13px] left-[13px] w-[10px] h-[10px] rounded-full border border-[#1E293B] pointer-events-none z-25"
          style={{
            background: 'radial-gradient(circle at 35% 35%, #CAD1D8 0%, #6E767E 65%, #353B42 100%)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.5)',
          }}
          aria-hidden="true"
        >
          <span className="absolute top-[1.5px] left-[1.5px] w-[1.5px] h-[1.5px] rounded-full bg-white/80" />
        </div>
        <div
          className="hidden md:block absolute top-[13px] right-[13px] w-[10px] h-[10px] rounded-full border border-[#1E293B] pointer-events-none z-25"
          style={{
            background: 'radial-gradient(circle at 35% 35%, #CAD1D8 0%, #6E767E 65%, #353B42 100%)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.5)',
          }}
          aria-hidden="true"
        >
          <span className="absolute top-[1.5px] left-[1.5px] w-[1.5px] h-[1.5px] rounded-full bg-white/80" />
        </div>
        <div
          className="hidden md:block absolute bottom-[13px] left-[13px] w-[10px] h-[10px] rounded-full border border-[#1E293B] pointer-events-none z-25"
          style={{
            background: 'radial-gradient(circle at 35% 35%, #CAD1D8 0%, #6E767E 65%, #353B42 100%)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.5)',
          }}
          aria-hidden="true"
        >
          <span className="absolute top-[1.5px] left-[1.5px] w-[1.5px] h-[1.5px] rounded-full bg-white/80" />
        </div>
        <div
          className="hidden md:block absolute bottom-[13px] right-[13px] w-[10px] h-[10px] rounded-full border border-[#1E293B] pointer-events-none z-25"
          style={{
            background: 'radial-gradient(circle at 35% 35%, #CAD1D8 0%, #6E767E 65%, #353B42 100%)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.5)',
          }}
          aria-hidden="true"
        >
          <span className="absolute top-[1.5px] left-[1.5px] w-[1.5px] h-[1.5px] rounded-full bg-white/80" />
        </div>

        {/* Top 5px Blue Sheet Edge Accent Strip + 1px Blue Highlight Rule */}
        <div className="h-[5px] w-full bg-[#2563EB] rounded-t-[12px] relative z-20" aria-hidden="true" />
        <div className="h-[1px] w-full bg-[#60A5FA]/80 relative z-20" aria-hidden="true" />

        {/* Header Block: Dark translucent band spanning full card width */}
        <div className="bg-black/30 border-b border-white/10 px-6 py-6 text-center relative z-20">
          <h1 className="font-serif font-bold text-xl sm:text-2xl uppercase tracking-wider text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.4)]">
            RR METAL ROOFING
          </h1>
          <div className="h-[1.5px] w-12 bg-[#60A5FA] mx-auto my-2 rounded-full" />
          <p className="text-xs text-white/90 tracking-wide font-medium [text-shadow:0_1px_2px_rgba(0,0,0,0.4)]">
            Quotation &amp; Billing System
          </p>
        </div>

        {/* Main Form Body */}
        <div className="p-6 relative z-20">
          {/* Section Heading directly above form */}
          <h2 className="font-serif text-base sm:text-lg font-bold text-white text-center [text-shadow:0_1px_2px_rgba(0,0,0,0.4)]">
            Sign in to your account
          </h2>
          <div className="h-[1px] w-8 bg-[#60A5FA] mx-auto mt-1.5 mb-5" aria-hidden="true" />

          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            {/* Error Message Box (only when authError is present) */}
            {authError && (
              <div
                role="alert"
                aria-live="polite"
                className="p-3 rounded-[6px] bg-[#FEF2F2] border-l-4 border-l-[#EF4444] border-t border-r border-b border-[#FCA5A5] text-xs text-[#991B1B] leading-relaxed shadow-sm"
              >
                {authError.toLowerCase().includes('credential') ||
                authError.toLowerCase().includes('password') ||
                authError.toLowerCase().includes('user-not-found')
                  ? 'The email or password is incorrect. Please try again.'
                  : authError}
              </div>
            )}

            {/* Email Address Field */}
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-white mb-1.5 [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]"
              >
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="block w-full h-11 px-3 text-xs sm:text-sm text-[#101828] bg-white border border-white/50 rounded-[6px] shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/40 focus:bg-white transition-colors placeholder:text-[#94A3B8]"
              />
            </div>

            {/* Password Field with Eye Toggle */}
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold text-white mb-1.5 [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full h-11 px-3 pr-11 text-xs sm:text-sm text-[#101828] bg-white border border-white/50 rounded-[6px] shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/40 focus:bg-white transition-colors placeholder:text-[#94A3B8]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#64748B] hover:text-[#2563EB] transition-colors focus:outline-none cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="w-[18px] h-[18px]" aria-hidden="true" />
                  ) : (
                    <Eye className="w-[18px] h-[18px]" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {/* Primary Action Button */}
            <button
              type="submit"
              disabled={submitting || loading}
              className="w-full h-11 mt-2 flex justify-center items-center px-4 rounded-[6px] text-xs font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E3A8A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-2px_0_rgba(0,0,0,0.25)]"
            >
              {submitting || loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        {/* Footer Strip: Dark band spanning full card width */}
        <div className="bg-black/30 border-t border-white/[0.08] py-3.5 px-6 text-center relative z-20">
          <p className="text-[11px] leading-relaxed text-white/80 [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]">
            Access is provided by your administrator.
          </p>
        </div>
      </div>

      {/* Roofing Product Line Tagline & Platform Footer */}
      <div className="relative z-10 mt-6 text-center select-none">
        <p className="text-xs text-white/80 tracking-wide font-sans [text-shadow:0_1px_2px_rgba(0,0,0,0.4)]">
          Roofing Sheets • Ridge Caps • Flashings • Fasteners • Accessories
        </p>
        <p className="text-[11px] text-white/50 mt-1.5 font-sans [text-shadow:0_1px_2px_rgba(0,0,0,0.4)]">
          RR Metal Roofing • Powered by ApexFlow Technologies
        </p>
      </div>
    </div>
  );
};
