/**
 * Phase 68 Plan 01 (Wave 0) — RED test scaffold for ConfirmStep.
 *
 * Covers the confirm-screen presenter: cover photo fallback chain,
 * status radiogroup picker, price field label flip, inline-editable
 * inputs, action affordances, and pending state.
 *
 * 15 cases (a)-(o):
 *   (a) catalogImageUrl set + extractedImageUrl also set → catalog wins
 *   (b) only extractedImageUrl set → extracted renders
 *   (c) neither image set → WatchIcon placeholder (data-testid="confirm-cover-placeholder")
 *   (d) picker shows exactly 3 options (owned / wishlist / grail), no 'sold'
 *   (e) Star icon appears next to Grail label, not owned/wishlist
 *   (f) clicking Owned fires onStatusChange('owned') once; CTA shows "Add to Collection"
 *   (g) CTA label is "Add to Wishlist" when status=wishlist
 *   (h) CTA label is "Save as Grail" when status=grail
 *   (i) owned → "Price paid" label; wishlist + grail → "Target price" label
 *   (j) editing reference input fires onReferenceChange with typed value
 *   (k) editing year input fires onProductionYearChange(number); blank fires undefined
 *   (l) "Edit details" click fires onEditDetails exactly once
 *   (m) "Start over" click fires onStartOver exactly once
 *   (n) pending=true → primary CTA disabled + "Saving..." + Loader2; ghost buttons disabled
 *   (o) aria-checked flips correctly across 3 options on rerender
 *
 * RED until Wave 1 ships `@/components/watch/ConfirmStep`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('next/image', () => ({
  default: (p: { src: string; alt: string }) => <img src={p.src} alt={p.alt} />,
}))

// IMPORT UNDER TEST — Wave 1 ships this.
import { ConfirmStep } from '@/components/watch/ConfirmStep'

const BASE_PROPS = {
  brand: 'Omega',
  model: 'Speedmaster',
  reference: '311.30.42.30.01.005',
  productionYear: undefined as number | undefined,
  status: 'wishlist' as const,
  price: undefined as number | undefined,
  onReferenceChange: vi.fn(),
  onProductionYearChange: vi.fn(),
  onStatusChange: vi.fn(),
  onPriceChange: vi.fn(),
  onPrimary: vi.fn(),
  onEditDetails: vi.fn(),
  onStartOver: vi.fn(),
}

describe("ConfirmStep — cover photo (CONF-01)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('(a) renders catalog cover when catalogImageUrl set, even with extractedImageUrl also set', () => {
    render(
      <ConfirmStep
        {...BASE_PROPS}
        catalogImageUrl="https://catalog.example.com/omega.jpg"
        extractedImageUrl="https://extracted.example.com/omega.jpg"
      />,
    )
    const img = screen.getByRole('img', { name: 'Omega Speedmaster' })
    expect(img).toHaveAttribute('src', 'https://catalog.example.com/omega.jpg')
  })

  it('(b) renders extracted cover when only extractedImageUrl set', () => {
    render(
      <ConfirmStep
        {...BASE_PROPS}
        catalogImageUrl={null}
        extractedImageUrl="https://extracted.example.com/omega.jpg"
      />,
    )
    const img = screen.getByRole('img', { name: 'Omega Speedmaster' })
    expect(img).toHaveAttribute('src', 'https://extracted.example.com/omega.jpg')
  })

  it('(c) renders WatchIcon placeholder when neither image is set', () => {
    render(
      <ConfirmStep
        {...BASE_PROPS}
        catalogImageUrl={null}
        extractedImageUrl={null}
      />,
    )
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByTestId('confirm-cover-placeholder')).toBeInTheDocument()
  })
})

describe("ConfirmStep — status picker (CONF-03/04/08)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('(d) shows exactly 3 radio options (Owned / Wishlist / Grail), no Sold', () => {
    render(<ConfirmStep {...BASE_PROPS} />)
    expect(screen.getByRole('radio', { name: 'Owned' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Wishlist' })).toBeInTheDocument()
    // Grail contains the Star icon — name includes "Grail" text
    expect(screen.getByRole('radio', { name: /Grail/i })).toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: /sold/i })).not.toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(3)
  })

  it('(e) Star icon appears inside the Grail option, not inside Owned or Wishlist', () => {
    render(<ConfirmStep {...BASE_PROPS} />)
    const grailBtn = screen.getByRole('radio', { name: /Grail/i })
    // Star icon is the span > svg inside the Grail button
    const starSvg = grailBtn.querySelector('svg')
    expect(starSvg).not.toBeNull()

    const ownedBtn = screen.getByRole('radio', { name: 'Owned' })
    expect(ownedBtn.querySelector('svg')).toBeNull()

    const wishlistBtn = screen.getByRole('radio', { name: 'Wishlist' })
    expect(wishlistBtn.querySelector('svg')).toBeNull()
  })

  it('(f) clicking Owned fires onStatusChange("owned") exactly once; with status=owned CTA is "Add to Collection"', () => {
    const onStatusChange = vi.fn()
    render(
      <ConfirmStep
        {...BASE_PROPS}
        status="owned"
        onStatusChange={onStatusChange}
      />,
    )
    fireEvent.click(screen.getByRole('radio', { name: 'Owned' }))
    expect(onStatusChange).toHaveBeenCalledTimes(1)
    expect(onStatusChange).toHaveBeenCalledWith('owned')
    expect(screen.getByRole('button', { name: 'Add to Collection' })).toBeInTheDocument()
  })

  it('(g) CTA label is "Add to Wishlist" when status=wishlist', () => {
    render(<ConfirmStep {...BASE_PROPS} status="wishlist" />)
    expect(screen.getByRole('button', { name: 'Add to Wishlist' })).toBeInTheDocument()
  })

  it('(h) CTA label is "Save as Grail" when status=grail', () => {
    render(<ConfirmStep {...BASE_PROPS} status="grail" />)
    expect(screen.getByRole('button', { name: 'Save as Grail' })).toBeInTheDocument()
  })

  it('(o) aria-checked reflects status correctly across all three options on rerender', () => {
    const { rerender } = render(<ConfirmStep {...BASE_PROPS} status="owned" />)

    const ownedBtn = screen.getByRole('radio', { name: 'Owned' })
    const wishlistBtn = screen.getByRole('radio', { name: 'Wishlist' })
    const grailBtn = screen.getByRole('radio', { name: /Grail/i })

    expect(ownedBtn).toHaveAttribute('aria-checked', 'true')
    expect(wishlistBtn).toHaveAttribute('aria-checked', 'false')
    expect(grailBtn).toHaveAttribute('aria-checked', 'false')

    rerender(<ConfirmStep {...BASE_PROPS} status="grail" />)

    expect(screen.getByRole('radio', { name: 'Owned' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('radio', { name: 'Wishlist' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('radio', { name: /Grail/i })).toHaveAttribute('aria-checked', 'true')
  })
})

describe("ConfirmStep — price field (CONF-06)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('(i) owned → "Price paid" label; wishlist → "Target price"; grail → "Target price"', () => {
    const { rerender } = render(<ConfirmStep {...BASE_PROPS} status="owned" />)
    expect(screen.getByText('Price paid')).toBeInTheDocument()
    expect(screen.queryByText('Target price')).not.toBeInTheDocument()

    rerender(<ConfirmStep {...BASE_PROPS} status="wishlist" />)
    expect(screen.getByText('Target price')).toBeInTheDocument()
    expect(screen.queryByText('Price paid')).not.toBeInTheDocument()

    rerender(<ConfirmStep {...BASE_PROPS} status="grail" />)
    expect(screen.getByText('Target price')).toBeInTheDocument()
    expect(screen.queryByText('Price paid')).not.toBeInTheDocument()
  })
})

describe("ConfirmStep — inline inputs (CONF-05)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('(j) editing reference input fires onReferenceChange with the typed value', () => {
    const onReferenceChange = vi.fn()
    render(<ConfirmStep {...BASE_PROPS} onReferenceChange={onReferenceChange} />)
    const referenceInput = screen.getByLabelText('Reference')
    fireEvent.change(referenceInput, { target: { value: '321.30.44.51.01.002' } })
    expect(onReferenceChange).toHaveBeenCalledTimes(1)
    expect(onReferenceChange).toHaveBeenCalledWith('321.30.44.51.01.002')
  })

  it('(k) editing year input fires onProductionYearChange(number); clearing fires undefined', () => {
    const onProductionYearChange = vi.fn()
    render(<ConfirmStep {...BASE_PROPS} onProductionYearChange={onProductionYearChange} />)
    const yearInput = screen.getByLabelText('Year')

    fireEvent.change(yearInput, { target: { value: '2020' } })
    expect(onProductionYearChange).toHaveBeenCalledWith(2020)

    fireEvent.change(yearInput, { target: { value: '' } })
    expect(onProductionYearChange).toHaveBeenCalledWith(undefined)
  })
})

describe("ConfirmStep — action affordances (CONF-07/09)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('(l) clicking "Edit details" fires onEditDetails exactly once', () => {
    const onEditDetails = vi.fn()
    render(<ConfirmStep {...BASE_PROPS} onEditDetails={onEditDetails} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }))
    expect(onEditDetails).toHaveBeenCalledTimes(1)
  })

  it('(m) clicking "Start over" fires onStartOver exactly once', () => {
    const onStartOver = vi.fn()
    render(<ConfirmStep {...BASE_PROPS} onStartOver={onStartOver} />)
    fireEvent.click(screen.getByRole('button', { name: 'Start over' }))
    expect(onStartOver).toHaveBeenCalledTimes(1)
  })
})

describe("ConfirmStep — pending state", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('(n) pending=true → primary CTA disabled + shows "Saving..." text; ghost buttons also disabled', () => {
    render(<ConfirmStep {...BASE_PROPS} pending={true} status="wishlist" />)

    // Primary CTA is disabled and shows "Saving..."
    expect(screen.getByText(/Saving\.\.\./)).toBeInTheDocument()
    // The CTA button is not queryable by its normal label when pending — find by disabled state
    const allButtons = screen.getAllByRole('button')
    const disabledButtons = allButtons.filter((b) => b.hasAttribute('disabled'))
    expect(disabledButtons.length).toBeGreaterThanOrEqual(3)

    // Edit details and Start over are disabled
    expect(screen.getByRole('button', { name: 'Edit details' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Start over' })).toBeDisabled()

    // The Loader2 SVG is present inside the CTA button area
    // We can't query by aria-hidden, but the "Saving..." text confirms the pending state
    // Check that the normal CTA label is gone
    expect(screen.queryByRole('button', { name: 'Add to Wishlist' })).not.toBeInTheDocument()
  })
})
