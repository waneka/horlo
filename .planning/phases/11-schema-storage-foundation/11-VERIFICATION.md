---
phase: 11-schema-storage-foundation
verified: 2026-04-22T12:00:00Z
resolved: 2026-04-22T18:45:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
deferred:
  - truth: "worn_public column removed from profile_settings after backfill verified"
    addressed_in: "Phase 12"
    evidence: "Phase 12 goal: 'Every existing function that reads wear_events for non-owner viewers correctly enforces the three-tier visibility gate'; PLAN frontmatter decision D-06 locks the column drop to Phase 12 after the DAL ripple lands. ROADMAP Phase 11 SC-1 only requires backfill, not removal."
human_verification:
  - test: "Confirm SECURITY DEFINER helpers are not probe-accessible to arbitrary callers"
    expected: "Any authenticated user querying get_wear_event_visibility_bypassing_rls(arbitrary_uuid), get_wear_event_owner_bypassing_rls(arbitrary_uuid), or viewer_follows_bypassing_rls(uuid1, uuid2) via Supabase RPC should receive a permission-denied error. If they return data, the WR-01 exposure is live."
    why_human: "Privilege grants on SECURITY DEFINER functions are a live-DB check. The migration file (20260423000004b) contains no REVOKE/GRANT clauses, meaning PUBLIC has EXECUTE by default. A human must run `SELECT has_function_privilege('authenticated', 'public.get_wear_event_visibility_bypassing_rls(uuid)', 'EXECUTE')` and `SELECT has_function_privilege('anon', 'public.get_wear_event_owner_bypassing_rls(uuid)', 'EXECUTE')` on the live local DB, and confirm whether the WR-01 risk is accepted or needs the REVOKE fix recommended in 11-REVIEW.md."
    result: "resolved — Migration 6 (20260423000006_phase11_secdef_revoke_public.sql, commit 93dec02) revoked EXECUTE from PUBLIC and anon, granted EXECUTE to authenticated. Post-fix has_function_privilege returns false for anon on all three helpers, true for authenticated. 12/12 storage RLS tests still pass."
  - test: "Confirm private wear photo returns 403 for incognito (unauthenticated) access"
    expected: "Direct URL or signed URL from a different authenticated user for a visibility='private' wear photo should return 403 or a RLS-denied error, not a 200."
    why_human: "The integration test (phase11-storage-rls.test.ts) verifies the 9-cell matrix using authenticated clients, but the roadmap SC-3 specifically mentions 'direct URL access in incognito returns 403'. Unauthenticated access is blocked by the TO authenticated grant, but verifying this in an actual browser incognito window requires a human step."
    result: "resolved — user manually verified in browser incognito window against the local Supabase stack. Direct URL access to a visibility='private' wear photo returned the expected unauthenticated-denied response (not 200 with image bytes)."
---

# Phase 11: Schema + Storage Foundation Verification Report

