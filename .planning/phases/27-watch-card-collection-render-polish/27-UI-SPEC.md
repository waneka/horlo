---
phase: 27
slug: watch-card-collection-render-polish
status: draft
shadcn_initialized: true
preset: base-nova
created: 2026-05-04
---

# Phase 27 — UI Design Contract

> Polish phase for Collection/Wishlist render. Heavy reuse of `ProfileWatchCard`, `CollectionTabContent`, `WishlistTabContent`. This contract locks the **incremental visual/interaction deltas** for the 2-column mobile grid, the unified price line, and the press-and-hold reorder UX — it does not redesign the existing card.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (already initialized) |
| Preset | `base-nova` (per `components.json`) |
| Component library | Base UI (`@base-ui/react`) + shadcn primitives in `src/components/ui/` |
| Icon library | `lucide-react` |
| Font | Geist (sans) / Geist Mono (mono) — `next/font/google` in `src/app/layout.tsx` |
| Toast surface | `sonner` via `ThemedToaster` (already mounted) |
| Color base | neutral (oklch palette in `src/app/globals.css`) |
| CSS variables | enabled (`cssVariables: true`) |
| Class merge | `cn()` (`src/lib/utils.ts`) |

**Phase scope re. design system:** No new shadcn primitives are introduced. New library dependency for drag/drop is **owned by the planner** (default candidate `@dnd-kit/core` + `@dnd-kit/sortable` per CONTEXT.md "Claude's Discretion") and is not a shadcn registry component, so the registry safety gate does not apply.

---

## Spacing Scale

Declared values (multiples of 4, Tailwind defaults — already in use across the codebase):

| Token | Value | Usage in this phase |
|-------|-------|---------------------|
| 1 (4px) | 4px | Icon gaps; `gap-1` between price-line glyphs (none used here) |
| 2 (8px) | 8px | Tag pill padding (`px-2 py-0.5`); reorder drop-indicator gap |
| 3 (12px) | 12px | n/a (avoided — keep 8/16 rhythm) |
| 4 (16px) | 16px | `p-4` card content padding (UNCHANGED at half-width per D-12); `gap-4` grid gap (UNCHANGED per D-11) |
| 6 (24px) | 24px | n/a in card; reserved for empty-state vertical rhythm (already in use) |
| 8 (32px) | 32px | n/a in card |
| 12 (48px) | 48px | Empty-state outer padding `p-12` (UNCHANGED) |

**Exceptions:** none. Every spacing class used in this phase already maps to a multiple-of-4 Tailwind token. Card padding is **explicitly preserved** at `p-4` on mobile (D-12) — no compressed `p-2` or `p-3` variants.

**Touch target note:** The drag-affordance is whole-card (no separate handle), so the touch target equals the card area — comfortably ≥44×44px at 2-column mobile (~180px wide × 4:5 aspect = ~225px tall image + content rows).

---

## Typography

Existing `ProfileWatchCard` typography is **preserved verbatim** at half-width per D-12. Geist sans across the board.

| Role | Size | Weight | Line Height | Used For |
|------|------|--------|-------------|----------|
| Model (heading) | 16px (`text-base`) | 600 (`font-semibold`) | tight (`leading-tight`, ~1.25) | `watch.model` |
| Brand (body) | 14px (`text-sm`) | 400 (`font-normal`) | default (~1.5) | `watch.brand`, owner empty-state heading paragraph |
| Caption (label/meta) | 12px (`text-xs`) | 400 (`font-normal`) | default (~1.5) | tag pill, wear label, **price line**, notes preview, "Worn today" / "Not worn recently" overlay |

**Sizes declared:** 3 (12 / 14 / 16). **Weights declared:** 2 (400 + 600). Within the 3-4 sizes / 2 weights envelope.

**Heading line height:** Headings use `leading-tight` (~1.25) — explicit Tailwind class on the model line. **Body line height:** default (~1.5) — Tailwind base, no override.

**Price line typography (NEW — VIS-08):**
- Class: `mt-1 text-xs font-normal text-foreground`
- Replaces the existing wishlist-only `Target: $X` block (which already used `text-xs text-foreground`) — same size, same color, same weight, **single rendering path** for both buckets per D-15/D-19.
- No mobile-specific override; renders identically at half-width and quarter-width.

**Number formatting (D-21):** `value.toLocaleString()` for thousands separators, prefix `$`, no decimals. Examples: `$4,200`, `$15,000`, `$120,000`. Format helper lives inline (no new utility); single source of truth is the `${label}: $${value.toLocaleString()}` template.

