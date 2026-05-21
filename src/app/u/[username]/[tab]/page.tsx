import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
import { ProfileShellResolver } from '../profile-shell-resolver'
import { ProfileTabContentSkeleton } from '../profile-shell-skeleton'
import {
  getMostRecentWearDates,
  getWearEventsForViewer,
} from '@/data/wearEvents'
import { getPreferencesByUser } from '@/data/preferences'
import { CollectionTabContent } from '@/components/profile/CollectionTabContent'
import { WishlistTabContent } from '@/components/profile/WishlistTabContent'
import { NotesTabContent } from '@/components/profile/NotesTabContent'
import { WornTabContent } from '@/components/profile/WornTabContent'
import { StatsTabContent } from '@/components/profile/StatsTabContent'
import { LockedTabCard } from '@/components/profile/LockedTabCard'
import { CommonGroundTabContent } from '@/components/profile/CommonGroundTabContent'
import { InsightsTabContent } from '@/components/profile/InsightsTabContent'
import { resolveCommonGround } from '../common-ground-gate'
import { isFollowing } from '@/data/follows'
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

// Phase 52 D-52-16 structural lock — OUTER SYNC, INNER ASYNC inside
// <Suspense>. The outer ProfileTabPage is a pure JSX scaffold: it
// receives `params` (Promise) and passes it UNCHANGED to the inner
// async ProfileTabContent via `paramsPromise`. All runtime API access
// (params await, getCurrentUser, ProfileShellResolver) lives inside
// ProfileTabContent, which the Suspense boundary wraps. This is the
// canonical Next 16 Cache Components / instant-navigation pattern per
// node_modules/next/dist/docs/01-app/01-getting-started/15-instant.md
// (ProductPage example) + audit followup Step 2 + RESEARCH.md Pattern 2.
//
// The `unstable_instant = { prefetch: 'static' }` export below is the
// build/dev validator (Plan 52-03 added it; Plan 52-08 rewrites the
// adjacent stale comment block). The validator + this outer-sync /
// inner-async / Suspense structure together form the recurrence-5
// prevention contract.
//
// D-52-CF-03 / Phase 39c Pitfall 5 PRESERVED — notFound() calls inside
// ProfileTabContent stay in their original relative ordering: invalid
// tab check FIRST (before any await), then viewer resolution, then
// resolver call, then missing-profile notFound BEFORE any subsequent
// awaits (isFollowing, resolveCommonGround, per-tab data fetches).
//
// D-52-CF-02 / Phase 39c Pitfall 1 PRESERVED — viewerId is resolved
// inside ProfileTabContent (uncached async, inside Suspense) and is
// NEVER passed into ProfileShellResolver's cached scope; the resolver
// receives only `{ username }`.
//
// See .planning/phases/52-.../52-CONTEXT.md, 52-RESEARCH.md Pattern 2,
// .planning/audits/cache-components-2026-05-21-followup.md § Step 2.

// Phase 52 D-52-DEV-01 — empirically refined from audit followup Step 1.
// The canonical instant.md example uses `{ prefetch: 'static' }` on a
// single-dynamic-segment route. The Next 16.2.3 validator empirically
// requires samples for routes with dynamic params (the error message
// itself reads "Add it to the sample's `params` object"). Per the
// documented TypeScript interface in
// node_modules/next/.../instant.md, samples is the `RuntimeSample[]`
// shape used with `prefetch: 'runtime'`. Using runtime keeps validation
// active at every shared layout boundary (the recurrence-5 contract
// per D-52-03) while supplying representative param values the
// prerender phase needs to materialize a static shell.
export const unstable_instant: {
  prefetch: 'runtime'
  samples: Array<{ params: Record<string, string> }>
} = {
  prefetch: 'runtime',
  samples: [{ params: { username: 'twwaneka', tab: 'collection' } }],
}

// Phase 52 D-52-11 — DIAGNOSIS REVERSAL of the Phase 39c "REMOVED
// 2026-05-14" entry.
//
// `unstable_instant` is a VALIDATOR, not a runtime feature. The
// Phase 39c-era removal of this export was based on a misreading of
// the recurrence-2 symptom: tree-only RSC payloads + Router Cache
// poisoning were the STRUCTURAL DEFECT (top-level runtime API access
// outside Suspense) manifesting at runtime — the validator was
// correctly flagging it. Removing the export removed the validation,
// not the bug, and recurrences 3 + 4 followed.
//
// Phase 52 reinstates the export AS A VALIDATOR per
// node_modules/next/dist/docs/01-app/02-guides/instant-navigation.md
// ("How validation works") + the audit followup at
// .planning/audits/cache-components-2026-05-21-followup.md
// § "What changed since the original audit" (lines 47-60). The
// validator runs at every shared layout boundary in this route during
// `npm run dev` and `npm run build`; combined with the canonical
// sync-outer + async-inner `ProfileTabContent` inside `<Suspense>`
// shape above (D-52-16 structural lock), it forms the recurrence-5
// prevention contract (D-52-03 — failing build IS the CI gate).
//
// Full decision record: .planning/phases/52-option-d-cache-components-
// canonical-pattern-fix-for-u-userna/52-CONTEXT.md (D-52-11).

