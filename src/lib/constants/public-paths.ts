export const PUBLIC_PATHS = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/auth',
] as const

export type PublicPath = (typeof PUBLIC_PATHS)[number]

/**
 * True when `pathname` matches any PUBLIC_PATH as an exact match, as a
 * prefix followed by '/', or as a prefix followed by '?' (query string).
 *
 * Mirrors the proxy's historical `startsWith(p)` semantics while explicitly
 * rejecting collisions like `/loginfoo` or `/authentication`. All five
 * public paths are short and well-known; no real route uses these prefixes
 * for other purposes (verified RESEARCH §Pattern 3 for phase 14).
 *
 * Consumers:
 *   - src/proxy.ts (server auth gate)
 *   - src/components/layout/BottomNav.tsx (client render gate — plan 14-03)
 *   - src/components/layout/SlimTopNav.tsx (client render gate — plan 14-04)
 *
 * Any divergence between these consumers leaks authenticated chrome to
 * unauthenticated viewers (T-14-01-03). Keep this module as the sole source
 * of truth.
 */
export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) =>
      pathname === p ||
      pathname.startsWith(`${p}/`) ||
      pathname.startsWith(`${p}?`),
  )
}

/**
 * True when `pathname` is a profile route (/u/*) that the proxy should NOT
 * gate with an auth redirect.
 *
 * Profile routes are intentionally browsable by unauthenticated visitors (v5.1
 * cross-collector discovery direction). Page-level code handles viewer-identity
 * in ProfileGate: `UnauthorizedError` → `viewerId = null` → `LockedProfileState`
 * for private profiles, `notFound()` for missing users. The proxy issuing a
 * 307 → /login on any RSC prefetch race would poison the Next 16 Router Cache
 * and cause 404s on soft-nav (debug session profile-page-404-top-nav).
 *
 * NOTE: This predicate is for the PROXY AUTH GATE only. It does NOT affect
 * `isPublicPath` (which drives nav-chrome visibility in BottomNav / SlimTopNav).
 * Profile pages still render authenticated chrome for logged-in users.
 */
export function isProfilePath(pathname: string): boolean {
  return pathname === '/u' || pathname.startsWith('/u/')
}
