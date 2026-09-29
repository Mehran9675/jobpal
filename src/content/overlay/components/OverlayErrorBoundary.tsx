import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Keeps a rendering error in one overlay component from unmounting the whole
 * overlay (the panel, the button and the editor all live in one React root).
 */
export class OverlayErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[jobpal] overlay render error', error, info.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="jp-crash">
        <div className="jp-detect-title">Something went wrong in the overlay</div>
        <div className="jp-detect-hint">{error.message}</div>
        <button type="button" className="jp-mini jp-mini-primary" onClick={() => this.setState({ error: null })}>
          Try again
        </button>
      </div>
    );
  }
}
