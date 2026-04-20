---
phase: 07-social-schema-profile-auto-creation
plan: "02"
subsystem: wear-tracking
tags: [wear-events, dal, server-action, drizzle, migration]
dependency_graph:
  requires: [07-01]
  provides: [wear-events-dal, mark-as-worn-action, lastWornDate-removed, column-drop-migration]
  affects: [src/lib/types.ts, src/db/schema.ts, src/data/watches.ts, src/app/actions/watches.ts, src/components/watch/WatchDetail.tsx, src/components/watch/WatchForm.tsx, src/components/insights/SleepingBeautiesSection.tsx, src/app/insights/page.tsx, src/app/watch/[id]/page.tsx]
tech_stack:
  added: []
  patterns: [wear-events-dal, WatchWithWear-enriched-type, batch-wear-date-query, onConflictDoNothing-idempotent-insert]
key_files:
  created:
    - src/data/wearEvents.ts
    - src/app/actions/wearEvents.ts
    - drizzle/0001_robust_dormammu.sql
  modified:
    - src/lib/types.ts
    - src/db/schema.ts
    - src/data/watches.ts
    - src/app/actions/watches.ts
    - src/components/watch/WatchDetail.tsx
    - src/components/watch/WatchForm.tsx
    - src/components/insights/SleepingBeautiesSection.tsx
    - src/app/insights/page.tsx
    - src/app/watch/[id]/page.tsx
decisions:
  - "WatchWithWear extends Watch with optional lastWornDate computed from wear_events — avoids breaking existing Watch type consumers"
  - "getMostRecentWearDates batch-queries all watch IDs in a single query to avoid N+1 on insights page"
  - "markAsWorn uses onConflictDoNothing — idempotent for same-day taps (T-07-08)"
  - "lastWornDate prop on WatchDetail sourced by server page via getMostRecentWearDate — keeps client component stateless"
  - "Column-drop migration generated but not applied — Plan 03 or manual push applies it"
metrics:
  duration: ~25 minutes
  completed: "2026-04-20"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 9
---

# Phase 07 Plan 02: Wear Events Migration Summary

**One-liner:** Replaced `lastWornDate` on the Watch type with a `wear_events` DAL and `markAsWorn` Server Action; enriched type `WatchWithWear` bridges insights/sleeping-beauties components with zero breaking changes to Watch consumers.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create wear events DAL, Server Action, update WatchDetail | d65bf38 | src/data/wearEvents.ts, src/app/actions/wearEvents.ts, src/components/watch/WatchDetail.tsx |
| 2 | Remove lastWornDate, wire wear_events data, generate column-drop migration | 49973da | src/lib/types.ts, src/db/schema.ts, src/data/watches.ts, src/app/actions/watches.ts, src/components/watch/WatchForm.tsx, src/components/insights/SleepingBeautiesSection.tsx, src/app/insights/page.tsx, src/app/watch/[id]/page.tsx, drizzle/0001_robust_dormammu.sql |

## What Was Built

### Wear Events DAL (`src/data/wearEvents.ts`)

Four server-only exports:
- `logWearEvent(userId, watchId, wornDate, note?)` — inserts a wear_events row with `.onConflictDoNothing()` so duplicate same-day taps are silently ignored
- `getMostRecentWearDate(userId, watchId)` — returns the most recent `worn_date` string for a single watch, ordered desc
- `getWearEventsByWatch(userId, watchId)` — returns all wear events for a watch in desc order (for future wear timeline)
- `getMostRecentWearDates(userId, watchIds[])` — single batch query returning a `Map<watchId, wornDate>` for efficient insights page loading

### `markAsWorn` Server Action (`src/app/actions/wearEvents.ts`)

- Reads `userId` from `getCurrentUser()` session — client cannot supply userId (T-07-07)
- Writes today's ISO date string (`YYYY-MM-DD`) via `logWearEvent`
- Returns `ActionResult<void>` — never throws across Server Action boundary
- `revalidatePath('/')` triggers re-fetch of server components

### Type Changes (`src/lib/types.ts`)

- `lastWornDate?: string` removed from `Watch` interface
- New `WatchWithWear` interface added: `extends Watch` with `lastWornDate?: string`

### Component Updates

- **WatchDetail**: accepts new `lastWornDate?: string | null` prop; uses `markAsWorn` instead of `editWatch` for worn tracking; all JSX reads use prop not `watch.lastWornDate`
- **WatchForm**: `lastWornDate` removed from `initialFormData` and watch-to-formData mapping
- **SleepingBeautiesSection**: props changed from `Watch[]` to `WatchWithWear[]`
- **insights/page.tsx**: batch-queries `getMostRecentWearDates`, builds `ownedWithWear: WatchWithWear[]`, passes to `computeWearInsights` and `SleepingBeautiesSection`
- **watch/[id]/page.tsx**: queries `getMostRecentWearDate` after fetching watch, passes `lastWornDate` prop to `WatchDetail`

### Column-Drop Migration (`drizzle/0001_robust_dormammu.sql`)

Contains `ALTER TABLE "watches" DROP COLUMN "last_worn_date";` plus all five social table CREATE statements from Plan 01. Ready to apply via `npx drizzle-kit push` — not applied in this plan.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all wear data flows from the `wear_events` table via the DAL. No hardcoded values or placeholders.

## Threat Flags

No new security surface beyond the plan's threat model.

- T-07-07 mitigated: `markAsWorn` reads `userId` from session, never from client input
- T-07-08 mitigated: `onConflictDoNothing()` with unique day constraint prevents duplicate rows

## Self-Check

### Files exist:
- [x] src/data/wearEvents.ts — created
- [x] src/app/actions/wearEvents.ts — created
- [x] drizzle/0001_robust_dormammu.sql — created (contains DROP COLUMN last_worn_date)
- [x] src/lib/types.ts — modified (WatchWithWear added, lastWornDate removed from Watch)
- [x] src/db/schema.ts — modified (lastWornDate column removed)
- [x] src/data/watches.ts — modified (lastWornDate removed from mapRowToWatch and mapDomainToRow)
- [x] src/app/actions/watches.ts — modified (lastWornDate removed from Zod schema)
- [x] src/components/watch/WatchForm.tsx — modified (lastWornDate removed from form state)
- [x] src/components/insights/SleepingBeautiesSection.tsx — modified (WatchWithWear props)
- [x] src/app/insights/page.tsx — modified (getMostRecentWearDates, ownedWithWear)
- [x] src/app/watch/[id]/page.tsx — modified (getMostRecentWearDate, lastWornDate prop)

### Commits exist:
- [x] d65bf38 — feat(07-02): create wear events DAL, Server Action, update WatchDetail
- [x] 49973da — feat(07-02): remove lastWornDate, wire wear_events, generate column-drop migration

### Build:
- [x] npm run build — passes cleanly, TypeScript 0 errors, 13 routes generated

## Self-Check: PASSED
