# Phase 33: Discovery Audit — Pattern Map

**Mapped:** 2026-05-06
**Files analyzed:** 2 deliverable artifacts (`33-DISCOVERY-AUDIT.md`, `checks/quick.sh` + `checks/full.sh`) + 21 source-grep target files referenced by RESEARCH.md
**Analogs found:** 1 / 2 deliverables — `DISCOVERY-AUDIT.md` has strong markdown-doc analogs in `.planning/`; `checks/*.sh` has **no codebase analog** (Phase 33 establishes a new convention)

---

## Reframing

This is a **documentation-only phase**. No `src/` files are created or modified — ROADMAP §Phase 33 success criterion #5 mandates "Zero code, schema, or dependency changes." The standard PATTERNS.md flow ("map new src files to existing src analogs") does not apply. Instead this map identifies:

1. The closest existing markdown analog the new `33-DISCOVERY-AUDIT.md` should mirror in shape, tone, and falsifiability rigor.
2. Verifies the 21 source-grep target files in RESEARCH.md actually exist on disk.
3. Notes the absence of any prior `.planning/**/checks/*.sh` pattern in the repo and recommends the minimum shape `quick.sh` / `full.sh` should follow.

---

## File Classification

| Deliverable | Role | Data Flow | Closest Analog | Match Quality |
|-------------|------|-----------|----------------|---------------|
| `.planning/phases/33-discovery-audit/33-DISCOVERY-AUDIT.md` | audit/decision-doc | static markdown (table + decisions §) | `.planning/research/PREMIUM-MAP.md` | **strong shape match** (table + decision verdicts + cross-references) — closest available analog for the "audit + 4 decisions" hybrid |
| `.planning/phases/33-discovery-audit/checks/quick.sh` | scaffold/check script | bash file-presence + grep + exit code | none in repo | **no analog** — establish a minimal convention |
| `.planning/phases/33-discovery-audit/checks/full.sh` | scaffold/check script | bash D-13 5-rule consistency checks | none in repo | **no analog** — establish a minimal convention |

---

## Pattern Assignments

### `33-DISCOVERY-AUDIT.md` (audit/decision-doc, static markdown)

**Primary analog:** `.planning/research/PREMIUM-MAP.md` (12kB, audit-style decision artifact dated 2026-05-06; the only repo doc that combines a tagged table + explicit verdicts in a single artifact).

**Secondary analogs (use for sub-section shapes only):**
- `.planning/phases/32-debt-09-notespublic-fix/32-VERIFICATION.md` lines 19–35 — for the "Observable Truths" table shape (numbered rows, status, evidence column with `file:line` references). The audit table per D-10 is structurally similar: row id + tag + evidence-with-file:line.
- `.planning/milestones/v4.0-MILESTONE-AUDIT.md` lines 1–95 — for the YAML frontmatter + executive summary + per-phase status table pattern.
- `.planning/milestones/v4.0-phases/23-settings-sections-schema-field-ui/23-VERIFICATION.md` lines 38–48 — best-in-repo example of multi-column status table with rich evidence cells, tag-style Status column (VERIFIED / GAP / MISSING — analogous to D-11 Live / Dead / Redundant / Missing), and inline citations.

**Frontmatter pattern** (`PREMIUM-MAP.md` lines 1–8 — adapt verbatim):

```markdown
---
title: Discovery Audit — v5.0 Click-Path Map
status: draft | decided
date: 2026-05-06
audit_seed: SEED-004
phase: 33-discovery-audit
decision: [populated when 4 verdicts ship; until then "pending"]
---
```

**Pass/Fail-criteria-at-top pattern** — D-13 mandates this section appear BEFORE any findings. No exact analog exists in the repo (most VERIFICATION docs put goal at top, criteria embedded in the truth table). Use a clean H2 immediately after the H1 title block:

```markdown
# Discovery Audit — v5.0

## Pass/Fail Criteria

The audit passes IFF all 5 rules below hold:

1. Every surface in the D-05 scope list has ≥1 row in the table.
2. Every Dead row has reproduction steps in `evidence` (file:line for source-pass; URL + observation for browser-pass).
3. Every Missing row cites the SEED-004 Rdio quote violation in `evidence`.
4. Every Redundant row cites the specific row ID it duplicates in `evidence`.
5. All 4 mandated decisions in the final § have an explicit YES/NO/DEFERRED resolution with rationale anchored to ≥1 row ID.

## SEED-004 Rdio Principle (single rubric — D-12)

> "A collector should be able to drift from one watch / collector / family / reference to another by clicking, without ever feeling lost or running into a dead end."
>
> — `.planning/seeds/SEED-004-v5-discovery-north-star.md` line 15

## Click-Path Audit
| row_id | surface | element | target | tag | evidence | viewer_state | viewport |
|--------|---------|---------|--------|-----|----------|--------------|----------|
| DISC-AUDIT-01 | / | ... | ... | Live | ... | ... | ... |
...

## Decisions
...
```

**Tag-column pattern** — closest analog is `23-VERIFICATION.md` line 41 ("Status" column with values like `VERIFIED`, `GAP`, `MISSING`). For Phase 33 use exactly the D-11 enum values: `Live`, `Dead`, `Redundant`, `Missing` (no other values; no freeform).

**Evidence-cell pattern** — `32-VERIFICATION.md` line 22:

```
✓ VERIFIED | `npx vitest run tests/...` → `Tests 4 passed (4)`
```

For Phase 33 source-pass rows, the parallel pattern is:

```
src/components/explore/PopularCollectors.tsx:42
```

For Phase 33 browser-pass rows:

```
prod: https://horlo.app/explore (fresh-account, ~390px) — ExploreHero rendered with "Find your first three" copy; clicked 3rd suggested collector card → /u/<username> loaded with 200
```

**Decisions § per-decision template** — no exact analog in repo. CONTEXT.md `<specifics>` provides the canonical template (D-16):

```markdown
### Decision Q1: Combine home and explore?
**Verdict:** YES | NO | DEFERRED
**Rationale:** [2-4 sentences citing audit findings]
**Cited rows:** DISC-AUDIT-NN, DISC-AUDIT-MM
**Drives:** [downstream phase / item this verdict gates]
```

`PREMIUM-MAP.md` "The Decision" section (lines 95–104) is the closest tonal match: a single declarative verdict line followed by 2–5 sentences of rationale. Use the same posture (declarative verdict, then rationale, then cross-references).

**Cross-references § pattern** — `PREMIUM-MAP.md` lines 146–153 ("Cross-References" with bulleted `.planning/**` paths each followed by an em-dash and one-line note). Mirror this shape at the bottom of `33-DISCOVERY-AUDIT.md` linking to ROADMAP §Phase 33, REQUIREMENTS DISC-10, SEED-004, STATE.md decisions §, and downstream Phase 34/35/38/39 plan-target paths.

---

### `checks/quick.sh` and `checks/full.sh` (scaffold/check scripts)

**Analog:** None. Repo-wide search confirms zero `.planning/**/checks/*.sh` files exist; zero `.sh` files exist in the source tree at all (the only `.sh` hit is a third-party `node_modules/damerau-levenshtein/scripts/update-changelog.sh`). `package.json` "scripts" are all `tsx` invocations (`db:backfill-catalog`, `db:refresh-counts`, etc.) — no precedent for shell-based validation in the repo.

**Recommendation: establish a new minimal convention.** Both scripts should:

1. Start with `#!/usr/bin/env bash` and `set -euo pipefail` (fail fast, fail loud).
2. Resolve the audit file path relative to the script location so they run from any CWD: `AUDIT="$(dirname "$0")/../33-DISCOVERY-AUDIT.md"`.
3. Print one diagnostic line per check (`echo "[ok] ..."` / `echo "[fail] ..." >&2`) — matches the developer's existing reading habits from `npm run lint` output.
4. Exit 0 only when ALL checks pass; exit 1 with a non-empty stderr message on the first failure (per VALIDATION.md §"Falsifiability Validator" implicit contract).
5. Use only `grep`, `wc`, `awk`, `test`, and `node -e` one-liners — no npm dependencies (matches the zero-dependency-change rule).

**Suggested shape for `quick.sh`** (3 checks per VALIDATION.md Wave 0):

