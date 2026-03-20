# Security Reviewer Memory — Aspire Admin Portal

## Review Index
- [Admin Portal Audit 2026-03-17](./admin-portal-audit-2026-03-17.md) — Post-premium overhaul security review

## Key Patterns Found

### Credential Exposure
- `.env` is in `.gitignore` (correct), but `.env.example` is absent — no safe reference for devs
- `VITE_SUPABASE_PUBLISHABLE_KEY` (anon key) is committed in `.env` — this is the anon key (public-safe by design), but the file itself is tracked
- No service_role key in client-side code (correct — only in Edge Functions via Deno.env)

### Edge Function Security Hotspots
- `supabase/functions/auth-session/index.ts` — uses service_role client; has rate limiter (20 req/min per IP); wildcard CORS
- `supabase/functions/admin-sign-in/index.ts` — uses service_role client; NO rate limiter; wildcard CORS; calls `auth.admin.listUsers()` (returns ALL users); timing oracle risk

### XSS Surfaces
- `src/components/ui/chart.tsx:70` — `dangerouslySetInnerHTML` for CSS custom properties; input is `ChartConfig` (developer-controlled, not user-controlled)
- `src/components/admin-ava/MarkdownRenderer.tsx` — ReactMarkdown without `rehype-sanitize`; renders LLM output from Ava; no `rehypeRaw` plugin (raw HTML disabled by default in react-markdown v10)
- No other `dangerouslySetInnerHTML` in user-facing pages

### Pagination / DoS
- `apiClient.ts:157` — `getIncidentGroups()` fetches up to 2000 raw receipt rows unbounded (removed pagination cap)
- All other queries use `.range()` or bounded `.limit()`

### Auth & Route Protection
- All routes wrapped in `ProtectedRoute` — checks session + allowlist + isAdmin + MFA
- 30-min inactivity auto-logout; 15-min tab-hidden re-auth; 5-min session heartbeat
- Session stored in `sessionStorage` (not localStorage — safer against persistent XSS)

### RLS / Tenant Isolation
- Admin portal uses anon key + JWT; RLS enforced at Supabase layer
- No `bypassPermissions` found anywhere
- `suite_id`/`office_id` exposed as readable fields in receipt/call log detail views (engineer mode only)
- No cross-tenant query injection surfaces found

### Clipboard API
- `copyToClipboard()` in Incidents/Receipts/ProviderCallLog all use `navigator.clipboard.writeText()` directly — copies raw UUIDs, no sanitization needed (UUIDs are safe)

### request_meta / response_meta in ProviderCallLog
- Raw JSON blobs from DB rendered in `<pre>` tags — potential for sensitive data exposure if backend doesn't redact them before storing

### CORS
- Both Edge Functions use `Access-Control-Allow-Origin: "*"` — acceptable for public APIs but should be restricted to known origins for admin functions

### Dependencies
- `react-markdown@10` — raw HTML disabled by default (safe without rehypeRaw)
- `@sentry/react@10.43.0` — externalized from build bundle; PII scrubbing implemented in sentry.ts
- No `lodash`, `moment`, or other historically vulnerable packages
- All deps are current major versions as of 2026-03

## Files to Watch in Future Reviews
- `supabase/functions/admin-sign-in/index.ts` — no rate limiter, calls listUsers()
- `supabase/functions/auth-session/index.ts` — wildcard CORS, service_role usage
- `src/services/apiClient.ts` — 2000-row unbounded fetch for incidents; ALSO 5 additional unbounded select('*') with no limit: fetchBusinessMetrics (line 1011), fetchAudienceInsights (line 1641), fetchAutomationMetrics (line 1279), fetchCostsUsage (line 1413), fetchN8nIncidents (line 263 — NO limit at all)
- `src/pages/ProviderCallLog.tsx` — raw request_meta/response_meta display
- `src/components/ui/chart.tsx` — dangerouslySetInnerHTML (low risk, dev config only)

## 2026-03-17 Review Findings (Post-Premium Overhaul)
- VERDICT: CONDITIONAL — 3 blocking issues (rate limit, unbounded queries, wildcard CORS)
- BLOCKING: admin-sign-in has no rate limiter (R-001)
- BLOCKING: 5 unbounded select('*') queries in apiClient.ts (R-002)
- BLOCKING: Wildcard CORS on both admin edge functions (R-003)
- ADVISORY: request_meta/response_meta/payload/stack_trace rendered without client-side redaction (R-004, R-007)
- NO bypassPermissions found (confirmed clean)
- NO hardcoded service_role keys in frontend (confirmed clean)
- ALL routes protected by ProtectedRoute (confirmed clean)
- Auth JWT in sessionStorage only (confirmed clean)
- Suite_id in localStorage (UI scope hint only, not a security gate)
