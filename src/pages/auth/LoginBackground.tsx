import React from 'react';

/**
 * LoginBackground component
 * Clean, modern light aesthetic with subtle ambient brand accents and architectural grid.
 */
export const LoginBackground: React.FC = () => {
  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none select-none bg-surface-2"
      aria-hidden="true"
    >
      {/* Soft ambient brand tints */}
      <div className="absolute top-0 right-1/4 w-[480px] h-[480px] rounded-full bg-brand-soft opacity-60 filter blur-[100px]" />
      <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] rounded-full bg-brand-soft opacity-40 filter blur-[120px]" />

      {/* Subtle architectural dot/line grid */}
      <svg
        className="absolute inset-0 w-full h-full opacity-40"
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="100%"
      >
        <defs>
          <pattern id="loginGrid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#edf0f5" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#loginGrid)" />
      </svg>
    </div>
  );
};
