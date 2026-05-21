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

  // Phase 51 (Branch B safety): proxy auth gating reads the session from the
  // cookie store via getSession() rather than via getUser(). Note (CR-01):
  // getSession() is NOT strictly network-free — in the common case it reads
  // the JWT from cookies, but in @supabase/auth-js@2.x (GoTrueClient.js:2358)
  // it calls _callRefreshToken() when the access token is within
  // EXPIRY_MARGIN_MS of expiry, which performs a network round-trip to the
  // Supabase auth server. The "transient failure" window is therefore
  // narrower than getUser() (which ALWAYS makes a network call) but it is
  // not zero. The result `user` has the same shape as before (User | null)
  // so callers do not need to change.
  //
  // The PRIMARY recurrence-2 (Router Cache poisoning) mitigation is the
  // `Cache-Control: no-store` header set on the 307 → /login in
  // src/proxy.ts:23. That header — NOT the getUser/getSession choice — is
  // what prevents Next 16's Router Cache from storing and replaying the
  // redirect on subsequent soft-navs. The getSession() swap narrows the
  // failure window; the no-store header closes the cache-poisoning vector.
  //
  // We return `userId` here (not the full User object) for two reasons
  // (CR-02 — insecureUserWarningProxy noise mitigation):
  //   1. The proxy gate only ever needs the id — no other User fields are
  //      consumed by src/proxy.ts.
  //   2. session.user is wrapped in `insecureUserWarningProxy` on the server
  //      (GoTrueClient.js:2349). The first string-prop access on that proxy
  //      triggers `console.warn` ("Using the user object as returned from
  //      supabase.auth.getSession()..."). By extracting `.id` exactly once
  //      here, we keep that single warning per request confined to this
  //      function — the proxied User object never crosses the boundary back
  //      into callers. (We cannot suppress the warning entirely: the
  //      Supabase typed `auth:` options do not expose
  //      `suppressGetSessionWarning`; that flag is a protected class field,
  //      not a constructor input. A true zero-warn fix would require
  //      decoding the JWT directly from the cookie via `jose` — deferred as
  //      out of scope for this surgical fix; tracked in REVIEW-FIX.md.)
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
  const userId = session?.user?.id ?? null

  return { supabase, userId, response }
}
