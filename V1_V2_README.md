# Aspire-Admin-Portal/ — V1 vs V2 Quick Map

> Pair with `myapp/docs/Aspire-System-Map-v2.md` (full map) and `myapp/.claude/workspace.json` (registry).

**The axis:** V1 vs V2 in Aspire is whether LangGraph is the brain. Most of this repo is `[shared]` admin tooling — it does not host frontstage agents.

## Top-level directories

| Directory | Status | Purpose |
|-----------|--------|---------|
| `src/` | `[shared]` | Vite + React admin app. |
| `public/` | `[shared]` | Static assets. |
| `scripts/` | `[shared]` | Deploy scripts. |
| `supabase/` | `[shared]` | **Separate Supabase project** `qtuehjqlcmfcascqjjhc`. Admin profiles + user roles only. NOT the platform DB. |
| `types/` | `[shared]` | TypeScript type definitions. |
| `docs/` | `[shared]` | Admin-portal docs. |

## Supabase note (cross-repo sync)

This repo has its own Supabase project (`qtuehjqlcmfcascqjjhc` at `https://qtuehjqlcmfcascqjjhc.supabase.co`) for admin auth and user roles. The **platform DB** (the one orchestrator + gateway use) lives in `myapp/backend/supabase/` and uses a different project. **These are intentionally separate.** Do not consolidate.

## V1 / V2 surfaces

This repo does not host V1 ElevenLabs agents or V2 Anam personas directly. It consumes data from both Supabase projects and surfaces admin UI for:

- Approval queues (V2 governance)
- Receipt audits (V2 hash chain)
- Tenant management (RLS-aware)

Edge functions: `admin-sign-in`, `auth-session`.
