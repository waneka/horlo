---
phase: 11-schema-storage-foundation
fixed_at: 2026-04-22T18:31:05Z
review_path: .planning/phases/11-schema-storage-foundation/11-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 3
skipped: 2
status: partial
---

# Phase 11: Code Review Fix Report

**Fixed at:** 2026-04-22T18:31:05Z
**Source review:** `.planning/phases/11-schema-storage-foundation/11-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (all Warning-severity; no Critical)
- Fixed: 3
- Skipped: 2 (1 already-fixed before this run, 1 deferred to Phase 13 with rationale)

## Fixed Issues

### WR-02: Migration 1 backfill silently leaves users-without-profile_settings on the default

**Files modified:** `supabase/migrations/20260423000001_phase11_wear_visibility.sql`, `supabase/migrations/20260423000007_phase11_backfill_coverage_assertion.sql`
**Commit:** `6bbc48c`
**Applied fix:**
- Corrected the misleading comment above the Migration 1 backfill UPDATE. The old comment said "runs unconditionally" — it actually runs only for users that have a matching `profile_settings` row (INNER JOIN semantics). New comment states this explicitly and cross-references Migration 7.
- Added a new Migration 7 (`20260423000007_phase11_backfill_coverage_assertion.sql`) with a read-only orphan-count assertion: counts `wear_events` rows whose user has no `profile_settings` row and raises an exception if any exist. In practice the Phase 7 trigger guarantees coverage, so this is a belt-and-suspenders check.
- Applied Migration 7 against the local stack — the `DO $$` block committed cleanly (orphan count = 0 as expected).

Chose the new-migration strategy over editing the already-applied Migration 1 in place because added runtime behavior belongs in a forward-only migration; only the documentation comment was corrected in Migration 1 (semantically inert).

### WR-04: Migration 4 ships a broken policy that only Migration 4b corrects

**Files modified:** `supabase/migrations/20260423000004_phase11_storage_bucket_rls.sql`
**Commit:** `426e010`
**Applied fix:** Added a prominent `KNOWN ISSUE (WR-04)` header block immediately under the migration's title comment. The header states:
- The SELECT policy below is broken without Migration 4b.
- Migration 4b replaces the policy with SECURITY DEFINER helpers that bypass `wear_events` RLS.
- Migration 6 tightens EXECUTE grants on those helpers.
- DO NOT deploy Migration 4 without 4b — non-owner access will fail closed.
- Treat 4 + 4b + 6 as an indivisible group; squashing is tracked as follow-up work.

No policy SQL was changed — this is a documentation-only fix to the migration file.

### WR-05: phase11-storage-rls.test.ts lacks follower-removal and signed-URL persistence coverage

**Files modified:** `tests/integration/phase11-storage-rls.test.ts`
**Commit:** `8b93c1b`
**Applied fix:** Added two dynamic test cases to the `three-tier SELECT (WYWT-14)` describe block, immediately after the static nine-cell matrix:
1. **Unfollow loses access** — F downloads followers-tier photo successfully, then `DELETE FROM follows WHERE follower_id = F`, then verifies F can no longer download. State is restored in a `finally` block (re-inserts the follow row) so subsequent tests and afterAll cleanup are unaffected.
2. **Visibility tightening removes access** — F downloads the public-tier photo successfully, then owner A tightens the wear event to `visibility='private'`, then verifies F can no longer download. State is restored in a `finally` block (back to `'public'`).

Both tests reuse the existing three-user fixture, `clientAs()` helper, and `canDownload()` helper — no new fixture setup required. The existing imports (`eq`, `follows`, `wearEvents`) already cover the needed Drizzle calls.

**Verification:** Ran the full suite against the local Supabase stack with `DATABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` set — all 14 tests pass (12 pre-existing + 2 new).

## Skipped Issues

### WR-01: SECURITY DEFINER helpers grant implicit probe access to any authenticated caller

**File:** `supabase/migrations/20260423000004b_phase11_storage_rls_secdef_fix.sql:24-61`
**Reason:** `already_fixed` — Migration 6 (`20260423000006_phase11_secdef_revoke_public.sql`, commit `93dec02`) landed before this fix-cycle started. That migration REVOKEs EXECUTE FROM PUBLIC, anon and GRANTs EXECUTE TO authenticated on all three SECDEF helpers (`get_wear_event_visibility_bypassing_rls`, `get_wear_event_owner_bypassing_rls`, `viewer_follows_bypassing_rls`), and includes an inline `DO $$` sanity assertion using `has_function_privilege()` to verify the grants landed correctly. The 12/12 storage RLS tests continue to pass after Migration 6. Per orchestrator instructions, no re-application or duplication of the fix was attempted.
**Original issue:** Three SECURITY DEFINER functions in Migration 4b were created without explicit REVOKE/GRANT, so Postgres's default PUBLIC EXECUTE grant exposed them to anon + authenticated RPC callers — a wider probe surface than the storage policy needs.

### WR-03: Dedup UNIQUE index has no DB-level guard on required payload keys

**File:** `supabase/migrations/20260423000002_phase11_notifications.sql:85-92`
**Reason:** `deferred_to_phase_13` — The notifications write-path is implemented in Phase 13 (notifications foundation). Enforcing payload-shape requirements is best expressed as a DAL invariant co-located with the INSERT logic (where the shape is constructed and validated) rather than as a partial-index predicate tweak in isolation. Adding a CHECK constraint or tightening the UNIQUE index predicate now, without Phase 13's DAL layer to observe and test the coupled behavior, risks:
- Creating an unused constraint whose migration timestamp precedes the code that exercises it, making the Phase 13 write path harder to test in isolation.
- Committing the DB to a specific payload-shape contract before the Server Action's v3.0 payload schema is finalized (Phase 13 may evolve keys beyond `watch_brand_normalized` / `watch_model_normalized`).

Phase 13 will carry a dedicated task to (a) add the DAL-layer payload validator, (b) tighten the partial UNIQUE index predicate to require both keys present + non-empty, and (c) optionally add the CHECK constraint once the payload schema freezes. The REVIEW.md guidance is preserved verbatim in the source review for Phase 13 pickup.
**Original issue:** The partial UNIQUE index on `payload->>'watch_brand_normalized'` + `payload->>'watch_model_normalized'` silently permits duplicate rows when either key is missing (NULL-distinct semantics in UNIQUE indexes) or empty-string. DB-level safety net is cheap to add but ties into Phase 13's write-path contract.

---

_Fixed: 2026-04-22T18:31:05Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
