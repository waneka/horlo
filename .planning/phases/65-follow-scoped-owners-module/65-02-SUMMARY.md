---
phase: 65
plan: 02
subsystem: ui
tags:
  - rsc
  - presentational
  - chip
  - a11y
  - static-guard
  - tdd
requirements:
  - FOLL-01
  - FOLL-03
dependency-graph:
  requires:
    - "src/data/follows.ts::FollowedOwner (type-only — Plan 01 ship)"
    - "src/components/profile/AvatarDisplay.tsx (size={40} literal-union compliance)"
    - "next/link (absolute-inset click surface primitive)"
  provides:
    - "src/components/insights/FollowedOwnersModule.tsx::FollowedOwnersModule (pure-presentation RSC, hide-if-empty, header, chip stack, overflow caption)"
  affects:
    - "Phase 65 Plan 03 (page.tsx + WatchDetailHero integration) — consumes the component via props {owners, totalCount}"
tech-stack:
  added: []
  patterns:
    - "Pure-presentation RSC chip composition (no 'use client', no 'use cache', no hooks, no event handlers)"
    - "Type-only DAL import (preserves PPR boundary — D-11)"
    - "Absolute-inset <Link> single-tap-target click surface with focus-visible:ring-2"
    - "Hide-if-empty early return — owners.length === 0 gate, NOT totalCount"
    - "Strict > overflow gate for plain-text 'and N more' caption (D-04c)"
    - "Static fs-scan RSC guard with // @vitest-environment node (project_vitest_static_node_env)"
    - "TDD per-task gate sequence (test commit → feat commit → guard commit)"
key-files:
  created:
    - "src/components/insights/FollowedOwnersModule.tsx"
    - "tests/components/insights/FollowedOwnersModule.test.tsx"
    - "tests/static/followed-owners-module-rsc.test.ts"
    - ".planning/phases/65-follow-scoped-owners-module/65-02-SUMMARY.md"
  modified: []
decisions:
  - "Component is a pure RSC (no 'use client', no 'use cache') — locked by static guard so future hover-state refactors fail CI loudly instead of silently corrupting the /w/[ref] PPR boundary"
  - "FollowedOwner imported as `import type` only — Plan 01's DAL function is NEVER imported here, preserving Plan 03's ability to wire WatchDetailHero (a 'use client' island) without dragging server-only code across the boundary"
  - "Overflow caption gate is strict `>` (totalCount > owners.length), not `>=` — exact-match cases render no caption (Behavior 8 in plan + dedicated test 'omits the caption when totalCount === owners.length')"
  - "Component does NOT slice owners — it trusts the prop (consumer passes the DAL's limit-5 result). The chip count and visible owner set are the consumer's responsibility per D-04b"
  - "Two-layer copy: visible <h3>From your circle</h3> (warmer Rdio-inspired framing per D-04a) + literal SR aria-label 'People you follow who own this' on the wrapping <section> (preserves UI-SPEC §Copywriting Contract)"
  - "TDD commit ordering: test(65-02) RED commit precedes feat(65-02) GREEN commit — confirmed RED via vite import-analysis failure on missing module"
metrics:
  duration: "~5 minutes (single sequential execution)"
  completed: 2026-05-28
  tasks_complete: 3
  files_created: 3
  files_modified: 0
  commits: 3
---

# Phase 65 Plan 02: FollowedOwnersModule (Pure-RSC Chip Stack) Summary

Ships the new pure-presentation Server Component
`src/components/insights/FollowedOwnersModule.tsx` consuming the Plan 01
`FollowedOwner` projection as a type-only import. The module renders the
"From your circle" vertical chip stack (avatar + @username + optional
displayName + absolute-inset link to `/u/{username}/collection`),
returns `null` when `owners.length === 0` (FOLL-01 hide-if-empty), and
emits a plain-text "and {N} more" overflow caption only when
`totalCount > owners.length` (strict `>`). Plan 03 (Wave 2) wires it into
the `WatchDetailHero` right column.

## What Shipped

### New component (Task 1)

**File:** `src/components/insights/FollowedOwnersModule.tsx` (new — 117 lines)

- **Signature:** `export function FollowedOwnersModule({ owners, totalCount }: FollowedOwnersModuleProps)`
- **Imports:** `Link` from `next/link`; `AvatarDisplay` from
  `@/components/profile/AvatarDisplay`; **type-only**
  `import type { FollowedOwner } from '@/data/follows'` (per D-11 — the
  server-only DAL function `getFollowedOwnersForCatalog` is NEVER
  imported here).
- **No `'use client'`. No `'use cache'`. No hooks. No event handlers.**
  Pure RSC, locked by Task 3 static guard.
