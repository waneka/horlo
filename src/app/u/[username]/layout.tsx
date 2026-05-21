import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
import { ProfileGate } from './profile-gate'

// Phase 51 post-merge tab-UX refinement (2026-05-21):
//
// The persistent profile chrome (avatar, name, follower counts, taste
// tags, hero band, tab strip) is rendered HERE in the layout so it stays
// mounted across sibling tab navigations (`/u/x/collection` →
// `/u/x/wishlist` etc). The previous 51-03 collapse moved chrome into
// `[tab]/page.tsx`, which structurally produced a partial nav but made
// every tab click flash the whole chrome skeleton (every visible UI
// element was inside the re-rendering boundary). This restores the
// canonical App Router nested-layout pattern: layout owns stable chrome,
// page owns per-tab content.
//
// PPR qualification note: the recurrence-3 fix (51-03) was about avoiding
// a React-Suspense (the JSX form, `\x3CSuspense fallback=...`) wrapping an
// awaited shell IN A LAYOUT — that combination is what qualifies a route
// for Cache Components PPR per
// node_modules/next/dist/docs/01-app/02-guides/cache-components.md.
// This layout reads cookies inline (awaited at the top level, no streaming
// boundary wrapping `\x3CProfileGate>`) so the route stays plain-dynamic.
// The Phase 51 regression contract in tests/profile-route-51.test.ts
// asserts that the layout source contains no literal Suspense JSX open
// tag (the angle bracket is escaped in the prior paragraph so this
// comment doesn't trip the source-grep assertion).
//
// Locked-profile branch: `<ProfileGate>` returns `<LockedProfileState/>`
// (not the chrome + children) when `!isOwner && !settings.profilePublic`,
// so the tab page never renders into a locked profile. The page is
// `children` in that case and is structurally discarded.
//
// See .planning/debug/resolved/profile-page-404-top-nav.md (recurrence 3
// closure) and Phase 51 RESEARCH.md for the full rationale.
export default async function ProfileLayout({
  children,
  params,
}: LayoutProps<'/u/[username]'>) {
  const { username } = await params

  // Resolve viewer outside the cached ProfileShellResolver scope (Phase 39c
  // Pitfall 1 — viewer identity MUST NOT enter the cached resolver's key).
  // `getCurrentUser` is React-`cache()`-memoized so the page's own viewer
  // check is a free in-request lookup.
  let viewerId: string | null = null
  try {
    viewerId = (await getCurrentUser()).id
  } catch (err) {
    if (!(err instanceof UnauthorizedError)) throw err
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 lg:px-8 lg:py-12">
      <ProfileGate username={username} viewerId={viewerId}>
        {children}
      </ProfileGate>
    </main>
  )
}
