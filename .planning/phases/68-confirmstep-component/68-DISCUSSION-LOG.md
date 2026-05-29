# Phase 68: ConfirmStep Component - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-29
**Phase:** 68-confirmstep-component
**Mode:** `--auto` (single-pass; recommended option auto-selected per area; no AskUserQuestion calls)
**Areas discussed:** component file & naming, pure-presenter contract, status-picker primitive, grail icon placement, cover-photo fallback chain, inline-edit shape, inline-edit × Phase 67 D-10 interaction, "Edit details" affordance, CTA label mapping + "Start over", initialStatus default semantics

---

## Component file & naming (D-01/D-02)

| Option | Description | Selected |
|--------|-------------|----------|
| New `src/components/watch/ConfirmStep.tsx` sibling of VerdictStep | Matches add-flow grouping; co-located test file `.test.tsx`; PascalCase per CONVENTIONS.md; named export | ✓ |
| New `src/components/watch/confirm/ConfirmStep.tsx` in a sub-folder | Adds a new sub-folder to `watch/` — no precedent in the dir (`watch/` is flat) | |
| Extend `VerdictStep.tsx` with a confirm-mode prop | Couples two pages of behavior in one file; VerdictStep is slated for deletion in Phase 70 | |

**Auto-selected:** new sibling file matching established pattern. **Notes:** Do NOT modify or delete VerdictStep here — Phase 70 owns the state-machine swap.

---

## Pure-presenter contract (D-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Pure presenter: props in, callbacks out, zero internal state | Mirrors VerdictStep / RecentlyEvaluatedRail / ExtractErrorCard pattern; Phase 70 owns orchestration | ✓ |
| ConfirmStep owns local form state, parent receives a final payload on CTA click | Couples form-state ownership inside the presenter; harder to test in isolation | |
| Hybrid: parent owns status + price; ConfirmStep owns reference + year locally | Splits state ownership across the boundary — confusing for the orchestrator | |

**Auto-selected:** pure presenter with locked prop contract (full TypeScript interface inlined in CONTEXT.md D-03). **Notes:** Phase 70 wires against this contract; any future expansion belongs in Phase 70's AddWatchFlow rewrite.

---

## Status-picker primitive (D-04)

| Option | Description | Selected |
|--------|-------------|----------|
| `<div role="radiogroup">` with 3 `<button role="radio" aria-checked>` children | CONF-03 says "button group" verbatim; aria-checked is the WAI-ARIA radio pattern; PrivacyToggleRow precedent for aria-checked on raw buttons | ✓ |
| shadcn `<Tabs>` (same primitive `StatusToggle` uses) | Tabs = view selector, NOT form input; SR users hear "tab" — wrong affordance | |
| `<Select>` dropdown | Hides options; CONF-03 explicitly wants segmented button group visible | |
| Native `<input type="radio">` x3 | Hard to style consistently; doesn't match the segmented-button visual contract | |

**Auto-selected:** `role="radiogroup"` with `<Button>` children. **Notes:** Arrow-key roving tabindex is planner-discretion / deferrable to Phase 70 polish — aria-checked semantics are mandatory for CONF-03 a11y.

---

## Grail icon placement (D-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Inline `<Star className="size-4" aria-hidden />` before the "Grail" text inside the option button | CONF-04 verbatim; matches VerdictStep's `Loader2 size-4 mr-2` icon-then-text token | ✓ |
| Star icon to the RIGHT of the "Grail" label | CONF-04 doesn't specify side; left-of-text is the prevailing icon-then-text convention in the codebase | |
| Star as a corner badge on the button | Changes visual weight; CONF-04 says "option weight/size unchanged" | |

**Auto-selected:** inline left-of-text Star. **Notes:** Owned + Wishlist options stay text-only — CONF-04 singles out Grail as the visually-distinguished one.

---

## Cover-photo fallback chain (D-06)

| Option | Description | Selected |
|--------|-------------|----------|
| Separate `catalogImageUrl?` and `extractedImageUrl?` props; render branch in render | Pure presenter ignores extraction discriminant; Phase 70 owns which is set | ✓ |
| Single `coverImageUrl?` prop pre-resolved by parent | Pushes fallback ordering knowledge to the parent — CONF-01 makes the order explicit at THIS layer | |
| Pass an array of fallback URLs in priority order | Over-engineered for a 3-tier static fallback | |

**Auto-selected:** two separate props; render-time branch with `WatchIcon` placeholder when both are null. **Notes:** Reuse exact `<Image>` props from `VerdictStep.tsx:65-73` (`unoptimized`, `size-20`, `rounded-md bg-muted overflow-hidden`); reuse `WatchIcon` empty-state styling from `WatchPhotoSection.tsx` (`h-16 w-16 text-muted-foreground/40`).

---

## Inline-edit shape (D-07)

| Option | Description | Selected |
|--------|-------------|----------|
| Plain `<Input>` for reference, `<Input type="number">` for year; controlled by props; blank-to-undefined for year | Mirrors `WatchForm.tsx:408-413` numeric input idiom; no auto-formatting | ✓ |
| Inline-edit popover (click chip → opens edit popover) | Heavier; CONF-05 says "inline-editable text inputs" — plain input is the literal read | |
| Use `contentEditable` on the text spans | Non-standard; no `contentEditable` precedent in the codebase | |

