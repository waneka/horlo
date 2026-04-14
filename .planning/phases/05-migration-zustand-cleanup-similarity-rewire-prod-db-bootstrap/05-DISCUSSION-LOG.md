# Phase 05: Zustand Cleanup, Similarity Rewire & Prod DB Bootstrap — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `05-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-04-13
**Phase:** 05-migration-zustand-cleanup-similarity-rewire-prod-db-bootstrap
**Areas discussed:** Migration banner & import flow (resulted in scope removal); none of the remaining areas

---

## Initial gray area selection

Four gray areas were presented for the original Phase 5 scope (MIG-01, MIG-02, DATA-05, OPS-01):

| Option | Description | Selected |
|--------|-------------|----------|
| Migration banner & import flow | Banner placement, dismissed-flag storage, import UX, conflict handling, post-import localStorage behavior | ✓ |
| Zustand demotion shape | Filter store shape, Server Component data threading, mutation refresh path | |
| Similarity rewire & insights conversion | Convert insights page to Server Component, SimilarityBadge prop drilling | |
| Prod DB bootstrap runbook | Verification model, drizzle migrate vs push, shadow-user trigger, rollback | |

**User's choice:** Migration banner & import flow

---

## Migration banner & import flow

Four follow-up questions were drafted (banner placement / dismissed-flag storage, import UX, conflict handling, post-import localStorage behavior) but not asked.

**User's response to the questions:** "what is this feature exactly? i'm confused. what is a user importing? what does the banner say?"

Feature was explained in detail (legacy localStorage data from pre-Phase-4 + new cloud account → one-time banner offering to import). Then:

**User's response to the explanation:** "i'm literally the only user and i don't need this feature"

### Resulting scope decision

| Option | Description | Selected |
|--------|-------------|----------|
| Drop MIG-01/02 from REQUIREMENTS.md, slim Phase 5 to DATA-05 + OPS-01 | Remove the requirements entirely; "Out of Scope for v1" entry; update ROADMAP.md Phase 5 success criteria, requirements list, and goal sentence | ✓ |
| Keep requirements, write a one-off migration script instead of a UI flow | Replacement plan: tiny Node script that reads a localStorage JSON export and inserts via DAL with the developer's userId | |
| Keep requirements as-is | | |

**User's choice:** Drop MIG-01/02. Confirmed via the question pair "do you have any actual localStorage watches that need to make it into the cloud?" → "no" / "should I remove MIG-01/MIG-02 from REQUIREMENTS.md and re-scope Phase 5?" → "yes".

### Files updated as a result
- `.planning/REQUIREMENTS.md` — removed `## Migration` section, added "Self-service localStorage import flow" entry under "Out of Scope for v1", removed MIG-01 / MIG-02 rows from traceability table, updated coverage from 31/31 to 29/29, updated sequencing notes
- `.planning/ROADMAP.md` — Phase 5 title, goal, requirements list, success criteria (1 and 2 removed, criteria 3–6 renumbered to 1–4), Overview narrative, Phases checklist, Progress table

---

## Remaining gray areas (re-presented after scope change)

After the scope change, three gray areas remained:

| Option | Description | Selected |
|--------|-------------|----------|
| Zustand demotion shape | Filter store shape, Server Component data threading, mutation refresh path | |
| Similarity rewire & insights conversion | Convert insights page to Server Component, SimilarityBadge prop drilling | |
| Prod DB bootstrap runbook | Verification model, drizzle migrate vs push, shadow-user trigger, rollback | |

**User's choice:** none — all three deferred to Claude's discretion for the planner.

---

## Outcome

CONTEXT.md captures:
- D-01 (MIG-01/02 removed from scope)
- D-02 (no localStorage cleanup code ships either)
- All gray-area decisions in "Claude's Discretion" subsections with annotated recommendations the planner can adopt or override

No locked decisions were made on the remaining workstreams beyond what prior phases already established.
