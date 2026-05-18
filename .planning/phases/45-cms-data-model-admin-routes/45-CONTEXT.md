# Phase 45: CMS Data Model + Admin Routes - Context

**Gathered:** 2026-05-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the data foundation and owner-only authoring tools for v5.1's editorial
content. In scope (CMS-01 through CMS-10): five new tables
(`curated_lists`, `curated_list_items`, `collection_paths`,
`collection_path_nodes`, `cms_settings`) with RLS that exposes only published
content to non-owners; owner-gated `/admin/lists` and `/admin/paths` routes;
full CRUD for curated lists (title, curator name, cover image, markdown intro,
per-item commentary, draft/publish, hand-ordering) and collection paths (seed
watch + up to 3 follow-ons, rationale, path-type label); hero-pin write
machinery on `cms_settings`; a DB-layer block on deleting catalog watches
referenced by a list/path; and 10 seed collection paths authored through the
admin UI in published state.

Out of scope: all public-facing `/explore` rendering — the Explore shell,
Curated Lists Rail, Hero module, and "Where Collections Go" module are
Phases 46–47. This phase ships the data + authoring side only; the hero
*pin* is writable here but the hero *render* is Phase 47. No catalog-watch
management UI (only lists/paths CRUD).

</domain>

<decisions>
## Implementation Decisions

### Owner Identity & Route Guard — CMS-02

- **D-01:** Owner identity is a new **`is_admin` boolean column on
  `profiles`**. This is the single source of truth for BOTH layers: RLS
  write policies and the app-level `assertOwner()`. Chosen over a hardcoded
  UUID function or an env var because it survives a future second user with
  no migration — see the multi-user re-check flagged in the
  `project_db_wipeable_2026_05_09` memory note.
- **D-02:** RLS **write** policies on the five CMS tables gate on the owner
  via `EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid())
  AND is_admin)`. Wrap `auth.uid()` in `(SELECT ...)` for InitPlan
  optimization — matches the existing convention in
  `supabase/migrations/20260420000001_social_tables_rls.sql`.
- **D-03:** RLS **public-read** policies stay as decided pre-phase:
  `USING (status = 'published')` for non-owner reads, with an explicit
  `WHERE status = 'published'` repeated in every public-read DAL function
  (two-layer draft-leak defense). The owner additionally reads drafts via an
  owner-scoped SELECT policy (same `EXISTS` predicate as D-02).
- **D-04:** The owner's `is_admin` flag is set to `true` by the **same
  migration**, keyed by owner email:
  `UPDATE profiles SET is_admin = true WHERE id = (SELECT id FROM auth.users
  WHERE email = 'twwaneka@gmail.com')`. Email is the cross-DB-stable key —
  works identically on local and prod (catalog/profile ids diverge between
  DBs; see `project-catalog-id-divergence` memory). No manual SQL step.
- **D-05:** The request-level route guard is a **server-component
  `src/app/admin/layout.tsx`** that calls `getCurrentUser()`, checks
  `is_admin`, and `redirect()`s non-owners. No `middleware.ts` is
  introduced — the guard stays co-located with the routes.
- **D-06:** `assertOwner()` is still called at the start of **every** CMS
  Server Action independently of the layout guard (locked pre-phase —
  Server Actions are HTTP-callable and bypass layout gates). It reads the
  same `is_admin` column.

### Catalog-Delete Protection — CMS-09

- **D-07:** Deletion of a referenced catalog watch is blocked by a plain
  **FK `ON DELETE RESTRICT`** on `curated_list_items.catalog_id` and
  `collection_path_nodes.catalog_id` (both reference `watches_catalog.id`).
  No trigger, no SECURITY DEFINER function.
- **D-08:** RESTRICT blocks deletion whenever the watch is referenced by
  **any** list/path — draft or published. This is intentionally *stronger*
  than success criterion #6 (which requires published-referenced to be
  blocked); a superset that also satisfies it. Upside: a list/path item can
  never be silently orphaned; the "published vs draft" distinction needs no
  trigger logic.
- **D-09:** The "admin UI warns before such a delete" clause of criterion #6
  is satisfied structurally: there is **no catalog-watch delete surface**
  inside `/admin/lists` or `/admin/paths`, so there is nothing to warn from
  in this phase. The DB-layer block is the Phase 45 deliverable; any future
  catalog-watch admin surface attaches the warning then.
- **D-10 [note for planner]:** RESTRICT FKs from CMS tables onto
  `watches_catalog` will block a future bulk catalog wipe/TRUNCATE (cf.
  Phase 36 catalog wipes, v5.2 expansion). Not a Phase 45 problem, but flag
  it in the SUMMARY so a later catalog-mutation phase accounts for it.

