import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import { WatchPickerDialog } from '@/components/home/WatchPickerDialog'
import type { Watch } from '@/lib/types'

// next/link stub
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string
    children: React.ReactNode
    className?: string
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

// Mock the Server Action.
const mockMarkAsWorn = vi.fn()
vi.mock('@/app/actions/wearEvents', () => ({
  markAsWorn: (...args: unknown[]) => mockMarkAsWorn(...args),
}))

function makeWatch(overrides: Partial<Watch> = {}): Watch {
  return {
    id: 'watch-1',
    brand: 'Rolex',
    model: 'Submariner',
    status: 'owned',
    movement: 'automatic',
    complications: [],
    styleTags: [],
    designTraits: [],
    roleTags: [],
    ...overrides,
  }
}

describe('WatchPickerDialog — Pitfall 10 single dialog for self-tile + nav +Wear', () => {
  beforeEach(() => {
    mockMarkAsWorn.mockReset()
  })

  it('Test 1 — empty owned watches renders "Add a watch first" empty state', () => {
    render(
      <WatchPickerDialog
        open
        onOpenChange={() => {}}
        watches={[]}
      />,
    )
    expect(screen.getByText('Add a watch first')).toBeTruthy()
    expect(
      screen.getByText(
        /You don.t have any watches yet\. Add one to log your wear\./,
      ),
    ).toBeTruthy()
    // Primary CTA links to the add-watch route.
    const cta = screen.getByRole('link', { name: 'Add watch' })
    expect(cta.getAttribute('href')).toBe('/watch/new')
  })

  it('Test 2 — 3 owned watches renders 3 rows', () => {
    const watches = [
      makeWatch({ id: 'w1', brand: 'Rolex', model: 'Submariner' }),
      makeWatch({ id: 'w2', brand: 'Omega', model: 'Speedmaster' }),
      makeWatch({ id: 'w3', brand: 'Seiko', model: 'SKX007' }),
    ]
    render(
      <WatchPickerDialog
        open
        onOpenChange={() => {}}
        watches={watches}
      />,
    )
    expect(screen.getAllByRole('option').length).toBe(3)
  })

  it('Test 3 — typing a brand into the search filters the list (case-insensitive)', () => {
    const watches = [
      makeWatch({ id: 'w1', brand: 'Rolex', model: 'Submariner' }),
      makeWatch({ id: 'w2', brand: 'Omega', model: 'Speedmaster' }),
      makeWatch({ id: 'w3', brand: 'Seiko', model: 'SKX007' }),
    ]
    render(
      <WatchPickerDialog
        open
        onOpenChange={() => {}}
        watches={watches}
      />,
    )
    const input = screen.getByLabelText('Search watches')
    fireEvent.change(input, { target: { value: 'rolex' } })
    const options = screen.getAllByRole('option')
    expect(options.length).toBe(1)
    expect(options[0].textContent).toMatch(/Rolex/)
  })

  it('Test 4 — selecting a row enables the "Log wear" submit button', () => {
    render(
      <WatchPickerDialog
        open
        onOpenChange={() => {}}
        watches={[makeWatch({ id: 'w1' })]}
      />,
    )
    const submit = screen.getByRole('button', { name: 'Log wear' })
    expect(submit.hasAttribute('disabled')).toBe(true)

    fireEvent.click(screen.getByRole('option'))
    expect(submit.hasAttribute('disabled')).toBe(false)
  })

  it('Test 5 — clicking "Log wear" with a selection calls markAsWorn(selectedId)', async () => {
    mockMarkAsWorn.mockResolvedValue({ success: true })
    render(
      <WatchPickerDialog
        open
        onOpenChange={() => {}}
        watches={[makeWatch({ id: 'w-target' })]}
      />,
    )
    fireEvent.click(screen.getByRole('option'))
    fireEvent.click(screen.getByRole('button', { name: 'Log wear' }))
    await waitFor(() => expect(mockMarkAsWorn).toHaveBeenCalledWith('w-target'))
    expect(mockMarkAsWorn).toHaveBeenCalledTimes(1)
  })

  it('Test 6 — successful markAsWorn closes the dialog via onOpenChange(false)', async () => {
    mockMarkAsWorn.mockResolvedValue({ success: true })
    const onOpenChange = vi.fn()
    render(
      <WatchPickerDialog
        open
        onOpenChange={onOpenChange}
        watches={[makeWatch({ id: 'w-ok' })]}
      />,
    )
    fireEvent.click(screen.getByRole('option'))
    fireEvent.click(screen.getByRole('button', { name: 'Log wear' }))
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })

  it('Test 7 — failed markAsWorn renders "Couldn\'t log that wear." inline', async () => {
    mockMarkAsWorn.mockResolvedValue({
      success: false,
      error: 'Watch not found',
    })
    render(
      <WatchPickerDialog
        open
        onOpenChange={() => {}}
        watches={[makeWatch({ id: 'w-fail' })]}
      />,
    )
    fireEvent.click(screen.getByRole('option'))
    fireEvent.click(screen.getByRole('button', { name: 'Log wear' }))
    await waitFor(() =>
      expect(screen.getByText(/Couldn.t log that wear\./)).toBeTruthy(),
    )
  })

  it('Test 8 — "Keep browsing" closes the dialog without calling markAsWorn', () => {
    const onOpenChange = vi.fn()
    render(
      <WatchPickerDialog
        open
        onOpenChange={onOpenChange}
        watches={[makeWatch({ id: 'w1' })]}
      />,
    )
    // Select a row first — this is the exact scenario where we want to
    // confirm that Keep browsing short-circuits the action path.
    fireEvent.click(screen.getByRole('option'))
    fireEvent.click(screen.getByRole('button', { name: 'Keep browsing' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(mockMarkAsWorn).not.toHaveBeenCalled()
  })
})
