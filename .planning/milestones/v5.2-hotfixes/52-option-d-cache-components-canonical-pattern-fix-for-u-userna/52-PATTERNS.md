# Phase 52: Option D — Cache Components Canonical Pattern Fix - Pattern Map

**Mapped:** 2026-05-21
**Files analyzed:** 13 (5 new, 6 modified, 1 deleted, 1 planning seed)
**Analogs found:** 8 / 13

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/app/u/[username]/profile-chrome.tsx` | async server component | request-response | `src/app/u/[username]/profile-gate.tsx` | exact |
| `src/app/u/[username]/layout.tsx` | layout (sync refactor) | request-response | itself (pre-refactor) + `cache-components-2026-05-21-followup.md` Step 2 | self-refactor |
| `src/app/u/[username]/[tab]/page.tsx` | page (hoist + validator) | request-response | itself (pre-refactor) + `instant-navigation.md` ProductPage example | self-refactor |
| `src/app/u/[username]/loading.tsx` | loading boundary | request-response | itself — comment-only rewrite | self-refactor |
| `src/app/u/[username]/profile-gate.tsx` | async server component | request-response | itself — comment-only update | self-refactor |
| `src/proxy.ts` | middleware | request-response | itself — comment-only update | self-refactor |
| `tests/profile-route-51.test.ts` | unit test (source-grep) | — | itself (existing tests 1–3) | self-extension |
| `package.json` | config | — | itself | self-extension |
| `playwright.config.ts` | config | — | NO ANALOG — greenfield Playwright | none |
| `tests/e2e/auth-setup.ts` | e2e test setup | — | NO ANALOG — first e2e file | none |
| `tests/e2e/profile-tab-instant.test.ts` | e2e test | — | NO ANALOG — first e2e file | none |
| `.planning/seeds/SEED-014-...md` | planning seed | — | `.planning/seeds/SEED-013-v7.0-watch-photos.md` | exact |
| `scripts/assert-phase-51-build.mjs` | script (DELETE) | — | N/A | N/A |

---

## Pattern Assignments

### `src/app/u/[username]/profile-chrome.tsx` (NEW — async server component, request-response)

**Analog:** `src/app/u/[username]/profile-gate.tsx`

Both are async server components that live in the same directory, carry no `'use cache'` directive, are the uncached layer in the route, and are server-only by explicit declaration.

**`server-only` import + function declaration pattern** (`profile-gate.tsx` lines 1, 36–55):
```tsx
import 'server-only'
// ... other imports ...
export async function ProfileGate({
  username,
  viewerId,
  children,
}: {
  username: string
  viewerId: string | null
  children: React.ReactNode
}) {
```

**ProfileChrome should mirror this exact shape.** The RESEARCH.md Step 2 template is the prescriptive implementation — copy verbatim:

```tsx
// src/app/u/[username]/profile-chrome.tsx
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

**Key differences from ProfileGate:**
- Receives `paramsPromise: Promise<{ username: string }>` (a Promise, not a resolved string) — the layout passes the raw `params` prop unchanged
- Calls `getCurrentUser()` + handles `UnauthorizedError` (ProfileGate explicitly CANNOT do this — see gate's PROHIBITED block)
- Does NOT call `ProfileShellResolver` or any DB helper — it only resolves runtime API values and passes them down as props
- Does NOT import from `@/data/*` — it only imports from `@/lib/auth` and `./profile-gate`

**Prohibited pattern from ProfileGate comment** (lines 26–35) — ProfileChrome must NOT have:
- `'use cache'` directive
- `next/cache` tag/life primitives
- `ProfileShellResolver` call
- Any `@/data/*` imports beyond what it legitimately needs

---

### `src/app/u/[username]/layout.tsx` (MODIFIED — sync refactor)

**Analog:** itself (current 60-line file) + RESEARCH.md Pattern 1 / audit followup Step 2

Current file at lines 35–59 is the anti-pattern that Phase 52 replaces. The refactor removes `async` from the function signature, removes both top-level `await` calls, and wraps the new `ProfileChrome` import in `<Suspense>`.

**Current (broken) shape** (`layout.tsx` lines 35–59):
```tsx
export default async function ProfileLayout({   // async — wrong
  children,
  params,
}: LayoutProps<'/u/[username]'>) {
  const { username } = await params             // top-level await — wrong
  let viewerId: string | null = null
  try {
    viewerId = (await getCurrentUser()).id       // top-level await — wrong
  } catch (err) {
    if (!(err instanceof UnauthorizedError)) throw err
  }
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 lg:px-8 lg:py-12">
      <ProfileGate username={username} viewerId={viewerId}>  {/* no Suspense — wrong */}
        {children}
      </ProfileGate>
    </main>
  )
}
```

**Target shape** (from RESEARCH.md Pattern 1 / audit followup Step 2):
```tsx
import { Suspense } from 'react'
import { ProfileChrome } from './profile-chrome'
import { ProfileShellSkeleton } from './profile-shell-skeleton'

export default function ProfileLayout({    // sync — correct
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

**Imports to remove:** `getCurrentUser`, `UnauthorizedError` from `@/lib/auth`; `ProfileGate` from `./profile-gate`
**Imports to add:** `{ Suspense }` from `react`; `{ ProfileChrome }` from `./profile-chrome`; `{ ProfileShellSkeleton }` from `./profile-shell-skeleton`

**D-52-16 structural lock:** The `async` keyword MUST NOT appear on `ProfileLayout`. The `Suspense` wrapper and `ProfileChrome` inside it MUST always be present.

---

### `src/app/u/[username]/[tab]/page.tsx` (MODIFIED — add validator export + hoist body)

**Analog:** itself (368-line file) + RESEARCH.md Pattern 2 (instant-navigation.md ProductPage example)

**Change 1 — validator export (line ~33 area, replaces comment block):**

Current comment block at lines 33–39 records the *wrong* diagnosis (unstable_instant on blocklist). Replace entirely with:
```tsx
// Phase 52 (D-52-11 diagnosis reversal): `unstable_instant` is a VALIDATOR,
// not a runtime feature. Adding it here causes npm run build + npm run dev
// to fail if the Suspense structure ever regresses (recurrence-5 prevention).
// See .planning/phases/52-.../52-CONTEXT.md and
// .planning/audits/cache-components-2026-05-21-followup.md.
export const unstable_instant = { prefetch: 'static' }
```

**Change 2 — outer component becomes sync, body hoisted to inner `ProfileTabContent`:**

Current outer function signature (line 52):
```tsx
export default async function ProfileTabPage({
  params,
}: {
  params: Promise<{ username: string; tab: string }>
}) {
  const { username, tab } = await params    // top-level await — wrong
  // ... 316 lines of tab logic ...
}
```

Target shape (outer sync, inner async):
```tsx
export default function ProfileTabPage({
  params,
}: {
  params: Promise<{ username: string; tab: string }>
}) {
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
  // ... ALL 316 lines of existing tab logic verbatim, unchanged ...
}
```

**IMPORTANT — body moves verbatim:** The entire body of `ProfileTabPage` (lines 57–368) moves unchanged into `ProfileTabContent`. The only mechanical changes are: function name, function declaration keyword (sync outer, async inner), and parameter name (`params` → `paramsPromise`, then `await paramsPromise` inside).

**Imports to add:** `{ Suspense }` from `react`; `ProfileTabContentSkeleton` is already exported from `../profile-shell-skeleton` but may need to be added to the import list at the top of the file.

**notFound() ordering invariant (D-52-CF-03):** Inside `ProfileTabContent`, the `notFound()` calls on lines ~58 and ~79 stay exactly where they are — they are already in the correct position (BEFORE post-suspending awaits at line ~57 tab validation; AFTER the resolver at line ~79 which is unavoidable). Do NOT reorder them.

---

### `src/app/u/[username]/loading.tsx` (MODIFIED — comment rewrite only)

**Analog:** itself (17-line file)

The 3 lines of executable code are unchanged. Only the comment block at lines 3–13 is rewritten. The current comment references "the layout's own `<Suspense fallback={<ProfileShellSkeleton/>}>`" as a cold-load case that doesn't exist yet (stale from a prior phase). After Phase 52, that Suspense WILL exist (layout wraps ProfileChrome in Suspense), so the comment becomes accurate — but it needs to describe the three-boundary structure.

**Current comment** (lines 3–13) — stale reference to a non-existent layout Suspense.

**Target comment** should describe the three Phase 52 boundaries:
1. `layout.tsx` `<Suspense fallback={<ProfileShellSkeleton/>}>` around `ProfileChrome` — cold-load chrome skeleton (layout level)
2. `[tab]/page.tsx` `<Suspense fallback={<ProfileTabContentSkeleton/>}>` around `ProfileTabContent` — tab-nav content skeleton (page level)
3. `loading.tsx` implicit Suspense — implicit-prefetch client-navigation case (this file)

**Executable code stays unchanged:**
```tsx
export default function Loading() {
  return <ProfileTabContentSkeleton />
}
```

---

### `src/app/u/[username]/profile-gate.tsx` (MODIFIED — comment update only)

**Analog:** itself

The function signature, props interface, and all logic are unchanged (D-52-CF-02 structural lock). The only change is the comment block at the top (lines 12–35) which references "Receives `viewerId` from the page (the runtime-API consumer)" — this attribution should be updated to say "from `ProfileChrome`" rather than "from the page", since ProfileChrome is now the caller.

**Invariants to preserve verbatim:**
- `import 'server-only'` (line 1)
- PROHIBITED block (lines 26–35) — no `use cache`, no `@/lib/auth` import, no cookie reads
- Function signature (lines 36–55) — `username`, `viewerId`, `initialIsFollowing?`, `children` props unchanged
- `notFound()` call before post-suspending awaits (line 60)

---

### `src/proxy.ts` (MODIFIED — comment correction only, CR-01)

**Analog:** itself (45-line file)

Lines 11–21 contain the comment that overstates `getSession()` cookie-only-ness. The current comment says "NOTE: this is cookie-first, not strictly network-free — getSession() can refresh the access token when it is near expiry ... The PRIMARY recurrence-2 mitigation is the `Cache-Control: no-store` header."

CR-01 correction: The comment already correctly identifies `Cache-Control: no-store` as the primary mitigation (line 21). What needs updating is the secondary framing — the comment should make clear that `getSession()` cookie-only-ness is NOT a safety property being relied on here; the `no-store` header IS the safety mechanism and is sufficient. The exact correction is planner's call on the wording; the behavioral code at lines 23–30 is unchanged.

**Executable code unchanged:**
```ts
if (!userId && !isPublic) {
  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('next', pathname + request.nextUrl.search)
  const redirect = NextResponse.redirect(loginUrl)
  redirect.headers.set('Cache-Control', 'no-store')  // unchanged
  return redirect
}
```

---

### `tests/profile-route-51.test.ts` (MODIFIED — Test 1 inversion + Tests 4 and 5 additions)

**Analog:** itself (lines 1–87, especially the describe/it/readFileSync/regex pattern)

**Established source-grep pattern** (lines 1–4 + 23–44):
```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('Phase 51 — profile route PPR opt-out', () => {
  it('layout has no Suspense over an awaited shell (REQ-51-04)', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/u/[username]/layout.tsx'),
      'utf8',
    )
    expect(/<Suspense\b/.test(source)).toBe(false)
    // ...
  })
})
```

**Test 1 inversion (D-52-06 / REQ-52-06):**

Remove the existing two assertions at lines 36–37:
```ts
expect(/<Suspense[^>]*fallback={<ProfileShellSkeleton/s.test(source)).toBe(false)
expect(/<Suspense\b/.test(source)).toBe(false)
```

Replace with the inverted invariant (layout MUST NOT directly `await getCurrentUser`; layout MUST have `<Suspense>`):
```ts
// Phase 52 inversion: layout MUST be sync (ProfileChrome is the new runtime-API consumer).
// Layout MUST NOT directly await getCurrentUser — that's ProfileChrome's job.
expect(/await\s+getCurrentUser/s.test(source)).toBe(false)
// Layout MUST have Suspense wrapping ProfileChrome (canonical Cache Components pattern).
expect(/<Suspense\b/.test(source)).toBe(true)
```

Keep line 44 (`expect(source.includes('<main')).toBe(true)`) unchanged.

**Test 4 — `unstable_instant` export (new, REQ-52-01):**
```ts
it('page exports unstable_instant for build-time validation (REQ-52-01)', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/app/u/[username]/[tab]/page.tsx'),
    'utf8',
  )
  expect(/export\s+const\s+unstable_instant\s*=/.test(source)).toBe(true)
})
```

**Test 5 — `ProfileTabContent` async component inside page Suspense (new, REQ-52-04):**
```ts
it('page has inner async ProfileTabContent inside Suspense (REQ-52-04)', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/app/u/[username]/[tab]/page.tsx'),
    'utf8',
  )
  // Inner async component must exist
  expect(/async\s+function\s+ProfileTabContent/.test(source)).toBe(true)
  // Outer component passes paramsPromise to it
  expect(/ProfileTabContent\s+paramsPromise=/.test(source)).toBe(true)
})
```

---

### `package.json` (MODIFIED — add devDeps + test:e2e script)

**Analog:** itself

**Addition to `scripts`** (after line 7 `"test:watch": "vitest"`):
```json
"test:e2e": "playwright test"
```

**Additions to `devDependencies`** (existing `playwright: "^1.60.0"` is present at line 74; add alongside it):
```json
"@playwright/test": "^1.60.0",
"@next/playwright": "16.2.6"
```

Note: `playwright` (browser lib) is already in devDependencies. `@playwright/test` is the separate CLI/API package; both are needed.

---

### `playwright.config.ts` (NEW — no existing analog)

No Playwright config exists in this codebase. Confirmed: no `playwright.config.*` files found anywhere in the project tree. This is entirely greenfield.

**Use RESEARCH.md Pattern 6 verbatim** (the standard Next.js + local-dev-server shape documented there):

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
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

---

### `tests/e2e/auth-setup.ts` (NEW — no existing analog)

No e2e test files exist. No Supabase admin API usage in test files exists. This is greenfield.

**Closest structural analog:** `scripts/seed-lineage.ts` or any other script in `scripts/` that uses Supabase client initialization. However, those scripts use Drizzle/postgres, not the Supabase JS client.

**Pattern from RESEARCH.md Pitfall 6:** Use `supabase.auth.signInWithPassword` with seeded credentials (option a — simplest; requires a seeded test user with known password in local Supabase). The standard Playwright storageState pattern:

```ts
import { chromium } from '@playwright/test'