- **JSDoc** cites Phase 65 FOLL-01..04, D-04 (vertical-stack layout), D-04a
  (header copy), D-04c (plain-text overflow caption), D-10 (placement),
  D-11 (type-only import), PAGE-03 preserve, and the XSS auto-escape
  contract (mirroring `OtherOwnersRoster.tsx:36-39`).

### Locked JSX shape (verbatim from UI-SPEC §Module Anatomy)

```tsx
<section className="space-y-2" aria-label="People you follow who own this">
  <h3 className="text-sm font-medium text-foreground">From your circle</h3>
  <ul className="space-y-2">
    {owners.map((owner) => {
      const name = owner.displayName ?? `@${owner.username}`
      return (
        <li
          key={owner.userId}
          className="group relative flex items-center gap-3 min-h-[44px]"
        >
          <Link
            href={`/u/${owner.username}/collection`}
            aria-label={`${name}'s collection`}
            className="absolute inset-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <AvatarDisplay
            avatarUrl={owner.avatarUrl}
            displayName={owner.displayName}
            username={owner.username}
            size={40}
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              @{owner.username}
            </p>
            {owner.displayName && (
              <p className="text-xs text-muted-foreground truncate group-hover:text-foreground transition-colors">
                {owner.displayName}
              </p>
            )}
          </div>
        </li>
      )
    })}
  </ul>
  {totalCount > owners.length && (
    <p className="text-xs text-muted-foreground">
      and {totalCount - owners.length} more
    </p>
  )}
</section>
```

### Component test (Task 2)

**File:** `tests/components/insights/FollowedOwnersModule.test.tsx` (new — 180 lines)

11 it-cases under a single `describe('FollowedOwnersModule', …)` block,
using `@testing-library/react`'s `render` + `getByText` / `getByRole` /
`container.querySelector` / `queryByText` patterns. The Alice (displayName
present) + Bob (displayName null) fixtures validate the displayName→
`'@'+username` fallback in the aria-label.

| # | Test | Asserts | Contract |
|---|------|---------|----------|
| 1 | returns null when owners=[] | `container.firstChild === null` | FOLL-01 |
| 2 | returns null when owners=[] even with non-zero totalCount | gate is owners.length, not totalCount | FOLL-01 defensive |
| 3 | renders literal "From your circle" header in <h3> | visible warmer copy + correct element | D-04a |
| 4 | applies SR aria-label "People you follow who own this" on <section> | literal phrasing preserved in a11y tree | UI-SPEC Copywriting |
| 5 | renders one <Link> per owner with correct href + aria-label (Alice + Bob) | full FOLL-03 chip semantics including displayName fallback | FOLL-03 / D-02a |
| 6 | renders @username as primary chip text | UI-SPEC chip primary | D-04 |
| 7 | renders displayName secondary line only when non-null | conditional render correctness | UI-SPEC chip secondary |
| 8 | uses one <ul> with exactly one <li> per owner | semantic list shape | A11y |
| 9 | renders "and 7 more" caption when totalCount(10) > owners(3) | overflow caption present | D-04c |
| 10 | omits caption when totalCount === owners.length | strict > gate (not >=) | D-04c |
| 11 | omits caption when totalCount < owners.length | strict > gate (defensive) | D-04c |

**Behavior verification:** `npx vitest run tests/components/insights/FollowedOwnersModule.test.tsx` → **11 passed (11)** in jsdom env.

### Static RSC guard (Task 3)

**File:** `tests/static/followed-owners-module-rsc.test.ts` (new — 63 lines)

- **Line 1:** `// @vitest-environment node` (load-bearing per
  `project_vitest_static_node_env` — Phase 59 prod-deploy failure
  precedent; under jsdom `node:fs` is externalized and `readFileSync` is
  undefined, so a missing header would pass locally but fail Vercel
  prebuild).
- **Directive-detection pattern:** `line.trim() === "'use client'"` on the
  first 5 lines — NOT a fuzzy `content.includes(...)` (which would
  false-positive on JSDoc prose; this file's JSDoc already mentions the
  directive names in prose, so the strict-form match is mandatory). Same
  shape as `tests/static/comment-thread-no-client.test.ts:27-29`.
- **3 it-cases:**
  1. `does not contain "use client" directive in the first 5 lines`
  2. `does not contain "use cache" directive in the first 5 lines`
  3. `exports FollowedOwnersModule as a named function`