```bash
#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
AUDIT="$DIR/../33-DISCOVERY-AUDIT.md"

# 1. file exists
test -f "$AUDIT" || { echo "[fail] $AUDIT not found" >&2; exit 1; }
echo "[ok] file exists: $AUDIT"

# 2. top-level headings present
for h in "## Pass/Fail Criteria" "## Click-Path Audit" "## Decisions"; do
  grep -qF "$h" "$AUDIT" || { echo "[fail] missing heading: $h" >&2; exit 1; }
done
echo "[ok] required headings present"

# 3. table has ≥1 DISC-AUDIT row
ROWS=$(grep -c '^| DISC-AUDIT-' "$AUDIT" || true)
test "$ROWS" -gt 0 || { echo "[fail] no DISC-AUDIT rows found" >&2; exit 1; }
echo "[ok] $ROWS DISC-AUDIT rows present"
```

**Suggested shape for `full.sh`** (wraps quick.sh + the D-13 5-rule consistency checks per VALIDATION.md line 73):

```bash
#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
AUDIT="$DIR/../33-DISCOVERY-AUDIT.md"

bash "$DIR/quick.sh"

# Rule 2: every Dead row has file: or prod: in evidence
DEAD_BAD=$(awk -F'\\|' '/\| Dead \|/ { if ($7 !~ /(file|src\/|prod:)/) print NR }' "$AUDIT" || true)
test -z "$DEAD_BAD" || { echo "[fail] Dead rows missing reproduction evidence: $DEAD_BAD" >&2; exit 1; }
echo "[ok] all Dead rows cite file:line or prod:URL"

# Rule 3: every Missing row cites Rdio / SEED-004
MISSING_BAD=$(awk -F'\\|' '/\| Missing \|/ { if ($7 !~ /(Rdio|SEED-004)/) print NR }' "$AUDIT" || true)
test -z "$MISSING_BAD" || { echo "[fail] Missing rows lack Rdio/SEED-004 citation: $MISSING_BAD" >&2; exit 1; }
echo "[ok] all Missing rows cite SEED-004 Rdio principle"

# Rule 4: every Redundant row cites a target DISC-AUDIT-NN that exists
# (extract the cited id; assert it appears as a row id elsewhere)
# ... (similar awk + grep pair) ...

# Rule 5: 4 decision verdicts present
VERDICTS=$(grep -cE '^\*\*Verdict:\*\*' "$AUDIT" || true)
test "$VERDICTS" -eq 4 || { echo "[fail] expected 4 Verdict lines; found $VERDICTS" >&2; exit 1; }
echo "[ok] 4 decision verdicts present"

echo "[ok] full audit consistency checks pass"
```

The shape above is the recommended baseline. The plan executor may diverge as long as the exit-0/exit-1 contract holds and the 5 D-13 rules are mechanically enforced.

---

## Surface Entry-Point File Path Verification

RESEARCH.md §Surface Inventory cites 21 entry-point files across the 15 surface blocks plus the followers/following click-target sub-routes plus the layout subtree. **All 21 paths verified present on disk as of 2026-05-06**:

| RESEARCH.md path | Verified |
|------------------|----------|
| `src/app/page.tsx` | ✓ |
| `src/app/explore/page.tsx` | ✓ |
| `src/app/explore/collectors/page.tsx` | ✓ |
| `src/app/explore/watches/page.tsx` | ✓ |
| `src/app/search/page.tsx` | ✓ |
| `src/app/catalog/[catalogId]/page.tsx` | ✓ |
| `src/app/watch/[id]/page.tsx` | ✓ |
| `src/app/u/[username]/page.tsx` | ✓ |
| `src/app/u/[username]/layout.tsx` | ✓ |
| `src/app/u/[username]/[tab]/page.tsx` | ✓ |
| `src/app/u/[username]/followers/page.tsx` | ✓ |
| `src/app/u/[username]/following/page.tsx` | ✓ |
| `src/components/layout/Header.tsx` | ✓ |
| `src/components/layout/SlimTopNav.tsx` | ✓ |
| `src/components/layout/DesktopTopNav.tsx` | ✓ |
| `src/components/layout/UserMenu.tsx` | ✓ |
| `src/components/layout/BottomNav.tsx` | ✓ |
| `src/components/layout/NavWearButton.tsx` | ✓ |
| `src/components/profile/ProfileTabs.tsx` | ✓ |
| `src/components/profile/ProfileHeader.tsx` | ✓ |
| `src/components/search/SearchPageClient.tsx` | ✓ |

**No path corrections needed.** RESEARCH.md surface inventory is accurate; the audit author can trust the paths as cited and proceed with the augmented grep recipe in RESEARCH.md §Source-Grep Recipe (lines 184–217).

