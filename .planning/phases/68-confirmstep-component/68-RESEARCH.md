# Phase 68: ConfirmStep Component - Research

**Researched:** 2026-05-29
**Domain:** React pure-presenter component / WAI-ARIA radiogroup / next/image / Vitest+RTL testing
**Confidence:** HIGH — all findings verified directly against the codebase or official docs in `node_modules/next/dist/docs/`

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** New file `src/components/watch/ConfirmStep.tsx`. Sibling of VerdictStep.tsx, PasteSection.tsx, WatchForm.tsx. Co-located test: `src/components/watch/ConfirmStep.test.tsx`. Do NOT delete or modify VerdictStep.tsx in this phase.
- **D-02:** Named export `function ConfirmStep(...)`, no default export. Top-of-file `'use client'` directive.
- **D-03:** Pure presenter. No `useState`, no fetch, no Server Action, no `router.push`. All state in props + callbacks. Full prop contract locked (see interface below).
- **D-04:** Custom 3-button group inside `<div role="radiogroup">`, each button `role="radio"` + `aria-checked={status === value}`. NOT shadcn Tabs. Each button is `<Button variant="outline">` + `cn(...)` selected-state class.
- **D-05:** Inline lucide-react `Star` icon inside the grail button, immediately before "Grail" text, `size-4`, `aria-hidden`. Wrapped in `<span className="inline-flex items-center gap-1.5">`.
- **D-06:** Two separate optional props `catalogImageUrl` and `extractedImageUrl`. Fallback chain: catalogImageUrl → extractedImageUrl → WatchIcon placeholder. `next/image` with `unoptimized` + `width={80} height={80}`. Container: `size-20 rounded-md bg-muted overflow-hidden flex-shrink-0`.
- **D-07:** Plain `<Input>` for reference (controlled, `reference ?? ''`). Plain `<Input type="number">` for year (blank-to-undefined pattern from WatchForm.tsx:408-413). No validation — Zod on Server Action is single source of truth.
- **D-08:** Keep reference input enabled on catalog-bound rows. Phase 67 D-10 server-side override handles canonical identity. Document invariant in JSDoc.
- **D-09:** ConfirmStep emits `onEditDetails: () => void`; parent (Phase 70) decides presentation. Button: `variant="ghost"`, label `"Edit details"`.
- **D-10:** CTA label via module-scope `CTA_LABELS = { owned: 'Add to Collection', wishlist: 'Add to Wishlist', grail: 'Save as Grail' } as const`. Pending state: Loader2 spinner + "Saving...". "Start over": `variant="ghost"`, disabled when `pending`.
- **D-11:** ConfirmStep does NOT own the initial-status default. Receives `status` as required controlled prop from Phase 70.

### Claude's Discretion

- Reference input `id`: use `confirm-reference`, `confirm-year`, `confirm-price`, `confirm-status-group` to avoid collisions with WatchForm.tsx.
- Price input: mirrors WatchForm.tsx:419-451. Label: `{status === 'owned' ? 'Price paid' : 'Target price'}`.
- Optional `spec` prop for SpecHeadline parity with VerdictStep — planner picks (a) or (b).
- Wrapper: `<div>` (not `<form>`) per VerdictStep precedent.
- Test file covers 15 cases (a)-(o) listed in CONTEXT.

### Deferred Ideas (OUT OF SCOPE)

- `initialStatus` default fallback — Phase 70 owns.
- "Edit details" inline-expand vs. route-change — Phase 70 owns.
- `CollectionFitCard` on ConfirmStep — permanently out of scope per PROJECT.md.
- Year input min/max validation — defer until Phase 70 UAT surfaces need.
- VerdictStep deletion — Phase 70.
- Arrow-key roving tabindex on radiogroup — planner discretion for Phase 68; Phase 70 polish task if deferred.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CONF-01 | Cover photo at top (catalog imageUrl → extracted imageUrl → watch-icon placeholder) | D-06 locks the prop contract + fallback chain; `next/image unoptimized` is the verified idiom (see §Architecture Patterns); WatchPhotoSection.tsx WatchIcon pattern confirmed |
| CONF-02 | Brand / model / reference identity displayed read-only by default | Pure presenter pattern from VerdictStep.tsx:57-84; brand+model rendered as static text; reference rendered as Input per D-05/D-07 |
| CONF-03 | Segmented status picker (button group): owned / wishlist / grail; sold absent | WAI-ARIA radiogroup pattern verified; `role="radiogroup"` + `role="radio"` + `aria-checked` semantics confirmed; no `Tabs` (D-04) |
| CONF-04 | Grail visually distinguished by inline lucide `Star` icon; option weight/size unchanged | `Star` export confirmed from lucide-react node module; `size-4 aria-hidden` + `inline-flex items-center gap-1.5` pattern from D-05 + VerdictStep Loader2 precedent |
| CONF-05 | Reference and year are inline-editable text inputs | `<Input>` shadcn primitive + blank-to-undefined pattern verified at WatchForm.tsx:408-413; 2-col grid layout from WatchForm.tsx:313 |
| CONF-06 | Status-gated price field (Price paid / Target price) | `isOwned = status === 'owned'` pattern at WatchForm.tsx:304; two-branch `isOwned ? pricePaid : targetPrice` pattern at WatchForm.tsx:419-451; single-prop design per D-03 |
| CONF-07 | "Edit details" affordance opens WatchForm (or expands inline) with pre-filled data; lockedStatus NOT set | Phase 70 owns wiring; ConfirmStep emits `onEditDetails: () => void`; `variant="ghost"` confirmed by VerdictStep.tsx:138 |
| CONF-08 | Primary CTA label reflects chosen status | `CTA_LABELS` lookup table at module scope; Loader2 pending pattern from VerdictStep.tsx:112 |
| CONF-09 | "Start over" escape returns to search idle without persisting partial data | Emits `onStartOver: () => void`; Phase 70 owns the state machine reset; ghost button pattern confirmed |
| CONF-10 | Status default derives from `?status=` URL parameter | ConfirmStep accepts `status` as controlled prop; Phase 70 resolves `initialStatus` before threading down; ConfirmStep carries no default |
</phase_requirements>

