# Phase 59: Unified Route (Variant C) - Context

**Gathered:** 2026-05-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Collapse the two watch-detail routes — `/catalog/[catalogId]` (cross-user spec) and `/watch/[id]` (per-user owned) — into one canonical `/w/[ref]` route; **remove** the legacy detail routes (hard 404, no redirect); move the edit form to `/w/[ref]/edit`; re-point every internal link to a watch; and add a build-failing CI guard that catches any surviving legacy detail-path link literal.

**Route + URL dispatch only.** No schema change, no photos/carousel, no new viewer-state handling (the routes split on ref-identity, not viewer audience — `/watch/[id]` already serves cross-user viewers). Photos (Phase 60-61), wear-pic surfacing (62), grid engagement (63), and IA redesign (64) are explicitly out of this phase.

**Requirements:** ROUTE-01, ROUTE-02, ROUTE-03, ROUTE-04, ROUTE-05, ROUTE-06.

</domain>

<decisions>
## Implementation Decisions

### Route & URL Identity
- **D-01:** Variant C unified route `src/app/w/[ref]/page.tsx` is the sole watch-detail surface (locked by Phase 50 spike §4.C + operator).
- **D-02:** Hard cutover — `/watch/[id]` and `/catalog/[catalogId]` are **removed** (delete the `page.tsx` files; route 404s by absence). **No redirect shells.** Un-migrated links must fail loudly; the CI guard (D-11) is the completeness guarantee, not manual click-through (operator 2026-05-25).
- **D-03:** The ref carries the **natural id of the linking surface** — ownership/per-user surfaces (collection, profile, home, notifications, insights) emit `watches.id`; discovery surfaces (search, Explore rails, curated lists) emit `catalogId`. **Not** a prefixed/typed ref — operator explicitly rejected `/w/u-…` / `/w/c-…`.
- **D-04:** Server-side resolution is raw-UUID **try-per-user-then-catalog**: try `getWatchByIdForViewer(user.id, ref)` first; if null, fall back to `getCatalogById(ref)`. No prefix decoding.
- **D-05:** An owned watch legitimately has **two resolvable `/w/` URLs** (its `watches.id` and its `catalogId`). Accepted — **no canonicalizing redirect** to collapse them. Consistent with ROUTE-01 as written ("single canonical *route* that resolves *either* id type" — one route, not one URL string per watch). **Rationale for natural-id over catalog-id-only:** a collector can own duplicate copies of one reference (or owned + sold); per-user data (notes, acquisition date, strap, condition) is per-*copy*; only `watches.id` addresses a specific copy. Catalog-id-only cannot.

### Owner-via-Discovery-Link Framing
- **D-06:** When an owner reaches `/w/[catalogId]` (discovery surfaces link by `catalogId` regardless of viewer), the catalog-resolution branch **detects ownership** (reuse `findViewerWatchByCatalogId` or equivalent), loads the full `Watch`, and renders the **full owned view in place** — owned framing + `WatchDetail` client island + owner write actions. **No redirect.**
- **D-07:** Ownership is determined by the **viewer's relationship to the watch, not by which id the URL carried.** Both resolution branches (per-user hit; catalog hit + ownership detected) **converge on the same framing dispatch** (`same-user` | `cross-user`). This is the unified framing the spike §4.C described. The catalog-branch ownership layering is the inherent Variant C cost — it is **not** the buggy D-08/BUG-01 status-flip; it is a clean owner render.
- **D-08:** The 50.1 Variant B redirect (`redirect(\`/watch/${viewerOwnedRow.id}\`)` at `src/app/catalog/[catalogId]/page.tsx:112`, ARCH-02) is **unwound** — Variant C supersedes it. No page-level redirects on the catalog path. (Avoids the Router Cache poisoning landmine entirely — see code_context.)

### Route Scope (edit / add-watch)
- **D-09:** `/watch/[id]/edit` → `/w/[ref]/edit` (keyed by `watches.id`, owner-only — only owners reach the edit form). It follows its detail route.
- **D-10:** `/watch/new` (add-watch flow) **stays** at its current path in this phase. v8.0 Add-Watch Redesign (SEED-010) will rework it; do not churn its 10+ linkers now.

