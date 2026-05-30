# Phase 68: ConfirmStep Component - Pattern Map

**Mapped:** 2026-05-29
**Files analyzed:** 2 (ConfirmStep.tsx, ConfirmStep.test.tsx)
**Analogs found:** 4 / 4

## File Classification

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/components/watch/ConfirmStep.tsx` | component (pure presenter) | request-response (props-in / callbacks-out) | `src/components/watch/VerdictStep.tsx` | exact |
| `src/components/watch/ConfirmStep.test.tsx` | test | — | `src/components/watch/VerdictStep.test.tsx` | exact |

**Secondary analogs (specific patterns only):**
- `src/components/watch/WatchForm.tsx` — price-gating + numeric input
- `src/components/settings/PrivacyToggleRow.tsx` — `aria-checked` on `<button>`
- `src/components/watch/WatchPhotoSection.tsx` — WatchIcon placeholder

---

## Pattern Assignments

---

### 1. `src/components/watch/ConfirmStep.tsx` → `src/components/watch/VerdictStep.tsx` (primary analog)

**Closest analog:** `src/components/watch/VerdictStep.tsx`

ConfirmStep is structurally a direct mirror of VerdictStep: same pure-presenter contract, same `'use client'` + named-export shape, same `aria-live="polite"` root, same Card cover-photo block, same Loader2 pending CTA, same mobile-first button row. Replace the verdict content section with the status picker + inline inputs + price field.

---

#### 1a. `'use client'` directive + import block

**Source:** `src/components/watch/VerdictStep.tsx:1-11`

```typescript
'use client'

import Image from 'next/image'
import { Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MOVEMENT_LABELS } from '@/lib/constants'
import { CollectionFitCard } from '@/components/insights/CollectionFitCard'
import type { ExtractedWatchData } from '@/lib/extractors'
import type { VerdictBundle } from '@/lib/verdict/types'
import type { PendingTarget } from './flowTypes'
```

**ConfirmStep adaptation:**
- Keep: `'use client'`, `Image`, `Loader2`, `Card`, `CardContent`, `Button`, `MOVEMENT_LABELS`
- Add: `Star`, `Watch as WatchIcon` from `lucide-react`; `Input`, `Label` from `@/components/ui/`; `cn` from `@/lib/utils`
- Remove: `CollectionFitCard`, `ExtractedWatchData`, `VerdictBundle`, `PendingTarget` (none of these are ConfirmStep's concern)
- No new packages — every import already in `package.json`

---

#### 1b. File header JSDoc pattern

**Source:** `src/components/watch/VerdictStep.tsx:13-29`

```typescript
/**
 * Phase 20.1 D-01 + D-06 + D-11 — verdict-ready render.
 *
 * Pure presentation. Three sections rendered in order:
 *   1. Spec preview (brand / model / image / reference + headline specs)
 *   2. <CollectionFitCard verdict={verdict} /> — byte-locked Phase 20 component
 *      OR contextual fallback when verdict===null:
 *        - hasCollection=false → empty-collection notice (D-06)
 *        - hasCollection=true → "Couldn't compute fit" message (UAT gap 1 fix)
 *   3. 3-button row (Wishlist primary, Collection secondary, Skip tertiary per D-11)
 *
 * Pending behavior: when pendingTarget !== null, all 3 buttons disable; the
 * clicked button displays its variant-specific pending label.
 *
 * Accessibility: 3-button row carries an aria-live="polite" wrapper so
 * verdict-ready transitions announce without screen-reader interruption.
 */
