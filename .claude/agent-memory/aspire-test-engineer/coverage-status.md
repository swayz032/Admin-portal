---
name: Admin Portal Test Coverage Status
description: Which modules have coverage, what is missing, gap areas for future waves
type: project
---

## Coverage as of Wave 7.4 (2026-03-15)

### Covered
- `src/services/registryClient.ts` — happy path + error paths (Wave 7.4)
- `src/hooks/useRealtimeCustomers.ts` — hook existence + mapCustomerRow contract (Wave 7.4)
- `src/hooks/useRealtimeApprovals.ts` — data contract (existing)
- `src/hooks/useRealtimeReceipts.ts` — data contract (existing)
- `src/hooks/useCouncilSession.ts` — full hook behavior (existing)
- `src/hooks/usePatchJob.ts` — full hook behavior (existing)
- `src/hooks/useProviderHealthStream.ts` — state machine (existing)
- `src/hooks/useRobotRun.ts` — (existing)
- `src/hooks/useUnifiedIncidents.ts` — dedup + sort + source tagging (existing)
- `src/lib/adminAuth.ts` — token read/write (existing)
- `src/lib/devLog.ts` — console guard (existing)
- `src/pages/control-plane/Registry.tsx` — contract tests (Wave 7.4)
- `src/pages/control-plane/Rollouts.tsx` — contract + safety mode tests (Wave 7.4)
- `src/contexts/AdminAvaChatContext.tsx` — (existing)
- `src/services/opsFacadeClient.ts` — error paths (existing)

### Not Covered (Gap Areas for Future Waves)
- `src/services/registryClient.ts` — createRollout(), setRolloutPercentage(), pauseRollout() success paths
- `src/services/apiClient.ts` — fetchCustomers and other fetchers
- `src/services/opsFacadeClient.ts` — happy path coverage
- `src/hooks/useRealtimeSubscription.ts` — INSERT/UPDATE/DELETE realtime event handling
- `src/pages/control-plane/Builder.tsx` — multi-step wizard contract
- `src/contexts/SystemContext.tsx` — viewMode, safetyMode state
- `src/components/control-plane/` — component rendering tests
- RLS evil tests — cross-tenant SELECT/INSERT/UPDATE (no DB-level tests exist)
- Capability token tests — not present in Admin Portal

## Test Count History
- Phase 5: 9 admin portal tests
- Enterprise Remediation Wave 8: test count maintained
- Wave 7.4: 260 tests across 22 files (+5 files, +120 tests)
