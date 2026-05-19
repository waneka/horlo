---
status: partial
phase: 46-explore-shell-browse-archetypes
source: [46-VERIFICATION.md]
started: 2026-05-19T03:30:00Z
updated: 2026-05-19T05:50:00Z
---

## Current Test

### 5. A–Z nav G1/G2/G3 visual confirmation after gap-closure CSS changes

## Tests

### 1. Modules hide correctly on /explore — EXPL-02 null-hiding passes visual inspection
expected: When no editorial content exists, HeroModule, CuratedListsRail, and WhereCollectionsGo produce zero visible DOM output; CollectorArchetypes hides when archetype counts are empty; BrowseModule always shows 3 tiles. On live /explore only CollectorArchetypes + BrowseModule render — no empty containers, no padding-only boxes.
result: pass

### 2. A–Z jump nav on /explore/brands scrolls without heading hiding under nav — EXPL-04 UAT
expected: Tapping a letter anchor scrolls the correct letter section into view with `scroll-mt-12` keeping the section heading clear of the sticky nav.
result: pass
note: "EXPL-04 scroll-offset behavior passes. User raised 3 UX refinement requests for the A–Z nav — captured as gaps G1/G2/G3, now resolved by plan 46-06. See Test 5 for visual re-confirmation."

### 3. All 10 archetype chips resolve to at least one result
expected: Every chip on the /explore Collector Archetypes rail shows count > 0, and navigating to /search?tab=watches&archetype={value} returns at least one watch for each of the 10 primary_archetype values.
result: issue
reported: "'Genre Crosser' and 'Tool Watch Purist' have a count of 0. Clicking an archetype correctly lands on /search with the filter applied, but: (1) clicking back to /explore and clicking a different archetype doesn't apply — the original archetype stays; (2) after removing the archetype filter via X, clicking a new archetype from /explore still doesn't apply — the URL param appears then is removed almost immediately. Refreshing the page fixes both. Also: the /explore 'Collector Archetypes' module should have a subtitle explaining what the section is."
severity: major
resolution: "Resolved by gap-closure plans 46-05 (G5 soft-nav facet reconciliation) and 46-06 (G4 zero-count chips hidden, G6 module subtitle). Code-verified 9/9 in 46-VERIFICATION.md. Per the G4 owner decision, zero-count chips (tool/hybrid) are now hidden rather than backfilled."

### 4. Archetype chip navigates to /search with prefiltered results and editorial header
expected: Clicking a chip on /explore lands on /search?tab=watches&archetype={value} showing watches filtered by that archetype, an archetype editorial header (displayName + description + N watches), and a removable chip above the results that dismisses via the X control.
result: pass

### 5. A–Z nav G1/G2/G3 visual confirmation after gap-closure CSS changes
expected: On /explore/brands the A–Z nav wraps onto multiple lines with no horizontal scrolling (G1); clicking a letter anchor smooth-scrolls to the target section (G2); the nav pins below the global header — not behind it — and the landed section heading clears the sticky nav (G3, `scroll-mt-28 md:scroll-mt-32`). If the nav wraps to 3 lines at the test viewport and a heading still tucks under it, the offset may need bumping to `scroll-mt-32 md:scroll-mt-40`.
result: pending

## Summary

total: 5
passed: 3
issues: 1
pending: 1
skipped: 0
blocked: 0

## Gaps

- truth: "The /explore/brands A–Z jump nav wraps onto multiple lines responsively (≈2 lines on normal widths, up to 3 on very small screens) with NO horizontal scrolling."
  status: resolved
  resolved_by: 46-06
  reason: "User reported during Test 2: dislikes the horizontal-scrollable A–Z container; wants letters to wrap to additional lines as the screen narrows, no horizontal scroll."
  severity: minor
  test: 2
  root_cause: "Enhancement, not a defect — the A–Z nav was built as a horizontal-scroll container. Change the layout to a wrapping flex row."
  artifacts:
    - path: "src/app/explore/brands/page.tsx"
      issue: "A–Z jump nav uses an overflow-x-auto / single-row layout instead of flex-wrap"
  missing:
    - "Change the A–Z nav container to `flex flex-wrap` (remove horizontal-scroll), so letters wrap to 2 lines normally and up to 3 on very small screens"
- truth: "Clicking an A–Z letter anchor on /explore/brands triggers a smooth ease-in-out scroll to the target section, not an instant hard jump."
  status: resolved
  resolved_by: 46-06
  reason: "User reported during Test 2: wants the vertical scroll to the clicked letter's section to be smooth with ease-in-out, instead of a hard jump."
  severity: minor
  test: 2
  root_cause: "Enhancement, not a defect — anchor jumps default to instant. Needs `scroll-behavior: smooth`."
  artifacts:
    - path: "src/app/explore/brands/page.tsx"
      issue: "Letter anchors jump instantly — no smooth scroll behavior set"
  missing:
    - "Apply `scroll-smooth` (Tailwind) to the scroll container or html, so letter-anchor jumps animate with ease-in-out"
