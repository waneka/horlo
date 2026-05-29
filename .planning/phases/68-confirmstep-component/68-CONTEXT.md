# Phase 68: ConfirmStep Component - Context

**Gathered:** 2026-05-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Build a single new file — `src/components/watch/ConfirmStep.tsx` — that ships a **pure presenter** component the Phase 70 `AddWatchFlow` rewrite will mount in place of today's `VerdictStep`. ConfirmStep renders:

1. **Cover photo** at the top with a 3-tier fallback (`catalogImageUrl` → `extractedImageUrl` → lucide `WatchIcon` placeholder).
2. **Read-only watch identity** (brand / model / reference) with `reference` and `productionYear` as **inline-editable text inputs** (distinct affordance from "Edit details").
3. **Segmented status picker** (`owned` / `wishlist` / `grail`; `sold` intentionally absent), `grail` marked with a lucide `Star` icon inline next to the label.
4. **Status-gated price field** — `"Price paid"` for `owned`, `"Target price"` for `wishlist` / `grail` — reusing the same `isOwned = status === 'owned'` conditional WatchForm uses today.
5. **"Edit details" affordance** — a button that emits `onEditDetails` for the parent (Phase 70 owns whether it opens the full WatchForm inline or routes elsewhere; ConfirmStep does NOT make that choice).
6. **Primary CTA** with a status-driven label: `"Add to Collection"` (owned), `"Add to Wishlist"` (wishlist), `"Save as Grail"` (grail).
7. **"Start over"** escape that emits `onStartOver` — parent returns the user to search idle, no partial-data persistence.

Requirements delivered (10 of 11; CONF-11 shipped in Phase 67):

- **CONF-01** — Cover photo at top with the 3-tier fallback
- **CONF-02** — Brand / model / reference identity read-only by default
- **CONF-03** — Segmented status picker (button group) of owned / wishlist / grail; sold absent
- **CONF-04** — Grail option carries an inline lucide `Star` icon (option weight/size unchanged)
- **CONF-05** — Reference + year inline-editable text inputs (distinct from "Edit details")
- **CONF-06** — Status-gated price field (Price paid / Target price) using WatchForm's `isOwned` logic
- **CONF-07** — "Edit details" affordance opens the full WatchForm (or expands inline) — wiring is Phase 70's call; ConfirmStep emits the callback
- **CONF-08** — Primary CTA label reflects chosen status
- **CONF-09** — "Start over" escape returns user to search idle without persisting partial data — wiring is Phase 70's call; ConfirmStep emits the callback
- **CONF-10** — Status default derives from a `?status=` URL parameter — wiring is Phase 70's call; ConfirmStep accepts `initialStatus` prop

**Not this phase:**
- `VerdictStep` removal / `AddWatchFlow` state-machine rewrite (Phase 70 — depends_on Phase 68)
- `SearchEntry` + `StructuredEntryPanel` + module-scope cache hygiene (Phase 69 — depends_on Phase 67)
- URL plumbing for `?status=` (Phase 70 routes-glue)
- DUPE-01/02/03 redirects + "Move to Collection" UPDATE action (Phase 70)
- `CollectionFitCard` mounting on the confirm screen — verdict is **deliberately out of scope** for the add flow per PROJECT.md "Verdict deliberately out of scope" (see `project_verdict_hidden_on_owned_watches` memory rationale: verdict is a buy-decision tool, but the add screen is the buy-decision moment without yet a *target* row — the verdict lives on `/w/[ref]` only)
- Any change to today's `VerdictStep` file (leave intact; Phase 70 deletes it)
- Any Server Action / DAL changes (Phase 67 already shipped CONF-11 + DUPE-01/03 DAL primitives)

</domain>

<decisions>
## Implementation Decisions

