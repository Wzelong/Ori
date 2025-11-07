import { Component, ReactNode, ErrorInfo } from 'react';
import { formatErrorForUser, formatErrorForLogging, isAppError } from '@/lib/errors';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary component that catches React errors and displays fallback UI
 * Prevents entire app from crashing when a component throws an error
 *
 * @example
 * <ErrorBoundary>
 *   <StarMap {...props} />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary]', formatErrorForLogging(error));
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);

    this.props.onError?.(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleReset);
      }

      return <DefaultErrorFallback error={this.state.error} onReset={this.handleReset} />;
    }

    return this.props.children;
  }
}

interface FallbackProps {
  error: Error;
  onReset: () => void;
}

/**
 * Default fallback UI for error boundary
 */
function DefaultErrorFallback({ error, onReset }: FallbackProps) {
  const userMessage = formatErrorForUser(error);
  const showDetails = isAppError(error);

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <div className="max-w-md space-y-4">
        <div className="text-4xl">⚠️</div>

        <h2 className="text-xl font-semibold text-foreground">
          Something went wrong
        </h2>

        <p className="text-sm text-muted-foreground">
          {userMessage}
        </p>

        {showDetails && isAppError(error) && error.context && (
          <details className="text-xs text-left bg-muted p-3 rounded">
            <summary className="cursor-pointer font-medium mb-2">
              Technical details
            </summary>
            <pre className="overflow-auto">
              {JSON.stringify(error.context, null, 2)}
            </pre>
          </details>
        )}

        <button
          onClick={onReset}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
