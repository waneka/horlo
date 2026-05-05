---
phase: 28
slug: add-watch-flow-verdict-copy-polish
status: draft
shadcn_initialized: true
preset: base-nova
created: 2026-05-04
---

# Phase 28 — UI Design Contract

> Behavior + copy phase. Three coordinated changes: a Sonner action-slot toast (UX-09), `?returnTo=` capture/routing (ADD-08), and a verdict-copy speech-act split (FIT-06). No new visual surfaces, no new shadcn primitives. This contract locks the **interaction + copywriting deltas** — toast action slot, suppression rule, hint copy, and the voice rules for the 24+ planner-drafted strings.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (already initialized) |
| Preset | `base-nova` (per `components.json`) |
| Component library | Base UI (`@base-ui/react`) + shadcn primitives in `src/components/ui/` |
| Icon library | `lucide-react` |
| Font | Geist (sans) / Geist Mono (mono) — `next/font/google` in `src/app/layout.tsx` |
| Toast surface | `sonner` 2.0.7 via `ThemedToaster` (already mounted at layout root) |
| Color base | neutral (oklch palette in `src/app/globals.css`) |
| CSS variables | enabled (`cssVariables: true`) |
| Class merge | `cn()` (`src/lib/utils.ts`) |

**Phase scope re. design system:** Zero new dependencies (RESEARCH §"Standard Stack" verified). No new shadcn primitives. The Sonner action slot is part of the existing `sonner` package. Registry safety gate does not apply.

---

## Spacing Scale

Phase 28 introduces no new layout. Existing `ThemedToaster` Sonner defaults govern toast spacing; existing `WishlistRationalePanel` card spacing is unchanged. Listed for completeness — every value already in use:

| Token | Value | Usage in this phase |
|-------|-------|---------------------|
| 1 (4px) | 4px | n/a |
| 2 (8px) | 8px | Sonner toast internal padding (library default) |
| 4 (16px) | 16px | Sonner toast outer margin from viewport edge (library default) |
| 6 (24px) | 24px | `WishlistRationalePanel` card content `p-6` (UNCHANGED) |
| 8 (32px) | 32px | n/a |

**Exceptions:** none. Sonner's action button (the "View" CTA) renders at the library's default sizing, which Sonner builds against the same CSS variables our theme exposes. **No custom spacing override on the action slot** (D-03 — use built-in slot, not custom JSX).

**Touch target note:** Sonner's action button at default size is ≥44×44px effective tap area on touch viewports (Sonner pads its action region by design). No override needed.

---

## Typography

Phase 28 adds no new headings, no new font sizes, and no new font weights. It writes copy that lands inside three existing surfaces:

1. **Sonner toast** — toast body and action label inherit Sonner's defaults, which are bound to our `--font-sans` (Geist) via the theme prop on `<ThemedToaster>`.
2. **`WishlistRationalePanel` hint paragraph** — already styled `text-xs text-muted-foreground` (read at `WishlistRationalePanel.tsx:84`). UNCHANGED — only the literal copy below changes.
3. **Verdict descriptions / contextual phrasings / rationale phrasings** — render inside `CollectionFitCard` and other read sites at the typography Phase 20 already locked. UNCHANGED — only the literal strings change.

| Role | Size | Weight | Line Height | Used For (this phase) |
|------|------|--------|-------------|-----------------------|
| Body (toast message) | 14px (Sonner default, `text-sm` equivalent) | 400 | default (~1.5) | "Saved to your wishlist" / "Added to your collection" |
| Action label (toast button) | 14px (Sonner default) | 500 (medium — Sonner default) | default | "View" |
| Caption (hint paragraph) | 12px (`text-xs`) | 400 (`font-normal`) | default (~1.5) | `WishlistRationalePanel` hint below textarea |

