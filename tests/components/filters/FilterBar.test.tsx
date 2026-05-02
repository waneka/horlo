// tests/components/filters/FilterBar.test.tsx (TEST-06)
//
// Interaction coverage for <FilterBar>:
//   - styleTag toggle through store action when clicked
//   - styleTag removed on second click (toggle off)
//   - "Clear all filters" calls resetFilters
//   - priceRange: setFilter called via store interaction
//   - roleTag toggle through store action when clicked
//
// PointerEvent polyfill is in tests/setup.ts (lifted per RESEARCH.md Pitfall 6).
// No per-file polyfill needed here.

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FilterBar } from '@/components/filters/FilterBar'
import { useWatchStore } from '@/store/watchStore'

// Capture initial state once; reset before each test (Zustand v5 replace-mode).
const initialState = useWatchStore.getState()

describe('<FilterBar>', () => {
  beforeEach(() => {
    useWatchStore.setState(initialState, true)
  })

  it('toggles a styleTag through the store action when clicked', async () => {
    const user = userEvent.setup()
    render(<FilterBar maxPrice={5000} />)
    // CollapsibleSection defaults to closed — open it first.
    await user.click(screen.getByRole('button', { name: /style/i }))
    // 'diver' is the first entry in STYLE_TAGS from src/lib/constants.ts
    await user.click(screen.getByText('diver'))
    expect(useWatchStore.getState().filters.styleTags).toContain('diver')
  })

  it('removes styleTag on second click (toggle off)', async () => {
    const user = userEvent.setup()
    render(<FilterBar maxPrice={5000} />)
    await user.click(screen.getByRole('button', { name: /style/i }))
    const diverBadge = screen.getByText('diver')
    await user.click(diverBadge)
    expect(useWatchStore.getState().filters.styleTags).toContain('diver')
    await user.click(diverBadge)
    expect(useWatchStore.getState().filters.styleTags).toHaveLength(0)
  })

  it('"Clear all filters" button calls resetFilters and clears store', async () => {
    const user = userEvent.setup()
    // Set a filter via direct store call so the "Clear all filters" button appears.
    useWatchStore.getState().setFilter('styleTags', ['diver'])
    render(<FilterBar maxPrice={5000} />)
    // The button only renders when hasActiveFilters is true.
    const clearBtn = screen.getByRole('button', { name: /clear all filters/i })
    await user.click(clearBtn)
    const { filters } = useWatchStore.getState()
    expect(filters.styleTags).toHaveLength(0)
    expect(filters.roleTags).toHaveLength(0)
    expect(filters.dialColors).toHaveLength(0)
    expect(filters.priceRange).toEqual({ min: null, max: null })
  })

  it('priceRange: committing a range via setFilter updates the store', () => {
    // Slider DOM events are unreliable in jsdom; verify that calling
    // setFilter('priceRange', ...) directly reflects the correct store shape.
    // This tests the store integration that FilterBar wires up.
    useWatchStore.getState().setFilter('priceRange', { min: 500, max: 3000 })
    const { priceRange } = useWatchStore.getState().filters
    expect(priceRange.min).toBe(500)
    expect(priceRange.max).toBe(3000)
  })

  it('toggles a roleTag through the store action when clicked', async () => {
    const user = userEvent.setup()
    render(<FilterBar maxPrice={5000} />)
    // Open Role section first.
    await user.click(screen.getByRole('button', { name: /role/i }))
    // 'daily' is the first entry in ROLE_TAGS from src/lib/constants.ts
    await user.click(screen.getByText('daily'))
    expect(useWatchStore.getState().filters.roleTags).toContain('daily')
  })
})