async function globalSetup() {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  // Sign in via Supabase email/password UI or API
  await page.goto('http://localhost:3000/login')
  await page.fill('[name="email"]', process.env.TEST_USER_EMAIL ?? '')
  await page.fill('[name="password"]', process.env.TEST_USER_PASSWORD ?? '')
  await page.click('[type="submit"]')
  await page.waitForURL('**/u/**')  // confirm redirect to profile
  await page.context().storageState({ path: 'tests/e2e/storageState.json' })
  await browser.close()
}

export default globalSetup
```

**Planner note (A4 from RESEARCH.md):** Confirm a seeded test user with known email/password exists in local Supabase before writing `auth-setup.ts`. If not, the setup step needs to create one via the Supabase admin API with `SUPABASE_SERVICE_ROLE_KEY` from `.env.local`.

---

### `tests/e2e/profile-tab-instant.test.ts` (NEW — no existing analog)

No e2e test files exist. This is greenfield.

**Use RESEARCH.md Pattern 5 verbatim** (the `instant()` test template documented there with the warm-cache goto before instant() call):

```ts
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

**Planner note (A5 from RESEARCH.md):** Before writing the post-stream assertion, inspect `WishlistTabContent` for a `data-testid` attribute. If none exists, use a text-content selector like `page.locator('text=Wishlist')` or the tab heading.

