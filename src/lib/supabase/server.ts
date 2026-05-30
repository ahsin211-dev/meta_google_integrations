import { createClient, SupabaseClient } from "@supabase/supabase-js";

let serviceRoleClient: SupabaseClient | null = null;

export function createServiceRoleClient(): SupabaseClient {
  if (serviceRoleClient) {
    return serviceRoleClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase service role configuration is missing");
  }

  serviceRoleClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return serviceRoleClient;
}

export function createAnonServerClient(accessToken?: string): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Supabase anon configuration is missing");
  }

  return createClient(url, key, {
    global: accessToken
      ? { headers: { Authorization: `Bearer ${accessToken}` } }
      : undefined,
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
