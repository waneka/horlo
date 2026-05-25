# Phase 61: Photo Upload + Carousel UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-25
**Phase:** 61-photo-upload-carousel-ui
**Areas discussed:** Manage-photos surface, Reorder interaction, Carousel contents & cover feedback, Add-watch nudge (PHOTO-09), Upload input

---

## Manage-photos surface

| Option | Description | Selected |
|--------|-------------|----------|
| Inline + manage sheet | Clean carousel + lightweight Add/Manage affordance; "Manage" opens a sheet with a thumbnail grid for reorder/delete | ✓ |
| Fully inline on carousel | All controls overlaid on the carousel; reorder-in-a-one-at-a-time-carousel awkward | |
| On the /w/[ref]/edit page | Photos managed in the edit form; least aligned with roadmap "from the detail page" | |

**User's choice:** Inline + manage sheet.
**Notes:** Established the spine — clean viewing surface + a heavier editing surface. The "sheet" framing was then superseded by the next two answers (always-on filmstrip + Edit toggle), so the final design has no modal. Recorded in CONTEXT D-01 (sheet superseded).

---

## Reorder interaction

| Option | Description | Selected |
|--------|-------------|----------|
| Grid in sheet only | Drag-reorder on a thumbnail grid inside the Manage sheet; detail page carousel only | |
| Always-on filmstrip + drag there | Horizontal filmstrip under carousel for all (tap-to-jump); owner drags to reorder inline | ✓ |
| Reorder via up/down, no drag | Move-left/right buttons per thumbnail; no dnd-kit | |

**User's choice:** Always-on filmstrip + drag there.
**Notes:** Reframed area 1 — reorder is inline on the filmstrip, no sheet needed. Drag uses dnd-kit per Phase 27 precedent (CONTEXT D-04). Surfaced the gap: no reorder DAL fn exists yet (D-05).

---

## Add / Delete affordances (follow-up given filmstrip reorder)

| Option | Description | Selected |
|--------|-------------|----------|
| Edit toggle on filmstrip | "Edit photos" toggle: off = clean + tap-to-jump; on = × delete badges + "+ Add" tile + drag active | ✓ |
| Always-visible controls | Persistent +Add tile + per-thumb × always shown to owner; no toggle | |
| Add inline, delete in carousel | +Add on filmstrip; delete on the big carousel slide; splits controls | |

**User's choice:** Edit toggle on filmstrip.
**Notes:** Unifies add/reorder/delete on one surface with no modal. Cap-reached hides/disables the +Add tile (CONTEXT D-02, D-14).

---

## Carousel contents (zero owner photos)

| Option | Description | Selected |
|--------|-------------|----------|
| Catalog image as a slide | Catalog stock image is the single fallback slide; disappears once owner uploads | ✓ |
| Owner photos only, empty prompt | Carousel shows only owner uploads; empty state with "Add your first photo" | |
| Catalog slide + visible 'stock' tag | Catalog fallback slide with a "Catalog photo" label | |

**User's choice:** Catalog image as a slide (no label).
**Notes:** Page never empty; matches today's single-image behavior. Owner photos take over once present (CONTEXT D-09/D-10).

---

## Cover feedback (reorder sets cover)

| Option | Description | Selected |
|--------|-------------|----------|
| 'Cover' badge on first thumb | Persistent badge on first thumbnail; moves with drag; toast on save | ✓ |
| Toast on cover change only | One-off toast when first photo changes; no persistent badge | |
| Badge + explicit 'Make cover' | Badge plus a per-thumb "Make cover" action | |

**User's choice:** 'Cover' badge on first thumb.
**Notes:** Self-evident, persistent rule; drag-to-first IS make-cover, no separate button (CONTEXT D-07/D-08).

---

## Add-watch nudge — placement (PHOTO-09)

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated step before save | "Add your photos" step after identify / before commit; first-class screen | ✓ |
| Prominent field in the form | Large upload zone at top of WatchForm/verdict; competes with verdict on paste path | |
| Post-save, prime edit mode | Save first, land on /w/[ref] with Edit mode open + callout; easiest to ignore | |

**User's choice:** Dedicated step before save.
**Notes:** Natural unmissable moment; works for URL-extract + manual paths (CONTEXT D-15).

---

## Add-watch nudge — skip strength (PHOTO-09)

| Option | Description | Selected |
|--------|-------------|----------|
| Skip w/ friction | Big "Add photos" CTA; small secondary "Skip for now"; never blocks save | ✓ |
| Skip after acknowledgement | Confirm dialog on skip; max friction short of blocking | |
| Soft nudge, equal skip | Prominent but equal-weight buttons; arguably fails "not easily skipped" | |

**User's choice:** Skip with friction.
**Notes:** Satisfies SC5 ("prominent, not easily skipped") without trapping batch-adders. Button becomes "Continue" once ≥1 photo added (CONTEXT D-16).

---

## Upload input

| Option | Description | Selected |
|--------|-------------|----------|
| Multi-select + desktop drop zone | `multiple` file input; each → HEIC/EXIF/resize/upload; cap-respecting; desktop drag-drop zone; mobile OS picker | ✓ |
| Multi-select, no drop zone | `multiple` via normal picker on all devices; no drag-drop zone | |
| One-at-a-time (mirror existing) | Single-file pattern repeated; under-delivers PHOTO-02 "one or more" | |

**User's choice:** Multi-select + desktop drop zone.
**Notes:** Inherits HEIC handling, EXIF strip, and OS camera-or-library choice from existing uploaders (no forced `capture`). Batch beyond cap accepts up to limit, rejects extras with a message (CONTEXT D-12/D-13/D-14).

---

## Claude's Discretion

- Exact toast/message copy; per-photo upload progress UX; per-photo delete confirmation pattern (lighter than the whole-watch delete Dialog).
- Whether the add-watch step reuses the detail-page filmstrip/upload component or a leaner add-flow variant.
- Embla position-indicator style (dots vs. counter) and arrow styling.
- Filmstrip horizontal scroll/wrap behavior at higher photo counts.

## Deferred Ideas

- Public wear-pic surfacing into the carousel + per-pic hide — Phase 62.
- Detail-page information-hierarchy redesign — Phase 64.
- Per-account photo / storage quota — PHOTO-F1.
- In-app photo editing (filters/rotate/crop) — PHOTO-F2.
- Multi-photo extraction from URL import — PHOTO-F3.
