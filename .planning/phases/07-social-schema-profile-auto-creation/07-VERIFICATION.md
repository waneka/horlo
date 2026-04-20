---
phase: 07-social-schema-profile-auto-creation
verified: 2026-04-19T00:00:00Z
status: human_needed
score: 7/9 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Confirm profile trigger was applied to production — run `supabase db push --linked` if not done and then create a new user account; verify a profiles row and a profile_settings row are auto-created"
    expected: "After signup, `SELECT * FROM public.profiles WHERE id = '<new-user-id>'` returns one row with a username derived from the email prefix, and `SELECT * FROM public.profile_settings WHERE user_id = '<new-user-id>'` returns one row with all visibility columns defaulting to true"
    why_human: "The trigger is fully implemented in code and the migration file exists, but whether `supabase db push --linked` was actually run against production and the trigger fires correctly requires a live Supabase project and an auth flow — cannot be verified programmatically"
  - test: "Confirm every existing user (the developer's account) has a profile row — either via account re-creation after migration or manual inspection"
    expected: "Querying `SELECT COUNT(*) FROM public.profiles` returns a count equal to `SELECT COUNT(*) FROM public.users`; no orphaned users exist without a profile row"
    why_human: "The documented approach (D-02) was for the developer to delete and re-create their account after applying migrations. Whether this was done cannot be verified from the codebase alone"
  - test: "Confirm RLS is enabled on all 5 new tables in the live production database"
    expected: "`SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('profiles', 'follows', 'profile_settings', 'activities', 'wear_events')` returns rowsecurity=true for all 5 tables"
    why_human: "RLS policies exist in migration files but whether `supabase db push --linked` was applied to production requires a live DB check"
  - test: "Confirm the column-drop migration was applied to production — `watches.last_worn_date` column no longer exists"
    expected: "`SELECT column_name FROM information_schema.columns WHERE table_name = 'watches' AND column_name = 'last_worn_date'` returns zero rows"
    why_human: "The Drizzle migration (`drizzle/0001_robust_dormammu.sql`) containing the DROP COLUMN was generated but the SUMMARY documents that `npx drizzle-kit push` (Task 2 of Plan 03) is a human-action checkpoint still pending"
---

# Phase 7: Social Schema & Profile Auto-Creation — Verification Report

**Phase Goal:** The five new social tables exist in Postgres with full RLS policies and correct indexes, and every user (new and existing) has a profile row.
**Verified:** 2026-04-19
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

