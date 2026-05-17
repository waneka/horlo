# Phase 44: Catalog Enrichment - Context

**Gathered:** 2026-05-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Harden the catalog taste-enrichment tooling, run the production enrichment
over the ~100 `watches_catalog` rows, and confirm every `/search` filter
dimension and all 8 Collector Archetypes are populated — before the Browse
and Archetypes modules ship in Phase 46.

In scope (ENRH-01 through ENRH-06): rate-limit retry/backoff + pacing,
per-row success/failure logging, a downgrade guard on force re-enrichment,
populating taste columns (LLM) and factual filter columns (LLM-proposed /
human-approved), cover-photo backfill where sourceable, and a committed
archetype-coverage verification.

Out of scope: the catalog *breadth* expansion beyond the existing ~100 rows
(that is v5.2 / SEED-009 — "enrich then expand"), the Browse/Archetypes UI
itself (Phase 46), and the admin CMS UI (Phase 45). This is a data + tooling
phase, not a UI phase.

</domain>

<decisions>
## Implementation Decisions

### Factual-Field & Photo Fill — ENRH-04, ENRH-05

- **D-01:** Factual catalog columns (`movement_type`, `case_size_mm`,
  `style_tags`) that are NULL are filled via an **LLM-proposes /
  human-approves** flow. The LLM never writes factual columns directly to
  `watches_catalog` — the approval gate *is* the "human review" ENRH-05
  requires. ("Never auto-written" means never *ungated*, not never LLM.)
