# Phase 29: Nav & Profile Chrome Cleanup — Research

**Researched:** 2026-05-05
**Domain:** Next.js 16 App Router state hygiene + Tailwind 4 utilities + Vitest/RTL component tests
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### NAV-16 — UserMenu Profile Row Removal

- **D-01:** Delete the `Profile` `<DropdownMenuItem>` at `UserMenu.tsx:69-73` AND the trailing `<DropdownMenuSeparator />` at line 75 that precedes Settings (the separator only existed to bracket Profile from Settings; with Profile gone, Settings can sit immediately under the email label). Theme block keeps its enclosing separators (lines 75 + 80). Sign out keeps its preceding separator (line 80). Net change: dropdown order becomes email-label → Settings → Theme → Sign out. No restructuring beyond the deletion.

  **NOTE per UI-SPEC § Visual Diff Contract — NAV-16 D-01 wording precision:** Reading the actual source, line 68 is the separator between email-label and Profile; line 75 is the separator between Settings and the Theme block. Both separators serve a purpose AFTER deletion (line 68: separates email/identity from action items; line 75: brackets the Theme block). The planner should preserve BOTH separators and delete only the Profile DropdownMenuItem block at lines 69-73. Asserted dropdown order in tests: email-label → Separator → Settings → Separator → Theme → Separator → Sign out.

- **D-02:** Phase 25 D-04 lock ("dropdown content byte-identical to pre-Phase-25") is EXPLICITLY relaxed for NAV-16. The relaxation is scoped to: (a) Profile row removal and (b) the orphaned separator collapse. Settings, Theme, Sign out remain byte-identical to pre-Phase-25.
- **D-03:** "No username" edge-case branch (`UserMenu.tsx:97-112`, the chevron-only DropdownMenu) is UNCHANGED. The Profile row was already conditionally hidden via `{username && ...}`; deleting the wrapped block is a no-op for this branch's render tree.
- **D-04:** Existing `aria-label="Go to ${username}'s profile"` on the avatar Link (line 119) is sufficient assistive-tech coverage. No additional sr-only label, no menu-item-replacement needed.
- **D-05:** Update `tests/components/layout/UserMenu.test.tsx`:
  - Test 3 ("dropdown contains all sections in order: Email / Profile / Settings / Theme / Sign out") → rewrite to assert email-label → Settings → Theme → Sign out (drop the `profileIdx` assertion).
  - Test 4 ("Profile dropdown item links to /u/${username}/collection") → DELETE entirely. The avatar Link assertion in Test 2 already covers this navigation path.
  - Test 5 ("null-username branch") — verify the existing assertion `Profile dropdown item is also NOT rendered when username is null` still passes (it should; the row is now never rendered regardless of username).

#### PROF-10 — Profile Tab Strip Horizontal-Only Scroll

- **D-06:** CSS technique = add `overflow-y-hidden` alongside the existing `overflow-x-auto` on `ProfileTabs.tsx:65`. Most surgical fix; preserves focus rings (which are inside the box, not below it). Final className for the TabsList: `w-full justify-start gap-2 overflow-x-auto overflow-y-hidden pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`.
- **D-07:** Indicator clip mitigation = add `pb-2` (8px padding-bottom) to the same TabsList className. The TabsTrigger active-line pseudo-element at `tabs.tsx:64` (`after:bottom-[-5px]`) is 5px below the trigger's content box; with `pb-2` on the TabsList, the indicator falls inside the TabsList's clip region.
- **D-08:** Hide the horizontal scrollbar visually. Use `[scrollbar-width:none]` (Firefox) and `[&::-webkit-scrollbar]:hidden` (WebKit). Tab strip is still scrollable via touch/drag, arrow-key focus traversal (TabsTrigger handles this), and trackpad two-finger horizontal swipe.
- **D-09:** Fix scope = `ProfileTabs.tsx` ONLY. Do NOT modify `tabsListVariants` in `src/components/ui/tabs.tsx`. Rationale: (a) `/settings` mounts the TabsList in vertical orientation; (b) `/search` 4-tab TabsList has different overflow concerns. One-off className override is the right boundary.
- **D-10:** Vertical-scroll-gesture passthrough — when the user touches the tab strip with vertical intent, the gesture must pass through to the page-level scroll. With `overflow-y: hidden` (NOT `auto`/`scroll`), the browser does not consume the vertical axis; gesture bubbles up. No `overscroll-behavior` needed.
- **D-11:** Update `tests/components/profile/ProfileTabs.test.tsx`: assert the rendered TabsList has `overflow-x-auto` AND `overflow-y-hidden` classes (className inspection is reliable in JSDOM). The vertical-scroll-passthrough behavior is a manual UAT gate.

#### FORM-04 — Add-Watch Flow Reset on Every Entry

- **D-12:** Force a fresh React tree mount on every entry to `/watch/new` via a `key` prop on `<AddWatchFlow>`. Planner picks the source: most likely a server-generated per-request nonce (e.g., `crypto.randomUUID()` in the `/watch/new` page Server Component) passed as `<AddWatchFlow key={nonce}>`. Each navigation to the page generates a fresh nonce → fresh component tree → useState lazy-initializers run again → AddWatchFlow + WatchForm both remount.
- **D-13:** The key approach is the PRIMARY fix. It addresses ALL trigger paths the user named:
  - Browser back/forward (Next.js client cache replay)
  - Refresh
  - Click an "Add Watch" CTA from anywhere
  - Post-commit re-navigation
- **D-14:** Defense-in-depth: AddWatchFlow's commit handlers reset state right before calling `router.push(returnTo ?? default)`.
- **D-15:** Reset scope:
  - **AddWatchFlow.tsx** — `state` (FlowState), `url` paste-input, `rail` (RecentlyEvaluatedRail entries) ALL reset.
  - **WatchForm.tsx** — `formData` (line 101), `photoBlob` (line 98), `photoError` (line 99), `errors` (line 136) ALL reset to defaults via remount.
  - **NOT reset** — `useWatchSearchVerdictCache` (line 114). It's keyed on `collectionRevision` and is intentionally cross-session. Planner confirms the cache is hoisted above the `key` boundary so it survives the AddWatchFlow remount.
- **D-16:** URL params still drive initial state. The page Server Component's existing logic at `src/app/watch/new/page.tsx:53-77` is UNCHANGED. AddWatchFlow's `initialState` derivation at lines 103-108 stays — what changes is that the `key` prop forces this derivation to actually run on every entry.
- **D-17:** Skip / in-flow Cancel / WishlistRationalePanel Cancel paths are UNCHANGED.
- **D-18:** No client storage involved. The fix is at the React tree boundary (`key` prop), not at a storage layer.
- **D-19:** Tests for FORM-04:
  - Render `<AddWatchFlow key="a" .../>`, type into the paste URL input, transition to verdict-ready, then re-render with `key="b"`. Assert paste URL is empty AND `state.kind === 'idle'`.
  - Render `<WatchForm watch={null} mode="create" .../>`, type into brand/model fields, then re-mount with a new key. Assert `formData` returned to `initialFormData`.
  - Manual UAT: navigate `/watch/new` → paste URL → verdict ready → `router.push('/u/{username}/collection')` (or browser back) → click "Add Watch" CTA → assert paste URL is empty.

### Claude's Discretion

