// @ts-nocheck
// Keeps one broken screen from turning the whole page white: a boundary that shows a message with Try again / Reload,
// and a lazy() that retries a failed download (a new version of the game was published while this tab stayed open).
import { Component, lazy, type ComponentType, type ErrorInfo, type ReactNode } from 'react';

type State = { error: Error | null };
export class SafeView extends Component<{ children: ReactNode; label?: string }, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { try { console.error('[SafeView]', error, info.componentStack); } catch { /* no console */ } }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="p-8 max-w-md mx-auto text-center" data-testid="safe-view-error">
        <div className="text-white text-lg font-semibold mb-2">{this.props.label ?? 'This screen'} hit a problem</div>
        <p className="text-[#8ea0b8] text-sm mb-4">Nothing is lost. Try again, or reload the page to get the newest version of the game.</p>
        <div className="flex gap-2 justify-center">
          <button className="px-4 py-2 rounded-lg bg-[#00e676] text-[#0a0e14] font-semibold text-sm" onClick={() => this.setState({ error: null })} data-testid="safe-retry">Try again</button>
          <button className="px-4 py-2 rounded-lg bg-[#1a2433] text-white text-sm" onClick={() => location.reload()} data-testid="safe-reload">Reload</button>
        </div>
      </div>
    );
  }
}

/** lazy() that tries a failed download again, then reloads the page once (a stale tab asking for files that no longer exist). */
export function lazyRetry<T extends ComponentType<never>>(load: () => Promise<{ default: T }>) {
  return lazy(async () => {
    for (let i = 0; i < 2; i++) {
      try { return await load(); } catch { await new Promise((r) => setTimeout(r, 400 * (i + 1))); }
    }
    try {
      if (!sessionStorage.getItem('vb-chunk-reload')) { sessionStorage.setItem('vb-chunk-reload', '1'); location.reload(); return await new Promise<never>(() => undefined); }
      sessionStorage.removeItem('vb-chunk-reload');
    } catch { /* storage blocked */ }
    return load();
  });
}