---

## Color

The 60/30/10 split is already established by the `base-nova` preset (neutral base, warm amber accent at oklch 0.76 0.12 75). Phase 27 does not change tokens — it inherits.

| Role | Token | Value (light) | Usage in this phase |
|------|-------|---------------|---------------------|
| Dominant (60%) | `--background` | `oklch(0.985 0.003 75)` | Page background behind grid |
| Secondary (30%) | `--card` / `--muted` | `oklch(...)` | Card surface, image-loading muted bg, drop-indicator slot |
| Accent (10%) | `--accent` | `oklch(0.76 0.12 75)` | Reserved — see list below |
| Destructive | `--destructive` | `oklch(0.55 0.22 27)` | Reserved — see list below |
| Foreground | `--foreground` | `oklch(0.18 0.01 75)` | Card text (model, brand, **price line**, notes) |
| Muted foreground | `--muted-foreground` | (existing) | Brand line, wear label, notes-preview line |
| Border | `--border` | (existing) | Card border, "Not worn recently" pill ring, drop-indicator line |

**Accent (`--accent`) reserved for in this phase:**
1. The "Worn today" pill on `ProfileWatchCard` (existing — `bg-accent text-accent-foreground`). Phase 27 does NOT add new accent usages.

**The drag/reorder UX deliberately does NOT use accent.** The drop indicator, the dragging-card lift state, the press-and-hold pre-drag feedback, and the keyboard-grab focus ring all use **`--ring`** / `--border` / **`--card`** with a `shadow-lg` lift — this prevents reorder UI from competing with the "Worn today" pill for the accent slot.

**Destructive (`--destructive`) reserved for:** Sonner error toast on reorder-persist failure (D-09). No destructive UI on the card itself.

**Color does NOT distinguish primary vs fallback price (D-19).** Both `Paid:` / `Target:` (primary) and `Market:` (fallback) render in the same `text-foreground` color — the **label prefix carries the meaning**, not the styling.

---

## Copywriting Contract

| Element | Copy | Source |
|---------|------|--------|
| Price line — paid bucket primary | `Paid: $X` (e.g. `Paid: $4,200`) | D-17, D-18 |
| Price line — target bucket primary | `Target: $X` (e.g. `Target: $4,200`) | D-17, D-18 — replaces existing `Target: $X` block |
| Price line — fallback (either bucket) | `Market: $X` | D-17, D-18 |
| Price line — both null | (line hidden entirely; no placeholder) | D-17 |
| Wishlist empty-state heading (owner) | `No wishlist watches yet.` | EXISTING — unchanged |
| Wishlist empty-state body (owner) | `Track watches you want to own, with verdict-style fit analysis.` | EXISTING — unchanged |
| Wishlist empty-state heading (non-owner) | `Nothing here yet.` | EXISTING — unchanged |
| Wishlist empty-state body (non-owner) | `{username} hasn't added any wishlist watches yet.` | EXISTING — unchanged |
| Wishlist owner CTA (empty state) | `Add a wishlist watch` | EXISTING — unchanged |
| Reorder error toast | `Couldn't save new order. Reverted.` | NEW — Sonner error, optimistic rollback per D-09 |
| Reorder success | (silent — no toast on success per optimistic UI) | D-09 |
| Keyboard reorder — pickup announcement | `Picked up {brand} {model}. Use arrow keys to move, space to drop, escape to cancel.` | NEW — `aria-live="assertive"` polite region for screen readers |
| Keyboard reorder — drop announcement | `Dropped {brand} {model} at position {n} of {total}.` | NEW — `aria-live="assertive"` |
| Keyboard reorder — cancel announcement | `Reorder canceled. {brand} {model} returned to original position.` | NEW — `aria-live="assertive"` |
| Drag handle aria-label (whole card) | `Reorder {brand} {model}. Press and hold to drag, or focus and press space to pick up with keyboard.` | NEW — added to draggable card wrapper, owner-only |

**Empty state behavior under drag context:** When the wishlist is empty, the existing empty-state component renders unchanged (no draggable items, so no drag context to introduce). When the wishlist has exactly 1 item, drag is mounted but a no-op — no special copy.

**Destructive actions in this phase:** **None.** Reorder is non-destructive; failure path rolls back optimistic state and shows an error toast — no confirm dialog, no permanent loss surface. Status transitions and watch deletion are **out of scope** for Phase 27.

