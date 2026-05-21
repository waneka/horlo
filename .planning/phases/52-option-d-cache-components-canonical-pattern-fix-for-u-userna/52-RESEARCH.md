# Phase 52: Option D — Cache Components Canonical Pattern Fix - Research

**Researched:** 2026-05-21
**Domain:** Next.js 16 Cache Components / Partial Prerendering / `unstable_instant` validator / Playwright e2e
**Confidence:** HIGH — all critical claims verified against local `node_modules/next/dist/docs/01-app/` (Next 16.2.3 pinned source) and the `@next/playwright@16.2.6` type declarations unpacked from the npm tarball.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Validator scope:**
- D-52-01: `unstable_instant = { prefetch: 'static' }` added to ONLY `src/app/u/[username]/[tab]/page.tsx` initially.
- D-52-02: If validator surfaces errors in other files, apply `unstable_instant = false` opt-out at those sites. Does not change behavior, documents intent.
- D-52-03: `unstable_instant` export is a hard CI gate — `npm run build` failure on validator errors is the recurrence-5 prevention contract.
- D-52-04: Cross-route validator findings recorded in new `.planning/seeds/SEED-014-cache-components-canonical-sweep.md`.

**Playwright e2e:**
- D-52-05: Install `@playwright/test` + `@next/playwright`. New files: `playwright.config.ts`, `tests/e2e/auth-setup.ts`, `tests/e2e/profile-tab-instant.test.ts`.
- D-52-06: Auth setup uses seeded user + `storageState`. `tests/e2e/auth-setup.ts` signs in once, saves `storageState.json`.
- D-52-07: Test target is local `npm run dev` only.
- D-52-08: First e2e test uses `@next/playwright` `instant()` helper.

**Cleanup bundling:**
- D-52-09: CR-01 (proxy.ts safety-comment correction) fixed inline in Phase 52 — comment-only.
- D-52-10: `scripts/assert-phase-51-build.mjs` deleted; superseded by `unstable_instant` validator.
- D-52-11: Diagnosis reversal recorded in two places: (a) page comment block at `[tab]/page.tsx:33-39`; (b) annotation in `51-CONTEXT.md` `<decisions>` flagging `unstable_instant` blocklist entry as reversed.
- D-52-12: Grep `.planning/` for `.continue-here.md` files referencing `unstable_instant`; revise if found.

**loading.tsx reconciliation:**
- D-52-13: Keep all three Suspense boundaries: layout `<Suspense>` around ProfileChrome (cold-load), page `<Suspense>` around ProfileTabContent (tab-nav), `loading.tsx` implicit Suspense (implicit-prefetch client nav).
- D-52-14: `loading.tsx` comment block rewritten to describe Phase 52 three-boundary structure.
- D-52-15: Skeletons remain intentionally distinct. `ProfileShellSkeleton` = full chrome. `ProfileTabContentSkeleton` = content area only.
- D-52-16: Always-Suspense, always-async-ProfileChrome. Structural lock.

**Carrying forward from Phase 51:**
- D-52-CF-01: Branch B contract (anon `/u/*` → 307 + `Cache-Control: no-store`) MUST remain live.
- D-52-CF-02: `viewerId` stays out of `ProfileShellResolver`'s cached scope. `ProfileChrome` is the new runtime-API consumer and passes `viewerId` to `ProfileGate` via props.
- D-52-CF-03: `notFound()` MUST fire BEFORE any post-suspending `await`.
- D-52-CF-04: Resolver invariants unchanged: `'use cache'` + `cacheTag('profile:${username}')` + `cacheLife({ revalidate: 300 })`. Migration to `'use cache: remote'` explicitly deferred.

### Claude's Discretion
- Final shape of the refactor is validator-driven. The `ProfileChrome` + `ProfileTabContent` structure in the audit followup is a working hypothesis.
- Wave structure for the plan: Wave 0 (test scaffolds — TDD); Wave 1 (Step 1 probe — add `unstable_instant` line only); Wave 2 (refactor based on validator output); Wave 3 (cleanups + tests); Wave 4 (deploy + UAT).
- Exact seed text and structure for SEED-014.

### Deferred Ideas (OUT OF SCOPE)
- `'use cache'` → `'use cache: remote'` migration for `ProfileShellResolver`
- Real 404 HTTP status for unknown username
- Vercel preview-deploy Playwright runs
- Broader Cache Components canonical-pattern sweep (captured as SEED-014, executed later)
- Skeleton pixel-fidelity audit
</user_constraints>

---

<phase_requirements>
## Phase Requirements

Derived from the audit followup's 8 concrete steps — mapped to REQ-52-XX identifiers for the planner.

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-52-01 | Add `export const unstable_instant = { prefetch: 'static' }` to `src/app/u/[username]/[tab]/page.tsx` as hard CI gate | `instant.md` confirms this is valid on a page.tsx; validator runs at dev + build time |
| REQ-52-02 | Run Step 1 probe (add only `unstable_instant`, observe dev overlay + build errors), use validator output as ground truth for refactor scope | Validator error format documented in `instant-navigation.md`: "each error identifies the component" |
| REQ-52-03 | Refactor `layout.tsx` to sync; create `profile-chrome.tsx` (async, awaits params + cookies, wraps ProfileGate) inside layout `<Suspense fallback={<ProfileShellSkeleton/>}>` | `layout.md` "Interaction with loading.js" + streaming.md "Push dynamic access down" both prescribe this exact shape |
| REQ-52-04 | Refactor `[tab]/page.tsx`: outer component sync, pass `params` promise to inner async `ProfileTabContent` inside `<Suspense fallback={<ProfileTabContentSkeleton/>}>` | `instant-navigation.md` "ProductPage" canonical example; `streaming.md` "Push dynamic access down" |
| REQ-52-05 | Apply `unstable_instant = false` opt-out to any other routes the validator surfaces; record in SEED-014 | `instant.md` "Disabling instant" section; `instant-navigation.md` "Opting out" section |
| REQ-52-06 | Update `tests/profile-route-51.test.ts` — Test 1 inverted (layout MUST NOT directly `await getCurrentUser`); Test 4 added (assert `unstable_instant` export present on page) | Phase 51 source-grep pattern is the established convention |
| REQ-52-07 | Install `@playwright/test` + `@next/playwright`; add `playwright.config.ts`; add `tests/e2e/auth-setup.ts` (storageState); add `tests/e2e/profile-tab-instant.test.ts` (`instant()` chrome-mounted invariant) | `@next/playwright` type declarations confirmed; `instant()` signature documented |
| REQ-52-08 | Deploy + UAT: Branch B contract curl + 15-min wait + operator tab navigation, verify cache revalidation does not trigger React #419 | Established protocol from Phase 51 |
| REQ-52-09 | Inline cleanups: CR-01 proxy.ts comment correction; delete `scripts/assert-phase-51-build.mjs`; rewrite `loading.tsx` comment block; annotate Phase 51 CONTEXT.md with reversal note; retire any `.continue-here.md` anti-pattern references | Scoped + confirmed in CONTEXT.md D-52-09 through D-52-12 |
| REQ-52-10 | Create `.planning/seeds/SEED-014-cache-components-canonical-sweep.md` with cross-route validator findings table | Scoped in D-52-04 |
</phase_requirements>