- **Exact technique for the per-navigation key (D-12)** — `crypto.randomUUID()` in the page Server Component is the simplest; alternatives include a request-id from headers, a hash of `searchParams`, or a Suspense-keyed boundary. Planner picks based on Next.js 16 Cache Components compatibility.
- **`useWatchSearchVerdictCache` hoisting strategy (D-15)** — planner decides whether to hoist the cache hook above the `key` boundary OR let it remount and rely on collectionRevision-keyed re-fetch. Contract: "cache survives entry."
- **Whether to drop the explicit reset-on-commit (D-14)** — if the `key` prop alone proves sufficient, the reset-on-commit is redundant. Planner verifies.
- **Test technique for PROF-10 (D-11)** — JSDOM className assertion is reliable; planner picks.
- **Whether to ship a TabsList-level fix to the shared primitive in a future phase** — D-09 explicitly scopes Phase 29 to ProfileTabs only.

### Deferred Ideas (OUT OF SCOPE)

- Push PROF-10 fix into shared `tabsListVariants` primitive — deferred to v5.0+.
- Browser autofill on WatchForm fields — out of scope; separate follow-up fix.
- `useWatchSearchVerdictCache` migration to a true cross-route cache — deferred to v5.0+.
- `pageshow` event listener for Safari bfcache — not needed (key approach suffices).
- Settings menu reordering / new affordance after Profile removal — out of scope.
- Test the touch-gesture passthrough on PROF-10 — manual UAT only.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **NAV-16** | Remove the redundant Profile link from the UserMenu dropdown. Phase 25 made avatar→profile the primary path; the dropdown row is now duplicate. UserMenu retains Settings, Theme segmented, and Sign out. | Pattern 1 (DropdownMenuItem deletion); Existing test fixture map at `tests/components/layout/UserMenu.test.tsx`; UI-SPEC delta clarification (preserve BOTH surrounding separators). |
| **PROF-10** | Profile tab strip on `/u/[username]` scrolls only horizontally; vertical scroll is disabled. | Pattern 2 (Tailwind 4 arbitrary-variant scrollbar utilities); Verified className override is locked-literal `w-full justify-start gap-2 overflow-x-auto overflow-y-hidden pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`. |
| **FORM-04** | Every entry to `/watch/new` renders the Add-Watch flow in a fresh state. AddWatchFlow's `state`, `url`, and `rail` reset; WatchForm's `formData`, `photoBlob`, `photoError`, and `errors` reset. Within-flow Skip/Cancel paths and verdict cache are NOT affected. | Pattern 3 (per-navigation `key` prop in Server Component, post-`searchParams` await — already dynamic, no `connection()` needed); Pattern 4 (Cache Hoisting); Pitfall 1 (Activity preserves state across nav — `key` forces React to discard the preserved tree); Pitfall 4 (browser-back interaction with Activity). |
</phase_requirements>

## Summary

Phase 29 is a chrome-cleanup phase with three surgical fixes that fall into three small but distinct technical domains:

1. **NAV-16** is a literal DOM-shape edit (delete one DropdownMenuItem block, fix two unit tests). Zero technical risk; the only nuance is the UI-SPEC's explicit override of CONTEXT D-01's "trailing separator collapse" wording — both separators around the deleted Profile row stay because they bracket the email label and the Theme block respectively.

2. **PROF-10** is a four-utility className append on `ProfileTabs.tsx:65`. The Tailwind 4 arbitrary-variant utilities (`[scrollbar-width:none]`, `[&::-webkit-scrollbar]:hidden`) are NOT currently used elsewhere in the codebase (verified via grep) — Phase 29 introduces this pattern for the first time. They are stock Tailwind 4 patterns that compile to standard CSS.

3. **FORM-04** is the only domain with non-trivial Next.js 16 considerations. The bug surfaces because Next.js 16 `cacheComponents: true` (verified enabled at `next.config.ts:11`) preserves React state across client-side navigations via React's `<Activity>` mode (preserves up to 3 routes). The user's chosen fix — server-generated `crypto.randomUUID()` as a `key` prop on `<AddWatchFlow>` — works for **forward navigations** to `/watch/new` (each fresh nav re-runs the Server Component, generates a new nonce, mounts a new tree). The page is already dynamically rendered (it `await`s `searchParams`, a Request-time API), so `crypto.randomUUID()` does NOT require `connection()` and does NOT bust any cache (the page is not cached).

   **However:** `<Activity>` preservation creates an asymmetry the planner must explicitly address: when the user navigates BACK to `/watch/new` from a recent route in Activity-preserved history (≤3 routes back), the Server Component does NOT re-run — the existing React tree is un-hidden. The `key` prop value will be the SAME as it was when the user left, so the tree is NOT remounted. **The plan must include a complementary `useLayoutEffect` cleanup-on-hide reset** (the canonical Next.js 16 pattern documented in `node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md`) to cover the back-navigation case. CONTEXT D-14's "defense-in-depth reset on commit" is necessary but not sufficient on its own; the cleanup-on-hide closes the back-button gap.

**Primary recommendation:** Combine three layers — (1) per-request `crypto.randomUUID()` server nonce as `<AddWatchFlow key={nonce}>` for forward navs and refreshes; (2) `useLayoutEffect` cleanup in AddWatchFlow + WatchForm to reset on Activity-hide for back-navigation; (3) explicit state reset in `handleWishlistConfirm` before `router.push` for defense-in-depth on the post-commit case.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Profile row deletion | Browser / Client | — | UserMenu is a Server Component but renders DropdownMenu primitives that hydrate client-side. Edit is a static JSX delete; tier ownership is "the consumer file." |
| TabsList overflow override | Browser / Client | — | ProfileTabs is `'use client'` (uses `usePathname`); the className override is a CSS-layer change executed in the browser. |
| Per-navigation key generation | Frontend Server (SSR) | Browser / Client | `crypto.randomUUID()` runs in the page Server Component (already dynamic via `await searchParams`). The Client Component (AddWatchFlow) consumes the key as a prop. |
| Activity-hide cleanup reset | Browser / Client | — | `useLayoutEffect` is React-DOM-only — runs entirely in the browser when Activity transitions the route to hidden. |
| Verdict cache survival across remounts | Browser / Client | — | `useWatchSearchVerdictCache` is a `useState`-based React hook in client space. The "hoisting strategy" decision is which Client Component owns the hook (it must be a parent that does NOT remount when AddWatchFlow remounts). |
| Test execution (Vitest + JSDOM) | Browser / Client (simulated) | — | All Phase 29 tests run under jsdom; no SSR test surface. |

## Project Constraints (from CLAUDE.md / AGENTS.md)

