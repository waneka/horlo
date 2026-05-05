# Phase 29: Nav & Profile Chrome Cleanup — Pattern Map

**Mapped:** 2026-05-05
**Files analyzed:** 8 (5 modified + 1 created + 2 sibling test patterns)
**Analogs found:** 8 / 8

> Phase 29 is unusual: every modified file is its own canonical analog (the edits are deletions, className appends, and a per-navigation `key` prop — there is no "find a similar file in the codebase" boundary because the files BEING edited are themselves the latest pattern). This map therefore documents (a) the precise lines to delete / append per file, and (b) for the one NEW test file, the analog test file whose mock + describe-block scaffold to mirror.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/layout/UserMenu.tsx` | component (server, no `'use client'`) | request-response (renders dropdown) | itself (Phase 25 canonical) | exact — self |
| `src/components/profile/ProfileTabs.tsx` | component (`'use client'`) | request-response (pathname-driven render) | itself (Phase 14/18 canonical) | exact — self |
| `src/app/watch/new/page.tsx` | route page (Server Component, async) | request-response (searchParams + DB) | itself (Phase 20.1 + Phase 28 canonical) | exact — self |
| `src/components/watch/AddWatchFlow.tsx` | component (`'use client'`, state machine) | event-driven (FlowState transitions) | itself (Phase 20.1 + Phase 28 canonical) | exact — self |
| `tests/components/layout/UserMenu.test.tsx` | test | unit assertion | itself (Phase 25) | exact — self |
| `tests/components/profile/ProfileTabs.test.tsx` | test | unit assertion | itself (Phase 14) | exact — self |
| `tests/components/watch/WatchForm.test.tsx` | test | unit assertion | itself (Phase 19.1 + TEST-06) | exact — self |
| `tests/components/watch/AddWatchFlow.test.tsx` (NEW) | test | unit assertion | `tests/components/layout/UserMenu.test.tsx` + `tests/components/watch/WatchForm.test.tsx` | role-match (mock scaffold pattern) |

---

## Pattern Assignments

### 1. `src/components/layout/UserMenu.tsx` — NAV-16 deletion

**Analog:** itself, `src/components/layout/UserMenu.tsx` (Phase 25 canonical state)

**Imports pattern (preserved verbatim, lines 1-15):**
```tsx
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { logout } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { InlineThemeSegmented } from '@/components/layout/InlineThemeSegmented'
import { AvatarDisplay } from '@/components/profile/AvatarDisplay'
```

**Locked dropdown shell (preserved verbatim, lines 61-67):**
```tsx
const dropdownContent = (
  <DropdownMenuContent align="end" className="w-64">
    <DropdownMenuGroup>
      <DropdownMenuLabel className="font-normal">
        <div className="text-xs text-muted-foreground">Signed in as</div>
        <div className="truncate text-sm">{user.email}</div>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
```

**Core pattern — deletion site (lines 69-73, the only change):**

BEFORE (current file lines 67-74):
```tsx
        <DropdownMenuSeparator />
        {username && (
          <DropdownMenuItem
            render={<Link href={`/u/${username}/collection`}>Profile</Link>}
          />
        )}
        <DropdownMenuItem render={<Link href="/settings">Settings</Link>} />
        <DropdownMenuSeparator />
```

AFTER (post-NAV-16 — 4 lines removed; both surrounding separators preserved per UI-SPEC D-01 wording precision):
```tsx
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/settings">Settings</Link>} />
        <DropdownMenuSeparator />
```

**Untouched after deletion:**
- Theme block (lines 76-79): `<div className="px-2 py-1.5">…</div>`
- Final `<DropdownMenuSeparator />` (line 80)
- Sign out form-button (lines 81-92)
- `!user` Sign in branch (lines 50-56)
- `!username` chevron-only branch (lines 97-112)
- Dual-affordance avatar Link + chevron (lines 114-145)

---

### 2. `src/components/profile/ProfileTabs.tsx` — PROF-10 className append

**Analog:** itself, `src/components/profile/ProfileTabs.tsx` (Phase 14/18 canonical state)

**Imports pattern (preserved verbatim, lines 1-5):**
```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
```

**Core pattern — className append on the TabsList (line 65, the only change):**

BEFORE (current file lines 63-66):
```tsx
      <TabsList
        variant="line"
        className="w-full justify-start gap-2 overflow-x-auto"
      >
```

AFTER (per CONTEXT D-06/D-07/D-08 — locked literal):
```tsx
      <TabsList
        variant="line"
        className="w-full justify-start gap-2 overflow-x-auto overflow-y-hidden pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
```

**Class additions (4 utilities, locked):**
- `overflow-y-hidden` — clip the active-tab indicator's `bottom: -5px` overshoot (D-06)
- `pb-2` — pull the indicator inside the clip box (D-07)
- `[scrollbar-width:none]` — hide horizontal scrollbar in Firefox (D-08)
- `[&::-webkit-scrollbar]:hidden` — hide horizontal scrollbar in WebKit (D-08)

**Untouched after append:**
- Tab list rendering loop (lines 67-77)
- `BASE_TABS`, `COMMON_GROUND_TAB`, `OWNER_INSIGHTS_TAB` constants (lines 7-26)
- `pathname.endsWith('/${t.id}')` activeTab logic (line 59)
- `src/components/ui/tabs.tsx` (READ-ONLY per D-09)

---

### 3. `src/app/watch/new/page.tsx` — FORM-04 nonce generation

**Analog:** itself, `src/app/watch/new/page.tsx` (Phase 20.1 + Phase 28 canonical state)

**Imports pattern (preserved verbatim, lines 1-10):**
```tsx
import { redirect } from 'next/navigation'

import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
import { getWatchesByUser } from '@/data/watches'
import { getCatalogById } from '@/data/catalog'
import { getProfileById } from '@/data/profiles'
import { AddWatchFlow } from '@/components/watch/AddWatchFlow'
import { validateReturnTo } from '@/lib/watchFlow/destinations'
import type { ExtractedWatchData } from '@/lib/extractors'
import type { MovementType, CrystalType } from '@/lib/types'
```

**Auth/searchParams pattern (preserved verbatim, lines 44-95):** The page is already dynamic via `await searchParams` — RESEARCH explicitly verifies this at Pattern 3 / Pitfall 2. No `connection()` ceremony needed; `crypto.randomUUID()` runs at request time without additional imports.

**Core pattern — insert per-request nonce + thread as `key` prop (the only change):**

BEFORE (current lines 90-114):
```tsx
  const [collection, catalogPrefill, viewerProfile] = await Promise.all([
    getWatchesByUser(user.id),
    catalogId ? hydrateCatalogPrefill(catalogId) : Promise.resolve(null),
    getProfileById(user.id),
  ])
  const viewerUsername = viewerProfile?.username ?? null

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="font-serif text-3xl md:text-4xl text-foreground mb-8">
        Add a watch — or just evaluate one
      </h1>
      <AddWatchFlow
        collectionRevision={collection.length}
        initialCatalogId={catalogId}
        initialIntent={initialIntent}
        initialCatalogPrefill={catalogPrefill}
        initialManual={initialManual}
        initialStatus={initialStatus}
        initialReturnTo={initialReturnTo}
        viewerUsername={viewerUsername}
      />
    </div>
  )
}
```

AFTER (per CONTEXT D-12 / RESEARCH Pattern 3 — minimal diff, two lines added):
```tsx
  const [collection, catalogPrefill, viewerProfile] = await Promise.all([
    getWatchesByUser(user.id),
    catalogId ? hydrateCatalogPrefill(catalogId) : Promise.resolve(null),
    getProfileById(user.id),
  ])
  const viewerUsername = viewerProfile?.username ?? null

  // FORM-04 — per-request nonce as React key on AddWatchFlow. Forces remount
  // on every entry to /watch/new (CONTEXT D-12, D-13). Safe to call here
  // because the page is already dynamic via the await searchParams above
  // (Request-time API). DO NOT add 'use cache' to this file; the nonce must
  // be per-request, not per-build (RESEARCH Pitfall 2).
  const flowKey = crypto.randomUUID()

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="font-serif text-3xl md:text-4xl text-foreground mb-8">
        Add a watch — or just evaluate one
      </h1>
      <AddWatchFlow
        key={flowKey}
        collectionRevision={collection.length}
        initialCatalogId={catalogId}
        initialIntent={initialIntent}
        initialCatalogPrefill={catalogPrefill}
        initialManual={initialManual}
        initialStatus={initialStatus}
        initialReturnTo={initialReturnTo}
        viewerUsername={viewerUsername}
      />
    </div>
  )
}
```

**Pitfall guards (per RESEARCH Pitfalls 2 + 4):**
- Inline source comment forbidding `'use cache'`.
- `key` MUST appear at JSX level, NOT inside a spread (Pitfall 8 also applies in tests).

---

### 4. `src/components/watch/AddWatchFlow.tsx` — FORM-04 cleanup-on-hide + commit reset

**Analog:** itself, `src/components/watch/AddWatchFlow.tsx` (Phase 20.1 + Phase 28 canonical state)

**Imports pattern — extend with `useLayoutEffect` (line 3):**

BEFORE:
```tsx
import { useCallback, useEffect, useState, useTransition } from 'react'
```

AFTER:
```tsx
import { useCallback, useEffect, useLayoutEffect, useState, useTransition } from 'react'
```

**Core state declarations (preserved verbatim, lines 110-114):**
```tsx
const [state, setState] = useState<FlowState>(initialState)
const [url, setUrl] = useState('')
const [, startTransition] = useTransition()
const [rail, setRail] = useState<RailEntry[]>([])
const cache = useWatchSearchVerdictCache(collectionRevision)
```

**Existing useEffect for idle-focus (preserved, lines 122-127 — anchor for placement):**
```tsx
useEffect(() => {
  if (state.kind === 'idle') {
    const el = document.getElementById('paste-url') as HTMLInputElement | null
    el?.focus()
  }
}, [state.kind])
```

**Pattern A — Activity-hide cleanup (NEW, per CONTEXT D-14 + RESEARCH Pattern 4):** Insert immediately after the existing useEffect block (~line 128):

```tsx
// FORM-04 — Activity-hide reset (back-button defense). When the user
// navigates AWAY from /watch/new, Next.js's <Activity> wrapper sets this
// route's mode to "hidden". React runs effect cleanup at that boundary
// (per node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md).
// This cleanup resets local state to idle so when the user later navigates
// BACK (within the 3-route Activity window), the un-hidden tree is already
// fresh — even though the Server Component does NOT re-run on back-nav and
// the `key` prop value is therefore unchanged.
useLayoutEffect(() => {
  return () => {
    setState({ kind: 'idle' })
    setUrl('')
    setRail([])
  }
}, [])
```

**Pattern B — handleWishlistConfirm reset before router.push (per CONTEXT D-14, optional defense-in-depth):** Anchor at lines 296-324 (the success branch of `handleWishlistConfirm`). The current code already calls `router.push(dest)` (line 323) without resetting state — Phase 28 D-15 explicitly noted "setUrl + setState({kind:'idle'}) intentionally NOT called — mid-nav unmount handles cleanup." Phase 29 promotes this to "should reset on commit success because Activity preserves state on nav-away." Insert reset BEFORE the `router.push(dest)` call:

BEFORE (lines 318-324, success branch tail):
```tsx
      // Phase 28 D-15 — REMOVED router.refresh().
      // Verified safe: /u/[username]/[tab]/page.tsx is a Server Component
      // that re-fetches getWatchesByUser(profile.id) on every render. The
      // next visit to /watch/new will compute collectionRevision fresh.
      router.push(dest)
      // setUrl + setState({kind:'idle'}) intentionally NOT called — mid-nav unmount handles cleanup.
