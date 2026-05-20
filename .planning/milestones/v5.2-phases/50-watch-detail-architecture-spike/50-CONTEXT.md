# Phase 50: Watch-Detail Architecture Spike - Context

**Gathered:** 2026-05-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 50 is a **decision-only spike**. It produces ONE written deliverable — `50-SPIKE.md` — that:

1. Describes what each watch-detail route does today and who reaches it, framed as a corrected **viewer-state × ref-identity** matrix (not the ROADMAP's audience-axis labels — see D-AUDIENCE-01).
2. Scores **five merge variants A–E** on a decision matrix with explicit criteria.
3. Applies the v7.0 Watch Photos (SEED-013) lens per variant — carousel + wear-pic surfacing implications are mandatory, not box-checked.
4. Delivers a clear keep-separate / merge recommendation specific enough that `/gsd-plan-phase 50` can execute against it.
5. Includes a ship-now eligibility section in the same YES/NO/NEEDS-DISCUSSION format Phase 49 used, so the v5.2 mid-milestone requirement-add flow (which turned Phase 49 → 49.1) plugs in cleanly if the spike says ship.

**In scope:** the audit; the viewer-state × ref-identity matrix; the variant scoring; the v7.0 lens; the recommendation document.

**Out of scope:** any merge/canonicalization implementation. Per ROADMAP success criterion #4 + REQUIREMENTS.md "Out of Scope," an implementation ships in v5.2 ONLY if the spike specifically flags a path as cheap AND strongly favored — and only after a new requirement is added mid-milestone (separate `/gsd-phase` add flow, mirroring 49 → 49.1).

**Not in this spike:** the v7.0 photo data model itself, the public/private wear-pic policy, the per-person photo cap, the wears-tab persistence rules. The spike consumes SEED-013 as a forcing function but does not pre-decide v7.0's open questions.

</domain>

<decisions>
## Implementation Decisions

### Audience matrix — D-AUDIENCE
- **D-AUDIENCE-01:** The spike opens by **re-framing** the audience analysis from the ROADMAP SC#1 labels ("owner / wishlist-holder / anonymous visitor / cross-user browse") to a 2D **viewer-state × ref-identity** matrix. The ROADMAP framing mixes two axes — viewer-state (who the viewer is in relation to the watch) and ref-identity (which ID the route is keyed by) — and the spike conclusion should sit on a frame that matches code reality, not the as-written goal text.
  - **Viewer-state axis:** owner, non-owner-with-collection, non-owner-empty-collection, wishlist-holder (catalogId on viewer's wishlist), sold-this (viewer previously owned but status='sold').
  - **Ref-identity axis:** per-user (`watches.id`) vs catalog (`watches_catalog.id`).
  - **Anonymous-visitor** is flagged as a 5th viewer-state cell marked "not reachable today (auth-gated)" so v6.0 social / v7.0 photo readers know the spike didn't ignore them — the cell exists as a forward-compat placeholder.
  - Each cell describes the framing + UI shape today (citing the existing code: `findViewerWatchByCatalogId` D-08 flip, `getWatchByIdForViewer` same/cross-user framing, etc.). This corrects the implicit ROADMAP assumption that `/watch/[id]` is owner-only — it already supports cross-user via `getWatchByIdForViewer`.

### Merge variant breadth — D-VARIANTS
- **D-VARIANTS-01:** The spike scores **all five merge variants** on the decision matrix. Phase 49 scored 5 variants and that breadth is what surfaced the non-obvious "remove genre surface" winner — Phase 50 needs the same evidence base.
  - **Variant A** — Keep separate (status quo; UI-only convergence via shared components continues — `ReferenceIdentityCard`, `SameFamilyRail`, `LineageRail`, `CollectionFitCard` already shared).
  - **Variant B** — URL canonicalization (`/catalog/[catalogId]` 307s to `/watch/[id]` when viewer owns this catalog ref; otherwise stays on `/catalog`). Today's D-08 "You own this" callout becomes a redirect instead of an inline framing flip.
  - **Variant C** — Single unified route (e.g. `/w/[ref]`) that accepts either id type and resolves server-side. Both old URLs redirect to canonical.
  - **Variant D** — Absorb `/watch/[id]` into `/catalog/[catalogId]` (catalog route layers per-user data when the viewer owns the ref; the per-user URL is retired).
  - **Variant E** — Absorb `/catalog/[catalogId]` into `/watch/[id]` (per-user route grows a "no per-user row yet" mode; the catalog URL is retired; all search/Explore entry points re-point).
- **D-VARIANTS-02:** Decision matrix scoring criteria are locked: **UX clarity, schema/URL stability, per-user data shape, v7.0 photo carousel fit, entry-point disruption, migration cost, irreversibility.** Format of the matrix (numeric scores vs ✓/✗ vs prose) is the planner's call — see Claude's Discretion.

### v7.0 Watch Photos lens depth — D-V7-LENS
- **D-V7-LENS-01:** The spike applies a **deep, per-variant** v7.0 lens. For each of variants A–E, the spike sketches:
  1. **Where the carousel renders** — which route file, which Server vs Client boundary.
  2. **Data joins** — catalog photos (multi-photo replacement for `watches_catalog.imageUrl`) + owner wear-pics (from `wear_events.photo_url`) + other-owners' public wear-pics (cross-user query, public-visibility-gated).
  3. **Writability axis** — who can add a photo on this surface (owner vs catalog-spec writer vs nobody-just-display).
  4. **Variant × Viewer-State cell interaction** — how the carousel composition changes per viewer-state (owner sees own + others' public; non-owner sees only others' public; empty-collection-viewer sees catalog-only).
- This depth means the v7.0 milestone inherits an **architecture decision**, not a re-decision. The spike does NOT pre-decide SEED-013's own open questions (per-person cap, opt-in/opt-out wear-pic surfacing, ordering) — those stay open for the v7.0 discuss step.

### SPIKE.md skeleton + ship-now check — D-SKEL
- **D-SKEL-01:** Deliverable lives at `.planning/phases/50-watch-detail-architecture-spike/50-SPIKE.md`. Phase-co-located, same pattern as `49-SPIKE.md`.
- **D-SKEL-02:** The spike doc must contain these **9 sections** (skeleton — section ordering is the planner's call, but every section MUST be present):
  1. **Domain** — restate what the spike is deciding.
  2. **Audience Matrix** — viewer-state × ref-identity (per D-AUDIENCE-01), with the anonymous-visitor cell flagged as not-reachable-today.
  3. **Route Reality Today** — what each route does, entry-point map (search results / Explore curated lists / discovery cards → `/catalog/[catalogId]`; collection cards / Profile / Home → `/watch/[id]`).
  4. **Variants A–E** — for each variant: routing model, per-user data shape, entry-point disruption, brief summary.
  5. **v7.0 Watch Photos Lens** — per-variant sketch per D-V7-LENS-01 (4 sub-points × 5 variants).
  6. **Decision Matrix** — 7 criteria from D-VARIANTS-02, scored per variant.
  7. **Cost Estimate per Variant** — files touched, migrations needed (drizzle + supabase if any), entry-point rewrites, test surface. Live as a separate section, NOT folded into Variants — keeps cost numbers comparable side-by-side.
  8. **Recommendation** — primary keep/merge verdict + rationale rooted in the matrix.
  9. **Ship-now Eligibility** — YES/NO/NEEDS-DISCUSSION for the recommendation, with the gate that would trip a mid-milestone requirement add. **Format verbatim from Phase 49 D-05 §9** — so the v5.2 mid-milestone requirement-add flow (which worked for TAX-02 → Phase 49.1) plugs in cleanly without format friction.

### Hard guardrail (from ROADMAP/REQUIREMENTS) — D-GUARD
- **D-GUARD-01:** No implementation in this phase. If the spike concludes a path is cheap and strongly favored, that triggers a `/gsd-phase` requirement-add flow — NOT direct execution. The spike output must be the **only** artifact written under `.planning/phases/50-*/` other than the standard plan/verification artifacts.

### Claude's Discretion
- Exact ordering of sections within `50-SPIKE.md` (skeleton in D-SKEL-02 is mandatory; sequencing is the planner's call).
- Format of the Decision Matrix (numeric scores vs ✓/✗ vs prose) — planner picks whatever reads clearest for the data on hand. Phase 49 used a hybrid; either is fine.
- Whether the v7.0 per-variant sketches live as a single Section 5 or are interleaved with each Variant's subsection in Section 4. D-V7-LENS-01 mandates depth, not location.
- Whether the cost estimate distinguishes "data-migration cost" from "code-change cost." Recommended if any variant touches the schema (none should, since v5.2 catalog is single-user prod).
- Whether to query prod for any evidence (e.g. how many catalog rows the user currently owns — would inform the "You own this" callout's frequency). Optional; this is a route/UI architecture spike not a data spike.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements
- `.planning/REQUIREMENTS.md` line 22 — **ARCH-01** requirement text (decision-only spike; merge ships only if cheap AND strongly favored)
- `.planning/REQUIREMENTS.md` line 47 — v5.2 Out of Scope row: "Merging the two watch-detail views"
- `.planning/REQUIREMENTS.md` line 48 — v5.2 Out of Scope row: `/catalog/[catalogId]` truncated render is by design, feeds the spike not a bug fix
- `.planning/ROADMAP.md` §"Phase 50" (lines 242-251) — phase goal + 4 success criteria, including the cheap-and-strongly-favored escape hatch in SC#4
- `.planning/PROJECT.md` §"Current Milestone: v5.2 Polish + Taxonomy" — spike framing, milestone shape, v5.2 → v6.0 → v7.0 trajectory

### Phase 49 spike pattern (this phase mirrors it structurally)
- `.planning/phases/49-genre-vs-style-taxonomy-spike/49-CONTEXT.md` — D-04/D-05 spike-doc skeleton, D-06/D-07 evidence requirements, D-08 hard guardrail. Phase 50 inherits the structural shape (decision-only, variant-scored, ship-now eligibility section).
- `.planning/phases/49-genre-vs-style-taxonomy-spike/49-SPIKE.md` — the actual deliverable; Phase 50 should read identically in shape (sections, voice, ship-now format)
- `.planning/ROADMAP.md` Phase 49.1 entry — concrete proof that the SC#4 escape hatch works end-to-end (Phase 49's spike → Phase 49.1 requirement-add → 8-plan execution → prod migration applied 2026-05-20)

### v7.0 forcing function
- `.planning/seeds/SEED-013-v7.0-watch-photos.md` — multi-photo carousel, public wear-pic surfacing on watch detail, wears-tab persistence, add-watch photo encouragement. The spike's v7.0 lens (D-V7-LENS-01) reads this as the forcing function but does NOT pre-decide its open questions (per-person cap, opt-in/opt-out, ordering, storage bucket strategy).

### Watch-detail route implementations
- `src/app/catalog/[catalogId]/page.tsx` (308 lines) — server-only; `findViewerWatchByCatalogId` D-08 "You own this" flip; renders `OtherOwnersRoster` (catalog-only), `CatalogPageActions` 3-CTA block. Lines 90-93 carry the Phase 49.1 `primaryArchetype` projection drop — keep current after the upcoming prod deploy of Phase 49.1.
- `src/app/watch/[id]/page.tsx` (132 lines) — server page + heavy client island. Uses `getWatchByIdForViewer` which serves BOTH same-user AND cross-user framings (line 58: `framing: isOwner ? 'same-user' : 'cross-user'`) — this is the key signal that "two-routes-for-two-audiences" framing is inaccurate today.
- `src/components/watch/WatchDetail.tsx` (462 lines, `'use client'`) — owner-only edit/delete/markAsWorn/flag-deal Server Action wiring. Any merge variant must address whether this island still renders or how its writable surface participates in the merged page.
- `src/app/u/[username]/[tab]/page.tsx` (356 lines) — cross-user profile view; entry point into `ProfileWatchCard` which links to `/watch/[id]`.
- `src/data/watches.ts:193-` — `getWatchByIdForViewer` definition; the cross-user gate logic the spike must reference when describing today's reachability.

### Shared rendering surface (UI-only convergence already exists)
- `src/components/insights/ReferenceIdentityCard.tsx` — rendered by BOTH routes when collection is empty (NSV-06 + NSV-20)
- `src/components/insights/SameFamilyRail.tsx` — rendered by both routes
- `src/components/insights/LineageRail.tsx` — rendered by both routes
- `src/components/insights/CollectionFitCard.tsx` — rendered by both routes (verdict card)
- `src/components/insights/OtherOwnersRoster.tsx` — `/catalog/[catalogId]` ONLY; UI-SPEC §Render Order pins this to catalog-only (per `49-CONTEXT.md`-style note). Any merge variant must decide whether this stays catalog-only behavior or appears for owners too.

### Entry-point map (raw)
- `/catalog/[catalogId]` entry points: `src/components/search/WatchSearchRow.tsx:31`, `src/components/explore/DiscoveryWatchCard.tsx:30`, `src/components/explore/PathCard.tsx:97,134,143`, `src/app/explore/lists/[id]/page.tsx:91,110`
- `/watch/[id]` entry points: `src/components/watch/WatchCard.tsx:35`, `src/components/profile/ProfileWatchCard.tsx:59`, `src/components/home/RecommendationCard.tsx:22`, `src/components/home/ActivityRow.tsx:51`, `src/components/home/SleepingBeautyCard.tsx:33`, `src/components/home/MostWornThisMonthCard.tsx:21`, `src/components/home/WywtSlide.tsx:78`, `src/components/profile/StatsTabContent.tsx:62`, `src/components/profile/NoteRow.tsx:62`, `src/components/insights/CollectionFitCard.tsx:73`, `src/components/insights/SleepingBeautiesSection.tsx:44`, `src/components/insights/GoodDealsSection.tsx:48`. (Variant E — absorb catalog into watch — would NOT need to rewrite these; Variant D — absorb watch into catalog — would.)

### Verdict / framing composer (the cross-user vs same-user logic)
- `src/lib/verdict/composer.ts` — `computeVerdictBundle({ framing })` accepts `same-user | cross-user | self-via-cross-user`; this is the existing abstraction over the framing axis. Any merge variant should preserve compatibility with these three framings (or explicitly retire one).
- `src/lib/verdict/types.ts` — `VerdictBundle` discriminated union; the `self-via-cross-user` framing is the Phase 20.1 D-08 "You own this" callout shape.

### Schema ground truth
- `src/db/schema.ts` — `watches` table (per-user) vs `watches_catalog` table (shared catalog); both carry `imageUrl` today (relevant to v7.0 multi-photo replacement).

### Prior context (carry-forward signals)
- `.planning/phases/48-user-facing-bug-fixes/48-CONTEXT.md` — Phase 48 BUG-01 fix flipped wishlist watches to NOT trigger "You own this" on `/catalog/[catalogId]` (D-08 detection now scopes to `status='owned'`). The bug that surfaced ARCH-01 was itself a casualty of the two-route split — strong evidence for the merge case.
- `.planning/phases/49-genre-vs-style-taxonomy-spike/49-CONTEXT.md` — structural pattern (decision-only spike, 5-variant matrix, ship-now eligibility, hard guardrail).
- MEMORY: `feedback_proxy_router_cache_poisoning` — Variant B (URL canonicalization via 307) must NOT live in `proxy.ts` with a getUser()-DB-check shape; a 307 on RSC prefetch poisons Router Cache → 404 on soft-nav. Any "canonicalize at proxy" sub-variant of B is a structural landmine. The spike must call this out explicitly when scoring Variant B.
- MEMORY: `project_db_wipeable_2026_05_09` — prod is currently a single-user DB but `watches_catalog` is NOT wipeable (LLM/factual/photo enrichment investment). The v7.0 multi-photo migration would be in-place ALTER+UPDATE, not wipe+re-seed; the cost estimate for any variant that schemas the photo model should reflect that.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Shared component surface already exists** — `ReferenceIdentityCard`, `SameFamilyRail`, `LineageRail`, `CollectionFitCard` are rendered by BOTH routes today. Variant A ("keep separate") still benefits from the shared surface; the merge variants don't need to invent shared rendering, only collapse the two route shells.
- **`computeVerdictBundle` is framing-aware** — the verdict composer already accepts `same-user | cross-user | self-via-cross-user`. The framing abstraction is route-independent; merging routes doesn't require rewriting verdict logic.
- **`getWatchByIdForViewer` already cross-user-aware** — `/watch/[id]` is not owner-only today. This collapses the "owner vs non-owner audience" framing the ROADMAP implies — the routes don't split on viewer audience, they split on which ID the URL carries.
- **`OtherOwnersRoster`** is catalog-only by UI-SPEC. If Variants D/E merge, the spike must decide whether this surface becomes always-on (rendered for owners too) or stays guarded by a "do we have a catalog-keyed entry path" check.

### Established Patterns
- **Server-only `/catalog/[catalogId]`** vs **server+client-island `/watch/[id]`** — the per-user route needs the `WatchDetail` island for edit/delete/markAsWorn/flag-deal Server Actions. Any merge variant has to decide whether the island still gates on `isOwner` (likely yes) and whether server siblings continue to compose around it (B1 invariant from Phase 39b — RSCs cannot be imported into the `'use client'` island).
- **Entry-point asymmetry** — `/catalog/[catalogId]` is fed by discovery surfaces (search, Explore); `/watch/[id]` is fed by ownership surfaces (collection, profile, home recs). This split correlates with viewer-state in practice — but isn't enforced by the routes. The spike's audience matrix needs to make this de-facto split visible.
- **D-08 "You own this" callout** (Phase 20.1) — the existing in-route framing flip on `/catalog/[catalogId]` is the prototype for Variant B-style canonicalization. The Phase 48 BUG-01 fix (`status='owned'` scope) is evidence that maintaining this flip carries an ongoing tax — the wishlist/sold-this edges keep needing edits.
- **`proxy.ts` is intentionally NOT a soft auth gate** — per the `feedback_proxy_router_cache_poisoning` memory, 307s on RSC prefetch poison Router Cache. Variant B (URL canonicalization) must canonicalize at the page level, not via proxy.

### Integration Points
- **Verdict / similarity stays separate from route choice** — `composer.ts` reads typed bundles, not URL paths. A merge doesn't touch `lib/verdict/` or `lib/similarity.ts`.
- **The 3-CTA block (`CatalogPageActions`)** is catalog-only today. Variants D/E need to decide whether the CTA block surfaces on the merged route for non-owner viewers only (current behavior) or also for owners (current behavior on `/catalog/[catalogId]` when viewer doesn't own this catalog ref).
- **Hierarchy data (`getSameFamilyForCatalog`, `getLineageForReference`)** is keyed by catalogId. Variant E (catalog absorbed into watch) needs `watch.catalogId` for these rails to render — already handled today (`/watch/[id]` falls back to `[]` when `catalogId` is null per Phase 36 deferred-items.md Item 1). No new code needed.
- **v6.0 social layer (SEED-012)** will add likes/comments to wears + collection items. A merged surface is friendlier to a single likes/comments shape than two surfaces that each need to wire it. The spike should note this lightly — v6.0 ships before v7.0, so the merge decision affects v6.0 too.

</code_context>

<specifics>
## Specific Ideas

- **The bug that birthed the spike** — the Phase 48 BUG-01 (wishlist on `/catalog/[catalogId]` mislabeled "You own this") is itself evidence in the spike. A merge variant that retires the in-route framing flip retires the bug class. The spike's recommendation should reference BUG-01 by name when arguing for or against the framing-flip approach.
- **"Truncated render" observation** — the user noted `/catalog/[catalogId]` looks truncated vs `/watch/[id]`. Per REQUIREMENTS line 48 this is by-design (slimmer cross-user spec-only view) and feeds the spike. The audience matrix in §2 should explicitly cite "what's missing on /catalog/[catalogId] vs /watch/[id] in each viewer-state cell" — that asymmetry IS the merge case.
- **Phase 49 → 49.1 is the model** — the spike → ship-now → mid-milestone-requirement-add → 8-plan-execution → prod-migration loop just worked end-to-end (49.1 closed 2026-05-20). The Phase 50 SPIKE.md should be readable side-by-side with `49-SPIKE.md` — same shape, same voice, same ship-now section format. Future readers auditing v5.2 mid-milestone adds should see continuity.
- **v7.0 lens is the differentiator** — Phase 49's spike weighed UX clarity + schema simplicity + migration cost. Phase 50's matrix adds the v7.0 photo carousel fit as a first-class criterion (D-VARIANTS-02). The spike should explicitly note that this criterion can dominate if v7.0 favors one variant strongly — the timing is too close to ignore (v6.0 next, v7.0 after).

</specifics>

<deferred>
## Deferred Ideas

- **Any merge/canonicalization implementation in this phase** — explicitly forbidden by ROADMAP SC#4 + REQUIREMENTS Out of Scope. If the spike strongly favors a cheap path, that triggers a new requirement (separate `/gsd-phase` add), not direct execution. Mirror of Phase 49.1 from Phase 49.
- **v7.0 photo data model** (multi-photo schema, public/private wear-pic policy, per-person cap, ordering, storage bucket strategy) — out of scope; the spike consumes SEED-013 as a forcing function only. These remain open questions for the v7.0 discuss step.
- **v6.0 social layer interaction** (likes/comments on the merged surface, mutual-follow gating for wishlist comments) — out of scope; SEED-012 owns this. The spike may note the merge decision affects v6.0 too, but does not design the social wiring.
- **Auth-gating relaxation** (making either route reachable to anonymous visitors) — out of scope. The anonymous-visitor cell in the matrix is forward-compat only; relaxing auth would be its own multi-phase change touching `getCurrentUser()`, profile RLS, and the OAuth flow.
- **Entry-point reshuffle** — if Variants D or E win, the entry-point rewrite is part of the resulting implementation phase, not this spike. The spike scores entry-point disruption as a cost criterion only.

None of the discussion strayed beyond phase scope otherwise.

</deferred>

---

*Phase: 50-watch-detail-architecture-spike*
*Context gathered: 2026-05-20*
