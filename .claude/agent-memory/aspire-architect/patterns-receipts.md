---
name: Receipt Patterns
description: How receipts are structured and stored across the backend
type: project
---

# Receipt Pattern

## Module: `services/receipt_store.py`

### Public API
- `store_receipts(receipts: list[dict]) -> None` — non-blocking, in-memory + async Supabase. For GREEN tier.
- `store_receipts_strict(receipts: list[dict]) -> None` — blocking, fail-closed. For YELLOW/RED tier.
- `query_receipts(...)` — filter receipts from in-memory store.
- `clear_store()` — test use only.

### Receipt Shape (minimum required fields)
```python
{
    "id": str(uuid.uuid4()),              # unique receipt ID
    "correlation_id": str,               # request correlation ID
    "suite_id": str,                     # tenant ID (use "admin" or actor's suite_id)
    "office_id": str,                    # office ID ("admin_portal")
    "actor_type": "human" | "system",
    "actor_id": str,                     # actor_id from JWT
    "action_type": str,                  # e.g. "admin.chat.request"
    "risk_tier": "green" | "yellow" | "red",
    "tool_used": str,                    # e.g. "ava_admin_chat"
    "outcome": "SUCCEEDED" | "FAILED" | "DENIED" | "PENDING",
    "created_at": datetime.now(timezone.utc).isoformat(),
    "receipt_type": str,                 # e.g. "admin_chat"
    # optional:
    "reason_code": str | None,
    "details": dict | None,
}
```

### Important: `status` CHECK constraint
Receipts table in Supabase only allows: `PENDING`, `SUCCEEDED`, `FAILED`, `DENIED`.
NOT `SKIPPED` or anything else. Map all outcomes to one of these four.

### Law #2 Coverage
- Every endpoint access generates a receipt (even reads).
- Streaming endpoint: receipt at initiation (PENDING), receipt at completion (SUCCEEDED or FAILED/DENIED).
- Two receipts per chat request: one for the initiation, one for completion.
