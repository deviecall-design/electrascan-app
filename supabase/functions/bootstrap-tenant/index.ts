import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  // Verify the caller is authenticated
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // Service-role client bypasses RLS for the bootstrap inserts
  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // User-scoped client to verify the JWT and get the caller's uid
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "invalid_token" }), {
      status: 401, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // Reject if this user already belongs to a tenant (idempotency guard)
  const { data: existing } = await serviceClient
    .from("tenant_memberships")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    return new Response(JSON.stringify({ tenantId: existing.tenant_id, alreadyExists: true }), {
      status: 200, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const body = await req.json().catch(() => ({}));
  const name: string = body.name?.trim();
  if (!name) {
    return new Response(JSON.stringify({ error: "name_required" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // 1. Create the tenant
  const { data: tenant, error: tenantError } = await serviceClient
    .from("tenants")
    .insert([{
      name,
      abn: body.abn ?? null,
      address: body.address ?? null,
      contact_email: body.contact_email ?? user.email ?? null,
      contact_phone: body.contact_phone ?? null,
    }])
    .select()
    .single();

  if (tenantError || !tenant) {
    console.error("tenant insert failed:", tenantError);
    return new Response(JSON.stringify({ error: "tenant_create_failed", detail: tenantError?.message }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // 2. Bootstrap the first owner membership
  const { error: memberError } = await serviceClient
    .from("tenant_memberships")
    .insert([{ tenant_id: tenant.id, user_id: user.id, role: "owner" }]);

  if (memberError) {
    // Roll back the tenant row to avoid orphans
    await serviceClient.from("tenants").delete().eq("id", tenant.id);
    console.error("membership insert failed:", memberError);
    return new Response(JSON.stringify({ error: "membership_create_failed", detail: memberError.message }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ tenantId: tenant.id, name: tenant.name }), {
    status: 201, headers: { ...CORS, "Content-Type": "application/json" },
  });
});
