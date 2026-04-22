import Link from 'next/link'

/**
 * Empty-state block shown when the viewer has zero followed collectors or
 * zero eligible feed rows. Copy is locked by UI-SPEC § Copywriting § Empty
 * States (Network Activity).
 *
 * CTA anchors to `#suggested-collectors` so it scrolls to the same-page
 * Suggested Collectors section (Plan 07). Same-page anchor per CONTEXT.md L-02.
 */
export function FeedEmptyState() {
  return (
    <div className="py-12 text-center space-y-4">
      <h3 className="font-serif text-3xl font-normal text-foreground">
        Your feed is quiet
      </h3>
      <p className="text-base text-muted-foreground">
        Follow collectors to see what they&apos;re wearing, adding, and
        wishlisting.
      </p>
      <Link
        href="#suggested-collectors"
        className="inline-flex items-center justify-center h-10 px-6 rounded-md bg-primary text-primary-foreground font-semibold text-sm transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        Find collectors to follow
      </Link>
    </div>
  )
}
