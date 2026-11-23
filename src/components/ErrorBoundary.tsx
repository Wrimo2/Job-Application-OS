import * as React from 'react';
import { TriangleAlert } from 'lucide-react';
import { exportBackup } from '@/lib/io';

interface State {
  error: Error | null;
}

/** Keeps one broken screen from taking down the whole app; resets when `resetKey` changes (e.g. on navigation). */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode; resetKey?: string }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Pursuit caught an error:', error, info.componentStack);
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="page">
        <div className="mx-auto mt-10 max-w-lg rounded-2xl border bg-card p-6 text-center shadow-soft">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-amber-500/15 text-amber-600">
            <TriangleAlert className="h-6 w-6" />
          </div>
          <h2 className="mt-3 text-lg font-semibold">Something went wrong on this screen</h2>
          <p className="mt-1 text-[13.5px] text-muted-foreground">Your data is safe — it’s stored in this browser. Try reloading, or export a backup to be extra safe.</p>
          <pre className="mt-3 max-h-24 overflow-auto rounded-lg bg-muted p-2 text-left text-[11px] text-muted-foreground">{this.state.error.message}</pre>
          <div className="mt-4 flex justify-center gap-2">
            <button onClick={() => location.reload()} className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
              Reload
            </button>
            <button onClick={() => exportBackup()} className="h-9 rounded-lg border bg-card px-4 text-sm font-medium">
              Export backup
            </button>
          </div>
        </div>
      </div>
    );
  }
}
