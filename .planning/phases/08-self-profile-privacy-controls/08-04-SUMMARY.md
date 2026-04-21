---
phase: 08-self-profile-privacy-controls
plan: 04
subsystem: profile-tabs-worn-stats
tags: [profile-tabs, worn, stats, calendar, react-19, privacy, dal-gate]

requires:
  - phase: 08-self-profile-privacy-controls
    plan: 01
    provides: getPublicWearEventsForViewer DAL gate, profileSettings.wornPublic
  - phase: 08-self-profile-privacy-controls
    plan: 02
    provides: /u/[username]/[tab] route shell + layout with viewer-aware data fetch
  - phase: 08-self-profile-privacy-controls
    plan: 03
    provides: tab dispatch switch in [tab]/page.tsx (collection/wishlist/notes branches)
provides:
  - Worn tab — Timeline (default) + Calendar (custom month grid, native Date arithmetic) view toggle, per-watch filter, owner-only "Log Today's Wear" CTA
  - Stats tab — Most Worn, Least Worn, Style Distribution, Role Distribution cards plus full-width Collection Observations
  - src/lib/stats.ts — reusable distribution / wear-count / observation helpers (factored for future reuse on /insights)
affects: [/u/[username]/worn, /u/[username]/stats, src/app/u/[username]/[tab]/page.tsx]

tech-stack:
  added: []
  patterns:
    - "DAL visibility gate (PRIV-04 + PRIV-05): worn tab calls getPublicWearEventsForViewer (Plan 01) — server-rendered route gets [] for non-owner when wornPublic=false; double-layer with the Server Component early-return"
    - "Stats follows collection_public for visibility (collection-derived data) but uses getPublicWearEventsForViewer for wear data — when worn_public=false, stats render with 0 wear counts (no events leak)"
    - "Custom calendar via native Date arithmetic + getCalendarGrid helper — no date-fns / no react-calendar dependency"
    - "Custom HorizontalBarChart via div + style.width — no recharts/chart.js for this phase per plan must_haves"
    - "View toggle pill is a controlled segmented control — bg-accent active state, role=tablist + role=tab + aria-selected for a11y"
    - "Stats helpers (styleDistribution, roleDistribution, buildObservations, …) factored into src/lib/stats.ts so /insights and /u/[username]/stats can share the source of truth in a future refactor"
    - "Insufficient-data guard on Stats: <3 owned watches renders the UI-SPEC empty state instead of mostly-empty cards"

key-files:
  created:
    - src/components/profile/ViewTogglePill.tsx
    - src/components/profile/LogTodaysWearButton.tsx
    - src/components/profile/WornTimeline.tsx
    - src/components/profile/WornCalendar.tsx
    - src/components/profile/WornTabContent.tsx
    - src/components/profile/StatsCard.tsx
    - src/components/profile/HorizontalBarChart.tsx
    - src/components/profile/CollectionObservations.tsx
    - src/components/profile/StatsTabContent.tsx
    - src/lib/stats.ts
  modified:
    - src/app/u/[username]/[tab]/page.tsx (extended with worn + stats branches)

