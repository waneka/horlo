# Project Research Summary

**Project:** Horlo — v5.1 Explore Page Redesign
**Domain:** Editorial CMS + catalog enrichment pipeline + taste-driven discovery surface
**Researched:** 2026-05-16
**Confidence:** HIGH (stack/architecture/pitfalls) / MEDIUM (features)

## Executive Summary

v5.1 adds a five-module `/explore` page (Hero, Collector Archetypes, Curated Lists Rail, Where Collections Go, Browse the Catalog) backed by an in-app admin CMS for content authoring. The existing stack handles everything: Next.js 16 App Router, Supabase Postgres + Storage + RLS, Drizzle ORM, `@base-ui/react` 1.3.0 (which already ships a Drawer primitive for swipe-to-dismiss), and Zustand. The only new runtime dependency is `react-markdown@^10.1.0` for rendering markdown intro copy and per-item commentary — no rich-text editor, no external CMS, no additional image processing. The deprecated `claude-sonnet-4-20250514` model ID in `src/lib/extractors/llm.ts` must be updated to `claude-sonnet-4-6` before June 15, 2026.

The recommended build order is: (1) Polish pass to fix existing UX bugs and set up avatar upload infrastructure, (2) Catalog Enrichment to fill taste columns before any discovery module can be validated, (3) CMS data model + admin authoring routes so editorial content can be created, (4) Explore shell + Browse + Archetypes (which need enrichment data), and (5) Curated Lists Rail + Hero + Where Collections Go (which need published CMS content). This ordering is driven by hard data dependencies: Archetypes produce empty results without enriched `primary_archetype` values, and the Hero cannot select a list without at least one published quality-gated list. Collapsing phases that share a dependency into the wrong order is the primary risk.

The dominant risk areas are: draft content leaking through a naive RLS copy-paste (CP-01), CMS Server Actions being callable by any authenticated user without the owner assertion (CP-02), the `backfill-taste.ts` script hitting silent rate-limit failures at 100-row scale (MP-04), and the Hero's `'use cache'` component not responding to manual pin changes because `revalidatePath` was used instead of `revalidateTag` (MP-07). All four have clear prevention strategies documented in PITFALLS.md. Security is the higher-priority concern — the RLS and Server Action patterns must be correct before any list is authored.

---

## Key Findings

### Recommended Stack

The entire v5.1 milestone is executable on the existing stack with one new dependency. `react-markdown@^10.1.0` replaces the need for any rich-text editor — it is a pure renderer (~11 kB gzip), React 19 compatible, and handles everything the CMS needs (bold, italic, links, paragraph breaks, lists). The `@base-ui/react/drawer` primitive already installed at v1.3.0 provides native swipe-to-dismiss for the filter bottom sheet — no `vaul` needed. Supabase Storage handles hero cover images and avatars via two new public buckets (`explore-covers`, `avatars`); the client-side EXIF-strip + canvas-resize pattern already in place covers upload. The Anthropic enrichment remains sequential via the existing `scripts/backfill-taste.ts` — the Batch API is overkill for ~100 rows.

**Core technologies:**
- `react-markdown@^10.1.0`: markdown rendering for CMS intro copy and per-item commentary — lightest viable renderer, no editor runtime
- `@base-ui/react/drawer` (already installed): swipe-to-dismiss for `sheet.tsx` — replaces Dialog primitive, public API unchanged
- Supabase Storage `explore-covers` + `avatars` buckets (new, public): hero cover and avatar serving without signed-URL expiry
- `claude-sonnet-4-6`: confirmed current Sonnet ID — update `src/lib/extractors/llm.ts` from deprecated `claude-sonnet-4-20250514` (retires June 15, 2026)
- `scripts/backfill-taste.ts` (extended): sequential enrichment with rate-limit retry, 800ms inter-row delay, per-row failure logging

**What NOT to add:** TipTap/Quill/Slate/Lexical, vaul, Sanity/Contentlayer, Supabase image transform loader (Pro Plan only), Sharp/Imgix/Cloudinary, Anthropic Batch API.

### Expected Features

Research validated the SEED-008 spec and surfaced meaningful gaps. All five modules are table stakes for an editorial discovery surface — none can be deferred without undermining the v5.1 value proposition.

