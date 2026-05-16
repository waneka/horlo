# Phase 35: Layer B — Lineage Edges + Structured Movement + Era/Material - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-09
**Phase:** 35-Layer B — Lineage Edges + Structured Movement + Era/Material
**Areas discussed:** Movement enum migration & TS alignment, relationship_type storage shape, era / case_material / bracelet_config shape, Family seeding + lineage curation strategy

---

## Movement enum migration & TS alignment

### Q1 — `watches_catalog.movement` migration path

| Option | Description | Selected |
|--------|-------------|----------|
| Rename + migrate values in-place | Single migration: ADD movement_type, UPDATE rows mapping ('automatic'→'auto', etc.), DROP movement. Requires pg_depend check. | ✓ (initially — superseded by wipe choice) |
| Add new column, keep old as deprecated | ADD movement_type, keep movement text indefinitely. Drift risk. | |
| Two-phase: add now, drop in Phase 36 wipe | ADD movement_type, defer column drop to Phase 36 clean-slate. | |

**User's choice:** Rename + migrate values in-place — but the user then noted production DB is wipeable, which superseded this with a TRUNCATE-first approach.

### Q2 — Does Phase 35 also restructure the `watches` table?

| Option | Description | Selected |
|--------|-------------|----------|
| Catalog-only — leave watches.movement free-text | Phase 35 doesn't touch the watches table or Watch domain type. SRCH-16 reads catalog only. Simplest scope. | |
| Mirror the migration on watches table | ADD movement_type/movement_caliber on watches; UPDATE values; DROP movement; rewrite Watch type, MOVEMENT_TYPES, WatchForm, extractor, all 20+ src/ references. | ✓ |
| Add nullable movement_type on watches; keep movement | Minimal additive column without forcing wire-up now. Dead column anti-pattern. | |

**User's choice:** Mirror the migration on watches table.
**Notes:** Expanded Phase 35 scope significantly (form + extractor + similarity engine wiring updates) but the user explicitly chose the alignment.

### Q3 — TS-side `MovementType` / `MOVEMENT_TYPES` realignment

| Option | Description | Selected |
|--------|-------------|----------|
| Match DB exactly: 4 values | MOVEMENT_TYPES = ['auto', 'manual', 'quartz', 'spring_drive']. UI uses MOVEMENT_LABELS map for display. Single source of truth. | ✓ |
| Keep TS friendly names; convert at DAL boundary | MOVEMENT_TYPES stays ['automatic', etc.]. DAL converts at write/read boundary. Drift risk. | |
| Match DB but keep 'other' as TS-only NULL marker | TS keeps 'other'; DAL converts 'other'↔NULL. Preserves WatchForm 'Other' option. | |

**User's choice:** Match DB exactly: 4 values.

### Q4 — Wipeability disclosure (user-initiated)

After the Q1 answer, the user noted: "the production DB is wipeable at this point. the only user is me and starting over is fine. if that simplifies things."

**Follow-up question — Where should the wipe happen?**

| Option | Description | Selected |
|--------|-------------|----------|
| Wipe at start of Phase 35 | Migration begins with TRUNCATE watches CASCADE; TRUNCATE watches_catalog CASCADE. Then schema changes apply to empty tables — movement column drops cleanly with no value-mapping logic. | ✓ |
| Let Phase 36's planned wipe handle it | Phase 35 does in-place migration (no-op on near-empty tables); Phase 36 wipe runs as planned. | |
| Wipe at the end of Phase 35 instead of start | Schema changes apply in-place (with mapping), then final TRUNCATE. Worst of both. | |

**User's choice:** Wipe at start of Phase 35.
**Notes:** Saved as project memory `project_db_wipeable_2026_05_09.md` for future-phase reference. The 'other'/unparseable-value mapping question (originally Q3 of this area) was eliminated by the wipe — no rows to map.

---

## relationship_type storage shape

### Q1 — DB-level storage of `watch_lineage_edges.relationship_type`

