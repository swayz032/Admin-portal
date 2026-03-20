---
name: Admin Portal Page Patterns
description: Established UI patterns for Admin Portal pages — imports, layout structure, sidebar nav, component usage
type: project
---

## Page Layout Pattern (from Outbox.tsx, ProviderCallLog.tsx)
1. `page-header` div with `page-title` (h1) and `page-subtitle` (p) using `<ModeText>` for operator/engineer labels
2. `<PurposeStrip>` with operator/engineer purpose strings, variant="compact"
3. Optional `<SystemPipelineCard>` with highlighted step
4. Quick Stats: flex row of stat chips using `bg-surface-2 border border-border rounded-lg px-4 py-2`
5. Filters: `<Select>` dropdowns + `<Button variant="outline" size="sm">` for refresh
6. `<Panel>` wrapping `<DataTable>` with loading/empty/error states
7. `<Sheet>` drawer for detail view on row click

## Key Imports
- Supabase: `import { supabase } from '@/integrations/supabase/client'` (NOT `@/lib/supabase`)
- Data fetching: `import { listReceipts } from '@/services/apiClient'`
- Realtime: `import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'`
- Contract types: `import { Receipt as TrustReceipt, ReceiptStatus } from '@/contracts'`
- Formatters: `import { formatTimeAgo } from '@/lib/formatters'`
- System context: `import { useSystem } from '@/contexts/SystemContext'`

## useRealtimeSubscription Pattern
```tsx
const { data, loading, error, refetch } = useRealtimeSubscription<TrustReceipt>({
  table: 'receipts',
  events: ['INSERT', 'UPDATE'],
  fetcher: () => listReceipts(),
  getKey: (item) => item.id,
});
```
Returns `{ data: T[], count, loading, error, refetch, isRealtime }`.

## Sidebar Structure
- Nav items defined as arrays: `coreItems`, `operationsItems`, `platformItems`, `visibilityItems`, `businessControlItems`, `skillPackItems`
- Each item: `{ to, icon, label, engineerLabel? }`
- Groups rendered via `renderCollapsibleGroup(title, items, isOpen, setOpen)`
- Section headers: `<p className="px-3 text-[10px] font-medium text-muted-foreground/50 uppercase tracking-widest">`
- Collapsible state initialized from `location.pathname`

## Status Colors Convention
- success -> 'success' (green)
- pending -> 'warning' (yellow)
- failed/blocked -> 'critical' (red)
- info -> 'info' (blue)

## View Modes
- `viewMode === 'operator'`: simplified columns, friendly labels
- `viewMode === 'engineer'`: full detail columns (IDs, correlation IDs, payloads)

## App.tsx Route Pattern
- Lazy import at top
- Route wrapped in `<ProtectedRoute><AppLayout>...</AppLayout></ProtectedRoute>`

## Premium Overhaul Patterns (2026-03-17 Audit)
- CSS variables: HSL format, 3 surface tiers, glass/glow effects in index.css
- Premium IDs: INC-XXXX, RCP-XXXXXXXX, PCL-XXXXXXXX, TRC-XXXXXXXX via premiumIds.ts
- Loading: PageLoadingState (skeleton) is the gold standard; DataTable/Receipts/ProviderCallLog still use spinners
- Shared components: EmptyState (5 variants), PageLoadingState, SectionLoadingState, SourceBadge, OccurrenceBadge, StatusChip, SeverityBadge
- NOT shared yet: ProviderBadge (inline in ProviderCallLog.tsx), PremiumId cells (inline in 3 pages), copyToClipboard logic (duplicated 3x)

## Known Issues (from 2026-03-17 audit)
- P2 severity badge has text-black on blue — fails contrast in dark theme
- Receipts page swallows fetch errors silently (no error state)
- Incidents table is behind a Collapsible — filter sits above hidden content
- .dark CSS block duplicates :root (dead code)
- --shadow-premium token defined but never used

**Why:** Consistency across all admin portal pages. Every new page must follow this pattern.
**How to apply:** When creating new pages, copy the structure from Outbox.tsx/ProviderCallLog.tsx and adapt.
