import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'
import { isPublicPath, isProfilePath } from '@/lib/constants/public-paths'

export default async function proxy(request: NextRequest) {
  const { user, response } = await updateSession(request)

  const pathname = request.nextUrl.pathname
  const isPublic = isPublicPath(pathname)

  // Profile routes (/u/*) are NOT gated by the proxy even for unauthenticated
  // visitors. Page-level code (ProfileGate) handles viewer identity:
  // UnauthorizedError → viewerId=null → LockedProfileState or notFound().
  // Gating here causes 307 → /login on RSC prefetch races, which Next 16's
  // Router Cache stores and serves on subsequent soft-nav clicks → 404.
  // See .planning/debug/profile-page-404-top-nav.md (recurrence 2026-05-19).
  const isProfile = isProfilePath(pathname)

  if (!user && !isPublic && !isProfile) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname + request.nextUrl.search)
    return NextResponse.redirect(loginUrl)
  }

  // Dev-only log line to satisfy ROADMAP success criterion #2 ("a log line confirms the proxy executes")
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[proxy] ${pathname} user=${user?.id ?? 'anon'} public=${isPublic} profile=${isProfile}`)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
