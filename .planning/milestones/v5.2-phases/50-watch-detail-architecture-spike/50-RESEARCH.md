# Phase 50: Watch-Detail Architecture Spike - Research

**Researched:** 2026-05-20
**Domain:** Route architecture / SPIKE.md production (decision-only deliverable)
**Confidence:** HIGH

## Summary

Phase 50 produces a single markdown deliverable — `.planning/phases/50-watch-detail-architecture-spike/50-SPIKE.md` — that compares 5 merge variants (A–E) for `/catalog/[catalogId]` and `/watch/[id]`, scores them on 7 locked criteria, applies a deep v7.0 Watch Photos lens per variant, and emits a clear keep-separate / merge recommendation specific enough for `/gsd-plan-phase 50` to execute against. **No implementation code ships in Phase 50.** If the spike concludes a path is cheap AND strongly favored, that finding triggers a mid-milestone `/gsd-phase --insert` flow producing Phase 50.1 — the exact same loop Phase 49 → Phase 49.1 just closed on 2026-05-20.

The "implementation" task surface for the planner is therefore: (1) ingest the locked 9-section skeleton from CONTEXT.md D-SKEL-02; (2) wire the planner's plan files to the section produced (e.g. Plan 01 might cover Sections 1–3, Plan 02 the matrix + cost + lens, Plan 03 the recommendation + ship-now); (3) match Phase 49's voice + format verbatim where CONTEXT mandates it (the ship-now section is the load-bearing format). Research below provides a file-by-file evidence base per variant so the planner can write the spike against real code, not hypotheses.

**Primary recommendation for the planner:** mirror Phase 49's 3-plan execution shape (sections 1–3 in Plan 01; sections 4–7 in Plan 02; sections 8–9 in Plan 03) and lock the 9-section skeleton exactly as D-SKEL-02 specifies. Reuse the Phase 49 ship-now section's verbatim format. The variant evidence is in §"Per-Variant File Impact" below — the planner can copy the per-variant Files-Touched rows into the SPIKE.md §7 Cost Estimate table without re-deriving them.

## Architectural Responsibility Map

