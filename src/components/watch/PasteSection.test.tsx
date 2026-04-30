/**
 * Phase 20.1 Plan 01 (Wave 0) — RED test scaffold for PasteSection.
 *
 * Covers ADD-05 (manual-entry link) + URL input behavior.
 *
 * RED until Plan 03 ships `@/components/watch/PasteSection`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

// IMPORT UNDER TEST — Plan 03 ships this file.
import { PasteSection } from '@/components/watch/PasteSection'

describe('Phase 20.1 Plan 03 — PasteSection URL + manual-entry link', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('typing in URL input invokes onUrlChange with the typed string', () => {
    const onUrlChange = vi.fn()
    render(
      <PasteSection
        url=""
        onUrlChange={onUrlChange}
        onExtract={() => {}}
        onManualEntry={() => {}}
        pending={false}
        disabled={false}
      />,
    )
    fireEvent.change(screen.getByPlaceholderText(/Paste a product page URL/i), {
      target: { value: 'https://omega.com/x' },
    })
    expect(onUrlChange).toHaveBeenCalledWith('https://omega.com/x')
  })

  it('clicking Extract Watch button invokes onExtract once', () => {
    const onExtract = vi.fn()
    render(
      <PasteSection
        url="https://example.com/watch"
        onUrlChange={() => {}}
        onExtract={onExtract}
        onManualEntry={() => {}}
        pending={false}
        disabled={false}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Extract Watch/i }))
    expect(onExtract).toHaveBeenCalledTimes(1)
  })

  it('ADD-05 — clicking "or enter manually" link invokes onManualEntry once and does NOT invoke onExtract', () => {
    const onManualEntry = vi.fn()
    const onExtract = vi.fn()
    render(
      <PasteSection
        url=""
        onUrlChange={() => {}}
        onExtract={onExtract}
        onManualEntry={onManualEntry}
        pending={false}
        disabled={false}
      />,
    )
    fireEvent.click(screen.getByText(/or enter manually/i))
    expect(onManualEntry).toHaveBeenCalledTimes(1)
    expect(onExtract).not.toHaveBeenCalled()
  })

  it('pending=true disables input and shows "Working..." on the button', () => {
    render(
      <PasteSection
        url="https://example.com/x"
        onUrlChange={() => {}}
        onExtract={() => {}}
        onManualEntry={() => {}}
        pending={true}
        disabled={false}
      />,
    )
    const input = screen.getByPlaceholderText(/Paste a product page URL/i) as HTMLInputElement
    expect(input).toBeDisabled()
    expect(screen.getByRole('button', { name: /Working/i })).toBeInTheDocument()
  })
})
