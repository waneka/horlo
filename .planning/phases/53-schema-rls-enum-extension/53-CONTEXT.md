# Phase 53: Schema + RLS + Enum Extension - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning

<domain>
## Phase Boundary

The database foundation for likes + comments. This phase delivers the tables, constraints (FK cascade + UNIQUE on likes + CHECK on comments), two-layer RLS security with an in-migration anon-block assertion, the SECDEF-revoke discipline (if any SECDEF helper is introduced), the four new `notification_type` enum values, and the two new `profile_settings` opt-out columns.

**In scope:** `watch_likes` / `wear_likes` / `comments` tables; their FK cascades, UNIQUE/CHECK constraints, and RLS policies; the anon-block `DO $$` assertion; `ALTER TYPE notification_type ADD VALUE` x4; `notify_on_like` + `notify_on_comment` columns on `profile_settings`.

**Out of scope (later phases):** DAL functions incl. `isMutualFollow` and `getCommentsForTarget` (Phase 54); Server Actions, notification dedup index, cache invalidation (Phase 55); all UI (Phases 56–58). No data is read or written by this phase — it only shapes the database.

</domain>

<decisions>
## Implementation Decisions

### Data Model — likes + comments tables
- **D-01:** Likes use **per-target tables** — `watch_likes` and `wear_likes`. Each has `user_id → users(id) ON DELETE CASCADE`, a target FK (`watch_id → watches(id)` / `wear_event_id → wear_events(id)`) `ON DELETE CASCADE`, and `UNIQUE(user_id, <target>)` to make likes idempotent (LIKE-05). **Rejected:** a single polymorphic `reactions` table keyed by `(target_type, target_id)` — no real FK means app-layer orphan cleanup on every delete path (a cascade gap); PITFALLS lists it as "never for this project."
- **D-02:** Comments use **one shared `comments` table** with two nullable FKs (`watch_id → watches(id) ON DELETE CASCADE`, `wear_event_id → wear_events(id) ON DELETE CASCADE`) and a CHECK that **exactly one** is non-null (`(watch_id IS NULL) <> (wear_event_id IS NULL)`). Single DAL / Server-Action path while keeping real FK cascade. **Rejected:** split `watch_comments`/`wear_comments` — duplication with no UNIQUE-constraint payoff (unlike likes). Intentional asymmetry: likes split (clean UNIQUE), comments shared (no UNIQUE) — STACK's recommended bundle.
- **D-03:** SEC-06 (deleting a watch or wear removes its likes + comments) is delivered **entirely by FK `ON DELETE CASCADE`** — no application-layer orphan cleanup on any path.
- **D-04:** Comment body constraints at the DB layer: CHECK `char_length(body) <= 500` **and** non-blank (`btrim(body) <> ''`). 500-char limit is locked by REQUIREMENTS CMNT-04; the Zod `.strict()` and `<Textarea maxLength>` layers land in later phases and must match this number.

### RLS & Security — two-layer, anon-blocked
- **D-05:** All three new tables get `ENABLE ROW LEVEL SECURITY` with policies scoped **`TO authenticated`** (never anon), following the existing `{table}_{operation}_own` naming and `(SELECT auth.uid())` InitPlan-optimization convention. An in-migration `DO $$` assertion confirms the `anon` role cannot SELECT from each new table (mirrors the Phase 11 migration pattern). Satisfies SEC-01 + Phase 53 success-criterion 2.
- **D-06:** The wishlist mutual-follow gate is enforced in **both** layers (SEC-02). RLS layer: the `comments` INSERT `WITH CHECK` (and SELECT `USING`) encodes the gate via an **inline `follows` subquery** — viable because `follows` already has `follows_select_all ... TO authenticated USING (true)` (pre-flight RESOLVED, see code_context). The DAL `WHERE`/gate pre-flight is the second layer (Phase 54).
- **D-07:** A **SECURITY DEFINER function is most likely NOT required** for the mutual-follow gate: `follows` is authenticated-readable so an inline subquery works at the RLS layer, and the Phase 54 TypeScript `isMutualFollow` helper runs on the RLS-bypassing service-role client. **IF** the planner does introduce any SECDEF helper, it MUST `REVOKE EXECUTE FROM PUBLIC, anon` with an in-migration `has_function_privilege('anon', …) = false` assertion (SEC-04) — `REVOKE FROM PUBLIC` alone is insufficient on Supabase. See [[project_supabase_secdef_grants]].
- **D-08:** Likes RLS stays **open to all authenticated users on every watch status, including wishlist** (GATE-02 asymmetry). The gate is comments-only.

