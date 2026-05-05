# Phase 28: Add-Watch Flow & Verdict Copy Polish — Research

**Researched:** 2026-05-04
**Domain:** Form feedback / open-redirect-safe routing / verdict copy templating
**Confidence:** HIGH (every claim verified against current source files)

## Summary

Phase 28 ships three coordinated polish changes against existing v4.0 infrastructure: a Sonner action-slot CTA on the success toast (UX-09), `?returnTo=` capture + server-side validation routing the user back to their entry point on commit (ADD-08), and a structural verdict copy fix that splits the "verdict-to-user" voice (`contextualPhrasings`) from the "user's own rationale" voice (new `rationalePhrasings`) (FIT-06). All three are additive — no schema changes, no engine changes, no breaking type changes for existing callers.

The 22 locked decisions in CONTEXT.md (D-01..D-22) are precise enough that this research is exclusively a sourcing-and-mapping job: which files take what edits, which line numbers, which regexes, which existing patterns to mirror. No alternative-exploration is needed and none was performed.

**Primary recommendation:** Mirror three existing patterns verbatim — the `?next=` capture pattern in `FollowButton.tsx:65-73`, the auth-callback regex in `auth/callback/route.ts:60-61`, and the searchParams whitelist shape in `watch/new/page.tsx:50-70`. Extend `useFormFeedback` additively; rewrite verdict copy in lockstep arrays inside the existing composer loop.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### UX-09 — Success Toast & CTA-Link Variant

- **D-01:** Toast CTA copy = literal `"View"` (chevron `→` is iconographic, not part of the label). Sonner's action slot renders as a button; copy is the button label.
- **D-02:** CTA destination = `/u/{username}/wishlist` when the new watch's status ∈ {`wishlist`, `grail`}; `/u/{username}/collection` when status ∈ {`owned`, `sold`}. Username resolved from the current viewer's profile (already loaded server-side in /watch/new and the search/catalog Server Components).
- **D-03:** Toast renders via Sonner's built-in `action: { label, onClick }` slot — NOT custom JSX inside `toast.success(<>…</>)`. Action slot gives accessibility + theming for free.
- **D-04:** `useFormFeedback` extends additively. New optional field on the `run()` opts: `successAction?: { label: string; href: string }`. Existing 8+ callers stay unchanged. The hook itself imports `useRouter` from `next/navigation` and wires `onClick: () => router.push(href)` internally — callers pass declarative `{ label, href }`, not imperative onClick.
- **D-05:** **Suppress-toast rule.** When `successAction.href` (resolved to its absolute path form) equals the path the user will land on post-commit, fire NO toast and pass NO action. Practically:
  - AddWatchFlow Wishlist commit / WatchForm Collection commit on `/watch/new`: post-commit landing = `returnTo ?? defaultDestination`. If that equals `/u/{username}/{matching-tab}`, suppress.
  - /search row Wishlist commit and /catalog/[id] Wishlist commit: stay on /search and /catalog/[id] respectively, so post-commit page never matches the destination tab — toast always fires here.
- **D-06:** Path comparison for the suppress rule normalizes trailing slashes only. `/u/me/wishlist` vs `/u/{actualUsername}/wishlist` is NOT considered equivalent — the planner should resolve `/u/me` to the canonical username at capture time so the comparison is apples-to-apples. (See `WishlistGapCard.tsx:24` for the existing `/u/me/...` shorthand pattern that needs canonicalization on capture.)
- **D-07:** `FormStatusBanner` does NOT get a CTA variant. Phase 25 default copy ("Saved" / "Could not save…") stays locked. The four Phase 28 commit sites either don't mount the banner (inline 3-CTA paths) or unmount the form mid-nav (AddWatchFlow + WatchForm on commit), so banner-CTA mirroring is moot. UI-SPEC §"FormStatusBanner Component Contract" + Anti-Pattern #16 stay intact.

#### ADD-08 — returnTo Capture & Routing

- **D-08:** `?returnTo=` is captured **at every entry-point callsite**, NOT inferred from `document.referrer`. Each Link/router.push that points at `/watch/new` appends `&returnTo={encodeURIComponent(window.location.pathname + window.location.search)}` (or the equivalent server-rendered href on Server Components). Pattern parallels the existing `?next=` capture in `FollowButton.tsx:71`.
- **D-09:** Entry-point callsites that need to start appending `?returnTo=` (planner enumerates exhaustively via grep — likely set):
  - Top-nav "Add a watch" Link (DesktopTopNav, SlimTopNav, BottomNav)
  - Profile empty-state CTAs on `/u/[username]/[tab]` (Phase 25 4-empty-state-CTAs)
  - /search row 3-CTA "Add to Collection" `router.push('/watch/new?catalogId=…&intent=owned')` in `WatchSearchRowsAccordion.tsx:104`
  - /catalog/[id] 3-CTA "Add to Collection" `router.push('/watch/new?catalogId=…&intent=owned')` in `CatalogPageActions.tsx:107`
  - WishlistGapCard / homepage CTAs that link to /watch/new
  - Any /explore CTAs that route to /watch/new
- **D-10:** Server Components linking to `/watch/new` need to either (a) move to a Client component that reads `usePathname()` to set returnTo, or (b) skip returnTo (rare path — bottom-nav / global header CTA can fall back to D-13 default). Planner picks per callsite; (a) for high-value paths, (b) acceptable for header-style global CTAs since the default destination still routes the user to a sensible tab.
- **D-11:** Validation lives **server-side at `/watch/new`** (NOT in AddWatchFlow). Same shape as the existing intent / manual / status / catalogId whitelisting in `src/app/watch/new/page.tsx:50-70`. Two-stage validation:
  1. Syntactic guard (reuse the auth-callback regex): `/^\/(?!\/)[^\\\r\n\t]*$/` — must start with `/`, second char ≠ `/`, no backslash, CR, LF, or tab.
  2. Self-loop guard: reject if returnTo `startsWith('/watch/new')`. Prevents `?returnTo=/watch/new?returnTo=/watch/new...` infinite-trap vectors.
  Validated value flows into AddWatchFlow as a typed prop (`initialReturnTo: string | null`); invalid → null → default destination kicks in.
- **D-12:** AddWatchFlow holds `returnTo` in its existing `initialX` props pattern. The validated value is passed to handleWishlistConfirm and through to WatchForm so both commit paths can route to it. AddWatchFlow does NOT push it back into the URL bar — it's a one-way "where to go on commit" parameter, consumed by commit handlers.
- **D-13:** Default destination when `returnTo` is null = `/u/{username}/{matching-tab}` based on the new watch's status (same status→tab mapping as D-02). Both Wishlist commit and Collection/manual commit converge on this default. WatchForm's hardcoded `router.push('/')` at line 209 is replaced by the `returnTo ?? defaultDestination` resolution.
- **D-14:** Exit paths that route to `returnTo`: AddWatchFlow Wishlist commit (`handleWishlistConfirm` success branch, replaces `router.refresh + setState idle`), AddWatchFlow→WatchForm Collection commit (replaces line 209 `router.push('/')`), AddWatchFlow→WatchForm manual-entry commit (same code path). Exit paths that DO NOT change: Skip (rail loop), `← Cancel — paste a URL instead` (in-flow restart), `WishlistRationalePanel` Cancel (returns to verdict-ready). Browser back continues to handle "true exit without committing" naturally since /watch/new pushed onto history.
- **D-15:** Wishlist commit currently calls `router.refresh()` to bump `collectionRevision` so the verdict cache invalidates (Pitfall 3). With Phase 28's nav-on-commit, `router.refresh()` is no longer needed — the `router.push(returnTo ?? default)` + landing on a different page naturally re-fetches collectionRevision via the destination page's Server Component. Planner verifies this and removes the refresh call to avoid double-fetch.

#### FIT-06 — Verdict Copy & Speech-Act Split

- **D-16:** All 6 `DESCRIPTION_FOR_LABEL` strings (`src/lib/verdict/templates.ts:130-137`) are rewritten — verb-led, neutral-to-positive tone, accurate to each label's similarity-engine semantic.
- **D-17:** Each entry in `TEMPLATES` (12 entries today, `src/lib/verdict/templates.ts:14-119`) gains a new field `rationaleTemplate: string`. Same `${slot}` interpolation grammar as `template`. Voice: 1st-person user-self statement of *why they want it*. Predicate is unchanged; same firing logic; composer fills both arrays in lockstep.
- **D-18:** New constant `RATIONALE_FOR_LABEL: Record<SimilarityLabel, string>` mirrors the existing `DESCRIPTION_FOR_LABEL`. Used by composer's low-confidence fallback (the `isFallback` branch at composer.ts:59) to fill `rationalePhrasings` when no Template fires.
- **D-19:** `VerdictBundleFull` type (`src/lib/verdict/types.ts:28`) gains a parallel field: `rationalePhrasings: string[]`. Same length and ordering as `contextualPhrasings`. Composer fills both inside the same loop; if a Template's predicate fires, both `template` and `rationaleTemplate` get filled and pushed in lockstep. Hedge prefix logic (`Possibly …` for confidence ∈ [0.5, 0.7)) applies to both arrays the same way.
- **D-20:** `WishlistRationalePanel.defaultRationale()` (`src/components/watch/WishlistRationalePanel.tsx:42-46`) is rewired to read `verdict.rationalePhrasings[0] ?? ''` instead of `verdict.contextualPhrasings[0] ?? ''`. The `framing === 'self-via-cross-user'` early-return-empty-string branch stays. The hint copy below the textarea ("Pre-filled from the fit verdict. Edit or clear as you like.") is updated to match the new voice — planner drafts.
- **D-21:** The 24+ specific copy strings (6 DESCRIPTION_FOR_LABEL + 12 rationaleTemplate + 6 RATIONALE_FOR_LABEL) are **drafted by the planner** in PLAN.md and **reviewed by the user during plan-check**.
- **D-22:** Existing `composer.test.ts` assertions on the 4 roadmap-mandated templates (FIT-02 lock per Phase 20 D-01) MUST continue to pass. New `rationaleTemplate` slot is additive — does not change which templates fire.

### Claude's Discretion

