// Phase 23 Plan 01 — Wave 0 RED scaffold for SET-08.
//
// Asserts the not-yet-written <OverlapToleranceCard> renders a Card titled
// "Overlap tolerance" with the locked description, all 3 SelectItem options,
// and that selecting an option calls savePreferences with the chosen value.
//
// This file MUST FAIL today: the import below resolves to a missing module
// because Plan 02 has not yet created src/components/settings/preferences/
// OverlapToleranceCard.tsx.

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('@/app/actions/preferences', () => ({
  savePreferences: vi.fn(async () => ({ success: true, data: undefined })),
}))

// THIS IMPORT MUST FAIL — file does not exist yet (Plan 02 creates it).
import { OverlapToleranceCard } from '@/components/settings/preferences/OverlapToleranceCard'

describe('<OverlapToleranceCard> — Phase 23 SET-08 (Wave 0 RED scaffold)', () => {
  it('renders Card with title "Overlap tolerance" and the locked description', () => {
    render(<OverlapToleranceCard initialTolerance="medium" />)
    expect(screen.getByText('Overlap tolerance')).toBeInTheDocument()
    expect(
      screen.getByText(
        'How strictly should we flag watches that overlap with what you already own?',
      ),
    ).toBeInTheDocument()
  })

  it('renders all 3 SelectItem options when opened', async () => {
    const user = userEvent.setup()
    render(<OverlapToleranceCard initialTolerance="medium" />)
    await user.click(screen.getByRole('combobox'))
    expect(screen.getByText('Low — Flag any overlap')).toBeInTheDocument()
    expect(
      screen.getByText('Medium — Flag significant overlap'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('High — Only flag major overlap'),
    ).toBeInTheDocument()
  })

  it('calls savePreferences with the chosen tolerance', async () => {
    const { savePreferences } = await import('@/app/actions/preferences')
    const user = userEvent.setup()
    render(<OverlapToleranceCard initialTolerance="medium" />)
    await user.click(screen.getByRole('combobox'))
    await user.click(screen.getByText('High — Only flag major overlap'))
    expect(savePreferences).toHaveBeenCalledWith({
      overlapTolerance: 'high',
    })
  })
})