**Must have (table stakes — all five modules core to the redesign):**
- Hero: single full-bleed image, title/subtitle overlay, quality gate (min 3 watches + cover + intro copy), graceful hide when empty
- Collector Archetypes: chip rail with 8 archetypes (Tool Watch Minimalist and Complication Hunter fill the two TBD slots), URL-state filter, non-empty result guarantee
- Curated Lists Rail: cover image, title, curator, watch count, per-item commentary on list detail; publish/draft states; up to 12 in rail
- Where Collections Go: seed (position 0) + up to 3 follow-ons, editorial rationale per path, 10 seed paths required before launch
- Browse the Catalog: brand/era/genre/price-band indices with counts; tap navigates to `/search` prefiltered; ISR 1h + `revalidateTag`
- Admin CMS: auth-gated `/admin/*` routes, list CRUD + watch picker, per-item commentary, draft/publish, hero pin

**Should have (differentiators not in current spec):**
- Curator name visible in hero (establishes editorial voice — Hodinkee byline model)
- `published_at` timestamp distinct from `created_at` on `curated_lists` (freshness signal on cards)
- `display_order` field + reorder UI on curated lists rail (editorial control over ordering)
- `rationale` text field on collection paths (without the "why," the path has no insight)
- Archetype chip watch count badge (sets expectation before tap; confirms non-empty)
- Alphabetical jump nav on Brand index (essential once brand count exceeds ~20)
- Optional expiry date on hero pin (prevents admin forgetting to unpin)
- Fixed editorial price bands: Under $500 / $500-2K / $2K-10K / $10K-50K / $50K+
- `path_type` label on collection paths (Gateway / Natural Upgrade / Lateral / Deep-Dive)

**Defer to v5.x:**
- UGC list submission (moderation overhead; SEED-008 explicitly defers to 500+ users)
- Rich text / Markdown preview mode (plain textarea ships in v5.1)
- Brand logos in Brand index (depends on brand imagery not yet sourced)
- "Add to wishlist" inline on list items (interaction design untested in this context)
- Social proof stats on paths ("42% of users who own X own Y") — misleading at current user count
- Auto-rotating hero carousel (NNG research: users see slide 1 only; rotation within session is an anti-pattern)

### Architecture Approach

v5.1 follows the nested `'use cache'` Server Component pattern already established by the existing `/explore` page. The page shell renders uncached to preserve viewer-dependent gating logic; each of the five modules is a separately-cached Server Component with its own `cacheTag`. Five new Postgres tables land in a single migration: `curated_lists`, `curated_list_items`, `collection_paths`, `collection_path_nodes`, and `cms_settings`. Two new public Supabase Storage buckets handle cover images and avatars. All CMS mutations are Server Actions (not new API routes), each with `assertOwner()` as their literal first statement. The sole API route (`POST /api/extract-watch`) remains unchanged.

**Major components:**
1. `ExplorePage` (Server Component, uncached) — 5-module composition + viewer gate
2. `HeroFeature` (`'use cache'`, weekly TTL, `cacheTag('explore:hero')`) — quality-gate auto-selection + manual-pin logic reading `cms_settings`
3. `CollectorArchetypes` (Server Component, no DB fetch) — hardcoded 8-archetype config, chip rail deep-linking to `/search`
4. `CuratedListsRail` (`'use cache'`, 5m TTL, `cacheTag('explore:lists')`) — up to 12 published lists
5. `CollectionPathsModule` (`'use cache'`, 1h TTL, `cacheTag('explore:paths')`) — 3 rotating published paths from 10-seed pool
6. `BrowseCatalogModule` (`'use cache'`, 1h TTL, `cacheTag('catalog:browse')`) — 4-facet entry points with cached counts
7. `AdminLayout` (Server Component, uncached) — owner gate via `OWNER_USER_ID` env var comparison
8. `src/app/actions/cms.ts` — all CMS Server Actions, owner-gated, call `revalidateTag` (never `revalidatePath`)
9. `src/data/cms.ts` and `src/data/browse.ts` — new DAL files with two-layer privacy (RLS + `WHERE status = 'published'`)
10. `scripts/backfill-taste.ts` (extended) — sequential enrichment with rate-limit retry + inter-row delay

**New route tree:** `/explore/lists/**`, `/explore/paths/**`, `/explore/brands`, `/explore/eras`, `/explore/genres`, `/explore/price-bands`, `/admin/lists/**`, `/admin/paths/**`