const VALID_TABS = [
  'collection',
  'wishlist',
  'worn',
  'notes',
  'stats',
  'common-ground',
  'insights',
] as const
type Tab = (typeof VALID_TABS)[number]

export default function ProfileTabPage({
  params,
}: {
  params: Promise<{ username: string; tab: string }>
}) {
  return (
    <Suspense fallback={<ProfileTabContentSkeleton />}>
      <ProfileTabContent paramsPromise={params} />
    </Suspense>
  )
}

// Exported for unit testing (tests/app/profile-tab-*.test.tsx call this
// directly to exercise dynamic branching without spinning up Suspense).
// The default export is the sync outer wrapper; ProfileTabContent owns
// every dynamic branch.
export async function ProfileTabContent({
  paramsPromise,
}: {
  paramsPromise: Promise<{ username: string; tab: string }>
}) {
  const { username, tab } = await paramsPromise
  if (!VALID_TABS.includes(tab as Tab)) notFound()

  // Resolve viewer FIRST and OUTSIDE the cached ProfileShellResolver scope
  // (Phase 39c Pitfall 1 — D-39c-03). The resolver caches on username only;
  // mixing viewer state into its key would serve the first viewer's overlay
  // data to subsequent viewers.
  let viewerId: string | null = null
  try {
    viewerId = (await getCurrentUser()).id
  } catch (err) {
    if (!(err instanceof UnauthorizedError)) throw err
  }

  // Cached owner-scoped reads — shared with the page-owned ProfileGate via
  // the same `'use cache'` resolver. The second hit from this page is a
  // cache lookup, not a DB roundtrip, so subsequent tab navigations within
  // the 300s cacheLife window are sub-millisecond on the server side. The
  // resolver's `cacheTag('profile:${username}')` is invalidated by the
  // Server Actions wired in Plan 39c-05 (watches add/edit/remove, profile
  // updates, follows, wear events).
  const resolved = await ProfileShellResolver({ username })
  if (!resolved.profile) notFound()
  const { profile, settings, watches: ownerWatches, wearEvents: ownerWearEvents } = resolved
  const isOwner = viewerId === profile.id
  const displayName = profile.displayName ?? null
  const ownerDisplayLabel = profile.displayName ?? `@${profile.username}`

  // Phase 39b D-39b-12 — LockedTabCard FollowButton/sign-in CTA prep.
  // currentPath is a same-origin pathname built from server-side route params
  // (T-39b-03 mitigation — never an absolute URL). initialIsFollowing is
  // computed deterministically using the verified isFollowing helper at
  // src/data/follows.ts:54 and feeds the `<LockedTabCard>` branches below.
  // Gate-level `initialIsFollowing` is now resolved inside the gate itself
  // (in `../layout.tsx → <ProfileGate>`), not piped through the page.
  const currentPath = `/u/${username}/${tab}`
  const initialIsFollowing =
    viewerId !== null && !isOwner
      ? await isFollowing(viewerId, profile.id)
      : false

  // Phase 25 D-09: server-side env-presence check. Only the resolved Boolean
  // crosses the server/client boundary — the API key value itself never does.
  // Used by CollectionTabContent to branch the empty-state CTA between the
  // existing AddWatchCard (key present) and the two-button manual fallback
  // (key missing). T-25-05-06 mitigation per threat register.
  const hasUrlExtract = Boolean(process.env.ANTHROPIC_API_KEY?.trim())

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
    // Pitfall 1 / T-39-01 / D-09: split the previous single-line guard into
    // TWO distinct branches. The `!overlap` branch is a privacy-gate failure
    // (anonymous viewer, !collectionPublic, isOwner) — it MUST keep 404ing or
    // the route leaks the existence of the common-ground tab. The
    // `!overlap.hasAny` branch is a discoverable no-overlap state — it
    // becomes a soft walk-back fallback (NSV-12 / DISC-AUDIT-127).
    if (!overlap) notFound()
    if (!overlap.hasAny) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>No shared watches yet.</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You and @{profile.username} don&apos;t share any watches in your
              collections. That doesn&apos;t mean you don&apos;t share taste —
              try one of these:
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
              <Link
                href={`/u/${profile.username}/collection`}
                className={buttonVariants({ variant: 'default', size: 'default' })}
              >
                Browse {displayName ?? `@${profile.username}`}&apos;s collection →
              </Link>
              <Link
                href="/explore"
                className={buttonVariants({ variant: 'outline', size: 'default' })}
              >
                Find collectors with shared watches →
              </Link>
            </div>
          </CardContent>
        </Card>
      )
    }
    return (
      <CommonGroundTabContent
        overlap={overlap}
        ownerDisplayLabel={ownerDisplayLabel}
      />
    )
  }

  // D-13 / P-08: Insights tab is OWNER-ONLY. Non-owners (and anonymous
  // viewers) get the same uniform 404 as missing routes — no existence
  // leak. ProfileTabs also omits the tab link for non-owners (two-layer
  // privacy per Phase 12 pattern).
  if (tab === 'insights') {
    if (!isOwner) notFound()
    return <InsightsTabContent profileUserId={profile.id} />
  }

  // The shared layout already short-circuits when profile_public=false && !isOwner.
  // Per-tab visibility (PRIV-02 / PRIV-03 / PRIV-04):
  if (tab === 'collection' && !isOwner && !settings.collectionPublic) {
    return (
      <LockedTabCard
        tab="collection"
        displayName={displayName}
        username={profile.username}
        viewerId={viewerId}
        targetUserId={profile.id}
        initialIsFollowing={initialIsFollowing}
        currentPath={currentPath}
      />
    )
  }
  if (tab === 'wishlist' && !isOwner && !settings.wishlistPublic) {
    return (
      <LockedTabCard
        tab="wishlist"
        displayName={displayName}
        username={profile.username}
        viewerId={viewerId}
        targetUserId={profile.id}
        initialIsFollowing={initialIsFollowing}
        currentPath={currentPath}
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
        viewerId={viewerId}
        targetUserId={profile.id}
        initialIsFollowing={initialIsFollowing}
        currentPath={currentPath}
      />
    )
  }

  // Collection / Wishlist / Notes share the watches+wear data fetch.
  // `watches` comes from the cached resolver (shared with the layout);
  // `wearDates` is a small per-tab fetch that stays uncached.
  if (tab === 'collection' || tab === 'wishlist' || tab === 'notes') {
    const watches = ownerWatches
    const wearDates = await getMostRecentWearDates(
      profile.id,
      watches.map((w) => w.id),
    )
    // Phase 25 D-08: collectionCount drives Notes empty-state branching
    // (>0 → picker; 0 → "Add a watch first" CTA). Same array we already
    // loaded — no extra DB round-trip. T-25-05-03: server-derived; non-owner
    // never reaches the count-dependent branch (D-10 short-circuits first).
    const ownedWatches = watches.filter((w) => w.status === 'owned')
    const collectionCount = ownedWatches.length

    if (tab === 'collection') {
      return (
        <CollectionTabContent
          watches={ownedWatches}
          wearDates={Object.fromEntries(wearDates)}
          isOwner={isOwner}
          hasUrlExtract={hasUrlExtract}
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
          username={profile.username}
        />
      )
    }
    // tab === 'notes' — per-note visibility (D-13): non-owners only see notes_public !== false
    const notedWatches = watches.filter(
      (w) =>
        Boolean(w.notes && w.notes.trim()) &&
        (isOwner || w.notesPublic !== false),
    )
    return (
      <NotesTabContent
        watches={notedWatches}
        isOwner={isOwner}
        username={profile.username}
        collectionCount={collectionCount}
        ownedWatches={ownedWatches}
      />
    )
  }

  if (tab === 'worn') {
    // DAL visibility gate (PRIV-05 / Phase 12 WYWT-10): three-tier predicate;
    // owner bypass handled inside getWearEventsForViewer. Events stay
    // viewer-gated and uncached; `watches` comes from the cached resolver
    // shared with the layout.
    const events = await getWearEventsForViewer(viewerId, profile.id)
    const watches = ownerWatches
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
        username={profile.username}
        viewerId={viewerId}
        ownedWatches={watches.filter((w) => w.status === 'owned')}
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
        viewerId={viewerId}
        targetUserId={profile.id}
        initialIsFollowing={initialIsFollowing}
        currentPath={currentPath}
      />
    )
  }
  // `watches` and the owner-view `events` come from the cached resolver
  // (shared with the layout) — owner stats are cache hits within the 300s
  // window. Non-owner views need the viewer-gated `getWearEventsForViewer`
  // call (privacy-safe filtering by per-row visibility) and stay uncached.
  const watches = ownerWatches
  const ownedAll = watches.filter((w) => w.status === 'owned')
  const events = isOwner
    ? ownerWearEvents
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
