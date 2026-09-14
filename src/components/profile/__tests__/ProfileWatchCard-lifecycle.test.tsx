/**
 * Phase 85 Plan 08 Task 2 — owner ⋯ menu + previously-owned card treatment
 * on the LIVE ProfileWatchCard (LIFE-03/D-05, LIFE-05/D-16).
 *
 * Every presence assertion pairs with the matching disappearance/absence
 * assertion (memory: feedback_test_assert_disappearance_too).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    'aria-label': ariaLabel,
    className,
  }: {
    href: string
    children: React.ReactNode
    'aria-label'?: string
    className?: string
  }) => (
    <a href={href} aria-label={ariaLabel} className={className}>
      {children}
    </a>
  ),
}))

vi.mock('next/image', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: (p: any) => <img src={p.src} alt={p.alt} sizes={p.sizes} />,
}))

vi.mock('@/components/profile/MarkPreviouslyOwnedDialog', () => ({
  MarkPreviouslyOwnedDialog: ({ open }: { open: boolean }) =>
    open ? (
      <div role="dialog" aria-label="Mark as previously owned">
        Mark as previously owned
      </div>
    ) : null,
}))

import { ProfileWatchCard } from '@/components/profile/ProfileWatchCard'
import type { Watch } from '@/lib/types'

function buildWatch(overrides: Partial<Watch>): Watch {
  return {
    id: 'w1',
    brand: 'Brand',
    model: 'Model',
    status: 'owned',
    movement: 'auto',
    complications: [],
    styleTags: [],
    designTraits: [],
    roleTags: [],
    ...overrides,
  }
}

function openMenu() {
  fireEvent.click(screen.getByRole('button', { name: 'More options' }))
}

// Computed at test-run time (not hardcoded) — matches the existing
// tests/components/profile/ProfileWatchCard.test.tsx TODAY_ISO precedent.
const TODAY_ISO = new Date().toISOString().split('T')[0]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ProfileWatchCard — owner ⋯ menu (LIFE-03, D-05)', () => {
  it('isOwner + owned: trigger exists; click is defaultPrevented; menu shows "Mark as previously owned"; selecting opens the dialog', () => {
    render(
      <ProfileWatchCard watch={buildWatch({ status: 'owned' })} lastWornDate={null} isOwner />,
    )

    const trigger = screen.getByRole('button', { name: 'More options' })
    const event = fireEvent.click(trigger)
    expect(event).toBe(false) // defaultPrevented -> fireEvent returns false

    expect(screen.getByText('Mark as previously owned')).toBeInTheDocument()

    expect(screen.queryByRole('dialog', { name: 'Mark as previously owned' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Mark as previously owned' }))
    expect(screen.getByRole('dialog', { name: 'Mark as previously owned' })).toBeInTheDocument()
  })

  it('isOwner=false + owned: no "More options" trigger', () => {
    render(<ProfileWatchCard watch={buildWatch({ status: 'owned' })} lastWornDate={null} />)
    expect(screen.queryByRole('button', { name: 'More options' })).not.toBeInTheDocument()
  })

  it('isOwner + wishlist: no "More options" trigger', () => {
    render(
      <ProfileWatchCard
        watch={buildWatch({ status: 'wishlist' })}
        lastWornDate={null}
        isOwner
        showWishlistMeta
      />,
    )
    expect(screen.queryByRole('button', { name: 'More options' })).not.toBeInTheDocument()
  })

  it('isOwner + grail: no "More options" trigger', () => {
    render(
      <ProfileWatchCard
        watch={buildWatch({ status: 'grail' })}
        lastWornDate={null}
        isOwner
        showWishlistMeta
      />,
    )
    expect(screen.queryByRole('button', { name: 'More options' })).not.toBeInTheDocument()
  })
})

describe('ProfileWatchCard — previously-owned card treatment (LIFE-05, D-16)', () => {
  it('renders opacity-60, the reason·date badge, no wear indicators, and an Edit menu item (no Mark-as-previously-owned)', () => {
    const { container } = render(
      <ProfileWatchCard
        watch={buildWatch({
          status: 'previously_owned',
          disposalReason: 'traded',
          disposalDate: '2026-03-02',
        })}
        lastWornDate={TODAY_ISO} // today — proves the wear badge/line are suppressed, not just absent by data
        isOwner
      />,
    )

    expect(container.querySelector('.opacity-60')).toBeInTheDocument()
    expect(screen.getByText('Traded · Mar 2026')).toBeInTheDocument()

    expect(screen.queryByText('Never worn')).not.toBeInTheDocument()
    expect(screen.queryByText('Worn today')).not.toBeInTheDocument()
    expect(screen.queryByText('Not worn recently')).not.toBeInTheDocument()
    expect(screen.queryByText('Worn yesterday')).not.toBeInTheDocument()

    openMenu()
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/w/w1/edit')
    expect(screen.queryByRole('menuitem', { name: 'Mark as previously owned' })).not.toBeInTheDocument()
  })

  it('badge reads the reason alone when there is no disposal date', () => {
    render(
      <ProfileWatchCard
        watch={buildWatch({ status: 'previously_owned', disposalReason: 'traded' })}
        lastWornDate={null}
        isOwner
      />,
    )
    expect(screen.getByText('Traded')).toBeInTheDocument()
    expect(screen.queryByText(/Traded ·/)).not.toBeInTheDocument()
  })

  it('regression: owned + worn today still shows "Worn today" and no opacity-60', () => {
    const { container } = render(
      <ProfileWatchCard
        watch={buildWatch({ status: 'owned' })}
        lastWornDate={TODAY_ISO}
        isOwner
      />,
    )
    // Appears in both the badge and the last-worn line — assert at least one.
    expect(screen.getAllByText('Worn today').length).toBeGreaterThanOrEqual(1)
    expect(container.querySelector('.opacity-60')).not.toBeInTheDocument()
  })

  it('price line for previously_owned with pricePaid still reads "Paid: $X"', () => {
    render(
      <ProfileWatchCard
        watch={buildWatch({ status: 'previously_owned', pricePaid: 3000 })}
        lastWornDate={null}
        isOwner
      />,
    )
    expect(screen.getByText('Paid: $3,000')).toBeInTheDocument()
  })
})
