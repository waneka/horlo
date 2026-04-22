import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

vi.mock('@/app/actions/suggestions', () => ({
  loadMoreSuggestions: vi.fn(),
}))

// next/link stub (used transitively by SuggestedCollectorRow)
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
    'aria-label': ariaLabel,
  }: {
    href: string
    children: React.ReactNode
    className?: string
    'aria-label'?: string
  }) => (
    <a href={href} className={className} aria-label={ariaLabel}>
      {children}
    </a>
  ),
}))

// next/image stub
vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    className,
  }: {
    src: string
    alt: string
    className?: string
  }) => <img src={src} alt={alt} className={className} />,
}))

vi.mock('@/components/profile/FollowButton', () => ({
  FollowButton: ({ targetUserId }: { targetUserId: string }) => (
    <button data-testid="follow-button" data-target={targetUserId}>
      Follow
    </button>
  ),
}))

import { LoadMoreSuggestionsButton } from '@/components/home/LoadMoreSuggestionsButton'
import { loadMoreSuggestions } from '@/app/actions/suggestions'
import type { SuggestedCollector } from '@/lib/discoveryTypes'
import type { SuggestionCursor } from '@/data/suggestions'

const INITIAL_CURSOR: SuggestionCursor = {
  overlap: 0.85,
  userId: '00000000-0000-4000-8000-000000000001',
}

function makeCollector(
  overrides: Partial<SuggestedCollector> = {},
): SuggestedCollector {
  return {
    userId: 'u-bob',
    username: 'bob',
    displayName: 'Bob',
    avatarUrl: null,
    overlap: 0.55,
    sharedCount: 2,
    sharedWatches: [],
    ...overrides,
  }
}

async function flush() {
  await act(async () => {
    await Promise.resolve()
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('LoadMoreSuggestionsButton', () => {
  it('Test 1 — idle state: button label "Load more", not disabled', () => {
    render(
      <LoadMoreSuggestionsButton
        initialCursor={INITIAL_CURSOR}
        viewerId="v1"
      />,
    )
    const btn = screen.getByRole('button')
    expect(btn).toHaveTextContent(/Load more/)
    expect(btn).not.toBeDisabled()
  })

  it('Test 2 — loading state: after click, disabled + aria-label "Loading more collectors" + spinner', async () => {
    let resolveAction: (v: unknown) => void = () => {}
    ;(loadMoreSuggestions as Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveAction = resolve
      }),
    )
    render(
      <LoadMoreSuggestionsButton
        initialCursor={INITIAL_CURSOR}
        viewerId="v1"
      />,
    )
    const btn = screen.getByRole('button')
    fireEvent.click(btn)
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('aria-label', 'Loading more collectors')
    const spinner = btn.querySelector('.animate-spin')
    expect(spinner).toBeTruthy()
    resolveAction({ success: true, data: { collectors: [], nextCursor: null } })
    await flush()
  })

  it('Test 3 — success with nextCursor null: row appended, button unmounts', async () => {
    ;(loadMoreSuggestions as Mock).mockResolvedValue({
      success: true,
      data: {
        collectors: [makeCollector({ userId: 'u-bob', username: 'bob' })],
        nextCursor: null,
      },
    })
    const { container } = render(
      <LoadMoreSuggestionsButton
        initialCursor={INITIAL_CURSOR}
        viewerId="v1"
      />,
    )
    fireEvent.click(screen.getByRole('button'))
    await flush()
    // Appended row renders (Bob's collection link present)
    expect(container.querySelector('a[href="/u/bob/collection"]')).toBeTruthy()
    // Button unmounts when cursor becomes null
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('Test 4 — success with nextCursor non-null: button stays mounted', async () => {
    const nextCursor: SuggestionCursor = {
      overlap: 0.2,
      userId: '00000000-0000-4000-8000-000000000002',
    }
    ;(loadMoreSuggestions as Mock).mockResolvedValue({
      success: true,
      data: {
        collectors: [makeCollector({ userId: 'u-bob' })],
        nextCursor,
      },
    })
    render(
      <LoadMoreSuggestionsButton
        initialCursor={INITIAL_CURSOR}
        viewerId="v1"
      />,
    )
    fireEvent.click(screen.getByRole('button'))
    await flush()
    expect(screen.getByRole('button')).toBeTruthy()
  })

  it("Test 5 — error: label flips to \"Couldn't load more. Tap to retry.\"", async () => {
    ;(loadMoreSuggestions as Mock).mockResolvedValue({
      success: false,
      error: "Couldn't load more collectors.",
    })
    render(
      <LoadMoreSuggestionsButton
        initialCursor={INITIAL_CURSOR}
        viewerId="v1"
      />,
    )
    fireEvent.click(screen.getByRole('button'))
    await flush()
    const btn = screen.getByRole('button')
    expect(btn).toHaveTextContent("Couldn't load more. Tap to retry.")
  })

  it('Test 6 — retry after error: subsequent success clears the error and appends', async () => {
    ;(loadMoreSuggestions as Mock).mockResolvedValueOnce({
      success: false,
      error: "Couldn't load more collectors.",
    })
    ;(loadMoreSuggestions as Mock).mockResolvedValueOnce({
      success: true,
      data: {
        collectors: [makeCollector({ userId: 'u-carol', username: 'carol' })],
        nextCursor: null,
      },
    })
    const { container } = render(
      <LoadMoreSuggestionsButton
        initialCursor={INITIAL_CURSOR}
        viewerId="v1"
      />,
    )
    fireEvent.click(screen.getByRole('button'))
    await flush()
    expect(screen.getByRole('button')).toHaveTextContent(
      "Couldn't load more. Tap to retry.",
    )
    fireEvent.click(screen.getByRole('button'))
    await flush()
    // Button unmounts on success+nextCursor=null
    expect(screen.queryByRole('button')).toBeNull()
    // Appended row renders
    expect(container.querySelector('a[href="/u/carol/collection"]')).toBeTruthy()
  })
})
