/**
 * Mirrors the Collection tab's `settings.collectionPublic` gate for the
 * Worn tab's watch lists (D-14, RESEARCH Pitfall 5, T-84-LEAK).
 *
 * `getWearEventsForViewer` remains the single per-row wear-event
 * visibility gate. This helper only decides which WATCHES a non-owner
 * viewer is allowed to see on the Worn tab, so that zero-wear leaderboard
 * rows never reveal the existence of a watch in a private collection.
 * The owner and viewers of a public collection get the full owned list;
 * a non-owner viewer of a private collection only sees watches they've
 * already seen a wear for.
 *
 * Kept free of `next/`, `@/data/*`, and `@/lib/supabase*` imports so it
 * stays a pure, framework-agnostic helper testable without rendering the
 * Suspense / `'use cache'` page (84-06 wires this into
 * `src/app/u/[username]/[tab]/page.tsx`).
 */
export function scopeWornTabWatches<W extends { id: string; status: string }>(
  input: {
    isOwner: boolean
    collectionPublic: boolean
    watches: W[]
    eventWatchIds: ReadonlySet<string>
  },
): { ownedWatches: W[]; mapWatches: W[] } {
  const { isOwner, collectionPublic, watches, eventWatchIds } = input
  const owned = watches.filter((w) => w.status === 'owned')

  if (isOwner) {
    return { ownedWatches: owned, mapWatches: watches }
  }

  const referenced = (w: W) => eventWatchIds.has(w.id)
  const mapWatches = watches.filter(referenced)
  const ownedWatches = collectionPublic ? owned : owned.filter(referenced)
  return { ownedWatches, mapWatches }
}

/**
 * Minimal, serializable watch shape the Worn tab's client components read
 * (84-REVIEW CR-02). `WornTabContent` is a `'use client'` component, so every
 * prop is serialized into the RSC payload — full `Watch` rows would ship
 * `pricePaid`, `targetPrice`, `marketPrice`, `acquisitionDate`, `notes` and
 * `notesPublic` to any viewer. `scopeWornTabWatches` limits WHICH rows a
 * viewer gets; this projection limits WHICH FIELDS cross the boundary.
 * Consumers: `WearLeaderboard` (id/brand/model/imageUrl), the watch filter +
 * `LogTodaysWearButton` listbox (id/brand/model), `watchMap` (all four).
 */
export interface WornTabWatchSummary {
  id: string
  brand: string
  model: string
  imageUrl: string | null
}

export function toWornTabWatchSummary(w: {
  id: string
  brand: string
  model: string
  imageUrl?: string | null
}): WornTabWatchSummary {
  // Explicit field pick (never a spread) so new Watch columns can't leak.
  return { id: w.id, brand: w.brand, model: w.model, imageUrl: w.imageUrl ?? null }
}