---

### `.planning/seeds/SEED-014-cache-components-canonical-sweep.md` (NEW)

**Analog:** `.planning/seeds/SEED-013-v7.0-watch-photos.md` (most recently planted seed; same frontmatter structure)

**Frontmatter pattern** (from SEED-013 lines 1–9):
```markdown
---
id: SEED-014
status: dormant
planted: 2026-05-21
planted_during: Phase 52 — Option D Cache Components canonical pattern fix
trigger_when: starting the broader Cache Components canonical-pattern sweep phase (post-Phase-52).
scope: medium
related_phases: [Phase 39c unstable_instant removal, Phase 51 PPR opt-out, Phase 52 Option D fix]
---
```

**Body sections** (all seeds use: `## The Idea`, `## Scope`, `## Why This Matters`, `## When to Surface`, `## Open Questions`, `## Breadcrumbs`):

SEED-014 specific content per D-52-04:
- `## Scope` should include a table of cross-route validator findings: columns `route`, `opt-out applied`, `suspected fix shape`. Rows are populated from Step 1 Wave 1 validator output. If no cross-route errors appear, note that explicitly.
- `## Why This Matters` — the 30 PPR-classified routes from the original audit (`.planning/audits/cache-components-2026-05-21.md`) have the same structural bug potential; Phase 52 fixed one; a sweep phase fixes the rest.
- `## Breadcrumbs` — link to `.planning/audits/cache-components-2026-05-21.md` (full PPR-classified route list), `.planning/audits/cache-components-2026-05-21-followup.md` (Option D plan + D-52-02 opt-out pattern), and Phase 52's `52-CONTEXT.md`.