## Summary

Phase 68 ships `src/components/watch/ConfirmStep.tsx` — a single new pure-presenter component. The codebase already has everything needed: `VerdictStep.tsx` is the structural reference (props-in/callbacks-out, `aria-live`, cover photo, Loader2 pending, mobile-first button row); `WatchForm.tsx` owns the price-gating and numeric input patterns; `PrivacyToggleRow.tsx` owns the `aria-checked` on `<button>` precedent. The only net-new pattern is the WAI-ARIA `radiogroup` (3-element, `role="radio"` per button) which extends the 2-element toggle already established at `src/components/settings/PrivacyToggleRow.tsx:52`.

The test file (`ConfirmStep.test.tsx`) follows the VerdictStep.test.tsx pattern exactly: no `@vitest-environment node` directive (jsdom default is correct for a DOM presenter), `describe` blocks grouping cases, `vi.mock('next/image', ...)` stub, `fireEvent` for clicks, `screen.getByRole` queries. Global vitest setup at `tests/setup.tsx` provides StrictMode wrapping, PointerEvent polyfill, and `next/navigation` + `next/cache` mocks automatically.

**Primary recommendation:** Mirror VerdictStep.tsx line for line for the structural scaffolding (cover photo block, `aria-live="polite"` wrapper, mobile-first CTA row, JSDoc header). New material: extend the PrivacyToggleRow `aria-checked` pattern to 3-element radiogroup; add the Star icon via the Loader2 `size-4 mr-2 aria-hidden` precedent; replicate WatchForm.tsx price-gating and numeric input idiom verbatim.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Cover photo fallback chain | Browser / Client | — | Props-in rendering only; no fetch; parent feeds catalogImageUrl / extractedImageUrl |
| Status picker (radiogroup) | Browser / Client | — | Interactive selection; controlled via props; no server state |
| Inline-editable reference + year | Browser / Client | — | Controlled inputs; onChange callbacks fire to parent; no validation here |
| Status-gated price field | Browser / Client | — | `isOwned` conditional purely from `status` prop |
| Primary CTA pending state | Browser / Client | — | `pending` prop from parent; no local transition |
| Server Action dispatch | — | API / Backend | Phase 70 owns; ConfirmStep has no Server Action call |
| `initialStatus` URL resolution | Frontend Server (SSR) | Browser / Client | Phase 70 reads `?status=` param server-side; threads as `status` prop |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 19 | 19.2.4 | Controlled component model | Project runtime — no choice |
| next/image | Next 16.2.3 | Cover photo with `unoptimized` | Established by VerdictStep.tsx:65-73; avoids remotePatterns config |
| lucide-react | ^1.8.0 | `Star`, `Loader2`, `Watch as WatchIcon` icons | Project standard; all three exports verified present |
| shadcn `Button` | via @base-ui/react | Radiogroup buttons + CTA + ghost affordances | Established UI primitive; variant="outline" + variant="ghost" used throughout |
| shadcn `Input` | via @base-ui/react | Reference, year, price fields | Project standard; replicates WatchForm.tsx pattern |
| shadcn `Label` | via @base-ui/react | Field labels | Pairs with Input htmlFor per project convention |
| `cn()` from @/lib/utils | — | Conditional class composition for selected-state | Used in every interactive component |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn `Card` / `CardContent` | — | Outer container shell | Optional — VerdictStep uses Card for spec block; planner picks layout |
| `MOVEMENT_LABELS` from @/lib/constants | — | SpecHeadline helper (if discretion opts in) | Only if D-Discretion-3 SpecHeadline parity kept |
| class-variance-authority | ^0.7.1 | Button variant resolution | Transitive through Button primitive |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `<div role="radiogroup">` custom | shadcn `Tabs` | Tabs = "view selector" semantics (SR says "tab"); radio = "form input" semantics. D-04 locks custom radiogroup. |
| `next/image` with `unoptimized` | `<img>` tag directly | `next/image` carries lazy-loading + aspect-ratio placeholder benefits even with `unoptimized`; consistent with VerdictStep precedent |

**Installation:** No new packages needed. All required exports already in `package.json`.

## Architecture Patterns

### System Architecture Diagram

