// src/components/explore/__tests__/CollectorArchetypes.test.tsx
//
// Tests for the CollectorArchetypes component (Phase 46 EXPL-02, EXPL-05).
//
// Coverage:
//   1. Component renders null when archetype-count data is empty (EXPL-02 null-hide)
//   2. Component renders 10 chips when given 10 archetype counts

import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

// Mock next/cache — cacheLife and cacheTag are no-ops under vitest
// (no 'use cache' runtime exists in jsdom).
vi.mock('next/cache', () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

// Mock next/link to a plain anchor so rendered output is testable.
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

// Mock @/data/browse so the component doesn't need a DB connection.
// When counts are injected via props, getBrowseArchetypeCounts is never called.
vi.mock('@/data/browse', () => ({
  getBrowseArchetypeCounts: vi.fn().mockResolvedValue([]),
}))

import { CollectorArchetypes } from '@/components/explore/CollectorArchetypes'

async function renderAsync(element: Promise<React.ReactElement | null>) {
  const resolved = await element
  return render(resolved ?? <></>)
}

// PRIMARY_ARCHETYPES order mirrors ARCHETYPE_CONFIG in @/lib/archetype-config.ts
const PRIMARY_ARCHETYPES = [
  'dress', 'dive', 'field', 'pilot', 'chrono',
  'gmt', 'racing', 'sport', 'tool', 'hybrid',
] as const

describe('CollectorArchetypes', () => {
  it('renders null when archetype-count data is empty (EXPL-02 null-hide)', async () => {
    const { container } = await renderAsync(CollectorArchetypes({ counts: [] }))
    // With an empty counts array the component returns null — no DOM output.
    expect(container.firstChild).toBeNull()
  })

  it('renders 10 archetype chips when given 10 archetype counts', async () => {
    const counts = PRIMARY_ARCHETYPES.map((a) => ({ archetype: a, count: 5 }))
    const { getAllByRole } = await renderAsync(CollectorArchetypes({ counts }))
    // Each chip is a <button type="button"> — expect exactly 10.
    expect(getAllByRole('button')).toHaveLength(10)
  })
})
