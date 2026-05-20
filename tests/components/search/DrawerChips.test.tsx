import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Phase 48 Plan 03 Task 1 — Drawer chip component tests (BUG-02 / D-07)
//
// Asserts that after migration each surviving drawer chip component:
//   1. Renders chips via the shared <Chip variant="toggle"> primitive
//      (each chip is a <button> with the toggle primitive's classes)
//   2. Passes selected={true} when the chip matches the current selection
//   3. Calls onSelect with the correct value on click
//   4. Multi-select variant (StyleChips) toggles array membership correctly
//
// Phase 49.1 (D-EXPLORE-01): GenreChips + ArchetypeChips describes are deleted;
// the components themselves are deleted. The drawer now stacks 5 chip groups
// (Movement → CaseSize → Style → Brand → Era) per UI-SPEC §D.
// ---------------------------------------------------------------------------

// Mock the Chip primitive so we can verify props without resolving oklch CSS
vi.mock('@/components/ui/chip', () => ({
  Chip: ({
    variant,
    selected,
    onClick,
    children,
    'aria-pressed': ariaPressed,
  }: {
    variant?: string
    selected?: boolean
    onClick?: () => void
    children: React.ReactNode
    'aria-pressed'?: boolean
  }) => (
    <button
      data-testid="chip"
      data-variant={variant}
      data-selected={selected ? 'true' : 'false'}
      aria-pressed={ariaPressed}
      onClick={onClick}
    >
      {children}
    </button>
  ),
}))

// Mock vocab constants used by some chip components.
// Phase 49.1: PRIMARY_ARCHETYPES + ARCHETYPE_CONFIG mocks are no longer needed
// here — GenreChips/ArchetypeChips were deleted. Other chip groups don't
// consume these symbols (Movement/CaseSize use local constants; Era uses
// ERA_SIGNALS only).
vi.mock('@/lib/taste/vocab', () => ({
  ERA_SIGNALS: ['vintage-leaning', 'modern', 'contemporary'],
}))

// Import components under test after mocking
const { BrandChips } = await import('@/components/search/BrandChips')
const { EraChips } = await import('@/components/search/EraChips')
const { MovementChips } = await import('@/components/search/MovementChips')
const { CaseSizeChips } = await import('@/components/search/CaseSizeChips')
const { StyleChips } = await import('@/components/search/StyleChips')

describe('BrandChips (Plan 48-03 D-07)', () => {
  const vocab = [
    { slug: 'rolex', name: 'Rolex' },
    { slug: 'omega', name: 'Omega' },
  ]

  it('renders chips via <Chip variant="toggle">', () => {
    render(<BrandChips selected={null} onSelect={vi.fn()} vocab={vocab} />)
    const chips = screen.getAllByTestId('chip')
    expect(chips.length).toBe(2)
    chips.forEach((chip) => expect(chip).toHaveAttribute('data-variant', 'toggle'))
  })

  it('marks the selected chip as selected=true', () => {
    render(<BrandChips selected="rolex" onSelect={vi.fn()} vocab={vocab} />)
    const chips = screen.getAllByTestId('chip')
    expect(chips[0]).toHaveAttribute('data-selected', 'true')
    expect(chips[1]).toHaveAttribute('data-selected', 'false')
  })

  it('calls onSelect(null) when clicking the selected chip (deselect)', () => {
    const onSelect = vi.fn()
    render(<BrandChips selected="rolex" onSelect={onSelect} vocab={vocab} />)
    fireEvent.click(screen.getAllByTestId('chip')[0])
    expect(onSelect).toHaveBeenCalledWith(null)
  })

  it('calls onSelect(slug) when clicking an unselected chip', () => {
    const onSelect = vi.fn()
    render(<BrandChips selected={null} onSelect={onSelect} vocab={vocab} />)
    fireEvent.click(screen.getAllByTestId('chip')[1])
    expect(onSelect).toHaveBeenCalledWith('omega')
  })
})

describe('EraChips (Plan 48-03 D-07)', () => {
  it('renders chips via <Chip variant="toggle"> for each ERA_SIGNAL', () => {
    render(<EraChips selected={null} onSelect={vi.fn()} />)
    const chips = screen.getAllByTestId('chip')
    expect(chips.length).toBe(3)
    chips.forEach((chip) => expect(chip).toHaveAttribute('data-variant', 'toggle'))
  })

  it('marks the selected era chip as selected=true', () => {
    render(<EraChips selected="modern" onSelect={vi.fn()} />)
    const chips = screen.getAllByTestId('chip')
    const modernChip = chips.find((c) => c.textContent === 'Modern')
    expect(modernChip).toHaveAttribute('data-selected', 'true')
  })

  it('calls onSelect(null) when deselecting', () => {
    const onSelect = vi.fn()
    render(<EraChips selected="modern" onSelect={onSelect} />)
    const chips = screen.getAllByTestId('chip')
    const modernChip = chips.find((c) => c.textContent === 'Modern')
    fireEvent.click(modernChip!)
    expect(onSelect).toHaveBeenCalledWith(null)
  })
})