- **D-02:** The factual-fill LLM uses the **Anthropic `web_search` tool**.
  Each proposed value is written into the review file alongside the **source
  URL** it was derived from, so review is verify-against-citation, not
  eyeball-only. (See RESEARCH FLAG on combining web_search with the
  enricher's forced tool_choice.)
- **D-03:** The approval gate is an **editable review file**. A *propose*
  step writes a structured, hand-editable file keyed by `catalog_id` showing
  current value + proposed value + source URL per field. The user
  edits/deletes/confirms rows. An *apply* step writes only confirmed rows.
  No admin UI is built here — that is Phase 45.
- **D-04:** Cover photos (`image_url IS NULL`): the LLM proposes a likely
  **source-page URL** (brand site / retailer) into the review file. The user
  opens it, grabs the actual image, and supplies the final URL or upload. No
  LLM-emitted direct-image URLs are committed (hallucination/hotlink risk).
  Rows the user leaves blank stay without a cover photo — Browse must
  tolerate that.
- **D-05:** The fill is **gap-driven**, mirroring `backfill-taste.ts`: a
  query finds rows where each factual field / `image_url` is NULL; the LLM
  proposes only for the missing fields, field-by-field. Cost and web-search
  calls scale with the actual gap, not 100 rows × every field.
- **D-06:** The Phase 19.1 taste enricher (`src/lib/taste/enricher.ts`)
  **also gets the `web_search` tool** — taste calls may ground in sources.
  This modifies a working module: preserve its never-throws / returns-`null`
  posture and its structured event logging.

### Downgrade Guard — ENRH-03

- **D-07:** The downgrade guard lives in **`updateCatalogTaste`**
  (`src/data/catalog.ts`) — the data-layer write function. Every force path
  is protected; the invariant cannot be bypassed by a future caller.
- **D-08:** **Block rule** — a force write is rejected when ALL hold:
  (1) the existing row is vision-derived (`extracted_from_photo = true`),
  (2) the existing row's `confidence >= 0.7`, AND
  (3) the incoming write is text-mode (`extractedFromPhoto = false`).
  A force re-run that is itself vision-derived is allowed (legit refresh).
  Text-derived rows are unprotected — nothing to downgrade.
- **D-09:** High-confidence threshold = **0.7** (comfortably above the
  enricher's own `<0.5` "ambiguous" band documented in `TASTE_TOOL`).

### Script Surface — ENRH-01, ENRH-02

- **D-10:** **Four scripts, separated by write semantics:**
  1. `backfill-taste.ts` — hardened in place; taste columns; auto-writes via
     first-write-wins (`updateCatalogTaste` default mode).
  2. `reenrich-taste.ts` — force-overwrite path; now subject to the
     D-07/D-08 guard.
  3. **NEW** factual-propose script — web-search LLM → writes the review file.
  4. **NEW** factual-apply script — reads the approved review file → emits
     the catalog write (as a migration, per D-14).
- **D-11:** ENRH-01 — `backfill-taste.ts` and the factual-propose script
  retry rate-limited requests with **backoff** and **pace** requests so a
  full ~100-row run completes without silent failures.
- **D-12:** ENRH-02 — each row's `catalog_id` is logged as **success or
  failure** so a partial run is diagnosable.
- **D-13:** ENRH-02 resumability — the factual-propose script treats the
  **review file as the resume ledger**: re-running scans it and skips any
  `catalog_id` already present; only un-proposed gap rows get fresh
  web-search calls (mirrors how `backfill-taste.ts` resumes via the
  `confidence IS NULL` predicate).

### Run & Verify — ENRH-04, ENRH-06

- **D-14:** **Run-local-then-sync.** Enrichment runs against a **local** copy
  of the catalog — prod never receives a live LLM write. The taste-backfill
  and factual-apply steps emit a timestamped **SQL data migration** (one
  `UPDATE` per `catalog_id`, enriched columns only) into
  `supabase/migrations/`. The migration is committed, code-reviewable, and
  pushed to prod via `supabase db push --linked` — matching the project's
  established prod-deploy discipline. Prod only ever receives frozen,
  reviewed SQL.
- **D-15:** Verification is a **committed npm script** (e.g.
  `db:verify-catalog-coverage`): asserts every row has populated taste +
  factual columns AND all 8 Collector Archetypes resolve to ≥1 row
  (`GROUP BY primary_archetype`); exits non-zero on any gap. Run locally
  before generating the migration and against prod after applying. Phase 46
  can re-run it as a ship gate.

### Claude's Discretion

- Exact retry/backoff parameters; whether ENRH-01/02 resilience is extracted
  into a **shared helper** used by both API-calling scripts
  (`backfill-taste.ts` + factual-propose) — DRY is encouraged but not locked.
- The review-file format (JSON vs CSV vs other) — must be hand-editable and
  show per `catalog_id`: current value, proposed value, source URL.
- The generated migration's filename/timestamp convention — MUST follow the
  project's Supabase migration naming (see canonical refs / memory on
  prod-push gotchas).
- Exact structure of the run playbook handed to the user.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & Requirements
- `.planning/ROADMAP.md` § "Phase 44: Catalog Enrichment" — phase goal, the
  six ENRH requirements, and five success criteria.
- `.planning/REQUIREMENTS.md` — ENRH-01 through ENRH-06 requirement text.
- `.planning/seeds/SEED-008-v5.1-explore-redesign.md` § "Phase: Catalog
  Enrichment" — defines this phase as the "enrich" half of the
  enrich-then-expand decision and a direct prerequisite for Browse.

### Anthropic web_search Tool (D-02, D-06)
- https://docs.claude.com/en/docs/agents-and-tools/tool-use/web-search-tool —
  official server-tool docs. **Read before planning the factual-propose
  script and the enricher web-search change.** Note the interaction with a
  forced `tool_choice` (see RESEARCH FLAG below).

### Phase 19.1 Taste Enricher (prior decisions to respect)
- `src/lib/taste/enricher.ts` (header comment) — D-08…D-17: enricher NEVER
  throws (returns `null`), no retries in the enricher itself, structured
  event logging.
- `src/data/catalog.ts` `updateCatalogTaste` — D-13 first-write-wins; `force`
  option is the only overwrite path. The D-07 guard is added here.

### Research Flags (resolve during research, not user decisions)
- **RESEARCH FLAG — local catalog presence:** "Run local" (D-14) requires the
  **local DB to actually hold the ~100 `watches_catalog` rows**. Verify
  whether the local catalog is populated after `supabase db reset` + drizzle
  push (catalog rows may have been inserted at runtime, not via a
  migration/seed). If local is empty, a local-catalog seeding step is a
  prerequisite for this phase.
- **RESEARCH FLAG — forced tool_choice + web_search:** `enricher.ts` currently
  calls `messages.create` with `tool_choice: { type: 'tool', name:
  'record_taste_attributes' }`. Confirm whether a forced custom tool can
  coexist with the server-side `web_search` tool in one call, or whether the
  flow needs a two-turn shape (search turn, then forced-tool turn). Same
  question applies to the new factual-propose call.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/backfill-taste.ts` — taste backfill; gap-driven (`confidence IS
  NULL`), batched, pass-loop, dry-run cost preview. Hardened in place for
  ENRH-01/02 (D-10, D-11). The shape to mirror for the factual-propose script.
- `scripts/reenrich-taste.ts` — force-overwrite path; predicate-scoped
  (`--confidence-below` / `--catalog-id`), refuses force without a predicate.
  Now interacts with the D-07/D-08 guard.
- `src/lib/taste/enricher.ts` — `enrichTasteAttributes()`; text + vision
  modes, Anthropic tool-use with `strict` schema, never-throws posture.
  Target of the D-06 web-search change.
- `src/lib/taste/vocab.ts` / `prompt.ts` / `types.ts` — enricher support:
  closed vocab (`PRIMARY_ARCHETYPES` ×8, `ERA_SIGNALS`, `DESIGN_MOTIFS`),
  prompt builders, types.
- `src/data/catalog.ts` — `updateCatalogTaste` (guard site, D-07), the
  catalog upsert (factual columns + `style_tags` first-write-wins), filter
  predicates (`movementType`, `caseSizeMm`, `styleTags`), `getTopStyleTags`.
- `src/db/schema.ts` — `watches_catalog`: factual cols (`movement_type`,
  `case_size_mm`, `image_url`, `image_source_url`, `image_source_quality`),
  taste cols (`formality`, `sportiness`, `heritage_score`,
  `primary_archetype`, `era_signal`, `design_motifs`, `confidence`,
  `extracted_from_photo`), `style_tags` (notNull, default `'{}'`).
- `supabase/migrations/` — where the generated data migration (D-14) lands;
  pushed via `supabase db push --linked`.
- `package.json` `scripts` — `db:backfill-taste`, `db:reenrich-taste`, etc.;
  two new `db:` entries needed for factual-propose / factual-apply, one for
  `db:verify-catalog-coverage`.

### Established Patterns
- Catalog scripts: `tsx --env-file=.env.local`, relative imports (tsx does
  not resolve `@/*`), `--dry-run` cost preview, batch/pass loop, residual
  assertion logged not fatal.
- `style_tags` and `design_motifs` are **distinct columns** — `style_tags`
  is the `/search` factual filter dimension; `design_motifs` is the
  taste-vocab column the enricher writes. Do not conflate.
- Prod schema/data changes go through `supabase/migrations/` + `supabase db
  push --linked`; local uses drizzle push (see memory note on the mismatch).

### Integration Points
- Anthropic SDK `^0.88.0` — `web_search` tool wiring in `enricher.ts` and the
  new factual-propose script.
- `updateCatalogTaste` ← `backfill-taste.ts` (default mode) and
  `reenrich-taste.ts` (`force: true`) — the D-07 guard changes the `force`
  contract for the latter.
- Generated SQL data migration → `supabase/migrations/` → prod.
- `db:verify-catalog-coverage` → reusable by Phase 46 as a ship gate.

</code_context>

<specifics>
## Specific Ideas

- The user pushed back on "the LLM can't write factual fields" — correctly.
  The line is *governance*, not capability: the shared authoritative catalog
  must not take an **ungated** LLM write. An LLM that proposes values behind
  an approval gate satisfies ENRH-05. Honor this interpretation.
- Hard preference: **prod never receives a live LLM write.** Enrichment runs
  locally; prod only ever ingests frozen, reviewed SQL via a committed
  migration. Do not design any path that calls the LLM with prod credentials.
- The user chose web search "everywhere" — including the taste enricher, not
  just the new factual-fill pass.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. Catalog *breadth* expansion was
explicitly noted as out of scope (v5.2 / SEED-009).

</deferred>

---

*Phase: 44-Catalog Enrichment*
*Context gathered: 2026-05-17*
