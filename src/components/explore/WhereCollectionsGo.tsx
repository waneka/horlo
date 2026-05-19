// src/components/explore/WhereCollectionsGo.tsx
//
// Where Collections Go — Phase 47 EXPL-09.
//
// Shows 3 weekly-rotating curated collection paths. Returns null when no
// published paths exist (EXPL-02 absent-not-empty).
//
// D-13: weekly rotation — the caller computes getWeekIndex(new Date()) OUTSIDE
// this cache scope and passes it in as `weekIndex`, so it is a cache-KEY input
// (a fresh cache entry every 7 days) rather than a value frozen into cached
// output. Select 3 paths starting at weekIndex % allPaths.length with
// wrap-around for clean end-of-array slicing. Fewer than 3 published paths all
// render (no crash, no duplicates).
//
// WR-02: reading new Date() INSIDE this 'use cache' scope froze the rotation
// at cache-population time — it advanced only on eviction, not on the 7-day
// boundary. weekIndex is now a parameter so rotation is deterministic.
//
// Cache scope: 'explore:paths' tag only — every path mutation fires
// revalidateTag('explore:paths', 'max') (CR-01). The former 'explore' umbrella
// tag was removed: it was never fired and implied coverage that did not exist.
//
// T-47-12: No getCurrentUser() in this file — viewer-identity must NOT enter
// globally-shared cache entries.

import { cacheLife, cacheTag } from 'next/cache'
import Link from 'next/link'

import { getPublishedPaths, getPathWithNodes } from '@/data/collectionPaths'
import { PathCard } from '@/components/explore/PathCard'

export async function WhereCollectionsGo({ weekIndex }: { weekIndex: number }) {
  'use cache'
  cacheTag('explore:paths')
  cacheLife('hours')

  const allPaths = await getPublishedPaths()

  // EXPL-02: no published paths → hide entirely (return null, no empty container)
  if (allPaths.length === 0) return null

  // D-13: select 3 paths via weekly rotation with wrap-around
  const startIdx = weekIndex % allPaths.length
  // Slice from startIdx, then prepend from the beginning if the slice is short
  let threePaths = allPaths.slice(startIdx, startIdx + 3)
  if (threePaths.length < 3) {
    // Wrap around: take the remaining from the start of the array
    const needed = 3 - threePaths.length
    const wrappedExtras = allPaths.slice(0, needed)
    // Deduplicate by id — if the pool has < 3 paths, the wrap-around may produce
    // duplicate path ids which would cause React duplicate key warnings (Wave 2 fix)
    const seenIds = new Set(threePaths.map((p) => p.id))
    threePaths = [
      ...threePaths,
      ...wrappedExtras.filter((p) => !seenIds.has(p.id)),
    ]
  }

  // Fetch nodes for each selected path
  const pathsWithNodes = await Promise.all(
    threePaths.map((path) => getPathWithNodes(path.id))
  )

  // Filter out any null results (should not happen for published paths, but be safe)
  const validPaths = pathsWithNodes.filter(
    (p): p is NonNullable<typeof p> => p !== null
  )

  if (validPaths.length === 0) return null

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold leading-tight text-foreground">
          Where Collections Go
        </h2>
        <Link
          href="/explore/paths"
          className="text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          Explore all paths
        </Link>
      </div>
      <div className="flex flex-col gap-8">
        {validPaths.map((pathWithNodes) => (
          <PathCard key={pathWithNodes.id} pathWithNodes={pathWithNodes} />
        ))}
      </div>
    </section>
  )
}