### Admin Authoring UX — CMS-04, CMS-05, CMS-07

- **D-11:** Catalog watches are added to a list/path via a
  **search-as-you-type picker** (typeahead on brand/model) that reuses the
  existing catalog search layer (`src/data/search.ts`). Scales into the
  v5.2 catalog expansion — no full-table client load.
- **D-12:** All ordering — lists in the rail (CMS-05), items within a list
  (CMS-04), path nodes (CMS-07) — uses **up/down arrow buttons** that write
  an integer order column. No drag-and-drop, no new dnd dependency. Fits the
  project's deliberate minimal-dependency stance.
- **D-13:** Markdown intro copy (CMS-03) is edited in a **plain `<textarea>`
  with a live preview pane** rendered by `react-markdown` (toggle or side
  pane). No editor runtime, no WYSIWYG — consistent with the locked
  `react-markdown` "no editor runtime" decision.

### Cover Image — CMS-03

- **D-14:** A curated list's cover image is set by **device upload to a new
  public Supabase Storage bucket** (e.g. `cms-covers`), reusing the Phase 43
  upload pipeline: client-side EXIF strip + canvas re-encode + size guard,
  and the bucket-helper pattern from `src/lib/storage/catalogSourcePhotos.ts`
  / the avatar bucket. Predictable hosting + good LCP for the Phase 47 hero
  (the cover doubles as the hero image).
- **D-15:** **No crop step.** The image is stored as-uploaded; UI renders it
  in a fixed aspect-ratio container with `object-cover`. The Phase 43 crop
  component is circular-masked for avatars and is not reusable for
  rectangular covers — building a rectangular crop is out of scope.

### Path-Type Label — CMS-07

- **D-16:** The path-type label is a **small fixed vocabulary**, not free
  text. Seeded from this discussion (planner/user may refine the exact
  strings): **Going Deeper** (more of one genre), **Branching Out** (a new
  genre), **Trading Up** (higher tier), **Filling a Gap** (an unowned role).
  Consistent chips read as intentional editorial taxonomy and allow future
  grouping.
- **D-17:** Implement the constraint as a **`text` column + `CHECK`**, not a
  Postgres `enum`. A CHECK is far easier to evolve and avoids the
  enum-bound-dependent migration pain documented in the
  `project_drizzle_supabase_db_mismatch` memory note (query `pg_depend`
  before enum changes).

### Claude's Discretion

- Exact column names, indexes, and the `cms_settings` row shape for the
  hero pin (single-row settings table vs key/value) — planner's call.
- The `HeroFeature` data shape: SEED-008 wants a discriminated union on
  `format` accepting `featured_list` and `featured_collector` even though
  only `featured_list` is wired. Honor that forward-compat shape in the
  `cms_settings` / pin model.
- Whether the order column is a dense integer reindexed on each move, or a
  sparse/fractional scheme — up/down buttons work with either.
- The exact `cms-covers` bucket name and RLS folder policy (public read;
  owner-only write — mirror the Phase 43 avatar bucket policy).
- Final wording of the four path-type label strings.
- Which 10 watches/themes the seed paths cover (CMS-10) — content authored
  through the UI; the user supplies or approves the picks at execution time.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & Requirements
- `.planning/ROADMAP.md` § "Phase 45: CMS Data Model + Admin Routes" — phase
  goal, the ten CMS requirements, and seven success criteria.
- `.planning/REQUIREMENTS.md` — CMS-01 through CMS-10 requirement text.
- `.planning/seeds/SEED-008-v5.1-explore-redesign.md` § "Curated Lists Rail",
  § "Where Collections Go", § "Hero", § "Open Questions" (CMS approach) —
  defines the editorial modules this phase's data feeds, the `HeroFeature`
  discriminated-union requirement, and the `source` (`manual`|`computed`)
  field on paths.

### Prior Phase Context (locked decisions to respect)
- `.planning/phases/43-polish-pass/43-CONTEXT.md` § D-09/D-11 — the Supabase
  Storage upload pipeline (EXIF strip, canvas re-encode, size guard, bucket
  helper) that D-14 reuses for cover images.
- `.planning/phases/44-catalog-enrichment/44-CONTEXT.md` — establishes
  `watches_catalog` as the shared authoritative catalog the new FKs
  (D-07) reference.

### RLS & Migration Patterns
- `supabase/migrations/20260420000001_social_tables_rls.sql` — the
  established RLS naming convention (`{table}_{operation}_own`) and the
  `(SELECT auth.uid())` InitPlan-optimization wrapper. New CMS RLS follows it.
