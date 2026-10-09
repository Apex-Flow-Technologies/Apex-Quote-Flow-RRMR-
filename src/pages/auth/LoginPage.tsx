import React, { useState } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
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
    <div className="min-h-screen relative flex flex-col justify-center items-center p-4 sm:p-6 overflow-hidden font-sans bg-surface-2">
      {/* Light modern background */}
      <LoginBackground />

      {/* Clean White Login Card */}
      <div className="w-[92%] sm:w-full max-w-[400px] bg-white rounded-card border border-line-strong shadow-xs overflow-hidden relative z-10 p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="w-9 h-9 bg-brand rounded-control flex items-center justify-center text-white font-bold text-sm shadow-xs mx-auto mb-3 select-none">
            RR
          </div>
          <h1 className="font-bold text-xl text-ink tracking-tight">
            RR Metal Roofing
          </h1>
          <p className="text-xs text-muted mt-1 font-medium">
            Quotation &amp; Billing System
          </p>
        </div>

        {/* Section title */}
        <div className="border-t border-line pt-4 mb-4 text-center">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider">
            Sign in to your account
          </h2>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          {/* Error Message Box */}
          {authError && (
            <div
              role="alert"
              aria-live="polite"
              className="p-3 rounded-control bg-rose-50 border border-rose-200 text-xs text-danger leading-relaxed"
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
              className="block text-[10.5px] font-semibold text-faint uppercase tracking-wider mb-1.5"
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
              className="block w-full h-10 px-3 text-[13.5px] text-ink bg-white border border-line-strong rounded-control focus:border-brand focus:ring-3 focus:ring-brand/15 transition-colors"
            />
          </div>

          {/* Password Field */}
          <div>
            <label
              htmlFor="password"
              className="block text-[10.5px] font-semibold text-faint uppercase tracking-wider mb-1.5"
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
                className="block w-full h-10 px-3 pr-14 text-[13.5px] text-ink bg-white border border-line-strong rounded-control focus:border-brand focus:ring-3 focus:ring-brand/15 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs font-medium text-muted hover:text-ink transition-colors focus:outline-none"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {/* Primary Action Button */}
          <button
            type="submit"
            disabled={submitting || loading}
            className="w-full h-10 mt-2 flex justify-center items-center px-4 rounded-control text-xs font-semibold text-white bg-brand hover:bg-brand-dark active:bg-brand-deep transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs"
          >
            {submitting || loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Footer info inside card */}
        <div className="mt-5 pt-3.5 border-t border-line text-center">
          <p className="text-[11px] leading-relaxed text-muted">
            Access is provided by your administrator.
          </p>
        </div>
      </div>

      {/* Platform Footer */}
      <div className="relative z-10 mt-6 text-center select-none">
        <p className="text-[11px] text-faint font-sans">
          RR Metal Roofing • ApexFlow Technologies
        </p>
      </div>
    </div>
  );
};
