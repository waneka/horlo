import { notFound } from 'next/navigation'
import Image from 'next/image'
import { and, eq } from 'drizzle-orm'

import { getCurrentUser } from '@/lib/auth'
import { getCatalogById } from '@/data/catalog'
import { getWatchesByUser } from '@/data/watches'
import { getPreferencesByUser } from '@/data/preferences'
import { computeVerdictBundle } from '@/lib/verdict/composer'
import { computeViewerTasteProfile } from '@/lib/verdict/viewerTasteProfile'
import { catalogEntryToSimilarityInput } from '@/lib/verdict/shims'
import { CollectionFitCard } from '@/components/insights/CollectionFitCard'
import { db } from '@/db'
import { watches as watchesTable } from '@/db/schema'
import type { Watch } from '@/lib/types'
import type { VerdictBundle } from '@/lib/verdict/types'

interface CatalogPageProps {
  params: Promise<{ catalogId: string }>
}

/**
 * Phase 20 D-10 — /catalog/[catalogId] route (locked per Plan-Checker resolution
 * of RESEARCH Open Q4 / Option A).
 *
 * - Looks up by watches_catalog.id (catalog UUID), NOT watches.id.
 * - Computes verdict against viewer's own collection (D-03 server compute).
 * - D-07: when viewer collection is empty → no verdict card.
 * - D-08: when viewer already owns a watch with this catalogId → "You own this"
 *   framing — no verdict computed; link points to viewer's per-user /watch/[id].
 *
 * Existing /watch/[id]/page.tsx (per-user UUID lookup) stays byte-untouched.
 *
 * Security: findViewerWatchByCatalogId scopes by BOTH userId AND catalogId —
 * viewer can never read another user's watches.id even if catalogIds collide
 * across users (expected: multiple users own the same catalog ref). T-20-06-01.
 */
export default async function CatalogPage({ params }: CatalogPageProps) {
  const { catalogId } = await params
  const user = await getCurrentUser()

  const [catalogEntry, collection, preferences, viewerOwnedRow] = await Promise.all([
    getCatalogById(catalogId),
    getWatchesByUser(user.id),
    getPreferencesByUser(user.id),
    findViewerWatchByCatalogId(user.id, catalogId),
  ])

  if (!catalogEntry) notFound()

  let verdict: VerdictBundle | null = null

  if (viewerOwnedRow) {
    // D-08 — viewer already owns this catalog ref; swap to "You own this" framing.
    verdict = {
      framing: 'self-via-cross-user',
      ownedAtIso: viewerOwnedRow.acquisitionDate ?? new Date().toISOString(),
      ownerHref: `/watch/${viewerOwnedRow.id}`,
    }
  } else if (collection.length > 0) {
    // D-03/D-07 — cross-user framing, full verdict.
    const profile = await computeViewerTasteProfile(collection)
    const candidate: Watch = catalogEntryToSimilarityInput(catalogEntry)
    verdict = computeVerdictBundle({
      candidate,
      catalogEntry,
      collection,
      preferences,
      profile,
      framing: 'cross-user',
    })
  }
  // else: collection.length === 0 → verdict stays null → no card (D-07)

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
      <div className="flex items-start gap-4">
        {catalogEntry.imageUrl && (
          <div className="size-24 rounded-md bg-muted overflow-hidden flex-shrink-0">
            <Image
              src={catalogEntry.imageUrl}
              alt={`${catalogEntry.brand} ${catalogEntry.model}`}
              width={96}
              height={96}
              className="object-cover w-full h-full"
              unoptimized
            />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-semibold">
            {catalogEntry.brand} {catalogEntry.model}
          </h1>
          {catalogEntry.reference && (
            <p className="text-sm text-muted-foreground">{catalogEntry.reference}</p>
          )}
          <SpecsSublabel
            movement={catalogEntry.movement}
            caseSizeMm={catalogEntry.caseSizeMm}
            dialColor={catalogEntry.dialColor}
          />
        </div>
      </div>

      {verdict && <CollectionFitCard verdict={verdict} />}
    </div>
  )
}

function SpecsSublabel({
  movement,
  caseSizeMm,
  dialColor,
}: {
  movement: string | null
  caseSizeMm: number | null
  dialColor: string | null
}) {
  const parts = [
    movement,
    caseSizeMm ? `${caseSizeMm}mm` : null,
    dialColor,
  ].filter((p): p is string => Boolean(p))
  if (parts.length === 0) return null
  return <p className="text-sm text-muted-foreground">{parts.join(' • ')}</p>
}

/**
 * D-08 detection — does the viewer already own a row in `watches` with this
 * catalogId? If yes, return the row (we need its id + acquisitionDate for the
 * "You own this" callout). If no, return null.
 *
 * T-20-06-01: query is scoped by BOTH userId AND catalogId — the viewer can
 * never read another user's watches.id even if catalogIds collide across users.
 */
async function findViewerWatchByCatalogId(
  userId: string,
  catalogId: string,
): Promise<{ id: string; acquisitionDate: string | null } | null> {
  const rows = await db
    .select({
      id: watchesTable.id,
      acquisitionDate: watchesTable.acquisitionDate,
      createdAt: watchesTable.createdAt,
    })
    .from(watchesTable)
    .where(and(eq(watchesTable.userId, userId), eq(watchesTable.catalogId, catalogId)))
    .limit(1)
  if (rows.length === 0) return null
  const row = rows[0]
  // acquisitionDate is text (ISO yyyy-mm-dd) or null.
  // createdAt is a Date object from Drizzle's timestamp mapping.
  // VerdictBundleSelfOwned.ownedAtIso is string (ISO date).
  const iso = row.acquisitionDate !== null
    ? row.acquisitionDate
    : new Date(row.createdAt).toISOString()
  return { id: row.id, acquisitionDate: iso }
}