**FK shape decisions are load-bearing:** `curated_list_items.catalog_id` and `collection_path_nodes.catalog_id` both use `ON DELETE RESTRICT` — blocks catalog deletion when editorial content references it, preventing silent broken cards. `cms_settings.pinned_list_id` uses `ON DELETE SET NULL` so pin clears automatically if the list is deleted.

### Critical Pitfalls

1. **Draft RLS leak (CP-01)** — Copy-pasting `USING (true)` from catalog tables to `curated_lists` exposes all drafts to authenticated users. Fix: `USING (status = 'published')` for public reads + explicit `WHERE status = 'published'` in every DAL public-read function. Verify by querying as non-owner authenticated user.

2. **CMS Server Action auth bypass (CP-02)** — Owner check in `AdminLayout` alone is insufficient; Server Actions are HTTP-callable endpoints that bypass layout gates. Fix: `assertOwner()` as the literal first statement in every CMS Server Action. Test by calling `createCuratedList` as a non-owner user.

3. **Hero pin cache miss (MP-07)** — `setPinnedHero` calling `revalidatePath('/explore')` does not propagate to nested `'use cache'` components. Hero stays stale for up to 7 days. Fix: `revalidateTag('explore:hero')` in all four write paths: `setPinnedHero`, `clearPinnedHero`, `publishList`, `unpublishList`.

4. **Rate-limit silent failures in enrichment (MP-04)** — At 100 rows, the sequential backfill hits Anthropic RPM limits within ~2 minutes. The existing handler just increments `totalFailed`. Fix: 800ms inter-row delay + exponential backoff (2s/4s/8s) on `RateLimitError` + per-row `catalog_id` logging.

5. **Archetypes ship before catalog coverage validated (MP-09)** — If Archetypes module ships before `db:backfill-taste` runs in production, every archetype chip leads to zero results. Fix: catalog enrichment must run and be verified (`SELECT primary_archetype, count(*) GROUP BY ...`) before Archetypes phase ships to prod.

---

## Implications for Roadmap

Based on combined research, a 5-phase structure is recommended. Each phase has hard data prerequisites that make the ordering non-negotiable.

### Phase 1: Polish Pass

**Rationale:** Clears existing UX debt before new surfaces are added. Standalone work with no new DB tables — safe to do first while data model is being designed.
**Delivers:** Swipe-to-dismiss filter sheet (base-ui/drawer migration in `sheet.tsx`), wishlist card wear-UI gate (`status === 'owned'` guard), watch card fixed-height metadata, avatar upload (new `avatars` public bucket + `AvatarUpload` component + `ProfileSection.tsx`), model ID deprecation update in `llm.ts`.
**Addresses:** MP-03 (dismiss blocked during loading), MP-06 (avatar in wrong bucket), MP-08 (Turbopack stale CSS — clear `.next/` before confirming layout fixes).
**No research flag needed:** Standard refactor patterns; all technology decisions resolved in STACK.md.

### Phase 2: Catalog Enrichment

**Rationale:** Browse the Catalog indices and Collector Archetypes deep-links are both invalid until `primary_archetype`, `era_signal`, and taste attributes are populated in `watches_catalog`. Must complete and be verified in production before Phase 4 can ship.
**Delivers:** Extended `backfill-taste.ts` with rate-limit retry + 800ms delay + per-row logging; `--min-confidence-threshold` flag on `reenrich-taste.ts`; photo-existence pre-check; production backfill run + archetype coverage verification.
**Addresses:** CP-03 (force-reenrich overwrites high-confidence rows), CP-04 (LLM scope locked to taste columns only), MP-04 (rate-limit silent failures), MP-05 (vision-to-text flip on reenrich), MP-09 (Archetypes without catalog coverage).
**Hard constraint:** Do NOT expand LLM scope to factual spec columns (case_size_mm, movement_type, dial_color). Do NOT use `--force` on the prod reenrich run without confidence-threshold gating.
**No research flag needed:** Existing script is the right pattern; changes are additive.

### Phase 3: CMS Data Model + Admin Routes

