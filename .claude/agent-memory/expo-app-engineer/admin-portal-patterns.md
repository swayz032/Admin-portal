---
name: Admin Portal Component Patterns
description: UI conventions, routing, shared components, and testing setup for the Aspire Admin Portal (React+Vite+TailwindCSS+shadcn)
type: project
---

## Stack
- React + Vite + TailwindCSS + shadcn/ui
- React Router DOM (BrowserRouter, not Expo Router)
- Vitest + jsdom + @testing-library/react
- @tanstack/react-query for server state
- Lucide React for icons

## Routing Pattern
- All routes in `src/App.tsx` using `<Routes>/<Route>`
- Pattern: `<ProtectedRoute><AppLayout><PageComponent /></AppLayout></ProtectedRoute>`
- Lazy loaded via `lazy(() => import(...))` with `<Suspense fallback={<PageLoader />}>`
- Control plane routes: `/control-plane/*`, `/agent-studio/*`

## Shared Components
- `Panel` — card wrapper with title, subtitle, action slot, collapsible support
- `StatusChip` — status badge with color variants: success/warning/critical/pending/neutral/info/healthy/at-risk
- `DataTable` — generic typed table with pagination, loading, empty states
- `EmptyState` — configurable empty/error/all-done state with icon, action buttons
- `PageHero` — page header with title, subtitle, status, icon, action slot
- `Badge` (shadcn) — rounded pill badge with variant support

## Styling Conventions
- TailwindCSS utility classes
- `cn()` from `@/lib/utils` for conditional classes
- Custom CSS classes: `panel`, `panel-header`, `panel-title`, `panel-content`, `data-table`, `status-chip`, `loading-state`, `empty-state`
- Color tokens: `text-foreground`, `text-muted-foreground`, `bg-card`, `bg-muted`, `text-success`, `text-destructive`, `text-warning`, `text-primary`
- Surface: `bg-surface-2` for nested sections

## Testing
- Vitest with `globals: true` (no explicit imports needed)
- Setup file: `src/test/setup.ts` (does not exist yet — referenced in config)
- Pattern: mock fetch globally, mock context providers, use `renderHook`/`waitFor`
- Hook tests mock `localStorage` for auth tokens

## Key Contexts
- `OpsDeskContext` — provides `currentPatchJob`, `patchDraftResult`, etc.
- `SystemContext` — provides `viewMode` ('operator' | 'engineer')
- `AuthContext`, `ScopeContext`

**Why:** Understanding these patterns prevents inconsistent implementations and speeds up future component work.
**How to apply:** Follow these conventions for all new Admin Portal components and routes.
