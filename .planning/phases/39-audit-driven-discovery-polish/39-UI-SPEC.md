---
phase: 39
slug: audit-driven-discovery-polish
status: draft
shadcn_initialized: true
preset: base-nova (existing project preset)
created: 2026-05-12
---

# Phase 39 — UI Design Contract

> Visual and interaction contract for Phase 39 (Audit-Driven Discovery Polish — Cheap Patches). Phase 39 is a 3-item mechanical patch phase with all decisions pre-locked in `39-CONTEXT.md` (D-07..D-10). The UI-SPEC's job is to nail down the link-wrap className, fallback Card layout, copy verbatim, and a11y / tone constraints — no new components, no new tokens.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn |
| Preset | `base-nova` (existing — `components.json` confirmed) |
| Component library | shadcn primitives + `@base-ui/react` (Button uses base-ui Button primitive) |
| Icon library | `lucide-react` |
| Font | Sans: IBM Plex Sans (`--font-sans`); Mono: Geist Mono (`--font-geist-mono`); Serif: Instrument Serif (`--font-serif`, used as `--font-heading` is currently aliased to sans) |

**Detected in repo (do not re-spec):**
- `components.json` at repo root — `style: base-nova`, `baseColor: neutral`, `cssVariables: true`
- Existing UI primitives in `src/components/ui/`: `card.tsx`, `button.tsx`, `badge.tsx`, plus 14 other primitives
- Existing CSS tokens in `src/app/globals.css` (oklch palette, light + dark + system preference variants)

---

## Spacing Scale

Declared values (must be multiples of 4). Tailwind 4 utilities map 1 unit = 4px.

| Token | Value | Tailwind | Usage |
|-------|-------|----------|-------|
| xs | 4px | `p-1`, `gap-1` | NSV-01+15 Link wrap interior padding (D-07 lock) |
| sm | 8px | `p-2`, `gap-2` | InsightsTabContent existing Link padding (Phase 39 inherits) |
| md | 16px | `p-4`, `gap-4`, `space-y-4` | Card interior padding, CTA group gap on fallback Card |
| lg | 24px | `p-6`, `space-y-6` | Card body padding for the NSV-12 fallback Card |
| xl | 32px | `space-y-8` | Tab content top-level section gap (inherited from `CommonGroundTabContent`) |

**Exceptions:** none for Phase 39. All values inherit from existing Tailwind / shadcn defaults — Phase 39 ships no new spacing tokens.

---

## Typography

Inherited from the project's existing tokens — Phase 39 introduces zero new type scales.

| Role | Size | Weight | Line Height | Tailwind | Usage |
|------|------|--------|-------------|----------|-------|
| Body | 14px | 400 (regular) | 1.25 (`leading-snug`) | `text-sm` | NSV-01+15 mostSimilar row labels (existing), NSV-12 fallback Card body copy |
| Label / muted body | 14px | 400 | 1.25 | `text-sm text-muted-foreground` | NSV-12 fallback body sentence ("…try one of these:"), NSV-01+15 score suffix |
| CTA / button | 14px | 500 (medium) | snug | `text-sm font-medium` (Button default) | NSV-12 fallback CTAs |
| Heading (CardTitle) | 16px | 500 (medium) | snug | `font-heading text-base font-medium` (CardTitle primitive) | NSV-12 fallback Card title ("No shared watches yet.") |

**Font families in use:**
- `--font-sans` → IBM Plex Sans 400 / 500 / 600 / 700 (loaded in `src/app/layout.tsx`)
- Phase 39 uses only 400 + 500 weights. Do NOT introduce 600 / 700 for this phase.

**Project line-height conventions:**
- Body: `leading-snug` (1.25) — established via CardTitle and existing prose
- No new line-height declarations in Phase 39

---

## Color

The 60/30/10 split is inherited from existing tokens (oklch values in `src/app/globals.css`). Phase 39 introduces no new color tokens.