```
Parent (Phase 70 AddWatchFlow)
  │
  ├─ props: catalogImageUrl?, extractedImageUrl?, brand, model, reference,
  │          productionYear, status, price + all onChange callbacks, pending
  │
  └─► ConfirmStep (pure presenter — this phase)
        │
        ├─ Cover photo block
        │    catalogImageUrl ──► <Image unoptimized w=80 h=80>
        │    extractedImageUrl ─► <Image unoptimized w=80 h=80>
        │    (neither) ─────────► <WatchIcon h-16 w-16 text-muted-foreground/40>
        │
        ├─ Identity block (read-only brand+model text, inline reference Input, year Input)
        │
        ├─ Status radiogroup (role="radiogroup")
        │    [owned] [wishlist] [grail ★]  ← <Button role="radio" aria-checked>
        │    onStatusChange callback ──► parent
        │
        ├─ Status-gated price Input
        │    isOwned → Label "Price paid" / else → Label "Target price"
        │    onPriceChange callback ──► parent
        │
        └─ Action row
             [Edit details (ghost)]  [Start over (ghost)]
             [Add to Collection / Add to Wishlist / Save as Grail (primary full-width)]
             onEditDetails / onStartOver / onPrimary callbacks ──► parent
```

### Recommended Project Structure

```
src/components/watch/
├── ConfirmStep.tsx          # new — this phase
├── ConfirmStep.test.tsx     # new — this phase (co-located, no __tests__/ dir)
├── VerdictStep.tsx          # existing — DO NOT TOUCH until Phase 70
├── VerdictStep.test.tsx     # existing — DO NOT TOUCH
├── WatchForm.tsx            # existing — read-only reference
└── ...                      # other existing files unchanged
```

### Pattern 1: Pure-Presenter Shape (mirroring VerdictStep)

**What:** Component accepts all state as props, emits all mutations as callbacks, holds zero async state.

**When to use:** Any add-flow step that Phase 70's `AddWatchFlow` state machine mounts and controls.

```typescript
// Source: src/components/watch/VerdictStep.tsx:47-148
'use client'

export function ConfirmStep({
  catalogImageUrl,
  extractedImageUrl,
  brand,
  model,
  reference,
  onReferenceChange,
  productionYear,
  onProductionYearChange,
  status,
  onStatusChange,
  price,
  onPriceChange,
  onPrimary,
  onEditDetails,
  onStartOver,
  pending = false,
}: ConfirmStepProps) {
  const brandModel = [brand, model].filter(Boolean).join(' ') || 'Watch'
  const isOwned = status === 'owned'
  // ...render
}
```

### Pattern 2: WAI-ARIA Radiogroup — 3-Button Custom Picker

**What:** `<div role="radiogroup">` wrapper containing exactly 3 `<button role="radio" aria-checked>` children. Only the selected option has `tabIndex={0}`; others have `tabIndex={-1}` (roving tabindex). This is the WAI-ARIA 1.2 Radio Group design pattern — standard for "choose exactly one from a set."

**When to use:** Any picker where the user selects one exclusive value from 2-5 options that represents a form input (not a view selector).

**ARIA contract (authoritative from WAI-ARIA 1.2 Radio Group pattern):**
- Wrapper: `role="radiogroup"` + `aria-label` or `aria-labelledby`
- Each option: `role="radio"` + `aria-checked={boolean}` + `tabIndex={0 | -1}`
- Only the selected option has `tabIndex={0}` (roving tabindex — only one stop in the group per Tab key)
- Keyboard navigation on the wrapper's `onKeyDown`:
  - `ArrowRight` / `ArrowDown` → select next (wraps), move focus
  - `ArrowLeft` / `ArrowUp` → select previous (wraps), move focus
  - `Home` → select first
  - `End` → select last
  - `Space` / `Enter` → activate focused option

**Key distinction from `PrivacyToggleRow.tsx`:** That component uses `role="switch"` (a 2-state boolean toggle). ConfirmStep's picker uses `role="radio"` within a `role="radiogroup"` — different ARIA roles for different semantics. `aria-checked` attribute applies to BOTH.

**`aria-checked` on `<button>` vs `<input>`:** Both `<button role="radio">` and `<input type="radio">` accept `aria-checked`. The button approach requires explicitly setting the ARIA role; native `<input type="radio">` does not. Using `<button>` is valid and is the established codebase pattern (`PrivacyToggleRow.tsx:49-67`, `WatchForm.tsx:695`).

```typescript
// Source: CONTEXT D-04 + WAI-ARIA 1.2 Radio Group pattern + PrivacyToggleRow.tsx:49 precedent
const OPTIONS = [
  { value: 'owned', label: 'Owned' },
  { value: 'wishlist', label: 'Wishlist' },
  { value: 'grail', label: (
    <span className="inline-flex items-center gap-1.5">
      <Star className="size-4" aria-hidden />
      Grail
    </span>
  )},
] as const

// Wrapper:
<div
  role="radiogroup"
  aria-label="Watch status"
  id="confirm-status-group"
  className="flex gap-2"
  onKeyDown={handleKeyDown}   // roving tabindex navigation
>
  {OPTIONS.map(({ value, label }) => (
    <Button
      key={value}
      role="radio"
      aria-checked={status === value}
      tabIndex={status === value ? 0 : -1}
      variant="outline"
      className={cn(
        status === value && 'border-primary bg-primary/10',
      )}
      onClick={() => onStatusChange(value as ConfirmStepProps['status'])}
    >
      {label}
    </Button>
  ))}
</div>
```

