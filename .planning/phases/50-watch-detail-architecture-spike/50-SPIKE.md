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
