// Wave 0 RED stub — Phase 77 / 77-01-PLAN.md
// Plan 06: upgraded from todo to assertions (VID-01, D-04)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// useMediaCapability mock — controlled per-test to verify capability-gated
// rendering. The mock is hoisted so its identity is stable across tests.
vi.mock('@/hooks/useMediaCapability', () => ({
  useMediaCapability: vi.fn(),
}))

// next/navigation router — required because ComposeStep calls useRouter()
// at the top of its body.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

import { ComposeStep } from '@/components/wywt/ComposeStep'
import { useMediaCapability } from '@/hooks/useMediaCapability'

const mockedUseMediaCapability = useMediaCapability as unknown as ReturnType<typeof vi.fn>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mkProps(overrides: Record<string, any> = {}) {
  return {
    watch: {
      id: 'w-1',
      brand: 'Rolex',
      model: 'GMT',
      reference: '126710',
      imageUrl: null,
    } as Parameters<typeof ComposeStep>[0]['watch'],
    viewerId: 'v-1',
    wearEventId: 'we-1',
    mediaState: { kind: 'none' as const },
    setMediaState: vi.fn(),
    note: '',
    setNote: vi.fn(),
    visibility: 'public' as const,
    setVisibility: vi.fn(),
    onChange: vi.fn(),
    onSubmitted: vi.fn(),
    ...overrides,
  }
}

describe('ComposeStep video — 3-button chooser (VID-01, D-04)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('VID-01: renders 3 pre-capture buttons when supportsVideoCapture=true', () => {
    mockedUseMediaCapability.mockReturnValue({
      supportsVideoCapture: true,
      preferredMimeType: 'video/mp4;codecs=avc1',
    })
    render(<ComposeStep {...mkProps()} />)
    expect(screen.getByRole('button', { name: /Take wrist shot/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Record video/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Upload photo/i })).toBeInTheDocument()
  })

  it('D-04: renders 2 pre-capture buttons when supportsVideoCapture=false (Record video hidden)', () => {
    mockedUseMediaCapability.mockReturnValue({
      supportsVideoCapture: false,
      preferredMimeType: null,
    })
    render(<ComposeStep {...mkProps()} />)
    // Both photo buttons remain present
    expect(screen.getByRole('button', { name: /Take wrist shot/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Upload photo/i })).toBeInTheDocument()
    // Record video is hidden — assert disappearance per durable feedback
    expect(screen.queryByRole('button', { name: /Record video/i })).not.toBeInTheDocument()
  })
})
