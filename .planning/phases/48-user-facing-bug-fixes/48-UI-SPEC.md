---
phase: 48
slug: user-facing-bug-fixes
status: approved
shadcn_initialized: true
preset: base-nova
created: 2026-05-19
reviewed_at: 2026-05-19T00:00:00Z
---

# Phase 48 — UI Design Contract

> Visual and interaction contract for the unified chip primitive (D-07/D-08) and the dark-mode legibility fix (BUG-02/D-05). This is a narrow contract — Phase 48 is a 2-bug fix with chip consolidation. No new features, no layout changes.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn |
| Preset | base-nova |
| Style | base-nova (components.json confirmed) |
| Component library | @base-ui/react ^1.3.0 |
| Icon library | lucide-react |
| Font | IBM Plex Sans (sans), Instrument Serif (serif), Geist Mono (mono) |
| CSS variables | oklch-based custom properties in globals.css — class-based dark mode via `.dark` |

Source: `components.json` (verified), `src/app/layout.tsx` (verified), `src/app/globals.css` (verified).

---

## Spacing Scale

Standard 8-point scale. Phase 48 chip primitive uses only the values below.

| Token | Value | Chip Usage |
|-------|-------|-----------|
| xs | 4px | Gap between chip label and X icon (`gap-1` = 4px in Tailwind 4) |
| sm | 8px | Not used in chips directly |
| md | 12px | Chip horizontal padding (`px-3` = 12px) |
| sm-v | 4px | Chip vertical padding (`py-1` = 4px) |

**Chip geometry (both variants):**
- Horizontal padding: `px-3` (12px each side)
- Vertical padding: `py-1` (4px each side)
- Border radius: `rounded-full` (fully pill-shaped — matches existing drawer chip pattern)
- Height: implicit — text-sm (14px) + py-1 (4px×2) + border (1px×2) = ~24px effective height

Exceptions: none. Touch targets are not a concern — chips are pointer-only filter controls in a drawer and search results page, not primary actions.

---

## Typography

Phase 48 introduces no new typographic roles. Chip text inherits from the existing scale.

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Chip label | 14px (`text-sm`) | 400 normal (toggle unselected) | 1.25 (tight, single-line) |
| Chip label — active | 14px (`text-sm`) | 600 semibold (`font-semibold`) | 1.25 |

Active means: selected state (toggle variant) OR any removable chip (always semibold — per existing pattern and D-05 "smallest-diff").

Source: existing drawer chip className pattern (RESEARCH.md chip inventory, all 7 surfaces); existing removable chip className in SearchPageClient.tsx.

---

## Color

The design system uses oklch CSS custom properties. Phase 48 touches only chip surfaces. All values are token references — no hardcoded colors.

### Token Reference (from globals.css, verified)

| Token | Light (`:root`) | Dark (`.dark`) | Notes |
|-------|----------------|----------------|-------|
| `--background` | `oklch(0.985 0.003 75)` near-white | `oklch(0.14 0.005 75)` near-black | Page surface |
| `--foreground` | `oklch(0.18 0.01 75)` near-black | `oklch(0.96 0.005 75)` near-white | **Removable chip text** |
| `--accent` | `oklch(0.76 0.12 75)` golden | `oklch(0.78 0.13 75)` golden | Chip accent bg |
| `--accent-foreground` | `oklch(0.18 0.01 75)` near-black | `oklch(0.14 0.005 75)` near-black | Toggle selected text only |
| `--secondary` | `oklch(0.96 0.005 75)` near-white | `oklch(0.26 0.005 75)` dark gray | Toggle unselected bg |
| `--secondary-foreground` | `oklch(0.22 0.005 75)` near-black | `oklch(0.96 0.005 75)` near-white | Toggle unselected text |
| `--muted` | `oklch(0.95 0.005 75)` | `oklch(0.24 0.005 75)` | Toggle unselected hover bg |
| `--border` | `oklch(0.9 0.005 75)` | `oklch(1 0 0 / 10%)` | Toggle unselected border |
| `--destructive` | `oklch(0.55 0.22 27)` red | `oklch(0.65 0.2 27)` red | Destructive only |

### Color Roles for Phase 48

