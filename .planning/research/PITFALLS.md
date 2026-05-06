# Domain Pitfalls — v5.0 Discovery North Star

**Domain:** Catalog hierarchy migration + engine rewire + clean-slate DB wipe + audit-driven discovery polish on horlo (Next.js 16 App Router, Supabase, Drizzle ORM, single-user)
**Researched:** 2026-05-06
**Based on:** SEED-001, SEED-002, SEED-004, v4.0-MILESTONE-AUDIT.md, v4.1-MILESTONE-AUDIT.md, src/db/schema.ts, src/lib/similarity.ts, docs/deploy-db-setup.md, tests/static/CollectionFitCard.no-engine.test.ts, tests/actions/watches.notesPublic.test.ts

---

## Critical Pitfalls

These cause rewrites, data loss, or silent regressions that are hard to detect post-ship.

---

### CP-01: Brand/Family backfill applied in wrong order before NOT NULL constraint

**What goes wrong:** In the Layer A phase, `brand_id` and `family_id` are added as nullable columns on `watches_catalog`. A later migration flips them `NOT NULL`. If the `NOT NULL` ALTER runs before the backfill script completes — or if `brand_id` is made NOT NULL before `family_id` exists for every row — the migration aborts midway and leaves the catalog in a partial state.

**Why it happens:** The three operations (add nullable column, backfill data, add NOT NULL constraint) are tempting to collapse into a single migration for cleanliness. Postgres evaluates the constraint immediately; any row with a NULL brand_id at that moment fails the constraint.

**Consequences:** Migration fails in production, requiring manual intervention. If not caught before Drizzle migration tracking records the migration as applied (the T-05-06-EMPTYMIGRATE footgun), you cannot cleanly re-run.

**Prevention:**
- Layer A migration structure (Phase 33): ADD COLUMN brand_id nullable, ADD COLUMN family_id nullable — one migration.
- Backfill script runs separately, verifies zero NULLs remain.
- Only then: ALTER COLUMN brand_id SET NOT NULL in a separate migration.
- Same sequence for family_id.
- The sequence is: brand rows must exist BEFORE family rows BEFORE family_id can be assigned BEFORE brand_id can be NOT NULL.
- Explicitly: in Phase 33, `brands` table created first, then `watch_families` (FK to brands), then backfill `watches_catalog.brand_id`, then backfill `watches_catalog.family_id`, then optionally add NOT NULL on both.

**Detection:** Run `SELECT count(*) FROM watches_catalog WHERE brand_id IS NULL` after each backfill step. Any non-zero result blocks the NOT NULL flip.

**Phase owner:** Layer A phase (Phase 33 or equivalent).

---

### CP-02: CAT-13 engine rewire breaks the byte-lock invariant already spanning 3 phases

**What goes wrong:** `analyzeSimilarity()` is byte-locked across Phases 17, 19.1, and 20 (D-09 in Phase 17, reinforced in Phase 20). The static guard test `tests/static/CollectionFitCard.no-engine.test.ts` ensures `<CollectionFitCard>` never imports the engine. CAT-13 rewires the engine to read catalog taste columns at JOIN time. If the rewire modifies `analyzeSimilarity`'s function signature, its export name, or moves it to a different module path, every phase that cited the byte-lock becomes stale — but the lock is not re-verified and the static guard continues to pass vacuously (because it tests file-level imports, not function internals).

**Why it happens:** The byte-lock was documented as "NEVER MODIFY" but that instruction does not survive the CAT-13 rewire unchanged. The rewire necessarily changes the inputs (adding a catalog JOIN result) or the data path even if the signature stays the same.

**Consequences:** Static guard `tests/static/CollectionFitCard.no-engine.test.ts` continues to pass but the behavior contract it was protecting has silently shifted. Verdict labels regress on collections where catalog taste data is absent (NULL confidence rows) because the old per-user-tag fallback path is no longer exercised.

**Prevention:**
- In the CAT-13 phase, explicitly decide: does `analyzeSimilarity`'s signature change? If catalog taste columns are injected as a new optional parameter, document that as a deliberate signature extension, not a lock violation.
- Add a new static guard test: `tests/static/analyzeSimilarity.catalog-gate.test.ts` that asserts: when catalog taste data has NULL confidence, the engine returns a verdict using only per-user tag data (regression guard for the NULL-confidence fallback path). This is distinct from the existing `CollectionFitCard.no-engine.test.ts` which guards import boundaries, not behavioral correctness.
- The old byte-lock language ("byte-locked") should be updated in the CAT-13 phase's CONTEXT.md to "engine rewire under CAT-13 — see Phase 3X CONTEXT for the new invariant."
- The `no-engine` test name remains accurate post-rewire because the test guards that `<CollectionFitCard>` is still a pure renderer — the rewire moves computation server-side, which STRENGTHENS the rationale for the test. Do not rename the test.
- The `analyzeSimilarity.confidence-gate.test.ts` guard must assert that at confidence < 0.5, the catalog taste path is skipped and the verdict falls back to per-user-tag behavior. This matches the existing 0.5/0.7 threshold pattern from Phase 20.

