import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { CommonGroundHeroBand } from '@/components/profile/CommonGroundHeroBand'
import type { TasteOverlapResult } from '@/lib/tasteOverlap'

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

describe('CommonGroundHeroBand', () => {
  it('renders Strong overlap pill with bg-accent text-accent-foreground', () => {
    const { getByText } = render(
      <CommonGroundHeroBand
        overlap={makeOverlap({
          overlapLabel: 'Strong overlap',
          hasAny: true,
          sharedWatches: [
            {
              brand: 'Rolex',
              model: 'Submariner',
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              viewerWatch: {} as any,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ownerWatch: {} as any,
            },
          ],
        })}
        ownerUsername="tyler"
      />,
    )
    const pill = getByText('Strong overlap')
    expect(pill.className).toContain('bg-accent')
    expect(pill.className).toContain('text-accent-foreground')
  })

  it('renders Some overlap pill with bg-muted text-foreground', () => {
    const { getByText } = render(
      <CommonGroundHeroBand
        overlap={makeOverlap({
          overlapLabel: 'Some overlap',
          hasAny: true,
          sharedTasteTags: ['Sporty'],
        })}
        ownerUsername="tyler"
      />,
    )
    const pill = getByText('Some overlap')
    expect(pill.className).toContain('bg-muted')
    expect(pill.className).toContain('text-foreground')
  })

  it('renders Different taste pill with bg-muted text-muted-foreground', () => {
    const { getByText } = render(
      <CommonGroundHeroBand
        overlap={makeOverlap({
          overlapLabel: 'Different taste',
          hasAny: true,
          sharedTasteTags: ['Sporty'],
        })}
        ownerUsername="tyler"
      />,
    )
    const pill = getByText('Different taste')
    expect(pill.className).toContain('bg-muted')
    expect(pill.className).toContain('text-muted-foreground')
  })

  it('renders "1 shared watch" (singular) when sharedWatches.length === 1', () => {
    const { getByText } = render(
      <CommonGroundHeroBand
        overlap={makeOverlap({
          overlapLabel: 'Some overlap',
          hasAny: true,
          sharedWatches: [
            {
              brand: 'Rolex',
              model: 'Submariner',
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              viewerWatch: {} as any,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ownerWatch: {} as any,
            },
          ],
        })}
        ownerUsername="tyler"
      />,
    )
    expect(getByText(/1 shared watch(?!es)/)).toBeTruthy()
  })

  it('renders "3 shared watches" (plural) when length === 3', () => {
    const sw = Array.from({ length: 3 }).map((_, i) => ({
      brand: 'B',
      model: `M${i}`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      viewerWatch: {} as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ownerWatch: {} as any,
    }))
    const { getByText } = render(
      <CommonGroundHeroBand
        overlap={makeOverlap({
          overlapLabel: 'Strong overlap',
          hasAny: true,
          sharedWatches: sw,
        })}
        ownerUsername="tyler"
      />,
    )
    expect(getByText(/3 shared watches/)).toBeTruthy()
  })

  it('pluralizes shared taste tags (1 vs 2)', () => {
    const oneTagRender = render(
      <CommonGroundHeroBand
        overlap={makeOverlap({
          overlapLabel: 'Some overlap',
          hasAny: true,
          sharedTasteTags: ['Sporty'],
        })}
        ownerUsername="tyler"
      />,
    )
    expect(oneTagRender.getByText(/1 shared taste tag(?!s)/)).toBeTruthy()
    oneTagRender.unmount()

    const twoTagRender = render(
      <CommonGroundHeroBand
        overlap={makeOverlap({
          overlapLabel: 'Some overlap',
          hasAny: true,
          sharedTasteTags: ['Sporty', 'Dressy'],
        })}
        ownerUsername="tyler"
      />,
    )
    expect(twoTagRender.getByText(/2 shared taste tags/)).toBeTruthy()
  })

  it('renders "lean {style} together" fragment when sharedStyleRows has positive row', () => {
    const { getByText } = render(
      <CommonGroundHeroBand
        overlap={makeOverlap({
          overlapLabel: 'Strong overlap',
          hasAny: true,
          sharedTasteTags: ['x'],
          sharedStyleRows: [
            { label: 'Sport', viewerPct: 60, ownerPct: 50 },
          ],
        })}
        ownerUsername="tyler"
      />,
    )
    expect(getByText(/lean sport together/)).toBeTruthy()
  })

  it('omits "lean {style} together" when sharedStyleRows is empty', () => {
    const { queryByText } = render(
      <CommonGroundHeroBand
        overlap={makeOverlap({
          overlapLabel: 'Some overlap',
          hasAny: true,
          sharedTasteTags: ['x'],
          sharedStyleRows: [],
        })}
        ownerUsername="tyler"
      />,
    )
    expect(queryByText(/lean .* together/)).toBeNull()
  })

  it('renders "See full comparison →" link to /u/{username}/common-ground with hidden-below-sm classes', () => {
    const { getByText } = render(
      <CommonGroundHeroBand
        overlap={makeOverlap({
          overlapLabel: 'Strong overlap',
          hasAny: true,
          sharedTasteTags: ['x'],
        })}
        ownerUsername="tyler"
      />,
    )
    const link = getByText('See full comparison →').closest('a')
    expect(link).toBeTruthy()
    expect(link?.getAttribute('href')).toBe('/u/tyler/common-ground')
    expect(link?.className).toContain('hidden')
    expect(link?.className).toContain('sm:inline')
  })

  it('empty overlap (hasAny=false) renders the single-line "No overlap yet" copy with no pill, no stats, no link', () => {
    const { container, queryByText, getByText } = render(
      <CommonGroundHeroBand
        overlap={makeOverlap({ hasAny: false })}
        ownerUsername="tyler"
      />,
    )
    expect(
      getByText('No overlap yet — your tastes are distinct.'),
    ).toBeTruthy()
    // No pill
    expect(queryByText('Strong overlap')).toBeNull()
    expect(queryByText('Some overlap')).toBeNull()
    expect(queryByText('Different taste')).toBeNull()
    // No drill link
    expect(queryByText('See full comparison →')).toBeNull()
    // No <a> anchor at all
    expect(container.querySelector('a')).toBeNull()
  })

  it('band container has py-4, border-t, border-b, bg-card classes', () => {
    const { container } = render(
      <CommonGroundHeroBand
        overlap={makeOverlap({
          overlapLabel: 'Some overlap',
          hasAny: true,
          sharedTasteTags: ['x'],
        })}
        ownerUsername="tyler"
      />,
    )
    const section = container.querySelector('section')
    expect(section?.className).toContain('py-4')
    expect(section?.className).toContain('border-t')
    expect(section?.className).toContain('border-b')
    expect(section?.className).toContain('bg-card')
  })
})