---

## Summary

Phase 52 implements the canonical Next 16 Cache Components pattern on `/u/[username]/[tab]` to permanently eliminate React #419 ("The server could not finish this Suspense boundary") recurrence-4. The root cause is structural: runtime API access (`params`, `cookies()` via `getCurrentUser`, uncached `ProfileShellResolver` call) happening at the top level of an async layout and async page component, outside any Suspense boundary. When the `cacheLife(300)` window expires and PPR re-evaluates the static/dynamic partition, the awaited shells end up inside the static partition with no Suspense boundary to catch them, producing a zero-byte RSC body that the Router interprets as empty.

The fix is three-pronged: (1) make `layout.tsx` synchronous and introduce a new `profile-chrome.tsx` async component inside `<Suspense>` for the runtime API access; (2) make `[tab]/page.tsx` synchronous and hoist the entire page body into an inner async `ProfileTabContent` inside `<Suspense>`; (3) add `export const unstable_instant = { prefetch: 'static' }` as a validator export that causes `npm run build` and `npm run dev` to fail with specific, actionable errors if the Suspense structure ever regresses. This last piece is the structural enforcement that was absent across all four recurrences.

The diagnosis inversion (D-52-11) is load-bearing: Phase 39c and Phase 51 placed `unstable_instant` on a "failed-attempt blocklist" believing it caused the recurrence-2 prod 404s. The audit followup's re-reading of the `instant-navigation.md` doc reveals `unstable_instant` is a **validator**, not a runtime feature. Phase 39c's "tree-only RSC payloads" symptom was the structural defect (runtime API access outside Suspense) manifesting at runtime; the validator was correctly flagging it before recurrence-2 hit. Removing it removed the protection, not the bug.

**Primary recommendation:** Execute the 8-step plan from the audit followup in TDD wave order (Wave 0: test scaffolds → Wave 1: Step 1 probe → Wave 2: refactor → Wave 3: cleanups → Wave 4: deploy). The plan is already fully specified; this research confirms the doc-level foundations are correct and provides the exact API signatures needed for implementation.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Auth session resolution (getCurrentUser) | Frontend Server (SSR) — async ProfileChrome | — | Cookie read; must be server-side, outside cache scope |
| Profile data aggregation (ProfileShellResolver) | Frontend Server (SSR) — `'use cache'`-backed | — | Viewer-independent; cached per username; invalidated by Server Actions |
| Viewer-scoped profile gate (ProfileGate) | Frontend Server (SSR) | — | Receives resolved viewerId as prop from ProfileChrome; calls cached resolver internally |
| Tab content (per-tab data fetches) | Frontend Server (SSR) — async ProfileTabContent inside Suspense | — | Runtime params + cookies access; must be inside Suspense boundary |
| Chrome persistence across tab navs | Frontend Server (SSR) — layout.tsx (sync, Suspense around ProfileChrome) | — | Layout preserves mounted state across sibling segment navigations |
| Build/dev structural validation | Build tooling — `unstable_instant` export on page.tsx | — | Validator catches Suspense structure violations at compile time |
| Instant nav shell assertion (e2e) | Playwright (`@next/playwright` `instant()`) | — | Runtime complement to build-time validator; pins chrome-mounted invariant |
| Anonymous redirect (Branch B) | Frontend Server (SSR) — proxy.ts | — | Cache-Control: no-store prevents Router Cache poisoning |

---

## Standard Stack

### Core (Phase 52 additions only — existing stack preserved)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@playwright/test` | `^1.60.0` | E2e test runner | Already `playwright: ^1.60.0` in devDependencies; `@playwright/test` is the separate CLI/API package [VERIFIED: package.json shows `playwright` 1.60.0; npm view `@playwright/test` shows latest 1.60.0] |
| `@next/playwright` | `16.2.6` | `instant()` helper for Cache Components nav testing | Official Next.js package; peer deps require `@playwright/test >= 1.0.0`; peerless version of Next matches project's 16.2.3 [VERIFIED: npm view @next/playwright] |

**Version verification:**
```bash
npm view @playwright/test version   # 1.60.0
npm view @next/playwright version   # 16.2.6
```

**Installation:**
```bash
npm install --save-dev @playwright/test @next/playwright
npx playwright install chromium  # or --with-deps for CI
```

> `playwright` (the browser library) is already in devDependencies at `^1.60.0`. `@playwright/test` is the test runner/CLI package that must be installed separately. Both are needed.

### New Files (not library installs)

| File | Role | Notes |
|------|------|-------|
| `src/app/u/[username]/profile-chrome.tsx` | NEW — async Server Component; runtime API consumer for the layout | Contains `await params` + `await getCurrentUser` + `ProfileGate` render |
| `playwright.config.ts` | NEW — Playwright config with webServer for `npm run dev` | Standard shape documented below |
| `tests/e2e/auth-setup.ts` | NEW — auth storageState setup | Supabase seeded-user login once; saves `storageState.json` |
| `tests/e2e/profile-tab-instant.test.ts` | NEW — `instant()` chrome-stays-mounted test | Uses `@next/playwright` |
| `.planning/seeds/SEED-014-cache-components-canonical-sweep.md` | NEW — cross-route validator findings | Created from validator output in Wave 1 |

---

## Architecture Patterns

### System Architecture Diagram

