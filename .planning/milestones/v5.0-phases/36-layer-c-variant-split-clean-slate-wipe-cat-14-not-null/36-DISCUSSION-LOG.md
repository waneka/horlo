# Phase 36: Layer C — Variant Split + Clean-Slate Wipe + CAT-14 NOT NULL - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-11
**Phase:** 36-layer-c-variant-split-clean-slate-wipe-cat-14-not-null
**Areas discussed:** Wipe-runbook scope, Variant table shape (incl. FK semantics + RLS), Variant population strategy, CAT-14 pre-flight safety net

---

## Pre-discussion framing (user-requested)

User asked Claude to briefly explain the phase and give context for why it's needed before going through any questions. Claude provided a one-page explainer covering:
- Position in the v5.0 catalog hierarchy arc (Brand → Family → Reference → **Variant** ← here)
- Why the hierarchy split matters: unifies owner counts, unblocks lineage browse "N variants" rendering, fixes similarity engine over-distinguishing across variants
- Why CAT-14 bundles with Layer C: clean-slate wipe (now Phase 35's job) was the path to 100% catalog coverage, which CAT-14 requires
- User-facing value: unified owner counts, "N known variants" affordance, no orphan watches after CAT-14
- What does NOT ship: variant UI (Phase 39), variant CRUD admin (locked out for v5.0), sub-family chains (future), engine taste-rewire (Phase 38)

Major scope shift surfaced: Phase 35 D-02 already TRUNCATEd watches and watches_catalog, which obsoletes most of ROADMAP success #2's 6-step runbook. Set up Area 1 as the consequential discussion.

---

## Area 1 — Wipe-runbook scope after Phase 35

| Option | Description | Selected |
|--------|-------------|----------|
| Shrink to verify + re-link + flip | Drop (a)–(c) as inherited from Phase 35. Keep (d) idempotent re-link, (e) zero-NULL verify, (f) CAT-14 flip. Document obsolesced steps in CONTEXT.md. | ✓ |
| Preserve full 6-step runbook as no-op verification | Keep all 6 steps in deploy runbook even though most are no-ops. Heavier docs cost; complete audit trail. | |
| Drop the wipe runbook entirely; ship variants + CAT-14 only | Acknowledge Phase 35 absorbed the wipe. Phase 36 becomes purely additive: variants + variant_id FK + CAT-14 flip. | |

**User's choice:** Shrink to verify + re-link + flip (Recommended).
**Notes:** Decision recorded as D-01. Steps (a)(b)(c) inherited from Phase 35 D-02; (d)(e)(f) executed in Phase 36.

---

## Area 2 — Variant table shape & overlap with Phase 35

### Sub-area 2a: Column shape

| Option | Description | Selected |
|--------|-------------|----------|
| Lock to ROADMAP-3 + name/slug | id, catalog_id FK NOT NULL, name, slug, dial_color, bezel, bracelet_variant, image_url, timestamps. UNIQUE on (catalog_id, slug). Matches ROADMAP + adds name/slug for human identity + URL stability. | ✓ |
| Lock to ROADMAP-3 only (strictest) | Just id, catalog_id FK, dial_color, bezel, bracelet_variant, timestamps. Cheapest schema; forces a follow-up ALTER TABLE in Phase 39 for name/slug. | |
| Expand to mirror watches_catalog (richer) | Include case_material, production_year_start/end, production_year_is_estimate as nullable overrides on top of ROADMAP-3. Heavier schema. | |

**User's choice:** Lock to ROADMAP-3 + name/slug (Recommended).
**Notes:** Decision recorded as D-02. Slug is NOT a GENERATED column (Phase 34 D-01b rationale: URL stability across name edits). Phase 19.1 LLM enrichment columns stay on catalog only — per-Reference taste, not per-Variant taste.

### Sub-area 2b: `watch_variants.catalog_id` ON DELETE behavior

| Option | Description | Selected |
|--------|-------------|----------|
| ON DELETE RESTRICT | Block catalog DELETE if variants exist. Mirrors Phase 34 D-02 / Phase 35 D-04. Safest. | ✓ |
| ON DELETE CASCADE | Auto-delete variants when catalog row deleted. Risky; no precedent. | |

**User's choice:** ON DELETE RESTRICT (Recommended).
**Notes:** Decision recorded as D-03.

### Sub-area 2c: `watches.variant_id` ON DELETE behavior

| Option | Description | Selected |
|--------|-------------|----------|
| ON DELETE SET NULL | Watch stays in user's collection; loses variant association. Mirrors `watches.catalog_id` (Phase 17 D-04). | ✓ |
| ON DELETE RESTRICT | Block variant deletion if any user owns it. Heavier admin workflow. | |

**User's choice:** ON DELETE SET NULL (Recommended).
**Notes:** Decision recorded as D-04. User never loses their watch due to admin curation.

### Sub-area 2d: `watches.variant_id` nullability + RLS pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Nullable, public-read + service-role-write RLS | variant_id nullable; standard RLS pattern from Phase 34/35; co-located in same migration. | ✓ |
| NOT NULL after backfill (stricter) | Three-step migration discipline applied; risk of long-lived "we'll flip it eventually" tail. | |

**User's choice:** Nullable, public-read + service-role-write RLS (Recommended).
**Notes:** Decision recorded as D-05. `watches.variant_id` NOT NULL flip is explicitly NOT scheduled because variants will likely never hit 100% coverage.

---

## Area 3 — Variant population strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Ship empty; defer all population to Phase 39 | No seed file, no backfill script, no anchor rows. Mirror Phase 34 D-03 ("ship empty, seed in next phase"). Lightest scope. | ✓ |
| Ship anchor seed + idempotent backfill script | Mirror Phase 35 D-12 lineage pattern. Anchor variants on Submariner (Kermit/Hulk/Cermit) + GMT Pepsi. Vacuous against empty catalog. | |
| Auto-decompose existing fragmented catalog rows | Moot — Phase 35 D-02 already wiped; catalog is canonical. No work to do. | |

**User's choice:** Ship empty; defer all population to Phase 39 (Recommended).
**Notes:** Decision recorded as D-06. Phase 39 owns the seed file + backfill script + anchor seed alongside the lineage/variant browse UI (Phase 33b Q2 verdict).

---

## Area 4 — CAT-14 NOT NULL flip safety net

Context check: `addWatch` calls `upsertCatalogFromUserInput()` which always creates/finds a catalog row. NULL catalog_id should be impossible in practice for watches added since Phase 35 wiped. The pre-flight is for the unexpected.

| Option | Description | Selected |
|--------|-------------|----------|
| Hard-fail + manual recovery | Migration aborts via DO $$ RAISE EXCEPTION. Deploy runbook documents step-by-step recovery (inspect NULLs → re-run db:backfill-catalog or manual upsert → retry). Preserves curation discipline. | ✓ |
| Auto-backfill inside the migration transaction | Pre-flight runs backfill logic before NULL check. Silently creates user_promoted rows; loses curation discipline. | |
| Skip flip; defer CAT-14 to v5.x | Phase 36 ships variants only. Splits the originally-bundled CAT-17+CAT-14 work; reduces v5.0 scope. | |

**User's choice:** Hard-fail + manual recovery (Recommended).
**Notes:** Decision recorded as D-07. Preserves Phase 17 + Phase 35's "every catalog row was deliberately canonical" invariant. Auto-creating user_promoted rows would lose curation discipline.

---

## Claude's Discretion

None. User selected the recommended option on every question across all 4 areas. D-01 through D-07 are all user-confirmed.

## Deferred Ideas

Captured in CONTEXT.md `<deferred>` section. Highlights:
- Variant population (seed + backfill + anchors) → Phase 39 per D-06
- Variant browse UI / `/watch/{ref}/{slug}` route → Phase 39 per Phase 33b Q2
- Admin UI for variant CRUD → locked out for v5.0
- `watches.variant_id` NOT NULL flip → not scheduled (coverage will never hit 100%)
- Auto-decompose fragmented catalog rows → moot per Phase 35 D-02
- Per-variant LLM taste enrichment → variants inherit Reference taste; future phase if drift signals emerge
- Production-year columns on variants (Kermit 2003–2010) → curator notes for now, future v5.x columns if needed
- GIN trigram indexes on variant names → if variant-search becomes a feature
- Auto-backfill orphan watches inside the migration → rejected per D-07