---

### `scripts/assert-phase-51-build.mjs` (DELETE)

No pattern work needed. D-52-10 is a straight file deletion. The script is 209 lines; it is superseded entirely by the `unstable_instant` validator export. No replacement file.

---

## Shared Patterns

### `server-only` + async server component declaration
**Source:** `src/app/u/[username]/profile-gate.tsx` lines 1, 36
**Apply to:** `profile-chrome.tsx` (new file)
```tsx
import 'server-only'
export async function ComponentName({ ...props }: Props) {
```
This pattern enforces server-only at the module boundary and prevents accidental client bundle inclusion.

### `vitest.config.ts` `server-only` shim
**Source:** `vitest.config.ts` lines 18–20
**Apply to:** No new vitest test directly imports `profile-chrome.tsx`, but note the shim is already in place. Any new source-grep tests in `tests/profile-route-51.test.ts` that use `readFileSync` (not `import`) are unaffected — the shim is only needed for component imports.
```ts
'server-only': fileURLToPath(new URL('./tests/shims/server-only.ts', import.meta.url)),
```

### Source-grep test pattern
**Source:** `tests/profile-route-51.test.ts` lines 1–4, 24–27
**Apply to:** All new tests in `tests/profile-route-51.test.ts` (Tests 4 and 5)
```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(
  resolve(process.cwd(), 'src/path/to/file.tsx'),
  'utf8',
)
expect(/regex/.test(source)).toBe(true | false)
```

