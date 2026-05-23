import { createClient } from "@supabase/supabase-js"

/**
 * Returns a Supabase client with elevated privileges.
 * Prefers the server-side service role key; falls back to anon key
 * so the app works even when only the public env vars are set.
 */
export function getSupabaseAdmin() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error(
      "Missing Supabase env vars (SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY)"
    )
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  })
}
