# Phase 79: Backfill Migration + Display Hydration — Research

**Researched:** 2026-06-25
**Domain:** Atomic Postgres data migration via `tsx` script — INSERT brands + UPDATE catalog FKs + INSERT/UPDATE families+aliases + UPDATE catalog FKs + UPDATE watches display + in-transaction post-flight assertion. Auto-generated POST-DEPLOY artifact. Idempotent re-run safe.
**Confidence:** HIGH

## RESEARCH COMPLETE

## Summary

Phase 79 is the high-blast-radius data-write phase of v8.4. It extends `scripts/v8.4-brand-canonicalization.ts` (Phase 78 dry-run; 345 lines, 6 exported pure helpers) with three new modes (`--mode=brands|families|both`) and an `--apply` flag that wraps the six write/assert steps in a single `sql.begin(async tx => ...)` transaction. Every primitive Phase 79 needs has direct codebase precedent: `postgres.sql.begin()` for transactions (one prior caller — `scripts/repair-drizzle-journal.ts:172`), `existsSync`-gated refuse-to-overwrite for files (Phase 78 D-78-07), GFM table emission via line-array (`scripts/inventory-explore-catalog.ts:128-184`), and DO `$$` post-flight assertions for transactions (every recent migration). The new infrastructure consists of: a host-string check on `DATABASE_URL` to gate the interactive `yes` prompt, an in-memory `Map<brand_normalized, ResolvedBrand>` to share state between the family dry-run and apply paths, an `array_position(aliases, source) IS NULL` containment guard for idempotent alias append, and a templated `79-POST-DEPLOY.md` writer.

**Primary recommendation:** Structure the apply as `await sql.begin(async tx => { /* 6 ordered steps */ })` with the post-flight assertion as step 6 — a plain `if (countResolved !== countTotal) throw new Error(...)` inside the callback. Throwing inside the `sql.begin` callback triggers a `ROLLBACK` automatically (per `postgres` lib semantics — confirmed by behavior in `scripts/repair-drizzle-journal.ts`, although that script does not exercise the rollback path). Use `node:readline/promises` (Node built-in) for the interactive prod prompt; no new npm dependency. The aliases idempotent append uses `aliases = aliases || ARRAY[$source] WHERE NOT (aliases @> ARRAY[$source])` — readable, GIN-index-friendly, and idempotent. Hydration uses the unambiguous `UPDATE watches w SET brand = b.name, model = f.name FROM watches_catalog c JOIN brands b ON c.brand_id = b.id JOIN watch_families f ON c.family_id = f.id WHERE w.catalog_id = c.id` form — the JOIN naturally skips `catalog_id IS NULL` rows. Local DB is the gate per `[[local-first-dev]]`; do not push prod until the script runs cleanly against local and the SEED-021 Hamilton merge collapses both `Hamilton` and `Hamilton Watch` rows onto the canonical brand. **Local seed gap:** local catalog is populated via `scripts/import-prod-catalog.sh` mirror of prod — it inherits prod's drift cases (Hamilton/Hamilton Watch present, confirmed in `supabase/seed.sql:88,134` AND in `scripts/seed-data/explore-catalog-adds.json:112,122,132`), but Brut Date/Brut Datejust and Héron Watches are NOT in the local seed. The Hamilton merge IS the local end-to-end test. Brut Date alias-append is exercised by unit tests against fixtures, not against the local DB. See A1 in Assumptions Log.

> **Carryforward callouts from Phase 78 (R-FIND-02 applies directly):** the family dry-run still calls `word_similarity` from the script's `postgres`-lib connection — Phase 78's `SET search_path = public, extensions, pg_catalog` line at the top of `try {}` must be preserved when Phase 79 extends `main()`. Without it, the family dry-run's per-row fuzzy candidates fail with `42883`. Already done in `scripts/v8.4-brand-canonicalization.ts:258`; carry forward unchanged.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MIG-02 | Brand `--apply` populates `watches_catalog.brand_id` for every row; idempotent re-run | Q1 (atomic transaction), Q4 (re-run gate via D-79-04), Code Examples |
| MIG-03 | Family `--apply` populates `watches_catalog.family_id`; typo cases routed to `aliases` | Q2 (in-memory map), Q3 (alias append idempotency), Code Examples |
| MIG-04 | Post-flight assertion verifies zero unresolved rows using DIFFERENT predicate from WHERE | Q6 (assertion shape — positive predicate; in-transaction throw), Pitfall 1 |
| MIG-05 | Migration is portable; clean prod push via `supabase db push --linked` (full closure) | Phase 79 ships scripts not migrations; closure = `--apply` against prod succeeds first time |
| DISP-03 | Every `watches.catalog_id`-linked row hydrates `brand` + `model` from canonical names | Q5 (hydration UPDATE FROM JOIN), D-79-08 |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Strict pre-flight gate (decisions file vs live catalog reconciliation) | Script (Node) | Database / Storage | Reads catalog + decisions file in-memory; compares; no DB writes |
| Idempotent re-run gate (`brand_id IS NULL` count) | Database / Storage | Script (Node) | One SELECT before the strict gate runs |
| Local-vs-prod connection detection | Script (Node) | — | Pure URL host-string parsing; no DB call |
| Interactive operator prompt | Script (Node) | Operator (human) | `readline/promises` from stdin; only on prod URL |
| Atomic apply (5 writes + 1 assert) | Database / Storage | Script (Node) | `sql.begin(async tx => ...)`; Postgres MVCC isolation |
| Brand INSERT (33 new rows) | Database / Storage | — | Per-brand INSERT statement (small N) |
| Catalog `brand_id` UPDATE | Database / Storage | — | Per-brand WHERE-clause UPDATE OR bulk JOIN UPDATE (both feasible; small N) |
| Family INSERT + alias append (UPDATE) | Database / Storage | — | Per-family INSERT; per-merge UPDATE with containment guard |
| Catalog `family_id` UPDATE | Database / Storage | — | Per-family WHERE-clause UPDATE |
| Watches display hydration | Database / Storage | — | Single bulk UPDATE FROM JOIN — unconditional, no WHERE filter beyond JOIN |
| Post-flight assertion | Database / Storage | Script (Node) | SELECT COUNT(*); script throws on mismatch — rollback inside `sql.begin` |
| `79-POST-DEPLOY.md` auto-generation | Script (Node) | Filesystem | Post-commit; written outside the transaction |
| Family decisions artifact generation (`--mode=families` dry-run) | Script (Node) | Database / Storage | New file `.planning/v8.4-family-merge-decisions.md`; refuse-to-overwrite |

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Apply Gating + Transaction Boundary:**
- **D-79-01: Strictest pre-flight gate.** Before any SQL write, script verifies decisions file(s) fully resolved AND match current catalog. Refuses on ANY: `needs-review` status, unknown token, `merge:<uuid>` pointing at non-existent row, OR catalog has `(brand)` / `(brand, model)` rows not in decisions file. No escape hatches; operator must `--regenerate`.
- **D-79-02: Confirmation pattern — silent local, interactive prod.** Script inspects active DATABASE_URL: local (`127.0.0.1:54322`) runs silently; prod prints summary block (N brands, N catalog rows, N families, N user watches, N aliases) and waits for `yes` at stdin.
- **D-79-03: Single atomic transaction wrapping all 5 writes + post-flight.** One BEGIN; 6 ordered steps; any failure rolls back the entire transaction.
- **D-79-04: Re-run safety via "already applied" detection.** Before strict gate, `SELECT count(*) FROM watches_catalog WHERE brand_id IS NULL OR family_id IS NULL`. If zero, print `Already applied — nothing to do.` and exit zero.

**Family Decisions Artifact + Script Topology:**
- **D-79-05: Same script, `--mode=brands|families|both` switch.** Default preserves Phase 78 brand-only dry-run. `--mode=families` reads `brand-merge-decisions.md` in-memory, emits `family-merge-decisions.md`. `--mode=both` (apply path) requires both files; runs atomic transaction.
- **D-79-06: Merge decisions auto-append source string to canonical family's `aliases`.** Operator `merge:<datejust-uuid>` → UPDATE catalog row's family_id + append `lower(trim('Brut Date'))` to that canonical family's aliases (idempotent — checks containment first).
- **D-79-07: Family dry-run reads brand decisions in-memory (Option 2 path).** No DB write dependency. Parses `brand-merge-decisions.md`, builds in-memory `brand_raw → canonical brand identity` map, scopes `(brand_raw, model_raw)` → canonical brand. Family file is already deduped BEFORE operator reads it.

**Watches Display Hydration:**
- **D-79-08: Write through every catalog-linked watch, no exceptions.** `UPDATE watches SET brand = b.name, model = f.name FROM brands b, watch_families f, watches_catalog c WHERE watches.catalog_id = c.id AND c.brand_id = b.id AND c.family_id = f.id`. Only `brand` + `model` touched.

**`new` Row Defaults + Audit Artifact:**
- **D-79-09: `new` brand/family rows default `needs_review = false`.** Operator marking row `new` IS the approval signal. Phase 82 queue empty by default. IWC + IWC Schaffhausen case handled by manual /admin/brands cleanup in Phase 82.
- **D-79-10: Full `79-POST-DEPLOY.md` auto-generated by script after successful apply.** Counts, post-flight assertion query+result, operator sign-off SQL checklist, forward-armor section. Mirrors Phase 78 pattern.

### Claude's Discretion
- Post-flight assertion phrasing: positive predicate (`IS DISTINCT FROM NULL`) different from UPDATE WHERE; planner picks precise SQL.
- Migration filename: NO new `.sql` migration in Phase 79 — `tsx --apply` script-only.
- In-memory brand-decision map: planner picks data structure.
- Local-first verification gate: MUST verify on local Supabase against seeded local catalog BEFORE prod push.
- Connection model: reuses D-78-06 (tsx + DATABASE_URL + service-role).

### Deferred Ideas (OUT OF SCOPE)
- Two-step prod sequencing (brand `--apply` → verify → family `--apply`) — rejected; single atomic transaction.
- Combined single review file (brands + families interleaved) — rejected; two separate files.
- `new!` / `new:review` extended grammar — rejected; grammar stays small; punt to Phase 82.
- Pre-apply rollback table (`watches_pre_v8_4_strings`) — rejected; atomic transaction + Supabase backup is the belt.
- Skip no-op writes during hydration — rejected per D-79-08.
- Filtering hydration by status — rejected; success criterion + DISP-03 say "every catalog-linked row."
- User-facing notification on display change — rejected; scope creep.
- `--apply --dry-sql` preview — rejected; summary counts + `yes` prompt + atomic transaction provide equivalent safety.

## Project Constraints (from CLAUDE.md)

| Directive | Enforcement in Phase 79 |
|-----------|-------------------------|
| **Local-First Development** — verify in `npm run dev` against local Supabase before push | Phase 79 is THE canonical case for this rule. Script must run end-to-end against local (`127.0.0.1:54322` per `.env.development.local`), post-flight must pass, hydrated watch text must reflect canonical names (Hamilton not Hamilton Watch) BEFORE first prod `--apply`. See Validation Architecture step #11 below. |
| **AGENTS.md — Next 16 has breaking changes** | N/A — Phase 79 is script/DB only; no app-router, no rendering. |
| **GSD Workflow Enforcement — no direct repo edits outside a GSD command** | Will be executed via `/gsd-execute-phase 79`. |
| **`workflow.use_worktrees: false`** (already set per `[[next-clear-operational-debt]]`) | Phase 79 is DB-touching; worktrees disabled. |
| **Local-first applies even to scripts that have no UI surface** | Schema-additions phase 78 codified the introspection-based local verification. Phase 79 extends this with a one-extra-step: re-query a hydrated user's watch text after `--apply` and confirm canonical strings. |

## Standard Stack

### Core (already in `package.json` — no new deps)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `postgres` | `^3.4.9` | Direct `postgres` lib client + `sql.begin()` transaction helper | Already used in `scripts/v8.4-brand-canonicalization.ts:248,61`; `sql.begin` proven in `scripts/repair-drizzle-journal.ts:172` |
| `tsx` | (devDep) | Run `.ts` scripts without compile step | Existing standard — every `scripts/*.ts` runs via `tsx`; npm script `db:v8.4-brand-canon` already defined |
| `node:fs/promises` | (built-in) | `readFile`, `writeFile`, `mkdir` for artifact I/O | Already used in `scripts/v8.4-brand-canonicalization.ts:59` |
| `node:readline/promises` | (built-in) | Interactive `yes` prompt on prod (D-79-02) | **NEW for Phase 79** — no current usage in repo; Node-built-in; zero dep cost |
| `node:url` (URL parser) | (built-in) | Parse `DATABASE_URL` host for local-vs-prod detection (D-79-02) | **NEW for Phase 79** — Node-built-in; precedent for host-string check is `scripts/import-prod-catalog.sh:39` (shell `case` on `127.0.0.1`) and `scripts/generate-explore-covers.ts:128` (regex `/127\.0\.0\.1\|localhost/`) |

