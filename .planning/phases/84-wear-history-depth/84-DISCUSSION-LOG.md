# Phase 84: Wear history depth - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-12
**Phase:** 84-wear-history-depth
**Areas discussed:** Backfill entry & form, Backfill feed behavior, Leaderboard layout & data, Viewer & linking rules

---

## Backfill entry & form

| Option | Description | Selected |
|--------|-------------|----------|
| Date field in log-wear flow | Existing owner-only button opens a picker with a date field defaulting to today | ✓ |
| Separate "Log past wear" button | Second button beside "Log today's wear" | |
| Tap an empty calendar day | Owner taps a past day in Calendar view | |

| Option (date range) | Description | Selected |
|--------|-------------|----------|
| Any past date, not future | max=today, no lower bound, server rejects future | ✓ |
| Not before acquired date | Bound by purchase date when set | |
| Last 12 months only | Matches largest leaderboard window | |

| Option (form fields) | Description | Selected |
|--------|-------------|----------|
| Optional note + visibility | Same note/visibility as photo flow, no photo | ✓ |
| Watch + date only | Fastest; fixed visibility | |
| Optional note only | No visibility choice | |

| Option (duplicates) | Description | Selected |
|--------|-------------|----------|
| Disable already-worn watches | Date-aware preflight greys out worn watches | ✓ |
| Allow submit, inline error | Server unique constraint rejects | |

| Option (visibility default) | Description | Selected |
|--------|-------------|----------|
| Public | Matches markAsWorn + photo flow | ✓ |
| Followers | Conservative default | |
| Remember last choice | localStorage per viewer | |

**User's choice:** All recommended options.

---

## Backfill feed behavior

| Option | Description | Selected |
|--------|-------------|----------|
| No activity for past dates | Only today-dated wears write `watch_worn` | ✓ |
| Activity only if recent (≤48h) | Yesterday posts; older doesn't | |
| Always create activity | Current behavior for every log | |

| Option (today's log) | Description | Selected |
|--------|-------------|----------|
| One form for both | Log a wear always opens the form | ✓ |
| Keep pick-and-go for today | Immediate submit when date is today | |

**User's choice:** All recommended options.

---

## Leaderboard layout & data

| Option (placement) | Description | Selected |
|--------|-------------|----------|
| Section above the views | Aggregate card above Timeline/Calendar toggle | ✓ |
| Third view: "Stats" | Third ViewTogglePill option | |
| Collapsible section above | Top placement, collapsible | |

| Option (default window) | Description | Selected |
|--------|-------------|----------|
| 3 mo | Current rotation with enough data | ✓ |
| 1 mo | Current rotation; sparse for light loggers | |
| All time | Most data; slow to change | |

| Option (row style) | Description | Selected |
|--------|-------------|----------|
| Thumb + name + count + bar | Rank, thumbnail, name, count, accent bar | ✓ |
| Thumb + name + count | Plain ranked list | |
| Horizontal bar chart | Chart-style | |

| Option (rows shown) | Description | Selected |
|--------|-------------|----------|
| All owned, zeros included | Zero-wear at bottom; top 5 + Show all | ✓ |
| Only watches worn in window | Hides neglected | |
| All owned, no truncation | Always expanded | |

| Option (row tap) | Description | Selected |
|--------|-------------|----------|
| Open the watch page | /w/[id] | ✓ |
| Filter timeline to that watch | Sets filter + scrolls | |
| Not tappable | Display only | |

| Option (windows & ties) | Description | Selected |
|--------|-------------|----------|
| Rolling days, recent-wear tiebreak | 30/90/182/365; ties by last wear then A→Z | ✓ |
| Calendar months, alphabetical ties | Same date N months ago | |
| You decide | Planner's call | |

**User's choice:** All recommended options.

---

## Viewer & linking rules

| Option (visitors) | Description | Selected |
|--------|-------------|----------|
| Yes, from wears they can see | Counts from viewer-gated wears only | ✓ |
| Owner only | Visitors don't see leaderboard | |
| Visitors see worn-only rows | No zero-wear rows for visitors | |

| Option (linking) | Description | Selected |
|--------|-------------|----------|
| Timeline + calendar day panel | All wear rows link to /wear/[id] | ✓ |
| Timeline rows only | Literal WEAR-01 minimum | |

**User's choice:** All recommended options.

---

## Claude's Discretion

- Unified log action shape (extend markAsWorn vs reuse logWearWithPhoto vs new action), carrying both client `today` and `wornDate`
- Fix markAsWorn's activity-on-duplicate quirk if touched
- Mobile form presentation, empty/loading states (may be locked by UI-SPEC)
- JS vs SQL aggregation for leaderboard counts
- Cache invalidation primitives for the action

## Deferred Ideas

None.
