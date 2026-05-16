# Domain Pitfalls — v5.1 Explore Page Redesign

**Domain:** Editorial CMS + catalog-enrichment pipeline + Explore page modules on Horlo (Next.js 16, Supabase, Drizzle ORM)
**Researched:** 2026-05-16
**Confidence:** HIGH — grounded in the existing codebase (FilterSheet.tsx, enricher.ts, backfill-taste.ts, catalogSourcePhotos.ts, PROJECT.md, SEED-008), v5.0 post-mortem pitfalls, and known system-level patterns from prior milestones.

---

## Critical Pitfalls

These cause data corruption, security holes, or features that are silently wrong in production.

---

### CP-01: Published-draft RLS gap leaks unpublished curated lists to public readers

**What goes wrong:**
The curated-lists CMS will have a `status` column (`draft` | `published`). If the `watches_catalog` public-read RLS pattern is copied naively to `curated_lists` — `FOR SELECT TO anon, authenticated USING (true)` — every draft the admin is writing is immediately readable by any authenticated user via the DAL or direct Supabase client call. The UI does not surface drafts, but the API does.

**Why it happens:**
The catalog tables use `USING (true)` (catalog data is intentionally public). The CMS table is different: only published rows are public. Copying the catalog RLS pattern without adding a `status = 'published'` predicate is a copy-paste error with a security consequence.

