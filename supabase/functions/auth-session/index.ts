import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Content-Security-Policy": "frame-ancestors 'none'",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
};

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

function parseCsvEnv(name: string): string[] {
  const raw = Deno.env.get(name) || "";
  return raw
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  correlationId: string,
): Response {
  return new Response(JSON.stringify({ ...body, correlation_id: correlationId }), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "x-correlation-id": correlationId,
    },
  });
}

serve(async (req: Request) => {
  const correlationId = req.headers.get("x-correlation-id") || crypto.randomUUID();
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: { ...corsHeaders, "x-correlation-id": correlationId },
    });
  }

  try {
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    if (!checkRateLimit(ip)) {
      return jsonResponse({ error: "Rate limit exceeded" }, 429, correlationId);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401, correlationId);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseAnon = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");
    const missingEnv = [
      !supabaseUrl ? "SUPABASE_URL" : null,
      !supabaseServiceKey ? "SUPABASE_SERVICE_ROLE_KEY" : null,
      !supabaseAnon ? "SUPABASE_PUBLISHABLE_KEY|SUPABASE_ANON_KEY" : null,
    ].filter(Boolean) as string[];
    if (missingEnv.length > 0) {
      console.error("auth-session config error", { correlationId, missingEnv });
      return jsonResponse(
        { error: "Function misconfigured", code: "CONFIG_ERROR", missing_env: missingEnv },
        500,
        correlationId,
      );
    }
    const resolvedSupabaseUrl = supabaseUrl as string;
    const resolvedServiceRoleKey = supabaseServiceKey as string;
    const resolvedSupabaseAnon = supabaseAnon as string;

    // User-scoped client to validate the token
    const userClient = createClient(resolvedSupabaseUrl, resolvedSupabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      console.warn("auth-session invalid session", { correlationId, userError: userError?.message });
      return jsonResponse({ error: "Invalid session" }, 401, correlationId);
    }

    const userId = user.id;
    const email = user.email || "";

    // Service-role client for admin queries
    const adminClient = createClient(resolvedSupabaseUrl, resolvedServiceRoleKey);

    const bootstrapEmails = [
      ...parseCsvEnv("ASPIRE_ADMIN_BOOTSTRAP_EMAILS"),
      ...parseCsvEnv("ADMIN_BOOTSTRAP_EMAILS"),
    ];
    const isBootstrapAdmin = bootstrapEmails.includes(email.toLowerCase());

    // Check allowlist (degrades safely if table doesn't exist yet)
    let allowlistEntry: { id: string } | null = null;
    try {
      const { data } = await adminClient
        .from("admin_allowlist")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      allowlistEntry = data as { id: string } | null;
    } catch (tableErr) {
      console.warn("admin_allowlist lookup failed, using bootstrap fallback:", tableErr);
    }

    // Check roles (degrades safely if table doesn't exist yet)
    let roles: Array<{ role: string }> = [];
    try {
      const { data } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      roles = (data as Array<{ role: string }> | null) || [];
    } catch (tableErr) {
      console.warn("user_roles lookup failed, using JWT/bootstrap fallback:", tableErr);
    }

    // Get profile (degrades safely if table doesn't exist yet)
    let profile: { display_name?: string; email?: string } | null = null;
    try {
      const { data } = await adminClient
        .from("profiles")
        .select("display_name, email")
        .eq("user_id", userId)
        .maybeSingle();
      profile = data as { display_name?: string; email?: string } | null;
    } catch (tableErr) {
      console.warn("profiles lookup failed, using email fallback:", tableErr);
    }

    // Check MFA factors
    let mfaEnabled = false;
    try {
      const { data: factorsData } = await adminClient.auth.admin.mfa.listFactors({ userId });
      const verifiedFactors = factorsData?.factors?.filter((f: any) => f.status === "verified") || [];
      mfaEnabled = verifiedFactors.length > 0;
    } catch (mfaErr) {
      console.warn("MFA factor lookup failed:", mfaErr);
    }

    // Decode JWT to check AAL level (user.amr is not available from getUser())
    const token = authHeader.replace("Bearer ", "");
    let mfaVerified = false;
    try {
      const payloadBase64 = token.split(".")[1];
      const payload = JSON.parse(atob(payloadBase64));
      mfaVerified = payload.aal === "aal2" || (payload.amr || []).some((entry: any) => entry.method === "totp");
    } catch (e) {
      console.warn("JWT decode error:", e);
    }

    const roleFromJwt = (user as any)?.app_metadata?.role || (user as any)?.role || null;
    const userRoles = roles?.map((r: any) => r.role) || [];
    if (roleFromJwt && !userRoles.includes(roleFromJwt)) {
      userRoles.push(roleFromJwt);
    }
    const isAllowlisted = !!allowlistEntry || isBootstrapAdmin;
    const isAdmin = userRoles.includes("admin") || isBootstrapAdmin;

    // Audit log
    try {
      await adminClient.from("audit_log").insert({
        user_id: userId,
        event: "session_check",
        details: { email, roles: userRoles, mfaVerified, isAllowlisted, isBootstrapAdmin },
        ip_address: ip,
      });
    } catch (auditErr) {
      console.warn("audit_log insert skipped:", auditErr);
    }

    return new Response(
      JSON.stringify({
        user: {
          id: userId,
          email,
          displayName: profile?.display_name || email.split("@")[0],
        },
        roles: userRoles,
        isAllowlisted,
        isAdmin,
        mfaEnabled,
        mfaVerified,
        mfaVerifiedAt: mfaVerified ? new Date().toISOString() : null,
        correlation_id: correlationId,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "x-correlation-id": correlationId,
        },
      }
    );
  } catch (error) {
    console.error("auth-session error:", { correlationId, error });
    return jsonResponse({ error: "Internal server error" }, 500, correlationId);
  }
});
