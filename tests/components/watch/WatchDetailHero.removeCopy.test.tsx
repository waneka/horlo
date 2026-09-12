// Phase 83 Plan 04 — gap closure for 83-HUMAN-UAT test 2 (POLISH-03).
//
// Plan 83-03 ported the "Remove from wishlist" copy into the legacy
// src/components/watch/WatchDetail.tsx, which /w/[ref] no longer renders
// (Phase 64 D-02/D-09 replaced it with WatchDetailHero). This test renders
// the LIVE component (WatchDetailHero) and asserts the wishlist / grail /
// owned / non-owner delete-dialog branches directly, so a repeat of the
// dead-island failure mode is structurally impossible.
//
// This file MUST FAIL today on the wishlist + grail cases (trigger still
// reads "Delete", dialog still reads "Delete Watch") — GREEN lands in
// Task 2 by porting the isWishlistLike branching into the Dialog block.

import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Watch } from '@/lib/types'

// Mock next/navigation — WatchDetailHero calls useRouter().
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
}))

// Mock Server Actions (delete + flag-deal + mark-as-worn).
vi.mock('@/app/actions/watches', () => ({
  removeWatch: vi.fn(async () => ({ success: true, data: undefined })),
  editWatch: vi.fn(async () => ({ success: true, data: undefined })),
}))
vi.mock('@/app/actions/wearEvents', () => ({
  markAsWorn: vi.fn(async () => ({ success: true, data: undefined })),
}))

// Import AFTER mocks.
import { WatchDetailHero } from '@/components/watch/WatchDetailHero'

const baseWatch: Watch = {
  id: 'w1',
  brand: 'Rolex',
  model: 'Datejust',
  reference: '',
  status: 'owned',
  movement: 'auto',
  complications: [],
  styleTags: [],
  designTraits: [],
  roleTags: [],
  notes: '',
  imageUrl: '',
}

describe('<WatchDetailHero> — delete dialog copy (POLISH-03 gap closure, D-07..D-11)', () => {
  it('wishlist: trigger reads "Remove from wishlist" (outline), not "Delete"', () => {
    render(
      <WatchDetailHero
        watch={{ ...baseWatch, status: 'wishlist' }}
        collection={[]}
        viewerCanEdit
      />,
    )

    const trigger = screen.getByRole('button', { name: 'Remove from wishlist' })
    expect(trigger).toBeInTheDocument()
    expect(trigger.className).not.toContain('text-destructive')

    // Assert disappearance too — per project memory
    // feedback_test_assert_disappearance_too.
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
  })

  it('wishlist: dialog shows softened title/body/confirm; confirm stays destructive', async () => {
    const user = userEvent.setup()
    render(
      <WatchDetailHero
        watch={{ ...baseWatch, status: 'wishlist' }}
        collection={[]}
        viewerCanEdit
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Remove from wishlist' }))

    const dialog = within(await screen.findByRole('dialog'))
    expect(
      dialog.getByRole('heading', { name: 'Remove from wishlist' }),
    ).toBeInTheDocument()
    expect(
      dialog.getByText(
        'Remove Rolex Datejust from your wishlist? You can add it back any time.',
      ),
    ).toBeInTheDocument()

    const confirmBtn = dialog.getByRole('button', { name: 'Remove from wishlist' })
    expect(confirmBtn).toBeInTheDocument()
    expect(confirmBtn.className).toContain('text-destructive')
    expect(dialog.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()

    expect(dialog.queryByText(/cannot be undone/)).not.toBeInTheDocument()
    expect(dialog.queryByText('Delete Watch')).not.toBeInTheDocument()
  })

  it('grail: same trigger label and softened dialog body as wishlist (D-07)', async () => {
    const user = userEvent.setup()
    render(
      <WatchDetailHero
        watch={{ ...baseWatch, status: 'grail' }}
        collection={[]}
        viewerCanEdit
      />,
    )

    const trigger = screen.getByRole('button', { name: 'Remove from wishlist' })
    expect(trigger).toBeInTheDocument()
    expect(trigger.className).not.toContain('text-destructive')

    await user.click(trigger)

    const dialog = within(await screen.findByRole('dialog'))
    expect(
      dialog.getByRole('heading', { name: 'Remove from wishlist' }),
    ).toBeInTheDocument()
    expect(
      dialog.getByText(
        'Remove Rolex Datejust from your wishlist? You can add it back any time.',
      ),
    ).toBeInTheDocument()
  })

  it('owned: trigger reads "Delete" (destructive), dialog keeps original copy (D-08)', async () => {
    const user = userEvent.setup()
    render(
      <WatchDetailHero
        watch={{ ...baseWatch, status: 'owned' }}
        collection={[]}
        viewerCanEdit
      />,
    )

    const trigger = screen.getByRole('button', { name: 'Delete' })
    expect(trigger).toBeInTheDocument()
    expect(trigger.className).toContain('text-destructive')
    expect(
      screen.queryByRole('button', { name: 'Remove from wishlist' }),
    ).not.toBeInTheDocument()

    await user.click(trigger)

    const dialog = within(await screen.findByRole('dialog'))
    expect(dialog.getByText('Delete Watch')).toBeInTheDocument()
    expect(
      dialog.getByText(
        'Are you sure you want to delete Rolex Datejust? This action cannot be undone.',
      ),
    ).toBeInTheDocument()
    expect(dialog.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    expect(dialog.queryByText(/You can add it back any time/)).not.toBeInTheDocument()
  })

  it('non-owner: neither "Remove from wishlist" nor "Delete" trigger renders (existing owner gate)', () => {
    render(
      <WatchDetailHero
        watch={{ ...baseWatch, status: 'wishlist' }}
        collection={[]}
        viewerCanEdit={false}
      />,
    )

    expect(
      screen.queryByRole('button', { name: 'Remove from wishlist' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
  })
})
