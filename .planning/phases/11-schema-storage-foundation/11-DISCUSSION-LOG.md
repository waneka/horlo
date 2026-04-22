# Phase 11: Schema + Storage Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-22
**Phase:** 11-schema-storage-foundation
**Areas discussed:** Storage RLS enforcement model, Migration choreography, Notifications table details, DEBT-02 audit scope

---

## Storage RLS enforcement model

### Q1. Where should the three-tier visibility actually be enforced for wear photo reads?

| Option | Description | Selected |
|--------|-------------|----------|
| Storage RLS enforces all 3 tiers | storage.objects SELECT policy JOINs to wear_events (parsing {user_id}/{wear_event_id}.jpg) and checks visibility + follows. Defense-in-depth. | ✓ |
| Bucket owner-only; DAL mints signed URLs | Simpler RLS; DAL runs 3-tier check before minting URLs. Single privacy layer. | |
| Hybrid: owner-only on write, 3-tier on SELECT | Split the complexity. | |

**User's choice:** Storage RLS enforces all 3 tiers (Recommended)
**Notes:** Matches v2.0 two-layer privacy principle — either layer breaking alone is still caught.

### Q2. How should 'public-visibility unsigned OK' work given the bucket is private?

| Option | Description | Selected |
|--------|-------------|----------|
| Signed URLs with long TTL for all tiers | Every read uses signed URL; public-tier signed with long expiry. One DAL code path. | ✓ |
| Signed URL per request, short TTL | Fresh signed URL per render. Most defensive. | |
| Revisit Decision 3: split into public + private buckets | Reopen bucket topology. | |

**User's choice:** Signed URLs with long TTL for all tiers (Recommended)
**Notes:** Must respect Pitfall F-2 — never cache inside `'use cache'` or pass through next/image optimizer.

### Q3. Should path convention {user_id}/{wear_event_id}.jpg be enforced at Storage RLS?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — RLS checks folder prefix against auth.uid() | Closes Pitfall F-4. | ✓ |
| No — enforce in Server Action only | Simpler policy. | |

**User's choice:** Yes — RLS enforces folder convention (Recommended)

### Q4. Orphan storage cleanup when a wear_events row delete fails?

| Option | Description | Selected |
|--------|-------------|----------|
| Best-effort: Server Action deletes Storage object after row delete | Log + move on. F-3 accepted risk. | ✓ |
| Transactional: no row delete without Storage delete | Storage down = can't delete wears. | |
| Orphan scan cron / scheduled job | Defer to future phase. | |

**User's choice:** Best-effort: Server Action deletes Storage object after row delete (Recommended)
**Notes:** Scheduled cleanup deferred past v3.0.

---

## Migration choreography

### Q1. How should Phase 11 be split into migration files?

| Option | Description | Selected |
|--------|-------------|----------|
| Split by concern, logical order | 5 ordered migrations: schema/backfill → notifications → pg_trgm → storage → DEBT-02. | ✓ |
| One monolithic migration | Everything atomic in one file. | |
| Split by tool boundary (drizzle vs raw SQL) | Mirror existing repo pattern via tool boundary. | |

**User's choice:** Split by concern, logical order (Recommended)

### Q2. When does the worn_public column get dropped?

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 12, after DAL stops reading it | Safest deprecation discipline. | ✓ |
| Phase 11, same migration as backfill | Cleanest end-state but risks running app reading dropped column. | |
| Phase 11, separate migration after backfill verified | Still Phase 11 but sequenced. | |

**User's choice:** Phase 12, after DAL stops reading it (Recommended)

### Q3. How should the wear_events backfill be structured and verified?

| Option | Description | Selected |
|--------|-------------|----------|
| Single UPDATE with inline verification in migration | DO block RAISEs if any row = 'followers'. Self-verifying. | ✓ |
| Two-step: add nullable, backfill, then SET NOT NULL | Phase-safe for live traffic. Overkill at horlo scale. | |
| Backfill in a DAL-level script, not migration | Not reproducible. | |

**User's choice:** Single UPDATE with inline verification query in migration (Recommended)

### Q4. Which tool runs which parts of the Phase 11 migration?

| Option | Description | Selected |
|--------|-------------|----------|
| Drizzle for schema, raw SQL for extensions/RLS/Storage | Matches existing repo pattern. | ✓ |
| Pure supabase migrations for everything | Loses Drizzle schema sync. | |
| Drizzle for everything via custom SQL | Tangles raw SQL in auto-generated files. | |

