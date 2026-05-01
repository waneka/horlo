'use client'

import { useOptimistic, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { updateProfileSettings } from '@/app/actions/profile'
import type { VisibilityField } from '@/data/profiles'

interface PrivacyToggleRowProps {
  label: string
  description: string
  field: VisibilityField
  initialValue: boolean
}

export function PrivacyToggleRow({
  label,
  description,
  field,
  initialValue,
}: PrivacyToggleRowProps) {
  // useOptimistic returns the optimistic value plus a setter that is only
  // valid inside a transition. Initial value comes from the server-rendered
  // ProfileSettings row passed by the parent section component
  // (PrivacySection / NotificationsSection in Phase 22+).
  const [optimisticValue, setOptimistic] = useOptimistic(initialValue)
  const [pending, startTransition] = useTransition()

  function handleToggle() {
    const newValue = !optimisticValue
    startTransition(async () => {
      setOptimistic(newValue)
      const result = await updateProfileSettings({ field, value: newValue })
      if (!result.success) {
        // On failure, the next parent re-render (revalidatePath in the SA only
        // runs on success) leaves the layout's initialValue prop unchanged, so
        // useOptimistic snaps back to the server-truth on the following render.
        // Surface the failure for diagnostics; UI feedback is the snap-back.
        console.error('[PrivacyToggleRow] save failed:', result.error)
      }
    })
  }

  return (
    <div className="flex min-h-12 items-center justify-between gap-4 py-2">
      <div className="flex-1">
        <p className="text-sm font-normal text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={optimisticValue}
        aria-label={label}
        disabled={pending}
        onClick={handleToggle}
        className={cn(
          'relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-150 disabled:opacity-60',
          optimisticValue ? 'bg-accent' : 'bg-muted',
        )}
      >
        <span
          className={cn(
            'inline-block size-5 transform rounded-full bg-background shadow transition-transform duration-150',
            optimisticValue ? 'translate-x-[18px]' : 'translate-x-[2px]',
          )}
        />
      </button>
    </div>
  )
}
