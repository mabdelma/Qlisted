import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null }

/**
 * Top-level error boundary. qcart previously had none, so any render-time throw
 * blanked the whole app with no clue why. This catches it and shows the actual
 * error message + stack on screen, so failures are diagnosable in production.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface to the console too (shows up in DevTools / logs).
    console.error('[qcart] Uncaught render error:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-xl w-full bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
          <p className="text-gray-600 mb-4">The app hit an unexpected error. Details below:</p>
          <pre className="text-xs bg-gray-100 text-red-700 rounded p-3 overflow-auto max-h-64 whitespace-pre-wrap">
            {error.message}
            {error.stack ? `\n\n${error.stack}` : ''}
          </pre>
          <button
            onClick={() => { this.setState({ error: null }); window.location.reload(); }}
            className="mt-4 inline-flex items-center px-4 py-2 bg-[#0f766e] text-white rounded-lg hover:bg-[#1e3a5f]"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
