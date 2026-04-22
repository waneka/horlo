# Phase 12: Visibility Ripple in DAL — Research

**Researched:** 2026-04-22
**Domain:** Drizzle ORM three-tier privacy gates · jsonb metadata accessor · DAL audit · activity write-path widening · privacy-first integration tests · Postgres column drop migration
**Confidence:** HIGH (codebase is the primary source; every audited file was read line-by-line; viewer-aware DAL pattern already exists as canonical precedent in `getWatchByIdForViewer`)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**DAL Audit Scope**

- **D-01:** Audit scope is **Class A + Class B**. Class A call sites apply strict three-tier filtering; Class B (profile-layout taste-tag count) is audited and explicitly confirmed to keep full counts because `computeTasteTags` consumes an integer, never surfaces individual events, and Common Ground / taste-overlap math would degrade if private wears were excluded from aggregate inputs. Class C (recommendations/suggestions/taste-overlap) is deliberately out of scope — same reasoning.
- **D-02:** Profile-layout `computeTasteTags({ totalWearEvents: wearEvents.length })` keeps the full count even when viewer ≠ owner. Private wears influence the resulting tag string (derived taste label) but no wear event row data ever reaches the viewer's rendered output.
- **D-03:** DAL shape — **introduce a new viewer-aware variant** `getWearEventsForViewer(viewerId, profileUserId)` that returns three-tier-filtered events. Keep `getAllWearEventsByUser(userId)` as owner-only (name implies owner semantics). Mirrors the viewer-aware pattern established in `quick-260421-rdb-fix-404-on-watch-detail-pages-for-watche` (`getWatchById` owner-only vs `getWatchByIdForViewer` three-tier aware). Call sites:
  - Profile layout stats (`src/app/u/[username]/layout.tsx:70`) keeps calling `getAllWearEventsByUser(profile.id)` for the non-owner header taste-tag count (D-02 rule: full count).
  - Profile `[tab]/page.tsx` worn tab non-owner branch calls `getWearEventsForViewer(viewerId, profile.id)` (replaces current `getPublicWearEventsForViewer` call).
  - `getPublicWearEventsForViewer` is renamed/retired in favor of `getWearEventsForViewer` (one function, three-tier logic).
- **D-04:** Phase 12 does NOT mint signed URLs or otherwise touch Storage. Every existing `wear_events` row has `photo_url = NULL` (Phase 11 shipped the column empty). Signed URL minting is Phase 15's concern; DAL functions return `photo_url` raw in the tile payload shape.

**worn_public Lifecycle**

- **D-05:** Phase 12 ships a **cleanup migration that DROPs `profile_settings.worn_public`** after the DAL ripple is verified and integration tests pass. Matches Phase 11 D-06 ("Phase 12 includes a final cleanup migration dropping worn_public") and requirement WYWT-11. The column drop is the last migration in the phase, staged after all code changes land.
- **D-06:** Phase 12 scope includes **settings UI cleanup in the same phase**:
  - Remove `wornPublic` field from `ProfileSettings` type in `src/data/profiles.ts`
  - Remove `wornPublic` from `ALLOWED_FIELDS` in `src/app/actions/profile.ts`
  - Remove the `wornPublic` toggle row from `src/components/settings/SettingsClient.tsx`
  - Remove `wornPublic` read from `src/app/settings/page.tsx`
  - Column and UI drop together — no orphaned dead toggle.
- **D-07:** `markAsWorn` (current one-tap wear path, no photo/note/visibility picker yet) writes `visibility = 'public'` via the schema `DEFAULT 'public'`. Users who previously had `worn_public = false` get a one-time v2→v3 transition: their historical wears are already `'private'` via Phase 11 backfill, but new wears default to public. Phase 15's picker is the full solution for per-wear control.

**Activity Metadata**

- **D-08:** **No migration backfill of existing `watch_worn` activity rows.** Pre-launch state (no real users; test accounts disposable) makes legacy data continuity a non-constraint.
- **D-09:** Feed DAL (`getFeedForUser`) treats **missing `metadata.visibility` as `'private'` at read time (fail-closed)**. Legacy pre-v3.0 `watch_worn` activity rows effectively drop out of non-self feeds. Defense-in-depth.
- **D-10:** `logActivity` keeps its signature stable; the `watch_worn` metadata type widens to require `visibility: WearVisibility`. Callers pass `visibility` in the metadata object:
  - `markAsWorn` (Phase 12 update): writes `visibility: 'public'` (per D-07 default)
  - `logWearWithPhoto` (Phase 15): writes user-chosen `visibility` from the WYWT picker

### Claude's Discretion

- **Integration test strategy** — Privacy-first UAT rule is locked. Hybrid approach: per-function unit tests for each Class A call site, plus one consolidated E2E matrix test file (3 visibilities × 3 viewer relations: owner / follower / stranger × affected surfaces: home rail, feed, worn tab). Tests are written before any DAL function is touched. New tests follow the existing pattern in `tests/integration/home-privacy.test.ts`.
- **Shared visibility-check helper** — Planner decides whether to extract a shared `canSeeWearEvent(viewer, owner, visibility, isFollowing)` helper or inline the three-tier predicate per call site.
- **Wishlist action gate** — Planner decides whether to read `wear_events.visibility` directly in the JOIN or call the viewer-aware DAL helper.
- **Plan ordering within Phase 12** — Implied order: tests → Class A DAL ripple → activity metadata write-path update → Class B audit confirmation → worn_public column drop migration → settings UI cleanup.
- **Exact Drizzle query shape for `metadata->>'visibility'`** — Planner/executor decides jsonb accessor syntax.
- **Migration filenames and timestamps** — Executor decides using existing `supabase/migrations/*.sql` convention.

### Deferred Ideas (OUT OF SCOPE)

- **Class C visibility filtering** (`recommendations.ts`, `suggestions.ts`, `follows.ts getTasteOverlapData`) — explicitly out of scope per D-01.
- **Global `defaultWearVisibility` setting** to replace `worn_public` semantics — rejected for Phase 12.
- **Master kill-switch override** (worn_public=false forces all wears to effectively-private) — rejected.
- **Migration backfill of watch_worn activity rows** — rejected (D-08).
- **Signed URL minting in DAL return shapes** — Phase 15.
- **Bulk "Make all my wears private" action** — not in Phase 12 scope.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **WYWT-10** | Three-tier privacy wired through every wear-reading DAL function with a 3-way gate (audit-first; two-layer privacy pattern from v2.0). At minimum: `getWearRailForViewer`, `getPublicWearEventsForViewer`, profile worn tab DAL, any activity-feed wear row reads. | §DAL Call-Site Audit, §Architecture Patterns: Three-Tier Predicate, §Code Examples: Drizzle three-tier predicate |
| **WYWT-11** | Existing per-user `worn_public` setting deprecated: column removed from `profile_settings` after backfill verified. | §Architecture Patterns: Column Drop Migration, §Code Examples: DROP COLUMN migration, §Settings UI Cleanup |

</phase_requirements>

## Project Constraints (from CLAUDE.md / AGENTS.md)

- **Next.js 16 App Router** — "this is NOT the Next.js you know; read `node_modules/next/dist/docs/` before writing any Next.js code." Phase 12 is **almost entirely DAL/SQL** — no new Next.js APIs are introduced. The settings UI cleanup is a deletion of existing components/props; no framework concepts change.
- **Tech stack locked**: Next.js 16, React 19, TypeScript strict, Drizzle ORM 0.45.2 [VERIFIED: package.json], Supabase Postgres + Storage, vitest 2.1.9 [VERIFIED: package.json], jsdom test env [VERIFIED: vitest.config.ts].
- **Data model**: extend, don't break. `wearEvents.visibility` enum already shipped (Phase 11). Phase 12 RIPPLES the read-side; no schema changes except DROPing one column at end.
- **GSD workflow enforcement** — all changes go through this phase's plan/execute cycle.
- **Memory rules:**
  - `drizzle-kit push` is LOCAL ONLY; prod migrations use `supabase db push --linked --include-all` per `docs/deploy-db-setup.md`.
  - Local DB reset workflow: `supabase db reset` → `drizzle-kit push` → selective `supabase migrations` via `docker exec psql` (per memory).
  - Supabase auto-grants direct EXECUTE to anon/authenticated/service_role on public-schema functions — but Phase 12 introduces NO SECDEF helpers (Phase 11 WR-01 already resolved by Migration 6, commit 93dec02).