### Notification enum extension
- **D-09:** Add the four values with standalone `ALTER TYPE notification_type ADD VALUE IF NOT EXISTS '<v>'` statements (`watch_like`, `wear_like`, `watch_comment`, `wear_comment`), each run **outside a transaction block**. This is the ADD path and is explicitly **NOT** the Phase 24 rename+recreate pattern (that existed only to *remove* values). The `pg_depend` gotcha applies to removal/cleanup, not to ADD VALUE. See [[project_drizzle_supabase_db_mismatch]].

### profile_settings opt-out columns
- **D-10:** Add `notify_on_like` + `notify_on_comment` boolean columns to `profile_settings` **in this migration** (so Phase 58 only wires UI — one schema change, not two), `NOT NULL DEFAULT true` (opt-out, matching `notify_on_follow` / `notify_on_watch_overlap`). Existing rows backfill to `true`. **RLS is unchanged** — `profile_settings_select_all` + `profile_settings_update_own` already cover the new columns. `logNotification` reads these write-time (Phase 55). NOTIF-15's "opt out" framing settles default-on.

### Status-flip / gate semantics (locks Phase 54 read predicate; no Phase 53 schema impact)
- **D-11:** **Grandfather policy** — comment rows are **never deleted** on a status flip. The read gate keys off the watch's **current** status: while `wishlist`, the thread is visible only to mutual-followers + owner; flipping back to `owned` restores visibility for everyone. No snapshot column, no destructive action. Locks the `getCommentsForTarget` predicate for Phase 54.

### Migration mechanics (carry-forward — not re-decided this session)
- **D-12:** Drizzle holds **column shapes only**; raw SQL in `supabase/migrations/` is authoritative for CHECK constraints, partial/special indexes, and RLS (existing `notifications` + `watches_catalog` convention). `drizzle-kit push` is **LOCAL ONLY**; prod goes through `supabase db push --linked`. Test the enum `ADD VALUE` (non-transactional) on local before prod. See [[project_drizzle_supabase_db_mismatch]].

### Claude's Discretion
- Exact index set on the new tables (e.g., `watch_likes(watch_id)` for count GROUP BY, `comments(watch_id, created_at)` / `comments(wear_event_id, created_at)` for oldest-first reads) — planner/researcher choose from the count + chronological read patterns.
- Column naming details, timestamp columns (`created_at`; `edited_at` on comments per CMNT-06), and migration filename/sequencing.
- Whether the comments gate appears in the SELECT `USING` clause in addition to the INSERT `WITH CHECK` at the RLS layer — must satisfy SEC-02's both-layer requirement; researcher confirms the safest encoding.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — Phase 53 owns SEC-01, SEC-04, SEC-06, LIKE-05, GATE-02; CMNT-04 (500-char) is the locked comment limit referenced by D-04.
- `.planning/ROADMAP.md` §"Phase 53" — the five success criteria are the verification contract for this phase.

### Research (HIGH confidence; read SUMMARY first)
- `.planning/research/SUMMARY.md` — data-model disagreement resolution, enum ADD-VALUE reconciliation, the 6 open pre-flights, top-5 pitfalls.
- `.planning/research/ARCHITECTURE.md` — polymorphic position (rejected) + cache-tag taxonomy for later phases.
- `.planning/research/PITFALLS.md` — RLS anon-read, SECDEF auto-grant, asymmetric gate, unidirectional mutual-follow, cascade gap. Most relevant file for this phase.
- `.planning/research/STACK.md` — per-target-likes + shared-comments recommendation adopted in D-01/D-02.

