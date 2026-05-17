# Phase 43: Polish Pass - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-16
**Phase:** 43-Polish Pass
**Areas discussed:** Card height consistency, Add-watch button design, Avatar upload UX, Swipe-to-dismiss feel

---

## Card Height Consistency (PLSH-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Reserve every row | Every card always renders all content rows; missing data leaves a blank space-occupying row. | |
| Fixed card height | Pin the whole card to one height; the image flexes to absorb text-length differences. | |
| Fixed text block height | Image stays a fixed 4/5 ratio; only the text content area gets a min-height sized for the fullest case. | ✓ (basis) |

**User's choice:** Fixed text block height — *with a layout change*: brand and model move **above** the image; image at roughly 4/5 (or a bit shorter); fixed-height text block below for the remaining fields.
**Notes:** User clarified the question rather than answering as-posed. The card is deliberately restructured, not just height-padded. Captured as D-04/D-05.

---

## Add-Watch Button Design (PLSH-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Per-tab button | Collection tab → "Add to Collection", wishlist tab → "Add to Wishlist". | ✓ |
| One "Add a watch" button | Single neutral button on both tabs; status chosen later in the add flow. | |

| Option (placement) | Description | Selected |
|--------|-------------|----------|
| In the filter row, right side | Button on the existing filter-chips/search row, right-aligned. Empty state unchanged. | ✓ |
| Its own row above filters | Dedicated row above the filter chips. Empty state unchanged. | |
| You decide | Pick cleanest placement; empty-state CTA as-is. | |

**User's choice:** Per-tab button, right-aligned in the existing filter-chips/search row; empty-state CTA unchanged.
**Notes:** Captured as D-06/D-07/D-08.

---

## Avatar Upload UX (PLSH-06)

| Option | Description | Selected |
|--------|-------------|----------|
| Interactive square crop | User drags/zooms to position a square crop before saving. | ✓ (basis) |
| Auto center-crop | Resize + center-crop automatically, no crop UI. | |

| Option (URL field) | Description | Selected |
|--------|-------------|----------|
| Drop it entirely | ProfileEditForm shows only the upload control. | ✓ |
| Keep as advanced fallback | Upload primary; URL field kept as secondary option. | |

**User's choice:** Interactive crop — but with a **circular** mask (not square); drop the URL field entirely.
**Notes:** User amended the crop option via free text to specify a circular crop mask. Captured as D-09/D-10/D-11.

---

## Swipe-to-Dismiss Feel (PLSH-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Drag-follows-finger | Sheet tracks the finger; snaps closed past a threshold or springs back. | |
| Swipe-down detector | Downward swipe past a distance/velocity threshold triggers the close animation. | |
| You decide | Let research/planning pick. | |

**User's choice:** Neither as posed — user asked to evaluate the **Base UI Drawer** component (https://base-ui.com/react/components/drawer), which provides swipe-to-dismiss natively without custom behavior. Evaluation confirmed Drawer fits; adopted.

| Option (migration scope) | Description | Selected |
|--------|-------------|----------|
| Filter sheet only | Migrate just WatchFacetSheet/FilterSheet to a Drawer-based component. | ✓ |
| Replace the bottom-sheet primitive | Rework `ui/sheet.tsx` so the bottom variant is Drawer-backed everywhere. | |
| You decide | Scope after checking bottom-sheet usages. | |

**User's choice:** Adopt Base UI Drawer for the filter sheet only; `@base-ui/react` bumps to ~1.4.x.
**Notes:** Captured as D-01/D-02/D-03.

## Claude's Discretion

- Exact `@base-ui/react` patch version that ships Drawer.
- Precise image aspect ratio within "roughly 4/5, maybe a bit shorter".
- Crop component choice (build vs library) for the interactive circular crop.

## Deferred Ideas

None — discussion stayed within phase scope. A broader bottom-sheet primitive migration was explicitly scoped out (filter sheet only).
