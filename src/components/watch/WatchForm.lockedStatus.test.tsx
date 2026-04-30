/**
 * Phase 20.1 Plan 04 — WatchForm lockedStatus prop tests (D-12 + D-01).
 *
 * Verifies:
 *   1. lockedStatus="owned" replaces the status Select with a read-only chip
 *   2. lockedStatus="owned" → addWatch payload carries status: 'owned'
 *   3. omitting lockedStatus preserves the existing editable Select behavior
 *   4. UrlImport mount is gone from WatchForm (D-01 — legacy "Apply to Form" UX
 *      moved to AddWatchFlow)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

const mockAddWatch = vi.fn()
const mockEditWatch = vi.fn()

vi.mock('@/app/actions/watches', () => ({
  addWatch: (data: unknown) => mockAddWatch(data),
  editWatch: (id: string, data: unknown) => mockEditWatch(id, data),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}))

vi.mock('@/components/watch/CatalogPhotoUploader', () => ({
  CatalogPhotoUploader: () => null,
}))

import { WatchForm } from '@/components/watch/WatchForm'

describe('Phase 20.1 Plan 04 — WatchForm lockedStatus prop (D-12)', () => {
  beforeEach(() => {
    mockAddWatch.mockReset()
    mockEditWatch.mockReset()
    mockAddWatch.mockResolvedValue({ success: true, data: { id: 'w-new' } })
  })

  it('renders read-only status chip (no Select) when lockedStatus="owned"', () => {
    render(<WatchForm mode="create" lockedStatus="owned" />)
    // The chip carries aria-readonly="true" and shows "owned".
    const chip = document.querySelector('[aria-readonly="true"]')
    expect(chip).not.toBeNull()
    expect(chip?.textContent?.toLowerCase()).toContain('owned')
    // No status Select trigger should exist with accessible name "Status".
    expect(screen.queryByRole('combobox', { name: /^Status$/i })).not.toBeInTheDocument()
  })

  it('submits with status="owned" when lockedStatus="owned"', async () => {
    render(<WatchForm mode="create" lockedStatus="owned" />)

    fireEvent.change(screen.getByLabelText(/^Brand/i), { target: { value: 'Omega' } })
    fireEvent.change(screen.getByLabelText(/^Model/i), { target: { value: 'Speedy' } })

    await act(async () => {
      fireEvent.submit(
        screen.getByRole('button', { name: /Add Watch/i }).closest('form')!,
      )
    })

    await waitFor(() => expect(mockAddWatch).toHaveBeenCalled())
    expect(mockAddWatch).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'owned', brand: 'Omega', model: 'Speedy' }),
    )
  })

  it('renders editable Select when lockedStatus is omitted', () => {
    render(<WatchForm mode="create" />)
    // Editable Select renders — find by combobox role (shadcn Select trigger).
    // No aria-readonly element should appear in the form.
    expect(document.querySelector('[aria-readonly="true"]')).toBeNull()
    // Combobox role is present (Select trigger).
    const combos = screen.queryAllByRole('combobox')
    expect(combos.length).toBeGreaterThan(0)
  })

  it('does NOT render UrlImport (legacy "Apply to Form" UX gone — D-01)', () => {
    render(<WatchForm mode="create" />)
    expect(screen.queryByText(/Import from URL/i)).toBeNull()
    expect(screen.queryByText(/Apply to Form/i)).toBeNull()
  })
})
