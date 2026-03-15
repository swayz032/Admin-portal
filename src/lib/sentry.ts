/**
 * Sentry error tracking for Aspire Admin Portal (React/Vite).
 *
 * Optional — no-op if VITE_SENTRY_DSN is not set.
 * PII is stripped from all events before sending (Law #9).
 *
 * Usage in src/main.tsx:
 *   import { initSentry } from './lib/sentry';
 *   initSentry();  // call before React render
 */

// ---------------------------------------------------------------------------
// PII scrubbing (Law #9)
// ---------------------------------------------------------------------------

const PII_FIELDS = new Set([
  'email', 'phone', 'ssn', 'password', 'passwd',
  'secret', 'token', 'key', 'authorization',
  'credit_card', 'card_number', 'cvv', 'api_key',
  'apikey', 'access_token', 'refresh_token', 'session_id',
  'social_security',
]);

const PII_VALUE_PATTERNS: Array<[RegExp, string]> = [
  [/sk[-_](?:test|live|prod)[-_]\w+/g, 'sk-***'],
  [/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '***JWT***'],
  [/:\/\/\w+:[^@]+@/g, '://***:***@'],
  [/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '***@***.***'],
  [/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '***-***-****'],
  [/\b\d{3}-\d{2}-\d{4}\b/g, '***-**-****'],
  [/Bearer\s+\S+/gi, 'Bearer ***'],
];

function isPiiField(name: string): boolean {
  return PII_FIELDS.has(name.toLowerCase());
}

function scrubValue(value: string): string {
  let result = value;
  for (const [pattern, replacement] of PII_VALUE_PATTERNS) {
    pattern.lastIndex = 0;
    result = result.replace(pattern, replacement);
  }
  return result;
}

function scrubDict(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (isPiiField(k)) {
      result[k] = '[Filtered]';
    } else if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      result[k] = scrubDict(v as Record<string, unknown>);
    } else if (typeof v === 'string') {
      result[k] = scrubValue(v);
    } else {
      result[k] = v;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Sentry initialization
// ---------------------------------------------------------------------------

/**
 * Initialize Sentry for the React app. Call once in main.tsx before render.
 * No-op if VITE_SENTRY_DSN is not set or @sentry/react is not installed.
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    // Silent — Sentry is optional in Admin Portal
    return;
  }

  import('@sentry/react')
    .then((Sentry) => {
      Sentry.init({
        dsn,
        environment: import.meta.env.MODE ?? 'development',
        release: import.meta.env.VITE_ASPIRE_RELEASE ?? import.meta.env.VITE_APP_VERSION ?? 'aspire-admin@1.0.0',
        sendDefaultPii: false,
        tracesSampleRate: parseFloat(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
        beforeSend(event) {
          // Scrub request data
          if (event.request) {
            if (event.request.headers && typeof event.request.headers === 'object') {
              event.request.headers = scrubDict(
                event.request.headers as Record<string, unknown>,
              ) as Record<string, string>;
            }
            if (event.request.data && typeof event.request.data === 'object') {
              event.request.data = scrubDict(event.request.data as Record<string, unknown>);
            }
            if (typeof event.request.query_string === 'string') {
              event.request.query_string = scrubValue(event.request.query_string);
            }
            if (event.request.cookies) {
              event.request.cookies = '[Filtered]';
            }
          }

          // Scrub exception values
          if (event.exception?.values) {
            for (const exc of event.exception.values) {
              if (typeof exc.value === 'string') {
                exc.value = scrubValue(exc.value);
              }
            }
          }

          // Scrub breadcrumbs
          if (event.breadcrumbs) {
            for (const bc of event.breadcrumbs) {
              if (typeof bc.message === 'string') {
                bc.message = scrubValue(bc.message);
              }
              if (bc.data && typeof bc.data === 'object') {
                bc.data = scrubDict(bc.data as Record<string, unknown>);
              }
            }
          }

          // Scrub extra, contexts, tags
          for (const section of ['extra', 'contexts', 'tags'] as const) {
            const val = (event as Record<string, unknown>)[section];
            if (val && typeof val === 'object') {
              (event as Record<string, unknown>)[section] = scrubDict(val as Record<string, unknown>);
            }
          }

          // Scrub user
          if (event.user && typeof event.user === 'object') {
            event.user = scrubDict(event.user as Record<string, unknown>) as Record<string, string>;
          }

          return event;
        },
        integrations: [
          Sentry.browserTracingIntegration(),
        ],
        maxBreadcrumbs: 50,
      });

      console.log(`[sentry] Initialized: environment=${import.meta.env.MODE}`);
    })
    .catch(() => {
      // @sentry/react not installed — silent no-op
    });
}