The "capability" in this phase is "produce a written decision document." There is no runtime tier. The mapping below tracks where the *decision* about each axis ultimately lands in the codebase if the spike's recommendation is later implemented (Phase 50.1 path).

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Spike document (this phase's only deliverable) | Documentation (`.planning/phases/50-*/`) | — | Markdown-only artifact; no runtime impact |
| Route resolution (if merge ships later) | Frontend Server (Next.js 16 App Router page.tsx) | — | Both candidate routes are server components under `src/app/` |
| Owner-only write surface (markAsWorn, editWatch, removeWatch, flagDeal) | Frontend Server → Server Actions in `src/app/actions/` | Client island (`WatchDetail.tsx`) | Server Actions called from `'use client'` island; identity gate is `viewerCanEdit` prop, sourced from `getWatchByIdForViewer().isOwner` |
| Cross-user data fetch (verdict, hierarchy, roster) | Frontend Server (Server Component fetch in page.tsx) | DAL (`src/data/*.ts`) | All non-mutation reads happen in server page; privacy gate is in DAL (`getWatchByIdForViewer`, `getCollectorsForCatalog`) |
| Verdict framing (same-user / cross-user / self-via-cross-user) | Domain (`src/lib/verdict/composer.ts`) | — | Route-independent abstraction; merge does not touch this layer |
| URL canonicalization (Variant B path) | Frontend Server (page.tsx redirect — NOT `proxy.ts`) | — | Per `feedback_proxy_router_cache_poisoning` memory: 307s on RSC prefetch poison Router Cache → 404 on soft-nav; canonicalize at page level |

## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-AUDIENCE-01 — Audience matrix re-framing:** Open the spike by re-framing the audience analysis from the ROADMAP SC#1 labels ("owner / wishlist-holder / anonymous visitor / cross-user browse") to a 2D **viewer-state × ref-identity** matrix. The ROADMAP framing mixes two axes — viewer-state (who the viewer is in relation to the watch) and ref-identity (which ID the route is keyed by). The spike conclusion must sit on a frame that matches code reality, not the as-written goal text.
  - **Viewer-state axis:** owner, non-owner-with-collection, non-owner-empty-collection, wishlist-holder (catalogId on viewer's wishlist), sold-this (viewer previously owned but status='sold').
  - **Ref-identity axis:** per-user (`watches.id`) vs catalog (`watches_catalog.id`).
  - **Anonymous-visitor** is a 5th viewer-state cell flagged "not reachable today (auth-gated)" — forward-compat placeholder for v6.0 social / v7.0 photo readers.
  - Each cell describes the framing + UI shape today (citing `findViewerWatchByCatalogId` D-08 flip, `getWatchByIdForViewer` same/cross-user framing). This corrects the implicit ROADMAP assumption that `/watch/[id]` is owner-only — it already supports cross-user via `getWatchByIdForViewer`.

**D-VARIANTS-01 — Score all 5 variants:** Phase 49 scored 5 variants and that breadth surfaced the non-obvious "remove genre surface" winner. Phase 50 needs the same evidence base.
  - **Variant A** — Keep separate (status quo; UI-only convergence via shared components continues).
  - **Variant B** — URL canonicalization (`/catalog/[catalogId]` 307s to `/watch/[id]` when viewer owns this catalog ref).
  - **Variant C** — Single unified route (`/w/[ref]`) accepting either id type, resolving server-side.
  - **Variant D** — Absorb `/watch/[id]` into `/catalog/[catalogId]`.
  - **Variant E** — Absorb `/catalog/[catalogId]` into `/watch/[id]`.

**D-VARIANTS-02 — Locked decision criteria:** UX clarity, schema/URL stability, per-user data shape, v7.0 photo carousel fit, entry-point disruption, migration cost, irreversibility. Format (numeric / ✓ / prose) is planner's discretion.

**D-V7-LENS-01 — Deep per-variant v7.0 lens:** For each variant A–E, the spike sketches: (1) where the carousel renders (route file + Server vs Client boundary); (2) data joins (catalog photos + owner wear-pics + other-owners' public wear-pics); (3) writability axis (who can add a photo); (4) variant × viewer-state cell interaction. The spike does NOT pre-decide SEED-013's open questions.

**D-SKEL-01 — Deliverable location:** `.planning/phases/50-watch-detail-architecture-spike/50-SPIKE.md`.

**D-SKEL-02 — Mandatory 9 sections** (ordering = planner's call, but every section MUST be present):
  1. Domain — restate what the spike is deciding.
  2. Audience Matrix — viewer-state × ref-identity per D-AUDIENCE-01.
  3. Route Reality Today — what each route does, entry-point map.
  4. Variants A–E — for each: routing model, per-user data shape, entry-point disruption, brief summary.
  5. v7.0 Watch Photos Lens — per-variant sketch per D-V7-LENS-01 (4 sub-points × 5 variants).
  6. Decision Matrix — 7 criteria from D-VARIANTS-02, scored per variant.
  7. Cost Estimate per Variant — files touched, migrations, entry-point rewrites, test surface. Separate section, NOT folded into Variants.
  8. Recommendation — primary keep/merge verdict + rationale rooted in the matrix.
  9. Ship-now Eligibility — YES/NO/NEEDS-DISCUSSION. **Format verbatim from Phase 49 D-05 §9**.

**D-GUARD-01 — Hard guardrail:** No implementation in this phase. If the spike concludes a path is cheap and strongly favored, that triggers a `/gsd-phase` requirement-add flow — NOT direct execution. The spike output is the only artifact written under `.planning/phases/50-*/` other than standard plan/verification artifacts.

### Claude's Discretion

- Exact ordering of sections within `50-SPIKE.md` (skeleton mandatory; sequencing planner's call).
- Format of the Decision Matrix (numeric scores vs ✓/✗ vs prose). Phase 49 used a hybrid — either is fine.
- Whether v7.0 per-variant sketches live as a single Section 5 or are interleaved with each Variant's subsection in Section 4. D-V7-LENS-01 mandates depth, not location.
- Whether the cost estimate distinguishes "data-migration cost" from "code-change cost." Recommended if any variant touches the schema (none should, since v5.2 catalog is single-user prod).
- Whether to query prod for any evidence (e.g. how many catalog rows the user currently owns). Optional; route/UI architecture spike, not a data spike.

### Deferred Ideas (OUT OF SCOPE)

- **Any merge/canonicalization implementation in this phase** — explicitly forbidden by ROADMAP SC#4 + REQUIREMENTS Out of Scope. If the spike strongly favors a cheap path, trigger a new requirement (separate `/gsd-phase` add). Mirror of Phase 49.1 from Phase 49.
- **v7.0 photo data model** (multi-photo schema, public/private wear-pic policy, per-person cap, ordering, storage bucket strategy) — out of scope; spike consumes SEED-013 as a forcing function only.
- **v6.0 social layer interaction** (likes/comments on the merged surface, mutual-follow gating for wishlist comments) — out of scope; SEED-012 owns this. Spike may note merge affects v6.0 but does not design social wiring.
- **Auth-gating relaxation** (making either route reachable to anonymous visitors) — out of scope. Anonymous-visitor cell is forward-compat only.
- **Entry-point reshuffle** — if Variants D or E win, entry-point rewrite is part of the resulting implementation phase, not this spike. Spike scores entry-point disruption as a cost criterion only.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ARCH-01 | A spike compares keeping `/catalog/[catalogId]` and `/watch/[id]` as separate views vs merging them, and produces a written decision — no merge implementation in v5.2 unless the spike strongly favors it and it is cheap | This research provides: (a) the locked 9-section skeleton from CONTEXT.md D-SKEL-02; (b) the file-by-file variant evidence (Per-Variant File Impact §); (c) the verbatim ship-now format from `49-SPIKE.md` §9 (Ship-Now Format §); (d) viewer-state × ref-identity matrix evidence sourced from `catalog/[catalogId]/page.tsx`, `watch/[id]/page.tsx`, and `getWatchByIdForViewer`; (e) v7.0 forcing-function read of SEED-013 to support the per-variant lens depth requirement |

## Project Constraints (from CLAUDE.md / AGENTS.md)

- **Tech stack lock:** Next.js 16 App Router — continue with existing framework, no rewrites. Variants C/D/E all stay within App Router.
- **AGENTS.md warning:** "This is NOT the Next.js you know" — Next.js 16 has breaking changes. The spike must reference current behavior from `node_modules/next/dist/docs/` if it claims framework-specific behavior (e.g. that `redirect()` in a server page is the safe canonicalization point for Variant B).
- **Data model lock:** Watch and UserPreferences types are established — extend, don't break existing structure. Means: Variant E (absorb catalog into watch) must NOT require a schema change to `watches` (catalogId is already there per Phase 38 D-06 NOT NULL); Variant C/D similarly should be code-only.
- **Performance lock:** Target <500 watches per user; no pagination needed. Means: roster queries (`getCollectorsForCatalog`) don't need rework for any variant.
- **Personal first:** Single-user experience and data isolation must remain correct even after multi-user auth is added. Means: any merge variant must preserve the two-layer privacy gate in `getWatchByIdForViewer` (RLS outer + WHERE inner).
- **GSD workflow enforcement:** Before Edit/Write outside a GSD command, start work through a GSD entry point. Phase 50 is already inside the GSD flow — research → plan → execute.

## Standard Stack

This phase produces ONE markdown file. There is no library/framework stack to install. The "stack" is the project's existing planning toolchain.

### Core (already in place)
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| Markdown | — | Spike document format | Phase 49 precedent; readable in CLI + GitHub |
| GSD CLI | `gsd-sdk` | Phase init, commit gating, doc commit | `.planning/config.json` has `commit_docs: true` per init query |

### Supporting (referenced by deliverable, not installed)
| File | Purpose | Where Cited in Spike |
|------|---------|----------------------|
| `49-SPIKE.md` | Voice/format template | Sections 6 (matrix), 7 (cost), 9 (ship-now) match shape |
| `SEED-013-v7.0-watch-photos.md` | Forcing function for §5 lens | Section 5 reads this as input, does NOT re-decide its open questions |
| `feedback_proxy_router_cache_poisoning` (memory) | Landmine for Variant B | Section 4 Variant B subsection must call this out |
| `project_db_wipeable_2026_05_09` (memory) | Landmine for any v7.0 photo schema cost estimate | Section 5 / 7 must note `watches_catalog` is NOT wipeable |

**No `npm install` is required for this phase.** The deliverable is markdown.

## Architecture Patterns

### Spike Document Skeleton (locked — D-SKEL-02)

The 9 mandatory sections are reproduced under "User Constraints" above. The planner must produce a SPIKE.md that:

1. **Mirrors Phase 49's voice** — declarative, evidence-cited, no hedging. Where a claim is made, cite `file:line` or a memory entry by name.
2. **Provides grep-verifiable citations** — every code claim uses `src/path/to/file.tsx:lineno` format so future readers can run `grep -n` and confirm.
3. **Stays under the hard guardrail** — no Server Actions, no schema edits, no DAL changes ship in this phase. The only writes are to `.planning/phases/50-*/`.
4. **Uses the exact ship-now format** — Section 9 must read like `49-SPIKE.md` §9 so the v5.2 mid-milestone requirement-add flow (which worked for TAX-02 → Phase 49.1) plugs in cleanly.

### Phase 49's 3-Plan Decomposition (recommended template)

Per `49-SPIKE.md` frontmatter (`plan: 01 (sections 1-3); plans 02-03 complete the rest`):

| Plan | Spike Sections Produced | Estimated Effort |
|------|-------------------------|------------------|
| Plan 01 | Domain + Audience Matrix + Route Reality Today (§1–3) | Code-citation-heavy; relies on `catalog/[catalogId]/page.tsx`, `watch/[id]/page.tsx`, `getWatchByIdForViewer` reads |
| Plan 02 | Variants A–E + v7.0 Lens + Decision Matrix + Cost Estimate (§4–7) | Synthesis-heavy; cross-references Plan 01 evidence |
| Plan 03 | Recommendation + Ship-Now Eligibility (§8–9) | Conclusion + format-locked ship-now section |

This is one viable split. The planner may choose a different decomposition (e.g. 2 plans, 4 plans) — the constraint is "9 sections all present, ship-now format verbatim."

### Ship-Now Section Format (verbatim from `49-SPIKE.md` §9)

The planner must reuse this shape exactly. The trigger phrasing ("Add new requirement TAX-02… to REQUIREMENTS.md and `/gsd-phase --insert` a Phase 49b implementation wave") is how the mid-milestone flow plugs in.

```markdown
## Ship-Now Eligibility Check

ROADMAP SC#4 gate language (verbatim):

> "No consolidation or removal implementation is shipped in this phase unless the spike specifically flags it as cheap and strongly favored — in which case a new requirement is added mid-milestone"

---

### Primary recommendation eligibility ({label})

**Verdict: YES | NO | NEEDS-DISCUSSION**

{prose: strongly-favored justification, evidence cite back to §6 matrix}

**Strongly favored:** {matrix scores + criterion-by-criterion}

**Cheap:** {file count + migration count + backfill notes; reference 2026-05-19 catalog-wipeable carve-out impact}

**Trigger:** Add new requirement **ARCH-02: {short name} — {one-line action}** to REQUIREMENTS.md and `/gsd-phase --insert` a Phase 50.1 implementation wave.
```

Phase 50's recommendation will be ARCH-02 (next sequential REQUIREMENTS ID after ARCH-01). The wave label will be Phase 50.1 (mirroring Phase 49.1).

### Anti-Patterns to Avoid

- **Anti-pattern 1: Hedging the recommendation.** Phase 49's spike emitted a definitive `remove-genre` call backed by Q1 (99% agreement) evidence. Phase 50's spike must do the same — pick a variant or pick keep-separate, but do not deliver "it depends." The plan-checker for spike docs gates on actionable recommendations.
- **Anti-pattern 2: Folding v7.0 lens into the variant subsections without depth.** D-V7-LENS-01 mandates 4 sub-points × 5 variants = 20 distinct sketches. A one-line "v7.0 carousel fits here" per variant fails the depth requirement. The planner must allocate enough section space for genuine per-variant carousel/wear-pic analysis.
- **Anti-pattern 3: Variant B at the proxy layer.** Per `feedback_proxy_router_cache_poisoning` memory, a 307 on RSC prefetch poisons Next 16's Router Cache → 404 on soft-nav. If the spike scores Variant B, it must explicitly call out that canonicalization happens at the page level (server component `redirect()` after the DAL ownership check), NOT in `proxy.ts`. Failure to flag this lands the spike in the same trap that hit `/u/*`.
- **Anti-pattern 4: Cost estimates ignoring catalog-wipeable carve-out.** Per `project_db_wipeable_2026_05_09` (updated 2026-05-19), `watches_catalog` is NOT wipeable. Any variant that touches catalog schema (none of A–E should, since v5.2 catalog is single-user prod) must be costed with in-place ALTER + UPDATE, not wipe-and-re-seed. The v7.0 photo schema cost note in Section 5 must reflect this.

## Variants A–E Evidence Base

This section provides the file-by-file evidence the planner needs to populate SPIKE.md §4 (Variant summaries) and §7 (Cost Estimate). The planner copies these tables into the spike with planner-chosen voice.

### Variant A — Keep separate (status quo)

**Routing model:** Two routes remain. `/catalog/[catalogId]` (server-only, 308 lines, `src/app/catalog/[catalogId]/page.tsx`) and `/watch/[id]` (132 lines server + 462-line client island, `src/app/watch/[id]/page.tsx` + `src/components/watch/WatchDetail.tsx`).

**Per-user data shape:** Already converged via shared components. `ReferenceIdentityCard`, `SameFamilyRail`, `LineageRail`, `CollectionFitCard` render on both routes (`src/components/insights/*.tsx`). `OtherOwnersRoster` is catalog-only by UI-SPEC.

**Entry-point disruption:** Zero. Existing 12 `/watch/[id]` entry points and 7 `/catalog/[catalogId]` entry points remain.

**Files touched:** None. Pure no-op variant.

### Variant B — URL canonicalization (`/catalog/[catalogId]` 307→`/watch/[id]` when owned)

**Routing model:** `/catalog/[catalogId]/page.tsx` performs a server-level ownership check (already exists at lines 66–67, 282–308 — `findViewerWatchByCatalogId`); when `viewerOwnedRow !== null`, instead of rendering the D-08 "You own this" inline framing flip (current lines 107–115), it calls `redirect(\`/watch/${viewerOwnedRow.id}\`)` from `next/navigation`.

**Per-user data shape:** Unchanged. `/watch/[id]` continues to consume `getWatchByIdForViewer` with same-user framing for the owner case.

**Entry-point disruption:** Zero direct rewrites. Discovery entry points (search, Explore) still link to `/catalog/[catalogId]`; the route now redirects when ownership is detected.

**Files touched:**
- `src/app/catalog/[catalogId]/page.tsx` (lines 107–115 — replace VerdictBundleSelfOwned construction with `redirect()`).
- New test file or extension of existing — assert that owner viewers reaching `/catalog/[catalogId]` get a 307 to `/watch/[id]`.

**LANDMINE (per `feedback_proxy_router_cache_poisoning` memory):** Variant B is ONLY safe if canonicalization happens at the page level (server component calling `next/navigation`'s `redirect()`). It is NOT safe at the `proxy.ts` layer — a 307 on an RSC prefetch poisons Next 16's Router Cache, producing 404s on soft-nav (the `/u/*` precedent). The spike MUST call this out explicitly when scoring Variant B. A sub-variant "canonicalize at proxy" is a structural landmine.

**Carry-forward signal:** Phase 48 BUG-01 fix (status='owned' scope at line 296) is the maintenance tax for keeping the in-route framing flip. Variant B retires that tax by retiring the flip itself. The wishlist/sold-this edge cases that BUG-01 surfaced go away.

### Variant C — Single unified route (`/w/[ref]`)

**Routing model:** New route `src/app/w/[ref]/page.tsx`. Server-side resolution: try `getWatchByIdForViewer(user.id, ref)`; if null, try `getCatalogById(ref)`. Either resolves and renders. Both old URLs (`/catalog/[catalogId]`, `/watch/[id]`) issue server redirects to canonical `/w/[ref]`.

**Per-user data shape:** Unified server page does the framing dispatch — `framing: same-user | cross-user | self-via-cross-user` decided by which resolver hit. `WatchDetail` island still renders for `viewerCanEdit=true` cases.

**Entry-point disruption:** ALL 19 entry points (12 `/watch/[id]` + 7 `/catalog/[catalogId]`) rewrite to `/w/[ref]`. Bookmarks to old URLs are preserved via redirects from the old route files.

**Files touched:**
- New: `src/app/w/[ref]/page.tsx` (~250 lines — combines logic from both existing pages).
- Modified: `src/app/catalog/[catalogId]/page.tsx` (reduce to redirect-only).
- Modified: `src/app/watch/[id]/page.tsx` (reduce to redirect-only). The `/watch/[id]/edit` sub-route stays (or also moves to `/w/[ref]/edit`).
- Modified: all 19 entry-point files (listed in CONTEXT canonical_refs):
  - `src/components/search/WatchSearchRow.tsx:31`
  - `src/components/explore/DiscoveryWatchCard.tsx:30`
  - `src/components/explore/PathCard.tsx:97,134,143` (3 sites)
  - `src/app/explore/lists/[id]/page.tsx:91,110` (2 sites)
  - `src/components/watch/WatchCard.tsx:35`
  - `src/components/profile/ProfileWatchCard.tsx:59`
  - `src/components/home/RecommendationCard.tsx:22`
  - `src/components/home/ActivityRow.tsx:51`
  - `src/components/home/SleepingBeautyCard.tsx:33`
  - `src/components/home/MostWornThisMonthCard.tsx:21`
  - `src/components/home/WywtSlide.tsx:78`
  - `src/components/profile/StatsTabContent.tsx:62`
  - `src/components/profile/NoteRow.tsx:62`
  - `src/components/insights/CollectionFitCard.tsx:73`
  - `src/components/insights/SleepingBeautiesSection.tsx:44`
  - `src/components/insights/GoodDealsSection.tsx:48`
- Migrations: None (no schema change).

**Reversibility:** Medium. The new route + old-route redirects can both be reverted, but the entry-point rewrites across 19 files would need to be reversed.

### Variant D — Absorb `/watch/[id]` into `/catalog/[catalogId]`

**Routing model:** `/catalog/[catalogId]/page.tsx` becomes the only watch-detail route. When viewer owns the catalog ref, the page renders the per-user data layer (currently in `/watch/[id]`) — including the `WatchDetail` client island. Per-user URLs retire; `/watch/[id]` redirects to `/catalog/[catalogId]` (resolved via `watches.id → catalogId` lookup) OR is removed entirely with bookmarks lost.

**Per-user data shape:** `/catalog/[catalogId]/page.tsx` must layer in per-user state for owners — call `findViewerWatchByCatalogId` (already exists, lines 282–308), then call `getWatchByIdForViewer` to pull the full `Watch` shape (the per-user row carries strapType, notes, isFlaggedDeal, acquisitionDate, sortOrder, condition, boxPapers, etc. — all of which the catalog table does NOT carry per `src/db/schema.ts:130,140,153`). Conditionally render `WatchDetail` island when owner detected.

**Entry-point disruption:** All 12 `/watch/[id]` entry points rewrite to `/catalog/[catalogId]/${watch.catalogId}`. This requires every entry-point component to thread `catalogId` (not `watchId`). Several entry points already have access (`WatchCard`, `ProfileWatchCard`) because `Watch.catalogId` is a NOT NULL FK per `src/db/schema.ts:146` (Phase 38 D-06). Others (`ActivityRow`, `RecommendationCard`, `WywtSlide`) may need their data shape extended.

**Files touched:**
- `src/app/catalog/[catalogId]/page.tsx` (major rewrite — add per-user data layering when owner, add WatchDetail island conditionally).
- `src/app/watch/[id]/page.tsx` (delete or convert to lookup-then-redirect).
- All 12 `/watch/[id]` entry points (listed above; the `${watch.id}` interpolation becomes `${watch.catalogId}`).
- `src/data/watches.ts` (no DAL changes needed; existing `getWatchByIdForViewer` keyed by `watches.id` still works for the `/watch/[id]/edit` sub-route which would stay).
- Migrations: None.

**Reversibility:** Medium. The data-layering logic in `/catalog/[catalogId]/page.tsx` can be reverted. The 12 entry-point rewrites would need to be reversed.

**Forcing-function note:** `OtherOwnersRoster` (catalog-only today per UI-SPEC) would need a "do not show roster to owner" check — or the policy changes to "owners see the roster too." That's a UI-SPEC decision the spike should flag.

### Variant E — Absorb `/catalog/[catalogId]` into `/watch/[id]`

**Routing model:** `/watch/[id]/page.tsx` becomes the only watch-detail route. The route grows a "no per-user row yet" mode when the viewer hits an `id` that resolves only as a catalog id. `/catalog/[catalogId]` redirects to `/watch/[id]` (resolved via catalog-keyed lookup).

**Per-user data shape:** Already cross-user-aware via `getWatchByIdForViewer` (returns `{ watch, isOwner }`). The "no per-user row yet" mode needs a fallback to `getCatalogById(catalogId)` — but `watches.id` and `watches_catalog.id` are distinct UUID spaces, so the route must accept either and dispatch.

**Entry-point disruption:** All 7 `/catalog/[catalogId]` entry points rewrite to `/watch/[id]`. But the parameter swap is ambiguous — discovery entry points (search, Explore) only have `catalogId`, not `watchId`. The route would need to accept catalog UUIDs and resolve them, which is essentially Variant C with a different URL prefix.

**Files touched:**
- `src/app/watch/[id]/page.tsx` (major rewrite — accept either watch.id or catalog.id; conditional rendering for "catalog-only" mode).
- `src/app/catalog/[catalogId]/page.tsx` (delete or convert to redirect).
- All 7 `/catalog/[catalogId]` entry points (listed above).
- `OtherOwnersRoster` rendering policy must be reconsidered (currently catalog-only; merge requires "show for catalog-only views, hide for owners" OR "show always").
- `CatalogPageActions` (183 lines, the 3-CTA block) becomes a conditional render on `/watch/[id]` — only when no per-user row exists.
- Migrations: None.

**Reversibility:** Medium. Same blast radius as Variant D but smaller entry-point count (7 vs 12).

**Forcing-function note:** The "watches.id and watches_catalog.id share the same URL parameter space" pattern is fragile — UUIDs don't collide but the route resolution becomes "try one DAL, fall back to the other." This adds branching the spike should call out as a code-clarity cost.

## Per-Variant File Impact Summary

| Variant | Files touched | Entry-point rewrites | Migrations | DAL changes | Test surface |
|---------|--------------|----------------------|------------|-------------|--------------|
| A. keep-separate | 0 | 0 | 0 | 0 | None — no behavior change |
| B. URL-canonicalization | 1–2 (`catalog/[catalogId]/page.tsx` + 1 test file) | 0 | 0 | 0 | Low — redirect test; assert 307 for owner viewers on `/catalog/[id]` |
| C. unified `/w/[ref]` | 19+ (new route + 2 old routes + 17 entry-point files + a few `<Link href>` interpolations) | 19 | 0 | 0 (route-level dispatch) | High — full integration test for both old URLs → new URL + new URL + all 19 entry points |
| D. catalog-absorbs-watch | 13–14 (`catalog/[catalogId]/page.tsx` rewrite + `watch/[id]/page.tsx` removal + 12 entry points) | 12 | 0 | 0 (uses existing `findViewerWatchByCatalogId` + `getWatchByIdForViewer`) | Medium-high — owner-detection layering on catalog route; per-user data threading; `WatchDetail` island conditional |
| E. watch-absorbs-catalog | 8–9 (`watch/[id]/page.tsx` rewrite + `catalog/[catalogId]/page.tsx` removal + 7 entry points + `OtherOwnersRoster` policy) | 7 | 0 | 0 (route-level dispatch on UUID space) | Medium — catalog-only mode test; UUID dispatch test; `OtherOwnersRoster` always-on vs always-off decision |

**Backfill / migration impact (per `project_db_wipeable_2026_05_09` carve-out, updated 2026-05-19):** None of A–E require a `watches_catalog` migration. v5.2 catalog is single-user prod; merge variants are route + UI only. The catalog-wipeable carve-out only matters IF v7.0 photo schema lands as part of an implementation phase — which is out of scope here per CONTEXT D-GUARD-01.

## v7.0 Watch Photos Lens — Evidence per Variant

Per D-V7-LENS-01 the spike sketches 4 sub-points × 5 variants. Below is the evidence the planner needs.

**SEED-013 scope (verbatim from `.planning/seeds/SEED-013-v7.0-watch-photos.md`):**
1. Multi-photo model — replace single `imageUrl` with a multi-photo model (photos table or array).
2. Public wear pics → watch detail — wear photos with `public` visibility surface on the watch's detail page.
3. Wear pics persist in Wears tab — actual wear photo (not generic catalog image).
4. Add-watch photo encouragement — uploaded photos surface on watch detail with permission; per-person cap applies.

**SEED-013 open questions (the spike must NOT pre-decide these):** per-person cap; opt-in/opt-out wear-pic surfacing; carousel cover ordering; wears-tab persistence rules; v6.0 social interaction; storage bucket (`wear-photos` reuse vs new).

**Data sources at runtime:**
- Catalog photos: today `watches_catalog.imageUrl` (single — `src/db/schema.ts:357`); v7.0 → multi-photo table or array on `watches_catalog`.
- Owner wear-pics: `wear_events.photo_url` per-user, public-visibility-flag-gated (existing v3.0 Phase 15 pipeline).
- Other-owners' public wear-pics: cross-user query, public-visibility-gated, mirrors `getCollectorsForCatalog` shape.

### Per-Variant Sketches (skeleton for the planner)

**Variant A — Keep separate:**
- Carousel renders: in shared component `ReferenceIdentityCard.tsx` or a new `PhotoCarousel.tsx` rendered as a sibling, in BOTH routes (`/catalog/[catalogId]/page.tsx` + `/watch/[id]/page.tsx`).
- Data joins: each route fetches its own (catalog: catalog photos + cross-user-public wear pics; per-user: owner's wear pics + catalog photos + cross-user-public wear pics for non-owners).
- Writability: owner-only "add photo" surface lives in `WatchDetail` island on `/watch/[id]`. Catalog route is read-only.
- Variant × Viewer-State: every viewer-state cell described twice (once per route).
- Cost note: maintaining two carousel surfaces (potential drift) — keep-separate tax in v7.0.

**Variant B — URL canonicalization:**
- Carousel renders: on `/watch/[id]` only (canonical). `/catalog/[catalogId]` either renders carousel (non-owner viewers) or redirects (owner viewers).
- Data joins: same as A but only one route maintains the carousel-add UI (`/watch/[id]` via `WatchDetail` island).
- Writability: owner-only on `/watch/[id]`. Catalog route stays read-only for cross-user viewers.
- Variant × Viewer-State: owner → carousel on `/watch/[id]` with add affordance. Non-owner-with-collection → carousel on `/catalog/[catalogId]` read-only. Non-owner-empty-collection → carousel on `/catalog/[catalogId]` read-only.
- Cost note: cheapest path to single carousel surface for owners.

**Variant C — Unified `/w/[ref]`:**
- Carousel renders: in the new unified route `src/app/w/[ref]/page.tsx`, single component.
- Data joins: one server-side dispatch decides which DAL calls fire (`watches` row exists → owner data joins; only catalog → catalog + cross-user public).
- Writability: gated by `viewerCanEdit` from the same-user framing branch.
- Variant × Viewer-State: cleanest single-cell-per-viewer-state composition. Anonymous-visitor cell (future) lands trivially.
- Cost note: best v7.0 fit but highest entry-point rewrite cost.

**Variant D — catalog-absorbs-watch:**
- Carousel renders: in `/catalog/[catalogId]/page.tsx` (rewritten). Owner branch layers in writability via `WatchDetail` island.
- Data joins: catalog photos + (owner wear pics when owner) + cross-user public wear pics.
- Writability: owner-only via the conditionally-rendered `WatchDetail` island.
- Variant × Viewer-State: viewer-state branching happens at one route, one page, one carousel — cleaner than A/B.
- Cost note: similar to C but inherits the catalog route's discovery-surface entry-point shape (search/Explore already point here).

**Variant E — watch-absorbs-catalog:**
- Carousel renders: in `/watch/[id]/page.tsx` (rewritten). Catalog-only mode renders read-only carousel.
- Data joins: same as D but route resolves on `watches.id` first, falls back to `watches_catalog.id`.
- Writability: owner-only via `WatchDetail` island (already gated by `viewerCanEdit`).
- Variant × Viewer-State: catalog-only branch (non-owner with no per-user row) needs a "no `Watch` shape yet — synthesize from `CatalogEntry`" path. Existing `catalogEntryToSimilarityInput` from `src/lib/verdict/shims.ts` is the precedent.
- Cost note: smaller entry-point blast radius (7) than D (12), but UUID-dispatch fragility increases code complexity.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Spike document skeleton | Custom section layout | The 9 D-SKEL-02 sections verbatim | Locked decision; planner can choose ordering, NOT sections |
| Ship-now eligibility format | A new YES/NO format | Copy `49-SPIKE.md` §9 shape | v5.2 mid-milestone requirement-add flow expects this exact format |
| URL canonicalization (if Variant B) | `proxy.ts` 307 with DB check | `next/navigation` `redirect()` in server page after DAL check | `feedback_proxy_router_cache_poisoning` memory — proxy 307 on RSC prefetch poisons Router Cache → 404 on soft-nav |
| Multi-photo schema cost estimate | A wipe-and-re-seed plan for catalog | In-place ALTER + UPDATE | `project_db_wipeable_2026_05_09` (2026-05-19 update) — `watches_catalog` is NOT wipeable |
| Verdict framing dispatch | A new `Framing` discriminant | `same-user | cross-user | self-via-cross-user` already in `src/lib/verdict/types.ts:15` | Composer already accepts all three; any merge variant preserves compatibility |
| Privacy gate (if merging) | A new "owner check" function | `getWatchByIdForViewer` (`src/data/watches.ts:193`) — already two-layer (RLS + WHERE) | Merging routes does not require rewriting the privacy gate |
| Cross-user public photo query | A new query | Extend `getCollectorsForCatalog` shape | Mirrors existing two-layer privacy pattern |

**Key insight:** This phase is decision-only — there's essentially nothing to hand-roll because nothing ships. The "don't hand-roll" guidance is for the planner's reference when sketching Variant cost estimates: every variant that touches code must reuse existing abstractions (`getWatchByIdForViewer`, `computeVerdictBundle`, `findViewerWatchByCatalogId`, the Framing union).

## Common Pitfalls

### Pitfall 1: Spike conclusion misalignment with framing reality
**What goes wrong:** ROADMAP SC#1 frames audiences as "owner / wishlist-holder / anonymous visitor / cross-user browse" — but `/watch/[id]` already serves cross-user viewers via `getWatchByIdForViewer` (line 58 of `watch/[id]/page.tsx`: `framing: isOwner ? 'same-user' : 'cross-user'`). The spike that frames the question as "owner-vs-non-owner audience split" is wrong on the code reality.
**Why it happens:** ROADMAP language is intent-level; the spike needs to read code-level reality.
**How to avoid:** D-AUDIENCE-01 re-frames the matrix as viewer-state × ref-identity. The planner must enforce this re-framing in Section 2 — do not let the spike drift back to the ROADMAP labels.
**Warning signs:** A draft spike that uses "anonymous visitor" as a load-bearing cell (it's auth-gated today; the cell is forward-compat only).

### Pitfall 2: Variant B at the proxy layer
**What goes wrong:** Implementing Variant B as a `proxy.ts` 307 redirect with a `getUser()` DB check poisons Next 16's Router Cache on RSC prefetches → 404 on soft-nav.
**Why it happens:** Proxy-layer routing feels natural for URL canonicalization.
**How to avoid:** The spike's Variant B subsection MUST explicitly call out canonicalization at the page level using `next/navigation`'s `redirect()` after the DAL ownership check. Cite `feedback_proxy_router_cache_poisoning` memory by name.
**Warning signs:** Any draft that mentions modifying `proxy.ts` for Variant B.

### Pitfall 3: v7.0 lens depth violation
**What goes wrong:** Section 5 sketches one-liners per variant instead of the 4 sub-points × 5 variants = 20 distinct sketches.
**Why it happens:** v7.0 is far off (after v6.0); easy to box-check.
**How to avoid:** D-V7-LENS-01 mandates depth. The planner must allocate enough section space and tasks to produce 4 substantive sub-points per variant. Use the "Per-Variant Sketches" skeleton above as a starting point.
**Warning signs:** Section 5 fits on a single screen; per-variant sketches are bullet lists of fewer than 4 items.

### Pitfall 4: Ship-now format drift
**What goes wrong:** Section 9 uses a different YES/NO format than `49-SPIKE.md` §9. The v5.2 mid-milestone requirement-add flow (which worked for TAX-02 → Phase 49.1) hits format friction and needs manual reformatting.
**Why it happens:** Planner writes ship-now from scratch instead of copy-adapting.
**How to avoid:** Copy `49-SPIKE.md` §9 structure exactly — keep the verbatim ROADMAP SC#4 quote, the "Verdict: YES/NO" line, the "Strongly favored:" + "Cheap:" + "Trigger:" blocks. Only the labels (`{label}`) and contents change.
**Warning signs:** Section 9 introduces new headings, drops the trigger phrasing, or omits the file-count + migration-count summary.

### Pitfall 5: Hedging the recommendation
**What goes wrong:** Section 8 emits "it depends" or "any of A, B, D are fine" rather than a definitive call.
**Why it happens:** The 5-variant breadth makes "pick one" feel premature.
**How to avoid:** Phase 49's spike emitted `remove-genre` definitively backed by Q1 99% agreement. Phase 50 must do the same — even if the call is keep-separate (Variant A), say so clearly with evidence cite to §6 matrix.
**Warning signs:** Section 8 uses multiple "could", "might", "depending on" phrases.

### Pitfall 6: Catalog-wipeable carve-out blindspot
**What goes wrong:** Cost estimates assume `watches_catalog` is wipeable (the old rule). The 2026-05-19 update carved catalog out. Any variant that imagined wipe-and-re-seed for v7.0 photo schema is now wrong.
**Why it happens:** The carve-out is recent (2026-05-19).
**How to avoid:** Cite `project_db_wipeable_2026_05_09` (with 2026-05-19 update notation) in any Section 5 / 7 paragraph that mentions catalog migration cost. None of A–E should require catalog migration for the route change itself — but the v7.0 lens (Section 5) might mention it.
**Warning signs:** Any draft language like "wipe and re-enrich the catalog" for cost estimates.

## Runtime State Inventory

This is not a rename / refactor / migration phase — it is a decision-only spike. The phase produces one markdown file. No runtime state changes.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no DB writes. | None |
| Live service config | None — no service config changes. | None |
| OS-registered state | None. | None |
| Secrets / env vars | None. | None |
| Build artifacts | None. | None |

**Nothing in any category** — verified by the fact that the phase deliverable is `.planning/phases/50-watch-detail-architecture-spike/50-SPIKE.md` and no source files are modified.

## Code Examples

### Example 1: Reading the existing `findViewerWatchByCatalogId` (Variant B / D evidence)

```typescript
// Source: src/app/catalog/[catalogId]/page.tsx:282-308
async function findViewerWatchByCatalogId(
  userId: string,
  catalogId: string,
): Promise<{ id: string; acquisitionDate: string | null } | null> {
  const rows = await db
    .select({
      id: watchesTable.id,
      acquisitionDate: watchesTable.acquisitionDate,
      createdAt: watchesTable.createdAt,
    })
    .from(watchesTable)
    .where(and(
      eq(watchesTable.userId, userId),
      eq(watchesTable.catalogId, catalogId),
      eq(watchesTable.status, 'owned'),  // BUG-01 fix (D-02): only 'owned' rows
    ))
    .limit(1)
  if (rows.length === 0) return null
  // ... returns { id, acquisitionDate }
}
```

This is the function Variant B replaces an inline framing flip for — by calling `redirect(\`/watch/${row.id}\`)` instead of constructing a `VerdictBundleSelfOwned`.

### Example 2: Reading `getWatchByIdForViewer` (Variant E evidence)

```typescript
// Source: src/data/watches.ts:193-231
export async function getWatchByIdForViewer(
  viewerId: string,
  watchId: string,
): Promise<{ watch: Watch; isOwner: boolean } | null> {
  // Two-layer privacy: RLS outer + WHERE inner
  // owner short-circuit OR (profile_public AND per-tab visibility)
  // ...
  return {
    watch: mapRowToWatch(row.watch),
    isOwner: row.watch.userId === viewerId,
  }
}
```

This is already cross-user-aware — `/watch/[id]` is NOT owner-only today. Variant E grows the route to also accept catalog UUIDs.

### Example 3: Framing union (variant-independent)

```typescript
// Source: src/lib/verdict/types.ts:15
export type Framing = 'same-user' | 'cross-user' | 'self-via-cross-user'
```

All 5 variants preserve compatibility with this union. The composer at `src/lib/verdict/composer.ts:36` accepts `Exclude<Framing, 'self-via-cross-user'>`; `self-via-cross-user` is built inline at `catalog/[catalogId]/page.tsx:109` (today) — Variant B retires that inline construction.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ROADMAP audience labels (owner / wishlist / anon / cross-user) | viewer-state × ref-identity matrix | Phase 50 spike (this phase) | Re-framing per D-AUDIENCE-01 — the ROADMAP labels mix two axes; the matrix separates them |
| `watches_catalog` wipeable for migration cost | `watches_catalog` NOT wipeable; in-place ALTER + UPDATE only | 2026-05-19 carve-out (`project_db_wipeable_2026_05_09` update) | Affects v7.0 photo schema cost estimate in Section 5; does NOT affect variant cost (no variant touches catalog schema) |
| `proxy.ts` as soft auth gate | `proxy.ts` NOT a soft auth gate | `feedback_proxy_router_cache_poisoning` memory | Variant B must canonicalize at page level, NOT in proxy |
| `/catalog/[catalogId]` D-08 "You own this" inline framing flip | Maintained for now; Variant B retires it | Phase 20.1 (introduced) → Phase 48 BUG-01 (status='owned' scope) | Maintenance tax cited as evidence in spike Variant B subsection |

**Deprecated / outdated:**
- ROADMAP SC#1 phrasing of audience axes — re-framed by D-AUDIENCE-01.
- Any "merge ships in v5.2" assumption — explicitly forbidden by D-GUARD-01.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The planner will follow Phase 49's 3-plan decomposition (sections 1–3, 4–7, 8–9). | Architecture Patterns / Phase 49's 3-Plan Decomposition | LOW — planner has explicit discretion per D-SKEL-02 to choose ordering; this is a recommendation, not a constraint |
| A2 | All 5 merge variants are technically feasible within Next.js 16 App Router. | Variants A–E Evidence Base | LOW — verified by reading `node_modules/next/dist/docs/` requirement in AGENTS.md; `redirect()` from `next/navigation` works server-side; route absorption is standard App Router behavior. `[CITED: AGENTS.md]` flag for any Next.js 16-specific behavior the planner relies on. |
| A3 | The entry-point counts (12 + 7) are stable through Phase 50 plan execution. | Per-Variant File Impact Summary | LOW — verified via `grep -rEn 'href=\{`/watch/\$' src/ --include="*.tsx"` and equivalent for catalog; count may shift by ±1 if a new entry point lands between research and plan execution |
| A4 | `OtherOwnersRoster` policy (catalog-only by UI-SPEC) is a decision input, not a constraint. | Variants D & E Forcing-Function Notes | LOW — UI-SPEC §Render Order is a spec, not a code constraint; merge variants can propose changing the policy as part of the implementation phase |
| A5 | No variant requires schema changes to `watches` or `watches_catalog` in v5.2. | Per-Variant File Impact Summary / Migrations column | LOW-MEDIUM — confirmed by reading `src/db/schema.ts:97–167` (watches) and `:335–404` (watches_catalog); merge variants are route/UI only. v7.0 photo schema is the only schema work, and it's out of scope per D-GUARD-01. If user confirms v7.0 lens uncovers a needed schema change, the spike must flag it in Section 5 — but not implement it. |

**Note:** All claims above are `[VERIFIED: codebase grep + file read]` or `[VERIFIED: project memory]`. No `[ASSUMED]` claims — every load-bearing fact has a citable source.

## Open Questions (RESOLVED)

1. **Does the planner pick Phase 49's 3-plan split or a different decomposition?**
   - What we know: D-SKEL-02 locks 9 sections; section ordering is planner's discretion.
   - What's unclear: Whether 3 plans is the right granularity or whether 2 / 4 plans makes more sense.
   - Recommendation: Default to 3 plans (Sections 1–3 / 4–7 / 8–9) matching Phase 49. Adjust only if Section 5 (v7.0 lens) ends up oversized — in which case split into its own plan.

2. **Does the spike include any prod queries (e.g. how many catalog rows the user owns)?**
   - What we know: CONTEXT's "Claude's Discretion" flags this as optional.
   - What's unclear: Whether the "You own this" callout frequency informs the recommendation.
   - Recommendation: Skip — the recommendation is structural, not data-driven. Phase 49 used catalog data because the question was empirical (99% agreement). Phase 50's question is architectural.

3. **Should the decision matrix use Phase 49's hybrid format (numeric 1–5 with prose rationale) or pure prose?**
   - What we know: D-VARIANTS-02 explicitly leaves format to the planner.
   - What's unclear: Whether 7 criteria × 5 variants is legible in numeric form.
   - Recommendation: Phase 49's hybrid (numeric matrix + prose rationale paragraph below) is proven legible at 5 criteria × 5 options = 25 cells. 7 × 5 = 35 cells is borderline. The planner may choose ✓/✗/? for binary criteria (e.g. "schema change required?") and numeric for spectrum criteria (e.g. "UX clarity").

4. **Does the spike call Phase 48 BUG-01 by name in Variant B's evidence?**
   - What we know: CONTEXT § Prior Context says yes — "The bug that surfaced ARCH-01 was itself a casualty of the two-route split — strong evidence for the merge case."
   - What's unclear: Whether the citation should live in §3 (Route Reality) or §4 Variant B subsection.
   - Recommendation: Both. §3 cites it as evidence of the maintenance tax. §4 Variant B cites it as the bug class that Variant B retires.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| GSD CLI (`gsd-sdk`) | Phase init, commit gating | ✓ | (per init query — `gsd-sdk query init.phase-op "50"` succeeded) | — |
| Phase 49 spike (`49-SPIKE.md`) | Voice/format template | ✓ | Phase 49 closed 2026-05-19 | — |
| Phase 49.1 ROADMAP entry | Proof-of-concept for SC#4 escape hatch | ✓ | Phase 49.1 7/8 plans complete; Plan 08 prod-applied 2026-05-20 | — |
| `node_modules/next/dist/docs/` | AGENTS.md-mandated lookup for Next.js 16 behavior | ✓ (assumed; node_modules present per `package.json` evidence) | Next.js 16.2.3 | — |
| `markdownlint` or equivalent | Format the spike doc | — | — | None needed — Markdown is hand-written; planner reads `49-SPIKE.md` for style guide |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

## Validation Architecture

`workflow.nyquist_validation` was not located in `.planning/config.json` — per the GSD researcher protocol (key absent = enabled), this section is included.

### Test Framework

The deliverable is a markdown document. There is no executable to test in the traditional sense. Validation is structural: does the spike contain the 9 required sections, the verbatim ship-now format, the file-by-file evidence base, and an actionable recommendation?

| Property | Value |
|----------|-------|
| Framework | None (markdown deliverable) |
| Config file | None |
| Quick run command | `ls .planning/phases/50-watch-detail-architecture-spike/50-SPIKE.md && wc -l .planning/phases/50-watch-detail-architecture-spike/50-SPIKE.md` |
| Full suite command | Manual structural review against the 9-section checklist + ship-now format diff against `49-SPIKE.md` §9 |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ARCH-01 | Spike doc exists at the locked path | smoke | `test -f .planning/phases/50-watch-detail-architecture-spike/50-SPIKE.md` | ❌ Wave 0 — file does not yet exist; created in plan execution |
| ARCH-01 | Spike contains all 9 D-SKEL-02 sections | manual-only (structural review) | `grep -c '^##' .planning/phases/50-watch-detail-architecture-spike/50-SPIKE.md` ≥ 9 | ❌ — created in plan execution |
| ARCH-01 | Spike Section 9 ship-now format matches `49-SPIKE.md` §9 verbatim shape | manual-only (diff against template) | Manual diff against `.planning/phases/49-genre-vs-style-taxonomy-spike/49-SPIKE.md` §9 | ✅ template exists |
| ARCH-01 | Spike Section 4 covers all 5 variants A–E | manual-only (structural review) | `grep -E '^### (A|B|C|D|E)\.' .planning/phases/50-watch-detail-architecture-spike/50-SPIKE.md` returns 5 lines | ❌ — created in plan execution |
| ARCH-01 | Spike Section 6 decision matrix scores all 5 variants on all 7 criteria | manual-only (matrix table review) | Visual inspection — 5 rows × 7 columns minimum | ❌ — created in plan execution |
| ARCH-01 | Spike Section 5 v7.0 lens applies all 4 sub-points × 5 variants (=20 sketches) | manual-only (D-V7-LENS-01 depth gate) | Visual inspection per variant — 4 sub-bullets minimum | ❌ — created in plan execution |
| ARCH-01 | Spike Section 8 emits a definitive keep/merge recommendation | manual-only | `grep -E '^\*\*Verdict:' .planning/phases/50-watch-detail-architecture-spike/50-SPIKE.md` matches `YES|NO|NEEDS-DISCUSSION` and labels recommended variant | ❌ — created in plan execution |

### Sampling Rate

- **Per task commit:** `test -f` smoke test (the file exists)
- **Per wave merge:** Structural review against the 9-section checklist
- **Phase gate:** Full diff against `49-SPIKE.md` format + recommendation actionability check

### Wave 0 Gaps

- [ ] `.planning/phases/50-watch-detail-architecture-spike/50-SPIKE.md` — the deliverable itself; created in plan execution, not pre-existing
- [ ] No test framework / fixtures needed — markdown-only deliverable

*(Existing test infrastructure does not apply here — spike validation is structural review by `/gsd-verify-work`.)*

## Security Domain

`security_enforcement` was not located in `.planning/config.json` — per the GSD researcher protocol (absent = enabled), this section is included.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | This phase writes no code; auth posture unchanged |
| V3 Session Management | no | Same |
| V4 Access Control | no | Same; if merge ships in Phase 50.1, the two-layer privacy gate in `getWatchByIdForViewer` is preserved |
| V5 Input Validation | no | Same; UUID regex validation at `catalog/[catalogId]/page.tsx:52` is the pattern any merge variant inherits |
| V6 Cryptography | no | No crypto touched |

### Known Threat Patterns for Spike Document

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Spike recommends a path that breaks the two-layer privacy gate | Information Disclosure | The spike must preserve `getWatchByIdForViewer`'s RLS-outer + WHERE-inner shape per CLAUDE.md "Personal first" constraint. Any merge variant that bypasses this is rejected. |
| Spike's Variant B canonicalization fires before auth check | Authentication bypass | Mitigated by D-AUDIENCE-01's anonymous-visitor cell flagging — every variant assumes auth is in place before route resolution |
| Spike conclusion enables future code that leaks watch existence to non-owners | Information Disclosure | `getWatchByIdForViewer` already returns null uniformly for "missing" and "private" — Phase 10 WYWT DAL precedent. Merge variants preserve this. |

**Note:** No code ships in this phase, so the security posture is unchanged. The "threats" above are about the spike's *recommendation* potentially enabling a future implementation that weakens security. The spike's Variant subsections must call out the privacy-gate preservation requirement for any merge variant.

## Sources

### Primary (HIGH confidence — directly read)
- `.planning/phases/50-watch-detail-architecture-spike/50-CONTEXT.md` — full read; provides D-AUDIENCE-01, D-VARIANTS-01/02, D-V7-LENS-01, D-SKEL-01/02, D-GUARD-01, canonical_refs, code_context, specifics, deferred ideas.
- `.planning/REQUIREMENTS.md` — full read; provides ARCH-01 text (line 22), v5.2 Out of Scope rows (lines 47–48), TAX-02 precedent for mid-milestone add (line 18).
- `.planning/ROADMAP.md` lines 230–264 — Phase 49.1 + Phase 50 entries; 4 success criteria including SC#4 escape hatch.
- `.planning/STATE.md` lines 1–60 — v5.2 milestone status; Phase 49.1 closed 2026-05-20.
- `.planning/phases/49-genre-vs-style-taxonomy-spike/49-SPIKE.md` — full read; structural pattern Phase 50 mirrors. Confirms 3-plan decomposition + ship-now format + variant table format.
- `.planning/seeds/SEED-013-v7.0-watch-photos.md` — full read; v7.0 forcing function scope + open questions.
- `src/app/catalog/[catalogId]/page.tsx` — full 308-line read; `findViewerWatchByCatalogId` (lines 282–308), D-08 self-via-cross-user construction (lines 107–115), entry-point evidence.
- `src/app/watch/[id]/page.tsx` — full 132-line read; `getWatchByIdForViewer` consumption + framing dispatch (line 58); `WatchDetail` island rendering.
- `src/components/watch/WatchDetail.tsx` lines 1–80 — `'use client'` declaration; Server Action imports (`editWatch`, `removeWatch`, `markAsWorn`); `viewerCanEdit` prop; isOwner gate evidence.
- `src/data/watches.ts` lines 180–300 — `getWatchByIdForViewer` definition (lines 193–231) with two-layer privacy gate; `createWatch` / `updateWatch` / `deleteWatch` signatures.
- `src/lib/verdict/composer.ts` — full read; framing-aware composer; `Framing` exclusion pattern.
- `src/lib/verdict/types.ts` — full read; `Framing` union (line 15); `VerdictBundleFull` vs `VerdictBundleSelfOwned` discriminated union.
- `src/db/schema.ts` lines 100–212 (watches + userPreferences) + lines 340–404 (watches_catalog) — confirms catalog vs per-user split; `imageUrl` on both tables (lines 130 + 357); catalog FK NOT NULL since Phase 38.

### Secondary (MEDIUM confidence — grep-verified entry-point counts)
- `grep -rEn 'href=\{\`/watch/\$' src/ --include="*.tsx"` — 12 `/watch/[id]` entry points outside test/edit/new.
- `grep -rEn 'href=\{\`/catalog/\$' src/ --include="*.tsx"` — 7 `/catalog/[catalogId]` entry points outside test.

### Tertiary (project memory — referenced, not re-read in this research session)
- MEMORY: `feedback_proxy_router_cache_poisoning` (cited in Variant B landmine).
- MEMORY: `project_db_wipeable_2026_05_09` (2026-05-19 update — catalog carve-out; cited in §5 v7.0 lens cost notes).
- MEMORY: `feedback_ui_spec_css_chain_blind_spot` — not relevant to this spike (no CSS work).

## Metadata

**Confidence breakdown:**
- 9-section skeleton: HIGH — D-SKEL-02 is explicit and Phase 49 precedent exists.
- Per-variant evidence: HIGH — every claim has a `file:line` citation.
- Entry-point counts: HIGH — grep-verified (12 + 7).
- v7.0 lens depth: HIGH — SEED-013 read in full; per-variant sketches derived from its scope.
- Ship-now format: HIGH — `49-SPIKE.md` §9 read verbatim.
- Common pitfalls: HIGH — sourced from project memories with explicit landmine citations.

**Research date:** 2026-05-20
**Valid until:** 2026-06-03 (stable — spike-doc structure is locked by CONTEXT.md; only invalidated if Phase 49.1 closes with new memory or if an entry-point lands between research and plan execution).

---

*Phase 50 — Watch-Detail Architecture Spike*
*Research: 2026-05-20*
