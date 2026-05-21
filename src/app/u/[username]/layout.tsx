import { Suspense } from 'react'
import { ProfileChrome } from './profile-chrome'
import { ProfileShellSkeleton } from './profile-shell-skeleton'

// Phase 52 D-52-16 structural lock — ALWAYS-SYNC LAYOUT,
// ALWAYS-SUSPENSE, ALWAYS-ASYNC ProfileChrome.
//
// This layout is sync by design. All runtime API access (params,
// cookies via getCurrentUser) lives inside <ProfileChrome>, which is
// wrapped in <Suspense fallback={<ProfileShellSkeleton/>}>. That's
// the canonical Next 16 Cache Components pattern — "push dynamic
// access down" — per
// node_modules/next/dist/docs/01-app/01-getting-started/15-instant.md
// and the `.../streaming.md` / `.../layout.md` "Interaction with
// loading.js" rule.
//
// REVERSAL NOTE (D-52-11): Phase 51 CONTEXT.md placed
// `unstable_instant = { prefetch: 'static' }` on a "failed-attempt
// blocklist" — that diagnosis is REVERSED by Phase 52. The export is
// the build/dev validator that catches this exact bug class
// (top-level awaits in layout/page outside Suspense); removing it in
// Phase 39c removed the validation, not the bug. The recurrence-4
// React #419 (~10 min after the Phase 51 deploy, 2026-05-20 night)
// surfaced the structural defect that the validator had previously
// been flagging. See .planning/phases/52-.../52-CONTEXT.md and
// .planning/audits/cache-components-2026-05-21-followup.md.
//
// Invariants this layout still upholds:
//   * Persistent chrome — the <main> wrapper survives across
//     sibling tab navigations (collection ↔ wishlist ↔ worn …)
//     so the visible avatar / hero / tab strip never unmounts.
//     ProfileChrome's children render the per-tab page content.
//   * Phase 39c Pitfall 1 / D-52-CF-02 — viewerId is resolved by
//     ProfileChrome (uncached) and passed to ProfileGate as a prop;
//     ProfileShellResolver's cached scope stays viewer-independent.
//   * Phase 39c Pitfall 5 / D-52-CF-03 — notFound() ordering is
//     preserved inside ProfileGate (fires BEFORE any post-suspending
//     await, and BEFORE the LockedProfileState branch).
//   * The locked-profile branch lives inside ProfileGate; when
//     `!isOwner && !settings.profilePublic` the gate returns
//     <LockedProfileState/> instead of the chrome + children.
//
// See .planning/debug/resolved/profile-page-404-top-nav.md (recurrence
// 1–4 narrative), Phase 51 51-CONTEXT.md (annotated with the D-52-11
// reversal by Plan 52-08), and Phase 52 52-RESEARCH.md Pattern 1.
export default function ProfileLayout({
  children,
  params,
}: LayoutProps<'/u/[username]'>) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 lg:px-8 lg:py-12">
      <Suspense fallback={<ProfileShellSkeleton />}>
        <ProfileChrome paramsPromise={params}>{children}</ProfileChrome>
      </Suspense>
    </main>
  )
}
