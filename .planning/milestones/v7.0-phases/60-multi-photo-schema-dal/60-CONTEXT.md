# Phase 60: Multi-Photo Schema + DAL - Context

**Gathered:** 2026-05-25
**Status:** Ready for planning

<domain>
## Phase Boundary

The database layer to store **multiple ordered photos per per-user watch**. Adds a new `watch_photos` table, supersedes the single `watches.image_url` field, resolves a cover/thumbnail at the data layer, enforces a per-watch ~10-photo cap in the DAL, and reuses the v3.0 EXIF-strip / ≤1080px JPEG pipeline for the storage helper.

**Schema + DAL only. No UI.** Upload affordance, carousel, drag-reorder UI, and delete UI are Phase 61. Public wear-pic surfacing is Phase 62. This phase makes multi-photo storage + cover resolution observable at the data layer before any UI lands.

**Requirements:** PHOTO-01 (multi-photo model), PHOTO-04 (cover = card thumbnail), PHOTO-07 (cap + DAL rejection), PHOTO-08 (EXIF/≤1080 pipeline).

</domain>

<decisions>
## Implementation Decisions

### Table Model & Wear-Pic Fit
- **D-01:** New `watch_photos` table holds **owner uploads only**, keyed to `watches.id` (per-user/owned — never the catalog). `ON DELETE CASCADE` off `watches.id`.
- **D-02:** Public wear pics are **NOT stored in `watch_photos`**. Phase 62 surfaces them by querying `wear_events` (`visibility = 'public'`) and **unioning into the carousel at the DAL read layer** — not by copying rows. This keeps each wear pic's `wear_event` identity and its existing v6.0 `wear_likes` + comments intact (WPIC-06), and avoids any sync logic when a wear event's visibility or photo changes. **Separate tables, union at read** — locked to avoid a re-migration in Phase 62.
- **D-03:** Photo ordering mirrors the established Phase 27 `sort_order` pattern (integer `sort_order`, full-rewrite reorder via a bulk helper). Reordering ≤10 photos makes integer rewrite trivially cheap — no fractional/float ordering needed.

### Cover Resolution
- **D-04:** Cover thumbnail is **computed at read**, not a cached column. The DAL resolves cover via a join to `watch_photos` (lowest `sort_order`, `LIMIT 1`). No `coverPhotoUrl` column on `watches` — avoids the denormalized-drift class of bugs (every photo mutation would otherwise have to keep it in sync).
- **D-05:** Cover fallback chain: **owner upload `[0]` → catalog `imageUrl` → placeholder.** `getWatchesByUser` already `leftJoin`s `watchesCatalog` (`src/data/watches.ts:145`), so the catalog fallback is already in the query shape; add the `watch_photos` cover join alongside it.
- **D-06:** This is observable at the data layer before any UI (SC2) — the DAL returns the resolved cover; the planner should add coverage proving the lowest-`sort_order` upload wins over the catalog fallback.

### `imageUrl` Supersession & Backfill
- **D-07:** Backfill every non-null `watches.image_url` into `watch_photos` as the first photo (`sort_order = 0`) — **lossless**. Then **DROP the `watches.image_url` DB column.** `watch_photos` becomes the sole per-user photo store (SC1: "single-image field is superseded").
- **D-08:** The `Watch` TS type **keeps its `imageUrl` field** (so every existing grid-card/rail reader keeps working with no churn) — but it is now **populated by the computed cover (D-04/D-05)**, not by a raw column read. Map it in the DAL row→`Watch` mappers.
- **D-09:** `watches` is a user-side wipeable table, so the "in-place" concern here is **only that the backfill is lossless** before the column drop — not the catalog-investment concern of SC5.

### Catalog (`watches_catalog`)
- **D-10:** **No `watches_catalog` ALTER and no catalog backfill in this phase.** With the separate `watch_photos` table + computed cover, the catalog's existing `imageUrl` is already the read-time fallback (D-05). The ROADMAP phase-header line "in-place ALTER on `watches_catalog`; cover-photo backfill" was written pre-discussion and is **superseded** — `watches_catalog` is untouched.
- **D-11:** Consequence for verification: **SC5 as written** ("the in-place migration runs cleanly on local and prod without wiping existing `watches_catalog` LLM/factual/photo investment") is satisfied **trivially** because the phase does not touch `watches_catalog`. The verifier should re-read SC5 against the actual change set — the real lossless-migration assertion is the `watches.image_url` backfill→drop (D-07), not a catalog migration.

