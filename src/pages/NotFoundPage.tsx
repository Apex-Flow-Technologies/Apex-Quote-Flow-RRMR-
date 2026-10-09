import React from 'react';
import { Link } from 'react-router-dom';
import { FileQuestion, ArrowLeft } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-surface-2 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-card shadow-xs border border-line-strong p-8 text-center">
        <div className="w-12 h-12 bg-surface-2 text-muted rounded-control flex items-center justify-center mx-auto mb-3">
          <FileQuestion className="w-6 h-6" />
        </div>
        <h1 className="text-lg font-bold text-ink mb-1">Page Not Found</h1>
        <p className="text-xs text-muted mb-6">
          The requested page does not exist in the quotation module.
        </p>
        <Link
          to="/app"
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-control text-xs font-semibold hover:bg-brand-dark transition shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Dashboard
        </Link>
      </div>
    </div>
  );
};
