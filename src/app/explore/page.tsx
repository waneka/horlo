import { Sparkles } from 'lucide-react'

/**
 * /explore stub — Phase 14 NAV-11 D-18.
 *
 * Minimal "coming soon" placeholder so the BottomNav Explore tab and future
 * desktop nav Explore link never 404. Discovery is deferred beyond v3.0; this
 * page intentionally has no data dependencies. Copy + icon locked by
 * 14-UI-SPEC.md §Copywriting Contract. Renders inside the authenticated shell
 * (proxy.ts redirects unauth users to /login before reaching here — D-20).
 */
export default function ExplorePage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col items-center justify-center px-4 py-24 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-accent/10">
        <Sparkles className="size-6 text-accent" aria-hidden />
      </div>
      <h1 className="font-serif text-3xl md:text-4xl text-foreground">
        Discovery is coming.
      </h1>
      <p className="mt-3 max-w-md text-sm text-muted-foreground">
        Explore will surface watches, collectors, and taste clusters curated
        to your collection. Check back soon.
      </p>
    </main>
  )
}
