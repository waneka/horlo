import Link from 'next/link'
import { Compass } from 'lucide-react'

import { Button } from '@/components/ui/button'

/**
 * ExploreHero — sparse-network welcome (DISC-03 / D-05 / D-08).
 *
 * Pure render Server Component — NO 'use cache', NO DAL reads. The hero
 * gate (followingCount < 3 && wearEventsCount < 1) is computed in the
 * page Server Component scope (Plan 03); this component just renders.
 *
 * Copy locked by 18-UI-SPEC.md § Copywriting Contract → Sparse-network hero.
 * CTA destination: /explore/collectors (D-08).
 */
export function ExploreHero() {
  return (
    <section className="flex flex-col items-center text-center py-12 md:py-16 space-y-4">
      <div className="flex size-12 items-center justify-center rounded-full bg-accent/10">
        <Compass className="size-6 text-accent" aria-hidden />
      </div>
      <h1 className="font-serif text-3xl md:text-4xl text-foreground">
        Find collectors who share your taste.
      </h1>
      <p className="text-sm text-muted-foreground max-w-md">
        Horlo gets richer when you follow people whose collections rhyme with yours. Start here — we&apos;ll surface watches and faces worth knowing.
      </p>
      <Link href="/explore/collectors">
        <Button>Browse popular collectors</Button>
      </Link>
    </section>
  )
}
