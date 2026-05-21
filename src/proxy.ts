import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'
import { isPublicPath } from '@/lib/constants/public-paths'

export default async function proxy(request: NextRequest) {
  const { userId, response } = await updateSession(request)

  const pathname = request.nextUrl.pathname
  const isPublic = isPublicPath(pathname)

  // Phase 51 Branch B safety contract (CR-01 corrected by Phase 52 D-52-09):
  //
  // THE Router Cache poisoning mitigation for anon `/u/*` requests is the
  // `Cache-Control: no-store` header set on the 307 → /login below (line
  // 28). That header is NECESSARY AND SUFFICIENT — it tells Next 16's
  // Router Cache to neither store nor replay this redirect on subsequent
  // soft-navs. Four recurrences of the profile-tab 404 + React #419 bug
  // (.planning/debug/resolved/profile-page-404-top-nav.md) converged on
  // this single property.
  //
  // The cookie-only `getSession()` swap (plan 51-04) is NOT a safety
  // property. It is an optimistic auth optimisation: getSession() reads
  // session cookies first and CAN refresh the access token over the
  // network when it nears expiry (see the lengthy auth-js rationale in
  // src/lib/supabase/proxy.ts:26-67). That network refresh is acceptable
  // precisely because it doesn't affect the Router Cache decision — the
  // header below does. Treating getSession() as "part of" the safety
  // contract was the framing error CR-01 flagged in the Phase 51 code
  // review; this comment block is the corrected framing.
  //
  // See .planning/audits/cache-components-2026-05-21.md ("actual
  // recurrence-3 mitigation was Cache-Control: no-store"), Phase 52
  // D-52-09 (this CR-01 closure), and D-52-CF-01 (Branch B contract
  // preserved through Phase 52).

  if (!userId && !isPublic) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname + request.nextUrl.search)
    const redirect = NextResponse.redirect(loginUrl)
    // Branch B safety: prevent Router Cache from storing this 307.
    redirect.headers.set('Cache-Control', 'no-store')
    return redirect
  }

  // Dev-only log line to satisfy ROADMAP success criterion #2 ("a log line confirms the proxy executes")
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[proxy] ${pathname} user=${userId ?? 'anon'} public=${isPublic}`)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