### Supporting (existing Phase 78 helpers — extend in place)
| Function | Source | Use in Phase 79 |
|----------|--------|-----------------|
| `parseArgs` | `scripts/v8.4-brand-canonicalization.ts:91` | Extend signature: add `apply: boolean` and `mode: 'brands' \| 'families' \| 'both'` |
| `parseExistingPreserved` | `scripts/v8.4-brand-canonicalization.ts:155` | Reuse unchanged for family artifact parsing — operates on raw line text |
| `mergeForward` | `scripts/v8.4-brand-canonicalization.ts:179` | Reuse unchanged for family `--regenerate --mode=families` |
| `buildRow` / `buildTableRows` | `scripts/v8.4-brand-canonicalization.ts:114,138` | Reuse unchanged for family table emission |
| `formatCell` | `scripts/v8.4-brand-canonicalization.ts:103` | Reuse unchanged |
| `BrandRow` / `Candidate` types | `scripts/v8.4-brand-canonicalization.ts:75,81` | Reuse `Candidate`; add new `FamilyRow` type analogous to `BrandRow` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `sql.begin(async tx => ...)` callback | Manual `await sql\`BEGIN\`` / `COMMIT` / `ROLLBACK` | Manual is fragile — must wrap in try/catch + explicit rollback; `sql.begin` auto-rolls back on thrown error and auto-commits on resolution. Use `sql.begin`. |
| `node:readline/promises` interactive prompt | npm `inquirer` / `prompts` package | New dep for single-question prompt is overkill; `readline/promises` is built-in and adequate. Use `readline/promises`. |
| `new URL(connStr).hostname === '127.0.0.1'` host parse | Regex `/127\.0\.0\.1\|localhost/` on raw URL | `new URL` is the standards-compliant parser and more readable. Both work. Use `new URL`. |
| Single UPDATE FROM JOIN for hydration | Two separate UPDATEs (brand string, then model string) | Two UPDATEs double the row touches and double the trigger fires. One JOIN UPDATE is cleaner. Use the single JOIN form. |
| `array_append(aliases, $source)` | `aliases || ARRAY[$source]::text[]` | Both produce identical results; `||` operator is more idiomatic and reads cleaner inline. Use `||`. |
| DO `$$` ... RAISE EXCEPTION inside transaction | App-side `throw new Error(...)` from `tx.unsafe(...)` result | App-side throw is more flexible (can format error with counts, log structured data); DO `$$` keeps assertion in SQL but loses access to JS variables for the diagnostic. Use app-side throw inside the `sql.begin` callback. |
| Per-brand `UPDATE watches_catalog SET brand_id = $1 WHERE lower(trim(brand)) = $2` loop | Bulk `UPDATE watches_catalog SET brand_id = decisions.brand_id FROM (VALUES ...) decisions(brand_norm, brand_id) WHERE lower(trim(brand)) = decisions.brand_norm` | Per-brand loop is ~53 round-trips totaling <1s on 205 rows; bulk VALUES is one round-trip but harder to construct safely (need `sql.join` of parameterized VALUES). Loop is simpler and the perf difference is negligible at this scale. Use the loop. |

**Installation:** no new dependencies. (`readline/promises` and `node:url` are Node built-ins; no npm install.)

**Version verification:** dependencies unchanged from Phase 78 (`postgres@^3.4.9`, `tsx` devDep). `sql.begin` is documented for `postgres@^3.x` per the lib's public API.

## Architecture Patterns

### System Architecture Diagram

```
Operator                          scripts/v8.4-brand-canonicalization.ts (extended)
   │                                              │
   │ Phase 79 invocation flow:                    │
   │                                              │
   │ 1. tsx ... --mode=families   (dry-run)       │
   │ 2. (edit .planning/v8.4-family-merge-...md)  │
   │ 3. tsx ... --apply --mode=both               │
   │      (local first; then prod with `yes`)     │
   ▼                                              ▼

   ┌────────────────────────────────────────────────────────────────────┐
   │ STAGE 0: parseArgs + DATABASE_URL probe                            │
   │   - mode: brands | families | both                                 │
   │   - apply: bool                                                    │
   │   - isLocal := new URL(connStr).host === '127.0.0.1:54322'         │
   │   - Open postgres({prepare:false, max:1}); SET search_path         │
   └────────────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┴──────────────┐
                ▼                            ▼
     mode=families & !apply       mode=both & apply
     (Family dry-run path)        (Apply path)
                │                            │
                ▼                            ▼
   ┌──────────────────────┐      ┌──────────────────────────────────────┐
   │ Parse brand-md       │      │ STAGE 1: idempotent re-run gate      │
   │ in-memory.           │      │   SELECT count(*) FROM watches_      │
   │ Build:               │      │     catalog WHERE brand_id IS NULL   │
   │   Map<brand_norm,    │      │     OR family_id IS NULL             │
   │     ResolvedBrand>   │      │   If 0 → exit 0 "Already applied"    │
   │ (D-79-07)            │      └──────────────────────────────────────┘
   └──────────────────────┘                       │
                │                                 ▼
                ▼                  ┌──────────────────────────────────────┐
   ┌──────────────────────┐        │ STAGE 2: STRICTEST pre-flight gate   │
   │ Query DISTINCT       │        │   (D-79-01)                          │
   │ (brand_norm, model)  │        │   Parse brand-md + family-md.        │
   │ from catalog.        │        │   Verify:                            │
   │ For each, find       │        │     a) All rows have terminal status │
   │ canonical brand_id   │        │     b) merge:<uuid> targets exist    │
   │ via in-memory map.   │        │        in brands / families          │
   │ For unresolved:      │        │     c) Live catalog (brand,model)    │
   │ word_similarity      │        │        triples ALL present in        │
   │ candidates.          │        │        decisions files               │
   │ Refuse-to-overwrite  │        │   Refuse on ANY drift.               │
   │ + --regenerate.      │        └──────────────────────────────────────┘
   │ Write GFM table to   │                       │
   │ family-merge-...md   │                       ▼
   └──────────────────────┘        ┌──────────────────────────────────────┐
                │                  │ STAGE 3: D-79-02 confirm gate        │
                ▼                  │   if !isLocal:                       │
            (exit 0)               │     print summary counts             │
                                   │     read 'yes' from stdin            │
                                   │     else exit 1                      │
                                   └──────────────────────────────────────┘
                                                  │
                                                  ▼
                                   ┌──────────────────────────────────────┐
                                   │ STAGE 4: ATOMIC TRANSACTION          │
                                   │   (D-79-03) sql.begin(async tx => {  │
                                   │                                      │
                                   │   4.1 INSERT new brands              │
                                   │       (33 ops; needs_review=false)   │
                                   │                                      │
                                   │   4.2 UPDATE watches_catalog         │
                                   │       SET brand_id = $resolved       │
                                   │       (per-brand loop)               │
                                   │                                      │
                                   │   4.3 INSERT new watch_families      │
                                   │       (per family decisions; needs_  │
                                   │        review=false)                 │
                                   │                                      │
                                   │   4.4 UPDATE watch_families          │
                                   │       SET aliases = aliases ||       │
                                   │         ARRAY[$source]               │
                                   │       WHERE NOT (aliases @>          │
                                   │         ARRAY[$source])              │
                                   │       (per merge: decision)          │
                                   │                                      │
                                   │   4.5 UPDATE watches_catalog         │
                                   │       SET family_id = $resolved      │
                                   │       (per (brand,model) loop)       │
                                   │                                      │
                                   │   4.6 UPDATE watches w               │
                                   │       SET brand = b.name,            │
                                   │           model = f.name             │
                                   │       FROM watches_catalog c         │
                                   │       JOIN brands b ON c.brand_id=   │
                                   │           b.id                       │
                                   │       JOIN watch_families f ON       │
                                   │           c.family_id = f.id         │
                                   │       WHERE w.catalog_id = c.id      │
                                   │                                      │
                                   │   4.7 POST-FLIGHT ASSERTION (MIG-04) │
                                   │       SELECT                         │
                                   │         (SELECT count(*) FROM        │
                                   │           watches_catalog) AS total, │
                                   │         (SELECT count(*) FROM        │
                                   │           watches_catalog            │
                                   │           WHERE brand_id IS          │
                                   │           DISTINCT FROM NULL)        │
                                   │         AS resolved_brand,           │
                                   │         (... family ditto ...)       │
                                   │       if total <> resolved_*:        │
                                   │         throw new Error('MIG-04 ...')│
                                   │                                      │
                                   │   })  ← throws auto-trigger ROLLBACK │
                                   └──────────────────────────────────────┘
                                                  │
                                                  ▼ (commit)
                                   ┌──────────────────────────────────────┐
                                   │ STAGE 5: post-success artifact write │
                                   │   (D-79-10) Generate                 │
                                   │   .planning/phases/79-.../           │
                                   │     79-POST-DEPLOY.md                │
                                   │   - summary counts                   │
                                   │   - post-flight query + result       │
                                   │   - operator sign-off SQL checklist  │
                                   │   - "what this push does NOT do"     │
                                   └──────────────────────────────────────┘
                                                  │
                                                  ▼
                                            (exit 0; operator
                                             commits artifact)
```

### Recommended Project Structure (deltas only)
```
horlo/
├── scripts/
│   └── v8.4-brand-canonicalization.ts          # EDIT (extend Phase 78 in-place; D-79-05)
├── tests/
│   ├── unit/scripts/
│   │   ├── v8.4-family-build-decisions.test.ts # NEW (Wave 0 RED — in-memory chain D-79-07)
│   │   ├── v8.4-strict-gate.test.ts            # NEW (Wave 0 RED — D-79-01 gate cases)
│   │   ├── v8.4-host-detect.test.ts            # NEW (Wave 0 RED — D-79-02 local/prod)
│   │   └── v8.4-post-deploy-template.test.ts   # NEW (Wave 0 RED — D-79-10 artifact shape)
│   └── integration/scripts/
│       ├── v8.4-apply-atomic.test.ts           # NEW (Wave 0 RED — full apply against local
│       │                                       #       DB; covers MIG-02/03/04/05/DISP-03)
│       └── v8.4-apply-idempotent.test.ts       # NEW (Wave 0 RED — D-79-04 re-run gate)
└── .planning/
    ├── v8.4-family-merge-decisions.md          # GENERATED by --mode=families dry-run
    └── phases/79-backfill-migration-display-hydration/
        └── 79-POST-DEPLOY.md                   # GENERATED post-apply by --apply
```

### Pattern 1: postgres-lib Transactional Atomicity (sql.begin)

**What:** `sql.begin(async tx => { /* queries via tx`...` */ })` wraps queries in a single transaction. Throw inside the callback to trigger ROLLBACK; resolve to COMMIT. The `tx` parameter is the same template-literal interface as `sql`, but bound to the transaction.

**When to use:** Any multi-statement DB write where atomicity matters. Phase 79's 5 writes + 1 assertion is the canonical use case.

