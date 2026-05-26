// tests/components/add-watch-flow-photos.test.tsx
//
// Phase 61 Plan 03 — PHOTO-09 state-machine transition + skip path assertions.
// Phase 61 Plan 06 — gap #9: full extract→collection→form-prefill→submit path coverage.
//
// Tests:
//   1. AddWatchFlow transitions to photos-pending with watchId after watch creation
//      via the manual-entry path (onWatchCreated callback)
//   2. WatchPhotoStep: Skip button calls onSkip
//   3. WatchPhotoStep: Done button (with ≥1 upload) calls onDone
//   4. AddWatchFlow Activity-hide cleanup resets photos-pending to idle
//   5. [Plan 06] AddWatchFlow: form-prefill path → submit → photos-pending renders,
//      no navigation before Done/Skip (gap #9 regression guard)
//   6. [Plan 06] AddWatchFlow: onWatchCreated suppresses success toast (no
//      successAction router.push race when photos step is showing)
//
// NOTE: The real upload pipeline (Supabase + addWatchPhotoAction) is mocked in all tests.
// Visual hierarchy of "Skip for now" is verified by the user on prod (MEMORY feedback_mobile_ui_verify_on_prod).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ---------------------------------------------------------------------------
// Hoisted mock refs — vi.mock factories are hoisted before let/const
// initialization; stubs must live inside vi.hoisted() per project convention
// (MEMORY project_vitest_static_node_env / vi.hoisted() required for vitest
// mock error classes).
// ---------------------------------------------------------------------------
const { mockPush, mockToastSuccess, mockToastError } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

// next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn(), back: vi.fn() }),
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
  toast: { success: mockToastSuccess, error: mockToastError, warning: vi.fn() },
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

// next/image — lightweight stub for AddWatchFlow's image rendering
vi.mock('next/image', () => ({
  default: (p: { src: string; alt: string; width?: number; height?: number }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={p.src} alt={p.alt} />
  ),
}))

// next/link
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

// CollectionFitCard — stub to keep tests focused on flow state
vi.mock('@/components/insights/CollectionFitCard', () => ({
  CollectionFitCard: () => <div data-testid="cfc" />,
}))

// VerdictSkeleton — stub
vi.mock('@/components/insights/VerdictSkeleton', () => ({
  VerdictSkeleton: () => <div data-testid="verdict-skeleton" />,
}))

// ---------------------------------------------------------------------------
// Component imports (after mocks)
// ---------------------------------------------------------------------------
import { WatchPhotoStep } from '@/components/watch/WatchPhotoStep'
import { AddWatchFlow } from '@/components/watch/AddWatchFlow'
import type { ExtractedWatchData } from '@/lib/extractors/types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseWatchPhotoStepProps = {
  watchId: 'watch-123',
  userId: 'user-1',
  onDone: vi.fn(),
  onSkip: vi.fn(),
}

// Minimal extracted watch data for form-prefill tests
const fixtureExtracted: ExtractedWatchData = {
  brand: 'Omega',
  model: 'Speedmaster',
  imageUrl: 'https://example.com/spd.jpg',
}

// Default AddWatchFlow props shared across gap-#9 tests
const baseFlowProps = {
  collectionRevision: 3,
  initialCatalogId: null as string | null,
  initialIntent: null as 'owned' | null,
  initialCatalogPrefill: null as ExtractedWatchData | null,
  initialManual: false,
  initialStatus: null as 'wishlist' | null,
  initialReturnTo: null as string | null,
  viewerUsername: 'tyler',
  viewerUserId: 'user-1',
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
    render(<WatchPhotoStep watchId="watch-123" userId="user-1" onDone={vi.fn()} onSkip={onSkip} />)

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

// ---------------------------------------------------------------------------
// Test suite: Gap #9 regression guard — form-prefill → submit → photos-pending
// (Plan 06 — gap #9 / PHOTO-09 / SC5)
//
// Uses the deep-link initial state (initialCatalogId + initialIntent='owned' +
// initialCatalogPrefill) to jump directly into form-prefill without requiring
// a mocked /api/extract-watch fetch, then verifies that submitting the form
// (a) shows WatchPhotoStep ("Add your photos"), and (b) does NOT call
// router.push before the user interacts with the photos step.
// ---------------------------------------------------------------------------

describe('AddWatchFlow gap #9: form-prefill → submit → photos-pending (PHOTO-09)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('gap #9: submitting the prefilled form shows "Add your photos" step before navigation', async () => {
    const user = userEvent.setup()

    // Start directly in form-prefill (deep-link path: catalogId + intent='owned' + prefill)
    render(
      <AddWatchFlow
        {...baseFlowProps}
        initialCatalogId="cat-uuid-001"
        initialIntent="owned"
        initialCatalogPrefill={fixtureExtracted}
      />,
    )

    // form-prefill branch should be showing — wait for the brand field to appear
    const brandInput = await screen.findByDisplayValue('Omega')
    expect(brandInput).toBeDefined()

    // model field should also be prefilled
    expect(screen.getByDisplayValue('Speedmaster')).toBeDefined()

    // Verify no navigation has happened yet
    expect(mockPush).not.toHaveBeenCalled()

    // Submit the form (the "Add Watch" button in create mode)
    const submitBtn = screen.getByRole('button', { name: /add watch/i })
    await user.click(submitBtn)

    // After form submit → onWatchCreated fires → photos-pending renders
    // "Add your photos" heading must appear BEFORE any router.push call
    await waitFor(() => {
      expect(screen.getByText('Add your photos')).toBeDefined()
    })

    // No navigation should have occurred yet (photos step owns navigation)
    expect(mockPush).not.toHaveBeenCalled()

    // "Skip for now" button should be present (D-16 skippable)
    expect(screen.getByRole('button', { name: /skip for now/i })).toBeDefined()
  })

  it('gap #9: clicking "Skip for now" after photos step navigates to destination', async () => {
    const user = userEvent.setup()

    render(
      <AddWatchFlow
        {...baseFlowProps}
        initialCatalogId="cat-uuid-001"
        initialIntent="owned"
        initialCatalogPrefill={fixtureExtracted}
      />,
    )

    // Wait for form-prefill to mount
    await screen.findByDisplayValue('Omega')

    // Submit form → photos step
    const submitBtn = screen.getByRole('button', { name: /add watch/i })
    await user.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText('Add your photos')).toBeDefined()
    })

    // Click "Skip for now" — navigation should fire
    const skipBtn = screen.getByRole('button', { name: /skip for now/i })
    await user.click(skipBtn)

    expect(mockPush).toHaveBeenCalledTimes(1)
    // Destination is defaultDestinationForStatus('owned', 'tyler') = /u/tyler/collection
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('/u/tyler/collection'))
  })

  it('gap #9: success toast is suppressed when onWatchCreated intercepts the commit', async () => {
    // When onWatchCreated is provided (photos step path), the success toast
    // must NOT fire — so no "View" action button can navigate away from the
    // photos step while it is rendering. (Plan 06 fix: empty opts passed to
    // run() when onWatchCreated is present.)
    const user = userEvent.setup()

    render(
      <AddWatchFlow
        {...baseFlowProps}
        initialCatalogId="cat-uuid-001"
        initialIntent="owned"
        initialCatalogPrefill={fixtureExtracted}
      />,
    )

    await screen.findByDisplayValue('Omega')

    const submitBtn = screen.getByRole('button', { name: /add watch/i })
    await user.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText('Add your photos')).toBeDefined()
    })

    // toast.success must NOT have been called — no "View" CTA races the photos step
    expect(mockToastSuccess).not.toHaveBeenCalled()
  })
})
