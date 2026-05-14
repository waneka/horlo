import { ProfileTabContentSkeleton } from './profile-shell-skeleton'

// Phase 39c D-39c-06 + 2026-05-14 tab-UX refinement — Next 16 segment
// loading boundary for /u/[username]. Wraps page.tsx + nested layouts
// during navigation (different scope than the layout's own <Suspense>
// per loading.md:88). On tab-segment navigation the /u/[username] layout
// stays mounted and the chrome (avatar, header, tab strip from
// ProfileGate) stays on screen; only the tab page suspends. Rendering
// just the content-card placeholder here avoids the visually duplicated
// chrome skeleton that the original ProfileShellSkeleton would show. For
// cold-load cases where ProfileGate itself suspends, the layout's own
// `<Suspense fallback={<ProfileShellSkeleton/>}>` still renders the full
// chrome skeleton.
export default function Loading() {
  return <ProfileTabContentSkeleton />
}
