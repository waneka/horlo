# Phase 79: Backfill Migration + Display Hydration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-25
**Phase:** 79-backfill-migration-display-hydration
**Areas discussed:** Apply gating + transaction boundary, Family decisions artifact + symmetry, Watches table hydration scope, `new` defaults + post-apply audit record

---

## Area 1: Apply Gating + Transaction Boundary

### Q1: Pre-flight gating

| Option | Description | Selected |
|--------|-------------|----------|
| Strictest — refuse on anything weird | Refuses if any of: row undecided, mistyped status, bad merge target, catalog drifted since dry-run | ✓ |
| Refuse on undecided + mistyped only | Allows catalog drift to slip through; new brands skipped, re-run later | |
| Strictest + allow explicit 'defer this one' | Same as strictest + per-row `skip` for follow-up runs | |

**User's choice:** Strictest gate.
**Notes:** Reinforces "Phase 79 is the high-risk phase" framing from STATE.md. Operator accepts the cost of a re-run `--regenerate` cycle to surface drift before SQL hits prod.

### Q2: Confirmation pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Always pause and ask | Print summary + wait for 'yes' on both local and prod | |
| Pause and ask on prod only | Silent local; prod prints summary + waits for 'yes' (detected by connection string) | ✓ |
| Silent run, but require an extra flag for prod | Local silent; prod requires `--i-mean-it`-style flag, no interactive prompt | |

**User's choice:** Pause-and-ask on prod only.
**Notes:** Optimizes for dev-iteration speed locally; preserves a forced eyeball-the-magnitude moment on prod.

### Q3: Transaction shape

| Option | Description | Selected |
|--------|-------------|----------|
| All four writes as ONE atomic block | Single BEGIN/COMMIT wrapping brands insert → catalog UPDATE → families + aliases → watches hydration. Failure rolls back everything. | ✓ |
| Brands+catalog together, families+watches together | Two transactions; first half's work survives if second fails | |
| Each step as its own transaction | Most granular; mid-run failure leaves a partial state | |

**User's choice:** Single atomic transaction.
**Notes:** Cleanest rollback story for the highest-risk write in the milestone.

### Q4: Re-run behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Detect 'already done' and exit cleanly | Quick precheck on `count(*) WHERE brand_id IS NULL OR family_id IS NULL`; zero → exit 0 with "already applied" message | ✓ |
| Refuse, require explicit 'I know it ran' flag | `--force-rerun` required after a successful apply | |
| Run writes regardless — they'll be no-ops | ON CONFLICT DO NOTHING + redundant UPDATEs | |

**User's choice:** Detect and exit cleanly.
**Notes:** ROADMAP MIG-02 idempotency requirement satisfied; CI/CD-friendly without compromising the strict gate.

---

## Area 2: Family Decisions Artifact + Symmetry

### Q5: Script topology

| Option | Description | Selected |
|--------|-------------|----------|
| Same script with a mode switch | `--mode=brands\|families\|both` on existing `scripts/v8.4-brand-canonicalization.ts` | ✓ |
| Separate sibling script for families | New `scripts/v8.4-family-canonicalization.ts` mirrors brand one | |
| Same script, no mode switch — always does both | Dry-run always emits both files; apply always processes both | |

**User's choice:** Same script with mode switch.
**Notes:** One connection bootstrap + one parse routine + one gate implementation; fewer drift surfaces.

### Q6: Auto-alias on merge decisions

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — every merge adds the typo to aliases | `merge:<datejust-uuid>` on `Brut Date` row appends 'brut date' to canonical aliases | ✓ |
| Only if you mark it explicitly | Extra grammar token like `merge:<uuid> +alias` per-row | |
| No — aliases stay empty in Phase 79 | Aliases populated in a later phase | |

**User's choice:** Auto-alias on every merge.
**Notes:** Aliases are the entire point of the column; Phase 79 is the only phase with operator-decided merge data needed to populate them.

### Q7: Family dry-run ordering (initially raised as conflict with Q3 decision)

| Option | Description | Selected |
|--------|-------------|----------|
| Only after brand `--apply` has completed | TWO sequential prod operations; family dry-run reads applied brand_id | (initial) |
| Family dry-run reads brand DECISIONS, not applied DB | In-memory chain; single combined `--apply` survives | ✓ (after re-discussion) |
| Combined family+brand review file from the start | One review file with both interleaved | |

**User's choice:** Option 2 (after re-discussion). Initial pick was "only after brand apply" which would have broken Q3's single-atomic-transaction decision. Claude flagged the conflict and recommended Option 2.
**Notes:** Preserves single atomic apply; complexity contained inside script; strict gate catches stale family file via `--regenerate`.

---

## Area 3: Watches Hydration

### Q8: Hydration rule

| Option | Description | Selected |
|--------|-------------|----------|
| Write through every row, no exceptions | Even no-op writes; `updated_at` bumps everywhere; only brand+model touched | ✓ |
| Skip no-op writes | Only touch rows where stored value differs from canonical | |
| Write through, but also preserve old strings | Disposable `watches_pre_v8_4_strings` table for rollback path | |

**User's choice:** Write through every row.
**Notes:** Simplest SQL, easiest to reason about, acceptable churn for a one-shot milestone-level migration.

---

## Area 4: `new` Defaults + Post-Apply Audit

### Q9: `needs_review` default for operator-marked `new` rows

| Option | Description | Selected |
|--------|-------------|----------|
| Default to `false` (operator approved) | Phase 82 `/admin/brands` queue empty by default | ✓ |
| Default to `true` (eyeball later) | All 33 new rows show at the top of the Phase 82 queue | |
| Per-row via extended grammar (`new` vs `new!`) | Extends D-78-02 status grammar | |

**User's choice:** Default `false`.
**Notes:** Operator-marked `new` IS the approval signal; punts ambiguity to Phase 82 UI; keeps D-78-02 grammar tight.

### Q10: Post-apply audit artifact

| Option | Description | Selected |
|--------|-------------|----------|
| Full `79-POST-DEPLOY.md` written by script + operator sign-off | Auto-generated counts + assertion result + sign-off checklist | ✓ |
| Append summary section to the decisions files | `## Applied 2026-XX-XX` section in both `.md` files; no separate POST-DEPLOY | |
| Both — belt-and-suspenders | Append-section + separate POST-DEPLOY.md | |

**User's choice:** Full auto-generated `79-POST-DEPLOY.md`.
**Notes:** Mirrors successful Phase 78 pattern; high-information artifact for retrospective; auto-generation closes the "wrote script, forgot to write audit" gap.

---

## Claude's Discretion

- Post-flight assertion SQL phrasing (positive `IS DISTINCT FROM NULL` predicate)
- In-memory brand-decision map data structure
- Per-row alias normalization (`lower(trim(...))`)
- Wave 0 RED stub layout (mirrors Phase 78 convention)
- npm script entry naming (likely `db:v8.4-canon` extended; planner decides)

## Deferred Ideas

See `79-CONTEXT.md` `<deferred>` section. Summary:
- Two-step prod sequencing
- Combined single review file
- `new!` extended grammar
- Pre-apply rollback table
- Skip no-op writes optimization
- Filtering hydration by status
- User-facing change notifications
- Pre-flight count-match verification (subsumed by strict gate)
- `--dry-sql` SQL preview flag
