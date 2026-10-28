/**
 * Supabase client stub — will be configured with real credentials later
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let supabase = null;

/**
 * Returns true if Supabase credentials are configured
 */
export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

/**
 * Get or create the Supabase client singleton.
 * Returns null if credentials are missing.
 */
export async function getSupabase() {
  if (!isSupabaseConfigured()) return null;

  if (!supabase) {
    const { createClient } = await import('@supabase/supabase-js');
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabase;
}

export default { getSupabase, isSupabaseConfigured };
