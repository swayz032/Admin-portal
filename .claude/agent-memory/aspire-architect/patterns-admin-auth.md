---
name: Admin Auth Patterns
description: How admin JWT auth works in the Admin Portal and backend
type: project
---

# Admin Auth Pattern

## Frontend (Admin Portal)
- Token stored in `sessionStorage` under key `aspire_admin_token` (cleared on tab close)
- Suite ID stored in `localStorage` under key `aspire.admin.scope.suiteId`
- Helpers in `src/lib/adminAuth.ts`: `getAdminToken()`, `getSuiteId()`, `setAdminToken()`, `clearAdminToken()`
- `buildOpsHeaders()` in `src/services/opsFacadeClient.ts` constructs all standard headers
- `buildOpsFacadeUrl(path)` resolves URL against `OPS_BASE_URL` (from `VITE_OPS_FACADE_URL` env)

## Backend (`routes/admin.py`)
- `_require_admin(request)` — reads `x-admin-token` header, decodes JWT with `ASPIRE_ADMIN_JWT_SECRET`
- Returns `actor_id` (str) on success, `None` on failure (caller emits 401)
- Fail-closed: no secret configured = deny + incident registered
- `_get_correlation_id(request)` — reads `x-correlation-id` or generates UUID
- Admin token exchange: `POST /admin/auth/exchange` — Supabase token → short-lived admin JWT (1h)

## Existing Admin Endpoints Pattern
All guarded endpoints follow this pattern:
```python
actor_id = _require_admin(request)
if actor_id is None:
    return _ops_error(code="AUTH_REQUIRED", ..., status_code=401)
# emit access receipt
# do work
```

## Vite Proxy
`vite.config.ts` proxies `/api/*` → `OPS_BASE_URL` (stripping `/api` prefix).
Direct fetch to `OPS_BASE_URL` (via `buildOpsFacadeUrl`) bypasses the proxy entirely — preferred pattern for admin portal calls.
