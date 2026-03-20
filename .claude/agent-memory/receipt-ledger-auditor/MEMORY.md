# Receipt Ledger Auditor — Memory Index

## Audit History
- [2026-03-15 Full Audit](./2026-03-15-full-audit-findings.md) — Comprehensive 3-repo audit. 27 findings total (5 CRITICAL, 9 HIGH, 8 MEDIUM, 5 LOW). Overall: FAIL.
- [2026-03-17 Admin Portal Receipt Handling](./2026-03-17-admin-portal-audit.md) — Post-premium-overhaul focused audit. Key findings: `denied` lowercase status blind spot, n8n filter through-fall, raw payload rendered without DLP, DENIED excluded from ops error budget. See file for full findings.

## Key Patterns Found

### Receipt Infrastructure (Verified Working)
- Backend orchestrator: `receipt_write.py` + `receipt_chain.py` — SHA-256 chain with DLP redaction before hashing. Sound.
- Desktop server: Two receipt systems — `emitReceipt()` (inline SQL) and `createTrustSpineReceipt()` (receiptService.ts). Both write to `receipts` table.
- execute.py: Full deny receipts for capability token failure, idempotency, A2A dispatch failure, safe mode.
- resume.py: `_error()` helper emits receipt on ALL denial paths (validation, expiry, tenant mismatch, payload hash mismatch).

### Known Receipt Gaps (Confirmed)
1. `POST /api/auth/signup` — creates Supabase auth user, NO receipt (routes.ts:478)
2. `POST /api/authority-queue/:id/execute` — retry path, NO receipt emitted by desktop layer (routes.ts:3494)
3. Failure path of `POST /api/book/:slug/checkout` — no receipt on exception (routes.ts:1807)
4. `POST /api/book/:slug/confirm/:bookingId` — no failure receipt (routes.ts:1836)
5. `POST /api/pandadoc/:documentId/preview` — no receipt (routes.ts:5953)
6. Mail onboarding sub-steps missing receipts: `/dns/plan`, `/dns/check`, `/checks/run`, `/activate`, `/eli/policy/apply`
7. Google OAuth callback (`/api/mail/oauth/google/callback`) — stores tokens, no receipt (routes.ts:4907)

### Receipt Schema Issues (Confirmed)
- `createTrustSpineReceipt()` missing required fields: `risk_tier`, `tool_used`, `capability_token_id`, `approval_evidence`
- `emitReceipt()` (inline) missing: `receipt_hash`, `approval_evidence`, `capability_token_id`
- Legacy `PATCH /api/users/:userId` receipt (line 1314) writes to wrong columns (`action`, `result` as strings not jsonb, and includes non-existent `payload` column)
- Domain purchase approval (line 4814) uses raw `supabaseAdmin.from('receipts').insert()` bypassing all receipt services — missing `receipt_hash`, `tenant_id`

### Trace Chain Gaps (Confirmed)
- Gusto `fetchGustoPayrolls()` writes finance events with `receiptId: null` for each individual payroll (lines 246-254)
- Plaid `pullPlaidTransactionsSync()` writes finance events with `receiptId: null` for each tx (lines 213-295)
- `POST /api/authority-queue/:id/approve` receipt (line 3397) uses raw SQL bypassing chain computation
- `POST /api/authority-queue/:id/deny` receipt (line 3474) same issue

### Risk Tier Issues
- `POST /api/contracts/:id/send` — RED tier (PandaDoc external API, irreversible), classified as no explicit tier
- `POST /api/contracts/:id/void` — RED tier, no risk_tier in receipt
- Calendar receipts (create/update/delete) — no risk_tier field stored

### Receipt Immutability Status
- No UPDATE/DELETE on `receipts` table found — PASS
- `approval_requests` table has UPDATE (status field) — this is intentional state machine, NOT a receipt table

### PII/DLP Status
- Orchestrator: DLP applied systematically via Presidio before chain hash (PASS for YELLOW/RED)
- Desktop receiptService: `createTrustSpineReceipt()` has NO DLP integration — raw data passed through
- `emitReceipt()` has manual redaction for known PII fields but no systematic Presidio integration
- Booking checkout receipt (line 1787): `client_email: '<EMAIL_REDACTED>'` — manually redacted, correct