### Component file & naming
- **D-01:** **New file `src/components/watch/ConfirmStep.tsx`** — sibling of `VerdictStep.tsx`, `PasteSection.tsx`, `WatchForm.tsx`. Matches the established add-flow component grouping (everything that participates in `AddWatchFlow` lives in `src/components/watch/`). PascalCase filename matches CONVENTIONS.md table. **DO NOT** delete or modify `VerdictStep.tsx` in this phase — Phase 70 owns the state-machine swap. ConfirmStep ships dormant (unmounted) until Phase 70 wires it. **Co-located test file:** `src/components/watch/ConfirmStep.test.tsx` next to it (matches `VerdictStep.test.tsx`, `WatchForm.lockedStatus.test.tsx`, `ExtractErrorCard.test.tsx` precedent — no separate `__tests__/` dir for component tests in `watch/`).
- **D-02:** **Named export `function ConfirmStep(...)`**, no default export — matches `VerdictStep`, `PasteSection`, `WatchForm`, `WatchPhotoStep` precedent (only page components use `export default`). Top-of-file `'use client'` directive — segmented picker + inline inputs + CTA + onClick handlers are all interactive client surface.

### Pure-presenter contract (mirrors VerdictStep)
- **D-03:** **Pure presenter. All state lives in props + callbacks. No `useState`, no fetch, no Server Action call, no router.push.** Mirrors `VerdictStep`'s contract (props in → events out). Phase 70's `AddWatchFlow` owns the orchestrator state machine and threads the values + handlers down. Concrete prop shape (locked here so Phase 70 wires against a stable contract):

  ```ts
  interface ConfirmStepProps {
    /** Catalog row imageUrl when this watch resolved via search-pick (Phase 67 / D-10). */
    catalogImageUrl?: string | null
    /** Extracted-data imageUrl from the structured / URL extractor (Phase 66). */
    extractedImageUrl?: string | null
    /** Read-only brand (from catalog row when catalogId is bound; from extracted data otherwise). */
    brand: string
    /** Read-only model (same source rule as brand). */
    model: string
    /** Inline-editable reference (CONF-05). Controlled by parent; null/undefined renders empty. */
    reference: string | null | undefined
    onReferenceChange: (value: string) => void
    /** Inline-editable production year (CONF-05). Number for the controlled value, undefined when blank. */
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
    /** Pending state for the primary CTA (mirrors VerdictStep's `pending` + `pendingTarget` simplified to one CTA). */
    pending?: boolean
  }
  ```

  Notes for the planner: every event handler is a `() => void` or `(value) => void` — no React events leak out. The `pending` prop is the **only** transient state ConfirmStep cares about (it disables the CTA + swaps in a `Loader2` spinner identical to `VerdictStep`). The parent stays the sole owner of `pending` ↔ `addWatch` orchestration.

### Status picker primitive — `role="radiogroup"` button group (NOT shadcn `Tabs`)
- **D-04:** **Custom 3-button group inside a `<div role="radiogroup">` wrapper, each button `role="radio"` + `aria-checked={status === value}`.** Reasons (in order):
  1. CONF-03 verbatim says "segmented status picker (button group)" — picks **button group**, not tabs.
  2. `Tabs` (used in `StatusToggle`, `src/components/filters/StatusToggle.tsx:17`) is semantically a **view selector**, not a **form input**. SR users hear "tab" — wrong affordance.
  3. The `PrivacyToggleRow` precedent (`src/components/settings/PrivacyToggleRow.tsx:52`) already uses raw `<button>` + `aria-checked` for two-state switches; ConfirmStep extends that pattern to three states.
  4. `aria-checked` is the standard ARIA pattern for radio buttons in a group; `aria-pressed` + `role="button"` is for toggle buttons. The user picks ONE status from three — radio semantics.
  Each button is a `<Button variant="outline">` (shadcn) with a `cn(...)` selected-state class applied when `status === value`. Keyboard nav: Arrow keys move selection (per WAI-ARIA radiogroup pattern); Space/Enter activates. **Planner discretion:** keyboard nav can land as a small inline keydown handler on the wrapper or be deferred to a Phase 70 follow-up if testing time pressures. The aria attributes are non-negotiable for CONF-03 a11y; arrow-key nav is the polish layer.

