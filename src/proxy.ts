import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'
import { isPublicPath } from '@/lib/constants/public-paths'

export default async function proxy(request: NextRequest) {
  const { userId, response } = await updateSession(request)

  const pathname = request.nextUrl.pathname
  const isPublic = isPublicPath(pathname)

  // Phase 51 (Branch B): Profile routes (/u/*) ARE gated by the proxy.
  // Auth is read via updateSession's getSession() (plan 51-04). NOTE: this
  // is cookie-first, not strictly network-free — getSession() can refresh
  // the access token when it is near expiry (see comment in
  // src/lib/supabase/proxy.ts for the auth-js details). The PRIMARY
  // recurrence-2 (Router Cache poisoning) mitigation is the
  // `Cache-Control: no-store` header set on the 307 → /login below (line
  // 23). That header — NOT the getUser → getSession swap — is what
  // prevents Next 16's Router Cache from storing and replaying this
  // redirect on subsequent soft-navs. See
  // .planning/debug/profile-page-404-top-nav.md for the full history.

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
