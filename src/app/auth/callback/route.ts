import { NextRequest, NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * Phase 22 SET-06 / D-11 / D-12 — per-type auth-callback redirect map.
 *
 * EmailOtpType union (verified in @supabase/auth-js types.d.ts):
 *   'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change' | 'email'
 *
 * `'email'` is the deprecated alias for `'signup'` — coerced inline below.
 *
 * D-11 destination map: each documented Supabase email flow lands on a
 * destination that fires the matching `?status=` toast handler. The
 * `email_change` destination uses the hash-with-querystring shape mandated by
 * SET-06 + D-16: `/settings#account?status=email_changed`. RFC 7231 §7.1.2
 * mandates browsers honor the fragment in 3xx Location headers; Next.js's
 * NextResponse.redirect carries it verbatim.
 *
 * D-12 override matrix: only `signup`, `recovery`, and `magiclink` honor the
 * `?next=` query param override. `email_change` and `invite` ALWAYS land on
 * their type-default destination — for `email_change` this is the SET-06 spec
 * (T-22-S6 mitigation: a stale `next=` from the original change-form URL
 * should not redirect the user somewhere unexpected post-confirm).
 */
const TYPE_DEFAULT_REDIRECT = {
  signup: '/?status=email_confirmed',
  recovery: '/reset-password',
  // D-12: SET-06 spec destination — NEVER `next`-overridable. T-22-S6
  // mitigation; see top-of-file comment.
  email_change: '/settings#account?status=email_changed',
  magiclink: '/?status=signed_in',
  invite: '/signup?status=invited',
} as const satisfies Record<Exclude<EmailOtpType, 'email'>, string>

// D-12: only these 3 types honor the `next` override.
const NEXT_OVERRIDABLE: ReadonlySet<EmailOtpType> = new Set([
  'signup',
  'recovery',
  'magiclink',
])

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next')

  // Same-origin guard — Open-redirect protection (Pitfall 8 / T-22-S6).
  //
  // Tightened from the prior `startsWith('/') && !startsWith('//')` check to
  // also reject backslash and CRLF/tab control chars. URL decoding by
  // `searchParams.get` means a `next=%0d%0aSet-Cookie:...` value would, after
  // decode, contain raw `\r\n`. Node's HTTP layer already rejects header
  // values with control chars at runtime, but explicit validation up-front is
  // defense-in-depth and clearer than relying on the throw.
  //
  // Allowed shape: starts with `/`, second char is NOT `/` (rejects
  // `//evil.com`), and the remainder contains no backslash or control chars.
  const safeNext =
    next && /^\/(?!\/)[^\\\r\n\t]*$/.test(next) ? next : null

  if (!token_hash || !type) {
    return NextResponse.redirect(new URL('/login?error=invalid_link', origin))
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.verifyOtp({ type, token_hash })
  if (error) {
    return NextResponse.redirect(new URL('/login?error=invalid_link', origin))
  }

  // Coerce deprecated 'email' alias to 'signup'.
  const normalizedType: Exclude<EmailOtpType, 'email'> =
    type === 'email' ? 'signup' : type

  // Defensive runtime guard — TS narrows but a malformed `type` string at
  // runtime (not in the EmailOtpType literal) would index undefined.
  const typeDefault = TYPE_DEFAULT_REDIRECT[normalizedType]
  if (!typeDefault) {
    return NextResponse.redirect(new URL('/login?error=invalid_link', origin))
  }

  const destination =
    safeNext && NEXT_OVERRIDABLE.has(normalizedType) ? safeNext : typeDefault

  // WHATWG URL preserves the `#fragment?query` shape from D-16 verbatim — the
  // entire post-`#` substring is opaque fragment data, so the `?status=` lives
  // inside the fragment and round-trips byte-identical to what
  // <SettingsTabsShell>'s parseHash and <StatusToastHandler>'s hash parser
  // expect. Verified: `new URL('/settings#account?status=email_changed', origin)`
  // emits `https://origin/settings#account?status=email_changed`.
  return NextResponse.redirect(new URL(destination, origin))
}
