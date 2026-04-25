---
phase: 16-people-search
plan: 04
type: execute
wave: 1
depends_on:
  - 16-01
files_modified:
  - src/components/layout/DesktopTopNav.tsx
  - src/components/layout/HeaderNav.tsx
  - tests/components/layout/HeaderNav.test.tsx
  - tests/components/layout/DesktopTopNav.test.tsx
autonomous: true
requirements:
  - SRCH-01

must_haves:
  truths:
    - "tests/components/layout/DesktopTopNav.test.tsx no longer mocks @/components/layout/HeaderNav and no longer asserts on the legacy header-nav testid (Task 0 cleanup)"
    - "src/components/layout/HeaderNav.tsx is deleted from the codebase (D-23)"
    - "DesktopTopNav.tsx has no import of HeaderNav (D-23)"
    - "DesktopTopNav.tsx persistent search input shows a leading lucide Search icon (D-24)"
    - "DesktopTopNav.tsx persistent search input has a muted-fill background (e.g., bg-muted/50) (D-24)"
    - "DesktopTopNav.tsx persistent search input width is in the max-w-md to max-w-lg range (D-24)"
    - "DesktopTopNav.tsx handleSearchSubmit handler is preserved byte-for-byte (D-24, D-25)"
    - "Plan 01 Task 6 RED tests for DesktopTopNav (5 new Phase 16 tests) go GREEN"
    - "tests/components/layout/HeaderNav.test.tsx is deleted (HeaderNav no longer exists)"
    - "Build passes: zero stale imports of @/components/layout/HeaderNav anywhere in src/ or tests/"
  artifacts:
    - path: "src/components/layout/DesktopTopNav.tsx"
      provides: "Cleaned-up desktop nav: logo + Explore + restyled search + Wear + Add + Bell + UserMenu"
      contains: "Search"
    - path: "tests/components/layout/HeaderNav.test.tsx"
      provides: "DELETED — file removed alongside the component it covered"
  key_links:
    - from: "src/components/layout/DesktopTopNav.tsx"
      to: "lucide-react Search icon"
      via: "import { Plus, Search } from 'lucide-react'"
      pattern: "import.*Search.*from 'lucide-react'"
    - from: "src/components/layout/DesktopTopNav.tsx"
      to: "(removed) HeaderNav"
      via: "deletion — zero remaining importers in src/ or tests/"
      pattern: "from '@/components/layout/HeaderNav'"
---

<objective>
Delete `HeaderNav` (now redundant with the UserMenu dropdown shipped Phase 14) and restyle the persistent nav search input per the Figma direction.

Purpose: The nav strip currently has duplicate Profile/Settings entry points (HeaderNav inline links + UserMenu dropdown). Phase 14 consolidated those into UserMenu, leaving HeaderNav as dead chrome. The search input also needs to read as a prominent launcher (muted fill + leading magnifier + balanced width) — currently it's a thin transparent text field that gets visually lost.

Output: 1 modified file, 1 deleted file, 1 deleted test file. After this plan, Plan 01 Task 6's 5 new Phase 16 RED tests for DesktopTopNav go GREEN.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/16-people-search/16-CONTEXT.md
@.planning/phases/16-people-search/16-RESEARCH.md
@.planning/phases/16-people-search/16-VALIDATION.md

@src/components/layout/DesktopTopNav.tsx
@src/components/layout/HeaderNav.tsx
@src/components/layout/UserMenu.tsx
@src/components/ui/input.tsx
@src/app/explore/page.tsx
@tests/components/layout/DesktopTopNav.test.tsx

<interfaces>
<!-- Existing surface this plan modifies -->

From src/components/layout/DesktopTopNav.tsx (current shape):
```tsx
// Imports HeaderNav at line 9
// Renders HeaderNav at line 65 inside the left-cluster div
// handleSearchSubmit (lines 47-56) routes to /search?q=... — PRESERVE byte-for-byte
// Current input: <Input className="w-full" /> inside <form className="max-w-xs flex-1">
```

