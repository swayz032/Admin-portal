import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import bcrypt from "npm:bcryptjs@2.4.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Email and password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const dbUrl = Deno.env.get("SUPABASE_DB_URL")!;

    // First try the normal password flow (in case email provider gets re-enabled)
    const normalResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceRoleKey,
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ email, password }),
    });

    if (normalResponse.ok) {
      const sessionData = await normalResponse.json();
      return new Response(
        JSON.stringify(sessionData),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const errData = await normalResponse.json();
    
    // Only use fallback if email provider is disabled
    if (errData.error_code !== "email_provider_disabled") {
      return new Response(
        JSON.stringify({ error: errData.message || "Invalid login credentials" }),
        { status: normalResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fallback: verify password manually and generate a magic link session
    console.log("Email provider disabled, using admin fallback");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Find user by email
    const { data: usersData, error: listError } = await adminClient.auth.admin.listUsers();
    if (listError) {
      console.error("listUsers error:", listError);
      return new Response(
        JSON.stringify({ error: "Authentication service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const targetUser = usersData.users.find((u: any) => u.email === email);
    if (!targetUser) {
      // Don't reveal user doesn't exist
      return new Response(
        JSON.stringify({ error: "Invalid login credentials" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Query encrypted_password from auth.users using direct DB connection
    const { default: postgres } = await import("https://deno.land/x/postgresjs@v3.4.5/mod.js");
    const sql = postgres(dbUrl);
    
    try {
      const rows = await sql`SELECT encrypted_password FROM auth.users WHERE id = ${targetUser.id}`;
      if (!rows.length || !rows[0].encrypted_password) {
        return new Response(
          JSON.stringify({ error: "Invalid login credentials" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const passwordHash = rows[0].encrypted_password;
      const passwordValid = bcrypt.compareSync(password, passwordHash);
      
      if (!passwordValid) {
        return new Response(
          JSON.stringify({ error: "Invalid login credentials" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
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
      console.error("generateLink error:", linkError);
      return new Response(
        JSON.stringify({ error: "Could not generate session" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Return the token hash so the client can verify it
    return new Response(
      JSON.stringify({
        type: "magiclink_fallback",
        token_hash: linkData.properties.hashed_token,
        email,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("admin-sign-in error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