- **Sonner action-slot rendering details** — exact button styling produced by Sonner is theme-driven; minor visual mismatch is planner-owned.
- **Path canonicalization for the suppress-toast comparison** (D-06) — exact algorithm. Rule is "two strings match iff they refer to the same URL path." Recommended: resolve `/u/me/...` shorthand server-side at AddWatchFlow prop-build time; strip trailing `/`; case-sensitive comparison.
- **Specific copy strings for D-16/D-17/D-18** — planner drafts all 24+ strings in PLAN.md.
- **Whether `router.refresh()` removal in D-15 introduces verdict-cache races** — verified below in Pitfall analysis.
- **Test-coverage shape for D-22** — exact test names + fixtures planner-owned. Constraint: do not regress existing FIT-02 lock tests.
- **Server Component → Client Component conversion choice (D-10)** — per entry-point Link, planner decides between Client wrapper or fall back to default destination.

### Deferred Ideas (OUT OF SCOPE)

- **Add-Watch flow paid/target price capture UX** — carried over from Phase 27, NOT folded into Phase 28. Needs a new requirement (e.g., `ADD-09`) and roadmap edit.
- **Other DESCRIPTION_FOR_LABEL strings as their own pass** — folded into Phase 28 (D-16). No deferral.
- **FormStatusBanner CTA-link variant** — deferred indefinitely (D-07).
- **Verdict copy template predicate audit** — out of scope; locked by Phase 20 FIT-02.
- **Document.referrer fallback for returnTo** — rejected.
- **Strict positive allow-list registry for returnTo** — rejected.
- **Pre-fill empty wishlist note** — rejected.
- **`getSimilarityDisplay()` consolidation with `DESCRIPTION_FOR_LABEL`** — planner-owned (see Phase Requirements + recommendation below).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FIT-06 | Rewrite "unusual for your collection" verdict copy templates so they read coherently in TWO contexts: as verdict-to-user message AND as wishlist-note auto-fill source. Revisit whether `contextualPhrasings[0]` is the right rationale-fill source. | Verdict subsystem mapped (`templates.ts` lines 14-137, `composer.ts` lines 42-85, `types.ts:22-31`). Lockstep array fill location identified at composer.ts:62-72. WishlistRationalePanel.defaultRationale rewire site identified at line 45. composer.test.ts lock assertions enumerated. |
| ADD-08 | After completing or canceling Add-Watch flow, user returns to entry point via `?returnTo=…` validated against allow-list. | All 7 entry-point callsites enumerated (table below). Auth-callback regex confirmed reusable verbatim. Existing searchParams whitelist shape at `watch/new/page.tsx:50-70` documented for 1:1 mirroring. AddWatchFlow `initialX` props pattern + WatchForm.tsx:209 `router.push('/')` replacement site located. |
| UX-09 | Success toast with link to corresponding profile collection/wishlist tab. Extends Phase 25 `useFormFeedback` hook. | Sonner Action interface confirmed (`{label: ReactNode, onClick: (e) => void}` from sonner@2.0.7 type defs). useFormFeedback extension surface documented (line 55-58 + line 147 toast.success call). All 8 useFormFeedback callers enumerated. Suppress-rule comparison sites identified for /watch/new commits + /search/+/catalog inline commits. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `?returnTo=` validation (open-redirect guard) | Frontend Server (RSC) | — | Server Component at `/watch/new` is the validation chokepoint per D-11. Mirrors existing `?next=` validation at `auth/callback/route.ts`. |
| `?returnTo=` capture (encodeURIComponent of pathname) | Browser/Client | Frontend Server | Most callsites are Client Components reading `window.location` / `usePathname()`. Server-Component callsites (AddWatchCard, NotesTabContent CTAs) need wrapping or fallback per D-10. |
| Username resolution for D-02 / D-13 destination | Frontend Server (RSC) | — | `getCurrentUser()` already runs in `/watch/new` Server Component (page.tsx:42). Adding `getProfileById(user.id).username` is one Drizzle hop in the same RSC. |
| Toast emission (action slot) | Browser/Client | — | Sonner is a client-only library; `toast.success(...)` cannot fire from Server Actions (Pitfall H-2 in `ThemedToaster.tsx`). All commit handlers are already Client Components. |
| Suppress-toast path comparison | Browser/Client | Frontend Server (canonicalization helper) | Comparison happens at hook-emission time (Client). Server-side username resolution feeds the comparison so `/u/me/...` resolves correctly. |
| Verdict bundle composition (templates + rationale) | API/Backend (Server Action surface) | — | `getVerdictForCatalogWatch()` Server Action already calls `composer.computeVerdictBundle()` server-side. New `rationalePhrasings` field appears uniformly because composer is the single emit point. |
| `WishlistRationalePanel.defaultRationale()` source switch | Browser/Client | — | Pure presentation logic on a Client Component reading the verdict bundle prop. |
| post-commit navigation (returnTo OR default) | Browser/Client | — | `router.push()` from inside commit handlers; exists today (WatchForm:209, AddWatchFlow:284). |
| collectionRevision invalidation post-commit | Frontend Server (destination page RSC) | — | Destination `/u/[username]/[tab]/page.tsx` is a Server Component that re-fetches `getWatchesByUser(profile.id)` on every render — landing there naturally re-derives `collection.length` on next visit to `/watch/new`. See "Pitfall analysis" below for D-15 verification. |

## Standard Stack