- **Next.js 16.2.3 — App Router only**: No `pages/` directory. Read `node_modules/next/dist/docs/` before assuming any API. AGENTS.md explicitly warns "This is NOT the Next.js you know" — Cache Components + Activity preservation are the breaking changes most relevant to FORM-04.
- **Tech stack lock**: TypeScript 5, React 19.2.4, Tailwind 4, shadcn (`base-nova` preset), Base UI primitives, Zustand stores. Phase 29 introduces zero new dependencies.
- **GSD Workflow Enforcement**: Edits must originate inside a GSD command (`/gsd-execute-phase` for this phase).
- **Path alias**: `@/*` → `./src/*`. Strict mode TypeScript.
- **Tests**: Vitest 2.1.9 + React Testing Library 16.3.2 + jsdom 25 (verified at `package.json` and `vitest.config.ts`). Run via `npm run test` (one-shot) or `npm run test:watch`.
- **`server-only` shim**: `tests/shims/server-only.ts` aliased in vitest config so server-only files can be unit-tested under jsdom (relevant if any FORM-04 unit test imports a Server Component directly).
- **Locked primitives** (per CONTEXT D-09 and Phase 25 D-01..D-04): `src/components/ui/tabs.tsx` and `src/components/ui/dropdown-menu.tsx` are READ-ONLY references. All edits live in consumer files.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.2.3 [VERIFIED: package.json:31] | App Router framework with `cacheComponents: true` (Activity-preservation) | Already locked; per CLAUDE.md no rewrites |
| React | 19.2.4 [VERIFIED: package.json:34] | Provides `<Activity>` primitive used by Next.js for route preservation; supports `useLayoutEffect` cleanup-on-hide pattern | Required by Next 16 |
| Tailwind CSS | 4.x [VERIFIED: package.json:64] via `@tailwindcss/postcss` ^4 | Arbitrary-variant utilities (`[scrollbar-width:none]`, `[&::-webkit-scrollbar]:hidden`) used in PROF-10 | Already locked |
| Vitest | 2.1.9 [VERIFIED: package.json:69] | Test runner (jsdom env) | Already locked |
| @testing-library/react | 16.3.2 [VERIFIED: package.json:55] | Component test driver; supports `rerender` API for FORM-04 key-change tests | Already locked |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@base-ui/react` | 1.3.0 [VERIFIED: package.json:21] | Underlying primitives for DropdownMenu and Tabs (locked, read-only this phase) | n/a — references only |
| `lucide-react` | 1.8.0 [VERIFIED: package.json:32] | `ChevronDown` icon retained in UserMenu | n/a — referenced only |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `crypto.randomUUID()` in Server Component for `key` | Hash of `searchParams` JSON | Hash collides across two visits with identical query strings (e.g., two clicks on the same Add-Watch CTA from /search) — fails CONTEXT D-13 "Click an Add Watch CTA from anywhere." UUID is collision-free per-request. |
| `crypto.randomUUID()` in Server Component | `headers().get('x-request-id')` | Requires deployment-platform header injection; not guaranteed in dev or self-hosted environments. UUID has zero infra dependency. |
| `crypto.randomUUID()` in Server Component | Move nonce to a Client Component layer | Would require `'use client'` boundary; loses the "single canonical key per server render" semantic. Not recommended. |
| `key` prop alone | `useLayoutEffect` cleanup-on-hide alone | `useLayoutEffect` cleanup is the canonical pattern for Activity-hide, but does NOT cover the case where the user clicks "Add Watch" from a totally different route after the page has been evicted (Activity preserves max 3 routes). Combining both is more robust. |
| `key` prop alone | `<form ref={(form) => () => form?.reset()}>` callback ref | Resets DOM input values only — does NOT reset React state (FlowState, photoBlob, errors). Insufficient on its own. |

**Installation:** None. Phase 29 introduces zero new packages.

**Version verification (already-installed):**
```bash
npm view next version    # confirmed 16.2.3 matches package.json
npm view tailwindcss version    # ^4 line — Phase 29 uses already-installed major
```
Skipped re-verification because no new packages are installed.

## Architecture Patterns

### System Architecture Diagram

```
                                  Phase 29 — three independent edit sites
                                  ─────────────────────────────────────────

  [User clicks UserMenu chevron]
              │
              ▼
  ┌────────────────────────┐
  │  UserMenu (Server)     │   NAV-16: delete Profile DropdownMenuItem
  │  layout/UserMenu.tsx   │ ───────────────────► render new dropdown
  └────────────────────────┘                        (one fewer row)


  [User scrolls profile tab strip]
              │
              ▼
  ┌────────────────────────┐
  │  ProfileTabs (Client)  │   PROF-10: append 4 utility classes
  │  profile/ProfileTabs   │ ───────────────────► browser CSS clip + hide scrollbar
  └────────────────────────┘                        (vertical-scroll passthrough)


  [User navigates to /watch/new]
              │
              ▼
  ┌────────────────────────────────────────────┐    FORM-04 critical path
  │  /watch/new/page.tsx (Server Component)    │
  │                                            │
  │  await searchParams  ───► dynamic render   │ ← already opted-in
  │  const nonce = crypto.randomUUID()         │ ← NEW per-request value
  │  return <AddWatchFlow key={nonce} ... />   │ ← REACT TREE BOUNDARY
  └────────────────────────────────────────────┘
                       │
                       ▼
       ┌────────────────────────────────┐
       │  AddWatchFlow (Client)         │
       │                                │
       │  ┌──────────────────────────┐  │
       │  │ useState(initialState)   │  │ ← runs on EVERY remount
       │  │ useState('') for url     │  │
       │  │ useState([]) for rail    │  │
       │  │ useLayoutEffect cleanup  │  │ ← resets state on Activity-hide
       │  │   (back-button defense)  │  │
       │  └──────────────────────────┘  │
       │                                │
       │  Verdict cache hoisted ABOVE   │ ← survives remount via parent
       │  the key boundary OR rebuilt   │   (Claude's Discretion D-15)
       │  via collectionRevision        │
       └────────────────────────────────┘
                       │
                       ▼
       ┌────────────────────────────────┐
       │  WatchForm (Client child)      │
       │  Re-mounts implicitly when     │ ← no direct edit needed
       │  AddWatchFlow's key changes    │
       └────────────────────────────────┘

  [Decision points]
   ── Forward navigation (CTA click, refresh): server runs, fresh nonce, mounted fresh
   ── Back navigation: server does NOT re-run, key unchanged → useLayoutEffect cleanup carries the reset
   ── Post-commit router.push: explicit state reset before push (defense-in-depth, D-14)
```

### Recommended Project Structure

No structural change. Phase 29 edits are confined to four existing files:

```
src/
├── app/
│   └── watch/
│       └── new/
│           └── page.tsx              ← FORM-04 nonce generation site
├── components/
│   ├── layout/
│   │   └── UserMenu.tsx              ← NAV-16 deletion site
│   ├── profile/
│   │   └── ProfileTabs.tsx           ← PROF-10 className override site
│   └── watch/
│       ├── AddWatchFlow.tsx          ← FORM-04 receives key, owns useLayoutEffect cleanup
│       └── WatchForm.tsx             ← (no direct edit — re-mounts via parent key)

tests/
├── components/
│   ├── layout/
│   │   └── UserMenu.test.tsx         ← NAV-16 test updates (Tests 3 + 4)
│   ├── profile/
│   │   └── ProfileTabs.test.tsx      ← PROF-10 className assertion (new test)
│   └── watch/
│       ├── AddWatchFlow.test.tsx     ← FORM-04 NEW test file (Wave 0)
│       └── WatchForm.test.tsx        ← FORM-04 add re-mount test
```

### Pattern 1: DropdownMenuItem deletion (NAV-16)

**What:** Remove a single `<DropdownMenuItem render={<Link ...>Profile</Link>} />` block; preserve adjacent `<DropdownMenuSeparator />` siblings.
**When to use:** Removing redundant menu rows from a Base UI / shadcn DropdownMenu when the affordance is duplicated elsewhere (Phase 25 dual-affordance avatar Link).
**Example:**
```tsx
// Source: src/components/layout/UserMenu.tsx (current state, lines 67-74)
<DropdownMenuSeparator />
{username && (
  <DropdownMenuItem
    render={<Link href={`/u/${username}/collection`}>Profile</Link>}
  />
)}
<DropdownMenuItem render={<Link href="/settings">Settings</Link>} />

// AFTER NAV-16 (lines 67-72 in new file):
<DropdownMenuSeparator />
<DropdownMenuItem render={<Link href="/settings">Settings</Link>} />
```
[CITED: src/components/layout/UserMenu.tsx; UI-SPEC § Visual Diff Contract — NAV-16]

### Pattern 2: Tailwind 4 arbitrary-variant scrollbar hiding (PROF-10)

**What:** Use Tailwind 4's arbitrary-variant syntax to compile to non-standard CSS (Firefox `scrollbar-width: none`; WebKit `&::-webkit-scrollbar { display: none }`).
**When to use:** Hiding a horizontal scrollbar visually while keeping the element scrollable.
**Example:**
```tsx
// Source: src/components/profile/ProfileTabs.tsx:62-66 (TARGET state)
<TabsList
  variant="line"
  className="w-full justify-start gap-2 overflow-x-auto overflow-y-hidden pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
>
```
[CITED: CONTEXT D-06/D-07/D-08; UI-SPEC § Visual Diff Contract — PROF-10]

**Verified compilation:** Tailwind 4 supports both `[property:value]` arbitrary utility syntax and `[&::pseudo]:utility` arbitrary-variant syntax natively. No `tailwind.config.ts` change needed (project uses Tailwind 4 PostCSS plugin without a tailwind.config — Tailwind 4 auto-discovers via `@import 'tailwindcss'` in globals.css).

**Codebase precedent:** Grep for `[&::-webkit-scrollbar]` and `[scrollbar-width:none]` in `src/` returned ZERO matches. Phase 29 introduces this pattern for the first time. CONTEXT line 144 ("used elsewhere in the codebase (grep: `[&::-webkit-scrollbar]`)") is INACCURATE — the planner should not assume precedent. The patterns are stock Tailwind 4 patterns and should compile correctly, but Wave 0 should include a smoke test that the rendered DOM has the expected styles applied. [VERIFIED: grep on src/ at 2026-05-05]

### Pattern 3: Per-navigation key from Server Component nonce (FORM-04)

**What:** Generate a fresh value in the Server Component on every render and pass it to a Client Component as `key` to force remount.
**When to use:** When the consumer page needs to discard preserved React state on every fresh navigation under Next.js 16 `cacheComponents: true`.
**Example:**
```tsx
// Source: docs/01-app/01-getting-started/08-caching.md
//   "Operations like Math.random(), Date.now(), or crypto.randomUUID() produce
//    different values each time they execute. Cache Components requires you to
//    explicitly handle these. To generate unique values per request, defer to
//    request time by calling connection() before these operations, and wrap
//    the component in <Suspense>."
//
// EXCEPTION (verified): if the page Server Component is ALREADY dynamic
// because it accesses Request-time APIs (cookies, headers, searchParams),
// connection() is not required — the page is already excluded from
// prerendering. /watch/new awaits searchParams (page.tsx:55), so it's
// already dynamic. crypto.randomUUID() runs at request time without
// additional ceremony.

export default async function NewWatchPage({ searchParams }: NewWatchPageProps) {
  // ... existing auth + searchParams resolution (UNCHANGED)
  const sp = await searchParams                    // ← request-time API → page is dynamic
  // ... existing whitelist + DB fetches (UNCHANGED)

  // FORM-04: per-request nonce. Safe to call without connection() because
  // the page is already dynamic via the searchParams await above.
  const flowKey = crypto.randomUUID()

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="...">Add a watch — or just evaluate one</h1>
      <AddWatchFlow
        key={flowKey}                              // ← NEW: forces fresh tree on each render
        collectionRevision={collection.length}
        // ... all other props UNCHANGED
      />
    </div>
  )
}
```
[CITED: node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md § "Working with non-deterministic operations"; node_modules/next/dist/docs/01-app/04-glossary.md § "Request-time APIs"]

### Pattern 4: useLayoutEffect cleanup for Activity-hide reset (FORM-04 — back-button defense)

**What:** Reset client-side state in a `useLayoutEffect` cleanup function that fires when React's `<Activity>` transitions the route to `mode="hidden"` (i.e., when the user navigates AWAY).
**When to use:** When server-generated `key` alone cannot cover the case where the user navigates back to a route preserved in Activity history (Activity preserves up to 3 routes; back-nav un-hides the existing tree without re-running the Server Component).
**Example:**
```tsx
// Source: node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md
//   § "Expandable UI" subsection adapted for AddWatchFlow's full-state reset.
//   The cleanup function runs synchronously when React hides the component
//   (route navigated away), ensuring no flash of stale state when the user
//   returns.

