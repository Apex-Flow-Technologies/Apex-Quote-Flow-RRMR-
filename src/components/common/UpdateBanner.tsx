import React, { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';

/**
 * Shows "New version available — Refresh" after a deploy.
 * Compares the app bundle this tab is running with the one the server now lists in index.html.
 * Checks every 5 minutes and whenever the tab comes back to the foreground.
 */
const CHECK_EVERY_MS = 5 * 60 * 1000;

function currentBundle(): string | null {
  const el = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]');
  return el ? new URL(el.src, location.href).pathname : null;
}

async function latestBundle(): Promise<string | null> {
  try {
    const res = await fetch(`/index.html?v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const m = (await res.text()).match(/\/assets\/index-[^"']+\.js/);
    return m ? m[0] : null;
  } catch {
    return null; // offline — try again later
  }
}

export const UpdateBanner: React.FC = () => {
  const [available, setAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const running = currentBundle();
    if (!running) return; // dev server — nothing to compare

    let cancelled = false;
    const check = async () => {
      const latest = await latestBundle();
      if (!cancelled && latest && latest !== running) setAvailable(true);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };

    const timer = window.setInterval(check, CHECK_EVERY_MS);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', check);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', check);
    };
  }, []);

  if (!available || dismissed) return null;

  return (
    <div
      role="status"
      className="fixed left-3 right-3 sm:left-auto sm:right-5 sm:w-[380px] bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[10000] bg-ink text-white rounded-card shadow-2xl p-3 pl-4 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2"
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">New version available</div>
        <div className="text-xs text-white/70">Save your work, then refresh to update.</div>
      </div>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 bg-brand hover:bg-brand-dark rounded-control text-sm font-semibold"
      >
        <RefreshCw className="w-4 h-4" />
        Refresh
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="w-9 h-9 inline-flex items-center justify-center text-white/70 hover:text-white rounded-control"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
