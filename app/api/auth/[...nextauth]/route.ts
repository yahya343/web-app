/**
 * Static export requires `force-static` on every route.
 * The `apiHandler` wrapper catches errors gracefully when
 * MongoDB is unavailable (e.g., during static export build).
 */
export const dynamic = 'force-static';

import { handlers } from '@/lib/auth';
import { rateLimitCheck, getRateLimitKey } from '@/lib/rate-limit';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Rate-limited auth handlers.
 *
 * The POST handler (login) is wrapped with a rate limiter to prevent
 * brute-force credential stuffing. GET (session check) is passed through
 * without additional limiting.
 *
 * Note: NextAuth v5 (Auth.js) handlers accept only the request argument.
 * Route params are parsed internally from the URL path.
 */

async function rateLimitedPOST(request: NextRequest) {
  // 10 login attempts per IP per 60 seconds
  const key = getRateLimitKey(request);
  if (!rateLimitCheck(key, 10, 60_000)) {
    return NextResponse.json(
      { error: 'Too many login attempts. Please try again later.' },
      { status: 429 },
    );
  }

  return handlers.POST(request);
}

export const GET = handlers.GET;
export const POST = rateLimitedPOST;