**Keyboard handler (if implemented in Phase 68):**
```typescript
// Source: CONTEXT D-04 specifics + WAI-ARIA 1.2 pattern
function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
  const values = ['owned', 'wishlist', 'grail'] as const
  const idx = values.indexOf(status)
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    e.preventDefault()
    onStatusChange(values[(idx + 1) % values.length])
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault()
    onStatusChange(values[(idx + values.length - 1) % values.length])
  } else if (e.key === 'Home') {
    e.preventDefault()
    onStatusChange(values[0])
  } else if (e.key === 'End') {
    e.preventDefault()
    onStatusChange(values[values.length - 1])
  }
}
```

**Note on keyboard nav deferral:** CONTEXT D-04 marks keyboard arrow-key nav as "planner discretion" — the `aria-checked` and `tabIndex` attributes are non-negotiable; the `onKeyDown` handler is the polish layer. If deferred, a Phase 70 follow-up task should be filed.

### Pattern 3: Cover Photo Fallback Chain

**What:** Tries 3 image sources in priority order. The first non-null/undefined source wins. Falls back to a lucide `WatchIcon` placeholder.

**`unoptimized` semantics (verified from `node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md`):** Setting `unoptimized={true}` serves the source image as-is without quality, size, or format transformation. This is the correct pattern for arbitrary external URLs that are not listed in `next.config.ts` `remotePatterns`. Stable since Next.js 12.3.0; API unchanged in Next 16.2.3.

```typescript
// Source: src/components/watch/VerdictStep.tsx:64-75 (cover photo idiom) +
//         src/components/watch/WatchPhotoSection.tsx:53 (WatchIcon placeholder)
const coverUrl = catalogImageUrl ?? extractedImageUrl ?? null

// In JSX:
<div className="size-20 rounded-md bg-muted overflow-hidden flex-shrink-0">
  {coverUrl ? (
    <Image
      src={coverUrl}
      alt={brandModel}
      width={80}
      height={80}
      className="object-cover w-full h-full"
      unoptimized
    />
  ) : (
    <div className="flex h-full w-full items-center justify-center">
      <WatchIcon className="h-16 w-16 text-muted-foreground/40" aria-hidden />
    </div>
  )}
</div>
```

### Pattern 4: Status-Gated Price Field

**What:** Single price field whose label flips based on `status`. Exactly replicates WatchForm.tsx:304 + 419-451.

```typescript
// Source: src/components/watch/WatchForm.tsx:304, 419-451
const isOwned = status === 'owned'

<div className="space-y-2">
  <Label htmlFor="confirm-price">
    {isOwned ? 'Price paid' : 'Target price'}
  </Label>
  <Input
    id="confirm-price"
    type="number"
    value={price ?? ''}
    onChange={(e) =>
      onPriceChange(e.target.value ? Number(e.target.value) : undefined)
    }
    placeholder="$"
  />
</div>
```

### Pattern 5: Numeric Input Blank-to-Undefined

**What:** The controlled `<Input type="number">` pattern where an empty string converts to `undefined`. This is the codebase standard for optional numeric fields.

```typescript
// Source: src/components/watch/WatchForm.tsx:408-413
value={formData.marketPrice ?? ''}
onChange={(e) =>
  setFormData((prev) => ({
    ...prev,
    marketPrice: e.target.value ? Number(e.target.value) : undefined,
  }))
}
```

**ConfirmStep year input adaptation:**
```typescript
// Per D-07 + WatchForm.tsx:408-413 pattern
<Input
  id="confirm-year"
  type="number"
  value={productionYear ?? ''}
  onChange={(e) =>
    onProductionYearChange(e.target.value ? Number(e.target.value) : undefined)
  }
/>
```

### Pattern 6: Pending CTA with Loader2

**What:** When `pending=true`, the primary CTA disables and swaps to Loader2 spinner + "Saving..." text. All action buttons disable.

```typescript
// Source: src/components/watch/VerdictStep.tsx:103-118
<Button
  type="button"
  onClick={onPrimary}
  disabled={pending}
  className="w-full sm:flex-1"
>
  {pending ? (
    <>
      <Loader2 className="size-4 mr-2 animate-spin" aria-hidden="true" />
      Saving...
    </>
  ) : (
    CTA_LABELS[status]
  )}
</Button>
```

### Pattern 7: Mobile-First Button Row

**What:** Buttons stack vertically on mobile, go side-by-side on `sm:` breakpoint.

```typescript
// Source: src/components/watch/VerdictStep.tsx:102
<div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
  {/* primary CTA */}
  {/* ghost buttons */}
</div>
```

### Pattern 8: JSDoc Header

**What:** Multi-line JSDoc block at the top of the component (above the interface declaration) documenting the phase ownership, decisions, and cross-phase invariants.

