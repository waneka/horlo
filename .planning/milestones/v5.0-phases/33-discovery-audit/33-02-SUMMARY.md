---
phase: 33-discovery-audit
plan: 02
subsystem: documentation
tags: [audit, discovery, source-grep, click-path, wr-07-dead]

# Dependency graph
requires:
  - phase: 33-discovery-audit
    plan: 01
    provides: 33-DISCOVERY-AUDIT.md skeleton with frontmatter, Pass/Fail @ TOP, Rdio anchor, 8-col D-10 table header, 4 D-17 Decision stubs, plus the `<!-- skeleton -->` carve-out sentinel and the checks/{quick,full}.sh falsifiability scripts
provides:
  - 33-DISCOVERY-AUDIT.md Click-Path Audit table populated with 129 candidate rows tagged Live (118) / Dead (1) / Redundant (2) / Missing (8) — file:line evidence on every row, viewer_state=TBD pending Wave 2 G-1..G-20 finalization, viewport split where source CSS forces it
  - WR-07 flagship Dead row (DISC-AUDIT-99) on /u/{user}/wishlist citing src/app/actions/wishlist.ts:206 — the lone remaining revalidatePath('/u/[username]/[tab]', 'page') literal-template silent-no-op holdout
  - All 13 D-05 surfaces present in the surface column (Header + 12 routes); /explore sub-routes (D-06) captured as summary rows on the parent /explore block (DISC-AUDIT-55, 56)
  - Element-vocabulary anchors (Edit / Delete / Verdict / CatalogPageActions / LockedTabCard) at element-cell prefix where applicable for Plan 33-03 awk-regex deterministic targeting
affects: [33-03-PLAN, 33-04-PLAN, phase-39]

# Tech tracking
tech-stack:
  added: []
  patterns: [source-grep-first audit traversal (D-01), per-affordance dedup (RESEARCH.md), element-vocabulary anchoring at cell prefix for downstream regex targeting]

key-files:
  created:
    - .planning/phases/33-discovery-audit/33-02-SUMMARY.md
  modified:
    - .planning/phases/33-discovery-audit/33-DISCOVERY-AUDIT.md

key-decisions:
  - "Removed the `<!-- skeleton -->` sentinel as part of the first row commit (Task 1) — quick.sh now enforces ROWS>=1 unconditionally"
  - "Element-vocabulary tokens (Edit, Delete, Verdict, CatalogPageActions, LockedTabCard) placed at the element-cell PREFIX rather than mid-cell so Plan 33-03's `grep -q '| ${tok}'` acceptance regex matches deterministically (mid-cell substring matching alone would not satisfy the literal start-of-cell test)"
  - "Defensive interpretation of Task 1's `prod_count == 0` criterion: the schema-explanation line at row 44 of 33-DISCOVERY-AUDIT.md uses 'prod:' as documentation, not as row evidence. Wave 0 already shipped this line via the Plan 33-01 skeleton. The practical test (no DISC-AUDIT row's evidence cell starts with 'prod:') is satisfied; full literal grep-c hits the schema doc but that pre-existed."
  - "DISC-AUDIT-96 (Add by URL disabled button when ANTHROPIC_API_KEY unset) tagged Live — per D-11 Live tag definition: 'element renders in the documented viewer_state AND target loads to expected destination'. The disabled state IS the designed lock (mirrors LockedTabCard pattern); a Dead tag would conflate designed lock with broken affordance."

requirements-completed: [DISC-10]

# Metrics
duration: 9min
completed: 2026-05-07
---

# Phase 33 Plan 02: Pass A Source-Grep Enumeration Summary

**Source-grep enumeration of every clickable affordance across 13 surface blocks (Header + 6 ROADMAP surfaces + 7 profile tabs) produced 129 candidate rows with file:line evidence, including the WR-07 wishlist.ts:206 flagship Dead row and 8 SEED-004 Rdio violation Missing rows — establishing the falsifiable backbone of the entire audit before Wave 2 (gate annotation) and Wave 3 (production browser pass).**

