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
  it('Test 1 — renders with label "Wear" and a Plus icon', () => {
    render(<NavWearButton ownedWatches={[]} />)
    // Label
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

  it('Test 4 — button uses outline variant', () => {
    render(<NavWearButton ownedWatches={[]} />)
    const btn = screen.getByRole('button', { name: /log a wear/i })
    // shadcn Button outline variant includes `border-border` and `bg-background`.
    const cls = btn.getAttribute('class') ?? ''
    expect(cls).toMatch(/border-border/)
    expect(cls).toMatch(/bg-background/)
  })
})
