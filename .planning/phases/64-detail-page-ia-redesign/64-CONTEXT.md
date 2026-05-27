# Phase 64: Detail Page IA Redesign - Context

**Gathered:** 2026-05-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Redesign the **information hierarchy** of the `/w/[ref]` watch-detail page so its surfaces appear in a deliberate top-to-bottom order — **carousel → verdict → like → comments → (spec cards) → rails → footer** — instead of today's append-order stacking where the verdict is buried mid-island and comments sit dead-last below every rail.

Delivers PAGE-01..04:
- **PAGE-01** — intentional hierarchy (carousel, verdict, like, comments, rails, footer), not stacked append-order.
- **PAGE-02** — comments occupy a deliberate, reachable position — not buried at the bottom.
- **PAGE-03** — preserve the Phase 51/52 Cache Components structure (CommentThread stays an **uncached** Suspense RSC sibling; `unstable_instant`/`connection()` opt-out + cache rules intact).
- **PAGE-04** — photo carousel integrated as a primary visual element of the page.

**This phase is a layout/IA redesign — no new data, no new social primitives.** It re-orders and re-composes existing surfaces (`WatchPhotoSection`, `CollectionFitCard`, `LikeButton`, `CommentThread`, spec cards, `SameFamilyRail`/`LineageRail`, `OtherOwnersRoster`, `CatalogPageActions`). It does NOT add comment targets, multi-photo support to catalog entries, or any new capability.

**Not this phase:** giving the generic catalog entry a real comment thread (no per-user target exists) or a multi-photo carousel (catalog entries carry one image; Phase 60 D-10 left `watches_catalog` photos untouched) — both are deferred (see Deferred Ideas).

</domain>

<decisions>
## Implementation Decisions

### Page Layout Skeleton (PAGE-01 / PAGE-04)
- **D-01 (hybrid hero):** Use a **photo-led hero, then single-column** layout. On **desktop** the hero is **2-column** (carousel left, `verdict + like + title` riding alongside on the right); **below the hero, everything is single-column full-width**. Mobile collapses to a single column throughout. Chosen over pure single-column and over keeping today's `2fr/1fr` photo+spec-rail grid — the spec rail competes with the verdict for top-of-page attention.
- **D-02 (canonical order):** Top-to-bottom: **Hero (carousel · title · verdict · like · condensed spec strip)** → **Comments** → **full spec cards** → **rails (SameFamily / Lineage / OtherOwners as applicable)** → **footer / owner actions**.
- **D-03 (spec cards):** Add a **condensed one-line spec strip** in the hero (reuse the existing `SpecsSublabel` pattern: `movement · {case}mm · {dial}`) so the essentials are above the fold. Keep the **four full spec cards** (Specifications / Pricing / Classification / Tracking) **below comments** in the single-column flow.
- **D-04 (carousel primary):** The existing `WatchPhotoSection` (carousel + filmstrip) is the primary visual at the top-left of the hero on desktop / top on mobile (PAGE-04). Reuse it as-is — do not re-engineer the carousel.

