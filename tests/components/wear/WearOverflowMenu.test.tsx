// tests/components/wear/WearOverflowMenu.test.tsx — quick task 260913-csl.
//
// Covers Task 1 (menu gating + ported dialog flow) and Task 2 (WearCard
// canDelete threading) from 260913-csl-PLAN.md.
//
// Every presence assertion is paired with the matching disappearance/absence
// assertion (memory: feedback_test_assert_disappearance_too).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/app/actions/wearEvents', () => ({
  deleteWearEvent: vi.fn(),
}))

vi.mock('@/app/actions/wishlist', () => ({
  addToWishlistFromWearEvent: vi.fn(),
}))

const mockReplace = vi.fn()
const mockPush = vi.fn()
const mockBack = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush, back: mockBack }),
}))

vi.mock('sonner', () => ({
  toast: vi.fn(),
}))

import { WearOverflowMenu } from '@/components/wear/WearOverflowMenu'
import { WearCard } from '@/components/wear/WearCard'
import { deleteWearEvent } from '@/app/actions/wearEvents'
import { toast } from 'sonner'

const wearEventId = '11111111-2222-4333-8444-555555555555'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderMenu(overrides: Record<string, any> = {}) {
  return render(
    <WearOverflowMenu
      wearEventId={wearEventId}
      permalinkUrl={`/wear/${wearEventId}`}
      showAddToWishlist={false}
      onPhoto={false}
      showGoToPost={false}
      canDelete={false}
      ownerUsername="alice"
      {...overrides}
    />,
  )
}

function openMenu() {
  fireEvent.click(screen.getByRole('button', { name: 'More options' }))
}

describe('WearOverflowMenu — owner-gated Delete wear (260913-csl)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('menu gating', () => {
    it('canDelete=true: no "Delete wear" before opening; last menuitem + separator after opening', () => {
      renderMenu({ canDelete: true })
      expect(screen.queryByText(/delete wear/i)).not.toBeInTheDocument()

      openMenu()

      const deleteItem = screen.getByRole('menuitem', { name: /delete wear/i })
      expect(deleteItem).toBeInTheDocument()
      const items = screen.getAllByRole('menuitem')
      expect(items[items.length - 1]).toBe(deleteItem)
      expect(screen.getByRole('separator')).toBeInTheDocument()
    })

    it('canDelete=false: "Delete wear" absent after opening; "Copy link" present (menu did open)', () => {
      renderMenu({ canDelete: false })
      openMenu()

      expect(screen.queryByRole('menuitem', { name: /delete wear/i })).not.toBeInTheDocument()
      expect(screen.queryByText(/delete wear/i)).not.toBeInTheDocument()
      expect(screen.getByText('Copy link')).toBeInTheDocument()
    })

    it('stories-lane config (showGoToPost=true, canDelete=false): "Go to wear post" present, "Delete wear" absent', () => {
      renderMenu({ showGoToPost: true, canDelete: false })
      openMenu()

      expect(screen.getByText('Go to wear post')).toBeInTheDocument()
      expect(screen.queryByText(/delete wear/i)).not.toBeInTheDocument()
    })
  })

  describe('dialog flow (canDelete=true)', () => {
    function openDeleteDialog() {
      openMenu()
      fireEvent.click(screen.getByRole('menuitem', { name: /delete wear/i }))
      return screen.findByRole('dialog')
    }

    it('opens the confirmation dialog and closes the menu', async () => {
      renderMenu({ canDelete: true })
      await openDeleteDialog()

      expect(screen.getByText(/delete this wear\?/i)).toBeInTheDocument()
      expect(screen.getByText(/photo or video/i)).toBeInTheDocument()
      expect(screen.getByText(/likes and comments/i)).toBeInTheDocument()

      await waitFor(() => {
        expect(screen.queryByRole('menuitem', { name: /copy link/i })).not.toBeInTheDocument()
      })
    })

    it('Cancel closes the dialog without calling deleteWearEvent', async () => {
      renderMenu({ canDelete: true })
      await openDeleteDialog()

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

      await waitFor(() => {
        expect(screen.queryByText(/delete this wear\?/i)).not.toBeInTheDocument()
      })
      expect(deleteWearEvent).not.toHaveBeenCalled()
    })

    it('Delete calls deleteWearEvent({ wearEventId }) once; disabled "Deleting…" while pending; dialog disappears after resolve', async () => {
      let resolveFn: (value: { success: true; data: { username: string } }) => void
      ;(deleteWearEvent as Mock).mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFn = resolve
        }),
      )
      renderMenu({ canDelete: true })
      await openDeleteDialog()

      fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /deleting/i })).toBeDisabled()
      })
      expect(deleteWearEvent).toHaveBeenCalledTimes(1)
      expect(deleteWearEvent).toHaveBeenCalledWith({ wearEventId })

      resolveFn!({ success: true, data: { username: 'alice' } })
      await waitFor(() => {
        expect(screen.queryByText(/delete this wear\?/i)).not.toBeInTheDocument()
      })
    })

    it('success: router.replace("/u/alice/worn"); toast("Wear deleted"); push/back never called', async () => {
      ;(deleteWearEvent as Mock).mockResolvedValueOnce({
        success: true,
        data: { username: 'alice' },
      })
      renderMenu({ canDelete: true })
      await openDeleteDialog()

      fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/u/alice/worn')
      })
      expect(toast).toHaveBeenCalledWith('Wear deleted')
      expect(mockPush).not.toHaveBeenCalled()
      expect(mockBack).not.toHaveBeenCalled()
      expect(screen.queryByText(/delete this wear\?/i)).not.toBeInTheDocument()
    })

    it('failure: role="alert" with the error; dialog stays open; no replace/push/toast', async () => {
      ;(deleteWearEvent as Mock).mockResolvedValueOnce({
        success: false,
        error: 'Wear not found',
      })
      renderMenu({ canDelete: true })
      await openDeleteDialog()

      fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('Wear not found')
      expect(screen.getByText(/delete this wear\?/i)).toBeInTheDocument()
      expect(mockReplace).not.toHaveBeenCalled()
      expect(mockPush).not.toHaveBeenCalled()
      expect(toast).not.toHaveBeenCalled()
    })

    it('reopen after failure: no stale error', async () => {
      ;(deleteWearEvent as Mock).mockResolvedValueOnce({
        success: false,
        error: 'Wear not found',
      })
      renderMenu({ canDelete: true })
      await openDeleteDialog()
      fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
      await screen.findByRole('alert')

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
      await waitFor(() => {
        expect(screen.queryByText(/delete this wear\?/i)).not.toBeInTheDocument()
      })

      await openDeleteDialog()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })
})