---

## Shared Patterns

### Frontmatter convention
**Source:** `.planning/research/PREMIUM-MAP.md` lines 1–8; `.planning/milestones/v4.0-MILESTONE-AUDIT.md` lines 1–52.
**Apply to:** `33-DISCOVERY-AUDIT.md` only.
**Why:** Every long-form planning artifact in `.planning/` carries YAML frontmatter with `status` / `date` / cross-references. Use the simpler PREMIUM-MAP.md shape (5–7 lines) over the v4.0-MILESTONE-AUDIT.md shape (50+ lines of pre-computed scores) — the audit ships a single artifact, not a milestone-wide rollup.

### Cross-reference closing §
**Source:** `.planning/research/PREMIUM-MAP.md` lines 146–153.
**Apply to:** `33-DISCOVERY-AUDIT.md` only.
**Pattern:** Bulleted list of `.planning/**` paths each followed by a one-line note about how that document relates. Use this to point downstream readers to ROADMAP §Phase 33, REQUIREMENTS DISC-10, SEED-004, STATE.md, and the four downstream phase plans (34/35/38/39).

### Bash check-script convention (NEW — establish here)
**Source:** none — establish in this phase.
**Apply to:** `checks/quick.sh` and `checks/full.sh`.
**Pattern:** `#!/usr/bin/env bash` + `set -euo pipefail` + path-relative-to-script + one-line-per-check stdout/stderr + exit 0 only on full pass. No npm install. Future audit-style phases (e.g., a v5.x re-audit; the Phase 39 falsifiability validator candidate) can reuse this convention.

---

## No Analog Found

| Deliverable | Reason | Path Forward |
|-------------|--------|--------------|
| `checks/quick.sh` | Repo has zero `.sh` files outside `node_modules/`; all validation runs through `npm run lint` + `npm run test` | Establish minimal `bash + grep + awk + test` convention sketched above. Document in the script header that this is the first instance of a `.planning/**/checks/` script pattern. |
| `checks/full.sh` | Same as above | Same — wrap `quick.sh` + add D-13 5-rule consistency checks per VALIDATION.md line 73 |
| The combined "Pass/Fail criteria pinned at TOP before findings" pattern | No existing planning artifact pins falsifiable acceptance criteria above the artifact body — all VERIFICATION docs put goal at top, criteria embedded inline. D-13 enforces this as a NEW shape. | Use the literal H2 layout shown above (`## Pass/Fail Criteria` immediately after the H1 + frontmatter); this also makes `quick.sh` heading-presence check trivial to grep. |

---

## Landmines and Pre-Existing Artifacts to Reuse

1. **`PREMIUM-MAP.md` is the single closest analog in tone and shape** — read it once before drafting `33-DISCOVERY-AUDIT.md` to internalize the "audit table + verdicts + cross-references" cadence. Don't reinvent.
2. **`.planning/codebase/STRUCTURE.md` is STALE (dated 2026-04-11)** — RESEARCH.md Pitfall 6 calls this out explicitly. Do not rely on it for the surface inventory; the verified paths above (and RESEARCH.md §Surface Inventory) are the source of truth.
3. **The `revalidatePath('/u/[username]/[tab]', 'page')` WR-07 holdout at `src/app/actions/wishlist.ts:206`** is the audit's flagship Dead-row finding per RESEARCH.md §WR-07 Landmine. Don't fix it — capture only.
4. **No `.planning/**/checks/` directory exists yet** — the new `33-discovery-audit/checks/` directory establishes a precedent. If Phase 39 ships a `scripts/validate-discovery-audit.ts` (per RESEARCH.md §"Phase 39 candidate"), revisit whether to keep the bash convention or migrate.
5. **CLAUDE.md / AGENTS.md `@/*` alias convention** — applies to `src/` paths only. Audit `evidence` cells should use raw `src/...` paths (per CONTEXT.md research recommendation: shorter, unambiguous as `file:line` values).

---

## Metadata

**Analog search scope:** `.planning/research/`, `.planning/phases/`, `.planning/milestones/`, repo root for `.sh` files, `package.json` scripts, `scripts/` directory.
**Files scanned:** ~30 markdown files in `.planning/` + 21 source-tree paths verified by `ls`.
**Pattern extraction date:** 2026-05-06