**Sizes declared:** 2 (12 / 14). **Weights declared:** 2 (400 + 500 — Sonner's medium is the action-label default; we do not override it). Within the 3-4 sizes / 2 weights envelope.

**No mono usage** in any Phase 28 surface.

---

## Color

The `base-nova` preset (warm-neutral oklch palette) is already established. Phase 28 inherits — no token edits.

| Role | Token | Value (light) | Usage in this phase |
|------|-------|---------------|---------------------|
| Dominant (60%) | `--background` | `oklch(0.985 0.003 75)` | Page background under any toast/panel |
| Secondary (30%) | `--popover` / `--card` | `oklch(1 0 0)` | Sonner toast surface (`richColors=true` on `<ThemedToaster>` makes Sonner read theme tokens for surface) |
| Accent (10%) | `--accent` | `oklch(0.76 0.12 75)` | Reserved — see list below |
| Destructive | `--destructive` | `oklch(0.55 0.22 27)` | Reserved — see list below |
| Foreground | `--foreground` | `oklch(0.18 0.01 75)` | Toast message text, action label text |
| Muted foreground | `--muted-foreground` | `oklch(0.48 0.01 75)` | `WishlistRationalePanel` hint paragraph text |

**Accent (`--accent`) reserved for in this phase:**
1. Sonner action button (`View`) — Sonner's action slot uses the theme's primary tone for its button by default. With our preset, that resolves to a primary-foreground tone, NOT `--accent`. **Phase 28 does NOT introduce a new accent usage.** (RESEARCH §"Sonner action-slot rendering details" notes the styling is theme-driven; we accept Sonner's default, which uses `--primary` / `--primary-foreground`.)

**The toast action button MUST NOT be styled with a custom variant.** D-03 explicitly says use the built-in slot. If the planner discovers Sonner's default styling reads worse than expected against our theme, the fix is to adjust `richColors` / `theme` props on `<ThemedToaster>`, NOT to swap to custom JSX.

**Destructive (`--destructive`) reserved for:**
1. Sonner error toasts on Add-Watch commit failure (`toast.error(...)` inside `useFormFeedback`) — already wired in Phase 25. Phase 28 does NOT add new destructive surfaces.

**Color does NOT distinguish suppress-toast vs fire-toast.** When the suppress rule fires (D-05), the absence of a toast IS the signal. No "silent confirmation" UI element replaces it; the user simply lands on the destination tab and sees their watch in place.

---

## Copywriting Contract

This is the heart of Phase 28. Three classes of copy:

1. **Locked literals** — copy this contract pins. Planner uses verbatim.
2. **Voice rules + planner-drafted candidates** — the 24+ verdict strings (D-21). Contract pins voice rules + provides starter candidates. Planner finalizes in PLAN.md; user reviews at plan-check.
3. **Existing copy preserved** — Phase 25 / Phase 20.1 strings that stay byte-identical.

### Locked literals (planner copies verbatim)

| Element | Copy | Source |
|---------|------|--------|
| Toast message — wishlist commit | `Saved to your wishlist` | Phase 28 — matches Phase 25 voice (sentence-case, period-omitted on toast per Sonner convention) |
| Toast message — collection commit | `Added to your collection` | Phase 28 — verb-led, parallel to wishlist |
| Toast action label | `View` | D-01 (literal; `→` is iconographic, NOT part of label) |
| Toast — suppress when destination matches | (toast does not fire; no copy) | D-05 |
| `WishlistRationalePanel` textarea label | `Add a note (optional)` | EXISTING — unchanged (line 74) |
| `WishlistRationalePanel` Cancel button | `Cancel` | EXISTING — unchanged |
| `WishlistRationalePanel` Save button | `Save to Wishlist` | EXISTING — unchanged |
| `WishlistRationalePanel` Save button (pending) | `Saving...` | EXISTING — unchanged |
| `WishlistRationalePanel` hint (REWRITTEN) | `Pre-filled with why this watch fits — written as if you wrote it. Edit to make it yours, or clear it.` | Phase 28 — D-20 (matches new 1st-person rationale voice; replaces existing "Pre-filled from the fit verdict. Edit or clear as you like.") |
| `FormStatusBanner` success copy | `Saved` | EXISTING — locked by Phase 25 D-07 (DO NOT change) |
| `FormStatusBanner` error copy | `Could not save. Please try again.` | EXISTING — locked by Phase 25 |

**Hint copy rationale (D-20 elaboration).** The current hint ("Pre-filled from the fit verdict. Edit or clear as you like.") explicitly tells the user the source is a "verdict" — accurate when the source was `contextualPhrasings[0]` (a verdict-to-user message), but misleading once the source becomes `rationalePhrasings[0]` (a user-to-self rationale). The rewrite drops the word "verdict," foregrounds the 1st-person framing ("written as if you wrote it"), and keeps the "Edit or clear" affordance explicit. Verb-led, sentence-case, no exclamations.

### Voice rules — DESCRIPTION_FOR_LABEL (D-16)

**All 6 strings rewritten.** Voice direction (locked by D-16):

- **Verb-led sentence.** Starts with a verb or short observation phrase. Avoid bare adjective + noun ("Unusual for your collection") and bare label-ish noun phrases.
- **Tonally neutral or positive.** No dismissive, no judgmental. The similarity engine produced this label; the copy reports it.
- **Accurate to similarity-engine semantic.** Each label has a precise meaning (RESEARCH §"VerdictBundleFull" and `src/lib/types.ts` `SimilarityLabel` union). The copy must report that semantic, not a mood.
- **Descriptive enough to convey what the label means.** ≥6 words; one sentence; ends with a period.
- **Voice = system observation.** This is the verdict-to-user voice. NOT 1st-person.

**Length envelope:** 6–14 words per string. **Punctuation:** end with a period.

**Cross-label coherence rule:** all 6 strings in the same voice register. Even labels that already read verb-led today (`role-duplicate`, `hard-mismatch`) get rewritten so the cross-label voice is uniform. (Today's strings: 4 of 6 are bare-adjective phrases; 2 are verb-led. After rewrite: all 6 are verb-led.)

**Planner-drafted candidates** (not locked — planner refines in PLAN.md, user reviews at plan-check):

| Label | Today (bare) | Phase 28 candidate (verb-led, ≥6 words) | Engine semantic the copy must capture |
|-------|--------------|------------------------------------------|----------------------------------------|
| `core-fit` | `Highly aligned with your taste` | `Lines up cleanly with what you already like.` | High similarity to dominant taste centroid + matches stated preferences |
| `familiar-territory` | `Similar to what you like` | `Sits in territory you've already explored.` | Moderate-high similarity to existing collection items |
| `role-duplicate` | `May compete for wrist time` | `Plays a role you've already filled in your collection.` | High overlap with existing role/use-case slot |
| `taste-expansion` | `New but still aligned` | `Stretches your taste in a direction it's already leaning.` | Moderate similarity + aligned with stated growth direction |
| `outlier` | `Unusual for your collection` | `Stands apart from your collection but doesn't conflict.` | Low similarity + no negative-preference hit |
| `hard-mismatch` | `Conflicts with stated dislikes` | `Conflicts with styles you said you avoid.` | Low similarity + hits a stated negative-preference signal |

**Anti-patterns to avoid (D-16 rationale):**
- Bare-adjective phrases ("Unusual for your collection") — feels label-y, not informative.
- Dismissive tone words ("strange," "weird," "off") — the engine has not made a moral claim.
- Question forms ("Does this fit?") — verdict copy is declarative, not interrogative.
- Hedging adverbs ("maybe," "possibly") — the composer applies a `Possibly …` hedge prefix per `confidence ∈ [0.5, 0.7)` (D-19). Don't pre-hedge the base string or the hedge will double up.

### Voice rules — `rationaleTemplate` (12 entries) and `RATIONALE_FOR_LABEL` (6 entries) (D-17, D-18)

**Voice direction (locked by D-17):**

- **1st-person user-self.** "I want this because…" / "My collection has…" / "This fills…"
- **Statement of why they want it**, not observation about the engine's classification.
- **Same `${slot}` interpolation grammar** as `template`. Slot names match exactly (e.g., `${archetype}`, `${dominant}`, `${contrast}`, `${specific}`).
- **Predicate is unchanged.** `rationaleTemplate` fires whenever its parent `template` fires.
- **Length parity.** Within ±50% words of the parent template; if parent is 6 words, rationale is 4–9 words.
- **Hedge prefix `Possibly …` applies to BOTH `template` and `rationaleTemplate` strings** when confidence ∈ [0.5, 0.7) (D-19).

**Critical rule:** the rationale string must read coherently as a wishlist-note auto-fill. The user is going to see this string pre-filled into a textarea labeled "Add a note (optional)." If the string reads like the engine talking ("This watch overlaps with your Submariner"), the speech-act mismatch returns. The string must read like the user talking to themselves ("I already have a Submariner-shaped slot in my collection — this scratches a similar itch").

**Planner-drafted candidates for the 4 roadmap-locked TEMPLATES (FIT-02 lock — D-22 forbids predicate changes):**

| Template id | `template` (UNCHANGED) | `rationaleTemplate` candidate (planner draft) |
|-------------|------------------------|------------------------------------------------|
| `fills-a-hole` | `Fills a hole in your collection — your first ${archetype}.` | `My first ${archetype} — fills a real hole in what I own.` |
| `aligns-with-heritage` | `Aligns with your heritage-driven taste.` | `Heritage-driven, like the rest of what I'm drawn to.` |
| `collection-skews-contrast` | `Your collection skews ${dominant} — this is a ${contrast}.` | `My collection leans ${dominant}; this gives me a ${contrast} to balance it.` |
| `overlaps-with-specific` | `Overlaps strongly with your ${specific}.` | `Plays in the same space as my ${specific}.` |

**Planner-drafted candidates for the 8 supporting TEMPLATES** (and 6 `RATIONALE_FOR_LABEL` fallbacks): planner drafts in PLAN.md per the voice rules above. UI-SPEC does not enumerate to leave the planner room to refine. Voice constraints (1st-person, statement-of-why, slot-grammar parity, length parity, hedge-prefix compatibility) are non-negotiable.

**Anti-patterns to avoid (D-17 rationale):**
- 2nd-person address ("Your collection skews…") — that's the verdict voice, NOT the rationale voice.
- 3rd-person observation ("This watch fills a hole…") — same speech-act problem.
- Imperative ("Buy this because…") — never the user's interior voice.
- Marketing voice ("This grail completes the set!") — Horlo is a personal-collection tool, not a sales surface.

### Voice rules — toast message body

The toast body sits between the verdict voice and the rationale voice — it's a **system confirmation**. Sentence-case, verb-led past-participle, possessive 2nd-person, no period (Sonner convention):

- ✅ `Saved to your wishlist`
- ✅ `Added to your collection`
- ❌ `Watch saved!` (exclamation, no possessive)
- ❌ `You saved this watch.` (period; over-explanatory)
- ❌ `Successfully added` (adverb-led, missing direct object)

Parallel structure across both commit paths is the constraint: same prefix verb pattern, same possessive object.

### Destructive actions in this phase

**None.** Phase 28 has no delete, no overwrite, no irreversible commit. The Add-Watch commit creates a row; reversing it is a separate user action (delete from collection/wishlist) handled elsewhere. No confirm dialogs introduced. No copy needed.

### Voice consistency check

| Surface | Voice | Example |
|---------|-------|---------|
| Verdict (`DESCRIPTION_FOR_LABEL`, `template` strings) | System → user observation, 2nd-person | `Lines up cleanly with what you already like.` |
| Rationale (`RATIONALE_FOR_LABEL`, `rationaleTemplate` strings) | User → self statement, 1st-person | `My first dive watch — fills a real hole in what I own.` |
| Toast body | System confirmation, possessive 2nd-person, no period | `Saved to your wishlist` |
| Toast action label | Imperative verb, single word | `View` |
| Hint paragraph | System → user instruction, 2nd-person, sentence-case | `Pre-filled with why this watch fits — written as if you wrote it. Edit to make it yours, or clear it.` |
| `FormStatusBanner` (UNCHANGED) | System status, terse | `Saved` |

---

## Interaction Contract — Sonner Action-Slot Toast (UX-09)

This is the load-bearing interaction delta of Phase 28. Locked here so the executor has a single reference.

### Toast emission shape (D-03, D-04)

The hook (`useFormFeedback`) calls Sonner's built-in action slot — NOT custom JSX inside `toast.success(<>...</>)`.

```typescript
// useFormFeedback internal — D-04
toast.success(msg, {
  action: successAction
    ? {
        label: successAction.label,           // string (e.g., "View")
        onClick: () => router.push(successAction.href),
      }
    : undefined,
})
```

**Caller-facing API (D-04 — additive, optional):**

```typescript
formFeedback.run(action, {
  successMessage: 'Saved to your wishlist',
  successAction: { label: 'View', href: '/u/twwaneka/wishlist' },
})
```

Existing 8+ callers stay byte-identical (the `successAction` field is optional).

### Suppression rule (D-05) — interaction states

| Commit context | Post-commit landing | `successAction.href` | Toast fires? |
|----------------|---------------------|----------------------|--------------|
| AddWatchFlow Wishlist commit, `returnTo=null` | `/u/{username}/wishlist` (default) | `/u/{username}/wishlist` | NO — paths match (D-05) |
| AddWatchFlow Wishlist commit, `returnTo=/search?q=tudor` | `/search?q=tudor` | `/u/{username}/wishlist` | YES — paths differ |
| WatchForm Collection commit, `returnTo=null` | `/u/{username}/collection` (default) | `/u/{username}/collection` | NO — paths match |
| WatchForm Collection commit, `returnTo=/catalog/abc-123` | `/catalog/abc-123` | `/u/{username}/collection` | YES — paths differ |
| /search row Wishlist commit (inline) | (stays on /search) | `/u/{username}/wishlist` | YES — destination ≠ current |
| /catalog/[id] Wishlist commit (inline) | (stays on /catalog/[id]) | `/u/{username}/wishlist` | YES — destination ≠ current |

**Path comparison algorithm (D-06 elaboration):**

1. Resolve `successAction.href` to its canonical absolute form (e.g., `/u/me/wishlist` → `/u/twwaneka/wishlist` using `viewerUsername` resolved server-side at /watch/new per RESEARCH).
2. Resolve the post-commit landing path the same way.
3. Strip trailing slashes from both.
4. Compare strings (case-sensitive — Next.js routes are case-sensitive).
5. **Equal → suppress (no toast).** Different → fire toast with action.

**Suppress rule contract:** when suppressed, **no toast fires at all** — not the action toast, not a fallback "Saved" toast. The user lands on the destination page and sees their new watch in place; that IS the confirmation. (D-05 explicitly: "fire NO toast and pass NO action.")

### Keyboard accessibility (action button)

Sonner's action slot is a `<button>`. Keyboard interaction (verified against `node_modules/sonner/dist/index.d.ts` Action interface, RESEARCH):

| Key | Behavior |
|-----|----------|
| `Tab` | Focuses the action button when the toast region receives focus (Sonner manages focus traversal within the toast layer). |
| `Enter` / `Space` | Activates the button — fires `onClick` (which calls `router.push(href)`). |
| `Escape` | Dismisses the toast (Sonner default). Does NOT navigate. |

**Focus management on dismiss/click:**
- On `onClick` → `router.push(href)` — focus moves to the destination page's natural focus target (Next.js default).
- On `Escape` (manual dismiss) — focus returns to whatever element had focus when the toast appeared. Sonner handles this; we do not override.
- On 5s auto-dismiss — focus stays where it is. (The user did not interact with the toast; we do not steal focus.)

**Screen reader behavior:** Sonner emits `role="status"` (polite) for `toast.success` and `role="alert"` for `toast.error`. The action button is part of the same live region. The button's accessible name is its visible label ("View"); we do NOT add an `aria-label` override (no `aria-label` would replace the visible text, which Sonner already exposes via DOM text content).

### Iconographic chevron (D-01)

The visual `→` glyph on the action button is **iconographic, not part of the accessible name**. Implementation options for the planner (UI-SPEC permits either):

1. **Append `→` via Sonner's `actionButtonStyle` content / pseudo-element** — visually renders inside the button but does not enter the accessible name.
2. **Use `lucide-react` `ChevronRight` (or `ArrowRight`) inline before/after the label**, marked `aria-hidden="true"` so it does NOT enter the accessible name.

**Recommended:** option 2 (lucide `ArrowRight` at `size-4`, `aria-hidden="true"`, sibling to the label text inside the action slot). Matches `lucide-react` icon library declared in `components.json`. Sonner's action label accepts ReactNode (verified in RESEARCH against Sonner's `Action.label: React.ReactNode` type), so a `<><span>View</span><ArrowRight aria-hidden /></>` shape is permitted. **The accessible name remains exactly `"View"` per D-01.**

### Theme inheritance

Sonner is mounted via `ThemedToaster` (`src/components/ui/ThemedToaster.tsx`):

```typescript
<SonnerToaster theme={resolvedTheme} position="bottom-center" richColors />
```

- `theme` is bound to our custom `<ThemeProvider>` (NOT next-themes — Pitfall H-1, RESEARCH §"Sonner mount").
- `richColors` causes Sonner to use semantic theme tokens (success → `--success` / `--primary`; error → `--destructive`).
- `position="bottom-center"` is unchanged.

**The action button uses Sonner's theme-aware default styling.** If the planner implements option 2 above (lucide icon inside the button), use `text-current` on the icon so it inherits the action button's foreground color across light/dark themes.

### Auto-dismiss timing

| Toast type | Auto-dismiss |
|------------|--------------|
| Success WITHOUT action | 5000ms (existing `useFormFeedback` constant — D-16 from Phase 25) |
| Success WITH action | 5000ms (UNCHANGED — Sonner's action slot does not extend the timer; the action is a fast affordance, not a persistent invitation) |
| Error | persistent until next `run()` (existing — D-16 from Phase 25) |

**Rationale:** the action toast IS a "go now or don't" affordance. 5 seconds is the established Phase 25 timing; making the action toast longer would suggest the user owes the system a decision, which is not the affordance.

---

## Interaction Contract — `WishlistRationalePanel` (D-20)

Localized change. The component's render shape is UNCHANGED — only the data source for `defaultRationale()` and the literal hint string change.

### Source switch

```diff
 function defaultRationale(verdict: VerdictBundle | null): string {
   if (!verdict) return ''
   if (verdict.framing === 'self-via-cross-user') return ''
-  return verdict.contextualPhrasings[0] ?? ''
+  return verdict.rationalePhrasings[0] ?? ''
 }
```

The `framing === 'self-via-cross-user'` early-return-empty-string branch STAYS (D-20 — that empty-string contract is preserved across phases).

### Hint copy update

```diff
 <p id="wishlist-notes-hint" className="text-xs text-muted-foreground">
-  Pre-filled from the fit verdict. Edit or clear as you like.
+  Pre-filled with why this watch fits — written as if you wrote it. Edit to make it yours, or clear it.
 </p>
```

**`aria-describedby="wishlist-notes-hint"`** on the `<Textarea>` — UNCHANGED. The new copy is announced by the same accessible-name graph; screen readers receive the updated guidance with no markup change.

### Empty-textarea behavior (Pitfall 5)

UNCHANGED. The user can blank the textarea entirely; the verbatim blank value commits to notes. (`onConfirm(notes)` at line 67 sends `notes` as-is including `''`.) The hint copy reflects this with "or clear it" — explicit affordance for the blank-commit path.

### Auto-focus on mount

UNCHANGED. `useEffect` at line 60-62 still focuses the textarea on mount.

---

## Interaction Contract — `?returnTo=` (ADD-08, validation, focus restore)

Phase 28's routing/validation rules are exhaustively documented in CONTEXT.md (D-08..D-15) and RESEARCH.md (callsite audit, regex citation, validation flow). UI-SPEC scope is limited to the **user-perceivable** surface:

### Visible interaction states

| State | What the user sees |
|-------|---------------------|
| Click "Add a watch" from `/search?q=tudor` | URL changes to `/watch/new?returnTo=%2Fsearch%3Fq%3Dtudor` (the encoded value is technical detail; user does not interact with it). Add-Watch flow renders normally. |
| Commit Wishlist add | URL changes to `/search?q=tudor` (returnTo destination). Toast fires (paths differ). |
| Commit from `/u/twwaneka/wishlist` empty-state CTA | URL changes back to `/u/twwaneka/wishlist`. **Toast does NOT fire** (paths match — D-05). User sees their new watch in place. |
| Skip / Cancel during flow | UNCHANGED — stays in flow / restarts paste. `returnTo` is preserved on URL until explicit commit. |
| Browser back from /watch/new | UNCHANGED — natural history pop returns to entry point (no special handling needed). |

### Invalid `?returnTo=` value (security boundary)

When validation fails (D-11 — syntactic regex or self-loop guard), the user sees:
- Add-Watch flow renders normally (no error state, no banner, no message).
- On commit, post-commit landing falls back to D-13 default (`/u/{username}/{matching-tab}`).
- No copy is shown to explain the silent fallback. (RESEARCH justification: an invalid returnTo is either a tampering attempt or an internal bug; either way, surfacing it to the user adds attack surface and confuses honest users.)

**This contract DOES NOT introduce a "redirect blocked" toast or banner.** Falling back to default destination silently is the locked behavior.

### Focus restoration on post-commit nav

When the user commits and navigation fires:
- `router.push(dest)` triggers Next.js client-side nav.
- Next.js handles focus per its router defaults (focus moves to the new page's `<h1>` if present, else to `document.body`).
- **Phase 28 does NOT override this.** The toast (if it fires) is in the global `<ThemedToaster>` layer outside the page transition; Sonner's focus management for the action button is independent of route focus.

If the toast fires AND the user clicks "View":
- Toast button click → `router.push(href)` → Next.js focus-to-h1 on destination.
- Toast unmounts (Sonner handles via auto-dismiss timer or click → dismiss).
- Focus lands on the destination page's `<h1>` per Next.js default.

**No custom focus restoration logic needed.** The interaction stays inside Sonner + Next.js Router contracts that already work correctly.

---

## Component Inventory — what changes in this phase

| Component | Change | Visible UI delta |
|-----------|--------|-------------------|
| `src/lib/hooks/useFormFeedback.ts` | Add `successAction?: { label, href }` opt; import `useRouter`; pass `action: { label, onClick }` to `toast.success` when provided | Toasts gain optional action button |
| `src/components/ui/ThemedToaster.tsx` | NO EDIT | Sonner mount unchanged |
| `src/components/ui/FormStatusBanner.tsx` | NO EDIT (D-07) | Banner copy stays "Saved" / "Could not save…" |
| `src/components/watch/AddWatchFlow.tsx` | Add `initialReturnTo`, `viewerUsername` props; rewire `handleWishlistConfirm` to compute dest + suppress + toast | No visual delta during flow; toast/nav delta on commit |
| `src/components/watch/WatchForm.tsx` | Replace `router.push('/')` (line 209) with computed dest; pass `successAction` into `run()` | No in-form delta; toast/nav delta on commit |
| `src/components/watch/WishlistRationalePanel.tsx` | Source switch (line 45); hint copy update (line 86) | Pre-fill text changes per new voice; hint paragraph rewritten |
| `src/lib/verdict/templates.ts` | Add `rationaleTemplate` to all 12 TEMPLATES; rewrite all 6 DESCRIPTION_FOR_LABEL; add RATIONALE_FOR_LABEL | All verdict copy reads coherently in both voices |
| `src/lib/verdict/composer.ts` | Fill `rationalePhrasings` in lockstep with `contextualPhrasings` | No render-side delta — consumed by `WishlistRationalePanel` only |
| `src/lib/verdict/types.ts` | Add `rationalePhrasings: string[]` to `VerdictBundleFull`; add `rationaleTemplate: string` to `Template` | Type-only |
| Entry-point callsites (9 active per RESEARCH audit) | Append `?returnTo=` to /watch/new hrefs | URL gains query param; no visible UI delta |
| Read-side verdict consumers (`CollectionFitCard`, `VerdictStep`) | NO EDIT | Read same `contextualPhrasings`; new strings show through |

### New components

**None.** Phase 28 introduces zero new React components. All edits are in-place additions or copy rewrites.

---

## Component contracts (precise interaction guarantees)

### `useFormFeedback` (extended)

**New opt on `run()`:** `successAction?: { label: string; href: string }`

**Behavior contract:**
- When `successAction` is `undefined` → behaves byte-identically to today (success toast + 5s auto-dismiss + state→idle, no action button).
- When `successAction` is provided AND the success path fires → `toast.success(msg, { action: { label, onClick: () => router.push(href) } })`.
- When the success path fires but the caller has independently determined the suppress rule applies → caller MUST omit `successAction` AND opt out of `successMessage`. UI-SPEC recommendation: caller passes `{ successMessage: undefined, successAction: undefined }` in the suppress case so NO toast fires. (The hook does not implement the suppress rule itself — D-05 lives at the call site, where path comparison happens with full context.)
- The hook does NOT call `toast.success` when both `successMessage` and `successAction` are `undefined`. **Planner must add this short-circuit** OR caller passes `successMessage: ''` to suppress the toast emission. Recommended: short-circuit in the hook (cleaner API).

**Test contract additions (lockstep with D-22):**
- New test: `successAction` is forwarded to `toast.success` shape.
- New test: omitting `successAction` produces identical behavior to pre-Phase-28 callers.
- New test: `successMessage === undefined` AND `successAction === undefined` → no toast emission.
- Existing 25-06 tests: must remain green (no signature break).

### `WishlistRationalePanel` (modified)

- **Public props UNCHANGED.** `verdict`, `initialNotes`, `onConfirm`, `onCancel`, `pending` — all preserved.
- **Internal source switch only.** `defaultRationale()` reads `rationalePhrasings[0]` instead of `contextualPhrasings[0]`.
- **Behavioral contract preserved:** blank textarea commits as `''`; auto-focus on mount; verbatim onConfirm; `framing === 'self-via-cross-user'` → empty default.
- **Test additions:** verdict with `rationalePhrasings: ['I want this for X']` populates textarea with `'I want this for X'`; verdict with `rationalePhrasings: []` populates textarea with `''`; verdict with `framing === 'self-via-cross-user'` populates `''` regardless of `rationalePhrasings` content.

### Verdict composer (extended)

- **`computeVerdictBundle()` return shape gains** `rationalePhrasings: string[]`.
- **Lockstep invariant:** `rationalePhrasings.length === contextualPhrasings.length`. For every fired template at index `i`, `rationalePhrasings[i]` is the rationale-voice version of `contextualPhrasings[i]`.
- **Hedge prefix invariant:** when confidence ∈ [0.5, 0.7), the `Possibly …` prefix applies to BOTH arrays at every index uniformly.
- **Fallback invariant:** when no template fires (or confidence < 0.5), `contextualPhrasings = [DESCRIPTION_FOR_LABEL[label]]` AND `rationalePhrasings = [RATIONALE_FOR_LABEL[label]]`.
- **Test additions per D-22:** the 4 roadmap-locked template predicates + their `template` strings continue to produce green tests; new tests assert lockstep ordering and rationale-fallback parity.

---

## Out of Scope (UI-SPEC-level reminders)

- **`FormStatusBanner` CTA variant** — D-07 locks this. Anti-pattern #16 from Phase 25 UI-SPEC stays in force. The banner stays terse "Saved" / "Could not save…".
- **Custom Sonner action button styling** — D-03 locks the built-in slot. Use Sonner's theme-aware default; do not introduce a custom variant component.
- **In-flow exit affordance** — user chose "browser back as natural cancel" (CONTEXT specifics). No "Done" button, no explicit-exit CTA introduced.
- **Toast for invalid returnTo** — silent fallback to default destination (security/UX rationale above). No "redirect blocked" copy.
- **Verdict label rename / new labels** — Phase 28 only changes the strings. The 6 `SimilarityLabel` union members are locked by Phase 20.
- **`getSimilarityDisplay()` consolidation** — planner-owned per CONTEXT `<deferred>`. UI-SPEC does not mandate consolidation; if the rewritten `DESCRIPTION_FOR_LABEL` and the parallel map in `src/lib/similarity.ts:340-379` diverge, that's a code-review item.
- **Fonts, typography scale, color tokens** — Phase 28 inherits everything from `base-nova`. No edits.
- **New shadcn primitives** — none.
- **Pre-fill empty wishlist note** — rejected per CONTEXT `<deferred>`. Pre-fill stays; only the source becomes intentional.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | (none added in this phase — `card`, `button`, `label`, `textarea` etc. already installed) | not required |
| Third-party shadcn registries | none declared | not required |

**Sonner** is a standard npm dependency (already at `^2.0.7` in `package.json`), NOT a shadcn registry block. The shadcn registry safety gate (`shadcn view`) does not apply.

**No new dependencies in Phase 28.** RESEARCH §"Standard Stack" verified `npm install` is a no-op for this phase.

---

## Pre-Population Source Map

| Section | Source |
|---------|--------|
| Design system | `components.json` (read), `src/app/globals.css` (read 1-165), existing project (Geist, Sonner, lucide) |
| Spacing scale | Tailwind defaults already in use; Sonner library defaults for toast |
| Typography (sizes/weights/line-height) | Sonner library defaults; existing `WishlistRationalePanel.tsx:84` (read); existing CollectionFitCard typography (Phase 20 locked) |
| Color tokens | `src/app/globals.css` lines 51–118 (read); `<ThemedToaster>` theme binding line 24-27 (read) |
| Accent reservation | `<ThemedToaster richColors>` resolves theme tokens; D-03 locks built-in action slot styling |
| Locked literal copy (toast bodies, action label, hint) | CONTEXT D-01 (toast action label = "View"); UI-SPEC researcher (toast bodies, hint rewrite per D-20 voice direction) |
| Voice rules — DESCRIPTION_FOR_LABEL | CONTEXT D-16 (verb-led, neutral-to-positive, accurate, descriptive) |
| Voice rules — rationaleTemplate / RATIONALE_FOR_LABEL | CONTEXT D-17 (1st-person user-self), D-18 (fallback shape), D-19 (lockstep + hedge prefix) |
| Planner-drafted copy candidates | UI-SPEC researcher (per voice rules); planner finalizes in PLAN.md per D-21 |
| Suppress-toast rule | CONTEXT D-05; D-06 (path comparison); RESEARCH §"viewerUsername resolution" |
| Sonner action slot mechanics | RESEARCH §"Sonner Action interface verification" against `node_modules/sonner/dist/index.d.ts` |
| Keyboard accessibility (action button) | Sonner library defaults (RESEARCH); WAI-ARIA `role="status"` standard for live toast regions |
| `useFormFeedback` extension contract | CONTEXT D-04; existing hook source (read 1-177) |
| `WishlistRationalePanel` source switch | CONTEXT D-20; existing component source (read 1-107) |
| Verdict composer lockstep contract | CONTEXT D-19; D-22 (FIT-02 lock preservation) |
| Hint copy rewrite | UI-SPEC researcher (per D-20 voice direction; matches new 1st-person rationale framing) |
| Out-of-scope reminders | CONTEXT `<deferred>`; Phase 25 UI-SPEC anti-pattern #16; Phase 20 FIT-02 lock |
| Anti-patterns (verdict + rationale voice) | UI-SPEC researcher (synthesized from D-16, D-17 rationale + cross-label coherence rule) |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
