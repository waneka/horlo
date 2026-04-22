import { notFound } from 'next/navigation'
import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
import {
  getProfileByUsername,
  getProfileSettings,
} from '@/data/profiles'
import { getWatchesByUser } from '@/data/watches'
import {
  getMostRecentWearDates,
  getWearEventsForViewer,
  getAllWearEventsByUser,
} from '@/data/wearEvents'
import { getPreferencesByUser } from '@/data/preferences'
import { CollectionTabContent } from '@/components/profile/CollectionTabContent'
import { WishlistTabContent } from '@/components/profile/WishlistTabContent'
import { NotesTabContent } from '@/components/profile/NotesTabContent'
import { WornTabContent } from '@/components/profile/WornTabContent'
import { StatsTabContent } from '@/components/profile/StatsTabContent'
import { LockedTabCard } from '@/components/profile/LockedTabCard'
import { CommonGroundTabContent } from '@/components/profile/CommonGroundTabContent'
import { resolveCommonGround } from '../common-ground-gate'
import {
  styleDistribution,
  roleDistribution,
  topMostWorn,
  topLeastWorn,
  buildObservations,
  bucketWearsByWeekday,
  wearCountByWatchMap,
} from '@/lib/stats'
import type { WatchWithWear } from '@/lib/types'

const VALID_TABS = [
  'collection',
  'wishlist',
  'worn',
  'notes',
  'stats',
  'common-ground',
] as const
type Tab = (typeof VALID_TABS)[number]

