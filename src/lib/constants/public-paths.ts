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