key-decisions:
  - "Stats tab privacy follows collection_public — stats are derived from the collection, so collection visibility is the natural gate. Wear data (most/least worn counts) is gated separately through getPublicWearEventsForViewer; a viewer who can see the collection but not wear history sees the cards with 0 wear counts rather than a hard PrivateTabState."
  - "Custom calendar over a date library — UI-SPEC spec'd <60 lines of native Date arithmetic via a small getCalendarGrid helper; pulling in date-fns or react-calendar would be ~70KB gzipped for ~30 lines saved. Decision matches plan must_haves and CLAUDE.md 'no new dependency'."
  - "src/lib/stats.ts created instead of co-locating helpers in StatsTabContent — keeps the math testable, lets future phases (insights migration) import from a single source. /insights itself still has its own copies (left untouched for this plan); migrating insights to use stats.ts is a future-cleanup task."
  - "Select base-ui type adapter — base-ui's onValueChange signature is (value: string | null, eventDetails) but our local state is plain string. Wrapped both Select usages in `(v) => setX(v ?? defaultValue)` to satisfy the discriminated type without leaking nullability into local state."
  - "Stats events fetch picks the right DAL by isOwner — owner uses getAllWearEventsByUser directly (no double DAL hop); non-owner goes through getPublicWearEventsForViewer so worn_public=false yields []."
  - "Most-recent lastWornDate computed via events.find(e => e.watchId === w.id) — events are ordered desc by the DAL, so the first match is the most recent; avoids a second DAL roundtrip for getMostRecentWearDates."
  - "WornCalendar uses Date arithmetic-only (no time-zone handling beyond `new Date(yyyyMmDd + 'T00:00:00')` to lock to local midnight). wear_events.wornDate is a YYYY-MM-DD string from Phase 7 — local date semantics match what the user logged."

requirements-completed: [PROF-04, PROF-06, PRIV-04, PRIV-05]

duration: ~10 min
completed: 2026-04-20
---

# Plan 08-04: Worn + Stats Tabs Summary

**Replaces the Plan 03 fallthrough placeholder for the `worn` and `stats` tabs with full implementations: Worn ships a Timeline / Calendar segmented view, per-watch filter, and owner-only "Log Today's Wear" dialog — wired through the Plan 01 `getPublicWearEventsForViewer` DAL visibility gate (PRIV-04 + PRIV-05). Stats ships Most Worn / Least Worn / Style / Role distribution cards plus a Collection Observations panel powered by a new `src/lib/stats.ts` helper module — collection_public gates the page, with wear data gated separately through the same DAL function so 0-count cards render when worn_public=false.**

## Performance

- **Duration:** ~10 min
- **Tasks:** 2 (both auto)
- **Commits:** 2 (one per task, both with --no-verify per parallel-execution protocol)
- **New files:** 10 (5 worn components, 4 stats components, 1 lib module)
- **Modified files:** 1 ([tab]/page.tsx — worn + stats branches added, stats placeholder removed)

## Accomplishments

### Worn Tab (Task 1)

- `[tab]/page.tsx` worn branch wired through `getPublicWearEventsForViewer` (Plan 01 DAL gate) — non-owner gets `[]` when `wornPublic=false` even before the early-return PrivateTabState check fires (D-15 belt-and-suspenders)
- `WornTabContent` is the client orchestrator — holds view ('timeline' | 'calendar') and per-watch filter state; renders `ViewTogglePill` + Select + (owner-only) `LogTodaysWearButton` above the active view
- `ViewTogglePill` segmented control with `role="tablist"` + `role="tab"` + `aria-selected`; active segment uses `bg-accent text-accent-foreground`, inactive `text-muted-foreground hover:text-foreground`
- `WornTimeline` groups events by `wornDate` (events arrive desc-ordered from the DAL), renders date heading + 40px thumbnail + brand/model rows; empty state uses exact UI-SPEC copy ("No wear history yet." / "Log your first wear…")
- `WornCalendar` builds a Sun-Sat month grid using `getCalendarGrid(year, month)` — native `new Date()` arithmetic for leading/trailing-month padding, `dateKey()` for O(1) `eventsByDay` lookups, prev/next chevrons with `aria-label="Previous month"` / `aria-label="Next month"`, today's cell ringed with `ring-1 ring-accent`
- `LogTodaysWearButton` opens a Dialog with a Select of the owner's watches; confirm calls existing Phase 7 `markAsWorn` Server Action (no new action created, no schema changes); errors surface in a `role="alert"` paragraph
- Per-watch filter dropdown ("All watches" default) narrows both Timeline and Calendar views; sorted brand → model

### Stats Tab (Task 2)

