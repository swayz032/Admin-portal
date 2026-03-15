# Aspire Admin Portal — Incident Runbook

## Service Overview

| Property | Value |
|----------|-------|
| Service | aspire-admin-portal (Vite + React + TypeScript) |
| Type | Static SPA (served via Railway or CDN) |
| Dev port | 8080 (vite dev server) |
| Build command | `vite build` |
| Backend dependency | Backend orchestrator at `VITE_OPS_FACADE_URL` (default: http://localhost:8000) |
| Supabase client | `src/integrations/supabase/client.ts` |
| Auth | `src/lib/adminAuth.ts` — admin JWT in sessionStorage + localStorage fallback |
| Ops client | `src/services/opsFacadeClient.ts` — calls `/admin/ops/*` |
| Deployment | Railway (`swayz032/Admin-portal`) |

## Environment Variables Required

| Variable | Purpose | Failure if Missing |
|----------|---------|-------------------|
| `VITE_SUPABASE_URL` | Supabase project URL | Auth unusable; `window.__ASPIRE_CONFIG_ERROR__` set |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key | Auth unusable |
| `VITE_OPS_FACADE_URL` | Backend orchestrator URL | Falls back to `http://localhost:8000` |
| `VITE_API_BASE_URL` | Secondary API base URL fallback | Falls back to `http://localhost:8000` |

## Quick Diagnosis

```bash
# Check if build artifacts exist
ls dist/

# Check Vite build output for errors
pnpm build 2>&1 | tail -30

# Check environment variable availability at runtime
# In browser console:
import.meta.env.VITE_SUPABASE_URL
window.__ASPIRE_CONFIG_ERROR__   # Set if env vars are missing

# Test ops facade reachability from the portal's perspective
curl -s http://localhost:8000/admin/ops/health | jq .

# Railway production
railway logs --service aspire-admin-portal --tail 50
```

---

## Failure Mode 1: Vite Build Failures

### Symptoms
- Railway deploy fails with build error
- `pnpm build` exits non-zero
- Deployment is stuck on "Building" status
- Users see the old version or a blank page

### Diagnosis

```bash
# 1. Run build locally to reproduce
cd /mnt/c/Users/tonio/Projects/myapp/Aspire-Admin-Portal
pnpm install
pnpm build 2>&1

# 2. Check for TypeScript type errors
pnpm tsc --noEmit 2>&1 | head -50

# 3. Check chunk size warnings (limit is 900kB per vite.config.ts)
pnpm build 2>&1 | grep "chunk"

# 4. Check Railway build logs
railway logs --service aspire-admin-portal --deployment <deploy-id>
```

### Common Build Failure Causes

| Cause | Symptom | Fix |
|-------|---------|-----|
| TypeScript error | `error TS2345` or similar | Fix the type error; strict typing enforced per Law #5 |
| Missing package | `Cannot find module` | `pnpm install` then rebuild |
| Env var used at build time | `VITE_*` vars not injected | Set `VITE_*` vars in Railway service config before deploy |
| Chunk too large | `Warning: chunk too large` | Add to `manualChunks` in vite.config.ts |
| Circular import | Build hangs or infinite recursion | Use `madge` to detect cycles: `pnpm dlx madge --circular src/` |

### Resolution

```bash
# Fix locally, push to GitHub, Railway auto-deploys on main push
git add .
git commit -m "fix: resolve build failure"
git push origin main

# Force Railway redeploy if build passed locally but Railway is stale
railway redeploy --service aspire-admin-portal
```

### Escalation
- P2: Admin portal unavailable, but backend and desktop are healthy. Users can still use desktop.

---

## Failure Mode 2: Supabase Connection Issues

### Symptoms
- Admin portal shows blank content or auth loop
- Browser console: `[ASPIRE_CONFIG] Supabase client unavailable`
- `window.__ASPIRE_CONFIG_ERROR__` is set with missing env names
- Login page fails to submit or returns no response

### Diagnosis

```bash
# 1. Check if env vars are baked into the build
# VITE_* vars are embedded at BUILD TIME, not runtime
# A missing VITE_SUPABASE_URL means the Railway build environment is missing it

# 2. Verify in Railway
railway variables --service aspire-admin-portal | grep VITE_SUPABASE

# 3. Check browser console
# window.__ASPIRE_CONFIG_ERROR__ will show which vars are missing

# 4. Check Supabase project status
# https://status.supabase.com
# https://supabase.com/dashboard/project/qtuehjqlcmfcascqjjhc

# 5. Check Realtime subscription health (useRealtimeApprovals, useRealtimeReceipts)
# These hooks use the Supabase Realtime channel
# Disconnect events appear in browser console as WebSocket close codes
```

### Resolution

```bash
# 1. If env vars are missing from Railway build environment:
railway variables set VITE_SUPABASE_URL=<url> VITE_SUPABASE_PUBLISHABLE_KEY=<anon-key>
# IMPORTANT: VITE_* vars require a full rebuild to take effect
railway redeploy --service aspire-admin-portal

# 2. If Supabase is having a provider incident:
# Portal will fail to authenticate — this is correct fail-closed behavior (Law #3)
# Inform users via status page
# Monitor: https://status.supabase.com

# 3. If Realtime subscriptions are disconnecting:
# These auto-reconnect via useRealtimeSubscription hook
# Check browser console for persistent disconnect loops
# Temporary workaround: Refresh the page to re-establish Realtime channel
```

### Escalation
- P1 if auth is broken in production: All admin users locked out.

---

## Failure Mode 3: opsFacadeClient Errors (Backend Unreachable)

### Symptoms
- Admin portal pages show empty tables or loading spinners that never resolve
- Browser console: `OpsFacadeError: HTTP 503` or `Failed to fetch`
- `fetchOpsHealth()` returns false — `isOpsFacadeAvailable()` check fails
- CORS errors from backend

### Diagnosis

```bash
# 1. Test ops facade health directly
curl -s http://localhost:8000/admin/ops/health | jq .

# 2. Check VITE_OPS_FACADE_URL is pointing to the right endpoint
# Local dev: http://localhost:8000
# Production: Railway internal URL or https://www.aspireos.app

# 3. Check CORS configuration on the backend
# ASPIRE_CORS_ORIGINS must include the admin portal origin
curl -s http://localhost:8000/readyz | jq .  # If this returns CORS error, origins misconfigured

# 4. Check Railway networking
# Admin portal -> Backend: may need Railway private networking or public URL
```

### Resolution

```bash
# 1. Fix backend connectivity (see backend runbook.md)

# 2. If CORS is blocking:
# Set ASPIRE_CORS_ORIGINS on the backend to include the admin portal URL
# Example: "https://admin.aspireos.app,http://localhost:8080"
railway variables set ASPIRE_CORS_ORIGINS="<origins>" --service aspire-backend
railway redeploy --service aspire-backend

# 3. If VITE_OPS_FACADE_URL points to wrong endpoint:
# Set the correct URL and trigger a rebuild
railway variables set VITE_OPS_FACADE_URL=<correct-url>
railway redeploy --service aspire-admin-portal
```

### Escalation
- P2: Admin visibility is degraded. Backend and desktop may still be functioning.

---

## Failure Mode 4: Auth Token Exchange Failures

### Symptoms
- Admin portal shows "Authentication required" on every page load
- `exchangeAdminToken()` returning 401 or 403
- `POST /admin/auth/exchange` fails
- Admin JWT not stored in sessionStorage

### Diagnosis

```bash
# 1. Test the token exchange endpoint directly
curl -s -X POST http://localhost:8000/admin/auth/exchange \
  -H "Authorization: Bearer <supabase-access-token>" \
  -H "Content-Type: application/json" | jq .

# 2. Check ASPIRE_ADMIN_JWT_SECRET is set on backend
railway variables --service aspire-backend | grep ASPIRE_ADMIN_JWT_SECRET

# 3. Check if the Supabase user has admin role in the database
# Query: SELECT * FROM admin_users WHERE user_id = '<uid>';

# 4. Check browser storage (developer tools -> Application -> Storage)
# Token key: 'aspire_admin_token' (sessionStorage primary, localStorage fallback)
# Suite key: 'aspire.admin.scope.suiteId' (localStorage)

# 5. Token TTL: Admin JWTs expire. The portal should re-exchange on 401
# Check that the auto-refresh logic in the portal is functioning
```

### Resolution

```bash
# 1. Clear browser storage and re-login
# Developer Tools -> Application -> Clear Site Data

# 2. If ASPIRE_ADMIN_JWT_SECRET is missing or wrong:
railway variables set ASPIRE_ADMIN_JWT_SECRET=<32-char-secret> --service aspire-backend
railway redeploy --service aspire-backend

# 3. If user is missing from admin_users table:
# Add via Supabase dashboard: INSERT INTO admin_users (user_id, role) VALUES ('<uid>', 'admin');

# 4. If Supabase token expired: User must re-login to Supabase to get a fresh access token
```

### Escalation
- P1 if no admin users can authenticate: All admin operations blocked.

---

## Failure Mode 5: Realtime Subscription Disconnects

### Symptoms
- Approval queue not updating in real-time (stale data)
- Receipt feed not refreshing automatically
- Incident list not showing new items without manual page refresh
- Browser console: WebSocket close codes (1006 = abnormal closure, 1001 = going away)

### Diagnosis

```bash
# 1. Check browser console for Supabase Realtime errors
# Look for: "Subscribed to channel" vs "Channel closed" messages

# 2. Verify Supabase Realtime is enabled for affected tables
# Supabase dashboard -> Database -> Replication -> check receipts, approval_requests, incidents tables

# 3. Check if RLS policies allow Realtime subscriptions
# Realtime respects RLS — if RLS denies, subscription silently gets no events
# Verify: SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

# 4. Check useRealtimeApprovals.ts — it uses dual-path: Realtime primary + 30s polling fallback
# If Realtime is down, polling should keep data fresh every 30 seconds
```

### Resolution

```bash
# 1. Realtime auto-reconnects via useRealtimeSubscription hook
# Wait 30 seconds — the 30s polling fallback should keep the queue current

# 2. If persistent disconnects: Hard refresh the page (Ctrl+Shift+R)

# 3. If Supabase Realtime is down at the provider level:
# The 30s polling fallback in useRealtimeApprovals keeps the approval queue functional
# No admin action needed beyond monitoring

# 4. If RLS is incorrectly blocking Realtime events:
# Review RLS policies on affected tables in Supabase dashboard
# Check migration 074 (approval_requests RLS) for policy correctness
```

### Escalation
- P3: Realtime is a UX enhancement. Polling fallback ensures functional correctness. Monitor for persistent disconnects.

---

## Admin Token Storage Model

Per `src/lib/adminAuth.ts`:
- Primary storage: `sessionStorage` (key: `aspire_admin_token`) — cleared on tab close
- Fallback storage: `localStorage` (same key) — for SSE hooks that read synchronously
- Suite ID: `localStorage` only (key: `aspire.admin.scope.suiteId`)

If users report being logged out unexpectedly, `sessionStorage` clearing on tab close is by design — security feature, not a bug.
