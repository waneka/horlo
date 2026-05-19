// src/components/explore/__tests__/HeroModule.test.tsx
// Phase 47 Plan 03 — Live tests for HeroModule component.
//
// Test coverage:
//   EXPL-08: HeroModule returns null when eligible pool is empty (null-hide / D-10)
//   EXPL-08: HeroModule renders the manually pinned list when active and eligible (D-09)
//   EXPL-08: HeroModule falls back to weekly rotation when no valid pin exists (D-07)
//   EXPL-08: HeroModule falls back to weekly rotation when pinned list is not eligible (D-09 fallback)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

// Mock next/cache — cacheLife and cacheTag are no-ops under vitest
vi.mock('next/cache', () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

// Mock next/link to a plain anchor
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string
    children: React.ReactNode
    className?: string
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

// Mock DAL functions so the component doesn't need a DB connection
const mockGetPublishedLists = vi.fn()
const mockGetListItemCount = vi.fn()
const mockGetCmsSettings = vi.fn()

vi.mock('@/data/curatedLists', () => ({
  getPublishedLists: (...args: unknown[]) => mockGetPublishedLists(...args),
  getListItemCount: (...args: unknown[]) => mockGetListItemCount(...args),
}))

vi.mock('@/data/cmsSettings', () => ({
  getCmsSettings: (...args: unknown[]) => mockGetCmsSettings(...args),
}))

// Helper: build a minimal eligible list
function makeList(overrides: Partial<{
  id: string
  title: string
  curatorName: string
  coverUrl: string | null
  introMarkdown: string | null
  publishedAt: Date | null
  status: string
}> = {}) {
  return {
    id: 'list-1',
    title: 'Test List',
    curatorName: 'Test Curator',
    coverUrl: 'https://example.com/cover.jpg',
    introMarkdown: 'Some intro text',
    publishedAt: new Date('2024-01-01'),
    status: 'published',
    sortOrder: 0,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }
}

// Helper: default CMS settings (no active pin)
function makeSettings(overrides: Partial<{
  pinnedListId: string | null
  pinExpiresAt: Date | null
  heroFormat: string
}> = {}) {
  return {
    id: 1 as const,
    pinnedListId: null,
    pinExpiresAt: null,
    heroFormat: 'featured_list' as const,
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('HeroModule', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('returns null when the eligible pool is empty (EXPL-02 absent-not-empty / D-10)', async () => {
    mockGetPublishedLists.mockResolvedValue([])
    mockGetListItemCount.mockResolvedValue(0)
    mockGetCmsSettings.mockResolvedValue(makeSettings())

    const { HeroModule } = await import('@/components/explore/HeroModule')
    const result = await HeroModule({ weekIndex: 0 })
    expect(result).toBeNull()
  })

  it('renders the pinned list when a valid manual pin is active (D-09)', async () => {
    const pinnedList = makeList({ id: 'pinned-list', title: 'Pinned Feature' })
    const otherList = makeList({ id: 'other-list', title: 'Other List' })
    mockGetPublishedLists.mockResolvedValue([pinnedList, otherList])
    mockGetListItemCount.mockResolvedValue(5)
    mockGetCmsSettings.mockResolvedValue(makeSettings({
      pinnedListId: 'pinned-list',
      pinExpiresAt: null,
    }))

    const { HeroModule } = await import('@/components/explore/HeroModule')
    const result = await HeroModule({ weekIndex: 0 })
    render(result as React.ReactElement)
    expect(screen.getByText('Pinned Feature')).toBeTruthy()
    expect(screen.queryByText('Other List')).toBeNull()
  })

  it('falls back to weekly rotation when no valid pin exists (D-07)', async () => {
    const list1 = makeList({ id: 'list-a', title: 'List A', publishedAt: new Date('2024-01-01') })
    const list2 = makeList({ id: 'list-b', title: 'List B', publishedAt: new Date('2024-02-01') })
    mockGetPublishedLists.mockResolvedValue([list1, list2])
    mockGetListItemCount.mockResolvedValue(5)
    mockGetCmsSettings.mockResolvedValue(makeSettings())

    const { HeroModule } = await import('@/components/explore/HeroModule')
    const result = await HeroModule({ weekIndex: 0 })
    render(result as React.ReactElement)
    // One of the two lists must render — rotation is deterministic
    const rendered = screen.queryByText('List A') || screen.queryByText('List B')
    expect(rendered).toBeTruthy()
  })

  it('falls back to weekly rotation when pinned list is not eligible (D-09 fallback)', async () => {
    // Pinned list has no coverUrl → fails quality gate
    const ineligibleList = makeList({ id: 'pinned-list', title: 'Pinned Ineligible', coverUrl: null })
    const eligibleList = makeList({ id: 'eligible-list', title: 'Fallback List' })
    mockGetPublishedLists.mockResolvedValue([ineligibleList, eligibleList])
    mockGetListItemCount.mockResolvedValue(5)
    mockGetCmsSettings.mockResolvedValue(makeSettings({
      pinnedListId: 'pinned-list',
      pinExpiresAt: null,
    }))

    const { HeroModule } = await import('@/components/explore/HeroModule')
    const result = await HeroModule({ weekIndex: 0 })
    render(result as React.ReactElement)
    expect(screen.getByText('Fallback List')).toBeTruthy()
    expect(screen.queryByText('Pinned Ineligible')).toBeNull()
  })
})
