// ============================================================
// FILE: components/ErrorBoundary.tsx
// CREATED: 2025-01-17
// ============================================================
// OVERVIEW:
// React Error Boundary component for graceful error handling.
// Catches JavaScript errors in child components, logs them,
// and displays fallback UI instead of crashing the entire app.
// Implements React 18 error boundary pattern with TypeScript.
// ============================================================

'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// ============================================================
// ERROR BOUNDARY COMPONENT
// ============================================================

/**
 * Error Boundary Component
 * 
 * Catches errors in child components and displays fallback UI.
 * Prevents entire app crash when individual components fail.
 * 
 * Features:
 * - Catches rendering errors, lifecycle errors, constructor errors
 * - Logs errors to console (can be extended to error tracking service)
 * - Displays user-friendly error message
 * - Provides reload button for recovery
 * - Shows error details in development mode
 * 
 * @example
 * ```tsx
 * <ErrorBoundary>
 *   <SomeComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  /**
   * Static method called when error is caught
   * Updates state to trigger fallback UI rendering
   */
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  /**
   * Lifecycle method called after error is caught
   * Logs error details and calls optional error handler
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to console
    console.error('Error Boundary Caught:', error);
    console.error('Component Stack:', errorInfo.componentStack);

    // Update state with error info
    this.setState({
      errorInfo,
    });

    // Call optional error handler (for logging to service like Sentry)
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  /**
   * Reset error boundary state
   * Allows user to retry after error
   */
  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  /**
   * Reload entire page
   * Last resort recovery option
   */
  handleReload = (): void => {
    window.location.reload();
  };

  render() {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback } = this.props;

    // If error occurred, render fallback UI
    if (hasError) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback;
      }

      // Default fallback UI
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gray-900">
          <Card className="max-w-2xl w-full border-2 border-red-500">
            <div className="p-6">
              {/* Error Icon */}
              <div className="text-center mb-4">
                <span className="text-6xl">⚠️</span>
              </div>

              {/* Error Title */}
              <h1 className="text-2xl font-bold text-red-400 text-center mb-2">
                Oops! Something went wrong
              </h1>

              {/* Error Message */}
              <p className="text-gray-300 text-center mb-6">
                We encountered an unexpected error. Don't worry, your progress is saved.
              </p>

              {/* Error Details (Development Mode) */}
              {process.env.NODE_ENV === 'development' && error && (
                <Panel className="bg-red-900/20 border border-red-500 mb-6">
                  <div className="mb-3">
                    <h3 className="font-bold text-red-400 mb-2">Error Details:</h3>
                    <pre className="text-xs text-red-300 overflow-x-auto bg-black/30 p-3 rounded">
                      {error.toString()}
                    </pre>
                  </div>
                  
                  {errorInfo && (
                    <div>
                      <h3 className="font-bold text-red-400 mb-2">Component Stack:</h3>
                      <pre className="text-xs text-red-300 overflow-x-auto bg-black/30 p-3 rounded max-h-48">
                        {errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </Panel>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  size="base"
                  onClick={this.handleReset}
                  className="flex-1"
                >
                  Try Again
                </Button>
                <Button
                  variant="primary"
                  size="base"
                  onClick={this.handleReload}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  Reload Page
                </Button>
              </div>

              {/* Help Text */}
              <p className="text-xs text-gray-500 text-center mt-4">
                If this problem persists, please contact support or check the console for details.
              </p>
            </div>
          </Card>
        </div>
      );
    }

    // No error, render children normally
    return children;
  }
}

/**
 * Higher-order component to wrap components with error boundary
 * Useful for wrapping individual components
 * 
 * @example
 * ```tsx
 * const SafeComponent = withErrorBoundary(MyComponent);
 * ```
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
): React.ComponentType<P> {
  return (props: P) => (
    <ErrorBoundary fallback={fallback}>
      <Component {...props} />
    </ErrorBoundary>
  );
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Catches errors during rendering, lifecycle methods, and constructors
// - Does NOT catch: Event handlers, async code, SSR errors, errors in boundary itself
// - For event handler errors, use try-catch blocks directly
// - For async errors, use promise .catch() or try-catch in async functions
// - Error logging can be integrated with services like Sentry, LogRocket, etc.
// - Reset button attempts to re-render component tree
// - Reload button forces full page refresh as last resort
// - Development mode shows detailed error info, production shows generic message
// - Can be nested: inner boundary catches first, outer boundary as fallback
// ============================================================
// USAGE PATTERNS:
// ============================================================
// 1. Wrap entire app:
//    <ErrorBoundary><App /></ErrorBoundary>
// 
// 2. Wrap individual features:
//    <ErrorBoundary><GamePanel /></ErrorBoundary>
// 
// 3. Custom fallback:
//    <ErrorBoundary fallback={<CustomError />}><Component /></ErrorBoundary>
// 
// 4. Error logging:
//    <ErrorBoundary onError={(error) => logToService(error)}><App /></ErrorBoundary>
// ============================================================
// END OF FILE
// ============================================================
