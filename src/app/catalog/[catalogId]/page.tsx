import { notFound } from 'next/navigation'
import Image from 'next/image'
import { and, eq } from 'drizzle-orm'

import { getCurrentUser } from '@/lib/auth'
import { getCatalogById } from '@/data/catalog'
import { getWatchesByUser } from '@/data/watches'
import { getPreferencesByUser } from '@/data/preferences'
import { getProfileById } from '@/data/profiles'
import { computeVerdictBundle } from '@/lib/verdict/composer'
import { computeViewerTasteProfile } from '@/lib/verdict/viewerTasteProfile'
import { catalogEntryToSimilarityInput } from '@/lib/verdict/shims'
import { CollectionFitCard } from '@/components/insights/CollectionFitCard'
import { ReferenceIdentityCard } from '@/components/insights/ReferenceIdentityCard'
import { OtherOwnersRoster } from '@/components/insights/OtherOwnersRoster'
import { SameFamilyRail } from '@/components/insights/SameFamilyRail'
import { LineageRail } from '@/components/insights/LineageRail'
import { CatalogPageActions, type CatalogActionsSpec } from '@/components/watch/CatalogPageActions'
import { getCollectorsForCatalog } from '@/data/discovery'
import { getSameFamilyForCatalog, getLineageForReference } from '@/data/hierarchy'
import { db } from '@/db'
import { watches as watchesTable } from '@/db/schema'
import type { Watch, MovementType, CrystalType, CatalogTasteAttributes } from '@/lib/types'
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
  // Defense-in-depth: validate UUID format before any DB query so malformed
  // URLs (e.g. /catalog/not-a-uuid) collapse cleanly to 404 instead of bubbling
  // up Postgres "invalid input syntax for uuid" as a 500 error boundary.
  // Mirrors src/app/watch/new/page.tsx's catalogId regex check (Phase 20.1).
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(catalogId)) {
    notFound()
  }
  const user = await getCurrentUser()

  // Phase 28 D-02 / UX-09 — viewer username for the inline Wishlist commit
  // toast destination. Resolved server-side; threaded to CatalogPageActions
  // as a typed prop. Null is a soft alarm — at v4.0+ every authenticated user
  // has a username via signup trigger. Folded into the existing Promise.all
  // to keep the parallel-fetch character intact.
  const [catalogEntry, collection, preferences, viewerOwnedRow, viewerProfile, roster, sameFamily, lineage] = await Promise.all([
    getCatalogById(catalogId),
    getWatchesByUser(user.id),
    getPreferencesByUser(user.id),
    findViewerWatchByCatalogId(user.id, catalogId),
    getProfileById(user.id),
    // Phase 39b NSV-18 — catalog other-owners roster (two-layer privacy +
    // self-exclusion + sold-status filter inside the DAL; OtherOwnersRoster
    // returns null when collectors.length === 0 per D-39b-07).
    getCollectorsForCatalog(catalogId, user.id, { limit: 5 }),
    // Phase 39b NSV-02 — same-family rail data. catalogId from route params
    // is non-nullable (UUID regex gate at lines 49-51 ensures it exists), so
    // no falsy-fallback is needed (unlike /watch/[id] which guards on
    // watch.catalogId). D-39b-15 live COUNT ranking; D-39b-17 cap LIMIT 6.
    getSameFamilyForCatalog(catalogId),
    // Phase 39b NSV-16 — lineage rail data. Same non-nullable catalogId.
    // LineageRail.tsx caps at 6 cards via .slice(0, 6).
    getLineageForReference(catalogId),
  ])
  const viewerUsername = viewerProfile?.username ?? null

  if (!catalogEntry) notFound()

  // Phase 39b NSV-20 — adapt the top-level CatalogEntry taste fields to a
  // CatalogTasteAttributes literal so ReferenceIdentityCard (which consumes the
  // canonical Watch.catalogTaste shape) renders identically on both surfaces.
  // Pitfall 9: catalog taste fields live at the top level on CatalogEntry, not
  // nested under a `catalogTaste` key — explicit field-by-field projection.
  // Phase 49.1 D-SCOPE-01e + Pitfall 3 — projection drops primaryArchetype
  // alongside the type-system change at src/lib/types.ts and the watches.ts
  // LEFT JOIN mapper. All three sites change atomically to preserve the
  // D-39b-04 identical-rendering lock.
  const catalogTaste: CatalogTasteAttributes | null = {
    formality: catalogEntry.formality,
    sportiness: catalogEntry.sportiness,
    heritageScore: catalogEntry.heritageScore,
    eraSignal: catalogEntry.eraSignal,
    designMotifs: catalogEntry.designMotifs,
    confidence: catalogEntry.confidence,
    extractedFromPhoto: catalogEntry.extractedFromPhoto,
  }

  let verdict: VerdictBundle | null = null
  let actionsSpec: CatalogActionsSpec | null = null

  if (viewerOwnedRow) {
    // D-08 — viewer already owns this catalog ref; swap to "You own this" framing.
    verdict = {
      framing: 'self-via-cross-user',
      ownedAtIso: viewerOwnedRow.acquisitionDate ?? new Date().toISOString(),
      ownerHref: `/watch/${viewerOwnedRow.id}`,
    }
    // Phase 20.1 D-05 — self-via-cross-user keeps existing 'You own this' UI;
    // do NOT render CatalogPageActions.
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
    // Phase 20.1 D-05 — cross-user framing with non-empty collection → render
    // CatalogPageActions. strapType is per-user (catalog table doesn't carry
    // it) so we set it to null literally.
    actionsSpec = {
      brand: catalogEntry.brand,
      model: catalogEntry.model,
      reference: catalogEntry.reference,
      movement: catalogEntry.movementType,
      caseSizeMm: catalogEntry.caseSizeMm,
      lugToLugMm: catalogEntry.lugToLugMm,
      waterResistanceM: catalogEntry.waterResistanceM,
      strapType: null,
      crystalType: catalogEntry.crystalType as CrystalType | null,
      dialColor: catalogEntry.dialColor,
      isChronometer: catalogEntry.isChronometer,
      complications: catalogEntry.complications ?? [],
      styleTags: catalogEntry.styleTags ?? [],
      designTraits: catalogEntry.designTraits ?? [],
      imageUrl: catalogEntry.imageUrl,
    }
  } else {
    // Phase 39b NSV-20 — fresh-account viewer (collection.length === 0). Verdict
    // stays null (no collection to score against), but actionsSpec is built so
    // the 3-CTA block (Add to Wishlist / Add to Collection / Skip) still renders.
    // Above the CTAs, ReferenceIdentityCard or the fallback caption renders
    // (D-39b-04 — identical to /watch/[id]). This supersedes the prior Phase 20
    // "no card, no CTAs" suppression.
    actionsSpec = {
      brand: catalogEntry.brand,
      model: catalogEntry.model,
      reference: catalogEntry.reference,
      movement: catalogEntry.movementType,
      caseSizeMm: catalogEntry.caseSizeMm,
      lugToLugMm: catalogEntry.lugToLugMm,
      waterResistanceM: catalogEntry.waterResistanceM,
      strapType: null,
      crystalType: catalogEntry.crystalType as CrystalType | null,
      dialColor: catalogEntry.dialColor,
      isChronometer: catalogEntry.isChronometer,
      complications: catalogEntry.complications ?? [],
      styleTags: catalogEntry.styleTags ?? [],
      designTraits: catalogEntry.designTraits ?? [],
      imageUrl: catalogEntry.imageUrl,
    }
  }

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
            movement={catalogEntry.movementType}
            caseSizeMm={catalogEntry.caseSizeMm}
            dialColor={catalogEntry.dialColor}
          />
        </div>
      </div>

      {verdict && <CollectionFitCard verdict={verdict} />}

      {/* Phase 39b NSV-20 — Fresh-account viewer (collection.length === 0):
          ReferenceIdentityCard OR fallback caption. D-39b-04: identical
          conditional shape to /watch/[id]/page.tsx. D-39b-03 confidence gate
          mirrored explicitly in caller; ReferenceIdentityCard also gates
          internally as defense-in-depth. */}
      {collection.length === 0 &&
        catalogTaste &&
        catalogTaste.confidence !== null &&
        catalogTaste.confidence >= 0.5 && (
          <ReferenceIdentityCard taste={catalogTaste} />
        )}
      {collection.length === 0 &&
        (!catalogTaste ||
          catalogTaste.confidence === null ||
          catalogTaste.confidence < 0.5) && (
          <p className="text-sm text-muted-foreground">
            Add a few watches to see how this one fits your collection.
          </p>
        )}

      {/* Phase 39b NSV-18 — Other-Owners Roster. Position #2 in UI-SPEC
          §Render Order (between the verdict card and the family rails). The
          component self-hides when collectors.length === 0 (D-39b-07), so
          no caller-side conditional wrapper is needed. /watch/{id} does
          NOT get this roster — catalog-only per UI-SPEC §Render Order. */}
      <OtherOwnersRoster collectors={roster.collectors} totalCount={roster.totalCount} />

      {/* Phase 39b NSV-02 + NSV-16 — Same family + Lineage rails. UI-SPEC
          §Render Order position #3/#4 — AFTER OtherOwnersRoster (Plan 39b-04)
          and BEFORE the CTA block. Both rails self-hide via internal
          rows.length === 0 guard (D-39b-07). */}
      <SameFamilyRail rows={sameFamily} />
      <LineageRail rows={lineage} />

      {/* Phase 20.1 D-05 + Phase 39b NSV-20 — 3-CTA block. Now also rendered in
          the fresh-account branch (collection.length === 0) so NSV-20 closes
          the empty-collection dead-end. actionsSpec is null only in the
          self-via-cross-user case (D-05 keeps "You own this"). */}
      {actionsSpec && (
        <CatalogPageActions
          catalogId={catalogId}
          spec={actionsSpec}
          framing="cross-user"
          viewerUsername={viewerUsername}
        />
      )}
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
    .where(and(
      eq(watchesTable.userId, userId),
      eq(watchesTable.catalogId, catalogId),
      eq(watchesTable.status, 'owned'),  // BUG-01 fix (D-02): only 'owned' rows are "truly owned"
    ))
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