- `supabase/migrations/` (recent files, e.g. `20260518191301_*`) — the
  Supabase migration timestamp/naming convention the new migration must
  follow.

### Project Decisions (STATE.md ## Accumulated Context)
- `.planning/STATE.md` § "Key Decisions" — pre-phase locks: in-app `/admin/*`
  (no third-party CMS), `react-markdown@^10.1.0`, two-layer RLS pattern,
  `assertOwner()` in every CMS Server Action, SECURITY DEFINER grants need
  explicit `REVOKE EXECUTE FROM anon, authenticated`.

### Memory Notes (read before writing the migration)
- `project_drizzle_supabase_db_mismatch` — drizzle-kit push is LOCAL ONLY;
  prod uses `supabase db push --linked`; migration filename/ordering gotchas;
  enum-bound-dependent pain (drove D-17).
- `project-catalog-id-divergence` — local and prod ids diverge; key data
  steps by natural keys (drove D-04's email-keyed `is_admin` update).
- `project_supabase_secdef_grants` — applies only if any SECURITY DEFINER
  function is added (D-07's RESTRICT-FK approach avoids needing one).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/db/schema.ts` — `profiles` table (gets the `is_admin` column);
  `watches_catalog` (id, target of the new RESTRICT FKs); existing
  drizzle table/index patterns to mirror for the five CMS tables.
- `src/lib/auth.ts` — `getCurrentUser()` / `getCurrentUserFull()` /
  `UnauthorizedError`. `assertOwner()` builds on `getCurrentUser()` + an
  `is_admin` read.
- `src/data/search.ts` — catalog search layer the watch-picker typeahead
  (D-11) reuses.
- `src/data/` (e.g. `catalog.ts`, `profiles.ts`) — DAL pattern: typed
  functions, explicit `WHERE` predicates. New `curatedLists.ts` /
  `collectionPaths.ts` DAL modules follow it; public-read functions carry
  the explicit `status = 'published'` filter (D-03).
- `src/app/actions/profile.ts` — Server Action pattern: `'use server'`,
  `getCurrentUser()` in a try/catch, zod `.strict()` schema,
  `ActionResult<T>` return, `next/cache` revalidation. CMS Server Actions
  follow it + add `assertOwner()`.
- `src/lib/storage/catalogSourcePhotos.ts` + the Phase 43 avatar bucket —
  Supabase Storage bucket helper + RLS folder pattern reused for the
  `cms-covers` bucket (D-14).
- `supabase/migrations/` — where the schema + RLS + `is_admin` migration
  lands; pushed to prod via `supabase db push --linked`.

### Established Patterns
- RLS naming `{table}_{operation}_own`; `(SELECT auth.uid())` wrapper.
- Prod schema changes go through `supabase/migrations/` + `supabase db push
  --linked`; local uses drizzle push (the two diverge — see memory).
- Server Actions: strict zod schemas, `ActionResult`, toast feedback.
- App Router: server-component layouts for gating; `'use client'` only where
  state is needed.

### Integration Points
- `profiles.is_admin` ← migration (D-04); read by `assertOwner()` + RLS + the
  `/admin` layout guard.
- New FKs: `curated_list_items.catalog_id` → `watches_catalog.id` and
  `collection_path_nodes.catalog_id` → `watches_catalog.id`, both
  `ON DELETE RESTRICT` (D-07).
- `cms_settings` hero-pin row ← pin/clear Server Actions here; ← read by the
  Phase 47 hero render. Pin write paths must `revalidateTag('explore:hero')`
  (pre-phase lock) — relevant when the pin action is built.
- New `cms-covers` Supabase Storage bucket ← cover-image uploads.

</code_context>

<specifics>
## Specific Ideas

- The owner check must be defense-in-depth: route-layout guard (D-05) AND
  `assertOwner()` in every Server Action (D-06) AND RLS write policies
  (D-02) — three independent layers, all keyed off the same `is_admin`
  column. None is sufficient alone.
- The catalog-delete block is intentionally over-strict (D-08): block on
  *any* reference, not just published. The user accepted that you can't
  delete a catalog watch sitting in a draft list without first removing it
  from the draft — that tradeoff buys a trigger-free, orphan-proof model.
- The list cover image and the Phase 47 hero image are the same asset —
  D-14's "upload, don't paste a URL" choice was made with the hero's LCP
  budget in mind.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. Catalog-watch management UI was
explicitly scoped out (D-09); a rectangular cover-image crop was scoped out
(D-15); both can resurface as their own future work if needed.

</deferred>

---

*Phase: 45-CMS Data Model + Admin Routes*
*Context gathered: 2026-05-18*
