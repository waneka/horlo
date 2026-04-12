# Phase 03: Data Layer Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-11
**Phase:** 03-data-layer-foundation
**Areas discussed:** Schema mapping, DAL design, Server Actions shape, Supabase dev setup
**Mode:** --auto (all recommendations auto-selected)

---

## Schema Mapping

| Option | Description | Selected |
|--------|-------------|----------|
| Postgres arrays | `text('...').array()` for array fields — simpler, avoids junction table N+1 | ✓ |
| Junction tables | Normalized many-to-many — more flexible but overkill for <500 watches | |

**User's choice:** [auto] Postgres arrays
**Notes:** Drizzle supports array operations; <500 watches makes join overhead unnecessary

| Option | Description | Selected |
|--------|-------------|----------|
| Normalized columns | Each preference field as its own column — type-safe, individual updates | ✓ |
| Single JSON column | One jsonb column for all preferences — flexible but loses type safety | |

**User's choice:** [auto] Normalized columns
**Notes:** Mirrors TypeScript interface directly; Drizzle schema generation benefits

---

## DAL Design

| Option | Description | Selected |
|--------|-------------|----------|
| Throw errors | DAL throws, Server Actions catch and shape for client | ✓ |
| Return Result types | DAL returns `{ ok, error }` — more explicit but verbose | |

**User's choice:** [auto] Throw errors
**Notes:** DAL is internal API; Server Actions are the user-facing boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Domain types | Return Watch/UserPreferences directly — consumers don't see DB shapes | ✓ |
| Raw Drizzle rows | Pass through DB types — simpler but leaks implementation | |

**User's choice:** [auto] Domain types
**Notes:** Mapping happens inside DAL; clean separation of concerns

---

## Server Actions Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Result objects | `{ success, data?, error? }` — works with useActionState | ✓ |
| Throw on error | Server Actions throw — requires try/catch in components | |

**User's choice:** [auto] Result objects
**Notes:** Avoids try/catch ceremony in components; structured error handling

| Option | Description | Selected |
|--------|-------------|----------|
| revalidatePath | Simple path-based revalidation — correct for current routing | ✓ |
| revalidateTag | Tag-based — more granular but unnecessary complexity at this scale | |

**User's choice:** [auto] revalidatePath
**Notes:** <500 watches, simple routing structure — path revalidation is sufficient

---

## Supabase Dev Setup

| Option | Description | Selected |
|--------|-------------|----------|
| Supabase CLI local | `supabase init` + `supabase start` — no hosted dependency | ✓ |
| Hosted Supabase | Free tier project — simpler setup but network dependency | |

**User's choice:** [auto] Supabase CLI local
**Notes:** Offline development, faster iteration, matches production topology

---

## Claude's Discretion

- Exact Drizzle column types for numeric fields
- Index strategy beyond userId
- Connection file structure
- Zod schema derivation approach

## Deferred Ideas

- UI rewire → Phase 5
- Auth enforcement → Phase 4
- Zustand demotion → Phase 5