- truth: "The /explore/brands A–Z nav bar stays pinned to the top of the viewport and remains visible while the user scrolls down the brand list."
  status: resolved
  resolved_by: 46-06
  reason: "User reported during Test 2: wants the A–Z nav bar sticky to the top of the screen so it is always in view on scroll-down."
  severity: minor
  test: 2
  root_cause: "`position: sticky` works correctly — the bug is the pin TARGET. The A–Z nav uses `sticky top-0 z-10`, but the global app header (SlimTopNav mobile / DesktopTopNav desktop, rendered by app/layout.tsx) is also `sticky top-0` at `z-50` with an opaque background. The A–Z nav pins to top:0 — the exact pixels the 48px(mobile)/64px(desktop) header occupies — and renders entirely behind it. No ancestor overflow trap (DOM ancestry confirmed clean)."
  artifacts:
    - path: "src/app/explore/brands/page.tsx"
      issue: "Line ~73: A–Z nav uses `sticky top-0` — pins behind the global header instead of below it"
  missing:
    - "Change the A–Z nav from `sticky top-0 z-10` to `sticky top-12 md:top-16 z-10` so it pins below the 48px mobile / 64px desktop global header"
  debug_session: .planning/debug/resolved/g3-sticky-az-nav.md
- truth: "All 10 Collector Archetypes chips resolve to at least one catalog watch — every chip shows a count > 0 (roadmap SC #4 / EXPL-05, amended to 10 by D-15)."
  status: resolved
  resolved_by: 46-06
  reason: "User reported during Test 3: the 'Genre Crosser' (hybrid) and 'Tool Watch Purist' (tool) chips show a count of 0."
  severity: major
  test: 3
  root_cause: "Genuine catalog DATA-coverage gap, NOT a query bug — getBrowseArchetypeCounts is correct. The Phase 44 taste backfill (20260518001506_phase44_taste_data.sql) assigned primary_archetype to only 101 catalog rows: tool=0, hybrid=1 (dive=43, chrono=19, dress=12, gmt=9, field=7, sport=7, pilot=2, racing=1). CONTEXT.md D-15's claim that Phase 44 verified all-10 coverage is false — verify-catalog-coverage.ts treats zero-coverage as a soft warning (exit 0) by D-16 design. AMPLIFIER: the taste migration is 100% id-keyed; per the known local/prod catalog-id divergence, id-keyed UPDATEs are partial no-ops on prod, so even the 1 hybrid row may not resolve on prod. A natural-keyed taste migration was never issued (unlike the factual backfill)."
  artifacts:
    - path: "supabase/migrations/20260518001506_phase44_taste_data.sql"
      issue: "Assigns primary_archetype=tool to 0 rows, hybrid to 1 row; id-keyed so partially no-ops on prod"
    - path: "scripts/verify-catalog-coverage.ts"
      issue: "Pre-ship coverage gate soft-warns (exit 0) on zero-coverage archetypes — let the gap ship undetected"
  missing:
    - "OWNER DECISION (2026-05-19): hide zero-count chips. CollectorArchetypes filters out any archetype whose count is 0 — the rail renders only covered archetypes (8 today), and tool/hybrid reappear automatically when v5.2 catalog expansion (SEED-009) adds coverage. Consistent with EXPL-02 'absent, not empty'. SC #4 reframes from 'all 10 resolve' to 'every visible chip resolves to ≥1 result'. No data backfill, no migration."
  debug_session: .planning/debug/resolved/g4-zero-count-archetype-chips.md
- truth: "Selecting a new archetype chip from /explore applies the new facet on /search via client-side (soft) navigation — without requiring a full page refresh."
  status: resolved
  resolved_by: 46-05
  reason: "User reported during Test 3: after a first archetype is applied, navigating back to /explore and clicking a different archetype does not apply the new filter — the original archetype persists. After removing the facet via the X chip, clicking a new archetype shows the URL param briefly then it is stripped almost immediately. A hard refresh fixes both."
  severity: major
  test: 3
  root_cause: "useSearchState makes in-memory React state the source of truth and seeds facet state from URL params ONLY at first mount (useState initializers, lines 107-111). Next.js App Router soft navigation does not remount the /search page, so a soft nav to /search?archetype=B never re-seeds state (Fault 1 — stale archetype stays). Worse, the URL-sync effect (lines 134-149) rebuilds the URL from in-memory state and router.replace()s it, with a dependency array that excludes searchParams — so after a soft nav it fires with stale state and STRIPS the just-arrived param (Fault 2 — param appears then vanishes). A hard refresh works because it remounts and re-runs the initializers."
  artifacts:
    - path: "src/components/search/useSearchState.ts"
      issue: "Lines 107-111 seed facet state from URL only at mount; lines 134-149 URL-sync effect omits searchParams from deps and clobbers incoming params on soft nav"
  missing:
    - "Add a URL→state sync: a useEffect keyed on useSearchParams() that re-seeds facet state when params change externally, AND guard the state→URL sync effect so it does not run-and-clobber on a navigation it did not originate (or read facets directly from useSearchParams as the single source of truth)"
  resolution_note: "Resolved by 46-05 (effect 1a reconciliation + Fault 2 guard). Code-review blocker CR-01 — the Fault 2 guard initially over-scoped to q/tab, which would have stale-stuck those params — was fixed in follow-up commit 4e592ab; the guard is now scoped to the seven reconciled facet params. Regression tests 11b/11c added."
  debug_session: .planning/debug/resolved/g5-soft-nav-facet-not-applied.md
- truth: "The /explore 'Collector Archetypes' module has a short subtitle that briefly explains what the section is and does."
  status: resolved
  resolved_by: 46-06
  reason: "User reported during Test 3: the Collector Archetypes module on /explore should have a subtitle briefly explaining what the section is and does."
  severity: minor
  test: 3
  root_cause: "Enhancement, not a defect — the module header renders a title with no subtitle. Add a one-line editorial subtitle."
  artifacts:
    - path: "src/components/explore/CollectorArchetypes.tsx"
      issue: "Module header has a title but no explanatory subtitle"
  missing:
    - "Add a short subtitle under the 'Collector Archetypes' heading explaining the section (identity-based entry points into the catalog)"
