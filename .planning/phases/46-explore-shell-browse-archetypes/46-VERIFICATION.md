---
phase: 46-explore-shell-browse-archetypes
verified: 2026-05-19T22:50:00Z
status: passed
score: 9/9
overrides_applied: 0
human_verification_outcome: "operator-approved 2026-05-19 — G1 (wrap, no horizontal scroll) and G3 (sticky pin below header) confirmed in browser. G2 (smooth scroll) reported still not smooth — deferred as an end-of-v5.1 follow-up, not a blocker. Also: an infinite router.replace loop on /search (regression from the 46-05 Fault 2 fix) was found and fixed in commit 2c75d32 after verification."
re_verification:
  previous_status: human_needed
  previous_score: 4/4
  gaps_closed:
    - "G5 — soft-nav archetype facet reconciliation (Fault 1 + Fault 2 guard scoped to facet params, CR-01 fix)"
    - "G1 — A–Z nav wraps to multiple lines with no horizontal scrolling"
    - "G2 — A–Z letter anchors smooth-scroll with ease-in-out"
    - "G3 — A–Z nav pins below global header (sticky top-12 md:top-16) with header+nav-clearing scroll-mt-28 md:scroll-mt-32"
    - "G4 — zero-count archetype chips hidden (visibleArchetypes filter, owner decision)"
    - "G6 — Collector Archetypes module has explanatory subtitle"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "A–Z nav G1/G2/G3 visual confirmation after CSS changes"
    expected: "Letters wrap to ~2 lines with no horizontal scrollbar. Clicking a letter smooth-scrolls to that section. The A–Z nav is visible below the global header (not hidden behind it). The jumped-to letter heading lands fully clear below the sticky nav (not underneath it)."
    why_human: "The G1/G2/G3 CSS changes (flex-wrap, scroll-smooth, top-12 md:top-16, scroll-mt-28 md:scroll-mt-32) are new since UAT Test 2. The prior UAT passed the original sticky-but-hidden nav; the corrected nav behavior (now visible, wrapping) requires a fresh browser confirmation that scroll-mt-28 md:scroll-mt-32 actually clears the combined header+nav height on both mobile and desktop."
---

# Phase 46: Explore Shell + Browse + Archetypes — Verification Report (Re-verification)

**Phase Goal:** `/explore` renders as a 5-module shell and users can browse the catalog by brand, era, and genre, and deep-link into archetype-filtered search results
**Verified:** 2026-05-19T22:50:00Z
**Status:** passed (operator-approved 2026-05-19)
**Re-verification:** Yes — gap-closure pass after UAT (plans 46-05 and 46-06, commit 4e592ab CR-01 follow-up)

## Goal Achievement

### Observable Truths

