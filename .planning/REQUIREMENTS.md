# Horlo v5.0 Discovery North Star — Requirements

**Status:** Defining
**Started:** 2026-05-06
**Goal:** Make Rdio-style click-driven discovery the organizing principle of Horlo by auditing every discovery surface, then rebuilding the catalog as a 5-level hierarchy that earns Reference granularity for the future recommender — clearing v4.x carryover (DEBT-09, Nyquist) along the way.

**Scope posture:** Audit-first per SEED-004. Schema-only catalog seeding (no ~500 References pre-seeded). Clean-slate DB wipe enabled by single-user context. No paywall (SEED-006 resolved → `.planning/research/PREMIUM-MAP.md`). Recommender (SEED-002) and onboarding (SEED-003) NOT in v5.0; only Layer D `divestments` schema lands as recommender prep.

---

## v5.0 Requirements

### Carryover Bugfix

- [ ] **DEBT-09**: `addWatch` and `editWatch` Server Actions persist `notesPublic` and call `revalidatePath('/u/[username]/[tab]', 'page')` after every write. Zod schemas in `src/app/actions/watches.ts` accept `notesPublic: z.boolean().optional()`; the existing RED test scaffold `tests/actions/watches.notesPublic.test.ts` (4/4 FAIL) reaches 4/4 GREEN as an explicit success criterion. Phase 23 SUMMARY claimed this shipped via commit `4d362ff` but `git merge-base --is-ancestor 4d362ff HEAD` returns exit 1 — that commit never reached `main`.

### Discovery Audit (audit-first per SEED-004)

- [ ] **DISC-10**: A read-only discovery audit produces `.planning/phases/{N}-discovery-audit/DISCOVERY-AUDIT.md` containing (a) a click-path table with one row per `(surface × clickable element)` across `/`, `/explore`, `/u/{user}`, `/catalog/{id}`, `/search`, `/watch/{id}` — each row tagged Live / Dead / Redundant / Missing — and (b) a decisions doc with explicit YES/NO/DEFERRED resolutions for: "combine home and explore?", lineage browse priority, dead-end closure priority, CAT-13 discovery framing. Pass/fail criteria are written before audit runs. Downstream phases cite specific audit row IDs. No code ships in this phase. **2026-05-08 update:** the 4 decision verdicts are deferred to DISC-12 (Phase 33b) — they are inherently product judgments against the Rdio north star; Phase 33 ships the click-path table as the research substrate.

- [ ] **DISC-12**: A product-framed Rdio north-star audit produces `.planning/phases/33b-discovery-north-star-audit/DISCOVERY-NORTH-STAR-AUDIT.md` containing (a) per-entity drift-vector enumeration — for each user-facing entity (watch detail, collector profile, catalog/family, home/explore feeds, search results) list every discovery vector that SHOULD exist (drift directions a collector might want to follow), score each as ship / partial / missing, and rank missing vectors by Rdio leverage; (b) per-surface dead-end and discovery-leverage scoring against the SEED-004 Rdio principle ("a collector should be able to drift from one watch / collector / family / reference to another by clicking, without ever feeling lost or running into a dead end"); and (c) explicit YES/NO/DEFERRED verdicts (with 2–4 sentence rationales + downstream-phase impact lines) for the 4 D-17 product decisions deferred from Phase 33 — combine home and explore, lineage browse priority, dead-end closure priority, CAT-13 discovery framing. Backing evidence: Phase 33's DISC-AUDIT-NN click-path rows (referenced by id, not modified). Downstream Phases 34 / 35 / 38 / 39 cite north-star findings rather than raw DISC-AUDIT-NN row ids for product decisions. No code, schema, or dependency changes ship in this phase.

### Catalog Hierarchy (SEED-001, schema-only, all 4 layers)

- [ ] **CAT-15** (Layer A): New `brands` and `watch_families` tables with public-read RLS + service-role-write. Nullable `brand_id` FK and nullable `family_id` FK added to `watches_catalog`. Existing DAL queries continue working unchanged. Backfill is manual via service-role scripts; no automated migration. Three-step migration discipline: nullable column add → backfill → (deferred) NOT NULL flip.

- [x] **CAT-16** (Layer B): New `watch_lineage_edges` junction table with `(predecessor_catalog_id, successor_catalog_id, relationship_type, metadata)` supporting M:N relationships and `relationship_type ∈ {successor, predecessor, remake, tribute, homage}`. BEFORE INSERT cycle-detection trigger plus `CYCLE` clause on every recursive CTE query. New `src/data/hierarchy.ts` DAL with `getLineageForReference(catalogId)` recursive CTE (depth-guard 10). Free-text `movement` column replaced by `(movement_caliber TEXT, movement_type ENUM[auto, manual, quartz, spring_drive])`. New first-class columns: `era` (text enum), `case_material` (text), `bracelet_config` (text). Lineage edge data is manually curated only — no automated inference.