### Grail icon placement
- **D-05:** **Inline lucide-react `Star` icon INSIDE the grail option button, immediately before the "Grail" text, `size-4` (matches the `Loader2 size-4 mr-2` precedent in `VerdictStep.tsx:112`), `aria-hidden`.** Same vertical height as the other two options — the icon does NOT widen the button or change visual weight per CONF-04. Use `mr-1.5` (or whatever the codebase already uses for icon-then-text inside buttons; planner picks the existing token). The other two options (`Owned`, `Wishlist`) render text-only — no balance icon needed (CONF-04 explicitly singles out Grail as the visually-distinguished option).

### Cover photo fallback chain — separate input props
- **D-06:** **Take `catalogImageUrl` and `extractedImageUrl` as separate optional string props.** ConfirmStep does NOT know how the photo arrived (search-pick vs URL extract vs structured extract). Phase 70 owns the discriminant and feeds in whichever values are populated.

  Render branch:
  ```
  catalogImageUrl  → <Image src={catalogImageUrl}  ... />
  else extractedImageUrl → <Image src={extractedImageUrl} ... />
  else            → <WatchIcon className="..." aria-hidden /> placeholder
  ```

  - `<Image>` uses `next/image` with `width={80} height={80} unoptimized` matching `VerdictStep.tsx:65-73` (the existing cover-photo idiom in the add flow). `alt={brandModel}` where `brandModel = [brand, model].filter(Boolean).join(' ') || 'Watch'`. Container is `size-20 rounded-md bg-muted overflow-hidden flex-shrink-0`.
  - The empty / placeholder branch reuses the `WatchPhotoSection` precedent: `<Watch as WatchIcon from 'lucide-react'>` with `className="h-16 w-16 text-muted-foreground/40"` centered. Container styling matches the photo branch (same `size-20` box, just centered icon inside).
  - **`unoptimized` reason:** matches `VerdictStep` precedent — catalog `imageUrl` and extracted `imageUrl` are arbitrary external URLs; `next/image` `remotePatterns` security check happens at the route level, not here. The pure presenter doesn't decide caching policy.

### Inline-editable reference + year — UX shape
- **D-07:** **Plain `<Input>` (shadcn) for reference, plain `<Input type="number">` for year.** Reference is `<Input value={reference ?? ''} onChange={...}>` — keep it simple, no auto-formatting (the catalog DAL handles normalization). Year is `<Input type="number" value={productionYear ?? ''} onChange={(e) => onProductionYearChange(e.target.value ? Number(e.target.value) : undefined)}>` — mirrors the `marketPrice` / `pricePaid` empty-string-to-undefined idiom in `WatchForm.tsx:408-413`. **No min/max validation in ConfirmStep** — Zod on the Server Action is the single source of truth (per WatchForm precedent). Label above each input: `"Reference"` and `"Year"`. **Layout:** inputs sit immediately below brand/model identity, in a 2-column grid (`grid grid-cols-1 gap-3 sm:grid-cols-2`) matching the WatchForm "Basic Information" layout for visual continuity.

### Inline-edit × Phase 67 D-10 interaction
- **D-08:** **Keep the reference input enabled — do NOT disable it on catalog-bound rows.** Phase 67 D-10 server-side overrides `parsed.data.brand`, `parsed.data.model`, and `parsed.data.reference` with `catalogRow.{brand,model,reference}` when `catalogId` is supplied. That means user edits to the `reference` input on a catalog-bound row are silently overridden by the Server Action. **This is the correct behavior** — the catalog row is canonical for identity; the user can still *see* what's stored without ConfirmStep needing branch logic. The `productionYear` field is NOT overridden by Phase 67 D-10 (year is not part of the (brand, model, reference) tuple) — so year edits always persist. **Document this in a JSDoc comment on the props block** so Phase 70's wiring and any future ConfirmStep refactor understands the invariant. **Alternative considered:** flip reference to read-only when a `catalogId` prop is supplied. Rejected because (a) it adds a prop ConfirmStep doesn't otherwise need, (b) the seed and CONF-05 both speak of reference as inline-editable without conditional carve-outs, and (c) users editing reference + saving + then noticing it didn't change is a tiny lesson, not a footgun. Phase 70 may revisit if UAT surfaces confusion.