| Role | Value (light) | Value (dark) | Tailwind | Usage |
|------|---------------|--------------|----------|-------|
| Dominant (60%) | `oklch(0.985 0.003 75)` background, `oklch(1 0 0)` card | `oklch(0.14 0.005 75)` background, `oklch(0.19 0.005 75)` card | `bg-background`, `bg-card` | Page background; NSV-12 fallback Card surface |
| Secondary (30%) | `oklch(0.96 0.005 75)` secondary, `oklch(0.95 0.005 75)` muted | `oklch(0.26 0.005 75)` secondary, `oklch(0.24 0.005 75)` muted | `bg-secondary`, `bg-muted`, `text-muted-foreground` | Body copy on fallback Card; CTA hover surface (`hover:bg-accent` — note: token name `accent` is used as the hover-surface color across the project) |
| Accent (10%) | `oklch(0.76 0.12 75)` (warm amber) | `oklch(0.78 0.13 75)` | `bg-accent`, `text-accent`, `ring-accent` | **Hover state ONLY** on NSV-01+15 Link wraps (D-07 lock: `hover:bg-accent`); same convention used by existing `SleepingBeautiesSection.tsx:45` and `GoodDealsSection.tsx:49` |
| Destructive | `oklch(0.55 0.22 27)` | `oklch(0.65 0.2 27)` | `text-destructive`, `bg-destructive/10` | **Not used in Phase 39** (no destructive actions) |

**Accent reserved for:**
- Link-wrap hover surface in mostSimilar list (D-07 verbatim: `hover:bg-accent`)
- Inherited hover surface for sibling InsightsTabContent Links (already shipped per Sleeping Beauties / Good Deals — Phase 39 may apply the same pattern if any new Link wrap ships)

**NOT accent-eligible for Phase 39:**
- Fallback Card CTAs in NSV-12 — use default `Button` variant for the primary CTA and `outline` variant for the secondary CTA (see Component Inventory). The accent color is RESERVED for hover-on-list-item affordance per project convention.

---

## Copywriting Contract

All copy strings below are LOAD-BEARING — execution must use these verbatim except where Claude's Discretion is marked.

### NSV-01 + NSV-15 — mostSimilar Link wraps

No new copy. The existing list-item text ("{watch.brand} {watch.model}" + "{N}% similar") is preserved; the only change is wrapping each row in a `<Link>` element so the row becomes clickable.

| Element | Copy |
|---------|------|
| Link target | `/watch/{watch.id}` (D-07 lock) |
| Link wrap className | `block hover:bg-accent rounded-md p-1` (D-07 lock — copy verbatim) |
| Hover affordance | Background fills with `bg-accent` on pointer hover and on `:focus-visible` (browser default for keyboard tab — DO NOT add an extra `focus:` class beyond what the project already produces for anchor elements) |
| ARIA / a11y | The `<Link>` element IS the interactive surface. Do NOT add `role="link"` or `tabIndex`. Do NOT nest `<button>` or `<a>` inside. The existing `<span>` children are non-interactive text. |

### NSV-08 — InsightsTabContent Link wraps (verify-before-patch)

Verification result (this UI-SPEC author confirmed via Read on 2026-05-12):
- `src/components/insights/SleepingBeautiesSection.tsx:42-51` — ALREADY wraps `<li>` content in `<Link href={\`/watch/${watch.id}\`} className="flex items-center justify-between rounded-md p-2 hover:bg-accent">`. Confirmed.
- `src/components/insights/GoodDealsSection.tsx:46-63` — ALREADY wraps `<li>` content in `<Link href={\`/watch/${w.id}\`} className="flex items-center gap-3 rounded-md p-2 hover:bg-accent">`. Confirmed.

**Expected planning outcome:** Plan author re-runs the D-08 grep at plan time; if the verification still holds (both wrap), the plan closes NSV-08 as "already shipped before Phase 39 began" with grep evidence in the SUMMARY. No new copy required.

**If the grep finds drift** (one or both have lost the Link wrap):
| Element | Copy |
|---------|------|
| Link target | `/watch/{watch.id}` |
| Link wrap className | `flex items-center justify-between rounded-md p-2 hover:bg-accent` (mirror SleepingBeautiesSection — established pattern) |

### NSV-12 — common-ground walk-back fallback Card

