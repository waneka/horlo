// Placeholder — replaced in Task 2 with NoteRow integration.
// This stub exists so the [tab]/page.tsx tab router compiles in Task 1
// without depending on Task 2's NoteRow / NoteVisibilityPill / RemoveNoteDialog trio.
import type { Watch } from '@/lib/types'

interface NotesTabContentProps {
  watches: Watch[]
  isOwner: boolean
}

export function NotesTabContent({ watches }: NotesTabContentProps) {
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
        <li
          key={w.id}
          className="rounded-xl border bg-card p-4 text-sm text-muted-foreground"
        >
          {w.brand} {w.model} — note row content lands in Task 2.
        </li>
      ))}
    </ul>
  )
}