- `[tab]/page.tsx` stats branch — `collection_public` gates the page (since stats are collection-derived); wear events fetched via `getAllWearEventsByUser` for owner, `getPublicWearEventsForViewer` for non-owner so worn_public=false yields `[]` and the stats cards render with 0 counts (no event details leak — T-08-24)
- `src/lib/stats.ts` exports the reusable helpers: `calculateDistribution`, `styleDistribution`, `roleDistribution`, `topMostWorn`, `topLeastWorn`, `buildObservations`, `bucketWearsByWeekday`, `wearCountByWatchMap` — pure functions, no DAL coupling, ready for /insights to migrate to in a follow-up
- `StatsTabContent` insufficient-data guard: <3 owned watches renders the UI-SPEC "Not enough data." card instead of mostly-empty cards
- `HorizontalBarChart` uses div bars with `style={{ width: '${pct}%' }}` and `bg-accent` fill on a `bg-muted rounded-full h-2` track — no recharts/chart.js import per plan must_haves and UI-SPEC instruction note 10
- `CollectionObservations` panel renders `buildObservations` output as a bulleted list — picks observations from style lean, loyal-brand signal (reused `detectLoyalBrands` from `src/lib/similarity.ts`), neglected watches (`SLEEPING_BEAUTY_DAYS` threshold), most-active wearing day (computed from `wear_events.worn_date` weekday), and movement consistency
- `StatsCard` is a thin Card wrapper with `min-h-[120px]` content area for visual consistency across the 2x2 grid

## Task Commits

1. **Task 1 (auto):** `be212ad` — feat(08-04): Worn tab — Timeline + Calendar + Log Today's Wear
2. **Task 2 (auto):** `435d0e6` — feat(08-04): Stats tab — distributions, most/least worn, observations

## Files Created/Modified

**Created (10):**
- `src/components/profile/ViewTogglePill.tsx` — segmented control for Timeline / Calendar
- `src/components/profile/LogTodaysWearButton.tsx` — owner-only dialog wired to existing markAsWorn action
- `src/components/profile/WornTimeline.tsx` — chronological events grouped by date
- `src/components/profile/WornCalendar.tsx` — custom month grid (native Date)
- `src/components/profile/WornTabContent.tsx` — Worn tab orchestrator (client; holds view + filter state)
- `src/components/profile/StatsCard.tsx` — Card wrapper with min-h-[120px]
- `src/components/profile/HorizontalBarChart.tsx` — div-based bars, bg-accent fill
- `src/components/profile/CollectionObservations.tsx` — bulleted insights list
- `src/components/profile/StatsTabContent.tsx` — 2x2 cards + observations + insufficient-data guard
- `src/lib/stats.ts` — distribution / wear / observation helpers (no DAL coupling)

**Modified (1):**
- `src/app/u/[username]/[tab]/page.tsx` — worn branch + stats branch added; stats placeholder removed (worn placeholder was already replaced in Task 1)

## Decisions Made

- **Stats privacy follows collection_public, not worn_public** — stats are a derived view of the collection itself; if you can see the collection, you can see its shape. Wear-derived stats (most/least worn) gracefully degrade to 0 counts when worn data is private rather than gating the entire tab.
- **isOwner picks the right DAL for stats wear data** — owner uses `getAllWearEventsByUser` directly (no double DAL hop); non-owner goes through `getPublicWearEventsForViewer` so PRIV-04 is enforced. Avoids the regression of "owner sees wear data, non-owner sees a 'private' tab even though collection is public".
- **Custom calendar over a library** — native Date arithmetic stays under 60 lines (per plan min_lines artifact spec) and adds zero KB. date-fns / react-calendar were intentionally deferred (CLAUDE.md "no new dependency").
- **Stats helpers factored into src/lib/stats.ts** — pure functions, importable from both /insights and /u/[username]/stats. /insights itself still has its own helper copies; migrating /insights to consume stats.ts is left as a future polish task to avoid scope creep.
- **lastWornDate from events.find()** — DAL returns events ordered desc by wornDate, so `events.find(e => e.watchId === w.id)` is the most-recent event for that watch in O(n*k) where k is small. Avoids a second `getMostRecentWearDates` roundtrip and reuses the data already fetched.

