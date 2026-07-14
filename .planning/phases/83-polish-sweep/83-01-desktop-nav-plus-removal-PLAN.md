---
phase: 83-polish-sweep
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/layout/DesktopTopNav.tsx
  - tests/components/layout/DesktopTopNav.test.tsx
autonomous: true
requirements:
  - POLISH-01
tags:
  - ui
  - nav
  - polish

must_haves:
  truths:
    - "On the desktop top nav (viewport ≥ md), the user does NOT see a `+` add-watch icon-button (POLISH-01, per D-01)."
    - "The add flow remains reachable via the existing `AddWatchCard` entries on Collection and Wishlist tabs — no substitute affordance is added to DesktopTopNav (per D-02)."
    - "The mobile `BottomNav` is unchanged — it never had a `+` add-watch button in the first place (per D-01)."
    - "DesktopTopNav.test.tsx passes with the add-watch link assertions removed/rewritten to reflect the new nav composition (per D-12)."
  artifacts:
    - path: src/components/layout/DesktopTopNav.tsx
      provides: "Desktop top chrome without the `+` add-watch Link/Button/Plus block"
      contains: "no `Plus` import; no `<Link href=\"/watch/new?returnTo=...\" aria-label=\"Add watch\">`"
    - path: tests/components/layout/DesktopTopNav.test.tsx
      provides: "Updated assertions consistent with the removed `+` button"
      contains: "no `screen.getByRole('link', { name: /add watch/i })` assertion in a `.toBeInTheDocument()` positive-check; obsolete Test 10 removed or rewritten"
  key_links:
    - from: "src/components/layout/DesktopTopNav.tsx"
      to: "no consumer"
      via: "the `+` button link's removal has no downstream consumer — `AddWatchCard` remains the canonical entry point (D-02)"
      pattern: "AddWatchCard"
---

<objective>
POLISH-01: Remove the `+` add-watch icon-button from the desktop top nav (`DesktopTopNav.tsx`) and update `DesktopTopNav.test.tsx` assertions accordingly. No substitute affordance is added; the `AddWatchCard` entries on the Collection and Wishlist tabs remain the canonical add-flow entry points per CONTEXT.md D-01/D-02.

Purpose: The `+` icon-button is redundant with the existing `AddWatchCard` cards and clutters the desktop chrome. Removing it unblocks the v9.0 polish sweep before any schema work begins.