import { useLayoutEffect } from 'react'

export function AddWatchFlow({ collectionRevision, /* ... */ }: AddWatchFlowProps) {
  const [state, setState] = useState<FlowState>(initialState)
  const [url, setUrl] = useState('')
  const [rail, setRail] = useState<RailEntry[]>([])
  // ... existing hooks (verdict cache, etc.) UNCHANGED

  // FORM-04 — Activity-hide cleanup. Runs when the user navigates AWAY from
  // /watch/new. Resets the local React state so when the user returns
  // (back-button or click into the flow from anywhere), the cached React
  // tree (preserved by Next.js Activity) is already at idle.
  useLayoutEffect(() => {
    return () => {
      setState(initialState)        // ← derives from props on cleanup
      setUrl('')
      setRail([])
    }
  }, [])

  // ... rest of component UNCHANGED
}
```
[CITED: node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md § "Expandable UI" + § "Form input values"]

**Note:** WatchForm needs the same pattern for `formData`, `photoBlob`, `photoError`, `errors`. Two options:
- (a) Per-component cleanup — each component manages its own reset.
- (b) Trust the parent's `key`-prop remount on forward nav + cleanup on hide for both — equivalent end behavior with one less code site.

The **planner picks**, but the testable contract is the same: after navigating away and back, the component renders idle.

### Anti-Patterns to Avoid

- **`useEffect` cleanup instead of `useLayoutEffect`**: `useEffect` cleanup runs asynchronously, which can produce a flash of stale state when the user navigates back. The Next.js docs explicitly recommend `useLayoutEffect` for Activity-hide cleanup. [CITED: preserving-ui-state.md line 69]

- **Closing over `initialState` from outside the component body**: Activity preserves the closure. If `initialState` is computed from props (which is the case in AddWatchFlow), the cleanup must read CURRENT prop values. Pass props through `useRef` or close over `setState`'s functional updater pattern.

- **Modifying `useWatchSearchVerdictCache.ts`**: Out of scope per UI-SPEC. The hook's identity-keyed semantic must survive AddWatchFlow remount. Hoist the hook above the `key` boundary by:
  - **Option A:** Pass the cache instance from a Client Component WRAPPER mounted ABOVE `<AddWatchFlow key={nonce}>` (a "AddWatchFlowShell" Client Component owns the cache hook and forwards `cache.get` / `cache.set` as props).
  - **Option B:** Hoist into a React Context provider higher in the tree.
  - **Option C:** Accept that the cache resets per remount, and rely on `collectionRevision` as the truth — the verdict re-fetch is fast and the user's mental model is "the cache is per-session anyway."
  - The planner picks. Verify against Phase 20 D-06 invalidation tests.

- **Setting `'use cache'` on `/watch/new/page.tsx`**: Would prevent `crypto.randomUUID()` from producing a fresh value per request (it would be cached). The page must remain uncached. Verified at `node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md` — "use cache + crypto.randomUUID()" produces a build-time constant.

- **Using `Math.random()` instead of `crypto.randomUUID()`**: Lower entropy, theoretically collidable on rapid-fire navigations. `crypto.randomUUID()` is the documented choice in `node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md`. UUID is also Edge-runtime safe.

- **Using `key={Date.now()}`**: Same value across two clicks fired in the same millisecond. UUID has cryptographic entropy.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Force React tree remount on a Client Component | A `useEffect` that calls `setState(initialState)` on every prop change | `key` prop on the parent | React's `key`-based reconciliation is the canonical primitive; effect-based reset has timing races (renders idle frame after stale frame) and re-runs all effects redundantly |
| Hide horizontal scrollbar | Custom CSS file or `<style>` injection | Tailwind 4 arbitrary-variant utilities (`[scrollbar-width:none]` and `[&::-webkit-scrollbar]:hidden`) | Stock pattern; compiles to standard CSS; no dev-only `style` injection |
| Generate per-request unique value in Server Component | Hash of timestamp + Math.random | `crypto.randomUUID()` | Cryptographic entropy; native to Node ≥ 16 and Edge runtime; documented in Next.js Caching guide |
| Reset React state when route is hidden by Activity | A custom NextRouter event listener | `useLayoutEffect` cleanup | Documented canonical Next.js 16 pattern; runs synchronously before Activity hides; Activity's hide IS React's effect cleanup boundary |
| Detect "is this the route being hidden" | A custom `<Activity>` mode prop check | Trust React's effect cleanup contract | The cleanup function semantically MEANS "this route is being hidden / unmounted"; no additional check needed |

**Key insight:** Next.js 16 with `cacheComponents: true` does NOT require new mental models for state reset — it requires applying React's existing primitives (`key`, `useLayoutEffect` cleanup, callback refs) to the new "Activity-preserved route" reality. Don't write custom navigation listeners; use the framework's intended hooks.

## Common Pitfalls

### Pitfall 1: Activity preserves React state across navigations
**What goes wrong:** With `cacheComponents: true`, Next.js wraps each route in `<Activity>` and toggles `mode="hidden"` instead of unmounting on navigation. Any `useState` value persists. The Add-Watch flow's bug is exactly this.
**Why it happens:** Default behavior of Cache Components since Next.js 16.0.0. [CITED: cacheComponents.md "Navigation with Activity"]
**How to avoid:** Combine the `key`-prop remount (covers fresh navs) with `useLayoutEffect` cleanup (covers back-nav from Activity-preserved routes).
**Warning signs:** State that "should be fresh" appears stale after navigating away and back. Up to 3 routes are preserved; beyond that, the oldest is evicted and re-renders fresh — so reproducing the bug requires staying within the 3-route Activity window. [CITED: preserving-ui-state.md line 18]

### Pitfall 2: `crypto.randomUUID()` in a `'use cache'` boundary becomes a build-time constant
**What goes wrong:** If a future maintainer adds `'use cache'` to `/watch/new/page.tsx` (e.g., to optimize), the nonce is computed once at build time and reused across ALL requests — defeating FORM-04 entirely.
**Why it happens:** `'use cache'` caches the function's output, including the UUID value. [CITED: 08-caching.md § "Working with non-deterministic operations"]
**How to avoid:** The plan should add an inline source comment near the `crypto.randomUUID()` call: `// FORM-04 contract — DO NOT add 'use cache' to this page; nonce must be per-request.` Optionally a Vitest test that `import`s page.tsx and asserts no `'use cache'` directive (string-grep).
**Warning signs:** Multiple users in a deployment all see the same stale form data simultaneously.