### CI Guard (ROUTE-03)
- **D-11:** A **static source-scan test that fails the build** (not a lint warning). It bans any internal link literal targeting the legacy watch-detail paths `/watch/<id>` and `/catalog/<id>`, **including template literals** (`/watch/${...}`, `/catalog/${...}`).
- **D-12:** The guard must catch **computed/runtime deep-link strings**, not only JSX `href` literals — specifically `NotificationRow.resolveHref`'s `return \`/watch/${watchId}\`` (ROUTE-04 explicitly names "computed notification deep-links").
- **D-13:** The guard **allowlists `/watch/new`** (kept per D-10) and must not false-flag non-watch paths (`/explore/lists/[id]`, `/admin/lists/[id]`, `/wear/[id]`).

### Privacy & Write Surfaces (locked; restated for planner)
- **D-14:** Two-layer privacy gate (`getWatchByIdForViewer`: RLS-outer + WHERE-inner requiring `profile_public=true` AND per-tab visibility) preserved with **no regression** (ROUTE-05). The merge changes routing, not the gate.
- **D-15:** Owner-only write surfaces (edit, delete, mark-worn, flag-deal) remain gated to the authenticated owner via `viewerCanEdit` on the `WatchDetail` island (ROUTE-06).

### Claude's Discretion
- **CI guard exact mechanism** (D-13) — custom test-runner check vs ESLint rule vs typed-route helper. Pick what's most robust; build-failing + the scope above are the locked constraints.
- **404/not-found UX** for legacy paths — Next's default `not-found` is acceptable; the point is "fail loudly," not a designed error page.
- **How the server-only catalog page and the client-island watch page are physically merged** into one `/w/[ref]/page.tsx` (B1-invariant compliance, server-sibling composition) — implementation detail; the *behavior* is locked by D-06/D-07/D-14/D-15.
- **`OtherOwnersRoster` / `CatalogPageActions` visibility per viewer-state** on the unified route (catalog-only by UI-SPEC today) — carry the spike §4.D/E forcing-function note to the planner; resolve here or defer to Phase 64 IA redesign.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture decision (load-bearing)
- `.planning/milestones/v5.2-phases/50-watch-detail-architecture-spike/50-SPIKE.md` — the Variant C definition (§4.C), the viewer-state × ref-identity matrix (§2), the entry-point map (§3.2), the decision matrix (§6), and the "ship B now, design for C in v7.0" trajectory. §4.B documents the 50.1 Variant B redirect that Phase 59 unwinds (D-08). §4.C/§5.C is the canonical Variant C spec.
- `.planning/REQUIREMENTS.md` §"Unified Route (Variant C) — `ROUTE`" (lines 14–25) — ROUTE-01..06 plus the operator hard-cutover note (lines 16–18): ~55 link literals / ~36 files, CI guard is the completeness guarantee, notification deep-links are computed-not-stored, `/wear/[id]` unaffected.
- `.planning/ROADMAP.md` "Phase 59" (lines 191–201) — goal + 5 success criteria.

### Current route code (what Phase 59 modifies / deletes)
- `src/app/catalog/[catalogId]/page.tsx` — cross-user catalog detail (server-only); **currently does the 50.1 Variant B redirect at line 112** (unwind per D-08); `findViewerWatchByCatalogId` ownership detection at ~282–308 (reuse for D-06). **Deleted** at end state.
- `src/app/watch/[id]/page.tsx` — per-user detail; framing dispatch `isOwner ? 'same-user' : 'cross-user'` (~line 58). **Deleted** at end state.
- `src/components/watch/WatchDetail.tsx` — `'use client'` island; `viewerCanEdit`-gated write actions (`editWatch`, `removeWatch`, `markAsWorn`, `flagDeal`). Reused by the unified page.
- `src/app/watch/[id]/edit/page.tsx` — edit form; **moves to** `src/app/w/[ref]/edit/page.tsx` (D-09).
- `src/data/watches.ts` — `getWatchByIdForViewer` (~line 193): two-layer privacy gate, returns `{ watch, isOwner }`; the primary `/w/[ref]` resolver.

