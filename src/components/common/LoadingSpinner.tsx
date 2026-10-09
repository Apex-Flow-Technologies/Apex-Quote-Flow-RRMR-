import React from 'react';

interface LoadingSpinnerProps {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  label = 'Loading...',
  size = 'md',
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-7 h-7 border-2.5',
    lg: 'w-10 h-10 border-3',
  }[size];

  return (
    <div className="flex flex-col items-center justify-center p-6 space-y-2.5">
      <div
        className={`${sizeClasses} border-brand border-t-transparent rounded-full animate-spin`}
        role="status"
        aria-label="loading"
      />
      {label && <p className="text-xs font-medium text-muted">{label}</p>}
    </div>
  );
};