D-10 copy lock — execution MUST render these strings verbatim. Variable interpolation in `{}`. Punctuation, capitalization, and trailing arrows are all load-bearing.

| Element | Copy | Notes |
|---------|------|-------|
| Card title | `No shared watches yet.` | Period included. Sentence-case (matches CardTitle weight 500). Tone: informational, NOT apologetic. |
| Card body | `You and @{username} don't share any watches in your collections. That doesn't mean you don't share taste — try one of these:` | Use raw `@{profile.username}` (the at-prefixed handle), NOT `{displayName}` for the body sentence. Em-dash (`—`) verbatim, not double-hyphen. Curly apostrophes (`'`) — match the project convention; if the surrounding file uses straight apostrophes (`'`) for ESLint compliance, use straight apostrophes here too. |
| Primary CTA label | `Browse {displayName}'s collection →` | Uses `displayName` (the human-readable name resolved at line 65 of `page.tsx` as `profile.displayName ?? null`). If `displayName` is null, fall back to `@{profile.username}`. Arrow `→` is U+2192. |
| Primary CTA target | `/u/{profile.username}/collection` | Server-rendered `<Link href>`. |
| Secondary CTA label | `Find collectors with shared watches →` | Static — no variable interpolation. Arrow `→` is U+2192. |
| Secondary CTA target | `/explore` | D-10 lock. Per D-10, anchoring to `#popular-collectors` is allowed if the existing `/explore` page provides such an anchor; otherwise plain `/explore`. Anchor existence is a planner verification — fall back to plain `/explore` if absent. |

**Tone gate (apply during plan / executor review):**
- The page state is INFORMATIONAL, not an error. Reject any copy variant that uses: "Sorry", "Oops", "404", "not found", "error", "missing".
- The framing must be two-collector ("You and @{username}") — reject any single-actor framing.
- The walk-back CTAs are affordances, not consolations. Reject any phrasing like "instead" or "try these alternatives."

**General copywriting contract (project-wide defaults applied to Phase 39):**

| Element | Copy |
|---------|------|
| Primary CTA verb pattern | "Browse {noun}" / "Find {noun}" (action + object, no helper verbs like "Click to") |
| Empty state heading style | Sentence-case, period included, no exclamation marks |
| Empty state body style | Two-sentence pattern: (1) state the situation factually; (2) offer a next step |
| Error state | **Not applicable in Phase 39** — NSV-12 explicitly converts an error (404) into a soft fallback; no other error surfaces ship in this phase |
| Destructive confirmation | **Not applicable in Phase 39** — no destructive actions |

---

## Component Inventory

The full visual surface Phase 39 touches uses ONLY existing components. Phase 39 introduces zero new components.

### Reused from existing primitives

| Component | Source | Used by | Notes |
|-----------|--------|---------|-------|
| `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent` | `src/components/ui/card.tsx` | NSV-12 fallback | Use default `size="default"` (gives `gap-4`, `py-4`, `rounded-xl`, `ring-1 ring-foreground/10`). Do NOT use `size="sm"`. |
| `Button` (with `Link` composition via `asChild`-free wrap or `Link` styled by `buttonVariants`) | `src/components/ui/button.tsx` | NSV-12 fallback CTAs | See "Button + Link composition" pattern below. |
| `Link` from `next/link` | `next/link` | NSV-01+15 row wraps; NSV-12 CTAs | Server-rendered. Phase 20 import-boundary guard does NOT block `next/link`. |

### Button + Link composition (Phase 39 NSV-12)

`Button` from `src/components/ui/button.tsx` wraps `@base-ui/react/button` and does NOT support `asChild` (no Radix Slot pattern in this codebase). The project's established pattern for "link styled as button" is to apply `buttonVariants()` className directly to a `next/link` element. Example reference: see how existing pages compose CTAs.

**Pattern for NSV-12 CTAs:**

```tsx
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

<Link
  href={`/u/${profile.username}/collection`}
  className={buttonVariants({ variant: 'default', size: 'default' })}
>
  Browse {displayName}'s collection →
</Link>
<Link
  href="/explore"
  className={buttonVariants({ variant: 'outline', size: 'default' })}
>
  Find collectors with shared watches →
</Link>
```