```typescript
// Source: src/components/watch/VerdictStep.tsx:13-29 (structure reference)
/**
 * Phase 68 D-01..D-11 — confirm-screen presenter.
 *
 * Pure presentation. Sections rendered in order:
 *   1. Cover photo (catalogImageUrl → extractedImageUrl → WatchIcon placeholder) [D-06]
 *   2. Read-only brand+model identity + inline reference/year inputs [D-07]
 *   3. Segmented status picker (owned / wishlist / grail — sold absent) [D-04, CONF-03]
 *   4. Status-gated price field (Price paid / Target price) [D-06 WatchForm isOwned pattern]
 *   5. Action row: "Edit details" (ghost) + "Start over" (ghost) + primary CTA [D-10]
 *
 * Cross-phase invariants:
 *   - reference input is ENABLED even on catalog-bound rows. Phase 67 D-10 server-side
 *     overrides brand/model/reference when catalogId is supplied — user edits are silently
 *     superseded by the Server Action. productionYear is NOT overridden. [D-08]
 *   - Phase 70 owns: initialStatus resolution, addWatch dispatch, onEditDetails wiring,
 *     onStartOver wiring. This component emits callbacks only. [D-03]
 *   - CollectionFitCard is NOT mounted here — verdict is deliberately out of scope for
 *     the add flow per PROJECT.md "Verdict deliberately out of scope". [CONTEXT deferred]
 *
 * Pending behavior: pending=true disables all action buttons; primary CTA shows
 * Loader2 spinner + "Saving...". [D-10]
 */
```

### Anti-Patterns to Avoid