### Pitfall 3: `useWatchSearchVerdictCache` hoisted-vs-co-located ambiguity
**What goes wrong:** If the cache hook lives inside `AddWatchFlow.tsx` (current location, line 114), it remounts with AddWatchFlow when the key changes — and any cached verdict bundles are lost. Phase 20 D-06 contract says the cache is "intentionally cross-session"; FORM-04 D-15 says it must survive the remount.
**Why it happens:** `useWatchSearchVerdictCache` is a local `useState` hook — its lifecycle is the component's lifecycle.
**How to avoid:** Pick ONE of these strategies (planner discretion per CONTEXT D-15):
  - **(A) Hoist via Client wrapper:** Create `AddWatchFlowShell.tsx` (`'use client'`), mount it in page.tsx as `<AddWatchFlowShell><AddWatchFlow key={nonce} ... /></AddWatchFlowShell>`. The shell owns `useWatchSearchVerdictCache(collectionRevision)` and passes `{ get, set }` callbacks down as props. AddWatchFlow no longer calls the hook directly.
  - **(B) Accept the reset:** Move on. The cache is fast to repopulate via `collectionRevision`-keyed re-fetch and the user's experience is unchanged for an empty cache.
  - **(C) React Context provider:** Mount `<VerdictCacheProvider>` at a higher Client Component layer (perhaps in app shell). Adds context-plumbing complexity but cleanly decouples lifetime.
**Recommendation:** Option (A) is the lowest-risk path that preserves the Phase 20 D-06 contract. Option (B) is acceptable if Phase 20 D-06 tests pass after the change (planner verifies).
**Warning signs:** First paste of a previously-evaluated catalogId after FORM-04 lands shows a verdict-spinner instead of an instant verdict; Phase 20 D-06 tests fail.

### Pitfall 4: Browser back-navigation does NOT re-run the Server Component
**What goes wrong:** When the user navigates BACK to `/watch/new` (within the 3-route Activity window), Next.js un-hides the existing React tree. The Server Component does NOT re-execute. So even though `crypto.randomUUID()` would generate a fresh value if it ran, IT DOESN'T RUN — and the AddWatchFlow `key` is unchanged. The tree is preserved with stale state.
**Why it happens:** Activity preservation is a client-side React mechanism; the server component output is also preserved (the React tree includes server-rendered children). [CITED: preserving-ui-state.md "Activity preserves all component state and DOM state by default"]
**How to avoid:** Pair the `key`-prop strategy with a `useLayoutEffect` cleanup in AddWatchFlow that resets state when the route is hidden. When the user navigates AWAY, cleanup runs → state resets to idle. When they navigate back, the tree is un-hidden but already at idle.
**Warning signs:** Manual UAT: paste URL, navigate away (forward to /u/.../collection), browser-back to /watch/new → stale URL appears. If only the `key` approach was implemented, this case fails.

### Pitfall 5: jsdom does not faithfully simulate `<Activity>` mode toggling
**What goes wrong:** Vitest tests for FORM-04 cannot simulate "navigate away with Activity, then navigate back" because jsdom's React renderer doesn't emulate the Next.js router's Activity mode toggling. Unit tests can only assert the explicit `key`-change re-mount behavior (CONTEXT D-19).
**Why it happens:** Activity is a Next.js framework feature; jsdom is a DOM-only environment.
**How to avoid:** Split FORM-04 verification into two layers:
  - **Unit (Vitest + RTL):** D-19's `rerender({ key: 'b' })` test pattern + `useLayoutEffect` cleanup test (render then unmount, assert state was reset by inspecting via the test's render shell).
  - **Manual UAT:** D-19's "navigate /watch/new → paste URL → router.push → click Add Watch CTA → assert empty" flow.