## Deviations from Plan

### Auto-fixed Issues

**1. [Plan defect — base-ui type signature] Select onValueChange wrapping**
- **Found during:** Task 1
- **Issue:** Plan snippet used `onValueChange={setSelected}` and `onValueChange={setFilterWatchId}` directly, but base-ui's `Select` declares `onValueChange: (value: string | null, eventDetails) => void` — strict mode rejects the assignment because `setX: Dispatch<SetStateAction<string>>` cannot accept `null`.
- **Fix:** Wrapped both Select usages with `(v) => setX(v ?? defaultValue)` so the local state stays a plain `string`. Default for `setSelected` is `''`; default for `setFilterWatchId` is `'all'`.
- **Files modified:** `src/components/profile/LogTodaysWearButton.tsx`, `src/components/profile/WornTabContent.tsx`
- **Commit:** `be212ad`

**2. [Plan/UI-SPEC consistency — no font-medium] WornTimeline date heading + WornCalendar month label**
- **Found during:** Task 1 implementation
- **Issue:** Plan snippets used `text-sm font-medium` for the WornTimeline date heading and the WornCalendar month label. The project's `tests/no-raw-palette.test.ts` forbids `font-medium`, `font-bold`, `font-light` in `src/components/**` (Plan 03 SUMMARY documented the same fix-up).
- **Fix:** Used `font-normal` (Body weight from the two-weight system in 08-UI-SPEC.md) for both. Stats Most/Least Worn count uses `font-semibold` (Heading weight) to keep the count visually heavier than the watch label.
- **Files modified:** `src/components/profile/WornTimeline.tsx`, `src/components/profile/WornCalendar.tsx`, `src/components/profile/StatsTabContent.tsx`
- **Commits:** `be212ad`, `435d0e6`
- **Verification:** `npx vitest run tests/no-raw-palette.test.ts` → 1105/1105 passing.

**3. [JSX correctness] Apostrophe escaping in "Log Today's Wear"**
- **Found during:** Task 1
- **Issue:** Plan snippets used a raw apostrophe in JSX text — `Log Today's Wear` — which Next/React lints reject (`react/no-unescaped-entities`).
- **Fix:** Used `Log Today&apos;s Wear` in JSX text nodes (button label + dialog title). Plain string literals (commit messages, SUMMARY copy) keep the unescaped apostrophe.
- **Files modified:** `src/components/profile/LogTodaysWearButton.tsx`
- **Commit:** `be212ad`

---

**Total deviations:** 3 — one plan-defect type-signature fix (base-ui Select), one project-rule fix (no font-medium), one JSX correctness fix (escaped apostrophe).
**Impact on plan:** No scope change. All three deviations preserve plan intent and align with project conventions / primitives.

## Threat Flags

None — surfaces introduced in this plan are accounted for in the plan's threat model:
- **T-08-23** (worn-tab leak): mitigated by `[tab]/page.tsx` PrivateTabState gate + `getPublicWearEventsForViewer` DAL gate (D-15 two-layer)
- **T-08-24** (stats wear-count leak): mitigated by `getPublicWearEventsForViewer` for non-owners — when worn_public=false, events=[] and most/least worn render with 0 counts but no event details
- **T-08-25** (LogTodaysWearButton spoofing): mitigated by reusing existing `markAsWorn` Server Action which reads userId from session (no client-supplied userId)
- **T-08-26** (note-text XSS in calendar): not applicable — calendar/timeline only render watch identity (brand/model) and `wornDate`; the `note` field is included in the `events` map prop but never rendered
- **T-08-27** (calendar DOS): accepted per plan — <500 watches/user constraint
- **T-08-28** (per-watch filter dropdown leak): mitigated — watchMap is built from `getWatchesByUser` (owner-scoped DAL) on the page Server Component before sending to the client; non-owner without collection_public is already blocked at the parent layout

