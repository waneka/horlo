'use client'

import Image from 'next/image'
import { Watch as WatchIcon } from 'lucide-react'
import type { RailEntry } from './flowTypes'

/**
 * Phase 20.1 D-14 — session-only "Recently evaluated" chip rail.
 *
 * Pure presentation. Plan 04 owns the entries useState; this component
 * just renders the chips and forwards click events.
 *
 * Returns null when entries=[] — no heading, no empty placeholder
 * (per UI-SPEC §Copywriting Contract: "rail hidden — only shown when
 * 1+ chips exist").
 *
 * Each chip is a <button> (interactive, keyboard-focusable). aria-label
 * format is fixed per UI-SPEC §Accessibility Contract:
 *   "{brand} {model} — re-evaluate"
 */
interface RecentlyEvaluatedRailProps {
  entries: RailEntry[]
  onSelect: (entry: RailEntry) => void
}

export function RecentlyEvaluatedRail({ entries, onSelect }: RecentlyEvaluatedRailProps) {
  if (entries.length === 0) return null

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground">Recently evaluated</h3>
      <ul role="list" className="flex flex-wrap gap-2">
        {entries.map((e) => {
          const label = `${e.brand} ${e.model}`.trim()
          return (
            <li key={e.catalogId} role="listitem">
              <button
                type="button"
                onClick={() => onSelect(e)}
                aria-label={`${label} — re-evaluate`}
                className="flex items-center gap-2 h-8 px-2 rounded-full border border-border bg-card text-sm text-foreground hover:bg-accent/5 transition-colors"
              >
                {e.imageUrl ? (
                  <span className="size-5 rounded-full overflow-hidden flex-shrink-0 bg-muted">
                    <Image
                      src={e.imageUrl}
                      alt=""
                      width={20}
                      height={20}
                      className="object-cover w-full h-full"
                      unoptimized
                    />
                  </span>
                ) : (
                  <WatchIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                )}
                <span className="truncate max-w-[12rem]">{label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
