---
phase: 84-wear-history-depth
verified: 2026-09-13T17:41:09Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "WR-02 date-preflight gating: open 'Log a wear', pick a past date already logged for a watch, confirm it renders disabled with 'Already logged'; change date again quickly and confirm the row list never shows stale disabled state and Submit stays disabled until the fresh preflight resolves."
    expected: "No stale disabled/enabled flicker; Submit only enables once the preflight for the currently-selected date has returned; re-opening the dialog never carries over the previous session's disabled set."
    why_human: "Timing-dependent client state (in-flight preflight request) — not observable via static analysis; commit 1915d2a7 changed this behavior after the prod walk in 84-07."
  - test: "WR-03 error handling: with dev tools throttling/offline, submit a backfill wear and confirm the dialog shows an inline 'Couldn't log that wear. Please try again.' alert and stays open, instead of crashing to an error boundary."
    expected: "Inline role=alert message, dialog remains open, Submit re-enables."
    why_human: "Requires simulating a rejected Server Action call (network failure) — not exercised by the prod walk, which predates commit 4e39c487."
  - test: "WR-04 unlinked leaderboard rows for a non-owner viewing a private collection: as a second seeded user, view a profile with collection_public=false and confirm leaderboard rows for watches you have a visible wear for render as plain (non-clickable) rows, not dead links to /w/[id]."
    expected: "Rows for a private-collection profile do not navigate anywhere when tapped/clicked (no hover/focus ring, no href)."
    why_human: "Visual/interactive confirmation that unlinked rows render correctly and don't 404 — commit 425a7858 postdates the prod walk in 84-07, which only tested the pre-fix (linked, 404-prone) behavior."
  - test: "WR-05 empty states: as a non-owner viewing a profile with zero wears in the selected window (but some wears exist outside it), confirm only one empty-state message appears (no stacked 'No wears in this window' + 'Nothing here yet'); as the owner, confirm the CTA copy still reads 'log a wear to get started'; as a non-owner, confirm it reads 'Try a longer window.' without a CTA."
    expected: "No duplicate/stacked empty-state cards; owner vs non-owner copy differs as specified; leaderboard is not mounted at all when the profile has zero wears total."
    why_human: "UX/visual state combinations (owner vs non-owner x zero-wears vs zero-in-window) — commit da46472c postdates the 84-07 prod walk and changes copy/mount conditions that were UI-SPEC-locked differently before the fix."
  - test: "WR-01 plausible-today bound: attempt to submit a backfill wear with the device clock set far in the future or past (if testable) or confirm via code review only if device-clock manipulation isn't practical; otherwise confirm normal-timezone backfill (e.g., a device in UTC+13/UTC-11) still succeeds without being falsely rejected."
    expected: "Normal timezones (UTC-12 to UTC+14) can still log wears; only implausible client 'today' values (clock more than 14h off server UTC) are rejected with 'Check your device's date and try again.'"
    why_human: "Requires a real device/browser clock in an edge timezone to confirm the ±14h bound doesn't false-reject legitimate users — commit bfa52253 postdates the 84-07 prod walk."
---

# Phase 84: Wear history depth Verification Report

