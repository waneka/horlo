'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { VerdictBundle } from '@/lib/verdict/types'

/**
 * Phase 20.1 D-13 — wishlist-rationale inline expand.
 *
 * Pre-fills the textarea with the verdict's user-self rationale
 * (verdict.rationalePhrasings[0] when available — Phase 28 D-20; empty string when
 * verdict is null per D-06 empty-collection edge or D-09 enrichment fail).
 *
 * Pitfall 5: the user can blank the textarea entirely; that BLANK is what
 * commits to notes (NOT the pre-fill ghosting back). This component sends
 * `textarea.value` verbatim to onConfirm — including '' (empty string).
 *
 * D-19: verdict-rationale text is read-only here. Plan 04's parent owns
 * the addWatch Server Action call; this component just gathers the note
 * text + fires onConfirm.
 */
interface WishlistRationalePanelProps {
  /** Verdict bundle from Plan 04. null when collection empty (D-06) or enrichment failed (D-09). */
  verdict: VerdictBundle | null
  /** Optional starting notes (e.g., when re-opening from rail). Defaults to verdict headline if absent. */
  initialNotes?: string
  onConfirm: (notes: string) => void
  onCancel: () => void
  pending: boolean
}

/**
 * Compute the default textarea value (Phase 28 D-20).
 * - If verdict is a Full bundle, use the first rationale phrasing — the user-self
 *   voice version of the verdict, intentionally chosen as the auto-fill source
 *   instead of contextualPhrasings[0] (which is verdict-to-user voice).
 * - Otherwise (self-via-cross-user OR null), default to empty.
 * Caller may override via initialNotes (e.g., for re-open semantics).
 */
function defaultRationale(verdict: VerdictBundle | null): string {
  if (!verdict) return ''
  if (verdict.framing === 'self-via-cross-user') return ''
  return verdict.rationalePhrasings[0] ?? ''
}

export function WishlistRationalePanel({
  verdict,
  initialNotes,
  onConfirm,
  onCancel,
  pending,
}: WishlistRationalePanelProps) {
  // initialNotes wins over verdict-derived default; verdict-derived wins over ''
  const [notes, setNotes] = useState<string>(() => initialNotes ?? defaultRationale(verdict))
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  // Auto-focus on mount for fast edit (mirrors D-14 auto-focus pattern after Skip).
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const handleConfirm = () => {
    if (pending) return
    // Pitfall 5: send verbatim, INCLUDING empty string.
    onConfirm(notes)
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="space-y-2">
          <Label htmlFor="wishlist-notes">Add a note (optional)</Label>
          <Textarea
            ref={textareaRef}
            id="wishlist-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            disabled={pending}
            aria-describedby="wishlist-notes-hint"
          />
          <p id="wishlist-notes-hint" className="text-xs text-muted-foreground">
            Pre-filled with why this watch fits — written as if you wrote it. Edit to make it yours, or clear it.
          </p>
        </div>
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" aria-hidden="true" />
                Saving...
              </>
            ) : (
              'Save to Wishlist'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
