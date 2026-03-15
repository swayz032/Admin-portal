/**
 * Sentry integration for Aspire Admin Portal (React/Vite).
 * Optional: no-op if VITE_SENTRY_DSN is not set. Strips PII per Law #9.
 */

const PII_FIELDS = new Set([
  'email', 'phone', 'ssn', 'password', 'secret', 'token',
  'key', 'api_key', 'apikey', 'authorization', 'credit_card',
  'card_number', 'cvv', 'social_security',
]);

function stripPii(data: Record<string, unknown>): Record<string, unknown> {
  const cleaned = { ...data };
  for (const key of Object.keys(cleaned)) {
    if (PII_FIELDS.has(key.toLowerCase())) {
      cleaned[key] = '[REDACTED]';
    }
  }
  return cleaned;
}

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    return; // Silent — Sentry optional in Admin Portal
  }

  import('@sentry/react')
    .then((Sentry) => {
      Sentry.init({
        dsn,
        tracesSampleRate: 0.1,
        environment: import.meta.env.MODE,
        release: import.meta.env.VITE_APP_VERSION || 'unknown',
        beforeSend(event) {
          const request = event.request;
          if (request?.data && typeof request.data === 'object') {
            request.data = stripPii(request.data as Record<string, unknown>);
          }
          return event;
        },
        integrations: [
          Sentry.browserTracingIntegration(),
        ],
      });
      console.log('Sentry initialized');
    })
    .catch(() => {
      // @sentry/react not installed — silent no-op
    });
}
