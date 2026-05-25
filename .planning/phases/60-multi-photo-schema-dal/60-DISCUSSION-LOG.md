# Phase 60: Multi-Photo Schema + DAL - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-25
**Phase:** 60-multi-photo-schema-dal
**Areas discussed:** Table model + wear-pic fit, Cover resolution + fallback, imageUrl fate + backfill, Cap semantics + enforcement

---

## Table model + wear-pic fit

| Option | Description | Selected |
|--------|-------------|----------|
| Separate + union at read | New `watch_photos` table holds owner uploads only; Phase 62 unions public wear pics from `wear_events` at the DAL layer. Wear pics keep their `wear_event` identity + `wear_likes`/comments. No duplication, no sync. | ✓ |
| Unified watch_photos table | One table with `source` ('upload' \| 'wear'); Phase 62 inserts a row per public wear pic. Single ordering/cap space, but forks the wear pic's social identity and needs sync logic. | |

**User's choice:** Separate + union at read
**Notes:** Matches the v6.0 social keying (`wear_likes`/comments attach to `wear_events`, not photos). Locked now to avoid a re-migration in Phase 62.

---

## Cover resolution + fallback

| Option | Description | Selected |
|--------|-------------|----------|
| Computed at read | DAL resolves cover via join to `watch_photos` (lowest `sort_order`, LIMIT 1) → catalog `imageUrl` fallback. No new column, always correct, zero sync burden. | ✓ |
| Cached column on watches | Add `coverPhotoUrl`, kept in sync on every upload/reorder/delete. Fastest reads but introduces sync obligation + drift risk. | |

**User's choice:** Computed at read
**Notes:** Avoids the denormalized-drift bug class. `getWatchesByUser` already left-joins the catalog, so the cover join slots in cheaply at <500 watches/user. Fallback chain: upload[0] → catalog `imageUrl` → placeholder.

---

## imageUrl fate + backfill

| Option | Description | Selected |
|--------|-------------|----------|
| Drop the column | Backfill `watches.image_url` → `watch_photos` photo[0] (lossless), then DROP the column. `watch_photos` is sole store; `Watch.imageUrl` type field repopulated by computed cover. | ✓ |
| Keep as deprecated mirror | Backfill but leave the column (stop writing). Avoids touching readers now, but leaves a dead column that can drift. | |

**User's choice:** Drop the column
**Notes:** Clean supersession (SC1), no dead column. `Watch.imageUrl` type field kept so grid/rail readers don't churn — repointed to the computed cover.

### Catalog ALTER (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| No catalog ALTER — preserve as-is | Catalog `imageUrl` is already the computed-cover fallback; `watches_catalog` untouched. Trivially satisfies SC5. Roadmap's "in-place ALTER" line superseded. | ✓ |
| There's a catalog change I'm missing | A specific `watches_catalog` change was intended. | |

**User's choice:** No catalog ALTER — preserve as-is
**Notes:** Phase touches no catalog; SC5's catalog framing retired. The real lossless-migration assertion is the `watches.image_url` backfill→drop — flagged for the verifier.

---

## Cap semantics + enforcement

| Option | Description | Selected |
|--------|-------------|----------|
| DAL only | `MAX_PHOTOS_PER_WATCH = 10`; `addPhoto` counts existing rows + rejects beyond cap with a clear error. DAL is the sole writer. | ✓ |
| DAL + DB trigger (defense-in-depth) | DAL check + a Postgres BEFORE INSERT trigger hard-rejecting row 11. Heavier to migrate; the DAL is already the sole write path. | |

**User's choice:** DAL only
**Notes:** Cap counts `watch_photos` rows only (= uploads); surfaced wear pics union at read and aren't counted (D-14). Number is a single tunable constant. Per-account quota stays deferred (PHOTO-F1).

---

## Claude's Discretion

- **Storage bucket** — new dedicated `watch-photos` bucket (not `wear-photos`), per-user RLS path scoping mirroring Phase 11. Storage helper mirrors `src/lib/storage/wearPhotos.ts`.
- **PHOTO-08 scope in Phase 60** — build the storage helper + `stripAndResize` wiring + a metadata-verifying test now; actual upload UI is Phase 61 (SC4 wants the verification here).
- **`watch_photos` RLS shape, storage-path convention, and delete-time storage purge** — established patterns; planner to detail. Carry the Phase 53 RLS-subquery-caller gotcha (service-role DAL is the real read gate).

## Deferred Ideas

- Public wear-pic surfacing + per-pic hide + carousel union ordering — Phase 62.
- Upload/carousel/drag-reorder/delete UI + add-watch photo encouragement — Phase 61.
- Per-account photo cap / storage quota — PHOTO-F1 (future).
- In-app photo editing beyond capture crop — PHOTO-F2 (future).
- Multi-photo extraction from URL import — PHOTO-F3 (future).
