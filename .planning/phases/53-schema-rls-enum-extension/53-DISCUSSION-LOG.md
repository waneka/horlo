# Phase 53: Schema + RLS + Enum Extension - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-22
**Phase:** 53-schema-rls-enum-extension
**Areas discussed:** Data model shape, Comments table structure, Status-flip grandfather policy, Notify-toggle defaults

---

## Data model shape (likes)

| Option | Description | Selected |
|--------|-------------|----------|
| Per-target tables | Separate `watch_likes` + `wear_likes` with real `ON DELETE CASCADE` FKs; SEC-06 cascade automatic; matches existing FK precedent | ✓ |
| Polymorphic reactions table | One `reactions` table keyed by `(target_type, target_id)`; no FK → app-layer orphan cleanup; PITFALLS "never for this project" | |
| You decide | Defer to research recommendation | |

**User's choice:** Per-target tables (Recommended)
**Notes:** Aligns with research (STACK + PITFALLS + 2/3 researchers) and the existing FK-cascade house style; cascade for SEC-06 becomes impossible to forget.

---

## Comments table structure

| Option | Description | Selected |
|--------|-------------|----------|
| One shared comments table | Two nullable cascading FKs (`watch_id`, `wear_event_id`) + CHECK exactly-one-set; single DAL path, FK cascade preserved | ✓ |
| Split watch_comments + wear_comments | Fully symmetric with likes; doubles DAL/Server-Action/RLS with no UNIQUE payoff | |
| You decide | Defer to research recommendation | |

**User's choice:** One shared comments table (Recommended)
**Notes:** Likes stay split (clean `UNIQUE(user,target)`); comments shared (no UNIQUE needed) — intentional asymmetry per STACK.

---

## Status-flip grandfather policy

| Option | Description | Selected |
|--------|-------------|----------|
| Keep rows, gate by current status | No deletes; read gate keys off current watch status; reversible; no schema column | ✓ |
| Snapshot visibility at post time | Extra column recording gate context per comment; mixed-visibility threads; more complex | |
| Hard-delete non-mutual comments on flip | Destructive, irreversible, punishes commenters for owner's later action | |

**User's choice:** Keep rows, gate by current status (Recommended)
**Notes:** Locks the `getCommentsForTarget` predicate for Phase 54; no Phase 53 schema impact.

---

## Notify-toggle defaults

| Option | Description | Selected |
|--------|-------------|----------|
| Add now, default ON | Both columns in this migration, `NOT NULL DEFAULT true` (opt-out, matches `notify_on_follow`); Phase 58 only wires UI | ✓ |
| Add now, default OFF (opt-in) | Default false; contradicts NOTIF-15 "opt out" wording; inconsistent with other notify_* toggles | |
| Defer columns to Phase 58 | Second profile_settings migration later; Phase 55 logNotification can't honor toggle until then | |

**User's choice:** Add now, default ON (Recommended)
**Notes:** Single schema change; consistent with the Phase 13 notify-column precedent and NOTIF-15 opt-out framing.

---

## Claude's Discretion

- Exact index set on the new tables (count GROUP BY + oldest-first chronological reads).
- Column naming, timestamp columns (`created_at`, `edited_at`), migration filename/sequencing.
- Whether the comments gate appears in the RLS SELECT `USING` clause in addition to the INSERT `WITH CHECK` (must satisfy SEC-02 both-layer).

## Deferred Ideas

None — discussion stayed within phase scope. Future social work (SOC-F1…F5) already tracked in REQUIREMENTS.md §Future Requirements.
