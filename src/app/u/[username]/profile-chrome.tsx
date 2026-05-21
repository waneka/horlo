import 'server-only'
import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
import { ProfileGate } from './profile-gate'

/**
 * Async runtime-API consumer for the `/u/[username]` layout scope — the
 * uncached layer that owns cookie reads and `params` resolution. The
 * sync `layout.tsx` wraps this component in `<Suspense>` (Phase 52
 * D-52-16 structural lock — see RESEARCH.md Pattern 3 + audit followup
 * Step 2 + `.../instant.md` "Push dynamic access down").
 *
 * Why it exists:
 *   Phase 52 reverses the Phase 39c diagnosis that put `unstable_instant`
 *   on a blocklist (D-52-11). The recurrence-4 root cause was a TOP-LEVEL
 *   `await getCurrentUser()` in the layout body — outside any Suspense
 *   boundary — which the Next 16 Cache Components validator (the build /
 *   dev `unstable_instant` check) flags as `INSTANT_VALIDATION_ERROR`.
 *   `ProfileChrome` is the structural fix: cookie + params reads live
 *   here, inside an async component that the layout renders inside
 *   `<Suspense fallback={<ProfileShellSkeleton/>}>`. This is the
 *   canonical pattern the validator wants and the Phase 51 + 39c
 *   invariants depend on.
 *
 * Contract:
 *   - `paramsPromise` arrives UNRESOLVED — awaiting at the layout would
 *     re-introduce the bug. The layout passes `params` through verbatim
 *     and this function calls `await paramsPromise` inside its body.
 *   - `viewerId` is resolved here via `getCurrentUser()` and passed to
 *     `<ProfileGate>` as a typed prop. Phase 39c Pitfall 1 / D-52-CF-02
 *     — viewer identity MUST NOT enter `ProfileShellResolver`'s cached
 *     scope; this file is the boundary that physically enforces that.
 *
 * PROHIBITED inside this file (D-52-CF-02 / D-52-CF-04 structural lock):
 *   - `'use cache'` — this is the uncached layer; the resolver inside
 *     `ProfileGate` is the only cached call site for the route.
 *   - `next/cache` tag/life primitives.
 *   - `ProfileShellResolver` call — the resolver is invoked inside
 *     `ProfileGate`, NOT here.
 *   - `@/data/*` imports — this file imports only `@/lib/auth` and
 *     `./profile-gate`.
 *
 * Citations: 52-CONTEXT.md, 52-RESEARCH.md Pattern 3 (lines 282-311),
 * .planning/audits/cache-components-2026-05-21-followup.md § Step 2,
 * Phase 39c Pitfall 1, D-52-CF-02, D-52-16.
 */
interface Props {
  paramsPromise: Promise<{ username: string }>
  children: React.ReactNode
}

export async function ProfileChrome({ paramsPromise, children }: Props) {
  const { username } = await paramsPromise

  // Resolve viewer here (uncached, runtime-API consumer) so the cached
  // ProfileShellResolver inside ProfileGate stays viewer-independent.
  // `getCurrentUser` is React-`cache()`-memoized (src/lib/auth.ts:25),
  // so the page's own viewer lookup is a free in-request hit.
  let viewerId: string | null = null
  try {
    viewerId = (await getCurrentUser()).id
  } catch (err) {
    if (!(err instanceof UnauthorizedError)) throw err
  }

  return (
    <ProfileGate username={username} viewerId={viewerId}>
      {children}
    </ProfileGate>
  )
}
