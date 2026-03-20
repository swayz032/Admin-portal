---
name: SSE Streaming Patterns
description: How SSE streaming works in the backend sse_manager.py
type: project
---

# SSE Pattern

## Module: `services/sse_manager.py`

### Key exports
- `redact_pii(text: str) -> str` — SSN, CC, email, phone redaction (Law #9)
- `format_sse_event(data: dict, event_type: str | None) -> str` — produces `data: {...}\n\n` string; auto-redacts `message` field
- `StreamRateLimiter` — token bucket, 10 events/sec per stream, `check() -> bool`
- `_ConnectionTracker` / `get_connection_tracker()` — singleton; `try_connect()`, `disconnect()`
- `build_stream_receipt(...)` — builds a receipt dict for SSE lifecycle events (stream.initiate, stream.complete, stream.error, stream.denied)

### SSE Event Wire Format (from frontend parsing in `AdminAvaChatContext.tsx`)
- `data: {"type": "delta", "content": "..."}\n\n` — streaming text chunk
- `data: {"type": "response", "content": "..."}\n\n` — also accepted as streaming text
- `data: {"type": "reasoning", "reasoning": "..."}\n\n` — reasoning text
- `data: {"type": "activity", "tool_calls": [...]}\n\n` — tool activity (updates thinking indicator)
- `data: {"type": "done", "receipt_id": "..."}\n\n` — completion with receipt
- `data: [DONE]\n\n` — SSE termination sentinel

### FastAPI StreamingResponse pattern
```python
return StreamingResponse(
    generator(),
    media_type="text/event-stream",
    headers={
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
        "X-Correlation-Id": correlation_id,
    },
)
```

### Note on `format_sse_event`
Only redacts the `message` field. For `content` field (LLM output), caller must call `redact_pii()` explicitly before placing in the dict.
