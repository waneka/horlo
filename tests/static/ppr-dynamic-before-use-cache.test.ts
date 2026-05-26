// @vitest-environment node
//
// This guard reads source files from the filesystem (readFileSync).
// It MUST run in the node environment — under jsdom (the default), vite
// externalizes node:fs and readFileSync becomes undefined. That difference is
// environment-dependent: passes locally under jsdom but FAILS the Vercel
// prebuild build (cost a failed Phase 59 prod deploy).
// See MEMORY project_vitest_static_node_env.
//
// P61-BUG-01 static regression guard.
//
// Rule (durable_rule from .planning/debug/phase61-404-react-419-soft-nav.md):
//   In PPR routes containing both 'use cache' functions and dynamic API access
//   (cookies/headers via createSupabaseServerClient or signCoverUrls) in the
//   same async function body, the dynamic API calls MUST come BEFORE any
//   'use cache' calls. Violating this ordering causes React #419 on soft-nav
//   (hard browser refresh works because full SSR re-evaluates without the
//   cached RSC boundary conflict). Tag: P61-BUG-01.
//
// Affected files (fixed in commit 98e7289):
//   - src/app/u/[username]/[tab]/page.tsx
//   - src/app/w/[ref]/page.tsx
//
// This test encodes two per-file ordering assertions. A failure here means a
// dynamic API call was placed AFTER a 'use cache' call in one of these routes.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ---------------------------------------------------------------------------
// Helper: extract "active code" line numbers for a given pattern.
// "Active code" = not a pure comment line (//…), not an import line,
// not a blank line, not a JSDoc line ( *…). This prevents prose in comment
// blocks that mention the pattern from self-invalidating the guard.
// ---------------------------------------------------------------------------
function activeLineNumbers(lines: string[], pattern: RegExp): number[] {
  return lines.reduce<number[]>((acc, line, idx) => {
    const trimmed = line.trim()
    if (
      trimmed.startsWith('//') ||
      trimmed.startsWith('*') ||
      trimmed.startsWith('import ') ||
      trimmed === ''
    ) {
      return acc
    }
    if (pattern.test(trimmed)) {
      acc.push(idx + 1)  // 1-indexed line number for error messages
    }
    return acc
  }, [])
}

// ---------------------------------------------------------------------------
// Route files under test
// ---------------------------------------------------------------------------
const TAB_PAGE = join('src', 'app', 'u', '[username]', '[tab]', 'page.tsx')
const REF_PAGE = join('src', 'app', 'w', '[ref]', 'page.tsx')

