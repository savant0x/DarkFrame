/**
 * Next.js Proxy — Supabase Auth + Security Headers
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { startFactoryDailyReset, executeFactoryDailyReset } from '@/lib/jobs/factoryDailyReset';

let jobsStarted = false;

export async function proxy(request: NextRequest) {
  // Start beer base auto-spawn on first request
  if (!jobsStarted) {
    jobsStarted = true;
    try {
      // Beer base auto-spawn
      const { beerBaseRespawner } = await import('@/lib/wmd/jobs/beerBaseRespawner');
      const interval = setInterval(() => beerBaseRespawner(), 60000);
      // Initial spawn immediately on startup
      beerBaseRespawner().catch(err => console.error('[proxy] Initial beer base spawn failed:', err));

      // Flag system initialization
      const { initializeFlagSystem } = await import('@/lib/flagBotService');
      await initializeFlagSystem();

      // Flag auto-drop respawner
      const { startFlagRespawner } = await import('@/lib/jobs/flagRespawner');
      startFlagRespawner();

      // Factory daily reset — full slot refresh every 24h
      startFactoryDailyReset();

      console.log('[proxy] Background systems started');
    } catch (err) {
      console.error('[proxy] Background start failed:', err);
    }
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser();

  if (!user || error) {
    const loginUrl = new URL('/login', request.url);
    return addSecurityHeaders(NextResponse.redirect(loginUrl));
  }

  return addSecurityHeaders(response);
}

function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' https://api.stripe.com https://*.supabase.co wss: ws:",
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests"
    ].join('; ')
  );
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=(self)');
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  return response;
}

export const config = {
  matcher: ['/game/:path*'],
};
