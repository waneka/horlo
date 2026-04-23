import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}))

import { HeaderNav } from '@/components/layout/HeaderNav'

const HEADER_NAV_SRC = readFileSync(
  path.resolve(process.cwd(), 'src/components/layout/HeaderNav.tsx'),
  'utf8',
)

describe('HeaderNav (Phase 14 D-14 — Insights + Preferences removed)', () => {
  // D-14 + RESEARCH Open Q#2: both Insights and Preferences removed
  it('Test 17 — baseNavItems contains NO entry with href "/insights" (D-14)', () => {
    // Source-level assertion: ensures the literal is gone, not just not-rendered
    expect(HEADER_NAV_SRC.includes("'/insights'")).toBe(false)
    // Runtime assertion: no rendered link points to /insights
    render(<HeaderNav username={null} />)
    expect(
      screen.queryByRole('link', { name: /insights/i }),
    ).toBeNull()
  })

  it('Test 18 — baseNavItems contains NO entry with href "/preferences" (Research Q#2)', () => {
    expect(HEADER_NAV_SRC.includes("'/preferences'")).toBe(false)
    render(<HeaderNav username={null} />)
    expect(
      screen.queryByRole('link', { name: /^preferences$/i }),
    ).toBeNull()
  })

  it('Test 19 — baseNavItems contains exactly ONE entry: { href: "/", label: "Collection" }', () => {
    // Source-level regex match — look for the sole remaining `baseNavItems` literal
    const match = HEADER_NAV_SRC.match(
      /baseNavItems:\s*NavItem\[\]\s*=\s*\[([\s\S]*?)\]/,
    )
    expect(match).toBeTruthy()
    const body = match![1]
    // Exactly one object literal inside the array
    const objectCount = (body.match(/\{\s*href:/g) ?? []).length
    expect(objectCount).toBe(1)
    expect(body).toContain("{ href: '/', label: 'Collection' }")
  })
})
