/**
 * Development-only logging utility (A-H6 — Enterprise Remediation Wave 3).
 *
 * In production builds, all log calls are no-ops — zero PII/token leakage.
 * Vite tree-shakes the console calls when `import.meta.env.PROD` is true.
 */

const isDev = import.meta.env.DEV;

/* eslint-disable no-console */
export const devLog = isDev ? console.log.bind(console) : (() => {});
export const devWarn = isDev ? console.warn.bind(console) : (() => {});
export const devError = isDev ? console.error.bind(console) : (() => {});
/* eslint-enable no-console */