```

AFTER (Phase 29 — reset BEFORE router.push for defense-in-depth):
```tsx
      // Phase 28 D-15 — REMOVED router.refresh().
      // Verified safe: /u/[username]/[tab]/page.tsx is a Server Component
      // that re-fetches getWatchesByUser(profile.id) on every render. The
      // next visit to /watch/new will compute collectionRevision fresh.
      //
      // Phase 29 FORM-04 D-14 — defense-in-depth state reset BEFORE router.push.
      // Activity preserves React state across navigation; without this reset,
      // a return visit to /watch/new (within the 3-route Activity window)
      // could briefly paint stale state before the useLayoutEffect cleanup
      // resolves. The key prop on <AddWatchFlow> is the primary fix; this
      // reset closes the post-commit gap.
      setUrl('')
      setRail([])
      setState({ kind: 'idle' })
      router.push(dest)
```

**Note on prop-derived initialState (RESEARCH A2):** Cleanup resets to literal `{ kind: 'idle' }`, not the prop-derived `initialState`. The Plan should add a UAT step verifying that `?catalogId=X&intent=owned` deep-link → navigate-away → back behavior is acceptable (likely yes — back-nav from another route loses the deep-link context anyway).

**Untouched:**
- Existing `useEffect` for paste-url focus (lines 122-127)
- All FlowState transitions (lines 137-389)
- All render branches (lines 393-528)
- `useWatchSearchVerdictCache(collectionRevision)` at line 114 — RESEARCH Pitfall 3 / CONTEXT D-15: planner picks hoisting strategy. Three options:
  - **(A)** Hoist via Client wrapper (`AddWatchFlowShell`) above the `key` boundary
  - **(B)** Accept the reset (cache is fast to repopulate via `collectionRevision`-keyed re-fetch)
  - **(C)** Move into a React Context provider higher in the tree
  - **Recommendation per RESEARCH:** Option (A); Option (B) acceptable if Phase 20 D-06 tests pass.

---

### 5. `tests/components/layout/UserMenu.test.tsx` — Tests 3 + 4 update (NAV-16)

**Analog:** itself, `tests/components/layout/UserMenu.test.tsx` (Phase 25)

**Mock scaffold (preserved verbatim, lines 10-44):** The dropdown-menu / auth / theme-segmented mocks at the top of the file are reused; no changes.

**Test 3 rewrite (lines 75-89, per CONTEXT D-05):**

BEFORE:
```tsx
it('Test 3 — dropdown contains all sections in order: Email / Profile / Settings / Theme / Sign out', () => {
  render(<UserMenu {...aliceProps} />)
  const content = screen.getByTestId('dropdown-content')
  const text = content.textContent ?? ''
  const emailIdx = text.indexOf('alice@example.com')
  const profileIdx = text.indexOf('Profile')
  const settingsIdx = text.indexOf('Settings')
  const themeIdx = text.indexOf('Theme')
  const signOutIdx = text.indexOf('Sign out')
  expect(emailIdx).toBeGreaterThanOrEqual(0)
  expect(profileIdx).toBeGreaterThan(emailIdx)
  expect(settingsIdx).toBeGreaterThan(profileIdx)
  expect(themeIdx).toBeGreaterThan(settingsIdx)
  expect(signOutIdx).toBeGreaterThan(themeIdx)
})
```

AFTER (drop the profileIdx assertion; assert Settings sits directly after the email label):
```tsx
it('Test 3 — dropdown contains all sections in order: Email / Settings / Theme / Sign out (NAV-16)', () => {
  render(<UserMenu {...aliceProps} />)
  const content = screen.getByTestId('dropdown-content')
  const text = content.textContent ?? ''
  const emailIdx = text.indexOf('alice@example.com')
  const settingsIdx = text.indexOf('Settings')
  const themeIdx = text.indexOf('Theme')
  const signOutIdx = text.indexOf('Sign out')
  expect(emailIdx).toBeGreaterThanOrEqual(0)
  expect(settingsIdx).toBeGreaterThan(emailIdx)
  expect(themeIdx).toBeGreaterThan(settingsIdx)
  expect(signOutIdx).toBeGreaterThan(themeIdx)
  // NAV-16: Profile row removed; assertion is no longer present.
  expect(text).not.toMatch(/Profile/)
})
```

**Test 4 deletion (lines 91-98, per CONTEXT D-05):** DELETE entirely. Test 9 (originally numbered Test 5 in CONTEXT/RESEARCH — actual file line 126-147) already contains `expect(screen.queryByRole('link', { name: /^profile$/i })).toBeNull()` which now passes for ALL branches (no longer username-conditional).

**Test 9 (preserved — already correct per RESEARCH Pitfall 6):** No changes; the existing `queryByRole('link', { name: /^profile$/i })).toBeNull()` assertion is now globally true.

---

### 6. `tests/components/profile/ProfileTabs.test.tsx` — className assertion (PROF-10)

**Analog:** itself, `tests/components/profile/ProfileTabs.test.tsx` (Phase 14)

**Mock scaffold (preserved verbatim, lines 1-8):**
```tsx
import { render } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: () => '/u/tyler/collection',
}))

