# Policy Gate Agent Memory

## Key Files Reviewed (2026-03-15)
- [Enforcement patterns](enforcement-patterns.md) — token mint, approval check, execute node, policy engine
- [Bypass findings](bypass-findings.md) — critical vulnerabilities found in Desktop server

## Key Files Reviewed (2026-03-17 — Admin Portal premium overhaul)
- [Admin Portal findings](admin-portal-review.md) — detailed findings from post-overhaul review

## Top-Level Status
- Backend orchestrator: STRONG enforcement (Law 1-7 well-implemented)
- Aspire-Desktop server: CRITICAL gaps (Law 1, 4, 5 violations in stripeConnectRoutes.ts, gustoRoutes.ts)
- Admin Portal: CONDITIONAL PASS — 2 HIGH findings, 3 MEDIUM, 1 LOW; no CRITICAL

## Critical Findings (do not forget)
1. `Aspire-desktop/server/stripeConnectRoutes.ts` — ALL `/api/stripe/*` routes execute Stripe directly with NO orchestrator routing, NO capability token validation, NO approval gates for RED/YELLOW ops (invoice send, void, delete)
2. `Aspire-desktop/server/index.ts:L462-514` — gustoRoutes, plaidRoutes, quickbooksRoutes, stripeConnectRoutes ALL registered AFTER the RLS middleware but the stripeConnectRoutes router does NOT call requireAuth() per-route — auth check relies entirely on the global middleware, which is correct for auth but the routes have NO capability token or approval gate layer
3. `backend/infrastructure/supabase/migrations/063_premium_display_ids.sql:L259` — UPDATE on receipts table in a migration (Law 2 violation in migration context)
4. `backend/orchestrator/src/.../nodes/execute.py:L157` — bare `except Exception: pass` swallows safe mode check error, proceeds to execute (Law 3 fail-open gap)
5. `backend/orchestrator/src/.../skillpacks/clara_legal.py:L1023-1024` — `except Exception: pass` swallows RAG errors silently

## Admin Portal Key Patterns (2026-03-17)
- `src/services/apiClient.ts` — ALL 1,889 lines are SELECT queries only. No INSERT/UPDATE/DELETE. Fail-closed on all critical paths (throws ApiError). Soft-fail (returns empty + devWarn) on non-critical metrics queries.
- `src/services/registryClient.ts` — Has write operations (INSERT/UPDATE to agent_registry, config_rollouts, config_proposals). Emits client-side CustomEvent receipts via `window.dispatchEvent('aspire:receipt')`. NOT persisted to Supabase receipts table.
- `src/pages/Auth.tsx:L72` — Direct `supabase.from('audit_log').insert()` from frontend. Intentional (auth audit). Swallows all errors so login is never blocked.
- `src/contexts/AuthContext.tsx:L140` — Direct `supabase.from('audit_log').insert()` from frontend (force_logout audit). Same pattern.
- `src/services/opsFacadeClient.ts:L541-550` — `submitApprovalDecision()` routes through backend `/admin/ops/approvals/:id/decide` (correct Law 7 pattern).
- `src/pages/Approvals.tsx:L68` — Approval decisions go through opsFacadeClient, not direct Supabase write. Correct.
- Receipt payload displayed raw in engineer mode: `Receipts.tsx:L422`, `FinanceView.tsx:L340`, `MailVisibility.tsx:L337`, `ConferenceMonitor.tsx:L328`. Provider call request_meta/response_meta displayed raw: `ProviderCallLog.tsx:L389,L396`.
- `ReleaseControl.tsx:L36` — Hardcoded `approval = { status: 'approved', decisionReason: 'Auto-approved after tests' }` when `createdApprovalId` is truthy. UI-only state machine, not connected to real backend approval records.
- Capability tokens: NOT used anywhere in admin portal. Admin portal uses admin JWT (X-Admin-Token) for ops facade calls. This is correct for an admin portal (capability tokens are for orchestrator tool execution, not admin reads).
- Tenant isolation: Admin portal has NO explicit tenant_id filter in any query. Relies entirely on Supabase RLS. The Supabase client uses `VITE_SUPABASE_PUBLISHABLE_KEY` (anon key + session JWT), so RLS applies correctly.
- `fetchCustomers()` soft-fails: `devWarn` + `return { data: [], count: 0 }` instead of throwing. This is a MEDIUM Law 3 gap.