### Cap Semantics & Enforcement
- **D-12:** Single tunable constant `MAX_PHOTOS_PER_WATCH = 10`. ("~10" → a hard `10` the DAL can check; easy to retune later.)
- **D-13:** Cap is enforced in the **DAL only** — the `addPhoto` function counts existing `watch_photos` rows for the watch and rejects the insert beyond the cap with a clear error. The DAL is the sole write path (mirrors `createWatch`/reorder). **No DB-level CHECK/trigger** — a row-count cap can't be a simple CHECK, and a trigger is heavier than warranted given the single writer.
- **D-14:** Cap counts **`watch_photos` rows only** (= owner uploads). Surfaced public wear pics union in at read (D-02) and are **not** counted against the cap. Per-account quota stays deferred (PHOTO-F1).

### PHOTO-08 — EXIF/Resize Pipeline Scope (in this phase)
- **D-15:** Build the **storage helper + `stripAndResize` wiring + a metadata-verifying test** in Phase 60. The actual upload *UI* is Phase 61. SC4 ("verifiable via file metadata on uploaded test images") wants the verification to live here, so a test asserting stripped-EXIF + ≤1080px JPEG output belongs in this phase.
- **D-16:** Reuse the existing client-side `stripAndResize` (`src/lib/exif/strip.ts` — canvas re-encode, EXIF strip, 1080px long-edge cap, JPEG @ 0.85). Do **not** rebuild the pipeline.