## Summary

Phase 12 is the **read-side ripple** of the three-tier `wear_visibility` enum that Phase 11 schema-shipped. It is the highest-risk phase in v3.0 because it modifies existing working privacy code in five files (`src/data/wearEvents.ts`, `src/data/activities.ts`, `src/app/u/[username]/[tab]/page.tsx`, `src/app/u/[username]/layout.tsx`, `src/app/actions/wishlist.ts`), updates one write-path (`src/app/actions/wearEvents.ts → markAsWorn`), removes a settings UI surface (4 files), and drops a column (`profile_settings.worn_public`) — and any one of these touches can silently leak private wear events to non-followers if the predicate is written wrong.

The work is bounded by hard precedent: `getWatchByIdForViewer` in `src/data/watches.ts:119-149` is the canonical viewer-aware DAL with two-layer privacy (RLS + DAL WHERE) and three-tier predicate composition (`OR (eq(watches.userId, viewerId), and(profilePublic, perTabFlag))`). Phase 12's `getWearEventsForViewer` and rewritten `getWearRailForViewer` predicate compose the SAME three-tier shape but read `wearEvents.visibility` instead of `profileSettings.wornPublic`. Test scaffolding precedent is `tests/integration/home-privacy.test.ts` — fixed-UUID seeded users, env-gated `describe.skipIf(!DATABASE_URL)`, deterministic teardown.

The two technical research gaps that the planner must resolve in plan-text (not in additional research) are: (1) the exact Drizzle `sql` template for `activities.metadata->>'visibility'` since this codebase has zero TypeScript precedent for jsonb path access (only one SQL precedent in `supabase/migrations/20260423000002_phase11_notifications.sql:88-89` for the dedup index); (2) how aggressive to be about extracting a shared `canSeeWearEvent` helper given Drizzle's `and`/`or` primitives don't compose cleanly through indirection.

**Primary recommendation:** Plan order: (Plan 1) Test matrix scaffolding — write failing integration tests covering 3 visibilities × {owner, follower, stranger} × {home rail, feed watch_worn rows, worn tab DAL, wishlist action}, locked to the existing `home-privacy.test.ts` pattern. (Plan 2) DAL ripple — rename `getPublicWearEventsForViewer` → `getWearEventsForViewer` with three-tier predicate; rewrite `getWearRailForViewer` WHERE clause; rewrite `getFeedForUser` watch_worn branch to read `metadata->>'visibility'` (fail-closed on NULL); rewrite `wishlist.ts` action JOIN; route profile-tab worn non-owner branch to new function. (Plan 3) Activity write-path widen — `markAsWorn` passes `visibility: 'public'` in metadata, `WatchWornMetadata` type added. (Plan 4) Settings UI cleanup + DROP COLUMN migration — remove all `wornPublic` references in 4 files, drop column, drop schema.ts column.

## Standard Stack

### Core (no new packages)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | ^0.45.2 [VERIFIED: package.json line ~30] | DAL query builder; `eq`, `and`, `or`, `not`, `inArray`, `sql` template, `pgEnum` | Every existing DAL uses these primitives; matches `getWatchByIdForViewer` precedent |
| @supabase/supabase-js | ^2.103.0 [VERIFIED: package.json] | Auth admin client for test seeding via `seedTwoUsers` helper | Existing test helper at `tests/fixtures/users.ts` |
| @supabase/ssr | ^0.10.2 [VERIFIED: package.json] | Server-side Supabase client used in DAL | Existing |
| postgres | ^3.4.9 [VERIFIED: package.json] | Drizzle's pg driver | Existing |
| vitest | ^2.1.9 [VERIFIED: package.json + vitest.config.ts] | Test runner; `describe.skipIf` for env-gated integration tests | Existing — `home-privacy.test.ts` is the template |
| zod | ^4.1.12 [VERIFIED: existing usage in actions] | Schema validation in Server Actions; used by both `wishlist.ts` and `wearEvents.ts` | Existing |
| Supabase CLI | 2.x [VERIFIED: docs/deploy-db-setup.md] | `supabase db push --linked --include-all` for prod migration of DROP COLUMN | Established deploy runbook |
| drizzle-kit | ^0.31.10 [VERIFIED: package.json] | `drizzle-kit generate` to emit the DROP COLUMN migration locally | Existing |

### Supporting

| Thing | Purpose | When to Use |
|-------|---------|-------------|
| Postgres `->>` jsonb operator | Read text value from `activities.metadata->>'visibility'` | `getFeedForUser` rewrite — only place in Phase 12 |
| `wearVisibilityEnum` Drizzle enum | Already exported from `src/db/schema.ts:17-21` [VERIFIED: schema.ts] | Reference in `eq(wearEvents.visibility, 'public')` predicates |
| `(SELECT auth.uid())` InitPlan pattern | Standard for any new RLS policies | Phase 12 is DAL-only — RLS already shipped in Phase 11; do NOT touch |

### Alternatives Considered and Rejected

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New `getWearEventsForViewer` | Modify `getPublicWearEventsForViewer` in place | Rejected per D-03 — function name "Public" is now misleading because the function returns followers-only events to followers; rename is correct semantically. Atomic rename in one plan is simpler than two-step. |
| `metadata->>'visibility'` jsonb gate | JOIN to `wear_events` on every feed render | Rejected — feed is the hot read path. JOIN adds latency and tightens coupling between activities and wear_events lifecycle. Storing visibility in metadata at write time was the explicit recommendation in `.planning/research/ARCHITECTURE.md` line 452-454. |
| Inline three-tier predicate per call site | Extract shared `canSeeWearEvent(viewer, owner, visibility, isFollowing)` TS helper | Mixed — Drizzle predicates can't be composed through TS indirection (the `or`/`and` calls return Drizzle SQL fragments). Inline in DAL queries; consider a shared TS helper only for in-memory checks (e.g., the wishlist Server Action). |
| Backfill activity metadata | Leave legacy rows with no `visibility` key | Rejected per D-08; pre-launch state, no real users to preserve. Combined with D-09 fail-closed read, legacy `watch_worn` rows simply drop out of non-self feeds. |

**Installation:** No npm installs needed — all dependencies already present.

**Version verification:**
```bash
npm view drizzle-orm version  # confirm 0.45.x is current; package.json pins ^0.45.2
npm view vitest version       # confirm 2.x current
```
(Skipped — both are pre-existing in this codebase and `package-lock.json` already resolved.)

## Architecture Patterns

### Recommended Project Structure (no new files except tests)

```
src/
├── data/
│   ├── wearEvents.ts         # MODIFY: rename getPublicWearEventsForViewer → getWearEventsForViewer; rewrite getWearRailForViewer WHERE
│   ├── activities.ts         # MODIFY: getFeedForUser watch_worn branch reads metadata->>'visibility'; logActivity metadata type widens
│   └── profiles.ts           # MODIFY: remove wornPublic from ProfileSettings, VisibilityField, DEFAULT_SETTINGS, getProfileSettings, updateProfileSettingsField
├── db/
│   └── schema.ts             # MODIFY: remove `wornPublic` column from profileSettings table definition
├── app/
│   ├── actions/
│   │   ├── wearEvents.ts     # MODIFY: markAsWorn passes visibility:'public' to logActivity metadata
│   │   ├── profile.ts        # MODIFY: remove 'wornPublic' from VISIBILITY_FIELDS array
│   │   └── wishlist.ts       # MODIFY: addToWishlistFromWearEvent JOIN gates on wear_events.visibility (+ follows for followers tier)
│   ├── settings/
│   │   └── page.tsx          # MODIFY: remove wornPublic from settings prop
│   └── u/[username]/
│       ├── layout.tsx        # NO CHANGE (Class B — D-02 keeps full-count getAllWearEventsByUser call)
│       └── [tab]/page.tsx    # MODIFY: non-owner worn tab branch calls new getWearEventsForViewer
├── components/
│   └── settings/
│       └── SettingsClient.tsx  # MODIFY: remove "Worn History" PrivacyToggleRow + the field from props
└── lib/
    └── (no new types file needed — WatchWornMetadata can live inline in activities.ts or extracted)

supabase/migrations/
└── 20260424000001_phase12_drop_worn_public.sql  # NEW: ALTER TABLE profile_settings DROP COLUMN worn_public; (final migration)

drizzle/
└── 0004_phase12_drop_worn_public.sql  # NEW: drizzle-kit generate output for the schema.ts column removal

tests/
├── integration/
│   └── phase12-visibility-matrix.test.ts  # NEW: 3 × 3 × 4 visibility matrix (consolidated E2E)
├── data/
│   ├── getWearEventsForViewer.test.ts     # NEW (or extend getWearRailForViewer.test.ts) — per-function unit shape tests
│   ├── getWearRailForViewer.test.ts       # MODIFY: update existing tests for new WHERE shape
│   └── getFeedForUser.test.ts             # MODIFY: extend with metadata->>'visibility' branch tests
```

