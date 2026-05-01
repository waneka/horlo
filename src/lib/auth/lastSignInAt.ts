/**
 * Phase 22 SET-05 — Stale-session freshness helper for the password-change
 * re-auth dialog.
 *
 * Used by Phase 22 password-change re-auth detection (RECONCILED D-08
 * 2026-04-30 — Option C: `user.last_sign_in_at` is the primary freshness
 * signal because it matches Supabase's server-side reauth check
 * (`session.created_at + 24h > now`) — verified in supabase/auth
 * `internal/api/user.go`. JWT `iat` was rejected because it rotates on
 * every silent token refresh and would let a 7-day-old session appear
 * fresh client-side while the server returns 401.)
 *
 * Both helpers are PURE — no DOM, no network, safe to import from anywhere
 * (Client Components, Server Components, route handlers). Intentionally
 * does NOT use Next.js's server-only guard — the password-change form is a
 * Client Component that needs to read this on submit.
 */

const DEFAULT_THRESHOLD_MS = 24 * 60 * 60 * 1000

/**
 * Returns the elapsed milliseconds since the last fresh sign-in, or null if
 * the input is missing or malformed.
 *
 * Input source: `user.last_sign_in_at` from the Supabase `User` object
 * returned by `supabase.auth.getUser()`. Updates only on fresh
 * `signInWithPassword` (and OAuth/OTP/etc.); does NOT update on silent token
 * refresh (matching Supabase server-side `session.created_at` semantics).
 */
export function getLastSignInAgeMs(
  lastSignInAtIso: string | null | undefined,
): number | null {
  if (lastSignInAtIso == null) return null
  if (typeof lastSignInAtIso !== 'string' || lastSignInAtIso.length === 0) {
    return null
  }
  const parsed = Date.parse(lastSignInAtIso)
  if (Number.isNaN(parsed)) return null
  return Date.now() - parsed
}

/**
 * Returns true when the session is older than `thresholdMs` (default 24h)
 * since the last fresh sign-in, OR when last_sign_in_at is null/malformed
 * (defensive default — assume stale to force re-auth instead of silently
 * bypassing the dialog and hitting a 401 from the server).
 *
 * The 24h default mirrors Supabase Auth's server-side reauth threshold for
 * "Secure password change" (verified in supabase/auth `internal/api/user.go`).
 */
export function isSessionStale(
  lastSignInAtIso: string | null | undefined,
  thresholdMs: number = DEFAULT_THRESHOLD_MS,
): boolean {
  const ageMs = getLastSignInAgeMs(lastSignInAtIso)
  if (ageMs === null) return true
  return ageMs > thresholdMs
}
