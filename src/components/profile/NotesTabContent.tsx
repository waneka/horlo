import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { NoteRow } from './NoteRow'
import { NotesEmptyOwnerActions } from './NotesEmptyOwnerActions'
import type { Watch } from '@/lib/types'

interface NotesTabContentProps {
  // Already filtered by [tab]/page.tsx to non-empty notes + per-note visibility.
  watches: Watch[]
  isOwner: boolean
  /** Phase 25 D-10: surfaces non-owner copy "{username} hasn't added any
   *  notes yet." Threaded from [tab]/page.tsx (profile.username). */
  username: string
  /** Phase 25 D-08: drives the owner empty-state branch. >0 → picker flow
   *  (NotesEmptyOwnerActions). 0 → "Add a watch first" CTA → /watch/new
   *  (avoids the "click → empty picker → confusion" jank). T-25-05-03 in
   *  threat register: server-derived; non-owner never reaches this branch. */
  collectionCount: number
  /** Phase 25 D-07: the owner's collection (status='owned') used by the picker
   *  inside NotesEmptyOwnerActions. Server-derived in [tab]/page.tsx. */
  ownedWatches: Watch[]
}

export function NotesTabContent({
  watches,
  isOwner,
  username,
  collectionCount,
  ownedWatches,
}: NotesTabContentProps) {
  if (watches.length === 0) {
    if (isOwner) {
      if (collectionCount > 0) {
        // D-07: picker flow — owner has watches to add notes to.
        return (
          <div className="rounded-xl border bg-card p-12 text-center">
            <p className="text-base font-semibold">No watch notes yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add notes to any watch in your collection — visible to followers if you choose.
            </p>
            <NotesEmptyOwnerActions ownedWatches={ownedWatches} />
          </div>
        )
      }
      // D-08: zero-collection branch — picker would be empty, so route to
      // /watch/new instead. Avoids the "click CTA → see empty picker" jank.
      return (
        <div className="rounded-xl border bg-card p-12 text-center">
          <p className="text-base font-semibold">No watch notes yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add a watch to your collection first, then leave notes about it.
          </p>
          <div className="mx-auto mt-6 max-w-xs">
            <Button
              variant="default"
              className="w-full"
              render={<Link href="/watch/new" />}
            >
              Add a watch first
            </Button>
          </div>
        </div>
      )
    }
    // D-10: non-owner — owner-aware copy with NO CTA.
    return (
      <div className="rounded-xl border bg-card p-12 text-center">
        <p className="text-base font-semibold">Nothing here yet.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {username} hasn&apos;t added any notes yet.
        </p>
      </div>
    )
  }
  return (
    <ul className="flex flex-col gap-3">
      {watches.map((w) => (
        <li key={w.id}>
          <NoteRow watch={w} isOwner={isOwner} />
        </li>
      ))}
    </ul>
  )
}