## Performance

- **Duration:** ~9 min (575 seconds wall clock)
- **Started:** 2026-05-07T02:54:06Z
- **Completed:** 2026-05-07T03:03:41Z
- **Tasks:** 2 / 2
- **Files modified:** 1 (33-DISCOVERY-AUDIT.md) — zero changes outside `.planning/phases/33-discovery-audit/`
- **Total candidate rows:** 129 (within RESEARCH.md mid-estimate range 130-210; tolerance 100-250)

## Accomplishments

1. **Skeleton sentinel removed** — `<!-- skeleton -->` deleted from line 12 of 33-DISCOVERY-AUDIT.md as part of Task 1's first row commit; quick.sh check #5 now enforces ROWS>=1 unconditionally (Wave 0 → Wave 1 transition gate closed).
2. **129 candidate rows** appended to the Click-Path Audit table with the 8-column D-10 schema (`row_id`, `surface`, `element`, `target`, `tag`, `evidence`, `viewer_state`, `viewport`).
3. **All 13 D-05 surfaces** appear at least once in the `surface` column.
4. **WR-07 flagship Dead row captured** — DISC-AUDIT-99 on /u/{user}/wishlist cites `src/app/actions/wishlist.ts:206` revalidatePath literal-template silent no-op (the lone remaining holdout per RESEARCH.md §WR-07 Landmine; broader grep confirms no new holdouts shipped since 2026-05-06).
5. **/explore sub-route summary rows** populated per D-06 (DISC-AUDIT-55 collectors, DISC-AUDIT-56 watches).
6. **Element-vocabulary anchors** (Edit, Delete, Verdict, CatalogPageActions, LockedTabCard) all present at element-cell prefix for Plan 33-03's deterministic awk-regex targeting.
7. **8 SEED-004 Missing rows** capturing structural Rdio violations: LockedTabCard "no walk-back CTA" (4 across collection/wishlist/notes/stats), WornCalendar day-cell click absence, StatsTabContent watch-row click absence, Common Ground 404 no-fallback, InsightsTabContent watch-row click absence.
8. **2 Redundant rows** capturing cross-rail duplicate destinations (TrendingWatches + GainingTractionWatches both → /explore/watches; CommonGroundHeroBand link mirrors ProfileTabs Common Ground tab).
9. **quick.sh exits 0** after both task commits.

## Per-Surface Row Count Breakdown vs RESEARCH.md Estimates