All nine truths below are derived from the three PLAN frontmatter `must_haves` sections plus the five ROADMAP success criteria. ROADMAP SCs take precedence.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Five new tables (profiles, follows, profile_settings, activities, wear_events) exist in the Drizzle schema | VERIFIED | All five `export const` table definitions present in `src/db/schema.ts` lines 128-196; `unique` imported correctly |
| 2 | RLS is enabled on all five new tables with correct owner-scoped policies | VERIFIED (code) / ? HUMAN (prod) | `20260420000001_social_tables_rls.sql` contains exactly 5 `ENABLE ROW LEVEL SECURITY` statements; all UPDATE policies have both USING and WITH CHECK; SELECT open for profiles/follows/profile_settings, owner-only for activities/wear_events |
| 3 | A new user signup automatically creates a profiles row and a profile_settings row via DB trigger | VERIFIED (code) / ? HUMAN (prod) | `20260420000002_profile_trigger.sql` implements `handle_new_public_user()` with SECURITY DEFINER, fires on `public.users` INSERT, inserts into both `profiles` and `profile_settings`; username generated from email prefix with dedup loop |
| 4 | Username is auto-generated from email prefix with deduplication | VERIFIED | Trigger uses `regexp_replace(split_part(NEW.email, '@', 1), ...)`, enforces letter-start, 3-char minimum, 26-char truncation, WHILE loop with 4-digit random suffix |
| 5 | Required indexes exist on follows and activities tables | VERIFIED | `follows_follower_idx`, `follows_following_idx`, `activities_user_id_idx`, `activities_user_created_at_idx`, `wear_events_watch_worn_at_idx` present in both `20260419999999_social_tables_create.sql` and `drizzle/0001_robust_dormammu.sql` |
| 6 | Mark as Worn writes a wear_events row instead of updating watches.lastWornDate | VERIFIED | `src/app/actions/wearEvents.ts` calls `wearEventDAL.logWearEvent(user.id, watchId, today)`; no `editWatch` call for worn tracking in `WatchDetail.tsx` |
| 7 | Every existing user has a profile row | ? HUMAN | No backfill script was created. D-02 (documented in RESEARCH.md and CONTEXT.md) explicitly states the single existing user will delete and re-create their account — the trigger handles all future signups. Whether this account re-creation occurred is unverifiable from code. |
| 8 | Adding a watch writes an activity event; adding a worn event writes a watch_worn activity | VERIFIED | `src/app/actions/watches.ts:69` calls `logActivity` inside `addWatch` with type derived from `watch.status`; `src/app/actions/wearEvents.ts:22` calls `logActivity('watch_worn', ...)` inside `markAsWorn`; both wrapped in fire-and-forget try/catch |
| 9 | npm run build passes cleanly with zero lastWornDate references in core types/schema/DAL | VERIFIED | Build passes (13 routes generated, 0 TypeScript errors); `lastWornDate` absent from Watch interface, `src/db/schema.ts`, `src/data/watches.ts`, `src/app/actions/watches.ts`, `WatchForm.tsx`; only present in `WatchWithWear` (approved bridge type) and components accessing the prop |

**Score:** 7/9 truths verified (2 require human confirmation of production state)

---

### Deferred Items