### Pattern 1: Three-Tier Predicate (Drizzle inline)

**What:** A `WHERE` clause that admits a wear event row when (a) viewer is the owner, OR (b) row is `'public'` AND owner's profile is public, OR (c) row is `'followers'` AND owner's profile is public AND viewer follows owner. Private rows are admitted only via branch (a).

**When to use:** `getWearEventsForViewer`, `getWearRailForViewer`, and the `wishlist.ts` JOIN gate. Same shape, different surrounding context.

**Example (canonical — derived from `src/data/watches.ts:119-149` pattern):**
```typescript
// Pseudocode for the three-tier predicate. Real implementation injects
// `viewerFollowsActor` either via a JOIN (rail) or a per-row subquery (single-event read).
import { and, or, eq, sql } from 'drizzle-orm'
import { wearEvents, profileSettings, follows } from '@/db/schema'

// In getWearEventsForViewer (per-profile fetch — viewer follows owner is a single boolean):
const viewerFollowsOwner = await db
  .select({ id: follows.id })
  .from(follows)
  .where(and(
    eq(follows.followerId, viewerId),
    eq(follows.followingId, profileUserId),
  ))
  .limit(1)
const isFollowing = viewerFollowsOwner.length > 0

const events = await db
  .select(/* ... */)
  .from(wearEvents)
  .innerJoin(profileSettings, eq(profileSettings.userId, wearEvents.userId))
  .where(and(
    eq(wearEvents.userId, profileUserId),
    or(
      eq(wearEvents.userId, viewerId),                    // (a) self bypass — G-5
      and(
        eq(profileSettings.profilePublic, true),          // (G-4) outer gate
        or(
          eq(wearEvents.visibility, 'public'),            // public branch
          isFollowing
            ? eq(wearEvents.visibility, 'followers')      // followers branch
            : sql`FALSE`,
        ),
      ),
    ),
  ))
```

**For the rail (multi-actor):** the follow relationship is per-row, so the JOIN must include `follows`:
```typescript
.leftJoin(follows, and(
  eq(follows.followerId, viewerId),
  eq(follows.followingId, wearEvents.userId),
))
.where(and(
  inArray(wearEvents.userId, actorIds),
  gte(wearEvents.wornDate, cutoffDate),
  or(
    eq(wearEvents.userId, viewerId),                    // (a) self bypass — G-5
    and(
      eq(profileSettings.profilePublic, true),          // (G-4) outer gate
      or(
        eq(wearEvents.visibility, 'public'),
        and(
          eq(wearEvents.visibility, 'followers'),
          sql`${follows.id} IS NOT NULL`,                // viewer follows actor
        ),
      ),
    ),
  ),
))
```

`profileSettings.wornPublic` does NOT appear in the new predicate. The whole `wornPublic` gate is replaced by the per-row `wearEvents.visibility` check.

### Pattern 2: jsonb metadata gate in `getFeedForUser`

**What:** The feed read replaces `eq(profileSettings.wornPublic, true)` with `metadata->>'visibility' = 'public' OR (visibility = 'followers' AND viewer follows actor) OR userId = viewerId`. No JOIN to `wear_events` (D-09 says fail-closed on missing key — legacy rows drop out of non-self feeds).

**Example (from CONTEXT.md and Drizzle docs):**
```typescript
// Source: derived from existing getFeedForUser shape + Drizzle docs jsonb pattern [CITED: orm.drizzle.team/docs/operators]
sql`(
  (${activities.type} = 'watch_added'     AND ${profileSettings.collectionPublic} = true)
  OR (${activities.type} = 'wishlist_added' AND ${profileSettings.wishlistPublic} = true)
  OR (${activities.type} = 'watch_worn' AND (
        ${activities.userId} = ${viewerId}                              -- self bypass
        OR ${activities.metadata}->>'visibility' = 'public'              -- public tier
        OR (
          ${activities.metadata}->>'visibility' = 'followers'
          AND EXISTS (
            SELECT 1 FROM ${follows}
             WHERE ${follows.followerId}  = ${viewerId}
               AND ${follows.followingId} = ${activities.userId}
          )
        )
      )
  )
)`
```

**Important:** the existing `getFeedForUser` already has an `innerJoin(follows, ...)` that gates the entire feed to "followed actors only" (FEED-01..04). The follow relationship is therefore guaranteed for every row admitted into the feed — meaning the `'followers'` branch can simplify to `metadata->>'visibility' IN ('public', 'followers')` because every actor in the feed is already followed by the viewer. **The planner must verify this against the existing `getFeedForUser` JOIN structure (line 81-84) before simplifying.** The own-filter `not(eq(activities.userId, viewerId))` (line 87) means the self bypass branch is also unreachable — so for the feed specifically, the predicate collapses to `metadata->>'visibility' IN ('public', 'followers')`.

**Postgres NULL semantics for missing key (D-09 fail-closed verification):** When `metadata` does not contain a `visibility` key, `metadata->>'visibility'` returns NULL. `NULL = 'public'` evaluates to NULL (not TRUE), so legacy rows fail the predicate and are excluded. This satisfies D-09 without a separate `IS NOT NULL` check. [VERIFIED: Postgres docs jsonb operators — `->>` returns NULL for missing keys; comparison against text returns NULL which is falsy in WHERE.]

### Pattern 3: Existing `home-privacy.test.ts` Test Harness (Phase 12 extends this exactly)

**What:** Conditional `describe.skipIf(!DATABASE_URL)` activation; fixed-UUID seeded users (V/A/B/C/D/E pattern); deterministic `beforeAll` seed + `afterAll` cleanup; FK-cascade-safe delete order.

**When to use:** All Phase 12 integration tests. The matrix file extends this scaffold with three new actors representing the visibility matrix:
- `Pf` — followed actor with `visibility='public'` wear
- `Ff` — followed actor with `visibility='followers'` wear
- `Rf` — non-followed actor with `visibility='followers'` wear (negative case for follower direction)

**Example (test scaffold pattern from `tests/integration/home-privacy.test.ts:43-176`):**
```typescript
const maybe = process.env.DATABASE_URL ? describe : describe.skip

maybe('Phase 12 visibility matrix', () => {
  const ids = {
    V:  '00000000-0000-0000-0000-00000000c0a0', // viewer
    Op: '00000000-0000-0000-0000-00000000c0a1', // owner with public wear
    Of: '00000000-0000-0000-0000-00000000c0a2', // owner with followers wear (V follows)
    Or: '00000000-0000-0000-0000-00000000c0a3', // owner with private wear
    S:  '00000000-0000-0000-0000-00000000c0a4', // stranger (no follow from V)
  } as const
  // ... cleanup, beforeAll seeding follow graph + wear events with all 3 visibility tiers
})
```

### Anti-Patterns to Avoid

