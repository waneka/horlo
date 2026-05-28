# Phase 64: Detail Page IA Redesign - Research

**Researched:** 2026-05-27
**Domain:** Next.js 16 App Router — RSC sibling composition, `'use client'` island split, Cache Components preservation, information hierarchy redesign
**Confidence:** HIGH (all findings verified from direct source-code reads; no assumed claims)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 (hybrid hero):** Photo-led hero, then single-column. Desktop: 2-column hero (carousel left, `verdict + like + title` right). Below hero: single-column full-width. Mobile: single column throughout.
- **D-02 (canonical order):** Hero (carousel · title · verdict · like · condensed spec strip) → Comments → full spec cards → rails (SameFamily / Lineage / OtherOwners as applicable) → footer / owner actions.
- **D-03 (spec cards):** Condensed one-line spec strip in the hero (reuse `SpecsSublabel`). Four full spec cards below comments.
- **D-04 (carousel primary):** `WatchPhotoSection` (carousel + filmstrip) is the primary visual at top-left of hero on desktop / top on mobile. Reuse as-is.
- **D-05 (position):** Comments render directly under the hero, ABOVE full spec cards and all rails.
- **D-06 (jump link):** Hero comment-count indicator becomes tap-to-scroll "jump to comments" anchor (smooth-scroll). Do NOT pull comment data into the hero island.
- **D-07 (LOAD-BEARING — island split):** `CommentThread` stays an uncached async RSC `<Suspense>` sibling — NO `'use client'`, NO `'use cache'`. Island MUST be split: hero portion stays client island; trailing content (full spec cards, notes) moves to RSC sibling(s) rendered AFTER `CommentThread`. CSS-order tricks are FORBIDDEN (break tab/SR order).
- **D-08 (Cache Components intact — PAGE-03):** `export const unstable_instant = false` and `await connection()` at top of `page.tsx` are PERMANENT. Sync-outer / async-inner / local-`<Suspense>` structure must survive. Admin client only for storage URL signing (never cookie client). `'use cache'` data segments stay free of request-time APIs.
- **D-09 (elevate verdict):** `CollectionFitCard` is elevated into the hero (right column on desktop). NOT at island bottom.
- **D-12 (shell parity, accept gaps):** Generic catalog page (Branch 3) gets same visual IA shell: verdict-forward hero (single image), then rails + footer/actions. Cleanly OMIT comments (no per-user target) and multi-photo carousel.
- **D-13 (roster/actions high):** `OtherOwnersRoster` + `CatalogPageActions` surface HIGH, near the verdict, on the catalog page.
- **D-14 (branch scope):** Branches 1 & 2-D06 get full hero + comments IA. Branch 3 gets shell-only variant. All three branches stay visually coherent.

### Claude's Discretion

- **D-15 (owner actions placement):** Mark-as-Worn / Edit / Delete / Flag-deal / Last-worn — hero vs dedicated bottom "footer action bar." Keep hidden for non-owners.
- **D-10 (empty-collection hero fill):** What fills the hero verdict slot when viewer has no collection. Lean: `ReferenceIdentityCard` when `confidence >= 0.5`, else caption. Place fresh-account 3-CTA block where it reads best.
- **D-11 (gap-fill placement):** Wishlist/grail gap-fill callout — pair with verdict in hero (lean) or as separate card lower.
- **Comments desktop width:** Full content width vs narrower centered reading column.
- **Notes / Tracking / sub-ordering** within the lower spec section.
- **Updating `WatchPageSkeleton`** to mirror the new IA.

### Deferred Ideas (OUT OF SCOPE)

- Real comment thread on the generic catalog entry (no per-user `watches.id` target).
- Multi-photo carousel for catalog entries.
- New social primitives / threaded replies / moderation / public liker lists / Realtime.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PAGE-01 | Intentional hierarchy (carousel, verdict, like, comments, rails, footer), not stacked append-order | Island split (D-07) enables reordering; server-tree child order in each branch changes per D-02 |
| PAGE-02 | Comments occupy a deliberate, reachable position — not buried at bottom | `CommentThread` moves immediately after the hero in all Branches 1 & 2 server trees |
| PAGE-03 | Redesign preserves Phase 51/52 Cache Components structure | `unstable_instant = false`, `await connection()`, and admin-client signing are non-negotiable; no import of `CommentThread` into the client island |
| PAGE-04 | Redesign integrates the photo carousel as a primary visual element | `WatchPhotoSection` moves to left column of the 2-col desktop hero; reused as-is (D-04) |
</phase_requirements>

---

## Summary

Phase 64 is a **composition-only redesign** — no new data models, no new social primitives, no schema changes. The work is entirely structural: changing the top-to-bottom child order in `page.tsx`'s three render branches, and splitting the monolithic `WatchDetail.tsx` `'use client'` island so that `CommentThread` (an uncached RSC sibling) can render above the full spec cards in the DOM tree rather than below them.

The core challenge is the **island split (D-07)**. Today `WatchDetail.tsx` is a single `'use client'` island whose JSX includes both the hero content (photo, title, like, owner-actions) and the trailing content (4 full spec cards, gap-fill, notes, verdict). Getting `CommentThread` above the spec cards requires that the trailing content move to RSC siblings rendered AFTER `CommentThread` in the server tree — because `CommentThread` cannot be imported into a `'use client'` module. CSS tricks that visually reorder DOM elements without changing DOM position are explicitly forbidden (D-07) as they break tab and screen-reader order.

The Cache Components structure from Phase 51/52 (the `#419` soft-nav fix) is the hardest constraint in this phase. Lines 47 and 93 of `page.tsx` (`unstable_instant = false` and `await connection()`) are immovable. The sync-outer / async-inner / local-`<Suspense>` pattern that wraps `UnifiedWatchContent` must be preserved verbatim. The `ppr-dynamic-before-use-cache.test.ts` static guard (which checks call ordering in this file) must remain green.