**Voice:** Sentence-case, period-terminated, second-person where applicable. Matches existing Horlo copy (Phases 25/26 set the precedent). No exclamation marks. `Couldn't` (contraction) over `Could not` — matches existing toast voice.

---

## Interaction Contract — Reorder (NEW)

This section is the load-bearing delta of Phase 27. Locked here because the decisions are non-trivial and the orchestrator flagged them as open.

### Press-and-hold thresholds (D-06, D-07)

| Pointer type | Activation threshold | Tolerance | Library prop equivalent |
|--------------|---------------------|-----------|-------------------------|
| Mouse / trackpad (desktop) | **150ms** hold | 5px movement | `dnd-kit` `MouseSensor` `activationConstraint: { delay: 150, tolerance: 5 }` |
| Touch (mobile) | **250ms** hold | 8px movement | `dnd-kit` `TouchSensor` `activationConstraint: { delay: 250, tolerance: 8 }` |
| Keyboard | space (pickup) → arrows (move) → space (drop) / escape (cancel) | n/a | `dnd-kit` `KeyboardSensor` (default) |

**Below threshold = navigate.** Mouse-up / touch-end before the delay elapses fires the existing `<Link>` to `/watch/[id]` unmodified. Above threshold = drag begins; the click-through is suppressed by the sensor.

### Visual feedback states

| State | Trigger | Visual treatment |
|-------|---------|------------------|
| At rest (owner-draggable) | Idle, owner viewing wishlist | Card unchanged. **`cursor-grab` on hover** (desktop only). Mobile: no visual difference at rest (touch users have no hover). |
| Hover (owner-draggable, desktop) | Pointer over card | Existing `hover:shadow-lg` (already on card) PLUS `cursor-grab`. No additional treatment. |
| Pre-drag (during hold, before threshold) | Mouse/touch held but delay not yet elapsed | **No additional visual feedback.** Rationale: avoid noisy pre-drag lifts for tap users who simply hold a moment too long. The 150/250ms thresholds are tight enough that a misfire indicator would do more harm than good. |
| Active drag (after threshold) | Sensor fires `onDragStart` | Source card: opacity reduced to `opacity-30`, in-place. Drag overlay (`<DragOverlay>`): full card render, **`scale-105 shadow-xl`**, `cursor-grabbing`. |
| Drop indicator | Hovering a sortable target slot | A 2px line in `bg-ring` color appears in the gap **before** the target slot, full-width of the slot. No slot-ghost / no displaced card animation beyond `dnd-kit`'s default `transform` translation. |
| Drop confirmed | `onDragEnd` with valid target | Drag overlay unmounts; cards snap to new positions via `dnd-kit` transition (default 250ms). No success toast (silent per optimistic UI). |
| Drop failed (server error) | Server action returns error | Local state rolls back to pre-drag order (cards animate back via same transition). Sonner error toast: `Couldn't save new order. Reverted.` |
| Keyboard pickup | Card focused + space pressed | Card gets `ring-2 ring-ring ring-offset-2` focus ring AND `shadow-lg` lift. `aria-live` announcement fires. |
| Keyboard move | Arrow key (up/down/left/right in 2-col grid) | Card visually translates to new slot via dnd-kit; focus stays on card. No announcement per move (would be too verbose). |
| Keyboard drop | Space pressed while picked-up | Same as `Drop confirmed`. `aria-live` confirmation announcement. |
| Keyboard cancel | Escape pressed while picked-up | Card returns to original slot. `aria-live` cancel announcement. Focus stays on card. |

### Cursor states (desktop)

| Context | Cursor |
|---------|--------|
| Owner viewing wishlist, hovering card | `cursor-grab` |
| Owner viewing wishlist, actively dragging | `cursor-grabbing` (applied to body via dnd-kit overlay) |
| Non-owner viewing public wishlist | `cursor-pointer` (existing `<Link>` cursor — UNCHANGED) |
| Owner viewing **collection** tab (drag NOT in scope) | `cursor-pointer` (UNCHANGED — no drag wired) |

### Mobile haptic feedback

When the touch sensor fires `onDragStart` (250ms threshold reached), call `navigator.vibrate?.(10)` once. **10ms = single brief tick**, the iOS/Android norm for "drag started." Guard with `?.` for browsers that don't support the API. No vibration on drop, on cancel, or on hover-over-slot — vibration noise budget is one event per drag.