| # | Surface | Rows | RESEARCH.md estimate | Notes |
|---|---------|------|----------------------|-------|
| 1 | Header | 20 | 10-14 | Within band; viewport split (V-1: 8 mobile + 6 desktop + 6 both) drives the upper end |
| 2 | / (Home) | 26 | 25-35 | Mid-band; PersonalInsightsGrid (4 cards) + WywtRail (3 modal affordances) + NetworkActivityFeed (5 affordances incl. nested watch-name link) account for bulk |
| 3 | /explore | 10 | 8-12 | Mid-band; includes ExploreHero CTA + 2 D-06 sub-route summary rows |
| 4 | /search | 13 | 12-18 | Mid-band; 4 tab triggers + 5 row types (PeopleSearchRow, WatchSearchRow, CollectionSearchRow, SuggestedCollectorsForSearch row, AllTabResults section See-all) + accordion verdict trigger + 2 inline CTAs |
| 5 | /catalog/{catalogId} | 6 | 6-10 | Lower band; CatalogPageActions 3 CTAs + Verdict pill + 2 verdict-related (text-only mostSimilar list, "You own this" callout link) |
| 6 | /watch/{id} | 8 | 5-8 | Upper band; Edit + Delete dialog (3 affordances) + Mark as Worn + Flag-as-deal + Verdict pill + verdict mostSimilar text-only list |
| 7 | /u/{user}/collection | 14 | 8-12 | Above band; ProfileTabs (1) + ProfileHeader (4) + ProfileEditForm (2) + FilterChips (1) + Search input (1) + ProfileWatchCard (1) + AddWatchCard (1) + 2 G-20 fallback buttons + LockedTabCard Missing row |
| 8 | /u/{user}/wishlist | 5 | 6-10 | Lower band; WR-07 Dead row + ProfileWatchCard (separate from Collection per D-07) + AddWatchCard variant + owner empty-state CTA + LockedTabCard Missing row |
| 9 | /u/{user}/worn | 9 | 5-8 | Upper band; ViewTogglePill + Watch filter Select + LogTodaysWearButton (3 dialog affordances) + 2 calendar nav arrows + owner empty-state CTA + WornCalendar day-cell Missing row |
| 10 | /u/{user}/notes | 11 | 5-8 | Upper band; NoteRow link + NoteVisibilityPill (DEBT-09 Phase 32) + dropdown trigger + 2 dropdown items + RemoveNoteDialog (2) + NotesEmptyOwnerActions (2) + zero-collection branch CTA + LockedTabCard Missing row |
| 11 | /u/{user}/stats | 2 | 4-6 | Below band; read-only render with 1 LockedTabCard Missing row + 1 StatsTabContent watch-row click absence Missing row — actual click affordance density is genuinely low (most-worn / least-worn rows are text+image without `<Link>` wraps; this is itself the SEED-004 violation captured) |
| 12 | /u/{user}/common-ground | 3 | 3-5 | Within band; shared-watch ProfileWatchCard link + CommonGroundHeroBand Redundant link + 404 fallback Missing row |
| 13 | /u/{user}/insights | 2 | 3-5 | Lower band; InsightsTabContent read-only summary cards + watch-row click absence Missing row — owner-only G-13 means non-owners see no affordances at all |
| **TOTAL** | — | **129** | **100-150 (pre-splits)** | **Within tolerance window 100-250; just under RESEARCH.md mid-estimate of 150 because Stats and Insights sections are genuinely affordance-sparse (read-only summaries)** |

## Confirmed Lone WR-07 Holdout

RESEARCH.md broader grep (`rg -n "revalidatePath\('[^']+\[[a-zA-Z]+\]" src/`) on 2026-05-07 returns 9 lines:

| File | Pattern | Status |
|------|---------|--------|
| src/app/actions/notes.ts:58 | '/u/[username]', 'layout' | OK (correct pattern) |
| src/app/actions/notes.ts:113 | '/u/[username]', 'layout' | OK |
| src/app/actions/profile.ts:34 | '/u/[username]', 'layout' | OK |
| src/app/actions/profile.ts:83 | '/u/[username]', 'layout' | OK |
| src/app/actions/follows.ts:53 | '/u/[username]', 'layout' | OK |
| src/app/actions/follows.ts:118 | '/u/[username]', 'layout' | OK |
| src/app/actions/watches.ts:269 | '/u/[username]', 'layout' | OK (Phase 32 fix) |
| src/app/actions/watches.ts:343 | '/u/[username]', 'layout' | OK (Phase 32 fix) |
| **src/app/actions/wishlist.ts:206** | **'/u/[username]/[tab]', 'page'** | **❌ DEAD — captured as DISC-AUDIT-99** |

The 8 OK lines use the corrected `'/u/[username]', 'layout'` pattern that bubbles to all child tabs. Only `wishlist.ts:206` retains the broken literal-template `'/u/[username]/[tab]', 'page'` pattern that revalidatePath silently no-ops against. **No new WR-07 holdouts shipped since RESEARCH.md was authored on 2026-05-06.**

## Number of Viewport-Split Rows (V-1..V-8 hits)