**Behavior verification:** `npx vitest run tests/static/followed-owners-module-rsc.test.ts` → **3 passed (3)** in node env.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 2 | Author failing component tests (RED — module doesn't exist, vite import-analysis fails) | `a4fe95f1` | `tests/components/insights/FollowedOwnersModule.test.tsx` |
| 1 | Implement FollowedOwnersModule.tsx (GREEN — 11/11 component tests pass; 0 new TS errors) | `0e23bc74` | `src/components/insights/FollowedOwnersModule.tsx` |
| 3 | Author static RSC guard (3/3 pass; locks the pure-RSC invariant against future client conversion) | `f959a557` | `tests/static/followed-owners-module-rsc.test.ts` |

### TDD Gate Compliance

Per-task TDD gate sequence (each task is tdd="true"):

- **Plan-level RED→GREEN:** ✅ `test(65-02): add failing tests for FollowedOwnersModule` (RED commit `a4fe95f1`) precedes `feat(65-02): add FollowedOwnersModule pure-RSC chip stack` (GREEN commit `0e23bc74`). RED was confirmed: vite import-analysis failed on `'@/components/insights/FollowedOwnersModule'` because the module did not exist; once Task 1 implemented the component, all 11 tests went green.
- **Task 3 guard:** the static guard self-passes immediately because Task 1 already shipped the file with no `'use client'` / `'use cache'` directives. The guard is structural and intentional — its value is the negative regression check (if a future developer adds `'use client'` to line 1, the guard will fail).
- _REFACTOR not needed_ — component is a direct structural clone of `OtherOwnersRoster.tsx` (with the divergence documented in 65-PATTERNS.md "src/components/insights/FollowedOwnersModule.tsx" subsection); no cleanup pass required.

Plan tasks are written in implementation order (Task 1 component, Task 2 test, Task 3 guard), but commits follow TDD gate order (test commit first, feat commit second, guard commit third). This matches the `<tdd_execution>` rules: RED commit must precede GREEN.

## Acceptance Criteria Verification

### Task 1 (component file)

| Assertion | Expected | Actual | Status |
|-----------|----------|--------|--------|
| File exists at `src/components/insights/FollowedOwnersModule.tsx` | yes | yes | ✅ |
| First 5 import lines contain `next/link`, `@/components/profile/AvatarDisplay`, and type-only `@/data/follows::FollowedOwner` — and contain NEITHER directive | yes | yes (verified by Task 3 static guard) | ✅ |
| `grep -c "^export function FollowedOwnersModule"` | 1 | 1 | ✅ |
| `grep -c "if (owners.length === 0) return null"` (FOLL-01) | 1 | 1 | ✅ |
| `grep -c "From your circle"` (≥1; visible header) | ≥1 | 3 (visible header + 2 JSDoc references) | ✅ |
| `grep -c "People you follow who own this"` (SR aria-label) | 1 | 1 | ✅ |
| `/u/{username}/collection` href template present | yes | `` href={`/u/${owner.username}/collection`} `` present | ✅ |
| aria-label template references displayName + username | yes | `` aria-label={`${name}'s collection`} `` where `name = owner.displayName ?? '@' + owner.username` | ✅ |
| `grep -c "size={40}"` | ≥1 | 2 (1 JSDoc + 1 usage) | ✅ |
| `grep -c "focus-visible:ring-2 focus-visible:ring-ring"` | 1 | 1 | ✅ |
| `grep -c "min-h-\[44px\]"` | ≥1 | 2 (1 JSDoc + 1 usage) | ✅ |
| Overflow caption strict `>` gate (`totalCount > owners.length`) | ≥1 | 2 (1 JSDoc + 1 usage) | ✅ |
| Literal "and {totalCount - owners.length} more" present | 1 | 1 | ✅ |
| NO import of `getFollowedOwnersForCatalog` (function) | 0 | 0 | ✅ |
| NO `'use client'` / `'use cache'` anywhere in file | 0 | 0 | ✅ |
| `npx tsc --noEmit` adds no new errors mentioning this file | clean | clean | ✅ |

### Task 2 (component tests)

| Assertion | Expected | Actual | Status |
|-----------|----------|--------|--------|
| File exists at `tests/components/insights/FollowedOwnersModule.test.tsx` | yes | yes | ✅ |
| `import { render } from '@testing-library/react'` | 1 | 1 | ✅ |
| `from '@/components/insights/FollowedOwnersModule'` | 1 | 1 | ✅ |
| `import type { FollowedOwner } from '@/data/follows'` | 1 | 1 | ✅ |
| `it(` invocations | ≥10 | 11 | ✅ |
| References `"Alice Wonder's collection"` and `"@bob's collection"` | ≥2 | both present | ✅ |
| References `/u/alice/collection` and `/u/bob/collection` | ≥2 | both present (in querySelector calls) | ✅ |
| References literal "and 7 more" caption assertion | ≥1 | 1 | ✅ |
| All it-cases pass under `npx vitest run` | pass | 11/11 | ✅ |

### Task 3 (static guard)

| Assertion | Expected | Actual | Status |
|-----------|----------|--------|--------|
| File exists at `tests/static/followed-owners-module-rsc.test.ts` | yes | yes | ✅ |
| Line 1 is exactly `// @vitest-environment node` | yes | yes | ✅ |
| References `project_vitest_static_node_env` or `MEMORY` | ≥1 | 1 | ✅ |
| Uses `readFileSync(FILE` | ≥1 | 1 | ✅ |
| Uses `line.trim() === "'use client'"` exact shape | ≥1 | 1 | ✅ |
| `npx vitest run` reports 3 passing, 0 failures | pass | 3/3 | ✅ |
| `npm run build` completes without TS errors mentioning this file | clean | clean | ✅ |

## Verification

| Gate | Command | Result |
|------|---------|--------|
| Component behavior | `npx vitest run tests/components/insights/FollowedOwnersModule.test.tsx` | **11 passed (11)** in jsdom |
| Static guard behavior | `npx vitest run tests/static/followed-owners-module-rsc.test.ts` | **3 passed (3)** in node env |
| Static + component suite | `npx vitest run tests/static/ tests/components/insights/FollowedOwnersModule.test.tsx` | **16 test files / 448 tests passing** |
| TypeScript | `npx tsc --noEmit 2>&1 \| grep -E "FollowedOwnersModule"` | empty (zero new errors) |
| Build (authoritative gate per `project_baseline_not_green_build_is_gate`) | `npm run build` | **exits 0** (✓ Compiled successfully in 5.4s; 33/33 static pages) |

## Deviations from Plan

**None.** Plan executed exactly as written. No Rule 1/2/3 auto-fixes were
required; no Rule 4 architectural decisions were triggered.

The only structural choice was task commit ORDER: the plan lists Task 1
(component) before Task 2 (tests) and Task 3 (guard), but TDD plan-level
gate requires the `test(...)` commit to precede the `feat(...)` commit.
I committed Task 2 (tests) first as RED, then Task 1 (component) as
GREEN, then Task 3 (guard) last. The plan's `<tdd_execution>` rules
explicitly call for this ordering; all three tasks are complete with one
commit each.

## Authentication Gates

None. No auth surface added — the component is pure-presentation RSC
trusting pre-resolved props from the (eventual) Plan 03 page-level call
site, which inherits the existing `getCurrentUser()` route-level auth
gate.

## Known Stubs

None. The component is fully wired against the Plan 01 `FollowedOwner`
type and the `AvatarDisplay` / `next/link` primitives; no placeholder
data, no empty-prop pass-throughs that would render meaningless UI.
Plan 03 wires the consuming page-level RSC to the live DAL.

## Threat Flags

None. The component introduces no new network endpoints, no new auth
paths, no new file-access patterns, and no new schema. The two
trust-boundary surfaces it touches (props → JSX text/aria-label;
username → SPA navigation href) are mitigated by React's auto-escape
and by the regex validation applied to usernames at signup. These match
the documented contract in `OtherOwnersRoster.tsx:36-39`.

The threat-model items from the PLAN (T-65-07 XSS via username/displayName
in chip text + aria-label; T-65-08 Tampering via future `'use client'`
addition; T-65-09 Information Disclosure via DAL function import on the
client; T-65-10 Privacy bypass via empty-list rendering) all hold:

- **T-65-07:** Mitigated — JSX text-node auto-escape on `{owner.username}`
  + `{owner.displayName}` and on template-literal interpolations in
  `aria-label` / `href`. No `dangerouslySetInnerHTML`.
- **T-65-08:** Mitigated — Task 3 static guard fails CI if either
  `'use client'` or `'use cache'` appears on the first 5 lines of the
  component file.
- **T-65-09:** Mitigated — `import type { FollowedOwner } from '@/data/follows'`
  is type-only. `grep -c "import.*getFollowedOwnersForCatalog"` on the
  component file returns 0.
- **T-65-10:** Mitigated by Test 2 in the component suite ("returns null
  when owners=[] even with non-zero totalCount") — fails loudly if a
  future refactor changes the gate from `owners.length === 0` to
  `totalCount === 0`.

## Self-Check: PASSED

**Files exist:**
- `[ -f src/components/insights/FollowedOwnersModule.tsx ]` → FOUND
- `[ -f tests/components/insights/FollowedOwnersModule.test.tsx ]` → FOUND
- `[ -f tests/static/followed-owners-module-rsc.test.ts ]` → FOUND
- `[ -f .planning/phases/65-follow-scoped-owners-module/65-02-SUMMARY.md ]` → FOUND (this file)

**Commits exist:**
- `git log --oneline | grep -q "a4fe95f1"` → FOUND (RED: `test(65-02): add failing tests for FollowedOwnersModule`)
- `git log --oneline | grep -q "0e23bc74"` → FOUND (GREEN: `feat(65-02): add FollowedOwnersModule pure-RSC chip stack`)
- `git log --oneline | grep -q "f959a557"` → FOUND (Guard: `test(65-02): add static RSC guard for FollowedOwnersModule`)

**Verification commands re-run at self-check time:**
- Component tests: 11/11 passing
- Static guard: 3/3 passing
- Build: exit 0