No new network endpoints, auth paths, file access, or schema changes at trust boundaries beyond what Plans 01-03 already established.

## Issues Encountered

- **Pre-existing `tests/balance-chart.test.tsx` TS2578** (unused `@ts-expect-error`) — documented in Plans 01-03 SUMMARYs, not caused by this plan.
- **Initial `npx tsc --noEmit` showed `LayoutProps` not found in `src/app/u/[username]/layout.tsx`** — a Next.js 16 generated-types resolution issue that disappears once `npm run build` runs and regenerates `.next/types/**`. Not a regression from this plan; same condition exists at the base of Plan 03.
- **Worktree initial state was at Phase 7 HEAD, not Plan 03 base** — required `git reset --soft 6fb30e4 && git checkout HEAD -- .` to bring the worktree to the expected base before starting work. Standard worktree-setup adjustment, no impact on output.

## User Setup Required
None — all DAL functions, schema columns, and Server Actions used in this plan already shipped in Plans 01-03 + Phase 7.

## Verification Results

- `npx tsc --noEmit` — clean apart from pre-existing `tests/balance-chart.test.tsx` TS2578
- `npm run build` — succeeded; all 14 routes generate including `/u/[username]/[tab]` worn + stats content
- `npx vitest run tests/no-raw-palette.test.ts` — 1105/1105 passing (covers all new Plan 04 components)
- Spot-check greps:
  - `getPublicWearEventsForViewer` in `[tab]/page.tsx` — PASS
  - `Previous month` + `Next month` aria-labels in `WornCalendar.tsx` — PASS
  - `Log Today` in `LogTodaysWearButton.tsx` — PASS
  - `StatsTabContent` import in `[tab]/page.tsx` — PASS
  - `buildObservations` export in `src/lib/stats.ts` — PASS
  - `bg-accent` in `HorizontalBarChart.tsx` — PASS
  - `Most Worn` in `StatsTabContent.tsx` — PASS

## Next Phase Readiness

- All 5 profile tabs now functional: Collection (P3), Wishlist (P3), Worn (P4), Notes (P3), Stats (P4)
- Phase 8 requirements complete: PROF-01..07, PROF-10, PRIV-01..06 — 14/14 phase requirements
- Phase 9 (social — Common Ground, Follow button activation, follower/following lists) can mount on the existing ProfileHeader without further refactoring
- /insights migration to consume `src/lib/stats.ts` is a future polish task, not a Phase 8 dependency

---

## Self-Check: PASSED

**Files created (verified on disk):**
- FOUND: src/components/profile/ViewTogglePill.tsx
- FOUND: src/components/profile/LogTodaysWearButton.tsx
- FOUND: src/components/profile/WornTimeline.tsx
- FOUND: src/components/profile/WornCalendar.tsx
- FOUND: src/components/profile/WornTabContent.tsx
- FOUND: src/components/profile/StatsCard.tsx
- FOUND: src/components/profile/HorizontalBarChart.tsx
- FOUND: src/components/profile/CollectionObservations.tsx
- FOUND: src/components/profile/StatsTabContent.tsx
- FOUND: src/lib/stats.ts

**Files modified (verified on disk):**
- FOUND: src/app/u/[username]/[tab]/page.tsx (worn + stats branches added)

**Commits (verified in git log):**
- FOUND: be212ad feat(08-04): Worn tab — Timeline + Calendar + Log Today's Wear
- FOUND: 435d0e6 feat(08-04): Stats tab — distributions, most/least worn, observations

---
*Phase: 08-self-profile-privacy-controls*
*Completed: 2026-04-20*