**Primary recommendation:** Split `WatchDetail.tsx` into `WatchDetailHero` (client island: carousel, title, like + comment-count-anchor, last-worn, flag-deal, owner actions, condensed spec strip) and `WatchDetailTrailing` (spec cards, gap-fill, notes — could be RSC or a second `'use client'` island depending on whether any interactivity is needed; the spec cards and notes are display-only so RSC is correct). Reorder page.tsx sibling trees per D-02. Give `CommentThread`'s `<section>` a stable `id="comments"` for the anchor.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Hero layout (photo + verdict + title + like) | Browser / Client | — | `WatchPhotoSection` and `LikeButton` require `'use client'`; hero island is client |
| Trailing spec cards (4 cards + gap-fill + notes) | API / Backend (RSC) | — | These are display-only; no hooks/event handlers; moving them to RSC removes client bundle weight |
| `CommentThread` fetch + render | API / Backend (RSC) | — | Uncached async RSC — privacy guarantee; MUST NOT become client |
| Jump-to-comments anchor | Browser / Client | — | Scroll behavior is client-side; anchor tag `<a href="#comments">` needs no JS |
| Owner actions (Mark Worn, Edit, Delete, Flag-deal) | Browser / Client | — | Server Actions + useTransition + Dialog require `'use client'` |
| Rails (SameFamilyRail, LineageRail) | API / Backend (RSC) | — | Pure RSC siblings; already correct |
| OtherOwnersRoster, CatalogPageActions | API / Backend (RSC) / Client | — | Roster is RSC; CatalogPageActions is `'use client'` (event handlers); both are already siblings |
| `CollectionFitCard` | API / Backend (RSC) | Browser / Client | Pure-renderer; imported into the current `'use client'` island but has no requirement to be there; can move to server tree |
| Branch 3 hero (single-image + verdict) | API / Backend (RSC) | — | Branch 3 has no client island today; new hero shell stays RSC |
| `WatchPageSkeleton` | CDN / Static | — | Pure JSX, no dynamic API; forms the static shell for soft-nav |
| `unstable_instant = false` / `await connection()` | Frontend Server (SSR) | — | Route-level PPR opt-out; non-negotiable; must remain at module top |

---

## Standard Stack

No new libraries are introduced in this phase. All dependencies exist.

### Core (existing — no new installs)

| Component | Location | Role in Phase |
|-----------|----------|---------------|
| `WatchPhotoSection` | `src/components/watch/WatchPhotoSection.tsx` | Hero primary visual (D-04); reuse as-is |
| `CollectionFitCard` | `src/components/insights/CollectionFitCard.tsx` | Verdict card; elevate into hero (D-09) |
| `LikeButton` | `src/components/shared/LikeButton.tsx` | Like toggle in hero; `'use client'` |
| `CommentThread` | `src/components/comment/CommentThread.tsx` | Uncached RSC sibling; move UP in tree |
| `SpecsSublabel` | `src/app/w/[ref]/page.tsx:752-768` | One-line condensed spec strip in hero (D-03) |
| `SameFamilyRail` / `LineageRail` | `src/components/insights/` | Self-hiding RSC rails; move BELOW comments |
| `OtherOwnersRoster` | `src/components/insights/OtherOwnersRoster.tsx` | RSC; surface high in Branch 3 (D-13) |
| `CatalogPageActions` | `src/components/watch/CatalogPageActions.tsx` | `'use client'`; surface high in Branch 3 (D-13) |
| `ReferenceIdentityCard` | `src/components/insights/ReferenceIdentityCard.tsx` | Fresh-account taste card; RSC |

**Installation:** No new packages needed. [VERIFIED: direct source read]

---

## Architecture Patterns

### System Architecture Diagram

```
/w/[ref] page.tsx (sync outer — PERMANENT)
  │
  └─ await connection()           ← PERMANENT opt-out of static shell
  └─ <Suspense fallback={WatchPageSkeleton}>   ← streams during request-time render
       └─ UnifiedWatchContent (async RSC)
            │
            ├─ Branch 1 (per-user watch) — NEW CHILD ORDER:
            │    ├─ <WatchDetailHero>    ← NEW: hero client island (carousel · title · verdict · like · actions · spec strip)
            │    ├─ <Suspense fallback={<CommentThreadSkeleton />}>   ← MOVED UP from bottom
            │    │    └─ <CommentThread> ← uncached RSC; NO 'use client', NO 'use cache'
            │    ├─ <WatchDetailTrailing>  ← NEW: RSC — 4 full spec cards + gap-fill + notes
            │    ├─ <SameFamilyRail>       ← self-hiding RSC; moved BELOW comments
            │    ├─ <LineageRail>          ← self-hiding RSC; moved BELOW comments
            │    └─ [fresh-account CTAs]   ← kept near bottom or with verdict (D-10)
            │
            ├─ Branch 2 D-06 (owner via catalogId) — same hero→comments→trailing→rails order
            │    ├─ <WatchDetailHero>
            │    ├─ <Suspense><CommentThread></Suspense>   ← MOVED UP
            │    ├─ <WatchDetailTrailing>
            │    ├─ <SameFamilyRail>
            │    └─ <LineageRail>
            │
            └─ Branch 3 (pure catalog — no comments, no carousel) — NEW ORDER:
                 ├─ [catalog hero shell: single image + title + verdict + SpecsSublabel]  ← stays RSC
                 ├─ <OtherOwnersRoster>    ← MOVED UP near verdict (D-13)
                 ├─ <CatalogPageActions>   ← MOVED UP near verdict (D-13)
                 ├─ [fresh-account empty state]
                 ├─ <SameFamilyRail>
                 └─ <LineageRail>
```

### Recommended Component Split

**New: `WatchDetailHero` (client island)**

