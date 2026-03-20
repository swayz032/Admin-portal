---
name: Admin Portal Testing Infrastructure
description: Vitest config, setup file, path aliases, test runner command for the Admin Portal
type: project
---

## Test Runner
- Framework: Vitest v3.2.4
- Environment: jsdom
- Config: `vitest.config.ts` at repo root
- Setup file: `src/test/setup.ts` (imports @testing-library/jest-dom, stubs matchMedia)
- Path alias: `@` → `src/`
- Test glob: `src/**/*.{test,spec}.{ts,tsx}`

## Run Command
```
npx vitest run                          # full suite
npx vitest run --reporter=verbose       # verbose output
npx vitest run src/services/registryClient.test.ts   # targeted
```

## Test File Count (as of Wave 7.4)
22 test files total. Starting count was 17, target was 20+.
New files added in Wave 7.4:
- src/services/registryClient.test.ts
- src/services/registryClient-errors.test.ts
- src/hooks/useRealtimeCustomers.test.ts
- src/pages/control-plane/Registry.test.ts
- src/pages/control-plane/Rollouts.test.ts

## Known Pre-existing Test Files
- src/test/example.test.ts
- src/lib/devLog.test.ts
- src/lib/adminAuth.test.ts
- src/contexts/AdminAvaChatContext.test.tsx
- src/hooks/useCouncilSession.test.ts
- src/hooks/usePatchJob.test.ts
- src/hooks/useProviderHealthStream.test.ts
- src/hooks/useRobotRun.test.ts
- src/hooks/useUnifiedIncidents.test.ts
- src/hooks/useRealtimeApprovals.test.ts
- src/hooks/useRealtimeReceipts.test.ts
- src/hooks/useOpsStreamContracts.test.ts
- src/services/opsFacadeClient-errors.test.ts