```
Browser                       Next.js Server (SSR)
  |                               |
  |-- GET /u/twwaneka/collection ->|
  |                               |
  |                    [layout.tsx SYNC]
  |                          |
  |                    <main className="...">
  |                          |
  |             <Suspense fallback={<ProfileShellSkeleton/>}>
  |                          |
  |                    [profile-chrome.tsx ASYNC]
  |                    await params           (runtime API — inside Suspense)
  |                    await getCurrentUser() (cookie read — inside Suspense)
  |                          |
  |                    <ProfileGate username viewerId>
  |                          |
  |                    [ProfileShellResolver 'use cache']
  |                    cacheTag('profile:username')
  |                    cacheLife(300s)
  |                          |
  |                    {children}  ←───── page.tsx SYNC
  |                          |              |
  |             </Suspense>          <Suspense fallback={<ProfileTabContentSkeleton/>}>
  |                                        |
  |                                  [ProfileTabContent ASYNC]
  |                                  await paramsPromise
  |                                  await getCurrentUser()
  |                                  await ProfileShellResolver()
  |                                  <tab-specific content>
  |                                        |
  |                                  </Suspense>
  |                               |
  |<-- HTML stream (static shell: Suspense fallbacks) + dynamic chunks as they resolve
  |
  |-- tab click (client nav RSC request) ->|
  |                               Only [tab] segment re-renders
  |                               layout stays mounted (chrome preserved)
  |<-- RSC payload: ProfileTabContent subtree only
```

### Recommended Project Structure (affected files only)

```
src/app/u/[username]/
├── layout.tsx                    # SYNC — passes params Promise to ProfileChrome
├── profile-chrome.tsx            # NEW — async, runtime API consumer for layout
├── profile-gate.tsx              # unchanged — accepts viewerId as prop
├── profile-shell-resolver.tsx    # unchanged — 'use cache' + cacheTag + cacheLife
├── profile-shell-skeleton.tsx    # unchanged — ProfileShellSkeleton + ProfileTabContentSkeleton
├── loading.tsx                   # comment rewritten (D-52-14)
└── [tab]/
    └── page.tsx                  # SYNC outer + async ProfileTabContent inner + unstable_instant export

tests/e2e/
├── auth-setup.ts                 # NEW — storageState
└── profile-tab-instant.test.ts   # NEW — instant() test

playwright.config.ts              # NEW
```

### Pattern 1: Sync Layout with Suspense-Wrapped Async Chrome

**What:** Layout is synchronous. Runtime API access (params, cookies) moved into a dedicated async child component wrapped in `<Suspense>`.

**When to use:** Any layout in a Cache Components PPR route that needs to read cookies or params.

**Verbatim doc prescription** (from `layout.md` "Interaction with loading.js"):

> "With Cache Components: `loading.js` is treated as a regular `<Suspense>` boundary rather than a special prefetch marker. Uncached or runtime data access in the layout must be explicitly wrapped in its own `<Suspense>` boundary, otherwise Next.js guides you with a build-time error. The static shell streams immediately, and the uncached content swaps in as it resolves."

```tsx
// src/app/u/[username]/layout.tsx
// Source: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/layout.md
//         "Interaction with loading.js" section
import { Suspense } from 'react'
import { ProfileChrome } from './profile-chrome'
import { ProfileShellSkeleton } from './profile-shell-skeleton'

export default function ProfileLayout({
  children,
  params,
}: LayoutProps<'/u/[username]'>) {
  // Layout MUST be sync. Pass params Promise to child inside Suspense.
  // D-52-16: always-sync-layout + always-async-ProfileChrome structural lock.
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 lg:px-8 lg:py-12">
      <Suspense fallback={<ProfileShellSkeleton />}>
        <ProfileChrome paramsPromise={params}>{children}</ProfileChrome>
      </Suspense>
    </main>
  )
}
```

### Pattern 2: Push Dynamic Access Down (Streaming Guide Canonical Example)

**What:** Async runtime API access deferred to the component that actually needs it, inside a Suspense boundary. The outer component stays synchronous.

**Verbatim doc quote** (from `streaming.md` "Push dynamic access down"):

> "The key to maximizing what streams instantly is to defer dynamic data access to the component that actually needs it. This applies to `params`, `searchParams`, `cookies()`, `headers()`, and data fetches. If you `await` any of these at the top of a layout or page, everything below that point becomes dynamic and cannot be prerendered as part of the static shell."

The streaming doc's DashboardLayout example (sync layout, `cookies()` called but not awaited, `<UserMenu cookiePromise={cookieStore}>` inside Suspense) is the prescriptive shape. [CITED: node_modules/next/dist/docs/01-app/02-guides/streaming.md lines 252-297]

**For our page.tsx** — the `instant-navigation.md` "ProductPage" canonical example is the exact match:

```tsx
// Source: node_modules/next/dist/docs/01-app/02-guides/instant-navigation.md
export const unstable_instant = { prefetch: 'static' }

export default function ProfileTabPage({
  params,
}: {
  params: Promise<{ username: string; tab: string }>
}) {
  // Outer component is SYNC. Pass params Promise to inner component.
  return (
    <Suspense fallback={<ProfileTabContentSkeleton />}>
      <ProfileTabContent paramsPromise={params} />
    </Suspense>
  )
}

async function ProfileTabContent({
  paramsPromise,
}: {
  paramsPromise: Promise<{ username: string; tab: string }>
}) {
  const { username, tab } = await paramsPromise
  // ... all existing page logic (getCurrentUser, ProfileShellResolver,
  // tab branching, notFound, etc.) moves here verbatim.
}
```

### Pattern 3: ProfileChrome — Async Runtime API Consumer

**What:** New file that encapsulates all runtime API access for the layout scope. Receives `paramsPromise` as a prop (Promise, not resolved value) and resolves it internally.

```tsx
// src/app/u/[username]/profile-chrome.tsx (NEW FILE)
// Source: audit followup Step 2 + caching.md "Passing runtime values to cached functions"
import 'server-only'
import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
import { ProfileGate } from './profile-gate'

interface Props {
  paramsPromise: Promise<{ username: string }>
  children: React.ReactNode
}

export async function ProfileChrome({ paramsPromise, children }: Props) {
  const { username } = await paramsPromise
  let viewerId: string | null = null
  try {
    viewerId = (await getCurrentUser()).id
  } catch (err) {
    if (!(err instanceof UnauthorizedError)) throw err
  }
  return (
    <ProfileGate username={username} viewerId={viewerId}>
      {children}
    </ProfileGate>
  )
}
```

**Critical:** `import 'server-only'` — enforced by the project's existing pattern for server components that read cookies. The vitest `server-only` shim in `vitest.config.ts` handles tests.

### Pattern 4: `unstable_instant` Export and Validator Behavior

**What:** A route-segment config export that opts a page into build-time and dev-time Suspense structure validation.

**Verbatim from `instant.md` "How validation works":**

