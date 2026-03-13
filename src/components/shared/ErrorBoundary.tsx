import React from 'react';
import { devError } from '@/lib/devLog';
import {
  captureUnhandledRejection,
  captureWindowError,
  reportPortalIncident,
} from '@/services/frontendIncidentReporter';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global Error Boundary — prevents white screen on uncaught errors (A-H2).
 * Shows a recovery UI with reload button instead of a blank page.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  private readonly handleWindowError = (event: ErrorEvent): void => {
    void captureWindowError(event).catch(() => {
      // best effort only
    });
  };

  private readonly handleUnhandledRejection = (event: PromiseRejectionEvent): void => {
    void captureUnhandledRejection(event).catch(() => {
      // best effort only
    });
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidMount(): void {
    window.addEventListener('error', this.handleWindowError);
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  componentWillUnmount(): void {
    window.removeEventListener('error', this.handleWindowError);
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  componentDidCatch(error: Error, _info: React.ErrorInfo): void {
    // devError is already no-op in production (Law #9 — never log PII)
    devError('[Aspire Admin] Render error:', error.message);
    void reportPortalIncident({
      kind: 'render_error',
      title: 'Admin portal render error',
      message: error.message,
      stack: error.stack,
      component: 'react_boundary',
      severity: 'sev2',
    }).catch(() => {
      // best effort only
    });
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      const configDiagnostic =
        typeof window !== 'undefined' ? window.__ASPIRE_CONFIG_ERROR__ : undefined;

      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: '#0a0a0a',
          color: '#ffffff',
          padding: '2rem',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          <div style={{
            maxWidth: '480px',
            textAlign: 'center',
          }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem' }}>
              Something went wrong
            </h1>
            <p style={{ color: '#a1a1aa', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              {this.state.error?.message || 'An unexpected error occurred in the Admin Portal.'}
            </p>
            {configDiagnostic?.missingPublicEnv?.length ? (
              <div
                style={{
                  textAlign: 'left',
                  backgroundColor: '#111827',
                  border: '1px solid #374151',
                  borderRadius: '0.5rem',
                  padding: '0.75rem',
                  marginBottom: '1.25rem',
                }}
              >
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.5rem' }}>
                  Missing Environment Variables
                </p>
                <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.875rem', lineHeight: 1.5 }}>
                  {configDiagnostic.missingPublicEnv.map((name) => (
                    <li key={name}>
                      <code>{name}</code>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                onClick={this.handleReset}
                style={{
                  padding: '0.5rem 1.25rem',
                  backgroundColor: '#27272a',
                  color: '#ffffff',
                  border: '1px solid #3f3f46',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                style={{
                  padding: '0.5rem 1.25rem',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
