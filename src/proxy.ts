import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'
import { isPublicPath } from '@/lib/constants/public-paths'

export default async function proxy(request: NextRequest) {
  const { user, response } = await updateSession(request)

  const pathname = request.nextUrl.pathname
  const isPublic = isPublicPath(pathname)

  // Phase 51 (Branch B): Profile routes (/u/*) ARE gated by the proxy.
  // Cookie-only auth via updateSession's getSession() (plan 51-04) — no
  // network round-trip on RSC prefetches. The 307 → /login carries
  // Cache-Control: no-store so it cannot be stored by Next 16's Router
  // Cache, preventing the recurrence-2 poisoning vector documented in
  // .planning/debug/profile-page-404-top-nav.md.

  if (!user && !isPublic) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname + request.nextUrl.search)
    const redirect = NextResponse.redirect(loginUrl)
    // Branch B safety: prevent Router Cache from storing this 307.
    redirect.headers.set('Cache-Control', 'no-store')
    return redirect
  }

  // Dev-only log line to satisfy ROADMAP success criterion #2 ("a log line confirms the proxy executes")
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[proxy] ${pathname} user=${user?.id ?? 'anon'} public=${isPublic}`)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