### Non-owner experience (D-08)

- No `cursor-grab`, no press-and-hold detection, no DnD context mounted, no drag overlay, no aria-labels mentioning drag, no haptic.
- Cards render as plain `<Link>` exactly as today.
- Order is the owner's chosen `sort_order` (threaded through DAL per D-10).

### Accessibility

- **Keyboard reorder** is a first-class path (not a fallback). `dnd-kit` `KeyboardSensor` is required.
- **`aria-live="assertive"`** region (visually hidden, persistent in DOM) announces pickup / drop / cancel events. Lives in `WishlistTabContent` adjacent to the grid.
- **Card focus ring** uses the existing project ring token (`ring-2 ring-ring ring-offset-2`). When picked up, the lift state (`shadow-lg`) supplements the ring — does not replace it.
- **`aria-roledescription="sortable"`** on each draggable card so screen readers identify the affordance.
- **Reduced motion:** `dnd-kit` honors `prefers-reduced-motion` automatically for transition animations. The drop indicator (a static line) and the lift (a static shadow) are unaffected.

---

## Mobile Grid (VIS-07)

Locked per D-11, D-12, D-13.

### Grid classes

```
grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4
```

| Breakpoint | Columns | Tailwind |
|------------|---------|----------|
| <640px (mobile) | **2** (CHANGED from 1) | `grid-cols-2` |
| 640px–1023px (tablet) | 2 (unchanged) | `sm:grid-cols-2` |
| ≥1024px (desktop) | 4 (unchanged) | `lg:grid-cols-4` |

Applies to BOTH `CollectionTabContent` AND `WishlistTabContent`.

### Image sizing

- Aspect ratio: `aspect-[4/5]` across all breakpoints (D-13 — vertical objects, do not clip strap context).
- `<Image sizes>` attribute (UPDATED per D-13):

  ```
  (max-width: 640px) 50vw, (max-width: 1024px) 50vw, 25vw
  ```

  (Replaces existing `(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw`.)

### Card content at half-width

Per D-12 — **render unchanged**. Specifically PRESERVE on mobile half-width:
- `p-4` content padding
- `text-base font-semibold leading-tight` on `watch.model`
- `text-sm font-normal` on `watch.brand`
- Tag pill (`mt-2 rounded-full text-xs font-normal`)
- Wear label (`mt-2 text-xs text-muted-foreground`)
- Price line (`mt-1 text-xs text-foreground`) — NEW
- Notes preview on Wishlist (`mt-1 line-clamp-2 text-xs text-muted-foreground`)
- "Worn today" / "Not worn recently" pill (`absolute top-2 left-2 ... text-xs`)

Ship and iterate per CONTEXT specifics. Do NOT add `sm:`/`md:` responsive font/padding variants in this phase.

### `AddWatchCard` at end of grid

- `AddWatchCard` (collection tab — owner only) and `AddWatchCard variant="wishlist"` (wishlist tab — owner only) continue to render as the final grid cell. They pick up the 2-column mobile layout automatically (no class change required on `AddWatchCard` itself).
- `AddWatchCard` is NOT draggable on the wishlist tab — it's an action affordance, not a sortable item. Excluded from the dnd-kit `SortableContext`.

---

## Price Line (VIS-08)

Locked per D-15 → D-21. Single rendering path replaces the existing wishlist-only `Target: $X` block at line 85-88 of `ProfileWatchCard.tsx`.

### Status → bucket → label resolution

```
status = 'owned' | 'sold'
  → bucket = 'paid'
  → if pricePaid != null:    "Paid: $" + pricePaid.toLocaleString()
  → else if marketPrice != null: "Market: $" + marketPrice.toLocaleString()
  → else: hide line

status = 'wishlist' | 'grail'
  → bucket = 'target'
  → if targetPrice != null:  "Target: $" + targetPrice.toLocaleString()
  → else if marketPrice != null: "Market: $" + marketPrice.toLocaleString()
  → else: hide line
```

### Render position in card

Between the wear-label line and the notes preview (when shown). Inserted at the same DOM depth as today's `Target: $X` block, but rendered for **all card variants** (collection AND wishlist), driven by status — not gated on `showWishlistMeta`.

### Visual

- Class: `mt-1 text-xs font-normal text-foreground`
- One line, never wraps (model/brand strings could wrap; price line will not — `$X,XXX` strings fit easily)
- No icon prefix
- No tooltip (the label IS the explanation)
- No skeleton / loading state — price is part of `Watch` payload, available synchronously