- [ ] **CAT-17** (Layer C): New `watch_variants` table (catalog_id FK + dial_color, bezel, bracelet_variant). Existing fragmented Reference rows (e.g., "16610 Kermit" + "16610 black dial") consolidated to canonical Reference + N Variants. Migration is `DELETE` rows from `watches_catalog` (NOT `DROP TABLE` — preserves pg_cron schedule + RLS policies + `ON DELETE SET NULL` cascade behavior on `watches.catalog_id`). User's collection survives the wipe (FKs go null) and is re-linked via the existing idempotent `npm run db:backfill-catalog` (already idempotent on `WHERE catalog_id IS NULL`). 6-step runbook (export user collection refs → wipe catalog → reseed canonical refs → relink user watches → verify zero NULLs → CAT-14 NOT NULL flip) documented in phase CONTEXT.md as a success criterion.

- [ ] **CAT-18** (Layer D): Provenance columns added to `watches`: `serial`, `year_of_acquisition`, `condition`, `box_papers` (chip enum: none / box-only / papers-only / full-set), `service_history`, `paid_currency`, `purchase_date`. New `divestments` table with `(catalog_id NOT NULL, user_id, divested_at, replaced_by_catalog_id, sale_price, notes)`. Existing `watches.status = 'sold'` enum value remains for UI display; recommender (SEED-002, future) reads from `divestments`. Status transition `'owned' → 'sold'` writes a row to `divestments`. Provenance UI ships as collapsed "Collector's Record" disclosure on the WatchForm edit page. Divestment dialog UI scope deferred to phase discuss-phase.

### Engine Rewire

- [ ] **CAT-13**: `analyzeSimilarity()` in `src/lib/similarity.ts` reads catalog taste columns (`formality`, `sportiness`, `heritage_score`, `primary_archetype`, `era_signal`, `design_motifs`, `confidence`) at JOIN time. The `Watch` type extends with optional `catalogTaste`. Taste becomes a 9th additive scoring dimension gated on `confidence >= 0.5` (per Phase 19.1 D-13 confidence semantics). Two new static guard tests at `tests/static/similarity.taste-null.test.ts` (engine falls back to per-user tag data when `catalogTaste` null or below threshold) and `tests/static/similarity.taste-present.test.ts` (engine uses additive 9th dimension when `catalogTaste` present and confidence ≥ 0.5) — both written and passing BEFORE any change to `similarity.ts`. Existing `tests/static/CollectionFitCard.no-engine.test.ts` import boundary guard unchanged. Phase 19.1 D-07 byte-lock on `extractWithLlm()` survives untouched.

- [ ] **CAT-14**: `SET NOT NULL` on `watches.catalog_id`. Pre-flight `DO $$` block asserts zero NULLs as the first migration statement; transaction aborts if any NULL exists. Bundled with CAT-17 Layer C clean-slate phase since clean-slate enables the constraint.

### Audit-Driven Discovery Polish

- [ ] **DISC-09**: An "Editorial Featured Collection" slot ships on `/explore` with admin-only write surface. Curators (admin = owner user_id check in single-user app) can pin a featured catalog reference, family, or collector with a curator-written blurb. Free per SEED-006. Detailed UX shaped by audit findings.

- [ ] **DISC-11**: Audit-driven discovery surface polish closes specific row IDs from the DISC-10 click-path table AND addresses the missing drift vectors identified by the DISC-12 north-star audit. Each polish item is a separate plan within this phase, citing the DISC-AUDIT-NN row ID it closes and/or the DISC-12 north-star vector it addresses. Possible items (DISC-12 verdicts determine final scope): `/family/{familyId}` lineage browse pages, `/catalog/{id}` predecessor/successor affordances, home/explore consolidation if DISC-12 Q1 calls for it, dead-end fixes per the audit table prioritized by DISC-12 Q3 verdict. Scope is fully audit-conditional on Phase 33b verdicts.

### Search & Verdict Polish

- [ ] **SRCH-16**: `/search` Watches tab gains three faceted filters: Movement Type (auto/manual/quartz/spring_drive — sourced from `watches_catalog.movement_type` enum), Case Size (numeric range slider — sourced from `case_size_mm`), Style (multi-select chip group — sourced from existing `style_tags`). Mobile UX: bottom-sheet filter pattern. Hard-blocked on CAT-16 Layer B `movement_type` enum — if Layer B slips, SRCH-16 defers to v5.x.

