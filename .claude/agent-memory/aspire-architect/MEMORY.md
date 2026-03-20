# Aspire Architect Memory

## Codebase Structure

- **Admin Portal** (`Aspire-Admin-Portal/`): Vite + React + TypeScript, port 8080
- **Backend Orchestrator** (`backend/orchestrator/`): Python FastAPI, port 8000
  - Source root: `src/aspire_orchestrator/`
  - Tests: `tests/` (pytest, FastAPI TestClient)
  - Pyproject: `pyproject.toml`

## Key Pattern References

- [Admin Auth Pattern](patterns-admin-auth.md) — token storage, header names, `_require_admin()`
- [SSE Pattern](patterns-sse.md) — `sse_manager.py`, `StreamRateLimiter`, `format_sse_event`, `redact_pii`
- [OpenAI Client Pattern](patterns-openai.md) — `AsyncOpenAI`, circuit breaker, `resolve_openai_api_key()`, `settings.ava_llm_model`
- [Receipt Pattern](patterns-receipts.md) — `store_receipts()`, receipt shape, Law #2

## Investigation Log

- 2026-03-17: Investigated Admin Ava Chat → LLM streaming endpoint plan