- **`import { Tabs, TabsList, TabsTrigger }` for the status picker:** Tabs = view selector semantics; screen readers say "tab". Use `role="radiogroup"` custom group per D-04.
- **`import { CollectionFitCard }`:** Explicitly forbidden in this phase (CLNP-03 static guard in Phase 71 enforces this at CI level).
- **`import { addWatch } from '@/app/actions/watches'`:** Phase 68 is a pure presenter; Phase 70 dispatches the action.
- **`import { useRouter } from 'next/navigation'`:** Pure presenter; no navigation.
- **`useState` for status / price / reference / year:** All controlled by parent. No local state for business data.
- **`role="switch"` on the radiogroup buttons:** `switch` is for 2-state boolean toggles (`PrivacyToggleRow`); `radio` is for exclusive selection from a set.
- **`export default function ConfirmStep`:** Named export only — pages use default; components use named (every file in `src/components/watch/` uses named export except page-level files).
- **Rendering `productionYear` as plain text:** It's an inline-editable `<Input type="number">` per D-07/CONF-05.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Conditional class composition | Ternary string concatenation | `cn()` from `@/lib/utils` | Handles falsy values, merges Tailwind conflicts |
| Number input blank handling | Custom null-check + Number coercion | `e.target.value ? Number(e.target.value) : undefined` | Already the project-standard WatchForm.tsx:408-413 idiom — copy verbatim |
| Icon sizing | Custom CSS | `size-4` / `h-16 w-16` Tailwind tokens | Matches existing precedents exactly |
| Button variant for selected state | Custom CSS class | `cn('border-primary bg-primary/10')` applied when `status === value` | Consistent with project token vocabulary (CONTEXT Claude's Discretion) |
| External image rendering | `<img>` tag | `next/image` with `unoptimized` | Matches VerdictStep.tsx:65-73 exact pattern; Next 16 Image API stable |

**Key insight:** Every non-trivial pattern in ConfirmStep has an exact precedent in the codebase. The planner should treat this phase as "assemble known pieces" rather than invent new solutions.

## Common Pitfalls

### Pitfall 1: `role="radio"` Without `tabIndex` Roving

**What goes wrong:** All 3 radiogroup buttons have `tabIndex={0}`, so Tab cycles through all 3 options individually instead of treating the group as a single focus stop.

**Why it happens:** Forgetting the roving tabindex contract — only the selected option should be `tabIndex={0}`; non-selected options must be `tabIndex={-1}`.

**How to avoid:** `tabIndex={status === value ? 0 : -1}` on every `<button role="radio">`. Test case (o) in the CONTEXT test list asserts `aria-checked` — add a parallel assertion for `tabIndex` in the test.

**Warning signs:** Screen reader announces "3 of 3" as user tabs through all buttons sequentially rather than entering the group and using arrow keys.

### Pitfall 2: `aria-checked` Attribute Value Type

**What goes wrong:** Passing `aria-checked={true}` as a JSX boolean works correctly, but only because React serializes `true` as the string `"true"` for ARIA attributes. However, passing `aria-checked={undefined}` will strip the attribute entirely (which is valid — non-selected radios may omit it, or may carry `aria-checked="false"`).

**How to avoid:** Always explicitly set `aria-checked={status === value}` on every button so the non-selected state is explicitly `false` (serializes as the string "false"), not absent. This is the strictest correct form per WAI-ARIA 1.2.

**Warning signs:** WAVE accessibility audit reports missing `aria-checked` on non-selected radio buttons.

### Pitfall 3: `Base UI Button` Props and `role` Override

**What goes wrong:** The shadcn `Button` primitive (`src/components/ui/button.tsx`) wraps `@base-ui/react/button`. Base UI's `<ButtonPrimitive>` renders a native `<button>` element by default. Adding `role="radio"` to a `<Button>` component passes it through as an HTML attribute — this is valid and works correctly. However, `type="button"` should still be passed to prevent accidental form submission if ConfirmStep is ever wrapped in a `<form>`.

**How to avoid:** Include `type="button"` on each radiogroup Button. The outer wrapper is a `<div>` per D-Discretion-5 (no form element) but defensive practice for future refactors.

**Warning signs:** Console warning about button inside form without type attribute.

### Pitfall 4: `next/image` `alt` With Empty String

**What goes wrong:** If `brand` and `model` are both empty strings, `[brand, model].filter(Boolean).join(' ')` evaluates to `''`, which causes `alt=""` on the Image — making the image invisible to screen readers (treats it as decorative). For a cover photo that IS meaningful content, a missing alt is an a11y failure.

**How to avoid:** `const brandModel = [brand, model].filter(Boolean).join(' ') || 'Watch'` — the `|| 'Watch'` fallback ensures alt is never empty. This is already the VerdictStep.tsx:57 pattern — replicate verbatim.

**Warning signs:** `alt=""` on the Image element in DOM inspection.

### Pitfall 5: `Star` vs `StarFilled` Icon Naming

**What goes wrong:** Believing there's a separate "filled" variant named `StarFilled` or `StarIcon`. lucide-react ships a single `Star` export (outline style, which is standard lucide convention). The CONTEXT calls for `Star` — verified: `typeof Star === 'object'` confirmed from the installed `lucide-react` node module.

**How to avoid:** `import { Star } from 'lucide-react'` — exactly one export, no suffix needed. The icon renders as an outline star by default, which is appropriate for the "Grail" status label (aspirational, not filled).

**Warning signs:** TypeScript import error saying `StarFilled` is not exported.

### Pitfall 6: `confirm-reference` vs `reference` id Collision

**What goes wrong:** Using `id="reference"` on the ConfirmStep reference input collides with `WatchForm.tsx:347`'s `id="reference"` if both mount in the same document (e.g., when CONF-07 "Edit details" expands `WatchForm` inline in Phase 70).

**How to avoid:** Use `id="confirm-reference"`, `id="confirm-year"`, `id="confirm-price"`, `id="confirm-status-group"` per CONTEXT Claude's Discretion. Pairs correctly with `<Label htmlFor="confirm-reference">`.

**Warning signs:** Two elements with the same `id` in the DOM; `htmlFor` label click activating the wrong input.

### Pitfall 7: Test Mock for `next/image`

**What goes wrong:** Importing `next/image` in a Vitest/jsdom test without mocking it causes the component to fail (Next Image requires Next.js runtime context). VerdictStep.test.tsx line 17 shows the required mock.

**How to avoid:** In `ConfirmStep.test.tsx`:
```typescript
vi.mock('next/image', () => ({
  default: (p: { src: string; alt: string }) => <img src={p.src} alt={p.alt} />,
}))
```

**Warning signs:** Test fails with "Error: Image Optimization using Next.js' default loader is not compatible with next export."

### Pitfall 8: Omitting `aria-live="polite"` on Root Wrapper

**What goes wrong:** CTA label changes (e.g., status switch from "owned" to "wishlist") update the button text without announcement to screen readers. Screen reader users who aren't focused on the button miss the change.

**How to avoid:** Wrap the entire ConfirmStep return in `<div className="space-y-6" aria-live="polite">` — same as VerdictStep.tsx:60. The "polite" setting means announcements don't interrupt in-progress speech.

**Warning signs:** Screen reader users report CTA label changes are silent.

## Code Examples

### Full Prop Interface

```typescript
// Source: CONTEXT.md D-03 (locked contract)
interface ConfirmStepProps {
  /** Catalog row imageUrl when this watch resolved via search-pick (Phase 67 / D-10). */
  catalogImageUrl?: string | null
  /** Extracted-data imageUrl from the structured / URL extractor (Phase 66). */
  extractedImageUrl?: string | null
  /** Read-only brand (from catalog row when catalogId is bound; from extracted data otherwise). */
  brand: string
  /** Read-only model (same source rule as brand). */
  model: string
  /**
   * Inline-editable reference (CONF-05). Controlled by parent; null/undefined renders empty.
   *
   * NOTE (D-08): When catalogId is bound, Phase 67 D-10 server-side OVERRIDES this value
   * with catalogRow.reference in the addWatch Server Action. User edits to this field on
   * catalog-bound rows are silently superseded. The input stays ENABLED — this is correct
   * behavior; the catalog row is canonical for identity.
   */
  reference: string | null | undefined
  onReferenceChange: (value: string) => void
  /**
   * Inline-editable production year (CONF-05). Number for the controlled value, undefined when blank.
   * productionYear is NOT overridden by Phase 67 D-10 (year is not part of the catalog identity tuple).
   */
  productionYear: number | undefined
  onProductionYearChange: (value: number | undefined) => void
  /** Status picker controlled value. Restricted union excludes 'sold' (CONF-03). */
  status: 'owned' | 'wishlist' | 'grail'
  onStatusChange: (next: 'owned' | 'wishlist' | 'grail') => void
  /** Status-gated price (CONF-06). Single numeric prop; the label flips with status. */
  price: number | undefined
  onPriceChange: (value: number | undefined) => void
  /** Primary CTA. Phase 70 calls addWatch + routes. */
  onPrimary: () => void
  /** CONF-07 — opens WatchForm (Phase 70 decides inline vs route). */
  onEditDetails: () => void
  /** CONF-09 — return user to search idle. */
  onStartOver: () => void
  /** Pending state for the primary CTA. Disables all action buttons + swaps CTA to Loader2. */
  pending?: boolean
}
```

### CTA Labels Constant

```typescript
// Source: CONTEXT.md D-10
const CTA_LABELS = {
  owned: 'Add to Collection',
  wishlist: 'Add to Wishlist',
  grail: 'Save as Grail',
} as const
```

### Test File Structure

```typescript
// Source: VerdictStep.test.tsx:1-12 (header pattern) + AddWatchFlow.test.tsx:13-38 (mock pattern)
// No @vitest-environment node directive — jsdom is correct for DOM presenter

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('next/image', () => ({
  default: (p: { src: string; alt: string }) => <img src={p.src} alt={p.alt} />,
}))

import { ConfirmStep } from '@/components/watch/ConfirmStep'

// Minimal props fixture (all callbacks stubbed)
const BASE_PROPS = {
  brand: 'Omega',
  model: 'Speedmaster',
  reference: '311.30.42.30.01.005',
  productionYear: undefined,
  status: 'wishlist' as const,
  price: undefined,
  onReferenceChange: vi.fn(),
  onProductionYearChange: vi.fn(),
  onStatusChange: vi.fn(),
  onPriceChange: vi.fn(),
  onPrimary: vi.fn(),
  onEditDetails: vi.fn(),
  onStartOver: vi.fn(),
}

describe('ConfirmStep — cover photo (CONF-01)', () => {
  it('(a) renders catalog cover when catalogImageUrl set, even with extractedImageUrl', () => { ... })
  it('(b) renders extracted cover when only extractedImageUrl set', () => { ... })
  it('(c) renders WatchIcon placeholder when neither image is set', () => { ... })
})

describe('ConfirmStep — status picker (CONF-03/04/08)', () => {
  it('(d) shows exactly 3 options (owned / wishlist / grail), no sold', () => { ... })
  it('(e) Star icon appears next to Grail label, not owned/wishlist', () => { ... })
  it('(f) selecting Owned fires onStatusChange("owned")', () => { ... })
  it('(g) CTA label is "Add to Wishlist" when status=wishlist', () => { ... })
  it('(h) CTA label is "Save as Grail" when status=grail', () => { ... })
  it('(o) aria-checked reflects status across all three options', () => { ... })
})

describe('ConfirmStep — price field (CONF-06)', () => {
  it('(i) owned → "Price paid" label; wishlist → "Target price"', () => { ... })
})

describe('ConfirmStep — inline inputs (CONF-05)', () => {
  it('(j) editing reference fires onReferenceChange with new value', () => { ... })
  it('(k) editing year fires onProductionYearChange with parsed number; blank fires undefined', () => { ... })
})

describe('ConfirmStep — action affordances (CONF-07/09)', () => {
  it('(l) "Edit details" click fires onEditDetails', () => { ... })
  it('(m) "Start over" click fires onStartOver', () => { ... })
})

describe('ConfirmStep — pending state', () => {
  it('(n) pending=true → primary CTA disabled + shows Loader2 + "Saving..."', () => { ... })
})
```

### Selected-State cn() Token

```typescript
// Source: CONTEXT.md Claude's Discretion + button.tsx variant "outline" definition
// The "outline" variant base: 'border-border bg-background hover:bg-muted'
// Selected overlay adds: 'border-primary bg-primary/10'
className={cn(
  status === value && 'border-primary bg-primary/10',
)}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| VerdictStep 3-button terminal action | ConfirmStep: selection picker THEN single CTA | Phase 68 (this phase) | Status is now chosen via radiogroup, not action button dispatch |
| `WatchStatus` includes 'sold' in form | Confirm picker explicitly excludes 'sold' | Phase 68 design decision | 'sold' is a transition state, not an initial add state; WATCH_STATUSES includes 'sold' but ConfirmStep's `status` prop type does not |
| `next/image` `unoptimized` via config | Per-component `unoptimized` prop | Stable since Next 12.3.0 | Both approaches remain valid in Next 16; per-component is the established codebase pattern |

**Note on Base UI Button vs. native button:** The shadcn `Button` component (`src/components/ui/button.tsx`) wraps `@base-ui/react/button`, not `<button>` directly. It accepts all standard button HTML attributes (including `role`, `aria-checked`, `tabIndex`) and passes them through to the native `<button>` element. The `nativeButton={true}` default (line 57) ensures the rendered element is a real `<button>`. No special handling needed for ARIA props.

**Deprecated/outdated:**
- `layout="raw"` on next/image: removed in Next 12.2.0 (docs confirmed). Don't use.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Arrow-key keyboard navigation is the correct roving-tabindex contract for WAI-ARIA 1.2 Radio Group | Pattern 2 | If WAI-ARIA 1.3 changed the contract, keyboard behavior may differ — low risk, no breaking behavioral change |

**All other claims in this research were verified against the codebase (grep/read tools) or official docs (`node_modules/next/dist/docs/`) — no additional assumed claims.**

## Open Questions

1. **SpecHeadline parity (D-Discretion-3)**
   - What we know: VerdictStep renders a `SpecHeadline` helper showing movement · case size · dial color. CONTEXT recommends (a) keep it for visual continuity via an optional `spec` prop.
   - What's unclear: whether the confirm screen is a "review screen" (no spec needed) or should feel like VerdictStep.
   - Recommendation: include the optional `spec` prop in Phase 68; if the UI-SPEC (`/gsd-ui-phase 68`) omits it from the wireframe, drop it — costs nothing to add and nothing to not render when `spec` is undefined.

2. **"Edit details" + "Start over" button placement**
   - What we know: CONTEXT D-09 defers placement to UI-SPEC. VerdictStep has "Skip" as the third button in the same row as the two primary actions.
   - What's unclear: whether "Edit details" and "Start over" sit in the same row as the primary CTA or above it.
   - Recommendation: run `/gsd-ui-phase 68` to generate the UI-SPEC before finalizing the plan. Default: stack ghost buttons above the primary CTA row for clear hierarchy.

## Environment Availability

Step 2.6: SKIPPED — Phase 68 is a purely code/config change. No external dependencies, no CLIs, no services, no migrations. Deliverable is a single `.tsx` file + co-located test file.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.x (via `vitest.config.ts` + `@vitejs/plugin-react`) |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npm run test -- src/components/watch/ConfirmStep.test.tsx` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CONF-01 | Cover photo fallback chain (catalog → extracted → placeholder) | unit | `npm run test -- ConfirmStep.test.tsx` (cases a, b, c) | ❌ Wave 0 |
| CONF-02 | Brand/model rendered read-only | unit | same | ❌ Wave 0 |
| CONF-03 | Exactly 3 picker options, no 'sold'; aria-checked correct | unit | same (cases d, o) | ❌ Wave 0 |
| CONF-04 | Star icon on Grail option, not others | unit | same (case e) | ❌ Wave 0 |
| CONF-05 | Reference + year inputs fire callbacks with correct types | unit | same (cases j, k) | ❌ Wave 0 |
| CONF-06 | Price label flips with status | unit | same (case i) | ❌ Wave 0 |
| CONF-07 | "Edit details" fires onEditDetails | unit | same (case l) | ❌ Wave 0 |
| CONF-08 | CTA label reflects status | unit | same (cases f, g, h) | ❌ Wave 0 |
| CONF-09 | "Start over" fires onStartOver | unit | same (case m) | ❌ Wave 0 |
| CONF-10 | status controlled by parent (no internal default) | unit | verified by all cases (prop required, no useState) | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm run test -- src/components/watch/ConfirmStep.test.tsx`
- **Per wave merge:** `npm run test`
- **Phase gate:** `npm run build` exits 0 (build-gate is authoritative per project memory)

### Wave 0 Gaps

- [ ] `src/components/watch/ConfirmStep.test.tsx` — covers all 15 CONF-0x cases (a-o)
- [ ] `src/components/watch/ConfirmStep.tsx` — the component under test (create in Wave 1)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Pure presenter — no auth logic |
| V3 Session Management | no | No session state |
| V4 Access Control | no | No authorization decisions |
| V5 Input Validation | minimal | reference and year inputs have no client-side validation; Zod on Server Action is the single source of truth per D-07 |
| V6 Cryptography | no | No cryptographic operations |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via unvalidated user input in reference/year fields | Tampering | React's JSX escaping handles this automatically; no `dangerouslySetInnerHTML` |
| IDOR via catalogImageUrl/extractedImageUrl serving arbitrary URLs | Information Disclosure | `unoptimized` serves URLs as-is; URLs are provided by the parent, not user-typed; no IDOR surface in the presenter itself |

**Net security assessment:** ConfirmStep is a pure presenter with no auth, no fetch, no Server Action call, and no `dangerouslySetInnerHTML`. The security surface is minimal and governed entirely by the parent's prop threading.

## Sources

### Primary (HIGH confidence)

- `src/components/watch/VerdictStep.tsx` — pure-presenter pattern, cover photo idiom, aria-live, Loader2 pending, mobile button row
- `src/components/watch/WatchForm.tsx:304,408-451` — isOwned conditional, price-gating, numeric input blank-to-undefined pattern
- `src/components/settings/PrivacyToggleRow.tsx:49-67` — `aria-checked` on `<button>` precedent
- `src/components/watch/WatchPhotoSection.tsx:53` — `Watch as WatchIcon` placeholder pattern
- `src/components/ui/button.tsx` — Button variant definitions (`outline`, `ghost`, `default`)
- `node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md:391-412` — `unoptimized` prop API (stable since Next 12.3.0, unchanged in Next 16)
- `vitest.config.ts` — environment: jsdom (default for all component tests)
- `tests/setup.tsx` — global mocks for next/navigation, next/cache, next/image, StrictMode wrapping
- `src/components/watch/VerdictStep.test.tsx` — established test file structure and mock patterns
- Node.js `require('lucide-react')` — `Star` and `Watch` exports verified present

### Secondary (MEDIUM confidence)

- WAI-ARIA 1.2 Radio Group pattern — `role="radiogroup"` + `role="radio"` + `aria-checked` + roving tabindex keyboard semantics (training knowledge; aligns with codebase usage of `aria-checked` in PrivacyToggleRow and WatchForm)

### Tertiary (LOW confidence)

None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in package.json and node_modules
- Architecture: HIGH — directly mirrors VerdictStep.tsx + WatchForm.tsx; no new patterns
- Pitfalls: HIGH — verified against actual codebase code paths
- ARIA radiogroup contract: MEDIUM — training knowledge consistent with codebase `aria-checked` usage

**Research date:** 2026-05-29
**Valid until:** 2026-06-28 (stable domain; no fast-moving dependencies)