### Examples (visual reference)

```
Paid: $4,200
Target: $15,000
Market: $8,500
(line absent — both fields null)
```

---

## Component Inventory — what changes in this phase

| Component | Change | Risk |
|-----------|--------|------|
| `ProfileWatchCard` | Replace existing `showWishlistMeta && watch.targetPrice` block with status-driven price line. Add `aria-roledescription`, `aria-label` for owner reorder context. Add `cursor-grab` on hover when owner+wishlist. | LOW — local change, single component |
| `WishlistTabContent` | Wrap grid in `dnd-kit` `DndContext` + `SortableContext` (owner only). Add `aria-live` region. Wire optimistic local state + server action. Update grid class to `grid-cols-2`. | MEDIUM — new library + state |
| `CollectionTabContent` | Update grid class to `grid-cols-2` only. **No drag.** | LOW — single class change |
| `AddWatchCard` | No internal change. Excluded from `SortableContext` on wishlist. | NONE |
| `src/components/ui/` | No new shadcn primitives added. | NONE |

### New components (planner may introduce)

| Component | Purpose | Notes |
|-----------|---------|-------|
| `SortableProfileWatchCard` (or HOC pattern) | Wraps `ProfileWatchCard` with `useSortable` hook from `@dnd-kit/sortable` | Lives next to `ProfileWatchCard` in `src/components/profile/`. Owner-only render path. |
| `WishlistDragOverlay` (optional) | Custom `<DragOverlay>` content if dnd-kit's default isn't acceptable | Optional — dnd-kit's overlay rendering the card itself is usually fine. |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | (none added in this phase — `card`, `badge`, `button`, `tooltip`, `input` etc. already installed) | not required |
| Third-party shadcn registries | none declared | not required |

**Drag/drop library** (`@dnd-kit/core`, `@dnd-kit/sortable`) is a standard npm dependency added by the planner — NOT a shadcn registry block. The shadcn registry safety gate (`shadcn view`) does not apply. Standard npm supply-chain hygiene applies (planner verifies package, version, weekly downloads, last publish date, maintainer footprint per project conventions).

---

## Out of Scope (UI-SPEC-level reminders)

- **Card redesign** — D-12 explicitly forbids responsive variants. Ship existing card at half-width.
- **Collection tab reorder UX** — column exists post-migration but no DnD wired (deferred per CONTEXT `<deferred>`).
- **Notes tab reorder** — out of scope.
- **`marketPrice` first-class display** — only the fallback role per D-20. v6.0 Market Value owns first-class market display.
- **Edit-mode toggle / always-visible drag handle** — explicitly rejected per D-06.
- **Pre-drag visual feedback** below the activation threshold — explicitly omitted (rationale in interaction contract).

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending

---

## Pre-Population Source Map

| Section | Source |
|---------|--------|
| Design system | `components.json` (read), `src/app/globals.css` (read), existing project (Geist, Sonner, lucide) |
| Spacing scale | Tailwind defaults already in use; CONTEXT D-11/D-12 (preserve `gap-4`, `p-4`) |
| Typography (sizes/weights/line-height) | Existing `ProfileWatchCard.tsx` lines 71–92 (read) |
| Color tokens | `src/app/globals.css` lines 52–112 (read) |
| Accent reservation | Existing `ProfileWatchCard.tsx` line 63 (`bg-accent` only on Worn-today pill) |
| Price line copy + format | CONTEXT D-15 → D-21 |
| Press-and-hold thresholds | CONTEXT D-06, D-07 |
| Optimistic UI + Sonner toast | CONTEXT D-09; existing Sonner mounted via `ThemedToaster` |
| Mobile grid breakpoints | CONTEXT D-11 |
| Image aspect + sizes attr | CONTEXT D-13 |
| Owner-only drag gating | CONTEXT D-08, D-10 |
| Visual feedback states (drag overlay, drop indicator, focus ring, haptic) | Researcher discretion (CONTEXT explicitly delegates DnD UX choices to planner/researcher); contract locks specific values |
| Empty-state copy | Existing `WishlistTabContent.tsx` lines 30–53 (unchanged) |
| Error toast copy | Researcher (matches existing Horlo voice) |
| aria-live announcements | Researcher (accessibility requirement; pattern matches `FormStatusBanner` precedent) |
