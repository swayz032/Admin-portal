/**
 * Client-side defense-in-depth redaction for JSON payloads rendered in engineer mode.
 * The backend SHOULD already redact sensitive fields via Presidio DLP, but this
 * provides a secondary gate against accidental exposure of secrets/PII.
 */

const SENSITIVE_KEYS = /key|token|secret|password|credential|auth|api_key|apikey|access_token|refresh_token|bearer|ssn|tax_id/i;

export function redactPayload(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return obj;
  if (typeof obj === 'number' || typeof obj === 'boolean') return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => redactPayload(item));
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.test(key) && typeof value === 'string' && value.length > 0) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = redactPayload(value);
      }
    }
    return result;
  }

  return obj;
}