```

**ConfirmStep adaptation:** Copy the multi-paragraph JSDoc structure verbatim. Replace the section list with the 6 sections ConfirmStep renders (cover photo, identity, radiogroup, price, ghost buttons, primary CTA). Add the cross-phase invariant block documenting D-08 (reference input enabled even on catalog-bound rows) and D-03 (no state / no Server Action / no router.push). See full JSDoc draft in 68-RESEARCH.md Pattern 8.

---

#### 1c. Props interface shape

**Source:** `src/components/watch/VerdictStep.tsx:30-45`

```typescript
interface VerdictStepProps {
  extracted: ExtractedWatchData
  /** null = D-06 empty-collection edge OR enrichment-failure ... */
  verdict: VerdictBundle | null
  hasCollection: boolean
  pending: boolean
  pendingTarget: PendingTarget
  onWishlist: () => void
  onCollection: () => void
  onSkip: () => void
}
```

**ConfirmStep adaptation:** Replace entirely with the locked prop contract from CONTEXT D-03. Key differences: ConfirmStep takes `catalogImageUrl?`, `extractedImageUrl?`, `brand`, `model`, `reference`/`onReferenceChange`, `productionYear`/`onProductionYearChange`, `status`/`onStatusChange`, `price`/`onPriceChange`, `onPrimary`, `onEditDetails`, `onStartOver`, `pending?`. The `pendingTarget` simplifies to a single `pending?: boolean` — ConfirmStep has one primary CTA, not three competing action buttons.

---

#### 1d. `aria-live="polite"` root wrapper + brandModel derivation

**Source:** `src/components/watch/VerdictStep.tsx:57-60`

```typescript
export function VerdictStep({ extracted, ... }: VerdictStepProps) {
  const brandModel = [extracted.brand, extracted.model].filter(Boolean).join(' ') || 'Watch'

  return (
    <div className="space-y-6" aria-live="polite">
```

**ConfirmStep adaptation:**
- `brandModel` derivation is identical — `[brand, model].filter(Boolean).join(' ') || 'Watch'` — but sourced from the flat `brand` and `model` props (not `extracted.brand`)
- `isOwned` derivation goes here too: `const isOwned = status === 'owned'`
- Root wrapper is byte-identical: `<div className="space-y-6" aria-live="polite">`

---

#### 1e. Cover photo + identity Card block

**Source:** `src/components/watch/VerdictStep.tsx:62-84`

```typescript
<Card>
  <CardContent className="flex items-start gap-4 p-6">
    {extracted.imageUrl && (
      <div className="size-20 rounded-md bg-muted overflow-hidden flex-shrink-0">
        <Image
          src={extracted.imageUrl}
          alt={brandModel}
          width={80}
          height={80}
          className="object-cover w-full h-full"
          unoptimized
        />
      </div>
    )}
    <div className="space-y-1 min-w-0">
      <h2 className="text-base font-semibold text-foreground truncate">{brandModel}</h2>
      {extracted.reference && (
        <p className="text-sm text-muted-foreground">{extracted.reference}</p>
      )}
      <SpecHeadline data={extracted} />
    </div>
  </CardContent>
</Card>
```

**ConfirmStep adaptation:**
- Container tokens are verbatim: `size-20 rounded-md bg-muted overflow-hidden flex-shrink-0`
- `<Image>` props are verbatim: `width={80} height={80} className="object-cover w-full h-full" unoptimized`
- Cover slot changes: VerdictStep conditionally renders the div only when `extracted.imageUrl` is set. ConfirmStep always renders the `size-20` container — either an `<Image>` (catalogImageUrl or extractedImageUrl) or a `<WatchIcon>` placeholder. See Section 4 below for the placeholder pattern.
- Identity block: reference moves from a read-only `<p>` to an inline `<Input>` (Section 2 of the component tree, not inside the Card)
- SpecHeadline helper is copied inline (Section 1f below)

---

#### 1f. Private `SpecHeadline` helper

**Source:** `src/components/watch/VerdictStep.tsx:151-159`

```typescript
function SpecHeadline({ data }: { data: ExtractedWatchData }) {
  const parts = [
    data.movement ? MOVEMENT_LABELS[data.movement] : null,
    data.caseSizeMm ? `${data.caseSizeMm}mm` : null,
    data.dialColor,
  ].filter((p): p is string => Boolean(p))
  if (parts.length === 0) return null
  return <p className="text-sm text-muted-foreground">{parts.join(' • ')}</p>
}
```

**ConfirmStep adaptation:** Copy verbatim but change the prop signature to accept three separate optional props `movement?`, `caseSizeMm?`, `dialColor?` (matching ConfirmStep's optional spec props per UI-SPEC). Do NOT import from VerdictStep — private helpers are presenter-local. The function signature becomes:
```typescript
function SpecHeadline({ movement, caseSizeMm, dialColor }: {
  movement?: string | null
  caseSizeMm?: number | null
  dialColor?: string | null
})
```

---

#### 1g. Loader2 pending CTA pattern

**Source:** `src/components/watch/VerdictStep.tsx:103-118`

```typescript
<div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
  <Button
    type="button"
    onClick={onWishlist}
    disabled={pending}
    className="w-full sm:w-auto sm:flex-1"
    aria-label="Add to Wishlist"
  >
    {pending && pendingTarget === 'wishlist' ? (
      <>
        <Loader2 className="size-4 mr-2 animate-spin" aria-hidden="true" />
        Saving...
      </>
    ) : (
      'Add to Wishlist'
    )}
  </Button>
```

**ConfirmStep adaptation:** ConfirmStep simplifies to a single primary CTA — no `pendingTarget` discrimination needed. The pending branch is:
```typescript
<Button type="button" onClick={onPrimary} disabled={pending} className="w-full">
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
The `Loader2` props (`size-4 mr-2 animate-spin aria-hidden="true"`) are copied verbatim from VerdictStep.

---

#### 1h. Mobile-first button row tokens

**Source:** `src/components/watch/VerdictStep.tsx:102`

```typescript
<div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
```

**ConfirmStep adaptation:** The ghost button row ("Edit details" + "Start over") reuses this exact token string. Per UI-SPEC: ghost buttons sit in this row above the primary CTA. Each ghost Button gets `className="w-full sm:flex-1"`. The primary CTA sits below in its own full-width block (not inside this flex row).

---

#### 1i. Ghost / Skip button pattern

**Source:** `src/components/watch/VerdictStep.tsx:136-145`

```typescript
<Button
  type="button"
  variant="ghost"
  onClick={onSkip}
  disabled={pending}
  className="w-full sm:w-auto"
  aria-label="Skip"
>
  {pending && pendingTarget === 'skip' ? 'Skipping...' : 'Skip'}
</Button>
```

**ConfirmStep adaptation:** "Edit details" and "Start over" both follow this ghost button pattern. Labels are verbatim strings (no dynamic swap needed — pending state shows on the CTA, not on ghost buttons). Both ghost buttons disable when `pending`:
```typescript
<Button type="button" variant="ghost" onClick={onEditDetails} disabled={pending} className="w-full sm:flex-1">
  Edit details
</Button>
<Button type="button" variant="ghost" onClick={onStartOver}   disabled={pending} className="w-full sm:flex-1">
  Start over
</Button>
```

---

### 2. Price-Gating + Numeric Input → `src/components/watch/WatchForm.tsx`

**Closest analog:** `src/components/watch/WatchForm.tsx`

---

#### 2a. `isOwned` conditional (CONF-06 cited verbatim)

**Source:** `src/components/watch/WatchForm.tsx:304`

```typescript
const isOwned = formData.status === 'owned'
```

**ConfirmStep adaptation:** Copy verbatim but source from the `status` prop (not `formData.status`):
```typescript
const isOwned = status === 'owned'
```
This single line drives both the price label flip and the CTA label (via `CTA_LABELS[status]`).

---

#### 2b. Price input — two-branch controlled component pattern

**Source:** `src/components/watch/WatchForm.tsx:419-451`

```typescript
{isOwned ? (
  <div className="space-y-2">
    <Label htmlFor="pricePaid">Paid</Label>
    <Input
      id="pricePaid"
      type="number"
      value={formData.pricePaid ?? ''}
      onChange={(e) =>
        setFormData((prev) => ({
          ...prev,
          pricePaid: e.target.value ? Number(e.target.value) : undefined,
        }))
      }
      placeholder="$"
    />
  </div>
) : (
  <div className="space-y-2">
    <Label htmlFor="targetPrice">Target</Label>
    <Input
      id="targetPrice"
      type="number"
      value={formData.targetPrice ?? ''}
      onChange={(e) =>
        setFormData((prev) => ({
          ...prev,
          targetPrice: e.target.value ? Number(e.target.value) : undefined,
        }))
      }
      placeholder="$"
    />
  </div>
)}
```

**ConfirmStep adaptation:** ConfirmStep collapses this two-branch pattern into a single controlled `<Input>` with a flipping label (single `price` prop per CONTEXT D-03). The blank-to-undefined idiom (`e.target.value ? Number(e.target.value) : undefined`) is copied verbatim:
```typescript
<div className="space-y-2">
  <Label htmlFor="confirm-price">{isOwned ? 'Price paid' : 'Target price'}</Label>
  <Input
    id="confirm-price"
    type="number"
    value={price ?? ''}
    onChange={(e) => onPriceChange(e.target.value ? Number(e.target.value) : undefined)}
    placeholder="$"
  />
</div>
```
Label text differs from WatchForm ("Price paid" / "Target price" vs. "Paid" / "Target") — copy is locked in CONTEXT Claude's Discretion.

---

#### 2c. Numeric blank-to-undefined idiom (year input)

**Source:** `src/components/watch/WatchForm.tsx:407-413`

```typescript
value={formData.marketPrice ?? ''}
onChange={(e) =>
  setFormData((prev) => ({
    ...prev,
    marketPrice: e.target.value ? Number(e.target.value) : undefined,
  }))
}
```

**ConfirmStep adaptation:** The year input reuses this idiom with a direct callback instead of a `setFormData` updater:
```typescript
<Input
  id="confirm-year"
  type="number"
  value={productionYear ?? ''}
  onChange={(e) => onProductionYearChange(e.target.value ? Number(e.target.value) : undefined)}
/>
```

---

#### 2d. 2-column input grid layout

**Source:** `src/components/watch/WatchForm.tsx:313`

```typescript
<CardContent className="grid gap-6 sm:grid-cols-2">
```

**ConfirmStep adaptation:** Same `sm:grid-cols-2` pattern but with `gap-3` (not `gap-6`) per UI-SPEC — lighter gap appropriate for inline-edit context vs. full form:
```typescript
<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
```
The `grid-cols-1` is explicit on mobile (WatchForm omits it because it's the Card's grid default — ConfirmStep uses a plain `<div>` wrapper that needs the explicit declaration).

---

### 3. Radiogroup Buttons → `src/components/settings/PrivacyToggleRow.tsx` + Extension to 3-State

**Closest analog:** `src/components/settings/PrivacyToggleRow.tsx`

---

#### 3a. `aria-checked` on `<button>` precedent

**Source:** `src/components/settings/PrivacyToggleRow.tsx:49-67`

```typescript
<button
  type="button"
  role="switch"
  aria-checked={optimisticValue}
  aria-label={label}
  disabled={pending}
  onClick={handleToggle}
  className={cn(
    'relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-150 disabled:opacity-60',
    optimisticValue ? 'bg-accent' : 'bg-muted',
  )}
>
```

**ConfirmStep adaptation:** This is the codebase proof that `aria-checked` on a `<button>` element is the established project pattern. ConfirmStep extends 2-state `role="switch"` to 3-state `role="radio"` within a `role="radiogroup"`. The `cn(...)` conditional class composition pattern is identical — swap `optimisticValue ? 'bg-accent' : 'bg-muted'` for `status === value && 'border-primary bg-primary/10'`.

Key differences:
- `role="switch"` (2-state boolean) → `role="radio"` (exclusive selection from a set)
- Single raw `<button>` → `<Button variant="outline">` shadcn primitive
- `aria-checked={optimisticValue}` → `aria-checked={status === value}` (always explicitly `true` or `false`, never `undefined`)
- Add `tabIndex={status === value ? 0 : -1}` (roving tabindex — absent from PrivacyToggleRow because a single toggle is always tabbable)

---

#### 3b. Radiogroup wrapper + button group structure

**Source:** CONTEXT D-04 + WAI-ARIA 1.2 + PrivacyToggleRow.tsx:49 pattern extended

```typescript
// Module scope (not inline JSX):
const OPTIONS = [
  { value: 'owned',    label: 'Owned'    },
  { value: 'wishlist', label: 'Wishlist' },
  { value: 'grail',   label: 'Grail'    },
] as const

// In JSX:
<div
  role="radiogroup"
  aria-label="Watch status"
  id="confirm-status-group"
  className="flex gap-2"
  onKeyDown={handleKeyDown}
>
  {OPTIONS.map(({ value, label }) => (
    <Button
      key={value}
      type="button"
      role="radio"
      aria-checked={status === value}
      tabIndex={status === value ? 0 : -1}
      variant="outline"
      className={cn(
        'min-h-[44px]',
        status === value && 'border-primary bg-primary/10',
      )}
      onClick={() => onStatusChange(value)}
    >
      {value === 'grail' ? (
        <span className="inline-flex items-center gap-1.5">
          <Star className="size-4" aria-hidden />
          Grail
        </span>
      ) : (
        label
      )}
    </Button>
  ))}
</div>
```

**Adaptations needed:** `min-h-[44px]` override is required (Button default is `h-8` = 32px, below WCAG 2.5.5 44px tap-target floor per UI-SPEC). The `onKeyDown` handler for roving tabindex is locked IN by UI-SPEC (not deferred) — see 68-RESEARCH.md Pattern 2 for the full 10-line `handleKeyDown` implementation.

---

### 4. WatchIcon Placeholder → `src/components/watch/WatchPhotoSection.tsx`

**Closest analog:** `src/components/watch/WatchPhotoSection.tsx`

---

#### 4a. WatchIcon placeholder in a sized container

**Source:** `src/components/watch/WatchPhotoSection.tsx:475-477`

```typescript
<div className="flex h-full w-full items-center justify-center">
  <WatchIcon className="h-16 w-16 text-muted-foreground/40" aria-hidden />
</div>
```

**Import convention** (WatchPhotoSection.tsx header — import alias confirmed):
```typescript
import { Watch as WatchIcon } from 'lucide-react'
```

**ConfirmStep adaptation:** Reuse verbatim inside the `size-20` cover slot. The container is the outer `size-20 rounded-md bg-muted overflow-hidden flex-shrink-0` div that VerdictStep uses for the image slot. The inner centering div + icon are copied exactly:
```typescript
<div className="size-20 rounded-md bg-muted overflow-hidden flex-shrink-0">
  {coverUrl ? (
    <Image src={coverUrl} alt={brandModel} width={80} height={80}
           className="object-cover w-full h-full" unoptimized />
  ) : (
    <div className="flex h-full w-full items-center justify-center">
      <WatchIcon className="h-16 w-16 text-muted-foreground/40" aria-hidden />
    </div>
  )}
</div>
```

CSS chain: container is 80×80px (`size-20`). Icon is 64×64px (`h-16 w-16`). Inner div centers via `flex items-center justify-center` — 8px breathing room on each side. `overflow-hidden` on the container clips any image overflow. `flex-shrink-0` prevents the cover from collapsing in the flex row with the identity text block.

---

### 5. `src/components/watch/ConfirmStep.test.tsx` → `src/components/watch/VerdictStep.test.tsx` (test analog)

**Closest analog:** `src/components/watch/VerdictStep.test.tsx`

---

#### 5a. File header + imports + mock block

**Source:** `src/components/watch/VerdictStep.test.tsx:1-24`

```typescript
/**
 * Phase 20.1 Plan 01 (Wave 0) — RED test scaffold for VerdictStep.
 *
 * Covers verdict-ready visuals: spec preview + CollectionFitCard + 3 buttons +
 * D-06 empty-collection fallback.
 *
 * RED until Plan 03 ships `@/components/watch/VerdictStep`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/components/insights/CollectionFitCard', () => ({
  CollectionFitCard: ({ verdict }: { verdict: { headlinePhrasing?: string } }) => (
    <div data-testid="cfc">{verdict.headlinePhrasing}</div>
  ),
}))
vi.mock('next/image', () => ({
  default: (p: { src: string; alt: string }) => <img src={p.src} alt={p.alt} />,
}))

// IMPORT UNDER TEST — Plan 03 ships this.
import { VerdictStep } from '@/components/watch/VerdictStep'
```

**ConfirmStep.test.tsx adaptation:**
- File header JSDoc: reference "Phase 68" + the 15 test cases (a)-(o)
- No `CollectionFitCard` mock needed
- Keep `vi.mock('next/image', ...)` exactly — same stub pattern
- Import under test: `import { ConfirmStep } from '@/components/watch/ConfirmStep'`
- No additional mocks required (no router, no server action, no optimistic hook)

---

#### 5b. Props fixture + `vi.fn()` callbacks

**Source:** `src/components/watch/VerdictStep.test.tsx:26-41` (fixtureExtracted + fixtureVerdict) + `VerdictStep.test.tsx:92-105` (vi.fn() callback pattern)

```typescript
const fixtureExtracted: ExtractedWatchData = {
  brand: 'Omega',
  model: 'Speedmaster',
  imageUrl: 'https://example.com/spd.jpg',
}

// In test body:
const onWishlist = vi.fn()
const onCollection = vi.fn()
const onSkip = vi.fn()
render(<VerdictStep ... onWishlist={onWishlist} ... />)
fireEvent.click(screen.getByRole('button', { name: 'Add to Wishlist' }))
expect(onWishlist).toHaveBeenCalledTimes(1)
```

**ConfirmStep.test.tsx adaptation:** Declare a `BASE_PROPS` fixture constant with all required props set to safe defaults + all callbacks as `vi.fn()`:
```typescript
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
```
Individual tests spread `BASE_PROPS` and override what they need. `beforeEach(() => vi.clearAllMocks())` follows VerdictStep.test.tsx:44.

---

#### 5c. `describe`/`it` block shape + `fireEvent` + `screen` queries

**Source:** `src/components/watch/VerdictStep.test.tsx:43-136`

```typescript
describe('Phase 20.1 Plan 03 — VerdictStep verdict-ready render', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('renders spec preview brand+model, the CollectionFitCard headline, and 3 named buttons', () => {
    render(<VerdictStep ... />)
    expect(screen.getByText('Omega Speedmaster')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add to Wishlist' })).toBeInTheDocument()
  })

  it('pending=true with pendingTarget="wishlist" — Wishlist shows Saving... and all 3 buttons disabled', () => {
    render(<VerdictStep ... pending={true} pendingTarget="wishlist" ... />)
    expect(screen.getByText(/Saving/i)).toBeInTheDocument()
    const buttons = screen.getAllByRole('button')
    buttons.forEach((b) => expect(b).toBeDisabled())
  })
})
```

**ConfirmStep.test.tsx adaptation:** Group the 15 cases into `describe` blocks by concern matching CONTEXT Claude's Discretion:
- `describe('ConfirmStep — cover photo (CONF-01)')` → cases (a), (b), (c)
- `describe('ConfirmStep — status picker (CONF-03/04/08)')` → cases (d), (e), (f), (g), (h), (o)
- `describe('ConfirmStep — price field (CONF-06)')` → case (i)
- `describe('ConfirmStep — inline inputs (CONF-05)')` → cases (j), (k)
- `describe('ConfirmStep — action affordances (CONF-07/09)')` → cases (l), (m)
- `describe('ConfirmStep — pending state')` → case (n)

Use `screen.getByRole('radio', { name: 'Owned' })` to query radiogroup options (ARIA role is `radio` per D-04, not `button`). Use `screen.getByRole('button')` for CTA + ghost buttons. For aria-checked assertions: `expect(ownedBtn).toHaveAttribute('aria-checked', 'true')`.

---

## Shared Patterns

### `'use client'` + named export (no default)

**Source:** `src/components/watch/VerdictStep.tsx:1` + `src/components/watch/VerdictStep.tsx:47`
**Apply to:** `ConfirmStep.tsx`

```typescript
'use client'
// ... imports ...
export function ConfirmStep({ ... }: ConfirmStepProps) {
```

Every non-page file in `src/components/watch/` uses named export. Only page-level files use `export default`. `'use client'` is required because ConfirmStep has onClick handlers, controlled inputs, and an interactive radiogroup.

---

### `cn()` for conditional class composition

**Source:** `src/components/settings/PrivacyToggleRow.tsx:3` + usage at lines 56-59
**Apply to:** `ConfirmStep.tsx` (radiogroup selected-state, any other conditional classes)

```typescript
import { cn } from '@/lib/utils'
// Usage:
className={cn(
  'min-h-[44px]',
  status === value && 'border-primary bg-primary/10',
)}
```

---

### `next/image` mock for Vitest

**Source:** `src/components/watch/VerdictStep.test.tsx:17-19`
**Apply to:** `ConfirmStep.test.tsx`

```typescript
vi.mock('next/image', () => ({
  default: (p: { src: string; alt: string }) => <img src={p.src} alt={p.alt} />,
}))
```

Must be declared before the component import. Tests run in jsdom (no `@vitest-environment node` needed — ConfirmStep is a DOM presenter, not a filesystem walker).

---

## No Analog Found

No files in Phase 68 are without an analog. Every pattern has a direct codebase precedent.

The only net-new construct is the WAI-ARIA 3-element `role="radiogroup"` with roving tabindex — the 2-element `role="switch"` precedent (`PrivacyToggleRow.tsx:52`) is a partial match. The extension from 2-state to 3-state is straightforward: add `role="radiogroup"` wrapper, change `role="switch"` to `role="radio"` on each button, add `tabIndex` roving, add `onKeyDown` arrow-key handler. 68-RESEARCH.md Pattern 2 provides the full implementation to copy.

---

## Adaptations Summary (per file)

### `ConfirmStep.tsx` — adaptations from VerdictStep.tsx

1. Import block: add `Star`, `Watch as WatchIcon`, `Input`, `Label`, `cn`; remove `CollectionFitCard`, flow types
2. Props interface: replace entirely with D-03 locked contract (13 props)
3. Component body: add `isOwned = status === 'owned'` and `coverUrl = catalogImageUrl ?? extractedImageUrl ?? null`
4. Cover photo slot: always render the `size-20` container; show `<Image>` when `coverUrl` is set, `<WatchIcon>` placeholder when not (VerdictStep conditionally skips the container entirely — ConfirmStep does not)
5. Identity block: remove `extracted.reference` read-only `<p>`; reference becomes an inline `<Input>` outside the Card (Section 2)
6. Middle section: replace `<CollectionFitCard>` / fallback copy with radiogroup + price field
7. `SpecHeadline` signature: change from `{ data: ExtractedWatchData }` to `{ movement?, caseSizeMm?, dialColor? }`
8. Button row: reduce from 3 terminal actions to 2 ghost buttons + 1 primary CTA; primary CTA label from `CTA_LABELS[status]` lookup table at module scope

### `ConfirmStep.test.tsx` — adaptations from VerdictStep.test.tsx

1. No `CollectionFitCard` mock
2. `BASE_PROPS` fixture replaces `fixtureExtracted` / `fixtureVerdict` (all 13 props + all `vi.fn()` callbacks)
3. Query radiogroup options via `screen.getByRole('radio', { name: '...' })` not `getByRole('button', { name: '...' })`
4. 15 test cases (a)-(o) replace VerdictStep's 6 test cases
5. `aria-checked` attribute assertion: `expect(btn).toHaveAttribute('aria-checked', 'true')`

---

## Metadata

**Analog search scope:** `src/components/watch/`, `src/components/settings/`
**Files read:** 5 (VerdictStep.tsx, VerdictStep.test.tsx, WatchForm.tsx partial, PrivacyToggleRow.tsx, WatchPhotoSection.tsx partial)
**Pattern extraction date:** 2026-05-29

---

## PATTERN MAPPING COMPLETE

**Phase:** 68 - ConfirmStep Component
**Files classified:** 2
**Analogs found:** 4 / 4

### Coverage
- Files with exact analog: 2 (ConfirmStep.tsx → VerdictStep.tsx; ConfirmStep.test.tsx → VerdictStep.test.tsx)
- Files with role-match analog (specific patterns): 3 (WatchForm.tsx price-gating; PrivacyToggleRow.tsx aria-checked; WatchPhotoSection.tsx WatchIcon)
- Files with no analog: 0

### Key Patterns Identified
- ConfirmStep is a structural mirror of VerdictStep: `aria-live="polite"` root, `space-y-6` section rhythm, Card cover-photo block with `size-20 rounded-md bg-muted overflow-hidden flex-shrink-0`, `Loader2 size-4 mr-2 animate-spin` pending CTA, `flex flex-col gap-2 sm:flex-row sm:gap-3` button row
- Price field and numeric blank-to-undefined idiom copy verbatim from WatchForm.tsx:304+407-451; `isOwned = status === 'owned'` is the exact conditional
- Radiogroup extends PrivacyToggleRow's `aria-checked` on `<button>` from 2-state `role="switch"` to 3-state `role="radio"` within `role="radiogroup"`; roving `tabIndex` and `onKeyDown` are the net-new additions
- Test file structure (mocks, `vi.fn()` fixtures, `fireEvent`+`screen` queries, `describe`/`it` grouping) is a direct copy of VerdictStep.test.tsx conventions

### File Created
`.planning/phases/68-confirmstep-component/68-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. Planner can now reference analog patterns in PLAN.md files.