| CTA | Button variant | Button size | Rationale |
|-----|----------------|-------------|-----------|
| Primary ("Browse {displayName}'s collection →") | `default` (bg-primary, foreground primary-foreground) | `default` (h-8, px-2.5) | Primary visual weight — this is the recommended walk-back affordance |
| Secondary ("Find collectors with shared watches →") | `outline` (transparent bg, border) | `default` | Alternative walk-back — secondary visual weight |

### Fallback Card layout (NSV-12)

```
┌─────────────────────────────────────────────────┐
│  No shared watches yet.                          │ ← CardTitle (text-base, font-medium, sentence-case)
│                                                  │
│  You and @{username} don't share any watches    │ ← CardContent body (text-sm, text-muted-foreground)
│  in your collections. That doesn't mean you      │
│  don't share taste — try one of these:           │
│                                                  │
│  ┌─────────────────────────────┐                 │
│  │ Browse {displayName}'s    →│  (Primary)      │ ← Button default
│  │ collection                  │                 │
│  └─────────────────────────────┘                 │
│  ┌─────────────────────────────┐                 │
│  │ Find collectors with      →│  (Outline)      │ ← Button outline
│  │ shared watches              │                 │
│  └─────────────────────────────┘                 │
└─────────────────────────────────────────────────┘
```

