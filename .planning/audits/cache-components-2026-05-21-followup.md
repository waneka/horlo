---
title: Cache Components Audit — Follow-up + Refined Plan (Option D)
type: audit-followup
audit_date: 2026-05-21
supersedes_section: "Three forward options" in cache-components-2026-05-21.md
status: ready-for-execution
related_phase: 51
related_audit: .planning/audits/cache-components-2026-05-21.md
related_debug: .planning/debug/resolved/profile-page-404-top-nav.md
trigger: Recurrence-4 (React #419) hit prod ~10 min after the layout-fix deploy on 2026-05-20 night. Operator chose to investigate the docs deeply rather than revert, given zero users and the recurrence pattern itself being the meta-bug.
---

# Cache Components Audit — Follow-up

This document captures the diagnosis revision and refined plan from the morning of 2026-05-21, after deep reading of six Next.js 16 documentation pages. It supersedes the "Three forward options" section of `cache-components-2026-05-21.md`. The original audit's findings (the broken assertion script, the actual recurrence-3 mitigation being `Cache-Control: no-store`, the 30 PPR-classified routes, the 22 files touching CC surfaces) all remain valid.

## What changed since the original audit

### 1. Recurrence-4 happened in prod (2026-05-20 late night)

After the three layout-fix commits (`172f211` + `be264f2` + `7b1a401`) deployed, the operator clicked around fine for ~10 minutes, then 404s came back. Browser console showed React minified error #419:

> "The server could not finish this Suspense boundary, likely due to an error during server rendering. Switched to client rendering."

Stack trace was in scheduler / postMessage internals — i.e., the RSC streaming layer aborted server-side.

Prod state at the time of recurrence-4:
- Anon `/u/twwaneka/collection` → 307 + `cache-control: no-store` ✓ (Branch B contract still live)
- Authenticated tab navigation → React #419 + 404 page after ~10 min of healthy navigation
- `x-vercel-id` confirmed the layout-fix code was the deployed artifact

The 10-minute delay matches the 300s `cacheLife` window on `ProfileShellResolver` (two revalidation cycles), pointing at the static/dynamic partition re-rendering with the wrong state when the cache expires.

**Operator decision:** Do NOT revert. Zero users in prod; the broken state is information. Investigate the docs deeply, fix correctly, then redeploy.

### 2. Six docs pages read with specific gotcha-hunting prompts

| URL | Key findings |
|---|---|
| `/docs/app/getting-started/caching` | Components accessing runtime APIs (cookies/headers/searchParams/params) MUST be in Suspense; "Passing runtime values to cached functions" canonical pattern; `'use cache'` is in-memory only on serverless. |
| `/docs/app/getting-started/route-handlers#with-cache-components` | Route handlers stop prerendering on cookie/header/db/network access; `'use cache'` cannot be used directly in route handler bodies. |
| `/docs/app/getting-started/layouts-and-pages` | Layouts preserve state on navigation; do not rerender; `params` is `Promise<{...}>`. |
| `/docs/app/getting-started/linking-and-navigating` | Client-side navigation fetches RSC payload only (no HTML); only re-renders below the shared layout; loading.tsx fires implicit Suspense boundaries; `unstable_instant` referenced in AI agent hint. |
| `/docs/app/guides/streaming` | "Push dynamic access down" canonical principle; layouts should be SYNC and pass promises to Suspense'd children; mid-stream `notFound()` is 200 + noindex meta, not real 404; HTTP contract once streaming starts. |
| `/docs/app/guides/instant-navigation` | **`unstable_instant` is a VALIDATION TOOL**, not a runtime feature — fails dev/build if Suspense structure can't produce instant nav at any entry point including sibling client navigations. |
| `/docs/app/api-reference/file-conventions/layout` | The "Interaction with loading.js" section describes our exact bug verbatim and prescribes the exact fix. |

### 3. The diagnosis chain across all four recurrences was wrong

Re-reading our project debug history alongside the docs reveals the diagnosis pattern:

- **Recurrence 1**: `prefetch={false}` band-aid — treated symptom
- **Recurrence 2** (May 14): `unstable_instant` REMOVED because "`{ prefetch: 'static' }` on a route whose page body is dynamic caused click-time RSC fetches to return tree-only payloads → infinite skeletons and Router Cache poisoning"
- **Recurrence 3** (May 19): F3-Composite layout collapse — moved Suspense+ProfileGate from layout to page
- **Recurrence 4** (May 20 night): layout fix moved ProfileGate back to layout (canonical Next pattern) without re-adding Suspense

**The diagnosis inversion** (high confidence based on the instant-navigation doc): `unstable_instant` did not *cause* the recurrence-2 bug. It was *correctly flagging that the page's structure couldn't produce an instant navigation* (because `params`, cookies, and uncached fetches were awaited at the top of the page/layout without Suspense boundaries). Removing it in Phase 39c **removed the validation, not the bug**. The "tree-only RSC payloads" symptom was the structural defect manifesting at runtime; the validator was correctly trying to prevent it.

This explains the recurrence cycle: every "fix" addressed a tangential signal (prefetch hints, Suspense placement, layout collapse, layout restoration) without fixing the root structural defect — runtime API access (`params`, `cookies()`, uncached fetches) outside of Suspense boundaries in segments that participate in client-side navigation.

## The canonical Next 16 pattern for our use case

Three independent doc sections converge on the same prescription:

### From the streaming guide ("Push dynamic access down")

> "The key to maximizing what streams instantly is to defer dynamic data access to the component that actually needs it. This applies to `params`, `searchParams`, `cookies()`, `headers()`, and data fetches. **If you `await` any of these at the top of a layout or page, everything below that point becomes dynamic and cannot be prerendered as part of the static shell.**"

The doc's example layout is SYNC, calls `cookies()` to get a promise but doesn't await it:

```tsx
export default function DashboardLayout({ children }) {
  const cookieStore = cookies() // Start the work, but don't await
  return (
    <div>
      <Nav>
        <Suspense fallback={<p>Loading user...</p>}>
          <UserMenu cookiePromise={cookieStore} />
        </Suspense>
      </Nav>
      {children}
    </div>
  )
}
```

### From the layout API reference ("Interaction with loading.js")

> "**With Cache Components:** `loading.js` is treated as a regular `<Suspense>` boundary rather than a special prefetch marker. **Uncached or runtime data access in the layout must be explicitly wrapped in its own `<Suspense>` boundary**, otherwise Next.js guides you with a build-time error."

Fix shown in the doc:

```tsx
import { Suspense } from 'react'
import { NavSkeleton } from './nav-skeleton'
import { DashboardNav } from './dashboard-nav'

export default function Layout({ children }) {
  return (
    <>
      <Suspense fallback={<NavSkeleton />}>
        <DashboardNav />
      </Suspense>
      <main>{children}</main>
    </>
  )
}
```

### From the instant-navigation guide (dynamic-route canonical pattern)

```tsx
export const unstable_instant = { prefetch: 'static' }

import { Suspense } from 'react'

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  return (
    <div>
      <Suspense fallback={<p>Loading product...</p>}>
        {params.then(({ slug }) => <ProductInfo slug={slug} />)}
      </Suspense>
      <Suspense fallback={<p>Checking availability...</p>}>
        <Inventory params={params} />
      </Suspense>
    </div>
  )
}

async function ProductInfo({ slug }: { slug: string }) {
  'use cache'
  const product = await fetchProduct(slug)
  return <>...</>
}

async function Inventory({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const inventory = await fetchInventory(slug)
  return <p>{inventory.count} in stock</p>
}
```

### What our current code does wrong (post-layout-fix state at commit `2f22003`)

**`src/app/u/[username]/layout.tsx`** — violates the rule:

```tsx
export default async function ProfileLayout({  // ← ASYNC (wrong)
  children,
  params,
}: LayoutProps<'/u/[username]'>) {
  const { username } = await params              // ← top-level await of runtime API
  let viewerId: string | null = null
  try { viewerId = (await getCurrentUser()).id }  // ← top-level await of cookies
  catch (err) { if (!(err instanceof UnauthorizedError)) throw err }
  return (
    <main>
      <ProfileGate username={username} viewerId={viewerId}>  {/* no Suspense */}
        {children}
      </ProfileGate>
    </main>
  )
}
```

**`src/app/u/[username]/[tab]/page.tsx`** — also violates:

```tsx
export default async function ProfileTabPage({ params }) {
  const { username, tab } = await params          // ← top-level await of runtime API
  // ...
  let viewerId: string | null = null
  try { viewerId = (await getCurrentUser()).id }  // ← top-level await of cookies
  // ...
  const resolved = await ProfileShellResolver({ username })  // ← top-level await
  // ...
  // tab-specific branches each return JSX with no Suspense boundary around the
  // runtime-API-dependent content
}
```

There is no `unstable_instant` export anywhere in the codebase — validation has been off since Phase 39c removed it.

## Refined Option D — concrete implementation plan

This is Option D (keep CC + layouts + PPR, fix the bug correctly), expanded from yesterday's layout-only fix to include the page + the validation export. **The operator selected Option D / "fix the bug, keep the features" on the morning of 2026-05-21 after sleeping on the audit.**

### Step 1 — validation experiment (one-line change)

Add **only** this single line to `src/app/u/[username]/[tab]/page.tsx`:

```tsx
export const unstable_instant = { prefetch: 'static' }
```

Then run:

```bash
npm run dev   # Watch for the validator's overlay errors
npm run build # Watch for build-time errors
```

The validator will fail with specific component-level errors identifying every Suspense boundary problem on the route. Each error names the offending component and suggests a fix. **This is the ground truth for the actual scope of the fix.** Do not guess — let the validator tell us.

> From the instant-navigation doc: *"Next.js now simulates navigations at every shared layout boundary in the route. Awaiting `params` and both data fetches are flagged as violations because they suspend or access uncached data outside a Suspense boundary. Each error identifies the specific component and suggests a fix."*

Expected output (best guess, but DO NOT pre-implement before reading actual validator output):
- Layout's top-level `await params` flagged
- Layout's top-level `await getCurrentUser()` flagged
- Page's top-level `await params` flagged
- Page's top-level `await getCurrentUser()` flagged
- Page's top-level `await ProfileShellResolver(...)` flagged
- Possibly: cached components receiving Promise-typed args instead of resolved values

### Step 2 — refactor based on validator output

Working hypothesis of the proposed shape (will be refined by actual validator output):

#### `src/app/u/[username]/layout.tsx` — sync, Suspense around chrome

```tsx
import { Suspense } from 'react'
import { ProfileChrome } from './profile-chrome'
import { ProfileShellSkeleton } from './profile-shell-skeleton'

export default function ProfileLayout({
  children,
  params,
}: LayoutProps<'/u/[username]'>) {
  // Layout is SYNC. Do not await `params`. Pass the promise to a child
  // wrapped in <Suspense> so the layout itself stays in the static shell.
  // Pattern source: /docs/app/guides/streaming "Push dynamic access down"
  // + /docs/app/api-reference/file-conventions/layout "Interaction with
  // loading.js" (with Cache Components, runtime data access in the layout
  // must be wrapped in its own Suspense).
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 lg:px-8 lg:py-12">
      <Suspense fallback={<ProfileShellSkeleton />}>
        <ProfileChrome paramsPromise={params}>{children}</ProfileChrome>
      </Suspense>
    </main>
  )
}
```

#### `src/app/u/[username]/profile-chrome.tsx` — NEW FILE, async, does runtime API access

```tsx
import 'server-only'
import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
import { ProfileGate } from './profile-gate'

interface Props {
  paramsPromise: Promise<{ username: string }>
  children: React.ReactNode
}

export async function ProfileChrome({ paramsPromise, children }: Props) {
  // This component is the runtime-API consumer for the layout, wrapped
  // in <Suspense> by the parent layout. Per the docs (caching guide,
  // "Passing runtime values to cached functions"), runtime API access
  // happens HERE in an uncached scope, and resolved values are passed
  // to ProfileGate which awaits the cached ProfileShellResolver internally.
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

#### `src/app/u/[username]/[tab]/page.tsx` — restructure to defer top-level awaits

The page has substantial tab-specific branching logic (collection / wishlist / worn / notes / stats / common-ground / insights — each with its own data fetches, locked-tab branches, and privacy gates). Rather than restructure all of this inline, hoist the entire body into an async inner component called from a Suspense-wrapped wrapper:

```tsx
export const unstable_instant = { prefetch: 'static' }

import { Suspense } from 'react'
// ... existing imports ...

export default function ProfileTabPage({
  params,
}: {
  params: Promise<{ username: string; tab: string }>
}) {
  // Page is SYNC. Do not await params at top. Defer to inner component
  // that runs inside a Suspense boundary.
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
  // ... all the existing page logic (tab validation, viewer resolution,
  // ProfileShellResolver, tab-specific branches, locked-tab cards, etc.)
  // moves here verbatim. Just changes the function signature.
}
```

`<ProfileTabContentSkeleton />` already exists in `src/app/u/[username]/profile-shell-skeleton.tsx`.

### Step 3 — verify the layout's `[username]/loading.tsx` still makes sense

Currently `src/app/u/[username]/loading.tsx` exists and renders `<ProfileTabContentSkeleton />`. With the new structure:

- Layout's Suspense (around ProfileChrome) shows `<ProfileShellSkeleton />` — full chrome skeleton on cold load
- Page's Suspense (around ProfileTabContent) shows `<ProfileTabContentSkeleton />` — narrow content-area skeleton on tab nav

Both boundaries coexist correctly per the docs:
- Cold load: layout Suspense fires first (full chrome skeleton), then resolves chrome + page's Suspense fallback (content skeleton), then resolves content
- Tab navigation: layout subtree is already resolved (chrome stays on screen); only page Suspense fires (content skeleton flash for the new tab's data)

The existing `loading.tsx` may now be redundant (since the page has its own Suspense). Keep it for the implicit-prefetch case during client navigation per the linking-and-navigating docs. The docs aren't crisp on whether you need both, but having both is harmless.

### Step 4 — run validation again, fix until green

```bash
npm run dev
# Click around in /u/twwaneka/{collection,wishlist,worn,notes,stats}
# Watch DevTools for any structural warnings or runtime errors

npm run build
# Must exit 0 with no "blocking route" or "Uncached data was accessed"
# errors. The build summary should still show ◐ for /u/[username]/[tab]
# (PPR is correct here; the static shell will contain the Suspense
# fallbacks, the dynamic content streams in).
```

### Step 5 — local UAT before deploy

Critical: do NOT push to prod without verifying locally that:
1. Tab-to-tab navigation does not flash the full chrome skeleton (only the per-tab content skeleton, if any)
2. Initial page load shows the layout Suspense fallback first, then resolves cleanly
3. Anonymous request → 307 with Cache-Control: no-store (Branch B contract still holds)
4. `npx vitest run tests/profile-route-51.test.ts tests/proxy.test.ts tests/app/profile-tab-insights.test.tsx tests/app/profile-layout.test.tsx` all pass

### Step 6 — update the regression tests

The Phase 51 regression test (`tests/profile-route-51.test.ts`) asserts NO Suspense in layout source. With the refined Option D, layout WILL have Suspense (correctly, per docs). Update Test 1 to assert the correct invariant:

```ts
// Test 1 (REQ-51-04 revised): layout MUST NOT contain `<Suspense
// fallback={<ProfileShellSkeleton/>}>` wrapping ProfileGate DIRECTLY
// (which was the recurrence-3 anti-pattern — Suspense around an awaited
// cookie-reading shell that internally awaits getCurrentUser).
//
// Layout MAY contain `<Suspense fallback={...}><ProfileChrome
// paramsPromise={...}>` (the docs-prescribed pattern — Suspense around
// an async component that does runtime API access).
expect(/await\s+getCurrentUser/s.test(source)).toBe(false)
// Layout must not directly await getCurrentUser; that's ProfileChrome's job.
```

Add a test asserting the page has `unstable_instant` export:

```ts
it('page exports unstable_instant for build-time validation (REQ-NEW)', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/app/u/[username]/[tab]/page.tsx'),
    'utf8',
  )
  expect(/export\s+const\s+unstable_instant\s*=/.test(source)).toBe(true)
})
```

### Step 7 — add a Playwright `instant()` test for the canonical flow

Per the instant-navigation guide:

```ts
// tests/e2e/profile-tab-instant.test.ts
import { test, expect } from '@playwright/test'
import { instant } from '@next/playwright'

