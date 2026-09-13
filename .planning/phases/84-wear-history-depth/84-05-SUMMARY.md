---
phase: 84-wear-history-depth
plan: 05
subsystem: components/profile
tags: [vitest, rtl, tdd, wear-leaderboard, roving-tabindex, react-418]

# Dependency graph
requires:
  - phase: 84-wear-history-depth (Plan 03)
    provides: WINDOW_DAYS/WearWindowKey/DEFAULT_WEAR_WINDOW (src/lib/wear.ts), filterEventsByWindow + buildLeaderboard (src/lib/stats.ts)
provides:
  - WearLeaderboard component (self-contained client section: window tablist + ranked rows + expander)
affects: [84-06 (Worn tab page wiring mounts WearLeaderboard above ViewTogglePill row)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Roving-tabindex 5-segment window control ported from ConfirmStep's WAI-ARIA radiogroup handleKeyDown, not ui/tabs.tsx (documented discretion in plan objective)"
    - "useSyncExternalStore with null server snapshot for hydration-safe 'today' (React #418 guard), same shape as the 260622-exo client-supplied-date invariant"

key-files:
  created:
    - src/components/profile/WearLeaderboard.tsx
    - tests/components/profile/WearLeaderboard.test.tsx
  modified: []

key-decisions:
  - "Window control clones ViewTogglePill's visual shape + ports ConfirmStep's handleKeyDown rather than using ui/tabs.tsx, per the plan's documented discretion choice (UI-SPEC's bg-accent text-accent-foreground active-segment requirement would need heavy TabsTrigger overrides; the hand-ported handler is deterministic under jsdom, unit-testing keyboard behavior directly)."
  - "todayISO computed via useSyncExternalStore(subscribeNoop, () => todayLocalISO(), () => null) — a referentially stable no-op subscribe avoids a render loop, and the null server snapshot means the component renders a skeleton until the client snapshot resolves, guaranteeing SSR/hydration agreement on window counts."
  - "Component returns null outright when watches.length === 0 — 84-06 is responsible for deciding whether to render the section at all on an owned-watch-free profile."

requirements-completed: []  # WEAR-03/WEAR-04 stay unmarked per executor instructions — 84-06 mounts the component into the Worn tab page and completes both requirements.

# Metrics
duration: ~25min
completed: 2026-09-12
---

# Phase 84 Plan 05: WearLeaderboard Component Summary

**Self-contained, fully tested `WearLeaderboard` client component — 5-segment rolling-window tablist with roving-tabindex keyboard nav, zero-wear-inclusive ranked rows with proportional accent bars, a top-5 expander, and `/w/[id]` links — not yet mounted (84-06 wires it into the Worn tab).**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2 (`type="auto" tdd="true"` each — Task 1 RED, Task 2 GREEN)
- **Files modified:** 2 (both created)

## Accomplishments

- `tests/components/profile/WearLeaderboard.test.tsx` created — 11 RTL tests (L1-L11) covering the window tablist shape/defaults, ranking + rerank-on-window-change, full roving-tabindex keyboard cycle (ArrowRight/ArrowLeft/Home/End with wraparound), zero-wear A→Z sort + singular "1 wear" copy, the top-5 expander toggle, `/w/[id]` row hrefs, the empty-window note, proportional bar-fill widths, the `watches=[]` → null case, rank numbering, and cross-watch event filtering (ignores events for unknown watch ids).
- `src/components/profile/WearLeaderboard.tsx` created — exports `WearLeaderboard({ events, watches })`. Consumes `filterEventsByWindow` + `buildLeaderboard` from `src/lib/stats.ts` (84-03) and `todayLocalISO`/`DEFAULT_WEAR_WINDOW`/`WearWindowKey` from `src/lib/wear.ts` (84-03). Thumbnail block mirrors `WornTimeline`'s `getSafeImageUrl` + `WatchIcon` fallback pattern exactly (size-10, T-84-05 mitigation). Row-as-`Link` idiom mirrors `MostWornThisMonthCard`.
- All 11 tests pass on first implementation attempt — no debugging iterations required.

## Task Commits

1. **RED** — `56a2569f` (`test(84-05): add failing WearLeaderboard tests`) — confirmed failing only on `Cannot resolve '@/components/profile/WearLeaderboard'` (module did not exist yet).
2. **GREEN** — `f6819491` (`feat(84-05): WearLeaderboard section`) — all 11 tests pass; `npm run build` exits 0.

## TDD Gate Compliance

- RED gate: `56a2569f` (`test(84-05): ...`) — present, confirmed import-resolution failure pre-implementation.
- GREEN gate: `f6819491` (`feat(84-05): ...`) — present, all 11 tests pass after implementation.
- REFACTOR gate: not needed — implementation matched the plan's exact spec on the first pass; no cleanup commit required.

## Files Created/Modified

- `src/components/profile/WearLeaderboard.tsx` (215 lines, min_lines 110) — new component, `export function WearLeaderboard`.
- `tests/components/profile/WearLeaderboard.test.tsx` (239 lines, min_lines 140) — new RTL suite, 11 tests.

## Verification

- `npx vitest run tests/components/profile/WearLeaderboard.test.tsx` — 11/11 pass.
- `npx vitest run tests/no-raw-palette.test.ts` — 5 failures, all in unrelated pre-existing files (confirmed zero mentions of `WearLeaderboard.tsx` in the failure output); matches the documented pre-existing baseline (see `sequential_execution` note in this plan's execution context).
- `npm run build` — exits 0.
- Acceptance-criteria greps (plan Task 2): `export function WearLeaderboard` = 1; `role="tablist"` = 1; `tabIndex={` = 1; `'Home'|'End'` = 2; `useSyncExternalStore` = 3; `DEFAULT_WEAR_WINDOW` = 2; `bg-accent` = 2; `font-medium|font-bold|bg-primary` = 0; `` href={`/w/${row.watch.id}`} `` = 1.
- key_links patterns confirmed: `buildLeaderboard(watches, filterEventsByWindow(...))` present (composition matches plan's `key_links` regex); row `Link href={`/w/${row.watch.id}`}` present.

## Decisions Made

See `key-decisions` above. No decisions beyond what the plan's objective already locked in (the `ViewTogglePill`-clone + `ConfirmStep`-handler discretion choice was pre-decided by the plan; this executor implemented it as specified without deviation).

## Deviations from Plan

None — plan executed exactly as written. No Rule 1/2/3 auto-fixes were needed; all 11 tests passed on the first implementation attempt against the plan's literal spec.

## Known Stubs

None. The component is fully wired to real data via its props contract (`events`/`watches`); it performs no fetching itself and has no placeholder/mock data paths. It is simply not yet mounted anywhere in the render tree — that is explicitly 84-06's scope per this plan's objective, not a stub.

## Threat Flags

None found. `getSafeImageUrl` gating (T-84-05, mitigate) is applied to thumbnails exactly as planned; no new network endpoints, auth paths, or schema changes were introduced. Row-source privacy (T-84-LEAK, transfer) is unaffected — the component renders exactly the `watches`/`events` props it receives and performs no fetching of its own, matching the threat model's disposition.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. Pure client-side component consuming already-computed props.

## Next Phase Readiness

- `WearLeaderboard` is exported, fully tested, and ready for 84-06 to mount above the `ViewTogglePill` row in `WornTabContent.tsx` (D-08), threading in the viewer-gated `events` and privacy-scoped owned `watches` (via `scopeWornTabWatches` from 84-03).
- No blockers. WEAR-03/WEAR-04 intentionally remain unmarked in REQUIREMENTS.md per this plan's scope (component-only; 84-06 completes both requirements by wiring the component into the page).

---
*Phase: 84-wear-history-depth*
*Completed: 2026-09-12*

## Self-Check: PENDING
