import type { WatchStatus } from '@/lib/types'

/**
 * Phase 28 ADD-08 / D-11 — Open-redirect-safe regex (VERBATIM from
 * src/app/auth/callback/route.ts:60-61). Required shape: starts with `/`,
 * second char is NOT `/` (rejects `//evil.com`), and the remainder contains
 * no backslash or CR/LF/tab control chars (rejects header-injection vectors
 * like `?returnTo=/path%0d%0aSet-Cookie:...`).
 *
 * URL decoding by `searchParams.get` (Server Component) means a CRLF-encoded
 * value, after decode, contains raw `\r\n` — caught by this regex.
 *
 * Plus a self-loop guard: reject if returnTo `startsWith('/watch/new')` to
 * prevent `?returnTo=/watch/new?returnTo=...` infinite-trap vectors.
 *
 * EXPORTED so destinations.test.ts can assert `.source` parity against a
 * literal-string fixture (replaces escape-fragile cross-file regex grep).
 */
export const RETURN_TO_REGEX = /^\/(?!\/)[^\\\r\n\t]*$/

/** D-11 two-stage validation. Returns the validated string OR null. */
export function validateReturnTo(value: unknown): string | null {
  if (typeof value !== 'string') return null
  if (!RETURN_TO_REGEX.test(value)) return null
  if (value.startsWith('/watch/new')) return null
  return value
}

/**
 * Phase 28 D-02 / D-13 — status → profile-tab mapping. The default
 * destination when ?returnTo= is null OR invalid.
 *
 * - status ∈ {'wishlist', 'grail'} → /u/{username}/wishlist
 * - status ∈ {'owned', 'sold'}     → /u/{username}/collection
 *
 * When username is null (data integrity issue — should not happen at v4.0+
 * since signup trigger guarantees a username), the function returns '/' as
 * a soft fallback. Callers should treat null username as a soft alarm but
 * not crash the commit flow.
 */
export function defaultDestinationForStatus(
  status: WatchStatus,
  username: string | null,
): string {
  if (!username) return '/'
  const tab = status === 'wishlist' || status === 'grail' ? 'wishlist' : 'collection'
  return `/u/${username}/${tab}`
}

/**
 * Phase 28 D-05 / D-06 — Path canonicalization for the suppress-toast
 * comparison.
 *
 * Two paths refer to the same URL iff their canonicalized forms are equal.
 * Algorithm:
 *   1. If path starts with `/u/me/`, rewrite the prefix to `/u/{viewerUsername}/`
 *      using the actual viewer's username (resolved server-side at
 *      /watch/new). This handles the WishlistGapCard.tsx:24 shorthand
 *      pattern without requiring callsites to change.
 *   2. Strip query string (everything from `?` onward) — D-06: "two strings
 *      match iff they refer to the same URL path."
 *   3. Strip trailing slash when path length > 1.
 *   4. Case-sensitive comparison (Next.js routes are case-sensitive).
 *
 * When viewerUsername is null, the function returns the path unchanged
 * (the comparison will then operate on un-canonicalized strings; the
 * caller should treat null username as "do not suppress").
 */
export function canonicalize(
  path: string,
  viewerUsername: string | null,
): string {
  // Phase 28 D-06 — null username is the soft-alarm case: the caller cannot
  // build a meaningful comparison without the viewer's username (e.g. the
  // /u/me/ rewrite is impossible). Return the path verbatim so the caller's
  // path-equality check fails ("do not suppress") rather than silently
  // matching against a partially-canonicalized form. The test fixture asserts
  // both branches (`/u/me/wishlist` and `/search?q=tudor`) round-trip
  // unchanged.
  if (!viewerUsername) return path
  let p = path
  if (p.startsWith('/u/me/')) {
    p = `/u/${viewerUsername}/` + p.slice('/u/me/'.length)
  }
  const queryStart = p.indexOf('?')
  if (queryStart >= 0) p = p.slice(0, queryStart)
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1)
  return p
}