**Warning signs:** A unit test that "tries to simulate Activity preservation" — abandon and document in UAT.

### Pitfall 6: Test 4 deletion in UserMenu.test.tsx — verify the "no Profile link" assertion still works
**What goes wrong:** UserMenu.test.tsx Test 4 (line 91-98) currently asserts `screen.getByRole('link', { name: /^profile$/i })`. After NAV-16, this query returns `null`. Test 5 (line 138 — actually line 139 in the current file: `expect(screen.queryByRole('link', { name: /^profile$/i })).toBeNull()`) ALREADY asserts the no-Profile-link case for the null-username branch. After NAV-16, that assertion is correct for ALL branches.
**Why it happens:** D-05 says "Test 5 should still pass." It does — but a planner who deletes Test 4 without re-reading Test 5 might miss that Test 5's `queryByRole` query is already the canonical "no Profile link" coverage and doesn't need a new test.
**How to avoid:** D-05 explicitly says "Test 4 → DELETE entirely" and "Test 5 → preserve as-is." No new test needed. The planner verifies by running tests after the deletion: Test 5's existing assertion passes for both username-set and username-null cases.
**Warning signs:** Adding a redundant "Profile link does not exist when username set" test as a "replacement" for Test 4 — unnecessary; Test 5 already covers it after NAV-16.

### Pitfall 7: PROF-10 className override does not modify shared `tabsListVariants`
**What goes wrong:** A planner reads CONTEXT D-09 ("Fix scope = ProfileTabs.tsx ONLY") but mentally drifts toward "this would be cleaner as a `horizontal` variant in `tabsListVariants`." Modifying `tabs.tsx:26-39` is forbidden because `/settings` and `/search` use the same primitive with different layout needs.
**Why it happens:** DRY instinct.
**How to avoid:** The plan should NOT touch `src/components/ui/tabs.tsx` at all. Verify by `git diff` before commit — only `ProfileTabs.tsx` and the test file should appear for PROF-10.
**Warning signs:** A plan task whose action mentions `tabsListVariants` or `src/components/ui/tabs.tsx`.

### Pitfall 8: Vitest `rerender` does NOT remount when only the `key` changes via prop spread
**What goes wrong:** RTL's `rerender(<AddWatchFlow key="b" {...sameProps} />)` — if `key` is passed at the JSX level but the test spreads sameProps over `<AddWatchFlow {...{key: 'b', ...sameProps}}>`, React's diff treats them as the same component instance and DOES NOT remount.
**Why it happens:** `key` is a special React prop that must appear at the JSX level, not inside an object spread. RTL's rerender works correctly when `key` is explicit on the JSX.
**How to avoid:** Tests must write `rerender(<AddWatchFlow key="b" collectionRevision={0} ... />)` — no spread of an object containing key. Verified pattern in many React Testing Library tutorials. [ASSUMED based on React docs convention; verified in React DevTools behavior]
**Warning signs:** A "key change" test that PASSES without the fix in place — the test isn't actually testing what it claims.

## Runtime State Inventory

> Phase 29 is a UI-only chrome-cleanup phase. No renames, no migrations, no string replacements at the runtime-state layer. The `crypto.randomUUID()` nonce is ephemeral per-request and is NOT persisted. Section omitted per the trigger condition.

## Code Examples

Verified patterns from official sources:

### NAV-16 — UserMenu deletion shape

```tsx
// Source: src/components/layout/UserMenu.tsx (current and target)
// CURRENT (lines 67-75):
        <DropdownMenuSeparator />
        {username && (
          <DropdownMenuItem
            render={<Link href={`/u/${username}/collection`}>Profile</Link>}
          />
        )}
        <DropdownMenuItem render={<Link href="/settings">Settings</Link>} />
        <DropdownMenuSeparator />

// TARGET (5 lines instead of 9):
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/settings">Settings</Link>} />
        <DropdownMenuSeparator />
```

### PROF-10 — TabsList className override

```tsx
// Source: src/components/profile/ProfileTabs.tsx:62-66 (current and target)
// CURRENT:
      <TabsList
        variant="line"
        className="w-full justify-start gap-2 overflow-x-auto"
      >

// TARGET:
      <TabsList
        variant="line"
        className="w-full justify-start gap-2 overflow-x-auto overflow-y-hidden pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
```

### FORM-04 — Server Component nonce

```tsx
// Source: src/app/watch/new/page.tsx (current state, target adds two lines)
// FILE START — UNCHANGED imports
// AFTER all existing async work (auth, await searchParams, DB fetches), insert:

  // FORM-04 — per-request nonce as React key on AddWatchFlow. Forces remount
  // on every entry to /watch/new (CONTEXT D-12, D-13). Safe to call here
  // because the page is already dynamic via the await searchParams above
  // (Request-time API). DO NOT add 'use cache' to this file; the nonce must
  // be per-request, not per-build.
  const flowKey = crypto.randomUUID()

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="font-serif text-3xl md:text-4xl text-foreground mb-8">
        Add a watch — or just evaluate one
      </h1>
      <AddWatchFlow
        key={flowKey}                         // ← NEW (only diff vs current)
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

### FORM-04 — useLayoutEffect cleanup-on-hide (back-nav defense)

```tsx
// Source: src/components/watch/AddWatchFlow.tsx (lines 81-128 area)
// Add `useLayoutEffect` to the React import line if not already present.
// Insert near the existing useEffect at lines 122-127:

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

**Note on `initialState` derived from props:** The cleanup above resets to literal `{ kind: 'idle' }` rather than the prop-derived `initialState`. This is intentional — when the user navigates back to `/watch/new` from within the 3-route Activity window, they're typically NOT carrying the same deep-link query params (those would force a fresh nav, not a back-nav). If the planner determines this is wrong (e.g., user navigates `/watch/new?catalogId=X&intent=owned` → some other route → back), the cleanup can read `initialCatalogId` etc. from a `useRef` mirror of props. **Validate this assumption in UAT.** Tagged `[ASSUMED]`.

### FORM-04 — Vitest unit test for `key`-change remount

```tsx
// Source: tests/components/watch/AddWatchFlow.test.tsx (NEW FILE — Wave 0)
// Pattern adapted from existing tests/components/layout/UserMenu.test.tsx and
// tests/components/profile/ProfileTabs.test.tsx (both use vitest + RTL +
// next/navigation mocks).

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

// Mock fetch for /api/extract-watch — minimal stub, returns idle-keep
vi.mock('@/app/actions/verdict', () => ({
  getVerdictForCatalogWatch: vi.fn(),
}))
vi.mock('@/app/actions/watches', () => ({
  addWatch: vi.fn(),
}))

import { AddWatchFlow } from '@/components/watch/AddWatchFlow'

describe('AddWatchFlow — FORM-04 key-change remount (CONTEXT D-19)', () => {
  const baseProps = {
    collectionRevision: 0,                       // empty collection — short-circuit
    initialCatalogId: null,
    initialIntent: null as 'owned' | null,
    initialCatalogPrefill: null,
    initialManual: false,
    initialStatus: null as 'wishlist' | null,
    initialReturnTo: null,
    viewerUsername: 'tyler',
  }

  it('resets paste URL when key prop changes', async () => {
    const { rerender } = render(<AddWatchFlow key="a" {...baseProps} />)
    const urlInput = screen.getByPlaceholderText(/paste/i) as HTMLInputElement
    await userEvent.type(urlInput, 'https://example.com/watch')
    expect(urlInput.value).toBe('https://example.com/watch')

    // Trigger remount via key change. NOTE: must pass key explicitly at JSX
    // level — see Pitfall 8.
    rerender(<AddWatchFlow key="b" {...baseProps} />)
    const urlInputAfter = screen.getByPlaceholderText(/paste/i) as HTMLInputElement
    expect(urlInputAfter.value).toBe('')
  })
})
```