### "Edit details" affordance — emit callback, don't decide presentation
- **D-09:** **ConfirmStep emits `onEditDetails: () => void`; the parent (Phase 70 / `AddWatchFlow`) decides whether that opens the WatchForm inline (expand-in-place) or replaces the screen (transition to a `WatchForm` mode).** CONF-07 says "opens `WatchForm` (or expands inline)" — the "or" is a deliberate ambiguity that belongs to the orchestrator, not the presenter. ConfirmStep ships only the **button + callback**. Visual: text button styled `variant="ghost"` (matches `VerdictStep.tsx:138` Skip button), label `"Edit details"`. Placement: between the inline-editable inputs and the price field, OR below the price field next to "Start over" — **planner picks based on UI-SPEC.md** (run `/gsd-ui-phase 68` to generate the contract). When the parent calls back via `onEditDetails`, Phase 70 is free to: (a) mount `<WatchForm mode="create" />` with all extracted/catalog data pre-filled and `lockedStatus` NOT set (per CONF-07), or (b) push to a different in-flow state. **NEITHER decision lives in Phase 68.**

### CTA label mapping + "Start over"
- **D-10:** **CTA label via a local lookup table — `CTA_LABELS = { owned: 'Add to Collection', wishlist: 'Add to Wishlist', grail: 'Save as Grail' } as const`** declared at module scope. Primary CTA: `<Button onClick={onPrimary} disabled={pending} className="w-full sm:flex-1">{pending ? <><Loader2 className="size-4 mr-2 animate-spin" aria-hidden /> Saving...</> : CTA_LABELS[status]}</Button>` — mirrors `VerdictStep.tsx:103-118` so the disabled + pending visuals are byte-identical to the flow the user already knows. "Start over" is a secondary button styled `variant="ghost"`, label `"Start over"`, `onClick={onStartOver}`, disabled when `pending`. **Layout for the CTA row:** primary CTA full-width on mobile, flex-1 on desktop; "Edit details" + "Start over" sit as ghost buttons either above (more conservative) or beside the primary CTA — final placement deferred to UI-SPEC.

### Default `initialStatus` semantics (CONF-10 / Phase 70 thread)
- **D-11:** **ConfirmStep does NOT own the initial-status default — it just receives `status` as a controlled prop from Phase 70.** Phase 70 is responsible for resolving `initialStatus` (from `?status=` URL param, server-validated as `'wishlist'` per the existing Phase 25 D-05 pattern) **and** picking a fallback when the URL param is absent. **Recommended fallback for Phase 70** (carried into deferred ideas): `'wishlist'` — matches `WatchForm.tsx:79` initialFormData (`status: 'wishlist'`) and the seed's spirit that the add flow biases toward "exploring / saving" over "owning". ConfirmStep itself just accepts `status` as a required prop with no internal default — strict mode TypeScript enforces the contract.