**Rationale:** Curated Lists Rail and Hero modules need published content before they can be validated. Admin routes and the 5-table migration must land before any front-end editorial modules are built. 10 seed paths must be authored in admin before Where Collections Go can be validated.
**Delivers:** Single migration for all 5 new tables + RLS policies + enum types; `explore-covers` public bucket; `src/data/cms.ts` DAL; `src/app/actions/cms.ts` + `src/app/actions/paths.ts` Server Actions; `/admin/lists/**` and `/admin/paths/**` routes + CMS forms; initial 10 collection paths authored.
**Addresses:** CP-01 (draft RLS leak), CP-02 (Server Action auth bypass), CP-05 (catalog FK RESTRICT for list items and path nodes), CP-06 (SECDEF auto-grant — REVOKE from anon/authenticated on any DB functions added).
**Research flag:** Any Supabase SECURITY DEFINER functions added in this migration require explicit `REVOKE EXECUTE FROM anon, authenticated` — check against `project_supabase_secdef_grants.md` memory note before applying migration to prod.

### Phase 4: Explore Shell + Browse + Archetypes

**Rationale:** Explore shell is the container for all modules; Browse and Archetypes have the fewest editorial dependencies (no published CMS content needed). Requires Phase 2 (enrichment) verified in prod for non-empty archetype results.
**Delivers:** New `/explore` page shell (5-module grid, replaces existing 3-rail composition), `src/data/browse.ts` with `cacheTag('catalog:browse')`, Browse the Catalog module + 4 sub-routes (`/explore/brands`, `/explore/eras`, `/explore/genres`, `/explore/price-bands`), Collector Archetypes chip rail (hardcoded config), `revalidateTag('catalog:browse')` added to `refresh-counts.ts`.
**Addresses:** MP-01 (Browse count caching — ISR 1h + revalidateTag), MP-02 (empty-module null return, not empty container), MP-08 (clear `.next/` before confirming Explore layout), MP-09 (post-enrichment archetype coverage assertion in acceptance criteria).
**No research flag needed:** ISR caching strategy and archetype taxonomy fully resolved in ARCHITECTURE.md and FEATURES.md.

### Phase 5: Curated Lists Rail + Hero + Where Collections Go

**Rationale:** All three modules depend on published CMS content from Phase 3. Hero additionally requires at least one quality-gated published list before it can activate. Final editorial layer.
**Delivers:** `CuratedListsRail` component + `/explore/lists/**` routes; `HeroFeature` with auto-selection + quality gate + manual-pin + `cms_settings` read/write; `CollectionPathsModule` + `/explore/paths/**` routes; complete `explore:hero` invalidation matrix.
**Addresses:** MP-02 (Hero returns `null` when no eligible list — not an empty container), MP-07 (Hero pin invalidation via `revalidateTag('explore:hero')` in all four write paths: `setPinnedHero`, `clearPinnedHero`, `publishList`, `unpublishList`).
**Research flag:** Where Collections Go mobile layout at 360px is underspecified — vertical stacking with numbered progression indicator is the recommendation but should be prototyped before finalizing the component.

### Phase Ordering Rationale

- Enrichment before Archetypes/Browse: Archetypes produce empty results without `primary_archetype` data; Browse shows 0 counts without era/style enrichment. Hard dependency.
- CMS model before Rail/Hero: Hero and Curated Lists Rail cannot be meaningfully tested without published lists. Admin routes must exist so content can be authored first.
- Polish first: Standalone work that doesn't block anything; better to resolve existing UX bugs before the codebase expands.
- Shell before module-specific CSS: `/explore` grid layout must be stable before per-module responsive breakpoints are validated.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (CMS Data Model):** Any Supabase SECURITY DEFINER functions added in the migration require the REVOKE pattern from `project_supabase_secdef_grants.md`. Also verify enum ordering before writing enum-bound dependent columns (per `project_drizzle_supabase_db_mismatch.md` — 4 prod-push gotchas).
- **Phase 5 (Where Collections Go — mobile layout):** The path sequence at 360px is underspecified. Vertical stacking with numbered progression is the recommendation; needs explicit prototyping before the component is finalized.

Phases with standard patterns (skip research):
- **Phase 1 (Polish):** All decisions resolved — base-ui drawer migration, avatar bucket pattern, model ID update.
- **Phase 2 (Catalog Enrichment):** Script extension is additive; existing sequential pattern is correct at this scale.
- **Phase 4 (Browse + Archetypes):** ISR caching strategy and archetype taxonomy fully resolved; no novel patterns.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All version claims verified via Context7, official Anthropic docs, Supabase docs, npm. `react-markdown` v10.1.0 confirmed React 19 compatible. No speculative dependencies. |
| Features | MEDIUM | Editorial/taste-media patterns (Letterboxd, Hodinkee, Pitchfork) are well-evidenced. Watch-specific collector-path UX is lightly documented — community observation + adjacent domains. Archetype taxonomy is community-derived, not from formal UX research. |
| Architecture | HIGH | Grounded directly in existing codebase files. All patterns are extensions of established project conventions (Phase 11 two-layer privacy, Phase 13/18 revalidateTag, Phase 19.1 storage upload pattern). |
| Pitfalls | HIGH | All 6 critical and 9 moderate pitfalls traced to specific existing files and prior milestone post-mortems. No speculative pitfalls. |

