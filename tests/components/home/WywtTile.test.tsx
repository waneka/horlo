import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { WywtTile } from '@/components/home/WywtTile'
import type { WywtTile as WywtTileData } from '@/lib/wywtTypes'

// `next/image` under jsdom does not emit a real <img>; stub it so we can
// assert DOM alt/visual shape.
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { src, alt, fill: _fill, unoptimized: _unoptimized, ...rest } = props
    const imgProps = { ...rest } as Record<string, unknown>
    delete imgProps.fill
    delete imgProps.unoptimized
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src as string} alt={alt as string} {...imgProps} />
  },
}))

function makeTile(overrides: Partial<WywtTileData> = {}): WywtTileData {
  return {
    wearEventId: 'evt-1',
    userId: 'user-alice',
    username: 'alice',
    displayName: 'Alice',
    avatarUrl: null,
    watchId: 'watch-1',
    brand: 'Rolex',
    model: 'Submariner',
    imageUrl: 'https://example.com/sub.jpg',
    wornDate: new Date(Date.now() - 5 * 60 * 60 * 1000) // 5h ago
      .toISOString()
      .slice(0, 10),
    note: null,
    visibility: 'public',
    isSelf: false,
    ...overrides,
  }
}

describe('WywtTile — W-04 Instagram Reels feel + Pitfall 4 hydration', () => {
  it('Test 1 — unviewed tile renders ring-2 ring-ring', () => {
    render(
      <WywtTile
        tile={makeTile()}
        isSelfPlaceholder={false}
        viewedIds={new Set()}
        hydrated
        onOpen={() => {}}
        onOpenPicker={() => {}}
      />,
    )
    const button = screen.getByRole('button')
    expect(button.className).toMatch(/ring-2/)
    expect(button.className).toMatch(/ring-ring/)
  })

  it('Test 2 — viewed tile AFTER hydration renders ring-1 ring-muted-foreground/40', () => {
    render(
      <WywtTile
        tile={makeTile({ wearEventId: 'viewed-1' })}
        isSelfPlaceholder={false}
        viewedIds={new Set(['viewed-1'])}
        hydrated
        onOpen={() => {}}
        onOpenPicker={() => {}}
      />,
    )
    const button = screen.getByRole('button')
    expect(button.className).toMatch(/ring-1/)
    expect(button.className).toMatch(/ring-muted-foreground\/40/)
  })

  it('Test 3 — self-placeholder renders "What are you wearing?" text', () => {
    render(
      <WywtTile
        tile={null}
        isSelfPlaceholder
        viewedIds={new Set()}
        hydrated
        onOpen={() => {}}
        onOpenPicker={() => {}}
      />,
    )
    expect(screen.getByText('What are you wearing?')).toBeTruthy()
  })

  it('Test 4 — clicking non-self tile fires onOpen', () => {
    const onOpen = vi.fn()
    render(
      <WywtTile
        tile={makeTile()}
        isSelfPlaceholder={false}
        viewedIds={new Set()}
        hydrated
        onOpen={onOpen}
        onOpenPicker={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('Test 5 — clicking self-placeholder fires onOpenPicker (not onOpen)', () => {
    const onOpen = vi.fn()
    const onOpenPicker = vi.fn()
    render(
      <WywtTile
        tile={null}
        isSelfPlaceholder
        viewedIds={new Set()}
        hydrated
        onOpen={onOpen}
        onOpenPicker={onOpenPicker}
      />,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(onOpenPicker).toHaveBeenCalledTimes(1)
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('Test 6 — aria-label unviewed: "Unviewed wear from {username}, {timeAgo}"', () => {
    render(
      <WywtTile
        tile={makeTile({ username: 'bob' })}
        isSelfPlaceholder={false}
        viewedIds={new Set()}
        hydrated
        onOpen={() => {}}
        onOpenPicker={() => {}}
      />,
    )
    const button = screen.getByRole('button')
    const label = button.getAttribute('aria-label')
    expect(label).toMatch(/^Unviewed wear from bob, /)
  })

  it('Test 7 — aria-label viewed: "Wear from {username}, {timeAgo}"', () => {
    render(
      <WywtTile
        tile={makeTile({ wearEventId: 'v1', username: 'bob' })}
        isSelfPlaceholder={false}
        viewedIds={new Set(['v1'])}
        hydrated
        onOpen={() => {}}
        onOpenPicker={() => {}}
      />,
    )
    const button = screen.getByRole('button')
    const label = button.getAttribute('aria-label')
    // Must NOT start with "Unviewed"
    expect(label).toMatch(/^Wear from bob, /)
    expect(label).not.toMatch(/^Unviewed/)
  })

  it('Test 8 — aria-label self: "What are you wearing? Log a wear for today."', () => {
    render(
      <WywtTile
        tile={null}
        isSelfPlaceholder
        viewedIds={new Set()}
        hydrated
        onOpen={() => {}}
        onOpenPicker={() => {}}
      />,
    )
    const button = screen.getByRole('button')
    expect(button.getAttribute('aria-label')).toBe(
      'What are you wearing? Log a wear for today.',
    )
  })

  it('Test 9 (Pitfall 4 guard) — pre-hydration always renders unviewed ring even if viewedIds contains the id', () => {
    // When hydrated=false, the client has not yet read localStorage, so every
    // tile must render as unviewed to match the server's SSR output.
    render(
      <WywtTile
        tile={makeTile({ wearEventId: 'seeded' })}
        isSelfPlaceholder={false}
        viewedIds={new Set(['seeded'])}
        hydrated={false}
        onOpen={() => {}}
        onOpenPicker={() => {}}
      />,
    )
    const button = screen.getByRole('button')
    expect(button.className).toMatch(/ring-2/)
    expect(button.className).toMatch(/ring-ring/)
    expect(button.className).not.toMatch(/ring-muted-foreground\/40/)
  })
})