**How to avoid:**
The curated_lists RLS SELECT policy for non-owner readers must be:
`USING (status = 'published')`.
Owner reads (admin CMS editing their own draft) require a separate policy:
`USING (status = 'published' OR author_id = auth.uid())`.
Two-layer defense: DAL functions for public reads must also include `WHERE status = 'published'` — do not rely on RLS alone (consistent with the project's two-layer privacy posture established in Phase 11).
Verify via: `SELECT * FROM curated_lists` in a Supabase Studio session authenticated as a non-admin user. Zero draft rows should appear.

**Warning signs:**
A non-admin user visits `/explore/lists` and can see a list by its URL (`/explore/lists/[slug]`) that was never published. Or: a DAL integration test queries curated_lists without the status filter and returns draft rows.

**Phase to address:** Curated Lists + CMS phase (Phase 46 or equivalent). The RLS migration and DAL WHERE clauses must both be present in the same plan before any list authoring begins.

---

### CP-02: Server Action auth bypass on CMS mutations — owner-gate implemented in UI only

**What goes wrong:**
The in-app admin CMS route is "owner-gated" — only the operator (single user) can author lists. If the ownership check lives only in the route rendering logic (e.g., `if (user.id !== OWNER_ID) redirect('/explore')`) but not in the Server Actions that handle create/update/delete, any authenticated user who crafts a direct POST to the Server Action can mutate curated lists.

**Why it happens:**
UI-layer gates feel sufficient when there is only one user. But the app has multi-user auth already live (follows, public profiles). Any future user can hit Server Actions directly. "It's a single-user app" is not a durable security argument.

**How to avoid:**
Every CMS Server Action (`createCuratedList`, `updateCuratedList`, `publishList`, `unpublishList`, `deleteCuratedList`) must begin with:
```ts
const user = await getCurrentUser()
if (user.id !== process.env.OWNER_USER_ID) {
  throw new Error('Unauthorized')
}
```
This is the same pattern as the DAL's `double-verified` auth gate used throughout the existing actions. Use a named constant `OWNER_USER_ID` from an env var — do not hardcode the UUID in source.
Additionally: RLS on `curated_lists` should enforce `WITH CHECK (author_id = auth.uid())` on INSERT/UPDATE/DELETE, so even a service-role bypass would require the correct user.

**Warning signs:**
A Server Action file for CMS operations exists but does not call `getCurrentUser()` as its first statement. Or: the action calls `getCurrentUser()` but then only uses the result for display logic, not to enforce ownership.

**Phase to address:** Curated Lists + CMS phase. Document as a success criterion: "Run `createCuratedList` as non-owner user — verify it throws Unauthorized."

---

### CP-03: LLM enrichment re-run overwrites high-confidence catalog data already in production

**What goes wrong:**
The existing `updateCatalogTaste` uses first-write-wins (`WHERE confidence IS NULL`). The v5.1 catalog enrichment phase will run a richer backfill — potentially with photos, more spec data, or a better prompt. If the operator runs `db:reenrich-taste --force` without understanding that `--force` overwrites ALL rows regardless of confidence, high-confidence rows enriched from official photos get replaced by lower-quality text-only enrichments. The production catalog taste data degrades silently — `analyzeSimilarity()` starts producing worse verdicts.

**Why it happens:**
The `reenrich-taste.ts` script exists and accepts `--force`. The v5.1 enrichment phase has better inputs (more spec columns populated, better photos from the enrichment run). It is tempting to `--force` everything to get the "better" enrichment. But some rows already have `confidence = 0.9` from official photos in Phase 19.1. Force-overwriting those with text-only calls (confidence ~0.6) is a regression.

**How to avoid:**
For the v5.1 backfill run: use the default `db:backfill-taste` (NULL confidence only) to fill gaps, then `db:reenrich-taste --catalog-id=<uuid>` only for specific rows where the operator has identified that existing taste data is wrong.
Add a new flag to `reenrich-taste.ts`: `--min-confidence-threshold=0.7` — only re-enriches rows where existing confidence is BELOW the threshold. This makes intentional upgrades safe without risking regression on high-confidence rows.
Pre-run assertion: before any backfill/reenrich run in prod, log the count and distribution of existing confidence values: `SELECT confidence, count(*) FROM watches_catalog WHERE confidence IS NOT NULL GROUP BY confidence ORDER BY confidence`.

**Warning signs:**
After a backfill run, the average `confidence` across `watches_catalog` rows DECREASES. Or: a row previously enriched from a photo now has `extracted_from_photo = false`.

**Phase to address:** Catalog Enrichment phase (before Explore module work). Add the confidence-threshold flag as a requirement.

---

### CP-04: LLM hallucination corrupts factual spec fields — no validation boundary between taste and spec columns

**What goes wrong:**
v5.1 enrichment extends beyond taste attributes to factual spec backfill: movement type, case size, dial color, complications, photos. If the LLM is asked to produce both taste attributes (subjective, soft) AND factual specs (objective, hard) in the same call, it may hallucinate specs — e.g., reporting `case_size_mm = 40` for a watch that is 38mm, or `movement_type = 'manual'` for a watch that is automatic. These errors flow directly into the catalog's factual columns and affect `/search` filter results (a user filtering for 38-40mm case sizes finds or misses watches incorrectly).

**Why it happens:**
The existing enricher is strictly scoped to taste attributes (formality, sportiness, heritage_score, primary_archetype, era_signal, design_motifs, confidence). There is a clean boundary: the enricher never writes factual spec columns. If v5.1 tries to use the LLM to also backfill `movement_type`, `case_size_mm`, etc., it removes that boundary.

**How to avoid:**
Maintain the existing separation: the LLM enricher writes ONLY taste columns. Factual spec backfill (`movement_type`, `case_size_mm`, `dial_color`, etc.) must come from a different source — either manual operator entry, web scraping from known authoritative sources (brand.com, watch databases), or a separate LLM call with explicit confidence gating and a human review step before write.
If the enrichment phase does use LLM for specs, require: (a) a `spec_confidence` field separate from `taste_confidence`; (b) a `spec_needs_review` boolean that gates spec writes behind operator approval; (c) never auto-write factual specs to production without a review step.
The safest approach: enrichment phase uses LLM only for taste columns (existing pattern), uses manual operator data entry + scraping for spec columns.

**Warning signs:**
The enrichment plan proposes a single LLM call that outputs both taste attributes and factual specs in one tool-use block. Or: spec columns are being written from LLM output without a human review step.

**Phase to address:** Catalog Enrichment phase. Document as a hard constraint: "LLM output writes taste columns only. Spec columns require either manual entry or a human-reviewed scrape."

---

### CP-05: Broken catalog references in curated lists when a catalog row is deleted or replaced

**What goes wrong:**
A curated list contains FK references to `watches_catalog.id`. If a catalog row is deleted (e.g., during a future catalog cleanup or merge operation), the FK reference in the list either CASCADE DELETEs the list item (making the list silently shorter) or sets it to NULL (making the list render a broken card). Neither is surfaced to the admin — the published list is now broken in production.

**Why it happens:**
The `watches_catalog` table uses `ON DELETE SET NULL` for `watches.catalog_id`. If the same pattern is used for the curated list items junction table, list item rows survive but with a NULL `catalog_id` — the component tries to render a watch card with no data. If `ON DELETE CASCADE` is used instead, list items silently disappear.

**How to avoid:**
The curated list items table must use `ON DELETE RESTRICT` on `catalog_id` FK — blocking deletion of catalog rows that are referenced by a published list. This forces the operator to either: (a) remove the watch from the list before deleting the catalog row, or (b) unpublish the list first.
For the `Where Collections Go` path module: same constraint — a path node that references a deleted catalog row must block the delete.
In both cases, add a pre-delete check in the admin UI that warns: "This watch is referenced in [N] curated lists. Remove it from those lists before deleting."

**Warning signs:**
An admin deletes a catalog row and the published list on `/explore` renders a broken card or silently shows fewer watches than the list's advertised count.

**Phase to address:** Curated Lists + CMS phase. The schema design decision (RESTRICT vs CASCADE vs SET NULL) must be explicit in the plan.

---

### CP-06: Supabase SECDEF functions auto-granting EXECUTE to anon breaks admin-CMS isolation

**What goes wrong:**
The existing memory note (`project_supabase_secdef_grants.md`) documents that Supabase auto-grants EXECUTE to `anon`, `authenticated`, and `service_role` on public-schema functions by default. If any CMS-related SECURITY DEFINER function is created (e.g., a function to publish a list, refresh browse counts) without explicit `REVOKE EXECUTE FROM anon, authenticated` followed by `GRANT EXECUTE TO service_role`, any authenticated user can call the function directly from the Supabase client.

**Why it happens:**
This is a Supabase-specific behavior, not standard Postgres. Prior milestones (Phase 11) hit this: `REVOKE FROM PUBLIC` alone does not block anon. The grant to `authenticated` happens automatically and must be explicitly revoked per-role.

**How to avoid:**
Every SECURITY DEFINER function created in v5.1 (count refresh, publish trigger, etc.) must follow the existing pattern:
```sql
REVOKE ALL ON FUNCTION fn_name() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_name() FROM anon;
REVOKE EXECUTE ON FUNCTION fn_name() FROM authenticated;
GRANT EXECUTE ON FUNCTION fn_name() TO service_role;
```
Add this to the migration template for any new SECDEF function. Verify post-migration: attempt to call the function as `authenticated` role — it must return a permission error.

**Warning signs:**
A new SECDEF function is created in a migration file without explicit REVOKE statements after the function body. Or: the function appears in `information_schema.routines` with `SECURITY_TYPE = 'DEFINER'` but no REVOKE migration lines.

**Phase to address:** Any phase that adds SECDEF functions (count refresh cache, publish helpers). The Catalog Enrichment phase is the most likely candidate.

---

## Moderate Pitfalls

Mistakes that cause incorrect behavior, UX regressions, or significant rework.

---

### MP-01: Catalog-derived count caching strategy not decided before Browse the Catalog ships

**What goes wrong:**
The Browse the Catalog module shows brand/era/genre/price-band indices with counts (e.g., "Rolex (42)"). These counts are derived from `watches_catalog` via SQL aggregation. If no caching strategy is decided, two bad outcomes are possible: (a) live queries on every page load make Browse the Catalog slow for a count that barely changes; (b) `cacheLife({ revalidate: 86400 })` is applied blindly and counts are stale for a full day after catalog enrichment adds new rows.

**Why it happens:**
SEED-008 explicitly flags "Caching strategy for catalog-derived counts in Browse indices: static at build, ISR, or live?" as an open question. The temptation is to defer this to the phase and figure it out then. But the choice affects the data model: if count materialization requires a cron job or a pre-computed `counts_cache` table, that infrastructure must exist before the Browse module renders.

**How to avoid:**
Decide at roadmap time, not during the phase. Recommendation: use Next.js `cacheLife({ revalidate: 3600 })` (1-hour ISR) on the Browse index Server Component, paired with explicit `revalidateTag('catalog:browse')` calls in any Server Action that modifies `watches_catalog` (enrichment writes, admin edits). This is the same pattern as the existing `/explore` rails (5-minute TTL + revalidateTag on watch mutations). The existing `refresh-counts.ts` script (daily pg_cron) can also call `revalidateTag` after it runs.
Document the tag name convention in the Browse phase plan.

**Warning signs:**
The Browse the Catalog module is shipped without a `cacheLife` declaration. Or: the phase CONTEXT.md says "we'll use live queries for now" — this will cause noticeable latency on the browse index pages.

**Phase to address:** Explore Shell + Browse the Catalog phase. The caching decision must be in the plan before implementation.

---

### MP-02: Empty-module degradation not tested — modules render empty containers instead of hiding

**What goes wrong:**
SEED-008 states: "Modules with missing data degrade gracefully — never empty." The Hero must hide itself when no quality-gated list exists. The Curated Lists Rail must hide the entire module when there are zero published lists. In practice, components render their container (heading, padding, section chrome) but with no content — a visible empty box on the page.

**Why it happens:**
Developers test the happy path. The empty-state check is conditional logic that only runs when the data array is length 0, which never happens in a dev environment where the admin has seeded content. The empty container only surfaces in production before any lists are authored, or if all lists are unpublished.

**How to avoid:**
Each module component must have an explicit early return of `null` (not an empty `<section>`) when its data is empty. The acceptance criteria for each module must include: "Render with empty data — module is absent from the DOM, no empty container."
Write a test for each module with empty props: `expect(container).toBeEmptyDOMElement()` or `expect(queryByRole('region', { name: 'Curated Lists' })).not.toBeInTheDocument()`.
The Hero's quality-gate logic (minimum watch count, has cover image, has intro copy) must be tested with lists that fail exactly one criterion at a time.

**Warning signs:**
A screenshot of `/explore` on a fresh environment (no lists authored yet) shows section headings with blank content beneath them. Or: the Hero renders a broken image placeholder when no list has a cover image.

**Phase to address:** Explore Shell (for the shell empty-module pattern) + Curated Lists Rail phase (for the specific list module). Each module acceptance checklist must include the zero-data test.

---

### MP-03: Bottom-sheet gated-open-change bug class — dismiss blocked during loading

**What goes wrong:**
The v5.0 FilterSheet bug: the sheet "could not be dismissed while a filtered query was in flight." The root cause: something in the parent was calling `onOpenChange` with a function that checked loading state before allowing close. The `WatchFacetSheet` component in `FilterSheet.tsx` passes `onOpenChange={setSheetOpen}` directly, which is correct. The bug likely manifested where a parent wrapped the open-state setter in a guard: `(open) => { if (!watchesIsLoading) setSheetOpen(open) }` — or where closing the sheet triggered a re-render that set loading state which re-opened the sheet.

This class of bug recurs any time a modal/sheet's dismiss handler is made conditional on async state.

**Why it happens:**
The intent is usually "don't close the filter sheet while results are loading, because the user might not realize their filter is in flight." But this inverts user intent: the user explicitly dismissed the sheet. Loading state should never gate a user-initiated dismiss.

**How to avoid:**
The pattern to enforce in v5.1 (and for the v5.0 fix in the Polish phase): the `onOpenChange` prop passed to any Sheet/Dialog/BottomSheet must NEVER be wrapped in a loading-state guard. Dismiss is always allowed.
If the concern is "the user dismissed the sheet before seeing the results," show a loading indicator inside the sheet or in the results area — do not block dismiss.
For drag-to-dismiss: implement using `@base-ui/react` Dialog or a CSS `transition` on `transform: translateY` with a pointer-move handler. Do not reuse the Shadcn Sheet for drag-to-dismiss — Shadcn Sheet does not have native swipe-dismiss; adding it via `onPointerDown` / `onPointerMove` / `onPointerUp` handlers risks interfering with scroll.
Success criterion: "Sheet can be dismissed at any point during a pending search query — loading state does not gate close."

**Warning signs:**
`onOpenChange` in any Sheet consumer is wrapped in a function with a conditional before calling `set*Open`. Or: the Sheet's `open` prop is derived from a loading state rather than a dedicated `boolean` state variable.

**Phase to address:** Polish phase (first phase of v5.1). Fix the dismiss-guard bug in the existing FilterSheet before building new sheet surfaces.

---

### MP-04: LLM enrichment rate limits cause silent partial failure at batch scale

**What goes wrong:**
The existing `backfill-taste.ts` processes rows sequentially with no rate-limit handling. At ~100 rows, the Anthropic API's `claude-sonnet-4-6` rate limits (requests-per-minute and tokens-per-minute) may cause 429 errors mid-batch. The current error handler catches the error, logs it, increments `totalFailed`, and continues — leaving those rows with `confidence = NULL`. The script reports "22 rows still have NULL confidence" at the end, but there is no retry logic and no distinction between "failed due to rate limit" vs "failed due to bad input."

**Why it happens:**
At Phase 19.1 scale (<20 rows in the initial bootstrap), rate limits were never hit. At 100 rows, depending on vision vs text mode and prompt token count, the RPM limit (~50 for Tier 1 Sonnet) can be reached within 2 minutes of the script starting.

**How to avoid:**
Add exponential backoff + retry (3 attempts, 2s/4s/8s delays) inside `enrichTasteAttributes` or in the batch loop, triggered on `status 429` or Anthropic SDK `RateLimitError`. Existing error handler: `catch (err) { ... totalFailed++ }` — add a pre-catch check for `err instanceof Anthropic.RateLimitError` and sleep before retrying.
Add inter-row delay: `await new Promise(r => setTimeout(r, 800))` between rows in the batch loop. At 800ms/row, 100 rows takes ~80 seconds — well within the RPM limit.
Add a `--delay-ms=N` CLI flag to the backfill script so the operator can tune the rate.
After a run with failures, the script already instructs "re-run later" — but the operator needs to know WHICH rows failed. Log each failed `catalog_id` explicitly rather than just a count.

**Warning signs:**
A dry-run reports 100 rows; the live run reports 22 failed. All 22 failures are the same error type (`RateLimitError`). Or: the script completes in under 60 seconds for 100 rows (suspiciously fast — likely hitting rate limits and silently skipping).

**Phase to address:** Catalog Enrichment phase. The rate-limit retry and inter-row delay must be in the enrichment script before the prod run.

---

### MP-05: Non-idempotent enrichment re-run creates duplicate state via vision vs text mode flip

**What goes wrong:**
A row has `extracted_from_photo = true` and `confidence = 0.85` from a vision-mode enrichment. The operator re-runs `db:reenrich-taste` for that row (e.g., because the photo was replaced). If the `photoSourcePath` is now NULL (the old photo was deleted from Storage), the enricher falls back to text mode and writes `extracted_from_photo = false` with lower confidence. The DB now has contradictory history: the row says it was NOT extracted from a photo, but the changelog (if any) shows it was. More practically: the Browse the Catalog module may show different taste groupings than expected because a high-confidence vision-enriched archetype was downgraded to a lower-confidence text guess.

**Why it happens:**
The enricher already handles this gracefully (falls back to text on photo fetch failure). The issue is operator awareness: running reenrich on a row without confirming the photo still exists will silently downgrade the enrichment quality.

**How to avoid:**
Before re-enriching a row that has `extracted_from_photo = true`, confirm the photo path is still valid: attempt a signed-URL generation for the path. If it fails, warn the operator instead of silently falling back.
Add a pre-run assertion to `reenrich-taste.ts`: when re-enriching a vision row, log a warning: "Photo not found for catalog_id={id} — will enrich text-only; confidence may be lower than existing value."
Add a `--skip-if-higher-confidence` flag: if the existing confidence is above a threshold, skip rather than risk downgrade.

**Warning signs:**
After a targeted reenrich, the row's `extracted_from_photo` flips from `true` to `false` unexpectedly. Or: confidence drops from 0.85 to 0.55 on a row that was previously vision-enriched.

**Phase to address:** Catalog Enrichment phase. The `reenrich-taste.ts` script must include the photo-existence check before the prod run.

---

### MP-06: Avatar upload reuses wrong bucket — mixing profile photos into catalog-source-photos

**What goes wrong:**
The v5.1 Polish phase adds avatar upload via Supabase Storage. The existing photo upload path (`catalog-source-photos` bucket, `src/lib/storage/catalogSourcePhotos.ts`) is well-established. The temptation is to reuse it for profile photos by just adding a new path convention (e.g., `{userId}/avatar/avatar.jpg`). But `catalog-source-photos` has RLS scoped to watch-catalog operations (its policies are tied to the catalog enricher's service-role access). Profile avatars have different access patterns: they should be publicly readable (like CDN-served profile photos) without signed URLs.

**Why it happens:**
The bucket already exists, the upload helper is already written, and the EXIF-strip + JPEG-resize pipeline is already implemented. Reusing it for avatars seems like minimal friction.

**How to avoid:**
Create a separate `avatars` bucket (or `profile-photos` bucket) with public-read policy, not signed-URL access. Profile photos need to be served directly via a public URL (`supabase.storage.from('avatars').getPublicUrl(path)`) so they can be used in `<img src>` without expiring. Signed URLs expire (60s in the existing enricher pattern) — unacceptable for a profile avatar rendered in navigation headers on every page.
The upload pipeline (EXIF strip, canvas re-encode to JPEG, ≤1080px) can be reused as a utility function — just change the bucket name and the URL retrieval pattern (public URL vs signed URL).
Add `remotePatterns` entry in `next.config.ts` for the new bucket's CDN hostname if it differs from the existing `catalog-source-photos` pattern.

**Warning signs:**
`ProfileSection.tsx` calls `uploadCatalogSourcePhoto` or `getCatalogSourcePhotoSignedUrl`. Or: the avatar URL stored in `profiles.avatar_url` is a signed URL with an expiry timestamp.

**Phase to address:** Polish phase. Avatar upload must use a new bucket, not the existing catalog bucket.

---

### MP-07: Hero auto-rotation logic creates a stale-cache collision with manual pin

**What goes wrong:**
The Hero has two selection modes: auto (most recently published quality-gated list) and manual pin (admin sets a specific list). If the Hero's Server Component is cached with `cacheLife({ revalidate: 604800 })` (weekly), and the admin sets a manual pin mid-week, the cache serves the old auto-selected hero for up to 7 days before revalidation. Unpinning has the same problem in reverse.

**Why it happens:**
The cache tag for the Hero is likely `'explore:hero'`. If the pin-setting Server Action calls `revalidateTag('explore:hero')`, this works correctly. But if the action only calls `revalidatePath('/explore')` (path-based invalidation), and the Hero component is a nested cached Server Component using `'use cache'`, the cache tag invalidation does not propagate to the nested component.

**How to avoid:**
The manual-pin Server Action must call `revalidateTag('explore:hero')` explicitly — not just `revalidatePath('/explore')`. This is consistent with the existing pattern (Phase 13 documented `updateTag` vs `revalidateTag` distinction; Phase 18 used `revalidateTag('explore', 'max')` for SWR fan-out).
The pin status must be stored in the DB (a `config` or `cms_settings` table row), not in environment variables or a JSON file — so the Server Component always reads live pin state when cache is refreshed.
Document the invalidation matrix for the Hero in the plan: what writes must call `revalidateTag('explore:hero')`? Answer: `publishList`, `unpublishList`, `setPinnedHero`, `clearPinnedHero`.

**Warning signs:**
Admin sets a manual pin; the `/explore` hero still shows the previous auto-selected list after navigating away and back. This is a cache tag miss on the pin action.

**Phase to address:** Curated Lists + Hero phase. The invalidation matrix must be in the plan before the Hero cache scope is written.

---

### MP-08: Turbopack `.next` cache serves stale Explore CSS — known prior pitfall

**What goes wrong:**
The v5.1 Explore page is a new route with its own layout grid, module spacing, and responsive breakpoints. Turbopack's `.next/` cache has caused stale CSS in prior milestones (Phase 30's black bar, documented in `project_turbopack_next_cache_stale_css.md`). Responsive layout bugs on `/explore` may appear to be code errors but are actually stale cached CSS.

**Why it happens:**
Turbopack does not always invalidate `.next/` on CSS changes, particularly for global styles or newly added Tailwind utility classes. Dev server restart alone does not clear the cache.

**How to avoid:**
The Polish phase and Explore Shell phase verification steps must include: "Clear `.next/` (`rm -rf .next`) and restart dev server before confirming any layout fix." Add this to the phase completion checklist.
For the Explore page specifically: the `aspect-[4/5]` watch card fix (cards with variable metadata height) is a CSS chain that must be verified with computed styles in DevTools, not just source inspection — per the MP-07 pattern documented in the v5.0 PITFALLS.md.

**Warning signs:**
A Tailwind class is present in the JSX but the computed style in DevTools does not reflect it. Or: a layout regression appears on first load but disappears after a hard refresh.

**Phase to address:** Polish phase (watch-card height fix) and Explore Shell phase. Both verification steps must include the `.next/` cache clear.

---

### MP-09: Collector Archetype filter deep-links produce empty results if catalog lacks the tagged data

**What goes wrong:**
SEED-008 acceptance: "Every archetype produces a non-empty results page (validate at build time)." If the catalog enrichment has not been completed before the Archetypes module ships, a user taps "Dive Watch Devotee" and gets zero results — because `primary_archetype = 'dive'` matches zero catalog rows with sufficient confidence. The module renders but is functionally broken.

**Why it happens:**
The implementation order in SEED-008 is: (1) Polish, (2) Catalog Enrichment, (3) Page Shell + Browse + Archetypes. If the Archetypes phase is implemented before the enrichment run completes in production, the archetype filter deep-links are broken in prod even though they work in dev (where the developer seeded their own test data).

**How to avoid:**
The Archetypes phase must include a build-time or CI assertion: for each archetype config entry, verify the filter returns ≥1 result from the production catalog via a test against the staging DB or a snapshot. Do not ship Archetypes to prod until the catalog enrichment run is verified complete with sufficient coverage per archetype.
Alternatively: add a runtime guard — if an archetype's prefiltered results page returns zero results, show a "No results yet — catalog expanding soon" placeholder rather than an empty search page. This is graceful degradation, not a fix.

**Warning signs:**
Archetypes module ships before `db:backfill-taste` has been run in production. Or: the archetype config maps to `primary_archetype = 'field'` but zero catalog rows have `primary_archetype = 'field'` after enrichment.

**Phase to address:** Catalog Enrichment phase (run first, verify coverage). Archetypes phase (include post-enrichment coverage assertion in acceptance criteria).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcode `OWNER_USER_ID` in source instead of env var | No env var setup needed | Owner changes (unlikely but possible); UUID visible in repo history | Never — use env var |
| Single bucket for all photos (avatars + catalog photos) | Fewer Supabase buckets | RLS policies conflict; signed URLs used for public avatars (expiry issues) | Never |
| Skip `status = 'published'` filter in DAL (rely on RLS only) | Simpler queries | One-layer privacy; RLS bypass via service role exposes drafts | Never for data with draft/published lifecycle |
| `onOpenChange` wrapped in loading guard | "Prevents accidental dismiss" | Blocks user-initiated dismiss; violates UX contract | Never |
| Use `revalidatePath('/explore')` instead of tagged cache invalidation | Simpler | Nested `'use cache'` components not invalidated by path revalidation | Never for nested Cache Components |
| LLM for factual spec backfill without human review | Faster backfill | Hallucinated specs corrupt filter results silently | Never for factual spec columns |
| Run `db:reenrich-taste --force` on all rows before verifying photo availability | Simpler invocation | Vision-enriched rows downgraded to text-only without awareness | Never without photo-existence pre-check |
| Copy `watches_catalog` public-read RLS to `curated_lists` | Faster schema setup | Leaks drafts to all authenticated users | Never |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase Storage (avatar upload) | Use `createSignedUrl` for avatar retrieval | Use `getPublicUrl` — avatars must be publicly readable without expiry |
| Supabase Storage (avatar upload) | Upload to existing `catalog-source-photos` bucket | Create a separate `avatars` bucket with public-read policy |
| Anthropic API (enrichment) | No inter-row delay → silent 429s mid-batch | Add 800ms+ delay between rows; add exponential backoff on `RateLimitError` |
| Anthropic API (enrichment) | Force-reenrich all rows regardless of confidence | Use `--min-confidence-threshold` flag; never downgrade high-confidence rows |
| Supabase RLS on CMS tables | Copy `USING (true)` from catalog tables | Add `status = 'published'` predicate for public reads |
| Supabase SECDEF functions | Omit explicit REVOKE after function creation | Always: `REVOKE EXECUTE FROM anon, authenticated` immediately after function definition |
| Next.js `'use cache'` + manual pin | `revalidatePath` does not reach nested cached components | Use `revalidateTag('explore:hero')` in pin/unpin Server Actions |
| Drizzle + Supabase migrations | `drizzle-kit push` for prod | Always use `supabase db push --linked` for production schema changes |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Live SQL count aggregation on Browse indices per request | Browse the Catalog page takes 500ms+; slow under concurrent users | `cacheLife({ revalidate: 3600 })` + `revalidateTag('catalog:browse')` on enrichment writes | At any scale — aggregation is expensive without caching |
| No inter-row delay in enrichment batch at 100 rows | 22 silent failures, `totalFailed = 22` at end | 800ms delay between rows; retry on 429 | Hits rate limit within 2 minutes at 100 rows |
| Hero Server Component without cache scope | `/explore` page re-fetches hero data on every request | `'use cache'` with `cacheLife({ revalidate: 604800 })` + tag-based invalidation | At any traffic level — server renders are synchronous and block page delivery |
| Curated list items JOIN at render time for count display | Rail card shows wrong count if items are added/removed without count column | Cache a `watch_count` on `curated_lists` row; update on item mutations | As list item count grows — N+1 risk if count is computed via subquery per card |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Owner check only in route rendering, not in Server Actions | Any authenticated user can POST to CMS Server Actions | `getCurrentUser()` + owner ID assertion as first statement in every CMS Server Action |
| `curated_lists` RLS allows reads of draft rows by authenticated users | Unpublished editorial content visible to non-admin collectors | RLS SELECT policy: `USING (status = 'published' OR author_id = auth.uid())` |
| SECDEF function without explicit REVOKE | Authenticated users can call admin-only functions directly | Always REVOKE from anon and authenticated; GRANT to service_role only |
| Avatar upload path traversal via malformed filename | Attacker uploads to another user's folder | Reuse `buildCatalogSourcePhotoPath` validation (UUID/pending check, no slashes in filename) |
| CMS admin route accessible without auth check | Unauthenticated access to list authoring UI | Proxy.ts must block `/admin/*` routes; add to PUBLIC_PATHS exclusion |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Sheet dismiss blocked during loading | User feels stuck; cannot close filter drawer mid-query | Never gate `onOpenChange` on loading state; always allow user-initiated dismiss |
| Wishlist cards show wear badges for wishlist watches | Confusing UI ("Never worn" on a watch you don't own) | Gate all wear UI on `status === 'owned'` |
| Watch card height varies by metadata length | Grid looks inconsistent; some cards are taller than others | Fix metadata block to a consistent height; use `line-clamp` for overflowing text |
| Hero shows broken image when list has no cover | First impression is broken | Hero quality gate must require `has cover image` — no cover, no hero eligibility |
| Curated list rail shows rail heading + empty space | Signals emptiness to user before CMS has any content | Module must return `null` when zero published lists exist (no heading, no container) |
| Where Collections Go path wraps on very narrow (360px) screens | Horizontal chain unreadable on smallest phones | Stack the path sequence vertically on screens <400px |

---

## "Looks Done But Isn't" Checklist

- [ ] **Curated Lists CMS:** Draft/publish status is gated in BOTH RLS AND DAL WHERE clause — verify by querying as non-owner authenticated user.
- [ ] **CMS Server Actions:** Every mutation begins with `getCurrentUser()` + owner ID assertion — verify by calling createCuratedList as a non-owner user.
- [ ] **Hero manual pin:** `revalidateTag('explore:hero')` is called in both `setPinnedHero` and `clearPinnedHero` Server Actions — verify by setting/clearing pin and confirming hero updates within one request.
- [ ] **Catalog Enrichment:** `db:backfill-taste --dry-run` run before prod backfill to confirm cost estimate and row count.
- [ ] **Catalog Enrichment:** After prod backfill, `SELECT primary_archetype, count(*) FROM watches_catalog GROUP BY primary_archetype` — verify each archetype has ≥1 row before Archetypes module ships.
- [ ] **Avatar Upload:** Avatar bucket uses `getPublicUrl` not `createSignedUrl` — verify the URL stored in `profiles.avatar_url` does not contain an expiry parameter.
- [ ] **Avatar Upload:** New bucket has public-read RLS and is listed in `next.config.ts` `remotePatterns`.
- [ ] **Bottom-sheet dismiss:** Sheet can be closed while `watchesIsLoading = true` — verify by opening FilterSheet, starting a query, and dismissing before it resolves.
- [ ] **Drag-to-dismiss:** Bottom-sheet drag gesture triggers close and does not scroll the page behind the sheet simultaneously.
- [ ] **Empty-module degradation:** Each Explore module returns `null` (not an empty container) when its data array is empty — verify with a test using empty props.
- [ ] **SECDEF functions:** Any new function has explicit `REVOKE EXECUTE FROM anon, authenticated` in its migration — check migration file before applying to prod.
- [ ] **Where Collections Go:** A path with a deleted/unpublished catalog reference does not crash the page — verify by removing a catalog row referenced in a path.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Draft lists leaked to public via RLS miss | LOW | Add `status = 'published'` predicate to RLS policy via new migration; unpublish any exposed drafts immediately |
| Enrichment run downgrades high-confidence rows | MEDIUM | Run `reenrich-taste.ts --catalog-id=<uuid>` with vision inputs for each downgraded row; verify confidence restores |
| Factual spec hallucination in catalog | HIGH | Manual operator review + correction for each affected row via admin edit UI; add `spec_needs_review` flag to catch future cases |
| CMS Server Action unauthorized access discovered | LOW (single user) | Immediately add owner-gate assertion to affected actions; audit Server Action logs for unauthorized calls |
| Avatar URL expiring (signed URL used instead of public) | LOW | Migrate `profiles.avatar_url` values to public URLs; update upload helper to use `getPublicUrl`; no data loss |
| Rate-limit batch failure (22 NULL confidence rows) | LOW | Re-run `db:backfill-taste` (idempotent — processes only NULL rows); add delay flag to prevent recurrence |
| Browse counts stale for 1 hour after enrichment | LOW | Call `revalidateTag('catalog:browse')` manually from admin script; counts refresh on next ISR cycle |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| CP-01: Draft RLS leak | Curated Lists + CMS phase | Query as non-owner authenticated user; zero draft rows returned |
| CP-02: CMS Server Action auth bypass | Curated Lists + CMS phase | Call createCuratedList as non-owner; verify Unauthorized error |
| CP-03: Force-reenrich overwrites high-confidence rows | Catalog Enrichment phase | Pre-run confidence distribution query; use NULL-only backfill by default |
| CP-04: LLM hallucination in spec columns | Catalog Enrichment phase | LLM writes taste columns only; spec columns require manual/scrape + human review |
| CP-05: Catalog FK breaks published lists | Curated Lists + CMS phase | Schema uses ON DELETE RESTRICT; pre-delete warning in admin UI |
| CP-06: SECDEF auto-grant to anon | Any phase adding SECDEF functions | Post-migration: attempt function call as authenticated role; verify permission error |
| MP-01: Browse count caching undefined | Explore Shell + Browse phase | cacheLife declared; revalidateTag called on enrichment writes |
| MP-02: Empty-module renders container | All Explore module phases | Unit test each module with empty props; verify null return |
| MP-03: Dismiss-blocked-during-loading | Polish phase (first phase) | Sheet can close while watchesIsLoading = true |
| MP-04: Rate limits cause silent failures | Catalog Enrichment phase | Dry-run cost estimate; add 800ms delay + retry; log each failed catalog_id |
| MP-05: Vision→text flip on reenrich | Catalog Enrichment phase | Photo-existence check before reenrich; log warning if photo missing |
| MP-06: Avatar in wrong bucket | Polish phase | Avatar URL is public (no expiry); stored in separate bucket |
| MP-07: Hero pin cache miss | Curated Lists + Hero phase | Set/clear pin; verify hero updates within one request |
| MP-08: Turbopack stale CSS | Polish phase + Explore Shell phase | `rm -rf .next` before layout verification; computed styles in DevTools |
| MP-09: Archetypes without catalog coverage | Archetypes phase | Each archetype filter returns ≥1 result from prod catalog post-enrichment |

---

## Sources

- `src/components/search/FilterSheet.tsx` — bottom-sheet dismiss pattern; `onOpenChange={setSheetOpen}` is correct; dismiss-gate bug is in callers
- `src/components/search/SearchPageClient.tsx` — `sheetOpen` state is independent of loading state; confirms dismiss bug was caller-side
- `src/lib/taste/enricher.ts` — existing enricher scope (taste only); vision fallback to text; no retry logic; rate limit gap identified
- `scripts/backfill-taste.ts` — sequential processing; no inter-row delay; `totalFailed` count only (no per-row logging); rate limit vulnerability at 100 rows
- `src/lib/storage/catalogSourcePhotos.ts` — `createSignedUrl` pattern (60s TTL); signed URLs inappropriate for public avatars
- `src/lib/types.ts` — `CatalogEntry`, `CatalogTasteAttributes` — confirms taste and spec columns are in the same table; boundary between them is enforced by convention only
- `src/data/catalog.ts` — `sanitizeHttpUrl`, `sanitizeTagArray` — existing write-time validation for URL extractor output; confirms spec columns need similar write-time validation if LLM is used
- `.planning/seeds/SEED-008-v5.1-explore-redesign.md` — module specs, acceptance criteria, open questions (caching strategy, CMS approach)
- `.planning/PROJECT.md` — v5.1 scope, CMS decision (in-app admin), enrichment as "enrich half" before Explore modules
- `CLAUDE.md` memory: `project_supabase_secdef_grants.md` — REVOKE FROM PUBLIC alone does not block anon; explicit per-role REVOKE required
- `CLAUDE.md` memory: `project_turbopack_next_cache_stale_css.md` — dev server restart does not clear `.next/`; must `rm -rf .next`
- `CLAUDE.md` memory: `project_drizzle_supabase_db_mismatch.md` — prod push via `supabase db push --linked` only
- `.planning/research/PITFALLS.md` (v5.0) — MP-07 CSS chain blind spot; SECDEF grant pattern (Phase 11); revalidateTag vs revalidatePath distinction

---
*Pitfalls research for: v5.1 Explore Page Redesign (editorial CMS + catalog enrichment + Explore modules)*
*Researched: 2026-05-16*
