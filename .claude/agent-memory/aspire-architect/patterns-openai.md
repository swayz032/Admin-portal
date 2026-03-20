---
name: OpenAI Client Patterns
description: How to use the shared OpenAI client for streaming and non-streaming calls
type: project
---

# OpenAI Client Pattern

## Module: `services/openai_client.py`

### Key exports
- `_get_or_create_async_client(api_key, base_url, timeout) -> AsyncOpenAI` — cached singleton
- `generate_text_async(model, messages, api_key, ...)` — non-streaming, with circuit breaker, LLM cache, fallback, token tracking
- `OpenAIAdapterError(reason_code, message)` — normalized error
- `_openai_circuit_breaker` — module-level circuit breaker (5 failures → OPEN, 30s cooldown)
- `_is_reasoning_model(model)` — True for gpt-5*, o1, o3 (affects role/temp)

### For streaming: Do NOT use `generate_text_async`
Use `_get_or_create_async_client()` directly and call `.chat.completions.create(stream=True)`.
The Responses API (`client.responses.create`) does not have a streaming-friendly interface for SSE forwarding.

### Settings
- `settings.ava_llm_model` — "gpt-5-mini" (dev) or "gpt-5.2" (prod)
- `settings.openai_base_url` — "https://api.openai.com/v1"
- `resolve_openai_api_key()` — resolves from OPENAI_API_KEY > ASPIRE_OPENAI_API_KEY > settings.openai_api_key

### Circuit Breaker
`_openai_circuit_breaker.allow_request()` — check before making any call.
`_openai_circuit_breaker.record_success()` / `record_failure()` — update after call completes.
For new streaming endpoint: replicate this pattern inline (do not bypass).
