---
gsd_state_version: 1.0
milestone: v8.4
milestone_name: Catalog Brand+Model Canonicalization
status: milestone_complete
last_updated: "2026-07-14T03:00:41.296Z"
last_activity: 2026-07-13 -- v8.4 milestone complete (Phase 82 shipped, all 5 UAT green on prod)
progress:
  total_phases: 5
  completed_phases: 5
  total_plans: 25
  completed_plans: 25
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-24 — v8.4 Catalog Brand+Model Canonicalization STARTED; see §Current State)

**Core value:** A collector can evaluate any watch against their collection and get a meaningful, preference-aware answer about whether it adds something or just duplicates what they already own.
**Current focus:** v8.4 shipped end-to-end; next step is `/gsd-complete-milestone v8.4` to archive and prep for v9.0

## Current Position

Phase: — (v8.4 shipped)
Plan: —
Status: Milestone complete
Last activity: 2026-07-13

**Phase 78 scope preview** (full plan derived by `/gsd-plan-phase 78`):

- CANON-03: `watch_families.aliases text[] NOT NULL DEFAULT '{}'` + GIN containment index
- CANON-04: `brands.needs_review` + `watch_families.needs_review` boolean columns
- MIG-01: `scripts/v8.4-brand-canonicalization.ts` dry-run → writes `.planning/v8.4-brand-merge-decisions.md`
- MIG-05 (portability foundation): `extensions.unaccent` + pinned `SET search_path` per `project_drizzle_supabase_db_mismatch`; full MIG-05 closes in Phase 79

## Deferred Items