From src/components/layout/HeaderNav.tsx (current shape — to be deleted):
```tsx
// Renders 'Collection' link (always) + 'Profile' link (when username) + 'Settings' link
// Sole importer: src/components/layout/DesktopTopNav.tsx line 9 (verified by grep)
```

From src/components/layout/UserMenu.tsx (already shipped Phase 14):
```tsx
// DropdownMenuContent contains Profile, Settings, Theme toggle, Sign out items
// This is why HeaderNav is now redundant (D-17 from Phase 14)
```

From lucide-react:
```ts
import { Search } from 'lucide-react'  // 24x24 default; size-4 = 16x16, size-5 = 20x20
```

From src/components/ui/input.tsx:
```tsx
// shadcn Input wraps @base-ui/react Input
// Accepts className that merges via cn() with default classes
// Default: "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 ..."
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 0: Strip stale HeaderNav vi.mock + legacy assertion from tests/components/layout/DesktopTopNav.test.tsx</name>
  <files>tests/components/layout/DesktopTopNav.test.tsx</files>
  <read_first>
    - tests/components/layout/DesktopTopNav.test.tsx (current state — see lines 9-14 vi.mock block + line 48 legacy 'header-nav' assertion + line 45 legacy "Test 9" name)
    - .planning/phases/16-people-search/16-CONTEXT.md (D-23 — HeaderNav is being deleted; tests must not stub or assert it)
  </read_first>
  <behavior>
    Pre-existing tests (Test 10..16) remain GREEN unchanged. The legacy "Test 9 — renders wordmark, HeaderNav, ..." has its HeaderNav-specific bits surgically excised so the file does NOT import a stub for the about-to-be-deleted module and does NOT assert on the now-absent header-nav testid. The file is left in a state where (a) the existing layout-composition assertions still run (wordmark, search input, Add link, bell, UserMenu) and (b) the 5 NEW Phase 16 tests appended by Plan 01 Task 6 are RED until Task 1 of THIS plan ships D-23 + D-24.
  </behavior>
  <action>
**Why this task exists:** Plan 04 Task 2 deletes `src/components/layout/HeaderNav.tsx`. The pre-existing `tests/components/layout/DesktopTopNav.test.tsx` currently (a) calls `vi.mock('@/components/layout/HeaderNav', ...)` (lines 10-14) and (b) asserts `expect(screen.getByTestId('header-nav')).toBeInTheDocument()` (line 48 in the legacy "Test 9"). After deletion, the `vi.mock` factory targets a non-existent module path (vitest is forgiving about this in practice but it's stale clutter) and the legacy testid assertion will fail because no element renders that testid anymore.

This task surgically removes BOTH stale references BEFORE Task 1 lands, so when Task 1 + Task 2 ship, the file goes RED only on the 5 new Phase 16 tests authored by Plan 01 Task 6 — not on legacy chrome that the user already approved removing.

**Step 1 — Remove the `vi.mock('@/components/layout/HeaderNav', ...)` block.**

Delete lines 9-14 of `tests/components/layout/DesktopTopNav.test.tsx`:

```tsx
// Stub HeaderNav, NavWearButton, UserMenu to isolate composition testing
vi.mock('@/components/layout/HeaderNav', () => ({
  HeaderNav: ({ username }: { username?: string | null }) => (
    <div data-testid="header-nav" data-username={username ?? ''} />
  ),
}))

```

The next `vi.mock(...)` block (NavWearButton) becomes the first stub; preserve everything from it onwards. Update the comment on the line above the NavWearButton mock to read `// Stub NavWearButton, UserMenu to isolate composition testing` (drop "HeaderNav,").

**Step 2 — Excise the legacy 'header-nav' assertion from the existing "Test 9".**

In the `it('Test 9 — renders wordmark, HeaderNav, search input, ...'` block (around line 45), do TWO surgical edits:

1. Rename the test description: change `'Test 9 — renders wordmark, HeaderNav, search input, NavWearButton, Add icon, NotificationBell, UserMenu (all present)'` to `'Test 9 — renders wordmark, search input, NavWearButton, Add icon, NotificationBell, UserMenu (all present)'` (drop "HeaderNav, ").
2. Delete the line `expect(screen.getByTestId('header-nav')).toBeInTheDocument()` (line ~48 — between the `screen.getByText('Horlo')` assertion and the `container.querySelector('input[type="search"]')` assertion). The remaining 6 assertions in that test stay intact.

**Step 3 — Verify the file still compiles + the legacy tests still pass.**

`npx tsc --noEmit` exits 0. `npm run test -- tests/components/layout/DesktopTopNav.test.tsx` runs — the legacy Test 9..16 should be GREEN; the 5 new Phase 16 tests appended by Plan 01 Task 6 remain RED until Task 1 of this plan ships (since they assert the new behavior — magnifier, muted fill, no-HeaderNav — that Task 1 introduces).

**Do NOT touch** anything else: `bellStub`, `userProps` helper, NavWearButton + UserMenu mocks, the existing tests 10..16, or the new Phase 16 `describe` block from Plan 01 Task 6.
  </action>
  <verify>
    <automated>! grep -q "vi.mock.*HeaderNav" tests/components/layout/DesktopTopNav.test.tsx &amp;&amp; ! grep -q "header-nav" tests/components/layout/DesktopTopNav.test.tsx &amp;&amp; npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `! grep -q "vi.mock.*HeaderNav" tests/components/layout/DesktopTopNav.test.tsx` (zero matches — the vi.mock block is gone)
    - `! grep -q "header-nav" tests/components/layout/DesktopTopNav.test.tsx` (zero matches — the testid assertion AND the testid string are gone)
    - `grep -q "Test 9 — renders wordmark, search input, NavWearButton" tests/components/layout/DesktopTopNav.test.tsx` matches (renamed description)
    - `grep -q "Stub NavWearButton, UserMenu to isolate composition testing" tests/components/layout/DesktopTopNav.test.tsx` matches (comment updated)
    - `grep -c "it(" tests/components/layout/DesktopTopNav.test.tsx` returns the SAME count it had before this task (no tests added or removed by this task — Plan 01 Task 6 already added the 5 new tests)
    - `grep -q "Phase 16 polish" tests/components/layout/DesktopTopNav.test.tsx` matches (Plan 01 Task 6's new describe block still present)
    - `npx tsc --noEmit` exits 0
    - `npm run test -- tests/components/layout/DesktopTopNav.test.tsx` runs without import-resolution errors (legacy tests GREEN; the 5 new Phase 16 tests RED until Task 1 ships)
  </acceptance_criteria>
  <done>vi.mock + legacy header-nav testid surgically removed; existing layout assertions intact; Phase 16 tests still RED-pending until Task 1.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 1: Restyle DesktopTopNav.tsx — delete HeaderNav usage + add leading magnifier + muted-fill input</name>
  <files>src/components/layout/DesktopTopNav.tsx</files>
  <read_first>
    - src/components/layout/DesktopTopNav.tsx (current state — preserve handleSearchSubmit + container layout)
    - src/components/layout/HeaderNav.tsx (to be deleted in Task 2 — confirm no other consumers)
    - .planning/phases/16-people-search/16-CONTEXT.md (D-23, D-24, D-25, D-26, D-27)
    - .planning/phases/16-people-search/16-RESEARCH.md Example 5 (full restyle code sketch)
    - tests/components/layout/DesktopTopNav.test.tsx (Plan 01 Task 6 — new Phase 16 tests must pass)
  </read_first>
  <behavior>
    - HeaderNav import removed
    - HeaderNav render removed (line 65 in current file)
    - Search icon imported from lucide-react alongside the existing Plus import
    - <form> wrapper widened from max-w-xs to max-w-md (judgment: max-w-md reads balanced against logo · Explore · Wear · + · Bell · Avatar cluster; max-w-lg too dominant per D-27)
    - Input shell becomes a relative-positioned wrapper with a leading absolute-positioned Search icon and pl-9 padding on the input
    - Input className adds: bg-muted/50, border-transparent (so the muted fill reads as the primary visual treatment), pl-9, rounded-md, focus-visible:bg-background (so focused state lifts cleanly)
    - handleSearchSubmit handler preserved byte-for-byte (do NOT touch the function body)
    - All other elements (NavWearButton, Add icon, bell, UserMenu) preserved unchanged (D-26)
  </behavior>
  <action>
Edit `src/components/layout/DesktopTopNav.tsx`:

**1. Update imports (top of file):**

Replace:
```tsx
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { isPublicPath } from '@/lib/constants/public-paths'
import { HeaderNav } from '@/components/layout/HeaderNav'
import { NavWearButton } from '@/components/layout/NavWearButton'
import { UserMenu } from '@/components/layout/UserMenu'
```

With:
```tsx
import { Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { isPublicPath } from '@/lib/constants/public-paths'
import { NavWearButton } from '@/components/layout/NavWearButton'
import { UserMenu } from '@/components/layout/UserMenu'
```

(Removes the HeaderNav import per D-23; adds Search per D-24.)

**2. Update JSDoc block** (lines 22-35) to reflect Phase 16 changes. Replace the `Composition (left → right):` line with:

```
 * Composition (left → right):
 *   Horlo wordmark · Explore link · persistent search input (D-24 muted fill +
 *   leading magnifier) · NavWearButton · Add icon · NotificationBell · UserMenu
 *
 * Phase 16 changes (D-23, D-24):
 *   - HeaderNav inline links removed (Profile + Settings now exclusively in
 *     UserMenu dropdown — Phase 14 D-17 made these redundant).
 *   - Search input restyled with muted-fill (bg-muted/50) + leading lucide
 *     Search icon + widened to max-w-md. handleSearchSubmit preserved.
```

**3. Delete the HeaderNav render** in the JSX. Replace:

```tsx
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-serif text-xl">Horlo</span>
          </Link>
          <HeaderNav username={username} />
          <Link
            href="/explore"
            className="text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            Explore
          </Link>
        </div>
```

With:
```tsx
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-serif text-xl">Horlo</span>
          </Link>
          <Link
            href="/explore"
            className="text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            Explore
          </Link>
        </div>
```

(D-23: HeaderNav element removed. The `username` prop is no longer needed by the left cluster but IS still needed by UserMenu downstream — preserve the prop on the function signature.)

**4. Restyle the search form + input** (D-24). Replace:

```tsx
        <form onSubmit={handleSearchSubmit} className="max-w-xs flex-1">
          <Input
            type="search"
            name="q"
            placeholder="Search collectors, watches…"
            aria-label="Search"
            className="w-full"
          />
        </form>
```

With:
```tsx
        <form onSubmit={handleSearchSubmit} className="max-w-md flex-1">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              name="q"
              placeholder="Search collectors, watches…"
              aria-label="Search"
              className="w-full bg-muted/50 border-transparent pl-9 rounded-md focus-visible:bg-background"
            />
          </div>
        </form>
```

D-24 spec breakdown (verbatim from CONTEXT.md):
- Muted fill background → `bg-muted/50`
- Leading magnifier icon → `<Search>` from lucide-react, absolute-positioned at `left-3`, `size-4`, vertically centered (`top-1/2 -translate-y-1/2`), `pointer-events-none` so the icon never intercepts clicks
- Widened width → `max-w-md` (judgment per D-27 — within the documented `max-w-md` to `max-w-lg` range; `max-w-md` reads balanced against the right-cluster icons)
- Rounded corners → `rounded-md`
- Border-transparent → so the muted fill reads as the primary visual; focus state restores via `focus-visible:bg-background`
- Preserved: `name="q"`, `type="search"`, `aria-label="Search"`, `handleSearchSubmit` handler

**5. DO NOT TOUCH** anything else. NavWearButton + Add icon + bell + UserMenu all stay (D-26).

**6. The `username` prop is still consumed** by `<UserMenu user={user} username={username} />` on the right cluster. Do NOT remove the prop from the component signature.
  </action>
  <verify>
    <automated>npm run test -- tests/components/layout/DesktopTopNav.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `! grep -q "from '@/components/layout/HeaderNav'" src/components/layout/DesktopTopNav.tsx` (D-23 import removed)
    - `! grep -q "<HeaderNav" src/components/layout/DesktopTopNav.tsx` (D-23 render removed)
    - `grep -q "import { Plus, Search } from 'lucide-react'" src/components/layout/DesktopTopNav.tsx` matches (D-24 leading magnifier import)
    - `grep -q "<Search" src/components/layout/DesktopTopNav.tsx` matches (D-24 icon rendered)
    - `grep -q "bg-muted/50" src/components/layout/DesktopTopNav.tsx` matches (D-24 muted fill)
    - `grep -q "max-w-md" src/components/layout/DesktopTopNav.tsx` matches (D-24 width)
    - `grep -q "rounded-md" src/components/layout/DesktopTopNav.tsx` matches (D-24 corners)
    - `grep -q "pl-9" src/components/layout/DesktopTopNav.tsx` matches (icon padding)
    - `grep -q "pointer-events-none" src/components/layout/DesktopTopNav.tsx` matches (icon doesn't intercept clicks)
    - `grep -q "handleSearchSubmit" src/components/layout/DesktopTopNav.tsx` matches (handler preserved)
    - `grep -q "window.location.href = .*search" src/components/layout/DesktopTopNav.tsx` matches (handler body untouched)
    - `npm run test -- tests/components/layout/DesktopTopNav.test.tsx` exits 0 (Plan 01 Task 6 RED → GREEN)
  </acceptance_criteria>
  <done>DesktopTopNav restyled per D-23 + D-24; handleSearchSubmit preserved; new Plan 01 tests pass.</done>
</task>

<task type="auto">
  <name>Task 2: Delete HeaderNav.tsx + its test file</name>
  <files>src/components/layout/HeaderNav.tsx, tests/components/layout/HeaderNav.test.tsx</files>
  <read_first>
    - src/components/layout/DesktopTopNav.tsx (just edited — confirm zero remaining imports)
    - tests/components/layout/HeaderNav.test.tsx (existing test file for the doomed component)
    - .planning/phases/16-people-search/16-CONTEXT.md (D-23 — explicit deletion mandate)
    - .planning/phases/16-people-search/16-RESEARCH.md §"Runtime State Inventory" HeaderNav row + Pitfall 6 (broken-import safety)
  </read_first>
  <action>
**Step 1 — Pre-deletion safety grep (Pitfall 6):**

```bash
grep -rn "from '@/components/layout/HeaderNav'" src/ tests/
```

Expected: ZERO matches (Task 1 removed the only importer; Plan 01 Task 6 added Phase 16 tests to `DesktopTopNav.test.tsx`, NOT to `HeaderNav.test.tsx` — the existing `HeaderNav.test.tsx` only imports the component itself, which we are about to delete).

If the grep returns ANY hit other than the test file we're deleting, STOP and resolve the importer first.

**Step 2 — Delete the component:**

```bash
rm src/components/layout/HeaderNav.tsx
```

**Step 3 — Delete the test file:**

```bash
rm tests/components/layout/HeaderNav.test.tsx
```

The test file's only purpose was to test the deleted component. Plan 01 Task 6 already covers HeaderNav's absence in `tests/components/layout/DesktopTopNav.test.tsx`.

**Step 4 — Re-verify with grep:**

```bash
grep -rn "from '@/components/layout/HeaderNav'" src/ tests/
grep -rn "import.*HeaderNav" src/ tests/
```

Both must return ZERO matches.
  </action>
  <verify>
    <automated>test ! -f src/components/layout/HeaderNav.tsx &amp;&amp; test ! -f tests/components/layout/HeaderNav.test.tsx &amp;&amp; npm run build 2&gt;&amp;1 | grep -q 'Compiled successfully\\|Compiled in' || (npm run lint &amp;&amp; npx tsc --noEmit)</automated>
  </verify>
  <acceptance_criteria>
    - `test ! -f src/components/layout/HeaderNav.tsx` returns 0 (file deleted)
    - `test ! -f tests/components/layout/HeaderNav.test.tsx` returns 0 (test file deleted)
    - `! grep -rn "from '@/components/layout/HeaderNav'" src/`
    - `! grep -rn "from '@/components/layout/HeaderNav'" tests/`
    - `! grep -rn "import.*HeaderNav" src/ tests/`
    - `npx tsc --noEmit` exits 0 (no broken imports — Pitfall 6 evidence)
    - `npm run lint` exits 0
    - `npm run test -- tests/components/layout/` exits 0 (other layout tests still pass)
  </acceptance_criteria>
  <done>HeaderNav.tsx and HeaderNav.test.tsx deleted; build is clean; no stale imports.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| User → search form | Form submit fires handleSearchSubmit; preserved byte-for-byte from Phase 14 (uses encodeURIComponent on q). |
| Build system → HeaderNav imports | Pre-deletion grep gates against stale imports breaking the build. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-16-08 | Tampering (XSS via unencoded search query in URL) | src/components/layout/DesktopTopNav.tsx | mitigate | handleSearchSubmit preserved — uses `encodeURIComponent(q)` (verified at line 55 of current file). Restyle does NOT touch the handler body. Acceptance criterion grep enforces this. |
| T-16-build | DoS (broken-import build failure leaking deployment time) | Plan 04 Task 2 deletion sequence | mitigate | Pre-deletion grep gate (`grep -rn "from '@/components/layout/HeaderNav'" src/ tests/`); fails-closed if any importer remains. `npx tsc --noEmit` post-deletion catches any imports the grep missed (Pitfall 6). |
| T-16-vis | Information Disclosure (visual leak of actor identity) | src/components/layout/DesktopTopNav.tsx | accept | UserMenu still surfaces username + avatar; this plan REMOVES inline Profile/Settings links but does NOT change what UserMenu exposes. The actor's username has always been visible in the desktop nav (UserMenu trigger). No new disclosure. |
</threat_model>

<verification>
After both tasks complete:

1. `npm run test -- tests/components/layout/DesktopTopNav.test.tsx` exits 0 — Plan 01 Task 6's 5 Phase 16 tests are GREEN.
2. `npm run test` — full suite GREEN. (SearchPageClient RED tests from Plan 01 Task 5 remain RED until Plan 05 — that's expected.)
3. `npx tsc --noEmit` exits 0
4. `npm run lint` exits 0
5. `! grep -rn "HeaderNav" src/ tests/` (component fully purged)
6. Manual smoke test (deferred to Plan 05's UAT checkpoint): `npm run dev` + load `/` desktop viewport — left cluster shows only logo + Explore; search input shows leading magnifier with muted fill.
</verification>

<success_criteria>
Plan 04 succeeds when:
- DesktopTopNav.tsx restyled per D-23 + D-24
- HeaderNav.tsx + HeaderNav.test.tsx deleted
- Zero stale imports in src/ and tests/
- Plan 01 Task 6's 5 new Phase 16 tests are GREEN
- Build + lint + types clean
- Single commit `feat(16): delete HeaderNav + restyle DesktopTopNav search input (D-23, D-24)`
</success_criteria>

<output>
After completion, create `.planning/phases/16-people-search/16-04-SUMMARY.md` recording:
- Files modified: 1 (DesktopTopNav.tsx)
- Files deleted: 2 (HeaderNav.tsx, HeaderNav.test.tsx)
- Plan 01 Task 6 RED → GREEN snapshot for the 5 new Phase 16 tests
- Manual visual sanity (deferred to Plan 05 UAT) noted
- Note: SearchPageClient RED tests from Plan 01 Task 5 still RED until Plan 05
</output>
