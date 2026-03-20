---
name: Spec Interpretations
description: Decisions made during code review about how specs are interpreted in the portal
type: project
---

## Premium ID Spec
- IDs are display-only; the raw UUID is the actual key everywhere
- formatIncidentId(index) is based on array position after filter — index is unstable across page reloads
- RCP- prefix uses first 8 chars of UUID; collision risk is low but non-zero across large receipt volumes

## DataTable Pagination Spec
- DataTable has a pagination prop but none of the 3 new pages use it
- All 3 pages pass full filtered datasets to DataTable, relying on maxHeight (600px) for scroll
- This is the intended design for now; pagination is opt-in

## deriveSourceCategory Spec
- Source categorization is best-effort / heuristic, not authoritative
- 'backend' is the documented fallback for unknown receipt types
- The 6 categories (backend/desktop/n8n/provider/orchestrator/security) are the approved taxonomy
