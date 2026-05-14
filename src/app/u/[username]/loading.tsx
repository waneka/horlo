import { ProfileShellSkeleton } from './profile-shell-skeleton'

// Phase 39c D-39c-06 — Next 16 segment loading boundary for /u/[username].
// Wraps page.tsx + nested layouts during navigation (different scope than the
// layout's own <Suspense> per loading.md:88). The <main> wrapper MUST be
// byte-equivalent to layout.tsx:50,113 so the skeleton-to-layout swap is
// zero outer-CLS on the dominant public-branch path.
export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 lg:px-8 lg:py-12">
      <ProfileShellSkeleton />
    </main>
  )
}
