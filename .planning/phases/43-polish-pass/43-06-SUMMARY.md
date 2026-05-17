---
phase: 43-polish-pass
plan: "06"
subsystem: database
tags: [supabase, storage, rls, avatars, sql-migration]

# Dependency graph
requires:
  - phase: 43-polish-pass
    provides: avatars bucket + INSERT/UPDATE/DELETE policies (20260516000000_phase43_avatar_bucket.sql)
provides:
  - avatars_select_own_folder SELECT policy on storage.objects, enabling upsert uploads to the avatars bucket without a 403 RLS error
affects: [43-polish-pass, PLSH-06, avatar upload, profile edit]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Supabase Storage upsert requires a SELECT policy on storage.objects so the storage-api object lookup (insert-vs-update decision) succeeds — add SELECT alongside INSERT/UPDATE."
    - "Folder-scoped SELECT policy: USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text) — never a bare USING (bucket_id = '...')."

key-files:
  created:
    - supabase/migrations/20260517000000_phase43_avatar_select_policy.sql
  modified: []

key-decisions:
  - "DB-only fix: no application code changed — uploadAvatarPhoto keeps upsert: true, AvatarUploader.tsx and updateProfile are untouched."
  - "SELECT policy predicate mirrors avatars_insert_own_folder exactly (folder-scoped, TO authenticated) — not the permissive bucket-wide form used by the catalog_source_photos bucket."
  - "Migration is idempotent (DROP POLICY IF EXISTS) and self-asserting (DO $$ ... $$ block raising EXCEPTION if policy_count <> 4)."

patterns-established:
  - "Supabase Storage upsert pattern: always add a folder-scoped SELECT policy alongside INSERT/UPDATE when using upsert: true — the storage-api performs a storage.objects SELECT before deciding insert-vs-update, and RLS blocks that lookup without a SELECT policy."

requirements-completed: [PLSH-06]

# Metrics
duration: ~10min (Task 2 was a human-action gate; migration applied externally)
completed: "2026-05-17"
---

# Phase 43 Plan 06: Avatar SELECT Policy (GAP-43-03) Summary

**Added folder-scoped `avatars_select_own_folder` SELECT policy to `storage.objects` via SQL migration, closing the 403 RLS error that blocked all avatar uploads when using `upsert: true`.**

## Performance

- **Duration:** ~10 min (DB-only gap closure; Task 2 was a blocking human-action gate)
- **Started:** 2026-05-17
- **Completed:** 2026-05-17
- **Tasks:** 2 (Task 1 automated, Task 2 human-action gate resolved externally)
- **Files modified:** 1

## Accomplishments

- Diagnosed root cause of GAP-43-03: `uploadAvatarPhoto` uses `upsert: true`, which requires the storage-api to SELECT the existing `storage.objects` row before deciding insert-vs-update — without a SELECT policy that lookup is rejected by RLS, returning `403 "new row violates row-level security policy"` even though INSERT and UPDATE policies were present.
- Created and applied `supabase/migrations/20260517000000_phase43_avatar_select_policy.sql` — a folder-scoped, `TO authenticated` SELECT policy (`avatars_select_own_folder`) mirroring the existing `avatars_insert_own_folder` predicate exactly.
- Migration applied to linked Supabase project via `supabase db push --yes`; embedded `DO $$` assertion (expects exactly 4 `avatars_%` policies) passed — confirming all four policies (INSERT, UPDATE, DELETE, SELECT) are live.
- GAP-43-03 closed: PLSH-06 (avatar upload) is now genuinely functional, matching its REQUIREMENTS.md "Complete" status.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add folder-scoped SELECT policy migration for the avatars bucket** - `bf0c4b4` (feat)
2. **Task 2: [BLOCKING] Apply via supabase db push** - applied externally (human-action gate; no separate commit — migration push is a Supabase remote operation, not a repo change)

**Plan metadata:** (this commit)

## Files Created/Modified

- `supabase/migrations/20260517000000_phase43_avatar_select_policy.sql` - New SQL migration; adds `avatars_select_own_folder` SELECT policy on `storage.objects`; idempotent (`DROP POLICY IF EXISTS`); self-asserting (`DO $$` block requiring `policy_count = 4` for `avatars_%` policies)

## Decisions Made

- DB-only fix: No application code changed. `uploadAvatarPhoto` keeps `upsert: true`; `AvatarUploader.tsx` and `updateProfile` are untouched. The policy gap was the sole cause of the 403.
- SELECT predicate kept folder-scoped (`(storage.foldername(name))[1] = (SELECT auth.uid())::text`), not a permissive bucket-wide form — to satisfy threat model T-43-G06-01 (information disclosure prevention) and T-43-G06-03 (elevation-of-privilege prevention).
- Migration timestamp `20260517000000` sorts strictly after the existing bucket migration `20260516000000`, ensuring the bucket exists before the SELECT policy is applied.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The root cause was known from UAT analysis before execution began. The migration write, push, and embedded assertion all completed cleanly.

## User Setup Required

None — `supabase db push` was run by the developer as the Task 2 human-action gate. No additional configuration steps remain.

## Next Phase Readiness

- GAP-43-03 closed. Avatar upload via `ProfileEditForm` (pick → crop → confirm) should now succeed without a 403 and display the new avatar on profile surfaces.
- All three Phase 43 gap-closure plans (43-04 / GAP-43-01, 43-05 / GAP-43-02, 43-06 / GAP-43-03) are complete.
- PLSH-06 is genuinely functional end-to-end.

---
*Phase: 43-polish-pass*
*Completed: 2026-05-17*