[CITED: existing tests/components/layout/UserMenu.test.tsx and tests/components/profile/ProfileTabs.test.tsx for vitest+RTL+next/navigation mock conventions.]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pre-Next-15: `pageshow` listener for bfcache | Next.js 16 Activity preservation + `useLayoutEffect` cleanup | Next.js 16.0.0 (cacheComponents flag introduced) | Activity covers more cases than bfcache; the canonical fix is now React-lifecycle-based, not browser-event-based |
| Pre-Next-15: `unstable_noStore()` for dynamic opt-out | `await connection()` for explicit dynamic opt-in | Next.js 15.0.0 | `connection()` replaces `unstable_noStore()`; only relevant if a Server Component would otherwise be prerendered (NOT this case — already dynamic via searchParams) |
| Pre-Next-15: `dynamic = 'force-dynamic'` route segment config | Implicit dynamic via Request-time APIs | Next.js 16 (Cache Components migration) | All pages dynamic by default; opt-in cache via `'use cache'` |

**Deprecated/outdated:**
- `unstable_noStore()`: replaced by `connection()`. Phase 29 doesn't use either — page is already dynamic. [CITED: connection.md line 50]
- `router.refresh()` after AddWatchFlow Wishlist commit: removed in Phase 28 D-15. The Plan must NOT re-introduce it as a "FORM-04 alternative." Verified pattern in current `AddWatchFlow.tsx:319-323`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | jsdom-rendered cleanup runs synchronously when RTL `unmount()` is called, mirroring Activity-hide cleanup behavior closely enough for unit-test parity | Pitfall 5 / Code Examples / Validation Architecture | If wrong, Vitest's "useLayoutEffect cleanup resets state" test passes but the production behavior under Activity differs. Mitigation: rely on manual UAT for the "navigate-and-back" assertion (CONTEXT D-19 already specifies manual UAT for this case). |
| A2 | Resetting AddWatchFlow's state to literal `{ kind: 'idle' }` in cleanup (rather than prop-derived `initialState`) is correct UX for the back-nav case | Code Examples — useLayoutEffect cleanup section | If wrong, deep-link entries (?catalogId=X&intent=owned) followed by navigate-away-and-back would lose the prefill. Mitigation: use a `useRef` mirror of `initialState` so cleanup reads current prop-derived value. Confirm with user in plan-discuss. |
| A3 | `useWatchSearchVerdictCache` Option A (Client wrapper hoist) is the lowest-risk hoisting strategy that preserves Phase 20 D-06 contract | Pitfall 3 / Don't Hand-Roll | If wrong (e.g., Phase 20 D-06 actually tolerates per-mount cache), Option B is fine and saves a wrapper component. Mitigation: planner runs Phase 20 D-06 tests after both options; defaults to A unless tests pass under B. |
| A4 | Vitest `rerender(<Component key="b" {...spreadProps} />)` correctly forces remount when `key` is the literal first prop and not inside the spread | Pitfall 8 / Code Examples — Vitest test | If wrong, the unit test passes vacuously. Mitigation: include a sanity assertion that an internal `useState` value DID reset (not just that no error was thrown). |

**If this table grows during planning:** decisions tagged `[ASSUMED]` should be confirmed in `/gsd-discuss-phase` before plan-checker locks them.

## Open Questions (RESOLVED)

1. **Should the `useLayoutEffect` cleanup live in AddWatchFlow alone, or also in WatchForm?**
   - What we know: `key` on `<AddWatchFlow>` causes WatchForm to remount automatically when AddWatchFlow remounts. So forward-nav coverage is fine without a WatchForm-side cleanup.
   - What's unclear: Back-nav case. If the user navigates from `/watch/new` (with WatchForm rendered in `manual-entry` or `form-prefill`) to another route and back, AddWatchFlow's `useLayoutEffect` cleanup resets `state` to `{ kind: 'idle' }`. WatchForm is no longer rendered in idle. So formData reset is implicit. Should be OK.
   - RESOLVED: Cleanup in AddWatchFlow only. WatchForm stays as-is. Verify in manual UAT (D-19) — type into manual-entry brand field, navigate away, navigate back, click "manual entry" again — assert brand is empty. Implemented in Plan 29-04 Task 2.

2. **Does Phase 20 D-06 test suite still pass with the verdict cache hoisted into a wrapper?**
   - What we know: The cache is keyed on `collectionRevision` and intentionally cross-session.
   - What's unclear: Phase 20 D-06 tests may make assumptions about the cache being co-located with AddWatchFlow.
   - RESOLVED: Plan 29-04 picks **Option B (accept the cache reset per remount)** per CONTEXT D-15 "Claude's Discretion." Phase 20 D-06 cache regression is part of Plan 29-04's verify acceptance criteria. Option A (Client wrapper hoisting) is deferred to a v5.0+ refactor candidate if UAT shows the reset is observable.

3. **Will `crypto.randomUUID()` be available in all deployment environments?**
   - What we know: Node ≥ 16 and Edge runtime support `crypto.randomUUID()` natively (Web Crypto). Next.js 16 requires Node ≥ 20.
   - What's unclear: Nothing — the project's Node version is not pinned (no .nvmrc) but Next 16 enforces ≥ 20 at install time.
   - RESOLVED: No action needed. Plan 29-04 Task 1 documents the runtime requirement in an inline source comment alongside the nonce generation.

## Environment Availability

> Phase 29 introduces zero new external dependencies. Existing toolchain (already verified in current commits): Next.js 16.2.3, React 19.2.4, Tailwind CSS 4, Vitest 2.1.9, jsdom 25, @testing-library/react 16.3.2.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node ≥ 20 | `crypto.randomUUID()` in Server Component | ✓ (Next 16 install-time enforcement) | inferred from package.json next@16.2.3 | — |
| Vitest + jsdom | All Phase 29 tests | ✓ | 2.1.9 + jsdom 25 | — |
| `@testing-library/react` `rerender` API | FORM-04 unit tests | ✓ | 16.3.2 | — |
| Tailwind 4 PostCSS plugin | PROF-10 utility classes | ✓ | ^4 | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 + @testing-library/react 16.3.2 + jsdom 25 |
| Config file | `vitest.config.ts` [VERIFIED] |
| Quick run command | `npm run test -- tests/components/layout/UserMenu.test.tsx tests/components/profile/ProfileTabs.test.tsx tests/components/watch/AddWatchFlow.test.tsx tests/components/watch/WatchForm.test.tsx` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NAV-16 | Profile DropdownMenuItem deleted; dropdown order is email→Settings→Theme→Sign out | unit | `npm run test -- tests/components/layout/UserMenu.test.tsx` | ✅ existing (Tests 3 + 4 update; Test 5 unchanged) |
| NAV-16 | Profile link with name=`/^profile$/i` is not in the DOM regardless of username state | unit | same as above | ✅ existing (Test 5 already covers; verify post-NAV-16) |
| PROF-10 | TabsList className includes `overflow-x-auto`, `overflow-y-hidden`, `pb-2`, `[scrollbar-width:none]`, `[&::-webkit-scrollbar]:hidden` | unit | `npm run test -- tests/components/profile/ProfileTabs.test.tsx` | ✅ existing (extend with new className-assertion test) |
| PROF-10 | Vertical-scroll passthrough on touch/trackpad gesture | manual UAT | (manual) | n/a |
| FORM-04 | AddWatchFlow re-render with new `key` resets `url` to `''` and `state.kind` to `'idle'` | unit | `npm run test -- tests/components/watch/AddWatchFlow.test.tsx` | ❌ Wave 0 (NEW file) |
| FORM-04 | WatchForm re-mount with new `key` resets `formData` to `initialFormData` | unit | `npm run test -- tests/components/watch/WatchForm.test.tsx` | ✅ existing (extend) |
| FORM-04 | useLayoutEffect cleanup runs on unmount and resets state | unit | included in `tests/components/watch/AddWatchFlow.test.tsx` | ❌ Wave 0 (NEW) |
| FORM-04 | Verdict cache survives AddWatchFlow remount | unit (regression) | run existing Phase 20 D-06 cache tests | ✅ existing (path TBD by planner; locate via grep "useWatchSearchVerdictCache") |
| FORM-04 | Manual UAT: navigate /watch/new → paste URL → router.push → click Add Watch CTA → assert empty | manual UAT | (manual) | n/a |
| FORM-04 | Manual UAT: paste URL → browser-back from /u/.../collection → /watch/new → assert empty | manual UAT | (manual) | n/a |

