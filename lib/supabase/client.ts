/**
 * Supabase Client (Browser)
 * 
 * Creates a Supabase client for client-side components.
 * Uses the anon key (public) — RLS policies enforce permissions.
 * 
 * Usage:
 *   import { createClient } from '@/lib/supabase/client';
 *   const supabase = createClient();
 *   const { data } = await supabase.from('players').select('*');
 */

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
