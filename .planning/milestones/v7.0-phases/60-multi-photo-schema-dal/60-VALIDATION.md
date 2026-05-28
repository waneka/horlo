---
phase: 60
slug: multi-photo-schema-dal
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-25
---

# Phase 60 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 60-RESEARCH.md `## Validation Architecture`. Task IDs are TBD until plans are written; map below is keyed by requirement and will be bound to task IDs during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (jsdom default environment) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/unit/lib/storage/watchPhotos.test.ts` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~5s quick (no DB) · ~30s integration (requires `DATABASE_URL`) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/unit/lib/storage/watchPhotos.test.ts` (pure unit, no DB)
- **After every plan wave:** Run `npx vitest run tests/integration/phase60-watch-photos.test.ts` (requires `DATABASE_URL`; skips when absent)
- **Before `/gsd-verify-work`:** Full suite `npm run test` must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 1 | PHOTO-01 / SC1 | — | `watch_photos` table + `(watch_id, sort_order)` index exist; `watches.image_url` dropped; backfill rows at `sort_order=0` (lossless) | integration | `npx vitest run tests/integration/phase60-watch-photos.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 2 | PHOTO-04 / SC2 | — | `getWatchesByUser` returns `imageUrl` from cover (lowest `sort_order`); catalog fallback when no photos | integration | `npx vitest run tests/integration/phase60-watch-photos.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 2 | PHOTO-07 / SC3 | T-CAP | `addWatchPhoto` rejects insert at `MAX_PHOTOS_PER_WATCH + 1`; count includes only `watch_photos` rows (not unioned wear pics) | integration | `npx vitest run tests/integration/phase60-watch-photos.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | PHOTO-08 / SC4 | — | `stripAndResize` output: JPEG MIME + ≤1080px long edge + no `0xFFE1` EXIF marker | unit (structural / canvas-mocked) | `npx vitest run tests/unit/lib/exif/stripAndResize.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | Access control | T-XTENANT | `addWatchPhoto`/reorder/delete confirm `watches.user_id = userId` before mutating (cross-tenant insert blocked) | integration | `npx vitest run tests/integration/phase60-watch-photos.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | Path builder | T-TRAVERSAL | `buildWatchPhotoPath` validates UUID `photoId`, returns `{userId}/{photoId}.jpg`, throws on bad inputs | unit | `npx vitest run tests/unit/lib/storage/watchPhotos.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/integration/phase60-watch-photos.test.ts` — covers PHOTO-01/SC1, PHOTO-04/SC2, PHOTO-07/SC3, schema index + cross-tenant assertions. Guard on `DATABASE_URL` (skip when absent — mirror `tests/integration/phase27-schema.test.ts:16`). Use `// @vitest-environment node` if it walks the filesystem (e.g. migration-file assertions); otherwise jsdom is fine.
- [ ] `tests/unit/lib/storage/watchPhotos.test.ts` — `buildWatchPhotoPath` happy + error paths. No DB. Pattern: `tests/lib/storage/catalogSourcePhotos.test.ts`.
- [ ] `tests/unit/lib/exif/stripAndResize.test.ts` — SC4 (PHOTO-08). `canvas` devDep is NOT installed (research A2) → planner decides: install `canvas` for a full re-encode test, or structural/mocked-canvas smoke test asserting JPEG + ≤1080 + EXIF-strip behavior.

*Migration files (written during Wave 1, not Wave 0 test stubs): `supabase/migrations/<ts>_phase60_watch_photos.sql` (authoritative; backfill → DO $$ assert → DROP COLUMN) and the `drizzle/` generated migration.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Lossless backfill + column drop on **prod** | PHOTO-01 / SC1 / SC5 | `drizzle-kit push` is local-only; prod runs `supabase db push --linked`. Local DB has RLS OFF on pre-existing tables, so cross-table RLS behavior is not reproducible locally (MEMORY `project_rls_subquery_caller_rls`). | Run `supabase db push --linked` against prod; confirm zero rows lost (pre-drop `DO $$` guard passes) and `watches.image_url` column is gone. Verify on prod per MEMORY `feedback_mobile_ui_verify_on_prod` deploy discipline. |
| `watch_photos` RLS public-read gate behavior for non-owners | Access control | RLS subquery runs under caller's RLS → fails closed locally and behaves differently in prod; the service-role DAL is the real gate. | Confirm on prod that a non-owner viewer reads cover photos only through the service-role DAL path, not direct anon RLS reads. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
