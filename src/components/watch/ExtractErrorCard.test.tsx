/**
 * Phase 25 Plan 02 — ExtractErrorCard tests
 *
 * Verifies the 5-category branching, locked D-15 recovery copy verbatim,
 * locked D-14 lucide icons, dual-CTA wiring, and accessibility surface
 * (role="alert" + aria-live="polite") per UI-SPEC §ExtractErrorCard
 * Component Contract.
 *
 * Copy is LOCKED per D-15 — DO NOT paraphrase any heading or body string.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import {
  ExtractErrorCard,
  type ExtractErrorCategory,
} from '@/components/watch/ExtractErrorCard'

const CASES: Array<[ExtractErrorCategory, string, string]> = [
  [
    'host-403',
    'This site blocks data extraction',
    "This site doesn't allow data extraction. Try entering manually.",
  ],
  [
    'structured-data-missing',
    'No watch info found',
    "Couldn't find watch info on this page. Try the original product page or enter manually.",
  ],
  [
    'LLM-timeout',
    'Extraction timed out',
    'Extraction is taking longer than expected. Try again or enter manually.',
  ],
  [
    'quota-exceeded',
    'Service is busy',
    'Extraction service is busy. Try again in a few minutes.',
  ],
  [
    'generic-network',
    "Couldn't reach that URL",
    "Couldn't reach that URL. Check the link and try again.",
  ],
]

describe('ExtractErrorCard — category branches (D-14 + D-15 LOCKED)', () => {
  it.each(CASES)(
    'renders %s category with locked heading and body',
    (category, heading, body) => {
      render(
        <ExtractErrorCard
          category={category}
          retryAction={vi.fn()}
          manualAction={vi.fn()}
        />,
      )
      expect(screen.getByText(heading)).toBeInTheDocument()
      expect(screen.getByText(body)).toBeInTheDocument()
    },
  )

  it.each(CASES)(
    'renders an SVG icon for %s category',
    (category) => {
      render(
        <ExtractErrorCard
          category={category}
          retryAction={vi.fn()}
          manualAction={vi.fn()}
        />,
      )
      // Lucide renders icons as <svg class="lucide ..."> — confirm one exists
      // inside the alert region. Anti-Pattern #9 forbids any non-locked icons,
      // so the single SVG is the category's locked icon.
      const alert = screen.getByRole('alert')
      const svg = alert.querySelector('svg')
      expect(svg).toBeTruthy()
      expect(svg?.classList.contains('lucide')).toBe(true)
    },
  )
})

describe('ExtractErrorCard — interactions', () => {
  it('clicking the primary "Add manually" button calls manualAction', () => {
    const manualAction = vi.fn()
    const retryAction = vi.fn()
    render(
      <ExtractErrorCard
        category="host-403"
        retryAction={retryAction}
        manualAction={manualAction}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Add manually' }))
    expect(manualAction).toHaveBeenCalledTimes(1)
    expect(retryAction).not.toHaveBeenCalled()
  })

  it('clicking the secondary "Try a different URL" button calls retryAction', () => {
    const manualAction = vi.fn()
    const retryAction = vi.fn()
    render(
      <ExtractErrorCard
        category="generic-network"
        retryAction={retryAction}
        manualAction={manualAction}
      />,
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Try a different URL' }),
    )
    expect(retryAction).toHaveBeenCalledTimes(1)
    expect(manualAction).not.toHaveBeenCalled()
  })

  it('renders both CTAs for every category', () => {
    for (const [category] of CASES) {
      const { unmount } = render(
        <ExtractErrorCard
          category={category}
          retryAction={vi.fn()}
          manualAction={vi.fn()}
        />,
      )
      expect(
        screen.getByRole('button', { name: 'Add manually' }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Try a different URL' }),
      ).toBeInTheDocument()
      unmount()
    }
  })
})

describe('ExtractErrorCard — accessibility', () => {
  it('root has role="alert" and aria-live="polite"', () => {
    const { container } = render(
      <ExtractErrorCard
        category="LLM-timeout"
        retryAction={vi.fn()}
        manualAction={vi.fn()}
      />,
    )
    const alert = container.querySelector('[role="alert"]')
    expect(alert).toBeTruthy()
    expect(alert).toHaveAttribute('aria-live', 'polite')
  })

  it('icon container is aria-hidden (decorative; differentiates categories visually only)', () => {
    render(
      <ExtractErrorCard
        category="quota-exceeded"
        retryAction={vi.fn()}
        manualAction={vi.fn()}
      />,
    )
    const alert = screen.getByRole('alert')
    const svg = alert.querySelector('svg')
    // Lucide auto-applies aria-hidden when no a11y props are supplied; we also
    // pass aria-hidden explicitly per UI-SPEC §Layout.
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
  })
})
