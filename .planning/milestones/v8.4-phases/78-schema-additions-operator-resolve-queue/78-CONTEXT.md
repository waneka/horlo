# Phase 78: Schema Additions + Operator-Resolve Queue - Context

**Gathered:** 2026-06-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 78 ships the FOUNDATION for v8.4 canonicalization — no data UPDATE runs in this phase.

**Delivers:**
1. Two additive schema columns: `watch_families.aliases text[] NOT NULL DEFAULT '{}'` (with a GIN containment index) and a `needs_review boolean NOT NULL DEFAULT false` column on BOTH `brands` and `watch_families`.
2. A dry-run TypeScript script (`scripts/v8.4-brand-canonicalization.ts`) that scans `watches_catalog`, proposes brand → `brands.id` mappings, and writes `.planning/v8.4-brand-merge-decisions.md` for operator review.
3. Portability foundation: any helper functions used in functional indexes use `extensions.unaccent` with `SET search_path` pinned ON the function (per `[[drizzle-supabase-db-mismatch]]` gotcha #4 and `[[supabase-extension-schema-function-pin]]`).

**Explicitly NOT in this phase:**
- No `--apply` flag (Phase 79 wires writes).
- No FAMILY dry-run (Phase 79's MIG-03 generates `.planning/v8.4-family-merge-decisions.md`).
- No `NOT NULL` flip on `brand_id` / `family_id` (Phase 80).
- No ingest, recommender, or UI changes.
- No `watches` row touches.

Phase 78 succeeds when: an operator can run the script, get a markdown table of every distinct catalog brand value with proposed mappings, edit it to lock decisions, and Phase 79 will be able to parse it back without further format negotiation.

</domain>

<decisions>
## Implementation Decisions

### Operator-Resolve `.md` Artifact Format

- **D-78-01: GFM table is the on-disk format.** `.planning/v8.4-brand-merge-decisions.md` is a single GitHub-Flavored Markdown table with these columns: `brand_raw | normalized | proposed_target_id | status | candidates / notes`. One row per distinct `lower(trim(watches_catalog.brand))` value across the entire catalog. Familiar editor surface, search/replace-friendly, parseable by any GFM table parser. Why: chose this over per-row YAML blocks because the parser surface is smaller and operators are GFM-fluent; chose it over inline HTML-comment markers because operators need to see and edit the decision in visible text.
- **D-78-02: `status` cell grammar uses explicit prefix tokens.** Phase 79's parser accepts exactly these values: `auto-resolved` (use `proposed_target_id` as-is) · `merge:<uuid>` (merge `brand_raw` into the given existing brand_id) · `new` (create a new `brands` row from `brand_raw`) · `skip` (defer the row; Phase 79 errors unless `--allow-skips` is passed). Any other value (including the default `needs-review` left untouched) causes Phase 79 to refuse `--apply`. Why: explicit verbs are unambiguous and surface bad edits immediately rather than at `--apply` time; `skip` exists so the operator can defer a row to a follow-up run without blocking everything else.
- **D-78-03: `candidates / notes` column carries top 3 fuzzy candidates ≥0.5.** For every `needs-review` row, the dry-run pre-computes the top 3 `pg_trgm` candidates above similarity 0.5 (relaxed below INGEST's 0.6 threshold so the operator can spot borderline-but-plausible cases). Format: `hamilton (0.85), hamilton-khaki (0.62)`. Empty value = no candidates above 0.5; operator should treat as a `new` proposal. Why: gives the operator enough decision context inline without scrolling; 3 is enough to spot ambiguity (two candidates scoring 0.84 vs 0.82) without making the cell visually noisy.

### Auto-Resolve Aggressiveness

- **D-78-04: Exact-only auto-resolve.** A row is written with `status: auto-resolved` ONLY when `lower(trim(brand_raw))` exactly equals some existing `brands.name_normalized`. Every fuzzy candidate (any similarity threshold, including ≥0.6 — the INGEST threshold) goes to `status: needs-review` so the operator sees it. The SEED-021 bug-surface cases (Hamilton vs Hamilton Watch, Héron vs Héron Watches, Brut Date vs Brut Datejust, Omega vs OMEGA) all land in the operator queue by construction. Why: this matches D-04's spirit ("ambiguous cases queued for manual operator decision before the data migration runs") — auto-fuzzy-merging would silently make exactly the calls the operator queue exists to surface.
- **D-78-05: The dry-run never writes to the DB.** No INSERT/UPDATE/DELETE; reads only. Produces only the `.md` artifact. Why: keeps Phase 78 zero-risk-for-prod; the only outputs are the additive schema columns + a markdown file.

### Script Runtime Contract

- **D-78-06: Service-role + `DATABASE_URL`, works against both envs.** Reuses the existing `tsx scripts/<name>.ts` pattern (analog: `scripts/inventory-explore-catalog.ts`). `DATABASE_URL` points at local Supabase (`127.0.0.1:54322`) by default per the project's `.env.development.local` setup; operator exports the prod URL to dry-run against prod. Service-role bypasses RLS so reads see every catalog row. Dry-run cannot mutate anything regardless of env, so cross-env safety is at the SQL-statement level (read-only queries only) rather than at the connection level. Why: chose this over local-only because Phase 79's `--apply` will need the same connection model and we want one code path; chose it over Supabase REST because Phase 79's `--apply` needs drizzle anyway.
- **D-78-07: Idempotent re-run via refuse-to-overwrite + `--regenerate` merge-forward.** If `.planning/v8.4-brand-merge-decisions.md` already exists, the default run exits with a non-zero status pointing the operator at `--regenerate`. `--regenerate` rewrites the file by MERGING: for any `brand_raw` whose existing row has a non-`needs-review` status, the operator's decision is preserved verbatim; new rows (brand strings introduced since the last run) are appended at the bottom with `status: needs-review`. Why: protects operator edits from accidental clobber; supports the realistic workflow of "dry-run, start editing, the catalog gets a new ingest, re-generate to pick it up without losing my prior decisions"; `--force` overwrites unconditionally for the destructive case (covered by Phase 79 needs).

### Aliases Seeding

- **D-78-08: Phase 78 ships `aliases` empty; Phase 79's `--apply` populates them.** The schema migration adds `aliases text[] NOT NULL DEFAULT '{}'` and the GIN containment index, but writes zero alias values. All known SEED-021 typo/abbreviation cases (`Brut Date` → `Brut Datejust`, etc.) are routed through the Phase 79 operator queue: the operator's decision in `.planning/v8.4-family-merge-decisions.md` (Phase 79 artifact) drives `UPDATE watch_families SET aliases = aliases || ARRAY['<typo>']` statements in Phase 79's `--apply`. Why: single source of truth for alias data (operator queue, not hardcoded migration); avoids splitting alias state between migration and script; sidesteps the local-vs-prod catalog divergence problem (`[[catalog-id-divergence]]`) since aliases will key on `(brand_id, name_normalized)` per Phase 79.

### Claude's Discretion

- **GIN index design**: plain `CREATE INDEX watch_families_aliases_gin ON watch_families USING GIN (aliases)` for `@>` containment is the standard answer for `text[]` lookup; no functional GIN / trigram GIN needed on aliases (the point of aliases is exact-string mapping, not fuzzy matching — fuzzy matching happens upstream on `name_normalized` via the existing trigram index).
- **`needs_review` retroactive flagging**: existing `brands` / `watch_families` rows backfill to `false` per CANON-04. The Phase 79 `--apply` may choose to flip specific existing rows to `true` if the operator wants them re-reviewed — that's a Phase 79 decision driven by the operator queue, not a Phase 78 default.
- **Drizzle codegen for the additive columns**: planner picks between hand-written `supabase/migrations/*.sql` (per `[[drizzle-supabase-db-mismatch]]` for prod portability) and Drizzle Kit push for local. Standard pattern; expected output is a hand-written SQL migration that runs cleanly on both envs.
- **`brand_id` column on `watches_catalog`** already exists (Phase 34, schema.ts L504); no schema work in Phase 78 for it. Phase 78 only adds: `aliases` + `needs_review`s. The NOT NULL flip on `brand_id`/`family_id` is Phase 80.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### v8.4 Milestone Inputs (mandatory)
- `.planning/REQUIREMENTS.md` — locked decisions D-01..D-08 and the full CANON / MIG / INGEST / RECO / DISP / UI / OPS requirement breakdown. D-01..D-08 are the policy frame Phase 78 implements.
- `.planning/ROADMAP.md` § Phase 78 — phase goal, depends-on, success criteria, requirement mapping (CANON-03, CANON-04, MIG-01).
- `.planning/seeds/SEED-021-catalog-brand-model-canonicalization.md` — origin signal (real-world Hamilton/Hamilton Watch + Brut Date/Brut Datejust + Héron/Héron Watches drift cases) plus the open-questions section that REQUIREMENTS.md resolved.

### Schema starting state
- `src/db/schema.ts` § brands (L518–535) — current `brands` table with `name`, `nameNormalized` GENERATED column, `brands_name_normalized_unique` constraint. Phase 78 ADDs the `needs_review` column here.
- `src/db/schema.ts` § watchFamilies (L537–555) — current `watch_families` table with `(brand_id, name_normalized)` unique constraint. Phase 78 ADDs `aliases` + `needs_review`.
- `src/db/schema.ts` § watches_catalog (L503–509) — `brand_id` / `family_id` FKs already nullable since Phase 34; Phase 78 does NOT touch this table.

### Migration portability rules (mandatory — failure here costs a prod push)
- Memory: `[[drizzle-supabase-db-mismatch]]` — drizzle-kit push is LOCAL ONLY; prod uses `supabase db push --linked`; 4 prod-push gotchas (filename, ordering, extension schema, enum-bound dependents).
- Memory: `[[supabase-extension-schema-function-pin]]` — pg_trgm/unaccent functions need `SET search_path` PINNED ON THE FUNCTION definition (not just session SET LOCAL) when used in functional indexes. First `supabase db push --linked` IS the gate; local doesn't reproduce.
- `supabase/migrations/20260623200000_quick_260623_uua_search_unaccent_trgm.sql` — recent precedent: hand-written `extensions.`-prefixed function definitions for unaccent + trigram with pinned search_path. Phase 78's migration follows this pattern.

### Local-first development gate (mandatory)
- `CLAUDE.md` § Local-First Development — `npm run dev` against local Supabase before push; `vitest` and `npm run build` aren't runtime gates. Phase 78's schema lands locally first via drizzle-kit push + hand-written SQL run against local Supabase; verify column exists + GIN index built + dry-run script reads data correctly before writing the prod migration.
- Memory: `[[local-first-dev]]` — same rule, with the Drizzle SQL incident rationale.

### Script pattern precedents
- `scripts/inventory-explore-catalog.ts` — existing `tsx` script that connects via DATABASE_URL + service-role and writes a markdown artifact under `.planning/`. Closest analog for the dry-run script's runtime contract.
- `scripts/import-prod-catalog.sh` — env-handling pattern for scripts that may run against prod DB.

### Related memories (background, not mandatory)
- Memory: `[[pg-trgm-word-similarity-for-brand-typos]]` — for typo-tolerant lookup where the user types ONE word but the DB value is multi-word, `word_similarity()` not `similarity()`. Phase 78's candidate-suggestions logic should consider this; INGEST in Phase 80 definitely needs it.
- Memory: `[[post-flight-assertion-predicate-divergence]]` — Phase 79's MIG-04 post-flight assertion lesson. Phase 78 just sets up the column shape; the assertion is Phase 79's concern but the lesson informs how MIG-01's dry-run reports coverage.
- Memory: `[[local-catalog-natural-key-drift]]` — `watches_catalog_natural_key` UNIQUE constraint silently lost after Drizzle pushes. Phase 78 should not push the `aliases` / `needs_review` columns via drizzle-kit push alone; the hand-written SQL migration is the safe path.
- Memory: `[[catalog-id-divergence]]` — local + prod `watches_catalog` rows have different ids; data migrations should key by `(brand, model, reference)` not by `id`. Phase 79's `--apply` follows this; Phase 78 doesn't write data so it's untouched here.
- Memory: `[[next-clear-operational-debt]]` — `workflow.use_worktrees=false` is globally set; Phase 78 is DB-touching and inherits this. No worktrees.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/db/schema.ts` `brands` + `watchFamilies` pgTable definitions — Phase 78 adds two columns to each via Drizzle ADD COLUMN + hand-written SQL. Existing `nameNormalized` GENERATED column gives the script its lookup key (no normalization logic to re-implement).
- `scripts/inventory-explore-catalog.ts` (existing `tsx` analog) — connection bootstrap, drizzle client setup, service-role pattern. Copy/adapt for the dry-run script.
- `supabase/migrations/20260623200000_quick_260623_uua_search_unaccent_trgm.sql` — hand-written SQL for adding `extensions.`-prefixed trigram + unaccent functions with pinned search_path. The pattern Phase 78's helper functions (if any are needed) should follow.
- Existing `pg_trgm` extension already installed in both local and prod via the 260623-uua migration. Phase 78's similarity lookups can use it directly (`word_similarity(brand_raw, name_normalized) > 0.5`).
- `watches_catalog_natural_key` UNIQUE constraint — Phase 78 does not touch it but the script reads through the same `(brand, model, reference)` triple for grouping.

### Established Patterns
- **Hand-written `.sql` migration for additive schema changes**, not drizzle-kit push (per `[[drizzle-supabase-db-mismatch]]`). Filename format: `supabase/migrations/{timestamp}_phase78_aliases_needs_review.sql`. Run order: local supabase + drizzle push refresh → write SQL → run on local → smoke-test → commit → prod `supabase db push --linked`.
- **tsx scripts that touch the DB live under `scripts/`** with DATABASE_URL service-role connection. Read-only scripts produce markdown artifacts under `.planning/`. Write scripts gate themselves behind `--apply` flag (Phase 79 wires this; Phase 78 does NOT).
- **Markdown artifacts as operator-edited contracts** — recent precedent: the explore-catalog seed JSON files written by `scripts/inventory-explore-catalog.ts` and consumed by the seed migration. Same pattern, different output format (GFM table vs JSON).

### Integration Points
- **Phase 79's `--apply`** consumes the artifact this phase produces. Phase 78's `.md` schema + status grammar (D-78-01, D-78-02) is the contract.
- **Phase 80's INGEST-01..04** queries `brands.name_normalized` (already GENERATED) + `watch_families.aliases` (this phase ships the column) + `watch_families.name_normalized` (already GENERATED) for resolution. Phase 78's GIN index on `aliases` is the index Phase 80's `@>` lookup uses.
- **Phase 82's `/admin/brands` + `/admin/families`** filter on `needs_review DESC, name ASC`. The columns Phase 78 ships are what those queries sort on.

</code_context>

<specifics>
## Specific Ideas

- The four SEED-021-cited cases (`Hamilton` vs `Hamilton Watch`, `Omega` vs `OMEGA`, `Héron` vs `Héron Watches`, `Brut Date` vs `Brut Datejust`) MUST land in the dry-run's `needs-review` queue when run against the local catalog. If any of them auto-resolve, the auto-resolve threshold is wrong — that's the fast end-to-end correctness check for the dry-run.
- The artifact format example (D-78-01 preview): copy the table layout verbatim into the planner's task description so the SQL output formatting is unambiguous.
- Phase 79's parser MUST refuse unknown `status` values rather than coercing them — surfaces bad operator edits at parse time, not at `--apply` time.

</specifics>

<deferred>
## Deferred Ideas

- **Functional GIN / trigram GIN on `aliases`** — considered for typo-tolerance on the alias strings themselves. Deferred: aliases are exact-string mapping by design; fuzzy matching belongs upstream on `name_normalized` (already has a trigram index per 260623-uua). Plain `USING GIN (aliases)` for `@>` containment is sufficient.
- **Retroactive `needs_review: true` on existing brand rows** — considered for flagging brands that were ingested via the drift-prone pre-v8.4 path. Deferred to Phase 79's operator decisions (operator can flip specific existing rows via the `.md` artifact if desired).
- **Pre-seeding SEED-021-cited aliases in the schema migration** — explicitly considered and rejected (D-78-08). All alias population is Phase 79's `--apply` driven by operator queue.
- **Local-only refusal to run against prod** — considered as a safety mechanism for the dry-run script. Rejected (D-78-06): dry-run is read-only by construction; refusing prod connectivity would block Phase 79 from extending the same script for `--apply`. Cross-env safety is at the SQL level (read-only queries), not the connection level.
- **Generic `--mode=brands|families` flag on the script** — considered for Phase 78. Deferred to Phase 79 — Phase 78 ships brand-only dry-run per success criteria #3; Phase 79's MIG-03 adds families.

</deferred>

---

*Phase: 78-Schema Additions + Operator-Resolve Queue*
*Context gathered: 2026-06-24*