> "`unstable_instant` triggers validation at every shared layout boundary in the route. Validation runs during development (on page loads and HMR updates) and at build time. Errors appear in the dev error overlay or fail the build. Each error identifies the component that would block navigation. The fix is usually to cache the data with `use cache` or wrap it in a `<Suspense>` boundary."

**Key facts confirmed from local docs:**

1. **Dev AND build time** — validation runs in BOTH modes. `npm run dev` shows overlay errors; `npm run build` exits non-zero. [VERIFIED: instant.md]
2. **`prefetch: 'static'`** — "Enables validation. Prefetching behavior stays the same (static by default). Components that read cookies or headers are treated as dynamic and must be behind Suspense." [VERIFIED: instant.md]
3. **`unstable_instant = false` opt-out** — "Set `false` to exempt a segment from validation" — exempts that segment from the requirement that entry into it is instant, but still allows inner segments to be validated. [VERIFIED: instant.md "Disabling instant" section]
4. **Only works with `cacheComponents: true`** — confirmed; project already has this. [VERIFIED: instant.md "Good to know" + next.config.ts]
5. **Cross-entry-point validation** — validator simulates navigations at EVERY shared layout boundary, not just the page's own. If `/u/[username]/[tab]/page.tsx` exports `unstable_instant`, the validator checks: page load from outside, client nav from `/u/[username]/collection` to `/u/[username]/wishlist` (shared layout boundary is `/u/[username]/layout.tsx`). [VERIFIED: instant-navigation.md "How validation checks every entry point"]

**TypeScript interface (from instant.md):**
```tsx
type InstantConfig =
  | false
  | {
      prefetch: 'static'
      from?: string[]
      unstable_disableValidation?: boolean
    }
  | {
      prefetch: 'runtime'
      samples: RuntimeSample[]
      from?: string[]
      unstable_disableValidation?: boolean
    }
```

### Pattern 5: `instant()` Playwright Helper

**What:** Holds back dynamic content while a callback runs against the static shell (the instant prefetch). After the callback resolves, dynamic content streams in normally.

**Exact signature** (from `@next/playwright@16.2.6` type declarations, unpacked from npm tarball):

```typescript
export declare function instant<T>(
  page: PlaywrightPage,
  fn: () => Promise<T>,
  options?: {
    baseURL?: string
  }
): Promise<T>
```

**How it works** (from README.md, unpacked from tarball):
- Sets a cookie (`next-instant-navigation-testing=1; path=/`) to enter instant mode
- While active: client-side navigations render only cached/prefetched content; dynamic data deferred
- On callback complete: cookie cleared, normal streaming resumes
- Uses structural typing for `PlaywrightPage` — works with any `@playwright/test` version ≥ 1.0.0

**Usage in our context:**
```typescript
import { test, expect } from '@playwright/test'
import { instant } from '@next/playwright'

test('profile chrome stays mounted on tab navigation', async ({ page }) => {
  await page.goto('/u/twwaneka/collection')

  await instant(page, async () => {
    await page.click('a[href="/u/twwaneka/wishlist"]')
    // Chrome (heading, tablist) is in the instant shell — must be visible
    await expect(page.getByRole('heading', { name: /@twwaneka/ })).toBeVisible()
    await expect(page.getByRole('tablist')).toBeVisible()
  })

  // After instant() exits, tab content streams in
  await expect(page.locator('[data-testid="wishlist-content"]')).toBeVisible()
})
```

**Important note from README:** `instant()` assumes a warm cache — all prefetches completed and all cacheable data available. It tests whether the route is *structured correctly* for instant navigation, independent of network timing. Content missing inside the callback points to a missing `use cache` directive or misplaced Suspense boundary.

### Pattern 6: Playwright Config with webServer