### Claude's Discretion
- **Reference input `id`:** use `confirm-reference` (not `reference`) to avoid colliding with `WatchForm.tsx:347`'s `id="reference"` if both components ever mount on the same page (e.g. CONF-07 "expands inline" presentation). Same for `confirm-year`, `confirm-price`, `confirm-status-group`. Cheap collision avoidance.
- **Price input behavior:** mirror `WatchForm.tsx:419-451` — `<Input type="number" value={price ?? ''} onChange={(e) => onPriceChange(e.target.value ? Number(e.target.value) : undefined)} placeholder="$">`. Label is `<Label htmlFor="confirm-price">{status === 'owned' ? 'Price paid' : 'Target price'}</Label>` — single conditional, no two-input branch.
- **Spec headline sublabel:** `VerdictStep` renders a small `SpecHeadline` line under the brand/model identity (movement label · case size · dial color). ConfirmStep can either (a) accept an optional `spec: SpecHeadline` prop and render the same line for parity with VerdictStep, or (b) drop it entirely since the confirm screen is a review screen, not a verdict screen, and the user is about to edit. **Recommend (a)** — keep visual continuity with the pre-Phase-70 flow so the cutover doesn't feel like a regression. Planner picks. The `SpecHeadline` helper in `VerdictStep.tsx:151-159` is private — copy it inline, don't export-import (low LOC, presenter-local concern).
- **Form vs not-form wrapper:** wrap the inputs in a `<form>` element OR a plain `<div>` — the primary CTA fires `onPrimary` via onClick, no native form submit needed. **Recommend `<div>`** — VerdictStep is a div, and the parent (Phase 70) doesn't want form submission semantics conflicting with the WatchForm-expand path (CONF-07).
- **Test coverage targets** (`ConfirmStep.test.tsx`):
  - (a) Renders catalog cover when `catalogImageUrl` is set, even with `extractedImageUrl` also set (priority order, CONF-01)
  - (b) Renders extracted cover when only `extractedImageUrl` is set (CONF-01)
  - (c) Renders WatchIcon placeholder when neither image is set (CONF-01)
  - (d) Status picker shows exactly 3 options (owned / wishlist / grail), no 'sold' (CONF-03)
  - (e) Star icon appears next to "Grail" label, not next to owned/wishlist (CONF-04)
  - (f) Selecting "Owned" → `onStatusChange('owned')` fires once, CTA label updates to "Add to Collection" (CONF-08)
  - (g) Selecting "Wishlist" → CTA label "Add to Wishlist" (CONF-08)
  - (h) Selecting "Grail" → CTA label "Save as Grail" (CONF-08)
  - (i) Owned status → "Price paid" label; wishlist + grail → "Target price" label (CONF-06)
  - (j) Editing reference input fires `onReferenceChange` with new value (CONF-05)
  - (k) Editing year input parses to number; blank fires `undefined` (CONF-05)
  - (l) "Edit details" click fires `onEditDetails` (CONF-07)
  - (m) "Start over" click fires `onStartOver` (CONF-09)
  - (n) `pending=true` → primary CTA disabled + shows Loader2 + "Saving..." text (mirrors VerdictStep)
  - (o) Status picker `aria-checked` flips correctly across the three options (CONF-03 a11y)
- **Translation note for D-11 / Phase 70 wiring:** Phase 70 will need a default-status resolver. The simplest implementation: `initialStatus ?? 'wishlist'` at the parent. ConfirmStep should NOT carry this default.

