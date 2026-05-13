---
phase: 39b
slug: audit-driven-discovery-polish-heavier-ux
status: draft
shadcn_initialized: true
preset: base-nova (existing project preset)
created: 2026-05-13
reviewed_at: —
---

# Phase 39b — UI Design Contract

> Visual and interaction contract for Phase 39b (Audit-Driven Discovery Polish — Heavier UX).
> Phase 39b introduces 4 closures: NSV-06+20 ReferenceIdentityCard, NSV-14 sub-cluster
> (LockedTabCard CTAs / WornCalendar day-detail panel / StatsTabContent Link wraps),
> NSV-18 catalog other-owners roster, and NSV-02+16 inline lineage rails.
> All token and system defaults carry forward from the Phase 39 UI-SPEC (sibling phase, status: approved).
> This spec resolves all Claude's Discretion items declared in 39b-CONTEXT.md §"Claude's Discretion".

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn |
| Preset | `base-nova` (existing — `components.json` confirmed) |
| Component library | shadcn primitives + `@base-ui/react` (Button uses base-ui Button primitive) |
| Icon library | `lucide-react` |
| Font | Sans: IBM Plex Sans (`--font-sans`); Mono: Geist Mono (`--font-geist-mono`) |

**Source:** Phase 39 UI-SPEC (approved 2026-05-12) — design system unchanged.

**Detected in repo (do not re-spec):**
- `components.json` at repo root — `style: base-nova`, `baseColor: neutral`, `cssVariables: true`
- Existing UI primitives in `src/components/ui/`: `card.tsx`, `button.tsx`, `badge.tsx`, plus 14+ other primitives
- Existing CSS tokens in `src/app/globals.css` (oklch palette, light + dark + system preference variants)

---

## Spacing Scale

Inherited from Phase 39 UI-SPEC and existing project tokens. Phase 39b introduces zero new spacing tokens.

| Token | Value | Tailwind | Usage in Phase 39b |
|-------|-------|----------|--------------------|
| xs | 4px | `p-1`, `gap-1` | Lineage chip gap; motif chip gap in ReferenceIdentityCard |
| sm | 8px | `p-2`, `gap-2` | WornList Link wrap interior padding; scale bar label gap |
| md | 16px | `p-4`, `gap-4` | Card interior padding (ReferenceIdentityCard, wear-detail panel) |
| lg | 24px | `p-6`, `gap-6` | Rail section gap |
| xl | 32px | `gap-8`, `space-y-8` | Page-level section gap (inherited from parent layouts) |

**Rail horizontal scroll container:** `gap-3 md:gap-4` — mirrors `TrendingWatches.tsx:39` exactly.

**Exceptions:** none for Phase 39b. All values are multiples of 4 and inherit from project defaults.

---

## Typography

Inherited from project tokens and Phase 39 UI-SPEC. Phase 39b introduces zero new type scales.

| Role | Size | Weight | Line Height | Tailwind | Usage in Phase 39b |
|------|------|--------|-------------|----------|--------------------|
| Rail header | 20px | 600 (semibold) | 1.25 (`leading-tight`) | `text-xl font-semibold leading-tight` | "Same family" / "Lineage" rail headers — mirrors `TrendingWatches.tsx:28` |
| Card title / section heading | 16px | 500 (medium) | 1.25 | `text-base font-medium` | ReferenceIdentityCard headline row; WornCalendar panel date heading |
| Body / list label | 14px | 400 (regular) | 1.25 (`leading-snug`) | `text-sm` | DiscoveryWatchCard brand/model; wear-detail watch name; WornList Link label |
| Muted body / sublabel | 14px | 400 | 1.25 | `text-sm text-muted-foreground` | ReferenceIdentityCard subtitle ("Inferred taste signature"); LockedTabCard caption; roster count label; scale bar dimension labels; empty-day caption; lineage chip text |
| Badge / chip text | 12px | 500 (medium) | n/a | `text-xs font-medium` | Badge `outline` variant (design motifs, relationship chips) — matches `badge.tsx` defaults |
| Calendar day number | 10px | 400 | n/a | `text-[10px]` | WornCalendar day-number cell — matches existing `WornCalendar.tsx:157` |

**Font families in use:** `--font-sans` (IBM Plex Sans) at weights 400 + 500 + 600. Phase 39b may use 600 only for rail section headers (mirrors TrendingWatches pattern); do NOT introduce 600 elsewhere.

---

## Color