**Standard shape for Next.js + Playwright (local dev target, D-52-07):**

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,  // Sequential — single dev server
  retries: 0,
  use: {
    baseURL: 'http://localhost:3000',
    storageState: 'tests/e2e/storageState.json',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth-setup\.ts/,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
```

**`package.json` `scripts` addition:**
```json
"test:e2e": "playwright test"
```

### Anti-Patterns to Avoid

- **Async layout with top-level `await params`** — this is the recurrence bug. Layout MUST be sync. `params` is `Promise<{...}>` passed down to an async child inside Suspense. [CITED: layout.md, streaming.md]
- **Async layout with top-level `await getCurrentUser()`** — same issue. Cookie reads in a layout that participates in PPR must be inside Suspense. [CITED: layout.md "Interaction with loading.js"]
- **Removing `unstable_instant` when it produces validation errors** — this removes the protection without fixing the bug. The validator errors are the fix directions. [CITED: instant-navigation.md diagnosis inversion; CONTEXT.md D-52-11]
- **`unstable_instant = false` on the target page** — D-52-02 applies this ONLY to OTHER routes that the validator surfaces cross-route errors for; the target `/u/[username]/[tab]/page.tsx` MUST have `unstable_instant = { prefetch: 'static' }`.
- **Passing a resolved value vs. Promise as `paramsPromise` prop** — the layout MUST pass the raw `params` Promise to `ProfileChrome`, not `await params`. Awaiting it at the layout level re-introduces the bug. [CITED: streaming.md "Push dynamic access down"]
- **`notFound()` after a suspending `await`** — D-52-CF-03 requires `notFound()` BEFORE any post-suspending `await`. Inside `ProfileTabContent`: validate tab, await ProfileShellResolver, check `resolved.profile`, then `notFound()` if null. [CITED: loading.md "Status Codes" + audit followup risk 4]
- **`viewerId` inside `ProfileShellResolver`'s `'use cache'` scope** — D-52-CF-02 / Phase 39c Pitfall 1. `ProfileChrome` reads `getCurrentUser` and passes `viewerId` as a prop to `ProfileGate`. The resolver is viewer-independent. [CITED: profile-shell-resolver.tsx comment block]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Build-time Suspense structure validation | Custom ESLint rule or manifest-inspection script | `unstable_instant = { prefetch: 'static' }` export | Next 16 validator checks every entry point including cross-sibling navigations; a custom script cannot replicate this without re-implementing the compiler's static/dynamic partition analysis |
| Instant-nav cookie protocol | Custom cookie-toggle test helper | `@next/playwright` `instant()` | Package encapsulates the exact `next-instant-navigation-testing` cookie protocol Next uses; structural typing means zero version coupling |
| PPR manifest shape parsing | Updated `assert-phase-51-build.mjs` | `unstable_instant` validator + build exit code | Manifest shape changed between Next versions (recurrence-3 lesson); the validator is framework-maintained; delete the script per D-52-10 |

**Key insight:** The entire class of "did the Suspense structure regress?" questions is answered by a one-line export and `npm run build`. Custom scripts attempting to replicate this have historically been wrong (see audit finding 4: `assert-phase-51-build.mjs` false-negative since Phase 51 shipped).

---

## Common Pitfalls

### Pitfall 1: Validator Surfaces Cross-Route Errors
**What goes wrong:** Adding `unstable_instant` to `[tab]/page.tsx` triggers validation for ALL shared layout boundaries, including routes that import from or share a layout with the profile route. The validator may surface errors on `/u/[username]/followers`, `/u/[username]/following`, or even other authenticated routes.
**Why it happens:** The validator "simulates navigations at every shared layout boundary in the route." The `/u/[username]/layout.tsx` is shared by all child segments.
**How to avoid:** Per D-52-02, apply `unstable_instant = false` to those routes. This documents intent ("this route legitimately can't be instant"), makes no behavior change, and keeps Phase 52 narrow. Record in SEED-014.
**Warning signs:** Build output shows "blocking route" errors in routes other than `[tab]`. Dev overlay shows errors on `/u/[username]/followers`.

### Pitfall 2: Test 1 in `profile-route-51.test.ts` Fails After Refactor
**What goes wrong:** The existing Test 1 asserts `expect(/<Suspense\b/.test(source)).toBe(false)` — layout must have NO Suspense. Phase 52 adds Suspense back to the layout (correctly, per docs). Test 1 will fail.
**Why it happens:** Phase 51 wrote the assertion as "no Suspense in layout = correct" because the recurrence-3 anti-pattern was Suspense wrapping an awaited shell. Phase 52 inverts the correct invariant: Suspense IS present (around ProfileChrome), but the layout itself is sync (no direct `await getCurrentUser`).
**How to avoid:** Per D-52-06 / REQ-52-06, invert Test 1 to assert the correct invariant: layout MUST NOT directly `await getCurrentUser` (that's ProfileChrome's job). The test comment must explain the inversion. The new assertion is: `expect(/await\s+getCurrentUser/s.test(source)).toBe(false)`.
**Warning signs:** `npx vitest run tests/profile-route-51.test.ts` fails immediately after layout refactor with "expected true to be false."

### Pitfall 3: `params` Awaited in Layout Before Passing to ProfileChrome
**What goes wrong:** Destructuring `const { username } = await params` in the layout, then passing the resolved string to ProfileChrome, puts the await back at the layout level.
**Why it happens:** Looks natural; TypeScript doesn't flag it.
**How to avoid:** Layout passes the raw `params` prop (a Promise) directly to ProfileChrome as `paramsPromise`. ProfileChrome's signature takes `paramsPromise: Promise<{ username: string }>`.
**Warning signs:** Validator still shows "awaited params at layout level" error after refactor.

### Pitfall 4: `loading.tsx` Now Has Semantic Ambiguity
**What goes wrong:** `loading.tsx` currently describes a "layout's own `<Suspense>`" that no longer exists in the pre-Phase-52 state. After Phase 52, the comment describes a different three-boundary structure than what was there before.
**Why it happens:** The comment in `loading.tsx` was written for a prior phase's Suspense topology.
**How to avoid:** Per D-52-14, rewrite the `loading.tsx` comment block to describe Phase 52's three-boundary structure as the single source of truth. Future debuggers should read this comment and understand all three boundaries.
**Warning signs:** Comment references "the layout's Suspense" in a way that contradicts the actual phase's topology.

### Pitfall 5: `.next/` Cache Serving Stale Validator Output
**What goes wrong:** `npm run dev` shows no errors after the refactor, but that's because `.next/` still has a cached build from before the refactor.
**Why it happens:** Turbopack `.next/` cache survives dev-server restarts; does not auto-invalidate on file changes in some edge cases.
**How to avoid:** Per the project memory (`project_turbopack_next_cache_stale_css.md`): `rm -rf .next` before running the validator after significant structural changes.
**Warning signs:** Dev overlay shows no errors immediately after adding `unstable_instant` (suspicious — the pre-fix code SHOULD produce errors).

### Pitfall 6: storageState Auth — Supabase Admin API vs. Seeded Credentials
**What goes wrong:** `tests/e2e/auth-setup.ts` needs to sign in as a seeded user. The Supabase client-facing signIn requires a real password. Using the Supabase admin API requires `SUPABASE_SERVICE_ROLE_KEY` which is in `.env.local` (not committed).
**Why it happens:** E2e auth setup for Supabase is less ergonomic than for simple username/password flows.
**How to avoid:** Planner decides: (a) use `supabase.auth.signInWithPassword` with seeded credentials (simplest; requires a seeded test user with known password); (b) use admin API with `SERVICE_ROLE_KEY` loaded from `.env.local` in the auth-setup script. Option (a) is recommended — the test user is for local dev only.
**Warning signs:** `auth-setup.ts` throws on missing env vars in CI.

### Pitfall 7: `instant()` Test Requires Warm Cache
**What goes wrong:** The `instant()` test fails because profile data hasn't been prefetched. `instant()` assumes a warm cache.
**Why it happens:** First visit to `/u/twwaneka/collection` hasn't triggered the profileShellResolver's `'use cache'` fill.
**How to avoid:** Navigate to the page once before entering `instant()` scope. The `page.goto('/u/twwaneka/collection')` before the `instant()` call in the test template serves this purpose — it loads the page, which fills the cache. The `instant()` callback then clicks a tab link.
**Warning signs:** `instant()` callback assertions fail because chrome heading/tablist are not visible.

---

## Code Examples

### `unstable_instant` Export

```typescript
// Source: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/instant.md
export const unstable_instant = {
  prefetch: 'static',
}
```

### Opt-Out Pattern (for cross-route findings)

```tsx
// Source: node_modules/next/dist/docs/01-app/02-guides/instant-navigation.md "Opting out"
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/instant.md "Disabling instant"
export const unstable_instant = false
```

### Sync Layout with Promise Pass-Through

```tsx
// Source: node_modules/next/dist/docs/01-app/02-guides/streaming.md "Push dynamic access down"
// The doc's example does cookies(); for params the principle is identical.
import { Suspense } from 'react'
import { ProfileChrome } from './profile-chrome'
import { ProfileShellSkeleton } from './profile-shell-skeleton'

export default function ProfileLayout({
  children,
  params,
}: LayoutProps<'/u/[username]'>) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 lg:px-8 lg:py-12">
      <Suspense fallback={<ProfileShellSkeleton />}>
        <ProfileChrome paramsPromise={params}>{children}</ProfileChrome>
      </Suspense>
    </main>
  )
}
```

### Inverted Test 1 Assertion

```typescript
// Source: tests/profile-route-51.test.ts (inverted per D-52-06 / REQ-52-06)
// The NEW correct invariant: layout must NOT directly await getCurrentUser.
// (ProfileChrome now does that, inside its own Suspense.)
// The OLD assertion (no Suspense in layout) is WRONG post-Phase-52.
expect(/await\s+getCurrentUser/s.test(source)).toBe(false)
// Layout MAY and SHOULD have Suspense wrapping ProfileChrome.
expect(/<Suspense\b/.test(source)).toBe(true)  // Test 1 additional positive assertion
```

### Test 4 — `unstable_instant` Export Present

```typescript
// Source: audit followup Step 6 + REQ-52-06
it('page exports unstable_instant for build-time validation (REQ-52-01)', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/app/u/[username]/[tab]/page.tsx'),
    'utf8',
  )
  expect(/export\s+const\s+unstable_instant\s*=/.test(source)).toBe(true)
})
```

### `instant()` E2e Test

```typescript
// Source: @next/playwright README (unpacked from npm tarball)
// + node_modules/next/dist/docs/01-app/02-guides/instant-navigation.md
// "Prevent regressions with e2e tests"
import { test, expect } from '@playwright/test'
import { instant } from '@next/playwright'