**Layout rules:**
- Card width: full-width within the existing tab content area (the `[tab]/page.tsx` route renders inside the profile layout's existing content slot — no explicit `max-w-*` needed; the layout provides its own constraint)
- CardHeader → CardContent stacking (default Card behavior, `gap-4`)
- CardContent body uses `space-y-4` to separate: body paragraph → CTA stack
- CTA stack is `flex flex-col gap-3 sm:flex-row sm:gap-4` (mobile: stacked; ≥640px: inline) — preserves single-row CTA pairing on desktop while remaining tap-friendly on mobile
- CTA tap targets: min 32px tall via `Button` `size="default"` (h-8 = 32px); accept this baseline since other project CTAs use the same height. If executor finds the spec calls for taller (44px iOS HIG), use `size="lg"` (h-9) — but baseline = `default`

### Optional section-wrapper consistency

The existing `CommonGroundTabContent.tsx:34` wraps its content in `<div className="space-y-8">`. The NSV-12 fallback renders INSTEAD of `CommonGroundTabContent` (different branch), so it does not need the `space-y-8` wrapper — render the Card directly as the return value of the no-overlap branch. The profile layout's parent containers provide the page-level spacing.

---

## Interaction & A11y Contract

### Keyboard navigation

| Element | Expected behavior |
|---------|-------------------|
| NSV-01+15 mostSimilar row Link | Each `<Link>` receives keyboard focus via Tab; Enter activates navigation. Focus-visible ring inherited from project default (no `outline-none` override). |
| NSV-12 fallback Card CTAs | Both `<Link>` CTAs reachable via Tab in document order (Primary first, Secondary second). Enter activates navigation. |

### Pointer interaction

| Element | Hover state | Active state |
|---------|-------------|--------------|
| NSV-01+15 row Link | `bg-accent` fill (D-07 lock) on the full row surface | Browser default (Link active depression — no project override) |
| NSV-12 Primary CTA | `bg-primary/80` (existing Button default variant `[a]:hover:bg-primary/80`) | Browser default |
| NSV-12 Secondary CTA | `bg-muted hover:text-foreground` (existing Button outline variant) | Browser default |

### Touch / mobile

- All Phase 39 affordances render on existing pages that already serve mobile; no new responsive breakpoints introduced.
- NSV-12 CTA stack collapses to `flex-col` below `sm:` breakpoint (≥640px → row).
- No new tap-target audit needed — Phase 39 reuses primitives that already pass project tap-target expectations.

### Screen-reader contract

| Element | Constraint |
|---------|-----------|
| NSV-01+15 Link wrap | The `<Link>` IS the named landmark — its accessible name is the concatenated child text ("{brand} {model} {N}% similar"). Do NOT add an `aria-label` override unless reviewer determines the implicit name is misleading. |
| NSV-12 fallback Card title | CardTitle renders as a `<div>` (not heading). If the surrounding tab content has a heading hierarchy this Card should slot into, the executor may pass `as="h2"` if/when CardTitle supports it — current shadcn CardTitle does NOT support this prop, so leave as `<div>` for Phase 39 and accept the limitation. Future a11y polish would address this project-wide, not in Phase 39. |
| Em-dash in body | Screen-readers handle U+2014 (`—`) correctly; no special handling needed. |
| Arrows in CTA labels | The `→` (U+2192) is decorative; some screen readers read "right arrow" which is acceptable in this context (the CTA text already states the action; the arrow reinforces direction). |

### Server vs Client component constraint

- NSV-12 fallback Card renders inside `src/app/u/[username]/[tab]/page.tsx` which is a Server Component (no `'use client'` directive at top). Phase 39 MUST NOT add `'use client'` to this page or to the fallback render branch. The Card + Link composition is server-renderable.
- NSV-01+15 edit site (`CollectionFitCard.tsx`) is currently a server-renderable pure component (no `'use client'`). Wrapping `<li>` content in `<Link>` does NOT require client-side conversion — `next/link` works in Server Components.

---

## Test Coverage Contract

| Concern | Test type | File / location |
|---------|-----------|-----------------|
| NSV-01+15 Phase 20 import-boundary guard survival | Static guard | `tests/static/CollectionFitCard.no-engine.test.ts` — already exists; MUST continue passing after edits. `next/link` is NOT an engine import; no test changes required. |
| NSV-01+15 Link target wires to correct watch id | Component test (if planner deems necessary; not mandated) | New or existing `CollectionFitCard.test.tsx` extension |
| NSV-08 verify-before-patch evidence | Plan SUMMARY grep output | Captured as a bash output block in the plan's SUMMARY artifact, not as a test file |
| NSV-12 fallback returns 200 (not 404) when overlap empty and viewer follows owner | Integration test | New `tests/app/common-ground-fallback.test.ts` (or appended to existing common-ground test if one exists) — assert response renders the fallback Card structure (title text + 2 CTA hrefs) |
| NSV-12 other gate failures still 404 | Integration test | Same file as above — assert `!profile` and `!isOwner` paths still call `notFound()` (Phase 39 changes ONLY the no-overlap branch) |

The full test plan is the planner's discretion; this contract only fixes the load-bearing assertions.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official (`base-nova` preset) | `card`, `button`, `badge` (all pre-existing in `src/components/ui/`) | not required — already in repo at HEAD; no new `npx shadcn add` calls in Phase 39 |
| Third-party registries | none | not applicable |

Phase 39 introduces ZERO new registry installs. The plan executor must NOT run `npx shadcn add ...` for any component.

---

## Out-of-Scope Visual Concerns (do NOT touch in Phase 39)

These exist in the broader code surface but Phase 39 explicitly avoids them — the UI-SPEC names them so executor cannot accidentally drift:

- **CollectionFitCard headline / contextual phrasings / role-overlap warning** (`CollectionFitCard.tsx:34-89` outside the mostSimilar block). Phase 39 edits ONLY the `<li>` rows inside the mostSimilar `<ul>`. The rest of the card is untouched.
- **InsightsTabContent overall layout / non-Link affordances.** Phase 39 may touch ONLY the verify-and-patch result for `GoodDealsSection` + `SleepingBeautiesSection` Link wraps (and per the verify gate, neither needs touching).
- **CommonGroundTabContent body** (the success-path render). Phase 39 reshapes ONLY the failure branch (no-overlap) into a fallback Card; the success-path component is unchanged.
- **Other `notFound()` calls** in `[tab]/page.tsx` (lines 51, 54, 101). Phase 39 reshapes ONLY line 87. Other `notFound()` calls survive unchanged.
- **Color palette, font, spacing tokens.** Phase 39 introduces no new tokens. Any new token in execution = scope drift.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