### Link surfaces to re-point (ROUTE-04) — researcher must re-enumerate
- `src/components/notifications/NotificationRow.tsx` — `resolveHref` computes `/watch/${watchId}` (~line 142); computed deep-link the CI guard must catch (D-12).
- `src/lib/watchFlow/destinations.ts` — add-watch `returnTo` handling; references `/watch/new` (stays per D-10).
- Spike §3.2 lists the v5.2-era 19 entry points; **current count is higher** (~36 files / ~55 literals per REQUIREMENTS, after v6.0 social surfaces landed). Re-grep `'/watch/'` and `'/catalog/'` across `src/` at research time — do not trust the spike's 19-site list as complete.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`getWatchByIdForViewer`** (`src/data/watches.ts:~193`) — already cross-user-aware (returns `isOwner`); the per-user resolver for the try-first branch (D-04).
- **`getCatalogById`** — the catalog resolver for the fallback branch (D-04).
- **`findViewerWatchByCatalogId`** (`src/app/catalog/[catalogId]/page.tsx:~282`) — ownership detection by `catalogId`; reused on the catalog branch for the D-06 owner layering.
- **`WatchDetail.tsx` island + shared server siblings** (`ReferenceIdentityCard`, `SameFamilyRail`, `LineageRail`, `CollectionFitCard`, `OtherOwnersRoster`, `CatalogPageActions`) — both legacy pages already converge on these; the unified page composes them.

### Established Patterns / Constraints
- **B1 invariant:** RSCs cannot be imported into the `'use client'` `WatchDetail` island; server siblings compose *around* it. Preserve in the merged page.
- **Router Cache poisoning landmine** (MEMORY `feedback_proxy_router_cache_poisoning`, spike §4.B): proxy-layer (`NextResponse.redirect`) redirects poison Next 16's Router Cache → 404s on soft-nav. Phase 59 adds **no** redirects (hard cutover D-02 + in-place owner render D-06), so it sidesteps this entirely. **Do not** add a proxy-layer redirect for canonicalization.
- **`/wear/[id]`** is a separate route, **unaffected** by the merge.
- **`watches.catalogId` is a NOT-NULL FK** (Phase 38 D-06) — every per-user watch maps to a catalog row. (This is what makes catalog-id-only *technically* possible but was rejected per D-05's duplicate-copy reasoning.)

### Integration Points
- The unified `src/app/w/[ref]/page.tsx` (+ `/w/[ref]/edit/page.tsx`) replaces both legacy detail pages; the legacy `page.tsx` files are deleted (404 by absence).
- The notification deep-link resolver, add-watch destinations, and all grid/search/rail/profile/home/insights cards re-point to `/w/[ref]`.

</code_context>

<specifics>
## Specific Ideas

- **Natural id, not prefixed** — operator explicitly rejected a prefixed/typed ref (`/w/u-…` / `/w/c-…`) in favor of raw UUIDs with try/fallback resolution.
- **Duplicate-copy is the deciding argument** for natural-id over catalog-id-only: a collector can own two of the same reference; per-user data is per-copy; only `watches.id` addresses a specific copy.
- **No redirects, anywhere** — the operator's hard-cutover stance plus the owner-view-in-place choice (D-06) means the phase ships with zero `redirect()` calls on watch routes, including unwinding the 50.1 one.

</specifics>

<deferred>
## Deferred Ideas

- **`/watch/new` → `/w/new` relocation** — deferred to v8.0 Add-Watch Redesign (SEED-010), which reworks the flow; relocating now would be churn (D-10).
- **CI guard → typed-route enforcement** (prevent, not just detect) — out of scope; this phase ships the build-failing static scan. Could evolve later.
- **Photos / carousel / wear-pic surfacing / grid engagement / IA redesign** — Phases 60-64; explicitly out of this phase.

None of the discussion strayed outside the route-merge domain.

</deferred>

---

*Phase: 59-unified-route-variant-c*
*Context gathered: 2026-05-25*