### Absolute `@/` imports
**Source:** All source files in the codebase — consistent convention
**Apply to:** `profile-chrome.tsx`
```tsx
import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
```
No relative `../../` traversals. The `vitest.config.ts` alias maps `@` to `./src`.

### Error try/catch for `UnauthorizedError`
**Source:** `src/app/u/[username]/layout.tsx` lines 45–50 and `[tab]/page.tsx` lines 64–69
**Apply to:** `profile-chrome.tsx`
```tsx
let viewerId: string | null = null
try {
  viewerId = (await getCurrentUser()).id
} catch (err) {
  if (!(err instanceof UnauthorizedError)) throw err
}
```
This pattern distinguishes "not logged in" (expected, viewerId stays null) from unexpected errors (rethrown). Both layout.tsx and page.tsx use it identically — ProfileChrome must use it identically too.

---

## No Analog Found

| File | Role | Reason |
|---|---|---|
| `playwright.config.ts` | e2e config | No Playwright config exists in this codebase. `playwright` (browser lib) is in devDependencies but no test runner config exists. Use RESEARCH.md Pattern 6 as the implementation template. |
| `tests/e2e/auth-setup.ts` | e2e auth setup | No e2e test files exist. No Supabase auth flows in test files. Use RESEARCH.md Pitfall 6 guidance + standard Playwright storageState pattern. Planner must confirm seeded test user availability (A4). |
| `tests/e2e/profile-tab-instant.test.ts` | e2e test | No e2e test files exist. Use RESEARCH.md Pattern 5 (`instant()` test template) verbatim. Planner must confirm `WishlistTabContent` testid for the post-stream assertion (A5). |

---

## Metadata

**Analog search scope:** `src/app/u/[username]/`, `tests/`, `scripts/`, `.planning/seeds/`
**Files scanned:** 14 source files + 13 seed files (list above)
**Playwright infrastructure confirmed absent:** `find . -name "playwright.config*" -o -path "*/e2e/*"` returned no results (excluding `node_modules`)
**Pattern extraction date:** 2026-05-21
