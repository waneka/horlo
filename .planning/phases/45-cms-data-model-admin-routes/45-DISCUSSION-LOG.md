# Phase 45: CMS Data Model + Admin Routes - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-18
**Phase:** 45-cms-data-model-admin-routes
**Areas discussed:** Owner identity mechanism, Catalog-delete protection, Admin authoring UX, Curated list cover image, Path-type label

---

## Owner identity mechanism

### Q1 — How to identify the owner (assertOwner + RLS)

| Option | Description | Selected |
|--------|-------------|----------|
| is_admin column on profiles | Boolean on `profiles`; RLS uses EXISTS subquery; survives a future 2nd user with no migration | ✓ |
| is_owner() SQL function, hardcoded UUID | Single source for RLS + app; no profiles change but UUID literal in migration | |
| Env var OWNER_USER_ID | App-only; RLS still needs its own in-DB mechanism — most fragmented | |

### Q2 — Route guard for /admin/*

| Option | Description | Selected |
|--------|-------------|----------|
| app/admin/layout.tsx server check | Server-component layout checks is_admin, redirects non-owners; no middleware | ✓ |
| middleware.ts matcher | Root middleware matching /admin/*; new file/pattern | |

### Q3 — Bootstrapping is_admin

| Option | Description | Selected |
|--------|-------------|----------|
| Migration, keyed by owner email | Same migration sets is_admin via auth.users email lookup; works on local + prod | ✓ |
| Manual SQL step | Documented manual UPDATE per DB | |

**User's choice:** is_admin column + layout guard + email-keyed migration.
**Notes:** Owner identity is one column feeding three independent enforcement layers.

---

## Catalog-delete protection (CMS-09)

### Q1 — When to block deletion of a referenced catalog watch

| Option | Description | Selected |
|--------|-------------|----------|
| Any reference — FK ON DELETE RESTRICT | Plain FK RESTRICT; blocks draft or published references; no trigger; superset of criterion | ✓ |
| Published only — BEFORE DELETE trigger | Matches criterion #6 literally; adds a (likely SECDEF) trigger and ON DELETE behavior decisions | |

### Q2 — Handling the "admin UI warns" clause

| Option | Description | Selected |
|--------|-------------|----------|
| DB block is the Phase 45 deliverable | No catalog-watch delete surface in /admin/lists or /admin/paths to warn from | ✓ |
| Add catalog-watch management to this phase | Expands phase well beyond lists/paths CRUD | |

**User's choice:** FK RESTRICT (block any reference); DB block is the deliverable.
**Notes:** Accepted the over-strict tradeoff — can't delete a watch in a draft list — to stay trigger-free and orphan-proof.

---

## Admin authoring UX

### Q1 — Catalog watch picker

| Option | Description | Selected |
|--------|-------------|----------|
| Search-as-you-type picker | Typeahead reusing src/data/search.ts; scales into v5.2 expansion | ✓ |
| Searchable select over all rows | Client-side combobox over ~100 rows; grows awkward post-expansion | |
| Paste catalog ID / reference | Minimal UI, error-prone | |

### Q2 — Reorder UX

| Option | Description | Selected |
|--------|-------------|----------|
| Up/down arrow buttons | Writes an order field; no new dependency | ✓ |
| Drag-and-drop | Nicer UX but needs a new dnd library | |

### Q3 — Markdown editor

| Option | Description | Selected |
|--------|-------------|----------|
| Textarea + live preview pane | Raw markdown textarea + react-markdown preview; no new dependency | ✓ |
| Textarea only | No preview until the published page | |

**User's choice:** Typeahead picker + up/down buttons + textarea with live preview.
**Notes:** Minimal-dependency stance held throughout.

---

## Curated list cover image

### Q1 — How the cover image is set

| Option | Description | Selected |
|--------|-------------|----------|
| Device upload to Supabase Storage | Reuse Phase 43 pipeline into a new public bucket; predictable hosting + LCP | ✓ |
| Plain image-URL field | No upload UI; uncontrolled hosting/LCP — risky for the hero | |

### Q2 — Crop step

| Option | Description | Selected |
|--------|-------------|----------|
| No crop — object-cover at display | Store as-uploaded; fixed aspect-ratio container; Phase 43 crop is circular, not reusable | ✓ |
| Rectangular crop step | Owner controls framing; more UI work | |

**User's choice:** Device upload + no crop.
**Notes:** Cover image doubles as the Phase 47 hero image — upload chosen with LCP in mind.

---

## Path-type label (CMS-07)

### Q1 — Fixed vocabulary or free text

| Option | Description | Selected |
|--------|-------------|----------|
| Small fixed vocabulary | Closed set (Going Deeper / Branching Out / Trading Up / Filling a Gap); consistent chips | ✓ |
| Free text | Maximum flexibility but drifts; can't group | |

**User's choice:** Small fixed vocabulary.
**Notes:** Implemented as a text column + CHECK (not a pg enum) to avoid enum-dependent migration pain.

---

## Claude's Discretion

- `cms_settings` row shape for the hero pin; `HeroFeature` discriminated-union forward-compat shape.
- Order column scheme (dense reindex vs sparse/fractional).
- `cms-covers` bucket name and RLS folder policy.
- Final wording of the four path-type label strings.
- Which 10 watches/themes the seed paths cover (content authored at execution time).

## Deferred Ideas

None — discussion stayed within phase scope. Catalog-watch management UI and a rectangular cover-image crop were explicitly scoped out.
