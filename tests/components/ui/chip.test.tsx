import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Chip, chipVariants } from '@/components/ui/chip'

describe('chipVariants', () => {
  // Test 1: toggle variant returns correct class composition
  it('toggle variant returns base + unselected class set', () => {
    const result = chipVariants({ variant: 'toggle' })
    expect(result).toContain('bg-secondary')
    expect(result).toContain('text-secondary-foreground')
    expect(result).toContain('border-border')
    expect(result).toContain('hover:bg-muted')
    expect(result).toContain('rounded-full')
    expect(result).toContain('border')
    expect(result).toContain('px-3')
    expect(result).toContain('py-1')
    expect(result).toContain('text-sm')
    expect(result).toContain('transition-colors')
    expect(result).toContain('focus-visible:ring-2')
  })

  // Test 2: removable variant returns correct class composition
  it('removable variant returns base + removable class set', () => {
    const result = chipVariants({ variant: 'removable' })
    expect(result).toContain('bg-accent/10')
    expect(result).toContain('border-accent')
    expect(result).toContain('text-foreground')
    expect(result).toContain('font-semibold')
    expect(result).toContain('hover:bg-accent/20')
    expect(result).toContain('gap-1')
  })

  // Test 3: BUG-02 regression guard — removable variant MUST NOT use text-accent-foreground
  it('removable variant does NOT contain text-accent-foreground (BUG-02 dark-mode regression guard)', () => {
    const result = chipVariants({ variant: 'removable' })
    expect(result).not.toContain('text-accent-foreground')
  })
})

describe('Chip component', () => {
  // Test 4: default render is a button with toggle-unselected classes
  it('renders a <button type="button"> with toggle-unselected class set by default', () => {
    render(<Chip>Default</Chip>)
    const button = screen.getByRole('button')
    expect(button).toBeInTheDocument()
    expect(button).toHaveAttribute('type', 'button')
    expect(button).toHaveClass('bg-secondary')
    expect(button).toHaveClass('text-secondary-foreground')
    expect(button).toHaveClass('rounded-full')
  })

  // Test 5: toggle selected={true} renders selected class set
  it('toggle variant with selected={true} applies selected class set', () => {
    render(<Chip variant="toggle" selected>Selected</Chip>)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('bg-accent')
    expect(button).toHaveClass('text-accent-foreground')
    expect(button).toHaveClass('border-accent')
    expect(button).toHaveClass('font-semibold')
  })

  // Test 6: removable variant renders X icon + sr-only label + calls onClick
  it('removable variant renders children, aria-hidden X icon, sr-only label, and fires onClick', () => {
    const spy = vi.fn()
    const { container } = render(
      <Chip variant="removable" onClick={spy} removeLabel="Remove brand filter">
        Rolex
      </Chip>
    )

    const button = screen.getByRole('button')
    expect(button).toHaveTextContent('Rolex')

    // X icon should be an SVG with aria-hidden="true"
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg).toHaveAttribute('aria-hidden', 'true')

    // sr-only label
    const srLabel = screen.getByText('Remove brand filter')
    expect(srLabel).toHaveClass('sr-only')

    // Click fires once
    button.click()
    expect(spy).toHaveBeenCalledTimes(1)
  })

  // Test 7: removable variant with no removeLabel does NOT render empty sr-only span
  // WR-02 follow-up: `onClick` is now required on removable variants (discriminated
  // union enforces this at compile time). Test supplies a no-op spy to satisfy TS.
  it('removable variant with no removeLabel does not render empty sr-only span', () => {
    const { container } = render(
      <Chip variant="removable" onClick={vi.fn()}>Label</Chip>
    )
    const srSpan = container.querySelector('span.sr-only')
    expect(srSpan).toBeNull()
  })
})
