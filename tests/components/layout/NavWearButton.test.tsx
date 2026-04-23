import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import { NavWearButton } from '@/components/layout/NavWearButton'
import type { Watch } from '@/lib/types'

// Mock the shared WatchPickerDialog so we can assert on its open / watches
// props without rendering its internals. Mocking also suppresses the lazy
// boundary in tests (no Suspense fallback to wait on).
const mockDialog = vi.fn<
  (props: {
    open: boolean
    onOpenChange: (v: boolean) => void
    watches: Watch[]
  }) => React.ReactNode
>()
vi.mock('@/components/home/WatchPickerDialog', () => ({
  WatchPickerDialog: (props: {
    open: boolean
    onOpenChange: (v: boolean) => void
    watches: Watch[]
  }) => {
    mockDialog(props)
    return (
      <div
        data-testid="mock-picker"
        data-open={props.open ? 'true' : 'false'}
        data-count={props.watches.length}
      >
        <button
          type="button"
          onClick={() => props.onOpenChange(false)}
          data-testid="mock-picker-close"
        >
          close-mock
        </button>
      </div>
    )
  },
}))

function makeWatch(id: string): Watch {
  return {
    id,
    brand: 'Rolex',
    model: `Submariner ${id}`,
    status: 'owned',
    movement: 'automatic',
    complications: [],
    styleTags: [],
    designTraits: [],
    roleTags: [],
  }
}

describe('NavWearButton — nav `+ Wear` trigger for the shared picker', () => {
  it('Test 1 — renders with label "Wear" and a Plus icon (default/header variant)', () => {
    render(<NavWearButton ownedWatches={[]} />)
    // Label (desktop shows "Wear" via `hidden sm:inline` but still in DOM)
    expect(screen.getByRole('button', { name: /log a wear/i })).toBeTruthy()
    expect(screen.getByText('Wear')).toBeTruthy()
    // Plus icon is an svg inside the button; lucide icons render as <svg>.
    const btn = screen.getByRole('button', { name: /log a wear/i })
    expect(btn.querySelector('svg')).toBeTruthy()
  })

  it('Test 2 — clicking the button opens the WatchPickerDialog with the watches prop', async () => {
    const watches = [makeWatch('a'), makeWatch('b')]
    render(<NavWearButton ownedWatches={watches} />)

    // Picker is not mounted before click (NavWearButton uses `open && ...`).
    expect(screen.queryByTestId('mock-picker')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /log a wear/i }))

    // Now the dialog should render with open=true and the passed watches.
    await waitFor(() => {
      expect(screen.getByTestId('mock-picker')).toBeTruthy()
    })
    const picker = screen.getByTestId('mock-picker')
    expect(picker.getAttribute('data-open')).toBe('true')
    expect(picker.getAttribute('data-count')).toBe('2')
  })

  it('Test 3 — dialog onOpenChange(false) closes the dialog', async () => {
    render(<NavWearButton ownedWatches={[makeWatch('a')]} />)
    fireEvent.click(screen.getByRole('button', { name: /log a wear/i }))
    await waitFor(() => {
      expect(screen.getByTestId('mock-picker')).toBeTruthy()
    })

    // Close via the mock's onOpenChange(false).
    fireEvent.click(screen.getByTestId('mock-picker-close'))

    await waitFor(() => {
      expect(screen.queryByTestId('mock-picker')).toBeNull()
    })
  })

  it('Test 4 — button uses outline variant (header default)', () => {
    render(<NavWearButton ownedWatches={[]} />)
    const btn = screen.getByRole('button', { name: /log a wear/i })
    // shadcn Button outline variant includes `border-border` and `bg-background`.
    const cls = btn.getAttribute('class') ?? ''
    expect(cls).toMatch(/border-border/)
    expect(cls).toMatch(/bg-background/)
  })

  describe('Phase 14-03 Task 1 — bottom-nav appearance variant', () => {
    it('Test 5 — `appearance="bottom-nav"` renders a 56×56 rounded-full element with the Watch icon and "Wear" label', () => {
      render(<NavWearButton ownedWatches={[]} appearance="bottom-nav" />)

      // aria-label differs from header variant — see Test 8 for the exact text
      const btn = screen.getByRole('button', { name: /log a wear/i })
      expect(btn).toBeTruthy()

      // The "Wear" text label renders under the circle (still accessible
      // because it's inside the button with the aria-label as well).
      expect(screen.getByText('Wear')).toBeTruthy()

      // Inner circle is the child <span> carrying rounded-full + size-14.
      // Find it via the SVG's parent (<span> wrapping the Watch icon).
      const svg = btn.querySelector('svg')
      expect(svg).toBeTruthy()
      const circleSpan = svg!.parentElement as HTMLElement
      expect(circleSpan.className).toMatch(/size-14/)
      expect(circleSpan.className).toMatch(/rounded-full/)
    })

    it('Test 6 — `appearance="bottom-nav"` circle has the two-layer Figma shadow', () => {
      render(<NavWearButton ownedWatches={[]} appearance="bottom-nav" />)
      const btn = screen.getByRole('button', { name: /log a wear/i })
      const svg = btn.querySelector('svg')!
      const circleSpan = svg.parentElement as HTMLElement
      // The shadow class uses Tailwind's arbitrary-value syntax with embedded
      // commas; match on the leading shadow prefix + first rgba pair.
      expect(circleSpan.className).toMatch(/shadow-\[/)
      expect(circleSpan.className).toContain('0px_10px_15px_0px_rgba(0,0,0,0.1)')
    })

    it('Test 7 — `appearance="bottom-nav"` circle uses `bg-accent` fill', () => {
      render(<NavWearButton ownedWatches={[]} appearance="bottom-nav" />)
      const btn = screen.getByRole('button', { name: /log a wear/i })
      const svg = btn.querySelector('svg')!
      const circleSpan = svg.parentElement as HTMLElement
      expect(circleSpan.className).toMatch(/bg-accent/)
    })

    it('Test 8 — `appearance="bottom-nav"` button has aria-label "Log a wear" (UI-SPEC Copywriting)', () => {
      render(<NavWearButton ownedWatches={[]} appearance="bottom-nav" />)
      // Exact aria-label lock — NOT "Log a wear for today" (that's the header
      // variant). Bottom-nav variant uses the tighter "Log a wear" string.
      const btn = screen.getByLabelText('Log a wear')
      expect(btn).toBeTruthy()
      expect(btn.tagName).toBe('BUTTON')
    })

    it('Test 9 — both appearances open the SAME WatchPickerDialog', async () => {
      const watches = [makeWatch('x'), makeWatch('y'), makeWatch('z')]
      render(<NavWearButton ownedWatches={watches} appearance="bottom-nav" />)

      expect(screen.queryByTestId('mock-picker')).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: /log a wear/i }))

      await waitFor(() => {
        expect(screen.getByTestId('mock-picker')).toBeTruthy()
      })
      const picker = screen.getByTestId('mock-picker')
      expect(picker.getAttribute('data-open')).toBe('true')
      expect(picker.getAttribute('data-count')).toBe('3')
    })

    it('Test 10 — `appearance="bottom-nav"` Watch icon is 28×28 (size-7)', () => {
      render(<NavWearButton ownedWatches={[]} appearance="bottom-nav" />)
      const btn = screen.getByRole('button', { name: /log a wear/i })
      const svg = btn.querySelector('svg')
      expect(svg).toBeTruthy()
      // size-7 = 28px
      expect(svg!.getAttribute('class') ?? '').toMatch(/size-7/)
    })
  })
})
