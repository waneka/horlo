import { describe, it, expect, vi } from 'vitest'

// next/font/google runs a Next.js build-time SWC plugin; in vitest the
// underlying loader throws. Stub each font constructor to return a CSS
// `variable` string matching what `<html className={…}>` expects.
vi.mock('next/font/google', () => {
  const make = (variable: string) => ({
    variable,
    className: variable,
    style: { fontFamily: variable },
  })
  return {
    IBM_Plex_Sans: (opts: any) => make(opts?.variable ?? '--font-sans'),
    Geist: (opts: any) => make(opts?.variable ?? '--font-geist-sans'),
    Geist_Mono: (opts: any) => make(opts?.variable ?? '--font-geist-mono'),
    Instrument_Serif: (opts: any) => make(opts?.variable ?? '--font-serif'),
  }
})

import RootLayout, { metadata, viewport } from '@/app/layout'
import React from 'react'

function findInTree(node: any, predicate: (n: any) => boolean): any | null {
  if (!node || typeof node !== 'object') return null
  if (predicate(node)) return node
  const children = node.props?.children
  if (Array.isArray(children)) {
    for (const c of children) {
      const hit = findInTree(c, predicate)
      if (hit) return hit
    }
  } else if (children) {
    return findInTree(children, predicate)
  }
  return null
}

describe('RootLayout (Phase 14 NAV-03 D-07, D-08)', () => {
  it('exports viewport with viewportFit cover', () => {
    expect(viewport?.viewportFit).toBe('cover')
  })

  it('keeps existing metadata.title', () => {
    expect(metadata?.title).toBe('Horlo - Watch Collection')
  })

  it('default export is RootLayout function', () => {
    expect(typeof RootLayout).toBe('function')
  })

  it('html className composes font-sans and font-serif variables', () => {
    const tree = RootLayout({
      children: React.createElement('div', { 'data-testid': 'child' }),
    }) as any
    // tree is <html …>; its className is on props
    expect(tree.props.className).toMatch(/--font-sans|font-sans/)
    expect(tree.props.className).toMatch(/--font-serif|font-serif/)
  })

  it('html className does NOT reference the retired Geist sans font (negative lock)', () => {
    // Guards against a partial rename where a reintroduced geistSans variable
    // would slip past grep-based acceptance criteria. IBM Plex Sans must fully
    // replace Geist in the resolved font-sans utility chain.
    const tree = RootLayout({
      children: React.createElement('div', { 'data-testid': 'child' }),
    }) as any
    expect(tree.props.className).not.toMatch(/geistSans|geist-sans/i)
  })

  it('inline theme script runs pre-paint (zero-FOUC, Pitfall P-05)', () => {
    const tree = RootLayout({ children: null }) as any
    const head = findInTree(tree, (n) => n?.type === 'head')
    expect(head).toBeTruthy()
    const script = findInTree(head, (n) => n?.type === 'script')
    expect(script?.props?.dangerouslySetInnerHTML?.__html ?? '').toContain(
      'horlo-theme',
    )
  })

  it('wraps Header and main in Suspense (Pitfall A-1)', () => {
    const tree = RootLayout({ children: null }) as any
    // Look for React.Suspense presence by type identity
    const suspenses: any[] = []
    function walk(n: any) {
      if (!n || typeof n !== 'object') return
      if (n.type === React.Suspense) suspenses.push(n)
      const c = n.props?.children
      if (Array.isArray(c)) c.forEach(walk)
      else if (c) walk(c)
    }
    walk(tree)
    // Plan 02 ships with Header + main = 2 Suspense boundaries.
    // Plan 03 will raise this to >= 3 once BottomNavServer is mounted; that
    // update is performed as part of Plan 03 Task 2 Step C.
    expect(suspenses.length).toBeGreaterThanOrEqual(2)
  })
})
