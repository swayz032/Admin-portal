---
name: Admin Portal Policy Gate Review (2026-03-17)
description: Detailed findings from post-premium-overhaul review of Aspire-Admin-Portal
type: project
---

# Admin Portal Review — Post-Premium Overhaul (2026-03-17)

## Files Examined
- src/services/apiClient.ts (1,889 lines)
- src/services/registryClient.ts (427 lines)
- src/services/opsFacadeClient.ts (596 lines)
- src/integrations/supabase/client.ts
- src/pages/Incidents.tsx, Receipts.tsx, ProviderCallLog.tsx
- src/pages/Approvals.tsx, Auth.tsx
- src/contexts/AuthContext.tsx
- src/components/opsdesk/ReleaseControl.tsx

## Verdict
CONDITIONAL PASS — No critical bypasses. 2 HIGH, 3 MEDIUM, 1 LOW.

## Key Enforcement Patterns Found

### Correct
1. apiClient.ts: zero write operations — pure SELECT. All errors on critical queries throw (fail closed).
2. Approval decisions route through opsFacadeClient → backend API → receipt generated server-side. Correct Law 7.
3. Supabase client uses anon key + session JWT → RLS enforces tenant isolation automatically.
4. No capability tokens in admin portal — correct, those are for orchestrator tool execution layer only.
5. Auth uses Supabase Edge Functions (admin-signup, admin-sign-in, auth-session) — not direct auth table writes.
6. Unavailable client proxy throws on all operations if env vars missing — fail closed.

### Gaps
1. HIGH (Law 2): registryClient.ts write receipts are client-side CustomEvents dispatched to window. They are NOT persisted to the Supabase receipts table. registry.create_draft, rollout.create, rollout.set_percentage, rollout.pause, config.propose_change — all write to production tables (agent_registry, config_rollouts, config_proposals) but produce only ephemeral window events as receipts.
2. HIGH (Law 9/PII): receipt payload, request_meta, response_meta displayed raw with no redaction in engineer mode across 5 pages. These fields can contain PII/secrets depending on what the backend stores.
3. MEDIUM (Law 3): fetchCustomers(), fetchSubscriptions(), fetchAutomationFailures(), fetchAutomationMetrics(), fetchBusinessMetrics(), fetchRunwayBurn(), fetchSkillPackRegistry() all soft-fail (devWarn + return empty) instead of throwing. UI shows empty/stale data without surfacing the error to the user.
4. MEDIUM (Law 2): Auth.tsx logAuthEvent() catch block silently swallows ALL errors — auth audit log writes can fail silently with no fallback.
5. MEDIUM (Law 1/Law 7): ReleaseControl.tsx L36 has hardcoded approval object: `{ status: 'approved', decisionReason: 'Auto-approved after tests' }`. When createdApprovalId is truthy, the component shows 'Approved' state and enables 'Launch Release' without any backend verification that the approval was actually granted. The approval status is not fetched from the backend.
6. LOW (Law 2): registryClient.ts uses `owner: 'current-user'` (hardcoded string) and `requested_by: 'current-user'` in INSERT payloads instead of the authenticated user's actual ID. Receipts/audit trail will have anonymous actor attribution.

## Why: The premium overhaul introduced the Agent Studio / Control Plane features (registryClient.ts) which added write capability to the portal. This is the source of the new gaps. The core observability pages (Incidents, Receipts, ProviderCallLog) remain clean.
