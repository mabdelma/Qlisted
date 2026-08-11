import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  name?: string;
}

interface State {
  error: Error | null;
}

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[qcart] Error in route "${this.props.name || 'unknown'}":`, error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h2>
          <p className="text-gray-500 text-sm mb-6">
            {this.props.name
              ? `An error occurred while loading this section.`
              : `The app hit an unexpected error.`}
          </p>
          <button
            onClick={this.handleRetry}
            className="px-5 py-2.5 bg-[#0f766e] text-white rounded-lg hover:bg-[#1e3a5f] transition-colors text-sm font-medium"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }
}