The 60/30/10 split is inherited from existing tokens. Phase 39b introduces zero new color tokens.

| Role | Value (light) | Value (dark) | Tailwind | Usage in Phase 39b |
|------|---------------|--------------|----------|--------------------|
| Dominant (60%) | `oklch(0.985 0.003 75)` background, `oklch(1 0 0)` card | `oklch(0.14 0.005 75)` background, `oklch(0.19 0.005 75)` card | `bg-background`, `bg-card` | Page background; ReferenceIdentityCard surface; wear-detail panel surface |
| Secondary (30%) | `oklch(0.95 0.005 75)` muted | `oklch(0.24 0.005 75)` muted | `bg-muted`, `text-muted-foreground` | Scale bar track fill; inactive day cells; caption text throughout; hover surface on chip row |
| Accent (10%) | `oklch(0.76 0.12 75)` (warm amber) | `oklch(0.78 0.13 75)` | `bg-accent`, `text-accent`, `ring-accent` | **Listed below — reserved uses only** |
| Destructive | `oklch(0.55 0.22 27)` light / `oklch(0.65 0.2 27)` dark | — | `text-destructive`, `bg-destructive/10` | **Not used in Phase 39b** (no destructive actions) |

**Accent reserved for (Phase 39b):**
- `ring-1 ring-accent` on WornCalendar today-cell (existing, preserved)
- `bg-accent` badge overflow-count dot on WornCalendar (existing, preserved)
- `text-accent` icon tint (e.g., `Flame` icon in rail headers — follow TrendingWatches pattern if icons are added to rail headers; no new accent-icon uses mandated by 39b)
- WornList Link wrap hover: `hover:bg-accent` (matches Phase 39 D-07 verbatim link-wrap hover pattern — see Component Inventory)

**NOT accent-eligible in Phase 39b:**
- ReferenceIdentityCard scale bars: use `bg-foreground/70` (filled) + `bg-muted` (track) — see Scale Visual specification below
- NSV-18 roster chip row: use `bg-muted/40` hover (matches PopularCollectorRow.tsx:41 `hover:bg-muted/40`)
- FollowButton inside LockedTabCard: inherits its own button variant colors unchanged
- Scale bar dimension labels: use `text-muted-foreground` only

---

## Component Inventory

### New Components

| Component | Path | Scope |
|-----------|------|-------|
| `ReferenceIdentityCard` | `src/components/insights/ReferenceIdentityCard.tsx` | NSV-06+20: renders 6 CAT-13 taste fields; pure server component; no engine imports |

### Patched Components

