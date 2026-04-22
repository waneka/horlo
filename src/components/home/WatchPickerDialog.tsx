'use client'

import type { Watch } from '@/lib/types'

// Stub — full implementation lands in Plan 10-06 Task 4 (shared picker dialog
// for WYWT self-tile + Plan 08 nav `+ Wear` button). Defined here so Plan
// 10-06 Task 2's WywtRail can compile and be shipped as its own task commit
// while Task 4 builds out the picker behavior.

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  watches: Watch[]
}

export function WatchPickerDialog(_props: Props) {
  return null
}