### Folded Todos
None — no pending todos matched Phase 68 scope.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` §"Phase 68: ConfirmStep Component" — phase goal, depends-on (nothing; parallelizable with Phase 69; consumed by Phase 70), 5 success criteria
- `.planning/REQUIREMENTS.md` §"Confirm Screen + Status Selection (CONF)" items CONF-01..CONF-10 — full text + Phase 68 traceability
- `.planning/seeds/SEED-010-v5.3-add-watch-redesign.md` §"The Idea" #4 + §"Open Questions" #4 — milestone rationale: confirm screen REPLACES today's status-locking VerdictStep; status incl. grail picked here
- `.planning/PROJECT.md` "Verdict deliberately out of scope" — CollectionFitCard drops from the add flow; no verdict mount on ConfirmStep

### Cross-phase coordination (Phase 68 deliverable consumed by these)
- `.planning/phases/67-server-action-dal-extensions/67-CONTEXT.md` — Phase 67 SHIPPED `addWatch` `catalogId` extension (CONF-11) + DAL primitives; **D-10** (server overrides brand/model/reference when catalogId supplied) is the reason D-08 in this CONTEXT keeps the reference input enabled-but-effectively-overridden on catalog-bound rows
- `.planning/phases/66-api-route-extension/66-CONTEXT.md` — Phase 66 SHIPPED structured-input extraction; ConfirmStep receives `extractedImageUrl` regardless of which extraction mode produced it (Phase 70 dispatches)
- **Phase 70 (`AddWatchFlow` rewrite + DUPE wiring)** — primary consumer; mounts ConfirmStep in place of VerdictStep; owns initialStatus resolution, addWatch dispatch, route-on-commit. D-03's prop contract IS the contract Phase 70 wires against.
- **Phase 69 (`SearchEntry` + `StructuredEntryPanel`)** — parallel to Phase 68 (no shared file edits); produces the upstream surfaces that feed `catalogImageUrl` / `extractedImageUrl` / brand / model / reference into Phase 70 → ConfirmStep

### Existing presenter being mirrored
- `src/components/watch/VerdictStep.tsx` — the **pure-presenter pattern reference**; ConfirmStep mirrors its: props-in/callbacks-out shape, `<Image>` + container styling for the cover photo (`size-20 rounded-md bg-muted`), `Loader2` pending UI (`size-4 mr-2 animate-spin`), `aria-live="polite"` wrapper, mobile-first button row (`flex-col gap-2 sm:flex-row sm:gap-3`), private `SpecHeadline` helper. **DO NOT** modify VerdictStep in this phase — Phase 70 deletes it.

### Existing form being conditionally shared
- `src/components/watch/WatchForm.tsx:304` — `const isOwned = formData.status === 'owned'` — **the exact conditional ConfirmStep replicates** for the status-gated price label (CONF-06)
- `src/components/watch/WatchForm.tsx:419-451` — Price input controlled-component idiom (empty-string-to-undefined via `Number(e.target.value)`); ConfirmStep replicates verbatim
- `src/components/watch/WatchForm.tsx:42-71` — `WatchFormProps` interface — Phase 70 will mount `<WatchForm mode="create" lockedStatus={undefined} ...prefill />` from the `onEditDetails` callback (CONF-07: `lockedStatus` is NOT set so the user can still change status in the full form)
- `src/components/watch/WatchForm.tsx:75-109` — `initialFormData` — source of the `'wishlist'` default for Phase 70's `initialStatus` resolver (D-11 deferred)

### Constants + types
- `src/lib/types.ts:1` — `export type WatchStatus = 'owned' | 'wishlist' | 'sold' | 'grail'` — ConfirmStep's status union is the 3-element subset excluding `'sold'`
- `src/lib/constants.ts:131-135` — `WATCH_STATUSES` — full union; ConfirmStep does NOT iterate this (need to exclude 'sold' explicitly per CONF-03)

### Icon convention precedents
- `src/components/watch/WatchPhotoSection.tsx` — `import { Watch as WatchIcon } from 'lucide-react'` then `<WatchIcon className="h-16 w-16 text-muted-foreground/40" aria-hidden />` — **the established empty-state cover placeholder pattern**; ConfirmStep reuses verbatim
- `src/components/layout/NavWearButton.tsx:91` — `<Watch className="size-7 text-accent-foreground" aria-hidden />` — secondary precedent (different size token for nav)

### a11y / radiogroup precedents
- `src/components/settings/PrivacyToggleRow.tsx:52` — `aria-checked={optimisticValue}` on `<button>` — pattern for a single toggle; ConfirmStep extends to 3-element radiogroup
- `src/components/watch/WatchForm.tsx:695` — second `aria-checked` precedent on the notesPublic toggle

### Patterns NOT to confuse
- `src/components/filters/StatusToggle.tsx:17` — uses shadcn `Tabs` for the **view-selection** status filter on `/u/[username]/[tab]`. **DO NOT use this primitive** for ConfirmStep's picker — Tabs are semantically "view selector", picker is semantically "form input" (D-04).
- `src/components/watch/VerdictStep.tsx:101-146` — 3-button row is **flat buttons with disabled-when-pending**, not a radiogroup (each button is a terminal action, not a selection). ConfirmStep's picker is a different thing: selection THEN one terminal CTA.

### Auth + Server Action contract (referenced but not changed)
- `src/app/actions/watches.ts:79` — `addWatch` Server Action (Phase 70 calls; ConfirmStep does NOT — D-03)
- `src/lib/actionTypes.ts` — `ActionResult<T>` (Phase 70's concern)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`<Button>` + `<Input>` + `<Label>` shadcn primitives** (`src/components/ui/`) — all three used directly; no new ui primitive needed
- **`<Card>` + `<CardContent>`** (`src/components/ui/card.tsx`) — ConfirmStep's outer container mirrors VerdictStep's `<Card>` shell for the cover-photo + identity block; the picker + inputs + CTA row can sit in a sibling `<Card>` or a plain `<div>` (planner picks for visual hierarchy; UI-SPEC will lock)
- **`cn(...)` helper** (`@/lib/utils`) — used for the selected-state class swap on radiogroup buttons (`status === value && 'border-primary bg-primary/10'` or similar — planner picks tokens)
- **`Loader2` + `Star` from `lucide-react`** — Loader2 for pending CTA (VerdictStep precedent), Star for grail icon (CONF-04)
- **`Watch as WatchIcon` from `lucide-react`** — placeholder for the empty cover slot (matches WatchPhotoSection convention)
- **`MOVEMENT_LABELS` from `@/lib/constants`** — if D-Discretion-3 SpecHeadline parity is kept, this label map is the same one VerdictStep uses
- **`Image` from `next/image`** — `unoptimized` + fixed dims, mirrors VerdictStep's cover render

### Established Patterns
- **Pure-presenter pattern in `watch/`** — VerdictStep, RecentlyEvaluatedRail, ExtractErrorCard are all pure (props in, callbacks out, no `useState` beyond pure UI state like a controlled accordion). ConfirmStep extends this — Phase 70 owns orchestration; ConfirmStep ships only render + dispatch.
- **`aria-live="polite"` wrapper on add-flow steps** (`VerdictStep.tsx:60`) — repeat on ConfirmStep so status flips and CTA label updates announce without interruption.
- **Mobile-first stacked → desktop side-by-side button row** (`VerdictStep.tsx:102` — `flex flex-col gap-2 sm:flex-row sm:gap-3`) — use the same tokens for ConfirmStep's CTA row.
- **Status-conditional price field** (`WatchForm.tsx:304 + 419-451`) — `isOwned = status === 'owned'`; ConfirmStep replicates the exact same conditional (CONF-06 explicitly cites this).
- **Inline-editable numeric input with blank-to-undefined** (`WatchForm.tsx:408-413`) — pattern for the year + price inputs.
- **Co-located test files** (`src/components/watch/*.test.tsx`) — no `__tests__/` dir for components in this directory; tests sit next to the component.
- **PascalCase named export, no default** (every `src/components/watch/*.tsx` non-page file).

### Integration Points
- **Phase 70's `AddWatchFlow` rewrite** mounts ConfirmStep replacing the `state.kind === 'verdict-ready'` branch in `AddWatchFlow.tsx:542-553`. Phase 70 threads `addWatch` dispatch into `onPrimary`, routes the post-commit via the existing `defaultDestinationForStatus(status, viewerUsername)` helper (extending it: grail currently maps to `wishlist` tab per `src/lib/watchFlow/destinations.ts:46` — that already covers grail correctly so no change needed in Phase 68).
- **Phase 70 wires `onEditDetails`** to either an in-flow state transition (mount `<WatchForm>` with all data prefilled, `lockedStatus` NOT set per CONF-07) or a route change. ConfirmStep is agnostic.
- **Phase 70 wires `onStartOver`** to reset `AddWatchFlow` state to `{ kind: 'idle' }` and clear search query / URL state. ConfirmStep is agnostic.
- **Phase 67 D-10 invariant applies via Phase 70's `addWatch` call:** even if user edits the reference input on a catalog-bound row, the Server Action will override with catalogRow.reference. Document in ConfirmStep prop JSDoc (D-08).

</code_context>

<specifics>
## Specific Ideas

- **The `Star` icon position must match other option text vertically.** Use a flex container inside the grail button: `<span className="inline-flex items-center gap-1.5"><Star className="size-4" aria-hidden /> Grail</span>` — gap and size matched to VerdictStep's `<Loader2 className="size-4 mr-2" />` precedent so the icon doesn't dominate.
- **Cover photo container is exactly `size-20`** (matches `VerdictStep.tsx:65`). Don't introduce a new size token — the add flow already trains the user on this dimension.
- **CTA row gets `aria-live="polite"`** wrapping the entire ConfirmStep root (same as VerdictStep) so the dynamic CTA label change (`"Add to Wishlist"` → `"Save as Grail"`) announces to screen readers.
- **Watch icon placeholder dimensions** in the cover slot: `h-16 w-16` (so it has breathing room inside the `size-20` box matching WatchPhotoSection precedent) with `text-muted-foreground/40` opacity.
- **The radiogroup keyboard contract** (if implemented in this phase per D-04 planner-discretion): Left/Up → previous option, Right/Down → next option, Home → first, End → last, Space/Enter → activate. Roving tabindex (only the selected option has `tabIndex={0}`, others `tabIndex={-1}`).

</specifics>

<deferred>
## Deferred Ideas

- **`initialStatus` default fallback** — Phase 70 owns this. Recommend `'wishlist'` (matches `WatchForm.tsx:79` + seed direction). ConfirmStep stays default-less; the parent decides.
- **"Edit details" inline-expand vs route-change presentation** — D-09 keeps this Phase 70's call. The natural Phase 70 implementation: a `state.kind === 'edit-details-open'` branch in `AddWatchFlow` that mounts `<WatchForm mode="create" />` with all extracted/catalog data pre-filled per CONF-07. Inline-expand-without-state-change is also viable but couples ConfirmStep + WatchForm in a single render — Phase 70 decides.
- **`CollectionFitCard` mount on ConfirmStep** — Out of scope per PROJECT.md "Verdict deliberately out of scope." Future revisit IF user research shows the verdict's absence in the add flow degrades buy-decision quality. Today's stance: verdict lives on `/w/[ref]` only.
- **Year input min/max validation** — D-07 keeps validation server-side (Zod). If Phase 70 UAT surfaces "I typed 19" and wondered if it was 1919 or 2019, add a `min={1700} max={new Date().getFullYear() + 1}` then. Defer until needed.
- **Phase 70 follow-up — typed error code from `addWatch`** — already deferred in Phase 67 67-CONTEXT.md. ConfirmStep doesn't care about error shape (the parent handles toast on failure).
- **VerdictStep deletion** — owned by Phase 70 (state-machine swap + `AddWatchFlow.tsx:8` import removal + `VerdictStep.tsx` + `VerdictStep.test.tsx` `git rm`). Phase 68 leaves both files intact.
- **Phase 70 wiring of arrow-key roving tabindex on the radiogroup** — D-04 keeps this planner-discretion for Phase 68. If deferred, file a Phase 70 polish task.

### Reviewed Todos (not folded)
None — no pending todos matched Phase 68 scope.

</deferred>

---

*Phase: 68-confirmstep-component*
*Context gathered: 2026-05-29*
