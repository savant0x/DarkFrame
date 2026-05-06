/**
 * Supabase Server Client
 * 
 * Creates a Supabase client for server-side API routes and Server Components.
 * Uses the service role key (private) — bypasses RLS for server operations.
 * 
 * Usage (API Route):
 *   import { createServerClient } from '@/lib/supabase/server';
 *   const supabase = await createServerClient();
 *   const { data, error } = await supabase.from('players').insert({...});
 * 
 * Usage (Middleware / Server Component):
 *   import { createServerClient } from '@/lib/supabase/server';
 *   import { cookies } from 'next/headers';
 *   const supabase = await createServerClient(cookies());
 */

import { createServerClient as createSSRClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/**
 * Creates a server-side Supabase client with cookie-based auth
 * for use in Next.js Server Components and Route Handlers.
 */
export async function createServerClient() {
  const cookieStore = await cookies();

  return createSSRClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Can be ignored in Server Components — only Route Handlers can set cookies
          }
        },
      },
    }
  );
}

/**
 * Creates a server-side Supabase client using the service role key.
 * Use ONLY in API routes where full admin access is needed.
 * Never expose the service role key to the client.
 */
export function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