**Detection:** If any of the 6 SimilarityLabel outputs regresses in tests after CAT-13 ships, it is a confidence-gate logic error in the rewire. Run `npx vitest run tests/similarity` immediately after the rewire.

**Phase owner:** CAT-13 phase (Phase 35 or equivalent).

---

### CP-03: Clean-slate DB wipe with user data not exported before DROP

**What goes wrong:** Layer C (Variant split) requires a clean-slate DB wipe so the user can manually curate dedup'd catalog rows. The user's small collection in `watches` needs to survive. The wipe sequence drops `watches_catalog` rows and re-seeds from a clean curated set, then re-links `watches.catalog_id`. If the user's `watches` rows are not exported (or if `watches.catalog_id` FKs are left pointing at to-be-deleted catalog rows before re-link), the user loses their collection or their watches become orphaned.

**Why it happens:** `watches.catalog_id` is nullable `ON DELETE SET NULL`. So a DROP of `watches_catalog` rows does NOT delete the user's watches — it NULLs out the `catalog_id` FKs. This is actually correct behavior. But it requires a deliberate re-link pass after the new catalog seed is in place, or the collection loses all catalog associations (breaks CAT-13 verdicts, breaks `/catalog/{id}` ownership counts, breaks discover surfaces).

**Consequences:** Collection exists but every watch has `catalog_id = NULL`. CAT-14 (SET NOT NULL) cannot be applied until re-link is complete. CAT-13 engine rewire produces empty-collection verdicts (no catalog JOIN hits) for every watch.

**Prevention (exact sequence for Layer C phase):**
1. Export the user's `watches` table as a CSV backup BEFORE any wipe (`SELECT * FROM watches INTO OUTFILE` or `pg_dump --table=watches`).
2. Do NOT drop the `watches_catalog` table. Instead: DELETE the catalog rows that are being replaced, INSERT the curated dedup'd rows.
3. Run `SELECT id, brand, model, catalog_id FROM watches WHERE catalog_id IS NULL` after the wipe to see which watches lost their FK.
4. Run the re-link backfill (`npm run db:backfill-catalog` is idempotent per `WHERE catalog_id IS NULL`) to re-associate watches to the new curated catalog rows.
5. Verify: `SELECT count(*) FROM watches WHERE catalog_id IS NULL` must return 0 before CAT-14 can proceed.
6. If count > 0, these are watches that cannot be matched to any row in the new curated catalog — they need manual assignment or a new catalog row created.

**Detection:** After wipe, `catalog_id IS NULL` count is the progress indicator. Before Layer C ships, run this query against the local DB with a dry-run of the wipe to verify recovery is possible.

**Phase owner:** Layer C phase.

---

### CP-04: Lineage CTE infinite recursion from undirected cycle in `watch_lineage_edges`

**What goes wrong:** `watch_lineage_edges` stores (predecessor_id, successor_id) pairs. If even one cycle exists — e.g., row A says 5513 → 16610 and row B says 16610 → 5513 — then `WITH RECURSIVE lineage AS (...)` will loop forever and the query will either time out or crash the connection.

**Why it happens:** The schema has no CHECK constraint preventing (A,B) and (B,A) from coexisting. Manual data entry of lineage edges (which is the seeding strategy) is prone to accidental reversal. Postgres does not detect lineage graph cycles at INSERT time.

**Consequences:** Any query that traverses the lineage graph (e.g., "show predecessors of this reference") hangs. In Next.js App Router this surfaces as a request that never resolves (timeout, or RSC stream never closes), not a thrown error — hard to debug.

**Prevention:**
- Add a `BEFORE INSERT` trigger on `watch_lineage_edges` that checks for cycle introduction via a bounded recursive query (depth limit: 20 hops is enough for any real watch lineage).
- Alternatively: at INSERT time, query `WITH RECURSIVE check_cycle AS (SELECT predecessor_id FROM watch_lineage_edges WHERE successor_id = NEW.predecessor_id UNION ALL ...) SELECT 1 FROM check_cycle WHERE predecessor_id = NEW.successor_id`. If this returns a row, RAISE EXCEPTION and reject the insert.
- All lineage CTE queries must include a depth counter (`depth INT`, stop at depth > 20) and CYCLE detection (`CYCLE reference_id SET is_cycle USING path` — Postgres 14+ syntax available on Supabase). Supabase runs Postgres 15+; use `CYCLE` clause.
- In the Layer B phase's CONTEXT.md, document that lineage edges are unidirectional: predecessor → successor represents "this reference came before and influenced that one." "Tribute" and "homage" are NOT lineage edges — they are a separate edge type (`relation_type` enum: `'successor' | 'tribute' | 'homage' | 'regional_variant'`).
- Seed lineage data with a seed script that validates the full graph for cycles after each batch insert before committing.

**Detection:** Warning sign: a `/catalog/{id}` page that renders the lineage tree takes more than 2 seconds. Expected render is under 200ms for 10-hop chains.

**Phase owner:** Layer B phase.

---

### CP-05: Variant fragmentation creep resumes post-clean-slate via user_promoted inserts