import { ProfileTabs } from '@/components/profile/ProfileTabs'
```

**Existing 7 tests (lines 12-117):** Preserved verbatim. The tab-rendering / Insights-gate / Common-Ground tests all assert structural shape, not className — they continue to pass post-PROF-10.

**Test pattern — NEW className assertion (per CONTEXT D-11):** Append after the existing describe block. Use `container.querySelector` to find the TabsList (the only direct child wrapping `[data-tab-id]` elements; the test file already uses `container.querySelector('[data-tab-id="…"]')` patterns at lines 18, 33, 45, 67):

```tsx
describe('ProfileTabs — PROF-10 horizontal-only scroll className override', () => {
  it('TabsList has overflow-x-auto AND overflow-y-hidden + scrollbar-hiding utilities + pb-2', () => {
    const { container } = render(<ProfileTabs username="tyler" />)
    // The TabsList is the parent of all [data-tab-id] triggers.
    const firstTrigger = container.querySelector('[data-tab-id]')
    const tabsList = firstTrigger?.parentElement
    expect(tabsList).toBeTruthy()
    const cls = tabsList!.className
    // Preserved utilities (Phase 14 lock):
    expect(cls).toContain('w-full')
    expect(cls).toContain('justify-start')
    expect(cls).toContain('gap-2')
    expect(cls).toContain('overflow-x-auto')
    // PROF-10 additions (CONTEXT D-06/D-07/D-08):
    expect(cls).toContain('overflow-y-hidden')
    expect(cls).toContain('pb-2')
    expect(cls).toContain('[scrollbar-width:none]')
    expect(cls).toContain('[&::-webkit-scrollbar]:hidden')
  })
})
```

---

### 7. `tests/components/watch/WatchForm.test.tsx` — reset-on-key-change extension (FORM-04)

**Analog:** itself, `tests/components/watch/WatchForm.test.tsx` (Phase 19.1 + TEST-06 — full mock scaffold at lines 14-89)

**Mock scaffold (preserved verbatim, lines 14-89):** All Server Action mocks (`addWatch`, `editWatch`), Supabase mock, `useRouter` mock, `CatalogPhotoUploader` mock, `UrlImport` mock, and `uploadCatalogSourcePhoto` mock are reused.

**Test pattern — NEW reset-on-key-change test (per CONTEXT D-19):** Append after the TEST-06 `describe` block (line 233). Mirror the existing TEST-06 `userEvent.setup()` pattern (line 173-184 — happy-path submit), but use RTL's `rerender` API:

```tsx
describe('WatchForm — FORM-04 reset on parent key change (CONTEXT D-19)', () => {
  it('formData returns to initialFormData defaults after re-mount with a new key', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<WatchForm key="a" mode="create" />)

    // Type into brand + model — formData is now non-default.
    await user.type(screen.getByLabelText(/brand/i), 'Omega')
    await user.type(screen.getByLabelText(/^model/i), 'Speedmaster')
    expect(screen.getByLabelText(/brand/i)).toHaveValue('Omega')
    expect(screen.getByLabelText(/^model/i)).toHaveValue('Speedmaster')

    // Re-mount via key change (Pitfall 8: key MUST be at JSX level, NOT in spread).
    rerender(<WatchForm key="b" mode="create" />)

    // After remount, useState lazy-initializer runs again; formData = initialFormData.
    expect(screen.getByLabelText(/brand/i)).toHaveValue('')
    expect(screen.getByLabelText(/^model/i)).toHaveValue('')
  })
})
```

---

### 8. `tests/components/watch/AddWatchFlow.test.tsx` — NEW Wave 0 file (FORM-04)

**Analog (NEW file — mirror two test files):**
- **Mock + describe scaffold:** `tests/components/layout/UserMenu.test.tsx` (lines 1-44) for `vi.mock` patterns
- **userEvent + rerender pattern:** `tests/components/watch/WatchForm.test.tsx` (lines 14-66 mock setup + lines 171-184 happy-path)

**Imports + mock scaffold (per RESEARCH Code Examples + analog mocks):**
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// next/navigation — AddWatchFlow calls useRouter().push.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

// Server Actions — minimal stubs; FORM-04 tests don't exercise the commit path.
vi.mock('@/app/actions/verdict', () => ({
  getVerdictForCatalogWatch: vi.fn(),
}))
vi.mock('@/app/actions/watches', () => ({
  addWatch: vi.fn(),
}))

// sonner toast — AddWatchFlow imports `toast` for commit-success surface.
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// Import AFTER mocks.
import { AddWatchFlow } from '@/components/watch/AddWatchFlow'
```