Items acknowledged and deferred at v8.3 milestone close on 2026-06-23 (carries forward v8.2's list — SEED-020 dropped because it shipped THIS milestone; 5 new quick_tasks + 1 todo added since v8.2; SEED-008/012/013/015/016 re-classification still pending separately):

| Category | Item | Status |
|----------|------|--------|
| debug | knowledge-base | unknown |
| debug | mobile-title-above-fold | diagnosed |
| quick_task | 260413-qp3-price-prominence-and-filter-collapse | missing |
| quick_task | 260421-rdb-fix-404-on-watch-detail-pages-for-watche | missing |
| quick_task | 260421-srx-wrap-follower-following-counts-in-link-o | missing |
| quick_task | 260424-nk2-fix-phase-15-uat-bug-wywt-rail-and-overl | missing |
| quick_task | 260513-hvu-hotfix-search-watches-tab-returns-empty- | missing |
| quick_task | 260513-m31-fix-otherownersroster-count-label-always | missing |
| quick_task | 260519-08p-fix-next-js-image-aspect-ratio-console-w | missing |
| quick_task | 260519-d69-fix-4-collection-path-ui-issues-in-pathc | missing |
| quick_task | 260519-g4v-fu-02-fix-explore-brands-a-z-letter-anch | missing |
| quick_task | 260519-ga9-fu-01-expose-brand-era-genre-archetype-f | missing |
| quick_task | 260530-e55-srch-03-followup-popup-stay-open-fix | missing |
| quick_task | 260614-f82-seed-explore-page-editorial-content-8-cu | missing (new since v8.2) |
| quick_task | 260620-gk9-backfill-18-catalog-image-urls-delete-te | missing (new since v8.2) |
| quick_task | 260620-lbn-seed-018-surgical-slice-surface-url-extr | missing (new since v8.2) |
| quick_task | 260622-exo-fix-wear-duplicate-day-across-utc-midnig | missing (new since v8.2) |
| quick_task | 260622-lcd-audit-missing-on-local-supabase-migrations | missing (new since v8.2) |
| todo | drizzle-kit-pg-net-introspection-bug | medium priority (new since v8.2) |
| seed | SEED-001-catalog-hierarchy-and-attributes | dormant |
| seed | SEED-002-hybrid-recommender | dormant (future paid-feature candidate per `project_monetization_stance_2026_05_06`) |
| seed | SEED-003-onboarding-cold-start-flow | dormant |
| seed | SEED-004-v5-discovery-north-star | dormant (v5.0 shipped) |
| seed | SEED-005-v6-market-value | dormant (next post-v9.0 candidate; needs SEED-007 spike first) |
| seed | SEED-007-market-pricing-api-spike | dormant (precursor to SEED-005) |
| seed | SEED-008-v5.1-explore-redesign | active — flagged for re-classification (v5.1 shipped) |
| seed | SEED-010-v5.3-add-watch-redesign | dormant — flagged for re-classification (v8.0 shipped this) |
| seed | SEED-012-v6.0-social-interaction | active — flagged for re-classification (v6.0 shipped) |
| seed | SEED-013-v7.0-watch-photos | dormant — flagged for re-classification (v7.0 shipped) |
| seed | SEED-014-cache-components-canonical-sweep | dormant — still future work |
| seed | SEED-015-inline-grid-engagement | dormant — flagged for re-classification (v7.0 Phase 63 shipped) |
| seed | SEED-016-watch-detail-redesign | dormant — flagged for re-classification (v7.0 Phase 64 shipped) |

Total: 33 items (2 debug + 16 quick_task + 1 todo + 14 seed). SEED-020 (wywt-video-3s) is the one v8.3 just shipped — marked `status: shipped, shipped_in: v8.3` in `.planning/seeds/SEED-020-wywt-video-3s.md` and excluded from this list. The 14 seeds represent the forward roadmap + re-classification backlog, not operational debt; SEED-001/002/003/005/007/014 are genuine future work; SEED-008/010/012/013/015/016 are already shipped and need their seed-file `status:` field flipped to `shipped:`. Quick tasks are long-tail backlog (oldest from April 2026) consistent with the `project_next_clear_operational_debt` pattern across v6.0 / v7.0 / v8.0 / v8.1 / v8.2 closes.

## Performance Metrics

- Phase 81 P02: ~17min, 2 tasks (both auto+tdd), 4 files modified (2 src + 2 tests), 2 commits (95e090e3 + a28a6615), 4 requirements marked complete (RECO-01/02/03/04 close read-path); 2 auto-fixes (1 Rule-3 Task 1 build-boundary glue in src/data/recommendations.ts + 1 Rule-1 grep-armor comment reword — recurrence of Plan 01 Task 2 pattern); `npm run build` ✓ in 7.3s; 24/24 targeted vitest suites pass (11 lib + 13 DAL); grep armor `= ANY(` = 0 across src/data/recommendations.ts + src/lib/recommendations.ts; innerJoin brands|watchFamilies = 4 matches; sql.join = 5 matches; excludeKey|norm( = 7 matches; brandNameLookup Map construction verified INSIDE getRecommendationsForViewer body (T-81-P02-01 satisfied).
- Phase 81 P01: ~12min, 2 tasks (both auto), 19 files modified (6 src + 2 scripts + 11 tests), 2 commits (ea893912 + aa5df614), 0 requirements marked complete (DISP-01/02 close in Plan 03 — Plan 01 is foundation only), 3 auto-fixes (2 Rule-3 script callsites surfaced by build per `[[reexport-only-doesnt-bind-locally]]` + 1 Rule-1 grep-armor comment reword); `npm run build` ✓ in 7.8s; 19/19 targeted vitest suites pass; grep armor `= ANY(` = 0 across all 6 core files.
- Phase 76 P04: ~8min executor portion, 2 of 3 tasks complete (Task 3 operator-blocked), 3 files (1 created `76-POST-DEPLOY.md`, 1 created `76-04-SUMMARY.md`, 1 modified `76-VALIDATION.md`), 7/7 phase reqs verified green (VID-07/08/09/10/11/12/16); no deviations. `npm run build` ✓ in 5.5s; 4 targeted vitest invocations all green (2 env-skipped, 2 pass — 15/15 tests pass for the run ones); 2 grep-based VID-15 regression guards = 1.
- Phase 76 P03: ~20min, 3 tasks, 3 files (2 modified, 1 created), 5/5 reqs (VID-07, VID-08, VID-09, VID-10, VID-16 — VID-07 + VID-16 were already complete from P02 but the Server Action enforces them server-side); 1 auto-fix (mockStorage `.list()` two-arg signature)
- Phase 76 P02: ~10min, 2 tasks, 2 files (1 modified, 1 created), 2/2 reqs (VID-07, VID-16); no deviations
- Phase 76 P01: ~35min, 4 tasks, 4 files (1 modified, 3 created), 2/2 reqs (VID-11, VID-12); 1 auto-fix (drizzle .cause.code unwrap pattern documented)
- v8.2: 1 phase (75), 2 plans, ~2h code, 14 commits, 2/2 reqs (close held 10 days for DISC-RECS-VARIATION rotation observation)
- v8.1: 3 phases (72-74), 5 plans, 1 day, 47 commits, 6/6 reqs (all bundled prod UAT items passed)
- v8.0: 6 phases (66-71), 22 plans, 2 days, 150 commits, 39/39 reqs
- v7.0: 7 phases (59-65), 29 plans, 4 days, 244 commits
- 34/34 v7.0 requirements shipped (ROUTE 6, PHOTO 9, WPIC 6, GRID 5, PAGE 4, FOLL 4)
- src/ +5,057 / −628 LOC across 65 files; tests/ +3,982 / −502 LOC across 33 files
- Phase 65 prod UAT: 9 pass / 1 skip / 0 issues
- Blockers encountered: 0
- v6.0 (prior): 8 phases (53-58 + 56A + 57.1), 37 plans, 3 days; 34/34 reqs shipped

## Accumulated Context

### Key Decisions

**Phase 81 P05 (Plan 05, scope patch) — same-family + lineage rail canonical display (2026-07-13):**

- CONTEXT.md § Deferred Ideas revisit-trigger fires: "Read-time JOIN in `topUpFromCatalogPopularity` closes the display-drift bug on the home rail. If drift becomes visible in other surfaces post-Phase-81, revisit as a Phase 82+ concern." Discovered during Plan 04 D-81-04 walkthrough step (i) 2026-07-13 — RECO-01 exclusion on the home rail passed; drift denorm strings still visible on the watch detail page's same-family section. Tyler elected to fold the scope patch into Phase 81 as Plan 05 rather than defer.
- `getSameFamilyForCatalog` (`src/data/hierarchy.ts` L61+): INNER JOIN brands (on watches_catalog.brand_id) + watch_families (on watches_catalog.family_id); SELECT projection `brand: brands.name, model: watchFamilies.name` in place of `watchesCatalog.brand` / `watchesCatalog.model`; GROUP BY substitutes the canonical columns for the denorm; ORDER BY tiebreak substitutes `asc(brands.name)` + `asc(watchFamilies.name)`.
- `getLineageForReference` recursive CTE (L108+): BOTH the seed arm and the recursive arm gain `JOIN brands b ON b.id = wc.brand_id` + `JOIN watch_families f ON f.id = wc.family_id`; SELECT projection `b.name AS brand, f.name AS model` swapped in both arms. Pitfall 5 (both-arms invariant) extended from `wc.image_url` to `b.name` + `f.name`. CYCLE clause + depth-10 guard untouched.
- Public interfaces `SameFamilyWatch` + `LineageRow` unchanged — field names + types identical; only projection sources changed.
- 2 Rail components (`SameFamilyRail.tsx`, `LineageRail.tsx`) untouched — they consume `.brand` / `.model` by name and now receive canonical strings automatically.
- Live psql smoke against drift fixture `90c4ac1f-…4af4` (denorm `Hamilton Watch / DriftTest Chrono` on canonical Hamilton brand_id) confirms canonical `Hamilton / Khaki Field Mechanical` under the new JOIN pattern.
- Forward armor: `= ANY(` grep at 0 in `src/data/hierarchy.ts`; Plan 02 pattern parity greps all pass (`innerJoin(brands` = 1, `innerJoin(watchFamilies` = 1, `JOIN brands b` = 2, `JOIN watch_families f` = 2).
- `npm run build` exits 0 after both tasks. Zero deviations — plan executed exactly as written.
- 0 new requirements marked complete: RECO-01/RECO-04 already closed at Plan 02 boundary; scope patch is a re-application of the same pattern to two additional read surfaces (idempotent w.r.t. requirement completion).

**Phase 81 P02 (Plan 02) — recommender read-path canonical FK swap (2026-07-12):**

- topBrandOf signature widened per D-81-05: `(watches, brandNameLookup: Map<string,string>) => { brandId, brandName } | null`. Filter now `w.status === 'owned' && w.brandId` (legacy brandId=undefined excluded from counting); tiebreak by resolved brandName ASC via lookup; defensive null-return when lookup misses winner (Pitfall 6).
- RationaleContext gains `viewerTopBrand: { brandId, brandName } | null` — DAL pre-computes once, threads through per-candidate rationaleFor ctx (avoids N² compute). `rationaleFor` reads `ctx.viewerTopBrand?.brandName` in the brand-match template (was: internal `topBrandOf(ctx.viewerOwnedWatches)` per candidate).
- Module-scope `excludeKey(w)` helper reads `${brandId}|${familyId}` when both FKs present, `${brand.trim().toLowerCase()}|${model.trim().toLowerCase()}` fallback for the ON DELETE SET NULL legacy case (D-81-02). Called at 3 sites: viewer exclusion loop + candidateMap keying (via `norm = excludeKey` alias) + synthetic Watch keying inside topUpFromCatalogPopularity — Pitfall 5 identity guarantee by construction.
- brandNameLookup Map built INSIDE getRecommendationsForViewer body from `SELECT id, name FROM brands WHERE id IN (…viewer's brandIds…)` — never at module scope (T-81-P02-01 cross-viewer poisoning mitigation). Empty viewerBrandIds guard (Pitfall 2 — `sql.join([], …)` would emit invalid `IN ()`).
- `viewerOwnedBrandsLower: Set<string>` (lowercased brand text) REPLACED by `viewerOwnedBrandIds: Set<string>` (canonical brand UUIDs). Owned-brand IN clause switches from `lower(trim(watches_catalog.brand)) IN (…strings…)` to `${watchesCatalog.brandId} IN (${sql.join(brandArr.map(id => sql\`${id}\`), sql\`, \`)})` — anti-pitfall correct shape per [[drizzle-sql-any-array-pitfall]]. Closes RECO-02 literally: Hamilton + Hamilton Watch both trigger +100 boost against canonical Hamilton brand_id.
- topUpFromCatalogPopularity: both SELECTs INNER JOIN brands + watch_families (safe under Phase 80 NOT NULL guarantee); project `brand: brands.name, model: watchFamilies.name, brandId: watchesCatalog.brandId, familyId: watchesCatalog.familyId`. Popularity tiebreak switched from denorm `watchesCatalog.brand` to canonical `brands.name`. Synthetic Watch adds `brandId + familyId` from JOIN row (Pitfall 5 mitigation — the exact class of bug Phase 81 exists to close).
- brandCount variety cap keys on canonical brand_id (fallback to lowercased-brand-string for legacy peer-pool watches without brandId).
- 4 requirements marked complete: RECO-01/02/03/04.
- 2 Rule 1/3 auto-fixes: (1) Task 1 build-boundary glue in src/data/recommendations.ts to satisfy `npm run build` exits 0 at Task 1 done gate; Task 2 replaced the glue with real brandNameLookup wire-up. (2) grep-armor comment reword (recurrence of Plan 01 Task 2 pattern) — 2 in-file comments used the literal `= ANY(${arr})` in prose and false-positive-tripped the forward-armor grep; reworded to `Drizzle sql-ANY-array anti-pattern intentionally NOT introduced`.

**Phase 81 P01 (Plan 01) — foundation type + DAL widening (2026-07-12):**

- Watch domain type gains optional `brandId?: string` + `familyId?: string` (D-81-02); projected via LEFT JOIN in getWatchesByUser + getWatchById with `?? undefined` at the map() boundary.
- CatalogEntryWithCanonical (extends CatalogEntry) exposes `canonicalBrand` + `canonicalFamily` via LEFT JOIN on brands + watch_families in getCatalogById (D-81-01). Additive-safe — all 6 existing callers unchanged.
- upsertCatalogFromUserInput + upsertCatalogFromExtractedUrl return shape widens from `string | null` to `{ catalogId: string; brandName: string; familyName: string } | null` via extended CTE + constant-column subselects (D-81-01 Option A single round-trip).
- 7 upsert callsites updated (5 planned per RESEARCH Pitfall 3 + 2 script callsites surfaced as Rule 3 blocking auto-fixes by `npm run build` — matches `[[reexport-only-doesnt-bind-locally]]` pattern).
- No requirements marked complete — Plans 02/03 close RECO-01..04 + DISP-01/02.

**v8.4 Catalog Brand+Model Canonicalization — locked decisions from SEED-021 + kickoff:**

- **D-01 (v8.4)**: `brands.name` is the canonical brand string; `watch_families.name` is the canonical model/family string. `watches_catalog.brand|model` and `watches.brand|model` become denormalized display copies, auto-overwritten from FK targets on every write.
- **D-02 (v8.4)**: On every `addWatch` / `editWatch` / catalog upsert, denormalized brand+model strings are auto-overwritten from resolved canonical names. No free-text drift on display surfaces.
- **D-03 (v8.4)**: Wire `watch_families.id` FK on `watches_catalog` + add `watch_families.aliases text[]` for typo/abbreviation cases (`Brut Date` → `Brut Datejust`). NO new `models` table — `watch_families` already plays that role (Phase 34 D-01). SEED-001 Variant + Individual layers remain future work.
- **D-04 (v8.4)**: Backfill conflict resolution via operator-resolve queue at `.planning/v8.4-brand-merge-decisions.md`. Auto-map exact-normalized matches; ambiguous cases (`Hamilton` vs `Hamilton Watch`, `Omega` vs `OMEGA`, `Héron` vs `Héron Watches`) queued for manual operator decision BEFORE the data migration runs.
- **D-05 (v8.4)**: Ingest fuzzy-match-then-create — `/api/extract-watch` looks up exact match first, then `pg_trgm` `similarity > 0.6` fuzzy, then auto-creates new row with `needs_review: true`. Same path for `watch_families` (including `aliases` containment check).
- **D-06 (v8.4)**: Recommender reads `brand_id` via JOIN through `watches.catalogId → watches_catalog.brand_id`. No new column on `watches` (CANON-V2-01 denormalization deferred — JOIN cost acceptable per Phase 19.1 baselines). Rationale templates read canonical `brands.name`, not free-text.
- **D-07 (v8.4)**: Operator-review queue surfaces in `/admin/brands` + `/admin/families` views (reusing v5.1 admin CMS pattern from Phase 47). Confirm / rename / merge-into-existing actions. No CLI required.
- **D-08 (v8.4)**: Backfill migration is reversible in dry-run mode (writes proposed mappings to `.md` artifact for operator review BEFORE the data UPDATE runs). Post-flight assertion uses a DIFFERENT predicate from the UPDATE's WHERE-clause (per `project_post_flight_assertion_predicate_divergence`).
- **Phases 78-80 are DB-touching**: `workflow.use_worktrees=false` already set globally (per `project_next_clear_operational_debt`); migration push pattern is local `drizzle-kit push` for `npm run dev` verification + hand-written `supabase/migrations/*.sql` + `supabase db push --linked` for prod (per `project_drizzle_supabase_db_mismatch`).
- **Phase 79 is the high-risk phase**: data-write backfill on production catalog. The MIG-04 post-flight assertion + the MIG-01 dry-run `.md` artifact are the two safety nets; both are required.
- **Phase 80 sequencing is non-negotiable**: ingest hardening (INGEST-01..04) must land in the SAME migration push as the NOT NULL flip (CANON-01/02), or the first post-flip extract will crash with a 23502 not-null violation.

**v8.3 WYWT Video — locked decisions from SEED-020 + Spike 001:**

- **D-01 (SEED-020)**: Wrist-rotation is linear motion — NOT a boomerang. Accept a visible loop snap on `/wear/{id}` autoplay-muted-loop; no ping-pong post-processing.
- **D-02 (SEED-020)**: Static poster + play-icon overlay in all feed/rail surfaces; tap navigates to `/wear/{id}` which autoplays inline. No in-feed autoplay.
- **D-03 (SEED-020)**: Either-or per post — `media_type: 'photo' | 'video'` column on `wear_events`; never both.
- **D-04 (SEED-020)**: Hard 3-second cap; auto-stop via `setTimeout(stop, 3000)` client-side + ~5 MB server-side size cap.
- **D-05 (SEED-020)**: Audio disabled — `MediaRecorder` configured with `audio: false`.
- **D-06 (SEED-020)**: WYWT-only in v8.3; watch-detail-page carousel (`/w/[ref]`) stays photo-only.
- **D-07 (SEED-020)**: Storage paths: `{userId}/{wearEventId}.mp4` + `{userId}/{wearEventId}-poster.jpg` in existing `wear-photos` bucket. Server constructs paths — client never supplies them (Phase 15 T-15-17 pattern).
- **D-08 (SEED-020 + Spike 001)**: Poster frame default = `currentTime = video.duration * 0.75` (3/4 through clip = "completed angle" moment for wrist rotation). User-pick scrubber deferred to v2.
- **D-09 (SEED-020 + Spike 001)**: Codec = H.264 mp4 (`video/mp4;codecs=avc1`). Force mp4 on Chrome 121+ via mimeType; webm fallback only if mp4 MediaRecorder unsupported. Storage extension `.mp4` always.
- **Spike 001 empirical results**: iOS 26.6 Safari — `mp4+avc1: true`; clip = `video/mp4; codecs=avc1.42000a` (Baseline Profile L1.0); auto-stop at 3010ms (10ms overshoot — within tolerance); poster canvas JPEG = 169KB at 720×1280; file size = 3.6 MB for 3s 720p portrait; autoplay-muted-loop+playsInline confirmed inline (no fullscreen takeover).
- **`playsInline` is mandatory**: MUST be set on every `<video>` rendering wear-event videos — in feed/rail tiles AND on `/wear/{id}` — or iOS goes fullscreen on play.
- **Phase 76 is DB-touching**: `workflow.use_worktrees=false` already set globally (per `project_next_clear_operational_debt`); applies here. Migration uses `supabase db push --linked` for prod (per `project_drizzle_supabase_db_mismatch`).
- **Phase 15 threat-model analogs**: T-15-04 (probe both Storage objects before INSERT) → VID-08; T-15-17 (server-constructed path only) → VID-16; T-15-18 (best-effort delete on INSERT failure) → VID-10.
- **Spike cleanup**: `src/app/spike-mr-capture/` must be deleted in Phase 77 (or earlier — throwaway code per Spike 001 README cleanup instructions).

**Phase 77 Plan 01 (Wave 0 foundation) outcomes — 2026-06-23:**

- **T-77-01 closed**: `src/app/spike-mr-capture/` (367-line throwaway page from Spike 001) removed via `git rm` (commit `75b00386`). No redirect / replacement — 404 is the correct end state for a never-user-facing spike route. Vercel's next deploy publishes 404 for `/spike-mr-capture`.
- **Wave 0 RED stub convention**: every Wave 0 stub uses `// Wave 0 RED stub — Phase 77 / 77-01-PLAN.md` as its first-line marker + vitest imports + `describe()` + `it.todo()` callsites + one sanity `it()` so vitest discovery returns a positive 1-passed signal per file (suite total: 11 passed | 32 todo | 0 failed across the 11 stubs).
- **`it.todo` not `it.skip`**: Vitest 3 reports `it.todo(...)` as `↓ todo` rather than `× failed`, keeping the red/green signal pristine for downstream feedback loops.
- **Commented-import escape hatch**: `tests/unit/mediaState.test.ts` keeps the `MediaState` import COMMENTED out (`// TODO Plan 02: import type { MediaState } from '@/lib/wywtTypes'`) so Wave 0 does not depend on Plan 02 (would block its own preconditions). Plan 02's task list literal-greps for this comment to perform the uncomment step.
- **`wave_0_complete: true`**: 77-VALIDATION.md frontmatter flag flipped — gate for Plan 02+ satisfied (commit `b0cdd52c`).

**Phase 78 Plan 01 (Wave 0 RED stubs) outcomes — 2026-06-25:**

- **7 Wave 0 RED stub files seeded** under `tests/static/`, `tests/integration/migrations/`, `tests/integration/scripts/`, `tests/unit/scripts/` per `78-VALIDATION.md` §Wave 0 Requirements (commits `d0ea806b` Task 1 / `15b2e19e` Task 2 / `e1d26133` Task 3).
- **Convention generalizes beyond components**: Phase 77's Wave 0 RED stub pattern (`// Wave 0 RED stub — Phase X / X-01-PLAN.md` first-line marker + sanity `it()` + `it.todo()` callsites) applies cleanly to non-component domains — DB schema-shape static fs-guards + DB introspection integration stubs + tsx-script unit + integration tests all use the same shape.
- **DATABASE_URL-gated suites use `describe.skip` for positive discovery signal**: 3 of 7 stubs (78-gin-index, v8.4-brand-canonicalization, v8.4-readonly) use `const maybe = process.env.DATABASE_URL ? describe : describe.skip` so vitest reports the suite as `↓ skipped`, not failed, when env is unset. Full Wave 0 suite run: 4 passed | 3 skipped | 29 todo | 0 failed.
- **Decision-ID citation pattern**: every `it.todo` literal cites the relevant D-78-XX or B-78-01 in the assertion string for downstream verifier traceability (D-78-04 in SEED-021 golden, D-78-05 in readonly, D-78-07 in regenerate-merge).
- **78-VALIDATION.md**: `wave_0_complete: false → true`, `nyquist_compliant: false → true`; "File Exists" column flipped `❌ W0 → ✅ W0` on 7 stub-backed rows (78-01-01, 78-01-02, 78-02-01..05); row 78-01-03 stays `❌ W0` (manual `supabase db push` step has no stub file mapping).
- **No deviations** — Plan 01 executed exactly as written.

**Phase 78 Plan 03 (Wave 2 dry-run script + first artifact) outcomes — 2026-06-25:**

- **`scripts/v8.4-brand-canonicalization.ts` shipped** (commit `31c24c92`). 4-stage read-only dry-run: (1) connection bootstrap + `SET search_path = public, extensions`, (2) `SELECT DISTINCT brand FROM watches_catalog LEFT JOIN brands` for exact-match auto-resolve, (3) per-row `word_similarity > 0.5` fuzzy candidates for unresolved rows, (4) GFM table emission to `.planning/v8.4-brand-merge-decisions.md`. Exports 6 pure functions (parseArgs, formatCell, buildRow, buildTableRows, parseExistingPreserved, mergeForward) + 3 types for unit-test importability. `main()` argv-match-guarded so test imports don't spawn DB connection. MIG-01 complete.
- **Cross-env extension-schema portability via SET search_path at connection time** (new pattern): local Supabase has pg_trgm + unaccent in `public` schema; prod has them in `extensions`. Hardcoding `extensions.word_similarity(...)` per R-FIND-02 would fail locally with `42883`. Fix: `await sql.unsafe('SET search_path = public, extensions, pg_catalog')` once on the fresh postgres-lib connection makes unqualified `word_similarity` resolve correctly in both envs. Extends `[[supabase-extension-schema-function-pin]]` (which covers migration / index-build time) to runtime postgres-lib script execution. The literal string `extensions.word_similarity` is preserved in the header docstring for traceability.
- **PLAN.md `DISTINCT ON (brand_normalized)` would have silently collapsed B-78-01 Omega/OMEGA case-drift** — caught in Task 1 smoke (only one Omega row emitted when smoke acceptance required 2). Changed to plain `SELECT DISTINCT` so case-variants both surface with same `proposed_target_id`. Internal contradiction in PLAN.md (Task 1 step 3 vs acceptance smoke step #5) resolved in favor of the smoke step which captures B-78-01 intent.
- **D-78-05 grep guard false-positive on `DELETE` as English verb** in user-facing strings — `DO NOT delete the file` matched `grep -iE "(INSERT|UPDATE|DELETE)[[:space:]]"`. Renamed `delete` → `remove` in 3 user-facing string literals to satisfy the guard with no semantic loss.
- **Plan 01 stubs all greened**: 5 files / 27 tests / 0 todo / 0 failed (commit `2b78d51c`). Includes the B-78-01 case-collapse Test 5 in `v8.4-seed021-golden.test.ts` (both Omega and OMEGA rows assert `status=auto-resolved` + SAME `proposed_target_id`). Integration tests backup/restore the `.planning/v8.4-brand-merge-decisions.md` working file to avoid clobbering operator state during test runs.
- **First-generated `.planning/v8.4-brand-merge-decisions.md` committed** (commit `cf67b566`): 53 brand rows / 19 auto-resolved / 34 needs-review. SEED-021 verification: Hamilton Watch → needs-review with `hamilton (0.60)` candidate; Omega + OMEGA → BOTH auto-resolved with same `cf2bc26e-...` proposed_target_id per B-78-01. Local catalog has 5 of 8 SEED-021 strings (Hamilton, Hamilton Watch, Héron Watches, Omega, OMEGA; missing Héron / Brut Date / Brut Datejust).
- **D-78-05 read-only invariant verified end-to-end**: pre/post `brands` count (19) + `max(updated_at)` byte-identical across script invocations.
- **Full Phase 78 test sweep**: 7 files / 35 tests / 0 failed; `npm run build` exit 0.
- **3 deviations** all Rule 1 (auto-fix): extensions.word_similarity portability, DISTINCT ON → DISTINCT, DELETE-as-English-verb grep collision. Documented in `78-03-SUMMARY.md`.

**Phase 79 Plan 01 (Wave 0 RED stubs for v8.4 apply path) outcomes — 2026-06-25:**

- **6 Wave 0 RED stub files seeded** under `tests/unit/scripts/` (4 files) and `tests/integration/scripts/` (2 files) per `79-VALIDATION.md` Per-Task Verification Map (commits `9b0dca9c` Task 1 / `45190d5d` Task 2 / `8eb7750b` Task 3).
- **Convention generalizes cleanly to integration-tier**: Phase 78's Wave 0 RED stub pattern (first-line marker + sanity `it()` + decision-ID citations) extended to DATABASE_URL-gated integration suites by placing the sanity `it()` callsite OUTSIDE the `maybe(...)` wrapper. Vitest reports the integration files as `passed` regardless of env state (sanity test always runs); the `it.todo` callsites surface from the maybe-suite as `↓ skipped` (DATABASE_URL unset) or `↓ todo` (DATABASE_URL set).
- **Commented-import escape hatch (Phase 77 → 78 → 79)**: 6/6 stubs reference Plan 02/03/04 NEW exports as `// TODO Plan NN: uncomment when X export lands` markers — Wave 0 does not depend on downstream exports landing first.
- **Decision-ID citation pattern**: every `it.todo` literal cites the gating `D-79-NN` or `MIG-NN` / `DISP-NN` token in the assertion string; the 12-check grep-gate in 79-VALIDATION.md returns `PASS — all 12 checks present`.
- **`79-VALIDATION.md`**: `wave_0_complete: false → true`, `nyquist_compliant: false → true`, `status: draft → ready-for-plan-02`; Per-Task Verification Map fully populated with 15 rows (one per REQ-ID / D-79-NN grouping per 79-RESEARCH.md L1191-1208); File-Exists column flipped to `✅ W0` on every row.
- **Full Phase 78 + Phase 79 sweep**: 9 files passed / 25 tests passed / 8 skipped / 39 todo / 0 failed. `npm run build` exit 0.
- **No deviations** — Plan 01 executed exactly as written.

**Phase 79 Plan 02 (Wave 1 brand apply scaffold) outcomes — 2026-06-25:**

- **`scripts/v8.4-brand-canonicalization.ts` extended 345 → 873 LOC** (commits `501d19db` Task 1 / `e10fbbb0` Task 2 / `1120fafd` Task 3). Lands isLocalDatabaseUrl + extended parseArgs (--apply, --mode=brands|families|both) + confirmIfProd + slugify + ApplySummary + ResolvedBrand discriminated union + BrandDecisionMap + BrandDecisionRow + parseDecisionsTable + buildBrandMap + strictPreflightGate (brand-only scope) + idempotentReRunGate + applyBrandPath. main() now dispatches on args.apply: --apply runs idempotentReRunGate → strict gate → confirmIfProd → applyBrandPath inside its OWN sql.begin (TRANSIENT — Plan 04 restructures into ONE outer sql.begin wrapping brand + family + alias + hydration + post-flight per D-79-03).
- **Plan 02's sql.begin wrapper is INTENTIONALLY TRANSIENT.** Plan 04 will REPLACE it with one outer transaction containing all 6 apply steps. The seam is clearly commented in the code so the Plan 04 executor can find + restructure it without grep guessing.
- **D-79-01 strict pre-flight gate brand-only scope landed.** 4 refuse cases + 1 PASS case green in `tests/unit/scripts/v8.4-strict-gate.test.ts` (6 brand + 1 sanity + 2 family it.todo for Plan 03). Family cases (d-family merge target check, f live-(brand,model) drift check) wait for the parallel FamilyDecisionMap shape in Plan 03.
- **D-79-02 host-detect with fail-closed semantics.** All 7 cases green in `tests/unit/scripts/v8.4-host-detect.test.ts` (8 tests / 0 todo / 0 failed). Unparseable URLs + alt-port + empty string ALL return false (safety bias — prod confirmation prompt fires).
- **D-79-04 idempotent re-run gate FIRES BEFORE the strict gate.** Cheaper exit on no-op re-run; the strict gate's catalog SELECT DISTINCT is more expensive than the simple count(*) the re-run gate does.
- **Forward armor preserved end-to-end:** `grep -c "= ANY("` returns 0; the strict gate's lone DB existence check is dependency-injected (existingBrandIdsFn) and the main() callsite uses postgres-lib `sql(uuids)` helper form per `[[drizzle-sql-any-array-pitfall]]`. Documented in JSDoc with the pattern name (not the forbidden literal).
- **Phase 78 dry-run path 100% backward-compatible.** `npm run db:v8.4-brand-canon -- --force` against local DB still emits 55 brand rows (operator file backup/restored around the smoke).
- **4 deviations all Rule 1 (auto-fix):** (1) `export async function strictPreflightGate` doesn't match the plan's literal `export function` grep regex — substantive intent (3 new exported helpers) is met. (2) applyBrandPath Step 4.2 type-narrowing — TS flow analysis can't carry post-invariant narrowing across for-of; added explicit runtime guard. (3) postgres-lib UpdateResult `.count` cast — typed `Promise<Array<{id}>>` doesn't carry runtime `.count`; cast on consume. (4) Comment-removed `= ANY(${arr})` literal to keep forward-armor grep at 0. Documented in `79-02-SUMMARY.md`.
- **Full test sweep:** 27 files / 507 passed / 14 todo / 0 failed (tests/unit/scripts + tests/static); `npm run build` exit 0.

**Phase 79 Plan 03 (Wave 2 family dry-run + applyFamilyPath definition) outcomes — 2026-06-25:**

- **`scripts/v8.4-brand-canonicalization.ts` extended 873 → 1643 LOC** (commits `4c7a7f4b` Task 1 / `21b3a753` Task 2 / `66820328` Task 3). NEW exports: FamilyRow, FamilyDecisionRow, ResolvedFamily, FamilyDecisionMap, FamilyDecision, buildFamilyRow, buildFamilyTableRows, parseFamilyDecisionsTable, parseCompositeKey, buildFamilyMap. NEW non-exported helpers: buildFamilyHeader, parseExistingFamilyPreserved, familyDryRun, applyFamilyPath.
- **D-79-07 in-memory brand→family chain (Option 2) landed.** `--mode=families` dry-run reads `.planning/v8.4-brand-merge-decisions.md` in-memory, builds the BrandDecisionMap, then emits `.planning/v8.4-family-merge-decisions.md` deduped on canonical brand identity. Family dry-run does NOT require brand `--apply` to have run first.
- **Canonical-brand-identity dedup must be keyed on UUID, NOT brand_norm string** (Rule 1 deviation caught at local smoke). The BrandDecisionMap's `merge` entries store `canonicalName = row.brand_raw` (source raw, not target canonical — there's no target-canonical name field available at parse time). With brand_norm-string keying, `Hamilton Watch` and `Hamilton` dedup'd separately. Fixed by switching to UUID identity keying + a separate `canonicalNameByUuid` map for display. Post-fix smoke: 0 `Hamilton Watch` rows + 8 `Hamilton` rows under canonical leading column in the emitted family file (out of 164 family rows / 21 auto-resolved / 143 needs-review against local catalog).
- **D-79-05 family dry-run read-only invariant verified.** Phase 78 `v8.4-readonly.test.ts` still passes (5/5) against local DB — family dry-run is read-only by construction (SELECT-only).
- **D-79-01 strict pre-flight gate extended with 4 family refuse cases** (Task 2). strictPreflightGate signature: brandRows + existingBrandIdsFn + (NEW) familyRows + existingFamilyIdsFn, both new params with safe defaults so Plan 02 brand-only callsites stay backward-compatible. Family refuse cases: needs-review, unknown token, merge:<uuid> family target missing from watch_families.id, live catalog (brand, model) triple absent from family decisions file.
- **applyFamilyPath defined but NOT wired into main()** per spec (Task 3). 3-step shape per RESEARCH § Code Examples L727-770: Step 4.3 INSERT new families RETURNING id + reify map + Pitfall 3 invariant check; Step 4.4 idempotent alias-append via `WHERE NOT (aliases @> ARRAY[$src]::text[])` (D-79-06 / T-79-04 mitigation); Step 4.5 catalog family_id UPDATE JOIN-scoped by brand_id + model_normalized (MIG-03). Plan 04 wraps applyBrandPath + applyFamilyPath + hydration + post-flight in ONE outer sql.begin per D-79-03.
- **Plan 01 stub greens:** v8.4-family-build-decisions.test.ts (5 it.todo → 5 it() / 6 pass / 0 todo / 0 failed); v8.4-strict-gate.test.ts (2 family it.todo → 2 it() + 1 NEW combined PASS test / 9 pass / 0 todo / 0 failed).
- **Forward armor preserved:** `grep -c "= ANY("` returns 0 (re-applied Plan 02's comment-rephrase to applyFamilyPath JSDoc — Rule 1 deviation); 0 `process.exit` inside sql.begin callbacks; `npm run build` exit 0.
- **MIG-03 marked complete** in REQUIREMENTS.md (family backfill function definition + dry-run end-to-end; full integration verification in Plan 04 + Plan 05).
- **2 Rule 1 deviations** documented in 79-03-SUMMARY.md: (1) dedup-by-UUID-not-norm-string bug caught at local smoke; (2) comment-rephrase to keep `= ANY(` grep at 0 (recurrence of Plan 02 Rule 1 deviation #4).
- **Full test sweep:** 7 unit-script files / 43 passed / 7 todo / 0 failed; readonly integration 5/5 against local DB.

**Phase 79 Plan 04 (Wave 3 unified atomic apply transaction + post-flight + POST-DEPLOY auto-generation) outcomes — 2026-06-25:**

- **`scripts/v8.4-brand-canonicalization.ts` extended 1643 → 2125 LOC** (commits `ac69a781` Task 1 / `f2652cf2` Task 2 / `d732d996` Task 3). NEW exports: `ApplyCounts`, `PostDeployArgs`, `renderPostDeployMarkdown`. NEW non-exported helpers: `applyHydration` (DISP-03 Step 4.6), `postFlightAssertion` (MIG-04 Step 4.7), `writePostDeployArtifact` (D-79-10 wrapper). NEW constant `POST_DEPLOY_PATH`.
- **D-79-03 atomic 6-step transaction wired end-to-end.** Plan 02's transient brand-only `sql.begin` block DELETED; replaced with ONE outer `sql.begin` callback wrapping applyBrandPath + applyFamilyPath + applyHydration + postFlightAssertion. Any throw inside → automatic ROLLBACK. 5-stage flow: idempotent gate → strict gate → confirmIfProd → atomic transaction → post-success POST-DEPLOY write. Verified live: 1 actual `sql.begin(` call site in apply path.
- **D-79-08 hydration UNCONDITIONAL.** UPDATE FROM JOIN with NO WHERE-clause filter on watches.brand/model text — JOIN naturally skips watches.catalog_id IS NULL orphans per Pitfall 5. Touches `brand` + `model` columns ONLY; preserves notes/serial/reference (verified byte-identical pre vs post in integration test).
- **D-79-10 POST-DEPLOY auto-generated via pure renderer + thin wrapper.** `renderPostDeployMarkdown(args)` is a pure exported function (testable in vitest without I/O); `writePostDeployArtifact` wraps with mkdir + writeFile AFTER the sql.begin commits. 6 operator sign-off SQL queries inline; Hamilton merge canonical UUID `20969364-...` verbatim.
- **MIG-04 post-flight assertion uses POSITIVE predicate** `IS DISTINCT FROM NULL` per `[[post-flight-assertion-predicate-divergence]]`. Throw inside callback when resolved != total → ROLLBACK. Verified by source-grep in unit test + by structural review.
- **Local DB end-to-end APPLY ran successfully.** Integration test against `127.0.0.1:54322` brought local DB to fully post-apply state: 205/205 catalog rows resolved (brand_id + family_id); 16 user watches hydrated; Hamilton + Hamilton Watch BOTH resolve to canonical UUID `20969364-...`; zero `watches.brand = 'Hamilton Watch'` rows post-apply; 33 new brands + 143 new families created (all needs_review=false per D-79-09).
- **2 Rule 1 deviations** caught + auto-fixed during integration test development:
  - (1) `strictPreflightGate` family-triple decided-set was keyed by RAW brand_norm but the family file is deduped by CANONICAL BRAND UUID identity per Plan 03 D-79-07. Live `hamilton watch|khaki field mechanical bronze` would never match decided `hamilton|...`. Fix: build brandMap inline + key BOTH sides by canonical UUID identity (mirror familyDryRun Stage 2 logic verbatim).
  - (2) `applyFamilyPath` Step 4.3 INSERT failed with `22P02 invalid input syntax for type uuid: "a. lange & söhne"` because buildFamilyMap captured `brandUuid` at parse time when brandMap entries were still kind='new' with synthetic keys. applyBrandPath Step 4.1 reified brandMap to kind='existing' with real UUIDs but familyMap still held synthetics. Fix: applyFamilyPath gains optional `brandMap` param + re-resolves brandUuid at INSERT time via the now-reified brandMap; call site in main() passes brandMap.
- **Plan 01 stub greens (final):** v8.4-post-deploy-template (8 it() + 1 sanity / 9 pass / 0 todo / 0 failed); v8.4-apply-atomic (10 it() + 1 sanity / DATABASE_URL set → 11 pass; unset → 1 pass + 10 skip); v8.4-apply-idempotent (3 it() + 1 sanity / DATABASE_URL set → 4 pass; unset → 1 pass + 3 skip). ALL 6 Phase 79 stub files now fully green.
- **Forward armor preserved:** 0 `= ANY(` patterns; 0 `process.exit()` inside any sql.begin callback (Pitfall 2 verified — 7 actual exits all outside the transaction); 1 actual `sql.begin(` call (the unified outer atomic transaction); 6 `IS DISTINCT FROM NULL` occurrences (1 in postFlightAssertion + 1 in postFlightQuery template + 4 in operator sign-off SQL); 1 export of `renderPostDeployMarkdown`.
- **MIG-02 + MIG-04 + DISP-03 marked complete** (full integration verification end-to-end). Plan 05 inherits a fully-functional script that has been run against local DB with all post-flight invariants green — Plan 05 is gate execution only (operator runs prod push, reviews auto-generated 79-POST-DEPLOY.md, runs 6 operator sign-off queries, commits with sign-off).
- **Spec drift noted (not substantive):** Plan verify `grep -c 'process.exit' -le 6` is too narrow — counts comment refs too; actual code count is 7, all OUTSIDE the sql.begin callback. The substantive Pitfall 2 contract is met.
- **POST-DEPLOY artifact NOT committed in this plan.** The local-generated 79-POST-DEPLOY.md was cleaned up after verification because the prod-version (PROD target) is Plan 05's deliverable.
- **Full test sweep:** 9 test files passing / 65 tests passing / 0 todo / 0 failed when running just the Plan 04 stubs (parallel-vitest race with v8.4-brand-canonicalization.test.ts when running ALL integration tests at once — mitigated by apply-atomic restoring brand file from `git show HEAD:...` if missing).

### Pending Todos

None.

### Blockers/Concerns

None.

## Quick Tasks Completed

(carried forward from v8.1 close; v8.2 added no quick tasks. Phase 75 P01/P02 entries removed — they were standard plan execution, not ad-hoc quick tasks, and the CLI mis-categorized them.)

| Quick Task ID | Description | Commits | Date |
|---------------|-------------|---------|------|
| 260530-e55 | SRCH-03 followup: composite footer onClick closes combobox popup + mounts StructuredEntryPanel | 6070c5cc, 17d5bc0f | 2026-05-30 |
| 260620-gk9 | Backfill 18 prod `watches_catalog.image_url` rows + delete rogue test/test row (now 0/193 missing) | daf3e03c, b8b2af2d | 2026-06-20 |
| 260620-lbn | SEED-018 surgical slice: "Add from URL" affordance + admin-gated catalog-only save path | b1c20ddd, 9e0ee504 | 2026-06-20 |
| 260622-exo | Fix wear-event duplicate-day false positive across UTC midnight — thread client `today` into markAsWorn + logWearWithPhoto Server Actions | 25708a84, edf204f6 | 2026-06-22 |
| 260623-mn3 | Taste-aware sparse-pool top-up for collectors-like-you recommendations | cd3c2efb, 9f754300 | 2026-06-23 |
| 260623-pzz | Multi-brand match + per-brand variety cap for collectors-like-you sparse-pool top-up (initial deploy CRASHED prod home with Postgres 42809 / digest 2193629549 — Drizzle `sql\`= ANY(${arr})\`` emitted ROW literal not array; reverted f4967cb9 + cf9c942b; forward-fixed in 81f78084 using `IN (sql.join(...))`. See `project_drizzle_sql_any_array_pitfall.md` memory.) | 95ab7301, 0d842731, f4967cb9, cf9c942b, 81f78084 | 2026-06-23 |
| 260623-uua | Search ergonomics — multi-token AND-of-ORs, `unaccent` diacritic fold, `pg_trgm` `word_similarity > 0.2` fuzzy fallback. Fixes "omega seamaster" / "Heron" / "Jaeger la" / "Jeager" failing queries on /search Watches + Collections tabs. Read-path only — SEED-021 brand canonicalization explicitly deferred. Local UAT 12/12 pass; awaiting `git push` + `supabase db push --linked` for prod. | 81e21fb3, ac89ad1f, 50621739, 99172df2 | 2026-06-24 |

(Phase 76 P01 + P02 + P03 are standard plan execution, not ad-hoc quick tasks; removed from this table — see Performance Metrics above instead.)
| Phase 77 P01 | 8min | 2 tasks | 13 files |
| Phase 78 P01 | ~6min | 3 tasks | 8 files |
| Phase 78 P02 | ~6min | 4 tasks | 6 files |
| Phase 78 P03 | ~8min | 3 tasks | 9 files |
| Phase 79 P01 | 12min | 3 tasks | 7 files |
| Phase 79 P02 | 10 | 3 tasks | 2 files |
| Phase 79 P03 | 14min | 3 tasks | 2 files |
| Phase 79 P04 | 17min | 3 tasks | 4 files |
| Phase 81 P01 | 12m | 2 tasks | 19 files |
| Phase 81 P02 | 17m | 2 tasks | 4 files |
| Phase 81 P02 | 17m | 2 tasks | 4 files |
| Phase 81 P03 | 7m | 1 tasks | 3 files |
| Phase 81 P05 | 9m | 2 tasks | 1 files |

## Session Continuity

Last activity: 2026-07-13 — Phase 81 Plan 05 (scope patch: canonical JOIN on watch-detail-page same-family + lineage rails) complete. `src/data/hierarchy.ts` +26 LOC across 2 tasks. Task 05-1 (commit `39b7783e`): extended import to include `brands` + `watchFamilies` from `@/db/schema`; `getSameFamilyForCatalog` gains `.innerJoin(brands, eq(brands.id, watchesCatalog.brandId))` + `.innerJoin(watchFamilies, eq(watchFamilies.id, watchesCatalog.familyId))`; SELECT projection swaps `brand: watchesCatalog.brand` → `brand: brands.name` and `model: watchesCatalog.model` → `model: watchFamilies.name`; GROUP BY substitutes `brands.name` + `watchFamilies.name` for `watchesCatalog.brand` + `watchesCatalog.model` (keeping `watchesCatalog.id` + `watchesCatalog.imageUrl` intact); ORDER BY tiebreak switches to canonical `asc(brands.name), asc(watchFamilies.name)`. Task 05-2 (commit `748c0b5f`): `getLineageForReference` raw-SQL recursive CTE — BOTH the seed arm and the recursive arm gain `JOIN brands b ON b.id = wc.brand_id` + `JOIN watch_families f ON f.id = wc.family_id`; both arms' SELECT lists swap `wc.brand, wc.model` → `b.name AS brand, f.name AS model`; outer SELECT L165-172 unchanged (reads by name from CTE column list); CYCLE clause + depth-10 guard untouched; Pitfall 5 invariant extended in an inline docstring from just `wc.image_url` to also cover `b.name` + `f.name`. Live psql smoke against drift fixture `90c4ac1f-…4af4` (denorm `Hamilton Watch / DriftTest Chrono` on canonical Hamilton brand_id) returns canonical `Hamilton / Khaki Field Mechanical` under the new JOIN pattern. Public interfaces `SameFamilyWatch` (L53-59) + `LineageRow` (L28-40) unchanged. Consumer components `SameFamilyRail.tsx` + `LineageRail.tsx` untouched (they render `.brand` / `.model` by name and now receive canonical strings automatically). Forward armor: `grep -c '= ANY(' src/data/hierarchy.ts` = 0; `innerJoin(brands` = 1; `innerJoin(watchFamilies` = 1; `JOIN brands b` = 2 (seed + recursive); `JOIN watch_families f` = 2. `npm run build` exits 0. Zero deviations — plan executed exactly as written. Drift fixture LEFT APPLIED for operator re-walkthrough on the detail page; operator will run REVERT block after visual confirmation. Commits: `39b7783e` (Task 05-1 getSameFamilyForCatalog canonical JOIN), `748c0b5f` (Task 05-2 getLineageForReference CTE both-arms canonical JOIN). 0 new requirements marked complete (RECO-01 + RECO-04 already closed at Plan 02 boundary; scope patch is a re-application of the same read-time canonical JOIN pattern to two additional read surfaces per CONTEXT.md § Deferred Ideas revisit trigger).

Prior activity: 2026-07-12 — Phase 81 Plan 02 (recommender read-path canonical FK swap) complete. `src/lib/recommendations.ts` +61 LOC: `topBrandOf` signature widened to `(watches, brandNameLookup) => { brandId, brandName } | null` per D-81-05 (filter `w.status === 'owned' && w.brandId`, count by `w.brandId!`, tiebreak by resolved brandName ASC, defensive null-return on lookup miss per Pitfall 6); `RationaleContext` gains `viewerTopBrand: { brandId, brandName } | null` — caller pre-computes once, threaded through per-candidate ctx (removes N² compute inside outer rec-mapping loop); `rationaleFor` brand-match reads `ctx.viewerTopBrand?.brandName`. `src/data/recommendations.ts` +103 LOC: module-scope `excludeKey(w)` helper (reads `${brandId}|${familyId}` when both FKs present, `${brand.trim().toLowerCase()}|${model.trim().toLowerCase()}` fallback) called at 3 sites (exclusion loop + candidateMap key + synthetic Watch key via top-up) — Pitfall 5 identity guarantee by construction; `brandNameLookup` Map built INSIDE `getRecommendationsForViewer` from `SELECT id, name FROM brands WHERE id IN (…)` with empty-viewerBrandIds guard (Pitfall 2) — T-81-P02-01 cross-viewer poisoning mitigation; `viewerOwnedBrandsLower: Set<string>` → `viewerOwnedBrandIds: Set<string>` (canonical UUIDs); owned-brand IN clause switched from `lower(trim(brand)) IN (…strings…)` to `watches_catalog.brand_id IN (${sql.join(brandArr.map(id => sql\`${id}\`), sql\`, \`)})` — anti-pitfall correct per [[drizzle-sql-any-array-pitfall]] (closes RECO-02 literally); `topUpFromCatalogPopularity` both SELECTs INNER JOIN brands + watch_families safe under Phase 80 NOT NULL guarantee, project `brand: brands.name, model: watchFamilies.name, brandId, familyId`; popularity tiebreak switched from denorm `watchesCatalog.brand` to canonical `brands.name`; synthetic Watch gains `brandId + familyId` from JOIN row; brandCount variety cap keys on brand_id. Tests: `tests/lib/recommendations.test.ts` +59 LOC (8 rationaleFor tests updated with `viewerTopBrand` ctx + 3 new topBrandOf cases: brandId-keyed counting, legacy-row exclusion, all-undefined null return); `src/data/__tests__/recommendations.test.ts` +235 LOC (schema mock extended with brandId/familyId + brands/watchFamilies tags, fluent-chain routes `__tag === 'brands'` SELECTs to brandNameLookupResolver, catalogTopUpResolver row shape gains brandId/familyId, 3 new Phase 81 describe cases: Pitfall 5 exclusion-key identity drops drift-branded rows, synthetic Watch FK propagation surfaces JOIN-derived canonical brand string, Pitfall 2 brandNameLookup empty guard proven by throw-on-call resolver never being awaited). Forward armor: `= ANY(` grep = 0 across src/data + src/lib recommendations files (2 in-file comment reword after false-positive trip — recurrence of Plan 01 Task 2 Rule 1 deviation #3); `innerJoin brands|watchFamilies` = 4 matches; `sql.join` = 5 matches; `excludeKey|norm(` = 7 matches; `new Map<string, string>(` = 1 match INSIDE getRecommendationsForViewer body (T-81-P02-01 satisfied structurally). `npm run build` ✓ 7.3s; 24/24 targeted tests pass (11 lib + 13 DAL). 2 auto-fixes: (1) Rule 3 Task 1 build-boundary glue (passed empty Map into topBrandOf so `npm run build` exits 0 at Task 1 done gate; Task 2 replaced with real brandNameLookup wire-up); (2) Rule 1 grep-armor comment reword. Commits: `95e090e3` (Task 1 topBrandOf + RationaleContext widening + tests/lib updates), `a28a6615` (Task 2 recommender read-path canonical FK swap + DAL tests). RECO-01/02/03/04 marked complete.

Prior activity: 2026-06-25 — Phase 79 Plan 04 (Wave 3 unified atomic apply transaction + post-flight assertion + auto-generated POST-DEPLOY artifact) complete. `scripts/v8.4-brand-canonicalization.ts` extended 1643 → 2125 LOC with applyHydration (DISP-03 / D-79-08 unconditional UPDATE FROM JOIN) + postFlightAssertion (MIG-04 / positive `IS DISTINCT FROM NULL` predicate) + renderPostDeployMarkdown (pure exported function) + writePostDeployArtifact (FS wrapper). main() `--apply --mode=both` branch fully wired with 5-stage flow + ONE outer `sql.begin` callback containing 6 mutation steps + 1 post-flight assertion per D-79-03 (Plan 02's transient brand-only sql.begin DELETED; Plan 02 "Plan 03/04" throw at the families/both gate DELETED). Local DB end-to-end smoke ran successfully: 205/205 catalog rows resolved + 33 new brands + 143 new families + 16 user watches hydrated; Hamilton + Hamilton Watch BOTH resolve to canonical UUID `20969364-...`; zero `watches.brand = 'Hamilton Watch'` rows post-apply; D-79-04 idempotent re-run gate verified (re-apply exits 0 with "Already applied"); D-79-06 alias cardinality stable across re-runs. 2 Rule 1 deviations auto-fixed: (1) strictPreflightGate family-triple keying must use canonical brand UUID identity not raw brand_norm; (2) applyFamilyPath needs optional brandMap param to re-resolve brandUuid at INSERT time since buildFamilyMap captures stale synthetic keys before applyBrandPath reifies brandMap. Plan 01 stub greens (ALL 6 Phase 79 stub files now green): v8.4-post-deploy-template 9/0/0; v8.4-apply-atomic 11/0/0 (DATABASE_URL set); v8.4-apply-idempotent 4/0/0 (DATABASE_URL set). Forward armor: 0 `= ANY(` patterns; 0 process.exit inside sql.begin callback; 1 actual sql.begin call site; 6 `IS DISTINCT FROM NULL` occurrences; npm run build exit 0. Commits: `ac69a781` (Task 1 helpers + unit test green), `f2652cf2` (Task 2 atomic-transaction wiring), `d732d996` (Task 3 integration tests + 2 Rule 1 deviations). MIG-02 + MIG-04 + DISP-03 marked complete.

Next action: operator re-walkthrough on `npm run dev` — click into the local viewer's Hamilton on the watch detail page, confirm SameFamilyRail + LineageRail now render `Hamilton / Khaki Field Mechanical` for the drift catalog row `90c4ac1f-…4af4` (was `Hamilton Watch / DriftTest Chrono`). After visual confirmation, run the drift fixture REVERT block per Plan 04 spec. Then re-run Plan 04's bundled deploy path: `git push` main (bundles Plans 01-05) + prod smoke walkthrough per D-81-04 UAT script (rail exclusion, canonical rationale on home rail, canonical strings on detail-page rails, DISP-01/02 add/edit persistence). Phase 81 verification then complete. Prior queue depth at Plan 05 close: Phase 79 Plan 05 + 260623-uua + Phase 76 all remain CODE-COMPLETE on `main` awaiting operator prod migration push per 76-POST-DEPLOY.md / 79-POST-DEPLOY.md.

Prior next action (2026-07-12): `/gsd-execute-phase 81` → Plan 03 (Wave 3 — Server Action canonical overwrite for addWatch + editWatch). Consumes Plan 01's `upsertCatalogFromUserInput`/`upsertCatalogFromExtractedUrl` `{ catalogId, brandName, familyName } | null` return shape + extended `getCatalogById` `canonicalBrand`/`canonicalFamily` fields; closes DISP-01/02 (user types "Hamilton Watch" → persisted `watches.brand = 'Hamilton'` canonical). Then Plan 04 (Wave 4 — bundled local drift-fixture UAT + prod deploy per D-81-04). Prior queue depth at Plan 02 close: Phase 79 Plan 05 + 260623-uua + Phase 76 all remain CODE-COMPLETE on `main` awaiting operator prod migration push per 76-POST-DEPLOY.md / 79-POST-DEPLOY.md.

Prior next action (2026-06-25): `/gsd-execute-phase 79` → Plan 05 (Wave 4 — local-first verification gate + prod push). Plan 05 is gate execution only (no new code): operator runs final local-first verification (`npm run dev` smoke against the post-apply local DB to confirm display strings render canonical), THEN runs the script against prod via `tsx scripts/v8.4-brand-canonicalization.ts --apply --mode=both` with a prod DATABASE_URL inline (D-79-02 prompts for `yes`); reviews the auto-generated 79-POST-DEPLOY.md; runs the 6 operator sign-off SQL queries in the Supabase SQL editor; commits the file with sign-off. Note: 260623-uua + Phase 76 still CODE-COMPLETE on `main` awaiting operator prod migration push per 76-POST-DEPLOY.md (both unblocked by Plan 05's prod migration push window).

## Operator Next Steps
