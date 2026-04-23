import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isValidElement, type ReactElement } from 'react'

// Mock the DAL + auth layer so `await Header()` resolves deterministically.
let mockUser: { id: string; email: string } | null = null
vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(async () => mockUser),
  UnauthorizedError: class UnauthorizedError extends Error {},
}))
vi.mock('@/data/profiles', () => ({
  getProfileById: vi.fn(async () => ({ username: 'alice' })),
}))
vi.mock('@/data/watches', () => ({
  getWatchesByUser: vi.fn(async () => []),
}))

// Mock the nav components as simple pass-throughs so we can inspect the
// `bell` prop directly. Each returns its props object as the element; we
// compare props via .props on the React element at the Header output root.
vi.mock('@/components/layout/SlimTopNav', () => ({
  SlimTopNav: (props: Record<string, unknown>) => (
    <div data-testid="slim-top-nav" data-has-user={String(props.hasUser)}>
      {/* Render the bell element directly so tree traversal can find
          <NotificationBell /> occurrences inside this subtree. */}
      {(props.bell as React.ReactNode) ?? null}
    </div>
  ),
}))
vi.mock('@/components/layout/DesktopTopNav', () => ({
  DesktopTopNav: (props: Record<string, unknown>) => (
    <div
      data-testid="desktop-top-nav"
      data-user={props.user ? 'yes' : 'no'}
      data-username={String((props.username as string | null) ?? '')}
    >
      {(props.bell as React.ReactNode) ?? null}
    </div>
  ),
}))
// Mock NotificationBell so we can recognize it without invoking 'use cache'
vi.mock('@/components/notifications/NotificationBell', () => ({
  NotificationBell: ({ viewerId }: { viewerId: string }) => (
    <span data-testid="notification-bell" data-viewer-id={viewerId} />
  ),
}))

import { Header } from '@/components/layout/Header'

/**
 * Walk a React element tree looking for SlimTopNav / DesktopTopNav. Return
 * their props so we can assert on `bell` referential identity.
 *
 * Header returns a Fragment with two children: <SlimTopNav ... /> and
 * <DesktopTopNav ... />. We locate both at the top level.
 */
function findNavChildren(element: ReactElement): {
  slim: ReactElement | null
  desktop: ReactElement | null
} {
  let slim: ReactElement | null = null
  let desktop: ReactElement | null = null
  const visit = (node: unknown) => {
    if (!isValidElement(node)) return
    const el = node as ReactElement & {
      type: unknown
      props: Record<string, unknown>
    }
    const typeName =
      typeof el.type === 'function'
        ? (el.type as { displayName?: string; name?: string }).displayName ??
          (el.type as { name?: string }).name ??
          ''
        : ''
    if (typeName === 'SlimTopNav') slim = el
    if (typeName === 'DesktopTopNav') desktop = el
    const children = el.props?.children
    if (Array.isArray(children)) {
      children.forEach(visit)
    } else if (children) {
      visit(children)
    }
  }
  visit(element)
  return { slim, desktop }
}

describe('Header bell placement (Phase 14 D-23 / D-24 / RESEARCH P-06)', () => {
  beforeEach(() => {
    mockUser = null
  })

  it('Test 1 — when user is present, the `bell` prop handed to SlimTopNav and DesktopTopNav is the SAME React element (referential identity)', async () => {
    // NOTE to future maintainers: do NOT "simplify" this test to assert
    // exactly-one-NotificationBell occurrence. A single React element passed
    // as a prop to two separate parents renders twice in the DOM. The
    // correct invariant is:
    //   (a) the bell prop is the SAME element reference on both surfaces,
    //   (b) both rendered occurrences carry identical viewerId props.
    // Those two together guarantee exactly ONE cacheTag entry per render
    // pass (RESEARCH §P-06 / Pitfall 3).
    mockUser = { id: 'viewer-42', email: 'alice@example.com' }
    const tree = await Header()
    expect(isValidElement(tree)).toBe(true)

    const { slim, desktop } = findNavChildren(tree as ReactElement)
    expect(slim).not.toBeNull()
    expect(desktop).not.toBeNull()

    const slimBell = (
      slim as unknown as { props: { bell: React.ReactNode } }
    ).props.bell
    const desktopBell = (
      desktop as unknown as { props: { bell: React.ReactNode } }
    ).props.bell

    // (c) — referential identity of bell prop
    expect(slimBell).toBe(desktopBell)
    expect(isValidElement(slimBell)).toBe(true)
  })

  it('Test 1b — both surfaces receive matching viewerId in their NotificationBell child', async () => {
    mockUser = { id: 'viewer-42', email: 'alice@example.com' }
    const tree = await Header()
    // Traverse the element tree capturing every <NotificationBell> and its viewerId prop.
    const viewerIds: string[] = []
    const visit = (node: unknown) => {
      if (!isValidElement(node)) return
      const el = node as ReactElement & {
        type: unknown
        props: Record<string, unknown>
      }
      const typeName =
        typeof el.type === 'function'
          ? (el.type as { displayName?: string; name?: string }).displayName ??
            (el.type as { name?: string }).name ??
            ''
          : ''
      if (typeName === 'NotificationBell') {
        viewerIds.push(String(el.props.viewerId))
      }
      const children = el.props?.children
      if (Array.isArray(children)) children.forEach(visit)
      else if (children) visit(children)
    }
    visit(tree as ReactElement)

    // The shared bell prop is a single <Suspense><NotificationBell /></Suspense>.
    // Because the same element reference is passed to both mocked surfaces,
    // traversing the fragment + both surface subtrees should reveal the
    // NotificationBell element at least once; we just need at least one
    // and all occurrences must share the same viewerId.
    expect(viewerIds.length).toBeGreaterThanOrEqual(1)
    for (const vid of viewerIds) {
      expect(vid).toBe('viewer-42')
    }
  })

  it('Test 2 — when user is null, bell prop is null on both surfaces and no NotificationBell exists anywhere', async () => {
    mockUser = null
    const tree = await Header()
    const { slim, desktop } = findNavChildren(tree as ReactElement)
    expect(slim).not.toBeNull()
    expect(desktop).not.toBeNull()
    const slimBell = (
      slim as unknown as { props: { bell: React.ReactNode | null } }
    ).props.bell
    const desktopBell = (
      desktop as unknown as { props: { bell: React.ReactNode | null } }
    ).props.bell
    expect(slimBell).toBeNull()
    expect(desktopBell).toBeNull()

    // Walk tree: zero NotificationBell elements
    let count = 0
    const visit = (node: unknown) => {
      if (!isValidElement(node)) return
      const el = node as ReactElement & {
        type: unknown
        props: Record<string, unknown>
      }
      const typeName =
        typeof el.type === 'function'
          ? (el.type as { displayName?: string; name?: string }).displayName ??
            (el.type as { name?: string }).name ??
            ''
          : ''
      if (typeName === 'NotificationBell') count++
      const children = el.props?.children
      if (Array.isArray(children)) children.forEach(visit)
      else if (children) visit(children)
    }
    visit(tree as ReactElement)
    expect(count).toBe(0)
  })

  it('Test 3 — Header renders both SlimTopNav and DesktopTopNav (delegator shape)', async () => {
    mockUser = { id: 'viewer-42', email: 'alice@example.com' }
    const tree = await Header()
    const { slim, desktop } = findNavChildren(tree as ReactElement)
    expect(slim).not.toBeNull()
    expect(desktop).not.toBeNull()
  })
})
