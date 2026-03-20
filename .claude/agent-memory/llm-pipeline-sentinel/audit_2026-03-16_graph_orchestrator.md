---
name: Pipeline Audit 2026-03-16 — Deep Production Readiness
description: Two-pass deep audit of 13-node orchestrator, agent persona system, template kit. P0 _deny_execution bug STILL OPEN. New P1: persona map divergence between agent_reason.py and respond.py. 14 pass items verified.
type: project
---

## Audit History

### Pass 2 (2026-03-16, deep audit)

**P0 Bug STILL OPEN:** `execute.py:184/200/220` calls `_deny_execution()` BEFORE the nested function is defined at line 230. Triggers `NameError` when Eli quality/deliverability gate rejects. Fix: move `def _deny_execution` above line 181.

**NEW P1 — Persona Map Divergence:** `agent_reason.py:43-63` uses `finn_finance_manager_system_prompt.md`, `eli_inbox_system_prompt.md`, etc. `respond.py:488-503` uses `finn_fm_system_prompt.md`, `eli_system_prompt.md`, etc. Both file sets exist on disk. Same agent speaks with different persona in conversation vs action path. Fix: unify to shared map in `services/agent_identity.py`.

**P1 Warnings (carried from Pass 1):**
- `openai_client.py:43-58` — Timeout not in AsyncOpenAI cache key
- `tool_executor.py:806-846` — No `asyncio.wait_for()` wrapper on tool execution
- `graph.py:367-401` — Eli tweak rescue path lacks session context check

**Strengths Verified (14 pass items):**
- Graph topology: 13 nodes fully connected, no orphans, no dead ends, QA retry bounded at 1
- Receipt coverage: genuinely 100% with respond node safety net
- Capability tokens: HMAC-SHA256, TTL<60s, 6-check validation, fail-closed on missing key
- Tenant isolation: auth-derived suite_id, hard deny on missing actor_id
- Agent persona warmth: formal greetings (Mr./Ms. LastName), channel-aware length, identity drift protection, phantom action stripping
- Dual-path routing: robust classification -> action vs conversation, advisory force-route, never dead-ends
- Money movement block: comprehensive NL + action prefix + context token detection with exclusion list
- Approval system: payload hash binding, anti-replay, presence tokens, PII redaction on drafts
- Respond node: narration layer (deterministic) + LLM persona summary + output guard, verbosity by channel
- Behavior contract: 11-section reference document, SORN format for chat, natural governance language
- Template kit: 8 files + 13-step checklist + one-command scaffold
- Safety gate: receipt on pass/block/error, fail-closed
- Param extraction: domain-specific recovery (email, conference, office), tweak loop, agentic Eli RAG
- DLP: redaction before chain hashing, fail-closed for YELLOW/RED tier

**How to apply:** The _deny_execution bug and persona divergence are the only blockers. All other pipeline components are production-grade. The persona divergence is cosmetic in most cases (both persona file sets contain similar content) but violates the single-source-of-truth principle.