| Option | Description | Selected |
|--------|-------------|----------|
| pgEnum | CREATE TYPE lineage_relationship_type AS ENUM ('successor', 'predecessor', 'remake', 'tribute', 'homage'). Type-safe; matches movement_type pgEnum discipline. | ✓ |
| text + CHECK constraint | text NOT NULL CHECK (rel_type IN (...)). Adding values is simpler. Less type-safe. | |
| Foreign key to relationship_types lookup table | Most flexible (could carry icon/label later). Overkill for closed 5-value set with no UI. | |

**User's choice:** pgEnum.

### Q2 — Edge storage direction

| Option | Description | Selected |
|--------|-------------|----------|
| Directional only — one row per fact | Single row with predecessor/successor columns + rel_type. DAL UNIONs both directions in CTE. Single source of truth. | ✓ |
| Reciprocal pairs — auto-insert inverse | AFTER INSERT trigger writes inverse row. 2x storage; sync risk. | |
| Symmetric undirected edges | catalog_id_a + catalog_id_b with CHECK (a < b). Loses semantic direction for successor/predecessor. Wrong fit. | |

**User's choice:** Directional only.

### Q3 — Cycle prevention shape

| Option | Description | Selected |
|--------|-------------|----------|
| Self-loop = CHECK constraint; cycle = trigger with depth 10 | CHECK rejects self-loops cheaply; BEFORE INSERT trigger runs bounded recursive CTE for deeper cycles. | ✓ |
| Single trigger handles both | Trigger checks self-loop at top, then runs CTE. One mechanism. | |
| CHECK constraint only | Skip the cycle trigger; rely on curator discipline. Violates ROADMAP success #1. | |

**User's choice:** Self-loop = CHECK; cycle = trigger with depth 10.

### Q4 — Edge uniqueness

| Option | Description | Selected |
|--------|-------------|----------|
| UNIQUE on (pred, succ, rel_type) | A pair (A, B) can carry MULTIPLE rel_type rows. Loosest reasonable constraint. | ✓ |
| UNIQUE on (pred, succ) only | One row per ordered pair regardless of rel_type. Forces single primary type. | |
| No uniqueness constraint | Curator discipline only. Probably wrong. | |

**User's choice:** UNIQUE on (pred, succ, rel_type).

---

## era / case_material / bracelet_config shape

### Q1 — `era` vs existing Phase 19.1 `era_signal`

| Option | Description | Selected |
|--------|-------------|----------|
| era = curated factual era; era_signal stays as LLM taste signal | Two different concepts coexist. era for filtering; era_signal for taste matching. No coupling. | ✓ |
| Drop era_signal; era replaces it | Loses Phase 19.1 D-01 taste-signal investment. CAT-13 Phase 38 loses input dimension. | |
| Keep era_signal; don't add a new era column at all | Reinterpret ROADMAP success #5. Violates ROADMAP letter. | |

**User's choice:** era is independent.

### Q2 — `era` value list and DB constraint

User initially rejected the option set, then specified: "for era values let's go decades starting with 1900-1910 and going all the way up to current."

Reformulated question: 13 decade values from '1900-1910' through '2020-2030'.

| Option | Description | Selected |
|--------|-------------|----------|
| pgEnum with 13 decade values | CREATE TYPE watch_era AS ENUM (13 decades). Type-safe; new decade once per 10 years requires ALTER TYPE migration. | ✓ |
| text + CHECK with regex pattern | TEXT CHECK (era ~ '^(19\|20)\d0-(19\|20)\d0$'). Auto-allows future decades. Less type-safe. | |
| Free text — no constraint | TEXT NULL. Maximum flexibility; zero filter quality. | |

**User's choice:** pgEnum with 13 decade values.

### Q3 — `case_material` shape

User initially rejected the option set, then specified: "for case material we need to account for specialty materials, like IWC's ceramic titanium hybrid for example. i think a suggested label list likely accounts for 98% of cases but we need to make sure there's freeform text values allowed as well."

Reformulated question: free text DB column + suggested-label TS constant list.

