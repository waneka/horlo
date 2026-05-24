// Loading skeleton for CommentThread — shown via Suspense fallback in the host page.

export function CommentThreadSkeleton() {
  return (
    <section className="mt-6">
      <div className="h-4 w-20 bg-muted animate-pulse rounded mb-4" />
      <div className="flex flex-col gap-4">
        <div className="h-4 bg-muted animate-pulse rounded mb-3" />
        <div className="h-4 bg-muted animate-pulse rounded mb-3 w-3/4" />
        <div className="h-4 bg-muted animate-pulse rounded mb-3 w-1/2" />
      </div>
    </section>
  )
}
