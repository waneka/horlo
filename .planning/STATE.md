---
gsd_state_version: 1.0
milestone: v8.4
milestone_name: Catalog Brand+Model Canonicalization
status: executing
last_updated: "2026-06-25T04:05:02.925Z"
last_activity: 2026-06-25 -- Phase 78 planning complete
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 4
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-24 — v8.4 Catalog Brand+Model Canonicalization STARTED; see §Current State)

**Core value:** A collector can evaluate any watch against their collection and get a meaningful, preference-aware answer about whether it adds something or just duplicates what they already own.
**Current focus:** v8.4 Catalog Brand+Model Canonicalization (SEED-021) — wire `brand_id` FK as canonical identity across every `watches` + `watches_catalog` row before v9.0 Catalog Expansion (SEED-009) doubles the catalog volume.

## Current Position

Phase: 78 — Schema Additions + Operator-Resolve Queue
Plan: —
Status: Ready to execute
Last activity: 2026-06-25 -- Phase 78 planning complete

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

## Session Continuity

Last activity: 2026-06-25 — v8.4 Catalog Brand+Model Canonicalization roadmap drafted: 5 phases (78 Schema Additions + Operator-Resolve Queue, 79 Backfill Migration + Display Hydration, 80 NOT NULL Flip + Ingest Hardening, 81 Recommender + Display Server Action Swap, 82 Add-Watch UI + Operator Admin). 25/25 v8.4 requirements mapped across the 5 phases (P78: 3, P79: 5, P80: 6, P81: 6, P82: 5); CANON 4 + MIG 5 + INGEST 4 + RECO 4 + DISP 3 + UI 3 + OPS 2 = 25. Coverage table written to ROADMAP.md; REQUIREMENTS.md Traceability section filled with phase numbers (replaced 25 TBD placeholders). Sequencing locked: schema (P78) → backfill (P79) → NOT NULL+ingest in same push (P80) → recommender+display swap (P81) → UI+admin (P82). Prior activity: 260623-uua shipped (search ergonomics — multi-token AND-of-ORs + `unaccent` + `pg_trgm word_similarity > 0.2`).

Next action: `/gsd-plan-phase 78` to break Phase 78 into executable plans. Note: 260623-uua + Phase 76 still CODE-COMPLETE on `main` awaiting operator prod migration push per 76-POST-DEPLOY.md — these can be batched with the first v8.4 migration push (Phase 78 will produce a new `supabase/migrations/*.sql` file for the `aliases` + `needs_review` columns).

## Operator Next Steps