### Comment Placement (PAGE-02 / PAGE-03)
- **D-05 (position):** Comments render **directly under the hero, ABOVE the full spec cards and all rails** — this IS the PAGE-02 "reachable, not buried" fix (today they're below every rail at the very bottom).
- **D-06 (jump link):** The hero's comment-count indicator becomes a **tap-to-scroll "jump to comments"** affordance (smooth-scroll anchor). Today it's display-only (`WatchDetail.tsx:237-243`). This is a light interactive element — implement as a simple anchor; do not pull comment data into the hero island.
- **D-07 (LOAD-BEARING — island split):** `CommentThread` MUST stay an **uncached async RSC `<Suspense>` sibling** — **no `'use client'`, no `'use cache'`** (its absence is the comment privacy guarantee, see `comments.ts` PRIVACY LAYER NOTE). It **cannot** be imported into the `'use client'` `WatchDetail` island (B1 invariant). Because today's island **contains** the trailing spec cards / gap-fill / verdict / notes, getting comments above the spec cards requires **splitting the island**: the hero portion stays a client island; the trailing content (full spec cards, notes) moves to **RSC sibling(s) / a separate island rendered AFTER `CommentThread`** in the server tree. **Avoid CSS-order tricks** (DOM-below but visually-above) — they break tab order / screen-reader order. Planner owns the exact split shape.
- **D-08 (Cache Components intact — PAGE-03):** `export const unstable_instant = false` and the `await connection()` static-shell opt-out at the top of `page.tsx` are **PERMANENT — do not touch**. The sync-outer / async-inner / local-`<Suspense>` structure (the React #419 soft-nav fix) must survive the redesign. Owner-photo + wear-pic signing stays on the **admin client** (never the cookie client) inside this route. `'use cache'` data segments (`getLikesForTargetCached`, `getCatalogById`) stay free of request-time APIs.

### Verdict Prominence (PAGE-01)
- **D-09 (elevate verdict):** The Collection Fit verdict (`CollectionFitCard`) is **elevated into the hero** (right column on desktop), NOT at the bottom of the island as today (`WatchDetail.tsx:547`). It is the core product value ("does this add or duplicate?") and earns top placement.

### Catalog Branch — generic cross-user catalog view (Branch 3)
- **D-12 (shell parity, accept gaps):** Align the **generic catalog page** (`page.tsx:656-725` — viewer doesn't own it, viewed as a catalog entry not a specific person's watch) to the **same visual IA shell**: verdict-forward hero (single image), then rails + footer/actions in the new order. **Cleanly OMIT** comments (no per-user `watches.id` target exists) and the multi-photo carousel (single catalog image). Goal = consistent feel without inventing data.
- **D-13 (roster/actions high):** `OtherOwnersRoster` + `CatalogPageActions` surface **HIGH, near the verdict** — social proof + add-to-collection CTA drive discovery→collection on the catalog page. This resolves the two `page.tsx` TODO comments ("Phase 64 IA redesign will resolve this definitively" — lines ~594-595 and ~704-706).
- **D-14 (branch scope):** Branch 1 (per-user: owner + cross-user-of-a-person's-watch) and Branch 2 D-06 (owner arriving via a catalogId URL) get the **full hero + comments IA**. Branch 3 (pure catalog) gets the **shell-only variant** (D-12/D-13). All three branches stay visually coherent (same container, same hero language).

### Claude's Discretion
- **Owner actions placement (D-15):** Mark-as-Worn / Edit / Delete / Flag-deal / Last-worn line — hero vs a dedicated bottom "footer action bar." Keep them **hidden for non-owners** (as today via `viewerCanEdit`). Planner decides.
- **Empty-collection hero fill (D-10):** What fills the hero verdict slot when the viewer has no collection (verdict is `null`). Lean: `ReferenceIdentityCard` when `confidence ≥ 0.5`, else the "Add a few watches to see how this fits" caption; place the fresh-account 3-CTA (Add to Wishlist / Collection / Skip) block where it reads best.
- **Gap-fill placement (D-11):** The wishlist/grail gap-fill callout — pair with the verdict in the hero (lean) or as a separate card lower. Planner decides.
- **Comments desktop width:** full content width vs a narrower centered reading column.
- **Notes / Tracking / sub-ordering** within the lower spec section, and updating `WatchPageSkeleton` (`page.tsx:103-114`) so the loading shell mirrors the NEW IA rather than the old layout.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope
- `.planning/ROADMAP.md` — "Phase 64: Detail Page IA Redesign" (goal + 4 success criteria; "UI hint: yes"; depends on Phases 61, 62, 63).
- `.planning/REQUIREMENTS.md` — PAGE-01..04 (lines 66-69).
- `.planning/seeds/SEED-016-watch-detail-redesign.md` — the originating complaint ("comments too far down; page wants intentional hierarchy, not append-at-bottom growth") + the medium-scope framing (decide comment placement; reconcile verdict + footer + rails; keep Cache Components structure intact). Breadcrumbs point at the same three files below.

### The page + components being recomposed
- `src/app/w/[ref]/page.tsx` — the unified route. **Read the header comment block (lines 42-99)**: `unstable_instant = false`, `await connection()` opt-out, sync-outer/async-inner/`<Suspense>` #419 fix. Three render branches: Branch 1 per-user (304-391), Branch 2 D-06 owner-via-catalog (550-625), Branch 3 generic catalog (656-725). The `CommentThread` Suspense sibling is at 360-371 / 597-608. TODOs flagged for Phase 64 at ~594-595 and ~704-706.
- `src/components/watch/WatchDetail.tsx` — the `'use client'` island. Current internal order: photo (179-212) → title (214-226) → like + comment-count (228-245) → last-worn (247-266) → flag-deal (269-283) → owner actions (287-332) → spec cards right rail (336-513) → gap-fill (517-544) → **verdict (547)** → notes (550-561). `SpecsSublabel` reuse target for D-03 lives in `page.tsx:752-768`.
- `src/components/comment/CommentThread.tsx` — **the privacy/cache constraint (D-07).** Top comment: "NO 'use client' AND NO 'use cache' … the absence of 'use cache' is the privacy guarantee." Renders `<section className="mt-6"><h2>Comments</h2>…`. Must stay an RSC sibling.

### Surfaces to reposition (read for props/shape)
- `src/components/insights/CollectionFitCard.tsx` — the verdict card to elevate into the hero (D-09).
- `src/components/watch/WatchPhotoSection.tsx` — the carousel/filmstrip primary visual (D-04). Exports `SignedWearPic`.
- `src/components/shared/LikeButton.tsx` — the like control in the hero.
- `src/components/insights/SameFamilyRail.tsx` / `LineageRail.tsx` — self-hiding rails (`rows.length === 0` guard).
- `src/components/insights/OtherOwnersRoster.tsx` + `src/components/watch/CatalogPageActions.tsx` — catalog-only surfaces to surface high (D-13).
- `src/components/insights/ReferenceIdentityCard.tsx` — fresh-account taste card (D-10 empty-state fill).

### Load-bearing gotchas (MEMORY — verify still current)
- `project_ppr_dynamic_before_use_cache` — **`unstable_instant = false` + `await connection()` on `/w/[ref]` is PERMANENT** (D-08). Sign storage URLs via the admin client, never the cookie client, inside this route.
- `project_react_418_date_tz_hydration` — any date rendered in client components on this page must use `toLocaleDateString('en-US', { timeZone: 'UTC' })` (already done in `WatchDetail.formatDate`); preserve when moving the worn/acquired/tracking rows.
- `feedback_mobile_ui_verify_on_prod` — hero responsive collapse, jump-to-comments scroll, and desktop 2-col behavior verify on **prod** (push → Vercel), not locally (empty test DB skips e2e). Classify device/touch behavior `human_needed`, build-gate, bundle into one deploy.
- `project_baseline_not_green_build_is_gate` — `npm run build` (exit 0) is the authoritative gate; ignore the ~77 pre-existing tsc test-file errors + 1 pre-existing test failure.
- `project_turbopack_next_cache_stale_css` — `rm -rf .next` before concluding a CSS/layout fix failed in dev.
- `project_next_clear_operational_debt` — `workflow.use_worktrees = false` globally (this phase builds + is DB-backed-RSC at build time).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`WatchPhotoSection`** — complete carousel + filmstrip + (owner) upload controls; becomes the hero's primary visual unchanged (D-04).
- **`CollectionFitCard`** — pure-render verdict card; move its render slot from island-bottom into the hero (D-09). Computation already happens server-side in `page.tsx` (verdict is precomputed and passed in) — only the JSX position changes.
- **`SpecsSublabel`** (`page.tsx:752`) — the one-line `movement · mm · dial` summary already used by the catalog branch; reuse for the hero condensed spec strip (D-03).
- **`LikeButton`** — optimistic ♥ toggle; sits in the hero with the comment-count jump link.
- **Self-hiding rails** (`SameFamilyRail` / `LineageRail`) — render unconditionally; internal `rows.length === 0` guard hides them. Reordering them is free.

### Established Patterns
- **B1 sibling composition** — RSCs (`CommentThread`, rails, roster, actions, `CollectionFitCard` slot, `ReferenceIdentityCard`) compose AROUND the `'use client'` `WatchDetail` island, never imported into it. The redesign keeps this; it just changes sibling order and **splits the island** so trailing specs/notes become siblings rendered after `CommentThread` (D-07).
- **Cache Components route shape** (Phase 51/52) — `unstable_instant = false`, `await connection()`, sync-outer/async-inner/local-`<Suspense>` with a static `WatchPageSkeleton`. Update the skeleton to mirror the new IA; do NOT alter the opt-out mechanics (D-08).
- **Server-side hydration of social state** — like state + comment count + gates are resolved in `page.tsx` and passed down; the redesign does not move data fetching, only layout.

### Integration Points
- `page.tsx` three branches each return a `<div className="container … space-y-8">` tree → re-order the children per D-02 (Branches 1 & 2-D06) and per D-12/D-13 (Branch 3). Branch 3 currently has NO `WatchDetail` island and NO `CommentThread` — it gets the shell-only hero (D-12).
- `WatchDetail.tsx` → split: hero island (carousel/title/verdict-slot/like/owner-actions/condensed-spec-strip) + a trailing content piece (full spec cards, gap-fill, notes) rendered as a sibling AFTER `CommentThread` (D-07). Props already flow in; the split is structural, not data.
- Hero comment-count → tap-to-scroll anchor to the `CommentThread` `<section>` (D-06). Give the comments section a stable `id` to anchor to.

</code_context>

<specifics>
## Specific Ideas

- **Verdict-forward, comments-forward.** The two things a collector cares about — "does this fit my collection?" (verdict) and the social conversation (comments) — both move UP. Specs are reference material and drop below comments.
- **Photo as hero.** The carousel anchors the top-left of a 2-col desktop hero; verdict + like + title + a one-line spec summary ride the right. On mobile it's a clean vertical stack.
- **Catalog page = same skin, fewer organs.** The generic catalog view should *look* like the redesigned watch page (same hero shell, same order language) but honestly omits comments (no target) and the carousel (one image), and pulls "other owners" + add-to-collection up near the verdict to drive discovery→collection.
- **Don't disturb the plumbing.** This is composition, not re-plumbing. The hard `unstable_instant = false` / `connection()` / uncached-`CommentThread` structure is untouchable; the win is purely in ordering and the island split.

</specifics>

<deferred>
## Deferred Ideas

- **Real comment thread on the generic catalog entry** — out of scope: comments are keyed to a per-user `watches.id`; a catalog entry has zero/many owners and no single target. Would need a new "catalog-level discussion" data model — its own phase.
- **Multi-photo carousel for catalog entries** — out: `watches_catalog` photos were deliberately left untouched (Phase 60 D-10); catalog entries carry a single image. Would require catalog photo enrichment (catalog strategy under review, SEED-009).
- **New social primitives / threaded replies / moderation / public liker lists / Realtime** — out per the v6.0 social scope (unchanged).

### Reviewed Todos (not folded)
None — `todo.match-phase 64` returned 0 matches.

</deferred>

---

*Phase: 64-detail-page-ia-redesign*
*Context gathered: 2026-05-27*