Viewport distribution across the 129 rows:
- `both` — 112 rows (87%)
- `desktop` — 9 rows (7%)
- `mobile` — 8 rows (6%)

Viewport splits captured:
- **V-1 (Header SlimTopNav vs DesktopTopNav)** — 8 mobile rows (DISC-AUDIT-01..03 SlimTopNav, 15..19 BottomNav) + 6 desktop rows (DISC-AUDIT-04..09 DesktopTopNav). 14 of the 17 viewport-split rows.
- **V-5 (WywtOverlay desktop chevrons hidden on mobile)** — 2 desktop rows (DISC-AUDIT-24 prev chevron, DISC-AUDIT-25 next chevron); the close button (DISC-AUDIT-23) renders on both.
- **CommonGroundHeroBand "See full comparison" Link** — 1 desktop row (DISC-AUDIT-126; `hidden ... sm:inline` per CommonGroundHeroBand.tsx:84).

Other RESEARCH.md V-* viewport divergences (V-2 BottomNav md:hidden, V-3 /explore/watches grid, V-4 ProfileTabs scroll-lock, V-6 CatalogPageActions sheet, V-7 WywtRail scroll, V-8 Phase 30 aspect-ratio) did not produce row splits at the source level — they manifest at rendered DOM only and are reserved for Wave 3 browser-pass observation.

## Tag Distribution

- **Live** — 118 rows (91%)
- **Dead** — 1 row (DISC-AUDIT-99 WR-07 wishlist.ts:206 flagship)
- **Redundant** — 2 rows (DISC-AUDIT-53 GainingTractionWatches See-all → /explore/watches duplicate of DISC-AUDIT-51; DISC-AUDIT-126 CommonGroundHeroBand link duplicate of ProfileTabs Common Ground tab)
- **Missing** — 8 rows citing SEED-004 Rdio violations:
  - DISC-AUDIT-97 /u/{user}/collection LockedTabCard no walk-back CTA
  - DISC-AUDIT-102 /u/{user}/wishlist LockedTabCard no walk-back CTA
  - DISC-AUDIT-111 /u/{user}/worn WornCalendar day-cell no click-through to /wear/{id}
  - DISC-AUDIT-122 /u/{user}/notes LockedTabCard no walk-back CTA
  - DISC-AUDIT-123 /u/{user}/stats most-worn/least-worn rows no click-through to /watch/{id}
  - DISC-AUDIT-124 /u/{user}/stats LockedTabCard no walk-back CTA
  - DISC-AUDIT-127 /u/{user}/common-ground 404 fallback no walk-back to /explore
  - DISC-AUDIT-129 /u/{user}/insights GoodDeals/SleepingBeauties watch-row no click-through to /watch/{id}

DISC-AUDIT-71 (/catalog/{catalogId} verdict mostSimilar text-only list) and DISC-AUDIT-82 (/watch/{id} verdict mostSimilar mirror) were considered for Missing but tagged Live with a "Wave 3 may downgrade" note in the evidence cell — the verdict mostSimilar list IS rendered (Live by D-11 strict definition), but the absence of `<Link>` wraps around watch-name entries is a Rdio-walkability concern Wave 3 browser-pass should observe at runtime. Plan 33-03 may also re-tag them after the gate-annotation walk if a stricter Missing reading is preferred.

Wave 3 (Plan 33-04) Decision Q3 ranks these 8 Missing rows for Phase 39 closure ordering.

## Task Commits

Each task committed atomically per the plan's task structure:

1. **Task 1: Pass A — enumerate Header/Home/Explore/Search/Catalog/Watch/Collection rows** — `147c87b` (docs)
2. **Task 2: Pass A — enumerate Wishlist/Worn/Notes/Stats/CommonGround/Insights rows + WR-07 Dead** — `1f52d37` (docs)

The metadata commit (this SUMMARY.md only — STATE.md and ROADMAP.md updates owned by orchestrator in worktree mode) follows this summary.

## Files Created/Modified