Output: `src/components/layout/DesktopTopNav.tsx` without the `Plus` import and without the `<Link>/<Button variant="ghost" size="icon">/<Plus>` block at lines 98-105. `tests/components/layout/DesktopTopNav.test.tsx` updated so no test asserts the presence of an "Add watch" link.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/83-polish-sweep/83-CONTEXT.md
@CLAUDE.md
@AGENTS.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove the desktop `+` add-watch button and its Plus import from DesktopTopNav.tsx</name>
  <read_first>
    - src/components/layout/DesktopTopNav.tsx (target file — the full file must be read before editing so the executor understands the Plus import site at line 5, the button block at lines 98-105, and the surrounding right-hand-side chrome composition)
    - .planning/phases/83-polish-sweep/83-CONTEXT.md (locked decisions D-01 + D-02; explicitly names the exact lines to remove and forbids substitutions)
  </read_first>
  <files>src/components/layout/DesktopTopNav.tsx</files>
  <action>
    Per D-01 (POLISH-01):

    1) In the import list at the top of the file, remove `Plus` from the lucide-react import. Keep `Search` (still used by the persistent search input). The line currently reads `import { Plus, Search } from 'lucide-react'` — after the edit it must read `import { Search } from 'lucide-react'`.

    2) In the right-hand-side chrome block inside the `{user && (...)}` fragment (currently lines 95-108), remove the entire `<Link href={\`/watch/new?returnTo=${encodeURIComponent(pathname || '/')}\`} aria-label="Add watch"> ... </Link>` element that wraps the `<Button variant="ghost" size="icon"><Plus className="h-5 w-5" aria-hidden /></Button>`. This is the block currently at lines 98-105. The `NavWearButton` (before) and `{bell}` (after) MUST remain and MUST stay in their current sibling order — `NavWearButton` then `{bell}`, with no `+` link in between.

    3) Do NOT add any substitute affordance (no icon, no hover popover, no keyboard shortcut, no aria hint). Per D-02, `AddWatchCard` on the Collection and Wishlist tab bodies remains the canonical entry point; no chrome-level replacement is desired.

    4) Do NOT touch `pathname` local variable, `handleSearchSubmit`, the `<header>` sticky/z-50 chrome, the wordmark, the Explore link, the search form, `NavWearButton`, `bell`, `UserMenu`, or the `isPublicPath(pathname)` early return.

    5) Do NOT touch the JSDoc header comment above the component — it still accurately describes the chrome even without the Add icon; if the executor wants precision, they may drop the ` · Add icon` fragment from the "Composition (left → right):" line, but any rewrite must preserve every other detail.

    Verify visually by scanning the diff: the deletion should be a contiguous 8-line JSX block + one-token import edit, nothing else.
  </action>
  <verify>
    <automated>cd /Users/tylerwaneka/Documents/horlo &amp;&amp; ( grep -n 'Plus' src/components/layout/DesktopTopNav.tsx | grep -v '^[[:space:]]*//' | grep -v '^[[:space:]]*\*' ; grep -n 'aria-label="Add watch"' src/components/layout/DesktopTopNav.tsx ; grep -n '/watch/new?returnTo=' src/components/layout/DesktopTopNav.tsx ) ; echo "---expect all three greps to produce zero matches---"</automated>
  </verify>
  <acceptance_criteria>
    - Source assertion: `grep -c 'Plus' src/components/layout/DesktopTopNav.tsx` returns 0 (no import, no JSX reference).
    - Source assertion: `grep -c 'aria-label="Add watch"' src/components/layout/DesktopTopNav.tsx` returns 0.
    - Source assertion: `grep -c '/watch/new?returnTo=' src/components/layout/DesktopTopNav.tsx` returns 0.
    - Source assertion: `grep -c 'from '\''lucide-react'\''' src/components/layout/DesktopTopNav.tsx` returns 1 and the same line contains `Search` (verify by `grep -n 'from ' src/components/layout/DesktopTopNav.tsx | grep lucide-react` — output line contains `{ Search }`).
    - Source assertion: `NavWearButton` still appears exactly once inside `DesktopTopNav.tsx` (`grep -c 'NavWearButton' src/components/layout/DesktopTopNav.tsx` returns 2 — 1 import + 1 JSX use).
    - Build gate: `npm run build` exits 0.
  </acceptance_criteria>
  <done>DesktopTopNav.tsx no longer imports or renders the `Plus` icon or the `/watch/new?returnTo=...` link; surrounding chrome (NavWearButton, bell, UserMenu) preserved in order.</done>
</task>

