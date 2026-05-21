import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Phase 51 + Phase 52 — Profile route structural contract (joint pin).
 *
 * Source-grep-style structural assertions. These tests pin the
 * recurrence-4 and recurrence-5 prevention contracts:
 *
 *   Phase 51 contract (recurrence-3 → recurrence-4 guard):
 *   - Test 2 (REQ-51-05): ProfileGate accepts viewerId as a prop — fixed by 51-02
 *   - Test 3 (REQ-51-06): ProfileShellResolver remains cached with the profile tag — already met
 *
 *   Phase 52 contract (recurrence-5 guard — D-52-11, 2026-05-21):
 *   - Test 1 INVERTED (REQ-52-03a, REQ-52-03b): layout MUST be sync — MUST NOT directly
 *     await getCurrentUser; layout MUST contain Suspense wrapping ProfileChrome.
 *     This replaces the Phase 51 REQ-51-04 assertion that layout must NOT have Suspense.
 *     The Phase 51 assertion was based on a misdiagnosis (Phase 39c blocklist for the
 *     PPR-qualification root cause). Phase 52 D-52-11 corrects it: the canonical Next 16
 *     Cache Components pattern has a sync layout + a 'use cache' async component
 *     (ProfileChrome) wrapped in Suspense. Layout sync = no PPR qualification. The old
 *     assertion (no Suspense in layout) would have blocked the correct refactor.
 *     See .planning/audits/cache-components-2026-05-21-followup.md for the step-by-step.
 *   - Test 4 (REQ-52-01): page exports unstable_instant — locks CI gate for recurrence-5
 *   - Test 5 (REQ-52-04): page has inner async ProfileTabContent inside Suspense —
 *     canonical instant-navigation pattern from Next 16 docs
 *
 * Pattern mirrors `tests/no-evaluate-route.test.ts` — pure fs.readFileSync
 * source inspection, no DOM render, no component import.
 */

