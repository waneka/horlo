---
phase: 39b
plan: 03
type: execute
wave: 1
depends_on:
  - 39b-01
files_modified:
  - src/components/profile/LockedTabCard.tsx
  - src/components/profile/WornCalendar.tsx
  - src/components/profile/StatsTabContent.tsx
  - src/app/u/[username]/[tab]/page.tsx
  - tests/components/profile/LockedTabCard.test.tsx
  - tests/components/profile/WornCalendar.test.tsx
autonomous: true
requirements:
  - DISC-11
nsv_rows:
  - NSV-14
disc_audit_rows:
  - DISC-AUDIT-97
  - DISC-AUDIT-102
  - DISC-AUDIT-111
  - DISC-AUDIT-122
  - DISC-AUDIT-123
  - DISC-AUDIT-124
commit_strategy: per-task

must_haves:
  truths:
    - "LockedTabCard's logged-in branch (viewerId !== null) renders an inline FollowButton + caption 'Follow @{username} to see their {label}.' (D-39b-12)"
    - "LockedTabCard's unauthenticated branch (viewerId === null) renders a sign-in Link with href '/signin?returnTo={encodeURIComponent(currentPath)}' + caption 'Sign in to see @{username}'s {label}.'"
    - "LockedTabCard's tab === 'common-ground' branch still returns null (Phase 39 D-09 regression guard)"
    - "WornCalendar day cells with > 0 events become keyboard-focusable buttons (role='button' tabIndex=0 + onKeyDown for Enter/Space)"
    - "WornCalendar renders a wear-detail panel BELOW the grid showing watch image + brand + model + notes for the selected day; first event-day selected on mount"
    - "WornCalendar empty-day selection renders 'No wear events on {date}.' caption (D-39b-13 lock)"
    - "WornCalendar exposes a test-only `initialSelectedDate?: string | null` prop that overrides the first-event-day initialization (defaults to undefined; production code path unchanged)"
    - "StatsTabContent WornList <li> rows wrap content in <Link href='/watch/${watch.id}'> (Most Worn + Least Worn); HorizontalBarChart bars unchanged"
  artifacts:
    - path: "src/components/profile/LockedTabCard.tsx"
      provides: "Patched with viewerId/targetUserId/initialIsFollowing/currentPath props; inline FollowButton + caption + sign-in Link"
      contains: "FollowButton"
    - path: "src/components/profile/WornCalendar.tsx"
      provides: "Patched with selectedDate state + day-cell onClick + below-grid wear-detail panel + initialSelectedDate test-only prop"
      contains: "selectedDate"
    - path: "src/components/profile/StatsTabContent.tsx"
      provides: "WornList <li> rows wrapped in <Link>"
      contains: "href={`/watch/${watch.id}`}"
    - path: "tests/components/profile/LockedTabCard.test.tsx"
      provides: "3 new tests for D-39b-12 branches"
      contains: "Sign in to follow"
    - path: "tests/components/profile/WornCalendar.test.tsx"
      provides: "NEW test file — first-event-day selection on mount + empty-day caption (via initialSelectedDate prop) + day-cell onClick"
      contains: "initialSelectedDate"
  key_links:
    - from: "src/components/profile/LockedTabCard.tsx"
      to: "src/components/profile/FollowButton.tsx"
      via: "Direct import (server-imports-client island per PopularCollectorRow analog)"
      pattern: "import \\{ FollowButton \\}"
    - from: "src/components/profile/LockedTabCard.tsx (unauthenticated branch)"
      to: "/signin route"
      via: "<Link href=`/signin?returnTo=${encodeURIComponent(currentPath)}`>"
      pattern: "encodeURIComponent\\(currentPath\\)"
    - from: "src/app/u/[username]/[tab]/page.tsx (4 LockedTabCard mount sites)"
      to: "src/components/profile/LockedTabCard.tsx"
      via: "Props: viewerId, targetUserId, initialIsFollowing, currentPath"
      pattern: "LockedTabCard"
    - from: "src/app/u/[username]/[tab]/page.tsx"
      to: "src/data/follows.ts:54 isFollowing"
      via: "Direct import; `const following = viewerId !== null ? await isFollowing(viewerId, targetProfile.id) : false`"
      pattern: "import \\{ isFollowing \\} from '@/data/follows'"
    - from: "src/components/profile/WornCalendar.tsx (wear-detail panel)"
      to: "src/components/profile/StatsTabContent.tsx (analog image+name layout at lines 59-82)"
      via: "Same flex-row image+name structure"
      pattern: "Image src=\\{safe\\}"
    - from: "src/components/profile/StatsTabContent.tsx (each WornList <li>)"
      to: "/watch/${watch.id}"
      via: "<Link>"
      pattern: "href=\\{`/watch/\\$\\{watch\\.id\\}`\\}"
---

<objective>
Close the NSV-14 Collector Profile 8-row dead-end sub-cluster: three sub-cells
that all live on the profile tab surface (`/u/{username}/{tab}`) but touch
disjoint files (LockedTabCard / WornCalendar / StatsTabContent), enabling
parallel-safe execution and a single plan boundary.

Purpose:
- Sub-cell #1 (D-39b-12): LockedTabCard locked-tab variants gain an inline
  FollowButton + caption (logged-in) or sign-in Link (unauthenticated) so the
  viewer has an action that turns the lock state into progress instead of a
  dead-end.
- Sub-cell #2 (D-39b-13): WornCalendar day-cells with wear events become
  keyboard-focusable buttons that surface a wear-detail panel below the grid
  (image + brand + model + notes). First event-day selected on mount; empty-day
  selection renders a "No wear events on {date}." caption. A test-only
  `initialSelectedDate` prop enables deterministic empty-day testing without
  resorting to source-file grep assertions (W1 fix).
- Sub-cell #3 (D-39b-14): StatsTabContent WornList rows (Most Worn + Least
  Worn lists at lines 59-82) wrap content in `<Link href='/watch/${watch.id}'>`.
  Style/Role HorizontalBarChart bars stay non-clickable.

Output: Three component patches, one page mount update (4 LockedTabCard
callsites), two test files (one extended, one new). Six per-task commits.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-CONTEXT.md
@.planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-PATTERNS.md
@.planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-UI-SPEC.md
@.planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-RESEARCH.md
@CLAUDE.md
@AGENTS.md
@.planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-01-SUMMARY.md
@src/components/profile/LockedTabCard.tsx
@src/components/profile/WornCalendar.tsx
@src/components/profile/StatsTabContent.tsx
@src/components/profile/FollowButton.tsx
@src/components/explore/PopularCollectorRow.tsx
@src/components/insights/CollectionFitCard.tsx
@src/app/u/[username]/[tab]/page.tsx
@src/data/follows.ts

