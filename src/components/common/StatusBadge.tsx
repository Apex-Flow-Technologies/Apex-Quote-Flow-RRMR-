import React from 'react';

interface StatusBadgeProps {
  label: string;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'primary';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  label,
  variant = 'info',
}) => {
  const styles = {
    success: 'bg-emerald-50 text-ok border-emerald-200',
    warning: 'bg-amber-50 text-warn border-amber-200',
    danger: 'bg-rose-50 text-danger border-rose-200',
    info: 'bg-surface-2 text-muted border-line-strong',
    primary: 'bg-brand-soft text-brand border-brand/20',
  }[variant];

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-control text-xs font-semibold border ${styles}`}
    >
      {label}
    </span>
  );
};
