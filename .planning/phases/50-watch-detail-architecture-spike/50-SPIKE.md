---
phase: 50-watch-detail-architecture-spike
plan: 01 (§1-3); plans 02-04 complete the rest
date: 2026-05-20
author: executor-agent (claude-sonnet-4-6)
requirement: ARCH-01
---

# Watch-Detail Architecture Spike

## 1. Domain

This spike answers requirement ARCH-01: **should `/catalog/[catalogId]` and `/watch/[id]` remain as separate routes or be merged?** The spike produces a recommendation grounded in code analysis (this plan, §1–3), variant scoring and cost estimates (Plan 02, §4–7), and synthesis (Plan 03–04, §8–9).

**Primary question:** Two watch-detail routes exist. `/catalog/[catalogId]` is keyed by `watches_catalog.id` (catalog UUID) and is a server-only Next.js 16 App Router page. `/watch/[id]` is keyed by `watches.id` (per-user UUID) and combines a server page with a `'use client'` island (`WatchDetail.tsx`). Both routes render significant shared surface — `ReferenceIdentityCard`, `SameFamilyRail`, `LineageRail`, `CollectionFitCard` — but differ in entry-point origin, data shape, and writable surface. The spike determines whether this split should be kept, canonicalized, or fully merged.

**Five variants are scored (§4) and costed (§7):**

- **Variant A** — Keep separate (status quo; UI-only convergence via shared components continues).
- **Variant B** — URL canonicalization: `/catalog/[catalogId]` 307s to `/watch/[id]` when the viewer owns this catalog ref; otherwise stays on `/catalog`.
- **Variant C** — Single unified route (e.g. `/w/[ref]`) that accepts either id type and resolves server-side. Both old URLs redirect to canonical.
- **Variant D** — Absorb `/watch/[id]` into `/catalog/[catalogId]`: catalog route layers per-user data when viewer owns the ref; per-user URL is retired.
- **Variant E** — Absorb `/catalog/[catalogId]` into `/watch/[id]`: per-user route grows a "no per-user row yet" mode; all discovery entry points re-point.

**Hard guardrail (D-GUARD-01):** No implementation is permitted in Phase 50. If the spike concludes a path is cheap AND strongly favored, that finding triggers a `/gsd-phase --insert` requirement-add flow producing a Phase 50.1 implementation wave — the exact same loop Phase 49 → Phase 49.1 just closed on 2026-05-20. Direct execution is not authorized. Per ROADMAP SC#4:

> "No consolidation or removal implementation is shipped in this phase unless the spike specifically flags it as cheap and strongly favored — in which case a new requirement is added mid-milestone"

The only artifact written under `.planning/phases/50-*/` other than standard plan/verification artifacts is this file.

---

## 2. Audience Matrix

### Re-framing note (D-AUDIENCE-01)

The ROADMAP SC#1 audience labels — "owner / wishlist-holder / anonymous visitor / cross-user browse" — mix two orthogonal axes: **viewer-state** (who the viewer is in relation to the watch) and **ref-identity** (which ID the route URL carries). A spike conclusion grounded in these mixed labels would import that confusion into the recommendation. Per locked decision D-AUDIENCE-01, this section re-frames the analysis as a 2D **viewer-state × ref-identity** matrix, each cell describing the framing and UI shape that code serves today.

This re-framing surfaces a key correction: the implicit ROADMAP assumption that `/watch/[id]` is owner-only is wrong. `/watch/[id]` already supports cross-user viewers via `getWatchByIdForViewer` (`src/data/watches.ts:193`), which returns `{ watch, isOwner }` for any viewer who has permission — and the route dispatches framing at `src/app/watch/[id]/page.tsx:58` as `framing: isOwner ? 'same-user' : 'cross-user'`. The routes do not split on viewer audience; they split on which ID the URL carries.

### Matrix