Extracted from `WatchDetail.tsx`. Handles everything that needs client interactivity or appears in the hero:
- `WatchPhotoSection` (carousel + wear pics)
- Title / brand / model / reference / status badge
- `LikeButton` + comment-count jump-link (`<a href="#comments">`)
- Last-worn line (`viewerCanEdit && (owned || grail)`)
- Flag-deal checkbox
- Owner action buttons (Mark Worn, Edit, Delete dialog)
- `SpecsSublabel` condensed one-liner (from `page.tsx:752-768`)
- `CollectionFitCard` slot (verdict prop passed in from server — pure-render)
- Fresh-account fill: `ReferenceIdentityCard` or caption (currently sibling; can stay sibling in server tree; see "Verdict Empty-State" below)

Props needed: everything currently passed to `WatchDetail` except those only needed by spec cards / notes.

**New: `WatchDetailTrailing` (RSC — no `'use client'`)**

Extracted from `WatchDetail.tsx`. Pure display; no hooks, no event handlers:
- Specifications card
- Pricing card
- Classification card
- Tracking / Wear card (uses `formatDate` — but `formatDate` is a pure function, safe in RSC)
- Gap-fill card (uses `computeGapFill` — pure function; needs `watch`, `collection`, `preferences` props)
- Notes card

Since these are pure render, moving them to an RSC shrinks the client bundle and does not require any interaction plumbing. The RSC receives `watch`, `collection`, `preferences`, `lastWornDate` directly from the `page.tsx` branch (already in scope).