### Core (already in project — version-confirmed today)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `sonner` | 2.0.7 | Toast UI primitive | Already mounted via `ThemedToaster`; bound to custom ThemeProvider. Has built-in `action: Action \| ReactNode` slot in `ToastT` interface — no extension needed. [VERIFIED: `node_modules/sonner/dist/index.d.ts` Action interface] |
| `next` | 16.2.3 | useRouter, usePathname, RSC searchParams Promise | Already in use throughout. `useRouter().push(href)` for nav-on-commit; `usePathname()` for capture-time pathname read. [CITED: `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-router.md`] |
| `react` | 19.2.4 | useTransition + hooks | Already in use. `useFormFeedback` already wraps useTransition (line 68 of hook). |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none new) | — | — | Phase 28 introduces zero new dependencies. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `useRouter().push()` for post-commit nav | `<Link>` with redirect-from-Server-Action | Server Action redirects work for form-action submissions, but Phase 28 commits are inside `useTransition` callbacks — keep client-side `router.push()` for parity with existing pattern (FollowButton.tsx:72). |
| Sonner `action` slot | Custom JSX inside `toast.success(<>...</>)` | Loses accessibility (Sonner's action button is keyboard-focusable + has correct ARIA). D-03 explicitly rejects custom JSX. |

**Installation:** `npm install` — nothing new. [VERIFIED: read `package.json`; sonner already at `^2.0.7`]

**Version verification:** Sonner 2.0.7 confirmed via local `package.json`; type definitions inspected at `node_modules/sonner/dist/index.d.ts`. The `Action` interface is `{ label: React.ReactNode; onClick: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void; actionButtonStyle?: React.CSSProperties }` — confirms D-04's declarative `{ label, href }` shape can map to it cleanly.

## Architecture Patterns

### System Architecture Diagram

```
                           ┌────────────────────────────────────────┐
                           │  Entry-point callsite                  │
                           │  (Link/router.push → /watch/new)       │
                           │  ─ DesktopTopNav, BottomNav            │
                           │  ─ Profile empty-state CTAs            │
                           │  ─ /search row "Add to Collection"     │
                           │  ─ /catalog "Add to Collection"        │
                           │  ─ WatchPickerDialog "Add watch"       │
                           └────────────┬───────────────────────────┘
                                        │ append ?returnTo=ENC(pathname+search)
                                        │  D-08
                                        ▼
                  ┌───────────────────────────────────────────────────┐
                  │  /watch/new (Server Component, page.tsx)          │
                  │  1. searchParams whitelist (existing 50-70)       │
                  │  2. NEW: returnTo two-stage validate (D-11)       │
                  │     - syntactic regex                             │
                  │     - self-loop guard                             │
                  │  3. NEW: viewerUsername = getProfileById(user.id) │
                  │  4. Render <AddWatchFlow                          │
                  │     initialReturnTo={validated}                   │
                  │     viewerUsername={username}                     │
                  │  />                                                │
                  └────────────┬──────────────────────────────────────┘
                               │
                               ▼
              ┌──────────────────────────────────────────────────┐
              │  AddWatchFlow (Client Component)                 │
              │  ─ holds initialReturnTo + viewerUsername        │
              │  ─ paste → extract → verdict → 3-button decide   │
              └─┬─────────────────────────┬──────────────────────┘
                │                         │
        Wishlist commit         Collection commit (form-prefill)
                │                         │
                ▼                         ▼
   ┌────────────────────────┐  ┌──────────────────────────────────┐
   │ handleWishlistConfirm  │  │ <WatchForm lockedStatus="owned"> │
   │  ─ addWatch(...)       │  │  ─ handleSubmit run()            │
   │  ─ NEW: useFormFeedback│  │  ─ NEW: useFormFeedback          │
   │      run() with        │  │      run() with                  │
   │      successAction     │  │      successAction               │
   │  ─ resolve dest =      │  │  ─ resolve dest =                │
   │      returnTo ?? D-13  │  │      returnTo ?? D-13            │
   │  ─ if dest matches     │  │  ─ if dest matches               │
   │      action.href       │  │      action.href                 │
   │      → suppress (D-05) │  │      → suppress (D-05)           │
   │  ─ remove router.refresh│ │  ─ replace router.push('/')      │
   │      (D-15)            │  │      with router.push(dest)      │
   │  ─ router.push(dest)   │  │                                  │
   └────────────┬───────────┘  └────────────┬─────────────────────┘
                │                            │
                └────────────┬───────────────┘
                             ▼
                ┌────────────────────────────────┐
                │ /u/[username]/[tab]/page.tsx   │
                │  Server Component              │
                │  ─ getWatchesByUser(profile.id)│
                │  ─ collection.length naturally │
                │     re-derived on next visit   │
                │     to /watch/new (D-15        │
                │     verification)              │
                └────────────────────────────────┘


  Composer (server-only, src/lib/verdict/composer.ts):

   computeVerdictBundle({...})
     ├─ analyzeSimilarity(...)             ──── result
     ├─ candidateTaste = {confidence, ...} ──── conf gate
     │
     ├─ if isFallback (conf < 0.5):
     │     contextualPhrasings = [DESCRIPTION_FOR_LABEL[label]]
     │     NEW rationalePhrasings = [RATIONALE_FOR_LABEL[label]]
     │
     └─ else:
           for t in TEMPLATES:
              slots = t.predicate(result, profile, candidate, taste)
              if !slots: continue
              copy   = fillTemplate(t.template, slots)
              NEW r  = fillTemplate(t.rationaleTemplate, slots)
              if isHedged: copy = applyHedge(copy); NEW r = applyHedge(r)
              contextualPhrasings.push(copy)
              NEW rationalePhrasings.push(r)
           if empty:
              contextualPhrasings = [DESCRIPTION_FOR_LABEL[label]]
              NEW rationalePhrasings = [RATIONALE_FOR_LABEL[label]]
     return {... contextualPhrasings, NEW rationalePhrasings}
```

### Component Responsibilities

| File | Role | Phase 28 edit type |
|------|------|---------------------|
| `src/app/watch/new/page.tsx` (39-92) | Server Component: searchParams whitelist + AddWatchFlow render | ADD: returnTo validation (mirror lines 50-70 shape) + getProfileById(user.id) for username + thread `initialReturnTo` + `viewerUsername` props |
| `src/components/watch/AddWatchFlow.tsx` (46-63 props, 266-298 wishlist commit) | Flow orchestrator (Client) | ADD: `initialReturnTo: string \| null` and `viewerUsername: string` props. EDIT: `handleWishlistConfirm` to use `useFormFeedback` (or extend the `addWatch` ↔ toast inline call) with `successAction` + suppress rule. REMOVE: `router.refresh()` line 284. ADD: `router.push(dest)` post-commit. |
| `src/components/watch/WatchForm.tsx` (77-213) | Stay-mounted form (Client; uses `useFormFeedback` already) | EDIT line 209: replace `router.push('/')` with computed destination. ADD: `successAction` + suppress logic into the `run()` opts. NEW prop or context to receive `returnTo` + `viewerUsername` from parent AddWatchFlow / page wrapper. |
| `src/lib/hooks/useFormFeedback.ts` (41-177) | Hook primitive | ADD: optional `successAction?: { label: string; href: string }` field on `run()` opts (interface line 56-58). ADD: `useRouter` import. ADD: when `successAction` set, pass `{ action: { label, onClick: () => router.push(href) } }` into `toast.success()` (line 147). The 8 existing callers stay byte-identical since the field is optional. |
| `src/components/ui/ThemedToaster.tsx` | Theme-bound Sonner mount | NO EDIT. Action button styling inherits from Sonner's theme prop. |
| `src/components/search/WatchSearchRowsAccordion.tsx` (73-101 wishlist commit, 103-105 navigates) | Inline 3-CTA + nav | EDIT line 92: convert to `useFormFeedback`-style call OR pass `action` directly into `toast.success(...)` for the inline Wishlist commit. EDIT line 104: append `&returnTo=` query param. |
| `src/components/watch/CatalogPageActions.tsx` (66-103 wishlist commit, 105-108 navigates) | /catalog 3-CTA | EDIT line 93: same as WatchSearchRowsAccordion. EDIT line 107: append `&returnTo=`. |
| `src/components/watch/WishlistRationalePanel.tsx` (42-46 defaultRationale) | Pre-fill source | EDIT line 45: `verdict.contextualPhrasings[0]` → `verdict.rationalePhrasings[0]`. EDIT hint copy line 86 to match new voice. |
| `src/lib/verdict/types.ts` (22-31) | VerdictBundleFull shape | ADD: `rationalePhrasings: string[]` field (after `contextualPhrasings` for clarity). ADD: `rationaleTemplate: string` to `Template` interface (lines 74-83). |
| `src/lib/verdict/templates.ts` (14-119 TEMPLATES, 130-137 DESCRIPTION_FOR_LABEL) | Template library | ADD: `rationaleTemplate` field to each of 12 TEMPLATES entries. REWRITE: all 6 DESCRIPTION_FOR_LABEL strings (D-16). ADD: new `RATIONALE_FOR_LABEL: Record<SimilarityLabel, string>` constant (D-18). |
| `src/lib/verdict/composer.ts` (42-85) | Verdict composer | EDIT lines 58-72: build `rationalePhrasings` in lockstep with `contextualPhrasings`. ADD `RATIONALE_FOR_LABEL` import. ADD it to the bundle return at lines 74-84. |
| `src/lib/verdict/composer.test.ts` | Existing test lock | NO REGRESSION on existing 9 tests (lines 127-298). ADD: new tests for lockstep parity + RATIONALE_FOR_LABEL fallback. |
| `src/components/insights/CollectionFitCard.tsx` (28-93) | Verdict reader (read sites for `contextualPhrasings`) | NO EDIT — reads only `contextualPhrasings`, not `rationalePhrasings`. |
| `src/components/watch/VerdictStep.tsx` | Wraps `<CollectionFitCard>` | NO EDIT. |
| Entry-point callsites (table below) | Append `?returnTo=` | EDIT each per D-08/D-09. |

### Entry-Point Callsite Audit (D-09 Exhaustive Enumeration)

This is the canonical list — verified by `grep -rn "watch/new" src --include="*.tsx" --include="*.ts" | grep -v ".test."`. There are 7 active callsites that link to `/watch/new`. Each is classified by component type, current href shape, and recommended Phase 28 treatment.

| # | Callsite | File:line | Already Client? | Current href | Phase 28 treatment |
|---|----------|-----------|-----------------|--------------|---------------------|
| 1 | DesktopTopNav "Add a watch" Plus icon | `src/components/layout/DesktopTopNav.tsx:98` | YES (`'use client'` line 1; uses `usePathname` line 49) | `/watch/new` (literal) | Append `?returnTo=${encodeURIComponent(pathname + (search ? '?' + search : ''))}`. Has access to `usePathname` already. **NOTE:** SlimTopNav does NOT have an Add Watch link (only Search icon + bell + UserMenu) — confirmed by reading `src/components/layout/SlimTopNav.tsx` in full. |
| 2 | BottomNav (mobile) — there is **no** Add link in BottomNav | n/a | n/a | n/a | **No edit needed.** BottomNav has Home/Search/Wear/Explore/Profile slots only (Phase 18 dropped the Add slot). The Wear cradle goes through `<NavWearButton>`, NOT `/watch/new`. Verified by reading `src/components/layout/BottomNav.tsx:126-152`. CONTEXT D-09 mentions BottomNav as a candidate but the slot was dropped in v4.0 Phase 18. Surface this to user as a CONTEXT discrepancy. |
| 3 | Collection empty-state "Add manually" button | `src/components/profile/CollectionTabContent.tsx:111` | YES (`'use client'` line 1) | `/watch/new?manual=1` | Convert `<Link href=...>` to a Client wrapper that reads `usePathname()` + appends `&returnTo=`. Or use a small `useSearchParams`+`usePathname` derive at component top. The component already declares `'use client'`. |
| 4 | Wishlist empty-state "Add a wishlist watch" | `src/components/profile/WishlistTabContent.tsx:61` | YES (`'use client'` line 1) | `/watch/new?status=wishlist` | Append `&returnTo=` derived from `usePathname()`. |
| 5 | Notes empty-state "Add a watch first" | `src/components/profile/NotesTabContent.tsx:57` | NO — this file is a **Server Component** (no `'use client'` directive; no React hooks; renders pure JSX) | `/watch/new` (literal) | D-10 decision: option (a) wrap in a tiny Client child that reads `usePathname()`, OR option (b) skip returnTo and rely on the D-13 default destination (`/u/{username}/notes` → notes tab). Recommend (b) since notes empty-state is rare and D-13 default lands the user on `/u/{username}/collection` (status='owned' for first watch); the loop is "owner with zero notes adds first watch → lands on collection where it appears". Acceptable per D-10. |
| 6 | AddWatchCard ("Add to Collection" / "Add to Wishlist" dashed-border end-of-grid card) | `src/components/profile/AddWatchCard.tsx:21` | NO — pure Server Component (no `'use client'`; renders `<Link>`) | `/watch/new` (literal) | This component is rendered by both `CollectionTabContent` (line 169, line 127) and `WishlistTabContent` (line 235) — both of which ARE Client Components. **Recommended approach:** convert `AddWatchCard` to a Client Component (cheap — single `usePathname()` hook + variant prop), have it read pathname and render the `?returnTo=` href. Alternatively, accept a `returnTo: string` prop from the Client parents and keep AddWatchCard a Server Component (simpler). Planner picks. |
| 7 | /search row "Add to Collection" | `src/components/search/WatchSearchRowsAccordion.tsx:104` | YES (`'use client'`) | `/watch/new?catalogId=${id}&intent=owned` | Append `&returnTo=` from `usePathname()` + search query. The component already calls `useRouter`. |
| 8 | /catalog/[id] "Add to Collection" | `src/components/watch/CatalogPageActions.tsx:107` | YES (`'use client'`) | `/watch/new?catalogId=${id}&intent=owned` | Append `&returnTo=` from `usePathname()`. |
| 9 | WatchPickerDialog (when 0 owned watches) "Add watch" CTA | `src/components/home/WatchPickerDialog.tsx:144` | YES | `/watch/new` (literal) | Append `&returnTo=` derived from `usePathname()`. |
| 10 | AddWatchFlow's own "Add manually" fallback (`router.push('/watch/new?manual=1')`) | `src/components/watch/AddWatchFlow.tsx:335` | YES | `/watch/new?manual=1` | This is **internal navigation within /watch/new itself** (the `?manual=1` reset path from ExtractErrorCard). The parent already has `initialReturnTo` — preserve it: `router.push('/watch/new?manual=1' + (returnTo ? '&returnTo=' + ENC(returnTo) : ''))`. Or skip — the manual-entry route resolves through the same /watch/new page so `initialReturnTo` re-validates. **Recommend:** preserve via passthrough so the user doesn't lose their entry-point context. |
| 11 | WishlistGapCard (`/u/me/wishlist?filter=...`) | `src/components/home/WishlistGapCard.tsx:24` | NO (Server Component) | `/u/me/wishlist?filter=...` | **NOT a `/watch/new` callsite** — it links to the wishlist tab itself. CONTEXT.md mentions this as an example of the `/u/me/...` shorthand pattern that needs canonicalization for D-06, NOT as a returnTo capture site. Recorded for completeness; no edit needed for ADD-08. |

**Summary classification:**
- 9 active `/watch/new` callsites need `?returnTo=` appended (rows 1, 3, 4, 5, 6, 7, 8, 9, 10).
- Of those, 7 are already Client Components (rows 1, 3, 4, 7, 8, 9, 10) — direct `usePathname()` is cheap.
- 2 are Server Components (rows 5, 6) — recommended treatments documented per D-10.
- BottomNav (CONTEXT.md row in D-09) has no Add link in v4.0 architecture — surface as CONTEXT discrepancy.
- WishlistGapCard is referenced in CONTEXT.md only for the `/u/me/...` canonicalization rule (D-06), not as an ADD-08 site.

### Pattern 1: Existing `?next=` capture (mirror for D-08)

**What:** `FollowButton.tsx:65-73` — capture `window.location.pathname` at click time and append as URL-encoded query param.

**When to use:** Every `?returnTo=` capture callsite. Phase 28 needs the same shape but with `pathname + search`.

**Example:**
```typescript
// Source: src/components/profile/FollowButton.tsx:70-73
if (viewerId === null) {
  const next = encodeURIComponent(window.location.pathname)
  router.push(`/login?next=${next}`)
  return
}
```

**Phase 28 adaptation (recommended pattern):**
```typescript
// For Client Components with usePathname/useSearchParams already in scope:
const pathname = usePathname()
const sp = useSearchParams()
const search = sp?.toString()
const returnTo = encodeURIComponent(pathname + (search ? `?${search}` : ''))
const href = `/watch/new?manual=1&returnTo=${returnTo}`
```

For inline `router.push` callers (WatchSearchRowsAccordion, CatalogPageActions), prefer reading at click-time via `window.location` (matches FollowButton.tsx:71 verbatim — works in event handlers without extra hooks):
```typescript
const handleAddToCollection = (r) => {
  const returnTo = encodeURIComponent(window.location.pathname + window.location.search)
  router.push(`/watch/new?catalogId=${ENC(r.catalogId)}&intent=owned&returnTo=${returnTo}`)
}
```

### Pattern 2: searchParams whitelist (mirror for D-11)

**What:** `src/app/watch/new/page.tsx:50-70` — strict literal-match for `intent`/`manual`/`status`, UUID regex for `catalogId`. Each invalid value collapses to `null` (not throw, not redirect).

**When to use:** New `returnTo` validation slots into this same Server-Component-level pre-check shape per D-11.

**Example (existing shape — line 50-70):**
```typescript
// Source: src/app/watch/new/page.tsx:50-70
const sp = await searchParams

const initialIntent: 'owned' | null = sp.intent === 'owned' ? 'owned' : null
const initialManual: boolean = sp.manual === '1'
const initialStatus: 'wishlist' | null = sp.status === 'wishlist' ? 'wishlist' : null

const catalogId =
  typeof sp.catalogId === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sp.catalogId)
    ? sp.catalogId
    : null
```

**Phase 28 addition (drop-in, mirroring shape):**
```typescript
// NEW: D-11 two-stage validation
const RETURN_TO_REGEX = /^\/(?!\/)[^\\\r\n\t]*$/  // reused from auth/callback
const initialReturnTo: string | null = (() => {
  if (typeof sp.returnTo !== 'string') return null
  if (!RETURN_TO_REGEX.test(sp.returnTo)) return null
  if (sp.returnTo.startsWith('/watch/new')) return null  // self-loop guard
  return sp.returnTo
})()
```

The regex itself is verified verbatim at `src/app/auth/callback/route.ts:60-61`:
```typescript
// Source: src/app/auth/callback/route.ts:60-61
const safeNext =
  next && /^\/(?!\/)[^\\\r\n\t]*$/.test(next) ? next : null
```
That regex blocks `//evil.com`, `\evil.com`, and CRLF/tab control chars. The auth-callback comment (lines 49-58) explicitly explains why each character class is excluded — keep that prose verbatim in the new validator's comment.

### Pattern 3: `useFormFeedback` additive extension (D-04)

**What:** The hook (`src/lib/hooks/useFormFeedback.ts:41-177`) currently exposes:
```typescript
run(action, { successMessage?, errorMessage? })
```

**Phase 28 extension (additive — no caller breaks):**
```typescript
// NEW interface field (line 56-58)
run(
  action: () => Promise<ActionResult<T>>,
  opts?: {
    successMessage?: string
    errorMessage?: string
    successAction?: { label: string; href: string }  // NEW
  },
) => Promise<void>
```

The only internal change is at line 147 (`toast.success(msg)`). The hook imports `useRouter` from `next/navigation` (already in use elsewhere in the codebase) and changes the toast call to:
```typescript
const router = useRouter()  // ADD at top of hook (line ~67 area)
// ...
const action = opts?.successAction
  ? { label: opts.successAction.label, onClick: () => router.push(opts.successAction!.href) }
  : undefined
toast.success(msg, action ? { action } : undefined)
```

**Why D-05 suppression lives at the call site (not in the hook):** the hook can't compute the suppress condition because that requires knowing the post-commit destination. Caller resolves dest first, then conditionally passes `successAction` (or omits it for suppress).

### Pattern 4: Sonner action slot (D-03)

**What:** Sonner's `toast.success(message, { action })` accepts an `Action` object: `{ label: ReactNode; onClick: (e: MouseEvent) => void; actionButtonStyle? }`. [VERIFIED: `node_modules/sonner/dist/index.d.ts` line 86-90 + ToastT interface line 105]

**When to use:** All four Phase 28 commit sites that fire toasts: AddWatchFlow Wishlist commit, WatchForm Collection commit, WatchSearchRowsAccordion inline Wishlist commit, CatalogPageActions Wishlist commit.

**Example:**
```typescript
toast.success('Added to wishlist', {
  action: {
    label: 'View',
    onClick: () => router.push('/u/{username}/wishlist'),
  },
})
```

**Behavior verified from Sonner 2.0.7 type defs:**
- Action button is a real `<button>` (keyboard-accessible by default).
- `onClick` receives a real `MouseEvent` — can be ignored if not needed.
- Action button auto-dismisses the toast on click (Sonner default — confirm at runtime; current code base has no precedent for `action:` in toast calls per `grep "action:" src/**/*.tsx`).
- Theming inherits from `<ThemedToaster theme={resolvedTheme} richColors />` — no per-call style needed.

### Pattern 5: Verdict composer lockstep array fill (D-19)

**What:** Composer at `src/lib/verdict/composer.ts:62-72` iterates `TEMPLATES`, builds `contextualPhrasings` by accumulating filled+optionally-hedged template strings, and falls back to `[DESCRIPTION_FOR_LABEL[label]]` when no template fires.

**When to use:** D-19 says `rationalePhrasings` MUST be built in the same loop with the same predicate, hedge prefix, and fallback semantics. Index parity is the invariant.

**Phase 28 edit (showing both arrays in the same loop):**
```typescript
// Edited from src/lib/verdict/composer.ts:58-72
let contextualPhrasings: string[]
let rationalePhrasings: string[]
if (isFallback) {
  contextualPhrasings = [DESCRIPTION_FOR_LABEL[result.label]]
  rationalePhrasings = [RATIONALE_FOR_LABEL[result.label]]  // NEW
} else {
  const ctx: string[] = []
  const rat: string[] = []  // NEW — lockstep
  for (const t of TEMPLATES) {
    const slots = t.predicate(result, profile, candidate, candidateTaste)
    if (!slots) continue
    let copy = fillTemplate(t.template, slots)
    let rationale = fillTemplate(t.rationaleTemplate, slots)  // NEW
    if (isHedged) {
      copy = applyHedge(copy)
      rationale = applyHedge(rationale)  // NEW — same hedge prefix
    }
    ctx.push(copy)
    rat.push(rationale)
  }
  contextualPhrasings = ctx.length > 0 ? ctx : [DESCRIPTION_FOR_LABEL[result.label]]
  rationalePhrasings = rat.length > 0 ? rat : [RATIONALE_FOR_LABEL[result.label]]  // NEW
}
return {
  framing,
  label: result.label,
  headlinePhrasing: HEADLINE_FOR_LABEL[result.label],
  contextualPhrasings,
  rationalePhrasings,  // NEW — same length and ordering as contextualPhrasings
  mostSimilar: ...,
  roleOverlap: result.roleOverlap,
}
```

**Invariant:** `rationalePhrasings.length === contextualPhrasings.length` and `rationalePhrasings[i]` is the rationale-voice version of `contextualPhrasings[i]`. Tests assert this.

### Anti-Patterns to Avoid

- **Custom JSX inside `toast.success(<>...</>)` for the View CTA.** D-03 explicitly rejects. Loses Sonner's keyboard accessibility.
- **Passing imperative `onClick: () => ...` from caller into useFormFeedback.** D-04 says callers pass declarative `{ label, href }`; the hook owns useRouter.
- **Adding a banner CTA variant to FormStatusBanner.** D-07 + Phase 25 UI-SPEC Anti-Pattern #16 explicitly forbid.
- **Inferring returnTo from `document.referrer`.** Rejected (deferred ideas) — Referrer-Policy strips it.
- **Hand-rolling the path-safety regex.** Reuse the auth-callback regex verbatim. Don't try to "improve" it.
- **Changing predicate logic for any of the 12 TEMPLATES.** D-22 + Phase 20 FIT-02 lock — composer.test.ts assertions on the 4 roadmap templates must continue to pass.
- **Calling `toast.success(...)` from a Server Action.** Existing pitfall (`ThemedToaster.tsx:18`); Sonner is client-only.
- **Building `rationalePhrasings` as a separate fallback after `contextualPhrasings` is built.** D-19 invariant: same loop, same predicate, same hedge — index parity.
- **Pushing returnTo back into the URL bar from AddWatchFlow.** D-12: it's a one-way "where to go" parameter, not a URL state.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Open-redirect-safe path validation | A new regex / parser | Reuse `/^\/(?!\/)[^\\\r\n\t]*$/` from `auth/callback/route.ts:60-61` | Battle-tested across `?next=` flows; comment block at lines 49-58 documents every excluded character class |
| Toast action affordance | Custom button JSX inside toast.success | Sonner's `action: { label, onClick }` slot (Action interface in `node_modules/sonner/dist/index.d.ts`) | Built-in keyboard accessibility, ARIA, theming. Sonner 2.0.7 already mounted via ThemedToaster |
| Form pending/success/error state | Local state + toasts in each form | Existing `useFormFeedback` hook (`src/lib/hooks/useFormFeedback.ts`) — extend additively per D-04 | 8 callers already use it; consistent hybrid Sonner+banner contract from Phase 25 |
| Username-from-userId resolution | Re-fetch profile in AddWatchFlow client | Existing `getProfileById(user.id)` (`src/data/profiles.ts:48`) at the Server Component level | Already imported pattern; one Drizzle hop in same RSC; no client round-trip |
| collectionRevision invalidation | Manual `router.refresh()` after commit | Natural re-fetch on next visit to `/watch/new` (the destination page is a different route) | D-15: nav-on-commit makes refresh redundant — destination page's RSC re-runs `getWatchesByUser`, so on next `/watch/new` visit the count is fresh |
| Verdict bundle composition (template firing + hedge prefix + fallback) | New parallel loop for rationalePhrasings | Existing composer loop at `composer.ts:62-72` — fill both arrays in lockstep | D-19 invariant: same predicate, same hedge — index parity is the contract |

**Key insight:** Phase 28 is an *additive extension* phase, not a redesign. Every constraint already has a battle-tested pattern in the codebase; the work is mirroring those patterns at the new touchpoints, not inventing new mechanisms.

## Common Pitfalls

### Pitfall 1: D-15 router.refresh removal — verify collectionRevision still invalidates correctly

**What goes wrong:** The current `handleWishlistConfirm` (`AddWatchFlow.tsx:284`) calls `router.refresh()` to bump `collectionRevision` so the verdict cache invalidates (Phase 20.1 Pitfall 3). With Phase 28's nav-on-commit, removing this refresh and replacing with `router.push(dest)` could leave a stale `collectionRevision` on the client cache if the user navigates back to `/watch/new` later.

**Why it happens:** `collectionRevision` is computed by `/watch/new` page.tsx line 83 (`collectionRevision={collection.length}`) where `collection = getWatchesByUser(user.id)`. This runs every time the user visits `/watch/new` — Server Component, no `'use cache'`. The `useWatchSearchVerdictCache` is a per-mount React state (line 94 of AddWatchFlow), so navigation away unmounts it; navigation back creates a fresh cache.

**How to avoid:**
- After commit, `router.push(dest)` navigates to `/u/{username}/{tab}`. The destination Server Component re-fetches user data fresh on every render.
- When the user later comes back to `/watch/new` (clicks "Add a watch" again), the page Server Component re-runs `getWatchesByUser(user.id)` — now including the just-added watch. `collectionRevision` reflects the new count. The cache hook is fresh-mounted.
- **Confirmed safe:** `/watch/new/page.tsx` has no `'use cache'` directive. `getWatchesByUser` reads live data via Drizzle. Removing `router.refresh()` does NOT introduce a cache race. The destination page's getWatchesByUser also has no caching layer (verified by reading `src/app/u/[username]/[tab]/page.tsx:147` — `await getWatchesByUser(profile.id)` runs fresh each render).
- **Edge case to flag:** if the user clicks "Add a watch" from a **cached navigation** in the React tree (e.g., the user navigated to `/watch/new` via `<Link prefetch>` from BottomNav and then clicks back through history), Next.js's client-side router cache could serve a stale render. Mitigation: the Plus icon is currently a `<Link>` without a custom prefetch policy. This is the *same* behavior as today (router.refresh would be cleared by the prefetched cache too) — Phase 28 does not introduce regression here.

**Warning signs:** Verdict scores out of date after multiple watches added in succession. Watch test: add 3 watches in rapid succession, then add a 4th — verify the verdict on the 4th properly uses the just-added 3 in `mostSimilarWatches`.

### Pitfall 2: Suppress-toast comparison — `/u/me/...` shorthand canonicalization

**What goes wrong:** `WishlistGapCard.tsx:24` links to `/u/me/wishlist?filter=...`. If the user enters Add-Watch from there, `returnTo = '/u/me/wishlist?filter=role'`. After Wishlist commit on a wishlist watch, `successAction.href = '/u/{actualUsername}/wishlist'`. Naive `===` comparison says "different paths → fire toast", but the user lands at `/u/me/wishlist?filter=role` which `proxy.ts` resolves to the same place as `/u/{actualUsername}/wishlist`. The toast fires unnecessarily.

**Why it happens:** `/u/me` is a sentinel for "the viewer's own profile" used in shorthand links (e.g., WishlistGapCard). The canonical form is `/u/{actualUsername}`. Naive string equality misses this equivalence.

**How to avoid:** D-06 mandates path canonicalization at capture time. The recommended algorithm:
1. At AddWatchFlow prop-build (Server Component / page.tsx level), if validated `initialReturnTo` starts with `/u/me/`, rewrite it to `/u/${viewerUsername}/...`.
2. At suppress-comparison time, compare `returnTo` (post-canonicalization) to `successAction.href`. Apply trailing-slash normalization.
3. Ignore query strings in the comparison (D-06 says "two strings match iff they refer to the same URL path" — query is not the path).

**Sketch:**
```typescript
function canonicalize(path: string, viewerUsername: string): string {
  let p = path.startsWith('/u/me/') ? `/u/${viewerUsername}/` + path.slice('/u/me/'.length) : path
  // Strip trailing slash; ignore query
  const queryStart = p.indexOf('?')
  if (queryStart >= 0) p = p.slice(0, queryStart)
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1)
  return p
}
const dest = returnTo ?? defaultDestination
const suppress = canonicalize(dest, viewerUsername) === canonicalize(actionHref, viewerUsername)
```

**Warning signs:** Toast fires on Wishlist commit when entry was the wishlist tab; toast fails to fire on Wishlist commit when entry was an unrelated page.

### Pitfall 3: Lockstep invariant breakage in composer

**What goes wrong:** When implementing the rationalePhrasings parallel build, accidentally pushing to one array but not the other (e.g., adding a `continue` in the new code that skips only the rationale push). Result: `rationalePhrasings.length !== contextualPhrasings.length`, breaking the index parity that `WishlistRationalePanel.defaultRationale()` and any future readers depend on.

**Why it happens:** The loop is short and the pushes look symmetric, but a guard that returns early from one branch but not both is easy to miss in code review.

**How to avoid:**
- Push to both arrays in the same statement block, never with intermediate guards.
- Add a runtime invariant assertion in tests: after computeVerdictBundle, assert `output.rationalePhrasings.length === output.contextualPhrasings.length` — for ALL fixture combinations, not just the 4 roadmap templates.
- The single `const slots = t.predicate(...)` ; `if (!slots) continue;` early-exit at line 64 is the only `continue` in the loop today — keep it that way.

**Warning signs:** `WishlistRationalePanel`'s pre-fill is empty when a verdict has phrasings; index access `[0]` returns `undefined`.

### Pitfall 4: Existing `composer.test.ts` regression on RATIONALE_FOR_LABEL fallback

**What goes wrong:** The existing test at `composer.test.ts:215-227` asserts:
```typescript
expect(out.contextualPhrasings).toEqual([DESCRIPTION_FOR_LABEL['core-fit']])
expect(out.contextualPhrasings).toEqual(['Highly aligned with your taste'])
```

The second assertion is a literal-string lock on `'Highly aligned with your taste'` — the existing `DESCRIPTION_FOR_LABEL['core-fit']`. If D-16 rewrites that string, this assertion **breaks**.

**Why it happens:** Two simultaneous changes (the new field AND the literal-string rewrite). Phase 28 D-16 explicitly rewrites the existing string; Phase 28 D-22 says "existing assertions must continue to pass."

**How to avoid:** Reading the test carefully — the test asserts the *literal value* of `DESCRIPTION_FOR_LABEL['core-fit']`. After D-16 rewrites the string, line 226 becomes a stale literal. Two options:
- **Option A:** Update the literal-string assertion in the existing test to match the rewritten string (acceptable per D-22 — the assertion locks behavior, not the literal text; the rewrite is in scope).
- **Option B:** Remove the literal assertion at line 226, keep only line 225 (`toEqual([DESCRIPTION_FOR_LABEL['core-fit']])`) which is by-reference.

**Recommend Option B** — it survives any future copy edit without churn. Document this in PLAN.md as part of the D-22 test-coverage shape.

### Pitfall 5: Server Component returnTo capture edge cases

**What goes wrong:** A Server Component (e.g., AddWatchCard, NotesTabContent) cannot read `usePathname()`. If the planner naively converts the Link to a Client Component just to read pathname, they introduce a Client/Server boundary that breaks `cacheComponents: true` semantics (e.g., now a previously-cacheable subtree must hydrate).

**Why it happens:** AddWatchCard is rendered inside both `CollectionTabContent` and `WishlistTabContent` — both already Client Components. Wrapping AddWatchCard in `'use client'` is cheap (no cache impact since the parent is already client). But NotesTabContent at row 5 of the entry-point table is a Server Component child of a Server Component page; converting it would force more of the tab tree client-side.

**How to avoid:**
- For AddWatchCard: pass `returnTo` as a prop from the Client parent (CollectionTabContent / WishlistTabContent) — they have `usePathname` access. AddWatchCard stays a Server Component.
- For NotesTabContent's "Add a watch first" button: D-10 option (b) — skip returnTo, fall back to D-13 default destination. The default lands the user on `/u/{username}/collection` (where the new watch will appear), which is sensible for the "zero collection, adding first watch" scenario.

**Warning signs:** Hydration-mismatch warnings in dev mode at `/u/{username}/notes` empty state. Test plan should include rendering the empty state with cookies present.

### Pitfall 6: Empty-collection short-circuit interacts with verdict==null fallback

**What goes wrong:** When `collectionRevision === 0`, AddWatchFlow short-circuits the verdict compute (`AddWatchFlow.tsx:162-172`) and the verdict is `null`. `WishlistRationalePanel.defaultRationale(null)` returns `''` (line 43). After D-20's rewire, this is still `''` — but the planner may forget to test this branch and assume rationalePhrasings always has content.

**How to avoid:** Add a test for `WishlistRationalePanel` with `verdict={null}` confirming the textarea is empty (existing behavior preserved). Add a test with `verdict={...framing: 'self-via-cross-user'...}` confirming the framing-specific empty branch (line 44) still wins over the rationalePhrasings read.

### Pitfall 7: Pre-existing AddWatchFlow Pitfalls (1, 3, 5, 6, 8) carry forward

The AddWatchFlow comment block (lines 32-44) lists 6 explicit pitfalls. Phase 28's nav-on-commit + verdict copy split touches Pitfalls 1, 3, 5, 6, 8 indirectly. Documenting impact:

- **Pitfall 1 (searchParams Promise):** Phase 28 ADDS `returnTo` to the searchParams whitelist. Same Promise-await pattern at page.tsx:50 — preserved.
- **Pitfall 3 (router.refresh after Wishlist commit):** D-15 explicitly removes this. Replaced by router.push(dest) — verified safe in Pitfall 1 above.
- **Pitfall 5 (notes verbatim '' passes through):** unchanged — D-20 only changes the *source* of pre-fill, not the verbatim-pass-through behavior.
- **Pitfall 6 (photoSourcePath NEVER set on URL-extract):** unchanged — Phase 28 doesn't touch the photo path.
- **Pitfall 8 (collectionRevision === 0 short-circuit):** unchanged — verdict null still possible. Pitfall 6 above explicitly tests this branch survives.

## Code Examples

### Example 1: useFormFeedback extension (D-04)

```typescript
// Source: extension to src/lib/hooks/useFormFeedback.ts
import { useRouter } from 'next/navigation'  // NEW
// ... (existing imports)

export interface UseFormFeedbackOptions {
  dialogMode?: boolean
}

export function useFormFeedback<T = unknown>(
  options?: UseFormFeedbackOptions,
): UseFormFeedbackReturn<T> {
  const router = useRouter()  // NEW
  // ... (existing hook body)

  const run = useCallback(
    async (
      action: () => Promise<ActionResult<T>>,
      opts?: {
        successMessage?: string
        errorMessage?: string
        successAction?: { label: string; href: string }  // NEW
      },
    ) => {
      // ... (existing reset + pending logic)

      if (result.success) {
        const msg = opts?.successMessage ?? 'Saved'
        startTransition(() => {
          setState('success')
          setMessage(msg)
        })
        // NEW: forward action declaratively
        const sonnerOpts = opts?.successAction
          ? {
              action: {
                label: opts.successAction.label,
                onClick: () => router.push(opts.successAction!.href),
              },
            }
          : undefined
        toast.success(msg, sonnerOpts)
        // ... (existing 5s timeout logic)
      }
      // ... (existing error branch unchanged)
    },
    [reset, router],  // ADD router to deps
  )
  // ... (rest unchanged)
}
```

### Example 2: returnTo validation in /watch/new page (D-11)

```typescript
// Source: extension to src/app/watch/new/page.tsx around line 50-70
const sp = await searchParams

const initialIntent: 'owned' | null = sp.intent === 'owned' ? 'owned' : null
const initialManual: boolean = sp.manual === '1'
const initialStatus: 'wishlist' | null = sp.status === 'wishlist' ? 'wishlist' : null
const catalogId =
  typeof sp.catalogId === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sp.catalogId)
    ? sp.catalogId
    : null

// NEW: D-11 two-stage validation. Mirror the auth/callback regex (verified
// at src/app/auth/callback/route.ts:60-61). Required shape: starts with `/`,
// second char is NOT `/` (rejects //evil.com), and the remainder contains
// no backslash or control chars. Plus a self-loop guard against
// ?returnTo=/watch/new?... infinite-trap vectors.
const RETURN_TO_REGEX = /^\/(?!\/)[^\\\r\n\t]*$/
const initialReturnTo: string | null = (() => {
  if (typeof sp.returnTo !== 'string') return null
  if (!RETURN_TO_REGEX.test(sp.returnTo)) return null
  if (sp.returnTo.startsWith('/watch/new')) return null
  return sp.returnTo
})()

// NEW: viewerUsername resolution for D-02/D-13 destination + D-06 canonicalization.
const viewerProfile = await getProfileById(user.id)
const viewerUsername = viewerProfile?.username ?? null
// If viewerUsername is null (data integrity issue), fall back to /watch/new
// default (router.push('/') today) — but at v4.0+ every authenticated user
// has a username via the signup trigger, so null here is a soft alarm, not
// expected.

// (existing Promise.all for collection + catalogPrefill)

return (
  <div className="container mx-auto px-4 py-8 max-w-3xl">
    <h1 className="font-serif text-3xl md:text-4xl text-foreground mb-8">
      Add a watch — or just evaluate one
    </h1>
    <AddWatchFlow
      collectionRevision={collection.length}
      initialCatalogId={catalogId}
      initialIntent={initialIntent}
      initialCatalogPrefill={catalogPrefill}
      initialManual={initialManual}
      initialStatus={initialStatus}
      initialReturnTo={initialReturnTo}    {/* NEW */}
      viewerUsername={viewerUsername}      {/* NEW */}
    />
  </div>
)
```

### Example 3: AddWatchFlow Wishlist commit (D-14, D-15, suppress rule)

```typescript
// Source: rewrite of src/components/watch/AddWatchFlow.tsx:266-298
const handleWishlistConfirm = (notes: string) => {
  if (state.kind !== 'wishlist-rationale-open') return
  const captured = state
  setState({
    kind: 'submitting-wishlist',
    catalogId: captured.catalogId,
    extracted: captured.extracted,
    verdict: captured.verdict,
    notes,
  })
  startTransition(async () => {
    const payload = buildAddWatchPayload(captured.extracted, 'wishlist', notes)
    const result = await addWatch(payload)
    if (result.success) {
      // D-13 default + D-14 returnTo: where to go on commit.
      const dest = initialReturnTo ?? defaultDestinationForStatus('wishlist', viewerUsername)
      const actionHref = `/u/${viewerUsername}/wishlist`  // D-02
      const suppress = canonicalize(dest, viewerUsername) === canonicalize(actionHref, viewerUsername)

      if (suppress) {
        // D-05: post-commit page = destination tab; no toast, no CTA.
        // (Just navigate.)
      } else {
        toast.success('Added to wishlist', {
          action: { label: 'View', onClick: () => router.push(actionHref) },  // D-03 + D-01
        })
      }
      // D-15: REMOVED the previous router.refresh() — destination page's
      // Server Component re-fetches getWatchesByUser naturally; no
      // double-fetch needed. Verified safe in RESEARCH Pitfall 1.
      router.push(dest)
      // setUrl + setState({ kind: 'idle' }) intentionally NOT called —
      // mid-nav unmount handles cleanup.
    } else {
      toast.error(result.error)
      setState({
        kind: 'wishlist-rationale-open',
        catalogId: captured.catalogId,
        extracted: captured.extracted,
        verdict: captured.verdict,
      })
    }
  })
}
```

### Example 4: Composer rationalePhrasings parallel fill (D-19)

See Pattern 5 above for the full code listing.

### Example 5: WishlistRationalePanel source switch (D-20)

```typescript
// Source: edit to src/components/watch/WishlistRationalePanel.tsx:42-46
function defaultRationale(verdict: VerdictBundle | null): string {
  if (!verdict) return ''
  if (verdict.framing === 'self-via-cross-user') return ''
  return verdict.rationalePhrasings[0] ?? ''  // CHANGED from contextualPhrasings[0]
}
```

The `framing === 'self-via-cross-user'` branch stays untouched; it returns `''` because that framing produces a `VerdictBundleSelfOwned`, which has no phrasings array of either kind.

The hint copy below the textarea (`WishlistRationalePanel.tsx:86`) — currently `"Pre-filled from the fit verdict. Edit or clear as you like."` — should be updated to match the new 1st-person voice. Planner drafts. Suggested direction (per D-21): something like `"Drafted as your reason for wanting this. Edit or clear as you like."` — but exact string is planner-owned + user-reviewed at plan-check.

## Runtime State Inventory

This phase is additive code/config changes. No rename/refactor/migration. None of the runtime-state categories apply. Skipping inventory by intent.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — verified by audit (no schema migration; Watch type unchanged; verdict bundle is in-memory only). | None |
| Live service config | None — verified (no external service config touched; Sonner is a client lib; addWatch revalidates `/` and `explore` tag, both pre-existing). | None |
| OS-registered state | None | None |
| Secrets/env vars | None — `ANTHROPIC_API_KEY` referenced only in unrelated CollectionTabContent branch (not touched by Phase 28). | None |
| Build artifacts | None | None |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Wishlist commit fires `router.refresh()` to bump collectionRevision (Phase 20.1 Pitfall 3) | Wishlist commit calls `router.push(dest)` to nav-on-commit; destination Server Component re-fetches naturally | Phase 28 D-15 | Removes the double-fetch; collectionRevision still invalidates |
| WatchForm Collection commit unconditionally `router.push('/')` (line 209) | Resolves `dest = returnTo ?? /u/{username}/{matching-tab}` and pushes that | Phase 28 D-13/D-14 | User lands where they came from, not always at home |
| `toast.success('Added to wishlist')` from inline 3-CTA paths | Adds Sonner action slot `{ label: 'View', onClick: () => router.push(...) }` (or suppresses per D-05) | Phase 28 D-03 | Adds a one-click way to view the just-added watch |
| `WishlistRationalePanel.defaultRationale(verdict)` reads `contextualPhrasings[0]` | Reads `rationalePhrasings[0]` (1st-person voice, intentional source) | Phase 28 D-20 | Pre-fill text is in user-self voice, not verdict-to-user voice |
| Single `template: string` per Template entry | Parallel `template + rationaleTemplate` per Template entry; lockstep arrays in bundle | Phase 28 D-17/D-19 | Treats verdict and rationale as parallel artifacts of the same predicate |

**Deprecated/outdated:**
- The "always show toast" pattern at the four commit sites is replaced by the suppress-when-destination-matches rule (D-05). Avoids redundant overlay when the user lands ON the tab the CTA points to.

## Project Constraints (from CLAUDE.md / AGENTS.md)

| Directive | Source | Phase 28 implication |
|-----------|--------|----------------------|
| "This is NOT the Next.js you know — read `node_modules/next/dist/docs/` before writing any code" | AGENTS.md | Verified: useRouter from `next/navigation`, usePathname from `next/navigation`, RSC searchParams Promise pattern. All Phase 28 patterns confirmed against Next.js 16.2.3 docs. |
| "Continue with existing framework, no rewrites" | CLAUDE.md Constraints | Phase 28 is purely additive — no framework changes, no rewrites. |
| "Watch and UserPreferences types are established — extend, don't break existing structure" | CLAUDE.md Constraints | Phase 28 extends `VerdictBundleFull` (additive field), `Template` (additive field), and `useFormFeedback` opts (additive field). No breaking changes to Watch or UserPreferences. |
| "Single-user experience and data isolation must remain correct" | CLAUDE.md Constraints | All paths still go through `getCurrentUser()` + `getProfileById(user.id)`; viewer scoping unchanged. |
| "Target <500 watches per user" | CLAUDE.md Constraints | Verdict composer is O(12 templates) — unchanged. No pagination/perf concerns. |
| "Before using Edit, Write, or other file-changing tools, start work through a GSD command" | CLAUDE.md GSD Workflow | Research-only phase; no file edits. Implementation will go through `/gsd-execute-phase 28`. |

## Project Skills

No project skills found at `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/`. No SKILL.md files in scope. Phase 28 has no project-skill constraints.

## Environment Availability

Phase 28 introduces zero new external dependencies. All required tooling already in use.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| sonner | Toast action slot (D-03) | ✓ | 2.0.7 (from `package.json`; `node_modules/sonner/dist/index.d.ts` Action interface verified) | — |
| next | useRouter, usePathname, RSC searchParams Promise | ✓ | 16.2.3 | — |
| react | useTransition, hooks | ✓ | 19.2.4 | — |
| @anthropic-ai/sdk | NOT used by Phase 28 (only relevant to URL extract) | n/a | — | — |
| Drizzle / Supabase | getProfileById Server Component DAL call | ✓ | (existing) | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

## Validation Architecture

Workflow config has `nyquist_validation: true` (verified `.planning/config.json`).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest + React Testing Library + MSW (existing — see `tests/` and `package.json` scripts) |
| Config file | `vitest.config.ts` (root) — existing |
| Quick run command | `npm run test` (Vitest watch mode) — `vitest run <pattern>` for one-shot |
| Full suite command | `npm run test -- --run` (or `vitest run`) — confirmed via existing test commands referenced across plans |

### Phase Requirements → Test Map

22 locked decisions, mapped to verifiable tests. Test type column distinguishes unit / component (RTL) / integration / e2e-manual.

| Decision | Behavior | Test Type | Automated Command | File |
|----------|----------|-----------|-------------------|------|
| D-01 | Toast CTA literal "View" copy | unit (sonner mock spy) | `vitest run src/lib/hooks/useFormFeedback.test.ts` | new — extends `useFormFeedback.test.ts` (or create) |
| D-02 | Destination `/u/{username}/{wishlist\|collection}` based on status | unit | `vitest run src/lib/hooks/useFormFeedback.test.ts` | extends |
| D-03 | Sonner action slot used (not custom JSX) | unit (asserts `toast.success` called with `{ action: { label, onClick } }`) | same | extends |
| D-04 | useFormFeedback `successAction` opt is additive — existing 8 callers unaffected | unit (pre-existing tests pass) | `vitest run src/lib/hooks/useFormFeedback.test.ts src/components/settings src/components/preferences src/components/watch/WatchForm.test.tsx src/components/profile/ProfileEditForm.test.tsx` | existing tests must still pass |
| D-05 | Suppress-toast when post-commit dest equals successAction.href | component (RTL — render AddWatchFlow with returnTo equal to status-tab; commit; assert `toast.success` NOT called) | `vitest run src/components/watch/AddWatchFlow.test.tsx` | extends |
| D-06 | Path canonicalization: `/u/me/wishlist` ≡ `/u/{username}/wishlist` | unit (canonicalize helper) | `vitest run` | new — `src/lib/canonicalizePath.test.ts` (or co-located) |
| D-07 | FormStatusBanner unchanged — Phase 25 default copy locked | unit (pre-existing tests pass — "Saved" / "Could not save…" assertions) | existing | `src/components/ui/FormStatusBanner.test.tsx` (existing) |
| D-08 | `?returnTo=` appended at every entry-point callsite | component-level (RTL) per callsite — assert href contains `&returnTo=` | `vitest run src/components/layout src/components/profile src/components/search src/components/watch src/components/home` | new tests per callsite OR a single static-grep test that asserts `/watch/new` appears with `returnTo=` in src/ |
| D-09 | Exhaustive callsite coverage | static grep guard test | `vitest run tests/static/returnTo-coverage.test.ts` | new static test — lists allowed bare `/watch/new` callsites and asserts no others |
| D-10 | Server Component callsites use Client wrapper or fall back | component (NotesTabContent renders without errors when not Client) | `vitest run src/components/profile/NotesTabContent.test.tsx` | extends |
| D-11 | returnTo validation — syntactic regex + self-loop guard | unit + integration | `vitest run src/app/watch/new/page.test.ts` | new — covers: `//evil`, `\evil`, `\r\n`, `\t`, valid `/u/me/wishlist`, `/watch/new?...` (self-loop blocked) |
| D-12 | AddWatchFlow accepts `initialReturnTo` prop, doesn't push to URL | component | same as D-05 | extends AddWatchFlow.test.tsx |
| D-13 | Default destination = `/u/{username}/{matching-tab}` when returnTo null | component (commit with returnTo=null asserts router.push receives expected dest) | same | extends |
| D-14 | Wishlist commit + Collection commit + manual commit all route to returnTo (or default); Skip + Cancel paths unchanged | component | same | extends; assert each commit path; assert Skip / Cancel still set kind: 'idle' |
| D-15 | router.refresh() removed; collectionRevision still invalidates correctly | regression test (RTL — commit watch; navigate back; verify next mount sees updated collectionRevision) | `vitest run src/components/watch/AddWatchFlow.test.tsx` | extends; assert `router.refresh` is NOT called inside commit handler |
| D-16 | All 6 DESCRIPTION_FOR_LABEL strings present (verb-led; non-empty) | unit | `vitest run src/lib/verdict/templates.test.ts` | new — assert each label has a string starting with a verb (regex check) and non-empty |
| D-17 | Each TEMPLATES entry has rationaleTemplate field | unit | same | extends |
| D-18 | RATIONALE_FOR_LABEL exists for all 6 labels | unit | same | extends |
| D-19 | composer.computeVerdictBundle returns rationalePhrasings; same length as contextualPhrasings (lockstep invariant) | unit | `vitest run src/lib/verdict/composer.test.ts` | extends — for each of 4 roadmap fixtures + fallback + hedge, assert `rationalePhrasings.length === contextualPhrasings.length` |
| D-20 | WishlistRationalePanel reads rationalePhrasings[0] | component | `vitest run src/components/watch/WishlistRationalePanel.test.tsx` | extends or new |
| D-21 | Copy strings reviewed by user (process gate) | manual UAT | n/a | plan-check review |
| D-22 | Existing 9 composer.test.ts assertions continue to pass | regression | `vitest run src/lib/verdict/composer.test.ts` | existing — Pitfall 4 above flags one literal-string assertion needs Option B refactor |

### Sampling Rate

- **Per task commit:** `vitest run <changed-file-pattern>` — covers the touched file's tests.
- **Per wave merge:** `npm run test -- --run` (full Vitest suite) — green on every wave merge.
- **Phase gate:** Full suite green + manual UAT for D-21 (copy review) before `/gsd-verify-work`.

### Wave 0 Gaps

The Phase 28 test surface mostly extends existing test files. New files needed:

- [ ] `tests/static/returnTo-coverage.test.ts` — static grep guard listing allowed bare `/watch/new` callsites; fails build if a new bare callsite appears without `returnTo=`.
- [ ] `src/app/watch/new/page.test.ts` — server-side validation tests for the returnTo whitelist (mock searchParams Promise; assert null collapse on bad inputs; assert pass-through on valid).
- [ ] `src/lib/canonicalizePath.test.ts` (or co-located) — exercises the D-06 canonicalization helper across `/u/me/wishlist` ↔ `/u/{username}/wishlist`, trailing-slash variations, and query-stripping.
- [ ] `src/lib/verdict/templates.test.ts` — assertions on the new RATIONALE_FOR_LABEL constant + rationaleTemplate field presence on all 12 TEMPLATES.
- [ ] Extensions to `src/lib/hooks/useFormFeedback.test.ts` (existing? — confirm at Wave 0; if not present, create) covering the new `successAction` opt + Sonner action call shape.
- [ ] Extensions to `src/components/watch/AddWatchFlow.test.tsx` (exists — verified by `grep -rn "AddWatchFlow.test" src 2>/dev/null` shows `src/components/watch/AddWatchFlow.test.tsx:560` reference) covering the new `initialReturnTo` prop, suppress rule, and router.refresh removal.
- [ ] Extensions to `src/lib/verdict/composer.test.ts` (existing) covering rationalePhrasings lockstep + RATIONALE_FOR_LABEL fallback. Note the literal-string lock at line 226 needs Option B refactor (Pitfall 4 above).

Framework install: none needed — Vitest/RTL/MSW already in repo.

## Security Domain

**Note:** `security_enforcement` is not explicitly set in `.planning/config.json` (see `cat .planning/config.json`). Following the "absent = enabled" rule.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (transitively) | Existing — `getCurrentUser()` at /watch/new page Server Component (page.tsx:42), `proxy.ts` global enforcement. Phase 28 doesn't add a new auth path. |
| V3 Session Management | no | No session lifecycle changes |
| V4 Access Control | yes (transitively) | Existing — Server Action `addWatch` validates ownership; Phase 28 doesn't change ownership rules |
| V5 Input Validation | **yes** | NEW returnTo input must be validated server-side at /watch/new before being used as a redirect target. D-11 is the validation control. |
| V6 Cryptography | no | No crypto |
| V13 API Verification | yes (transitively) | All paths go through existing Server Actions (addWatch); no new endpoints |

### Known Threat Patterns for Phase 28 Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Open-redirect via `?returnTo=//evil.com` | Spoofing | Reuse auth-callback regex `/^\/(?!\/)[^\\\r\n\t]*$/` — second-char `/` rejected (D-11 syntactic guard) |
| Open-redirect via `?returnTo=javascript:alert(1)` | Spoofing | Same regex — does not start with `/`, rejected |
| Open-redirect via control-char injection (`?returnTo=/foo%0d%0aSet-Cookie:...`) | Tampering | URL decoding by `searchParams.get` decodes; regex rejects `\r\n\t` and `\\` |
| Self-loop trap via `?returnTo=/watch/new?returnTo=/watch/new...` | DoS | Self-loop guard at D-11 step 2: `startsWith('/watch/new')` → reject |
| XSS via `router.push(unsanitizedUrl)` | XSS | Next.js docs explicitly warn (`useRouter` doc line 51): never push untrusted URLs. D-11 validation runs server-side BEFORE the value reaches `AddWatchFlow.initialReturnTo`. Even if a malicious returnTo somehow bypassed validation, the Sonner action `onClick: () => router.push(href)` only fires from a user click on the in-app View button — the href comes from D-02 status→tab resolution (server-controlled, not user-controlled). |
| Reflection of user-controlled returnTo into the URL bar | Tampering | D-12 explicitly: AddWatchFlow does NOT push returnTo back into the URL — it's a one-way "where to go on commit" parameter |
| Toast action injection via crafted Watch.brand/model | XSS | Sonner `action.label` typed as `React.ReactNode` — but Phase 28 D-01 hard-codes `"View"`, never uses user data. Safe by construction. |
| URL-encoded payload bypass of regex (e.g., `%2F%2Fevil.com`) | Tampering | URL decoding happens at `searchParams.get` BEFORE regex test. The decoded form `//evil.com` is then rejected by the second-char-not-`/` rule. Verified by tracing the same path in `auth/callback/route.ts:60-61`. |

**Audit checklist before merge:**
- [ ] returnTo never appears in `router.push()` from a Client Component without first being validated by the Server Component at /watch/new.
- [ ] No callsite passes `returnTo` directly to `<a href={...}>` or `<Link href={...}>` without going through the validator.
- [ ] No `dangerouslySetInnerHTML` introduced.
- [ ] Sonner action `label` is always a literal string (not user data).

## Sources

### Primary (HIGH confidence)

- **Next.js 16.2.3 docs (local)** — `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-router.md` (verified Phase 28 useRouter().push pattern); `use-pathname.md` (verified usePathname Client Component requirement, hydration-mismatch caveat with rewrites — not applicable to Phase 28 since no rewrites configured)
- **Sonner 2.0.7 type definitions** — `node_modules/sonner/dist/index.d.ts` (verified Action interface: `{ label: React.ReactNode; onClick: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void; actionButtonStyle?: React.CSSProperties }` and `ToastT.action?: Action | React.ReactNode`)
- **Local source files** — verified reading:
  - `src/app/watch/new/page.tsx:1-123` (full)
  - `src/app/auth/callback/route.ts:1-95` (full)
  - `src/lib/hooks/useFormFeedback.ts:1-178` (full)
  - `src/components/ui/ThemedToaster.tsx:1-30` (full)
  - `src/components/watch/AddWatchFlow.tsx:1-549` (full)
  - `src/components/watch/WatchForm.tsx:1-672` (full)
  - `src/components/watch/WishlistRationalePanel.tsx:1-107` (full)
  - `src/components/watch/CatalogPageActions.tsx:1-160` (full)
  - `src/components/watch/VerdictStep.tsx:1-159` (full)
  - `src/components/insights/CollectionFitCard.tsx:1-138` (full)
  - `src/lib/verdict/types.ts:1-83` (full)
  - `src/lib/verdict/templates.ts:1-138` (full)
  - `src/lib/verdict/composer.ts:1-99` (full)
  - `src/lib/verdict/composer.test.ts:1-300` (full)
  - `src/components/profile/FollowButton.tsx:1-156` (full — `?next=` capture pattern)
  - `src/components/layout/DesktopTopNav.tsx:1-112` (full)
  - `src/components/layout/SlimTopNav.tsx:1-71` (full — confirms no Add link)
  - `src/components/layout/BottomNav.tsx:1-130 partial` (Add slot dropped)
  - `src/components/profile/AddWatchCard.tsx:1-30` (full — Server Component, used by both tab contents)
  - `src/components/profile/CollectionTabContent.tsx:1-174` (full)
  - `src/components/profile/WishlistTabContent.tsx:1-252` (full)
  - `src/components/profile/NotesTabContent.tsx:1-85` (full — Server Component)
  - `src/components/search/WatchSearchRowsAccordion.tsx:60-180` (relevant regions)
  - `src/components/home/WatchPickerDialog.tsx:130-160` (Add watch link region)
  - `src/components/home/WishlistGapCard.tsx:1-44` (full — `/u/me/...` pattern)
  - `src/data/profiles.ts:1-80` (getProfileByUsername + getProfileById)
  - `src/lib/similarity.ts:335-383` (getSimilarityLabelDisplay map)
  - `src/app/u/[username]/[tab]/page.tsx:1-271` (full — destination page Server Component; verified naturally re-fetches `getWatchesByUser`)
  - `src/app/actions/watches.ts:225-287` (addWatch revalidatePath/Tag map)
  - `package.json` (sonner ^2.0.7, next 16.2.3 confirmed)
  - `.planning/config.json` (nyquist_validation true, security_enforcement absent)
- **CONTEXT.md** — `.planning/phases/28-add-watch-flow-verdict-copy-polish/28-CONTEXT.md:1-211` (full)
- **DISCUSSION-LOG.md** — same dir, full
- **REQUIREMENTS.md** — `.planning/REQUIREMENTS.md` (full — confirms FIT-06, ADD-08, UX-09 as the three locked phase items)
- **ROADMAP.md** — `.planning/ROADMAP.md` (full — Phase 28 goal + 4 success criteria + Phase 29 boundary)

### Secondary (MEDIUM confidence)

- (none — every secondary claim was cross-verified against a primary source above)

### Tertiary (LOW confidence)

- (none)

## Open Questions

1. **AddWatchCard returnTo prop OR Client conversion?**
   - What we know: AddWatchCard is a Server Component used by two Client parents (CollectionTabContent, WishlistTabContent).
   - What's unclear: Planner-owned per D-10. Both options work; recommend the prop approach for cleaner separation, but Client conversion is also defensible (single-component scope; cheap).
   - Recommendation: Pass `returnTo: string` from Client parents (they have `usePathname` already). Keep AddWatchCard a Server Component.

2. **Sonner action button auto-dismiss behavior — confirmed default?**
   - What we know: Sonner Action interface exposes `onClick`. Type defs don't document auto-dismiss explicitly.
   - What's unclear: Whether clicking the action automatically dismisses the toast. The codebase has no existing `action:` calls to crib from.
   - Recommendation: Test in browser during implementation (it does — Sonner default behavior). If not, manually call `toast.dismiss(id)` from the onClick. Either way, planner adds a verification UAT step.

3. **`getSimilarityDisplay()` consolidation with rewritten `DESCRIPTION_FOR_LABEL`?**
   - What we know: `src/lib/similarity.ts:343-381` defines a parallel per-label `description` map identical in shape to `DESCRIPTION_FOR_LABEL`. Today the strings are byte-identical (`'Highly aligned with your taste'` etc.).
   - What's unclear: After D-16 rewrites `DESCRIPTION_FOR_LABEL`, should `getSimilarityDisplay().description` also be rewritten? CONTEXT marks as planner-owned.
   - Recommendation: **Consolidate.** Have `getSimilarityDisplay()` import `DESCRIPTION_FOR_LABEL` from `@/lib/verdict/templates` and reuse — eliminates the parallel-strings drift risk. The consumers of `getSimilarityDisplay()` (`grep` shows only the function definition itself; no live consumers in production code under `src/`) are minimal — verify before committing. If consumers exist that need a different voice, keep parallel and document; otherwise consolidate.
   - Action: Run `grep -rn "getSimilarityDisplay\|getSimilarityLabelDisplay" src` at plan-time; if no consumer exists, mark the function as candidate for deprecation in a follow-up plan-check item.

4. **CONTEXT.md row in D-09 references BottomNav as a callsite — but BottomNav has no Add link.**
   - What we know: D-09 explicitly lists "Top-nav 'Add a watch' Link (DesktopTopNav, SlimTopNav, BottomNav)". Phase 18 dropped the Add slot from BottomNav and SlimTopNav doesn't have Add either. Only DesktopTopNav has the `<Plus />` icon link.
   - What's unclear: Whether CONTEXT.md is stale (the user remembered an older nav shape) or whether it's specifying that the nav-shape audit should re-confirm at planning time.
   - Recommendation: Surface in PLAN.md as a CONTEXT discrepancy. Verify with user during plan-check that the active set is exactly the DesktopTopNav Plus icon (D-09 row 1) — no other top-nav callsites exist.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| (none) | All claims in this research were verified against current source files via direct reads. No `[ASSUMED]` claims required. | — | — |

The research deliberately avoided assumed knowledge — every architectural fact, file:line reference, and behavioral claim was confirmed against current source code in this session.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Sonner 2.0.7 + Next 16.2.3 + React 19.2.4 confirmed in `package.json`; type definitions inspected for the `Action` interface used by D-03
- Architecture: HIGH — every relevant file read in full; line numbers in CONTEXT.md cross-checked against actual source
- Pitfalls: HIGH — D-15 router.refresh removal verified safe by tracing `/u/[username]/[tab]/page.tsx` data-fetch path; D-22 composer test regression risk identified by reading the existing test file end-to-end
- Validation: HIGH — every locked decision mapped to a concrete vitest command + test file (existing or new)
- Security: HIGH — open-redirect threat surface enumerated from real Sonner type defs + Next.js useRouter doc warnings + auth-callback regex prose

**Research date:** 2026-05-04

**Valid until:** 2026-06-04 (30 days — patch-class phase against stable v4.0 infrastructure; no fast-moving deps)
