import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { AlertCircle, UserX, ShieldAlert, LogOut, RefreshCw } from 'lucide-react';

export const ProtectedRoute: React.FC = () => {
  const { user, profile, status, loading, authError, logout, refetchProfile } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <LoadingSpinner label="Authenticating session..." size="lg" />
      </div>
    );
  }

  // Handle Firebase configuration error
  if (status === 'config_error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-rose-200 p-6 text-center">
          <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Configuration Required</h2>
          <p className="text-sm text-slate-600 mb-4">{authError}</p>
          <div className="bg-slate-50 p-3 rounded-lg text-xs font-mono text-left text-slate-700 border border-slate-200 mb-4">
            Populate <code>.env.local</code> with values from Firebase Console (rr-metal-roofing-web).
          </div>
        </div>
      </div>
    );
  }

  // Not signed in -> send to login page
  if (status === 'unauthenticated' || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Signed in via Auth, but users/{uid} document does not exist
  if (status === 'no_profile') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-lg w-full bg-white rounded-xl shadow-lg border border-amber-200 p-8 text-center">
          <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserX className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">User Profile Not Provisioned</h2>
          <p className="text-sm text-slate-600 mb-4">
            You are authenticated as <strong className="text-slate-800">{user.email}</strong>, but your user profile document does not exist in Firestore.
          </p>
          <div className="bg-slate-50 p-4 rounded-lg text-xs text-left border border-slate-200 space-y-2 mb-6">
            <div className="font-semibold text-slate-700">Required Firestore Document:</div>
            <div className="font-mono text-blue-600">Collection: users</div>
            <div className="font-mono text-blue-600 break-all">Document ID: {user.uid}</div>
            <div className="font-semibold text-slate-700 pt-1">Fields:</div>
            <pre className="font-mono text-slate-600 text-xs bg-white p-2 rounded border border-slate-200">
{`{
  "name": "Your Name",
  "email": "${user.email}",
  "role": "admin", // or "sales"
  "active": true
}`}
            </pre>
          </div>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => refetchProfile()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
            >
              <RefreshCw className="w-4 h-4" /> Check Again
            </button>
            <button
              onClick={() => logout()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // User exists but active is false
  if (status === 'inactive' || (profile && !profile.active)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-rose-200 p-8 text-center">
          <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Account Deactivated</h2>
          <p className="text-sm text-slate-600 mb-2">
            Hello, <strong className="text-slate-800">{profile?.name || user.email}</strong>.
          </p>
          <p className="text-sm text-slate-600 mb-6">
            Your user account is currently marked as <span className="font-semibold text-rose-600">inactive</span>. Access to the RR Metal Roofing quotation system has been disabled by the administrator.
          </p>
          <button
            onClick={() => logout()}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-900 transition"
          >
            <LogOut className="w-4 h-4" /> Return to Login
          </button>
        </div>
      </div>
    );
  }

  return <Outlet />;
};
