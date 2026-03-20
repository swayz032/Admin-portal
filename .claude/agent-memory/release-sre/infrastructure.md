---
name: Aspire infrastructure and observability configuration
description: Real ports, deployment configuration, Prometheus/Grafana setup, known gaps
type: project
---

## Prometheus / Grafana Stack

- Config location: `backend/infrastructure/docker/otel/` (NOT `prometheus/`)
- `docker-compose.observability.yml` mounts `otel/` paths — this is the active compose
- Prometheus runs on port 9090, scrapes `otel-collector:8889`
- Grafana runs on port 3000, provisioning at `otel/grafana-provisioning/`
- Wave 8.4 created `prometheus/alert_rules.yml` and `prometheus/prometheus.yml` — THESE ARE NOT MOUNTED
- To activate Wave 8.4 alerts: merge into `otel/alert_rules.yml` or update compose to use new directory
- **No Alertmanager is deployed** — alerts fire in Prometheus but reach no one
- Alert rule groups in `otel/alert_rules.yml`: `aspire-alerts` (OutboxQueueStuck, ApprovalLatencyHigh)
- Wave 8.4 adds: `aspire_critical`, `aspire_slo_burn`, `aspire_availability`, `aspire_governance`

## Existing Operational Documents (as of 2026-03-15)

backend/docs/operations/:
- orchestrator-runbook.md — failure modes 1-4 (signing key, DLP, safety gate, CORS)
- rollback-procedure.md — git revert + config rollback for backend only
- postmortem-template.md — full template with Laws Affected table
- incident_response.md — 6-step IR (mitigate, trace, export, replay, fix, postmortem)
- kill_switch.md — ENABLED/APPROVAL_ONLY/DISABLED modes, API: POST /admin/kill-switch
- load-test-report.md — script validated 2026-02-13, LIVE SOAK NEVER EXECUTED
- SLI_SLO.md — SLOs for backend, desktop, admin portal + external provider timeouts

Wave 8.5 added (2026-03-15):
- backend/docs/operations/runbook.md — 5 failure modes: orchestrator, supabase, redis, openai, receipts
- Aspire-desktop/docs/operations/runbook.md — 5 failure modes: crash, backend proxy, stripe, supabase, memory
- Aspire-Admin-Portal/docs/operations/runbook.md — 5 failure modes: vite build, supabase, ops facade, auth, realtime
- docs/operations/postmortem-template.md — consolidated postmortem at workspace root
- docs/operations/rollback-procedure.md — all 3 services, Railway commands
- docs/operations/backup-restore.md — Supabase PITR, pg_dump, RLS verification post-restore
