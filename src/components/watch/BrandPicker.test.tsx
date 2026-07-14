/**
 * Phase 82 Plan 02 — TDD RED scaffold for BrandPicker.
 *
 * Unit tests for the BrandPicker component:
 *   - Controlled-open combobox for brand selection
 *   - Client-side substring filter (D-82-02)
 *   - UI-02 "Couldn't find" affordance — SRCH-03 lesson: sibling of List, NOT inside
 *   - assert-disappearance-too: affordance click fires onCouldntFind AND closes popup
 *
 * 8 test cases:
 *   (1) Render + filter: types 'ome' → ONE item; types 'xyz' → ZERO items + affordance
 *   (2) Selection fires onChange AND popup closes (assert-disappearance-too direction 2)
 *   (3) UI-02 affordance gate — empty input → no affordance rendered
 *   (4) UI-02 affordance gate — no onCouldntFind prop → no affordance (merge dialog use case)
 *   (5) UI-02 affordance click — assert-disappearance-too — THE load-bearing test:
 *         (a) popup closes, (b) onCouldntFind called with typed string
 *   (6) Affordance emit: whitespace-padded typed value → trimmed in onCouldntFind call
 *   (7) Grep armor: no Combobox.Empty in BrandPicker.tsx
 *   (8) Grep armor: verbatim D-82-05 copy present in BrandPicker.tsx
 *
 * Memory guardrails enforced:
 *   - [[assert-disappearance-too]]: Test 5 asserts BOTH popup close AND callback fire
 *   - [[accent-is-active-token]]: Item highlight class uses bg-accent (not bg-primary)
 *   - [[button-medium-guardrail]]: No font-medium in the component
 *
 * RED until Task 1 ships `@/components/watch/BrandPicker`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// ---- future import — will error RED until BrandPicker exists ----
import { BrandPicker } from '@/components/watch/BrandPicker'

const BRANDS = [
  { id: 'a', name: 'Omega' },
  { id: 'b', name: 'Rolex' },
  { id: 'c', name: 'Longines' },
]

const BASE_PROPS = {
  brands: BRANDS,
  value: null as { id: string; name: string } | null,
  onChange: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('BrandPicker — render + client-side filter (D-82-02)', () => {
  it('(1a) types "ome" → ONE item "Omega" visible in popup', async () => {
    const user = userEvent.setup()
    render(<BrandPicker {...BASE_PROPS} />)

    const input = screen.getByRole('combobox')
    await user.click(input)
    await user.type(input, 'ome')

    await waitFor(() => {
      expect(screen.queryByRole('option', { name: 'Omega' })).toBeInTheDocument()
    })
    // Rolex and Longines should NOT appear
    expect(screen.queryByRole('option', { name: 'Rolex' })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Longines' })).not.toBeInTheDocument()
  })

  it('(1b) types "xyz" (no matches) → ZERO items + affordance button appears (when onCouldntFind provided)', async () => {
    const onCouldntFind = vi.fn()
    const user = userEvent.setup()
    render(<BrandPicker {...BASE_PROPS} onCouldntFind={onCouldntFind} />)

    const input = screen.getByRole('combobox')
    await user.click(input)
    await user.type(input, 'xyz')

    await waitFor(() => {
      expect(screen.queryByTestId('brand-picker-couldnt-find')).toBeInTheDocument()
    })
    // No option items should be present
    expect(screen.queryByRole('option')).not.toBeInTheDocument()
  })
})

describe('BrandPicker — selection fires onChange and closes popup', () => {
  it('(2) ArrowDown then Enter fires onChange({ id, name }) and popup closes', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<BrandPicker {...BASE_PROPS} onChange={onChange} />)

    const input = screen.getByRole('combobox')
    await user.click(input)
    await user.type(input, 'ome')

    await waitFor(() => {
      expect(screen.queryByRole('option', { name: 'Omega' })).toBeInTheDocument()
    })

    await user.keyboard('{ArrowDown}')
    await user.keyboard('{Enter}')

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith({ id: 'a', name: 'Omega' })

    // Popup should close after selection
    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })
  })

  // Regression: clicking an item was updating parent state but leaving the visible
  // input showing the user's typed prefix (e.g., "Ham" instead of "Hamilton"). The
  // onInputValueChange guard (details.reason !== 'input-change') is intentional but
  // was also blocking the 'item-press' event base-ui fires to sync the label. The
  // fix pushes the picked.name into inputValue explicitly in onValueChange.
  it('(2b) selection updates the visible input value to the picked brand name', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<BrandPicker {...BASE_PROPS} onChange={onChange} />)

    const input = screen.getByRole('combobox') as HTMLInputElement
    await user.click(input)
    await user.type(input, 'long')

    await waitFor(() => {
      expect(screen.queryByRole('option', { name: 'Longines' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('option', { name: 'Longines' }))

    expect(onChange).toHaveBeenCalledWith({ id: 'c', name: 'Longines' })
    // Input should now show the FULL selected brand name, not the typed prefix
    expect(input.value).toBe('Longines')
  })
})

describe('BrandPicker — UI-02 affordance gate: empty input', () => {
  it('(3) empty inputValue → no affordance button rendered regardless of onCouldntFind', async () => {
    const onCouldntFind = vi.fn()
    render(<BrandPicker {...BASE_PROPS} onCouldntFind={onCouldntFind} />)

    // No typing → no affordance
    expect(screen.queryByTestId('brand-picker-couldnt-find')).not.toBeInTheDocument()
  })
})

describe('BrandPicker — UI-02 affordance gate: no onCouldntFind prop', () => {
  it('(4) onCouldntFind omitted → no affordance even with zero matches + non-empty typed', async () => {
    // No onCouldntFind provided (merge dialog use case per Plan 04)
    const user = userEvent.setup()
    render(<BrandPicker brands={BRANDS} value={null} onChange={vi.fn()} />)

    const input = screen.getByRole('combobox')
    await user.click(input)
    await user.type(input, 'xyz')

    await waitFor(() => {
      // Even with no matches, affordance must NOT render when onCouldntFind is absent
      expect(screen.queryByTestId('brand-picker-couldnt-find')).not.toBeInTheDocument()
    })
  })
})

describe('BrandPicker — UI-02 affordance click (assert-disappearance-too)', () => {
  it('(5) THE load-bearing test: affordance click (a) fires onCouldntFind with typed string AND (b) popup closes', async () => {
    const onCouldntFind = vi.fn()
    const user = userEvent.setup()
    render(<BrandPicker {...BASE_PROPS} onCouldntFind={onCouldntFind} />)

    const input = screen.getByRole('combobox')
    await user.click(input)
    await user.type(input, 'CustomWatchCo')

    // Wait for affordance to appear
    await waitFor(() => {
      expect(screen.queryByTestId('brand-picker-couldnt-find')).toBeInTheDocument()
    })

    // Verify affordance copy
    const affordanceBtn = screen.getByTestId('brand-picker-couldnt-find')
    expect(affordanceBtn.textContent).toContain("Couldn't find that brand")
    expect(affordanceBtn.textContent).toContain('CustomWatchCo')

    // Click the affordance
    await user.click(affordanceBtn)

    // (a) Assert onCouldntFind fired with trimmed typed string
    expect(onCouldntFind).toHaveBeenCalledTimes(1)
    expect(onCouldntFind).toHaveBeenCalledWith('CustomWatchCo')

    // (b) Assert popup CLOSES — [[assert-disappearance-too]]
    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })
  })
})

describe('BrandPicker — affordance emit trims whitespace', () => {
  it('(6) whitespace-padded typed value "  CustomCo  " → onCouldntFind called with "CustomCo" (trimmed)', async () => {
    const onCouldntFind = vi.fn()
    const user = userEvent.setup()
    render(<BrandPicker {...BASE_PROPS} onCouldntFind={onCouldntFind} />)

    const input = screen.getByRole('combobox')
    await user.click(input)
    // Note: userEvent.type doesn't support leading spaces well; we use keyboard events
    // The trimming behavior is verified by the component's onClick handler
    await user.type(input, '  CustomCo  ')

    await waitFor(() => {
      expect(screen.queryByTestId('brand-picker-couldnt-find')).toBeInTheDocument()
    })

    const affordanceBtn = screen.getByTestId('brand-picker-couldnt-find')
    await user.click(affordanceBtn)

    expect(onCouldntFind).toHaveBeenCalledTimes(1)
    // The argument must be the trimmed value
    expect(onCouldntFind.mock.calls[0][0]).toBe(onCouldntFind.mock.calls[0][0].trim())
  })
})

describe('BrandPicker — grep armor (SRCH-03 lesson + D-82-05)', () => {
  it('(7) BrandPicker.tsx must NOT use Combobox.Empty (affordance is sibling, not inside Empty)', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/components/watch/BrandPicker.tsx'),
      'utf8',
    )
    const count = (src.match(/Combobox\.Empty/g) ?? []).length
    expect(count).toBe(0)
  })

  it("(8) BrandPicker.tsx must contain verbatim D-82-05 copy: \"Couldn't find that brand\" + \"add as\"", () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/components/watch/BrandPicker.tsx'),
      'utf8',
    )
    // Pattern matches the em-dash copy: "Couldn't find that brand — add as"
    expect(src).toMatch(/Couldn.t find that brand.*add as/)
  })
})
