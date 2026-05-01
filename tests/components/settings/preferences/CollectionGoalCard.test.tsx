// Phase 23 Plan 01 — Wave 0 RED scaffold for SET-07.
//
// Asserts the not-yet-written <CollectionGoalCard> renders a Card titled
// "Collection goal" with the locked description, the placeholder for an
// undefined initial value, all 4 SelectItem options including the locked
// brand-loyalist label "Brand Loyalist — Same maker, different models"
// (em-dashes — D-03), and that selecting an option calls savePreferences.
//
// This file MUST FAIL today: the import below resolves to a missing module
// because Plan 02 has not yet created src/components/settings/preferences/
// CollectionGoalCard.tsx. The verifier should see "Cannot find module" or
// equivalent module-resolution error as the RED signal.

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock the savePreferences Server Action declared BEFORE the component
// import so vitest hoists the mock in time. The component itself will call
// savePreferences inside a transition; we assert payload shape.
vi.mock('@/app/actions/preferences', () => ({
  savePreferences: vi.fn(async () => ({ success: true, data: undefined })),
}))

// THIS IMPORT MUST FAIL — file does not exist yet (Plan 02 creates it).
import { CollectionGoalCard } from '@/components/settings/preferences/CollectionGoalCard'

describe('<CollectionGoalCard> — Phase 23 SET-07 (Wave 0 RED scaffold)', () => {
  it('renders Card with title "Collection goal" and the locked description', () => {
    render(<CollectionGoalCard initialGoal={undefined} />)
    expect(screen.getByText('Collection goal')).toBeInTheDocument()
    expect(
      screen.getByText('How do you want your collection to grow over time?'),
    ).toBeInTheDocument()
  })

  it('shows placeholder "Select a goal..." when initialGoal is undefined', () => {
    render(<CollectionGoalCard initialGoal={undefined} />)
    expect(screen.getByText('Select a goal...')).toBeInTheDocument()
  })

  it('renders all 4 SelectItem options including the locked Brand Loyalist copy when opened', async () => {
    const user = userEvent.setup()
    render(<CollectionGoalCard initialGoal={undefined} />)
    // base-ui Select trigger exposes role="combobox"
    await user.click(screen.getByRole('combobox'))
    expect(
      screen.getByText('Balanced — Diverse collection across styles'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Specialist — Deep in one area'),
    ).toBeInTheDocument()
    expect(screen.getByText('Variety within a theme')).toBeInTheDocument()
    expect(
      screen.getByText('Brand Loyalist — Same maker, different models'),
    ).toBeInTheDocument()
  })

  it('calls savePreferences with the chosen goal when an option is selected', async () => {
    const { savePreferences } = await import('@/app/actions/preferences')
    const user = userEvent.setup()
    render(<CollectionGoalCard initialGoal={undefined} />)
    await user.click(screen.getByRole('combobox'))
    await user.click(
      screen.getByText('Brand Loyalist — Same maker, different models'),
    )
    expect(savePreferences).toHaveBeenCalledWith({
      collectionGoal: 'brand-loyalist',
    })
  })
})