| Option | Description | Selected |
|--------|-------------|----------|
| Single text value + suggested label list | TEXT NULL no CHECK. CASE_MATERIALS_SUGGESTED in src/lib/constants.ts covers 98%. Specialty alloys (IWC ceramic-titanium hybrid) flow through as freeform. Two-tone uses compound labels. | ✓ |
| Text array | TEXT[] DEFAULT '{}'. Conflates 'made of multiple materials' with 'covers multiple variants' (Phase 36 concern). | |

**User's choice:** Single text value + suggested label list.

### Q4 — `bracelet_config` shape

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror case_material exactly: single text + suggested list | Same pattern. BRACELET_CONFIGS_SUGGESTED with 7 common values. Multi-bracelet variants (Daytona Oysterflex/Oyster) become Phase 36 watch_variants concern. | ✓ |
| Different shape — array / JSONB / skip | Open discussion of a different shape. | |

**User's choice:** Mirror case_material exactly.

---

## Family seeding + lineage curation strategy

### Q1 — How families and lineage edges enter the system

| Option | Description | Selected |
|--------|-------------|----------|
| JSON seed files + idempotent backfill scripts | scripts/seed-data/families.json + lineage-edges.json; two backfill scripts; git-tracked source of truth. | ✓ |
| Interactive prompt scripts (no JSON) | Scripts run interactively; no git-tracked source. | |
| Inline in TypeScript | Hard-coded seed arrays in TS files. Less inviting for future admin UI. | |
| Schema-only — zero seed data ships | Empty arrays; no end-to-end validation in Phase 35. | |

**User's choice:** JSON seed files + idempotent backfill scripts.

### Q2 — How much seed data ships with Phase 35

| Option | Description | Selected |
|--------|-------------|----------|
| Small anchor set: ~10 families + 1 lineage chain | Rolex/Omega/Tudor/AP/PP/GS families + Submariner 5513→14060→124060 chain. Validates ROADMAP success #3. | ✓ |
| Fixture-only: anchor set lives in tests | Production ships empty; test fixtures inject the 3-node chain. | |
| Comprehensive: ~30+ families + several chains | Front-loads curation work that REQUIREMENTS line 27 says is curator-paced. | |

**User's choice:** Small anchor set.

### Q3 — Operational order in the deploy runbook

| Option | Description | Selected |
|--------|-------------|----------|
| Catalog re-seed first, then families/lineage | (1) push migration with TRUNCATE; (2) db:backfill-catalog; (3) db:backfill-catalog-brands; (4) NEW db:backfill-catalog-families; (5) NEW db:backfill-catalog-lineage. Idempotent throughout. | ✓ |
| Don't auto-seed catalog — lineage script skips missing refs | Scripts log warnings; user manually imports refs first. Can't validate 3-node chain at deploy time. | |
| Lineage script INSERTs placeholder catalog rows | Backdoor catalog-write path; violates SEED-001 provenance. | |

**User's choice:** Catalog re-seed first, then families/lineage.

---

## Claude's Discretion

None — user selected the recommended option on every question across all 4 areas. Three questions required reformulation based on user clarification:
- Area 1 Q2 (`watches` table parity): user chose to MIRROR the migration on `watches` rather than the recommended catalog-only scope.
- Area 3 Q2 (era values): user specified the decade format and range.
- Area 3 Q3 (case_material): user clarified the freeform-text-with-suggested-list pattern for specialty alloys.

The wipeability disclosure was user-initiated mid-discussion and reshaped Area 1's migration approach.

## Deferred Ideas

All deferred ideas are captured in CONTEXT.md `<deferred>` section. Key items:
- Lineage browse UI (Phase 39 per Phase 33b Q2)
- /family/{id} and /brand/{id} routes (Phase 39 / v5.x)
- Comprehensive family/lineage seed data (post-deploy curation)
- Admin UI for family/lineage CRUD (locked out of v5.0)
- era_signal deprecation (NOT scheduled — coexist with new `era`)
- watches table parity for era/case_material/bracelet_config
- Variant-level material/bracelet variation (Phase 36 watch_variants)
- NOT NULL flips on family_id/movement_type/etc.
- Reciprocal-pair lineage edges (rejected — directional only)
- Movement caliber enum / lookup table (free text in v5.0)
