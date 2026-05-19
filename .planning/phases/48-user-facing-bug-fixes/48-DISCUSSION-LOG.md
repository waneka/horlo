# Phase 48: User-Facing Bug Fixes - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-19
**Phase:** 48-user-facing-bug-fixes
**Areas discussed:** BUG-01 fix shape, BUG-02 fix approach, chip consolidation scope, regression tests, chip primitive design

---

## BUG-01 — Catalog ownership mislabel

| Option | Description | Selected |
|--------|-------------|----------|
| Fall through to cross-user verdict | Stop the mislabel — non-owned watches get the normal cross-user verdict + CTA (wishlist watches show the existing wishlist-aware action). Minimal. | ✓ |
| Add an 'On your wishlist' callout | Stop the mislabel AND add a positive callout symmetric to 'You own this watch'. More UI work — arguably a new capability. | |

**User's choice:** Fall through to cross-user verdict
**Notes:** Minimal fix per SEED-011 "fix the labeling/state." Root cause confirmed pre-discussion: `findViewerWatchByCatalogId()` lacks a `status` filter.

---

## BUG-02 — Dark-mode chip legibility

| Option | Description | Selected |
|--------|-------------|----------|
| Swap to a legible foreground token | Keep the tinted bg-accent/10 pill; change text-accent-foreground → a token readable on a dark tint. Smallest diff. | ✓ |
| Restyle to the solid selected-chip pill | Make removable chips match the drawer's solid selected-chip style. More visual change. | |

**User's choice:** Swap to a legible foreground token
**Notes:** Root cause confirmed pre-discussion: inline removable chips use `text-accent-foreground` (near-black in dark mode) on `bg-accent/10` (barely-tinted dark surface).

---

## Chip consolidation scope

| Option | Description | Selected |
|--------|-------------|----------|
| Fix only the broken inline chips | Narrow bug fix; leave the 7 drawer chip components alone. Keeps the phase small. | |
| Extract a shared chip primitive | Fix the bug and consolidate all 8 chip surfaces into one primitive. Larger refactor. | ✓ |

**User's choice:** Extract a shared chip primitive
**Notes:** Expands the phase beyond a pure bug fix; accepted deliberately.

---

## Regression tests

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — add regression tests | Assert a wishlist/grail/sold watch on /catalog does NOT render 'You own this watch'; dark-mode chip check if practical. | ✓ |
| Bug fixes only, no new tests | Fix the two bugs; skip new coverage. | |

**User's choice:** Yes — add regression tests

---

## Chip primitive design

| Question | Options | Selected |
|----------|---------|----------|
| Variant model | Toggle + removable variants / Single chip + composable affordances | "You choose" → Claude's discretion |
| Visual outcome | Identical minus the bug / Unify the look | Unify the look ✓ |
| Location | `src/components/ui/` / `src/components/search/` | `src/components/ui/` ✓ |

**User's choice:** Unify the chip look; primitive lives in `src/components/ui/`; variant model deferred to Claude.
**Notes:** "Unify the look" makes the chip visuals a genuine design decision — a `/gsd-ui-phase 48` design contract is warranted before planning.

## Claude's Discretion

- Chip primitive variant model — recommended a CVA-based primitive with `toggle` and `removable` variants (CVA already in the stack). Final API shape is the planner's call.
- The exact legible foreground token for the BUG-02 fix — to be settled by the unified chip design.

## Deferred Ideas

- Positive "On your wishlist" callout on `/catalog/[catalogId]` — considered, explicitly declined for this phase; possible future polish.
- Whether `/catalog/[catalogId]` and `/watch/[id]` should remain separate views — that is Phase 50 / ARCH-01.
