import { render } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

// ProfileWatchCard uses next/image + next/link — mock next/image for jsdom.
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...(props as Record<string, unknown>)} />
  },
}))

import { CommonGroundTabContent } from '@/components/profile/CommonGroundTabContent'
import type {
  TasteOverlapResult,
  SharedWatchEntry,
} from '@/lib/tasteOverlap'
import type { Watch } from '@/lib/types'

function makeWatch(over: Partial<Watch> = {}): Watch {
  return {
    id: over.id ?? 'w1',
    brand: 'Rolex',
    model: 'Submariner',
    status: 'owned',
    dateAdded: '2024-01-01',
    ...over,
  } as Watch
}

function makeSharedWatch(
  i: number,
  over: Partial<SharedWatchEntry> = {},
): SharedWatchEntry {
  const watch = makeWatch({ id: `w${i}`, model: `M${i}` })
  return {
    brand: watch.brand,
    model: watch.model,
    viewerWatch: watch,
    ownerWatch: watch,
    ...over,
  }
}

function makeOverlap(
  overrides: Partial<TasteOverlapResult> = {},
): TasteOverlapResult {
  return {
    sharedWatches: [],
    sharedTasteTags: [],
    sharedStyleRows: [],
    sharedRoleRows: [],
    overlapLabel: 'Different taste',
    hasAny: false,
    ...overrides,
  }
}

describe('CommonGroundTabContent', () => {
  it('Strong overlap: renders heading + explainer body mentioning owner label + watch count + lowercased style', () => {
    const { getByText, getByRole } = render(
      <CommonGroundTabContent
        overlap={makeOverlap({
          overlapLabel: 'Strong overlap',
          hasAny: true,
          sharedWatches: [
            makeSharedWatch(1),
            makeSharedWatch(2),
            makeSharedWatch(3),
          ],
          sharedStyleRows: [
            { label: 'Sport', viewerPct: 60, ownerPct: 50 },
          ],
        })}
        ownerDisplayLabel="Tyler"
      />,
    )
    expect(
      getByRole('heading', { level: 2, name: 'Strong overlap' }),
    ).toBeTruthy()
    // Explainer body mentions displayName + sport + 3
    expect(
      getByText(
        /Tyler.*lean sport together.*share 3 watches/,
      ),
    ).toBeTruthy()
  })

  it('Some overlap: renders heading + explainer body with both counts pluralized', () => {
    const { getByText, getByRole } = render(
      <CommonGroundTabContent
        overlap={makeOverlap({
          overlapLabel: 'Some overlap',
          hasAny: true,
          sharedWatches: [makeSharedWatch(1)],
          sharedTasteTags: ['Sporty', 'Dressy'],
        })}
        ownerDisplayLabel="@tyler"
      />,
    )
    expect(
      getByRole('heading', { level: 2, name: 'Some overlap' }),
    ).toBeTruthy()
    // singular watch + plural tags
    expect(
      getByText(
        /You share 1 watch and 2 taste tags with @tyler\./,
      ),
    ).toBeTruthy()
  })

  it('Different taste: renders heading + exact explainer body', () => {
    const { getByText, getByRole } = render(
      <CommonGroundTabContent
        overlap={makeOverlap({
          overlapLabel: 'Different taste',
          hasAny: true,
          sharedTasteTags: ['Sporty'],
        })}
        ownerDisplayLabel="Tyler"
      />,
    )
    expect(
      getByRole('heading', { level: 2, name: 'Different taste' }),
    ).toBeTruthy()
    expect(
      getByText(
        "Your collections dont overlap much — different taste, different styles.",
      ),
    ).toBeTruthy()
  })

  it('omits Shared watches section when sharedWatches is empty', () => {
    const { queryByText, container } = render(
      <CommonGroundTabContent
        overlap={makeOverlap({
          overlapLabel: 'Some overlap',
          hasAny: true,
          sharedWatches: [],
          sharedTasteTags: ['Sporty'],
        })}
        ownerDisplayLabel="Tyler"
      />,
    )
    expect(queryByText(/Shared watches/)).toBeNull()
    // No ProfileWatchCard anchors (each renders a <a> with href=/watch/{id})
    expect(container.querySelector('a[href^="/watch/"]')).toBeNull()
  })

  it('omits Shared taste tags section when empty', () => {
    const { queryByText } = render(
      <CommonGroundTabContent
        overlap={makeOverlap({
          overlapLabel: 'Some overlap',
          hasAny: true,
          sharedWatches: [makeSharedWatch(1)],
          sharedTasteTags: [],
        })}
        ownerDisplayLabel="Tyler"
      />,
    )
    expect(queryByText('Shared taste tags')).toBeNull()
  })

  it('omits Collection composition section when both style and role rows empty', () => {
    const { queryByText } = render(
      <CommonGroundTabContent
        overlap={makeOverlap({
          overlapLabel: 'Some overlap',
          hasAny: true,
          sharedWatches: [makeSharedWatch(1)],
          sharedStyleRows: [],
          sharedRoleRows: [],
        })}
        ownerDisplayLabel="Tyler"
      />,
    )
    expect(queryByText('Collection composition')).toBeNull()
  })

  it('dual-bar markup emits inline style widths matching viewerPct and ownerPct', () => {
    const { container } = render(
      <CommonGroundTabContent
        overlap={makeOverlap({
          overlapLabel: 'Strong overlap',
          hasAny: true,
          sharedWatches: [makeSharedWatch(1)],
          sharedStyleRows: [
            { label: 'Sport', viewerPct: 60, ownerPct: 50 },
          ],
        })}
        ownerDisplayLabel="Tyler"
      />,
    )
    const html = container.innerHTML
    expect(html.includes('width: 60%')).toBe(true)
    expect(html.includes('width: 50%')).toBe(true)
  })

  it('renders legend "You" and ownerDisplayLabel inside Collection composition section', () => {
    const { queryByText } = render(
      <CommonGroundTabContent
        overlap={makeOverlap({
          overlapLabel: 'Some overlap',
          hasAny: true,
          sharedWatches: [makeSharedWatch(1)],
          sharedStyleRows: [
            { label: 'Sport', viewerPct: 60, ownerPct: 50 },
          ],
        })}
        ownerDisplayLabel="Tyler"
      />,
    )
    expect(queryByText('You')).toBeTruthy()
    // ownerDisplayLabel appears in explainer AND legend; assert at least one
    expect(queryByText('Tyler')).toBeTruthy()
  })
})