**Example:** (source: composition of `scripts/repair-drizzle-journal.ts:172-179` + postgres lib semantics)
```ts
// scripts/v8.4-brand-canonicalization.ts — apply path
import postgres from 'postgres'

const sql = postgres(connStr, { max: 1, prepare: false })

try {
  await sql.begin(async (tx) => {
    // Step 4.1 — INSERT new brands
    for (const newBrand of decisions.brands.filter(b => b.kind === 'new')) {
      await tx`
        INSERT INTO brands (name, slug, needs_review)
        VALUES (${newBrand.name}, ${slugify(newBrand.name)}, false)
      `
    }

    // Step 4.2 — UPDATE catalog brand_id
    for (const [brandNorm, resolved] of brandMap.entries()) {
      await tx`
        UPDATE watches_catalog
        SET brand_id = ${resolved.uuid}
        WHERE lower(trim(brand)) = ${brandNorm}
      `
    }

    // Step 4.3 — INSERT new families
    for (const newFamily of decisions.families.filter(f => f.kind === 'new')) {
      await tx`
        INSERT INTO watch_families (brand_id, name, needs_review, aliases)
        VALUES (${newFamily.brandId}, ${newFamily.name}, false, '{}')
      `
    }

    // Step 4.4 — UPDATE aliases idempotently (per merge: decision)
    for (const merge of decisions.families.filter(f => f.kind === 'merge')) {
      const sourceNorm = merge.sourceModelRaw.toLowerCase().trim()
      await tx`
        UPDATE watch_families
        SET aliases = aliases || ARRAY[${sourceNorm}]::text[]
        WHERE id = ${merge.targetUuid}
          AND NOT (aliases @> ARRAY[${sourceNorm}]::text[])
      `
    }

    // Step 4.5 — UPDATE catalog family_id (per (brand_norm, model_norm) loop)
    for (const [key, resolved] of familyMap.entries()) {
      const { brandNorm, modelNorm } = parseKey(key)
      await tx`
        UPDATE watches_catalog c
        SET family_id = ${resolved.uuid}
        FROM brands b
        WHERE c.brand_id = b.id
          AND b.name_normalized = ${brandNorm}
          AND c.model_normalized = ${modelNorm}
      `
    }

    // Step 4.6 — Hydrate watches.brand + .model (D-79-08)
    await tx`
      UPDATE watches w
      SET brand = b.name,
          model = f.name
      FROM watches_catalog c
      JOIN brands b ON c.brand_id = b.id
      JOIN watch_families f ON c.family_id = f.id
      WHERE w.catalog_id = c.id
    `

    // Step 4.7 — POST-FLIGHT ASSERTION (MIG-04)
    const [counts] = await tx<{
      total: string
      resolved_brand: string
      resolved_family: string
    }[]>`
      SELECT
        (SELECT count(*) FROM watches_catalog)::text AS total,
        (SELECT count(*) FROM watches_catalog
           WHERE brand_id IS DISTINCT FROM NULL)::text AS resolved_brand,
        (SELECT count(*) FROM watches_catalog
           WHERE family_id IS DISTINCT FROM NULL)::text AS resolved_family
    `
    const total = Number(counts.total)
    const resolvedBrand = Number(counts.resolved_brand)
    const resolvedFamily = Number(counts.resolved_family)
    if (resolvedBrand !== total || resolvedFamily !== total) {
      // Throwing inside sql.begin triggers ROLLBACK of the entire transaction.
      throw new Error(
        `MIG-04 post-flight assertion FAILED: ` +
        `total=${total}, resolved_brand=${resolvedBrand}, resolved_family=${resolvedFamily}. ` +
        `Rolling back.`,
      )
    }
  })

  // If we got here, the transaction COMMITTED.
  await writePostDeployArtifact(/* counts, query, result */)
  console.log('[v8.4-brand-canon] APPLIED + POST-DEPLOY artifact written.')
} finally {
  await sql.end({ timeout: 5 })
}
```

### Pattern 2: In-Memory Brand-Decision Map (D-79-07)

**What:** Parse the brand decisions file once, build a `Map` keyed by normalized brand_raw, share the map across the family dry-run path and the apply path.

**Recommended data shape:**
```ts
// scripts/v8.4-brand-canonicalization.ts — new types
export type ResolvedBrand =
  | { kind: 'existing'; uuid: string; canonicalName: string }
  | { kind: 'merge';    uuid: string; canonicalName: string }  // operator collapsed N raws onto 1 uuid
  | { kind: 'new';      syntheticKey: string; rawName: string } // placeholder until apply INSERTs the row

// Map: lower(trim(brand_raw)) → ResolvedBrand
export type BrandDecisionMap = Map<string, ResolvedBrand>

// During apply (after Step 4.1 INSERTs run), the 'new' synthetic_key entries are
// reified by querying back the freshly-inserted row's id and patching the map:
//   for (const [key, resolved] of brandMap.entries()) {
//     if (resolved.kind !== 'new') continue
//     const [row] = await tx`SELECT id FROM brands WHERE name = ${resolved.rawName}`
//     brandMap.set(key, { kind: 'existing', uuid: row.id, canonicalName: resolved.rawName })
//   }
// THEN proceed to Step 4.2 (catalog brand_id UPDATE).
```

**Family-side parallel:**
```ts
export type ResolvedFamily =
  | { kind: 'existing'; uuid: string; canonicalName: string }
  | { kind: 'merge';    uuid: string; canonicalName: string; sourceModelRaw: string }
  | { kind: 'new';      syntheticKey: string; rawName: string; brandUuid: string }

// Map key: `${brand_norm}|${model_norm}` (composite — families are brand-scoped per
// watch_families_brand_name_unique constraint)
export type FamilyDecisionMap = Map<string, ResolvedFamily>
```

**Why a Map (not a Record):**
- `Map.entries()` preserves insertion order — useful for deterministic INSERT ordering in tests.
- Key is `string` either way; `Map` API (`get`/`set`/`has`) reads cleaner than `obj[key]`.
- Iteration is `O(N)` either way.

### Pattern 3: Local-Host Detection (D-79-02)

**What:** Parse `DATABASE_URL` with `new URL()`; check `host` (includes port).

**Recommended:**
```ts
// scripts/v8.4-brand-canonicalization.ts — host detection
function isLocalDatabaseUrl(connStr: string): boolean {
  try {
    const url = new URL(connStr)
    // host = hostname + ':' + port. Local Supabase Postgres = 127.0.0.1:54322.
    // Defensive: also accept localhost:54322 (some setups).
    return (
      url.host === '127.0.0.1:54322' ||
      url.host === 'localhost:54322'
    )
  } catch {
    // Unparseable URL — fail closed (treat as prod → require confirmation).
    return false
  }
}
```

**Edge cases / fail-closed rationale:**
- If `DATABASE_URL` is missing → script already exits at Stage 0 (per existing `if (!connStr) process.exit(1)`).
- If `DATABASE_URL` parse throws → treat as prod (fail closed → require `yes` prompt).
- If operator runs script with a `127.0.0.1:54323`-style alt-port → not detected as local; will require `yes` prompt. Acceptable (safety bias).
- Supabase pooler URLs are `aws-X.pooler.supabase.com:6543` or `:5432` — never match `127.0.0.1`.

**Interactive prompt:**
```ts
// scripts/v8.4-brand-canonicalization.ts — prod confirmation prompt
import * as readline from 'node:readline/promises'

async function confirmProd(summary: {
  brandsToCreate: number
  catalogRowsToResolve: number
  familiesToCreate: number
  userWatchesToHydrate: number
  aliasesToAppend: number
}): Promise<boolean> {
  console.log(`
[v8.4-brand-canon] APPLY against PROD detected. Summary:
  - Brands to create:        ${summary.brandsToCreate}
  - Catalog rows to resolve: ${summary.catalogRowsToResolve}
  - Families to create:      ${summary.familiesToCreate}
  - User watches to hydrate: ${summary.userWatchesToHydrate}
  - Aliases to append:       ${summary.aliasesToAppend}
`)
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  try {
    const answer = await rl.question('Type "yes" to proceed: ')
    return answer.trim() === 'yes'
  } finally {
    rl.close()
  }
}
```

### Pattern 4: Idempotent Alias Append (D-79-06)

**What:** UPDATE that no-ops if the alias is already present.

**Recommended:**
```sql
-- inside sql.begin transaction
UPDATE watch_families
SET aliases = aliases || ARRAY[$source_norm]::text[]
WHERE id = $target_uuid
  AND NOT (aliases @> ARRAY[$source_norm]::text[])
```

**Why this form:**
- `||` is the array concatenation operator — idiomatic, identical-behavior to `array_append`.
- `@>` is GIN-index-friendly (we built the index in Phase 78); the WHERE-clause containment check leverages it.
- The `NOT (... @> ...)` predicate is the idempotency gate — re-running the same apply is a no-op.
- The `::text[]` cast on the literal is defensive — `postgres` lib parameter binding for `${source_norm}` produces a `text` value; constructing `ARRAY[$1]` would be inferred as `text[]` anyway, but the explicit cast removes ambiguity.

**Alternative `array_append` form:** `aliases = array_append(aliases, $source_norm)` — semantically identical; chose `||` for readability.

### Pattern 5: Hydration UPDATE FROM JOIN (D-79-08)

**What:** Single UPDATE that JOINs `watches_catalog → brands` and `→ watch_families`; sets `watches.brand` and `watches.model`.

**Recommended SQL:**
```sql
-- inside sql.begin transaction
UPDATE watches w
SET brand = b.name,
    model = f.name
FROM watches_catalog c
JOIN brands b ON c.brand_id = b.id
JOIN watch_families f ON c.family_id = f.id
WHERE w.catalog_id = c.id
```

**Why the JOIN form over CONTEXT's preview:**

CONTEXT.md L53 sketches the SQL as `FROM brands b, watch_families f, watches_catalog c WHERE ...` (cross-join + WHERE). That form is correct but reads less clearly than the explicit JOINs. The explicit JOIN form:
- Makes the join order + condition explicit (better for diff review).
- Postgres planner produces identical execution plans for both.
- Naturally handles `watches.catalog_id IS NULL` rows — they don't match `w.catalog_id = c.id` and are skipped.

**Per `[[drizzle-sql-any-array-pitfall]]` audit:** this UPDATE has NO arrays in template-literal interpolations — no `= ANY(${arr})`, no array spreading. Safe.

**Per `[[catalog-id-divergence]]`:** this UPDATE works correctly on both envs because it operates by JOIN-through-FK, not by hardcoded catalog UUIDs. Local + prod will both produce correct hydration even though their `watches_catalog.id` values differ.

**Why no WHERE-clause filter on stored brand text:** D-79-08 — write through every catalog-linked row unconditionally. The CONTEXT.md decision is explicit; the simpler SQL is worth the trivial DB churn.

### Pattern 6: Post-Flight Assertion with Predicate Divergence (MIG-04)

**What:** SELECT both totals + resolved counts using a POSITIVE predicate (`IS DISTINCT FROM NULL`); compare in JS; throw if mismatch.

**Recommended:**
```ts
// inside sql.begin transaction — Step 4.7
const [counts] = await tx<{
  total: string
  resolved_brand: string
  resolved_family: string
}[]>`
  SELECT
    (SELECT count(*) FROM watches_catalog)::text AS total,
    (SELECT count(*) FROM watches_catalog
       WHERE brand_id IS DISTINCT FROM NULL)::text AS resolved_brand,
    (SELECT count(*) FROM watches_catalog
       WHERE family_id IS DISTINCT FROM NULL)::text AS resolved_family
`
const total = Number(counts.total)
const resolvedBrand = Number(counts.resolved_brand)
const resolvedFamily = Number(counts.resolved_family)
if (resolvedBrand !== total || resolvedFamily !== total) {
  throw new Error(
    `MIG-04 post-flight assertion FAILED: ` +
    `total=${total} resolved_brand=${resolvedBrand} resolved_family=${resolvedFamily}. ` +
    `Rolling back the entire transaction.`,
  )
}
```

**Why this satisfies `[[post-flight-assertion-predicate-divergence]]`:**
- The UPDATEs in Steps 4.2 + 4.5 use `WHERE lower(trim(brand)) = ...` (positive equality) but NEVER use `WHERE brand_id IS NULL` — the script doesn't predicate UPDATEs on the absence of a value, it predicates on the brand string match. So the assertion's `IS DISTINCT FROM NULL` is divergent from the UPDATE's WHERE in form AND in semantics.
- **Why NOT `count(*) WHERE brand_id IS NULL = 0`:** that form trivially passes when the prior UPDATE was a no-op for the SAME reason the UPDATE itself was a no-op. The positive form (`IS DISTINCT FROM NULL = total`) requires the resolution to actually have happened.
- Throwing inside `sql.begin` → ROLLBACK of all 6 steps. Database returns to pre-apply state. Operator sees a clear error message with the counts.

**Why JS-side throw instead of DO `$$` ... RAISE EXCEPTION:**
- Easier to format diagnostic with formatted counts.
- Easier to test in unit tests (mock `tx` and assert on thrown error).
- Same rollback semantics.

### Anti-Patterns to Avoid