<task type="auto">
  <name>Task 2: Update DesktopTopNav.test.tsx assertions to match the removed `+` button</name>
  <read_first>
    - tests/components/layout/DesktopTopNav.test.tsx (target file — the full test file must be read; the three affected tests are Test 9 at line 41 with the `getByRole('link', { name: /add watch/i })` positive assertion, Test 10 at line 53 which is entirely about the add link href, and Test 15 at line 108 which asserts the add link is NOT rendered when user is null)
    - src/components/layout/DesktopTopNav.tsx (post-Task-1 state — verifies the composition the tests now describe)
    - .planning/phases/83-polish-sweep/83-CONTEXT.md (D-12: no new tests introduced; existing tests get their assertions updated)
  </read_first>
  <files>tests/components/layout/DesktopTopNav.test.tsx</files>
  <action>
    Per D-12 (no new tests introduced; existing tests updated to reflect new composition):

    1) Test 9 (currently at line 41, describes "renders wordmark, search input, NavWearButton, Add icon, NotificationBell, UserMenu (all present)"): remove the line `expect(screen.getByRole('link', { name: /add watch/i })).toBeInTheDocument()` (currently line 48). Update the test name string by dropping the ", Add icon" fragment so the name reads "renders wordmark, search input, NavWearButton, NotificationBell, UserMenu (all present)". Do NOT touch the other five assertions in this test (`Horlo` wordmark, search input `input[type="search"]`, `nav-wear` testid, `bell` testid, `user-menu` testid).

    2) Test 10 (currently at line 53, describes "Add icon link points at /watch/new with Phase 28 ?returnTo= capture"): DELETE the entire `it(...)` block. The behavior no longer exists — there is no "Add icon link" to assert against. Do NOT convert to a `.skip` or a `.todo`; delete outright.

    3) Test 15 (currently at line 108, describes "when user is null, NavWearButton and Add link are NOT rendered"): remove the line `expect(screen.queryByRole('link', { name: /add watch/i })).toBeNull()` (currently line 119). Update the test name to "when user is null, NavWearButton is NOT rendered". The remaining `nav-wear` testid assertion stays and is now the sole assertion in the test.

    4) All other tests in the file are unrelated (search input styling, form submit routing, sticky positioning, theme toggle absence, Phase 16 D-23 header nav removal, Phase 16 D-24 search restyle) and MUST NOT be modified.

    5) Do NOT touch the `vi.mock(...)` setup at the top of the file, the `userProps()` helper, or the `mockPathname` handling.
  </action>
  <verify>
    <automated>cd /Users/tylerwaneka/Documents/horlo &amp;&amp; ( grep -c 'name: /add watch/i' tests/components/layout/DesktopTopNav.test.tsx ; grep -c "'Test 10 —" tests/components/layout/DesktopTopNav.test.tsx ; npx vitest run tests/components/layout/DesktopTopNav.test.tsx --reporter=basic 2>&amp;1 | tail -20 )</automated>
  </verify>
  <acceptance_criteria>
    - Source assertion: `grep -c 'name: /add watch/i' tests/components/layout/DesktopTopNav.test.tsx` returns 0 (all three add-watch link assertions removed).
    - Source assertion: `grep -c "'Test 10 —" tests/components/layout/DesktopTopNav.test.tsx` returns 0 (Test 10 fully deleted).
    - Source assertion: The literal string `"Add icon"` no longer appears in the test file (`grep -c 'Add icon' tests/components/layout/DesktopTopNav.test.tsx` returns 0).
    - Test gate: `npx vitest run tests/components/layout/DesktopTopNav.test.tsx` reports 0 failed tests. Test count decreases by exactly 1 vs. the pre-plan baseline (Test 10 deleted; Tests 9 and 15 shrunk but not removed).
    - Build gate: `npm run build` exits 0.
    - Local-First verification surface (per D-13 — for the human walker, not part of the automated gate): `npm run dev` against local Supabase; sign in as `viewer@horlo.test`; on a desktop viewport (≥ md) confirm the top nav shows Explore, search, wear button, bell, user menu — and NO `+` icon. Confirm the mobile `BottomNav` is unchanged (there was never a `+` there).
  </acceptance_criteria>
  <done>DesktopTopNav.test.tsx passes with all `add watch` link assertions removed and Test 10 deleted; test file count decreases by exactly 1.</done>
</task>

</tasks>

<verification>
- `npm run build` exits 0 (build gate is authoritative per project memory `project_baseline_not_green_build_is_gate`).
- `npx vitest run tests/components/layout/DesktopTopNav.test.tsx` — 0 failed.
- `grep -c 'Plus\|aria-label="Add watch"\|/watch/new?returnTo=' src/components/layout/DesktopTopNav.tsx` returns 0.
- Local-First per D-13: `npm run dev` desktop walk shows the `+` gone; mobile `BottomNav` unchanged.
</verification>

<success_criteria>
- POLISH-01 satisfied: desktop nav has no `+` add-watch icon-button.
- No substitute affordance introduced (per D-02).
- Existing tests updated (per D-12) — no new tests added.
- Mobile `BottomNav` unchanged (per D-01).
</success_criteria>

<output>
After completion, create `.planning/phases/83-polish-sweep/83-01-SUMMARY.md`.
</output>
