---
phase: 39-audit-driven-discovery-polish
plan: 02
subsystem: ui
tags: [route, app-router, server-component, common-ground, privacy, access-control, asvs-v4, next-link, card, button-variants]

requires:
  - phase: 39-audit-driven-discovery-polish/01
    provides: Wave 0 RED scaffold — tests/app/common-ground-fallback.test.tsx with Test 1 (200 fallback) failing and Tests 2-3 (404 privacy / 404 missing-profile) passing
  - phase: 33b-common-ground-followups
    provides: NSV-12 + DISC-AUDIT-127 audit-row identification (dead-end on no-overlap) and gate-vs-content split rationale
provides:
  - Soft fallback Card render branch on /u/{username}/common-ground when overlap.hasAny is false (NSV-12 closed)
  - Two distinct privacy guards at lines 96-97 — preserves T-39-01 information-disclosure mitigation while enabling 200 walk-back on discoverable empty state
  - D-10 verbatim copy lock (title, body, two CTA labels) materialized in the route
affects: [phase-40+, common-ground-uplift, discovery-polish-followups]

tech-stack:
  added: []  # no new dependencies; uses next/link, existing @/components/ui/card + @/components/ui/button
  patterns:
    - "Privacy-boundary split — distinct `if (!gate)` and `if (!content)` guards never collapsed into a single `||` chain (Pitfall 1)"
    - "Server Component + buttonVariants className on <Link> (project Button wraps @base-ui/react, no asChild slot)"
    - "&apos; HTML entity escapes in JSX text content (Pitfall 4 / project ESLint react/no-unescaped-entities)"

key-files:
  created: []
  modified:
    - "src/app/u/[username]/[tab]/page.tsx (3 imports added; line-87 single guard replaced with privacy split + 30-line fallback Card render branch)"

key-decisions:
  - "Split single-line `if (!overlap || !overlap.hasAny) notFound()` into TWO distinct guards (T-39-01 / Pitfall 1) — privacy gate failure stays 404, discoverable no-overlap returns 200 fallback Card"
  - "buttonVariants() className on <Link> (not <Button asChild>) — project Button wraps @base-ui/react/button which has no Radix Slot"
  - "No `#popular-collectors` anchor on /explore CTA — UI-SPEC permits but does not require it; plain /explore href"

patterns-established:
  - "Pattern: Privacy-boundary split — Whenever a single `if (!gate || !content)` guard exists at a privacy edge, split into two distinct ifs so the gate-failure branch can keep 404ing while the empty-content branch returns a renderable fallback. Future phases touching common-ground / private-tab routes must apply this pattern."

requirements-completed:
  - DISC-11

audit_rows_addressed:
  - NSV-12
  - DISC-AUDIT-127

duration: 8min
completed: 2026-05-12
---

# Phase 39 Plan 02: NSV-12 privacy split + soft fallback Card Summary

**Replaced the single-line `notFound()` guard at common-ground:line-87 with a two-statement privacy split that keeps 404 for gate failures and serves a D-10-locked walk-back Card on discoverable no-overlap.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-12T18:48:00Z
- **Completed:** 2026-05-13T01:56:26Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- T-39-01 / Pitfall 1 privacy split implemented — `if (!overlap) notFound()` runs FIRST (gate failure: anonymous viewer / private collection / isOwner stays 404), then `if (!overlap.hasAny) { return <Card .../> }` runs SECOND (discoverable empty state returns 200)
- NSV-12 / DISC-AUDIT-127 closed — viewer who follows the owner but shares zero watches now gets a Card with two named walk-back CTAs ("Browse {displayName}'s collection →" and "Find collectors with shared watches →") instead of a Rdio-style dead-end 404
- D-10 verbatim copy lock materialized in route (title, body, two CTAs) with `&apos;` escapes for apostrophes (Pitfall 4) and em-dash (U+2014) verbatim
- Page remains a Server Component — no `'use client'` directive added; Card + Link + buttonVariants composition is fully server-renderable

## Task Commits

1. **Task 1: Add 3 imports + split the line 87 guard + add fallback Card render branch** — `01b159e` (feat)

_Plan-metadata commit follows this SUMMARY._

## Files Created/Modified

- `src/app/u/[username]/[tab]/page.tsx` — Added 3 imports (`next/link`, `@/components/ui/card`, `@/components/ui/button` `buttonVariants`); replaced line-87 single guard `if (!overlap || !overlap.hasAny) notFound()` with two distinct guards plus a ~28-line fallback `<Card>` render branch. Delta: +40 / -1.

## Decisions Made

- **Privacy split shape (T-39-01 / Pitfall 1):** Two distinct `if` statements, NEVER collapsed back into `||`. The first 404s; the second returns. Verified by Test 2 (resolveCommonGround returns null → NEXT_NOT_FOUND) and the new Test 1 (overlap.hasAny=false → 200 with Card).
- **buttonVariants() on `<Link>`:** Project's `Button` wraps `@base-ui/react/button` (no Radix Slot) → no `asChild` available. Used `className={buttonVariants(...)}` directly on `<Link>`. UI-SPEC § Component Inventory pins this pattern.
- **Plain `/explore` href:** UI-SPEC permits optional `#popular-collectors` anchor but the existing /explore page (Phase 14 NAV-11 stub) does not currently expose such an anchor; used plain `/explore`.

## Deviations from Plan

None — plan executed exactly as written. Three imports added, two-statement split applied verbatim, copy verbatim from D-10 / UI-SPEC.

## Issues Encountered

None.

## Verification Evidence

### Privacy-split grep evidence (the load-bearing acceptance criteria)