**baseProps fixture:**
```tsx
const baseProps = {
  collectionRevision: 0,                           // empty collection — short-circuits verdict compute
  initialCatalogId: null,
  initialIntent: null as 'owned' | null,
  initialCatalogPrefill: null,
  initialManual: false,
  initialStatus: null as 'wishlist' | null,
  initialReturnTo: null,
  viewerUsername: 'tyler',
}
```

**Test 1 — key-change resets paste URL (CONTEXT D-19, RESEARCH Pitfall 8):**
```tsx
describe('AddWatchFlow — FORM-04 key-change remount (CONTEXT D-19)', () => {
  it('resets paste URL when key prop changes', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<AddWatchFlow key="a" {...baseProps} />)

    const urlInput = screen.getByPlaceholderText(/paste a product page URL/i) as HTMLInputElement
    await user.type(urlInput, 'https://example.com/watch')
    expect(urlInput.value).toBe('https://example.com/watch')

    // Pitfall 8: key MUST be explicit at JSX level, NOT inside object spread.
    rerender(<AddWatchFlow key="b" {...baseProps} />)

    const urlInputAfter = screen.getByPlaceholderText(/paste a product page URL/i) as HTMLInputElement
    expect(urlInputAfter.value).toBe('')
  })
})
```

**Test 2 — useLayoutEffect cleanup resets state on unmount (CONTEXT D-14, RESEARCH Pattern 4):**
```tsx
describe('AddWatchFlow — FORM-04 useLayoutEffect cleanup-on-hide (CONTEXT D-14)', () => {
  it('cleanup runs on unmount (sanity that no error is thrown)', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<AddWatchFlow key="a" {...baseProps} />)

    // Type into paste URL to make state non-default.
    const urlInput = screen.getByPlaceholderText(/paste a product page URL/i) as HTMLInputElement
    await user.type(urlInput, 'https://example.com/watch')

    // Unmount — useLayoutEffect cleanup runs synchronously.
    expect(() => unmount()).not.toThrow()
  })
})
```