**Phase Goal:** All database schemas, migrations, storage infrastructure, and RLS policies are in place so every downstream phase has a stable foundation to build on.
**Verified:** 2026-04-22
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | `wear_visibility` enum with values public/followers/private; `wear_events` has photo_url, note, visibility columns; all existing rows backfilled from worn_public (false→private, true→public, no followers rows) | VERIFIED | Migration 1 (`20260423000001`) creates the enum, adds columns with `IF NOT EXISTS`, backfills via INNER JOIN from `profile_settings.worn_public`, and inline DO$$ verification block asserts 0 followers-count rows. `src/db/schema.ts` exports `wearVisibilityEnum` and `wearEvents` includes `photoUrl` and `visibility` fields. 30/30 Wave 0 tests passed per Plan 05 SUMMARY. |
| 2 | `notifications` table with id/user_id/type/payload/read_at/created_at; partial index on (user_id) WHERE read_at IS NULL; RLS allows recipient-only SELECT/UPDATE; no INSERT policy for anon key | VERIFIED | Migration 2 (`20260423000002`) creates table, creates `notifications_user_unread_idx` partial index, creates `notifications_select_recipient_only` and `notifications_update_recipient_only` policies with `(SELECT auth.uid())` InitPlan pattern. No INSERT/DELETE policy. 3/3 NOTIF-01 Wave 0 tests passed. |
| 3 | `wear-photos` bucket exists as private; Storage RLS enforces three-tier access; direct URL to private photo returns 403 | PARTIAL | Bucket creation (Migration 4) and four storage.objects policies confirmed in code. Migration 4b replaces the broken SELECT policy with SECURITY DEFINER helpers, and 12/12 storage-rls tests passed. However: (a) WR-01 — the three SECURITY DEFINER functions have no REVOKE/GRANT clauses, granting PUBLIC execute by default, exposing wear_event visibility, owner user_id, and follow relationships to any caller; (b) the "direct URL in incognito returns 403" aspect requires human verification. The policy end-state is functionally correct for the three-tier access matrix, but the WR-01 over-broad helper exposure is an unresolved code review warning. |
| 4 | `pg_trgm` extension enabled in Supabase; GIN trigram indexes on profiles.username and profiles.bio; query plan for username ILIKE shows index scan | VERIFIED | Migration 3 (`20260423000003`) creates `CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions` and both GIN indexes with `gin_trgm_ops` opclass. 3/3 SRCH-08 Wave 0 tests passed. EXPLAIN assertion was relaxed to index-existence check (documented as pre-approved fallback in Plan 01 SUMMARY — planner chose Seq Scan on small tables, which is expected behavior). |
| 5 | users, watches, user_preferences tables all have RLS policies using `(SELECT auth.uid())` InitPlan pattern; every UPDATE policy has both USING and WITH CHECK clauses | VERIFIED | `20260420000000_rls_existing_tables.sql` reviewed directly. All 12 policies present. All three UPDATE policies (`users_update_own`, `watches_update_own`, `user_preferences_update_own`) have both USING and WITH CHECK. Every `auth.uid()` occurrence is wrapped in `(SELECT auth.uid())`. Migration 5 DO$$ sanity assertion passed during the Plan 05 schema push. 4/4 DEBT-02 regression tests passed. |

**Score:** 4/5 truths fully verified (Truth 3 is PARTIAL — functionally correct for the access matrix but WR-01 requires human decision on privilege tightening)

### Deferred Items

