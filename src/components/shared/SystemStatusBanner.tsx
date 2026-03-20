import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchOpsDashboardMetrics, fetchOpsSentrySummary } from "@/services/opsFacadeClient";

type SystemStatus = "healthy" | "degraded" | "critical";

const STATUS_CONFIG: Record<SystemStatus, {
  icon: typeof CheckCircle2;
  label: string;
  className: string;
}> = {
  healthy: {
    icon: CheckCircle2,
    label: "All Systems Operational",
    className: "bg-success/10 border-success/20 text-success",
  },
  degraded: {
    icon: AlertTriangle,
    label: "Degraded Performance",
    className: "bg-warning/10 border-warning/20 text-warning",
  },
  critical: {
    icon: XCircle,
    label: "System Issues Detected",
    className: "bg-destructive/10 border-destructive/20 text-destructive",
  },
};

const REFRESH_INTERVAL_MS = 30_000;

async function deriveStatusFromSupabase(): Promise<SystemStatus> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("receipts")
    .select("receipt_id", { count: "exact", head: true })
    .gte("created_at", since)
    .in("status", ["FAILED", "DENIED"]);

  if (error) {
    console.warn("[SystemStatusBanner] Supabase receipts query failed:", error.message);
    return "healthy";
  }

  const failCount = count ?? 0;
  if (failCount > 50) return "critical";
  if (failCount > 20) return "degraded";
  return "healthy";
}

async function fetchOpsStatus(): Promise<SystemStatus | null> {
  try {
    const response = await fetchOpsDashboardMetrics();
    return response.metrics.system_status;
  } catch {
    return null;
  }
}

async function fetchSentryStatus(): Promise<SystemStatus | null> {
  try {
    const response = await fetchOpsSentrySummary();
    if (!response.summary.configured) {
      return null;
    }
    if (response.summary.status === "healthy" || response.summary.status === "degraded" || response.summary.status === "critical") {
      return response.summary.status;
    }
    return null;
  } catch {
    return null;
  }
}

function pickWorseStatus(...statuses: Array<SystemStatus | null>): SystemStatus {
  const severity: Record<SystemStatus, number> = { healthy: 0, degraded: 1, critical: 2 };
  return statuses.reduce<SystemStatus>((current, candidate) => {
    if (!candidate) {
      return current;
    }
    return severity[candidate] > severity[current] ? candidate : current;
  }, "healthy");
}

export function SystemStatusBanner() {
  const [status, setStatus] = useState<SystemStatus>("healthy");
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    const [supabaseStatus, opsStatus, sentryStatus] = await Promise.all([
      deriveStatusFromSupabase(),
      fetchOpsStatus(),
      fetchSentryStatus(),
    ]);

    if (!mountedRef.current) return;

    setStatus(pickWorseStatus(supabaseStatus, opsStatus, sentryStatus));
    setLoading(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchStatus();

    intervalRef.current = setInterval(() => {
      if (mountedRef.current) fetchStatus();
    }, REFRESH_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchStatus]);

  if (loading) return null;

  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  if (status === "healthy") {
    return (
      <div
        className={cn(
          "flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-medium border-b",
          config.className,
        )}
      >
        <Icon className="h-3 w-3" />
        <span>{config.label}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium border-b",
        config.className,
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{config.label}</span>
    </div>
  );
}
