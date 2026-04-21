import { notFound } from 'next/navigation'
import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
import {
  getProfileByUsername,
  getProfileSettings,
} from '@/data/profiles'
import { getWatchesByUser } from '@/data/watches'
import {
  getMostRecentWearDates,
  getPublicWearEventsForViewer,
} from '@/data/wearEvents'
import { CollectionTabContent } from '@/components/profile/CollectionTabContent'
import { WishlistTabContent } from '@/components/profile/WishlistTabContent'
import { NotesTabContent } from '@/components/profile/NotesTabContent'
import { WornTabContent } from '@/components/profile/WornTabContent'
// Stats tab content arrives in Plan 04 Task 2.

const VALID_TABS = ['collection', 'wishlist', 'worn', 'notes', 'stats'] as const
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

  // The shared layout already short-circuits when profile_public=false && !isOwner.
  // Per-tab visibility (PRIV-02 / PRIV-03 / PRIV-04):
  if (tab === 'collection' && !isOwner && !settings.collectionPublic) {
    return <PrivateTabState tab="collection" />
  }
  if (tab === 'wishlist' && !isOwner && !settings.wishlistPublic) {
    return <PrivateTabState tab="wishlist" />
  }
  if (tab === 'worn' && !isOwner && !settings.wornPublic) {
    return <PrivateTabState tab="worn" />
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
    // DAL visibility gate (PRIV-05): even when wornPublic=true, going through
    // this DAL ensures the application layer always rechecks before returning rows.
    const events = await getPublicWearEventsForViewer(viewerId, profile.id)
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

  // tab === 'stats' — Plan 04 Task 2 fills this in.
  return (
    <section
      data-slot="tab-placeholder"
      className="rounded-xl border bg-card p-8 text-center"
    >
      <p className="text-sm font-semibold capitalize">{tab} tab</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Content lands in Plan 04 Task 2 (Stats).
      </p>
    </section>
  )
}

function PrivateTabState({ tab }: { tab: Tab }) {
  return (
    <section className="flex flex-col items-center justify-center rounded-xl border bg-card py-16 text-center">
      <p className="text-sm text-muted-foreground">This {tab} is private.</p>
    </section>
  )
}