- **Don't put any DB write outside the `sql.begin` callback.** All 5 writes + assertion belong inside. If any single write happens outside, atomicity is broken (the broken write commits independently).
- **Don't use `WHERE brand_id IS NULL` in the post-flight assertion.** Per `[[post-flight-assertion-predicate-divergence]]` (root memory: quick-260620-gk9). Use `WHERE brand_id IS DISTINCT FROM NULL`.
- **Don't use `sql\`= ANY(${arr})\`` anywhere.** Per `[[drizzle-sql-any-array-pitfall]]`. The Phase 79 script's queries don't naturally require IN-lists (per-row loops are sufficient), so this should be easy to avoid. **Forward armor:** if a planner-task action says "use `ANY(arr)`," reject it and substitute `IN (sql.join(arr.map(v => sql\`${v}\`), sql\`, \`))` per established pattern.
- **Don't hardcode UUIDs from local in any path that touches prod.** Per `[[catalog-id-divergence]]`. The script must re-resolve every brand/family decision via `(brand_norm, model_norm)` natural keys at apply time, fresh per environment. The brand-merge-decisions.md operator-edited UUIDs in `merge:<uuid>` cells ARE prod UUIDs (since the file was generated from prod by the dry-run — verifiable: Phase 78's prod push happened 2026-06-24 and Tyler ran the dry-run against prod afterwards). These UUIDs MUST exist in prod's `brands` table; the strict gate verifies this.
- **Don't auto-commit the artifact file from the script.** The script WRITES `79-POST-DEPLOY.md`; operator commits via git after reviewing.
- **Don't run prod apply without local-first verification.** Per `[[local-first-dev]]`. The Hamilton merge is the canonical end-to-end test.
- **Don't skip the `SET search_path` line at the top of the connection.** Phase 78 R-FIND-02; required so family dry-run's `word_similarity` resolves regardless of env. Already in `scripts/v8.4-brand-canonicalization.ts:258`; carry forward.
- **Don't INSERT brands with `needs_review = true` for operator-marked `new` rows.** D-79-09. The operator marking the row `new` IS the approval signal.
- **Don't write to the database during the family dry-run.** D-79-05 — `--mode=families` without `--apply` is read-only (mirror Phase 78 D-78-05). Verifies via the same snapshot pattern as `tests/integration/scripts/v8.4-readonly.test.ts`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Transaction lifecycle (BEGIN/COMMIT/ROLLBACK) | Manual `await sql\`BEGIN\`` + try/catch + explicit rollback | `await sql.begin(async tx => ...)` | Auto-rollback on throw; auto-commit on resolution; one round-trip for both endpoints; precedent in `repair-drizzle-journal.ts:172` |
| URL host parsing | Regex on raw `DATABASE_URL` string | `new URL(connStr).host` | Standards-compliant; handles user:pass@host:port reliably |
| Interactive prompt | npm `inquirer` / `prompts` | `node:readline/promises` | Built-in; one question is all we need |
| Markdown emission | Markdown library | String-array `join('\n')` | Already the project pattern (inventory-explore-catalog.ts, Phase 78 buildTableRows) |
| GFM table parsing (family decisions file) | `remark` + `remark-gfm` | Reuse Phase 78's `parseExistingPreserved` (operates on raw line text) | Already exported, already tested |
| Slug generation for new brands | npm `slugify` | Hand-rolled `toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-\|-$/g, '')` | Brands table already has 53 rows with slugs; the function is ~3 LOC; matches established slug shape via grep `\\bslug\\b` |
| Diacritic folding for `word_similarity` in family dry-run | Custom JS normalize loop | `public.f_unaccent(text)` from quick-260623-uua | Already IMMUTABLE-pinned + index-backed |
| Per-row alias containment guard | Hand-roll a SELECT before UPDATE | `WHERE NOT (aliases @> ARRAY[$x]::text[])` in the UPDATE | Atomic; single round-trip; uses the GIN index Phase 78 shipped |
| Hydration WHERE-clause optimization (skip no-op writes) | Conditional UPDATE that checks if stored brand already matches canonical | Unconditional UPDATE per D-79-08 | Saves nothing operationally; adds WHERE that needs post-flight predicate divergence considerations |

**Key insight:** Phase 79 introduces ZERO new dependencies. Every primitive is either already in the script (parse + emit), in the postgres lib (`sql.begin`), or in Node built-ins (`readline/promises`, `URL`). The work is composition and atomicity, not invention.

## Runtime State Inventory

> Phase 79 is a data-migration phase touching schema columns shipped in Phase 78 + the existing `watches_catalog`, `brands`, `watch_families`, `watches` tables. It IS a write phase but does NOT rename any string in the codebase. The inventory below verifies no runtime state is left referencing pre-apply values.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `watches.brand` + `watches.model` text columns ARE rewritten by the hydration step (this is intentional per D-79-08; not a "rename" per se, just a canonicalization). All existing rows have their text overwritten with canonical names from `brands.name` / `watch_families.name`. | The hydration IS the action. No additional migration needed. |
| Live service config | None — n8n / Datadog / Tailscale don't reference Horlo brand/family strings | None |
| OS-registered state | None — no Task Scheduler / pm2 / launchd embeds these | None |
| Secrets / env vars | None new — script uses existing `DATABASE_URL` from `.env.local` (local default) or shell override (prod) | None |
| Build artifacts | None — Phase 79 ships no schema changes, so `drizzle-kit push` is not needed. `npm run build` artifacts in `.next/` will pick up canonical text on next SSR render of any user's collection (no cache invalidation required because rendered text comes from DB at request time per `await connection()` patterns on user-personalized routes) | None — `.next/` is content-hashed; no manual purge |
| Recommender exclusion-key cache | The home rail uses `watches_catalog.brand_id` JOIN-through after Phase 81. **Phase 79 hydrates `watches.brand` text but does NOT update the JOIN-through query path** — Phase 81 owns that swap. The Phase 79 hydration ensures the displayed text matches the eventual JOIN target. | None for Phase 79; flagged as Phase 81 dependency |

**Stored data carries through:** the existing `watches_catalog.id` values, `watches.id` values, FK targets — all UNCHANGED. Phase 79 ADDS resolved brand_id + family_id; it does NOT delete or replace any existing row. The hydration overwrites text columns; no row identity changes. `[[catalog-id-divergence]]` does not bite because the apply re-resolves natural keys per env.

## Common Pitfalls

### Pitfall 1: Post-flight assertion mirrors the operation's predicate
**What goes wrong:** Per `[[post-flight-assertion-predicate-divergence]]` (root: quick-260620-gk9 incident). If the assertion is `count(*) WHERE brand_id IS NULL = 0` and the UPDATE was a no-op (e.g. the WHERE clause matched zero rows due to a bug), the assertion trivially passes — both conditions inherit the same bug.
**Why it happens:** Symmetry feels right when authoring the assertion ("undo the UPDATE's WHERE"). It's a trap.
**How to avoid:** Phrase as POSITIVE predicate: `count(*) WHERE brand_id IS DISTINCT FROM NULL = (SELECT count(*) FROM watches_catalog)`. The assertion has to PROVE the post-state, not the absence of the pre-state.
**Warning signs:** Assertion uses the SAME `WHERE brand_id IS NULL` clause as the UPDATE. That's a smell. The assertion should look STRUCTURALLY DIFFERENT from any UPDATE/DELETE in the same transaction.

### Pitfall 2: `sql.begin` doesn't auto-rollback on a `process.exit()` mid-callback
**What goes wrong:** Some scripts `process.exit(1)` on error rather than `throw`. Inside a `sql.begin` callback, `process.exit` skips the transaction lifecycle — the connection is yanked, and the server-side transaction may HANG (until Postgres timeout) or commit partially (it shouldn't, but the connection death + server-side timeout is the safety net rather than the transaction protocol).
**Why it happens:** Mixing exit conventions inside an async callback.
**How to avoid:** Inside the `sql.begin` callback, ONLY use `throw new Error(...)` for failures. `sql.begin` catches the throw, sends ROLLBACK, then re-throws to the caller. The caller's outer try/catch handles `process.exit(1)` after rollback.
**Warning signs:** `process.exit` inside `sql.begin`. Should be flagged in code review.

### Pitfall 3: New brand `INSERT` runs before catalog `UPDATE` references its `id`
**What goes wrong:** Step 4.2 (catalog UPDATE) needs the `brand_id` from Step 4.1 (brand INSERT). If the script's in-memory map still holds `kind: 'new'` synthetic placeholders, the UPDATE has no UUID to set.
**Why it happens:** Mental gap between "operator-decided" map state and "post-INSERT" map state.
**How to avoid:** After Step 4.1, IMMEDIATELY re-query the freshly inserted brand rows (`SELECT id, name FROM brands WHERE name = ANY(...)`) and PATCH the in-memory map's `'new'` entries to `'existing'` with the real UUID. THEN proceed to Step 4.2. Or, use `INSERT ... RETURNING id, name` to capture UUIDs in one round-trip.
**Warning signs:** Step 4.2 fires with `brand_id = undefined` → Postgres receives NULL → catalog row's `brand_id` is NULL → post-flight assertion catches it → rollback. The pitfall is caught by the assertion, but the diagnostic is "row count off" rather than "you forgot to patch the map." Add an in-script invariant check before Step 4.2: `for (const v of brandMap.values()) if (v.kind === 'new') throw new Error('brandMap not reified')`.

### Pitfall 4: Family resolution requires brand_id already populated on the catalog row
**What goes wrong:** Step 4.5 (catalog family_id UPDATE) joins `watches_catalog → brands` to scope the family lookup by brand. If Step 4.2 (brand_id UPDATE) hasn't completed, the JOIN finds no matching brand and the UPDATE is a no-op.
**Why it happens:** Step ordering must be brand-first, family-second.
**How to avoid:** The 6-step ordering in the diagram + Pattern 1 is CORRECT — brand resolution before family resolution. Don't reorder. The order is also the reason atomicity matters: if family resolution ran before brand resolution and only the family step failed, we'd have brand_id populated but family_id NULL → broken intermediate state.
**Warning signs:** Family UPDATE produces "0 rows updated" reports. Likely cause: brand UPDATE ran but family UPDATE's WHERE-clause expects brand_id to be set on the same catalog row.

### Pitfall 5: Hydration UPDATE with watches that have NULL catalog_id (post-Phase-17 cleanup edge case)
**What goes wrong:** `watches.catalog_id` is `NOT NULL` per Phase 38 (schema.ts L154), but `ON DELETE SET NULL` per Phase 17 D-04. So in practice the column CAN go NULL if a catalog row was later deleted. The hydration UPDATE's JOIN naturally skips these rows (no match on `c.id`), but the planner might worry they're orphaned.
**Why it happens:** Schema constraint + ON DELETE behavior creates a "NOT NULL at insert; can become NULL later" window.
**How to avoid:** The JOIN form handles this correctly — orphaned watches don't get hydrated (because there's no canonical brand/family to resolve through). Document in `79-POST-DEPLOY.md` that "watches with NULL catalog_id are skipped by design (orphaned from catalog deletion)." Add a Stage 1 (idempotent gate) co-query: `SELECT count(*) FROM watches WHERE catalog_id IS NULL`; if non-zero, log warning but do NOT block.
**Warning signs:** `watches_to_hydrate` count in POST-DEPLOY < `(SELECT count(*) FROM watches)`. Investigate the gap; it's expected to be the orphaned-catalog-id count, but verify.

### Pitfall 6: `merge:<uuid>` decision points at a brand_id that was deleted between dry-run and apply
**What goes wrong:** Operator approves `merge:abc-123` based on a `brand-merge-decisions.md` generated by the dry-run. Between then and apply, the row at `brands.id = abc-123` is deleted (operator action via admin or DB editor). The Step 4.2 UPDATE sets `brand_id = abc-123` on catalog rows → FK violation on the `ON DELETE RESTRICT` → transaction aborts.
**Why it happens:** Time-gap between operator-decided file and apply.
**How to avoid:** D-79-01 strict gate verifies `merge:<uuid>` targets exist BEFORE the transaction opens. The verification: `SELECT id FROM brands WHERE id = $1` for each `merge:<uuid>` cell; refuse to apply if any is missing.
**Warning signs:** Strict gate failure with "merge:<uuid> target not found" — operator must edit the file (new `merge:<other-uuid>` or `new`) and re-run.

