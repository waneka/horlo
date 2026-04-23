import { Search } from 'lucide-react'

/**
 * /search stub — Phase 14 NAV-11 D-19.
 *
 * Minimal "coming soon" placeholder so the slim top nav search icon and
 * desktop nav search input never 404. Phase 16 rewrites this page with
 * real people-search (pg_trgm ILIKE + taste overlap). Copy + icon locked
 * by 14-UI-SPEC.md §Copywriting Contract. Renders inside the authenticated
 * shell (proxy.ts redirects unauth users to /login — D-20).
 */
export default function SearchPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col items-center justify-center px-4 py-24 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-accent/10">
        <Search className="size-6 text-accent" aria-hidden />
      </div>
      <h1 className="font-serif text-3xl md:text-4xl text-foreground">
        Search is coming.
      </h1>
      <p className="mt-3 max-w-md text-sm text-muted-foreground">
        Find collectors by name, discover taste overlap, and follow people
        who wear what you love. Check back soon.
      </p>
    </main>
  )
}