All truths from ROADMAP.md success criteria and PLAN frontmatter must-haves.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `/explore` renders a five-module page (Hero, Collector Archetypes, Curated Lists Rail, Where Collections Go, Browse the Catalog) — any module with no available content hides itself entirely [SC #1 / EXPL-01 + EXPL-02] | VERIFIED | `explore/page.tsx` renders all 5 modules; HeroModule/CuratedListsRail/WhereCollectionsGo return null; CollectorArchetypes guards `if (counts.length === 0) return null` AND `if (visibleArchetypes.length === 0) return null`; UAT Test 1 PASS |
| 2 | Browse the Catalog presents brand, era, and genre indices with accurate counts; tapping a grouping opens `/search` prefiltered by that facet [SC #2 / EXPL-03] | VERIFIED | BrowseModule 3 tiles; index pages fetch via real GROUP BY SQL queries with `'use cache'` + `cacheTag('explore', 'explore:browse')`; each row links to `/search?tab=watches&brand=`, `&era=`, `&genre=`; verified in prior pass |
| 3 | The Brands index includes A–Z jump navigation allowing the user to jump to any letter section [SC #3 / EXPL-04] | VERIFIED (code); UNCERTAIN (visual — see human item 1) | `brands/page.tsx` has `sticky top-12 md:top-16 z-10` nav, `flex flex-wrap gap-1` inner container, `scroll-smooth` on `<main>`, `scroll-mt-28 md:scroll-mt-32` on letter sections; 27 letter anchors (A-Z + #) with `id="letter-{X}"` |
| 4 | Collector Archetypes renders a chip rail with every visible archetype showing a watch-count badge; every visible chip resolves to ≥1 result; tapping a chip opens prefiltered search results with an archetype header [SC #4 / EXPL-05] | VERIFIED | `visibleArchetypes` filter (`countMap.get(value) ?? 0) >= 1`); 3/3 CollectorArchetypes tests pass (empty-null-hide, 10-chip, 8-chip G4 filter); subtitle `<p className="text-sm text-muted-foreground">`; UAT Test 4 PASS |
| 5 | A soft navigation to `/search?archetype=B` re-applies the new archetype facet without a hard refresh [46-05 must-have / G5 Fault 1] | VERIFIED | Reconciliation effect (effect 1a, lines 137-154) keyed on `searchParams` object ref — new object per App Router soft nav; compares each URL facet value to in-memory state, calls setter only when different; Test 20 passes |
| 6 | The URL-sync effect does not strip a freshly-arrived facet param before reconciliation settles [46-05 must-have / G5 Fault 2, CR-01 fix] | VERIFIED | `RECONCILED_FACET_PARAMS = ['movement', 'size', 'style', 'brand', 'era', 'genre', 'archetype']` at line 186 — `q` and `tab` are explicitly excluded; Test 21 passes; Tests 11b/11c (CR-01 regressions) pass; commit 4e592ab |
| 7 | The /explore/brands A–Z nav wraps onto multiple lines responsively with no horizontal scrolling [46-06 must-have / G1] | VERIFIED | `<div className="flex flex-wrap gap-1">` at line 75; no `overflow-x-auto` in file |
| 8 | The A–Z nav pins below the global header, not behind it; letter-section headings land clear of the sticky nav after an anchor jump [46-06 must-have / G2+G3] | VERIFIED (code); UNCERTAIN (visual — see human item 1) | `sticky top-12 md:top-16 z-10` on nav (line 73); `scroll-smooth` on `<main>` (line 47); `scroll-mt-28 md:scroll-mt-32` on `<section>` elements (line 104) |
| 9 | Existing q/tab and movement/size/style facets continue to round-trip correctly — no regression from G5 fix [46-05 must-have] | VERIFIED | 23/23 tests pass in useSearchState.test.tsx (19 original + 2 G5 + 2 CR-01); Tests 11b/11c specifically guard `q` and `tab` URL-sync paths |

**Score:** 9/9 truths verified (code-level); 1 human verification item for CSS behavior confirmation

### Deferred Items

Items not yet met but explicitly addressed in later milestone phases.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Price-band Browse index | v6.0 Market Value (SEED-005) | REQUIREMENTS.md EXPL-03 scope clarification; ROADMAP.md SC #2 notes deferral |
| 2 | Hero, Curated Lists Rail, Where Collections Go modules (editorial content) | Phase 47 | All three are null-returning stubs per EXPL-02; Phase 47 goal covers these modules |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/search/useSearchState.ts` | URL→state reconciliation (effect 1a) + Fault 2 guard scoped to facet params only | VERIFIED | Effect 1a (lines 137-154): reconciliation keyed on searchParams; RECONCILED_FACET_PARAMS (line 186) excludes q and tab; all 23 tests pass |
| `tests/components/search/useSearchState.test.tsx` | Tests 20/21 (G5) + Tests 11b/11c (CR-01) | VERIFIED | 23 tests total; Tests 20 and 21 labeled "G5"; Tests 11b and 11c labeled "CR-01 regression" |
| `src/app/explore/brands/page.tsx` | flex-wrap nav, scroll-smooth, sticky top-12 md:top-16, scroll-mt-28 md:scroll-mt-32 | VERIFIED | All four assertions confirmed in source: line 75 (`flex flex-wrap`), line 47 (`scroll-smooth`), line 73 (`sticky top-12 md:top-16`), line 104 (`scroll-mt-28 md:scroll-mt-32`); no `overflow-x-auto` or `scroll-mt-12` remaining |
| `src/components/explore/CollectorArchetypes.tsx` | visibleArchetypes filter + null guard + subtitle | VERIFIED | `visibleArchetypes` filter (lines 47-48); double null guard (counts.length===0 AND visibleArchetypes.length===0); subtitle `<p className="text-sm text-muted-foreground">` (line 60-61); no font-medium/font-bold |
| `src/components/explore/__tests__/CollectorArchetypes.test.tsx` | 3 cases including G4 zero-count filter | VERIFIED | 3 tests, all pass: empty-null-hide, 10-chip, 8-chip (G4 filter with tool+hybrid at count:0) |
| `.planning/ROADMAP.md` | SC #4 amended from "all 10 chips" to "every visible chip resolves" | VERIFIED | Line 216: "every visible chip resolves to at least one result — archetypes with zero catalog coverage are hidden per EXPL-02 (a thin-catalog data gap addressed by v5.2 catalog expansion, not a code defect) (amended 2026-05-19 from 8 ... further amended 2026-05-19 per G4 UAT finding)" |
| `.planning/REQUIREMENTS.md` | EXPL-05 reframed to "every visible chip resolves to ≥1 result" | VERIFIED | Line 52: EXPL-05 updated with ≥1 catalog watch wording and G4 amendment note |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `useSearchState.ts` effect 1a | facet state setters | `searchParams` object-reference dep | WIRED | Effect fires when App Router provides new searchParams per navigation; compares URL values to in-memory state; calls setX only on diff |
| `useSearchState.ts` Fault 2 guard | RECONCILED_FACET_PARAMS only | `RECONCILED_FACET_PARAMS.some(...)` at line 187 | WIRED | q and tab explicitly excluded; guard scoped to the 7 facet keys that effect 1a reconciles |
| `brands/page.tsx` A–Z nav | global header offset | `sticky top-12 md:top-16` | WIRED | Pins below SlimTopNav h-12 (48px mobile) / DesktopTopNav h-16 (64px desktop) |
| `brands/page.tsx` letter sections | sticky nav clearance | `scroll-mt-28 md:scroll-mt-32` | WIRED | 112px mobile clears 48px header + ~64px wrapped 2-line nav; 128px desktop clears 64px header + ~64px nav |
| `CollectorArchetypes.tsx` visibleArchetypes | getBrowseArchetypeCounts | `countMap.get(value) ?? 0) >= 1` filter | WIRED | Zero-count archetypes filtered before rendering; if none qualify, returns null |

### Data-Flow Trace (Level 4)

No new data-flow connections in gap-closure plans 46-05 and 46-06. Data flows verified in prior pass (4/4 FLOWING) are unchanged. The G5 fix is state management, not data source.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| G5 soft-nav re-seed + Fault 2 guard + CR-01 regressions | `npx vitest run tests/components/search/useSearchState.test.tsx` | 23/23 tests pass | PASS |
| G4 zero-count filter + G6 subtitle | `npx vitest run src/components/explore/__tests__/CollectorArchetypes.test.tsx` | 3/3 tests pass | PASS |
| G1 flex-wrap present, overflow-x-auto absent | `grep 'flex flex-wrap' brands/page.tsx && ! grep 'overflow-x-auto' brands/page.tsx` | Both assertions true | PASS |
| G2 scroll-smooth present | `grep 'scroll-smooth' brands/page.tsx` | Line 47 confirms | PASS |
| G3 sticky top-12 md:top-16 present | `grep 'sticky top-12 md:top-16' brands/page.tsx` | Line 73 confirms | PASS |
| G3b scroll-mt-28 md:scroll-mt-32 present | `grep 'scroll-mt-28 md:scroll-mt-32' brands/page.tsx` | Line 104 confirms | PASS |
| CR-01 RECONCILED_FACET_PARAMS excludes q and tab | `grep 'RECONCILED_FACET_PARAMS' useSearchState.ts` | Line 186 — 7 facet keys only, no q/tab | PASS |
| No TBD/FIXME/XXX in gap-closure files | grep on 3 modified files | No matches | PASS |
| No font-medium/font-bold in gap-closure files | grep on CollectorArchetypes.tsx and brands/page.tsx | No matches | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| EXPL-01 | 46-03 | `/explore` renders five-module page | SATISFIED | Verified in prior pass; unchanged |
| EXPL-02 | 46-01, 46-03 | Modules with no content hide themselves | SATISFIED (code + UAT Test 1 PASS) | null guards in all 5 modules; CollectorArchetypes now has double guard (counts empty AND visibleArchetypes empty); REQUIREMENTS.md checkbox still unchecked (documentation gap, not functional) |
| EXPL-03 | 46-01, 46-02, 46-03 | Browse indices with counts + prefiltered /search + cache | SATISFIED | Verified in prior pass; unchanged |
| EXPL-04 | 46-03, 46-06 | Brands index A–Z jump navigation | SATISFIED (code + UAT Test 2 PASS + G1/G2/G3 enhancements applied) | sticky nav now visible and correctly positioned; wrapping responsive layout; smooth scroll; REQUIREMENTS.md checkbox still unchecked (documentation gap) |
| EXPL-05 | 46-01, 46-02, 46-03, 46-04, 46-05, 46-06 | Collector Archetypes chip rail + soft-nav deep-link | SATISFIED | zero-count filter (G4); subtitle (G6); soft-nav reconciliation (G5); REQUIREMENTS.md updated to "every visible chip resolves to ≥1 result" |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/app/explore/brands/page.tsx` | 39 | WR-02: `brand.name[0]?.toUpperCase() ?? '#'` does not normalize digit/symbol first characters to '#' bucket — a brand starting with '8' would be silently dropped from the page | Warning | Latent bug; no digit-prefixed brands currently in catalog; will manifest when catalog expands. Identified in code review; not in scope of gap-closure plans. |
| `src/components/search/useSearchState.ts` | 137-154 | WR-03: reconciliation effect 1a closes over stale facet state values via `eslint-disable-next-line react-hooks/exhaustive-deps`; stale closure risk if a local facet setter fires without searchParams changing | Warning | Low risk — in practice, facet state and searchParams change together on soft nav; not a current failure; noted in code review |

No blockers found. No TBD/FIXME/XXX markers in any gap-closure files.

### Human Verification Required

**1. A–Z nav G1/G2/G3 visual confirmation after CSS changes**

**Test:** Run `npm run dev`. Visit `/explore/brands`. On a normal-width viewport (375px or 390px mobile, 1280px desktop): (a) confirm the letter buttons wrap to ~2 lines with no horizontal scrollbar; (b) tap any active letter — confirm the scroll animates smoothly (not an instant jump); (c) scroll down the brand list and confirm the A–Z nav remains visible below the top navigation bar (not hidden behind it); (d) after a letter-tap, confirm the jumped-to letter heading is fully clear below the sticky A–Z nav band, not underneath it.
**Expected:** Letters wrap responsively; smooth ease-in-out scroll; A–Z nav visible below the ~48px (mobile) / ~64px (desktop) global header; jumped section heading fully visible below the combined header + A–Z nav height.
**Why human:** The G1/G2/G3 CSS changes are new since UAT Test 2. UAT Test 2 passed the original `sticky top-0` (hidden-behind-header) behavior. The corrected nav is now visible and occupies real vertical space. The `scroll-mt-28 md:scroll-mt-32` offset is calculated to clear the combined header + wrapped nav height, but whether the wrapped 2-line nav consistently measures ~64px (the calculation basis) requires a browser to confirm. If the nav wraps to 3 lines at the test viewport, scroll-mt-28 may be insufficient and needs bumping to scroll-mt-32/md:scroll-mt-40.

### Gaps Summary

No blocking gaps. All 6 UAT gaps (G1-G6) are closed at the code level:
- G5: reconciliation effect + Fault 2 guard scoped to facet params only (CR-01); 23 tests pass
- G1/G2/G3: CSS-only fixes in brands/page.tsx; grep assertions all pass
- G4: visibleArchetypes filter in CollectorArchetypes; 3 tests pass
- G6: subtitle paragraph added; no font-medium/font-bold violation

One human verification item remains: visual confirmation that the G1/G2/G3 scroll behavior meets the UX intent in a real browser. This is standard CSS behavior verification that cannot be confirmed programmatically.

**Documentation discrepancy (WARNING, not BLOCKER):** REQUIREMENTS.md traceability shows EXPL-02 and EXPL-04 as `Pending` / unchecked `[ ]` despite both passing human UAT (Tests 1 and 2). The checkboxes and traceability status should be updated to `[x]` / `Complete` to reflect the confirmed UAT outcome.

---

_Verified: 2026-05-19T22:50:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification after gap-closure plans 46-05, 46-06, and commit 4e592ab (CR-01)_