**Phase Goal:** Give the Worn tab teeth — every entry links into its own detail page, past dates can be backfilled without a photo, and the tab surfaces an across-collection wear-count leaderboard with a time-window control.
**Verified:** 2026-09-13T17:41:09Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Tapping any entry in the Worn tab opens that wear's `/wear/[id]` detail page (WEAR-01, D-15) | VERIFIED | `src/components/profile/WornTimeline.tsx:73` and `src/components/profile/WornCalendar.tsx:276` both wrap rows in `<Link href={`/wear/${id}`}>` with hover/focus-visible ring + trailing `ChevronRight`. Calendar day cells remain `role="button"` selectors (not links), consistent with D-15's "calendar day cells keep select-a-day behavior." |
| 2 | User can log a wear on a past date without a photo via a backfill affordance; it appears on the Worn tab dated to the chosen day (WEAR-02, D-01..D-07) | VERIFIED | `logBackfillWear` (`src/app/actions/wearEvents.ts:551-641`) validates via zod `.strict()` schema (no photoUrl field, server hard-codes `photoUrl: null`), rejects future `wornDate` (`wornDate > today`), bounds client-supplied `today` to ±14h of server UTC (`isPlausibleClientToday`, post-review fix WR-01), IDOR-guards the watch lookup, and gates `logActivity` on `wornDate === today` (D-06). `LogTodaysWearButton.tsx` provides the single unified form (D-01/D-07) with native `<input type=date max={maxDate}>` (D-02), owned-watch listbox + optional note + `VisibilitySegmentedControl` defaulting to `public` on every open (D-04), and a date-aware preflight (`getWornTodayIdsForUserAction`) that disables already-logged watches (D-05). Duplicate-day 23505 detection now correctly reads `err.cause.code` via `pgErrorCode()` (post-review fix CR-01/WR-06) — confirmed in both the action and the updated test mocks. |
| 3 | Worn tab shows a wear-count aggregate section with a 5-option segmented window control (1/3/6/12 mo / All) (WEAR-03, D-08/D-09) | VERIFIED | `WearLeaderboard.tsx` renders a `role="tablist"` with exactly the 5 `WINDOW_OPTIONS` (1mo/3mo/6mo/12mo/all), roving-tabindex arrow/Home/End key handling, default `DEFAULT_WEAR_WINDOW = '3mo'` (`src/lib/wear.ts:71`). `WornTabContent.tsx` mounts `<WearLeaderboard>` above the Timeline/Calendar `ViewTogglePill` row (D-08) and passes the unfiltered `events` (not `filtered`), so the watch-filter Select never affects it. |
| 4 | The aggregate section ranks the owner's owned watches by wear count in the selected window; changing the window updates the ranking (WEAR-04, D-10..D-14) | VERIFIED | `buildLeaderboard` + `filterEventsByWindow` (`src/lib/stats.ts:154-232`) implement rolling windows (30/90/182/365/null days) through caller-supplied `todayISO`, with the exact D-13 tie-break (count desc → most-recent wornDate desc → Brand Model A→Z, zero-wear rows A→Z at the bottom). Rows include zero-wear owned watches (D-11), show top 5 with a "Show all" expander, link to `/w/${id}` (D-12) unless `linkable=false`. Viewer-privacy scoping (`scopeWornTabWatches`, D-14) restricts the owned-watch list for non-owner viewers of a private collection to watches referenced by their own visible wears, and non-owner leaderboard rows for a private collection render unlinked (`linkable = isOwner || collectionPublic`, post-review fix WR-04) rather than 404-prone links. Full `Watch` rows are no longer sent to the client — `toWornTabWatchSummary` projects to `{id, brand, model, imageUrl}` before crossing the RSC boundary (post-review fix CR-02). |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/profile/WornTimeline.tsx` | Timeline rows linked to `/wear/[id]` | VERIFIED | Link present, hover/focus states, chevron. |
| `src/components/profile/WornCalendar.tsx` | Selected-day panel rows linked to `/wear/[id]` | VERIFIED | Link present; day cells remain selectors. |
| `src/app/actions/wearEvents.ts` | `logBackfillWear` Server Action | VERIFIED | Present, exported, all D-02/D-05/D-06/IDOR/cache behaviors implemented; CR-01/WR-01/WR-06 fixes applied. |
| `tests/actions/wearEventsBackfill.test.ts` | Action contract tests | VERIFIED | 15 tests, all pass; Test 7/8/8b use the real `DrizzleQueryError`-shaped mock (`mkDrizzleQueryError`). |
| `src/lib/wear.ts` | `WINDOW_DAYS`, `WearWindowKey`, `DEFAULT_WEAR_WINDOW` | VERIFIED | `{1mo:30, 3mo:90, 6mo:182, 12mo:365, all:null}`, default `'3mo'`. |
| `src/lib/stats.ts` | `filterEventsByWindow`, `buildLeaderboard` | VERIFIED | D-13 windowing + tie-break logic present and unit-tested (22 tests pass). |
| `src/lib/wornTabScope.ts` | `scopeWornTabWatches`, `toWornTabWatchSummary` | VERIFIED | Privacy scoping (D-14) + field-projection (CR-02) both present, unit-tested (8 tests pass). |
| `src/components/profile/LogTodaysWearButton.tsx` | Unified "Log a wear" trigger + dialog form | VERIFIED | All D-01..D-07 fields present; WR-02/WR-03 fixes (preflight staleness guard, try/catch around action) applied. |
| `tests/components/profile/LogTodaysWearButton.test.tsx` | Form + preflight tests | VERIFIED | 14 tests pass, including new T12/T13/T14 covering the WR-02/WR-03 fixes. |
| `src/components/profile/WearLeaderboard.tsx` | Leaderboard section (tablist, ranked rows, expander) | VERIFIED | 13 tests pass; `linkable`/`isOwner` props (WR-04/WR-05) present and wired. |
| `tests/components/profile/WearLeaderboard.test.tsx` | RTL tests | VERIFIED | Passing, includes L6b (unlinked rows) and L7/L7b (owner/non-owner copy). |
| `src/components/profile/WornTabContent.tsx` | Leaderboard mounted above view toggle; scoped props threaded | VERIFIED | `<WearLeaderboard events={events} watches={ownedWatches} linkable=... isOwner=.../>` above `ViewTogglePill`; leaderboard skipped entirely when `events.length === 0` (WR-05). |
| `src/app/u/[username]/[tab]/page.tsx` | Worn branch calls `scopeWornTabWatches` + projects to summary | VERIFIED | Lines 441-505: `scopeWornTabWatches({...})` then `toWornTabWatchSummary` mapping for both `ownedWatches` and `watchMap` before the client boundary. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `WornTimeline.tsx` | `/wear/[wearEventId]/page.tsx` | Link href | WIRED | `href={`/wear/${e.id}`}` confirmed by direct grep (gsd-sdk's automated pattern check reported a false negative due to a regex double-escaping bug in the tool, not an actual code issue — verified manually). |
| `WornCalendar.tsx` | `/wear/[wearEventId]/page.tsx` | Link href | WIRED | `href={`/wear/${event.id}`}` confirmed. |
| `wearEvents.ts#logBackfillWear` | `wearEventDAL.logWearEventWithPhoto` | explicit insert, `photoUrl: null` | WIRED | Confirmed at line 600. |
| `wearEvents.ts#logBackfillWear` | `logActivity` | gated on `wornDate === today` | WIRED | Confirmed at line 620-627. |
| `stats.ts#buildLeaderboard` | `stats.ts#wearCountByWatchMap` | count aggregation reuse | WIRED | Confirmed at line 206. |
| `stats.ts#filterEventsByWindow` | `wear.ts#WINDOW_DAYS` | import | WIRED | Confirmed via import + usage. |
| `LogTodaysWearButton.tsx` | `wearEvents.ts#getWornTodayIdsForUserAction` | useEffect | WIRED | Confirmed at line 103. |
| `LogTodaysWearButton.tsx` | `wearEvents.ts#logBackfillWear` | startTransition submit | WIRED | Confirmed at line 145, now wrapped in try/catch (WR-03). |
| `WornTabContent.tsx` | `LogTodaysWearButton.tsx` | header row + empty state | WIRED | Confirmed (gsd-sdk also verified this one directly). |
| `WearLeaderboard.tsx` | `stats.ts` | `buildLeaderboard(filterEventsByWindow(...))` | WIRED | Confirmed at line 76. |
| `WearLeaderboard.tsx` | `/w/[id]` | Link href per row | WIRED | Confirmed at line 216, now conditional on `linkable` (WR-04). |
| `page.tsx` | `wornTabScope.ts#scopeWornTabWatches` | call in worn branch | WIRED | Confirmed at line 442. |
| `WornTabContent.tsx` | `WearLeaderboard.tsx` | events + ownedWatches props | WIRED | Confirmed at line 134 (props now include `linkable`/`isOwner` per the post-review fixes, a superset of the plan's original pattern). |

Note: `gsd-sdk query verify.key-links` reported false negatives on several of the above links due to a tool-side regex double-escaping bug and a `#`-suffixed path resolution issue (e.g. "Source file not found" for `wearEvents.ts#logBackfillWear`). All flagged links were independently confirmed present via direct `grep`/`Read` against the actual files, as shown above.

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `WearLeaderboard` | `events` prop | `getWearEventsForViewer` (DAL, per-row viewer-gated query against `wear_events`) → `[tab]/page.tsx` → `WornTabContent` → `WearLeaderboard` | Yes — real DB rows, not static/empty | FLOWING |
| `WearLeaderboard` | `watches` prop | `getWatchesByUser` → `scopeWornTabWatches` (D-14 privacy filter) → `toWornTabWatchSummary` (CR-02 field projection) → `WornTabContent` → `WearLeaderboard` | Yes — real per-user watch rows, correctly scoped and projected | FLOWING |
| `WornTimeline`/`WornCalendar` | `events`/`watchMap` | Same `getWearEventsForViewer` + `toWornTabWatchSummary` pipeline | Yes | FLOWING |

### Behavioral Spot-Checks

Skipped in favor of the phase's own automated test suites (Step 7b would duplicate that coverage with less precision). Targeted vitest suites run below act as the behavioral gate for pure logic (`stats.ts`, `wornTabScope.ts`) and component behavior (RTL).

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `npm run build` (authoritative runtime gate per CLAUDE.md) | `npm run build` | Exit 0, all 36 routes generated including `/u/[username]/[tab]` and `/wear/[wearEventId]` | PASS |
| Phase 84 targeted vitest (8 files) | `npx vitest run tests/actions/wearEventsBackfill.test.ts tests/components/profile/LogTodaysWearButton.test.tsx tests/components/profile/WearLeaderboard.test.tsx tests/unit/WornTimeline.test.tsx tests/unit/leaderboard.test.ts tests/unit/wornTabScope.test.ts tests/components/profile/WornTabContent.test.tsx tests/actions/wearEventsVideo.test.ts` | 93/93 passed | PASS |
| `WornCalendar.test.tsx` (known pre-existing failure) | `npx vitest run tests/components/profile/WornCalendar.test.tsx` | 3 failed / 4 passed — "selects first day with events on mount", "sets selectedDate on day-with-events click", "clicking an empty day cell..." all fail with a date/month-drift symptom (test fixtures use fixed dates that have rolled out of the "current month" as real time advances) | KNOWN PRE-EXISTING (per task context: "WornCalendar month-drift 3" — not counted against Phase 84; not touched by any Phase 84 commit's fix) |

### Probe Execution

No `scripts/*/tests/probe-*.sh` probes declared or found for this phase (not a migration/tooling phase). SKIPPED.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|--------------|--------|----------|
| WEAR-01 | 84-01 | Every wear row links to `/wear/[id]` | SATISFIED | Timeline + Calendar links confirmed. |
| WEAR-02 | 84-02, 84-04 | Photo-less backfill on a past date | SATISFIED | `logBackfillWear` + `LogTodaysWearButton` confirmed, all D-01..D-07 behaviors present, CR-01/WR-01/WR-02/WR-03/WR-06 fixes applied. |
| WEAR-03 | 84-03, 84-05, 84-06 | Wear-count aggregate with 5-window segmented control | SATISFIED | `WearLeaderboard` tablist + `WINDOW_DAYS` confirmed. |
| WEAR-04 | 84-03, 84-05, 84-06 | Leaderboard of owned watches ranked by wear count, re-ranks on window change | SATISFIED | `buildLeaderboard`/`filterEventsByWindow` confirmed; D-14 privacy scoping + WR-04 unlinked-row fix confirmed. |

REQUIREMENTS.md traceability table (lines 95-98) lists all four as "Phase 84 / Complete" — no orphaned requirement IDs found for Phase 84.

### Anti-Patterns Found

None (blocker or warning level) in the Phase 84 touched files. Scanned `src/app/actions/wearEvents.ts`, `src/components/profile/WearLeaderboard.tsx`, `src/components/profile/LogTodaysWearButton.tsx`, `src/components/profile/WornTabContent.tsx`, `src/lib/wornTabScope.ts`, `src/lib/stats.ts`, `src/lib/wear.ts`, `src/components/profile/WornTimeline.tsx`, `src/components/profile/WornCalendar.tsx`, `src/app/u/[username]/[tab]/page.tsx` for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER`. Single match was an HTML `placeholder="Add a note…"` attribute on a `<Textarea>` (not a debt marker).

The code-review process (`84-REVIEW.md` → `84-REVIEW-FIX.md`) already found and fixed the 2 critical + 6 warning issues that existed in the initial implementation (CR-01, CR-02, WR-01..WR-06); all 8 are confirmed present in the current HEAD by direct code inspection above. The 7 Info-level findings (IN-01..IN-07) were left unfixed by design (low severity, follow-up candidates) — none block the phase goal:
- IN-01 (no lower bound on `wornDate`) — cosmetic data-quality issue, not goal-blocking.
- IN-02 (`logBackfillWear` doesn't reject wishlist/grail watch status) — the form only offers owned watches; a direct API call could bypass this, but it's a hardening gap, not a broken user flow.
- IN-03 (stale component name/comment) — cosmetic.
- IN-04 (tabs missing `aria-controls`/`role=tabpanel`) — a11y polish gap, not a functional break; roving tabindex itself works.
- IN-05 (dialog can close mid-pending via Escape/backdrop) — edge-case UX polish.
- IN-06 (test fixture missing a field) — test-only.
- IN-07 (sold watches with wears show "No wears in this window" instead of a more precise message) — copy nuance, not incorrect behavior.

### Human Verification Required

The 84-07 human-verify checkpoint was walked and approved on **prod** (commit `6fa86db9`, Phase 84 plans 01-06) per the operator's explicit CLAUDE.md Local-First exception invocation. That walk covered the original (pre-review-fix) behavior. The 7 review-fix commits (`7a3b3473`..`da46472c`) shipped *after* that walk and have not been exercised in a browser. Per the task's explicit instruction, the prior approval does not cover these changed behaviors — see the `human_verification` list in the frontmatter for the 5 items:

1. WR-02 preflight staleness fix (date-change race, reopen carryover)
2. WR-03 error-boundary avoidance (network failure inline alert)
3. WR-04 unlinked leaderboard rows for private-collection non-owners
4. WR-05 empty-state copy/mounting changes (owner vs non-owner, zero-wears vs zero-in-window)
5. WR-01 plausible-today bound (edge-timezone false-rejection risk)

### Gaps Summary

No code gaps found. All 4 roadmap success criteria are observably true in the current codebase (HEAD, including all 7 post-review fix commits). All 8 code-review findings (CR-01, CR-02, WR-01..WR-06) are confirmed fixed in place, not just claimed in REVIEW-FIX.md. `npm run build` exits 0. All Phase-84-owned vitest suites pass (93/93); the only failing suite (`WornCalendar.test.tsx`, 3 tests) is a pre-existing, phase-independent date-drift issue explicitly called out as out-of-scope in the verification brief.

The phase is functionally complete and correctly implemented. The only open item is procedural: the human UAT walk happened before the review-fix commits landed, so the 5 behaviors those fixes changed have not been eyeballed in a running browser. This routes to `human_needed` rather than `passed` per the verification decision tree (Step 9), not because of any detected code defect.

---

_Verified: 2026-09-13T17:41:09Z_
_Verifier: Claude (gsd-verifier)_

## Human Verification Outcome

All 5 human_verification items approved by the operator on prod (2026-09-13). See 84-HUMAN-UAT.md (5/5 pass). Status promoted human_needed → passed.