test('profile chrome stays mounted on tab navigation (recurrence-5 guard)', async ({ page }) => {
  await page.goto('/u/twwaneka/collection')  // warm cache

  await instant(page, async () => {
    await page.click('a[href="/u/twwaneka/wishlist"]')
    await expect(page.getByRole('heading', { name: /@twwaneka/ })).toBeVisible()
    await expect(page.getByRole('tablist')).toBeVisible()
  })

  // After instant() exits, tab content streams in
  await expect(page.locator('text=Wishlist')).toBeVisible({ timeout: 10_000 })
})
```

---

## `'use cache'` Behavior on Serverless (Confirmed)

From `use-cache-remote.md` [VERIFIED: local docs]:

> "While the `use cache` directive is sufficient for most application needs, you might notice that cached operations are re-running more often than expected... This can happen because `use cache` stores entries in-memory, which has inherent limitations: Cache entries being evicted to make room for new ones; Memory constraints in your deployment environment; Cache not persisting across requests or server restarts."

From `self-hosting.md` [VERIFIED: local docs]:

> "By default, Next.js uses an in-memory cache that is not shared across instances. For consistent caching behavior, use `'use cache: remote'` with a custom cache handler that stores data in external storage."

**Implication for Phase 52:** `ProfileShellResolver`'s `'use cache'` may not actually cache across requests on Vercel (new function instance per request = fresh memory = empty cache = resolver re-runs on every request). The `cacheLife(300)` only controls the stale-while-revalidate window for the client-side prefetch shell — it describes what Next is allowed to prefetch and for how long — but the server-side runtime may not actually serve cached results.

**This does NOT affect the recurrence fix** — the bug is structural (Suspense boundaries), not a cache-miss problem. **It does mean** the "sub-millisecond second hit" claim in the page comment block is aspirational for Vercel serverless; it's accurate for self-hosted Node.js deployments. The D-52-CF-04 deferral of `'use cache: remote'` migration is correct. [ASSUMED: the perf implication; confirmed: the in-memory-only-on-serverless fact]

---

## `revalidatePath` + Phase 52 Suspense Topology

The Server Actions chain calls `revalidatePath('/u/[username]', 'layout')`. After Phase 52, the layout is sync with Suspense around ProfileChrome. Does this invalidation still work?

**Analysis (ASSUMED — not a doc-cited finding):** `revalidatePath('/u/[username]', 'layout')` invalidates the cache for all routes under `/u/[username]` at the layout level. This is path-based invalidation, not Suspense-topology-aware. It works regardless of whether the layout is sync or async. The layout's static shell (sync, no await) has nothing to cache; the dynamic content (ProfileChrome + ProfileTabContent inside Suspense) is NOT cached (no `'use cache'`). `ProfileShellResolver` uses `cacheTag('profile:${username}')` — Server Actions call `updateTag('profile:...')` not `revalidatePath`.

The `revalidatePath` calls in the Server Actions are belt-and-suspenders for the PPR prerender cache, not the `'use cache'` tag store. Phase 52's structural change does not alter this contract because:

1. `ProfileShellResolver` (the `'use cache'` component) is unchanged — still invalidated by `cacheTag` calls
2. The layout/page prerender cache is invalidated by `revalidatePath` — sync layout vs async layout makes no difference to path-based cache invalidation
3. `ProfileChrome` and `ProfileTabContent` are NOT `'use cache'` components — they run fresh on every request

**Verdict:** `revalidatePath` works correctly post-Phase-52. No changes needed to Server Actions. [ASSUMED: the mechanism; LOW confidence; but failure mode is harmless over-invalidation, not under-invalidation]

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `params` was synchronous | `params` is `Promise<{...}>` | Next.js 15 / Next 16 | Must use `async/await` or React `use()`; layouts and pages receive a Promise, not a plain object |
| `unstable_instant` as runtime prefetch hint | `unstable_instant` as structural validator | Next 16.x | Does not change runtime behavior; only adds validation; removing it removes protection not the bug |
| `revalidateTag()` for cache invalidation | `updateTag()` preferred in Server Actions | Next 16.x | `updateTag` provides read-your-own-writes (immediate expiry); `revalidateTag` is stale-while-revalidate |
| `loading.js` as "special prefetch marker" | `loading.js` as regular Suspense boundary (with Cache Components) | Cache Components mode | Layout runtime data access must be explicitly in its own Suspense; `loading.js` does NOT cover layout data access |
| `'use cache'` as persistent cross-request cache | `'use cache'` as in-memory per-process cache | Always true, newly documented | On serverless, `'use cache'` may not cache across requests; `'use cache: remote'` for persistent cross-instance caching |

**Deprecated/outdated:**
- `scripts/assert-phase-51-build.mjs`: silently broken — Next 16.2 manifest uses `experimentalPPR: true` + `renderingMode: "PARTIALLY_STATIC"` not `prerender: true` or `fallback: 'static'`. Delete per D-52-10.
- The `unstable_instant`-on-blocklist entry in `51-CONTEXT.md`: reversed by D-52-11. The blocklist was based on a misdiagnosis — the validator correctly flagged the structural defect; removing it removed protection not the cause.
- Phase 39c RETROSPECTIVE entry claiming "`unstable_instant` with `prefetch: 'static'` is unsafe on dynamic routes": this is the misdiagnosis. The RETROSPECTIVE records the wrong lesson. Phase 52's D-52-11 annotation in `51-CONTEXT.md` is the correction record.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `'use cache'` in-memory behavior means ProfileShellResolver may not actually cache across requests on Vercel (each cold invocation re-runs the resolver) | `'use cache'` Behavior section + Common Pitfalls | Low risk to Phase 52 correctness (the bug fix is structural); high risk to the "sub-millisecond second hit" performance claim in comments — would need to update comment language |
| A2 | `revalidatePath('/u/[username]', 'layout')` works correctly post-Phase-52 without any changes to Server Actions | `revalidatePath` + Phase 52 section | Low risk — failure mode is harmless over-invalidation, not under-invalidation; even if wrong, the `cacheTag`/`updateTag` path for ProfileShellResolver is the primary invalidation mechanism |
| A3 | The validator will flag ALL top-level awaits (params, getCurrentUser, ProfileShellResolver) in the pre-fix code — expected validator output from audit followup | Phase Requirements REQ-52-02 note | Low risk — Wave 1 Step 1 probe runs BEFORE any refactor; actual validator output is ground truth |
| A4 | Seeded test user with known password exists or can be created for Playwright auth setup | Standard Stack / Playwright Config | Medium risk — if no seeded test user with known password exists, auth-setup.ts needs a different approach (admin API + SERVICE_ROLE_KEY); planner should confirm seeded user availability |
| A5 | `ProfileTabContentSkeleton` has a `data-testid` attribute or a visible text label that the Playwright `instant()` test can assert against after dynamic content streams in | Playwright test example | Low risk — if `data-testid` doesn't exist, use a visible text selector or heading; the structural invariant (chrome stays mounted) is the critical assertion inside `instant()`, not the post-stream assertion |

---

## Open Questions

1. **Does the validator produce errors for cross-route layouts above `/u/[username]/layout.tsx`?**
   - What we know: validator checks "every shared layout boundary." The root layout (`app/layout.tsx`) is shared by all routes. If the root layout is sync (likely), it won't trigger violations. But `src/app/u/[username]/followers/` and `/following/` segments share the profile layout.
   - What's unclear: whether followers/following pages will produce validator errors when `[tab]/page.tsx` exports `unstable_instant`.
   - Recommendation: Step 1 probe answers this definitively. If followers/following produce errors, apply `unstable_instant = false` there per D-52-02.

2. **Does the `tests/profile-route-51.test.ts` file stay named `51` or get a sibling `52` file?**
   - What we know: CONTEXT.md says "File renamed? Plan TBD — could remain Phase 51 named since it pins the joint Phase 51+52 contract, or could be supplemented by a `tests/profile-route-52.test.ts`."
   - What's unclear: Whether having two test files covering overlapping structural invariants causes confusion.
   - Recommendation: Keep the Phase 51 file, update it in-place (invert Test 1, add Test 4). The file pins the joint contract. A separate Phase 52 file adds no clarity and splits the structural invariant contract.

3. **What's the exact `data-testid` attribute on wishlist content for the Playwright test?**
   - What we know: The audit followup uses `page.getByTestId('wishlist-content')` as a placeholder.
   - What's unclear: Whether `WishlistTabContent` renders a `data-testid="wishlist-content"` attribute.
   - Recommendation: Planner inspects `WishlistTabContent` component during Wave 0. If `data-testid` doesn't exist, the test can use a stable text assertion (e.g., tab heading) instead.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js dev server | ✓ (inferred from working project) | Not pinned | — |
| npm | Package install | ✓ | lockfileVersion 3 | — |
| Next.js dev server (`npm run dev`) | Playwright webServer | ✓ | 16.2.3 | — |
| `@playwright/test` | E2e tests | ✗ (not installed) | — | Must install per D-52-05 |
| `@next/playwright` | `instant()` helper | ✗ (not installed) | — | Must install per D-52-05 |
| `playwright` (browser lib) | Already in devDependencies | ✓ | `^1.60.0` | Existing install |
| Chromium browser | Playwright tests | Likely not installed for testing | — | `npx playwright install chromium` |
| Local Supabase (for e2e auth) | `auth-setup.ts` | [ASSUMED: ✓] | — | Remote Supabase with test credentials |

**Missing dependencies with no fallback:**
- `@playwright/test` — must be installed; no viable alternative for `instant()` helper
- `@next/playwright` — must be installed; no viable alternative for the `instant()` API

**Missing dependencies with fallback:**
- Chromium browser: `npx playwright install chromium` in setup wave. On CI, use `npx playwright install --with-deps chromium`.

---

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json` — this section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Existing framework | vitest `^2.1.9` + `@testing-library/react` `^16.3.2` |
| Existing config | `vitest.config.ts` (`jsdom` environment, `server-only` shim) |
| New framework | `@playwright/test` + `@next/playwright` (new in Phase 52) |
| New config | `playwright.config.ts` (new file, Wave 0) |
| Vitest quick run | `npx vitest run tests/profile-route-51.test.ts tests/proxy.test.ts` |
| Vitest full suite | `npm run test` |
| E2e quick run | `npx playwright test tests/e2e/profile-tab-instant.test.ts` |
| E2e full suite | `npm run test:e2e` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-52-01 | page.tsx exports `unstable_instant = { prefetch: 'static' }` | unit (source-grep) | `npx vitest run tests/profile-route-51.test.ts` | ✅ (Test 4 added to existing file) |
| REQ-52-02 | Validator produces no errors on `/u/[username]/[tab]` | build-time | `npm run build` exits 0 | ✅ (build CI gate) |
| REQ-52-03 | layout.tsx does NOT directly `await getCurrentUser` | unit (source-grep) | `npx vitest run tests/profile-route-51.test.ts` | ✅ (Test 1 inverted) |
| REQ-52-03 | layout.tsx HAS `<Suspense>` around ProfileChrome | unit (source-grep) | `npx vitest run tests/profile-route-51.test.ts` | ✅ (Test 1 positive assertion added) |
| REQ-52-04 | ProfileTabContent async component exists inside page's Suspense | unit (source-grep) | `npx vitest run tests/profile-route-51.test.ts` | ❌ Wave 0 gap |
| REQ-52-05 | Cross-route `unstable_instant = false` opt-outs applied where needed | build-time | `npm run build` exits 0 | ✅ (build gate) |
| REQ-52-06 | Profile chrome (heading + tablist) stays mounted across tab navigation | e2e (`instant()`) | `npx playwright test tests/e2e/profile-tab-instant.test.ts` | ❌ Wave 0 gap |
| REQ-52-07 | Playwright auth setup produces valid `storageState.json` | e2e (setup) | `npx playwright test tests/e2e/auth-setup.ts` | ❌ Wave 0 gap |
| REQ-52-08 | Post-deploy: anon → 307 + `Cache-Control: no-store`; 15-min revalidation does not trigger React #419 | manual (operator UAT + curl) | See deploy verification curl + UAT script | ✅ (existing curl in Phase 51) |
| REQ-52-09 | CR-01 comment corrected in proxy.ts | unit (source-grep) | `npx vitest run tests/proxy.test.ts` | ✅ (existing proxy test) |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/profile-route-51.test.ts tests/proxy.test.ts`
- **Per wave merge:** `npm run test` (full vitest suite)
- **Post Wave 2 (refactor complete):** `npm run build` (build-time validator gate)
- **Post Wave 3 (e2e ready):** `npm run test:e2e` (Playwright)
- **Phase gate:** Full vitest + build + e2e all green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/profile-route-51.test.ts` — Test 1 inversion (REQ-52-03) + Test 4 addition (REQ-52-01) + new positive Suspense assertion (REQ-52-03)
- [ ] `tests/e2e/auth-setup.ts` — covers REQ-52-07 (storageState)
- [ ] `tests/e2e/profile-tab-instant.test.ts` — covers REQ-52-06 (chrome-mounted invariant)
- [ ] `playwright.config.ts` — config infrastructure for e2e
- [ ] `package.json` — add `test:e2e` script + `@playwright/test` + `@next/playwright` devDeps
- [ ] Source-grep assertion for `ProfileTabContent` async component inside page's Suspense (REQ-52-04) — add as Test 5 in `tests/profile-route-51.test.ts`

