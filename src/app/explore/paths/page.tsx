// src/app/explore/paths/page.tsx
//
// /explore/paths — Collection Paths see-all route (Phase 47 D-05).
//
// Renders every published path grouped into sections by path-type label,
// iterating PATH_TYPES in its declared canonical order.
// Empty sections are omitted entirely (EXPL-02 absent-not-empty pattern
// extended to sections — do not render an empty <section>).
//
// Auth: getCurrentUser() is called first as an auth assertion (must stay OUTSIDE
// any 'use cache' boundary per RESEARCH Pitfall 2). proxy.ts already redirects
// unauthenticated requests before this page renders.
//
// PATH_TYPES imported from src/lib/pathTypes.ts (NOT from 'use server' action
// file) to avoid importing a 'use server' module from a Server Component (D-05).

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

import { getCurrentUser } from '@/lib/auth'
import { getPublishedPaths, getPathWithNodes } from '@/data/collectionPaths'
import { PATH_TYPES } from '@/lib/pathTypes'
import { PathCard } from '@/components/explore/PathCard'
import type { PathType } from '@/lib/pathTypes'

export const metadata = {
  title: 'Collection Paths — Horlo',
}

export default async function CollectionPathsPage() {
  // Auth assertion — must stay OUTSIDE any 'use cache' boundary.
  await getCurrentUser()

  // Fetch every published path and resolve nodes for each
  const allPaths = await getPublishedPaths(100)
  const pathsWithNodes = await Promise.all(
    allPaths.map((path) => getPathWithNodes(path.id))
  )

  // Filter out any null results (defensive — published paths should always resolve)
  const validPaths = pathsWithNodes.filter(
    (p): p is NonNullable<typeof p> => p !== null
  )

  // Group paths by pathType.
  // WR-04: collection_paths.pathType is a free `text` column (text + CHECK,
  // not an enum). A blind `as PathType` cast would let a path whose type is
  // outside PATH_TYPES (CHECK drift, a new value not yet in pathTypes.ts, a
  // manual DB edit) group under a key the render loop never visits — so the
  // published path would silently disappear with no error and no log.
  // Partition explicitly: only group KNOWN types, and log any unknowns so a
  // vocabulary drift is surfaced rather than hidden.
  const knownTypes = new Set<string>(PATH_TYPES)
  const pathsByType = new Map<PathType, typeof validPaths>()
  const unknownTypePaths: typeof validPaths = []
  for (const path of validPaths) {
    if (knownTypes.has(path.pathType)) {
      const type = path.pathType as PathType
      if (!pathsByType.has(type)) pathsByType.set(type, [])
      pathsByType.get(type)!.push(path)
    } else {
      unknownTypePaths.push(path)
    }
  }
  if (unknownTypePaths.length > 0) {
    console.error(
      '[CollectionPathsPage] published path(s) with an unknown pathType — not in PATH_TYPES:',
      unknownTypePaths.map((p) => ({ id: p.id, pathType: p.pathType })),
    )
  }

  return (
    <main className="container mx-auto px-4 md:px-8 py-8 max-w-6xl">
      {/* Back link */}
      <Link
        href="/explore"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Explore
      </Link>

      <h1 className="text-2xl font-semibold text-foreground mt-4 mb-8">
        Collection Paths
      </h1>

      {/* Sections in PATH_TYPES declared order: Going Deeper → Branching Out → Trading Up → Filling a Gap */}
      {PATH_TYPES.filter((type) => (pathsByType.get(type)?.length ?? 0) > 0).map((type) => {
        const typePaths = pathsByType.get(type)!
        return (
          <section key={type} className="mb-10">
            <h2 className="text-xl font-semibold text-foreground mb-4">{type}</h2>
            <div className="flex flex-col gap-8">
              {typePaths.map((pathWithNodes) => (
                <PathCard key={pathWithNodes.id} pathWithNodes={pathWithNodes} />
              ))}
            </div>
          </section>
        )
      })}

      {/* WR-04: trailing "Other" section — published paths whose pathType is
          outside PATH_TYPES are still rendered here rather than silently
          dropped. This should normally be empty (the DB CHECK constraint is
          layer 1); it is a safety net against vocabulary drift. */}
      {unknownTypePaths.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-foreground mb-4">Other</h2>
          <div className="flex flex-col gap-8">
            {unknownTypePaths.map((pathWithNodes) => (
              <PathCard key={pathWithNodes.id} pathWithNodes={pathWithNodes} />
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