// ---------------------------------------------------------------------------
// P61-BUG-01 assertion for src/app/u/[username]/[tab]/page.tsx
//
// In the collection/wishlist/notes branch of ProfileTabContent, the ordering
// MUST be:
//   (1) ProfileShellResolver (first 'use cache' call in the function body)
//   (2) getBatchedWatchCountsCached ('use cache')
//   (3) signCoverUrls (dynamic/cookies) — AFTER all 'use cache' calls
//
// OLD violation: signCoverUrls appeared at line ~191 — BETWEEN ProfileShellResolver
//   (~184) and getBatchedWatchCountsCached (~360).
// FIXED: signCoverUrls at ~368, AFTER getBatchedWatchCountsCached at ~363.
//
// Guard: the first active-code 'getBatchedWatchCountsCached(' line must be
//   LESS THAN the first active-code 'signCoverUrls(' line that appears AFTER
//   the getBatchedWatchCountsCached call. This catches any future regression
//   where signCoverUrls is hoisted back above the cached batch-counts call.
// ---------------------------------------------------------------------------
describe('P61-BUG-01: [tab]/page.tsx — dynamic API (signCoverUrls) after \'use cache\' calls', () => {
  const content = readFileSync(TAB_PAGE, 'utf8')
  const lines = content.split('\n')

  it('getBatchedWatchCountsCached( line < first following signCoverUrls( line', () => {
    // Find first active-code getBatchedWatchCountsCached call
    const batchedLines = activeLineNumbers(lines, /getBatchedWatchCountsCached\(/)
    expect(batchedLines.length, 'getBatchedWatchCountsCached( must appear in active code').toBeGreaterThan(0)

    const firstBatched = batchedLines[0]

    // Find first active-code signCoverUrls call that appears AFTER the batched call
    const signCoverLines = activeLineNumbers(lines, /signCoverUrls\(/)
    const followingSignCoverLine = signCoverLines.find((ln) => ln > firstBatched)

    expect(
      followingSignCoverLine,
      `signCoverUrls( must appear in active code after getBatchedWatchCountsCached( (line ${firstBatched}) — if signCoverUrls moves before the batch-counts call it re-introduces P61-BUG-01`,
    ).toBeDefined()

    // The invariant: firstBatched < followingSignCoverLine
    expect(
      firstBatched < followingSignCoverLine!,
      `P61-BUG-01 ordering violated in ${TAB_PAGE}: getBatchedWatchCountsCached( at line ${firstBatched} must come BEFORE signCoverUrls( at line ${followingSignCoverLine!}`,
    ).toBe(true)
  })

  it('ProfileShellResolver( appears before getBatchedWatchCountsCached( (first \'use cache\' call is the resolver)', () => {
    const resolverLines = activeLineNumbers(lines, /await ProfileShellResolver\(/)
    const batchedLines = activeLineNumbers(lines, /getBatchedWatchCountsCached\(/)

    expect(resolverLines.length, 'ProfileShellResolver must be awaited in active code').toBeGreaterThan(0)
    expect(batchedLines.length, 'getBatchedWatchCountsCached must appear in active code').toBeGreaterThan(0)

    const firstResolver = resolverLines[0]
    const firstBatched = batchedLines[0]

    expect(
      firstResolver < firstBatched,
      `P61-BUG-01 ordering violated: ProfileShellResolver( at line ${firstResolver} must come BEFORE getBatchedWatchCountsCached( at line ${firstBatched}`,
    ).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// P61-BUG-01 assertion for src/app/w/[ref]/page.tsx
//
// Both Branch 1 (perUserResult) and the D-06 owned branch (viewerOwnedRow)
// contain a createSupabaseServerClient() call (photo signing) that MUST come
// BEFORE getLikesForTargetCached (a 'use cache' helper).
//
// OLD violation (Branch 1): createSupabaseServerClient at ~148, AFTER
//   getLikesForTargetCached at ~81. Same pattern in D-06 branch.
// FIXED: createSupabaseServerClient at ~87 (Branch 1) and ~292 (D-06),
//   each appearing in the ~20 lines BEFORE their getLikesForTargetCached call.
//
// Guard: for each active-code getLikesForTargetCached( call, the most recent
//   active-code createSupabaseServerClient( call before it must be within
//   MAX_LOOKAHEAD lines. This catches the case where createSupabaseServerClient
//   is moved to AFTER getLikesForTargetCached.
//
// MAX_LOOKAHEAD = 50 lines is generous enough to accommodate comment blocks
//   and a few blank lines between the two calls within a branch, while being
//   tight enough to reject the old violation (where createSupabaseServerClient
//   was ~67 lines AFTER getLikesForTargetCached in Branch 1).
// ---------------------------------------------------------------------------
const MAX_LOOKAHEAD = 50

describe('P61-BUG-01: w/[ref]/page.tsx — createSupabaseServerClient before getLikesForTargetCached', () => {
  const content = readFileSync(REF_PAGE, 'utf8')
  const lines = content.split('\n')

  it('each getLikesForTargetCached( call is preceded by createSupabaseServerClient( within MAX_LOOKAHEAD lines', () => {
    const cachedCallLines = activeLineNumbers(lines, /getLikesForTargetCached\(/)
    const dynamicCallLines = activeLineNumbers(lines, /createSupabaseServerClient\(/)

    // There should be at least one getLikesForTargetCached active call
    expect(
      cachedCallLines.length,
      'getLikesForTargetCached( must appear at least once in active code',
    ).toBeGreaterThan(0)

    // For each getLikesForTargetCached call, verify that the most recent
    // createSupabaseServerClient call before it is within MAX_LOOKAHEAD lines.
    for (const cachedLine of cachedCallLines) {
      // Find the last createSupabaseServerClient call that comes before cachedLine
      const precedingDynamicLine = dynamicCallLines
        .filter((ln) => ln < cachedLine)
        .at(-1)  // most recent

      expect(
        precedingDynamicLine,
        `[${REF_PAGE}] getLikesForTargetCached( at line ${cachedLine}: no preceding createSupabaseServerClient( found — P61-BUG-01 violation (dynamic API must appear before the 'use cache' helper in each branch)`,
      ).toBeDefined()

      const distance = cachedLine - precedingDynamicLine!
      expect(
        distance,
        `[${REF_PAGE}] getLikesForTargetCached( at line ${cachedLine}: nearest preceding createSupabaseServerClient( is at line ${precedingDynamicLine!} (distance ${distance} lines). Expected ≤ ${MAX_LOOKAHEAD} lines — if they are now far apart, the dynamic call may have been moved after the 'use cache' helper (P61-BUG-01)`,
      ).toBeLessThanOrEqual(MAX_LOOKAHEAD)
    }
  })
})
