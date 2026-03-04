import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import bcrypt from "npm:bcryptjs@2.4.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    const { email, password } = await req.json();

    if (!email || !password) {
      return jsonResponse({ error: "Email and password are required" }, 400, correlationId);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const dbUrl = Deno.env.get("SUPABASE_DB_URL");
    const missingEnv = [
      !supabaseUrl ? "SUPABASE_URL" : null,
      !serviceRoleKey ? "SUPABASE_SERVICE_ROLE_KEY" : null,
      !dbUrl ? "SUPABASE_DB_URL" : null,
    ].filter(Boolean) as string[];
    if (missingEnv.length > 0) {
      console.error("admin-sign-in config error", { correlationId, missingEnv });
      return jsonResponse(
        { error: "Function misconfigured", code: "CONFIG_ERROR", missing_env: missingEnv },
        500,
        correlationId,
      );
    }
    const resolvedSupabaseUrl = supabaseUrl as string;
    const resolvedServiceRoleKey = serviceRoleKey as string;
    const resolvedDbUrl = dbUrl as string;

    // First try the normal password flow (in case email provider gets re-enabled)
    const normalResponse = await fetch(`${resolvedSupabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": resolvedServiceRoleKey,
        "Authorization": `Bearer ${resolvedServiceRoleKey}`,
      },
      body: JSON.stringify({ email, password }),
    });

    if (normalResponse.ok) {
      const sessionData = await normalResponse.json();
      return jsonResponse(sessionData as Record<string, unknown>, 200, correlationId);
    }

    const errData = await normalResponse.json().catch(() => ({}));
    
    // Only use fallback if email provider is disabled
    if (errData.error_code !== "email_provider_disabled") {
      return jsonResponse(
        { error: (errData as { message?: string }).message || "Invalid login credentials" },
        normalResponse.status,
        correlationId,
      );
    }

    // Fallback: verify password manually and generate a magic link session
    console.log("Email provider disabled, using admin fallback");

    const adminClient = createClient(resolvedSupabaseUrl, resolvedServiceRoleKey);

    // Find user by email
    const { data: usersData, error: listError } = await adminClient.auth.admin.listUsers();
    if (listError) {
      console.error("listUsers error:", { correlationId, listError });
      return jsonResponse({ error: "Authentication service error" }, 500, correlationId);
    }

    const targetUser = usersData.users.find((u: any) => u.email === email);
    if (!targetUser) {
      // Don't reveal user doesn't exist
      return jsonResponse({ error: "Invalid login credentials" }, 401, correlationId);
    }

    // Query encrypted_password from auth.users using direct DB connection
    const { default: postgres } = await import("https://deno.land/x/postgresjs@v3.4.5/mod.js");
    const sql = postgres(resolvedDbUrl);
    
    try {
      const rows = await sql`SELECT encrypted_password FROM auth.users WHERE id = ${targetUser.id}`;
      if (!rows.length || !rows[0].encrypted_password) {
        return jsonResponse({ error: "Invalid login credentials" }, 401, correlationId);
      }

      const passwordHash = rows[0].encrypted_password;
      const passwordValid = bcrypt.compareSync(password, passwordHash);
      
      if (!passwordValid) {
        return jsonResponse({ error: "Invalid login credentials" }, 401, correlationId);
      }
    } finally {
      await sql.end();
    }

    // Password verified! Generate a magic link to create a session
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

    if (linkError || !linkData) {
      console.error("generateLink error:", { correlationId, linkError });
      return jsonResponse({ error: "Could not generate session" }, 500, correlationId);
    }

    // Return the token hash so the client can verify it
    return jsonResponse(
      {
        type: "magiclink_fallback",
        token_hash: linkData.properties.hashed_token,
        email,
      },
      200,
      correlationId,
    );
  } catch (error) {
    console.error("admin-sign-in error:", { correlationId, error });
    return jsonResponse({ error: "Internal server error" }, 500, correlationId);
  }
});
