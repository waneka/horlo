# Phase 6: RLS Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-19
**Phase:** 06-rls-foundation
**Areas discussed:** Query architecture, Policy granularity, Verification approach, DATA-07 scope

---

## Query Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Defense-in-depth (Drizzle bypasses RLS) | Keep Drizzle with direct DATABASE_URL connection. RLS protects PostgREST/anon key access. DAL WHERE clauses remain primary enforcement. | ✓ |
| RLS-enforced queries | Switch DAL to use Supabase client with user JWT so RLS is primary enforcement. | |

**User's choice:** "all good - use your best judgement"
**Notes:** Claude selected defense-in-depth. Switching the entire query layer to RLS-enforced would be a massive refactor with no immediate benefit — the DAL already filters by userId. RLS adds a second layer protecting against direct API access.

---

## Policy Granularity

| Option | Description | Selected |
|--------|-------------|----------|
| Separate per-operation | Individual SELECT/INSERT/UPDATE/DELETE policies per table with descriptive names | ✓ |
| Combined broad policies | One or two policies per table covering multiple operations | |

**User's choice:** "all good - use your best judgement"
**Notes:** Claude selected separate per-operation policies. More explicit, easier to debug, Supabase best practice.

---

## Verification Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Supabase User Impersonation | Manual verification via Supabase dashboard impersonation tool | ✓ |
| Automated test suite | CI tests with two test users proving isolation | |
| Both | Manual now, automated in Phase 7 | |

**User's choice:** "all good - use your best judgement"
**Notes:** Claude selected manual verification for Phase 6 (3 tables). Automated RLS tests deferred to Phase 7 when the social table count makes automation worthwhile.

---

## DATA-07 Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Pattern only in Phase 6 | Phase 6 establishes RLS patterns on existing tables. Actual social table policies in Phase 7. | ✓ |
| Full DATA-07 in Phase 6 | Write policy templates/stubs for tables that don't exist yet | |

**User's choice:** "all good - use your best judgement"
**Notes:** Claude selected pattern-only. Can't write policies for tables that don't exist. Phase 6's policies serve as the template for Phase 7.

---

## Claude's Discretion

- Policy naming convention
- Single vs multi-file migration structure
- Drizzle migration tooling (generate vs hand-written SQL for RLS)
- Migration strategy (atomic enable + policies in same transaction)

## Deferred Ideas

None.
