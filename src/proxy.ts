import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'
import { isPublicPath } from '@/lib/constants/public-paths'

export default async function proxy(request: NextRequest) {
  const { user, response } = await updateSession(request)

  const pathname = request.nextUrl.pathname
  const isPublic = isPublicPath(pathname)

  if (!user && !isPublic) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname + request.nextUrl.search)
    return NextResponse.redirect(loginUrl)
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
