import React from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

// ---------------------------------------------------------------------------
// Contains a crash to whatever it's wrapping instead of white-screening the
// whole app. The dashboard renders one big tree via `renderTab()`, so a bug
// in, say, the Mock Test tab used to be able to take down Timeline, Training,
// Settings — everything — since it's all one React tree with no boundary.
//
// Usage: wrap each tab's rendered output, keyed by the active tab id so that
// switching tabs (rather than needing a full page reload) is enough to
// recover — a fresh key means React remounts the boundary and gives the new
// tab a clean slate even if the previous one crashed.
//
//   <ErrorBoundary key={activeTab}>{renderTab()}</ErrorBoundary>
// ---------------------------------------------------------------------------

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional label shown in the fallback, e.g. the tab's display name. */
  label?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] caught render error', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-rose-900/40 bg-rose-950/10 px-6 py-14 text-center animate-fadeIn">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/10">
            <AlertTriangle className="h-5 w-5 text-rose-400" strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-[13.5px] font-bold text-neutral-100">
              {this.props.label ? `${this.props.label} hit a problem` : 'Something went wrong here'}
            </h3>
            <p className="mt-1 max-w-sm text-[12px] leading-relaxed text-neutral-500">
              The rest of the app is fine — just this section crashed. Try again, or switch to another
              tab and come back.
            </p>
          </div>
          <button
            onClick={this.handleReset}
            className="cursor-target mt-1 flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 py-2 text-[12px] font-semibold text-neutral-200 hover:bg-neutral-800 transition-colors"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}