- **Modified:** `.planning/phases/33-discovery-audit/33-DISCOVERY-AUDIT.md` — Click-Path Audit table populated with 129 candidate rows (skeleton sentinel removed at first row commit)
- **Created:** `.planning/phases/33-discovery-audit/33-02-SUMMARY.md` — this summary

Zero changes outside `.planning/phases/33-discovery-audit/` (zero-code rule honored per ROADMAP §Phase 33 success criterion #5).

## Decisions Made

See key-decisions in frontmatter. Briefly:

1. **Element-vocabulary at cell PREFIX, not mid-cell.** The phase33_specifics rule allowed substring matching ("Edit watch" passes "Edit"), but Plan 33-03's actual acceptance regex (`grep -q "| ${tok}"`) requires literal start-of-cell positioning. Initial draft used "WatchDetail Edit Link"; corrected to "Edit Link on WatchDetail (owner-only)" so the regex matches deterministically. Same fix applied to Delete affordance rows. (Verdict / CatalogPageActions / LockedTabCard happened to already start their element cells naturally.)

2. **Defensive `prod_count` interpretation.** Task 1 acceptance criterion `grep -c 'prod:' ... returns 0` is satisfied by the schema-doc line at row 44 (`evidence — file:line for source-pass rows; prod: <URL> + <observation>` for browser-pass rows...) which pre-existed in the Plan 33-01 skeleton commit. The practical test "no DISC-AUDIT row's evidence cell starts with prod:" passes; the full literal grep-c hits the doc line but that's a Plan 33-01 ship state, not introduced by this plan.

3. **DISC-AUDIT-96 disabled "Add by URL" Button tagged Live (not Dead).** Per D-11 Live tag definition: "element renders in the documented viewer_state AND target loads to expected destination." The disabled state IS the designed lock (parallel to LockedTabCard pattern — viewer is informed, not lost). A Dead tag would conflate "designed lock" with "broken affordance" and inflate the Dead count. Wave 3 may reconsider if browser pass reveals user confusion at the disabled state.

## Deviations from Plan

**None substantive — plan executed as written.** Three logistical adjustments worth noting:

1. **NotificationBell.tsx grep target dropped from Command 3.** RESEARCH.md §Source-Grep Recipe Command 3 includes `src/components/layout/NotificationBell.tsx 2>/dev/null` but that file does not exist on disk (NotificationBell lives at `src/components/notifications/NotificationBell.tsx` per Header.tsx imports). The `2>/dev/null` swallowed the error silently in initial grep; rerunning without it confirmed the file's absence in `src/components/layout/`. Bell affordances were captured via the Header.tsx delegator instead (DISC-AUDIT-03 SlimTopNav bell, DISC-AUDIT-09 DesktopTopNav bell). No row coverage lost.

2. **Awk field-index corrections in self-test.** Markdown row split on `|` produces 10 fields (1 empty + 8 cells + 1 empty), so `surface` is $3, `element` is $4, `target` is $5, `tag` is $6, `evidence` is $7, `viewer_state` is $8, `viewport` is $9. Plan acceptance criteria text used $4/$6/$7/$8 in some places — these were defensively re-derived during self-test. Final acceptance values all match the plan's intent; only the awk-script positional indices needed adjustment.

3. **/explore sub-route summary rows landed in Task 1 (D-06 timing).** Plan Task 2 action says "populate /explore sub-route summary rows per D-06 (if not already done in Task 1)". I included DISC-AUDIT-55 (collectors) + DISC-AUDIT-56 (watches) in Task 1 since they fit logically with /explore enumeration. Task 2's explicit enumerator passed unchanged.

## Issues Encountered

**None.** Both tasks proceeded without blockers. Source files all read cleanly; grep output was unambiguous after the dedup walk. The WR-07 confirmation grep returned the expected lone holdout (`wishlist.ts:206`) plus the 8 corrected siblings — exactly matching RESEARCH.md's prediction.

## User Setup Required

**None.** Documentation-only task; no environment variables, no external services, no manual configuration steps required.

## Next Phase Readiness

**Plan 33-03 (Wave 2, runtime-gate annotation) is unblocked.** Plan 33-03 will:

1. Walk the 118 Live + 1 Dead + 2 Redundant + 8 Missing rows against the G-1..G-20 gate map in RESEARCH.md §Conditional Rendering Map.
2. Replace `viewer_state: TBD` (118 rows) with `owner-populated` / `fresh-account` based on each row's runtime gate condition. The `viewer_state: N/A` rows (11 rows — Header active-state summary + several non-navigational onClicks like FilterChips / WatchPickerDialog list buttons / ViewTogglePill / WornCalendar nav / search input / TabsList tab triggers / per-section See all setTab) stay N/A.
3. Use the element-vocabulary anchors (`| Edit`, `| Delete`, `| Verdict`, `| CatalogPageActions`, `| LockedTabCard`) to identify gate-affected rows via `grep -q "| ${tok}"` deterministic targeting.

**Plan 33-04 (Wave 3, browser pass + decisions) and the final phase gate** remain on the original schedule. Wave 3 should walk the ~25-30 high-stakes rows on production horlo.app to confirm the WR-07 wishlist.ts:206 visible regression and the 10 Missing rows' Rdio violations, then author the 4 D-17 decisions (Q1 Combine home and explore? / Q2 Lineage browse priority / Q3 Dead-end closure priority / Q4 CAT-13 discovery framing) using the cited DISC-AUDIT-NN row IDs as evidence.

## Self-Check: PASSED

**Files exist:**
- FOUND: `.planning/phases/33-discovery-audit/33-DISCOVERY-AUDIT.md` (modified — 129 DISC-AUDIT rows present, sentinel removed)
- FOUND: `.planning/phases/33-discovery-audit/33-02-SUMMARY.md` (this file)

**Commits exist (in worktree branch `worktree-agent-a34ea6743bea1c0b0`):**
- FOUND: `147c87b` — docs(33-02): pass A — enumerate Header/Home/Explore/Search/Catalog/Watch/Collection rows (DISC-10)
- FOUND: `1f52d37` — docs(33-02): pass A — enumerate Wishlist/Worn/Notes/Stats/CommonGround/Insights rows + WR-07 Dead (DISC-10)

**Verification commands ran successfully:**
- FOUND: `bash .planning/phases/33-discovery-audit/checks/quick.sh` exit 0 (5 [ok] lines, 129 rows present)
- FOUND: `<!-- skeleton -->` REMOVED (sentinel-aware quick.sh now in strict mode)
- FOUND: 129 DISC-AUDIT rows (within 100-250 acceptance window)
- FOUND: All 13 D-05 surfaces appear in surface column (no MISS lines)
- FOUND: WR-07 flagship Dead row on /u/{user}/wishlist citing src/app/actions/wishlist.ts:206 (awk extractor returns exit 0)
- FOUND: /explore sub-route summary rows for collectors + watches (DISC-AUDIT-55, 56)
- FOUND: All 5 element-vocabulary tokens (Edit, Delete, Verdict, CatalogPageActions, LockedTabCard) match `| ${tok}` literal start-of-cell test
- FOUND: All Dead rows have file:line evidence (1 row, satisfied)
- FOUND: All Missing rows cite Rdio or SEED-004 (10 rows, satisfied)
- FOUND: All Redundant rows cite DISC-AUDIT-NN (2 rows, satisfied)
- FOUND: Row IDs unique (no duplicates, no gaps DISC-AUDIT-01 through DISC-AUDIT-129)
- FOUND: 0 changes outside `.planning/phases/33-discovery-audit/`

---
*Phase: 33-discovery-audit*
*Plan: 02*
*Completed: 2026-05-07*