describe('WearCard canDelete threading (260913-csl Task 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function mkProps(overrides: Record<string, any> = {}) {
    return {
      signedUrl: null,
      watchImageUrl: null,
      altText: 'Test wear',
      username: 'alice',
      displayName: 'Alice',
      avatarUrl: null,
      createdAt: new Date('2026-06-22T10:00:00Z'),
      brand: 'Rolex',
      model: 'GMT',
      watchId: 'w-001',
      viewerId: 'v-001',
      wearEventId: 'we-001',
      initialLiked: false,
      initialCount: 0,
      commentHostVariant: 'inline' as const,
      showAddToWishlist: false,
      permalinkUrl: '/wear/we-001',
      initialComments: [],
      canComment: true,
      ownerFollowsViewer: false,
      viewerIsFollowing: false,
      ownerUserId: 'u-001',
      ownerUsername: 'alice',
      viewerAuthor: null,
      commentCount: 0,
      ...overrides,
    }
  }

  it('commentHostVariant=inline, canDelete=true → "Delete wear" menuitem present', () => {
    render(<WearCard {...mkProps({ canDelete: true })} />)
    openMenu()
    expect(screen.getByRole('menuitem', { name: /delete wear/i })).toBeInTheDocument()
  })

  it('commentHostVariant=inline, canDelete omitted → "Delete wear" absent; "Copy link" present', () => {
    render(<WearCard {...mkProps()} />)
    openMenu()
    expect(screen.queryByRole('menuitem', { name: /delete wear/i })).not.toBeInTheDocument()
    expect(screen.getByText('Copy link')).toBeInTheDocument()
  })

  it('commentHostVariant=bottom-sheet, canDelete=true (own wear on stories lane) → "Go to wear post" present, "Delete wear" absent', () => {
    render(
      <WearCard {...mkProps({ commentHostVariant: 'bottom-sheet', canDelete: true })} />,
    )
    openMenu()
    expect(screen.getByText('Go to wear post')).toBeInTheDocument()
    expect(screen.queryByText(/delete wear/i)).not.toBeInTheDocument()
  })
})