<interfaces>
<!-- Key types and contracts. Extracted from codebase. -->

From src/components/profile/LockedTabCard.tsx (CURRENT — 53 lines):
```typescript
interface LockedTabCardProps {
  tab: LockedTabId
  displayName: string | null
  username: string
}
// Returns null when tab === 'common-ground' (Phase 39 D-09 lock).
```

EXTENDED shape this plan ships (D-39b-12):
```typescript
interface LockedTabCardProps {
  tab: LockedTabId
  displayName: string | null
  username: string
  // NEW Phase 39b — D-39b-12:
  viewerId: string | null              // null = unauthenticated
  targetUserId: string                 // profile owner's user id (for FollowButton.targetUserId)
  initialIsFollowing: boolean          // from isFollowing(viewerId, targetUserId) at parent
  currentPath: string                  // same-origin pathname for /signin?returnTo=
}
```

From src/components/profile/FollowButton.tsx (reuse target — variant="inline"):
```typescript
export interface FollowButtonProps {
  viewerId: string
  targetUserId: string
  targetDisplayName: string | null
  initialIsFollowing: boolean
  variant?: 'inline' | 'default'
}
```

From src/data/follows.ts:54 (VERIFIED — the helper exists; do NOT branch on whether it exists):
```typescript
export async function isFollowing(
  followerId: string,
  followingId: string,
): Promise<boolean>
```

From src/components/profile/WornCalendar.tsx (current 181 lines; selectedDate state is NEW):
```typescript
interface WearEventLite {
  id: string
  watchId: string
  wornDate: string
  note: string | null  // Plan 39b-01 Task 3 extended this
}
```

EXTENDED WornCalendar prop interface this plan adds (test-only prop — W1 fix):
```typescript
interface WornCalendarProps {
  events: WearEventLite[]
  watchMap: Record<string, { id: string; brand: string; model: string; imageUrl: string | null }>
  // NEW — Phase 39b W1 fix: test-only prop that overrides the first-event-day
  // initialization. Defaults to undefined; when undefined, production code path
  // is unchanged (the mount-time useEffect selects the first event day).
  // When provided, useState is initialized directly to this value, bypassing
  // the effect's first-event-day logic. Used exclusively by
  // tests/components/profile/WornCalendar.test.tsx test #3 to drive the
  // empty-day code path without needing fireEvent on non-interactive cells.
  initialSelectedDate?: string | null
}
```

From src/components/profile/StatsTabContent.tsx:50-86 (WornList — wrap <li> with <Link>):
```typescript
// WornList renders <li> rows with watch image + name + count
// (Most Worn + Least Worn sections)
```