**What goes wrong:** Layer C dedup collapses "Submariner Date 16610" and "16610 black dial" into one canonical Reference row. But the `upsertCatalogFromUserInput` and `upsertCatalogFromExtractedUrl` helpers use a NULLS NOT DISTINCT UNIQUE on `(brand_normalized, model_normalized, reference_normalized)`. The normalized reference for "16610LV" and "16610 LV" differ after `regexp_replace(lower(trim(reference)), '[^a-z0-9]+', '', 'g')` — actually they collapse to the same string ("16610lv") because the regex strips non-alphanumerics. But "16610 LV" vs "Kermit 16610" vs "16610LV (Kermit)" do NOT collapse the same way.

**Consequences:** Within 6 months of the clean-slate wipe, the catalog fragments again. The taste graph for the recommender (SEED-002) fractions because "16610lv" and "16610lvkermit" are separate Reference rows even though they are the same watch.

**Prevention:**
- In Layer C, establish a written dedup policy (not just schema): model string normalization rules and which fields constitute Variant-level vs Reference-level identity.
- The Variant table (if shipped in Layer C) is the structural prevention: Variants are legitimate differences (dial color, bezel inscription); if "Kermit" and "black 16610" exist as Variants of Reference 16610, they correctly collapse to the same Reference in the taste graph.
- Add a post-insert linter (a cron script or admin page) that runs weekly: `SELECT brand, model, reference_normalized, count(*) FROM watches_catalog GROUP BY brand, model, reference_normalized HAVING count(*) > 1`. This surfaces fragmentation before it accumulates.
- Document in the Layer C CONTEXT.md that user_promoted rows with identical normalized tuples are correctly deduped by the UNIQUE constraint, but rows with slightly different model strings that represent the same watch require manual admin merging. Build a minimal admin merge endpoint in Layer C (merges two catalog rows: reassigns all FK references in `watches`, adopts the winning row's taste data, deletes the loser).

**Detection:** The weekly linter finding count > 0 rows is the warning sign. Any time `/explore` Trending shows the same Reference at multiple ranks under slightly different model strings, fragmentation has occurred.

**Phase owner:** Layer C phase. Linter is ongoing operator tooling.

---

### CP-06: CAT-14 SET NOT NULL applied before zero-NULL verification across two consecutive deploys

**What goes wrong:** `watches.catalog_id` is currently nullable. CAT-14 flips it NOT NULL. If any watch row still has `catalog_id = NULL` at flip time, the ALTER fails with a constraint violation and rolls back. Worse: if the migration is applied in a transaction that also modifies other columns, a partial state may require manual recovery.

**Why it happens:** The backfill is documented as "must be verified across two consecutive deploys" (SEED-004 and PROJECT.md). This verification discipline is easy to skip in practice — it requires two separate deploy-and-check cycles rather than a single migration.

**Consequences:** Migration fails in prod. If the Drizzle migration tracking row was written before the constraint check (depends on transaction ordering), re-running the migration errors with "column already NOT NULL." Manual psql recovery required.

**Prevention:**
- CAT-14 migration must include a pre-flight assertion as the FIRST statement: `DO $$ BEGIN IF EXISTS (SELECT 1 FROM watches WHERE catalog_id IS NULL) THEN RAISE EXCEPTION 'CAT-14 pre-flight failed: % watches have NULL catalog_id', (SELECT count(*) FROM watches WHERE catalog_id IS NULL); END IF; END $$;`
- This is the same DO $$ pattern used in Phase 24 T-24-PRODAPPLY. It fires before the ALTER and rolls back the entire transaction if any NULLs remain.
- Two-deploy verification means: deploy 1 runs the backfill and logs the count; deploy 2 (next day) verifies count is still 0 (no new NULLs from new add-watch operations that missed catalog linkage); only then does deploy 3 include the NOT NULL migration.
- In the v5.0 clean-slate context: the clean-slate gives a fresh start with a fully controlled catalog, making CAT-14 achievable within the milestone. But the two-deploy gate still applies — do not shortcut.

**Detection:** `SELECT count(*) FROM watches WHERE catalog_id IS NULL` must return 0 before CAT-14 migration is written.

**Phase owner:** CAT-14 phase (after Layer C and after backfill verified).

---

## Moderate Pitfalls

Mistakes that cause incorrect behavior or significant rework but not data loss.

---

### MP-01: RLS policies on new hierarchy tables not extended from watches_catalog pattern

**What goes wrong:** `watches_catalog` has public-read RLS (authenticated + anon can SELECT; only service_role can INSERT/UPDATE/DELETE — per CAT-02). The new `brands`, `watch_families`, `watch_variants`, and `watch_lineage_edges` tables are catalog-level data and must share this same public-read policy. If they are created without RLS enabled, or with default Postgres behavior (no row-level policies = anon blocked), then Server Components that render Brand pages or Family browse pages fail with 403/empty results in the browser.

**Why it happens:** Drizzle ORM `pgTable()` does not emit `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` or `CREATE POLICY` statements — these always live in Supabase raw SQL migrations. New tables land without RLS until a follow-up migration adds it. If the phase ships without the RLS migration, the tables appear to work in local dev (Drizzle `drizzle-kit push` does not apply RLS) but fail in prod where Supabase enforces it.

**Prevention:**
- Every new catalog-level table in Layer A/B/C must have its RLS migration in the SAME migration file as the table DDL — not as a follow-up.
- Template: `ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY; CREATE POLICY "Public read brands" ON public.brands FOR SELECT TO anon, authenticated USING (true); CREATE POLICY "Service role write brands" ON public.brands FOR ALL TO service_role USING (true) WITH CHECK (true);`
- The Layer A phase CONTEXT.md must list all four tables (brands, watch_families, watch_lineage_edges, watch_variants) and explicitly confirm RLS policy for each.
- Verify with `has_table_privilege('anon', 'public.brands', 'SELECT')` in the post-migration step of the deploy runbook.

**Detection:** Warning sign: `/explore/families` or a brand page returns empty results when viewed in a private browser (anon session), but works when logged in. This is the classic Supabase RLS miss.

**Phase owner:** Layer A phase for brands and watch_families; Layer B for watch_lineage_edges; Layer C for watch_variants.

---

### MP-02: divestments table vs sold status — wrong choice makes SEED-002 signal unqueryable

**What goes wrong:** SEED-002 requires a "sold (negative): -0.3" signal for the collaborative filtering layer. Currently `watches.status` has a `'sold'` value. If the divestments architecture is "just use status = sold," the sold signal is queryable but lacks the provenance fields needed for the negative-signal layer: specifically, when was the watch sold, what was the sale price, and was it sold vs given away vs traded. Without a timestamp, the -0.3 weight cannot be time-decayed (recent sells are stronger signal than sells from 5 years ago).

**Why it happens:** Adding a `divestments` table feels like over-engineering for a "sold" toggle. But the recommender's signal-extraction layer (SEED-002) needs at minimum: `(user_id, catalog_id, sold_at, sale_price_optional)`. This is exactly a `divestments` table, not a status column.

**Prevention:**
- Prefer a `divestments` table over status-only for Layer D. Schema: `(id uuid PK, user_id FK → users, watch_id FK → watches ON DELETE SET NULL, catalog_id FK → watches_catalog ON DELETE CASCADE, divested_at timestamp NOT NULL DEFAULT now(), sale_price real, divestment_type text CHECK IN ('sold', 'traded', 'gifted', 'lost'))`.
- The `watches.status = 'sold'` enum value can STAY as a convenience UI state (the watch card shows "Sold" in the collection grid), but the recommender signal-extraction query reads from `divestments`, not from `watches.status`.
- Note: `watches.status` already includes `'sold'` as a value (schema.ts line 58). Layer D should ADD the `divestments` table and wire `status = 'sold'` transitions to INSERT a divestments row. Do not try to remove the status value — it's an enum, and enum value removal requires T-24-PARTIDX surgery.
- The key queryable field for SEED-002: `SELECT catalog_id, divested_at FROM divestments WHERE user_id = $userId ORDER BY divested_at DESC` — this is the negative signal query. Make `catalog_id` NOT NULL on `divestments` (unlike watches.catalog_id) because a divestment with no catalog association is meaningless as a recommender signal.

**Detection:** Warning sign in SEED-002 planning: "we'll derive sold signal from watches.status." That path cannot produce a `sold_at` timestamp without createdAt/updatedAt approximations, which are noisy.

**Phase owner:** Layer D phase.

---

### MP-03: updateTag vs revalidateTag wiring missing on new hierarchy mutation paths

**What goes wrong:** Phase 13 documented the `updateTag` vs `revalidateTag` distinction (NOTIF-04). The `/explore` rails use `updateTag` for read-your-own-writes (per-viewer tag) and `revalidateTag` for SWR fan-out (global explore tag). When Layer A adds Brand and Family mutations (admin: create brand, assign family), these mutations touch catalog data that affects Brand pages, Family pages, and possibly `/explore` Trending (if Family-level counts aggregate onto the explore rails).

If the hierarchy mutation Server Actions only call `revalidatePath()` and forget the tag-based cache, the `/explore` Rails page stays stale for up to 5 minutes. If they forget invalidation entirely, the cached Brand/Family page never reflects the edit.

**Prevention:**
- In Layer A/B phases, define cache tag naming convention before writing any mutation. Proposed: `'catalog:brand:{brandId}'`, `'catalog:family:{familyId}'`, `'catalog:lineage:{referenceId}'`.
- Any Server Action that mutates a Brand row must call `revalidateTag('catalog:brand:${brandId}')` AND `revalidateTag('explore', 'max')` if the brand mutation could affect Trending or Gaining Traction counts.
- The Layer A phase CONTEXT.md must include an invalidation matrix (same pattern as Phase 18's Server Action invalidation matrix in the Requirements doc) listing every mutation and every tag it must invalidate.
- Admin-only mutations (brand create/edit) can use `revalidateTag` only (no `updateTag` needed — no per-user read-your-own-writes for admin ops).

**Detection:** Warning sign: edit a brand name in the admin UI and the Brand page still shows the old name after navigating away and back. This is a cache tag miss.

**Phase owner:** Layer A/B phases. Lineage edges in Layer B.

---

### MP-04: Phase 19.1 taste columns disagree after Variant dedup collapses catalog rows

**What goes wrong:** Before Layer C, catalog rows "Submariner Date 16610 (black)" and "Submariner 16610 LV (Kermit)" each have their own Phase 19.1 taste columns (formality, sportiness, heritage_score, etc.), enriched independently by LLM calls. After dedup, one row survives. The surviving row's taste data may have been enriched from the black dial variant's description/photo, not the green Kermit. The Kermit's taste signal (slightly higher sportiness, different era_signal) is lost.

**Why it happens:** The admin merge endpoint (CP-05 prevention) picks a "winning" row and deletes the "loser." There is no mechanism to blend the taste data from two rows.

**Prevention:**
- In Layer C, the admin merge procedure should: compare the two rows' `confidence` scores; if one is materially higher (>0.1 difference), adopt the higher-confidence row's taste data wholesale. If similar confidence, flag the merged row for re-enrichment by setting `confidence = NULL` — this triggers the next `npm run db:reenrich-taste` run to re-enrich from scratch using the canonical Reference description/photo.
- The `reenrich-taste.ts` script already supports `--catalog-id=<uuid>` for individual rows. Add a Layer C merge script that: merges FKs, adopts higher-confidence taste data (or nulls it), and logs a list of merged catalog_ids that need re-enrichment.
- Cost is low: at ~$0.005–$0.013 per row and a small catalog (<500 rows total), re-enriching 20–50 collapsed rows is under $0.65.

**Detection:** Warning sign: after Layer C, a Reference row for a recognizable watch (e.g., the 5513 vintage Submariner) has `primary_archetype = 'dress'` — clearly wrong, suggests the taste data was adopted from a misidentified merge source. Re-enrichment fixes this.

**Phase owner:** Layer C phase.

---

### MP-05: DEBT-09 fix falls into the same hole as the original Phase 23 ship

**What goes wrong:** DEBT-09 is: `addWatch`/`editWatch` in `src/app/actions/watches.ts` do not persist `notesPublic` and do not call `revalidatePath('/u/{username}/{tab}')`. The Phase 23 SUMMARY claimed both shipped via commit `4d362ff` which never reached main. The fix risk is repeating the same pattern: writing the fix in a branch, getting interrupted, and the commit not making it to main before the milestone closes.

**Why it happens:** The original miss was a commit that existed (4d362ff) but was not an ancestor of HEAD — suggesting a rebase or force-push dropped it silently. The RED test scaffold (4/4 FAIL) is now in the repo and will catch any future ship of the fix. But the scaffold only helps if the test suite is run before the phase closes.

**Prevention:**
- In the DEBT-09 fix phase, the RED scaffold (`tests/actions/watches.notesPublic.test.ts`) must be explicitly listed as a success criterion: "4/4 tests must be GREEN at phase close."
- The fix is straightforward (add `notesPublic: z.boolean().optional().default(true)` to `insertWatchSchema` in watches.ts, pass through to createWatch/updateWatch, add `revalidatePath('/u/[username]', 'layout')`). Write the fix against the test scaffold first; verify 4/4 GREEN locally before any other Phase work.
- Do NOT rely on "it was claimed in SUMMARY" — verify via grep: `grep -cnE "notesPublic|notes_public" src/app/actions/watches.ts` must return > 0 before phase closes.
- Add the DEBT-09 fix as Phase 32 (first phase of v5.0, since it is pre-existing carryover that should not be mixed with hierarchy schema work).

**Detection:** The RED scaffold is already there. Any CI run that includes `npx vitest run tests/actions/watches.notesPublic.test.ts` will show 4/4 FAIL until the fix ships. This should be blocked as a merge-gate.

**Phase owner:** v5.0 Phase 32 (carryover patch before hierarchy work begins).

---

### MP-06: Audit methodology produces vibes-check conclusions that later phases cannot cite

**What goes wrong:** The discovery audit (Phase 1 of v5.0 per SEED-004) is meant to answer "which surfaces are dead ends, which overlap, should home and explore combine?" If the audit produces a narrative document with prose conclusions ("the explore page feels redundant"), later phases (33, 34, etc.) cannot deterministically cite it. "Audit said lineage browse is needed" can be disputed. Phases get re-litigated at planning time.

**Why it happens:** Discovery audits naturally produce qualitative output. The temptation is to write a memo. The artifact needed is a falsifiable click-path map with specific YES/NO/DEFERRED decisions per surface.

**Prevention:**
- The discovery audit phase must produce TWO artifacts, both committed to `.planning/`:
  1. A **click-path map** — a table or diagram listing every surface (`/`, `/explore`, `/u/{user}`, `/catalog/{id}`, `/search`, `/watch/{id}`) with all outbound click targets, whether each target exists, and whether it dead-ends.
  2. A **decisions doc** — a table of specific decisions: `"combine home + explore? [YES | NO | DEFERRED]"`, `"lineage browse: urgency [HIGH | MEDIUM | DEFER]"`, `"Family pages: needed before CAT-13? [YES | NO]"`. Each decision row must cite its evidence (e.g., "home page has 0 outbound clicks to catalog — dead end confirmed by click-path map row 2").
- Subsequent phases cite the decisions doc by row ID (e.g., "per audit decision DISC-A-03, lineage browse is HIGH urgency"). This makes the audit falsifiable and prevents re-litigation.
- The audit is READ-ONLY: no code changes, no schema changes. It must be a pure CONTEXT + VERIFICATION output.

**Detection:** Warning sign: the audit phase SUMMARY says "we concluded X" without citing a specific artifact row. If a phase planner later challenges X and there is no row to point at, the audit was not structured correctly.

**Phase owner:** v5.0 Phase 1 (discovery audit, Phase 32 if DEBT-09 is Phase 31.5 or 32 and audit is Phase 33).

---

### MP-07: Nyquist sweep re-validation runs on shipped code but fails to catch the CSS chain blind spot

**What goes wrong:** The v4.1 audit documented a UI-SPEC CSS chain blind spot: the 6-pillar checker validates declared tokens, not whether the CSS chain actually produces the claimed visual contract. Phase 30's black-bar shipped through 6/6 PASS. The Nyquist hardening sweep for v5.0 (targeting Phases 25, 26, 27, 28, 30, 31) will re-run the checker on these phases. If the sweep does not explicitly add CSS chain assertions for aspect-ratio / object-fit phases, it will pass the same blind-spot phases again — and produce false confidence.

**Prevention:**
- For each phase being swept, identify if it touches aspect-ratio, object-fit, or overflow layout properties. If yes, add explicit CSS chain assertions to the VALIDATION.md Wave 0:
  - `aspect-ratio` assertions: confirm the element receives a computed aspect ratio in DevTools (not just a class name in source).
  - `object-fit: cover` on `<video>` or `<img>`: assert `h-full` is present on the element AND on its container when inside an aspect-square wrapper (Phase 30's hotfix pattern).
  - `overflow-x` scroll assertions: confirm `scrollbar-width: none` and `-webkit-scrollbar: hidden` both appear in the rendered CSS, not just as Tailwind classes (Phase 29 ProfileTabs pattern).
- Phase 30 specifically: the VALIDATION.md Wave 0 must cite the hotfix commit (`2dd7377`) and assert the `h-full` fix is present on `<video>` in `CameraCaptureView.tsx`.

**Detection:** Warning sign: a VALIDATION.md passes Wave 0 with 6/6 on a phase that contains `aspect-square` or `object-fit: cover`. Check whether the assertions are on computed styles vs class names in source.

**Phase owner:** Nyquist hardening sweep phase (v5.0 late phase).

---

### MP-08: SET-13 Account Delete leaves orphaned rows in follows, wear_events, notifications, activities

**What goes wrong:** `SET-13` adds an Account Delete / Wipe Collection Danger Zone. The `users` table has `ON DELETE CASCADE` wired to `watches`, `user_preferences`, `profiles`, `follows`, `activities`, `wearEvents`, `notifications`, and `profile_settings`. Deleting the `users` row should cascade to all of these. But `notifications` has two FK columns: `user_id` (the recipient) and `actor_id` (the sender). The `actor_id` FK uses `ON DELETE CASCADE` (schema.ts line 263). If the deleted user was an actor in another user's notifications, those notification rows CASCADE DELETE too — which is correct but may surprise the receiving user (their notifications for follows/overlaps from the deleted user disappear silently).

Additionally: `activities.watch_id` uses `ON DELETE SET NULL` (schema.ts line 223). After cascade delete of the user's watches, the activities rows remain (with watch_id = NULL) even though the user is deleted. This is a data hygiene issue: activities rows for a deleted user_id reference a non-existent user via user_id FK.

**Prevention:**
- The SET-13 phase CONTEXT.md must include a cascade map: which tables have direct FKs to `users`, and what happens on delete. Specifically flag:
  - `activities.user_id` ON DELETE CASCADE: all user's activities deleted. OK.
  - `activities.watch_id` ON DELETE SET NULL: watch_id goes null on activity rows. The activity's user_id FK cascades delete separately, so these rows are deleted via user_id cascade before watch_id can be set null. No orphan.
  - `notifications.actor_id` ON DELETE CASCADE: a deleted user's outbound notifications (follow alerts sent to others) are deleted. This is a side effect on OTHER users' notification inboxes. Document and accept.
  - `wearEvents.watch_id` ON DELETE CASCADE: all wear events deleted. OK.
  - `profiles`: ON DELETE CASCADE from users. Public profile snapshots cached by Next.js caching are NOT cleared by the DB delete. Must `revalidateTag('profile:{username}')` after the user deletion.
- The multi-step confirm UI must show the user what will be deleted (collection, wishlist, wear history, profile). "This will permanently delete [N] watches, [M] wear events, and your public profile" — not just a generic warning.
- Soft-delete is NOT recommended for SET-13. A single user wanting to wipe their account wants hard delete. Soft-delete adds complexity and leaves PII in the database.

**Detection:** Warning sign: after an account delete, another user's notification inbox shows a row for a follow action but the actor's avatar shows a fallback/error. This means the notification row was NOT cascade-deleted (actor_id FK not wiring correctly).

**Phase owner:** SET-13 phase.

---

### MP-09: SET-14 HTML email dark mode and Outlook MSO conditional on branded templates

**What goes wrong:** The existing Supabase Auth email templates (Confirm signup, Reset Password, Change Email) route through Resend at `mail.horlo.app`. A template overhaul (SET-14) introduces branded HTML: Horlo logo, brand colors, improved typography. Apple Mail iOS dark mode inverts colors defined via `background-color` inline styles unless wrapped in `prefers-color-scheme` media queries. Outlook MSO (Office 365 web and desktop) ignores most CSS except inline styles and specific MSO conditional comment syntax.

**Consequences:** Branded email looks correct in Gmail but renders as dark-background-with-dark-text in Apple Mail dark mode (invisible). In Outlook, the layout collapses because flexbox is not supported.

**Prevention:**
- Use table-based layout for the email HTML body (not flexbox/grid). Every cell padded via `cellpadding`/`cellspacing` attributes, not CSS.
- For dark mode: wrap background colors in `@media (prefers-color-scheme: dark)` with a `<style>` block in `<head>`. Apple Mail respects this. Use `!important` on dark-mode overrides.
- Supabase email template `{{ .TokenHash }}` and `{{ .SiteURL }}` variables must remain untouched through the overhaul — they are what triggers Supabase Auth to inject the magic link. Any template that accidentally wraps the link in a `<span>` instead of an `<a>` will break.
- DKIM signature: Resend signs outgoing email at the DKIM level based on the sender domain and API key, NOT based on template content. Changing template HTML does not affect DKIM. The DKIM signature only regresses if the Resend API key or DNS records change. SET-14 template overhaul is safe re: DKIM.
- Test via Resend's test-send feature against a Gmail address AND an Apple Mail address (iPhone) before shipping to prod. Check: does the confirmation link work? Does the layout look correct in dark mode?

**Detection:** Warning sign: confirmation email works (link is valid) but visual review shows black text on black background in Apple Mail. This is the `prefers-color-scheme` miss, not a deliverability issue.

**Phase owner:** SET-14 phase.

---

## Minor Pitfalls

Mistakes that degrade UX or require a follow-up fix but do not lose data or break features.

---

### MiP-01: pg_cron schedule drifts after clean-slate wipe

**What goes wrong:** The `refresh_watches_catalog_counts_daily` pg_cron job (installed by Phase 17, `0 3 * * *`) is registered in `cron.job` table which persists across schema wipes. If the clean-slate wipe drops and re-creates the `watches_catalog` table (not just deletes rows), the cron job's SECDEF function is referencing the old table OID. Re-running `supabase db push --linked` with the pg_cron migration is idempotent (`cron.schedule` uses ON CONFLICT DO UPDATE) but only if the migration file is still in `supabase/migrations/`.

**Prevention:** The clean-slate wipe for Layer C must NOT drop and re-create `watches_catalog`. It must DELETE rows and INSERT replacements. If the table DDL needs changes (e.g., adding `variant_id` FK), those are ALTER TABLE operations, not DROP/CREATE. This preserves the table OID and the cron function reference.

**Phase owner:** Layer C phase.

---

### MiP-02: Sequence values reset after clean-slate wipe create unexpected UUID collisions

**What goes wrong:** `watches_catalog.id` uses `uuid_generate_v4()` (random UUIDs). UUIDs do not use sequences so there is no collision risk. However, if the admin merge script (CP-05 prevention) reuses the surviving row's UUID and a client has that UUID cached in `useWatchSearchVerdictCache` (module-scoped Map), the cache hit returns stale verdict data for the new row.

**Prevention:** After Layer C ships, invalidate the module-scope verdict cache by bumping `collectionRevision` via a write (e.g., add/remove a watch). The `useWatchSearchVerdictCache` key is `(catalogId, collectionRevision)` — if collectionRevision increments, all cache entries for that viewer expire. A simple `touch` write on any watch in the collection accomplishes this.

**Phase owner:** Layer C phase (operator runbook note).

---

### MiP-03: Discovery audit conclusion on "combine home and explore" pre-decided before audit runs

**What goes wrong:** v5.0 planning has strong prior belief that home and explore should merge. If the audit phase CONTEXT.md is written with "expected outcome: merge," the auditor (agent or human) anchors on confirmation and produces a click-path map that supports the conclusion rather than testing it.

**Prevention:** The audit phase CONTEXT.md must explicitly state: "The answer to 'combine home and explore?' is UNKNOWN and must emerge from the click-path map. Do not assume the answer." The audit decision doc (MP-06 prevention) must include a row for this decision that is left blank until the click-path evidence is reviewed.

**Phase owner:** v5.0 Phase 1 (discovery audit).

---

### MiP-04: extractWithLlm body byte-lock (D-07) interacts with CAT-13 enrichment path

**What goes wrong:** Phase 19.1 D-07 locks the `extractWithLlm()` body byte-for-byte. CAT-13 rewires `analyzeSimilarity()` to read catalog taste columns at JOIN time. These are separate code paths: `extractWithLlm` is in `src/lib/extractors/llm.ts` and calls the Anthropic API for URL extraction; `analyzeSimilarity` is in `src/lib/similarity.ts` and runs in-process. The concern is: does CAT-13 need changes to the extraction-time enrichment path?

Answer: No. CAT-13 changes where `analyzeSimilarity` reads taste data FROM (catalog JOIN instead of re-deriving from per-user tag arrays), not HOW taste data gets INTO the catalog. The `extractWithLlm()` extraction path populates `watches_catalog` taste columns via the fire-and-forget `enrichTasteAttributes` call. This path is unchanged by CAT-13. The D-07 byte-lock on `extractWithLlm()` survives CAT-13 intact.

**Prevention:** In the CAT-13 CONTEXT.md, explicitly state: "D-07 byte-lock on `extractWithLlm()` is UNAFFECTED by this rewire. The rewire is entirely within `src/lib/similarity.ts` and the server-side verdict composition layer." Do not touch `src/lib/extractors/llm.ts` during CAT-13.

**Phase owner:** CAT-13 phase.

---

## Phase-Specific Warnings Summary

| Phase Topic | Pitfall | Mitigation Reference |
|---|---|---|
| DEBT-09 fix (v5.0 Phase 32) | Fix commit must reach main — same hole as original miss | MP-05: RED scaffold (4/4) is merge-gate |
| Discovery audit (v5.0 Phase 1) | Vibes-check conclusions, pre-decided merge outcome | MP-06, MiP-03: decisions doc with falsifiable rows |
| Layer A — Brand/Family schema | Brand backfill before family backfill before NOT NULL | CP-01: explicit sequence; pre-flight DO $$ assertion |
| Layer A — Brand/Family schema | RLS policies on new tables omitted (Drizzle doesn't emit them) | MP-01: RLS migration co-located with DDL |
| Layer A — Brand/Family mutations | Cache tag invalidation matrix missing | MP-03: define tag naming before writing mutations |
| Layer B — Lineage edges | Cycles in predecessor/successor graph crash recursive CTEs | CP-04: BEFORE INSERT trigger + CYCLE clause on all lineage CTEs |
| Layer C — Variant dedup/clean-slate | User watches lose catalog_id FK after catalog row wipe | CP-03: exact 6-step re-link sequence; backup first |
| Layer C — Variant dedup | Fragmentation creep resumes via user_promoted | CP-05: weekly linter + admin merge endpoint |
| Layer C — Taste column adoption | Collapsed rows inherit wrong taste data | MP-04: confidence-based adoption + flag for re-enrichment |
| Layer C — Clean-slate | pg_cron function OID breaks if table is dropped/re-created | MiP-01: DELETE rows, not DROP TABLE |
| Layer D — divestments | `watches.status = 'sold'` alone is not recommender-queryable | MP-02: `divestments` table with `catalog_id NOT NULL` |
| CAT-13 engine rewire | Byte-lock invariant needs explicit migration to new invariant | CP-02: new static guard for NULL-confidence fallback path |
| CAT-13 engine rewire | D-07 extractWithLlm byte-lock mistakenly touched | MiP-04: rewire is entirely in similarity.ts |
| CAT-14 NOT NULL | Applied before zero-NULL verification | CP-06: DO $$ pre-flight as FIRST migration statement |
| SET-13 Account Delete | actor_id cascade deletes other users' notifications | MP-08: cascade map in CONTEXT.md; accept as design |
| SET-14 HTML email | Dark mode invisible in Apple Mail, layout collapses in Outlook | MP-09: table layout + prefers-color-scheme; DKIM unaffected |
| Nyquist hardening sweep | CSS chain blind spot passes again on aspect-ratio/object-fit phases | MP-07: computed style assertions, not just class-name assertions |

---

## Sources

- `src/db/schema.ts` — watches, watches_catalog, follows, notifications, wearEvents, users schema
- `src/lib/similarity.ts` — byte-locked engine; signature and export pattern
- `tests/static/CollectionFitCard.no-engine.test.ts` — static guard; guards import boundary not behavioral contract
- `tests/actions/watches.notesPublic.test.ts` — DEBT-09 RED scaffold; 4/4 FAIL reproducible
- `docs/deploy-db-setup.md` — Footguns T-05-06-EMPTYMIGRATE, T-17-BACKFILL-PROD-DB, T-24-PRODAPPLY, T-24-PARTIDX, T-21-PREVIEWMAIL, T-21-WWWALLOWLIST; clean-slate and re-link runbook patterns
- `.planning/seeds/SEED-001` — Variant fragmentation creep note; hierarchy scope; backfill ordering strategy
- `.planning/seeds/SEED-002` — sold negative signal (-0.3); `divestments` table necessity; Reference granularity prereq
- `.planning/seeds/SEED-004` — Audit-first ordering; click-path map requirement; CAT-14 two-deploy gate
- `.planning/milestones/v4.0-MILESTONE-AUDIT.md` — byte-lock documentation across Phases 17/19.1/20; T-24-PARTIDX enum-bound partial index pattern; Phase 17 SECDEF + REVOKE pattern
- `.planning/milestones/v4.1-MILESTONE-AUDIT.md` — DEBT-09 evidence (grep -cnE returns 0); Nyquist partial posture; UI-SPEC CSS chain blind spot (Phase 30 black-bar); verdict cache signOut leak
- `CLAUDE.md` — project_supabase_secdef_grants.md memory; project_drizzle_supabase_db_mismatch.md (prod push = supabase db push --linked, not drizzle-kit push)
