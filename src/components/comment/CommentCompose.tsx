'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { cn } from '@/lib/utils'

interface CommentComposeProps {
  /** null for unauthenticated viewer — submit routes to /login?next=... */
  viewerId: string | null
  /** true while the parent CommentList has a pending Server Action transition */
  pending: boolean
  /** Called with the body string when the user clicks Post; parent owns clear-on-success */
  onSubmit: (body: string) => void
}

/**
 * Comment composition area (CMNT-04 + CMNT-05).
 *
 * Rules enforced here:
 *   - maxLength={500} hard-stops typing at the input level (CMNT-04, first layer).
 *   - Char counter appears at body.length >= 450 (CMNT-05 reveal threshold, 90% of max).
 *   - Counter turns text-destructive at body.length >= 480 (CMNT-05 color change).
 *   - Post button disabled when: pending OR body.trim().length === 0 OR body.length > 500.
 *   - Anon viewer (viewerId===null): submit bounces to /login?next= (T-57-11).
 *   - Clear-on-success is PARENT's responsibility (CommentList clears on reconcile);
 *     CommentCompose retains body on failure to allow retry.
 */
export function CommentCompose({ viewerId, pending, onSubmit }: CommentComposeProps) {
  const router = useRouter()
  const [body, setBody] = useState('')

  function handleSubmit() {
    // Anon bounce: navigate to /login preserving the current page (T-57-11).
    if (viewerId === null) {
      const next = encodeURIComponent(window.location.pathname)
      router.push(`/login?next=${next}`)
      return
    }
    onSubmit(body)
    // NOTE: body is NOT cleared here — CommentList clears it on successful reconcile.
    // If the action fails, the user can retry without re-typing.
  }

  const isOverLimit = body.length > 500
  const isBlank = body.trim().length === 0
  const isDisabled = pending || isBlank || isOverLimit

  return (
    <div className="flex items-end gap-2">
      {/* Textarea wrapper — grows to fill */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <textarea
          maxLength={500}
          rows={3}
          placeholder="Add a comment…"
          disabled={pending}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
        />
        {body.length >= 450 && (
          <span
            className={cn(
              'text-xs tabular-nums text-right',
              body.length >= 480 ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {body.length}/500
          </span>
        )}
      </div>
      {/* Post button — right-aligned, inline */}
      <button
        type="button"
        disabled={isDisabled}
        className="flex-shrink-0 self-end h-8 px-4 bg-primary text-primary-foreground text-sm font-semibold rounded-md hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-50 min-h-[44px] min-w-[44px]"
        onClick={handleSubmit}
      >
        Post
      </button>
    </div>
  )
}
