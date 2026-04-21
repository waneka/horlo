import { NoteRow } from './NoteRow'
import type { Watch } from '@/lib/types'

interface NotesTabContentProps {
  // Already filtered by [tab]/page.tsx to non-empty notes + per-note visibility.
  watches: Watch[]
  isOwner: boolean
}

export function NotesTabContent({ watches, isOwner }: NotesTabContentProps) {
  if (watches.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-12 text-center">
        <p className="text-base font-semibold">No notes yet.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Add notes to individual watches from their detail pages.
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