| Component | Path | Change |
|-----------|------|--------|
| `LockedTabCard` | `src/components/profile/LockedTabCard.tsx` | Add inline FollowButton + caption (NSV-14 sub-cell #1) |
| `WornCalendar` | `src/components/profile/WornCalendar.tsx` | Add `selectedDate` state + below-grid wear-detail panel (NSV-14 sub-cell #2) |
| `StatsTabContent` | `src/components/profile/StatsTabContent.tsx:50-86` | Wrap each `<li>` in `WornList` with `<Link>` (NSV-14 sub-cell #3) |

### New Sections (inline, no new component files)

| Section | Surface | Scope |
|---------|---------|-------|
| Other-owners roster | `src/app/catalog/[catalogId]/page.tsx` | NSV-18: horizontal chip row of top 5 collectors |
| Same-family rail | `/watch/{id}` + `/catalog/{id}` | NSV-02+16 |
| Lineage rail | `/watch/{id}` + `/catalog/{id}` | NSV-02+16 |

### Reused Unchanged

| Component | Reuse site | Notes |
|-----------|------------|-------|
| `DiscoveryWatchCard` | Lineage rails | Same `w-44 md:w-52` card shape; pass `sublabel` as relationship chip or collector count |
| `Badge` (variant `outline`) | Design motifs chip cluster; relationship chips | `border-border text-foreground` — no custom classes needed |
| `FollowButton` | LockedTabCard | `variant="inline"` per D-39b-12; same as PopularCollectorRow |
| `AvatarDisplay` | NSV-18 chip row | Reuse from `src/components/profile/AvatarDisplay.tsx` |
| `Card`, `CardHeader`, `CardTitle`, `CardContent` | ReferenceIdentityCard | Default size (matches CollectionFitCard.tsx shape) |

---

## ReferenceIdentityCard — Design Specification

### Scale Visual Decision (Claude's Discretion resolved)

**Chosen treatment: horizontal filled bar with dimension label.**

Rationale for horizontal bar over alternatives:
- **Sparkline-pill** (pill shape with fill): requires custom CSS for the inner fill + tick marks at 0/0.5/1; tick marks on a tiny pill are illegible at small sizes; three pills side-by-side on mobile creates a cramped row that doesn't communicate relative proportion clearly.
- **Concentric dot** (filled circles at position 0-1): invents a novel metaphor with no codebase precedent; requires SVG or custom positioning; radial encoding of a linear scale introduces perceptual distortion.
- **Horizontal bar**: already established in the project (`HorizontalBarChart.tsx`); linear encoding matches linear data; left/right tick labels ("Low" / "High") are legible at `text-xs`; three bars stack vertically in a `space-y-2` column with minimal height; no custom SVG or CSS needed.

**Scale bar anatomy (one bar):**

```
Formality      [████████░░░░░░░░░]   Low      High
               ← bar track (bg-muted) →
               ← bar fill (bg-foreground/70) proportional to 0–1 value →
```

Implementation:
```tsx
// Dimension label + bar track + tick labels, all inline Tailwind
<div className="flex flex-col gap-0.5">
  <span className="text-xs text-muted-foreground">{dimensionLabel}</span>
  <div className="relative h-1.5 rounded-full bg-muted overflow-hidden">
    <div
      className="absolute inset-y-0 left-0 rounded-full bg-foreground/70"
      style={{ width: `${Math.round(value * 100)}%` }}
    />
  </div>
  <div className="flex justify-between text-[10px] text-muted-foreground/60">
    <span>Low</span>
    <span>High</span>
  </div>
</div>
```

Bar height: `h-1.5` (6px — thin but readable; matches existing Progress-like patterns in shadcn).

Three bars stacked in `<div className="space-y-2">` within CardContent.

**Dimension display labels:**
- `formality` → "Formality"
- `sportiness` → "Sportiness"
- `heritageScore` → "Heritage"

**Suppression rule:** If a numeric scale field is `null`, omit that individual bar (do not render `width: 0%`). If ALL THREE scale fields are null, omit the entire scale section.

### Card Layout

```
┌─────────────────────────────────────────────────┐
│  Inferred taste signature          (muted, sm)   │  ← CardHeader subtitle
│                                                   │
│  {era display label}  ·  {archetype display}     │  ← headline row, text-base font-medium
│                                                   │
│  Formality                                        │  ← scale section (only when ≥1 scale present)
│  [████████░░░░░░░░░]                              │
│  Low                   High                       │
│                                                   │
│  Sportiness                                       │
│  [████░░░░░░░░░░░░░]                              │
│  Low                   High                       │
│                                                   │
│  Heritage                                         │
│  [██████████████░░░]                              │
│  Low                   High                       │
│                                                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐           │  ← motifs (Badge variant="outline", flex-wrap)
│  │ bauhaus  │ │gilt-dial │ │ domed…   │           │
│  └──────────┘ └──────────┘ └──────────┘           │
└─────────────────────────────────────────────────┘
```

**CardHeader:** renders the muted subtitle "Inferred taste signature" via `CardDescription` (not `CardTitle`). No explicit "Collection Fit" heading — this card has no judgment framing.

**Headline row:** `<p className="text-base font-medium text-foreground">` containing era display label + `·` separator + archetype display label, on one line (truncate-safe on narrow viewports: each segment in a `<span className="truncate">`).

**Era display labels** (from `EraSignal` closed vocab → human-readable):
- `'vintage-leaning'` → "Vintage-leaning"
- `'modern'` → "Modern era"
- `'contemporary'` → "Contemporary"

**Archetype display labels** (from `PrimaryArchetype` closed vocab → human-readable, title case):
- `'dress'` → "Dress"
- `'dive'` → "Dive"
- `'field'` → "Field"
- `'pilot'` → "Pilot"
- `'chrono'` → "Chronograph"
- `'gmt'` → "GMT"
- `'racing'` → "Racing"
- `'sport'` → "Sport"
- `'tool'` → "Tool"
- `'hybrid'` → "Hybrid"

If either `eraSignal` or `primaryArchetype` is null, omit that segment. If BOTH are null, omit the headline row entirely.

**Design motifs cluster:** `<div className="flex flex-wrap gap-1">` with `<Badge variant="outline">` for each motif string. Motif strings from vocab display as-is (lowercase hyphenated — `bauhaus`, `gilt-dial`). If `designMotifs` is empty array, omit the cluster section.

**Fallback (confidence < 0.5 or catalogTaste null):** render only the 3-CTA block (Add to Wishlist / Add to Collection / Skip). Include a one-line caption: `"Add a few watches to see how this one fits your collection."` in `text-sm text-muted-foreground` above the CTAs.

**Server component constraint:** `ReferenceIdentityCard` is a pure-renderer server component (no `'use client'`). Zero engine imports. No imports from `@/lib/similarity` or `@/lib/verdict/composer`. This matches the `CollectionFitCard.tsx` import-boundary pattern (enforced by `tests/static/CollectionFitCard.no-engine.test.ts`; planner should add `tests/static/ReferenceIdentityCard.no-engine.test.ts` analog per established pattern).

---

## Render Order — /watch/{id} and /catalog/{id}

Phase 39b changes the fresh-account and populated-viewer render order on both surfaces. The executor MUST follow this exact layout on both pages.

### /watch/{id} render order (full page body, below watch image/header)

```
1. CollectionFitCard                (owner-populated viewer — unchanged)
   ReferenceIdentityCard            (fresh-account viewer, confidence ≥ 0.5 — NEW NSV-06)
   [Fallback caption + CTAs only]   (fresh-account viewer, confidence < 0.5 — NEW NSV-06)

2. Same family rail                 (if family_id present + siblings exist — NEW NSV-02)

3. Lineage rail                     (if lineage edges exist — NEW NSV-02)

4. CTA block (Add to Wishlist / Add to Collection / Skip)   (fresh-account viewer — below card)
```

Owner-populated viewer sees: CollectionFitCard → Same family rail → Lineage rail. No CTAs (they already own/wishlist/have-collection context).
Fresh-account viewer sees: ReferenceIdentityCard (or fallback caption) → Same family rail → Lineage rail → CTA block.

### /catalog/{id} render order (full page body, below catalog image/header)

```
1. CollectionFitCard                (owner-populated viewer — unchanged)
   ReferenceIdentityCard            (fresh-account viewer, confidence ≥ 0.5 — NEW NSV-20)
   [Fallback caption + CTAs only]   (fresh-account viewer, confidence < 0.5 — NEW NSV-20)

2. Other-owners roster              (if total owners > 0 — NEW NSV-18)

3. Same family rail                 (if family_id present + siblings exist — NEW NSV-16)

4. Lineage rail                     (if lineage edges exist — NEW NSV-16)

5. CTA block (Add to Wishlist / Add to Collection / Skip)   (fresh-account viewer — always last)
```

Note: `/catalog/{id}` gains the other-owners roster in the #2 position (between the verdict card and the family rail) because it is catalog-specific. `/watch/{id}` does NOT get the other-owners roster (per D-39b scope: catalog only).

---

## NSV-14 Sub-Cluster — Visual Specifications

### Sub-cell #1: LockedTabCard — inline FollowButton + caption

**Layout (D-39b-12 lock):**

```
┌────────────────────────────────────────────────────┐
│                        🔒                           │  ← Lock icon (existing, unchanged)
│   {name} keeps their {label} private.               │  ← existing muted copy (unchanged)
│                                                     │
│   [  Follow @{username}  ]  ← FollowButton         │  ← new: variant="inline", logged-in path
│   Follow @{username} to see their {label}.          │  ← new: muted caption
└────────────────────────────────────────────────────┘
```

**Logged-in unauthenticated-NOT-following path:** `FollowButton` with `variant="inline"`. Caption renders BELOW the button in `text-sm text-muted-foreground`: `"Follow @{username} to see their {label}."` (period included). Trailing `{label}` inherits from `TAB_LABELS` map — `collection / wishlist / worn history / notes / stats`.

**Unauthenticated viewer path:**
```tsx
<Link
  href={`/signin?returnTo=${encodeURIComponent(currentPath)}`}
  className={buttonVariants({ variant: 'outline', size: 'default' })}
>
  Sign in to follow
</Link>
```
Caption below: `"Sign in to see @{username}'s {label}."` in `text-sm text-muted-foreground`.

**Layout additions inside the existing `<section>` element:**
- Add `gap-3` to the existing `flex flex-col items-center justify-center` container
- FollowButton and caption stack below existing lock icon + private copy with `gap-2`
- No new wrapping element needed if the existing section container gains `gap-3`

### Sub-cell #2: WornCalendar — wear-detail panel

**`selectedDate` state:** `useState<string | null>(null)` where the string is a YYYY-MM-DD key. Initialize on mount to the first date in the current calendar view that has `>0` events (scan `eventsByDay` keys for the earliest date in `cursor.month` with events).

**Day-cell interactivity:** cells with `dayEvents.length > 0` gain:
```tsx
onClick={() => setSelectedDate(key)}
className={cn(
  /* existing classes */,
  dayEvents.length > 0 && 'cursor-pointer hover:bg-muted/60',
  selectedDate === key && 'ring-2 ring-foreground/20',
)}
```

Cells with zero events remain non-interactive (no `onClick`, no `cursor-pointer`).

**Wear-detail panel (renders BELOW `<div className="grid grid-cols-7 gap-1">`)**

Panel container: `<div className="mt-4 border-t pt-4">` (top separator from the grid).

Panel states:
1. `selectedDate === null` → render nothing (panel absent)
2. `selectedDate` set, `dayEvents.length === 0` → `<p className="text-sm text-muted-foreground">"No wear events on {formatted date}."</p>` (empty-day selection state per 39b-CONTEXT.md §Specifics)
3. `selectedDate` set, `dayEvents.length > 0` → render all events for the day

**Per-event content density (Claude's Discretion resolved):** render exactly these fields per event, no more:

```tsx
<div className="flex items-start gap-3">
  {/* Watch image: 48×48 rounded bg-muted, Image fill object-cover */}
  <div className="relative size-12 shrink-0 overflow-hidden rounded bg-muted">
    {safe && <Image src={safe} alt="" fill sizes="48px" className="object-cover" />}
  </div>
  <div className="flex-1 min-w-0">
    <p className="text-sm font-medium text-foreground truncate">{watch.brand} {watch.model}</p>
    {/* Notes: only render if present and non-empty */}
    {event.notes && (
      <p className="mt-0.5 text-sm text-muted-foreground">{event.notes}</p>
    )}
  </div>
</div>
```

Multiple events for the same day stack with `space-y-3`.

Panel heading: `<p className="text-sm font-semibold text-foreground mb-3">{formattedDate}</p>` where `formattedDate` is `new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(...)`.

**Deferred:** wear-time, photos. Image + brand + model + notes is the full content density for Phase 39b.

### Sub-cell #3: StatsTabContent — WornList Link wraps

**Pattern (mirrors NSV-01+15 / Phase 39 D-07 lock):**

```tsx
<li key={watch.id}>
  <Link
    href={`/watch/${watch.id}`}
    className="flex items-center gap-3 rounded-md p-1 hover:bg-accent"
  >
    {/* existing image + name + count markup, unchanged */}
  </Link>
</li>
```

`className` uses `hover:bg-accent` (matching Phase 39 link-wrap pattern). `p-1` inner padding (matching D-07 xs token).

**Constraint:** Only the `WornList` `<li>` rows receive Link wraps (Most Worn + Least Worn sections). `HorizontalBarChart` bars in Style Distribution + Role Distribution are NOT wrapped — they aggregate over multiple watches (D-39b-14 lock).

---

## NSV-18 — Other-Owners Roster — Visual Specification

### Chip styling (Claude's Discretion resolved)

**Layout:** Horizontal chip row. Each chip is a full-row link, not a pill-only button — reuse the `PopularCollectorRow.tsx` pattern but in a compact horizontal card layout rather than vertical rows.

**Chip anatomy (per collector):**

```tsx
<div className="group relative flex flex-col items-center gap-1.5 w-16 shrink-0">
  <Link
    href={`/u/${collector.username}/collection`}
    aria-label={`${name}'s collection`}
    className="absolute inset-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  />
  <AvatarDisplay
    avatarUrl={collector.avatarUrl}
    displayName={collector.displayName}
    username={collector.username}
    size={36}
  />
  <p className="text-[10px] text-muted-foreground truncate w-full text-center">
    @{collector.username}
  </p>
</div>
```

Chip width: `w-16` (64px). Avatar size: 36px. Username: `text-[10px]` truncated, centered.

**Chip row container:**

```tsx
<div className="flex gap-3 overflow-x-auto scroll-smooth pb-1">
  {collectors.map(...)}
</div>
```

No `snap-x` needed (chips are small enough that natural scroll is sufficient).

**Section anatomy:**

```tsx
<section className="space-y-2">
  {/* Count label — only when total > 5 */}
  {totalCount > 5 && (
    <p className="text-sm text-muted-foreground">{totalCount} collectors own this</p>
  )}
  {/* Chip row */}
  <div className="flex gap-3 overflow-x-auto scroll-smooth pb-1">
    {/* chips */}
  </div>
</section>
```

**Hover/focus:** Each chip's absolute-inset `<Link>` provides keyboard focus ring (`focus-visible:ring-2 ring-ring`). No hover background on individual chips needed (the absolute inset approach matches PopularCollectorRow without per-chip hover styling).

**Hide-if-empty:** Section entirely absent when `totalCount === 0` (D-39b-07 / D-39b-09 lock).

**Count label:** rendered above the chip row when `totalCount > 5`; suppressed when `totalCount <= 5`. Copy verbatim: `"{N} collectors own this"`.

---

## NSV-02+16 — Inline Lineage Rails — Visual Specification

### Rail layout

Both "Same family" and "Lineage" rails follow the `TrendingWatches.tsx` horizontal-scroll pattern exactly.

**Section container (per rail):**

```tsx
<section className="space-y-4">
  <header className="flex items-center justify-between">
    <h2 className="text-xl font-semibold leading-tight text-foreground">
      {railHeader}  {/* "Same family" or "Lineage" */}
    </h2>
    {/* "See all in family" link — HIDDEN in 39b (D-39b-17) */}
    {/* Render nothing on the right side for Lineage rail */}
  </header>
  <div className="flex gap-3 md:gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2">
    {cards.map((card) => (
      <div key={card.id} className="snap-start">
        <DiscoveryWatchCard
          watch={{ id: card.id, brand: card.brand, model: card.model, imageUrl: card.imageUrl }}
          sublabel={sublabel}  {/* see below */}
        />
      </div>
    ))}
  </div>
</section>
```

**"See all in family" link:** Rendered as a visually hidden / disabled element in 39b — NOT present in the DOM. Per D-39b-17, the link target `/catalog?family={id}` is deferred to v5.x. Executor should leave a code comment `{/* TODO v5.x: "See all in family" link → /catalog?family={familyId} */}` in the header area.

### Sublabel prop for DiscoveryWatchCard

**Same family rail:** `sublabel` = `"{N} collector{s}"` (owner count from the aggregation query). Example: `"1 collector"` or `"14 collectors"`.

**Lineage rail:** `sublabel` = `<Badge variant="outline">{relationshipLabel}</Badge>` where `relationshipLabel` maps per D-39b-16:

| `relationship_type` | Display label |
|---------------------|---------------|
| `predecessor` | "Predecessor" |
| `successor` | "Successor" |
| `remake` | "Modern remake" |
| `tribute` | "Tribute to" |
| `homage` | "Homage to" |

The `sublabel` prop on `DiscoveryWatchCard` accepts `ReactNode` (existing type signature), so passing a `<Badge>` component is valid.

### Hide-if-empty

Both rails: if the query returns 0 rows, return `null` from the rail server component (module absent — no empty state). Matches D-39b-07.

### Card dimensions

Unchanged from `DiscoveryWatchCard.tsx`: `w-44 md:w-52` — fits 5+ on desktop scroll strip.

---

## Copywriting Contract

All copy strings below are LOAD-BEARING — execution must use these verbatim. Variable interpolation in `{}`. Punctuation and trailing characters are load-bearing.

### NSV-06+20 — ReferenceIdentityCard

| Element | Copy | Notes |
|---------|------|-------|
| Card subtitle (confidence ≥ 0.5) | `Inferred taste signature` | Renders as `CardDescription` in muted style. No colon. Sentence case. |
| Fallback caption (confidence < 0.5 or null) | `Add a few watches to see how this one fits your collection.` | `text-sm text-muted-foreground`. Period included. No exclamation mark. |

### NSV-18 — Other-Owners Roster

| Element | Copy | Notes |
|---------|------|-------|
| Count label (total > 5) | `{N} collectors own this` | `text-sm text-muted-foreground`. No period. `{N}` = integer total (not capped at 5). |

### NSV-14 — LockedTabCard

| Element | Copy | Notes |
|---------|------|-------|
| FollowButton caption (logged-in, not following) | `Follow @{username} to see their {label}.` | `text-sm text-muted-foreground`. Period included. `{username}` = `@`-prefixed handle. `{label}` from `TAB_LABELS` map. |
| Sign-in button (unauthenticated) | `Sign in to follow` | Button label. No arrow. |
| Sign-in button caption (unauthenticated) | `Sign in to see @{username}'s {label}.` | `text-sm text-muted-foreground`. Period included. Straight apostrophe for ESLint compliance. |

### NSV-14 — WornCalendar wear-detail panel

| Element | Copy | Notes |
|---------|------|-------|
| Empty-day selection caption | `No wear events on {date}.` | `text-sm text-muted-foreground`. Period included. `{date}` = formatted date string (e.g., "Wed, May 13"). No "Sorry" or apologetic framing. |

### NSV-02+16 — Lineage Rails

| Element | Copy | Notes |
|---------|------|-------|
| Same family rail header | `Same family` | Title case, two words. No icon mandated (executor may add a family icon from lucide-react if one is semantically appropriate — not mandated). |
| Lineage rail header | `Lineage` | Single word. No icon mandated. |
| Deferred "See all" comment | `{/* TODO v5.x: "See all in family" link → /catalog?family={familyId} */}` | Code comment only, no rendered text. |

### General copywriting rules (Project-wide defaults applied to Phase 39b)

| Rule | Contract |
|------|----------|
| Primary CTA verb pattern | "Follow @{username}" / "Sign in to follow" (action + object) |
| Empty state heading style | Sentence-case, period included, no exclamation marks |
| Empty state body style | One sentence: state the situation + optional next step |
| Tone gate | No "Sorry", "Oops", "unavailable", "error" in any copy in this phase |
| Confidence numeric % | NEVER display numeric confidence %. "Inferred taste signature" only (D-39b-02 lock). |
| Destructive confirmation | Not applicable — no destructive actions in Phase 39b |

---

## Interaction & A11y Contract

### Keyboard navigation

| Element | Expected behavior |
|---------|-------------------|
| ReferenceIdentityCard | Pure display — no interactive elements inside the card itself. CTAs below are standard Links. |
| WornCalendar day-cells (events > 0) | `button` semantic OR `onClick` on `<div>` with `role="button" tabIndex={0}` + `onKeyDown` (Enter/Space → `setSelectedDate`). Executor chooses: wrapping in `<button>` is cleaner but requires careful layout adjustment vs the existing grid. Preferred: wrap the day `<div>` content in a `<button type="button">` when `dayEvents.length > 0`, else keep as `<div>`. |
| WornList Link wraps | Each `<Link>` receives Tab focus; Enter activates. Focus ring inherited from project default. |
| NSV-18 chip row Link | Each chip's absolute-inset `<Link>` is keyboard-reachable. Focus ring: `focus-visible:ring-2 focus-visible:ring-ring` (matches PopularCollectorRow). |
| Lineage rail cards | DiscoveryWatchCard already wraps the entire card in `<Link>` with `focus-visible:ring-2 focus-visible:ring-ring` — no change needed. |

### Screen-reader contract

| Element | Constraint |
|---------|-----------|
| ReferenceIdentityCard scale bars | Add `aria-label="{dimensionLabel}: {Math.round(value * 100)} out of 100"` to each bar `<div>`. The visual-only percentage context must be exposed to assistive technology. |
| Design motif badges | Each `<Badge>` element has implicit text content = the motif string. No additional `aria-label` needed. |
| NSV-18 chip row | Each avatar Link has `aria-label="{name}'s collection"` (absolute-inset link, matches PopularCollectorRow pattern). |
| DiscoveryWatchCard in lineage rails | Existing `aria-label={"{brand} {model} — view details"}` unchanged. The `sublabel` (relationship badge text) is NOT included in the aria-label — it's secondary metadata that sighted users read below the identity. |
| WornCalendar interactive day-cells | `aria-label="View wear events for {date}"` on the button element. |

### Pointer / hover

| Element | Hover state |
|---------|-------------|
| WornList Link wraps | `hover:bg-accent` (D-07 pattern lock — consistent with Phase 39 NSV-01+15) |
| NSV-18 roster chip row | No per-chip hover (absolute-inset link handles the click surface; chips are static display) |
| Lineage DiscoveryWatchCard | Existing `focus-visible:ring-2 ring-ring` focus ring unchanged; no hover bg needed (card is already full-surface Link) |
| WornCalendar day-cell (events > 0) | `hover:bg-muted/60` on the cell container + `cursor-pointer` |
| WornCalendar day-cell selected | `ring-2 ring-foreground/20` |

### Touch / mobile

- All Phase 39b affordances render on existing pages. No new breakpoints.
- Rail horizontal scroll: `overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2` (matches TrendingWatches).
- NSV-18 chip row: `overflow-x-auto scroll-smooth pb-1` — no snap needed (chips are narrow).
- WornCalendar day-cells: touch target is the full cell (`min-h-12` = 48px minimum, already meets iOS HIG 44px).
- FollowButton inside LockedTabCard: inherits Button `size="default"` (`h-8` = 32px). Accept this baseline — matches Phase 39 CTA tap-target precedent.

### Server vs Client component constraints

| Component | Directive | Reason |
|-----------|-----------|--------|
| `ReferenceIdentityCard` | No `'use client'` — Server Component | Pure renderer; no state or hooks. Import-boundary: NO engine imports. |
| `WornCalendar` | `'use client'` already set | `selectedDate` state addition does not change this; already client-side. |
| `LockedTabCard` | No `'use client'` currently; **evaluate at patch time** | `FollowButton` with `variant="inline"` is a client component (handles follow mutation); `LockedTabCard` must either become `'use client'` or the FollowButton must be imported as a client boundary. Follow the same resolution pattern as `PopularCollectorRow.tsx` — it is a server component that imports `FollowButton` (a client component) without marking itself `'use client'`. Next.js allows importing client components from server components; only the client component itself is hydrated. No change to LockedTabCard's server/client status unless the FollowButton import triggers a serialization error at build time — executor verifies. |
| `StatsTabContent` | No `'use client'` currently | `Link` wraps are server-renderable; no change. |
| Other-owners roster section | No `'use client'` — Server Component | Aggregation query result; pure HTML output. |
| Lineage rails | No `'use client'` — Server Component | Read-only data display. |

---

## Test Coverage Contract

| Concern | Test type | Location |
|---------|-----------|----------|
| ReferenceIdentityCard import-boundary guard | Static guard | `tests/static/ReferenceIdentityCard.no-engine.test.ts` — new file, mirrors `CollectionFitCard.no-engine.test.ts`. Assert no imports from `@/lib/similarity` or `@/lib/verdict/composer`. |
| WornCalendar: selectedDate initializes to first-event-day | Unit/component | Extend or add `WornCalendar.test.tsx` |
| WornCalendar: empty-day selection renders caption copy | Unit/component | Same file |
| NSV-18 roster: hides when total === 0 | Integration or component | Planner discretion |
| Lineage rails: hide when 0 rows (module-absent) | Integration | Planner discretion |
| LockedTabCard: renders FollowButton for logged-in not-following | Component | Planner discretion |
| LockedTabCard: renders sign-in link for unauthenticated | Component | Planner discretion |

The static import-boundary guard for `ReferenceIdentityCard` is MANDATED (not discretionary) per the established `CollectionFitCard.no-engine.test.ts` pattern and Claude's Discretion resolution in 39b-CONTEXT.md.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official (`base-nova` preset) | `card`, `button`, `badge`, `avatar`-via-AvatarDisplay (all pre-existing in `src/components/ui/`) | not required — already in repo at HEAD; no new `npx shadcn add` calls in Phase 39b |
| Third-party registries | none | not applicable |

Phase 39b introduces ZERO new registry installs. The plan executor MUST NOT run `npx shadcn add ...` for any component.

---

## Out-of-Scope Visual Concerns (do NOT touch in Phase 39b)

These exist in the broader code surface but Phase 39b explicitly avoids them:

- **CollectionFitCard** — unchanged. Phase 39b adds a new SIBLING component (`ReferenceIdentityCard`), not a variant of CollectionFitCard.
- **`/explore` page** — Phase 39b adds lineage rails to `/watch/{id}` and `/catalog/{id}`, NOT to `/explore`. Explore redesign is v5.1 (SEED-008).
- **`/family/{familyId}` page** — deferred. "See all in family" link disabled in 39b.
- **WornCalendar month-navigation buttons** — unchanged. Phase 39b only adds day-cell onClick + below-grid panel.
- **ProfileWatchCard** (inside collection/wishlist tabs) — unchanged by Phase 39b.
- **HorizontalBarChart** in StatsTabContent — unchanged. Phase 39b wraps only WornList `<li>` rows.
- **CommonGroundTabContent** — Phase 39 closed NSV-12; Phase 39b does NOT touch the common-ground branch.
- **Color palette, font, spacing tokens** — zero new tokens in Phase 39b. Any new token = scope drift.
- **Numeric confidence display** — NEVER display `confidence` as a percentage or number in UI (D-39b-02 lock).

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
