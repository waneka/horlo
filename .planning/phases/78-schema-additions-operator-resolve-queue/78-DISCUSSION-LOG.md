# Phase 78: Schema Additions + Operator-Resolve Queue - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-24
**Phase:** 78-Schema Additions + Operator-Resolve Queue
**Areas discussed:** Operator-resolve `.md` artifact format, Dry-run auto-resolve aggressiveness, Script runtime contract, Seed known aliases in Phase 78

---

## Operator-resolve `.md` artifact format

### Q1: On-disk format

| Option | Description | Selected |
|--------|-------------|----------|
| Markdown table w/ status column | Single GFM table: brand_raw \| normalized \| proposed_target \| status \| notes. Operator edits the `status` cell. Phase 79 parses the table. Familiar editor surface, search-friendly. | ✓ |
| Per-row YAML blocks | Each ambiguous row is a fenced YAML block with `decision:` and `target_id:` fields. Richer schema per row but larger parser surface + visually heavier. | |
| Inline HTML-comment markers | Bullet list with HTML comments carrying decision metadata. Compact but HTML-comment parsing is fragile and operator ergonomics are poor. | |

**User's choice:** GFM table with status column
**Notes:** Phase 79 must error on unknown values in `status` rather than coercing.

### Q2: `status` cell grammar

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit prefix tokens | `auto-resolved` \| `merge:<uuid>` \| `new` \| `skip`. Verb-then-target is unambiguous; `skip` lets operator defer a row. Phase 79 errors on any other value. | ✓ |
| Decision in `proposed_target_id` column | Operator edits the UUID column; `status` is informational. Conflates 'decision' with 'value' and removes the deferral case. | |
| Free-text + post-parse normalization | Operator writes whatever; Phase 79 normalizes. Forgiving but parser failure surface invisible until --apply. | |

**User's choice:** Explicit prefix tokens
**Notes:** Phase 79 refuses to `--apply` if any row still has untouched `needs-review` status.

---

## Dry-run auto-resolve aggressiveness

### Q1: Auto-resolve scope

| Option | Description | Selected |
|--------|-------------|----------|
| Exact-only auto-resolve | Auto-resolve ONLY when `lower(trim(brand))` exactly equals an existing `brands.name_normalized`. Every fuzzy candidate goes to needs-review. | ✓ |
| Two-tier auto-resolve at >0.85 | Auto-resolve exact AND fuzzy ≥0.85 similarity. 0.6–0.85 still goes to needs-review. | |
| Mirror INGEST threshold (>0.6) | Auto-resolve everything INGEST would auto-attach. Operator never sees the Hamilton vs Hamilton Watch case. Defeats the operator queue's purpose. | |

**User's choice:** Exact-only auto-resolve
**Notes:** The four SEED-021-cited bug surface cases (Hamilton/Hamilton Watch, Omega/OMEGA, Héron/Héron Watches, Brut Date/Brut Datejust) all land in needs-review by construction.

### Q2: Fuzzy candidate count in notes column

| Option | Description | Selected |
|--------|-------------|----------|
| Top 3 candidates >0.5 | Up to 3 candidates above the relaxed-floor 0.5. Format: `hamilton (0.85), hamilton-khaki (0.62)`. | ✓ |
| Top 1 candidate only | Only the single highest-similarity candidate. Compact but loses signal when two candidates score close. | |
| All candidates >0.6 | Every candidate that crosses INGEST's threshold. Risks visual noise on common surnames. | |

**User's choice:** Top 3 candidates >0.5
**Notes:** Empty candidates cell = no match above 0.5, signal to operator that the proposal is `new`.

---

## Script runtime contract

### Q1: Connection model

| Option | Description | Selected |
|--------|-------------|----------|
| Service-role + DATABASE_URL, both envs | Reuses existing `tsx` script pattern. DATABASE_URL points local by default; operator exports prod URL to dry-run against prod. Service-role bypasses RLS. Dry-run never writes. | ✓ |
| Local-only, refuse to run against prod | Hardcoded local check on DATABASE_URL. Safer but blocks Phase 79's `--apply` workflow. | |
| Read-only conn via Supabase REST | anon key + REST API. Doubles surface area vs Phase 79's drizzle needs. | |

**User's choice:** Service-role + DATABASE_URL, both envs
**Notes:** Cross-env safety is at the SQL-statement level (read-only queries), not the connection level.

### Q2: Idempotency on re-run

| Option | Description | Selected |
|--------|-------------|----------|
| Refuse to overwrite if file exists | Default exits with error pointing at `--regenerate`. `--regenerate` rewrites by merging existing operator decisions forward. | ✓ |
| Always overwrite | Re-running blows away operator edits. Simplest but a footgun. | |
| Append-only with timestamp suffix | Each run produces `v8.4-brand-merge-decisions-{timestamp}.md`. Phase 79 needs a discovery rule. Friction without clear win. | |

**User's choice:** Refuse to overwrite + `--regenerate` merge-forward
**Notes:** `--force` flag overwrites unconditionally for cases the regenerate-merge logic can't cover.

---

## Seed known aliases in Phase 78

### Q1: Initial aliases content

| Option | Description | Selected |
|--------|-------------|----------|
| Empty everywhere; populate during Phase 79 backfill | Phase 78 ships `aliases default '{}'` and writes zero values. Phase 79's `--apply` writes aliases via operator decisions. Single source of truth for alias data. | ✓ |
| Pre-seed the SEED-021-cited cases in the migration | Hardcode 3–4 documented cases as UPDATE statements in the schema migration. Local catalog may not have the target family rows; UPDATEs awkward to undo; splits state between migration + operator queue. | |
| Ship a separate `aliases-seed.json` fixture | Dry-run script reads JSON and proposes alias additions in the artifact. More moving parts. | |

**User's choice:** Empty everywhere; populate during Phase 79 backfill
**Notes:** Phase 78 ships the column shape + GIN index; Phase 79's `--apply` writes alias values via `UPDATE watch_families SET aliases = aliases || ARRAY[...]` driven by operator decisions on the `.md` artifact.

---

## Claude's Discretion

- GIN index design: plain `USING GIN (aliases)` for `@>` containment; no functional/trigram GIN on aliases.
- Retroactive `needs_review: true` on existing brand rows: deferred to Phase 79's operator decisions.
- Drizzle codegen for additive columns: planner picks between hand-written `supabase/migrations/*.sql` (prod portability) vs Drizzle Kit push (local). Standard pattern.

## Deferred Ideas

- Functional GIN / trigram GIN on `aliases` — aliases are exact-string mapping by design; fuzzy match belongs on `name_normalized`.
- Retroactive `needs_review: true` flagging — Phase 79's operator queue handles it.
- Pre-seeding SEED-021 aliases in schema migration — explicitly rejected (D-78-08).
- Local-only refusal in script — rejected; cross-env safety is at SQL level.
- Generic `--mode=brands|families` flag on the script — Phase 78 is brand-only; Phase 79 MIG-03 extends to families.