- [ ] **FIT-05**: CollectionFitCard accordion gains a "Compare with the [X] you own" pairwise drill-down section. Two-column layout (max 2 items mobile per NN/Group pattern). Shows only taste-relevant dimensions (not all 20+ watch columns). Delta row at bottom summarizing the key taste difference. Best after CAT-13 so taste-attribute rows are populated.

### Account & Email Polish

- [ ] **SET-13**: Account → Danger Zone section in `/settings#account` exposes two distinct actions: "Wipe Collection" (deletes all `watches` + `wear_events` + storage files for the owner; preserves account, profile, follows) and "Delete Account" (full hard delete via service-role `supabase.auth.admin.deleteUser()`). Both actions: type-to-confirm input + Phase 22 password re-auth + multi-step modal. Storage `wear-photos/{userId}/` files explicitly purged before DB delete. Documented side effect: Account Delete cascades `notifications.actor_id` rows on other users' inboxes (schema-correct; warrants UX note in CONTEXT.md). No grace period at single-user scale.

- [ ] **SET-14**: Three Supabase Auth email templates (Confirm signup, Reset Password, Change Email) are rebranded with horlo identity: 600px single-column HTML, header logo, brand color, single CTA button. Templates designed with `react-email` 6.1.1 + `@react-email/components` (renders to static HTML for paste into Supabase Auth dashboard). Cross-client compatibility verified on Apple Mail iOS dark mode + Outlook MSO conditional + Gmail web. Existing Resend SMTP at `mail.horlo.app` and DKIM signature unaffected (template content does not affect signing). No Next.js code change — HTML pasted into Supabase Auth dashboard.

### Test & Validation Hardening

- [ ] **DEBT-10**: Nyquist hardening sweep retroactively brings v3.0+ phases to `nyquist_compliant: true` + `wave_0_complete: true`. Targets: v4.1 Phases 27, 28, 30, 31 (currently PARTIAL — only Phase 29 COMPLIANT); v4.0 Phases 25, 26 (no VALIDATION.md); aspect-ratio / object-fit phases (Phase 30) gain CSS-chain assertions per the v4.1 feedback memory. Tests assert *computed styles*, not class names.

- [ ] **DEBT-11**: ~33 deferred human UAT items across v4.0 Phases 18 / 20 / 20.1 / 22 / 23 are triaged. Each item: closed (run UAT and pass), invalidated (overtaken by later phase work — many in 20.1 likely overtaken by gap-closure plans 06/07/08), or deferred-with-explicit-reason (carry forward to v5.x). Triage output is a closure table in the phase CONTEXT.md.

- [ ] **DEBT-12**: Repair prod's `drizzle.__drizzle_migrations` journal — currently contains only 1 row (`idx=0 0000_flaky_lenny_balinger`, hash `cf60a4...`). All subsequent migrations (Phase 8 / 12 / 17 / 19.1 / 27 / 34) shipped via `supabase db push --linked` only; their journal rows were never recorded on prod. Discovered during Phase 34 Wave 3 prod push — `drizzle-kit migrate` on prod tried to apply 0001..0007 in sequence, errored on 0001 (`relation "watches" already exists` — 0001 lacks IF NOT EXISTS guards), aborted before recording 0007. Phase 34 schema is still correctly on prod (supabase db push shipped it); journal sync is bookkeeping that future drizzle-kit runs need. **Repair**: write a one-shot `scripts/repair-drizzle-journal.ts` that computes SHA256 of each `drizzle/0001..NNNN.sql` file, INSERTs rows into `drizzle.__drizzle_migrations` with `(hash, created_at)` matching local `drizzle/meta/_journal.json` entries, idempotent via `ON CONFLICT (hash) DO NOTHING`. Verify via `SELECT count(*) FROM drizzle.__drizzle_migrations` returns the local `_journal.json` entry count. Acceptance: post-repair `npx drizzle-kit migrate` against prod is a clean no-op. Schedule: opportunistic (next prod-deploy phase that needs `drizzle-kit migrate` to work normally — most likely Phase 35 / 36 / 37 since they all add Drizzle migrations too).

---

## Future Requirements (deferred to v5.x / v6.0+)

