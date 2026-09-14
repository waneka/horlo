'use client'

import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { DISPOSAL_REASONS, DISPOSAL_REASON_LABELS } from '@/lib/constants'
import type { DisposalReason } from '@/lib/types'

interface DisposalFieldsProps {
  idPrefix: string
  reason: DisposalReason | null
  onReasonChange: (r: DisposalReason) => void
  disposalDate: string
  onDisposalDateChange: (v: string) => void
  sellPrice: string
  onSellPriceChange: (v: string) => void
  maxDate: string
  disabled?: boolean
}

/**
 * Phase 85 (LIFE-03, D-06) — shared disposal reason/date/price fields.
 *
 * Reused verbatim by `MarkPreviouslyOwnedDialog` (this plan) and `WatchForm`
 * (85-10) so the field markup is never forked (UI-SPEC). The reason
 * radiogroup is a hand-rolled WAI-ARIA radiogroup + roving-tabindex
 * pattern copied from `ConfirmStep.tsx` (Phase 68) — no generic `RadioGroup`
 * primitive exists in `src/components/ui/`.
 */
export function DisposalFields({
  idPrefix,
  reason,
  onReasonChange,
  disposalDate,
  onDisposalDateChange,
  sellPrice,
  onSellPriceChange,
  maxDate,
  disabled = false,
}: DisposalFieldsProps) {
  const groupRef = useRef<HTMLDivElement>(null)

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const values = DISPOSAL_REASONS
    // When nothing is selected yet, the first option is the tabbable/focused
    // one (see isTabbable below) — treat it as the current position so
    // ArrowRight/Down/End/Home cycle relative to Sold, not relative to "none".
    const idx = reason === null ? 0 : values.indexOf(reason)
    let next: DisposalReason | null = null

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      next = values[(idx + 1 + values.length) % values.length]
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      next = values[(idx - 1 + values.length) % values.length]
    } else if (e.key === 'Home') {
      e.preventDefault()
      next = values[0]
    } else if (e.key === 'End') {
      e.preventDefault()
      next = values[values.length - 1]
    }

    if (next !== null) {
      onReasonChange(next)
      const nextValue = next
      requestAnimationFrame(() => {
        groupRef.current
          ?.querySelector<HTMLButtonElement>(`[data-value="${nextValue}"]`)
          ?.focus()
      })
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p id={`${idPrefix}-reason-label`} className="text-sm font-semibold">
          Reason
        </p>
        <div
          ref={groupRef}
          role="radiogroup"
          aria-labelledby={`${idPrefix}-reason-label`}
          aria-required="true"
          className="flex flex-wrap gap-2"
          onKeyDown={handleKeyDown}
        >
          {DISPOSAL_REASONS.map((value) => {
            const isSelected = reason === value
            // Roving tabindex: the selected option is focusable, or the
            // first option is focusable when nothing is selected yet.
            const isTabbable = isSelected || (reason === null && value === DISPOSAL_REASONS[0])
            return (
              <Button
                key={value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                tabIndex={isTabbable ? 0 : -1}
                data-value={value}
                variant="outline"
                disabled={disabled}
                className={cn(
                  'min-h-[44px]',
                  isSelected &&
                    'border-accent bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground dark:border-accent dark:bg-accent dark:text-accent-foreground dark:hover:bg-accent dark:hover:text-accent-foreground',
                )}
                onClick={() => onReasonChange(value)}
              >
                {DISPOSAL_REASON_LABELS[value]}
              </Button>
            )
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-date`} className="font-semibold">
          Disposal date
        </Label>
        <Input
          id={`${idPrefix}-date`}
          type="date"
          value={disposalDate}
          max={maxDate || undefined}
          onChange={(e) => onDisposalDateChange(e.target.value)}
          disabled={disabled}
          className="text-base md:text-sm"
        />
        <p className="text-xs text-muted-foreground">Optional — defaults to today</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-price`} className="font-semibold">
          Amount received
        </Label>
        <Input
          id={`${idPrefix}-price`}
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          placeholder="$"
          value={sellPrice}
          onChange={(e) => onSellPriceChange(e.target.value)}
          disabled={disabled}
          className="text-base md:text-sm"
        />
        <p className="text-xs text-muted-foreground">Optional</p>
      </div>
    </div>
  )
}