---

## Security Domain

**`security_enforcement`:** Not explicitly set to `false` in config.json — treat as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase auth; `getCurrentUser()` via React `cache()` |
| V3 Session Management | yes | `proxy.ts` Branch B — `Cache-Control: no-store` on 307 redirects; prevents Router Cache poisoning |
| V4 Access Control | yes | `ProfileGate` visibility gates; `viewerId` isolation from cached scope |
| V5 Input Validation | yes (tab param) | `VALID_TABS` allowlist in `ProfileTabContent` + `notFound()` on invalid tab |
| V6 Cryptography | no | — |

### Known Threat Patterns for this Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Router Cache poisoning via cached 307 redirect | Elevation of Privilege | `Cache-Control: no-store` on 307 → /login (Branch B, preserved per D-52-CF-01) |
| Session data leaking into shared cache | Information Disclosure | `viewerId` never enters `ProfileShellResolver`'s `'use cache'` scope (D-52-CF-02 / Phase 39c Pitfall 1) |
| Unauthorized profile data access | Information Disclosure | `ProfileGate` renders `LockedProfileState` for non-owner, non-public profiles |
| Stale auth token served from prerender cache | Elevation of Privilege | `getCurrentUser()` called in `ProfileChrome` (uncached, runtime) — not in `ProfileShellResolver` (`'use cache'`) |