| Role | Dominant (60%) | Secondary (30%) | Accent (10%) |
|------|---------------|-----------------|--------------|
| Chip unselected (toggle) | `bg-secondary` | — | — |
| Chip selected (toggle) | — | — | `bg-accent` solid |
| Chip removable | — | — | `bg-accent/10` tinted |
| Page/layout | unchanged — no new surfaces | unchanged | unchanged |

Accent reserved for: selected drawer chips (solid fill), removable chips (10% tinted background and border), ring/focus states.

---

## Chip Primitive Visual Contract

This section is the primary deliverable of this UI-SPEC. It specifies the unified `Chip` primitive that replaces all 8 ad-hoc chip surfaces.

### Shared Base (both variants)

```
rounded-full border px-3 py-1 text-sm transition-colors
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1
```

- Border radius: `rounded-full` — pill shape, consistent across both variants
- Padding: `px-3 py-1` — 12px horizontal, 4px vertical
- Font size: `text-sm` (14px)
- Transition: `transition-colors` (matches existing button/badge pattern)
- Focus: `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1`

### Variant: `toggle` — Unselected State

```
bg-secondary text-secondary-foreground border-border hover:bg-muted
font-normal
```

- Background: `bg-secondary` — near-white (light) / dark gray (dark)
- Text: `text-secondary-foreground` — near-black (light) / near-white (dark)
- Border: `border-border`
- Hover: `hover:bg-muted`
- Weight: `font-normal` (400)
- No trailing icon

### Variant: `toggle` — Selected State

The caller passes `selected={true}`; the primitive applies the selected classes via a compound variant or conditional `cn()`.

```
bg-accent text-accent-foreground border-accent font-semibold
```

- Background: `bg-accent` solid — golden in both modes (L=0.76/0.78)
- Text: `text-accent-foreground` — near-black (L=0.18 light / L=0.14 dark) on solid golden accent — adequate contrast on solid accent background in both modes
- Border: `border-accent`
- Weight: `font-semibold` (600)
- No trailing icon

Note: `text-accent-foreground` is only safe here because the background is `bg-accent` SOLID. This is NOT the case for the removable variant.

### Variant: `removable`

BUG-02 fix lives here. This is the only variant that changes from current code.

```
gap-1 bg-accent/10 border-accent text-foreground font-semibold hover:bg-accent/20
```

- Background: `bg-accent/10` — 10% tinted pill (D-05: keep tinted look, do NOT change to solid)
- Text: **`text-foreground`** — near-black (L=0.18) in light, near-white (L=0.96) in dark
  - This is the BUG-02 fix. The old value `text-accent-foreground` (L=0.14 dark) on `bg-accent/10` (near-transparent dark surface ~L=0.17) is near 1:1 contrast — unreadable.
  - `text-foreground` flips with the theme: light mode = near-black on near-white tint (excellent), dark mode = near-white on near-black tint (excellent).
  - Decision rationale: `text-foreground` is semantically correct (it is the base content token), requires no dark-mode-specific override, and is verified superior to `text-accent` (L=0.78 in dark — good but not as high contrast as L=0.96).
- Border: `border-accent`
- Gap: `gap-1` (4px between label and X icon)
- Weight: `font-semibold` (600) — always active, always semibold
- Hover: `hover:bg-accent/20`
- Trailing icon: `<X className="size-3" aria-hidden />` + `<span className="sr-only">Remove {label} filter</span>`
- No selected/unselected state — always rendered as active

### Visual Consistency Between Variants (D-08)

D-08 requires both variants look visually consistent post-consolidation. The unifying elements:

| Property | toggle (unselected) | toggle (selected) | removable |
|----------|--------------------|--------------------|-----------|
| Shape | `rounded-full` pill | `rounded-full` pill | `rounded-full` pill |
| Padding | `px-3 py-1` | `px-3 py-1` | `px-3 py-1` |
| Height | ~24px | ~24px | ~24px |
| Font size | 14px | 14px | 14px |
| Transition | colors | colors | colors |
| Focus ring | ring-ring | ring-ring | ring-ring |

Deliberate visual differences that remain (these are intentional, not inconsistencies):

