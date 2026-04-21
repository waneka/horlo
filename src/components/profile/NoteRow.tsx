'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { MoreVertical, Watch as WatchIcon } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { getSafeImageUrl } from '@/lib/images'
import { daysSince } from '@/lib/wear'
import { NoteVisibilityPill } from './NoteVisibilityPill'
import { RemoveNoteDialog } from './RemoveNoteDialog'
import type { Watch } from '@/lib/types'

interface NoteRowProps {
  watch: Watch
  isOwner: boolean
}

export function NoteRow({ watch, isOwner }: NoteRowProps) {
  const safe = getSafeImageUrl(watch.imageUrl)
  // Prefer notesUpdatedAt; fall back to acquisitionDate so the row always shows
  // a relative timestamp even before notesUpdatedAt is populated.
  const days = daysSince(watch.notesUpdatedAt ?? watch.acquisitionDate ?? undefined)
  const ago =
    days === null
      ? ''
      : days === 0
        ? 'Today'
        : days === 1
          ? '1 day ago'
          : `${days} days ago`
  const [removeOpen, setRemoveOpen] = useState(false)
  // notesPublic defaults to true server-side; treat undefined as public.
  const isPublic = watch.notesPublic !== false

  return (
    <article className="flex items-start gap-4 rounded-xl border bg-card p-4">
      <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
        {safe ? (
          <Image
            src={safe}
            alt={`${watch.brand} ${watch.model}`}
            fill
            sizes="48px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <WatchIcon className="size-5 text-muted-foreground/40" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <Link
            href={`/watch/${watch.id}`}
            className="text-sm font-semibold hover:underline"
          >
            {watch.brand} {watch.model}
          </Link>
          {ago && <span className="text-xs text-muted-foreground">{ago}</span>}
        </div>
        <p className="mt-1 whitespace-pre-wrap text-sm">{watch.notes}</p>
        <div className="mt-2 flex items-center justify-between">
          {/*
            NoteVisibilityPill is the canonical visibility toggle — it owns
            the useOptimistic flow. Do NOT add a redundant visibility-toggle
            item to the dropdown below; that would race the pill state.
          */}
          <NoteVisibilityPill
            watchId={watch.id}
            initialIsPublic={isPublic}
            disabled={!isOwner}
          />
          {isOwner && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Note options"
                  >
                    <MoreVertical className="size-4" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  render={<Link href={`/watch/${watch.id}/edit`} />}
                >
                  Edit Note
                </DropdownMenuItem>
                {/* Visibility toggle intentionally omitted — use the NoteVisibilityPill above. */}
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setRemoveOpen(true)}
                >
                  Remove Note
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      {isOwner && (
        <RemoveNoteDialog
          open={removeOpen}
          onOpenChange={setRemoveOpen}
          watchId={watch.id}
          brand={watch.brand}
          model={watch.model}
        />
      )}
    </article>
  )
}