export default async function ProfileTabPage({
  params,
}: {
  params: Promise<{ username: string; tab: string }>
}) {
  const { username, tab } = await params
  if (!VALID_TABS.includes(tab as Tab)) notFound()

  const profile = await getProfileByUsername(username)
  if (!profile) notFound()

  // Resolve viewer (anonymous viewers stay null without throwing).
  let viewerId: string | null = null
  try {
    viewerId = (await getCurrentUser()).id
  } catch (err) {
    if (!(err instanceof UnauthorizedError)) throw err
  }
  const isOwner = viewerId === profile.id
  const settings = await getProfileSettings(profile.id)
  const displayName = profile.displayName ?? null
  const ownerDisplayLabel = profile.displayName ?? `@${profile.username}`

  // Common Ground tab — handled first, same gate as the layout's hero band
  // (single-sourced in common-ground-gate.ts). On any gate failure or empty
  // overlap, emit a 404 per D-02 / D-17 — the tab is never "locked", only
  // absent or present. React cache() on getTasteOverlapData means this is a
  // free call when the layout already computed it.
  if (tab === 'common-ground') {
    const overlap = await resolveCommonGround({
      viewerId,
      ownerId: profile.id,
      isOwner,
      collectionPublic: settings.collectionPublic,
    })
    if (!overlap || !overlap.hasAny) notFound()
    return (
      <CommonGroundTabContent
        overlap={overlap}
        ownerDisplayLabel={ownerDisplayLabel}
      />
    )
  }

  // The shared layout already short-circuits when profile_public=false && !isOwner.
  // Per-tab visibility (PRIV-02 / PRIV-03 / PRIV-04):
  if (tab === 'collection' && !isOwner && !settings.collectionPublic) {
    return (
      <LockedTabCard
        tab="collection"
        displayName={displayName}
        username={profile.username}
      />
    )
  }
  if (tab === 'wishlist' && !isOwner && !settings.wishlistPublic) {
    return (
      <LockedTabCard
        tab="wishlist"
        displayName={displayName}
        username={profile.username}
      />
    )
  }
  // Phase 12 (WYWT-10): worn-tab LockedTabCard branch removed. Per-row
  // visibility (wear_events.visibility) means non-owner viewers now see a
  // pre-filtered list — empty array → WornTabContent's empty state. The
  // tab-level lock is unreachable now that per-row gating runs at the DAL
  // layer (getWearEventsForViewer in src/data/wearEvents.ts).

  // WR-01: Notes surface the underlying watch (brand/model/image + link),
  // so gating only on per-note notesPublic leaks the collection through a
  // side channel whenever the owner has hidden their collection. Mirror the
  // Stats gate (line ~136) and require collection_public for non-owners.
  if (tab === 'notes' && !isOwner && !settings.collectionPublic) {
    return (
      <LockedTabCard
        tab="notes"
        displayName={displayName}
        username={profile.username}
      />
    )
  }

  // Collection / Wishlist / Notes share the watches+wear data fetch.
  if (tab === 'collection' || tab === 'wishlist' || tab === 'notes') {
    const watches = await getWatchesByUser(profile.id)
    const wearDates = await getMostRecentWearDates(
      profile.id,
      watches.map((w) => w.id),
    )

    if (tab === 'collection') {
      return (
        <CollectionTabContent
          watches={watches.filter((w) => w.status === 'owned')}
          wearDates={Object.fromEntries(wearDates)}
          isOwner={isOwner}
        />
      )
    }
    if (tab === 'wishlist') {
      return (
        <WishlistTabContent
          watches={watches.filter(
            (w) => w.status === 'wishlist' || w.status === 'grail',
          )}
          wearDates={Object.fromEntries(wearDates)}
          isOwner={isOwner}
        />
      )
    }
    // tab === 'notes' — per-note visibility (D-13): non-owners only see notes_public !== false
    const notedWatches = watches.filter(
      (w) =>
        Boolean(w.notes && w.notes.trim()) &&
        (isOwner || w.notesPublic !== false),
    )
    return <NotesTabContent watches={notedWatches} isOwner={isOwner} />
  }

  if (tab === 'worn') {
    // DAL visibility gate (PRIV-05 / Phase 12 WYWT-10): three-tier predicate;
    // owner bypass handled inside getWearEventsForViewer.
    const events = await getWearEventsForViewer(viewerId, profile.id)
    const watches = await getWatchesByUser(profile.id)
    const watchMap = Object.fromEntries(
      watches.map((w) => [
        w.id,
        {
          id: w.id,
          brand: w.brand,
          model: w.model,
          imageUrl: w.imageUrl ?? null,
        },
      ]),
    )
    return (
      <WornTabContent
        events={events.map((e) => ({
          id: e.id,
          watchId: e.watchId,
          wornDate: e.wornDate,
          note: e.note ?? null,
        }))}
        watchMap={watchMap}
        isOwner={isOwner}
      />
    )
  }

  // tab === 'stats' — collection-derived, so it follows collection_public for non-owners.
  // Wear data is gated separately via getWearEventsForViewer (Phase 12 WYWT-10: returns
  // only per-row visible events for non-owners) — stats render with visible events only.
  if (!isOwner && !settings.collectionPublic) {
    return (
      <LockedTabCard
        tab="stats"
        displayName={displayName}
        username={profile.username}
      />
    )
  }
  const watches = await getWatchesByUser(profile.id)
  const ownedAll = watches.filter((w) => w.status === 'owned')
  const events = isOwner
    ? await getAllWearEventsByUser(profile.id)
    : await getWearEventsForViewer(viewerId, profile.id)
  const wearCount = wearCountByWatchMap(events)
  // Build WatchWithWear list — populate lastWornDate from the first (most-recent) event per watch.
  const ownedWithWear: WatchWithWear[] = ownedAll.map((w) => {
    const first = events.find((e) => e.watchId === w.id)
    return { ...w, lastWornDate: first?.wornDate ?? undefined }
  })
  const prefs = await getPreferencesByUser(profile.id).catch(() => null)
  const observations = buildObservations({
    ownedWatches: ownedWithWear,
    goal: prefs?.collectionGoal ?? null,
    weekdayCounts: bucketWearsByWeekday(events),
  })
  return (
    <StatsTabContent
      ownedWatches={ownedAll}
      styleRows={styleDistribution(ownedAll)}
      roleRows={roleDistribution(ownedAll)}
      mostWorn={topMostWorn(ownedAll, wearCount, 3)}
      leastWorn={topLeastWorn(ownedAll, wearCount, 3)}
      observations={observations}
    />
  )
}