describe('Phase 51 — profile route PPR opt-out', () => {
  it('layout must be sync — no top-level await getCurrentUser; Suspense MUST wrap ProfileChrome (REQ-52-03a, REQ-52-03b — Phase 52 inversion of Phase 51 REQ-51-04)', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/u/[username]/layout.tsx'),
      'utf8',
    )

    // Phase 52 inversion (D-52-11, 2026-05-21):
    // The Phase 51 REQ-51-04 assertion (no Suspense in layout) was a misdiagnosis.
    // The canonical Next 16 Cache Components pattern per
    // node_modules/next/dist/docs/01-app/02-guides/cache-components.md requires:
    //   1. Layout is SYNC (no top-level cookie reads or DB calls).
    //   2. The runtime-API consumer (ProfileChrome, marked 'use cache') is
    //      wrapped in <Suspense> inside the layout.
    // A sync layout with Suspense does NOT qualify the route for Cache Components PPR.
    // Only an ASYNC layout (or Suspense around a cookies()-reading component) does.
    // See .planning/audits/cache-components-2026-05-21-followup.md for full audit.
    //
    // REQ-52-03a: layout MUST NOT directly await getCurrentUser
    expect(/await\s+getCurrentUser/s.test(source)).toBe(false)
    // REQ-52-03b: layout MUST have <Suspense> wrapping ProfileChrome
    expect(/<Suspense\b/.test(source)).toBe(true)
    // ProfileChrome must be referenced in layout (new component for Phase 52)
    expect(/ProfileChrome/.test(source)).toBe(true)

    // Layout owns the persistent chrome wrapper (`<main>`) — this is the
    // anchor that survives across sibling tab navs. Without this, every
    // tab click would re-render the whole page including chrome, which
    // is the "full reload feel" symptom that motivated the 2026-05-21
    // post-merge restoration of ProfileGate at the layout level.
    expect(source.includes('<main')).toBe(true)
  })

  it('ProfileGate accepts viewerId as a prop (REQ-51-05; Phase 39c Pitfall 1)', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/u/[username]/profile-gate.tsx'),
      'utf8',
    )

    // After plan 51-02 the gate signature destructures `viewerId` from props.
    expect(
      /export\s+async\s+function\s+ProfileGate\s*\(\s*\{[^}]*viewerId/s.test(source),
    ).toBe(true)

    // The cookie read (getCurrentUser invocation) MUST move out of the gate
    // and into the page — Phase 39c Pitfall 1 reinforcement.
    expect(source.includes('getCurrentUser()')).toBe(false)

    // No import of getCurrentUser from @/lib/auth — the gate is no longer the
    // cookie-reading boundary.
    const hasAuthImport = /from ['"]@\/lib\/auth['"]/.test(source)
    const importsGetCurrentUser = source.includes('getCurrentUser')
    expect(hasAuthImport && importsGetCurrentUser).toBe(false)
  })

  it('ProfileShellResolver remains cached with the profile cacheTag (REQ-51-06; Phase 39c invariant)', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/u/[username]/profile-shell-resolver.tsx'),
      'utf8',
    )

    // 'use cache' directive must remain (per D-39c-03).
    expect(source.includes("'use cache'")).toBe(true)

    // cacheTag call with the username template literal. Use two substring
    // checks instead of a regex containing backticks + ${} (which is
    // ambiguous in JS regex literals — see NOTE in 51-01-PLAN.md).
    expect(source.includes('cacheTag(')).toBe(true)
    expect(source.includes('profile:${username}')).toBe(true)

    // cacheLife revalidate window unchanged (300s).
    expect(source.includes('cacheLife({ revalidate: 300 })')).toBe(true)
  })

  it('page exports unstable_instant for build-time validator gate (REQ-52-01)', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/u/[username]/[tab]/page.tsx'),
      'utf8',
    )

    // REQ-52-01 / D-52-01 / D-52-03: The `unstable_instant` export is the
    // CI gate that prevents recurrence-5. It is NOT a runtime feature — it is
    // a validator signal to the Next 16 build/prefetch pipeline that this page
    // participates in instant navigation (profile chrome stays mounted across
    // tab clicks; only the per-tab content streams). Without this export the
    // page cannot be registered as an instant-navigation leaf in the router
    // tree. Adding it is the primary structural invariant asserted by D-52-01.
    // See node_modules/next/dist/docs/01-app/02-guides/instant-navigation.md
    // and .planning/audits/cache-components-2026-05-21-followup.md Step 6.
    //
    // Regex matches both `export const unstable_instant = ...` and
    // `export const unstable_instant: <type> = ...` — Phase 52 D-52-DEV-01
    // ships with an inline type annotation because the Next 16.2.3 segment
    // validator empirically requires the explicit `RuntimeSample[]` shape
    // (the `as const` form trips an "Invalid segment configuration" check
    // at build time; the annotated form is accepted). Both forms satisfy
    // the contract.
    expect(/export\s+const\s+unstable_instant\b/.test(source)).toBe(true)
  })

  it('page has inner async ProfileTabContent component inside Suspense (REQ-52-04)', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/u/[username]/[tab]/page.tsx'),
      'utf8',
    )

    // REQ-52-04: The canonical Next 16 instant-navigation pattern (per
    // node_modules/next/dist/docs/01-app/02-guides/instant-navigation.md
    // ProductPage canonical example) requires that the page export be a SYNC
    // component (so it can start rendering immediately on navigation) that wraps
    // an inner ASYNC component in <Suspense>. The inner async component
    // (ProfileTabContent) owns all runtime-API calls (getCurrentUser, DB reads).
    //
    // Three invariants:
    //   1. inner async function ProfileTabContent exists in the file
    //   2. a <Suspense> JSX open tag exists (the outer page-level streaming boundary)
    //   3. the outer component passes paramsPromise into ProfileTabContent as a prop
    //      (avoids awaiting params in the sync outer layer — keeps it non-blocking)
    expect(/async\s+function\s+ProfileTabContent/.test(source)).toBe(true)
    expect(/<Suspense\b/.test(source)).toBe(true)
    expect(/ProfileTabContent\s+paramsPromise=/.test(source)).toBe(true)
  })
})