**Note on RESEARCH A1:** jsdom-rendered cleanup runs synchronously when RTL `unmount()` is called, mirroring Activity-hide cleanup behavior closely enough for unit-test parity. The "navigate-and-back" assertion is manual UAT only (CONTEXT D-19).

**Untouched in this NEW file:**
- No commit-path tests (RESEARCH Pitfall 5: jsdom doesn't simulate Activity)
- No verdict-cache survival tests (covered by existing Phase 20 D-06 tests; planner verifies separately)

---

## Shared Patterns

### Vitest + RTL + next/navigation mock scaffold

**Source:** `tests/components/layout/UserMenu.test.tsx:1-44` and `tests/components/watch/WatchForm.test.tsx:14-66`

**Apply to:** `tests/components/watch/AddWatchFlow.test.tsx` (NEW)

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

// Component-specific Server Action mocks here…

import { ComponentUnderTest } from '@/components/…'
```

### RTL `rerender` for key-change remount tests

**Source:** RESEARCH Pitfall 8 + Code Examples lines 605-617

**Apply to:** Both `tests/components/watch/AddWatchFlow.test.tsx` (NEW) and `tests/components/watch/WatchForm.test.tsx` (extension)

```tsx
const { rerender } = render(<Component key="a" {...baseProps} />)
// …mutate state via user interaction…
rerender(<Component key="b" {...baseProps} />)   // NOT inside spread — see Pitfall 8
// …assert state was reset…
```

### Tailwind 4 arbitrary-variant utilities

**Source:** RESEARCH Pattern 2 + CONTEXT D-08

**Apply to:** `src/components/profile/ProfileTabs.tsx` (PROF-10) — first introduction in this codebase per RESEARCH grep verification

```
[scrollbar-width:none]            // Firefox: scrollbar-width: none
[&::-webkit-scrollbar]:hidden     // WebKit/Blink: ::-webkit-scrollbar { display: none }
```

### `crypto.randomUUID()` in dynamic Server Component

**Source:** RESEARCH Pattern 3 / `node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md`

**Apply to:** `src/app/watch/new/page.tsx` (FORM-04)

The page is already dynamic via `await searchParams` (Request-time API), so `crypto.randomUUID()` runs per-request without `connection()` ceremony. A guard comment forbids future `'use cache'` addition.

### `useLayoutEffect` cleanup for Activity-hide reset

**Source:** RESEARCH Pattern 4 / `node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md`

**Apply to:** `src/components/watch/AddWatchFlow.tsx` (FORM-04 back-nav defense)

Cleanup runs synchronously when React's `<Activity>` transitions the route to `mode="hidden"`. The empty dependency array means the cleanup fires on unmount/hide only, not on every state change.

---

## No Analog Found

**None.** Every Phase 29 file has an exact-match canonical analog (in most cases the file itself, since these are surgical edits to mature surfaces). The one NEW file (`tests/components/watch/AddWatchFlow.test.tsx`) has two strong sibling test analogs whose mock scaffolds compose cleanly into the new test file.

---

## Metadata

**Analog search scope:**
- `src/components/layout/` — UserMenu canonical
- `src/components/profile/` — ProfileTabs canonical
- `src/components/watch/` — AddWatchFlow + WatchForm canonical
- `src/app/watch/new/` — page Server Component canonical
- `src/components/search/useWatchSearchVerdictCache.ts` — cache hoist target (READ-ONLY ref)
- `src/components/ui/dropdown-menu.tsx`, `src/components/ui/tabs.tsx` — locked primitives (READ-ONLY refs, NOT modified)
- `tests/components/layout/UserMenu.test.tsx` — mock scaffold analog
- `tests/components/profile/ProfileTabs.test.tsx` — sibling test pattern
- `tests/components/watch/WatchForm.test.tsx` — userEvent + rerender pattern + sibling Server Action mocks

**Files scanned:** 9 source files + 4 test files + 2 RESEARCH/UI-SPEC documents

**Pattern extraction date:** 2026-05-05

**Key insight:** Phase 29 is a "self-analog" phase. The patterns aren't copied from a different file in the codebase — they are surgical extensions of the file's own established shape. The job of this map is to pin down EXACTLY which lines to delete, append, and insert, and (for the one new file) which two existing test files to compose mocks from. Every excerpt above includes the specific line numbers in the canonical file so the planner can reference them directly in PLAN.md actions.