### Pitfall 7: Operator runs `--apply --mode=brands` only (skipping families) by mistake
**What goes wrong:** The script supports `--mode=brands|families|both`. If the operator runs `--apply --mode=brands`, brands resolve but families don't. Post-flight assertion catches this (`resolved_family !== total`) → rollback. Net effect: nothing changes, operator sees "MIG-04 post-flight FAILED."
**Why it happens:** Ambiguity around which mode is the apply mode.
**How to avoid:** Document explicitly that `--apply` REQUIRES `--mode=both`. Add an early check: `if (args.apply && args.mode !== 'both') { console.error('--apply requires --mode=both'); process.exit(1) }`. Document in script header + README.
**Warning signs:** Operator confused by "post-flight failed" when nothing seemingly broke.

### Pitfall 8: Local seed lacks Brut Date / Héron Watches drift cases
**What goes wrong:** The CONTEXT references `Brut Date → Brut Datejust` as the canonical FAMILY merge/alias test. Confirmed via `grep`: `Brut`, `Heron`, `Héron` are NOT in `supabase/seed.sql` OR `scripts/seed-data/*.json`. The local catalog is populated by `scripts/import-prod-catalog.sh` (prod mirror) — so it inherits whatever drift prod has. Hamilton/Hamilton Watch is in local seed.sql AND in prod (via the imported catalog).
**Why it happens:** Local seed is a subset of prod-imported data; not all SEED-021 cases were authored as fixtures.
**How to avoid:** Local end-to-end test is the Hamilton/Hamilton Watch merge (present). Brut Date alias-append + Héron Watches case are exercised by UNIT TESTS against fixtures (existing `tests/unit/scripts/v8.4-seed021-golden.test.ts` already uses fixture rows for Brut Date and Héron Watches — extend with family-level fixtures in Phase 79's Wave 0). Optional: Plan 01 Wave 0 task to add a `Brut Datejust` family row to `supabase/seed.sql` for live-DB confidence.
**Warning signs:** "I want to confirm the alias append on prod data" — must rely on UNIT-TEST fixture coverage + post-prod verification (POST-DEPLOY query #4: `SELECT name, aliases FROM watch_families WHERE 'brut date' = ANY(aliases)`).

## Code Examples

### Atomic Apply Skeleton (Full 6-Step Transaction)

```ts
// scripts/v8.4-brand-canonicalization.ts — apply path skeleton
// Source: composition of Phase 78 script + repair-drizzle-journal.ts:172 + this RESEARCH Pattern 1

async function applyPath(
  sql: postgres.Sql,
  brandMap: BrandDecisionMap,
  familyMap: FamilyDecisionMap,
  decisions: { brands: BrandDecision[]; families: FamilyDecision[] },
): Promise<{ counts: ApplyCounts; postFlightQuery: string; postFlightResult: { total: number; resolvedBrand: number; resolvedFamily: number } }> {
  let counts!: ApplyCounts
  let postFlightResult!: { total: number; resolvedBrand: number; resolvedFamily: number }

  await sql.begin(async (tx) => {
    // 4.1 — INSERT new brands; reify map entries
    let brandsCreated = 0
    for (const newBrand of decisions.brands.filter(b => b.kind === 'new')) {
      const [row] = await tx<{ id: string }[]>`
        INSERT INTO brands (name, slug, needs_review)
        VALUES (${newBrand.name}, ${slugify(newBrand.name)}, false)
        RETURNING id
      `
      brandMap.set(
        newBrand.brandRawNormalized,
        { kind: 'existing', uuid: row.id, canonicalName: newBrand.name },
      )
      brandsCreated++
    }
    // Invariant: every map entry is 'existing' or 'merge' (both have a UUID).
    for (const v of brandMap.values()) {
      if (v.kind === 'new') {
        throw new Error('brandMap not reified after Step 4.1')
      }
    }

    // 4.2 — UPDATE watches_catalog.brand_id
    let catalogRowsResolvedBrand = 0
    for (const [brandNorm, resolved] of brandMap.entries()) {
      const result = await tx`
        UPDATE watches_catalog
        SET brand_id = ${resolved.uuid}
        WHERE lower(trim(brand)) = ${brandNorm}
          AND (brand_id IS NULL OR brand_id <> ${resolved.uuid})
      `
      catalogRowsResolvedBrand += result.count
    }

    // 4.3 — INSERT new families; reify family map entries
    let familiesCreated = 0
    for (const newFamily of decisions.families.filter(f => f.kind === 'new')) {
      const [row] = await tx<{ id: string }[]>`
        INSERT INTO watch_families (brand_id, name, needs_review, aliases)
        VALUES (${newFamily.brandUuid}, ${newFamily.name}, false, '{}'::text[])
        RETURNING id
      `
      familyMap.set(newFamily.compositeKey, {
        kind: 'existing',
        uuid: row.id,
        canonicalName: newFamily.name,
      })
      familiesCreated++
    }

    // 4.4 — UPDATE aliases idempotently (per merge: decision)
    let aliasesAppended = 0
    for (const merge of decisions.families.filter(f => f.kind === 'merge')) {
      const sourceNorm = merge.sourceModelRaw.toLowerCase().trim()
      const result = await tx`
        UPDATE watch_families
        SET aliases = aliases || ARRAY[${sourceNorm}]::text[]
        WHERE id = ${merge.targetUuid}
          AND NOT (aliases @> ARRAY[${sourceNorm}]::text[])
      `
      aliasesAppended += result.count
    }

    // 4.5 — UPDATE watches_catalog.family_id (per (brand_norm, model_norm) loop)
    let catalogRowsResolvedFamily = 0
    for (const [key, resolved] of familyMap.entries()) {
      const { brandNorm, modelNorm } = parseCompositeKey(key)
      const result = await tx`
        UPDATE watches_catalog c
        SET family_id = ${resolved.uuid}
        FROM brands b
        WHERE c.brand_id = b.id
          AND b.name_normalized = ${brandNorm}
          AND c.model_normalized = ${modelNorm}
          AND (c.family_id IS NULL OR c.family_id <> ${resolved.uuid})
      `
      catalogRowsResolvedFamily += result.count
    }

    // 4.6 — Hydrate watches.brand + .model (D-79-08; DISP-03)
    const hydrationResult = await tx`
      UPDATE watches w
      SET brand = b.name,
          model = f.name
      FROM watches_catalog c
      JOIN brands b ON c.brand_id = b.id
      JOIN watch_families f ON c.family_id = f.id
      WHERE w.catalog_id = c.id
    `
    const userWatchesHydrated = hydrationResult.count

    // 4.7 — POST-FLIGHT ASSERTION (MIG-04 / D-79 Claude's Discretion)
    const [pf] = await tx<{
      total: string; resolved_brand: string; resolved_family: string
    }[]>`
      SELECT
        (SELECT count(*) FROM watches_catalog)::text AS total,
        (SELECT count(*) FROM watches_catalog
           WHERE brand_id IS DISTINCT FROM NULL)::text AS resolved_brand,
        (SELECT count(*) FROM watches_catalog
           WHERE family_id IS DISTINCT FROM NULL)::text AS resolved_family
    `
    const total = Number(pf.total)
    const resolvedBrand = Number(pf.resolved_brand)
    const resolvedFamily = Number(pf.resolved_family)
    postFlightResult = { total, resolvedBrand, resolvedFamily }
    if (resolvedBrand !== total || resolvedFamily !== total) {
      throw new Error(
        `MIG-04 post-flight assertion FAILED: ` +
        `total=${total} resolved_brand=${resolvedBrand} resolved_family=${resolvedFamily}. ` +
        `Rolling back the entire transaction.`,
      )
    }

    counts = {
      brandsCreated,
      catalogRowsResolvedBrand,
      familiesCreated,
      aliasesAppended,
      catalogRowsResolvedFamily,
      userWatchesHydrated,
    }
  })

  return {
    counts,
    postFlightQuery: `SELECT
  (SELECT count(*) FROM watches_catalog) AS total,
  (SELECT count(*) FROM watches_catalog WHERE brand_id IS DISTINCT FROM NULL) AS resolved_brand,
  (SELECT count(*) FROM watches_catalog WHERE family_id IS DISTINCT FROM NULL) AS resolved_family;`,
    postFlightResult,
  }
}
```

### Local-Host Detection + Prod Confirmation Prompt

```ts
// scripts/v8.4-brand-canonicalization.ts — Stage 3 confirm gate
import * as readline from 'node:readline/promises'

function isLocalDatabaseUrl(connStr: string): boolean {
  try {
    const url = new URL(connStr)
    return url.host === '127.0.0.1:54322' || url.host === 'localhost:54322'
  } catch {
    return false  // unparseable URL — fail closed (treat as prod)
  }
}

async function confirmIfProd(connStr: string, summary: ApplySummary): Promise<void> {
  if (isLocalDatabaseUrl(connStr)) return  // D-79-02: silent local
  // D-79-02: interactive prod
  console.log(`
[v8.4-brand-canon] APPLY against PROD detected (${new URL(connStr).host}). Summary:
  - Brands to create:        ${summary.brandsToCreate}
  - Catalog rows to resolve: ${summary.catalogRowsToResolve}
  - Families to create:      ${summary.familiesToCreate}
  - User watches to hydrate: ${summary.userWatchesToHydrate}
  - Aliases to append:       ${summary.aliasesToAppend}
`)
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  try {
    const answer = await rl.question('Type "yes" to proceed: ')
    if (answer.trim() !== 'yes') {
      console.error('[v8.4-brand-canon] Operator declined. Exiting without write.')
      process.exit(1)
    }
  } finally {
    rl.close()
  }
}
```

### Strict Pre-Flight Gate (D-79-01)

```ts
// scripts/v8.4-brand-canonicalization.ts — Stage 2 strict gate
async function strictPreflightGate(
  sql: postgres.Sql,
  brandFile: string,
  familyFile: string,
): Promise<{ brandMap: BrandDecisionMap; familyMap: FamilyDecisionMap; summary: ApplySummary }> {
  const brandContent = await readFile(brandFile, 'utf8')
  const familyContent = await readFile(familyFile, 'utf8')

  const brandRows = parseDecisionsTable(brandContent)
  const familyRows = parseDecisionsTable(familyContent)

  // (a) All rows have terminal status (no `needs-review`, no unknown)
  const VALID_BRAND_STATUSES = new Set(['auto-resolved', 'new', 'skip'])
  const MERGE_RE = /^merge:[0-9a-f-]{36}$/i
  for (const row of [...brandRows, ...familyRows]) {
    if (!VALID_BRAND_STATUSES.has(row.status) && !MERGE_RE.test(row.status)) {
      throw new Error(
        `STRICT GATE: row "${row.brandRaw}" has unresolved status "${row.status}". ` +
        `Re-run --regenerate, edit needs-review rows to a terminal status, then re-try --apply.`,
      )
    }
  }

  // (b) merge:<uuid> targets exist
  const brandMergeUuids = brandRows
    .filter(r => MERGE_RE.test(r.status))
    .map(r => r.status.replace(/^merge:/i, ''))
  if (brandMergeUuids.length > 0) {
    const existing = await sql<{ id: string }[]>`
      SELECT id FROM brands WHERE id IN ${sql(brandMergeUuids)}
    `
    const existingSet = new Set(existing.map(r => r.id))
    for (const uuid of brandMergeUuids) {
      if (!existingSet.has(uuid)) {
        throw new Error(
          `STRICT GATE: merge:${uuid} target not found in brands table. ` +
          `Edit decision file to point at a valid brand id, or change to 'new'.`,
        )
      }
    }
  }
  // (... analogous for family merge UUIDs against watch_families ...)

  // (c) Live catalog has no (brand) / (brand, model) NOT in decisions
  const liveBrands = await sql<{ brand_normalized: string }[]>`
    SELECT DISTINCT lower(trim(brand)) AS brand_normalized FROM watches_catalog
  `
  const decidedBrands = new Set(brandRows.map(r => r.brandRaw.toLowerCase().trim()))
  for (const live of liveBrands) {
    if (!decidedBrands.has(live.brand_normalized)) {
      throw new Error(
        `STRICT GATE: catalog has brand "${live.brand_normalized}" not present in decisions file. ` +
        `Re-run --regenerate to merge-forward, edit the new row, then re-try --apply.`,
      )
    }
  }
  // (... analogous for (brand, model) triples in family decisions ...)

  // Build maps + summary
  const brandMap = buildBrandMap(brandRows)
  const familyMap = buildFamilyMap(familyRows, brandMap)
  const summary = await computeSummary(sql, brandMap, familyMap)
  return { brandMap, familyMap, summary }
}
```

### Idempotent Re-Run Gate (D-79-04)

```ts
// scripts/v8.4-brand-canonicalization.ts — Stage 1 idempotent gate
async function idempotentGate(sql: postgres.Sql): Promise<'already-applied' | 'proceed'> {
  const [row] = await sql<{ count: string }[]>`
    SELECT count(*)::text AS count
    FROM watches_catalog
    WHERE brand_id IS NULL OR family_id IS NULL
  `
  if (Number(row.count) === 0) {
    console.log('[v8.4-brand-canon] Already applied — nothing to do. Exiting.')
    return 'already-applied'
  }
  return 'proceed'
}
```

### `79-POST-DEPLOY.md` Auto-Generation (D-79-10)

```ts
// scripts/v8.4-brand-canonicalization.ts — Stage 5 artifact writer
async function writePostDeployArtifact(args: {
  counts: ApplyCounts
  postFlightQuery: string
  postFlightResult: { total: number; resolvedBrand: number; resolvedFamily: number }
  isLocal: boolean
}): Promise<void> {
  const today = new Date().toISOString().slice(0, 10)
  const target = args.isLocal ? 'LOCAL' : 'PROD'
  const content = `# Phase 79 — ${target} Deployment Record

**Date:** ${today}
**Operator:** {operator-name-here}
**Status:** Pending verification → fill in after operator runs sign-off queries
**Script:** scripts/v8.4-brand-canonicalization.ts --apply --mode=both

---

## Apply Summary

| Step | Count |
|------|-------|
| Brands created (new rows) | ${args.counts.brandsCreated} |
| Catalog rows resolved (brand_id) | ${args.counts.catalogRowsResolvedBrand} |
| Families created (new rows) | ${args.counts.familiesCreated} |
| Aliases appended (merge decisions) | ${args.counts.aliasesAppended} |
| Catalog rows resolved (family_id) | ${args.counts.catalogRowsResolvedFamily} |
| User watches hydrated (brand+model overwritten) | ${args.counts.userWatchesHydrated} |

## Post-Flight Assertion (MIG-04)

\`\`\`sql
${args.postFlightQuery}
\`\`\`

**Result:**
- total: ${args.postFlightResult.total}
- resolved_brand: ${args.postFlightResult.resolvedBrand}
- resolved_family: ${args.postFlightResult.resolvedFamily}

✅ Both resolved counts equal total → zero unresolved rows (assertion held inside transaction).

---

## Operator Sign-Off Queries (paste into Supabase SQL editor)

### 1. Zero NULL brand_id or family_id on catalog
\`\`\`sql
SELECT
  (SELECT count(*) FROM watches_catalog WHERE brand_id IS NULL) AS brand_null,
  (SELECT count(*) FROM watches_catalog WHERE family_id IS NULL) AS family_null;
\`\`\`
Expected: \`0 | 0\`

### 2. Hamilton merge collapsed correctly
\`\`\`sql
SELECT
  count(*) AS rows_pointing_at_canonical_hamilton
FROM watches_catalog
WHERE brand_id = '20969364-f3b1-4b1d-ab2f-e5d22e9ffabc';
\`\`\`
Expected: ≥ (the count of catalog rows where lower(trim(brand)) IN ('hamilton', 'hamilton watch')).

### 3. New brand row count matches decisions file
\`\`\`sql
SELECT count(*) AS new_brand_count
FROM brands
WHERE created_at > now() - interval '1 hour';
\`\`\`
Expected: matches "Brands created" in summary (${args.counts.brandsCreated}).

### 4. Aliases appended via merge decisions (where applicable)
\`\`\`sql
SELECT name, aliases
FROM watch_families
WHERE cardinality(aliases) > 0
ORDER BY name;
\`\`\`
Expected: one entry per merge: decision in family-merge-decisions.md; e.g. \`Brut Datejust | {"brut date"}\`.

### 5. Hydration of a known user watch
\`\`\`sql
SELECT u.email, w.brand, w.model
FROM watches w
JOIN users u ON w.user_id = u.id
WHERE lower(w.brand) LIKE 'hamilton%'
LIMIT 5;
\`\`\`
Expected: every row's brand reads \`Hamilton\` (canonical), NOT \`Hamilton Watch\`.

### 6. Natural-key UNIQUE constraint survived (per [[local-catalog-natural-key-drift]])
\`\`\`sql
SELECT conname FROM pg_constraint WHERE conname = 'watches_catalog_natural_key';
\`\`\`
Expected: 1 row.

---

## Sign-off

- [ ] All 6 verification queries returned expected results
- [ ] No unexpected rollback or transaction abort
- [ ] needs_review queue empty by default (Phase 82 will populate on ingest)

## What this push does NOT do (forward-armor against scope creep)

- Does NOT flip NOT NULL on \`watches_catalog.brand_id\` / \`.family_id\` (Phase 80 CANON-01/02)
- Does NOT change \`/api/extract-watch\` behavior (Phase 80 INGEST-01..04)
- Does NOT swap the recommender JOIN-through path (Phase 81 RECO-01..04)
- Does NOT add auto-overwrite on \`addWatch\` / \`editWatch\` Server Actions (Phase 81 DISP-01/02)
- Does NOT add admin UI surfaces (Phase 82 UI-01..03, OPS-01/02)

## Phase 79 Deliverables Summary

| Requirement | Status |
|-------------|--------|
| MIG-02 — brand backfill --apply, idempotent | ✅ |
| MIG-03 — family backfill --apply, aliases routing | ✅ |
| MIG-04 — post-flight assertion (predicate divergence) | ✅ ${args.postFlightResult.resolvedBrand}/${args.postFlightResult.total} brand + ${args.postFlightResult.resolvedFamily}/${args.postFlightResult.total} family resolved |
| MIG-05 — portability (prod push clean first try) | ✅ (script-driven; no SQL migration in this phase) |
| DISP-03 — hydration via UPDATE FROM JOIN | ✅ ${args.counts.userWatchesHydrated} watches hydrated |

## Next Phase

Phase 80: NOT NULL Constraint Flip + Ingest Hardening — CANON-01/02 (flip NOT NULL on resolved FKs) + INGEST-01..04 (extract-watch resolves via brand/family FKs).
`
  await mkdir(path.dirname(POST_DEPLOY_PATH), { recursive: true })
  await writeFile(POST_DEPLOY_PATH, content, 'utf8')
  console.log(`[v8.4-brand-canon] wrote ${POST_DEPLOY_PATH}`)
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual `BEGIN` / `COMMIT` / `ROLLBACK` literals via `sql.unsafe('BEGIN')` | `sql.begin(async tx => ...)` callback | postgres@^3.x | Phase 79 uses the callback form; first canonical caller in scripts is `repair-drizzle-journal.ts:172` |
| Pushing data migrations as `supabase/migrations/*.sql` (DDL + DML mixed) | Pushing data migrations as `tsx --apply` scripts (DML only; DDL stays in `.sql`) | gradual project shift since Phase 17 backfills; explicit in Phase 79 D-79-05 | Phase 79's apply is script-driven; no new `.sql` file ships |
| Manual operator sign-off file written by hand after deploy (Phase 78 78-POST-DEPLOY.md) | Auto-generated POST-DEPLOY artifact (Phase 79 D-79-10) | Phase 79 D-79-10 | Reduces "wrote script, forgot the audit" gap |
| `IS NULL` post-flight checks that inherit the UPDATE WHERE's predicate | `IS DISTINCT FROM NULL` positive predicate checks (per `[[post-flight-assertion-predicate-divergence]]`) | quick-260620-gk9 incident (2026-06-20) | Phase 79 MIG-04 closes this lesson at the migration layer |

**Deprecated / outdated in this domain:** none. `sql.begin` is current API for `postgres@^3.x`; `readline/promises` is current for Node 18+ (well within Horlo's Node baseline).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Local seed contains Hamilton/Hamilton Watch drift case (the canonical end-to-end test). Brut Date/Brut Datejust and Héron Watches are NOT in local seed; alias-append verification relies on unit-test fixtures + post-prod query | Pitfall 8 / Validation Architecture | LOW for the end-to-end Hamilton path (confirmed grep `'Hamilton Watch'` in `supabase/seed.sql:88,134` and `scripts/seed-data/explore-catalog-adds.json:112,122,132`). MEDIUM for Brut Date/Héron coverage — if alias path is broken, unit tests catch it but local DB run won't surface it. Mitigation: post-prod query #4 in the operator sign-off checklist |
| A2 | `sql.begin(async tx => ...)` correctly triggers ROLLBACK when the callback throws | Pattern 1 / Pitfall 2 | LOW — documented postgres lib semantics for v3.x; recommend an integration test that intentionally throws inside the callback and asserts pre-vs-post snapshot identical (analog: `tests/integration/scripts/v8.4-readonly.test.ts` snapshot pattern) |
| A3 | Operator-edited `brand-merge-decisions.md` UUIDs (in `merge:<uuid>` cells) are PROD UUIDs that exist in prod's `brands` table | Code Examples / Pitfall 6 | LOW — Tyler ran the dry-run against prod after Phase 78's push (per `78-POST-DEPLOY.md`); the strict gate verifies. If a uuid doesn't exist in prod (e.g. operator pasted a local uuid by mistake), strict gate refuses to apply |
| A4 | The dry-run's `SET search_path = public, extensions, pg_catalog` line at `scripts/v8.4-brand-canonicalization.ts:258` carries forward to the family dry-run unchanged | "Carryforward callouts" / Pitfall 6 | LOW — pure SQL syntax; same connection model |
| A5 | `watches.catalog_id` IS NOT NULL for ALL existing rows (per Phase 38 NOT NULL flip), so the hydration JOIN finds every user watch | Pattern 5 / Pitfall 5 | LOW for fresh user watches; MEDIUM for "orphaned by catalog delete" rows (`ON DELETE SET NULL`). Pitfall 5 handles this case; no rollback risk |
| A6 | Operator runs `--apply --mode=both` (not `--apply --mode=brands` alone) | Pitfall 7 | LOW with the early `if (apply && mode !== 'both')` check; clear error message |
| A7 | Postgres `||` operator on `text[]` arrays preserves element order and doesn't deduplicate (so the WHERE `NOT @>` containment gate IS the idempotency check, not the operator) | Pattern 4 | LOW — documented Postgres behavior |
| A8 | Throwing from inside `sql.begin` correctly ROLLBACKs even when followed by `process.exit(1)` in the OUTER catch block | Pitfall 2 / Pattern 1 | LOW — `sql.begin` catches throw, sends ROLLBACK, then re-throws BEFORE returning; outer try/finally handles `sql.end()`. The fail mode (process.exit inside the callback) is what causes the hang per Pitfall 2 |
| A9 | Local Supabase Postgres port is 54322 (separate from Supabase Studio's 54323 + API's 54321) | Pattern 3 | LOW — well-documented Supabase CLI default; confirmed in `scripts/import-prod-catalog.sh:39` pattern |

**If this table is left as-is:** A1 is the one to verify with a local DB query before Plan 01 finalization — `SELECT DISTINCT lower(trim(brand)) FROM watches_catalog WHERE lower(brand) LIKE 'hamilton%'`. Expected: at least two rows (`hamilton` and `hamilton watch`).

## Open Questions (RESOLVED)

1. **Should `79-POST-DEPLOY.md` be auto-committed by the script via `git add`?**
   - What we know: Phase 78's `78-POST-DEPLOY.md` was hand-written then committed by Tyler post-verification.
   - What's unclear: D-79-10 says "auto-generated by the script"; doesn't specify whether script commits.
   - Recommendation: **Script writes the file; operator commits.** Mirrors Phase 78 convention; operator should review the file (especially the count summary and post-flight result) before committing.
   - **RESOLVED:** Script writes; operator commits via `git add` / `git commit` after verification.

2. **What npm script entry should run the apply path?**
   - What we know: Phase 78 added `db:v8.4-brand-canon` (dry-run default).
   - What's unclear: Should there be a separate `db:v8.4-brand-canon-apply` script, or reuse the existing entry with `--apply --mode=both`?
   - Recommendation: **Reuse existing entry; document the invocation in the script header.** Adding a separate `-apply` entry encourages "I'll just run the script with `--apply`" muscle-memory bypass of the local-vs-prod awareness gate. The shell invocation `npm run db:v8.4-brand-canon -- --apply --mode=both` (local) and `DATABASE_URL=... tsx scripts/v8.4-brand-canonicalization.ts --apply --mode=both` (prod) is verbose by design.
   - **RESOLVED:** No new npm script; document invocations in script header.

3. **Should `--mode=both` without `--apply` (dry-run for both brand+family) be supported?**
   - What we know: D-79-05 says `--mode=families` reads brand decisions in-memory; doesn't explicitly cover `--mode=both` dry-run.
   - What's unclear: Useful to operator? Or just complicates the args matrix?
   - Recommendation: **`--mode=both` REQUIRES `--apply`.** Operator runs `--mode=brands` (dry-run, exists), then operator runs `--mode=families` (dry-run, new), then operator runs `--mode=both --apply` (apply, new). Reject `--mode=both` without `--apply` with a clear error.
   - **RESOLVED:** `--mode=both` only valid with `--apply`. Update early arg-validation check.

4. **Should the family decisions file path be configurable?**
   - What we know: Phase 78 hardcoded `.planning/v8.4-brand-merge-decisions.md`.
   - What's unclear: Symmetric hardcode for family file?
   - Recommendation: **Hardcode `.planning/v8.4-family-merge-decisions.md`.** Symmetric with brand file; no configuration knobs to surface (config-creep risk). Constants at top of script next to existing `OUTPUT_FILE`.
   - **RESOLVED:** Hardcoded `FAMILY_OUTPUT_FILE = path.join(process.cwd(), '.planning/v8.4-family-merge-decisions.md')`.

5. **Where in the script does `79-POST-DEPLOY.md` generation logic live? Same module or separate file?**
   - What we know: Phase 78 has the script as a single file; no helpers are factored out.
   - What's unclear: Adding ~80 LOC of artifact template inline vs. a sibling helper.
   - Recommendation: **Inline in the script.** Single-file keeps the apply path readable end-to-end; the template is data + interpolation, not logic. Phase 79's script grows from 345 LOC to ~700 LOC; still well within manageable single-file size.
   - **RESOLVED:** Inline template + `writePostDeployArtifact()` helper at the bottom of `scripts/v8.4-brand-canonicalization.ts`.

6. **`readline/promises` vs minimal `process.stdin` reader?**
   - What we know: `readline/promises` is Node built-in; ~5 lines for a one-question prompt.
   - What's unclear: Some scripts in the wild use raw `process.stdin.on('data')`.
   - Recommendation: **`readline/promises`** — async/await-friendly, clearer code, no manual buffer handling.
   - **RESOLVED:** Use `node:readline/promises`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Local Supabase (Docker container `supabase_db_horlo`) | Local-first verification of apply path | ✓ (assumed running) | Postgres 15+ | `supabase start` |
| `tsx` | Running `scripts/v8.4-brand-canonicalization.ts --apply` | ✓ (devDep) | per package.json | `node` after explicit compile (slower) |
| `postgres` npm pkg | DB connection + `sql.begin()` transaction | ✓ (^3.4.9) | per package.json | none — required |
| `node:readline/promises` | Interactive prod prompt (D-79-02) | ✓ (built-in, Node 18+) | N/A | Raw stdin reader |
| `node:url` | DATABASE_URL host parsing (D-79-02) | ✓ (built-in) | N/A | Regex on raw string |
| `node:fs/promises` | Artifact I/O | ✓ (built-in) | N/A | none |
| `extensions.pg_trgm` | Family dry-run fuzzy candidates | ✓ in local + prod (via quick-260623-uua) | per extension | none |
| `extensions.unaccent` + `public.f_unaccent(text)` | Diacritic folding in family candidate scoring | ✓ in local + prod | per extension | skip f_unaccent (accents mismatch reduces score) |
| Prod `DATABASE_URL` (Supabase pooler) | Prod apply | ✗ (operator-supplied) | N/A | none — LOCAL-only verification is not a substitute |
| Phase 78 schema (aliases + needs_review columns) | Phase 79 apply writes to aliases column | ✓ shipped to local + prod 2026-06-24 | N/A | required |
| Operator-edited `.planning/v8.4-brand-merge-decisions.md` | Brand apply path | ✓ committed 2026-06-25 (53 rows, all terminal) | N/A | required |
| Operator-edited `.planning/v8.4-family-merge-decisions.md` | Family apply path | ✗ Phase 79 generates it; operator edits | N/A | required for apply (D-79-05) |

**Missing dependencies with no fallback:**
- Prod `DATABASE_URL` (operator-supplied at runtime; same as Phase 78 pattern)
- Operator-edited family decisions file (Phase 79 creates the file via `--mode=families`; operator edits before apply)

**Missing dependencies with fallback:**
- None. Every other piece is present.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `vitest@2.1.9` (already installed) |
| Config file | `vitest.config.ts` (existing) |
| Quick run command | `npm run test -- tests/unit/scripts/ tests/integration/scripts/` |
| Full suite command | `npm run test` |
| Build gate | `npm run build` (runs `prebuild` = `vitest run tests/static/`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| MIG-02 (apply + idempotent) | `--apply --mode=both` populates `watches_catalog.brand_id` for every row; second run is a no-op | integration (DATABASE_URL-gated) | `npm run test -- tests/integration/scripts/v8.4-apply-atomic.test.ts -t "brand_id resolved"` AND `... v8.4-apply-idempotent.test.ts` | ❌ Wave 0 |
| MIG-03 (families + aliases routing) | `--apply` populates `watches_catalog.family_id`; merge:<uuid> append source to aliases without duplication | integration (DATABASE_URL-gated) | `npm run test -- tests/integration/scripts/v8.4-apply-atomic.test.ts -t "family_id resolved" -t "aliases appended"` | ❌ Wave 0 |
| MIG-04 (post-flight assertion + rollback on failure) | Assertion uses POSITIVE predicate; throw inside `sql.begin` triggers ROLLBACK; pre-state preserved | integration (DATABASE_URL-gated) | `npm run test -- tests/integration/scripts/v8.4-apply-atomic.test.ts -t "post-flight assertion"` + a forced-fail variant (inject bad data; assert pre-vs-post snapshot identical) | ❌ Wave 0 |
| MIG-04 (predicate divergence) | Assertion phrasing differs from UPDATE WHERE | unit | `npm run test -- tests/unit/scripts/v8.4-post-deploy-template.test.ts -t "predicate divergence"` (grep on script source for IS DISTINCT FROM NULL alongside the UPDATE) | ❌ Wave 0 |
| MIG-05 (script-driven; portable across envs) | `--apply` against local AND prod completes; no `extensions` portability surprises (no new SQL in this phase) | integration (DATABASE_URL-gated; covers local) + manual UAT on prod | local: same as MIG-02 above; prod: post-deploy operator sign-off (Wave 4) | ❌ Wave 0 (local) + manual (prod) |
| DISP-03 (hydration via JOIN; unconditional; brand+model only) | Every `watches.catalog_id IS NOT NULL` row has `brand` + `model` overwritten from canonical names; `notes`, `serial`, etc unchanged | integration (DATABASE_URL-gated) | `npm run test -- tests/integration/scripts/v8.4-apply-atomic.test.ts -t "hydration overwrites" -t "hydration preserves other columns"` | ❌ Wave 0 |
| D-79-01 (strict pre-flight gate refuses on drift) | Refuses on: needs-review status / unknown token / merge:<uuid> not in DB / catalog rows not in decisions file | unit + integration | `npm run test -- tests/unit/scripts/v8.4-strict-gate.test.ts` (4 cases) | ❌ Wave 0 |
| D-79-02 (silent local; interactive prod) | `isLocalDatabaseUrl` returns true for `127.0.0.1:54322`; false for prod pooler URL | unit | `npm run test -- tests/unit/scripts/v8.4-host-detect.test.ts` | ❌ Wave 0 |
| D-79-03 (atomicity) | All 5 writes + assertion in one transaction; throw mid-callback rolls back | integration (DATABASE_URL-gated) | `npm run test -- tests/integration/scripts/v8.4-apply-atomic.test.ts -t "atomic rollback"` (force failure; snapshot pre-vs-post identical) | ❌ Wave 0 |
| D-79-04 (idempotent re-run) | Second `--apply --mode=both` on resolved DB exits 0 with "Already applied" | integration (DATABASE_URL-gated) | `npm run test -- tests/integration/scripts/v8.4-apply-idempotent.test.ts` | ❌ Wave 0 |
| D-79-06 (alias append idempotent) | Re-applying a merge: decision does not produce duplicate alias entries | unit | `npm run test -- tests/unit/scripts/v8.4-family-build-decisions.test.ts -t "alias idempotent"` (with fixture map) | ❌ Wave 0 |
| D-79-07 (in-memory chain) | Family dry-run resolves `(brand_raw, model_raw)` to canonical via in-memory brand map without DB write | unit | `npm run test -- tests/unit/scripts/v8.4-family-build-decisions.test.ts -t "in-memory map"` | ❌ Wave 0 |
| D-79-08 (unconditional hydration) | UPDATE has no WHERE on stored brand text (JOIN-only filter) | unit (grep on script source) | `npm run test -- tests/unit/scripts/v8.4-post-deploy-template.test.ts -t "hydration unconditional"` | ❌ Wave 0 |
| D-79-09 (new rows default needs_review false) | INSERT statements include `needs_review = false` for new brands AND new families | unit (grep on script source) + integration (asserts INSERTed rows have needs_review=false) | unit grep + integration `... -t "new rows default needs_review false"` | ❌ Wave 0 |
| D-79-10 (POST-DEPLOY auto-generated) | Successful apply writes `79-POST-DEPLOY.md` with expected sections (summary, query, sign-off, what-not-do) | integration | `npm run test -- tests/integration/scripts/v8.4-apply-atomic.test.ts -t "POST-DEPLOY written"` (assert file exists + grep sections) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test -- tests/unit/scripts/` (fast — no DB)
- **Per wave merge:** `npm run test -- tests/unit/scripts/ tests/integration/scripts/` (DATABASE_URL must be set; gated suites run)
- **Phase gate:** Full local verification sequence (below) + `npm run test` green + `npm run build` green + operator prod-apply with post-deploy artifact committed

### Phase 79 Local Verification Sequence (codifies the Local-First gate)

Per CLAUDE.md `## Local-First Development` and `[[local-first-dev]]`, Phase 79's local-first verification:

1. **Confirm local Supabase running:**
   ```bash
   docker exec supabase_db_horlo psql -U postgres -d postgres -c "SELECT 1"
   ```

2. **Confirm Phase 78 schema present (carryforward):**
   ```bash
   docker exec supabase_db_horlo psql -U postgres -d postgres -c \
     "SELECT column_name FROM information_schema.columns \
      WHERE table_name = 'watch_families' AND column_name IN ('aliases', 'needs_review')"
   # Expect 2 rows
   ```

3. **Confirm local catalog has Hamilton drift case (A1 verification):**
   ```bash
   docker exec supabase_db_horlo psql -U postgres -d postgres -c \
     "SELECT DISTINCT lower(trim(brand)) FROM watches_catalog WHERE lower(brand) LIKE 'hamilton%' ORDER BY 1"
   # Expect at least: hamilton, hamilton watch
   ```

4. **Confirm brand decisions file is operator-edited (no needs-review left):**
   ```bash
   grep -c "needs-review" .planning/v8.4-brand-merge-decisions.md
   # Expect 0 (header excluded by grep)
   ```

5. **Run family dry-run (creates `.planning/v8.4-family-merge-decisions.md`):**
   ```bash
   npm run db:v8.4-brand-canon -- --mode=families
   test -s .planning/v8.4-family-merge-decisions.md
   ```

6. **Operator edits family decisions file** (manual; resolve all needs-review):
   ```bash
   $EDITOR .planning/v8.4-family-merge-decisions.md
   ```

7. **Run apply against local:**
   ```bash
   npm run db:v8.4-brand-canon -- --apply --mode=both
   # Expect silent confirmation (D-79-02 local detection) + summary + transaction commit
   ```

8. **Verify post-flight passed (zero unresolved):**
   ```bash
   docker exec supabase_db_horlo psql -U postgres -d postgres -c \
     "SELECT count(*) FROM watches_catalog WHERE brand_id IS NULL OR family_id IS NULL"
   # Expect 0
   ```

9. **Verify Hamilton merge (the canonical end-to-end test):**
   ```bash
   docker exec supabase_db_horlo psql -U postgres -d postgres -c \
     "SELECT u.email, w.brand, w.model FROM watches w \
      JOIN users u ON w.user_id = u.id \
      WHERE lower(w.brand) LIKE 'hamilton%' LIMIT 5"
   # Expect: every row's brand reads 'Hamilton' (canonical), NOT 'Hamilton Watch'
   ```

10. **Verify idempotent re-run:**
    ```bash
    npm run db:v8.4-brand-canon -- --apply --mode=both
    # Expect exit 0 + "Already applied — nothing to do."
    ```

11. **Verify `79-POST-DEPLOY.md` auto-generated:**
    ```bash
    test -s .planning/phases/79-backfill-migration-display-hydration/79-POST-DEPLOY.md
    grep -c "post-flight" .planning/phases/79-backfill-migration-display-hydration/79-POST-DEPLOY.md
    # Expect ≥1
    ```

12. **vitest green:**
    ```bash
    npm run test -- tests/unit/scripts/ tests/integration/scripts/
    ```

13. **Build green (runs `prebuild` static guards too):**
    ```bash
    npm run build
    ```

14. **Prod apply (operator runs interactively):**
    ```bash
    DATABASE_URL=$PROD_URL tsx scripts/v8.4-brand-canonicalization.ts --apply --mode=both
    # Expect summary block + "Type 'yes' to proceed:" prompt
    # Operator types yes (or anything else to abort)
    ```

15. **Prod parity:** re-run sign-off queries from `79-POST-DEPLOY.md` against prod Supabase SQL editor; check all 6 queries pass.

16. **Commit `79-POST-DEPLOY.md`** (post-apply artifact) and the operator-edited `v8.4-family-merge-decisions.md`.

### Wave 0 Gaps
- [ ] `tests/unit/scripts/v8.4-host-detect.test.ts` — D-79-02 `isLocalDatabaseUrl` covers `127.0.0.1:54322`, `localhost:54322`, prod pooler, malformed URL (fail closed)
- [ ] `tests/unit/scripts/v8.4-strict-gate.test.ts` — D-79-01 — 4 cases: (a) needs-review status, (b) unknown token, (c) merge:<uuid> target not in DB, (d) catalog row missing from decisions file
- [ ] `tests/unit/scripts/v8.4-family-build-decisions.test.ts` — D-79-07 in-memory chain + D-79-06 alias idempotency (fixture-based)
- [ ] `tests/unit/scripts/v8.4-post-deploy-template.test.ts` — D-79-10 template shape (assert sections present; assert SQL queries syntactically valid) + D-79-08 unconditional hydration (grep) + MIG-04 predicate divergence (grep)
- [ ] `tests/integration/scripts/v8.4-apply-atomic.test.ts` — DATABASE_URL-gated; covers MIG-02/03/04/05/DISP-03 + D-79-03 + D-79-09 + D-79-10. Subtests: brand_id resolved, family_id resolved, aliases appended, hydration overwrites, hydration preserves notes/serial, atomic rollback (force fail), post-flight assertion, POST-DEPLOY written, new rows default needs_review false
- [ ] `tests/integration/scripts/v8.4-apply-idempotent.test.ts` — DATABASE_URL-gated; D-79-04 second-run no-op + D-79-06 alias double-append no-op
- [ ] Framework install: none — vitest already configured

## Security Domain

> Required when `security_enforcement` is enabled (default = enabled). Phase 79 has a higher security surface than Phase 78 because it WRITES to user-facing data (`watches.brand`, `watches.model`).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Phase 79 has no user-facing auth surface |
| V3 Session Management | no | Phase 79 has no session surface |
| V4 Access Control | yes | Script connects via service-role `DATABASE_URL`; bypasses RLS by design (per D-78-06 inheritance). The secret SHALL NOT be logged or interpolated into the auto-generated POST-DEPLOY artifact |
| V5 Input Validation | yes | Operator-edited markdown is parsed; the strict gate (D-79-01) refuses unknown status values per D-78-02 grammar |
| V6 Cryptography | no | No crypto in Phase 79 |

### Known Threat Patterns for tsx-script + Postgres atomic-write stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via operator-edited markdown content (brand_raw, model_raw flowing into SQL) | Tampering | All template-literal interpolations bind as parameters (`postgres` lib auto-binds); brand/model strings never concatenate into raw SQL. Validation: unit test that asserts a `'; DROP TABLE brands;--` brand_raw flows through `sql\`${brandRaw}\`` without producing a DROP execution (covered by `postgres` lib behavior, but a defensive integration test is cheap) |
| Service-role secret leakage | Information Disclosure | Script reads `process.env.DATABASE_URL`; never logs. Artifact is markdown with no secret material. Operator runs script in their own shell |
| Cross-env confusion (run --apply against prod while expecting local) | Information Disclosure / Integrity | D-79-02 confirmation prompt is the gate; operator must explicitly type `yes` for any non-localhost URL. The prompt summary shows counts so the operator can sanity-check the magnitude |
| Operator-edited markdown poisoning (malicious `merge:<uuid>` pointing at a wrong brand) | Tampering | Strict gate (D-79-01) verifies `merge:<uuid>` target exists in DB; cannot point at a non-existent uuid. Cannot prevent the operator from intentionally choosing a wrong-but-existing uuid — relies on the operator's own review process. Phase 82's `/admin/brands` provides post-hoc correction |
| Atomic-transaction interrupt mid-apply (network blip, Ctrl-C) | Availability / Integrity | `sql.begin` auto-rolls back on connection loss; Postgres server-side transaction also auto-aborts on backend disconnect (idle_in_transaction_session_timeout). Pre-state preserved. Operator re-runs `--apply` after investigating |
| Excessive privilege via service-role connection | Privilege Escalation | Service-role IS the by-design pattern (D-78-06); the read-only RLS bypass is necessary for the apply to touch every catalog row. Mitigation is in the operator's connection-string handling, not in the script |
| Post-flight assertion bypassed by inheriting UPDATE WHERE | Integrity | `[[post-flight-assertion-predicate-divergence]]` — covered by MIG-04 + the recommended positive predicate. Unit test asserts predicate divergence at the source-code level |

**Net new vectors over Phase 78:** Phase 79 IS a write phase (Phase 78 was read-only). Two additional attack surfaces emerge:
1. **Operator-decision injection.** Mitigated by strict gate + atomic rollback + post-flight assertion.
2. **User data overwrite.** `watches.brand` and `.model` are user-displayed columns; an operator decision error (wrong canonical name) would surface in every user's collection grid. Mitigated by the decisions file being committed to git BEFORE apply (operator reviews offline); local-first verification on a non-prod DB (operator sees the result before pushing); and Phase 82's `/admin/brands` rename action (post-hoc correction).

No new dependencies → no supply-chain vector beyond what Phase 78 already accepted.

## Sources

### Primary (HIGH confidence — codebase grep verified)
- `.planning/phases/79-backfill-migration-display-hydration/79-CONTEXT.md` — D-79-01..D-79-10 locked decisions
- `.planning/phases/78-schema-additions-operator-resolve-queue/78-CONTEXT.md` — D-78-01..D-78-08 carryforward
- `.planning/phases/78-schema-additions-operator-resolve-queue/78-POST-DEPLOY.md` — the template Phase 79's auto-generated artifact mirrors
- `.planning/phases/78-schema-additions-operator-resolve-queue/78-RESEARCH.md` — R-FIND-02 (search_path workaround), every Phase 78 helper Phase 79 reuses
- `.planning/REQUIREMENTS.md:40-43,69` — MIG-02/03/04/05 + DISP-03 requirement text
- `.planning/ROADMAP.md:289-300` — Phase 79 success criteria (5 items); 302-313 forward-armor (Phase 80/81/82)
- `.planning/v8.4-brand-merge-decisions.md` — operator-edited 2026-06-25: 53 rows / 19 auto-resolved / 1 merge (Hamilton Watch → Hamilton) / 33 new
- `scripts/v8.4-brand-canonicalization.ts:1-345` — Phase 78 MIG-01 dry-run; the file Phase 79 extends in-place
- `scripts/repair-drizzle-journal.ts:172-179` — `sql.begin(async tx => ...)` precedent (the project's only callback-form transaction caller)
- `scripts/inventory-explore-catalog.ts:36,128-184` — `postgres` lib connection pattern + markdown line-array emission
- `scripts/factual-apply.ts:300-307` — `BEGIN; ... COMMIT;` literal pattern (legacy form Phase 79 IS NOT using; reference for contrast)
- `scripts/generate-explore-covers.ts:128` — `/127\.0\.0\.1\|localhost/` regex for local detection (alternative form)
- `scripts/import-prod-catalog.sh:39` — shell `case` on `127.0.0.1` for local detection
- `src/db/schema.ts:87-175` (watches), `:431-510` (watchesCatalog), `:518-537` (brands), `:539-562` (watchFamilies) — current schema with Phase 78 columns
- `supabase/seed.sql:88,134` — Hamilton Watch drift case in local seed (confirms A1)
- `scripts/seed-data/explore-catalog-adds.json:112,122,132` — Hamilton Watch in explore catalog (confirms A1)
- `package.json:25` — `db:v8.4-brand-canon` npm script entry
- `tests/integration/scripts/v8.4-readonly.test.ts:1-127` — snapshot-pre-vs-post integration test idiom Phase 79 reuses (with the inversion: Phase 79 EXPECTS the snapshots to differ)
- `tests/unit/scripts/v8.4-seed021-golden.test.ts:1-120` — fixture-based unit test pattern for Brut Date / Héron Watches (the cases NOT in local seed)
- `tests/integration/migrations/78-gin-index.test.ts:1-80` — DATABASE_URL-gated integration test idiom
- Memory: `[[post-flight-assertion-predicate-divergence]]` — MIG-04 design rule
- Memory: `[[catalog-id-divergence]]` — natural-key resolution, no hardcoded UUIDs across envs
- Memory: `[[drizzle-supabase-db-mismatch]]` — Phase 79 ships no SQL migration; rules apply to dry-run + apply behavior
- Memory: `[[supabase-extension-schema-function-pin]]` — R-FIND-02 carryforward (search_path)
- Memory: `[[local-first-dev]]` — Phase 79 is THE canonical local-first case
- Memory: `[[pg-trgm-word-similarity-for-brand-typos]]` — family dry-run uses word_similarity
- Memory: `[[drizzle-sql-any-array-pitfall]]` — forward armor; Phase 79's queries don't use ANY(arr)
- Memory: `[[next-clear-operational-debt]]` — workflow.use_worktrees=false globally
- Memory: `[[local-catalog-natural-key-drift]]` — verification query #6 in POST-DEPLOY template

### Secondary (MEDIUM confidence — documented API behavior)
- [postgres-js README — Transactions](https://github.com/porsager/postgres#transactions) — `sql.begin(async tx => ...)` semantics: auto-commit on resolution, auto-rollback on throw, sub-transactions via `tx.savepoint()` (not needed for Phase 79)
- [PostgreSQL Documentation: array operators](https://www.postgresql.org/docs/16/functions-array.html) — `||` array concat, `@>` containment, `array_append` (alternative)
- [Node.js Documentation: node:readline/promises](https://nodejs.org/api/readline.html#promises-api) — `createInterface` + `rl.question(query)` returns `Promise<string>`
- [Node.js Documentation: URL](https://nodejs.org/api/url.html#url) — `new URL(input).host` (includes port)

### Tertiary (LOW confidence — assumptions to verify)
- Assumption A1 (local seed has Hamilton/Hamilton Watch drift) — grep-confirmed in `supabase/seed.sql:88,134`; HIGH actually, downgraded only because the broader claim "all SEED-021 cases in local" is FALSE (Brut Date, Héron Watches not in local)
- Assumption A2 (sql.begin auto-rollback on throw) — postgres lib documented behavior; recommend integration test exercising the rollback path

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every library is already installed, every pattern has direct codebase precedent
- Architecture: HIGH — `sql.begin` callback, `readline/promises`, `node:url` are all well-documented; the 6-step transaction ordering is unambiguous
- Pitfalls: HIGH — 8 pitfalls drawn from project memories (predicate divergence, catalog-id-divergence, sql-any-array, local-first) and codebase patterns; all with concrete avoidance pattern
- Carryforward: HIGH — Phase 78 R-FIND-02 (search_path), helpers (parseExistingPreserved, mergeForward, buildRow, buildTableRows), npm script, file path conventions all clean inheritance
- Local seed coverage: MEDIUM — Hamilton confirmed; Brut Date / Héron Watches absent (Pitfall 8 + A1 mitigation via unit fixtures + post-prod verification query #4)

**Research date:** 2026-06-25
**Valid until:** 2026-07-25 (30 days — script-only changes against schema that landed 2026-06-24; no fast-moving dependencies; `sql.begin` is stable postgres@3 API)
