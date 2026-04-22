'use client'

import type { WywtTile } from '@/lib/wywtTypes'

// Stub — full implementation lands in Plan 10-06 Task 3 (embla-carousel-react
// swipe overlay + base-ui Dialog). Defined here so Plan 10-06 Task 2's
// WywtRail can compile and be shipped as its own task commit while Task 3
// builds out the overlay behavior.

interface Props {
  tiles: WywtTile[]
  initialIndex: number
  open: boolean
  onOpenChange: (v: boolean) => void
  onViewed: (wearEventId: string) => void
  viewerId: string
}

export function WywtOverlay(_props: Props) {
  return null
}
