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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    if (!checkRateLimit(ip)) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnon = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;

    // User-scoped client to validate the token
    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;
    const email = user.email || "";

    // Service-role client for admin queries
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check allowlist
    const { data: allowlistEntry } = await adminClient
      .from("admin_allowlist")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    // Check roles
    const { data: roles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    // Get profile
    const { data: profile } = await adminClient
      .from("profiles")
      .select("display_name, email")
      .eq("user_id", userId)
      .maybeSingle();

    // Check MFA factors
    const { data: factorsData } = await adminClient.auth.admin.mfa.listFactors({ userId });
    const verifiedFactors = factorsData?.factors?.filter((f: any) => f.status === "verified") || [];
    const mfaEnabled = verifiedFactors.length > 0;

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

    const userRoles = roles?.map((r: any) => r.role) || [];
    const isAllowlisted = !!allowlistEntry;
    const isAdmin = userRoles.includes("admin");

    // Audit log
    await adminClient.from("audit_log").insert({
      user_id: userId,
      event: "session_check",
      details: { email, roles: userRoles, mfaVerified, isAllowlisted },
      ip_address: ip,
    });

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
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("auth-session error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
