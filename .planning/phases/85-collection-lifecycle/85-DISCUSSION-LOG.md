# Phase 85: Collection lifecycle - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-13
**Phase:** 85-collection-lifecycle
**Areas discussed:** Sold → previously_owned migration, Disposal flow & dialog, Celebration moment, Previously-owned visibility

**Scout finding that framed the discussion:** `sold` already exists as a `WatchStatus` (types, DB enum, edit-form dropdown), and Phase 37 added a `divestments` table with an owned→sold dual-write. Similarity already compares owned|grail only, and the recommender seed is owned-only. However, the recommender's "already has" exclusion omitted sold.

---

## Sold → previously_owned migration

| Option | Description | Selected |
|--------|-------------|----------|
| Replace it | Migrate sold rows → previously_owned + reason=sold; remove 'sold' everywhere | ✓ |
| Keep both | Keep legacy sold alongside previously_owned | |

| Option | Description | Selected |
|--------|-------------|----------|
| Columns on watches | Nullable disposal_reason / sell_price / disposal_date on watches | ✓ |
| Extend divestments table | Add reason + watch_id FK to divestments; join on read | |

| Option | Description | Selected |
|--------|-------------|----------|
| Stop writing, leave table | Remove dual-write; table + rows untouched | ✓ |
| Keep dual-writing | Continue inserting divestments rows | |
| Drop the table | Remove divestments entirely | |

| Option | Description | Selected |
|--------|-------------|----------|
| Allow undo, clear fields | Status leaving previously_owned nulls the 3 fields | ✓ |
| Strictly one-way | Never offer status change; delete to fix | |
| You decide | | |

---

## Disposal flow & dialog

| Option | Description | Selected |
|--------|-------------|----------|
| Card overflow (⋯) menu | Owner-only menu on card → Mark as previously owned | ✓ |
| Detail page action only | Button on /w/[id] hero | |
| Both card menu + detail page | Shared dialog | |

| Option | Description | Selected |
|--------|-------------|----------|
| Reason required; price+date optional | Date defaults today, no future | ✓ |
| Reason-aware fields | Hide sell price for gifted/lost/stolen | |

| Option | Description | Selected |
|--------|-------------|----------|
| Hide it from the dropdown | Dialog is the only disposal path; undo via edit form | ✓ |
| Offer it in the dropdown | Inline reason/price/date on edit form | |
| You decide | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Stay, card disappears + toast | Card leaves grid, toast confirms | ✓ |
| Stay, card stays until refresh | Badge in place | |

---

## Celebration moment

| Option | Description | Selected |
|--------|-------------|----------|
| Every wishlist/grail → owned | Edit form + add-flow move; server-returned promoted flag | ✓ |
| Wishlist → owned only | Exclude grail | |

| Option | Description | Selected |
|--------|-------------|----------|
| Centered moment dialog | Modal with watch image + scale-in, no new dep | |
| Confetti burst + toast | Lightweight confetti lib + celebratory toast | ✓ |
| Enhanced toast only | Celebratory sonner toast | |

| Option | Description | Selected |
|--------|-------------|----------|
| Same moment, grail copy | "Grail acquired" | ✓ |
| Identical | | |
| You decide | | |

| Option | Description | Selected |
|--------|-------------|----------|
| No, pure celebration | Nothing to fill in | ✓ |
| Optional price/photo links | Deep-links to edit/photos | |

---

## Previously-owned visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Owner only | Visitors never see disposal history | ✓ |
| Visitors too, price hidden | | |
| Visitors too, all fields | | |

| Option | Description | Selected |
|--------|-------------|----------|
| In FilterChips row, not persisted | Resets to off each visit | ✓ |
| In FilterChips row, persisted in URL | ?previously_owned=1 | |

| Option | Description | Selected |
|--------|-------------|----------|
| Mixed in, muted + badge | Same grid, dimmed, "Sold · Mar 2026" | ✓ |
| Separate section below | Second grid | |

| Option | Description | Selected |
|--------|-------------|----------|
| Keep in Timeline/Calendar | Wears stay; leaderboard/picker already owned-only | ✓ |
| Hide them too | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Treat as not found for visitors | Remove from visitor visibility predicate | ✓ |
| Visible, disposal fields hidden | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, exclude it | Add previously_owned to recommender "already has" set | ✓ |
| No, allow it | | |

---

## Claude's Discretion

- Confetti library + reduced-motion handling; celebration signal across navigation
- Copy (toast, badge, grail), dialog layout, ⋯ menu component/items
- CHECK constraint vs pgEnum for status/disposal_reason; field↔status CHECK
- Whether to backfill metadata from divestments (default no)

## Deferred Ideas

- Drop `divestments` table (later one-way cleanup)
- LIFE-V2-01/02/03 (already v2)
