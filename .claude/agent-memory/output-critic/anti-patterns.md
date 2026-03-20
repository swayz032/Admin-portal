---
name: Admin Portal Anti-Patterns
description: Recurring problems found in the Aspire Admin Portal codebase
type: project
---

## Confirmed Recurring Anti-Patterns

### 1. receipt_type not in contracts/index.ts Receipt interface
The `contracts/index.ts` Receipt type does NOT have a `receipt_type` field, but Receipts.tsx
dereferences `r.receipt_type` directly. This compiles only because the field arrives from the DB
row cast via `as unknown as TrustReceipt[]`. Any future strict mapping breaks this silently.

### 2. Unbounded client-side filtering after 500-row fetch
listReceipts() and listProviderCallLogs() both hard-limit at 500 rows. Filter state is maintained
client-side (useState). At scale, users see "filtered 3 matches" from a 500 row sample — not from
all data. This makes filters functionally incorrect at any volume > 500.

### 3. navigator.clipboard used without HTTPS/permissions guard
All three pages (Incidents, Receipts, ProviderCallLog) call navigator.clipboard.writeText() with no
try/catch and no check for clipboard API availability. Fails silently in HTTP contexts or browsers
denying clipboard permission.

### 4. PremiumId components defined inside render scope
PremiumId, PremiumReceiptId, PremiumCallId are React function components defined as const inside
the parent component body. They are re-created on every parent render, causing React to unmount/
remount them (losing tooltip state). They should be defined outside or memoized.

### 5. OccurrenceBadge uses CSS custom property `bg-warning/15` that requires Tailwind JIT
OccurrenceBadge references `bg-warning/15 text-warning` — `warning` is a custom CSS variable,
NOT a Tailwind color. Tailwind JIT cannot generate opacity variants for arbitrary CSS variables
without explicit configuration in tailwind.config. Must verify `bg-warning/15` actually works.

### 6. deriveSourceCategory() fallback is 'backend' — opaque catch-all
Unknown receipt types fall through to 'backend'. Production will have receipt types not in the
switch (e.g., `calendar.*`, `twilio.*`, `livekit.*`, `deploy`, `slo`, `entitlement`). All
silently become 'backend', misleading operators.

### 7. formatWorkflowId defined but never imported anywhere
premiumIds.ts exports formatWorkflowId but no page imports it. Dead export.

### 8. Incident status discrepancy: seed.ts Open/Resolved vs contracts Open/investigating/resolved/closed
The Incidents page uses seed.ts Incident type (Open | Resolved). Contracts have 4-state status.
The listIncidents() bridge function downcases to match contracts but the portal only renders
2 states. Filtering or automation against contract incidents would break.