None — all identified items are within Phase 7 scope or are human verification requirements.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/db/schema.ts` | Five new table definitions | VERIFIED | All 5 exports present: profiles (line 128), follows (142), profileSettings (157), activities (166), wearEvents (182) |
| `supabase/migrations/20260420000001_social_tables_rls.sql` | RLS policies for all five new tables | VERIFIED | 5x ENABLE ROW LEVEL SECURITY, 20 policies total, username CHECK constraint |
| `supabase/migrations/20260420000002_profile_trigger.sql` | Profile auto-creation trigger | VERIFIED | `handle_new_public_user` function with SECURITY DEFINER, `SET search_path = public`, `on_public_user_created` trigger |
| `src/data/wearEvents.ts` | Wear events DAL | VERIFIED | Exports `logWearEvent`, `getMostRecentWearDate`, `getWearEventsByWatch`, `getMostRecentWearDates`; uses `server-only`; `.onConflictDoNothing()` on insert |
| `src/app/actions/wearEvents.ts` | markAsWorn Server Action | VERIFIED | `'use server'`, reads userId from `getCurrentUser()`, calls `logWearEvent`, calls `logActivity('watch_worn')` fire-and-forget |
| `src/data/activities.ts` | Activity logging DAL | VERIFIED | Exports `logActivity` and `ActivityType`; uses `server-only`; inserts to activities table |
| `src/lib/types.ts` | Watch interface without lastWornDate; WatchWithWear added | VERIFIED | `Watch` interface has no `lastWornDate` field; `WatchWithWear extends Watch` with `lastWornDate?: string` added |
| `drizzle/0001_robust_dormammu.sql` | Column-drop migration with 5 social tables | VERIFIED | Contains all 5 CREATE TABLE statements plus `ALTER TABLE "watches" DROP COLUMN "last_worn_date"` |
| `supabase/migrations/20260419999999_social_tables_create.sql` | SQL to create social tables in Supabase | VERIFIED | Standalone SQL (not Drizzle-generated) with all 5 tables, foreign keys, and indexes for `supabase db push --linked` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `supabase/migrations/20260420000002_profile_trigger.sql` | `public.users` | AFTER INSERT trigger | VERIFIED | `CREATE TRIGGER on_public_user_created AFTER INSERT ON public.users` present at line 54 |
| `src/db/schema.ts` | `drizzle-orm/pg-core` | pgTable definitions | VERIFIED | `export const profiles = pgTable(` at line 128; `unique` imported at line 11 |
| `src/components/watch/WatchDetail.tsx` | `src/app/actions/wearEvents.ts` | markAsWorn Server Action call | VERIFIED | `import { markAsWorn } from '@/app/actions/wearEvents'` at line 24; called at line 77 |
| `src/app/actions/wearEvents.ts` | `src/data/wearEvents.ts` | DAL function call | VERIFIED | `import * as wearEventDAL from '@/data/wearEvents'`; `wearEventDAL.logWearEvent(...)` called at line 17 |
| `src/app/actions/watches.ts` | `src/data/activities.ts` | logActivity call after DAL mutation | VERIFIED | `import { logActivity } from '@/data/activities'` at line 6; called at line 69 inside addWatch |
| `src/app/watch/[id]/page.tsx` | `src/data/wearEvents.ts` | getMostRecentWearDate | VERIFIED | `import { getMostRecentWearDate } from '@/data/wearEvents'` at line 5; called at line 25; passed as `lastWornDate` prop |
| `src/app/insights/page.tsx` | `src/data/wearEvents.ts` | getMostRecentWearDates batch query | VERIFIED | `import { getMostRecentWearDates } from '@/data/wearEvents'` at line 9; called at line 137; builds `ownedWithWear: WatchWithWear[]` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `src/components/watch/WatchDetail.tsx` | `lastWornDate` prop | `getMostRecentWearDate` in server page → `wear_events` DB table | Yes — Drizzle SELECT with ORDER BY desc LIMIT 1 | FLOWING |
| `src/components/insights/SleepingBeautiesSection.tsx` | `watches: WatchWithWear[]` | `getMostRecentWearDates` in insights page → `wear_events` DB table | Yes — batch SELECT with `inArray` filter, builds Map | FLOWING |
| `src/data/activities.ts` | INSERT into activities | `logActivity` called from server actions | Yes — inserts real watch data from DAL-returned object, not client input | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Build produces all routes cleanly | `npm run build` | 13 routes generated, no TypeScript errors | PASS |
| `logWearEvent` does not conflict on duplicate same-day entry | `.onConflictDoNothing()` in `wearEvents.ts:16` | Verified in source | PASS |
| `logActivity` failure does not block parent mutation | try/catch at `watches.ts:65-76` and `wearEvents.ts:19-30` | Verified in source | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DATA-02 | 07-01 | Profiles table with username, display name, avatar URL, bio, auto-created on signup | SATISFIED | `profiles` table in schema; trigger creates row on signup; RLS policies present |
| DATA-03 | 07-01 | Follows table (asymmetric follow, follower/following) with appropriate indexes | SATISFIED | `follows` table in schema; `follows_follower_idx` and `follows_following_idx` in migration |
| DATA-04 | 07-03 | Activities table logging watch_added, wishlist_added, watch_worn events | SATISFIED | `activities` table in schema; `logActivity` DAL; integrated into `addWatch` and `markAsWorn` |
| DATA-05 | 07-01 | Profile settings table with profile_visibility, collection_public, wishlist_public, worn_public booleans | SATISFIED | `profile_settings` table with four boolean columns, all defaulting to true; auto-created by trigger |
| DATA-06 | 07-02 | Wear events table replacing/augmenting lastWornDate with structured wear history | SATISFIED | `wear_events` table; `lastWornDate` removed from Watch type, schema, DAL; `WatchWithWear` bridge; `markAsWorn` writes to wear_events |

**Requirement DATA-07** (RLS on all new social tables, Phase 6 per traceability table) is also fulfilled by this phase's `20260420000001_social_tables_rls.sql`, which adds RLS policies to all 5 new tables. This is a positive over-delivery from Phase 6's perspective.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `supabase/migrations/20260420000002_profile_trigger.sql` | 38-41 | Unbounded WHILE loop — random 4-digit suffix with no iteration cap | Warning | Low probability today (single user); becomes a risk with common email prefixes at scale. Flagged in 07-REVIEW.md as CR-01. |
| `src/data/wearEvents.ts` | 48 | Dynamic `import('drizzle-orm')` inside hot function body | Info | Module cache prevents repeated resolution; static import would be cleaner. Flagged in 07-REVIEW.md as WR-04. |
| `src/components/insights/SleepingBeautiesSection.tsx` | 14 | Filter includes `status === 'grail'` — grail watches are unowned, cannot be worn | Info | Dead code — parent page already passes only owned watches, so grail branch never matches. Flagged in 07-REVIEW.md as WR-02. |

None of these rise to blocker status for the phase goal. The unbounded loop is a long-term scalability concern. The review file (07-REVIEW.md) has already catalogued these as CR-01 and WR-04 with specific fixes.

---

### Human Verification Required

#### 1. Profile Trigger Applied to Production

**Test:** After running `supabase db push --linked` (if not already done), create a new user account via the app signup flow.

**Expected:** A row exists in `public.profiles` with a username derived from the email prefix (e.g., email `john@example.com` produces username `john` or `john_NNNN` if taken). A row also exists in `public.profile_settings` with all four boolean columns set to `true`.

**Verification SQL:**
```sql
SELECT p.id, p.username, ps.profile_public, ps.collection_public
FROM public.profiles p
JOIN public.profile_settings ps ON p.id = ps.user_id
WHERE p.id = '<new-user-id>';
```

**Why human:** The trigger implementation exists in code and is complete, but whether `supabase db push --linked` was actually run against the production project and the trigger fires on the real Supabase Auth flow cannot be verified programmatically.

---

#### 2. Existing User Has a Profile Row

**Test:** Query the production database to confirm the developer's existing account has a profile row.

**Expected:** `SELECT COUNT(*) FROM public.profiles` equals `SELECT COUNT(*) FROM public.users` — no orphaned user rows without a profile.

**Context:** D-02 documents the single-user decision: the developer would delete and re-create their account after applying migrations rather than running a backfill. This must be confirmed.

**Why human:** Account deletion/re-creation is a live Supabase operation; no code artifact proves it occurred.

---

#### 3. RLS Active on All 5 Tables in Production

**Test:** Run in Supabase SQL Editor (which uses service role and bypasses RLS):
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'follows', 'profile_settings', 'activities', 'wear_events');
```

**Expected:** All 5 rows show `rowsecurity = true`.

**Why human:** Migration files exist; production application requires confirming `supabase db push --linked` ran successfully.

---

#### 4. Column-Drop Migration Applied (lastWornDate Removed from Production DB)

**Test:** Run `npx drizzle-kit push` to apply `drizzle/0001_robust_dormammu.sql`, then verify:
```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'watches' AND column_name = 'last_worn_date';
```

**Expected:** Zero rows returned — column no longer exists.

**Note:** Per the prompt context provided by the developer: the `lastWornDate` column drop has NOT been applied yet — the column was temporarily re-added because deployed code still references it. This is a known sequencing issue awaiting a deploy of the new code, after which `npx drizzle-kit push` can be run safely. This item is informational, not a blocking gap in the phase's code deliverables.

**Why human:** Production DB state cannot be verified from the codebase.

---

### Gaps Summary

No code-level gaps were found. All artifacts exist, are substantive, and are correctly wired. The phase's code deliverables are complete.

The four human verification items above concern **production database state** — whether migrations were applied via `supabase db push --linked` and `npx drizzle-kit push`. These are operational steps, not code authorship failures. The phase's code is ready for those steps to be run and confirmed.

The `lastWornDate` column-drop sequencing (noted by the developer in the verification prompt) is an expected deployment ordering constraint, not a phase gap.

---

_Verified: 2026-04-19_
_Verifier: Claude (gsd-verifier)_
