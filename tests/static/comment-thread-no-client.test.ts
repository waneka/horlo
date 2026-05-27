// @vitest-environment node
//
// This guard reads source files from the filesystem (readFileSync).
// It MUST run in the node environment — under jsdom (the default), vite
// externalizes node:fs and readFileSync becomes undefined. That difference is
// environment-dependent: passes locally under jsdom but FAILS the Vercel
// prebuild build.
// See MEMORY project_vitest_static_node_env.
//
// PAGE-03 guard: CommentThread must never have 'use client' or 'use cache'.
// The absence of 'use cache' is the privacy guarantee for comments
// (src/data/comments.ts PRIVACY LAYER NOTE). A developer refactor must not
// accidentally add either directive.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('PAGE-03: CommentThread.tsx privacy invariants', () => {
  const COMMENT_THREAD = join('src', 'components', 'comment', 'CommentThread.tsx')
  const content = readFileSync(COMMENT_THREAD, 'utf8')

  it('does not contain "use client"', () => {
    // Check only top of file (first 5 lines) to avoid matching string literals in comments.
    // Match the directive form only: a line whose non-whitespace content is exactly 'use client'
    // (i.e. the directive itself, not a comment mentioning the string).
    const top = content.split('\n').slice(0, 5)
    const hasDirective = top.some((line) => line.trim() === "'use client'")
    expect(hasDirective).toBe(false)
  })

  it('does not contain "use cache"', () => {
    const top = content.split('\n').slice(0, 5)
    const hasDirective = top.some((line) => line.trim() === "'use cache'")
    expect(hasDirective).toBe(false)
  })

  it('is an async function (RSC)', () => {
    expect(content).toMatch(/export async function CommentThread/)
  })
})