**Overall confidence: HIGH**

### Gaps to Address

- **Collector path mobile layout (360px):** Underspecified. Research recommends vertical stacking with numbered progression indicator. Validate with prototype in Phase 5 plan before finalizing `CollectionPathsModule`.
- **Archetype chip count badge query shape:** Count per archetype must come from enriched catalog after Phase 2. Decide in Phase 4 plan whether to compute via `GROUP BY primary_archetype` query or add a materialized count column — affects whether the chip count is static (build-time) or ISR-refreshed.
- **`/search` URL preset format for archetype deep-links:** Phase 40 (SRCH-16) landed faceted filters but it is unconfirmed whether the archetype header slot was included. Verify before building chip rail deep-links in Phase 4.
- **Era taxonomy dual-mode:** FEATURES.md recommends both decade facets (1960s, 1970s) and named-era facets (Vintage / Neo-Vintage / Modern / Contemporary) as separate Browse dimensions. Schema impact — two separate index pages or one combined — should be decided in Phase 4 plan, not at implementation time.

---

## Sources

### Primary (HIGH confidence)
- Existing codebase — `src/db/schema.ts`, `src/app/explore/page.tsx`, `src/data/discovery.ts`, `src/lib/auth.ts`, `scripts/backfill-taste.ts`, `src/lib/storage/catalogSourcePhotos.ts`, `src/lib/types.ts` — read directly
- `@base-ui/react` Drawer docs (Context7 `/mui/base-ui`) — swipe-to-dismiss, `swipeDirection` prop, `data-base-ui-swipe-ignore`
- Anthropic models overview — https://platform.claude.com/docs/en/about-claude/models/overview — `claude-sonnet-4-6` confirmed; `claude-sonnet-4-20250514` deprecated June 15 2026
- Anthropic batch processing — https://platform.claude.com/docs/en/build-with-claude/batch-processing — tool_use + vision in Batch API confirmed; sequential script remains right approach at 100 rows
- Supabase Storage image transformations — https://supabase.com/docs/guides/storage/serving/image-transformations — Pro Plan required confirmed
- `react-markdown` (Context7 `/remarkjs/react-markdown`) — React 19 compatible, v10.1.0 latest
- `.planning/seeds/SEED-008-v5.1-explore-redesign.md` — module specs, acceptance criteria, open questions
- `.planning/PROJECT.md` — current architecture state post-v5.0, key decisions log
- CLAUDE.md memory: `project_drizzle_supabase_db_mismatch.md` — prod push via `supabase db push --linked` only
- CLAUDE.md memory: `project_supabase_secdef_grants.md` — explicit per-role REVOKE pattern for SECDEF functions
- CLAUDE.md memory: `project_turbopack_next_cache_stale_css.md` — `rm -rf .next` before confirming CSS fixes

### Secondary (MEDIUM confidence)
- Letterboxd lists FAQ + featured lists explainer — per-item notes, curator attribution, editorial list selection patterns
- Nielsen Norman Group — carousel usability; single static hero recommended over auto-rotation
- Baymard Institute — homepage carousel UX requirements
- Hodinkee Reference Points series — editorial voice, byline attribution, collector-depth content patterns
- Chrono24 Magazine, Teddy Baldassarre, Von Rieste, GearPatrol, Two Broke Watch Snobs — collector archetype taxonomy, gateway watch patterns
- Spotify Browse UX — genre/mood chip rail, editorial playlist structure
- Material Design 3 Chips guidelines — archetype rail chip component patterns
- Next.js Draft Mode documentation — preview pattern for admin CMS

### Tertiary (LOW confidence)
- Watch collecting community forums — collection evolution path validation (Rolex Submariner → Explorer, Seiko Presage → Grand Seiko, etc.); community observation, not formal research

---
*Research completed: 2026-05-16*
*Ready for roadmap: yes*