### Migration precedents (raw SQL is authoritative)
- `supabase/migrations/20260423000002_phase11_notifications.sql` — RLS `TO authenticated` + anon-block `DO $$` assertion + CHECK/partial-index/dedup-UNIQUE pattern to mirror.
- `supabase/migrations/20260423000046_phase11_secdef_revoke_public.sql` — the SECDEF `REVOKE … FROM PUBLIC, anon` + `has_function_privilege` assertion precedent (only if a SECDEF helper is introduced).
- `supabase/migrations/20260420000001_social_tables_rls.sql` — `follows_select_all` / `profile_settings_select_all` / naming + `(SELECT auth.uid())` convention; confirms the pre-flight in D-06.
- `supabase/migrations/20260425000000_phase13_profile_settings_notifications.sql` — `notify_on_follow` / `notify_on_watch_overlap` column + default-true precedent for D-10.
- `supabase/migrations/20260501000000_phase24_notification_enum_cleanup.sql` — the rename+recreate REMOVAL history; read it to understand why ADD VALUE (D-09) is the *different*, correct tool here.

### Schema source of truth
- `src/db/schema.ts` — `notificationTypeEnum` (currently `['follow','watch_overlap']`), `profileSettings`, `watches`, `wearEvents`, `follows`, `notifications`, `activities` table defs; new pgTable defs + enum values are added here.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 11 notifications migration is the closest template for a new-table-with-RLS-and-assertions migration (anon-block `DO $$`, partial index, dedup UNIQUE).
- `profile_settings` already carries two `notify_on_*` opt-out booleans (`default true`) — D-10 is a straight ALTER following that exact shape.

### Established Patterns
- RLS policy naming: `{table}_{operation}_own`; every `auth.uid()` wrapped as `(SELECT auth.uid())` for InitPlan optimization.
- Two-layer privacy is a project invariant: RLS `TO authenticated` blocks anon at the DB; the DAL `WHERE` (service-role client bypasses RLS) is the load-bearing second layer.
- FK cascade is the house style for owned data (`wear_events.watch_id`, `watches.user_id`, `follows.*`, `divestments.user_id` all cascade) — D-01/D-02 stay consistent with it.
- `notifications` / `watches_catalog` document the "Drizzle = column shapes only, raw SQL authoritative for CHECK/index/RLS" split (D-12).

### Integration Points
- `src/db/schema.ts`: add `watch_likes`, `wear_likes`, `comments` pgTable defs; append 4 values to `notificationTypeEnum`; add 2 columns to `profileSettings`.
- `supabase/migrations/`: one new migration file carrying tables + RLS + assertions + enum ADD VALUEs (enum statements must be non-transactional) + the `profile_settings` ALTER.

### Pre-flights (resolved during discussion)
- **RESOLVED — `follows` SELECT RLS policy exists.** `supabase/migrations/20260420000001_social_tables_rls.sql:17` defines `follows_select_all ON public.follows FOR SELECT TO authenticated USING (true)`. → The comments mutual-follow gate can use an inline `follows` subquery at the RLS layer; a SECDEF helper is most likely unnecessary (D-06/D-07). Researcher should still confirm before finalizing the policy.
- **NOTE — `wear_events` SELECT was expanded post-Phase-10** (visibility ripple) beyond the original owner-only policy. Relevant to *wear*-target like/comment visibility at the DAL layer (Phase 54), not to the Phase 53 anon-block requirement.

</code_context>

<specifics>
## Specific Ideas

- The likes/comments asymmetry is deliberate: likes split per-target (clean `UNIQUE(user, target)`), comments in one shared table (no UNIQUE, so two nullable FKs + a one-and-only-one CHECK is cleaner than two tables).
- Grandfather behavior should feel reversible to the user: moving a watch to wishlist hides its existing public comment thread from non-mutuals; moving it back surfaces the same thread again — nothing is destroyed.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (Future social work — liker-avatar strip, reply fan-out, email digest, @mentions, threaded replies — is already tracked in `.planning/REQUIREMENTS.md` §"Future Requirements" as SOC-F1…F5.)

</deferred>

---

*Phase: 53-schema-rls-enum-extension*
*Context gathered: 2026-05-22*