- **Inverted follow direction (G-3):** `follows.followerId = actorId AND follows.followingId = viewerId` shows wears to people the actor follows — completely wrong set. Always: `follows.followerId = viewerId AND follows.followingId = actorId`. Variable name `viewerFollowsActor` (not `isFollowing`).
- **Missing `profile_public` outer gate (G-4):** A `visibility = 'public'` wear event by an actor whose `profile_public = false` must NOT appear in any non-owner surface. Every Class A predicate must include `eq(profileSettings.profilePublic, true)` outside the visibility OR.
- **Missing self-tile bypass (G-5):** Without an explicit `OR userId = viewerId` short-circuit, a user logging a private wear loses sight of it in their own worn tab. Self bypass must be the FIRST branch.
- **`wornPublic` left dangling somewhere:** Even after the column drop, a stale Drizzle `eq(profileSettings.wornPublic, ...)` in a query will compile (TypeScript erases the column type at runtime) but throw at SQL execution. Grep gate before each commit: `grep -rn "wornPublic\|worn_public" src/` must return zero matches by end of phase.
- **Calling `getCurrentUser()` inside a `'use cache'` boundary (B-6):** None of the affected files currently use `'use cache'`, but the planner must verify before adding any (none of the Phase 12 changes should require it — these are dynamic per-viewer reads).
- **Two-function transition (`getPublicWearEventsForViewer` + `getWearEventsForViewer` coexisting):** Per D-03 specifics, atomic rename in one plan. Do not maintain both signatures — the dead one becomes a footgun.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Three-tier visibility check | Custom imperative if/else after fetching all rows | Inline Drizzle predicate (or/and/eq) | Push predicate to SQL; otherwise the DB does extra work and TS code paths multiply |
| jsonb path access | String-parse `JSON.parse(metadata).visibility` post-fetch | `${activities.metadata}->>'visibility'` in SQL template | NULL-safety, index-friendly, matches Postgres native semantics for missing-key fail-closed |
| Test seed/teardown | Bespoke beforeAll for this phase | Copy `tests/integration/home-privacy.test.ts` scaffold verbatim | Battle-tested pattern with FK-cascade-safe delete order |
| Privacy gate composition | Custom `canSee(...)` TS helper that wraps `or(eq(), and(eq(), eq()))` | Inline in each Drizzle query | Drizzle SQL fragments don't compose cleanly through TS indirection; inline is the established codebase convention |
| Schema column removal | Manual ALTER TABLE in raw SQL only | drizzle-kit generate for the column removal + raw SQL Supabase migration as the production drop | drizzle-kit generates the DDL; supabase migration is the deploy mechanism. Match the Phase 11 split (D-08). |
| Backfilling legacy `watch_worn` activity rows | Hand-write a `UPDATE activities SET metadata = jsonb_set(...)` | Don't do it (D-08) — fail-closed read (D-09) is sufficient | Pre-launch posture; no real users; complexity for zero value |

**Key insight:** Drizzle's strength is that the predicate IS the code — there's no schema-config-codegen layer to misalign. The temptation to extract a helper for "the three-tier check" is high but unwarranted: each call site has different surrounding JOINs and the predicate is small enough to inline with comments tracking which pitfall it addresses (G-3/G-4/G-5).

## Runtime State Inventory