**Auto-selected:** plain `<Input>` + `<Input type="number">`, controlled, 2-col grid. **Notes:** Validation is Server-Action Zod's job — ConfirmStep accepts anything stringly.

---

## Inline-edit × Phase 67 D-10 interaction (D-08)

| Option | Description | Selected |
|--------|-------------|----------|
| Keep reference input enabled; document that catalog-bound rows have server override per Phase 67 D-10 | User can still see + edit; year edits always persist (year is NOT in the override tuple); minor user-visible behavior is documented for Phase 70 follow-up if confusion surfaces | ✓ |
| Disable / read-only reference input when a `catalogId` is bound | Requires a new prop ConfirmStep doesn't otherwise need; seed + CONF-05 both speak of inline-edit unconditionally | |
| Hide reference input entirely on catalog-bound rows | Breaks CONF-05 verbatim | |

**Auto-selected:** keep enabled; JSDoc the invariant. **Notes:** Phase 70 may revisit if UAT shows users editing reference on catalog rows and confused that the change didn't persist.

---

## "Edit details" affordance presentation (D-09)

| Option | Description | Selected |
|--------|-------------|----------|
| ConfirmStep emits `onEditDetails: () => void`; Phase 70 picks inline-expand or route-transition | CONF-07 explicit "(or expands inline)" ambiguity belongs to the orchestrator | ✓ |
| ConfirmStep renders WatchForm inline when `editing` state flips true | Couples ConfirmStep + WatchForm in a single render; locks Phase 70 out of routing | |
| ConfirmStep renders a link to `/watch/new?edit=1` | Hardcodes route shape inside the presenter | |

**Auto-selected:** callback only. **Notes:** Phase 70 implementation: `state.kind === 'edit-details-open'` → mount `<WatchForm mode="create" lockedStatus={undefined} watch={prefill}>` per CONF-07.

---

## CTA label mapping + "Start over" (D-10)

| Option | Description | Selected |
|--------|-------------|----------|
| Module-scope const `CTA_LABELS = { owned, wishlist, grail }`; primary CTA disabled + Loader2 on pending | Mirrors VerdictStep's `Loader2 mr-2 animate-spin` + "Saving..." precedent byte-for-byte | ✓ |
| Compute label inline in JSX with a ternary | Two-status ternary is fine; three statuses make it a chained ternary — less readable | |
| Use shadcn `<Button variant>` for the status-driven CTA | Variant maps to visual styling, not label — wrong knob | |

**Auto-selected:** module-scope constant lookup table; "Start over" as ghost variant disabled on pending. **Notes:** Full CTA row final layout deferred to UI-SPEC (run `/gsd-ui-phase 68` to lock).

---

## `initialStatus` default semantics (D-11)

| Option | Description | Selected |
|--------|-------------|----------|
| ConfirmStep requires `status` as a controlled prop with no internal default; Phase 70 resolves the `?status=` URL param + fallback | Keeps presenter strict; orchestrator owns URL-param resolution | ✓ |
| ConfirmStep defaults to `'wishlist'` when prop is undefined | Hides the default in the presenter; harder for Phase 70 to override | |
| ConfirmStep defaults to `'owned'` when prop is undefined | Wrong bias — add flow is for exploring/saving, not declaring ownership | |

**Auto-selected:** strict required prop. **Notes:** Phase 70 fallback recommendation (deferred): `initialStatus ?? 'wishlist'` matching `WatchForm.tsx:79`.

---

## Claude's Discretion

The following items were left for the planner / researcher to lock during PLAN.md or via UI-SPEC.md:

- **Layout of the CTA row** (primary full-width on mobile / flex-1 desktop; "Edit details" + "Start over" placement above-vs-beside primary CTA) — UI-SPEC concern.
- **Inclusion of a `SpecHeadline` sublabel** under brand/model identity (parity with VerdictStep) — planner picks; CONTEXT recommends (a) keep it for visual continuity.
- **Selected-state visual tokens** on the radiogroup buttons (`border-primary bg-primary/10` or similar) — planner picks from the codebase's existing token vocabulary.
- **Arrow-key roving-tabindex implementation** for the radiogroup — planner picks whether to implement in Phase 68 or defer to a Phase 70 polish task. ARIA semantics (aria-checked) are non-negotiable; keyboard nav is the polish layer.
- **Form vs div wrapper** — CONTEXT recommends `<div>` (no native form submit), but planner may pick `<form>` if WatchForm-expand wiring (CONF-07) suggests a single submit surface.
- **Icon-text gap token** for the Grail Star — CONTEXT cites `mr-1.5` / `gap-1.5`; planner picks from existing precedents.

## Deferred Ideas

- Phase 70 default-status fallback resolver (recommend `'wishlist'`).
- Phase 70 "Edit details" inline-expand vs route-change presentation.
- `CollectionFitCard` mount on ConfirmStep — out of scope per PROJECT.md "Verdict deliberately out of scope"; future revisit only if UAT shows degraded buy-decision quality.
- Year input min/max validation — server-side Zod is the single source; revisit if UAT shows confusion.
- Phase 67 D-10 typed error code from `addWatch` — already deferred in 67-CONTEXT.md.
- VerdictStep file + test deletion — owned by Phase 70 cutover; Phase 68 leaves both intact.
- Phase 70 radiogroup arrow-key polish task (if D-04 keyboard nav defers from Phase 68).
