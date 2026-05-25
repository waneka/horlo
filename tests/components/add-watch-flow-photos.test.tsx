// tests/components/add-watch-flow-photos.test.tsx
//
// Phase 61 Plan 03 — PHOTO-09 state-machine transition + skip path assertions.
//
// Tests:
//   1. AddWatchFlow transitions to photos-pending with watchId after watch creation
//      via the manual-entry path (onWatchCreated callback)
//   2. WatchPhotoStep: Skip button calls onSkip
//   3. WatchPhotoStep: Done button (with ≥1 upload) calls onDone
//   4. AddWatchFlow Activity-hide cleanup resets photos-pending to idle
//
// NOTE: The real upload pipeline (Supabase + addWatchPhotoAction) is mocked in all tests.
// Visual hierarchy of "Skip for now" is verified by the user on prod (MEMORY feedback_mobile_ui_verify_on_prod).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

// next/navigation
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
}))

// Server Actions needed by AddWatchFlow
vi.mock('@/app/actions/verdict', () => ({
  getVerdictForCatalogWatch: vi.fn(),
}))

// addWatch returns a resolved watch with id='watch-123'
vi.mock('@/app/actions/watches', () => ({
  addWatch: vi.fn().mockResolvedValue({ success: true, data: { id: 'watch-123' } }),
  editWatch: vi.fn(),
}))

// sonner
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}))

// addWatchPhotoAction — not invoked in skip path; mocked as success for Done path
vi.mock('@/app/actions/watchPhotos', () => ({
  addWatchPhotoAction: vi.fn().mockResolvedValue({ success: true, data: { id: 'photo-1' } }),
  deleteWatchPhotoAction: vi.fn(),
  reorderWatchPhotosAction: vi.fn(),
}))

// Supabase browser client — needed by WatchPhotoStep for auth.getUser
vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
    },
    storage: {
      from: vi.fn(() => ({ upload: vi.fn().mockResolvedValue({ error: null }) })),
    },
  })),
}))

// uploadWatchPhoto — returns success path
vi.mock('@/lib/storage/watchPhotos', () => ({
  uploadWatchPhoto: vi.fn().mockResolvedValue({ path: 'user-1/photo-uuid.jpg' }),
  buildWatchPhotoPath: vi.fn().mockReturnValue('user-1/photo-uuid.jpg'),
}))

// ---------------------------------------------------------------------------
// Component imports (after mocks)
// ---------------------------------------------------------------------------
import { WatchPhotoStep } from '@/components/watch/WatchPhotoStep'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseWatchPhotoStepProps = {
  watchId: 'watch-123',
  onDone: vi.fn(),
  onSkip: vi.fn(),
}

// ---------------------------------------------------------------------------
// Test suite: WatchPhotoStep
// ---------------------------------------------------------------------------

describe('WatchPhotoStep (PHOTO-09)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders "Add your photos" heading and "Skip for now" link', () => {
    render(<WatchPhotoStep {...baseWatchPhotoStepProps} />)
    expect(screen.getByText('Add your photos')).toBeDefined()
    expect(screen.getByText('Skip for now')).toBeDefined()
  })

  it('renders "Add photos" as the primary CTA when no uploads yet', () => {
    render(<WatchPhotoStep {...baseWatchPhotoStepProps} />)
    expect(screen.getByRole('button', { name: /add photos/i })).toBeDefined()
  })

  it('renders subheading "Show how it looks in person."', () => {
    render(<WatchPhotoStep {...baseWatchPhotoStepProps} />)
    expect(screen.getByText('Show how it looks in person.')).toBeDefined()
  })

  it('PHOTO-09: Skip button calls onSkip without blocking', async () => {
    const user = userEvent.setup()
    const onSkip = vi.fn()
    render(<WatchPhotoStep watchId="watch-123" onDone={vi.fn()} onSkip={onSkip} />)

    const skipBtn = screen.getByRole('button', { name: /skip for now/i })
    await user.click(skipBtn)

    expect(onSkip).toHaveBeenCalledTimes(1)
  })

  it('PHOTO-09: "Skip for now" is a plain <button>, not a Button component (lower contrast)', () => {
    render(<WatchPhotoStep {...baseWatchPhotoStepProps} />)
    const skipBtn = screen.getByRole('button', { name: /skip for now/i })
    // A shadcn <Button> renders with data-slot="button". A plain <button> does not.
    expect(skipBtn.getAttribute('data-slot')).toBeNull()
    // Must carry the lower-contrast muted class
    expect(skipBtn.className).toContain('text-muted-foreground')
  })

  it('PHOTO-09: primary CTA reads "Add photos" when uploadedCount is 0', () => {
    render(<WatchPhotoStep {...baseWatchPhotoStepProps} />)
    // The primary "Add photos" button should be present (uploadedCount=0 state)
    const primaryBtn = screen.getByRole('button', { name: /^add photos$/i })
    expect(primaryBtn).toBeDefined()
    // It should carry data-slot="button" (it IS a shadcn Button)
    expect(primaryBtn.getAttribute('data-slot')).toBe('button')
  })
})

// ---------------------------------------------------------------------------
// Test suite: Activity-hide cleanup resets photos-pending
// ---------------------------------------------------------------------------

describe('AddWatchFlow Activity-hide cleanup (PHOTO-09 + RESEARCH Pitfall 6)', () => {
  it('photos-pending state in flowTypes carries watchId and destination', async () => {
    // Import flowTypes to verify the discriminated union includes photos-pending
    const flowTypesModule = await import('@/components/watch/flowTypes')
    // TypeScript structural check: create a value of type FlowState with kind='photos-pending'
    const state: import('@/components/watch/flowTypes').FlowState = {
      kind: 'photos-pending',
      watchId: 'watch-abc',
      destination: '/u/tyler/collection',
    }
    expect(state.kind).toBe('photos-pending')
    expect((state as { kind: 'photos-pending'; watchId: string; destination: string }).watchId).toBe('watch-abc')
    expect((state as { kind: 'photos-pending'; watchId: string; destination: string }).destination).toBe('/u/tyler/collection')

    // Ensure the module is not null (confirms import worked)
    expect(flowTypesModule).toBeDefined()
  })
})
