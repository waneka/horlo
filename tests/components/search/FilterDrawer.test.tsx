import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Phase 43 Plan 01 — FilterDrawer component tests (PLSH-01, PLSH-02)
//
// Asserts:
//   1. "Filters" title is in the document when open={true}
//   2. swipeDirection="down" prop reaches Drawer.Root
//   3. onOpenChange is NOT wrapped in any pending/loading guard —
//      a backdrop click invokes the passed callback directly
// ---------------------------------------------------------------------------

// Mock @base-ui/react/drawer to allow assertion of swipeDirection prop
// and capture of the onOpenChange callback.
const mockOnOpenChange = vi.fn()

let capturedSwipeDirection: string | undefined
let capturedOnOpenChange: ((open: boolean) => void) | undefined

vi.mock('@base-ui/react/drawer', () => {
  const Root = ({
    children,
    swipeDirection,
    onOpenChange,
    open,
  }: {
    children: React.ReactNode
    swipeDirection?: string
    onOpenChange?: (open: boolean) => void
    open?: boolean
  }) => {
    // Capture props for assertions
    capturedSwipeDirection = swipeDirection
    capturedOnOpenChange = onOpenChange
    // Only render children when open
    return open ? <div data-testid="drawer-root" data-swipe-direction={swipeDirection}>{children}</div> : null
  }

  const Portal = ({ children }: { children: React.ReactNode }) => <>{children}</>

  const Backdrop = ({
    className,
    onClick,
  }: {
    className?: string
    onClick?: () => void
  }) => (
    <div
      data-testid="drawer-backdrop"
      className={className}
      onClick={onClick}
    />
  )

  const Viewport = ({
    children,
    className,
  }: {
    children: React.ReactNode
    className?: string
  }) => <div className={className}>{children}</div>

  const Popup = ({
    children,
    className,
  }: {
    children: React.ReactNode
    className?: string
  }) => <div data-testid="drawer-popup" className={className}>{children}</div>

  const Content = ({
    children,
    className,
  }: {
    children: React.ReactNode
    className?: string
  }) => <div className={className}>{children}</div>

  const Title = ({
    children,
    className,
  }: {
    children: React.ReactNode
    className?: string
  }) => <h2 className={className}>{children}</h2>

  const Close = ({
    children,
    render: renderProp,
  }: {
    children: React.ReactNode
    render?: React.ReactElement
  }) => {
    if (renderProp) {
      // Render the passed element with children injected
      return (
        <button data-testid="drawer-close">
          {children}
        </button>
      )
    }
    return <button data-testid="drawer-close">{children}</button>
  }

  return {
    Drawer: { Root, Portal, Backdrop, Viewport, Popup, Content, Title, Close },
  }
})

// Mock chip components — we only care about the Drawer structure
vi.mock('@/components/search/MovementChips', () => ({
  MovementChips: () => <div data-testid="movement-chips" />,
}))

vi.mock('@/components/search/CaseSizeChips', () => ({
  CaseSizeChips: () => <div data-testid="case-size-chips" />,
}))

vi.mock('@/components/search/StyleChips', () => ({
  StyleChips: () => <div data-testid="style-chips" />,
}))

// Mock Button to avoid shadcn dependency
vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    className,
  }: {
    children: React.ReactNode
    onClick?: () => void
    className?: string
  }) => (
    <button className={className} onClick={onClick}>
      {children}
    </button>
  ),
}))

// Import after mocking
const { FilterDrawer } = await import('@/components/search/FilterDrawer')

const DEFAULT_PROPS = {
  open: true,
  onOpenChange: mockOnOpenChange,
  movement: null,
  size: null,
  styleArr: [],
  onMovementChange: vi.fn(),
  onSizeChange: vi.fn(),
  onStyleChange: vi.fn(),
  styleVocab: ['diver', 'dress', 'field'],
}

describe('FilterDrawer (PLSH-01, PLSH-02)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedSwipeDirection = undefined
    capturedOnOpenChange = undefined
  })

  it('renders "Filters" title when open', () => {
    render(<FilterDrawer {...DEFAULT_PROPS} />)
    expect(screen.getByText('Filters')).toBeInTheDocument()
  })

  it('passes swipeDirection="down" to Drawer.Root', () => {
    render(<FilterDrawer {...DEFAULT_PROPS} />)
    expect(capturedSwipeDirection).toBe('down')
    // Also verify via DOM attribute
    const root = screen.getByTestId('drawer-root')
    expect(root).toHaveAttribute('data-swipe-direction', 'down')
  })

  it('does not render when open=false', () => {
    render(<FilterDrawer {...DEFAULT_PROPS} open={false} />)
    expect(screen.queryByText('Filters')).not.toBeInTheDocument()
  })

  it('passes onOpenChange directly to Drawer.Root without an async guard (D-03)', () => {
    const directOnOpenChange = vi.fn()
    render(<FilterDrawer {...DEFAULT_PROPS} onOpenChange={directOnOpenChange} />)

    // The captured onOpenChange must be the same reference — not wrapped
    expect(capturedOnOpenChange).toBe(directOnOpenChange)
  })

  it('invokes onOpenChange when backdrop interaction triggers it', () => {
    const onOpenChange = vi.fn()
    render(<FilterDrawer {...DEFAULT_PROPS} onOpenChange={onOpenChange} />)

    // Simulate calling the captured callback directly (as the Drawer.Root would on dismiss)
    expect(capturedOnOpenChange).toBeDefined()
    capturedOnOpenChange!(false)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('renders all three chip sections', () => {
    render(<FilterDrawer {...DEFAULT_PROPS} />)
    expect(screen.getByTestId('movement-chips')).toBeInTheDocument()
    expect(screen.getByTestId('case-size-chips')).toBeInTheDocument()
    expect(screen.getByTestId('style-chips')).toBeInTheDocument()
  })

  it('renders "Clear all" button', () => {
    render(<FilterDrawer {...DEFAULT_PROPS} />)
    expect(screen.getByText('Clear all')).toBeInTheDocument()
  })
})