**Impact on props:**
- `WatchDetail.tsx` props interface splits between hero and trailing
- `formatDate` function moves to a shared utility or duplicated in both (it's a pure function — safe to import from a shared module or duplicate)
- `computeGapFill` called in `WatchDetailTrailing` RSC instead of in client island (it's a pure function; no client-only APIs)
- `daysSince` utility likewise pure; can be called in RSC

### Island Split — Shared State / Handlers Analysis

The current client island owns these handlers that could span the split:

| Handler | Needed in Hero | Needed in Trailing | Conclusion |
|---------|---------------|--------------------|------------|
| `handleDelete` | Yes (Delete button is in owner actions) | No | Stays in hero |
| `handleMarkAsWorn` | Yes (Mark as Worn button) | No | Stays in hero |
| `handleFlagDealChange` | Yes (Flag-deal checkbox) | No | Stays in hero |
| `isPending` / `useTransition` | Yes (all three handlers) | No | Stays in hero |
| `isDeleteDialogOpen` / `useState` | Yes (Delete dialog trigger) | No | Stays in hero |
| `router` / `useRouter` | Yes (all three push/refresh calls) | No | Stays in hero |

**Key finding:** All interactive handlers live in the hero (owner actions, Mark Worn, Flag-deal, Delete). The trailing content (spec cards, gap-fill, notes) has no event handlers. The split is clean — no shared state crosses the boundary. [VERIFIED: `WatchDetail.tsx` full read]

**`gapFill` computation:** Currently `computeGapFill(watch, collection, preferences)` runs inside the client island at line 136-138. Moving to `WatchDetailTrailing` (RSC) is safe because `computeGapFill` is a pure function with no side effects or client APIs. Props `watch`, `collection`, `preferences` are already resolved in `page.tsx` — just pass them to the trailing RSC. [VERIFIED: `WatchDetail.tsx:136-138`]

**`formatDate` function:** Currently defined at `WatchDetail.tsx:106-119`. If `WatchDetailTrailing` is an RSC in a separate file, this function either:
- Gets duplicated in the new file (acceptable; it's small and pure), or
- Gets extracted to a shared util like `src/lib/dates.ts`

The `timeZone: 'UTC'` pinning (React #418 fix) MUST be preserved wherever `formatDate` is called. [VERIFIED: `WatchDetail.tsx:109-118`]

### Server-Tree Reordering — Branch-by-Branch

**Branch 1 (per-user, lines 304-391) — current order:**
```
<WatchDetail>            (client island; all content)
[ReferenceIdentityCard or caption]
<SameFamilyRail>
<LineageRail>
<Suspense><CommentThread></Suspense>   ← currently LAST
[fresh-account 3-CTA buttons]
```

**Branch 1 — new order (D-02):**
```
<WatchDetailHero>           (hero client island)
<Suspense><CommentThread id-anchored></Suspense>   ← MOVED UP to position 2
<WatchDetailTrailing>       (spec cards, gap-fill, notes — RSC)
<SameFamilyRail>            (after trailing, per D-02)
<LineageRail>
[ReferenceIdentityCard or caption / fresh-account CTAs]  ← planner decides (D-10/D-15)
```

**Branch 2 D-06 (owner via catalogId, lines 550-625) — current order:**
```
<WatchDetail>
[ReferenceIdentityCard or caption]
<SameFamilyRail>
<LineageRail>
{/* OtherOwnersRoster/CatalogPageActions TODO comment */}
<Suspense><CommentThread></Suspense>   ← currently LAST
[fresh-account 3-CTAs]
```

**Branch 2 — new order:**
```
<WatchDetailHero>
<Suspense><CommentThread></Suspense>   ← MOVED UP
<WatchDetailTrailing>
<SameFamilyRail>
<LineageRail>
[fresh-account CTAs]
```
Note: The TODO comment at `page.tsx:594-595` ("OtherOwnersRoster and CatalogPageActions are cross-user-only") is correct — this is the D-06 owner branch; OtherOwnersRoster / CatalogPageActions do NOT appear here. The TODO simply resolves by leaving them absent (the redesign "definitively resolves" the question as: not here). [VERIFIED: `page.tsx:594-595`]

**Branch 3 (pure catalog, lines 656-725) — current order:**
```
[image + h1 + reference + SpecsSublabel]   ← inline div, no client island
<CollectionFitCard>
[ReferenceIdentityCard or caption]
<OtherOwnersRoster>
<SameFamilyRail>
<LineageRail>
<CatalogPageActions>   ← currently LAST
```

**Branch 3 — new order (D-12/D-13):**
```
[catalog hero shell: single-image + h1 + reference + SpecsSublabel + CollectionFitCard]
<OtherOwnersRoster>    ← MOVED HIGH (D-13; social proof drives discovery)
<CatalogPageActions>   ← MOVED HIGH (D-13; add-to-collection CTA near verdict)
[ReferenceIdentityCard or caption]
<SameFamilyRail>
<LineageRail>
```
Branch 3 has no `WatchDetail` island today and no `CommentThread` (no `watches.id` target). The hero shell stays RSC and is just a restructured version of the existing `div` block. No island split needed for Branch 3. [VERIFIED: `page.tsx:656-725`]

### Jump-to-Comments Anchor (D-06)

**What:** The comment-count `<span>` at `WatchDetail.tsx:237-243` currently renders as non-interactive display. D-06 converts it to a `<a href="#comments">` anchor.

**How:** Give `CommentThread`'s wrapping `<section>` a stable `id="comments"`. The `<section className="mt-6">` at `CommentThread.tsx:66` becomes `<section id="comments" className="mt-6">`. Then in `WatchDetailHero`, the comment-count renders as `<a href="#comments">` (or `<button onClick={() => document.getElementById('comments')?.scrollIntoView({ behavior: 'smooth' })}`).

**Anchor `<a href="#comments">` vs. `scrollIntoView`:**
- `<a href="#comments">` is pure HTML, no JS, accessible, works without hydration. Native browser smooth-scroll via `scroll-behavior: smooth` on `<html>` (already set globally in Tailwind's `@layer base` or body). This is the simpler and more robust approach.
- `scrollIntoView` requires a click handler on a `<button>`, which is also fine but adds a small amount of client-side glue and requires `'use client'` on that component (which the hero island already has).

**Recommendation (for planner):** Use `<a href="#comments">` — zero JS overhead, no hydration dependency, works even before React mounts. Since the hero is already a client island, a `<button onClick={scrollIntoView}>` is also viable if the planner prefers the UX of smooth-scroll JS over the browser default. Either is correct.

**Critical constraint:** The comment-count must not pull comment data into the hero island. The `commentCount` prop (already threaded from `page.tsx` via `getCommentsForTarget`) provides the display number. `CommentThread` still fetches its own list server-side. This separation is already in place and must be preserved. [VERIFIED: `WatchDetail.tsx:237-243`, `page.tsx:267-269`]

### Cache Components / #419 Preservation

**Lines that are load-bearing and must not move in `page.tsx`:**

```typescript
// line 47 — module-level export; must stay at module scope
export const unstable_instant = false

// line 93 — must stay at the TOP of the default export body, before ANY other work
await connection()

// lines 94-98 — Suspense wrapping the async content component
return (
  <Suspense fallback={<WatchPageSkeleton />}>
    <UnifiedWatchContent params={params} />
  </Suspense>
)
```

These three elements form the Phase 51/52 structural #419 fix. `unstable_instant = false` disables the PPR instant-nav validator for this route. `await connection()` opts the entire page out of the PPR static shell, so soft-nav renders at request-time (like hard refresh), eliminating the partial-prerender resume abort. The local `<Suspense>` streams `WatchPageSkeleton` during the request-time render. None of these may be moved, removed, or reorganized. [VERIFIED: `page.tsx:42-99` header comment block + `page.tsx:80-99`]

**The `ppr-dynamic-before-use-cache.test.ts` static guard:** This test checks that in `page.tsx`, `createSupabaseServerClient()` appears BEFORE `getLikesForTargetCached()` within each branch (within a 50-line lookahead window). The redesign does not add new `getLikesForTargetCached` calls or move the admin client instantiation, so this guard should remain green. But the planner must verify that restructuring branch 1's JSX does not accidentally move the call ordering. Note: the current code uses `createSupabaseAdminClient()` not `createSupabaseServerClient()` — the test guard's `createSupabaseServerClient(` pattern may already be vacuously passing (no matches). Worth verifying that the test actually catches the intended ordering. [VERIFIED: `page.tsx:163-170`, `tests/static/ppr-dynamic-before-use-cache.test.ts:147-181`]

**Admin client for signing:** All `createSupabaseAdminClient()` calls in Branch 1 and Branch 2-D06 must stay inside the RSC (`UnifiedWatchContent`) before any `getLikesForTargetCached` calls, exactly as today. The redesign does not touch this. [VERIFIED: `page.tsx:163`, `page.tsx:499`]

**`WatchPageSkeleton` update:** The planner should update `WatchPageSkeleton` (lines 103-114) to reflect the new IA shape — a skeleton with a wide aspect-ratio carousel block (hero left), a narrower right column (hero right), then a narrow comment skeleton, then spec cards. What it MUST NOT do:
- Reference any dynamic API (cookies, headers, params)
- Import any `'use client'` component
- Use `useEffect`, `useState`, or any React hook
- Grow beyond pure JSX with `Skeleton` primitives

The skeleton is rendered as the `<Suspense>` fallback during the request-time render (not as a prerendered static shell, since `await connection()` opts out of the PPR static shell). It is still useful for the streaming loading state. [VERIFIED: `page.tsx:101-114`]

### Date-TZ Hydration (#418) — Confirmed Safe

`formatDate` at `WatchDetail.tsx:106-119` uses `toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric' })`. The #418 fix is in place and documented in code comments.

When `formatDate` moves to `WatchDetailTrailing` (RSC):
- In an RSC there is no hydration mismatch risk — the RSC renders server-side only and sends HTML. The `timeZone: 'UTC'` pinning is still correct practice for RSCs (avoids server-locale variation), but the hydration risk specifically is eliminated.
- If `WatchDetail.tsx` remains as a client island (just stripped of trailing content), `formatDate` stays in the file for the last-worn line that remains in the hero (line 257: `{formatDate(lastWornDate)}`).
- The Tracking card's `formatDate(watch.acquisitionDate)` and `formatDate(lastWornDate ?? undefined)` at `WatchDetail.tsx:495-508` move to `WatchDetailTrailing` (RSC). Must carry the `timeZone: 'UTC'` pinning.

[VERIFIED: `WatchDetail.tsx:106-119`, `WatchDetail.tsx:493-511`]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Smooth-scroll to comments | Custom scroll manager | Native `<a href="#comments">` or `scrollIntoView` | Browser native; zero JS required for anchor; `scrollIntoView` for programmatic |
| RSC/client split pattern | New abstraction | Existing B1 sibling-composition pattern (already used for CommentThread, rails, roster) | Established in this codebase; planner just applies it to the new pieces |
| Skeleton update | Re-architect | Update existing `WatchPageSkeleton` JSX | It's pure JSX; just rearrange `Skeleton` primitives to mirror the new IA |
| `SpecsSublabel` in hero | New component | Reuse `SpecsSublabel` function at `page.tsx:752-768` | Already exists; extract/move or import into the hero rendering |

---

## Runtime State Inventory

Step 2.5: SKIPPED — this is a layout/composition redesign with no string renames, no data migrations, no rebrand. No stored data, live service config, OS-registered state, secrets, or build artifacts are affected.

---

## Environment Availability

Step 2.6: Core environment — Node.js, npm, Next.js, Tailwind — all running (project is live in production). No new external dependencies introduced. No new tools required.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Next.js 16 App Router | Entire phase | Yes | 16.2.3 | — |
| Vitest | Static guard tests | Yes | ^2.1.9 | — |
| `npm run build` | Phase gate | Yes | — | — |

---

## Common Pitfalls

### Pitfall 1: Importing `CommentThread` into the Client Island

**What goes wrong:** Placing `import { CommentThread } from '@/components/comment/CommentThread'` inside `WatchDetailHero.tsx` (which has `'use client'`). Next.js 16 converts all imports of a `'use client'` module into client modules, so `CommentThread` would become a client component — stripping its async RSC behavior and the privacy guarantee.

**Why it happens:** Developer refactoring toward a "hero file" accidentally pulls in comment rendering for the comment-count display.

**How to avoid:** The comment-count in the hero is display-only (a number prop). Never import `CommentThread` from any `'use client'` file. `CommentThread` stays in `page.tsx`'s server tree as a direct child of `UnifiedWatchContent`.

**Warning signs:** TypeScript will not catch this. ESLint might not catch it. The static test in `tests/static/` does not currently guard this. Add a new static guard (see Validation Architecture section).

### Pitfall 2: Moving `await connection()` Out of the Default Export Body

**What goes wrong:** Restructuring `page.tsx` and accidentally moving `await connection()` into `UnifiedWatchContent` (the async RSC) instead of keeping it at the top of the default sync export.

**Why it happens:** Developer reads "this should be near the data fetching" and moves it closer to the DB calls.

**How to avoid:** `await connection()` must stay in the default export (`UnifiedWatchPage`), before the `return (<Suspense>...)`. Moving it to `UnifiedWatchContent` re-introduces the partial prerender abort on soft-nav. The existing header comment block (lines 80-98) explains this; read it before editing.

**Warning signs:** `npm run build` completes (build can't catch this). Symptom is a React #419 error on soft-nav to `/w/[ref]` — only reproducible on prod.

### Pitfall 3: CSS-Order Visual Reordering (Forbidden by D-07)

**What goes wrong:** Using `order-first` / `flex-col-reverse` / negative `order` to visually place comments above spec cards while leaving them later in the DOM.

**Why it happens:** Seems like an easy shortcut to avoid the island split.

**How to avoid:** D-07 explicitly forbids this. It breaks keyboard tab order and screen-reader order. The island MUST be split and `CommentThread` MUST appear BEFORE `WatchDetailTrailing` in the DOM/server tree.

### Pitfall 4: Broken Turbopack Cache After CSS/Layout Changes

**What goes wrong:** Layout change appears not to work in dev server even after code is correct.

**Why it happens:** Turbopack's `.next/` cache serving stale CSS/JS.

**How to avoid:** `rm -rf .next` before concluding a layout fix failed (MEMORY: `project_turbopack_next_cache_stale_css`).

### Pitfall 5: `SpecsSublabel` Not Accessible Outside `page.tsx`

**What goes wrong:** `SpecsSublabel` is a module-level function in `page.tsx` (lines 752-768). It is not exported. Using it in the new `WatchDetailHero` client island requires either: (a) exporting it from `page.tsx` and importing into the hero — but RSC page exports are not importable into client islands in Next.js 16 App Router; (b) duplicating the function in the hero component; or (c) extracting it to a shared utility (recommended).

**Why it happens:** `SpecsSublabel` was a convenience function in the catalog branch; it now needs to appear in the hero across all branches.

**How to avoid:** Extract `SpecsSublabel` to a small shared RSC-compatible file (e.g., `src/components/watch/SpecsSublabel.tsx`) with no `'use client'`. Then import it from both the server tree (Branch 3 catalog header) and the hero client island (since importing a pure function from a non-`'use client'` file into a `'use client'` component is legal in Next.js App Router).

### Pitfall 6: `computeGapFill` Uses Client-Specific Imports

**What goes wrong:** Moving `computeGapFill` to an RSC but `gapFill.ts` or its imports pull in something client-only (e.g., Zustand store).

**Why it happens:** `computeGapFill` currently runs in the client island. If it or its deps import `useWatchStore` or similar, the RSC move would break.

**How to avoid:** `computeGapFill` at `@/lib/gapFill` is a pure function (takes `watch`, `collection`, `preferences`). It should have no client-only imports. Verify with a quick check before moving. [ASSUMED — verify `src/lib/gapFill.ts` imports before implementing]

### Pitfall 7: Branch 3 Getting a Client Island by Accident

**What goes wrong:** Refactoring Branch 3's hero shell into a `WatchDetailHero` component (to share code with Branches 1 & 2) and that component having `'use client'` — which would add an unnecessary client island to Branch 3.

**Why it happens:** DRY reflex during implementation.

**How to avoid:** Branch 3's hero shell has no client interactivity (no like button for catalog-only view? — actually, like buttons exist even on catalog views for authenticated users). Check: does Branch 3 need a `LikeButton`? Looking at the current code (lines 656-725), there is no `LikeButton` in Branch 3 today — it just has `CollectionFitCard` + roster + rails + actions. If D-02/D-14 requires a like button in Branch 3's hero, it needs client island plumbing. If not (catalog-only view is view-and-add, not like), Branch 3 stays RSC. [ASSUMED: Branch 3 like button requirement needs planner decision — current code has no LikeButton in Branch 3]

### Pitfall 8: The P61-BUG-01 Static Guard May Fire

**What goes wrong:** The `ppr-dynamic-before-use-cache.test.ts` guard checks that `createSupabaseServerClient(` appears within 50 lines before `getLikesForTargetCached(` in `page.tsx`. The current code uses `createSupabaseAdminClient()` (not `createSupabaseServerClient()`), so the guard pattern `/createSupabaseServerClient\(/` may not match any active code — the guard may be vacuously passing. If the redesign changes call ordering in a way that matters, a false-green guard would fail to catch it.

**How to avoid:** Review the static guard's pattern against the actual function names used in `page.tsx`. If the guard needs updating to match `createSupabaseAdminClient`, update it. The principle it encodes (admin client call before `getLikesForTargetCached` in each branch) is still correct; only the pattern string may need updating. [VERIFIED: `page.tsx:163` uses `createSupabaseAdminClient`; `tests/static/ppr-dynamic-before-use-cache.test.ts:152` checks `createSupabaseServerClient` — pattern mismatch exists]

---

## Code Examples

### Pattern 1: RSC Sibling Composition (B1 Invariant)

The established pattern for rendering RSC siblings around a client island, confirmed in the existing server tree. [VERIFIED: `page.tsx:304-391`]

```typescript
// page.tsx — server tree (UnifiedWatchContent, async RSC)
// Hero client island (carousel + title + verdict + like + actions + spec strip)
<WatchDetailHero
  watch={watch}
  verdict={verdict}
  viewerCanEdit={isOwner}
  viewerId={user.id}
  initialLikeState={...}
  commentCount={commentCount}
  signedPhotos={signedPhotos}
  // ... other hero props
/>

{/* CommentThread: uncached async RSC in Suspense — MUST be a direct
    sibling of the hero client island, NOT imported into it (B1 invariant).
    id="comments" enables the jump-link anchor from WatchDetailHero. */}
<Suspense fallback={<CommentThreadSkeleton />}>
  <CommentThread
    viewerId={user.id}
    target={target}
    canComment={canCommentDisplay}
    // ... other props
  />
</Suspense>

{/* Trailing spec cards: pure RSC — no hooks, no event handlers. */}
<WatchDetailTrailing
  watch={watch}
  collection={collection}
  preferences={preferences}
  lastWornDate={lastWornDate}
/>

{/* Rails: self-hiding RSC siblings */}
<SameFamilyRail rows={sameFamily} />
<LineageRail rows={lineage} />
```

### Pattern 2: CommentThread `<section>` with Stable `id`

```typescript
// src/components/comment/CommentThread.tsx
// Add id="comments" to the section element — enables <a href="#comments"> jump link
return (
  <section id="comments" className="mt-6">
    <h2 className="text-sm font-semibold mb-4">Comments</h2>
    <CommentList ... />
  </section>
)
```

### Pattern 3: Jump-to-Comments Anchor in Hero (Simple Version)

```typescript
// Inside WatchDetailHero (client island)
// commentCount prop passed from page.tsx — no comment data fetched in hero
{(commentCount ?? 0) > 0 && (
  <a
    href="#comments"
    className="inline-flex items-center gap-1 text-sm tabular-nums text-muted-foreground px-2 min-h-[44px] hover:text-foreground transition-colors"
  >
    <MessageCircle className="size-5" aria-hidden />
    {commentCount}
  </a>
)}
```

### Pattern 4: `SpecsSublabel` Extraction for Shared Use

```typescript
// src/components/watch/SpecsSublabel.tsx  (new shared file — NO 'use client')
export function SpecsSublabel({
  movement,
  caseSizeMm,
  dialColor,
}: {
  movement: string | null
  caseSizeMm: number | null
  dialColor: string | null
}) {
  const parts = [
    movement,
    caseSizeMm ? `${caseSizeMm}mm` : null,
    dialColor,
  ].filter((p): p is string => Boolean(p))
  if (parts.length === 0) return null
  return <p className="text-sm text-muted-foreground">{parts.join(' • ')}</p>
}
// Safe to import into 'use client' hero component (pure function; no server-only APIs)
```

### Pattern 5: `WatchDetailTrailing` as RSC

```typescript
// src/components/watch/WatchDetailTrailing.tsx  (NO 'use client')
import { computeGapFill } from '@/lib/gapFill'
import { daysSince } from '@/lib/wear'
import type { Watch, UserPreferences } from '@/lib/types'

interface WatchDetailTrailingProps {
  watch: Watch
  collection: Watch[]
  preferences: UserPreferences
  lastWornDate?: string | null
}

export function WatchDetailTrailing({ watch, collection, preferences, lastWornDate }: WatchDetailTrailingProps) {
  const isWishlistLike = watch.status === 'wishlist' || watch.status === 'grail'
  const gapFill = isWishlistLike ? computeGapFill(watch, collection, preferences) : null
  // ... spec card JSX (Specifications, Pricing, Classification, Tracking, Gap-fill, Notes)
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Monolithic `'use client'` island with all content | Split hero island + RSC trailing | Smaller client bundle; comments above specs in DOM |
| Comments buried at bottom of page tree | Comments immediately after hero (Suspense sibling) | PAGE-02 satisfied |
| Verdict at island bottom (line 547) | Verdict elevated into hero right column | PAGE-01 satisfied |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `computeGapFill` in `src/lib/gapFill.ts` has no client-only imports (no Zustand, no `window`, no hooks) | Pitfall 6 | If it does import client-only APIs, `WatchDetailTrailing` cannot be an RSC; would need to remain a `'use client'` island (which is still fine — trailing can be client, it just doesn't need to be) |
| A2 | Branch 3 (pure catalog) does not need a `LikeButton` in its hero | Pitfall 7, Branch 3 redesign | If Branch 3 needs a like button, a client island is needed for Branch 3's hero too |
| A3 | `scroll-behavior: smooth` is applied globally (via Tailwind base layer or `globals.css`) so `<a href="#comments">` produces a smooth scroll without JS | Jump-to-comments | If not set globally, the anchor will instant-jump; add `scroll-smooth` class to the `<html>` element or use `scrollIntoView({behavior:'smooth'})` in a click handler |

---

## Open Questions (RESOLVED)

> All four discretion items were resolved in `64-UI-SPEC.md` and are implemented in the Phase 64 plans (verified by gsd-plan-checker). Resolutions inlined below.

1. **Verdict in hero when `verdict === null` (D-10 — planner discretion)**
   - What we know: `verdict` is `null` when `collection.length === 0`. The hero right column would be empty in this case.
   - What's unclear: Does `ReferenceIdentityCard` go inside the hero right column (replacing the verdict) or stays as a sibling below the hero? Does the 3-CTA block (`Add to Wishlist / Collection / Skip`) stay near the bottom or move into the hero?
   - RESOLVED: `ReferenceIdentityCard` in the hero right column when verdict is null and confidence >= 0.5; the "Add a few watches to see how this one fits your collection." caption in the hero right column when both are absent; the 3-CTA block stays near the page bottom (it's an action footer, not hero content). Locked in UI-SPEC; implemented in Plan 64-02.

2. **Gap-fill in hero vs trailing (D-11 — planner discretion)**
   - What we know: Gap-fill callout is currently in the island below the spec cards (line 517-544).
   - What's unclear: D-11 says lean is "pair with verdict in hero." If gap-fill goes in the hero, it needs to be part of `WatchDetailHero` props (verdict + gapFill computed).
   - RESOLVED: Keep gap-fill in `WatchDetailTrailing` (below comments, above notes). It is reference material like the spec cards, not a primary verdict-level insight. Locked in UI-SPEC; implemented in Plan 64-03.

3. **Owner actions placement (D-15 — planner discretion)**
   - What we know: Currently in the hero island (Mark Worn, Edit, Delete dialog). D-15 leaves it to planner: hero vs dedicated bottom footer.
   - RESOLVED: Keep owner actions in the hero right column. They are contextual to the hero content and the owner-edit workflow; a bottom footer would require an additional client island or extending the trailing RSC to client. Locked in UI-SPEC; implemented in Plan 64-02 (gated by `viewerCanEdit`).

4. **Desktop 2-col hero grid class**
   - What we know: Current `WatchDetail.tsx:173` uses `grid gap-8 lg:grid-cols-[2fr_1fr]` for photo+spec-rail. New hero needs a different ratio for photo+verdict.
   - What's unclear: D-01 says "carousel left, verdict + like + title right" — the ratio should favor the carousel (photo) more than the current 2fr/1fr. Common choices: `lg:grid-cols-[3fr_2fr]` or `lg:grid-cols-[60%_40%]`.
   - RESOLVED: `grid gap-8 lg:grid-cols-[3fr_2fr]` — gives the carousel more real estate without making the verdict column too narrow; collapses to single column below `lg` by CSS-grid default. Locked in UI-SPEC; implemented in Plan 64-02.

---

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json`. Section included.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/static/ --reporter=verbose` |
| Full suite command | `npm run test` |
| Build gate command | `npm run build` (exit 0 is the authoritative gate) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PAGE-01 | Server-tree child order: hero before comments before trailing before rails | Static (fs-scan) | `npx vitest run tests/static/watch-detail-ia-order.test.ts` | No — Wave 0 |
| PAGE-02 | `CommentThread` renders before spec cards in server tree (not after all rails) | Static (fs-scan) | Same file | No — Wave 0 |
| PAGE-03 | `CommentThread` has no `'use client'` and no `'use cache'` | Static (grep) | `npx vitest run tests/static/comment-thread-no-client.test.ts` | No — Wave 0 |
| PAGE-03 | `unstable_instant = false` still present at `page.tsx` module scope | Static (fs-scan) | `npx vitest run tests/static/ppr-dynamic-before-use-cache.test.ts` | Yes — existing |
| PAGE-03 | `await connection()` still present inside `UnifiedWatchPage` before `<Suspense>` | Static (fs-scan) | Same existing test (add assertion) | Partial |
| PAGE-03 | `WatchDetailHero` does not import `CommentThread` | Static (grep) | `npx vitest run tests/static/watch-detail-ia-order.test.ts` | No — Wave 0 |
| PAGE-04 | `WatchPhotoSection` appears in the hero island | Static (grep) | Same file | No — Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/static/ --reporter=verbose` (fast; covers structural guards)
- **Per wave merge:** `npm run test` (full suite)
- **Phase gate:** `npm run build` (exit 0) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/static/watch-detail-ia-order.test.ts` — static guard for new IA child order and island-split correctness:
  - PAGE-01: In `src/app/w/[ref]/page.tsx`, `WatchDetailHero` render line appears before `CommentThread` render line, which appears before `WatchDetailTrailing` render line, which appears before `SameFamilyRail` render line.
  - PAGE-02: `CommentThread` appears in the server tree before the spec card section (confirmed by position in page.tsx).
  - PAGE-03: `WatchDetailHero` does not contain `import.*CommentThread` in its source file.
  - PAGE-04: `WatchDetailHero` source file contains `WatchPhotoSection`.
  - Must use `// @vitest-environment node` (filesystem reads; MEMORY `project_vitest_static_node_env`).
- [ ] `tests/static/comment-thread-no-client.test.ts` (or extend existing) — confirms `CommentThread.tsx` does not have `'use client'` or `'use cache'` at file top.
  - Note: this guard exists partially (the CRITICAL comment at `CommentThread.tsx:1` is documentation, not enforcement). A static test that `readFileSync` the file and checks `!content.includes("'use client'")` and `!content.includes("'use cache'")` would be a proper CI guard.
  - Must use `// @vitest-environment node`.

### What is `human_needed` on Prod

The following behaviors cannot be verified locally (empty test DB; no visual rendering in static tests):

- Responsive hero collapse (2-col desktop → 1-col mobile) — verify on prod (MEMORY: `feedback_mobile_ui_verify_on_prod`)
- Smooth-scroll behavior on mobile tap of comment-count anchor
- Desktop 2-col hero visual balance (carousel vs verdict proportions)
- `WatchPageSkeleton` visual match to new IA
- Overall "intentional hierarchy" subjective experience (PAGE-01)
- CommentThread visible without scrolling past all rails on a real populated watch

---

## Security Domain

> `security_enforcement` is not set to `false` in config. Section included.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No — no auth changes in this phase | — |
| V3 Session Management | No — no session changes | — |
| V4 Access Control | Yes (owner-only action gates) | `viewerCanEdit` prop gate on Edit/Delete/MarkWorn (preserved from current `WatchDetail.tsx`) |
| V5 Input Validation | No — no new inputs | — |
| V6 Cryptography | No — signing stays on admin client, unchanged | admin client `createSupabaseAdminClient()` |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Exposing owner actions to non-owners via hero split | Spoofing | `viewerCanEdit` prop must be threaded to `WatchDetailHero`; Server Actions double-verify ownership (T-RDB-06) |
| `CommentThread` becoming cached via accidental `'use cache'` | Information Disclosure | Privacy guarantee: no `'use cache'` on `CommentThread`; static guard in Wave 0 enforces this |
| IDOR on photo signing | Elevation of Privilege | Admin client only; storage paths are `{userId}/...` scoped by construction; not changed by this phase |

---

## Sources

### Primary (HIGH confidence — verified from direct source reads)

- `src/app/w/[ref]/page.tsx` — full read; confirmed branch structure, line numbers, `unstable_instant`, `await connection()`, `SpecsSublabel`, `WatchPageSkeleton`, `CommentThread` positions, all three render branches
- `src/components/watch/WatchDetail.tsx` — full read; confirmed internal order, props interface, handlers, `formatDate`, `computeGapFill` call, `CollectionFitCard` position
- `src/components/comment/CommentThread.tsx` — full read; confirmed RSC status, no `'use client'`, no `'use cache'`, `<section>` structure
- `src/components/insights/CollectionFitCard.tsx` — full read; confirmed pure-renderer (no hooks, no state)
- `src/components/watch/WatchPhotoSection.tsx` — header read; confirmed `'use client'` status
- `src/components/insights/OtherOwnersRoster.tsx` — full read; confirmed RSC status
- `src/components/watch/CatalogPageActions.tsx` — full read; confirmed `'use client'` status
- `src/components/insights/ReferenceIdentityCard.tsx` — full read; confirmed RSC status (no `'use client'`)
- `src/components/shared/LikeButton.tsx` — header read; confirmed `'use client'`
- `src/components/insights/SameFamilyRail.tsx` — header read; confirmed RSC (no `'use client'`)
- `tests/static/ppr-dynamic-before-use-cache.test.ts` — full read; confirmed existing guard logic and pattern mismatch (`createSupabaseServerClient` vs actual `createSupabaseAdminClient`)
- `tests/static/legacy-watch-routes.test.ts` — full read; confirmed prebuild hook and guard patterns (no changes needed here)
- `.planning/config.json` — confirmed `nyquist_validation: true`, `use_worktrees: false`, `commit_docs: true`
- `vitest.config.ts` — confirmed test framework, include patterns, jsdom default

### Secondary (MEDIUM confidence)

- `MEMORY: project_ppr_dynamic_before_use_cache` — PPR #419 opt-out pattern; confirmed by `page.tsx` header comment and static test
- `MEMORY: project_react_418_date_tz_hydration` — #418 hydration fix; confirmed by `WatchDetail.tsx:109-118`
- `MEMORY: project_turbopack_next_cache_stale_css` — `.next/` cache clearing; dev workflow advice
- `MEMORY: feedback_mobile_ui_verify_on_prod` — prod verification requirement for visual phases

---

## Metadata

**Confidence breakdown:**

- Island split mechanics: HIGH — full source read of `WatchDetail.tsx` and `page.tsx`; all handlers, props, and split points enumerated
- Server-tree reordering: HIGH — all three branches read line by line; current and new orders documented
- Cache Components preservation: HIGH — `page.tsx:42-99` header comment + lines 47, 93-99 confirmed; `ppr-dynamic-before-use-cache.test.ts` read in full
- Jump-to-comments anchor: HIGH — `WatchDetail.tsx:237-243` confirmed; `CommentThread.tsx:66` `<section>` confirmed
- Date-TZ hydration: HIGH — `WatchDetail.tsx:106-119` and `:493-511` confirmed; #418 fix documented in code
- Validation architecture: HIGH — `vitest.config.ts` confirmed; test locations and existing guards verified
- `computeGapFill` RSC safety: ASSUMED (A1) — need to verify `src/lib/gapFill.ts` imports

**Research date:** 2026-05-27
**Valid until:** 2026-06-27 (stable codebase; no fast-moving dependencies)
