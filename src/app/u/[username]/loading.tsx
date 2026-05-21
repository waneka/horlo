import { ProfileTabContentSkeleton } from './profile-shell-skeleton'

// Phase 52 D-52-13 + D-52-14 — three-boundary Suspense topology
// (single source of truth for future debugging on this route).
//
// `/u/[username]/*` now has THREE Suspense boundaries that coexist
// per the audit followup ("having all is harmless"):
//
//   1. LAYOUT-LEVEL — `src/app/u/[username]/layout.tsx` wraps the new
//      async `ProfileChrome` in `<Suspense fallback={<ProfileShellSkeleton/>}>`.
//      Cold-load case: the full chrome skeleton (avatar + header +
//      counts + tags + hero band + tab strip + content) renders while
//      ProfileChrome resolves `params` + `getCurrentUser()` inside
//      Suspense. (Plan 52-04 — D-52-16 structural lock.)
//
//   2. PAGE-LEVEL — `src/app/u/[username]/[tab]/page.tsx` outer sync
//      `ProfileTabPage` wraps the inner async `ProfileTabContent` in
//      `<Suspense fallback={<ProfileTabContentSkeleton/>}>`. Tab-navigation
//      case: chrome stays mounted (layout subtree is already resolved);
//      only the per-tab content area swaps. The content-area skeleton
//      shows briefly while ProfileTabContent's tab body streams.
//      (Plan 52-05 — D-52-16 structural lock.)
//
//   3. `loading.tsx` IMPLICIT SUSPENSE (THIS FILE) — Next 16's segment-
//      loading boundary per
//      node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md.
//      Used during the IMPLICIT-PREFETCH client-navigation case
//      described in node_modules/next/.../linking-and-navigating.md.
//      With Cache Components enabled, Next 16 treats this as a regular
//      Suspense boundary per layout.md's "Interaction with loading.js"
//      rule.
//
// Why all three coexist:
//   * Cold load: layout Suspense fires first → ProfileShellSkeleton →
//     ProfileChrome resolves → ProfileGate renders chrome → page
//     Suspense fires → ProfileTabContentSkeleton → ProfileTabContent
//     streams.
//   * Tab nav (client navigation): layout subtree already resolved →
//     page Suspense fires (briefly) → ProfileTabContentSkeleton →
//     tab content streams. `loading.tsx` is the implicit-prefetch
//     fallback during this transition.
//
// Why we render `<ProfileTabContentSkeleton/>` here (not
// `<ProfileShellSkeleton/>`) — D-52-15: skeletons are intentionally
// distinct. Chrome stays mounted on client nav; the loading boundary
// should match the visual state expected during a tab swap, which is
// "chrome stays, content updates" — content-only skeleton.
//
// See .planning/audits/cache-components-2026-05-21-followup.md § Step 3
// ("keep all three" decision) and .planning/phases/52-option-d-cache-
// components-canonical-pattern-fix-for-u-userna/52-CONTEXT.md D-52-13
// + D-52-14 + D-52-15.
export default function Loading() {
  return <ProfileTabContentSkeleton />
}