| Viewer-state | per-user (`watches.id`) | catalog (`watches_catalog.id`) |
|---|---|---|
| **owner** | Full per-user detail. Same-user framing via `getWatchByIdForViewer` (`src/data/watches.ts:193`, `isOwner=true`). Route: `src/app/watch/[id]/page.tsx:58` dispatches `framing: 'same-user'`. `WatchDetail` island (`src/components/watch/WatchDetail.tsx:1`, `'use client'`) renders with `viewerCanEdit=true` — Edit, Delete, Mark as Worn, Flag as Deal Server Actions available. | "You own this" framing. `findViewerWatchByCatalogId` (`src/app/catalog/[catalogId]/page.tsx:282`) detects `status='owned'` match (BUG-01 fix at line 296). D-08 framing flip at `src/app/catalog/[catalogId]/page.tsx:107-115` constructs `verdict = { framing: 'self-via-cross-user', ownerHref: '/watch/${viewerOwnedRow.id}' }`. No `WatchDetail` island; no writable surface. `CatalogPageActions` suppressed (D-05). |
| **non-owner-with-collection** | Cross-user detail (other collector's watch). `getWatchByIdForViewer` (`src/data/watches.ts:193`) two-layer privacy gate: RLS outer + WHERE inner requiring `profile_public=true` AND per-tab visibility. `framing: 'cross-user'` at `src/app/watch/[id]/page.tsx:58`. Full verdict computed. `WatchDetail` island renders with `viewerCanEdit=false` — no writable surface. | Cross-user discovery view. No `viewerOwnedRow` → falls through to cross-user verdict branch at `src/app/catalog/[catalogId]/page.tsx:116`. Full `VerdictBundle` computed. `CatalogPageActions` 3-CTA block rendered. `OtherOwnersRoster` rendered (catalog-only by UI-SPEC). |
| **non-owner-empty-collection** | Cross-user detail, no verdict. `getWatchByIdForViewer` same privacy gate; `isOwner=false`; `collection.length === 0` → no verdict computed per D-07 lock (`src/app/watch/[id]/page.tsx:47`). `ReferenceIdentityCard` rendered (NSV-20). | Discovery view, no verdict. `collection.length === 0` → no `CollectionFitCard`. `ReferenceIdentityCard` rendered (NSV-20). `CatalogPageActions` rendered. `OtherOwnersRoster` rendered. |
| **wishlist-holder** (catalogId on viewer's wishlist) | Cross-user framing — per-user URL keyed by `watches.id`; `isOwner=true` because the wishlist watch belongs to the viewer. `WatchDetail` island renders with `viewerCanEdit=true`. Same-user framing for verdict. Note: this is a valid reachable path — `WatchCard` on the collection page links to `/watch/${watch.id}` for ALL statuses. | Cross-user discovery view — no `viewerOwnedRow` because `findViewerWatchByCatalogId` scopes to `status='owned'` (BUG-01 fix at `src/app/catalog/[catalogId]/page.tsx:296`). Falls through to cross-user verdict branch. `CatalogPageActions` rendered. The BUG-01 bug was exactly this cell misfiring into the owner framing before the fix. |
| **sold-this** (viewer previously owned, `status='sold'`) | `isOwner=true` (watch belongs to viewer). Same-user framing. `WatchDetail` island renders with `viewerCanEdit=true`. | Same as wishlist-holder — `status='owned'` filter in `findViewerWatchByCatalogId` (`src/app/catalog/[catalogId]/page.tsx:296`) excludes `sold` rows; cross-user path fires. |
| **anonymous-visitor** | _not reachable today (auth-gated) — `getCurrentUser()` at `src/app/watch/[id]/page.tsx:24` throws/redirects before any data fetch. Forward-compat placeholder for v6.0 social / v7.0 photo readers._ | _not reachable today (auth-gated) — `getCurrentUser()` at `src/app/catalog/[catalogId]/page.tsx:55` throws/redirects before any DB query. Forward-compat placeholder for v6.0 social / v7.0 photo readers._ |

### Observation

The matrix confirms that `/watch/[id]` is NOT owner-only. The `non-owner-with-collection` and `non-owner-empty-collection` rows are reachable from the cross-user profile view (`src/app/u/[username]/[tab]/page.tsx:356` → `ProfileWatchCard` → `/watch/${watch.id}`). The routes split on ref-identity (which UUID space), not on viewer audience. This makes the "two audiences need two views" framing of ROADMAP SC#1 inaccurate at the code level — and means that merging the routes does not require inventing new viewer-state handling; it requires deciding which ref-identity space the merged URL carries.

---

## 3. Route Reality Today

### 3.1 What each route does today

**`/catalog/[catalogId]` (`src/app/catalog/[catalogId]/page.tsx`, 308 lines)**

Server-only Next.js 16 App Router page (no `'use client'` directive, no client island). Renders catalog-specification data from `watches_catalog` against the viewer's collection. Components rendered in order: `ReferenceIdentityCard` (shared; renders when collection is empty per NSV-20), `SameFamilyRail` (shared), `LineageRail` (shared), `CollectionFitCard` (shared; contains the verdict card or the "You own this" callout), `OtherOwnersRoster` (catalog-only by UI-SPEC; hidden when `collectors.length === 0`), and `CatalogPageActions` (catalog-only; 3-CTA block — Add to Collection, Add to Wishlist, Share; suppressed when viewer owns the ref per D-05).

When the viewer owns this catalog ref (detected via `findViewerWatchByCatalogId` at `src/app/catalog/[catalogId]/page.tsx:282-308`), the page constructs a `VerdictBundleSelfOwned` at lines 107–115 with `framing: 'self-via-cross-user'` — the D-08 "You own this" inline framing flip introduced by Phase 20.1. The `CollectionFitCard` renders the `YouOwnThisCallout` for this framing, with a link back to the viewer's per-user `/watch/[id]` page. This in-route framing flip is the key structural divergence point: it is a prototype of Variant B–style canonicalization implemented as inline rendering rather than a redirect.

**`/watch/[id]` (`src/app/watch/[id]/page.tsx`, 132 lines) + `WatchDetail` (`src/components/watch/WatchDetail.tsx`, 462 lines)**

Server page + `'use client'` island (B1 invariant: RSCs cannot be imported into the client island). The server page calls `getWatchByIdForViewer(user.id, id)` (`src/data/watches.ts:193`) which serves BOTH same-user AND cross-user framings via a two-layer privacy gate (RLS outer + WHERE inner). The framing dispatch at `src/app/watch/[id]/page.tsx:58` is `framing: isOwner ? 'same-user' : 'cross-user'`. The `WatchDetail` client island receives `viewerCanEdit={isOwner}` and gates the owner-only writable surface — `editWatch`, `removeWatch`, `markAsWorn`, `flagDeal` Server Actions (`src/components/watch/WatchDetail.tsx:23-24`) — on that prop. Server siblings `ReferenceIdentityCard`, `SameFamilyRail`, `LineageRail` render outside the island (B1 invariant compliance; `src/app/watch/[id]/page.tsx:80-108`). No `OtherOwnersRoster`; no `CatalogPageActions`.

### 3.2 Entry-point map

**`/catalog/[catalogId]` entry points — 7 sites**

| File:Line | Surface |
|-----------|---------|
| `src/components/search/WatchSearchRow.tsx:31` | Search results row |
| `src/components/explore/DiscoveryWatchCard.tsx:30` | Explore discovery card |
| `src/components/explore/PathCard.tsx:97` | Collection path card (site 1 of 3) |
| `src/components/explore/PathCard.tsx:134` | Collection path card (site 2 of 3) |
| `src/components/explore/PathCard.tsx:143` | Collection path card (site 3 of 3) |
| `src/app/explore/lists/[id]/page.tsx:91` | Explore curated list page (site 1 of 2) |
| `src/app/explore/lists/[id]/page.tsx:110` | Explore curated list page (site 2 of 2) |

**`/watch/[id]` entry points — 12 sites**

| File:Line | Surface |
|-----------|---------|
| `src/components/watch/WatchCard.tsx:35` | Collection card |
| `src/components/profile/ProfileWatchCard.tsx:59` | Profile watch card (cross-user entry point) |
| `src/components/home/RecommendationCard.tsx:22` | Home recommendations |
| `src/components/home/ActivityRow.tsx:51` | Home activity feed |
| `src/components/home/SleepingBeautyCard.tsx:33` | Home sleeping beauties |
| `src/components/home/MostWornThisMonthCard.tsx:21` | Home most worn this month |
| `src/components/home/WywtSlide.tsx:78` | Home WYWT slide |
| `src/components/profile/StatsTabContent.tsx:62` | Profile stats tab |
| `src/components/profile/NoteRow.tsx:62` | Profile notes |
| `src/components/insights/CollectionFitCard.tsx:73` | Verdict card (per-user link) |
| `src/components/insights/SleepingBeautiesSection.tsx:44` | Insights sleeping beauties |
| `src/components/insights/GoodDealsSection.tsx:48` | Insights good deals |

The split pattern is consistent: discovery surfaces (search, Explore) feed `/catalog/[catalogId]`; ownership and profile surfaces (collection, profile, home) feed `/watch/[id]`. This correlates with viewer-state in §2 — discovery paths land in the catalog ref-identity column; ownership paths land in the per-user ref-identity column. The correlation is structural (entry-point authors chose the ID appropriate to the surface's data shape) but is NOT enforced by the routes — `/watch/[id]` already handles cross-user viewers, and any merger variant must decide whether to preserve or collapse this split.

### 3.3 De-facto truncation and the BUG-01 maintenance tax

The user-reported "truncated render" observation (REQUIREMENTS.md line 48) names `/catalog/[catalogId]` as looking slimmer than `/watch/[id]`. This is by-design: the catalog route is a cross-user spec-only view that omits per-user metadata (acquisition date, strap type, box/papers, notes, condition, personal flags). The `watches_catalog` table does not carry those columns (`src/db/schema.ts:335-404`). The "truncation" is the structural asymmetry that feeds ARCH-01, not a bug — the spike's recommendation determines whether that asymmetry is worth preserving via the two-route split or collapsing via a merge variant.

**Phase 48 BUG-01** is the clearest evidence of the maintenance tax the in-route D-08 framing flip carries. The bug: a watch with `status='wishlist'` (or `status='grail'`, `status='sold'`) on the viewer's watchlist, when viewed at `/catalog/[catalogId]`, was mislabeled "You own this watch" because `findViewerWatchByCatalogId` (`src/app/catalog/[catalogId]/page.tsx:282`) originally queried by `userId + catalogId` with no status filter. Any matching row — regardless of status — set `viewerOwnedRow`, triggering the `self-via-cross-user` framing flip. The fix at `src/app/catalog/[catalogId]/page.tsx:296` added `eq(watchesTable.status, 'owned')` to scope the ownership detection to truly-owned rows only. The wishlist-holder and sold-this cells in §2's matrix exist precisely because those edge cases bit a live user.

The BUG-01 fix is not the last word. The in-route framing flip at lines 107–115 now correctly distinguishes `owned` from other statuses — but every new `WatchStatus` value (if one were added), every new wishlist edge case, every new "viewer has a special relationship to this ref" scenario would require another edit to `findViewerWatchByCatalogId`. Any merge variant that retires the in-route framing flip (Variants B, C, D, E) retires this bug class. Variant A keeps it. This is the spike's load-bearing evidence for the merge case.

---

## 4. Variants A-E

Five variants are evaluated. Variant labels are used verbatim as anchors in §6 and §7. Each subsection covers: routing model, per-user data shape, entry-point disruption, and a one-sentence Summary.

---

### A. Keep separate (status quo)

**Routing model:** Two routes remain unchanged. `/catalog/[catalogId]` (`src/app/catalog/[catalogId]/page.tsx`, 308 lines, server-only) and `/watch/[id]` (`src/app/watch/[id]/page.tsx`, 132 lines server + `src/components/watch/WatchDetail.tsx`, 462 lines client island) continue to co-exist at their current paths.

**Per-user data shape:** Already converged at the component layer. `ReferenceIdentityCard`, `SameFamilyRail`, `LineageRail`, and `CollectionFitCard` render on both routes (`src/components/insights/*.tsx`). `OtherOwnersRoster` is catalog-only by UI-SPEC. The per-user metadata fields — strapType, notes, isFlaggedDeal, acquisitionDate, sortOrder, condition, boxPapers — remain exclusively on the `/watch/[id]` surface; the catalog route never surfaces them.

**Entry-point disruption:** Zero. All 19 entry points (12 at `/watch/[id]`, 7 at `/catalog/[catalogId]` — see §3.2) remain unchanged.

**Summary:** Pure no-op; UI-only convergence via shared components continues without any route change, but the in-route D-08 framing flip (`src/app/catalog/[catalogId]/page.tsx:107-115`) and its maintenance tax survive untouched.

---

### B. URL canonicalization (/catalog → /watch when owned)

**Routing model:** When `findViewerWatchByCatalogId` (`src/app/catalog/[catalogId]/page.tsx:282-308`) detects that the viewer owns this catalog ref (`viewerOwnedRow !== null`), the server page calls `redirect(\`/watch/${viewerOwnedRow.id}\`)` imported from `next/navigation` — replacing the current inline `VerdictBundleSelfOwned` construction at lines 107–115. Non-owner viewers continue to receive the full catalog page without redirect.

**LANDMINE (mandatory callout — RESEARCH Pitfall 2, MEMORY `feedback_proxy_router_cache_poisoning`):** Variant B is ONLY safe if canonicalization happens at the page level — a Server Component calling `next/navigation`'s `redirect()` after the DAL ownership check. It is NOT safe at the `proxy.ts` middleware layer. A `NextResponse.redirect` (or any 307) issued from `proxy.ts` on an RSC prefetch request poisons Next.js 16's Router Cache, causing 404s on subsequent soft-navigation. The `/u/*` route is the live precedent for this failure mode — see MEMORY `feedback_proxy_router_cache_poisoning`. The Next.js 16 docs confirm: `redirect()` from `next/navigation` is the Server Component API (`node_modules/next/dist/docs/01-app/02-guides/redirecting.md:41`); `NextResponse.redirect` is the proxy-layer API and is the structural landmine here. Any sub-variant that canonicalizes at the proxy layer is rejected on first principles.

**Per-user data shape:** Unchanged. `/watch/[id]` continues to consume `getWatchByIdForViewer` (`src/data/watches.ts:193`) with same-user framing (`isOwner=true`) for owners who arrive via the redirect. Cross-user viewers receive the catalog page as before.

**Entry-point disruption:** Zero direct rewrites. Discovery entry points (search at `src/components/search/WatchSearchRow.tsx:31`, Explore at `src/components/explore/DiscoveryWatchCard.tsx:30`, etc.) continue to link to `/catalog/[catalogId]`; the page redirects at render time when ownership is detected.

**Phase 48 BUG-01 retirement:** The Phase 48 BUG-01 bug class — where any `watches` row matching `userId + catalogId` (regardless of `status`) triggered the `self-via-cross-user` framing flip, mislabeling wishlist and sold watches as "You own this" — exists because the in-route framing flip at lines 107–115 requires status-scoped ownership detection. Variant B retires the framing flip entirely. The `status='owned'` fix at line 296 becomes unnecessary because the flip code itself is removed. Every future `WatchStatus` value or edge case that would otherwise require a new edit to `findViewerWatchByCatalogId` no longer matters.

**Summary:** Cheapest merge variant — 1-2 files touched, zero entry-point rewrites, zero migrations — and fully retires Phase 48 BUG-01's maintenance tax by replacing the inline framing flip with a server-level redirect at the page layer via `next/navigation`.

---

### C. Single unified route /w/[ref]

**Routing model:** New route `src/app/w/[ref]/page.tsx` is the sole watch-detail surface. Server-side resolution: try `getWatchByIdForViewer(user.id, ref)` (`src/data/watches.ts:193`); if null, try `getCatalogById(ref)`. Both old routes (`/catalog/[catalogId]/page.tsx`, `/watch/[id]/page.tsx`) are reduced to lookup-then-redirect shells that issue server redirects to `/w/[ref]`. Bookmarks to old URLs are preserved.

**Per-user data shape:** The unified server page does framing dispatch — `same-user | cross-user | self-via-cross-user` — based on which resolver hit. `WatchDetail` client island still renders for `viewerCanEdit=true` cases (B1 invariant: RSCs cannot be imported into the `'use client'` island; server siblings compose around it as today). The full per-user metadata surface (strapType, notes, acquisitionDate, etc.) is available when `getWatchByIdForViewer` resolves the viewer's own watch row.

**Entry-point disruption:** ALL 19 entry points rewrite — 12 at `/watch/[id]` and 7 at `/catalog/[catalogId]` (see §3.2 for the full file:line list). Every `href={\`/watch/${watch.id}\`}` and `href={\`/catalog/${catalogId}\`}` becomes `href={\`/w/${ref}\`}`. Bookmarks to old URLs are preserved via the redirect shells left on the old route files.

**Summary:** Cleanest single-surface composition — one route handles all viewer-state × ref-identity cells — but carries the highest blast radius (19 entry-point rewrites + new route + 2 route shell rewrites) and medium reversibility due to the 19-file entry-point rewrite.

---

### D. Absorb /watch into /catalog

**Routing model:** `/catalog/[catalogId]/page.tsx` becomes the only watch-detail route. When the viewer owns the catalog ref, the page layers in per-user data (currently exclusive to `/watch/[id]`) — including the `WatchDetail` client island — on top of the existing catalog page structure. Per-user URLs are retired; `/watch/[id]/page.tsx` is converted to a lookup-then-redirect shell: resolve `watches.id → catalogId` via the `watches.catalogId` NOT NULL FK (Phase 38 D-06, `src/db/schema.ts:146`), then redirect to `/catalog/${watch.catalogId}`.

**Per-user data shape:** The catalog page must call `findViewerWatchByCatalogId` (already exists at `src/app/catalog/[catalogId]/page.tsx:282-308`) to detect ownership, then call `getWatchByIdForViewer` (`src/data/watches.ts:193`) to pull the full `Watch` shape. The per-user fields the catalog table does NOT carry — strapType, notes, isFlaggedDeal, acquisitionDate, sortOrder, condition, boxPapers — are at `src/db/schema.ts:130,140,153` on the `watches` table; they are surfaced conditionally when the owner branch fires.

**Entry-point disruption:** ALL 12 `/watch/[id]` entry points rewrite to `/catalog/${watch.catalogId}`. Several entry points already have `catalogId` available (`WatchCard` at `src/components/watch/WatchCard.tsx:35`, `ProfileWatchCard` at `src/components/profile/ProfileWatchCard.tsx:59`) because `Watch.catalogId` is a NOT NULL FK since Phase 38 D-06. Others (`ActivityRow` at `src/components/home/ActivityRow.tsx:51`, `RecommendationCard` at `src/components/home/RecommendationCard.tsx:22`, `WywtSlide` at `src/components/home/WywtSlide.tsx:78`) may need their data shapes checked to confirm `catalogId` is threaded through.

**Forcing-function note:** `OtherOwnersRoster` (catalog-only by UI-SPEC) would need a "do not show roster to owner" guard — or the UI-SPEC policy changes to "owners see the roster too." This is a UI-SPEC decision the implementation phase must resolve.

**Summary:** Clean owner-detection layering on a single catalog route with a natural entry-point shape, but requires 12 entry-point rewrites and a UI-SPEC decision on `OtherOwnersRoster` visibility for owners.

---

### E. Absorb /catalog into /watch

**Routing model:** `/watch/[id]/page.tsx` becomes the only watch-detail route. The route grows a "no per-user row yet" mode: when a viewer hits an `id` that resolves as a `watches_catalog.id` (not a `watches.id`), the route falls back to `getCatalogById(ref)` and renders catalog-spec data. `/catalog/[catalogId]/page.tsx` is converted to a lookup-then-redirect shell that redirects to `/watch/${catalog.id}` — but because `watches.id` and `watches_catalog.id` are distinct UUID spaces, the route must accept either and dispatch on which DAL call succeeds.

**Per-user data shape:** `getWatchByIdForViewer` (`src/data/watches.ts:193`) is already cross-user-aware (returns `{ watch, isOwner }`). The "no per-user row yet" mode is the new case: viewer arrives via a catalog UUID, `getWatchByIdForViewer` returns null, the route falls back to `getCatalogById`. The existing `catalogEntryToSimilarityInput` shim in `src/lib/verdict/shims.ts` is the precedent for synthesizing a `Watch`-shaped object from a `CatalogEntry` — the same pattern applies here for the catalog-only rendering path.

**Entry-point disruption:** All 7 `/catalog/[catalogId]` entry points rewrite (see §3.2). The `/watch/[id]` entry points (12 sites) are unchanged. Smaller blast radius than Variant D.

**Forcing-function notes:** (1) `watches.id` and `watches_catalog.id` share the same URL parameter space — UUIDs don't collide in practice, but the route resolution requires "try `getWatchByIdForViewer`, fall back to `getCatalogById`" branching that adds non-trivial code-clarity cost. (2) `OtherOwnersRoster` (currently catalog-only) and `CatalogPageActions` (the 3-CTA block) must become conditional renders on `/watch/[id]` for the catalog-only mode — the implementation must decide "show for catalog-only views, hide when per-user row exists" vs "show always."

**Summary:** Smaller entry-point blast radius than Variant D (7 vs 12 rewrites) but introduces UUID-space dispatch fragility on a route that currently carries clean per-user semantics, and requires a UI-SPEC decision on `OtherOwnersRoster` / `CatalogPageActions` conditional rendering.

---

## 5. v7.0 Watch Photos Lens

SEED-013 (v7.0 Watch Photos) is the forcing function for this lens. The scope items this spike consumes: the multi-photo model replacing `watches_catalog.imageUrl` (today a single text field at `src/db/schema.ts:357`) and `watches.imageUrl` (today a single text field at `src/db/schema.ts:130`); public wear-pic surfacing on watch detail (cross-user query, visibility-gated); wears-tab persistence for actual wear photo vs generic catalog image; and add-watch photo encouragement with a per-person cap. The v3.0 Phase 15 pipeline already captures `wear_events.photo_url` — the multi-photo model ties into that existing infrastructure at the data-join layer.

The spike does NOT pre-decide SEED-013's open questions: per-person photo cap, opt-in/opt-out wear-pic surfacing, carousel cover ordering, wears-tab persistence rules, v6.0 social interaction shape, and storage bucket strategy (whether to reuse the v3.0 `wear-photos` bucket or create a new one). This lens applies only the architectural decision that the chosen merge variant inherits — where the carousel renders and who can add photos — not the v7.0 product decisions.

### A. Keep separate (status quo) — v7.0 lens

- **Where the carousel renders** — in both routes separately. Either added as a sub-component of the shared `ReferenceIdentityCard.tsx` or as a new `PhotoCarousel.tsx` sibling rendered by both `src/app/catalog/[catalogId]/page.tsx` and `src/app/watch/[id]/page.tsx`. Two render sites means two import chains and two mounting contexts (both are server pages, so no client-boundary cost for the carousel shell — but any interactive navigation affordance, e.g. arrow buttons, would require a `'use client'` island at each site).
- **Data joins** — each route fires its own fetch. On `/catalog/[catalogId]`: catalog photos (from `watches_catalog` multi-photo model) + other-owners' public wear-pics (cross-user query, public-visibility-gated, mirrors `getCollectorsForCatalog` shape). On `/watch/[id]`: owner's own wear-pics (from `wear_events.photo_url`, per-user, public-visibility-flag-gated from the v3.0 Phase 15 pipeline) + catalog photos + other-owners' public wear-pics. The owner wear-pic join only fires on `/watch/[id]`; the catalog route never surfaces owner-private photos.
- **Writability axis** — the "add photo" affordance exists exclusively in the `WatchDetail` client island (`src/components/watch/WatchDetail.tsx`, `'use client'`) on `/watch/[id]`. The catalog route stays read-only — no owner-write surface, no upload CTA. This cleanly separates write from read in the two-route model. Any future per-catalog-spec write (e.g. a curator submits a reference photo) would need a separate CTA on the catalog route.
- **Variant × Viewer-State cell interaction** — every viewer-state cell from §2 must be described twice (once per route). Owner cell: `/watch/[id]` shows own wear-pics + catalog + others' public, with add-photo affordance; `/catalog/[catalogId]` shows catalog + others' public only, no affordance (the D-08 framing flip renders "You own this" but no photo-add CTA exists here). Non-owner-with-collection on `/watch/[id]` (cross-user browse): catalog + others' public, no affordance. Non-owner-with-collection on `/catalog/[catalogId]`: catalog + others' public, no affordance. Empty-collection viewer: same read-only carousel on both routes. The dual-surface model means maintaining two carousel compositions instead of one — Variant A's v7.0 tax is precisely this drift risk.

### B. URL canonicalization (/catalog → /watch when owned) — v7.0 lens

- **Where the carousel renders** — on `/watch/[id]` only for owner viewers (they are redirected at the page level via `next/navigation`'s `redirect()` after `findViewerWatchByCatalogId` returns non-null). Non-owner viewers receive the carousel on `/catalog/[catalogId]` in read-only mode. The owner-facing carousel has a single render site; the non-owner-facing carousel is still on the catalog route. Net: two render sites for the full carousel composition, but the owner-with-write-surface case now has exactly one home.
- **Data joins** — same as Variant A but the owner branch collapses into `/watch/[id]`. The catalog route fires only the catalog + cross-user public join (non-owner viewers never see owner wear-pics). The `/watch/[id]` route fires the full join (own wear-pics + catalog + cross-user public). One route maintains the carousel-add UI; the other is always read-only. No duplication of the write-capable carousel logic.
- **Writability axis** — owner-only on `/watch/[id]`, via the existing `WatchDetail` island (`viewerCanEdit={isOwner}`). The catalog route is structurally read-only; the add-photo affordance does not exist on it under Variant B. This is the cheapest path to a single owner-facing carousel surface: the write CTA lives in exactly one place.
- **Variant × Viewer-State cell interaction** — owner: redirected to `/watch/[id]`, sees own wear-pics + catalog + others' public + add-photo affordance. Non-owner-with-collection via `/catalog/[catalogId]`: catalog + others' public, no affordance. Non-owner-with-collection via `/watch/[id]` (cross-user browse): catalog + others' public (`isOwner=false`, so the `WatchDetail` island renders with `viewerCanEdit=false`). Empty-collection viewers on both routes: read-only carousel. Wishlist-holder: same as non-owner on `/catalog/[catalogId]` (the BUG-01 fix at line 296 ensures `status='wishlist'` rows do NOT trigger the redirect). Sold-this: same as wishlist-holder (no redirect fired). The viewer-state × carousel interaction is almost identical to Variant A, but the owner cell now only occurs on one route.

### C. Unified /w/[ref] — v7.0 lens

- **Where the carousel renders** — in the unified `src/app/w/[ref]/page.tsx`, single component, single surface. No carousel duplication. The server-side dispatch (`watches` row hit → owner path; catalog-only hit → non-owner path) happens before the carousel data join fires. One route, one carousel component, one mounting context — the cleanest single render site of all five variants.
- **Data joins** — one server-side decision tree: if `getWatchByIdForViewer` resolves the viewer's own watch row, fire the full join (own wear-pics + catalog + cross-user public); if only `getCatalogById` resolves, fire the catalog + cross-user public join only. The single-route dispatch eliminates the "same join, two implementations" drift risk that Variant A carries. The `getCollectorsForCatalog`-shaped cross-user query can be written once and reused regardless of which resolution path fired.
- **Writability axis** — gated by `viewerCanEdit` derived from the same-user framing branch (same as today's `/watch/[id]` logic). If `viewerCanEdit=true`, the `WatchDetail` island renders with the add-photo affordance. If `viewerCanEdit=false`, the carousel is read-only. The single dispatch eliminates any ambiguity about where the write surface lives — there is exactly one route and one `viewerCanEdit` gate.
- **Variant × Viewer-State cell interaction** — the cleanest single-cell composition of all variants. Owner: same-user framing, `viewerCanEdit=true`, full join, add-photo affordance. Non-owner-with-collection: cross-user framing, `viewerCanEdit=false`, catalog + cross-user public. Non-owner-empty-collection: same as non-owner-with-collection but no verdict. Wishlist-holder: cross-user framing (no per-user `status='owned'` row detected), read-only carousel. Sold-this: same as wishlist-holder. Anonymous-visitor (future): the route resolution already accepts either id type and `getCurrentUser()` would redirect before any data fetch — the cell lands trivially once auth is relaxed in v6.0. Single route means single maintenance point for all these cells.

### D. Catalog absorbs watch — v7.0 lens

- **Where the carousel renders** — in `/catalog/[catalogId]/page.tsx` (rewritten). When the owner branch fires (detected via `findViewerWatchByCatalogId`), the `WatchDetail` island renders conditionally with the add-photo affordance. Non-owner viewers see the catalog route's read-only carousel. Single route, but the conditional branch adds complexity inside the page — the carousel component must know whether to show the add affordance based on the owner-detection result.
- **Data joins** — single fetch path with branching: (a) always fetch catalog photos + other-owners' public wear-pics; (b) if owner detected, additionally fetch owner's own wear-pics from `wear_events.photo_url` (requires `getWatchByIdForViewer` call already planned for per-user data layering). The join structure is cleaner than Variant A/B because there is one route and one branching point, but the catalog route now carries a heavier data-fetch responsibility than it does today.
- **Writability axis** — owner-only via the conditionally-rendered `WatchDetail` island (`viewerCanEdit={isOwner}` when `findViewerWatchByCatalogId` returns non-null and ownership is confirmed). Non-owners never see the add-photo affordance — the catalog route's discovery-surface entry-point shape (search, Explore all point here) means the "add photo" CTA only appears when the viewer owns this catalog ref.
- **Variant × Viewer-State cell interaction** — viewer-state branching happens at one route, one page, one carousel composition — cleaner than Variant A/B. Owner: full join + add-photo affordance via `WatchDetail` island. Non-owner-with-collection: catalog + cross-user public, no affordance. Non-owner-empty-collection: same read-only carousel. Wishlist-holder: non-owner branch (BUG-01 fix at line 296 scopes ownership to `status='owned'`). Sold-this: non-owner branch. A forcing-function note: `OtherOwnersRoster` is currently catalog-only by UI-SPEC. Under Variant D, when the owner is viewing the merged route, the implementation phase must decide whether to show or hide the roster for owners — an open UI-SPEC policy question this spike flags but does not resolve.

### E. Watch absorbs catalog — v7.0 lens

- **Where the carousel renders** — in `/watch/[id]/page.tsx` (rewritten). The catalog-only mode (no per-user row for this viewer) renders a read-only carousel. The per-user mode (owner or cross-user browse via `watches.id`) renders the full carousel. Because the route must now accept both `watches.id` UUIDs and `watches_catalog.id` UUIDs, the render path is gated on which DAL call resolved: `getWatchByIdForViewer` hit → use the existing render tree; catalog-only fallback → use the new "synthesize-from-catalog" render branch. Two carousel compositions live in one route file.
- **Data joins** — same join structure as Variant D but route resolves on `watches.id` first and falls back to `watches_catalog.id`. Owner join: own wear-pics + catalog + cross-user public (fires on `getWatchByIdForViewer` success with `isOwner=true`). Cross-user join: catalog + cross-user public (fires on `getWatchByIdForViewer` success with `isOwner=false`). Catalog-only fallback join: catalog + cross-user public (fires when `getWatchByIdForViewer` returns null and `getCatalogById` succeeds). The existing `catalogEntryToSimilarityInput` shim in `src/lib/verdict/shims.ts` is the precedent for synthesizing a `Watch`-shaped object from a `CatalogEntry` — the same pattern applies here for the catalog-only carousel data join.
- **Writability axis** — owner-only via the existing `WatchDetail` island (`viewerCanEdit={isOwner}` already set from `getWatchByIdForViewer().isOwner`). The catalog-only fallback branch always sets `viewerCanEdit=false` — no add-photo affordance when the viewer has no per-user watch row. The write surface semantics are the same as today; the new code only adds the fallback path.
- **Variant × Viewer-State cell interaction** — catalog-only branch (non-owner with no per-user row) is the new cell. A visitor arriving via a discovery entry point (search, Explore) with a `watches_catalog.id` UUID hits `getWatchByIdForViewer(userId, catalogUUID)` returning null, then falls back to `getCatalogById(catalogUUID)` for the read-only carousel. Owner viewers arriving via `/watch/${watch.id}` get the full join + add-photo affordance as today. Non-owner-cross-user viewers via `/watch/${watch.id}` get the catalog + cross-user public join with `viewerCanEdit=false`. `OtherOwnersRoster` and `CatalogPageActions` (the 3-CTA block) must become conditional renders — currently catalog-only; under Variant E they need "show for catalog-only views, hide when per-user row exists" logic, which is the parallel of the OtherOwnersRoster question in Variant D.

> v7.0's multi-photo schema replacement (`imageUrl` text → photos table/array) is OUT OF SCOPE for Phase 50 per D-GUARD-01. The v7.0 implementation phase will face the `watches_catalog` NOT-wipeable constraint (MEMORY `project_db_wipeable_2026_05_09`, 2026-05-19 update) — any photo schema migration must be in-place ALTER + UPDATE, not wipe-and-re-seed. The merge variant chosen here affects where the carousel UI lives; it does not pre-decide how the photo data is shaped.

## 6. Decision Matrix

### Criteria Definitions

Seven criteria are scored per D-VARIANTS-02. Scale and scoring convention noted per criterion:

1. **UX clarity** — Does the variant produce a coherent, single-meaning surface for each viewer-state? Higher = clearer. Spectrum criterion: 1-5.
2. **Schema/URL stability** — Does the variant preserve canonical URLs and avoid schema churn? Higher = more stable. Spectrum criterion: 1-5.
3. **Per-user data shape** — How cleanly does the per-user data layer compose with the catalog spec layer? Higher = cleaner composition. Spectrum criterion: 1-5.
4. **v7.0 photo carousel fit** — Does the variant give the v7.0 multi-photo carousel a single rendering surface? Higher = better fit; rooted in §5 evidence. Spectrum criterion: 1-5.
5. **Entry-point disruption** — How many of the 19 entry-point sites does the variant rewrite? Inverted: higher = LESS disruption (0 rewrites = 5, 19 rewrites = 1). Spectrum criterion: 1-5.
6. **Migration cost** — Files touched + tests + DAL changes for the route migration itself (not the v7.0 photo schema). Lower cost = higher score. Inverted: higher = cheaper. Spectrum criterion: 1-5.
7. **Irreversibility** — Once shipped, how hard is the variant to revert? Inverted: higher = MORE reversible / easier to back out. Spectrum criterion: 1-5.

### Scored Matrix

| Variant | UX clarity | Schema/URL stability | Per-user data shape | v7.0 photo carousel fit | Entry-point disruption (inverted: higher = less) | Migration cost (inverted: higher = cheaper) | Irreversibility (inverted: higher = easier to revert) |
|---------|------------|---------------------|---------------------|-------------------------|---------------------------------------------------|---------------------------------------------|--------------------------------------------------------|
| **A. Keep separate** | 2 | 5 | 3 | 2 | 5 | 5 | 5 |
| **B. URL canonicalization** | 3 | 4 | 4 | 3 | 5 | 5 | 4 |
| **C. Unified `/w/[ref]`** | 5 | 3 | 5 | 5 | 1 | 1 | 3 |
| **D. Catalog absorbs watch** | 4 | 4 | 4 | 4 | 2 | 2 | 3 |
| **E. Watch absorbs catalog** | 3 | 3 | 3 | 3 | 3 | 3 | 3 |

### Scoring Rationale

**A. Keep separate** — Scores low on UX clarity (2) because the two-route split produces genuinely different surfaces — the catalog route lacks the per-user metadata layer, and §2's matrix confirms that the owner cell is described twice with different shapes depending on which ref-identity column the URL carries. The D-08 in-route framing flip (`src/app/catalog/[catalogId]/page.tsx:107-115`) is a prototype canonicalization hack that the viewer experiences as a non-canonical page with a redirect-flavored callout, not a clear "you are viewing your watch" surface. Schema/URL stability is perfect (5) — zero change. Per-user data shape is 3: the status quo carries ongoing maintenance tax (Phase 48 BUG-01 evidences this — the `status='owned'` fix at line 296 is not the last word; every new `WatchStatus` value requires another edit to `findViewerWatchByCatalogId`). The v7.0 carousel fit is 2 (§5.A): two carousel render sites, two data-join implementations, two mounting contexts — the drift risk is the v7.0 tax the keep-separate model pays. Irreversibility is 5 — keep-separate is trivially reversible because no work is done.

**B. URL canonicalization** — Scores 3 on UX clarity: better than Variant A because owner viewers now always land on `/watch/[id]` (single-meaning owner surface), but non-owner viewers still see `/catalog/[catalogId]` — two distinct routes in practice, just with the owner→non-owner surface split more cleanly drawn. Schema/URL stability is 4: no schema change; the canonical URL for owners shifts from potentially landing on `/catalog/[catalogId]` to always landing on `/watch/[id]`, which is a minor URL-identity improvement but the catalog URL persists as the non-owner canonical. Per-user data shape is 4: the Phase 48 BUG-01 maintenance tax is retired (§4.B confirms: the `status='owned'` fix at line 296 becomes unnecessary because the framing flip is removed entirely). The v7.0 carousel fit is 3 (§5.B): better than A because owners see a single carousel site, but the catalog route still needs a carousel implementation for non-owner viewers — two render sites survive. Entry-point disruption and migration cost are both 5 (zero rewrites, 1-2 files touched per §7). Irreversibility is 4: the redirect added to `catalog/[catalogId]/page.tsx` can be removed in a single file edit; the BUG-01 framing-flip code would need to be re-added but is minimal.

**C. Unified `/w/[ref]`** — Scores 5 on UX clarity: single route, single surface, single carousel, every viewer-state cell described exactly once (§5.C). The anonymous-visitor cell (v6.0+) lands trivially because the URL accepts either id type. Schema/URL stability is 3: no schema change, but ALL 19 canonical URLs shift from two URL spaces to one — bookmarks preserved via redirect shells, but the canonical URL identity changes everywhere; any hardcoded URL in external links or SEO surfaces shifts. Per-user data shape is 5: one framing dispatch, one join decision, cleanest composition of all variants (§5.C: "one server-side dispatch decides which DAL calls fire"). The v7.0 photo carousel fit is 5 (§5.C): single render site, single data-join implementation, zero drift risk — the best v7.0 fit. Entry-point disruption is 1: all 19 entry points rewrite (§3.2 full list: 12 at `/watch/[id]` + 7 at `/catalog/[catalogId]`). Migration cost is 1: 19+ files touched including a new route, 2 old-route rewrites, 17 entry-point files (§7). Irreversibility is 3: the new route + redirect shells are themselves reversible, but the 19-file entry-point rewrite would need to be reversed — medium back-out cost.

**D. Catalog absorbs watch** — Scores 4 on UX clarity: single route for the merged surface with owner-detection layering; the discovery-surface entry-point shape is preserved (search, Explore already point to `/catalog/[catalogId]`). The viewer-state branching is explicit and contained in one route. One open UI-SPEC question (§4.D forcing-function note: `OtherOwnersRoster` visibility for owners) prevents a 5. Schema/URL stability is 4: no schema change; the per-user URL space (`/watch/[id]`) is retired for the owner-facing surface; the 12 entry points that link to per-user URLs must update to catalog URLs. Per-user data shape is 4: clean — `findViewerWatchByCatalogId` already exists at lines 282–308; `getWatchByIdForViewer` provides the full per-user shape. The layering is additive, not structural. The v7.0 carousel fit is 4 (§5.D): single render site on the merged catalog route; owner-branch triggers the full data join; cleaner than Variant A/B. Entry-point disruption is 2: 12 of the 19 entry points rewrite (all `/watch/[id]` sites; §3.2). Migration cost is 2: 13-14 files touched (§7). Irreversibility is 3: the per-user data layering in `catalog/[catalogId]/page.tsx` can be reverted, but the 12 entry-point rewrites require reverting.

**E. Watch absorbs catalog** — Scores 3 on UX clarity: the UUID-dispatch fragility in Variant E (`getWatchByIdForViewer` try → `getCatalogById` fallback) adds code-path ambiguity that the URL surface doesn't convey clearly. Viewers arriving via discovery entry points land on a `/watch/[id]`-shaped URL with a catalog UUID as the parameter — conceptually unclear (§4.E forcing-function note). Schema/URL stability is 3: the catalog URL space (`/catalog/[catalogId]`) is retired; 7 entry points update; the `/watch/[id]` URL gains catalog-keyed traffic without a schema change, but the semantic meaning of the URL shifts (it now accepts both uuid spaces). Per-user data shape is 3: the `catalogEntryToSimilarityInput` shim (`src/lib/verdict/shims.ts`) is the synthesis precedent (§4.E), but the "synthesize from CatalogEntry" pattern adds a code-clarity cost — `getWatchByIdForViewer` returns null for catalog UUIDs, requiring a fallback branch that increases the route's cognitive load. The v7.0 carousel fit is 3 (§5.E): two carousel compositions in one route file (per-user branch and catalog-only branch); not as clean as Variant C or D, but better than Variant A. Entry-point disruption is 3: only 7 of the 19 entry points rewrite (smaller blast radius than D; §3.2). Migration cost is 3: 8-9 files touched (§7). Irreversibility is 3: same reversibility profile as Variant D — route changes are reversible, entry-point rewrites require reverting.

**Key insight from the matrix:** Variant B (`URL canonicalization`) is the standout balanced option — it scores 5 on the two cost criteria (entry-point disruption and migration cost) while improving UX clarity and per-user data shape vs Variant A, and doing so with strong reversibility (4). Variant C scores highest on the architectural quality criteria (UX clarity 5, per-user data shape 5, v7.0 carousel fit 5) but at maximum disruption cost (entry-point disruption 1, migration cost 1). Variant B's v7.0 carousel fit (3) is its weakest criterion — two render sites survive in the two-route model — but the cost differential vs Variant C is large. The matrix supports a "ship B now as the practical merge, design for C in v7.0" reading, or a "ship B now and accept the carousel remains two-surfaced" reading. Plan 04's recommendation section will make this call.

## 7. Cost Estimate per Variant

Columns: **Files touched** (count + key paths) | **Entry-point rewrites** | **Migrations** (drizzle + supabase) | **DAL changes** | **Test surface**

| Variant | Files touched | Entry-point rewrites | Migrations | DAL changes | Test surface |
|---------|---------------|----------------------|------------|-------------|--------------|
| **A. Keep separate** | 0 | 0 | 0 | 0 | None — no behavior change |
| **B. URL canonicalization** | 1-2 (`catalog/[catalogId]/page.tsx` + 1 test file) | 0 | 0 | 0 | Low — redirect test; assert 307 for owner viewers on `/catalog/[id]` |
| **C. Unified `/w/[ref]`** | 19+ (new route + 2 old routes + 17 entry-point files) | 19 | 0 | 0 (route-level dispatch) | High — full integration test for both old URLs → new URL + all 19 entry points |
| **D. Catalog absorbs watch** | 13-14 (`catalog/[catalogId]/page.tsx` rewrite + `watch/[id]/page.tsx` removal + 12 entry points) | 12 | 0 | 0 (reuses `findViewerWatchByCatalogId` + `getWatchByIdForViewer`) | Medium-high — owner-detection layering on catalog route; per-user data threading; `WatchDetail` island conditional |
| **E. Watch absorbs catalog** | 8-9 (`watch/[id]/page.tsx` rewrite + `catalog/[catalogId]/page.tsx` removal + 7 entry points + `OtherOwnersRoster` policy) | 7 | 0 | 0 (route-level dispatch on UUID space) | Medium — catalog-only mode test; UUID dispatch test; `OtherOwnersRoster` always-on vs always-off decision |

**None of A-E require schema changes to `watches` or `watches_catalog` in v5.2.** All merge variants are route + UI only. The catalog-wipeable carve-out (MEMORY `project_db_wipeable_2026_05_09`, updated 2026-05-19 — `watches_catalog` is NOT wipeable) only matters IF v7.0 photo schema lands as part of an implementation phase — out of scope for Phase 50 per D-GUARD-01. The v7.0 lens (§5) flags this consideration but does not pre-decide it.

---