Items not yet met but explicitly addressed in later milestone phases.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | `worn_public` column removed from `profile_settings` after backfill verified | Phase 12 | WYWT-11 full requirement includes column removal. Phase 11 PLAN decision D-06 explicitly locks the drop to Phase 12 after the DAL ripple. ROADMAP Phase 12 goal is "Every existing function that reads wear_events for non-owner viewers correctly enforces the three-tier visibility gate" and Phase 11 SC-1 only requires backfill, not removal. The column remains in `src/db/schema.ts` and `profile_settings` table. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/db/schema.ts` | Exports wearVisibilityEnum, notificationTypeEnum, wearEvents+photoUrl+visibility, notifications table | VERIFIED | All exports confirmed present. `pgEnum` imported. `wearEvents` has `photoUrl: text('photo_url')` and `visibility: wearVisibilityEnum('visibility').notNull().default('public')`. |
| `drizzle/0003_phase11_wear_events_columns.sql` | Two ALTER TABLE ADD COLUMN lines, no CREATE TYPE | VERIFIED | Contains exactly `ALTER TABLE "wear_events" ADD COLUMN "photo_url" text` and `ALTER TABLE "wear_events" ADD COLUMN "visibility" "wear_visibility" DEFAULT 'public' NOT NULL`. No CREATE TYPE or CREATE TABLE. |
| `supabase/migrations/20260423000001_phase11_wear_visibility.sql` | Enum + ADD COLUMN + note CHECK + backfill + DO$$ verification, BEGIN/COMMIT, no DROP COLUMN worn_public | VERIFIED | All elements present. Backfill CASE uses only 'public' and 'private' literals (never 'followers'). DO$$ block with RAISE EXCEPTION on followers_count > 0. No DROP COLUMN worn_public. |
| `supabase/migrations/20260423000002_phase11_notifications.sql` | notifications table, notification_type enum, 4 indexes (including partial unread), CHECK, 2 RLS policies (SELECT+UPDATE), no INSERT/DELETE policy | VERIFIED | All present. Partial UNIQUE dedup index on `(user_id, payload->>'watch_brand_normalized', payload->>'watch_model_normalized', (created_at AT TIME ZONE 'UTC')::date) WHERE type = 'watch_overlap'`. Both policies use `(SELECT auth.uid())`. |
| `supabase/migrations/20260423000003_phase11_pg_trgm.sql` | CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions; two GIN indexes with gin_trgm_ops | VERIFIED | Extension with schema qualifier present. Both `profiles_username_trgm_idx` and `profiles_bio_trgm_idx` use `USING gin (... gin_trgm_ops)`. |
| `supabase/migrations/20260423000004_phase11_storage_bucket_rls.sql` | wear-photos bucket (private, 5MB, JPEG/PNG/WEBP), 4 storage policies | VERIFIED (with caveat) | All 4 policies present (DROP-THEN-CREATE pattern). Bucket private. WR-04 noted: this SELECT policy is superseded by Migration 4b. The file lacks a warning comment that it requires 4b to function correctly for non-owner access. |
| `supabase/migrations/20260423000004b_phase11_storage_rls_secdef_fix.sql` | SECURITY DEFINER helpers + updated SELECT policy | VERIFIED (with WR-01 concern) | Three helpers created. SELECT policy updated. However, no REVOKE/GRANT clauses means all functions are PUBLIC EXECUTE by default. `get_wear_event_owner_bypassing_rls` leaks user_id contrary to the file comment. |
| `supabase/migrations/20260423000005_phase11_debt02_audit.sql` | DO$$ assertion on 12 policy names, no DDL | VERIFIED | Contains exactly the 12 expected policy names in the sanity array. No CREATE POLICY, DROP POLICY, or ALTER TABLE. DEBT-02 audit header comment with checklist. |
| `tests/integration/phase11-schema.test.ts` | Wave 0 tests for WYWT-09/WYWT-13/SRCH-08, DATABASE_URL gated | VERIFIED | File exists. DATABASE_URL gate present. 8/8 tests passed. |
| `tests/integration/phase11-notifications-rls.test.ts` | Wave 0 tests for NOTIF-01 (recipient RLS, self-notif CHECK, dedup), env-gated | VERIFIED | File exists. 3/3 tests passed. |
| `tests/integration/phase11-pg-trgm.test.ts` | Wave 0 tests for SRCH-08 (extension, indexes, EXPLAIN), DATABASE_URL gated | VERIFIED | File exists. 3/3 tests passed. EXPLAIN relaxed to index-existence (pre-approved). |
| `tests/integration/phase11-storage-rls.test.ts` | Wave 0 9-cell access matrix + folder enforcement + bucket privacy | VERIFIED | File exists. 12/12 tests passed. |
| `tests/integration/debt02-rls-audit.test.ts` | DEBT-02 ongoing regression: 4 scenarios for users/watches/user_preferences IDOR | VERIFIED | File exists. 4/4 tests passed. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| Migration 1 backfill | profile_settings.worn_public | `UPDATE wear_events we ... FROM profile_settings ps WHERE ps.user_id = we.user_id` | VERIFIED | INNER JOIN pattern confirmed in migration file line 60-66. |
| Migration 4b SELECT policy | wear_events.visibility | `public.get_wear_event_visibility_bypassing_rls(uuid)` SECURITY DEFINER helper | VERIFIED (WR-01 caveat) | Policy calls helper; helper returns `SELECT visibility FROM wear_events WHERE id = p_wear_event_id`. Bypass needed because wear_events has owner-only RLS. |
| Migration 4b SELECT policy (followers branch) | follows table | `public.viewer_follows_bypassing_rls(uid, owner_uid)` SECURITY DEFINER helper | VERIFIED | Helper performs EXISTS on follows table with SECURITY DEFINER context. |
| notifications table | users table | `REFERENCES users(id) ON DELETE CASCADE` on both user_id and actor_id | VERIFIED | Two ON DELETE CASCADE clauses confirmed in Migration 2. |
| `src/db/schema.ts` wearVisibilityEnum | wearEvents.visibility column | `visibility: wearVisibilityEnum('visibility').notNull().default('public')` | VERIFIED | Direct pgEnum reference in column definition. |

### Data-Flow Trace (Level 4)

The phase 11 artifacts are migrations and test scaffolds — not components rendering dynamic data. No data-flow trace required for migration SQL files. Integration tests verify DB-layer behavior directly, not component rendering.

### Behavioral Spot-Checks

Per Plan 05 SUMMARY, the schema push and all Wave 0 tests were run against the live local DB:

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| wear_visibility enum exists | `SELECT 1 FROM pg_type WHERE typname='wear_visibility'` | 1 row | PASS |
| notification_type enum exists | `SELECT 1 FROM pg_type WHERE typname='notification_type'` | 1 row | PASS |
| pg_trgm extension enabled | `SELECT 1 FROM pg_extension WHERE extname='pg_trgm'` | 1 row | PASS |
| wear-photos bucket is private | `SELECT id, public FROM storage.buckets WHERE id='wear-photos'` | 1 row, public=f | PASS |
| No followers-residue rows | `SELECT COUNT(*) FROM wear_events WHERE visibility='followers'` | 0 | PASS |
| DEBT-02 policy count | 4 key DEBT-02 policies present | 4 | PASS |
| Phase 11 Wave 0 test suite | `vitest run ... tests/integration/phase11-*.test.ts debt02-rls-audit.test.ts` | 30/30 passed | PASS |
| Full suite regression | `npm test` | 2108 passed, 11 pre-existing failures (confirmed pre-Phase-11), 0 new regressions | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| WYWT-09 | Plan 01 | wear_events schema extended with photo_url, note CHECK, visibility + wear_visibility enum | SATISFIED | Migration 1 + schema.ts + 8/8 phase11-schema tests |
| WYWT-11 | Plan 01 | Backfill wear_events.visibility from worn_public; worn_public deprecated | PARTIALLY SATISFIED | Backfill complete and verified. Column removal deferred to Phase 12 (D-06, deliberate design). Roadmap SC-1 only requires backfill, not removal — Phase 11 obligation is met. |
| WYWT-13 | Plan 04 | wear-photos bucket exists, private, 5MB limit, JPEG/PNG/WEBP | SATISFIED | Migration 4 + bucket privacy test passing |
| WYWT-14 | Plan 04/04b | Storage RLS three-tier enforcement (owner/public/followers/private) | SATISFIED (with WR-01 caveat) | 9-cell access matrix tests all pass. WR-01 security concern (over-broad EXECUTE grants on SECURITY DEFINER helpers) needs human decision. |
| NOTIF-01 | Plan 02 | notifications table, RLS, recipient-only SELECT/UPDATE, no INSERT for anon | SATISFIED | Migration 2 + 3/3 NOTIF-01 tests passing |
| SRCH-08 | Plan 03 | pg_trgm enabled, GIN indexes on profiles.username and profiles.bio | SATISFIED | Migration 3 + 3/3 SRCH-08 tests passing |
| DEBT-02 | Plan 05 | RLS audit on users/watches/user_preferences — InitPlan pattern + WITH CHECK | SATISFIED | Migration 5 audit confirms all 12 policies correct + 4/4 IDOR regression tests passing |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `supabase/migrations/20260423000004b_phase11_storage_rls_secdef_fix.sql` | 24-61 | SECURITY DEFINER functions with no REVOKE/GRANT — PUBLIC has EXECUTE by default; `get_wear_event_owner_bypassing_rls` returns user_id, contradicting the file's own comment | Warning (WR-01) | Any authenticated (and possibly anon) caller can probe wear event visibility, owner user_id, and arbitrary follow relationships via RPC. Not a CI-breaking blocker but is a production security concern requiring privilege tightening before prod deploy. |
| `supabase/migrations/20260423000001_phase11_wear_visibility.sql` | 60-66 | Backfill uses INNER JOIN — users without profile_settings row silently keep DEFAULT 'public' | Warning (WR-02) | Low risk in practice (Phase 7 trigger guarantees coverage), but the comment claiming "runs unconditionally" is misleading and no orphan-count assertion exists. |
| `supabase/migrations/20260423000004_phase11_storage_bucket_rls.sql` | Header | No warning comment that SELECT policy is broken without Migration 4b | Warning (WR-04) | Partial migration apply (stop at Migration 4) results in a broken fail-closed SELECT policy for non-owners. |
| `tests/integration/phase11-schema.test.ts` | 68 | Hardcoded UUID `'00000000-0000-0000-0000-0000000b1101'` for test user | Info (IN-01) | Parallel test run collision risk. Not blocking. |

### Human Verification Required

#### 1. SECURITY DEFINER Helper Privilege Check (WR-01)

**Test:** On the local Supabase DB, run:
```sql
SELECT has_function_privilege('authenticated', 'public.get_wear_event_visibility_bypassing_rls(uuid)', 'EXECUTE');
SELECT has_function_privilege('authenticated', 'public.get_wear_event_owner_bypassing_rls(uuid)', 'EXECUTE');
SELECT has_function_privilege('anon', 'public.viewer_follows_bypassing_rls(uuid, uuid)', 'EXECUTE');
```
Also attempt to call one helper via the Supabase JS client (`supabase.rpc('get_wear_event_visibility_bypassing_rls', { p_wear_event_id: '<some uuid>' })`) as an authenticated non-owner user.

**Expected:** Either (a) the calls return permission-denied (meaning REVOKE has already been applied or Supabase restricts RPC access), or (b) they succeed, in which case the WR-01 fix from 11-REVIEW.md must be applied before production rollout: either `REVOKE EXECUTE ... FROM PUBLIC, anon` + `GRANT EXECUTE ... TO authenticated` on each helper, or replacing all three helpers with a single boolean `can_view_wear_photo(wear_event_id, viewer_id)` function.

**Why human:** EXECUTE privilege state on SECURITY DEFINER functions requires a live-DB check. The migration file contains no REVOKE/GRANT DDL, so the risk exists unless Supabase's PostgREST configuration restricts RPC access independently.

#### 2. Incognito / Unauthenticated Storage Access Check (Roadmap SC-3)

**Test:** In a browser incognito window (no session), attempt to access a wear photo URL at `https://<project>.supabase.co/storage/v1/object/public/wear-photos/<path>` for a wear event with `visibility='private'`.

**Expected:** HTTP 403 or a storage error — not a 200 with photo data.

**Why human:** The storage.objects policies are `TO authenticated` (no anon policy), meaning unauthenticated requests should be blocked. However, verifying "direct URL in incognito returns 403" as stated in Roadmap SC-3 requires a browser test that cannot be automated in vitest without a live HTTP endpoint.

## Gaps Summary

No gaps that block goal achievement are present — all five success criteria are substantively met. The two human verification items above represent security posture questions about the production-readiness of the SECURITY DEFINER approach (WR-01) and the incognito access guarantee (Roadmap SC-3 wording). The access matrix tests (12/12 passing) demonstrate correct three-tier enforcement for authenticated users; the human items are about the unauthenticated boundary and privilege hygiene.

The code review identified WR-01 (SECURITY DEFINER over-broad EXECUTE grants) as the most notable concern for production. The recommended fix is straightforward and low-risk (REVOKE/GRANT DDL or function consolidation). This should be resolved before the Phase 11 migrations are deployed to production via `supabase db push --linked`.

---

_Verified: 2026-04-22_
_Verifier: Claude (gsd-verifier)_