### Sampling Rate
- **Per task commit:** `npm run test -- tests/components/<edited-file>` (only the test file for the just-modified component).
- **Per wave merge:** `npm run test -- tests/components/layout tests/components/profile tests/components/watch` (all Phase 29 affected component-level tests).
- **Phase gate:** `npm run test` (full suite) green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/components/watch/AddWatchFlow.test.tsx` — NEW FILE. Covers FORM-04 D-19 unit assertions: key-change remount + useLayoutEffect cleanup. Pattern: vitest + RTL + next/navigation mock (mirror existing UserMenu.test.tsx and ProfileTabs.test.tsx setup).
- [ ] `tests/components/watch/WatchForm.test.tsx` extension — add a single test asserting `formData` returns to `initialFormData` after remount with new `key`. Existing file already covers other WatchForm behavior; just add one test.
- [ ] No framework install needed (vitest + RTL + jsdom all in place).

## Security Domain

> Phase 29 is a UI-only chrome-cleanup phase. No new auth surface, no new input handling, no new data flow, no new persistence. Security review is bounded to confirming no regressions:

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no — UserMenu auth gating unchanged (Phase 25 lock holds) | — |
| V3 Session Management | no — no session-related changes | — |
| V4 Access Control | no — Profile-row deletion does not change access semantics; the avatar Link already covers the navigation. The chevron-only branch (no-username case) is unchanged. | — |
| V5 Input Validation | no — no new input fields. The `crypto.randomUUID()` nonce is a server-generated string with no user input. | — |
| V6 Cryptography | yes (low touch) | `crypto.randomUUID()` from Web Crypto / Node `node:crypto` — never hand-rolled. Used only as a React `key` value, never as a security token. |

### Known Threat Patterns for Next.js 16 + React 19 stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Stale-state leak across users (multi-user shared device) | Information Disclosure | Phase 29 FIXES one such leak (FORM-04 was leaking prior session's paste URL across re-entry). Full-page reload on logout (`window.location.href`, per existing project pattern) clears all `useState`. |
| `crypto.randomUUID()` collision/predictability | n/a | Cryptographic UUID v4 is uniformly distributed; collision probability is negligible at 2^122 entropy. Used as a React reconciliation key only — not a security token. |
| Activity-preserved sensitive form state | Information Disclosure | The `useLayoutEffect` cleanup pattern (FORM-04 fix) is itself a hardening: any sensitive form state (URL pastes that include tracking params, etc.) is no longer preserved indefinitely across navigations within the 3-route Activity window. |

**Phase 29 security improvement:** FORM-04 incidentally hardens against the "stale state across navigations" leak vector. No regression introduced; one defense added.

## Sources

### Primary (HIGH confidence)
- `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/cacheComponents.md` — Activity-preservation behavior under `cacheComponents: true`
- `node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md` — canonical patterns for resetting state across Activity-hide (callback ref, `useLayoutEffect` cleanup, key prop)
- `node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md` — `crypto.randomUUID()` and Cache Components interaction; explicit example showing UUID inside `'use cache'` produces a build-time constant
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/connection.md` — `connection()` semantics; only required when a Server Component would otherwise be prerendered
- `node_modules/next/dist/docs/01-app/04-glossary.md` — Request-time APIs definition (searchParams, cookies, headers); confirms `/watch/new` is already dynamic via searchParams
- `node_modules/next/dist/docs/01-app/03-api-reference/02-components/link.md` — `onNavigate` callback option (not used in Phase 29; documented for future consideration)
- `package.json` (project root) — verified versions of Next.js (16.2.3), React (19.2.4), Tailwind (^4), Vitest (2.1.9), @testing-library/react (16.3.2)
- `next.config.ts` (project root) — verified `experimental.cacheComponents: true`, `images.unoptimized: true`
- `vitest.config.ts` — verified jsdom environment, setupFiles, server-only shim alias
- `src/components/layout/UserMenu.tsx` — current state, lines 50-145 verified
- `src/components/profile/ProfileTabs.tsx` — current state, line 65 className verified
- `src/app/watch/new/page.tsx` — current state, lines 44-114 verified (already dynamic via searchParams await)
- `src/components/watch/AddWatchFlow.tsx` — verified hook locations (useState lines 110-113; useEffect lines 122-127)
- `src/components/watch/WatchForm.tsx` — verified useState locations (formData line 101; photoBlob line 98)
- `src/components/search/useWatchSearchVerdictCache.ts` — verified `useState`-based, returns `{ get, set }` API
- `tests/components/layout/UserMenu.test.tsx` — verified existing 13 tests; identified Tests 3-4-5 as the NAV-16 update sites
- `tests/components/profile/ProfileTabs.test.tsx` — verified existing 7 tests; PROF-10 adds a new className-assertion test

### Secondary (MEDIUM confidence)
- `.planning/phases/28-add-watch-flow-verdict-copy-polish/28-RESEARCH.md` — Phase 28 noted Activity-replay risk; FORM-04 is the cleanup of that lurking concern
- `tests/setup.ts` — verified PointerEvent + jest-shim setup; Phase 29 tests inherit this base

### Tertiary (LOW confidence)
- None. All claims in this research are tagged either `[VERIFIED: …]`, `[CITED: …]`, or `[ASSUMED]` (with explicit risk).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against package.json; no new packages introduced.
- Architecture: HIGH for NAV-16 / PROF-10 (literal source-shape edits); HIGH for FORM-04 forward-nav (canonical key pattern with explicit Next docs cite); MEDIUM for FORM-04 back-nav (`useLayoutEffect` cleanup is the documented canonical pattern but A1/A2 assumptions remain — manual UAT is the test of record per CONTEXT D-19).
- Pitfalls: HIGH — pitfalls 1-4 cite official Next.js 16 docs; pitfall 8 is a React fundamentals item flagged for the test-writer.

**Research date:** 2026-05-05
**Valid until:** 2026-06-05 (30 days for stable framework versions). Re-verify if Next.js minor or React minor changes during this window.
