/**
 * Phase 20.1 Plan 01 (Wave 0) — RED test scaffold for WishlistRationalePanel.
 *
 * Covers ADD-02 textarea pre-fill + commit shape + Pitfall 5 (blank textarea
 * MUST commit blank — never fall back silently to verdict copy).
 *
 * RED until Plan 03 ships `@/components/watch/WishlistRationalePanel`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// IMPORT UNDER TEST — Plan 03 ships this.
import { WishlistRationalePanel } from '@/components/watch/WishlistRationalePanel'
import type { VerdictBundleFull } from '@/lib/verdict/types'

const verdictWithCopy: VerdictBundleFull = {
  framing: 'cross-user',
  label: 'core-fit',
  headlinePhrasing: 'Core Fit',
  contextualPhrasings: [
    'Aligns with my heritage-driven taste — overlaps strongly with Submariner',
  ],
  mostSimilar: [],
  roleOverlap: false,
}

describe('Phase 20.1 Plan 03 — WishlistRationalePanel (ADD-02 + Pitfall 5)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ADD-02 — textarea pre-fills from verdict.contextualPhrasings copy', () => {
    render(
      <WishlistRationalePanel
        verdict={verdictWithCopy}
        initialNotes=""
        onConfirm={() => {}}
        onCancel={() => {}}
        pending={false}
      />,
    )
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea.value).toContain('Aligns with my heritage-driven taste')
  })

  it('Pitfall 5 — clearing the textarea preserves blank: onConfirm called with empty string, NOT verdict copy', () => {
    const onConfirm = vi.fn()
    render(
      <WishlistRationalePanel
        verdict={verdictWithCopy}
        initialNotes=""
        onConfirm={onConfirm}
        onCancel={() => {}}
        pending={false}
      />,
    )
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /Save to Wishlist/i }))
    expect(onConfirm).toHaveBeenCalledWith('')
  })

  it('edit + confirm — onConfirm receives the user-edited string verbatim', () => {
    const onConfirm = vi.fn()
    render(
      <WishlistRationalePanel
        verdict={verdictWithCopy}
        initialNotes=""
        onConfirm={onConfirm}
        onCancel={() => {}}
        pending={false}
      />,
    )
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'my custom note' } })
    fireEvent.click(screen.getByRole('button', { name: /Save to Wishlist/i }))
    expect(onConfirm).toHaveBeenCalledWith('my custom note')
  })

  it('cancel button invokes onCancel once', () => {
    const onCancel = vi.fn()
    render(
      <WishlistRationalePanel
        verdict={verdictWithCopy}
        initialNotes=""
        onConfirm={() => {}}
        onCancel={onCancel}
        pending={false}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