test('profile chrome stays mounted on tab navigation', async ({ page }) => {
  // Auth setup omitted — see other e2e tests for auth pattern
  await page.goto('/u/twwaneka/collection')

  await instant(page, async () => {
    await page.click('a[href="/u/twwaneka/wishlist"]')
    // The chrome (avatar, header, tab strip) is in the instant shell
    await expect(page.getByRole('heading', { name: /@twwaneka/ })).toBeVisible()
    await expect(page.getByRole('tablist')).toBeVisible()
  })

  // After instant() exits, the tab content streams in
  await expect(page.getByTestId('wishlist-content')).toBeVisible()
})
```

This test pins the bug class: chrome stays mounted across tab navigation. Will catch recurrence-5 (if any) at CI time before it ships.

### Step 8 — deploy and verify

```bash
git push origin main
# Wait ~3 min for Vercel deploy
curl -s -o /dev/null --cookie-jar /dev/null --cookie /dev/null \
  -w "STATUS=%{http_code}\n" -D /tmp/h \
  "https://www.horlo.app/u/twwaneka/collection"
# Must show STATUS=307 + cache-control: no-store
grep -i cache-control /tmp/h
```

Then operator UAT: sign in, click tabs through two full cycles, watch for 404s. Wait ~15 min and click again to verify cache revalidation doesn't trigger #419.

## Open risks for the next session

### 1. The `unstable_instant` validator may surface MORE errors than expected

The docs are clear that validation runs across ALL entry points. It's plausible the validator complains about:
- Other authenticated routes (`/watch/[id]`, `/watch/[id]/edit`, `/wear/[wearEventId]`) with similar patterns
- `/search` (uses `cacheTag`, `cacheLife`)
- `/explore/lists/[id]` (mentioned in audit as PPR-classified)
- Components imported by these pages that have implicit Suspense violations

**Mitigation:** Add `unstable_instant = { prefetch: 'static' }` to ONLY `/u/[username]/[tab]/page.tsx` initially. Scope the fix. Other routes' validation is a separate phase. If the validator complains about cross-route issues, narrow the test to JUST that page first.

### 2. The refactored shape may still hit a runtime edge case

Yesterday's audit predicted recurrence-4 with the Option A recommendation. The current Option D refinement has higher confidence because it's literally what the docs prescribe, but the operator has been burned four times. Verify locally with `npm run dev` before pushing. Use the Playwright `instant()` test to gain confidence.

### 3. `'use cache'` is in-memory only on serverless

From the caching guide: `'use cache'` stores entries in memory; serverless environments don't persist memory across requests. Our `ProfileShellResolver` may not be actually caching anything across requests on Vercel.

**Implication for the fix:** The "cached resolver" framing throughout the codebase may be wishful. Each cold function invocation re-runs the resolver. cacheLife is moot.

**For real caching, use `'use cache: remote'`** — see the `use-cache-remote` API ref. This is a separate concern from the recurrence bug; flag it for a future polish phase.

### 4. `notFound()` mid-stream is NOT a real 404

From the streaming guide: "When a `<Suspense>` fallback renders or a component suspends, the server must commit to `200 OK` in order to start sending the HTML stream. If a `notFound()` fires mid-stream, Next.js cannot go back and change the status to 404."

Our `[tab]/page.tsx` calls `notFound()` after `await ProfileShellResolver(...)` (line ~79). With the refactor, this stays inside the inner Suspense'd component — still mid-stream — so it still won't return a real 404. This is why no error logs surfaced for recurrence-3.

**Implication:** Move the "is this username a real user?" check ABOVE any Suspense if we want real 404 HTTP statuses. Probably a separate polish item; not blocking the fix.

### 5. CR-01 from the code review remains valid

The proxy.ts safety comment overstates `getSession()` cookie-only-ness. `getSession()` can refresh the token over the network when access token nears expiry. Branch B safety actually rests on the `Cache-Control: no-store` header (set in `src/proxy.ts:23`). Update those comments as part of the fix or as a separate cleanup.

### 6. The audit script `scripts/assert-phase-51-build.mjs` is broken

Original audit finding: the script checks for `prerender:true` or `fallback:'static'` but Next 16.2 uses `experimentalPPR:true` + `renderingMode:'PARTIALLY_STATIC'`. The script has always been a false negative.

**Decision needed:** delete the script, fix it to match Next 16.2's manifest shape, or replace its purpose with the `unstable_instant` validation export. The third option (let Next's validator be the source of truth) is cleanest.

## Current state of prod (as of 2026-05-21 morning)

- **Source on `origin/main`**: commit `2f22003` (includes Phase 51 + code review fixes + layout fix + audit doc; does NOT include refined Option D)
- **Prod URL**: https://www.horlo.app
- **Behavior**: Anon `/u/*` → 307 + `cache-control: no-store` ✓; Authenticated tab navigation → recurrence-4 (React #419 + 404) ~10 min after deploy
- **Last passing UAT**: Phase 51 main alone (commit `84779ae`, pushed 2026-05-20 evening) — zero 404s in two click cycles. The recurrence triggered when the layout-fix commits landed on top.
- **Users at risk**: zero. App has no users yet.
- **Tests passing locally**: 5233 vitest passed, 0 failed (the post-recurrence-4 code passes all our tests because the recurrence is a prod-only ISR-revalidation symptom we don't test for)

## Decision points the next session needs to make

1. **Start with Step 1 (the `unstable_instant` validation experiment)** before writing any other code. The validator output drives everything else.

2. **If validation surfaces errors in OTHER routes**, decide whether to:
   - Scope `unstable_instant` to JUST `[tab]/page.tsx` and fix that route only
   - Add `unstable_instant = false` to layouts that legitimately can't be instant (the docs' opt-out pattern)
   - Treat cross-route errors as a separate phase

3. **Once `/u/[username]/[tab]` validates green**, verify locally that tab UX is what we want (chrome stays mounted, no full reload feel) before pushing.

4. **Deploy verification protocol** — Branch B contract curl + 15-minute wait + operator UAT, in that order.

5. **Whether to keep `'use cache'` in `ProfileShellResolver`** given the in-memory-only-on-serverless finding. Likely keep for now; switch to `'use cache: remote'` later in a polish phase if cache benefits matter.

6. **Audit script** — delete `scripts/assert-phase-51-build.mjs` or replace with a check that reads the build summary's ◐ icon. The original audit flagged it as silently broken; the docs say to trust the build summary.

## Cross-references

- Original audit: `.planning/audits/cache-components-2026-05-21.md` (findings + Options A/B/C, observability proposals, why-was-this-hard-to-debug section — all still valid; only the "three forward options" section is superseded by this doc)
- Phase 51 artifacts: `.planning/phases/51-profile-route-ppr-opt-out-recurrence-3-fix-for-u-username-ta/`
- Resolved debug session: `.planning/debug/resolved/profile-page-404-top-nav.md` (the four recurrences narrative)
- Code review: `.planning/phases/51-.../51-REVIEW.md` (CR-01, CR-02, WR-01..06, IN-01..03)
- Memory file: `~/.claude/projects/-Users-tylerwaneka-Documents-horlo/memory/project_cc_audit_2026_05_21.md` (auto-loaded into context on session start)

## Doc-page references for the next session to consult mid-implementation

- "Push dynamic access down" section: https://nextjs.org/docs/app/guides/streaming#push-dynamic-access-down
- "Interaction with loading.js" section: https://nextjs.org/docs/app/api-reference/file-conventions/layout#interaction-with-loadingjs
- `unstable_instant` reference: https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/instant
- Canonical dynamic-route pattern (the exact shape we should mimic): https://nextjs.org/docs/app/guides/instant-navigation#a-page-that-navigates-instantly
- Locally version-pinned: `node_modules/next/dist/docs/01-app/` (Next 16.2.3 — live docs are 16.2.6 but very close)

## TL;DR for the next session

1. Read this doc + `.planning/audits/cache-components-2026-05-21.md`
2. Add `export const unstable_instant = { prefetch: 'static' }` to `src/app/u/[username]/[tab]/page.tsx` (one line)
3. Run `npm run dev` and `npm run build`, read validator errors
4. Refactor layout + page + new `profile-chrome.tsx` based on validator output (proposed shapes in Step 2)
5. Update Phase 51 regression tests (Step 6) and add Playwright `instant()` test (Step 7)
6. Verify locally, deploy, operator UAT
7. Wait 15+ min post-deploy, verify cache revalidation doesn't trigger #419