- **Recommender (SEED-002)** — three-layer hybrid CF + content + graph. Prerequisites met by v5.0 (Layer C Reference granularity + Layer D `divestments` table); ship lands in v6.0+ at earliest per SEED-006 audit outcome
- **Onboarding (SEED-003)** — 4-step taste calibration paired with recommender; not v5.0
- **Pre-seeded ~500 curated References** — schema ships in v5.0 without seeding; curated launch catalog is a separate editorial effort (could be v5.x)
- **Family pages `/family/{familyId}`** — depends on audit-driven polish (DISC-11) finding lineage browse high-priority; otherwise v5.x
- **Lineage browse UI affordances on `/catalog/{id}`** — same as above
- **Phase 999.1 directory archival** to `milestones/v3.0-phases/` — pre-existing v3.0 archival miss; defer to housekeeping
- **CAT-13 v6.x optimization** — collaborative-filtering layer once SEED-002 ships
- **Native apps** — explicitly not roadmapped; user has not raised
- **WristOverlaySvg geometry redesign** — user-owned (canonical 10:10 + arm spacing); not v5.0 WYWT-22 territory
- **Pre-existing `LayoutProps` TS error** in `src/app/u/[username]/layout.tsx:21` — carried from v3.0
- **REQUIREMENTS.md DISC-08 / NAV-14 wording drift** — historical archival note only
- **WatchForm.tsx unused imports** — flagged in plan summaries; not introduced by v5.0
- **SMTP-06 staging-prod sender split (`mail.staging.horlo.app`)** — pending staging Supabase project per Phase 21 CONTEXT D-01
- **`useWatchSearchVerdictCache` cross-user verdict leak** — module-scoped Map post-29-05; theoretical leak when collectionRevision values coincidentally match; v5.x polish
- **Cancel-mid-flow `?returnTo=` honoring** — Phase 28 design decision; revisit if user feedback warrants

## Out of Scope (explicit exclusions for v5.0)

- **Paywall / Subscription tier / Stripe wiring / entitlements scaffolding** — SEED-006 resolved 2026-05-06 (no paywall; build Horlo fully free; revisit monetization post-recommender). See `.planning/research/PREMIUM-MAP.md`. v5.0 builds free with no paid-vs-free forks.
- **Total collection value / market price / paid-vs-market chart** — v6.0 territory (SEED-005 Market Value); requires SEED-007 pricing API spike between v5.0 and v6.0
- **Recommender deployment** — v6.0+ per SEED-006; v5.0 only ships Layer C Reference granularity + Layer D `divestments` schema as data-model prep
- **Onboarding flow** — pairs with recommender per SEED-003; not v5.0
- **Pre-seeded ~500 curated References** — milestone summary decision (schema-only); separate editorial effort
- **Automated lineage inference** — CAT-16 explicitly forbids algorithmic inference (false-positive risk across unrelated families); manual curation only
- **`/evaluate` route reintroduction** — eliminated in v4.0 Phase 20.1; static guard `tests/no-evaluate-route.test.ts` enforces
- **Class-name-based test assertions on aspect-ratio / object-fit phases** — DEBT-10 mandates computed-style assertions per v4.1 feedback memory

---

## Traceability

*Filled by roadmapper 2026-05-06. All 16 v5.0 requirements mapped to exactly one phase.*

| REQ-ID | Phase | Status |
|--------|-------|--------|
| DEBT-09 | Phase 32 | Pending |
| DISC-10 | Phase 33 | Pending |
| DISC-12 | Phase 33b | Pending |
| CAT-15 | Phase 34 | Pending |
| CAT-16 | Phase 35 | Complete |
| CAT-17 | Phase 36 | Pending |
| CAT-14 | Phase 36 | Pending |
| CAT-18 | Phase 37 | Pending |
| CAT-13 | Phase 38 | Pending |
| DISC-09 | Phase 39 | Pending |
| DISC-11 | Phase 39 | Pending |
| SRCH-16 | Phase 40 | Pending |
| FIT-05 | Phase 40 | Pending |
| SET-13 | Phase 41 | Pending |
| SET-14 | Phase 41 | Pending |
| DEBT-10 | Phase 42 | Pending |
| DEBT-11 | Phase 42 | Pending |
| DEBT-12 | unscheduled (opportunistic — next prod deploy needing drizzle-kit migrate) | Pending |

**Coverage: 17/17 v5.0 requirements mapped + 1 ad-hoc DEBT (DEBT-12) discovered during Phase 34 Wave 3 — pre-existing journal drift unrelated to v5.0 scope.**

---

*Last updated: 2026-05-08 — DISC-12 (Phase 33b north-star audit) inserted between Phase 33 and Phase 34 after mid-execution scope reframe. 17 requirements across 8 categories mapped to Phases 32–42.*