describe('MovementChips (Plan 48-03 D-07)', () => {
  it('renders 4 chips via <Chip variant="toggle">', () => {
    render(<MovementChips selected={null} onSelect={vi.fn()} />)
    const chips = screen.getAllByTestId('chip')
    expect(chips.length).toBe(4)
    chips.forEach((chip) => expect(chip).toHaveAttribute('data-variant', 'toggle'))
  })

  it('marks the selected movement chip as selected=true', () => {
    render(<MovementChips selected="auto" onSelect={vi.fn()} />)
    const chips = screen.getAllByTestId('chip')
    const autoChip = chips.find((c) => c.textContent === 'Automatic')
    expect(autoChip).toHaveAttribute('data-selected', 'true')
  })

  it('calls onSelect(value) when clicking an unselected chip', () => {
    const onSelect = vi.fn()
    render(<MovementChips selected={null} onSelect={onSelect} />)
    const chips = screen.getAllByTestId('chip')
    const quartzChip = chips.find((c) => c.textContent === 'Quartz')
    fireEvent.click(quartzChip!)
    expect(onSelect).toHaveBeenCalledWith('quartz')
  })
})

describe('CaseSizeChips (Plan 48-03 D-07)', () => {
  it('renders 5 chips via <Chip variant="toggle">', () => {
    render(<CaseSizeChips selected={null} onSelect={vi.fn()} />)
    const chips = screen.getAllByTestId('chip')
    expect(chips.length).toBe(5)
    chips.forEach((chip) => expect(chip).toHaveAttribute('data-variant', 'toggle'))
  })

  it('marks the selected size chip as selected=true', () => {
    render(<CaseSizeChips selected="40-42" onSelect={vi.fn()} />)
    const chips = screen.getAllByTestId('chip')
    const sizeChip = chips.find((c) => c.textContent === '40–42mm')
    expect(sizeChip).toHaveAttribute('data-selected', 'true')
  })
})

describe('StyleChips — multi-select (Plan 48-03 D-07)', () => {
  const vocab = ['diver', 'dress', 'field']

  it('renders chips via <Chip variant="toggle">', () => {
    render(<StyleChips selected={[]} onSelect={vi.fn()} vocab={vocab} />)
    const chips = screen.getAllByTestId('chip')
    expect(chips.length).toBe(3)
    chips.forEach((chip) => expect(chip).toHaveAttribute('data-variant', 'toggle'))
  })

  it('marks multiple selected chips as selected=true', () => {
    render(<StyleChips selected={['diver', 'field']} onSelect={vi.fn()} vocab={vocab} />)
    const chips = screen.getAllByTestId('chip')
    const diverChip = chips.find((c) => c.textContent === 'Diver')
    const dressChip = chips.find((c) => c.textContent === 'Dress')
    const fieldChip = chips.find((c) => c.textContent === 'Field')
    expect(diverChip).toHaveAttribute('data-selected', 'true')
    expect(dressChip).toHaveAttribute('data-selected', 'false')
    expect(fieldChip).toHaveAttribute('data-selected', 'true')
  })

  it('adds tag to array when clicking unselected chip', () => {
    const onSelect = vi.fn()
    render(<StyleChips selected={['diver']} onSelect={onSelect} vocab={vocab} />)
    const chips = screen.getAllByTestId('chip')
    const dressChip = chips.find((c) => c.textContent === 'Dress')
    fireEvent.click(dressChip!)
    expect(onSelect).toHaveBeenCalledWith(['diver', 'dress'])
  })

  it('removes tag from array when clicking selected chip', () => {
    const onSelect = vi.fn()
    render(<StyleChips selected={['diver', 'dress']} onSelect={onSelect} vocab={vocab} />)
    const chips = screen.getAllByTestId('chip')
    const diverChip = chips.find((c) => c.textContent === 'Diver')
    fireEvent.click(diverChip!)
    expect(onSelect).toHaveBeenCalledWith(['dress'])
  })
})

// Phase 49.1 (D-EXPLORE-01): the GenreChips and ArchetypeChips describe blocks
// were removed when the components themselves were deleted. The drawer's
// surviving 5 groups (Movement / CaseSize / Style / Brand / Era) are exercised
// above.
