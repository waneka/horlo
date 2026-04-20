# Phase 7: Social Schema & Profile Auto-Creation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-19
**Phase:** 07-social-schema-profile-auto-creation
**Areas discussed:** Profile auto-creation, Username strategy, Activity logging scope, Wear events migration

---

## Profile Auto-Creation

| Option | Description | Selected |
|--------|-------------|----------|
| DB trigger (Recommended) | Postgres trigger on auth.users fires on INSERT, creates profile + profile_settings rows. Zero app code, works even if user never visits. | ✓ |
| Auth webhook | Supabase Auth webhook calls a Next.js API route on signup. More flexible but adds infra dependency. | |
| Lazy creation in DAL | First DAL call creates profile if missing. Simple but profile doesn't exist until user acts. | |

**User's choice:** DB trigger
**Notes:** None

### Backfill for existing users

| Option | Description | Selected |
|--------|-------------|----------|
| Migration backfill (Recommended) | Same migration inserts rows for existing users. Idempotent, runs once. | |
| User will re-create account | Single user (the developer) will delete and re-create their account. No backfill needed. | ✓ |

**User's choice:** Will delete account and re-create — no backfill needed
**Notes:** "there is one user currently - me. i can just delete the user account and start over"

---

## Username Strategy

### Assignment method

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-generate from email (Recommended) | Extract part before @, append random digits if taken. User can change in Phase 8. | ✓ |
| Random slug | Generate random username like user_a7f3b2. No collision risk but impersonal. | |
| Prompt at signup | Add username field to signup form. Best UX but modifies auth flow (outside Phase 7 scope). | |

**User's choice:** Auto-generate from email
**Notes:** None

### Format constraints

| Option | Description | Selected |
|--------|-------------|----------|
| Standard web (Recommended) | Lowercase alphanumeric + underscores, 3-30 chars, starts with letter. CHECK constraint. | ✓ |
| Permissive | Allow hyphens, dots, mixed case. More flexible but complicates URL routing. | |
| You decide | Claude picks a reasonable format. | |

**User's choice:** Standard web
**Notes:** None

---

## Activity Logging Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Start logging now (Recommended) | Modify Server Actions to insert activity rows on watch_added, wishlist_added, watch_worn. Historical data available by Phase 10. | ✓ |
| Table only, log later | Create table but write no events. Activity logging wired up in Phase 10 alongside feed UI. | |
| You decide | Claude picks based on implementation fit. | |

**User's choice:** Start logging now
**Notes:** None

---

## Wear Events Migration

| Option | Description | Selected |
|--------|-------------|----------|
| Keep both, sync via Server Action (Recommended) | wear_events is source of truth. Server Action writes to both. No breaking changes. | |
| Drop lastWornDate, use wear_events only | Remove lastWornDate column. All wear reads query wear_events. Cleaner but requires updating all components. | ✓ |
| You decide | Claude picks lowest-risk approach. | |

**User's choice:** Drop lastWornDate, use wear_events only
**Notes:** Clean break chosen since user is re-creating account anyway. No legacy wear data to preserve. Expands Phase 7 into app code changes (WatchCard, WatchDetail, insights must be updated).

---

## Claude's Discretion

- Migration file organization (single vs split by table)
- Trigger function implementation details
- RLS policy naming convention
- Activity event type enum values beyond the three specified
- Index strategy beyond success criteria requirements

## Deferred Ideas

None — discussion stayed within phase scope.
