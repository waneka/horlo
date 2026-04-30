'use client'

import { Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

/**
 * Phase 20.1 — idle-state and extraction-failed-state paste affordance.
 *
 * Pure controlled component. State + fetch live in the parent
 * (`<AddWatchFlow>`).
 *
 * D-03: includes a quiet "or enter manually" inline link below the input
 * that toggles the parent into the manual-entry branch (skips verdict step).
 *
 * D-07: when `pending=true`, the input is disabled and the Extract button
 * shows "Working..."; the parent renders a separate <VerdictSkeleton /> below.
 */
interface PasteSectionProps {
  url: string
  onUrlChange: (url: string) => void
  onExtract: () => void
  onManualEntry: () => void
  pending: boolean
  /** Caller-controlled disable; e.g., during a deep-link prefill mount. */
  disabled?: boolean
}

export function PasteSection({
  url,
  onUrlChange,
  onExtract,
  onManualEntry,
  pending,
  disabled = false,
}: PasteSectionProps) {
  const isLocked = pending || disabled
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim() || isLocked) return
    onExtract()
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="flex-1">
          <Label htmlFor="paste-url" className="sr-only">
            Product URL
          </Label>
          <Input
            id="paste-url"
            type="url"
            placeholder="Paste a product page URL — Omega, Rolex, Hodinkee..."
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            disabled={isLocked}
            aria-busy={pending}
          />
        </div>
        <Button type="submit" disabled={isLocked || !url.trim()}>
          {pending ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" aria-hidden="true" />
              Working...
            </>
          ) : (
            'Extract Watch'
          )}
        </Button>
      </form>
      <button
        type="button"
        onClick={onManualEntry}
        disabled={isLocked}
        className="text-sm text-muted-foreground underline-offset-4 hover:underline hover:text-foreground"
      >
        or enter manually
      </button>
    </div>
  )
}