| Property | toggle (unselected) | toggle (selected) | removable |
|----------|--------------------|--------------------|-----------|
| Background | secondary | accent solid | accent/10 tinted |
| Text color | secondary-foreground | accent-foreground | foreground |
| Weight | normal | semibold | semibold |
| Border | border | accent | accent |
| Hover | muted | (no hover needed — already selected) | accent/20 |
| Trailing X | no | no | yes |

The removable variant is visually "accent-flavored but not solid" — it reads as a distinct UI affordance from both toggle states, which is correct. A removable chip is not a selection toggle; it is an active filter with a clear action.

### CSS Chain Assertion (per feedback_ui_spec_css_chain_blind_spot memory)

The following CSS chains must be explicitly verified during implementation:

1. `removable` variant: `bg-accent/10` on `.dark` body = `oklch(0.78 0.13 75 / 10%)` layered on `oklch(0.14 0.005 75)` background → effective surface ~L=0.17 (very dark). `text-foreground` in `.dark` = `oklch(0.96 0.005 75)` → L=0.96 on L=0.17 → contrast > 7:1. WCAG AAA.

2. `toggle` selected: `bg-accent` on `.dark` = `oklch(0.78 0.13 75)` (mid-light golden). `text-accent-foreground` in `.dark` = `oklch(0.14 0.005 75)` → L=0.14 on L=0.78 → contrast ~4.5:1. WCAG AA. This is unchanged from existing behavior.

3. `toggle` unselected: `bg-secondary` on `.dark` = `oklch(0.26 0.005 75)`. `text-secondary-foreground` in `.dark` = `oklch(0.96 0.005 75)` → L=0.96 on L=0.26 → contrast > 6:1. WCAG AAA. Unchanged.

Manual dark-mode visual verification required before closing BUG-02 — jsdom cannot resolve CSS custom properties.

---

## Copywriting Contract

Phase 48 introduces no new user-visible copy surfaces. The chip primitive uses existing screen-reader patterns only.

| Element | Copy |
|---------|------|
| Removable chip SR label | "Remove [filter name] filter" (sr-only span) — matches existing pattern in SearchPageClient.tsx |
| Chip focus ring | No tooltip — focus state is visual only |
| BUG-01 fix | No copy change — mislabeled "You own this watch" disappears because the query no longer returns wishlist/grail/sold rows as owned |
| Empty state | Unchanged — no modifications to search empty states |
| Error state | Unchanged — no modifications to error surfaces |
| Destructive confirmation | None — this phase has no destructive actions |

Primary CTA for this phase: none — bug fixes are not feature flows.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | button.tsx, badge.tsx (reference patterns only — no new installs) | not required |
| Third-party | none | not applicable |

No new registry installs. The chip primitive is hand-authored in `src/components/ui/chip.tsx` following the existing `badge.tsx` CVA pattern. No `npx shadcn add` commands needed.

---

## Implementation Scope (for planner reference)

This section summarizes which files the chip primitive design contract touches. It is not a task plan — it is the visual scope boundary.

| File | Change Type | Design Contract Impact |
|------|-------------|----------------------|
| `src/components/ui/chip.tsx` | NEW — create | Full chip primitive per this spec |
| `src/components/search/BrandChips.tsx` | REFACTOR | Replace ad-hoc classNames with `<Chip variant="toggle" selected={...}>` |
| `src/components/search/EraChips.tsx` | REFACTOR | Same |
| `src/components/search/GenreChips.tsx` | REFACTOR | Same |
| `src/components/search/ArchetypeChips.tsx` | REFACTOR | Same |
| `src/components/search/MovementChips.tsx` | REFACTOR | Same |
| `src/components/search/CaseSizeChips.tsx` | REFACTOR | Same |
| `src/components/search/StyleChips.tsx` | REFACTOR | Same (multi-select: caller computes `selected` boolean per chip) |
| `src/components/search/SearchPageClient.tsx` | REFACTOR | Replace both chip block instances (lines ~410-454 and ~491-537) with `<Chip variant="removable">` |
| `src/app/catalog/[catalogId]/page.tsx` | BUG FIX | No visual change — query filter only |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