From src/app/u/[username]/[tab]/page.tsx LockedTabCard mount-site lines (4 total):
```
line 22:  import statement
line 148: collection tab mount
line 157: wishlist tab mount
line 176: notes tab mount
line 275: stats tab mount
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Patch LockedTabCard with FollowButton + sign-in branches</name>
  <files>src/components/profile/LockedTabCard.tsx</files>
  <read_first>
    - src/components/profile/LockedTabCard.tsx (FULL — 53 lines)
    - src/components/explore/PopularCollectorRow.tsx (FULL — 72 lines — canonical Server-imports-Client analog; D-39b-12 uses this pattern, NOT 'use client' on LockedTabCard)
    - src/components/profile/FollowButton.tsx (lines 1-150 — confirm `variant="inline"` API + initialIsFollowing prop)
    - src/components/ui/button.tsx (buttonVariants export — used for the sign-in Link className)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-PATTERNS.md §2 (lines 104-200 — full extension shape ready to copy)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-UI-SPEC.md §"Sub-cell #1: LockedTabCard" (lines 294-325) + §Copywriting Contract (lines 533-540)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-RESEARCH.md §Pitfall 8 + §T-39b-03 (open-redirect mitigation)
  </read_first>
  <behavior>
    Three branches:
    1. `tab === 'common-ground'` → return null (Phase 39 D-09 unchanged regression-guard)
    2. `viewerId !== null` (logged-in) → render existing lock icon + "{name} keeps their {label} private." + `<FollowButton variant="inline">` + `<p>Follow @{username} to see their {label}.</p>` (period included)
    3. `viewerId === null` (unauthenticated) → render existing lock icon + private-copy + `<Link href='/signin?returnTo=${encodeURIComponent(currentPath)}' className={buttonVariants({ variant: 'outline', size: 'default' })}>Sign in to follow</Link>` + `<p>Sign in to see @{username}'s {label}.</p>` (straight apostrophe — ESLint compliant; period included)
  </behavior>
  <action>
    Patch `src/components/profile/LockedTabCard.tsx`:

    Step 1 — Extend imports (after existing imports):
    ```typescript
    import Link from 'next/link'
    import { FollowButton } from '@/components/profile/FollowButton'
    import { buttonVariants } from '@/components/ui/button'
    ```

    Step 2 — Extend `LockedTabCardProps`:
    ```typescript
    interface LockedTabCardProps {
      tab: LockedTabId
      displayName: string | null
      username: string
      viewerId: string | null
      targetUserId: string
      initialIsFollowing: boolean
      currentPath: string
    }
    ```

    Step 3 — Preserve the existing early return: `if (tab === 'common-ground') return null` MUST remain unchanged.

    Step 4 — Replace the existing `<section>` body with the two-branch shape from 39b-PATTERNS.md §2 (lines 156-189). Add `gap-3` to the section's existing `flex flex-col items-center justify-center` class list. The unauthenticated `<Link>` MUST construct `href` exactly as:
    ```tsx
    href={`/signin?returnTo=${encodeURIComponent(currentPath)}`}
    ```
    (T-39b-03 mitigation — `encodeURIComponent` on the producer; `validateReturnTo` at the consumer is owned by `/signin`'s existing infrastructure.)

    Step 5 — Reuse the existing `TAB_LABELS` const for caption interpolation. For `tab === 'common-ground'` we already return null; the map's other 4 keys (`collection / wishlist / worn / notes / stats`) supply `{label}`.

    Step 6 — Captions are LOAD-BEARING (UI-SPEC §Copywriting Contract):
    - Logged-in: `Follow @{username} to see their {label}.` (period required)
    - Unauthenticated: `Sign in to see @{username}'s {label}.` (straight apostrophe — `'`)

    Forbidden:
    - Do NOT add `'use client'` to LockedTabCard (Pitfall 8 — PopularCollectorRow precedent: server RSC imports client island without marking itself client).
    - Do NOT pass an absolute URL or a different-origin path into `returnTo` (T-39b-03).
    - Do NOT remove the existing lock icon or private-copy.
    - Do NOT modify the `common-ground` early return.
    - Do NOT use curly apostrophe (`'`) in the unauthenticated caption — ESLint rejects it.
  </action>
  <verify>
    <automated>grep -c "FollowButton" src/components/profile/LockedTabCard.tsx</automated>
    <automated>grep "encodeURIComponent(currentPath)" src/components/profile/LockedTabCard.tsx</automated>
    <automated>grep "Sign in to follow" src/components/profile/LockedTabCard.tsx</automated>
    <automated>grep -cE "^['\"]use client['\"]" src/components/profile/LockedTabCard.tsx</automated>
    <automated>grep "common-ground" src/components/profile/LockedTabCard.tsx</automated>
    <automated>npx tsc --noEmit 2>&1 | grep -c "error TS"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "FollowButton" src/components/profile/LockedTabCard.tsx` returns ≥ 2 (import + JSX usage)
    - `grep "encodeURIComponent(currentPath)" src/components/profile/LockedTabCard.tsx` returns ≥ 1 line (T-39b-03 mitigation)
    - `grep "Sign in to follow" src/components/profile/LockedTabCard.tsx` returns 1 line (button label)
    - `grep "Follow @\${username} to see their \${label}" src/components/profile/LockedTabCard.tsx` OR equivalent template-literal pattern returns ≥ 1 line
    - `grep "Sign in to see @\${username}" src/components/profile/LockedTabCard.tsx` returns ≥ 1 line
    - `grep -cE "^['\"]use client['\"]" src/components/profile/LockedTabCard.tsx` returns 0 (Pitfall 8 — Server Component lock)
    - `grep -E "common-ground.*return null|return null.*common-ground" src/components/profile/LockedTabCard.tsx` returns ≥ 1 line OR `grep "common-ground" src/components/profile/LockedTabCard.tsx` returns ≥ 1 line (regression guard)
    - `grep -E "viewerId:\s*string\s*\|\s*null" src/components/profile/LockedTabCard.tsx` returns 1 line
    - `npx tsc --noEmit 2>&1 | grep -c "error TS"` ≤ 27 (Phase 36 baseline; mount-site callsites get updated in Task 2 — temporary tsc errors on this file alone are not acceptable, the new props MUST be required on the interface and consumers update in Task 2)
  </acceptance_criteria>
  <done>
    LockedTabCard accepts 4 new props (viewerId/targetUserId/initialIsFollowing/currentPath), renders FollowButton + caption for logged-in viewers, sign-in Link + caption for unauthenticated viewers, returns null for common-ground tab. Open-redirect mitigated via encodeURIComponent on the producer (T-39b-03).
  </done>
</task>

<task type="auto">
  <name>Task 2: Update 4 LockedTabCard mount sites in /u/[username]/[tab]/page.tsx (W2 — deterministic isFollowing helper import)</name>
  <files>src/app/u/[username]/[tab]/page.tsx</files>
  <read_first>
    - src/app/u/[username]/[tab]/page.tsx (FULL — 309 lines; LockedTabCard mounted at lines 148, 157, 176, 275)
    - src/lib/auth/lastSignInAt.ts (or analog — verify getCurrentUser() shape returns viewerId)
    - src/data/follows.ts (FULL — confirms `isFollowing(followerId, followingId)` is exported at line 54)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-PATTERNS.md §2 (lines 196-200 — mount-site pattern note)
  </read_first>
  <action>
    Patch `src/app/u/[username]/[tab]/page.tsx` to thread the 4 new props into every LockedTabCard render (4 callsites at lines 148, 157, 176, 275).

    Step 1 — Locate where `getCurrentUser()` resolves in the page server component. Confirm the variable name (e.g., `user` or `viewer`).

    Step 2 — Add the deterministic isFollowing import (W2 fix — the helper is verified to exist at `src/data/follows.ts:54`; no conditional branching is needed):
    ```typescript
    import { isFollowing } from '@/data/follows'
    ```

    Step 3 — Compute `viewerId` and `currentPath` at the top of the page component body:
    ```typescript
    const viewerId = user?.id ?? null
    const currentPath = `/u/${params.username}/${params.tab}`
    ```
    Use the existing route params (the page is at `/u/[username]/[tab]`). If `params` is async per Next 16 (`await params`), preserve the existing await pattern from the file.

    Step 4 — Compute `targetUserId` from the existing profile fetch result. The page already resolves the target profile (look for `getProfileByUsername` near the top of the function); use the profile's `.id` field.

    Step 5 — Compute `initialIsFollowing` deterministically using the imported helper. Do NOT use the older "if helper exists, else inline query" pattern — the helper IS exported at `src/data/follows.ts:54` (verified by Read in `<read_first>`). The exact shape:
    ```typescript
    const initialIsFollowing =
      viewerId !== null ? await isFollowing(viewerId, targetProfile.id) : false
    ```

    Step 6 — Update each of the 4 LockedTabCard mount-sites (lines 148, 157, 176, 275 — line numbers approximate, search via `grep -n "LockedTabCard" src/app/u/[username]/[tab]/page.tsx`) to pass the new props:
    ```tsx
    <LockedTabCard
      tab="collection"  // or wishlist / notes / stats per existing
      displayName={profile.displayName}
      username={profile.username}
      viewerId={viewerId}
      targetUserId={targetProfile.id}
      initialIsFollowing={initialIsFollowing}
      currentPath={currentPath}
    />
    ```

    The existing `tab`, `displayName`, `username` props are preserved on every callsite.

    Forbidden:
    - Do NOT branch on whether `isFollowing` exists — it IS exported at `src/data/follows.ts:54`; the W2 fix is to import + call directly.
    - Do NOT inline-query the follows table from page.tsx — use the existing helper.
    - Do NOT change the conditional/branching logic around which LockedTabCard variant renders for which tab.
    - Do NOT compute `currentPath` from `headers()` or `window.location` — use the route params (server-component-safe, same-origin guaranteed).
    - Do NOT pass a different-origin URL into `currentPath`.
  </action>
  <verify>
    <automated>grep -c "LockedTabCard" 'src/app/u/[username]/[tab]/page.tsx'</automated>
    <automated>grep "import { isFollowing } from '@/data/follows'" 'src/app/u/[username]/[tab]/page.tsx'</automated>
    <automated>grep -c "viewerId={viewerId}" 'src/app/u/[username]/[tab]/page.tsx'</automated>
    <automated>grep -c "currentPath={currentPath}" 'src/app/u/[username]/[tab]/page.tsx'</automated>
    <automated>grep -c "initialIsFollowing={initialIsFollowing}" 'src/app/u/[username]/[tab]/page.tsx'</automated>
    <automated>grep "isFollowing(viewerId" 'src/app/u/[username]/[tab]/page.tsx'</automated>
    <automated>npx tsc --noEmit 2>&1 | grep -c "error TS"</automated>
    <automated>npm run build 2>&1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - `grep "import { isFollowing } from '@/data/follows'" 'src/app/u/[username]/[tab]/page.tsx'` returns 1 line (W2 fix — deterministic helper import)
    - `grep -E "viewerId !== null \? await isFollowing\(viewerId, targetProfile\.id\) : false" 'src/app/u/[username]/[tab]/page.tsx'` returns 1 line (deterministic call shape)
    - `grep -c "viewerId={viewerId}" 'src/app/u/[username]/[tab]/page.tsx'` returns ≥ 4 (all 4 callsites updated)
    - `grep -c "currentPath={currentPath}" 'src/app/u/[username]/[tab]/page.tsx'` returns ≥ 4
    - `grep -c "initialIsFollowing={initialIsFollowing}" 'src/app/u/[username]/[tab]/page.tsx'` returns ≥ 4
    - `grep -c "targetUserId=" 'src/app/u/[username]/[tab]/page.tsx'` returns ≥ 4
    - `grep "const currentPath = \`/u/" 'src/app/u/[username]/[tab]/page.tsx'` returns 1 line (same-origin pathname construction — T-39b-03)
    - `npx tsc --noEmit 2>&1 | grep -c "error TS"` ≤ 27 (Phase 36 baseline)
    - `npm run build 2>&1 | tail -3` exits 0 (catches any LockedTabCard interface drift)
  </acceptance_criteria>
  <done>
    All 4 LockedTabCard callsites updated; `isFollowing` imported deterministically from `@/data/follows`; type checks clean; build green.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Extend LockedTabCard test with 3 new D-39b-12 assertions</name>
  <files>tests/components/profile/LockedTabCard.test.tsx</files>
  <read_first>
    - tests/components/profile/LockedTabCard.test.tsx (FULL — current 8 tests)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-PATTERNS.md §14 (lines 1109-1166 — three new assertions ready to copy)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-UI-SPEC.md §Test Coverage Contract
  </read_first>
  <behavior>
    Three new assertions appended to the existing describe block:
    1. Renders FollowButton + caption for logged-in not-following viewer (viewerId set, initialIsFollowing=false) — asserts button name "Follow Tyler" + caption "Follow @tyler to see their collection."
    2. Renders sign-in Link for unauthenticated viewer (viewerId=null) — asserts Link role with name "Sign in to follow" + href "/signin?returnTo=%2Fu%2Ftyler%2Fcollection" + caption "Sign in to see @tyler's collection."
    3. tab === 'common-ground' returns null regardless of viewerId (Phase 39 D-09 regression guard)
  </behavior>
  <action>
    Append three new `it(...)` assertions to the existing describe block in `tests/components/profile/LockedTabCard.test.tsx` using 39b-PATTERNS.md §14 (lines 1116-1163) verbatim.

    Step 1 — Update existing 8 tests to pass the new required props. Either:
    (a) Add `viewerId={null} targetUserId="..." initialIsFollowing={false} currentPath="..."` to each existing render call, OR
    (b) Make the new props optional with defaults on LockedTabCard (NOT preferred — D-39b-12 requires these props to be load-bearing).

    Prefer option (a) — explicit prop threading at every existing test render keeps the surface deterministic.

    Step 2 — Append the three new it() blocks per 39b-PATTERNS.md §14 (lines 1116-1163):
    ```typescript
    it('renders FollowButton + caption for logged-in not-following viewer (D-39b-12)', () => { ... })
    it('renders sign-in Link for unauthenticated viewer (D-39b-12)', () => { ... })
    it('still returns null for tab=common-ground regardless of viewerId (D-39 D-09 regression guard)', () => { ... })
    ```

    Step 3 — In the unauthenticated test, assert the exact href: `expect(link.getAttribute('href')).toBe('/signin?returnTo=%2Fu%2Ftyler%2Fcollection')`. This is the encoded form of `/u/tyler/collection` and confirms T-39b-03 mitigation is wired.

    Forbidden: do NOT delete pre-existing tests. APPEND only (plus minimal prop-threading edits to existing tests as needed for type compatibility).
  </action>
  <verify>
    <automated>npx vitest run tests/components/profile/LockedTabCard.test.tsx 2>&1 | tail -20</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "it(" tests/components/profile/LockedTabCard.test.tsx` returns ≥ 11 (8 existing + 3 new)
    - `grep "renders FollowButton + caption" tests/components/profile/LockedTabCard.test.tsx` returns 1 line
    - `grep "renders sign-in Link" tests/components/profile/LockedTabCard.test.tsx` returns 1 line
    - `grep "common-ground regardless of viewerId" tests/components/profile/LockedTabCard.test.tsx` returns 1 line
    - `grep "/signin?returnTo=%2Fu%2Ftyler%2Fcollection" tests/components/profile/LockedTabCard.test.tsx` returns 1 line (encoded-returnTo assertion)
    - `npx vitest run tests/components/profile/LockedTabCard.test.tsx` exits 0 (all 11 tests pass)
  </acceptance_criteria>
  <done>
    LockedTabCard test suite asserts the three D-39b-12 branches. Pre-existing 8 tests still green after prop-threading update.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: Patch WornCalendar with selectedDate state + day-cell onClick + wear-detail panel + initialSelectedDate test-only prop (W1 fix)</name>
  <files>src/components/profile/WornCalendar.tsx</files>
  <read_first>
    - src/components/profile/WornCalendar.tsx (FULL — 181 lines; the WearEventLite.note field was extended in Plan 39b-01)
    - src/components/profile/StatsTabContent.tsx (lines 50-86 — analog image+name two-column layout used for the wear-detail row)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-PATTERNS.md §3 (lines 203-314 — selectedDate state + day-cell interactivity + wear-detail panel JSX + formatDateLabel helper all ready to copy)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-UI-SPEC.md §"Sub-cell #2: WornCalendar" (lines 326-373) + §Copywriting Contract (lines 542-545)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-CONTEXT.md D-39b-13 + §Specifics WornCalendar wear-detail panel content density
  </read_first>
  <behavior>
    1. `selectedDate` initializes to the first day-with-events on mount within the current cursor month (deterministic).
    2. NEW (W1 fix): an optional `initialSelectedDate?: string | null` prop. When provided (test-only usage), `useState` initializes directly to this value and the first-event-day mount effect is skipped via early-return; when undefined (production), the existing first-event-day effect runs unchanged.
    3. Day cells with `dayEvents.length > 0` gain:
       - `role="button"` (or wrap in `<button type="button">`)
       - `tabIndex={0}`
       - `onClick={() => setSelectedDate(key)}`
       - `onKeyDown` for Enter/Space (preventDefault + setSelectedDate)
       - `aria-label="View wear events for {key}"`
       - `cursor-pointer hover:bg-muted/60` when interactive
       - `ring-2 ring-foreground/20` when `selectedDate === key`
    4. Day cells with 0 events remain non-interactive (no onClick, no role/tabIndex).
    5. Wear-detail panel renders BELOW the grid `<div className="grid grid-cols-7 gap-1">`:
       - When `selectedDate === null` → panel absent
       - When `selectedDate` set, `dayEvents.length === 0` → `<p>"No wear events on {formatDateLabel(selectedDate)}."</p>`
       - When `selectedDate` set, `dayEvents.length > 0` → `<ul>` of events (image + brand + model + notes)
    6. `formatDateLabel(yyyyMmDd)` uses `Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' })` (e.g., "Wed, May 13").
  </behavior>
  <action>
    Patch `src/components/profile/WornCalendar.tsx`:

    Step 1 — Confirm `'use client'` is at the top (existing — WornCalendar is already a client component per CONTEXT D-39b-13).

    Step 2 — Add `useEffect` to the existing React import if not already present.

    Step 3 — Extend the `WornCalendarProps` interface (W1 fix — add `initialSelectedDate`):
    ```typescript
    interface WornCalendarProps {
      events: WearEventLite[]
      watchMap: Record<string, { id: string; brand: string; model: string; imageUrl: string | null }>
      // Test-only override (W1 fix — Phase 39b). Defaults to undefined; when undefined,
      // production code path is unchanged. When provided (incl. when null), useState is
      // initialized directly to this value and the first-event-day mount effect is skipped.
      // Used exclusively by tests/components/profile/WornCalendar.test.tsx test #3 to
      // exercise the empty-day caption code path deterministically.
      initialSelectedDate?: string | null
    }
    ```

    Step 4 — Update the component signature to destructure the new prop:
    ```typescript
    export function WornCalendar({ events, watchMap, initialSelectedDate }: WornCalendarProps) {
    ```

    Step 5 — Initialize `selectedDate` state from the new prop. Add below the existing `useState({year, month})` cursor (around lines 67-71):
    ```typescript
    const [selectedDate, setSelectedDate] = useState<string | null>(
      initialSelectedDate !== undefined ? initialSelectedDate : null,
    )
    ```
    The check is `!== undefined` (NOT truthiness) — `null` is a valid pre-selected value (forces "no day selected at all" in tests).

    Step 6 — Add the mount-time initial selection effect (39b-PATTERNS.md §3 lines 220-231), with an early-return when `initialSelectedDate` was provided:
    ```typescript
    useEffect(() => {
      // W1 fix: when initialSelectedDate was provided (test-only), skip the
      // first-event-day initialization to preserve the test-driven state.
      if (initialSelectedDate !== undefined) return
      if (selectedDate !== null) return  // user already selected
      const monthKeys = Object.keys(eventsByDay).filter((k) => {
        const [y, m] = k.split('-')
        return Number(y) === cursor.year && Number(m) === cursor.month + 1
      }).sort()
      if (monthKeys.length > 0) setSelectedDate(monthKeys[0])
    }, [eventsByDay, cursor, selectedDate, initialSelectedDate])
    ```

    Step 7 — Replace the existing static day-cell `<div>` at WornCalendar.tsx:148-176 with the interactive shape from 39b-PATTERNS.md §3 lines 236-263. Use a wrapping `<button type="button">` when `dayEvents.length > 0`, else keep as `<div>` (UI-SPEC §Server vs Client constraints prefers wrapping in a button for semantic correctness).

    Step 8 — Append the wear-detail panel JSX BELOW the grid `<div className="grid grid-cols-7 gap-1">` (39b-PATTERNS.md §3 lines 267-301 — copy verbatim). Use `getSafeImageUrl` from the existing import (verify it's already imported at the top of WornCalendar.tsx; if not, add the import — same util used by StatsTabContent.tsx).

    Step 9 — Define `formatDateLabel` as an inline helper inside the file (or at module top — either acceptable):
    ```typescript
    function formatDateLabel(yyyyMmDd: string): string {
      const [y, m, d] = yyyyMmDd.split('-').map(Number)
      return new Intl.DateTimeFormat('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
      }).format(new Date(y, m - 1, d))
    }
    ```

    Step 10 — Empty-day caption copy (UI-SPEC §Copywriting Contract):
    `No wear events on ${formatDateLabel(selectedDate)}.` (period required)

    Note on the test-only prop trade-off (recorded here per W1 fix instructions, NOT in the SUMMARY): adding a test-only prop to a production component is a controlled trade-off. The alternative (asserting empty-day rendering via source-file `readFileSync` grep) proves the template exists but not that the conditional logic surfaces it. The `initialSelectedDate` prop is a small, well-defined extension that lets the test exercise the real code path. Defaults are chosen so production behavior is byte-identical to the pre-W1 design.

    Forbidden:
    - Do NOT remove the existing month-cursor or grid rendering.
    - Do NOT modify the today-cell `ring-1 ring-accent` styling (UI-SPEC §Color §Accent reserved for).
    - Do NOT add a modal/sheet overlay (CONTEXT §Deferred Ideas — below-calendar panel only).
    - Do NOT add wear-time or photos to per-event rendering (UI-SPEC §Deferred — image + brand + model + notes is the full content density).
    - Do NOT use `initialSelectedDate` in production callers (it's test-only; production caller in `src/app/u/[username]/[tab]/page.tsx` should NOT pass this prop).
  </action>
  <verify>
    <automated>grep -c "selectedDate" src/components/profile/WornCalendar.tsx</automated>
    <automated>grep "initialSelectedDate" src/components/profile/WornCalendar.tsx</automated>
    <automated>grep "setSelectedDate" src/components/profile/WornCalendar.tsx | head -3</automated>
    <automated>grep "No wear events on" src/components/profile/WornCalendar.tsx</automated>
    <automated>grep "formatDateLabel" src/components/profile/WornCalendar.tsx</automated>
    <automated>grep "aria-label" src/components/profile/WornCalendar.tsx | head -3</automated>
    <automated>grep "onKeyDown" src/components/profile/WornCalendar.tsx</automated>
    <automated>npx tsc --noEmit 2>&1 | grep -c "error TS"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "selectedDate" src/components/profile/WornCalendar.tsx` returns ≥ 6 (state declaration + effect deps + onClick + ring class + panel conditional + initialSelectedDate prop)
    - `grep -c "initialSelectedDate" src/components/profile/WornCalendar.tsx` returns ≥ 3 (interface field + signature destructure + useEffect guard)
    - `grep "setSelectedDate" src/components/profile/WornCalendar.tsx` returns ≥ 3 lines (effect + onClick + onKeyDown)
    - `grep "No wear events on" src/components/profile/WornCalendar.tsx` returns 1 line (load-bearing copy)
    - `grep "formatDateLabel" src/components/profile/WornCalendar.tsx` returns ≥ 2 lines (definition + usage)
    - `grep "aria-label" src/components/profile/WornCalendar.tsx` returns ≥ 1 line (day-cell button a11y per UI-SPEC §Screen-reader contract)
    - `grep "onKeyDown" src/components/profile/WornCalendar.tsx` returns ≥ 1 line (keyboard a11y)
    - `grep "ring-2 ring-foreground/20" src/components/profile/WornCalendar.tsx` returns ≥ 1 line (selected-cell styling per UI-SPEC §Pointer/hover)
    - `grep -cE "^['\"]use client['\"]" src/components/profile/WornCalendar.tsx` returns 1 (already a client component — preserved)
    - `npx tsc --noEmit 2>&1 | grep -c "error TS"` ≤ 27 (Phase 36 baseline)
  </acceptance_criteria>
  <done>
    WornCalendar has selectedDate state, interactive day cells (events > 0), wear-detail panel below the grid, empty-day caption, formatDateLabel helper, and the test-only `initialSelectedDate` prop (W1 fix). A11y: aria-label + onKeyDown on interactive cells. Production callers (not passing the prop) are byte-equivalent to the pre-W1 design.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 5: Create WornCalendar component test (W1 fix — initialSelectedDate-driven empty-day assertion)</name>
  <files>tests/components/profile/WornCalendar.test.tsx</files>
  <read_first>
    - tests/components/profile/LockedTabCard.test.tsx (structural analog — describe + render + assertions)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-PATTERNS.md §15 (lines 1170-1215 — three tests ready to copy with structure)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-UI-SPEC.md §Test Coverage Contract (lines 626-627 — three coverage assertions)
    - src/components/profile/WornCalendar.tsx (now patched with selectedDate state + panel + initialSelectedDate prop — Task 4)
  </read_first>
  <behavior>
    Three tests:
    1. `selectedDate` initializes to first day with events on mount (no `initialSelectedDate` passed — production code path) → asserts the first event's note ("breakfast wear") is visible in the panel.
    2. Clicking a day-cell-with-events sets selectedDate → panel updates to show the clicked event's note ("evening wear").
    3. Empty-day selection renders the "No wear events on {date}." caption — driven by `initialSelectedDate="2026-05-12"` (a YYYY-MM-DD with no events in the test fixture). W1 fix: no `readFileSync` grep fallback; the assertion uses `screen.getByText` against the rendered DOM directly.
  </behavior>
  <action>
    Create `tests/components/profile/WornCalendar.test.tsx`. Three tests; W1 fix mandates that test #3 uses the new `initialSelectedDate` prop to drive the empty-day code path through the real component logic — NOT a `readFileSync` source-file grep.

    ```typescript
    import { render, fireEvent, screen } from '@testing-library/react'
    import { describe, it, expect } from 'vitest'
    import { WornCalendar } from '@/components/profile/WornCalendar'

    describe('WornCalendar', () => {
      it('selects first day with events on mount', () => {
        render(
          <WornCalendar
            events={[
              { id: 'e1', watchId: 'w1', wornDate: '2026-05-03', note: 'breakfast wear' },
              { id: 'e2', watchId: 'w1', wornDate: '2026-05-10', note: null },
            ]}
            watchMap={{ w1: { id: 'w1', brand: 'Rolex', model: 'Submariner', imageUrl: null } }}
          />,
        )
        expect(screen.getByText('breakfast wear')).toBeTruthy()
      })

      it('sets selectedDate on day-with-events click', () => {
        render(
          <WornCalendar
            events={[
              { id: 'e1', watchId: 'w1', wornDate: '2026-05-03', note: 'breakfast wear' },
              { id: 'e2', watchId: 'w1', wornDate: '2026-05-10', note: 'evening wear' },
            ]}
            watchMap={{ w1: { id: 'w1', brand: 'Rolex', model: 'Submariner', imageUrl: null } }}
          />,
        )
        fireEvent.click(screen.getByLabelText(/View wear events for 2026-05-10/))
        expect(screen.getByText('evening wear')).toBeTruthy()
      })

      it('renders "No wear events on …" caption when an empty day is selected (W1 fix — initialSelectedDate prop)', () => {
        // W1 fix: use the test-only initialSelectedDate prop to drive the empty-day
        // code path. The fixture has events on 2026-05-03 and 2026-05-10, but the
        // initial selection of 2026-05-12 has zero events, so the conditional logic
        // in WornCalendar's wear-detail panel surfaces the empty-day caption.
        render(
          <WornCalendar
            events={[
              { id: 'e1', watchId: 'w1', wornDate: '2026-05-03', note: 'breakfast wear' },
              { id: 'e2', watchId: 'w1', wornDate: '2026-05-10', note: 'evening wear' },
            ]}
            watchMap={{ w1: { id: 'w1', brand: 'Rolex', model: 'Submariner', imageUrl: null } }}
            initialSelectedDate="2026-05-12"
          />,
        )
        // Assert the rendered text from the conditional empty-day branch.
        // formatDateLabel('2026-05-12') in en-US produces e.g. "Tue, May 12".
        expect(screen.getByText(/No wear events on /)).toBeTruthy()
      })
    })
    ```

    Verify the exact prop names (`events`, `watchMap`, `initialSelectedDate`) match the component's actual interface by reading `WornCalendar.tsx` prop interface at the top of the file (after Task 4's patch).

    Forbidden:
    - Do NOT use `readFileSync` or any source-file grep in this test (W1 fix — the previous design was rejected; assert against rendered DOM only).
    - Do NOT mock React's `useEffect` or `useState`.
    - Do NOT use `jest.fn()` — vitest uses `vi.fn()` if mocks are needed (none expected for this test).
  </action>
  <verify>
    <automated>test -f tests/components/profile/WornCalendar.test.tsx && echo "file exists"</automated>
    <automated>grep -c "readFileSync" tests/components/profile/WornCalendar.test.tsx</automated>
    <automated>grep "initialSelectedDate" tests/components/profile/WornCalendar.test.tsx</automated>
    <automated>npx vitest run tests/components/profile/WornCalendar.test.tsx 2>&1 | tail -20</automated>
  </verify>
  <acceptance_criteria>
    - `test -f tests/components/profile/WornCalendar.test.tsx` exits 0
    - `grep -c "it(" tests/components/profile/WornCalendar.test.tsx` returns ≥ 3
    - `grep "selects first day with events on mount" tests/components/profile/WornCalendar.test.tsx` returns 1 line
    - `grep "fireEvent.click" tests/components/profile/WornCalendar.test.tsx` returns ≥ 1 line (day-cell click assertion)
    - `grep "initialSelectedDate=\"2026-05-12\"" tests/components/profile/WornCalendar.test.tsx` returns 1 line (W1 fix — empty-day driver via prop)
    - `grep -c "readFileSync" tests/components/profile/WornCalendar.test.tsx` returns 0 (W1 fix — no source-file grep fallback)
    - `grep "screen.getByText(/No wear events on /)" tests/components/profile/WornCalendar.test.tsx` returns 1 line (W1 fix — DOM-level assertion against the conditional rendering, not a grep)
    - `npx vitest run tests/components/profile/WornCalendar.test.tsx` exits 0 (all tests pass)
  </acceptance_criteria>
  <done>
    WornCalendar test suite (3 tests) green. First-event-day selection on mount, day-cell click → panel update, and empty-day caption all asserted via real DOM rendering. W1 fix: test #3 uses the `initialSelectedDate` prop instead of a `readFileSync` source-file grep.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 6: Wrap StatsTabContent WornList <li> rows in <Link></name>
  <files>src/components/profile/StatsTabContent.tsx</files>
  <read_first>
    - src/components/profile/StatsTabContent.tsx (FULL — 86 lines; WornList interior at lines 50-82)
    - src/components/insights/CollectionFitCard.tsx (lines 71-81 — canonical Link-wrap pattern from Phase 39 D-07 / NSV-01+15 lock)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-PATTERNS.md §4 (lines 318-362 — Link-wrap excerpt + concrete patch)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-UI-SPEC.md §"Sub-cell #3: StatsTabContent" (lines 375-393)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-CONTEXT.md D-39b-14
  </read_first>
  <behavior>
    Each `<li>` in WornList (Most Worn + Least Worn) wraps content in `<Link href='/watch/${watch.id}' className='flex items-center gap-3 rounded-md p-1 hover:bg-accent'>`. The previous flex container classes migrate from `<li>` to `<Link>`. `<li>` becomes a pure wrapper with no className. HorizontalBarChart bars in Style/Role distribution at lines 38-43 stay non-clickable.
  </behavior>
  <action>
    Patch `src/components/profile/StatsTabContent.tsx` at the WornList interior (lines 50-82).

    Step 1 — Add `Link` import at the top:
    ```typescript
    import Link from 'next/link'
    ```

    Step 2 — Inside the WornList `.map()` body, replace the existing `<li className="flex items-center gap-3">` with:
    ```tsx
    <li key={watch.id}>
      <Link
        href={`/watch/${watch.id}`}
        className="flex items-center gap-3 rounded-md p-1 hover:bg-accent"
      >
        {/* existing image + name + count markup, unchanged */}
      </Link>
    </li>
    ```

    Step 3 — Verify the BOTH Most Worn and Least Worn lists at WornList go through the same `.map()` body (a single shared component) — patching the WornList internal function handles both lists.

    Step 4 — Critical lock (D-39b-14):
    - `HorizontalBarChart` bars in Style Distribution + Role Distribution at StatsTabContent.tsx:38-43 (or wherever they appear in the file) MUST stay non-clickable.
    - Do NOT wrap `HorizontalBarChart` props or `<div>` chart containers in `<Link>`.
    - Document explicitly in the SUMMARY: "HorizontalBarChart bars verified unwrapped (D-39b-14 lock)."

    Forbidden:
    - Do NOT wrap the chart bars in Link (D-39b-14 + UI-SPEC §"Sub-cell #3" + Out-of-Scope Visual Concerns).
    - Do NOT change `hover:bg-accent` to any other color (Phase 39 D-07 lock — matches NSV-01+15 ship verbatim).
    - Do NOT change the inner padding from `p-1` (D-07 xs token).
  </action>
  <verify>
    <automated>grep -c "href={\`/watch/\${watch.id}\`}" src/components/profile/StatsTabContent.tsx</automated>
    <automated>grep "hover:bg-accent" src/components/profile/StatsTabContent.tsx</automated>
    <automated>grep "import Link from 'next/link'" src/components/profile/StatsTabContent.tsx</automated>
    <automated>npx tsc --noEmit 2>&1 | grep -c "error TS"</automated>
    <automated>npm test 2>&1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "href={\`/watch/\${watch.id}\`}" src/components/profile/StatsTabContent.tsx` returns ≥ 1 line (Link wrap present — Most Worn + Least Worn share the same component so a single match is sufficient)
    - `grep "hover:bg-accent" src/components/profile/StatsTabContent.tsx` returns ≥ 1 line (D-07 hover lock)
    - `grep "rounded-md p-1" src/components/profile/StatsTabContent.tsx` returns ≥ 1 line (D-07 padding lock)
    - `grep "import Link from 'next/link'" src/components/profile/StatsTabContent.tsx` returns 1 line
    - `grep -c "HorizontalBarChart" src/components/profile/StatsTabContent.tsx` returns the SAME count as BEFORE the patch (no chart wrapping per D-39b-14)
    - `npx tsc --noEmit 2>&1 | grep -c "error TS"` ≤ 27
    - `npm test 2>&1 | tail -3` — no NEW test failures other than the intentional RED state from Plan 39b-01 Task 2 (the `tests/static/hierarchy.lineage-3-node.test.ts` assertion "getSameFamilyForCatalog function is exported" remains RED until Plan 39b-05 lands the DAL). Phase 36 baseline otherwise preserved.
  </acceptance_criteria>
  <done>
    WornList <li> rows wrap content in <Link>. HorizontalBarChart bars remain non-clickable (D-39b-14 lock verified). Hover + padding match Phase 39 D-07 lock.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Unauthenticated viewer → `/signin?returnTo=X` | LockedTabCard emits a `returnTo` query value derived from same-origin pathname; the `/signin` consumer enforces validateReturnTo (Phase 28 D-11) on receipt |
| Server RSC (LockedTabCard) → Client island (FollowButton) | Props must be serializable; Next 16 enforces; PopularCollectorRow precedent is the canonical analog |
| WornCalendar (client) → wear event data | Event notes are user-authored strings displayed via React text nodes (auto-escaped) |
| WornCalendar `initialSelectedDate` test-only prop | Prop is structurally test-only (defaults to undefined in production callers); a malicious caller passing a crafted value cannot exfiltrate data — the prop is just a string used to drive useState; render output is determined by the existing event-day filter logic |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-39b-03 | Tampering (Open Redirect) | src/components/profile/LockedTabCard.tsx (unauthenticated branch) | mitigate | `currentPath` is constructed from server-side route params (`/u/${params.username}/${params.tab}` — same-origin pathname only); `encodeURIComponent(currentPath)` is applied at render time before insertion into the href; consumer-side `validateReturnTo` (Phase 28 D-11 — src/lib/watchFlow/destinations.ts:22) rejects absolute URLs and off-origin paths on the `/signin` receiver. Test #3 in Task 3 asserts the encoded href shape. |
| Bundle bloat from server-imports-client | DoS-low | src/components/profile/LockedTabCard.tsx | mitigate | LockedTabCard stays a Server Component; FollowButton is a Client Component imported per PopularCollectorRow canonical analog (Pitfall 8); static grep gate in this plan: `grep -cE "^['\"]use client['\"]" src/components/profile/LockedTabCard.tsx` returns 0 |
| XSS via wear-event notes | XSS | src/components/profile/WornCalendar.tsx (wear-detail panel) | mitigate | Notes rendered via React text node `{event.note}` — auto-escaped; no `dangerouslySetInnerHTML`; notes are user-authored but only viewable by the profile owner OR by viewers who passed Phase 11 worn-tab privacy gate at the parent page |
| Self-XSS via collector username in caption | XSS | src/components/profile/LockedTabCard.tsx | mitigate | Username read from `profiles.username` (validated at signup, regex-enforced); rendered as React text via `{username}` interpolation; auto-escaped |
| Test-only prop misuse in production | Tampering (very-low) | src/components/profile/WornCalendar.tsx (`initialSelectedDate`) | accept | The prop is documented test-only; production caller (`src/app/u/[username]/[tab]/page.tsx`) does not pass it; even if a future caller did, the value only drives `useState` initialization and is consumed identically to a user click — no privacy or auth surface. |
</threat_model>

<verification>
After all 6 tasks:
- `npx vitest run tests/components/profile/LockedTabCard.test.tsx tests/components/profile/WornCalendar.test.tsx` exits 0
- `npm test 2>&1 | tail -10` — no NEW test failures other than the intentional RED state from Plan 39b-01 Task 2 (the `tests/static/hierarchy.lineage-3-node.test.ts` assertion "getSameFamilyForCatalog function is exported" remains RED until Plan 39b-05 lands the DAL). Phase 36 baseline otherwise preserved.
- `npm run build 2>&1 | tail -10` exits 0 (Next 16 server/client boundary check)
- Manual smoke (operator UAT, optional):
  - Sign in as viewer-A; navigate to `/u/{username}/collection` for a profile that locks collection — verify FollowButton + caption "Follow @{username} to see their collection." render.
  - Sign out; navigate to the same URL — verify sign-in Link with href `/signin?returnTo=%2Fu%2F{username}%2Fcollection` + caption render.
  - Navigate to `/u/{username}/worn` (assuming public worn) — verify WornCalendar's first event-day is selected on mount; click another event-day; verify panel updates.
  - Navigate to `/u/{username}/stats` — verify Most Worn + Least Worn list rows are clickable; verify Style/Role bars are not clickable.
</verification>

<success_criteria>
- LockedTabCard sub-cell: D-39b-12 captions + FollowButton + sign-in Link branches all render correctly; common-ground regression guard green (Phase 33b SC#3)
- W2 fix: `src/app/u/[username]/[tab]/page.tsx` imports `isFollowing` directly from `@/data/follows` and calls it deterministically (no conditional "if helper exists" branching)
- WornCalendar sub-cell: day-cell onClick wires the wear-detail panel with image + brand + model + notes; first event-day selected on mount; empty-day caption renders (SC#3)
- W1 fix: WornCalendar exposes a test-only `initialSelectedDate` prop; the empty-day test (#3) asserts via `screen.getByText` against the rendered DOM with no `readFileSync` source-file grep
- StatsTabContent sub-cell: WornList <li> rows wrap in `<Link>`; HorizontalBarChart bars verified unwrapped (D-39b-14 lock; SC#3)
- All 3 sub-cells have a passing test asserting the affordance is reachable (Phase 33b ROADMAP SC#3)
- T-39b-03 mitigation: sign-in href is `/signin?returnTo={encodeURIComponent(samedOriginPathname)}` — asserted by test
- No new tsc errors above Phase 36 baseline (27); npm run build green
</success_criteria>

<output>
After completion, create `.planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-03-SUMMARY.md` with:
- Sub-cell ship state per task
- Test transition (existing 8 → 11 LockedTabCard tests; 0 → 3 WornCalendar tests)
- W1 fix proof: `grep -c "readFileSync" tests/components/profile/WornCalendar.test.tsx` returns 0; test #3 uses `initialSelectedDate="2026-05-12"` to drive the empty-day code path
- W2 fix proof: page.tsx imports `isFollowing` from `@/data/follows`; call shape is `viewerId !== null ? await isFollowing(viewerId, targetProfile.id) : false`
- T-39b-03 mitigation verification: include the asserted encoded href shape from test #2 of Task 3
- D-39b-14 lock confirmation: HorizontalBarChart bars verified unwrapped (count of HorizontalBarChart references unchanged)
- Note any deviation from UI-SPEC §"Sub-cell #1..#3" or D-39b-12..D-39b-14
</output>
</content>
</invoke>