> Phase 12 is rename + ripple + DROP COLUMN — runtime state inventory required.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | `wear_events` rows already have `visibility` populated by Phase 11 backfill (`true → 'public'`, `false → 'private'`, no `'followers'` rows). [VERIFIED: 11-VERIFICATION.md success criterion 1 — DO$$ block asserted 0 followers rows.] No `activities.metadata` row currently has a `visibility` key — they're shaped `{brand, model, imageUrl}` (verified at `src/data/activities.ts:26`). | Code change to widen `WatchWornMetadata` type and pass `visibility: 'public'` in `markAsWorn` (D-10). No data migration of old rows (D-08). Old rows fail D-09 read gate as intended. |
| **Live service config** | None. Supabase project config has nothing referencing `worn_public` by name. No n8n / Datadog / Tailscale / Cloudflare Tunnel config in this project. | None — verified by repo grep returning only application-code matches. |
| **OS-registered state** | None. No Windows Task Scheduler / pm2 / launchd / systemd registrations referencing `worn_public`. | None — verified by repo grep + project is a Next.js dev/Vercel app. |
| **Secrets and env vars** | None. `.env.local` and `.env.example` contain `ANTHROPIC_API_KEY`, `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — none reference `worn_public` or `wear_visibility`. [VERIFIED: prior-phase research files; CLAUDE.md tech stack section.] | None. |
| **Build artifacts / installed packages** | `drizzle/` already contains Phase 11 migration `0003_phase11_wear_events_columns.sql` [VERIFIED: 11-VERIFICATION.md]. Phase 12 will emit `drizzle/0004_phase12_drop_worn_public.sql` via `drizzle-kit generate`. No npm installs change. | After local schema push, `drizzle-kit generate` must run to produce the Drizzle-tracked DDL for the column drop, AND a parallel `supabase/migrations/20260424000001_phase12_drop_worn_public.sql` raw SQL file must exist for prod deploy via `supabase db push --linked --include-all`. |

**Production migration ordering (per memory rule):**
1. Phase 12 code merges to main (DAL, settings UI, activity write-path) — `worn_public` column still present.
2. Local: `drizzle-kit push` to apply schema.ts column removal locally; `supabase migration new phase12_drop_worn_public` to scaffold the prod migration.
3. Prod: `supabase db push --linked --include-all` to drop the column on production.
4. Verify post-deploy: `SELECT column_name FROM information_schema.columns WHERE table_name='profile_settings'` should not contain `worn_public`.

The order matters: code must read `visibility` (not `worn_public`) BEFORE the column is dropped, otherwise a Drizzle query referencing `profileSettings.wornPublic` throws at runtime. Plan ordering enforces this — DROP migration is the LAST plan in Phase 12.

## DAL Call-Site Audit (per Class)

**Audit method:** repo-wide grep for `wornPublic`, `worn_public`, `getAllWearEventsByUser`, `getPublicWearEventsForViewer`, `getWearRailForViewer`, `getFeedForUser`. Every match classified.

### Class A — event-surfacing call sites (THREE-TIER GATE)

These return wear event rows (or wear-event-derived data) to non-owner viewers. They MUST be three-tier-gated.

| Call site | File:line | Current behavior | After Phase 12 |
|-----------|-----------|------------------|----------------|
| `getPublicWearEventsForViewer(viewerUserId, profileUserId)` | `src/data/wearEvents.ts:87-102` | Reads `profileSettings.wornPublic` boolean for non-owner; returns all rows or `[]` | RENAMED to `getWearEventsForViewer`; reads `wearEvents.visibility` per-row with three-tier predicate |
| `getWearRailForViewer(viewerId)` | `src/data/wearEvents.ts:126-202` | WHERE clause includes `eq(profileSettings.wornPublic, true)` for followed-actor branch (line 172); self-include short-circuits (line 169) | WHERE clause replaces `wornPublic` with three-tier predicate joined to `follows`; self-include branch unchanged |
| `getFeedForUser(viewerId, cursor, limit)` | `src/data/activities.ts:57-123` | `watch_worn` row admitted when `profileSettings.wornPublic = true` (line 92) | `watch_worn` row admitted when `metadata->>'visibility' IN ('public','followers')` (since the existing follows-JOIN already guarantees the actor is followed); legacy rows with no visibility key fail-close per Postgres NULL semantics (D-09) |
| `addToWishlistFromWearEvent` | `src/app/actions/wishlist.ts:40-120` | JOIN reads `profileSettings.wornPublic` to gate; rejects if `actorId !== viewerId AND !wornPublic` | JOIN reads `wearEvents.visibility` (and follows for the followers branch); rejects if `actorId !== viewerId AND NOT canSee(visibility, isFollowing)` |
| Profile non-owner worn tab | `src/app/u/[username]/[tab]/page.tsx:170` (and `213` for stats) | Calls `getPublicWearEventsForViewer(viewerId, profile.id)` | Calls `getWearEventsForViewer(viewerId, profile.id)` (function rename — same call sites) |

**Note on `[tab]/page.tsx:107`:** the non-owner worn-tab branch ALSO has a per-tab `if (!isOwner && !settings.wornPublic) return <LockedTabCard />` outer gate. **This needs revisiting in Phase 12** because once `wornPublic` is gone, the locked-tab card branch becomes unreachable for the worn tab. Decision: drop this branch entirely (the per-row visibility check inside `getWearEventsForViewer` already produces the right result — empty list = empty UI). This is a UI consequence the planner must call out as a Plan task.

### Class B — taste-tag aggregate count (FULL COUNT, NO FILTER)

| Call site | File:line | Behavior | Rationale |
|-----------|-----------|----------|-----------|
| Profile layout taste-tag count | `src/app/u/[username]/layout.tsx:67-71` (calls `getAllWearEventsByUser(profile.id)` then passes `wearEvents.length` to `computeTasteTags`) | UNCHANGED — keeps full count even for non-owner viewers | D-02 — derived label string, never surfaces individual events; Common Ground / taste accuracy depends on full counts. Verified `computeTasteTags` consumes only the `length` integer. |

### Class C — internal math call sites (OUT OF SCOPE per D-01)

| Call site | File:line | Behavior |
|-----------|-----------|----------|
| `getRecommendationsForViewer` | `src/data/recommendations.ts:60, 98` | Uses `getAllWearEventsByUser(p.id).length` as input to `computeTasteTags` and `computeTasteOverlap` |
| `getSuggestedCollectors` | `src/data/suggestions.ts:82, 118` | Same shape — counts only |
| `getTasteOverlapData` | `src/data/follows.ts:212, 215` | Same shape — `viewerWears` and `ownerWears` reduced to count for overlap math |

These call sites continue calling `getAllWearEventsByUser` (owner-keyed) and consume only `wears.length`. **No change in Phase 12.** D-01 explicitly out of scope.

### Owner-only / unaffected reads

| Call site | File:line | Why unchanged |
|-----------|-----------|---------------|
| `getMostRecentWearDate(userId, watchId)` | `src/data/wearEvents.ts:20-31` | Owner-only; `userId` arg matches viewer's own context (called from collection/wishlist/notes flows scoped to viewer) |
| `getWearEventsByWatch(userId, watchId)` | `src/data/wearEvents.ts:33-42` | Owner-only |
| `getMostRecentWearDates(userId, watchIds)` | `src/data/wearEvents.ts:44-64` | Owner-only |
| `getAllWearEventsByUser(userId)` | `src/data/wearEvents.ts:71-77` | Owner-only — explicitly retained per D-03; documented as such |
| `PersonalInsightsGrid` | `src/components/home/PersonalInsightsGrid.tsx:50` | Calls `getAllWearEventsByUser(viewerId)` — viewer reads own data |
| `markAsWorn` ownership check | `src/app/actions/wearEvents.ts:28` | Calls `watchDAL.getWatchById(user.id, ...)` — owner-keyed |
| `/watch/[id]/page.tsx:29` `getMostRecentWearDate` | guarded by `isOwner` ternary | Non-owner branch passes `null` |

**Conclusion:** the CONTEXT.md call-site list is COMPLETE. The grep audit surfaced no missing Class A site. `[tab]/page.tsx` line 107 LockedTabCard branch is the only undocumented consequence — it becomes unreachable after Phase 12 and should be removed as part of the same plan that ripples the worn tab.

## Activity Metadata Write-Path Audit

**Existing write paths (`grep -n logActivity src/`):**

| Caller | File:line | Current metadata shape | Phase 12 change |
|--------|-----------|------------------------|-----------------|
| `markAsWorn` | `src/app/actions/wearEvents.ts:39-43` | `{ brand: watch.brand, model: watch.model, imageUrl: watch.imageUrl ?? null }` | ADD `visibility: 'public'` field |
| `addToWishlistFromWearEvent` | `src/app/actions/wishlist.ts:105-109` | `{ brand, model, imageUrl }` for `'wishlist_added'` activity | NO CHANGE — `wishlist_added` is gated by `wishlistPublic`, not `visibility` |
| `addWatch` | (TBD — verify in `src/app/actions/watches.ts`) | `{brand, model, imageUrl}` for `'watch_added'` | NO CHANGE — `watch_added` gated by `collectionPublic` |

**Type widening required:** `src/data/activities.ts:22-34` — the `logActivity` signature has `metadata: { brand: string; model: string; imageUrl: string | null }`. To preserve type safety per activity type, the planner introduces a discriminated union (or simply widens to `metadata: Record<string, unknown> & { brand: string; model: string; imageUrl: string | null }`). Recommendation: introduce a `WatchWornMetadata = { brand; model; imageUrl; visibility: WearVisibility }` type with `WearVisibility` imported from a shared place (or aliased as `'public' | 'followers' | 'private'` literal). The function signature can stay structurally compatible if the `metadata` parameter type widens to `WatchWornMetadata | WatchAddedMetadata | WishlistAddedMetadata` (discriminated by an outer `type` arg).

**Where to define `WearVisibility` type:** `src/db/schema.ts` already exports `wearVisibilityEnum` as a Drizzle pgEnum. The runtime values are `['public', 'followers', 'private']`. Drizzle's `pgEnum.enumValues` provides the literal type; alternatively, a `lib/wearVisibility.ts` module exporting `export type WearVisibility = 'public' | 'followers' | 'private'` is the lighter-touch option matching this codebase's TS-types-as-source-of-truth style. Planner decides.

## Common Pitfalls

### Pitfall G-1: Missing a wear-reading DAL function during the ripple
**What goes wrong:** A Class A call site (most likely the wishlist action JOIN, which is easy to forget because it's outside `src/data/`) still reads `profileSettings.wornPublic` after the column is dropped — runtime error or silent privacy leak depending on whether the column is still present.
**Why it happens:** The audit was done at one point in time; later refactors add new readers.
**How to avoid:** Pre-drop grep gate: `grep -rn "wornPublic\|worn_public" src/` must return zero matches before Plan 4 (DROP migration) is committed. Add this as an explicit verification step in the plan task.
**Warning signs:** integration test for "stranger sees followers-only wear" passes (test does not exist) or runtime error referencing `profile_settings.worn_public`.

### Pitfall G-3: Inverted follow direction
**What goes wrong:** `follows.followerId = actorId AND follows.followingId = viewerId` shows wears to people the actor follows (not the people who follow the actor) — privacy hole.
**Why it happens:** "follower" and "following" are directional terms developers conflate.
**How to avoid:** Variable name `viewerFollowsActor`; explicit unit test asserting "A follows B but B does not follow A → B's followers wear is invisible to A".
**Warning signs:** Variable named `isFollowing` without specifying which way; no directional unit test in the matrix file.

### Pitfall G-4: Public wear from private profile leaks
**What goes wrong:** A user with `profile_public = false` logs `visibility = 'public'` wear; the wear surfaces in the rail/feed/wishlist gate for non-owner viewers because the code only checked `wearEvents.visibility = 'public'` and forgot the `profileSettings.profilePublic = true` outer gate.
**Why it happens:** Per-row visibility and profile-level visibility are independent gates; the new code may copy the `wearEvents.visibility = 'public'` check without preserving the existing `profile_public` JOIN.
**How to avoid:** Every Class A predicate must include `eq(profileSettings.profilePublic, true)` as the outer AND alongside the visibility OR. The matrix test must include a "public-tier wear by `profile_public=false` actor" cell that asserts invisibility to non-owner viewers.
**Warning signs:** Predicate has `or(eq(visibility, 'public'), ...)` without an outer `and(profilePublic = true, ...)`.

### Pitfall G-5: Self-tile bypass missing
**What goes wrong:** Owner logs a `'private'` wear and it disappears from their own worn tab — confusing and trust-eroding.
**Why it happens:** The predicate is written from "what others see" perspective without the self bypass.
**How to avoid:** Self bypass is the FIRST OR branch in every predicate: `or(eq(wearEvents.userId, viewerId), and(profilePublic, ...))`. Existing `getWearRailForViewer:169` already has this; preserve it. New `getWearEventsForViewer` must add it.
**Warning signs:** Predicate has no `eq(wearEvents.userId, viewerId)` short-circuit.

### Pitfall G-7: Visibility in activity metadata at write time
**What goes wrong:** Feed renders a `watch_worn` row from a followers-only wear by JOINing back to `wear_events` — but the JOIN is too expensive for the hot feed path; the alternative is to store `visibility` in the activity metadata at write time. If `markAsWorn` does NOT pass `visibility`, the feed read fails (D-09 fail-closed) and the actor's wear silently vanishes from the feed.
**Why it happens:** The schema doesn't enforce a CHECK on metadata shape (D-10 explicitly chose TS-only).
**How to avoid:** Ensure ALL `watch_worn` write paths pass `visibility` in metadata. Audit: only `markAsWorn` writes `watch_worn` activities today; Phase 15 adds `logWearWithPhoto`. Lock the type of the metadata arg so omitting `visibility` is a TS error.
**Warning signs:** Integration test for "owner sees own watch_worn in their own feed" fails (legacy rows missing visibility key).

### Pitfall B-6: `getCurrentUser()` inside `'use cache'`
**What goes wrong:** A Server Component or DAL function decorated with `'use cache'` calls `getCurrentUser()` internally — cache key has no viewer ID, so the first viewer's data is served to all viewers.
**Why it happens:** Convenience — `getCurrentUser()` looks like a normal function call.
**How to avoid:** Phase 12 should NOT add any `'use cache'` wrappers. Verify before each commit: `grep -rn "use cache" src/data/wearEvents.ts src/data/activities.ts src/app/actions/wishlist.ts src/app/actions/wearEvents.ts` returns empty. Existing code: none of these files use `'use cache'` today (verified by grep).
**Warning signs:** Any new `'use cache'` directive in a viewer-scoped DAL that derives `viewerId` internally rather than as an explicit argument.

### Pitfall F-1 (informational only — Storage RLS)
**What goes wrong:** Wear photos in Storage are accessed via signed URLs; Phase 11 already implemented three-tier `storage.objects` RLS with SECDEF helpers. This is NOT a Phase 12 concern.
**Why included:** ROADMAP cites F-1 as a pitfall list item — but only as defense-in-depth reminder. Phase 12 ships zero Storage code per D-04.
**Action:** None for Phase 12 except confirming the planner does not accidentally call `createSignedUrl` from any DAL function.

### Pitfall (Phase 12-specific): wornPublic dangling reference
**What goes wrong:** A grep miss leaves a stray `profileSettings.wornPublic` reference somewhere; the column drop migration succeeds but the code throws at the next read.
**How to avoid:** Plan-level verification step before the DROP migration runs: `grep -rn "wornPublic\|worn_public" src/ tests/` must return only matches in test fixtures that explicitly seed test users with the column (those are deletable too) or completely empty. Run this AS A SHELL COMMAND in the verification block of the DROP migration plan.

## Code Examples

Verified patterns from this repo's existing code (not from external docs).

### Three-tier predicate (mirrors `getWatchByIdForViewer`)
```typescript
// Source: src/data/watches.ts:119-149 (existing, verbatim shape)
// To be adapted to wearEvents in Phase 12 — replace the per-tab status check
// with the three-tier visibility check.
.where(and(
  eq(watches.id, watchId),
  or(
    eq(watches.userId, viewerId),                        // self bypass
    and(
      eq(profileSettings.profilePublic, true),           // outer gate (G-4)
      sql`(
        (${watches.status} = 'wishlist' AND ${profileSettings.wishlistPublic} = true)
        OR (${watches.status} IN ('owned','sold','grail') AND ${profileSettings.collectionPublic} = true)
      )`,
    ),
  ),
))
```

### `getWearRailForViewer` rewrite shape
```typescript
// Source: derived from src/data/wearEvents.ts:126-202 (existing)
// + three-tier ARCHITECTURE.md pattern. Pseudocode-level — actual planner output.
.leftJoin(follows, and(
  eq(follows.followerId, viewerId),
  eq(follows.followingId, wearEvents.userId),
))
.where(and(
  inArray(wearEvents.userId, actorIds),
  gte(wearEvents.wornDate, cutoffDate),
  or(
    eq(wearEvents.userId, viewerId),                     // self bypass (G-5)
    and(
      eq(profileSettings.profilePublic, true),           // outer gate (G-4)
      or(
        eq(wearEvents.visibility, 'public'),             // public tier
        and(                                             // followers tier
          eq(wearEvents.visibility, 'followers'),
          sql`${follows.id} IS NOT NULL`,                // viewer follows actor (G-3)
        ),
      ),
    ),
  ),
))
```

### `getFeedForUser` watch_worn metadata gate
```typescript
// Source: derived from src/data/activities.ts:85-95 + Drizzle jsonb pattern
// [CITED: orm.drizzle.team/docs/operators]
sql`(
  (${activities.type} = 'watch_added'     AND ${profileSettings.collectionPublic} = true)
  OR (${activities.type} = 'wishlist_added' AND ${profileSettings.wishlistPublic} = true)
  OR (${activities.type} = 'watch_worn'   AND ${activities.metadata}->>'visibility' IN ('public','followers'))
)`
// Justification for IN ('public','followers') simplification (no separate
// follower-direction check): the outer query already innerJoins follows on
// (follower_id=viewer, following_id=activity.user) — every admitted row is
// from a followed actor by construction. Therefore 'followers' visibility on
// any admitted row is automatically a follower-of relationship.
// D-09 fail-closed: NULL ->> 'visibility' = NULL; NULL IN (...) = NULL;
// Postgres treats NULL as not-true in WHERE, so legacy rows are excluded.
```

### `markAsWorn` metadata widening
```typescript
// Source: src/app/actions/wearEvents.ts:39-43 (existing) — Phase 12 patch
await logActivity(user.id, 'watch_worn', parsed.data, {
  brand: watch.brand,
  model: watch.model,
  imageUrl: watch.imageUrl ?? null,
  visibility: 'public',                // NEW (D-07, D-10)
})
```

### Drizzle column removal (schema.ts → drizzle-kit generate → supabase migration)
```typescript
// Source: src/db/schema.ts:178-185 (existing) — Phase 12 removes the wornPublic column.
export const profileSettings = pgTable('profile_settings', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  profilePublic: boolean('profile_public').notNull().default(true),
  collectionPublic: boolean('collection_public').notNull().default(true),
  wishlistPublic: boolean('wishlist_public').notNull().default(true),
  // wornPublic: REMOVED in Phase 12 — replaced by per-row wear_events.visibility
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
```

```sql
-- Source: derived from supabase/migrations/20260423000001_phase11_wear_visibility.sql pattern
-- supabase/migrations/20260424000001_phase12_drop_worn_public.sql
BEGIN;
ALTER TABLE profile_settings DROP COLUMN worn_public;
COMMIT;
```

### Test scaffold (extend `home-privacy.test.ts` pattern)
```typescript
// Source: tests/integration/home-privacy.test.ts:43-176 — copy this scaffold.
const maybe = process.env.DATABASE_URL ? describe : describe.skip
maybe('Phase 12 visibility matrix', () => {
  const ids = {
    V:  '00000000-0000-0000-0000-00000000c0a0', // viewer
    Op: '00000000-0000-0000-0000-00000000c0a1', // owner with public wear (V follows)
    Of: '00000000-0000-0000-0000-00000000c0a2', // owner with followers wear (V follows)
    Or: '00000000-0000-0000-0000-00000000c0a3', // owner with private wear (V follows)
    S:  '00000000-0000-0000-0000-00000000c0a4', // stranger (V does NOT follow)
  } as const
  // ... beforeAll: seed users, profile_settings (all profilePublic=true),
  //                follow graph (V → Op, Of, Or), then 4 wear_events with the 3 visibility tiers
  // ... afterAll: cleanup in FK-safe order (activities, wearEvents, watches, follows, profileSettings, profiles, users)
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `profileSettings.wornPublic` global boolean gate | Per-row `wearEvents.visibility` enum (`public` \| `followers` \| `private`) | Phase 11 schema; Phase 12 read-side ripple | Per-wear granularity replaces all-or-nothing toggle; transition window lasts only across Phase 12 plans |
| Settings UI four-toggle row (profile/collection/wishlist/worn) | Three-toggle row (profile/collection/wishlist); per-wear visibility lives in WYWT picker (Phase 15) | Phase 12 settings cleanup | Worn-history toggle row removed from `SettingsClient.tsx`; `wornPublic` removed from `ALLOWED_FIELDS` |
| `getPublicWearEventsForViewer` (boolean gate) | `getWearEventsForViewer` (three-tier gate) | Phase 12 D-03 | Function rename + rewrite, atomic |
| Feed JOINs to `profile_settings.wornPublic` for `watch_worn` rows | Feed reads `metadata->>'visibility'` from the activity row itself | Phase 12 D-09/D-10 | No JOIN to `wear_events` on the feed hot path; legacy rows fail-close |

**Deprecated/outdated:**
- `profile_settings.worn_public` column — DROP at end of Phase 12 (WYWT-11). Phase 11 D-06 explicitly deferred this drop to Phase 12.
- `wornPublic` field on `ProfileSettings` TypeScript type and `ALLOWED_FIELDS` — removed in Phase 12 (D-06).
- `getPublicWearEventsForViewer` function name — renamed to `getWearEventsForViewer`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Postgres `metadata->>'visibility' = 'public'` returns NULL (not FALSE) when the key is missing, and NULL is treated as not-true in WHERE clauses, so legacy rows fail-close per D-09. | Pattern 2: jsonb metadata gate | If wrong, legacy `watch_worn` rows might leak in non-self feeds. Verified by Postgres documentation on jsonb operators and SQL three-valued logic — but planner should add an explicit integration test asserting "legacy row with no visibility key is invisible to non-self feed". |
| A2 | The existing `getFeedForUser` follows-JOIN guarantees every admitted row is from a followed actor, so the followers-tier visibility predicate can simplify to `IN ('public','followers')` for the watch_worn branch (no per-row follow direction check needed). | Pattern 2 + Code Examples | If the JOIN is later widened (e.g., to admit "popular" non-followed actors), the simplification breaks and followers wears leak to non-followers. The planner must mark this as a load-bearing assumption with a code comment on the predicate. Verified by reading current `src/data/activities.ts:81-84`. |
| A3 | The wishlist action's `addToWishlistFromWearEvent` JOIN can read `wear_events.visibility` directly; the followers branch needs an EXISTS subquery against `follows`. Inline JOIN approach is cleaner than calling the new DAL helper because the action already needs the watch metadata snapshot in the same query. | DAL Call-Site Audit | If the planner instead routes through the DAL helper, the action does two queries (one for visibility check, one for snapshot data) — minor latency; not correctness. Decision left to planner per CONTEXT.md `<decisions>` Claude's Discretion. |
| A4 | No Class A call site requires `'use cache'` because every visibility decision is per-viewer-per-request. Verified none of the affected files currently use `'use cache'` (grep returned empty). | Pitfall B-6 | If a future plan adds `'use cache'` to one of these reads, B-6 leak vector reactivates. Document as a constraint in Plan task descriptions. |
| A5 | The Phase 11 backfill verified zero rows with `visibility = 'followers'`, so the matrix test seeds `'followers'` rows manually in `beforeAll` to exercise the new branch. | Code Examples: Test scaffold | Verified by 11-VERIFICATION.md success criterion 1. |

**Note:** All other claims in this research are tagged inline with `[VERIFIED: ...]` or `[CITED: ...]`. Items in this Assumptions Log require either a runtime verification (A1, A4) or a planner code-comment lock (A2, A3).

## Open Questions

1. **Should `getWearEventsForViewer` also accept an optional `visibilityTiers` filter?**
   - What we know: D-03 says one function with three-tier logic, no parameter for filter.
   - What's unclear: stats tab (`[tab]/page.tsx:213`) calls the same function; if owner is viewing own profile, the call returns all rows including private. Currently fine because owner-branch uses `getAllWearEventsByUser` directly.
   - Recommendation: keep the function signature as `(viewerId, profileUserId)` only; the predicate's self-bypass branch handles owner correctly.

2. **Where should `WearVisibility` type live?**
   - What we know: `wearVisibilityEnum` is already exported from `src/db/schema.ts`. Drizzle's `pgEnum` does not directly export the literal union type for value-side use.
   - What's unclear: whether to introduce `src/lib/wearVisibility.ts` with `export type WearVisibility = 'public' | 'followers' | 'private'`, or use `typeof wearVisibilityEnum.enumValues[number]`.
   - Recommendation: create `src/lib/wearVisibility.ts` for clarity (matches the codebase's lib/types.ts convention); the `enumValues[number]` trick is too clever for the maintenance burden.

3. **Should the wishlist action's "Wear event not found" error message be preserved verbatim?**
   - What we know: existing code returns `'Wear event not found'` for both missing and `wornPublic=false` cases (Letterboxd-style uniform 404). Preserves the design.
   - What's unclear: should new "private" or "followers (viewer doesn't follow)" cases also return the same message?
   - Recommendation: YES — preserve uniform message for any negative branch. The test assertions should check for the exact string `'Wear event not found'`.

4. **Is the `[tab]/page.tsx:107` `LockedTabCard` worn-tab branch deletable?**
   - What we know: After Phase 12, `settings.wornPublic` no longer exists; the conditional becomes a TS error.
   - What's unclear: should the worn tab show a "no public wears" empty state, or always render the `WornTabContent` with whatever the new function returns?
   - Recommendation: delete the branch entirely; let `WornTabContent` render an empty state when `events.length === 0`. Verify `WornTabContent`'s empty state copy is appropriate.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Local Supabase stack (`supabase start`) | Integration tests (env-gated on `DATABASE_URL` + `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`) | ✓ assumed (Phase 11 ran integration tests successfully — see 11-VERIFICATION.md "30/30 Wave 0 tests passed") | 2.x | Tests skip via `describe.skipIf` — suite stays green in CI |
| Postgres (via Supabase local) | Drizzle DAL + migrations | ✓ assumed | 15.x (Supabase default) | None |
| `supabase` CLI | `supabase db push --linked --include-all` for prod DROP COLUMN | ✓ assumed (used for Phase 11 deploys per `docs/deploy-db-setup.md`) | 2.x | None — required for prod |
| `drizzle-kit` | `drizzle-kit generate` for the schema.ts column removal migration | ✓ (in package.json) | 0.31.10 | None |
| `node` runtime | Build/test execution | ✓ | (project unpinned) | None |
| `vitest` | Test runner | ✓ | 2.1.9 | None |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

## Validation Architecture

> Phase 12 has nyquist_validation enabled (config.json `workflow.nyquist_validation: true` — explicit).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 2.1.9 [VERIFIED: package.json line ~51] |
| Config file | `vitest.config.ts` [VERIFIED: project root] |
| Quick run command | `npm test -- tests/integration/phase12-visibility-matrix.test.ts tests/data/getWearRailForViewer.test.ts tests/data/getFeedForUser.test.ts` |
| Full suite command | `npm test` (runs `vitest run`) |
| Env requirement for integration tests | `DATABASE_URL` + `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (auto-skip when absent) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WYWT-10 | `getPublicWearEventsForViewer`/`getWearEventsForViewer` returns followers-tier wear ONLY when viewer follows actor; invisible to stranger | integration (3 cells: visible-to-follower, invisible-to-stranger, visible-to-self) | `npm test -- tests/integration/phase12-visibility-matrix.test.ts` | ❌ Wave 0 |
| WYWT-10 | `getWearRailForViewer` includes followers-only tile only for followed actors; `worn_public=true` no longer surfaces a `visibility='followers'` event to non-followers | integration (extend home-privacy.test.ts pattern) | `npm test -- tests/integration/phase12-visibility-matrix.test.ts` | ❌ Wave 0 |
| WYWT-10 | `getFeedForUser` admits `watch_worn` row only when `metadata->>'visibility' IN ('public','followers')`; legacy NULL fails closed | integration | `npm test -- tests/integration/phase12-visibility-matrix.test.ts` | ❌ Wave 0 |
| WYWT-10 | Profile worn tab non-owner branch calls viewer-aware function; private wear by profile owner does not appear in non-owner viewer's worn tab | integration (DAL-level + tab page-level) | `npm test -- tests/integration/phase12-visibility-matrix.test.ts` | ❌ Wave 0 |
| WYWT-10 | Three positive cells: public visible to all, followers visible to follower & self, private visible only to self | integration matrix | (above) | ❌ Wave 0 |
| WYWT-10 | Pitfall G-3: directional follow check — A follows B but B does not follow A → B's followers wear is invisible to A | integration | (above) | ❌ Wave 0 |
| WYWT-10 | Pitfall G-4: actor with `profile_public=false` AND `visibility='public'` wear is invisible to non-owner viewers | integration | (above) | ❌ Wave 0 |
| WYWT-10 | Pitfall G-5: owner sees own private wear in their own surfaces | integration | (above) | ❌ Wave 0 |
| WYWT-10 | `addToWishlistFromWearEvent` rejects with `'Wear event not found'` when source is `visibility='followers'` and viewer doesn't follow; succeeds when viewer follows | integration | `npm test -- tests/integration/phase12-visibility-matrix.test.ts` | ❌ Wave 0 |
| WYWT-10 | `getWearRailForViewer` SQL shape — has new visibility OR branch; no longer reads `profileSettings.wornPublic` | unit (modify existing) | `npm test -- tests/data/getWearRailForViewer.test.ts` | ✓ exists, needs MODIFY |
| WYWT-10 | `getFeedForUser` SQL shape — `watch_worn` branch reads `metadata->>'visibility'`; no `wornPublic` reference | unit (modify existing) | `npm test -- tests/data/getFeedForUser.test.ts` | ✓ exists, needs MODIFY |
| WYWT-11 | `profile_settings.worn_public` column does not exist post-migration | integration (information_schema query) | `npm test -- tests/integration/phase12-visibility-matrix.test.ts` (final assertion) OR a dedicated `tests/integration/phase12-column-drop.test.ts` | ❌ Wave 0 |
| WYWT-11 | `wornPublic` not present in `src/db/schema.ts profileSettings` definition | unit (TS compile + schema introspection) | TypeScript compile (`npm run build`); test asserting `(profileSettings._.columns as any).wornPublic === undefined` | ❌ Wave 0 |
| WYWT-11 | `wornPublic` not in `src/data/profiles.ts ProfileSettings` | unit (TS compile) | `npm run build` | implicit |
| WYWT-11 | `wornPublic` toggle row absent from `SettingsClient.tsx` rendered output | component (RTL render) | `npm test -- tests/components/SettingsClient.test.tsx` (if exists; otherwise grep verification) | ❌ |
| Repo-wide invariant | Zero references to `wornPublic`/`worn_public` in `src/` and `tests/` (except in deletion migration files) | shell verification step in plan | `grep -rn "wornPublic\|worn_public" src/ tests/ \| grep -v "drizzle\|supabase/migrations"` returns empty | shell — encoded in Plan 4 verification |

### Sampling Rate
- **Per task commit:** `npm test -- tests/integration/phase12-visibility-matrix.test.ts` (matrix file is the load-bearing assertion)
- **Per wave merge:** `npm test -- tests/integration/phase12-visibility-matrix.test.ts tests/data/getWearRailForViewer.test.ts tests/data/getFeedForUser.test.ts tests/integration/home-privacy.test.ts`
- **Phase gate:** `npm test` (full suite — must remain green; previous baselines: Phase 10 was 2108 passed, 11 pre-existing failures per 11-VERIFICATION.md). Phase 12 must NOT introduce new failures and must add the new test files passing.

### Wave 0 Gaps
- [ ] `tests/integration/phase12-visibility-matrix.test.ts` — covers WYWT-10 matrix (NEW)
- [ ] `tests/data/getWearEventsForViewer.test.ts` — per-function unit shape test (NEW; or extended into existing wearEvents test file)
- [ ] `tests/data/getWearRailForViewer.test.ts` — MODIFY: replace `wornPublic` assertions with `visibility` assertions
- [ ] `tests/data/getFeedForUser.test.ts` — MODIFY: extend with `metadata->>'visibility'` shape assertions; legacy-NULL fail-closed assertion
- [ ] (Optional) `tests/integration/phase12-column-drop.test.ts` — single integration test asserting `worn_public` column absent post-migration (or fold into matrix test final cell)
- [ ] Framework install: none — vitest already present
- [ ] Test fixtures: none — `tests/fixtures/users.ts seedTwoUsers` works; or use the fixed-UUID pattern from `home-privacy.test.ts`

### What to test (per privacy-first UAT rule, in this order)
1. **Negative cells before positive cells.** Stranger seeing followers wear should fail BEFORE follower seeing followers wear succeeds. Catches inverted G-3 first.
2. **Self-bypass first.** Owner reading own private wear must pass before any other test runs — establishes G-5 baseline.
3. **Profile_public outer gate.** A `visibility='public'` wear by `profile_public=false` actor must be invisible to non-owner — establishes G-4 baseline.
4. **Activity feed legacy fail-closed.** A pre-Phase-12 `watch_worn` activity row (no visibility key) must NOT appear in non-self feed. Validates D-09.
5. **Column drop.** Final test asserts `worn_public` column absent.

### What to verify post-implementation
- `grep -rn "wornPublic\|worn_public" src/ tests/` returns only fixture/test references that are themselves deletable (post-Phase 12, ideally zero matches outside `supabase/migrations/`).
- `npm run build` (TS compile) succeeds — guarantees no dangling `wornPublic` reference in TypeScript.
- Manual UAT in browser (privacy-first rule, per SUMMARY.md): seed three test accounts (owner, follower, stranger), log wears with all three visibility tiers, verify rendering across home rail, profile worn tab, feed for follower vs stranger.

### What's out of scope for verification
- Storage RLS for wear photos (Phase 11 verified; F-1 is informational only here).
- Class C math call sites (D-01 — explicitly out).
- WYWT photo form / signed URL minting (Phase 15).
- Notifications visibility re-check at click-through time (Phase 13 + Phase 15 concern; Phase 12 has no notification surface).
- iOS / mobile-specific tests (Phase 14 + Phase 15 concern).

### Evidence sources
- ROADMAP §"Phase 12: Visibility Ripple in DAL" success criteria (5 numbered truths)
- REQUIREMENTS WYWT-10 (audit-first three-tier ripple)
- REQUIREMENTS WYWT-11 (column removal after backfill verified)
- CONTEXT D-01..D-10 (locked decisions)
- 11-VERIFICATION.md (Phase 11 schema/backfill verified — preconditions met)
- PITFALLS G-1, G-3, G-4, G-5, G-7 (must each be exercised by at least one test cell)
- STATE.md "Phase 12 requires integration tests written BEFORE touching any DAL function — privacy-first UAT rule"

## Sources

### Primary (HIGH confidence)
- Existing codebase — `src/data/wearEvents.ts`, `src/data/activities.ts`, `src/data/profiles.ts`, `src/data/watches.ts:119-149` (canonical viewer-aware pattern), `src/db/schema.ts:17-21,178-185,203-220`, `src/app/u/[username]/[tab]/page.tsx`, `src/app/u/[username]/layout.tsx`, `src/app/actions/wishlist.ts`, `src/app/actions/wearEvents.ts`, `src/app/actions/profile.ts`, `src/app/settings/page.tsx`, `src/components/settings/SettingsClient.tsx`, `src/lib/feedTypes.ts`, `src/lib/wywtTypes.ts`, `src/components/home/PersonalInsightsGrid.tsx`, `src/data/follows.ts`, `src/data/recommendations.ts`, `src/data/suggestions.ts`
- Existing tests — `tests/integration/home-privacy.test.ts` (test scaffold template), `tests/data/getFeedForUser.test.ts` (mock chain pattern), `tests/data/getWearRailForViewer.test.ts`, `tests/integration/isolation.test.ts`, `tests/fixtures/users.ts`
- Existing migrations — `supabase/migrations/20260423000001_phase11_wear_visibility.sql` (backfill + DO$$ pattern reference), `supabase/migrations/20260423000002_phase11_notifications.sql:88-89` (only existing jsonb path SQL precedent)
- Phase planning docs — `.planning/phases/12-visibility-ripple-in-dal/12-CONTEXT.md`, `.planning/phases/11-schema-storage-foundation/11-VERIFICATION.md`, `.planning/phases/11-schema-storage-foundation/11-RESEARCH.md`, `.planning/research/ARCHITECTURE.md` §"Three-Tier Visibility Ripple", `.planning/research/PITFALLS.md` G-1..G-7 + B-6 + F-1, `.planning/STATE.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`
- Project config — `vitest.config.ts`, `package.json`, `.planning/config.json` (nyquist_validation = true)

### Secondary (MEDIUM confidence)
- Drizzle ORM docs — `orm.drizzle.team/docs/operators` (sql template + jsonb pattern; cited via web search 2026-04)
- Postgres jsonb operators — `->>` returns NULL for missing key (canonical Postgres docs; consensus across multiple references)

### Tertiary (LOW confidence)
- None for Phase 12 — every claim is either codebase-verified or covered by primary sources.

## Metadata

**Confidence breakdown:**
- DAL audit completeness: HIGH — every wornPublic reference in `src/` and `tests/` was grep'd and classified; no unaccounted call site
- Three-tier predicate shape: HIGH — `getWatchByIdForViewer` is the canonical precedent; CONTEXT pre-locks the approach
- jsonb metadata gate semantics: HIGH (mechanism) / MEDIUM (Drizzle TS surface) — Postgres semantics are documented; Drizzle's `sql` template is well-trodden but no in-repo TS precedent for `metadata->>'key'`. Planner should test the exact emitted SQL via the existing mock-chain pattern in `getFeedForUser.test.ts`.
- Test scaffold pattern: HIGH — `home-privacy.test.ts` is the working template
- Column-drop migration: HIGH — same shape as Phase 11 migrations, with one fewer DDL line
- Settings UI cleanup: HIGH — files and lines all explicitly identified in CONTEXT canonical refs

**Research date:** 2026-04-22
**Valid until:** 2026-05-22 (30 days — codebase is stable; Phase 11 just shipped; no upstream changes anticipated)

## RESEARCH COMPLETE
