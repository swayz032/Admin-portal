---
name: 2026-03-17 Admin Portal Receipt Handling Audit
description: Full audit of Admin Portal receipt query integrity, dedup rules, immutability, trace linkage, PII risk, and perf after premium overhaul
type: project
---

# Admin Portal Receipt Handling Audit — 2026-03-17

## Status Coverage Gaps

**fetchIncidents() — apiClient.ts line 154**
- Covers: `failed`, `blocked`, `FAILED`, `BLOCKED`, `DENIED`
- Missing: `denied` (lowercase), `error`, `ERROR`, `PENDING` (would be wrong to include but worth noting)
- `denied` (lowercase) receipts from the orchestrator (see execute.py/resume.py which write `DENIED` uppercase) are captured. But `denied` lowercase is NOT in the list.
- Contract type ReceiptStatus (contracts/index.ts line 11) only defines `success | failed | blocked | pending` — `denied` is not even a valid contract status. This is a schema drift issue.

**fetchN8nIncidents() — apiClient.ts line 266**
- Covers: `FAILED`, `BLOCKED`, `DENIED` (uppercase only)
- Missing: `failed`, `blocked` (lowercase) — different from fetchIncidents() which covers both cases
- Also missing: `denied` (lowercase), `error`, `ERROR`

**Realtime subscription filter — useRealtimeIncidents.ts line 61**
- Filter: `status=in.(FAILED,BLOCKED,DENIED)` — uppercase only, no lowercase
- fetchIncidents() IS case-insensitive (covers both), but the realtime trigger only fires on uppercase
- This means a new lowercase-status receipt silently skips the live refresh but IS picked up on next page load

## Aggregation Fingerprint

fetchIncidents() fingerprint: `receipt_type::actionType::toolUsed::status`
- This is GOOD — 4-part key distinguishes same receipt_type with different tools
- One edge case: if `action.action_type` is null AND `action.tool_used` is null, all such receipts collapse to `<receipt_type>:::::<status>` regardless of what actually failed
- The `action` column is a jsonb field — if schema varies, some receipts may have neither field populated

## Dedup Rules — Filter Through-Fall

- Incidents page: `.not('receipt_type', 'like', 'n8n_%')` — catches n8n_ops, n8n_agent, n8n_webhook, n8n_anything
- N8n Operations page: `.or('receipt_type.eq.n8n_ops,receipt_type.eq.n8n_agent')` — ONLY catches n8n_ops and n8n_agent
- THROUGH-FALL: any receipt with receipt_type starting with `n8n_` but NOT `n8n_ops` or `n8n_agent` (e.g., `n8n_scheduler`, `n8n_trigger`, `n8n_webhook`) falls through BOTH filters and is invisible on both pages

## Receipt Immutability

- Confirmed: NO .update() or .delete() on `receipts` table in any .ts or .tsx file
- registryClient.ts has .update() on agent_registry and skill_pack_registry — not receipts
- useRealtimeReceipts listens only to `INSERT` events — correct
- PASS

## Payload Field (PII Risk)

- Receipts.tsx line 422: `{JSON.stringify(selectedReceipt.payload, null, 2)}` — raw payload rendered in engineer mode
- The `payload` field from the database is cast directly to `Record<string, unknown>` in contracts/index.ts
- No DLP/redaction applied to payload before display in the UI
- If the backend wrote unredacted data into `payload` (which our prior audit confirmed can happen for some receipt types), it will be visible to admin portal engineers
- The seed.ts Receipt type uses `redactedRequest`/`redactedResponse` fields (mapped from payload.redacted_inputs/outputs) — this mapping is correct IF the backend always uses those subkeys
- RISK: receipts written via raw `supabaseAdmin.from('receipts').insert()` (e.g., domain purchase approval, line 4814 of desktop routes.ts) may have unredacted content in payload

## stack_trace in Notes

- buildIncidentNotes() (apiClient.ts line 638): if `result.stack_trace` exists, it is appended to incident notes and displayed in the UI
- Stack traces may contain file paths, function names, internal infrastructure details — not PII but OPSEC concern
- No stripping/redaction of stack traces before display

## Trace Chain — correlation_id

- Receipts.tsx: uses `r.correlation_id` (snake_case, from contracts/index.ts Receipt.correlation_id) — correct
- TraceView.tsx: uses `correlationId` URL param, passes to `fetchOpsTrace(correlationId)` — correct
- mapReceiptRow (apiClient.ts line 698): maps `row.correlation_id` to camelCase `correlationId` for seed Receipt type
- listReceipts() (line 1738): filters by `correlation_id` snake_case — correct
- INCONSISTENCY: seed.ts Receipt uses `correlationId` (camelCase), contracts/index.ts Receipt uses `correlation_id` (snake_case). Two parallel type systems. Pages using Receipts.tsx use contracts Receipt (snake_case) correctly. Pages using the seed Receipt type would use camelCase. The filter in listReceipts() correctly uses snake_case for the DB query.

## listReceipts() Limit = 500

- Changed from 100 to 500 in premium overhaul
- With 17,074 receipts and no date filter, this returns the latest 500 rows
- The select is `*` (all columns including payload jsonb) — payload can be large
- No pagination beyond this — if you need receipt #501, you cannot get it without filters
- Performance concern: 500 * potentially large payload jsonb rows = significant data transfer
- The `count: exact` means Supabase still counts ALL 17,074 rows for the header — this is an extra full table scan
- Recommendation: add default date filter (e.g., last 7 days) or switch to cursor-based pagination

## Receipt Count Badge (Incidents page)

- DataTable `resultLabel="pipeline failures"` in Incidents.tsx line 243
- The count shown is `filteredIncidents.length` — number of AGGREGATED GROUPS, not raw receipts
- So "1,209 pipeline failures" means 1,209 distinct incident groups, NOT 1,209 raw receipt rows
- This is potentially misleading — each group has `occurrenceCount` field showing the real raw count
- The OccurrenceBadge component (line 122) shows per-row occurrence count — this is the actual raw count
- The header stat shows `openIncidents.length` (number of groups) — correct semantically for "issues to address" but misleading if operator thinks this is raw failure count

## fetchOpsMetrics() — DENIED not counted

- apiClient.ts line 1105: `failedToday` = receipts where status === 'failed' || status === 'blocked'
- `DENIED` status receipts are NOT included in `failedToday` for the ops metrics dashboard
- This means denied executions (governance blocks) are invisible in the error budget calculation

## N8n Filter Asymmetry Summary

| Page | Included | Excluded |
|------|----------|----------|
| Incidents | `receipt_type NOT LIKE 'n8n_%'` | all n8n types |
| N8n Operations | `receipt_type IN ('n8n_ops','n8n_agent')` | all non-n8n types |
| Through-fall zone | nothing catches `n8n_scheduler`, `n8n_trigger`, `n8n_webhook`, etc. | invisible |
