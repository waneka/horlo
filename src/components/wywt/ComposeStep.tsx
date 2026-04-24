'use client'

// Placeholder — implementation lands in Phase 15 Plan 03b Task 3.
import type { JSX } from 'react'
import type { Watch } from '@/lib/types'
import type { WearVisibility } from '@/lib/wearVisibility'

export function ComposeStep(_props: {
  watch: Watch
  viewerId: string
  wearEventId: string
  photoBlob: Blob | null
  setPhotoBlob: (b: Blob | null) => void
  note: string
  setNote: (s: string) => void
  visibility: WearVisibility
  setVisibility: (v: WearVisibility) => void
  onChange: () => void
  onSubmitted: () => void
}): JSX.Element {
  return null as unknown as JSX.Element
}
