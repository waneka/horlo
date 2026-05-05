import { redirect } from 'next/navigation'

import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
import { getWatchesByUser } from '@/data/watches'
import { getCatalogById } from '@/data/catalog'
import { getProfileById } from '@/data/profiles'
import { AddWatchFlow } from '@/components/watch/AddWatchFlow'
import { validateReturnTo } from '@/lib/watchFlow/destinations'
import type { ExtractedWatchData } from '@/lib/extractors'
import type { MovementType, CrystalType } from '@/lib/types'

/**
 * Phase 20.1 D-01 + D-02 — /watch/new becomes the state-machine root.
 *
 * Server Component responsibilities:
 *   1. Auth-gate via getCurrentUser (proxy already handles redirect, but
 *      the per-route gate stays for defense-in-depth).
 *   2. Compute collectionRevision = viewer.collection.length for verdict
 *      cache invalidation key (Phase 20 D-06 contract).
 *   3. Resolve searchParams (Pitfall 1: Promise in Next.js 16); whitelist
 *      `intent` to literal 'owned' or null; resolve `catalogId` to the
 *      synthesized ExtractedWatchData via getCatalogById.
 *   4. Render heading (D-02 reframe) + AddWatchFlow.
 *
 * Pitfall 1: searchParams is a Promise. Always await before destructuring.
 * Per node_modules/next/dist/docs (Next.js 16) — Promise searchParams is the
 * canonical async access pattern.
 */
interface NewWatchPageProps {
  searchParams: Promise<{
    catalogId?: string
    intent?: string
    /** Phase 25 D-09: literal-match whitelisted to '1'; skips paste in AddWatchFlow. */
    manual?: string
    /** Phase 25 D-05: literal-match whitelisted to 'wishlist'; presets the
     *  manual-entry WatchForm's status field (still user-editable). */
    status?: string
    /** Phase 28 D-11: validated server-side via validateReturnTo(); invalid → null
     *  → AddWatchFlow falls back to default destination per D-13. */
    returnTo?: string
  }>
}

export default async function NewWatchPage({ searchParams }: NewWatchPageProps) {
  let user: { id: string; email: string }
  try {
    user = await getCurrentUser()
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      redirect('/signin')
    }
    throw err
  }

  const sp = await searchParams

  // Whitelist intent (Security T-20.1-04-01): only literal 'owned' is allowed.
  const initialIntent: 'owned' | null = sp.intent === 'owned' ? 'owned' : null

  // Phase 25 T-25-05-01 mitigation: literal-match whitelist for `manual` and
  // `status`. Both flow into AddWatchFlow as local FlowState only — NEVER used
  // to construct a URL. Defense-in-depth: server whitelist + client typing both
  // reject anything else.
  const initialManual: boolean = sp.manual === '1'
  const initialStatus: 'wishlist' | null = sp.status === 'wishlist' ? 'wishlist' : null

  // Validate catalogId is a UUID-shaped string before fetching (defense-in-depth
  // for T-20.1-04-02 — getCatalogById uses Drizzle parameterized queries so SQL
  // injection is not viable, but the regex prevents arbitrary strings from
  // hitting the DAL at all).
  const catalogId =
    typeof sp.catalogId === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sp.catalogId)
      ? sp.catalogId
      : null

  // Phase 28 D-11 — validate returnTo via shared validator (mirrors the
  // auth-callback regex + adds a self-loop guard against /watch/new). Invalid
  // values collapse to null silently; AddWatchFlow then routes to the D-13
  // default destination on commit.
  const initialReturnTo = validateReturnTo(sp.returnTo)

  // Phase 28 D-02 / D-06 — resolve the viewer's username server-side so:
  //   1. /u/me/... shorthand canonicalization (D-06) can resolve correctly.
  //   2. The Plan 05 default-destination logic can build /u/{username}/{tab}.
  //   3. The Plan 04 toast suppress comparison can compare apples-to-apples.
  // At v4.0+ every authenticated user has a username via the signup trigger,
  // so null here is a soft alarm — the flow falls back to "no toast" + "/"
  // default destination.
  const [collection, catalogPrefill, viewerProfile] = await Promise.all([
    getWatchesByUser(user.id),
    catalogId ? hydrateCatalogPrefill(catalogId) : Promise.resolve(null),
    getProfileById(user.id),
  ])
  const viewerUsername = viewerProfile?.username ?? null

  // FORM-04 — per-request nonce as React key on AddWatchFlow. Forces remount
  // on every entry to /watch/new (CONTEXT D-12, D-13). Safe to call here
  // because the page is already dynamic via the await searchParams above
  // (Request-time API). DO NOT add 'use cache' to this file; the nonce must
  // be per-request, not per-build (RESEARCH Pitfall 2).
  const flowKey = crypto.randomUUID()

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="font-serif text-3xl md:text-4xl text-foreground mb-8">
        Add a watch — or just evaluate one
      </h1>
      <AddWatchFlow
        key={flowKey}
        collectionRevision={collection.length}
        initialCatalogId={catalogId}
        initialIntent={initialIntent}
        initialCatalogPrefill={catalogPrefill}
        initialManual={initialManual}
        initialStatus={initialStatus}
        initialReturnTo={initialReturnTo}
        viewerUsername={viewerUsername}
      />
    </div>
  )
}

/**
 * Build an ExtractedWatchData prefill from a catalog row so the deep-link
 * (`/watch/new?catalogId=X&intent=owned`) can advance the flow directly to
 * form-prefill without a paste round-trip.
 *
 * getCatalogById returns null for a non-existent / malformed id; we mirror
 * that to null so the flow falls back to idle.
 */
async function hydrateCatalogPrefill(
  catalogId: string,
): Promise<ExtractedWatchData | null> {
  const entry = await getCatalogById(catalogId)
  if (!entry) return null
  return {
    brand: entry.brand,
    model: entry.model,
    reference: entry.reference ?? undefined,
    movement: (entry.movement as MovementType | null) ?? undefined,
    caseSizeMm: entry.caseSizeMm ?? undefined,
    lugToLugMm: entry.lugToLugMm ?? undefined,
    waterResistanceM: entry.waterResistanceM ?? undefined,
    crystalType: (entry.crystalType as CrystalType | null) ?? undefined,
    dialColor: entry.dialColor ?? undefined,
    isChronometer: entry.isChronometer ?? undefined,
    complications: entry.complications ?? [],
    styleTags: entry.styleTags ?? [],
    designTraits: entry.designTraits ?? [],
    imageUrl: entry.imageUrl ?? undefined,
  }
}