**Phase 52 security invariants:**
1. CR-01 comment correction (D-52-09) makes it explicit: the `Cache-Control: no-store` header is the actual safety mechanism, not `getSession()` cookie-only behavior. `getSession()` can refresh tokens over the network; the `no-store` header is necessary and sufficient for Router Cache poisoning prevention.
2. Phase 52 does NOT weaken the Branch B contract. Proxy gate + `no-store` is preserved as a locked structural invariant (D-52-CF-01).

---

## Sources

### Primary (HIGH confidence — verified against local Next 16.2.3 docs)

- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/instant.md` — `unstable_instant` full reference: validator behavior, `prefetch: 'static'`, opt-out with `false`, TypeScript interface, works ONLY with `cacheComponents: true`
- `node_modules/next/dist/docs/01-app/02-guides/instant-navigation.md` — canonical dynamic-route example, `instant()` helper, "how validation checks every entry point", `instant = false` opt-out pattern
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/layout.md` — "Interaction with loading.js" section, verbatim prescription for Suspense around runtime data access, sync layout pattern
- `node_modules/next/dist/docs/01-app/02-guides/streaming.md` — "Push dynamic access down" section, sync layout with cookie/params Promise pass-through pattern
- `node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md` — `'use cache'` semantics, "Working with runtime APIs", "Passing runtime values to cached functions" pattern
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md` — loading.js behavior with Cache Components, Suspense boundary semantics, status code constraints
- `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-cache-remote.md` — in-memory limitations of `'use cache'`, when remote caching matters
- `/tmp/next-playwright-inspect/package/dist/index.d.ts` — `@next/playwright@16.2.6` `instant()` TypeScript declaration (exact signature + JSDoc)
- `/tmp/next-playwright-inspect/package/README.md` — `@next/playwright@16.2.6` `instant()` behavioral description, cookie protocol, warm-cache assumption

### Secondary (MEDIUM confidence — verified against npm registry + package.json)

- `npm view @playwright/test version` — confirmed `1.60.0` latest; `@next/playwright` peer deps require `>=1.0.0`
- `npm view @next/playwright peerDependencies` — `{ '@playwright/test': '>=1.0.0' }` — no tight version coupling
- `package.json` — confirmed existing `playwright: ^1.60.0` in devDependencies; `@playwright/test` NOT installed (separate package)

### Tertiary (LOW confidence — assumed from context/training, not directly verified)

- `revalidatePath('/u/[username]', 'layout')` behavior post-Phase-52 (A2 in Assumptions Log) — mechanism assumed correct; no doc quote directly addresses this topology change

---

## Metadata

**Confidence breakdown:**
- `unstable_instant` validator behavior: HIGH — verified from local pinned Next 16.2.3 docs
- Sync layout / Suspense pattern: HIGH — verbatim doc quotes from two independent doc sections
- `instant()` helper API: HIGH — type declarations + README unpacked from npm tarball
- `@playwright/test` + `@next/playwright` compatibility: HIGH — peer deps verified via npm registry
- `'use cache'` in-memory-on-serverless: HIGH — verified from `use-cache-remote.md`
- `revalidatePath` post-refactor behavior: LOW — assumed, not doc-cited
- Seeded test user availability for Playwright auth: ASSUMED — planner must confirm

**Research date:** 2026-05-21
**Valid until:** 2026-06-21 (stable APIs; Next 16.x docs are source-pinned in `node_modules`)
