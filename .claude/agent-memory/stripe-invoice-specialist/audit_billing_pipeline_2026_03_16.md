---
name: Billing Pipeline Gap Analysis
description: 31-gap audit of Quinn skill pack + Stripe client + webhook handlers + Desktop routes — P0 issues include float currency, no tenant isolation on Desktop, in-memory webhook dedup
type: project
---

Completed read-only audit of 7 files in the billing pipeline on 2026-03-16. Found 31 gaps (6 P0, 12 P1, 7 P2, 6 P3).

**Critical findings:**
- Desktop stripeConnectRoutes.ts has NO `stripeAccount` scoping — all calls hit platform account (GAP-03/04)
- `Math.round(item.amount * 100)` float-to-cents conversion at 3 places in Desktop (GAP-01/02)
- Backend ignores `line_items` payload; only creates single lump-sum invoiceitem (GAP-12)
- Desktop quote update loop overwrites line items on each iteration (GAP-14)
- `execute_stripe_quote_send` actually ACCEPTS the quote, not sends it (GAP-18)
- `auto_advance` not set to false in backend invoice creation (GAP-19)
- No metadata (suite_id, etc.) on Desktop-created Stripe objects (GAP-20)
- Global `connectedAccountId` variable = single-tenant only (GAP-24)

**What works well:**
- Backend base_client.py has solid retry, circuit breaker, idempotency key generation
- Backend stripe_webhook.py has proper signature verification + receipt emission
- Quinn skill pack has thorough binding field validation + receipt for every outcome
- Desktop finance webhook has DB-level dedup via ON CONFLICT

**Why:** Tracks production readiness gaps before going live with client billing.
**How to apply:** Reference this when planning billing pipeline remediation waves.