**User's choice:** Drizzle for schema changes, raw SQL migrations for extensions/RLS/Storage (Recommended)

---

## Notifications table details

### Q1. How should notifications.type be typed?

| Option | Description | Selected |
|--------|-------------|----------|
| Postgres enum with all v3.0 types upfront | Stubbed types included now; no ALTER TYPE later. | ✓ |
| text with CHECK constraint | Easier to add values, slightly less tooling-friendly. | |
| plain text, app-only validation | Weakest guarantee. | |

**User's choice:** Postgres enum with all v3.0 types upfront (Recommended)
**Notes:** Includes price_drop and trending_collector stubs (NOTIF-07).

### Q2. What shape should the payload jsonb take?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-type TypeScript discriminated union, no DB CHECK | Mirrors activities.metadata precedent. | ✓ |
| Per-type with DB CHECK constraint | Strongest guarantee; more migration churn. | |
| Flat columns for shared fields + jsonb for extras | Better query ergonomics, more rigid. | |

**User's choice:** Per-type TypeScript discriminated union, no DB CHECK (Recommended)

### Q3. How should watch-overlap dedup be implemented?

| Option | Description | Selected |
|--------|-------------|----------|
| Partial UNIQUE index on payload keys + ON CONFLICT DO NOTHING | Same (recipient, brand, model, day) only inserts once. 30-day window in Server Action. | ✓ |
| 30-day window fully in DB via partial index + expression | Can't cleanly express rolling 30-day in UNIQUE. | |
| Dedup entirely in Server Action, no DB constraint | Race possible. | |

**User's choice:** Partial UNIQUE index on payload keys, ON CONFLICT DO NOTHING (Recommended)

### Q4. Actor column and CHECK/CASCADE rules?

| Option | Description | Selected |
|--------|-------------|----------|
| actor_id nullable FK + ON DELETE CASCADE + self-notif CHECK | B-9 at DB layer; NULL for system notifications. | ✓ |
| No actor_id column — actor in payload only | Simpler schema, messier self-notif CHECK. | |
| actor_id NOT NULL with system sentinel UUID | Cleanest constraint; creates a magic system user. | |

**User's choice:** actor_id nullable + FK to users(id) ON DELETE CASCADE + self-notif CHECK (Recommended)

---

## DEBT-02 audit scope

### Q1. How deep should the DEBT-02 RLS audit go?

| Option | Description | Selected |
|--------|-------------|----------|
| Patch-minimal: add missing WITH CHECK + verify InitPlan | Matches MR-03 original scope. Smallest blast radius. | ✓ |
| Full rewrite for consistency | Cleaner code; regression risk. | |
| Patch + defense-in-depth SELECT policies | Scope expansion. | |

**User's choice:** Patch-minimal: add missing WITH CHECK + verify InitPlan pattern (Recommended)

### Q2. How should the RLS audit be verified?

| Option | Description | Selected |
|--------|-------------|----------|
| Integration tests: cross-user fixtures against local Supabase | Mirrors isolation.test.ts pattern. Ongoing regression coverage. | ✓ |
| Manual SQL verification in runbook | One-time at deploy, no ongoing coverage. | |
| Grep gate + policy diff review | Fast but trusts review eyes. | |

**User's choice:** Integration tests: run policies against local Supabase with cross-user fixtures (Recommended)

### Q3. Which migration carries the DEBT-02 patches?

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated Phase 11 RLS audit migration | Isolated, easy rollback. | ✓ |
| Bundle into first Phase 11 migration | Fewer files; mixes concerns. | |

**User's choice:** Dedicated Phase 11 RLS audit migration (Recommended)

---

## Claude's Discretion

- pg_trgm GIN vs GIST index variant + ops class
- Exact TS discriminated-union field names for each notification payload type
- `photo_url` storage format (path only vs full URL)
- Migration filenames/timestamps
- Exact SQL for the three-tier storage RLS JOIN

## Deferred Ideas

- Orphan storage cleanup cron / scheduled function
- worn_public column drop (Phase 12)
- Cross-user SELECT RLS on watches (defense-in-depth beyond DAL)
- DB-level CHECK on notifications.payload per-type shape
- 30-day dedup window as pure DB index expression
- Full RLS rewrite for consistency on existing tables
