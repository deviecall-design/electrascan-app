import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _server: SupabaseClient | null = null;
let _service: SupabaseClient | null = null;

export function getSupabaseServer(): SupabaseClient {
  if (_server) return _server;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    // Return a client that will fail gracefully; pages handle the error.
    return createClient("http://localhost", "missing", { auth: { persistSession: false } });
  }
  _server = createClient(url, key, { auth: { persistSession: false } });
  return _server;
}

export function getSupabaseService(): SupabaseClient {
  if (_service) return _service;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service credentials missing");
  _service = createClient(url, key, { auth: { persistSession: false } });
  return _service;
}
