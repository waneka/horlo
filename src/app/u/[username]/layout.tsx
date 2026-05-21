// Phase 51 (F3-Composite): layout is a pure static chrome wrapper.
//
// The previous layout-level streaming boundary + viewer-gating composition
// has been moved into [tab]/page.tsx so the page (which reads cookies via
// getCurrentUser) is the runtime-API consumer and the route's dynamic
// stream target. This eliminates Cache Components PPR qualification at the
// source — the layout has no async data, no streaming boundary, and
// contributes only deterministic chrome to the static shell.
//
// See .planning/debug/profile-page-404-top-nav.md (recurrence 3) and
// Phase 51 RESEARCH.md for the full rationale.
export default async function ProfileLayout({
  children,
  params,
}: LayoutProps<'/u/[username]'>) {
  // params is awaited to preserve the typed param contract; the value is
  // not used in the layout itself — children (the tab page) consumes it
  // via its own `params` prop.
  await params
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 lg:px-8 lg:py-12">
      {children}
    </main>
  )
}