### Claude's Discretion (decided here, open to planner refinement)
- **Storage bucket:** new dedicated `watch-photos` bucket (not the `wear-photos` bucket) — clean separation + per-user RLS path scoping (`{userId}/...`), mirroring `wear-photos`'s Phase 11 RLS convention. Storage helper mirrors `src/lib/storage/wearPhotos.ts`.
- **`watch_photos` storage-path convention** + the exact `ON DELETE` storage-object purge (a deleted watch should purge its `watch-photos/{userId}/...` objects, mirroring `src/app/actions/account.ts`'s `wear-photos` purge) — implementation detail for the planner.
- **RLS policy shape** on `watch_photos` — public-read gated by the owner's profile/collection visibility + owner-write, mirroring the v6.0 / `watches` pattern. **See the canonical-ref note on the Phase 53 RLS-subquery-caller gotcha** — a public-read policy that subqueries `watches` for visibility runs under the *caller's* RLS and can fail-closed for non-owners; the **service-role DAL is the real read gate**, RLS is defense-in-depth.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope
- `.planning/ROADMAP.md` "Phase 60" (lines 206–216) — goal + 5 success criteria. **Note D-10/D-11:** the "in-place ALTER on `watches_catalog`" header line and SC5's catalog framing are superseded by this discussion (no catalog change).
- `.planning/REQUIREMENTS.md` §"Multi-Photo Model + Carousel — `PHOTO`" (lines 27–39) + §"Out of Scope" (lines 89–101) — PHOTO-01/04/07/08 in scope; per-user-owned (not a cross-user pool), one-time backfill only.

### Schema (what this phase modifies)
- `src/db/schema.ts` — `watches` (lines 87–173; `image_url` at line 136 is dropped per D-07; `sort_order` pattern at 159–162 + indexes 167–172 is the ordering precedent for D-03); `wearEvents` (295–312; `photo_url` + `visibility` are the union-at-read source for Phase 62, D-02); `watchesCatalog` (411–481; `image_url` at 434 is the cover fallback, untouched per D-10).
- `drizzle/` migrations + `supabase/migrations/` — dual-migration discipline: `drizzle-kit push` LOCAL ONLY; prod via `supabase db push --linked`. See MEMORY `project_drizzle_supabase_db_mismatch` for the 4 prod-push gotchas.

### DAL (what this phase extends)
- `src/data/watches.ts` — `getWatchesByUser` (126; `leftJoin` catalog at 145 — add the `watch_photos` cover join here, D-05); `getWatchById` (172); `getWatchByIdForViewer` (193, two-layer privacy gate); `createWatch` (276); `updateWatch` (304); `deleteWatch` (320); `bulkReorderWishlist` (433, the reorder-helper precedent for D-03); row→`Watch` mappers (`imageUrl` mapping at 45, 93 — repoint to computed cover per D-08).

### Reusable pipeline + storage
- `src/lib/exif/strip.ts` — `stripAndResize(blob, maxDim=1080, quality=0.85)` → `StripResult`; the EXIF-strip + ≤1080px JPEG re-encode to reuse for PHOTO-08 (D-15/D-16).
- `src/lib/storage/wearPhotos.ts` — `buildWearPhotoPath` + `uploadWearPhoto` client-direct upload helper (`{userId}/{id}.jpg`, `upsert: false`, RLS folder enforcement); the template for the new `watch-photos` storage helper.
- `src/app/actions/account.ts` (lines ~30–61) — paginated `wear-photos/{userId}/` storage purge; the precedent for watch-photo storage cleanup on delete.

### Load-bearing gotchas (MEMORY)
- `project_rls_subquery_caller_rls` — an RLS policy's subquery runs under the **caller's** RLS; a `watch_photos` visibility gate that reads owner-only `watches` fails closed for non-owners. The service-role DAL is the real gate. Local DB has RLS OFF on pre-existing tables → cross-table RLS tests are meaningless locally.
- `project_drizzle_supabase_db_mismatch` — `drizzle-kit push` is local only; prod uses `supabase db push --linked`; 4 prod-push gotchas (filename, ordering, extension schema, enum-bound dependents).
- `project_db_wipeable_2026_05_09` — user-side tables (`watches`/`wear_events`) are wipeable; `watches_catalog` is NOT. (Reinforces D-07's lossless-backfill-before-drop and D-10's no-touch.)
- `feedback_execute_phase_no_worktree_when_db` — disable worktree isolation for DB-touching / build-gated phases (already permanent: `workflow.use_worktrees = false`).

### Prior context
- `.planning/phases/59-unified-route-variant-c/59-CONTEXT.md` — the `/w/[ref]` unified route (sole watch-detail surface) the carousel + cover will eventually render on; `getWatchByIdForViewer` is the per-user resolver.
- `.planning/seeds/SEED-013-v7.0-watch-photos.md` — the originating idea (multi-photo carousel + wear-pic surfacing + add-watch encouragement); open questions resolved by D-01..D-16.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`stripAndResize`** (`src/lib/exif/strip.ts`) — EXIF strip + ≤1080px JPEG re-encode, already used by WYWT camera capture + CMS cover uploader. Reuse verbatim for PHOTO-08 (D-16).
- **`uploadWearPhoto` / `buildWearPhotoPath`** (`src/lib/storage/wearPhotos.ts`) — client-direct upload helper with RLS folder enforcement; template for the new `watch-photos` storage helper.
- **`bulkReorderWishlist` + `sort_order` pattern** (Phase 27) — the integer-ordering + bulk-reorder precedent for `watch_photos` ordering (D-03).
- **`getWatchesByUser` catalog left-join** (`src/data/watches.ts:145`) — already the place where the catalog fallback lives; the cover join slots in here (D-05).

### Established Patterns
- **Dual migration:** Drizzle schema for types + raw `supabase/migrations/*.sql` as authoritative for RLS/constraints Drizzle can't express. `watch_photos` RLS lives in raw SQL.
- **RLS-subquery-caller gotcha** (Phase 53): cross-table visibility subqueries run under the caller's RLS → service-role DAL is the real gate (see canonical refs).
- **Storage path convention** `{userId}/{id}.ext` + per-user folder RLS (Phase 11) — reuse for `watch-photos`.
- **`ON DELETE CASCADE`** off `watches.id` for owned child tables (cf. `watch_likes` line 324, `wear_events` line 300) — apply to `watch_photos`.

### Integration Points
- `watch_photos` is consumed at read by `getWatchesByUser` / `getWatchById*` (cover resolution) now, and by the Phase 61 carousel + Phase 62 wear-pic union later.
- The `Watch.imageUrl` type field stays the contract for all grid/rail/card readers — repointed to the computed cover (D-08) so no reader churns.

</code_context>

<specifics>
## Specific Ideas

- **Separate tables, union at read** is the deliberate choice over a unified photo table — driven specifically by keeping surfaced wear pics' v6.0 social identity (`wear_likes`/comments on `wear_events`) intact for Phase 62 (WPIC-06).
- **Computed cover over cached column** — explicitly to dodge the denormalized-drift bug class; ≤500 watches/user makes the extra join cheap.
- **Drop `watches.image_url`** (not keep-as-mirror) — the user wants a clean supersession with no dead column.
- **No catalog churn** — the operator confirmed `watches_catalog` needs no change; the roadmap's catalog-ALTER line is retired.

</specifics>

<deferred>
## Deferred Ideas

- **Public wear-pic surfacing + per-pic hide + carousel union ordering** — Phase 62 (WPIC-01..06). Phase 60 only lays the separate-table groundwork (D-02).
- **Upload UI, carousel, drag-reorder UI, delete UI, add-watch photo encouragement** — Phase 61 (PHOTO-02/03/05/06/09).
- **Per-account photo cap / storage quota** — PHOTO-F1 (future); v7.0 caps per-watch only (D-14).
- **In-app photo editing beyond capture crop** — PHOTO-F2 (future).
- **Multi-photo extraction from URL import** — PHOTO-F3 (future); add-watch URL extract still pulls a single image.

</deferred>

---

*Phase: 60-multi-photo-schema-dal*
*Context gathered: 2026-05-25*
