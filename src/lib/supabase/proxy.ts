import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request: { headers: request.headers } })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Phase 51 (Branch B safety): proxy auth gating MUST be cookie-only — no
  // network round-trip — per authentication.md:1031. getUser() (a Supabase
  // API call) caused recurrence-2 Router Cache poisoning when a transient
  // null response triggered 307 → /login on RSC prefetch requests, which
  // Next 16's Router Cache stored and served on subsequent soft-nav clicks.
  // getSession() reads the JWT from cookies and decrypts locally — no
  // network — so it cannot fail transiently. The result `user` has the same
  // shape as before (User | null) so callers do not need to change.
  //
  // Trade-off explicitly accepted: a forged or stolen session JWT will be
  // accepted by the proxy gate (no server verification). Sensitive
  // operations on pages and Server Actions MUST continue to use the
  // server-verified user fetcher (getCurrentUser in src/lib/supabase/server,
  // which calls Supabase's auth server). The proxy gate is optimistic;
  // page/action gates are authoritative. This is the documented Supabase +
  // Next.js pattern.
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user ?? null

  return { supabase, user, response }
}
