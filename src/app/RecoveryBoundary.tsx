import { Component, type ErrorInfo, type ReactNode } from 'react';
import { logError } from './errorLog';

interface RecoveryBoundaryProps {
  children: ReactNode;
  /** Label written to the error log (e.g. "app", "editor"). */
  scope?: string;
}

interface RecoveryBoundaryState {
  error: Error | null;
}

/**
 * Recovery boundary (self-healing pass, docs/BLUEPRINT.md §7). Catches render
 * errors, always logs them (console + local error log), and shows a friendly
 * dark card — never a white screen of death, never a raw stack trace.
 */
export class RecoveryBoundary extends Component<RecoveryBoundaryProps, RecoveryBoundaryState> {
  state: RecoveryBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): RecoveryBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[Bit-Terra:${this.props.scope ?? 'app'}]`, error, info.componentStack);
    logError(error, this.props.scope ?? 'app');
  }

  private handleReset = (): void => {
    this.setState({ error: null });
  };

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div
        className="flex min-h-screen items-center justify-center p-4"
        style={{ background: 'var(--bt-slate)' }}
      >
        <div
          className="w-full max-w-md border-4 p-6"
          style={{
            borderColor: 'var(--bt-copper)',
            background: '#1b2230',
            color: 'var(--bt-bezel)',
            fontFamily: '"Pixelify Sans", sans-serif',
          }}
          role="alert"
        >
          <h1
            className="mb-3 text-sm leading-relaxed"
            style={{ fontFamily: '"Press Start 2P", monospace', color: 'var(--bt-amber)' }}
          >
            ADA YANG TERGANGGU
          </h1>
          <p className="mb-2 text-base">
            Tenang, Piko sudah mencatat masalahnya. Progresmu tersimpan otomatis di browser ini,
            jadi tidak ada yang hilang.
          </p>
          <p
            className="mb-5 break-words text-xs"
            style={{ fontFamily: '"JetBrains Mono", monospace', color: 'var(--bt-coral)' }}
          >
            {error.message}
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={this.handleReset}
              className="border-2 px-4 py-2 text-sm font-semibold"
              style={{
                borderColor: 'var(--bt-amber)',
                color: 'var(--bt-slate)',
                background: 'var(--bt-amber)',
              }}
            >
              Muat Ulang Tampilan
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="border-2 px-4 py-2 text-sm font-semibold"
              style={{ borderColor: 'var(--bt-bezel)', color: 'var(--bt-bezel)' }}
            >
              Muat Ulang Halaman
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default RecoveryBoundary;
