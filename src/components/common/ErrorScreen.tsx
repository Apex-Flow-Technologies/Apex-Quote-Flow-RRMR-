import React, { useEffect } from 'react';
import { useRouteError } from 'react-router-dom';
import { AlertTriangle, RotateCcw } from 'lucide-react';

/** After a deploy, an old tab may ask for page files that no longer exist — reload once to get the new version. */
export function isStaleChunkError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return /dynamically imported module|Importing a module script failed|Failed to fetch dynamically|error loading dynamically/i.test(msg);
}

const RELOAD_FLAG = 'rr-chunk-reload-at';

function reloadOnceForStaleChunk(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_FLAG) || 0);
    if (Date.now() - last < 30_000) return false; // avoid reload loops
    sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
  } catch {
    /* storage blocked — still try once */
  }
  window.location.reload();
  return true;
}

export const ErrorScreen: React.FC<{ error?: unknown; onReset?: () => void }> = ({ error, onReset }) => {
  const stale = isStaleChunkError(error);

  useEffect(() => {
    if (stale) reloadOnceForStaleChunk();
  }, [stale]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-sm w-full bg-white border border-line-strong rounded-card shadow-sm p-6 text-center">
        <div className="w-11 h-11 mx-auto rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mb-3">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
        </div>
        <h2 className="text-base font-bold text-ink">
          {stale ? 'Updating to the latest version…' : 'Something went wrong'}
        </h2>
        <p className="text-sm text-muted mt-1.5">
          {stale
            ? 'A new version of the app was published. Reloading now.'
            : 'This screen hit an unexpected error. Your saved quotations are safe.'}
        </p>
        <button
          type="button"
          onClick={() => (onReset ? onReset() : window.location.reload())}
          className="mt-5 w-full min-h-[44px] inline-flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark text-white rounded-control text-sm font-semibold transition"
        >
          <RotateCcw className="w-4 h-4" />
          Reload
        </button>
        {!stale && error instanceof Error && (
          <p className="mt-3 text-[11px] text-faint font-mono break-words">{error.message}</p>
        )}
      </div>
    </div>
  );
};

/** Router-level error element (errors thrown while rendering a page). */
export const RouteErrorScreen: React.FC = () => {
  const error = useRouteError();
  return <ErrorScreen error={error} />;
};

/** Last-resort boundary around the whole app (errors outside the router). */
export class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: unknown }> {
  state = { error: null as unknown };
  static getDerivedStateFromError(error: unknown) {
    return { error };
  }
  componentDidCatch(error: unknown) {
    console.error('App crashed:', error);
  }
  render() {
    return this.state.error ? <ErrorScreen error={this.state.error} /> : this.props.children;
  }
}

export const PageLoader: React.FC = () => (
  <div className="p-4 sm:p-6 space-y-3 animate-pulse" aria-busy="true" aria-label="Loading">
    <div className="h-7 w-40 bg-surface-2 border border-line rounded-control" />
    <div className="h-4 w-64 bg-surface-2 border border-line rounded-control" />
    <div className="h-28 bg-surface-2 border border-line rounded-card" />
    <div className="h-28 bg-surface-2 border border-line rounded-card" />
  </div>
);