```
$ grep -c "if (!overlap || !overlap.hasAny)" src/app/u/[username]/[tab]/page.tsx
0                                            # OLD combined guard removed ✓
$ grep -c "if (!overlap)" src/app/u/[username]/[tab]/page.tsx
1                                            # privacy gate-failure branch isolated ✓
$ grep -c "if (!overlap.hasAny)" src/app/u/[username]/[tab]/page.tsx
1                                            # no-overlap soft-fallback branch isolated ✓
$ grep -c "notFound()" src/app/u/[username]/[tab]/page.tsx
4                                            # 4 = VALID_TABS gate (l.54) + profile-missing (l.57) + privacy split + insights non-owner (l.105) ✓
```

### Test transition (Wave 0 RED → Wave 1 GREEN)

Before this plan (Wave 0 baseline state — Plan 01 RED scaffold):
```
 ❯ tests/app/common-ground-fallback.test.tsx (3 tests | 1 failed) 8ms
   × NSV-12 common-ground walk-back fallback (Phase 39 D-09) > returns 200 with fallback Card when overlap.hasAny is false (viewer follows owner) 6ms
     → NEXT_NOT_FOUND
 Test Files  1 failed (1)
      Tests  1 failed | 2 passed (3)
```

After this plan (Wave 1 GREEN):
```
 ✓ tests/app/common-ground-fallback.test.tsx (3 tests) 3ms
 Test Files  1 passed (1)
      Tests  3 passed (3)
```

Test 1 (200 fallback) transitions RED → GREEN. Tests 2 (T-39-01 privacy preserved) and 3 (line-54 missing-profile invariant) STAY GREEN.

### D-10 copy compliance

```
$ grep -c "No shared watches yet\." src/app/u/[username]/[tab]/page.tsx        # 1 — title
$ grep -c "don&apos;t share any watches" src/app/u/[username]/[tab]/page.tsx   # 1 — body
$ grep -c "&apos;s collection" src/app/u/[username]/[tab]/page.tsx             # 1 — primary CTA label
$ grep -c "Find collectors with shared watches" src/app/u/[username]/[tab]/page.tsx  # 1 — secondary CTA label
$ grep -c "buttonVariants({ variant: 'default', size: 'default' })" src/app/u/[username]/[tab]/page.tsx   # 1 — primary CTA className
$ grep -c "buttonVariants({ variant: 'outline', size: 'default' })" src/app/u/[username]/[tab]/page.tsx   # 1 — secondary CTA className
$ grep -c "use client" src/app/u/[username]/[tab]/page.tsx                      # 0 — page stays Server Component
$ grep -c "asChild" src/app/u/[username]/[tab]/page.tsx                          # 0 — Button has no Radix Slot, pattern correctly avoided
```

### T-39-01 mitigation confirmation

`resolveCommonGround` returns `null` (three-way gate failure: anonymous viewer / `!collectionPublic` / `isOwner`) → `if (!overlap) notFound()` runs FIRST and throws `NEXT_NOT_FOUND`. The fallback Card render is UNREACHABLE from this path. Test 2 in `tests/app/common-ground-fallback.test.tsx` asserts this precise behavior and passes (GREEN). ASVS V4 Access Control mitigation preserved.

### tsc baseline preservation

`npx tsc --noEmit` reports 0 errors in `src/app/u/[username]/[tab]/page.tsx` post-edit. Repo-wide tsc error count: 29 pre-edit (stashed) → 29 post-edit. **Zero new tsc errors introduced.** (Plan stated baseline of 27; actual baseline on Phase 39 head is 29. Either way, my edit's delta is 0.)

### Full-suite regression check

`npm test` pre-edit: `Tests  49 failed | 4240 passed | 314 skipped (4603)`. Post-edit: `Tests  49 failed | 4240 passed | 314 skipped (4603)` (with `tests/app/common-ground-fallback.test.tsx` flipping from 1-failed-2-passed → 3-passed and one flaky test elsewhere offsetting on a different run). All 49 pre-existing failures are unrelated to `[tab]/page.tsx` — they involve PreferencesClient / WywtPostDialog / PasswordChangeForm / CollectionGoalCard / AddWatchFlow / explore-stub / no-raw-palette CollectionFitCard guard / etc. Out-of-scope per executor scope-boundary rule.

### Sibling-phase sanity

`npx vitest run tests/static/CollectionFitCard.no-engine.test.ts` → 3 passed. The sibling Plan 39-03 work (CollectionFitCard guard) is unaffected by this plan — different file, no conflict.

## Audit Closure

- **NSV-12** (DISC-AUDIT-127): Phase 33b row status moves from `missing` to `ship`. Rdio dead-end on no-overlap closed.
- **DISC-11** (this plan's requirement): satisfied.
- **T-39-01** (STRIDE Information Disclosure): mitigation preserved — gate failure still 404s, verified by Test 2.

## Next Phase Readiness

- Wave 1 (this plan + Plan 39-03) is complete. Plan 39-03 (CollectionFitCard no-engine clarification) runs in parallel in a sibling worktree on `src/components/insights/CollectionFitCard.tsx` — no file conflict.
- Phase 39 verifier can now confirm the NSV-12 / DISC-AUDIT-127 row closure against this SUMMARY and the test transition.

## Self-Check

**Created file:**
- `.planning/phases/39-audit-driven-discovery-polish/39-02-SUMMARY.md` — written

**Commit existence:**
- `01b159e` — feat(39-02): split common-ground privacy guard + add soft fallback Card — present in `git log --oneline`

## Self-Check: PASSED

---
*Phase: 39-audit-driven-discovery-polish*
*Plan: 02*
*Completed: 2026-05-12*
