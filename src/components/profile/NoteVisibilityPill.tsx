'use client'

import { useOptimistic, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { updateNoteVisibility } from '@/app/actions/notes'

interface NoteVisibilityPillProps {
  watchId: string
  initialIsPublic: boolean
  // True when viewer is not owner — renders read-only.
  disabled?: boolean
}

/**
 * Canonical per-note visibility toggle (D-13).
 *
 * The 3-dot DropdownMenu in NoteRow intentionally does NOT contain a
 * "Make Public" / "Make Private" item — that would call updateNoteVisibility
 * directly and bypass this pill's optimistic flow, leaving the UI out of
 * sync with the server until the next round-trip. This pill owns the
 * useOptimistic state machine for note visibility.
 */
export function NoteVisibilityPill({
  watchId,
  initialIsPublic,
  disabled = false,
}: NoteVisibilityPillProps) {
  const [optimisticPublic, setOptimistic] = useOptimistic(initialIsPublic)
  const [pending, startTransition] = useTransition()

  function handleClick() {
    if (disabled) return
    const next = !optimisticPublic
    startTransition(async () => {
      setOptimistic(next)
      const result = await updateNoteVisibility({
        watchId,
        isPublic: next,
      })
      if (!result.success) {
        // Revalidation from the parent Server Component re-renders the row
        // with the original initialIsPublic, snapping the pill back. Surface
        // the error to the console for now (toast pattern arrives later).
        console.error('[NoteVisibilityPill] save failed:', result.error)
      }
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || pending}
      aria-pressed={optimisticPublic}
      aria-label={
        optimisticPublic
          ? 'Note is public, click to make private'
          : 'Note is private, click to make public'
      }
      className={cn(
        'rounded-full px-2.5 py-0.5 text-xs font-normal transition-colors',
        optimisticPublic
          ? 'bg-accent text-accent-foreground'
          : 'bg-muted text-muted-foreground',
        disabled && 'cursor-default opacity-80',
      )}
    >
      {optimisticPublic ? 'Public' : 'Private'}
    </button>
  )
}
