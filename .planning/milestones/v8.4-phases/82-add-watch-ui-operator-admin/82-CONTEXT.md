# Phase 82: Add-Watch UI + Operator Admin - Context

**Gathered:** 2026-07-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 82 closes v8.4's user-facing loop by:

1. **UI-01 — Brand-picker autocomplete on structured entry.** `StructuredEntryPanel`'s Brand field (`src/components/watch/StructuredEntryPanel.tsx` L220) swaps its raw `<Input>` for a dedicated `BrandPicker.tsx` component built on the same `@base-ui/react/combobox` primitive `SearchEntry` uses. Options sourced from an SSR-fetched `{ id, name }[]` list — no per-keystroke round-trip. Selecting a brand attaches its `brand_id` to the eventual catalog upsert path (already wired via Phase 80 D-80-01 resolver + Phase 81 D-81-01 canonical-name overwrite).

2. **UI-02 — "Couldn't find" affordance inside the picker.** When the client-side filter returns zero matches AND the typed string is non-empty, the picker's popup shows a footer button labeled verbatim `Couldn't find that brand — add as "{typed}"` (roadmap language quoted exactly). Clicking it closes the popup and locks the typed string as the picker's value. On subsequent "Find specs" click, `/api/extract-watch` (mode='structured') runs — the existing Phase 80 `resolveBrandId` inside its upsert path auto-creates a `brands` row with `needs_review = true` (no new client-server surface). Silent per D-80-04 — no toast, no envelope field, no inline hint. User flow never blocks.

3. **UI-03 — WatchForm brand/model become read-only display strings resolved through `catalogId`.** For watches with `catalogId != null` (the ~100% case post-Phase-80), `WatchForm.tsx` L328–355 renders the canonical `brands.name` / `watch_families.name` as read-only chips (mirroring the Phase 20.1 D-12 status-chip pattern already used at L373–380). Legacy `catalogId = null` rows keep the existing free-text `<Input>`s as a compatibility fallback. When the viewer is BOTH the watch owner AND `is_admin = true`, an "Edit catalog mapping" link cluster renders: "Edit brand" → `/admin/brands#brand-{brandId}`, "Edit family" → `/admin/families?brandId={brandId}`.

4. **OPS-01 — `/admin/brands` needs_review queue.** Server component fetching `SELECT * FROM brands ORDER BY needs_review DESC, name ASC`. Reuses the existing admin layout (`src/app/admin/layout.tsx` — `assertOwner()` guard, `AdminSubNav` gets `Brands` + `Families` tabs added). Per-row Card mirrors `ListIndexClient.tsx` pattern (L145–220): brand metadata + three inline actions — "Confirm as new" (flips `needs_review = false`), "Rename" (edit-name Dialog with `slug` regeneration), "Merge into…" (Dialog with `BrandPicker` for target selection + pre-flight family-handling prompt when source has referencing families). All actions are Server Actions under `src/app/actions/cms/brands.ts` gated by `assertOwner()` (SOLE write gate per Phase 45 D-06 CMS pattern).

5. **OPS-02 — `/admin/families` mirrors OPS-01 for `watch_families` and adds "Add alias".** Same queue shape scoped to families; family rows include their `aliases text[]` current values as removable chips. "Add alias" Dialog shows current aliases as chips + input + "Add alias" button. Append is de-duped against existing aliases via `@>` containment (matches Phase 80 D-80-02 tier-2 lookup); duplicates silently no-op. Removable chips call an "Remove alias" Server Action that UPDATEs the array minus the removed string. Aliases feed straight back into Phase 80's resolver alias tier — operator-added aliases immediately route future ingests.

**Explicitly NOT in this phase:**

- No schema migrations. All schema (`aliases text[]`, `needs_review boolean`, `brand_id`/`family_id` NOT NULL) already shipped in Phases 78–80.
- No changes to the `resolveBrandId` / `resolveFamilyId` resolver contract (`src/data/catalog-resolver.ts`). Phase 82 CALLS these unchanged; the resolver is Phase 80's frozen surface.
- No changes to Phase 81's `addWatch` / `editWatch` canonical-name overwrite path. The picker's `brand_id` selection reaches the DB through the already-shipped Phase 81 code path (via `/api/extract-watch` → `upsertCatalogFromUserInput` → resolver → catalog upsert → return canonical brand name → `addWatch` overwrites `watches.brand`).
- No new user-facing "request a catalog fix" surface for non-admin owners. Non-admin viewers of their own watch see the read-only display strings but no admin link.
- No bulk multi-select queue actions (deferred; single-row Card + Dialog is enough at current volume).
- No `/admin/brands/{id}` deep-page for a single brand. Queue + inline dialogs cover the OPS-01/02 acceptance criteria.
- No promotion/demotion of `needs_review` on rows other than by explicit operator action. The queue is a triage surface, not an auto-cleaner.
- No changes to `SearchEntry.tsx`. It stays the watch-search combobox; `BrandPicker.tsx` is a sibling, not a refactor.

Phase 82 succeeds when: (i) a real user adds a watch by typing an unknown brand, sees the "Couldn't find — add as X" affordance, clicks Find specs, and the flow completes without blocking — a `brands` row with `needs_review = true` appears in `/admin/brands` afterward; (ii) editing an existing catalog-linked watch shows read-only canonical strings and (if admin+owner) the "Edit catalog mapping" link cluster that deep-links to the right rows; (iii) `/admin/brands` renders the `needs_review = true` rows at top, and the operator can confirm-as-new / rename / merge with correct transactional semantics; (iv) `/admin/families` mirrors OPS-01 plus a working add-alias / remove-alias UX whose changes take immediate effect on the next ingest via Phase 80's alias tier.

</domain>

<decisions>
## Implementation Decisions

### Brand-picker component shape

- **D-82-01: Ship a new dedicated `src/components/watch/BrandPicker.tsx`** (per Area 1a discussion). ~120 lines, focused, no image thumbs / owner counts / viewerState pills. Uses the same `@base-ui/react/combobox` primitive as `SearchEntry` with the same controlled-open pattern (`inputValue` + `onInputValueChange` with `details.reason !== 'input-change'` guard; controlled `open` + `onOpenChange`). Component props: `brands: { id: string; name: string }[]`, `value: { id: string; name: string } | null`, `onChange(next)`, `onCouldntFind(typed: string)` for the UI-02 affordance emit. Mounts inside `StructuredEntryPanel` REPLACING the raw `<Input id="se-brand">` at L220–228.
  - Why not generalize into `src/components/ui/typeahead.tsx`: adds SearchEntry refactor surface + a second consumer's-worth of coupling risk without buying anything today. The next typeahead (merge-target family picker) is inside this same phase and can reuse `BrandPicker.tsx` for brands specifically; family picker gets a similar sibling if needed.
  - Why not `mode='brand'` variant on SearchEntry: SearchEntry has controlled-open + no-match footer state that would branch per mode. Fork-in-place makes the file harder to reason about.
  - Cost: one new file, one new test file, one prop-drill line through `AddWatchFlow.tsx` (already threads `catalogBrands`, adding a second `brandsWithIds` list is trivial).

### Brand list fetch strategy

- **D-82-02: SSR-fetch the full `{ id, name }` brand list once per `/watch/new` request; client filters via substring match** (per Area 1b discussion). Extend the existing DAL: rename `listCatalogBrands()` → `listCatalogBrandNames()` (keep the string[] shape for `parseSearchQuery`'s longest-prefix matcher) AND ship a new sibling `listBrands(): Promise<{ id: string; name: string }[]>` that SELECTs from `brands` table (ORDER BY name ASC). Prop-drill through `AddWatchFlow` → `StructuredEntryPanel` → `BrandPicker`. No `'use cache'` (matches existing `listCatalogBrands` decision at L1059–1063 — brand list is cheap + per-request-fresh).
  - Why not `/api/brands?q=` server-fetch on keystroke: ~100 brands today, grows slowly. Client-filter is 0 round-trips + instant. If catalog grows past 500 brands, revisit.
  - Why not hybrid: premature.
  - `parseSearchQuery` continues to consume the DENORM string list (`listCatalogBrandNames`). Its longest-prefix match doesn't need canonical `brand_id`s. Post-v8.4 all catalog rows are canonical so the string list is safe.
  - The `SearchEntry`-consumed `catalogBrands: string[]` prop stays. `BrandPicker` gets a new `brands: { id: string; name: string }[]` prop. Both flow from `/watch/new` page's `Promise.all(...)`.

### UI-02 auto-create timing + feedback

- **D-82-03: Auto-create fires on "Find specs" click via the existing `/api/extract-watch` route** (per Area 2a discussion). The affordance click is UX-only: it closes the popup and locks the typed string as the picker's `value` (but keeps `value.id = null`). When user then clicks "Find specs", the panel POSTs to `/api/extract-watch` (mode='structured') as it does today. Inside the route's upsert path, `resolveBrandId('X')` runs — since 'X' has no match, tier 3 auto-creates a `brands` row with `needs_review = true` and returns its `brand_id`. Zero new route surface; zero new state on the picker; the flow is IDENTICAL to typing an unknown brand and clicking Find specs today, plus the UX affirmation of the affordance.
  - Why not a dedicated `/api/brands/resolve` route: adds a route + client-fetch layer for a UX improvement that the existing route already accomplishes. The picker's "brand_id" won't reach the client between the affordance click and Find specs; the flow doesn't need it (the resolver runs server-side inside extract-watch).
  - Why not fire on addWatch submit only: the affordance's purpose is to reassure the user in the moment. Firing on submit is too late; the user has already left the picker.

- **D-82-04: Silent — no client-visible signal that a new brand was auto-created** (per Area 2b discussion). Mirrors Phase 80 D-80-04. The affordance click IS the confirmation (user explicitly opted in). No toast on commit, no envelope field on `/api/extract-watch`, no inline hint. Operator sees the `needs_review = true` row in `/admin/brands` after the fact — that's the cleanup surface.

- **D-82-05: Affordance copy is verbatim `Couldn't find that brand — add as "{typed}"`, placed as a sibling of `Combobox.List` inside the Popup, not inside the list** (per Area 2c discussion). Mirrors `SearchEntry`'s SRCH-03 lesson (footer placed OUTSIDE `Combobox.List` to preserve native click semantics; L326 pattern). Gate: `filteredBrands.length === 0 && typed.trim().length > 0`. Full-width button, min-h-[44px] for tap target, ghost variant, muted-foreground text.

### UI-03 WatchForm read-only + admin link

- **D-82-06: Read-only rendering gates on `watch.catalogId != null`** (per Area 3a discussion). When present: brand + model fields render as read-only chips using the Phase 20.1 D-12 status-chip pattern (`<div aria-readonly="true" className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm capitalize">{watch.brand}</div>`). When null (rare post-Phase-80, only ON DELETE SET NULL edge case from Phase 17): keep existing free-text `<Input>`s at `WatchForm.tsx` L328–355 unchanged. Reason: Phase 81 auto-overwrite doesn't apply when `catalogId = null` (no FK to resolve); locking those fields would strand the user with no way to fix a typo.

- **D-82-07: "Edit catalog mapping" link visibility gates on owner AND is_admin=true** (per Area 3b discussion). Thread viewer's `is_admin` server-side (mirror the SEED-018 pattern at `src/app/watch/new/page.tsx` L100–104: `supabase.from('profiles').select('is_admin')`). WatchForm accepts a new prop `viewerIsAdmin: boolean` and the existing `mode: 'edit'` check + the watch's ownership check (already established through the route guard on `/watch/[id]/edit`). Link renders ONLY when `mode === 'edit' && watch.catalogId != null && viewerIsAdmin`. Non-admin owners see the read-only chips without the link.

- **D-82-08: Two-link cluster with deep-linking to `/admin/brands#brand-{brandId}` and `/admin/families?brandId={brandId}`** (per Area 3c discussion). Cluster copy: "Edit brand" and "Edit family" as ghost-variant `<Button render={<Link .../>}>` chips below the read-only display chips. `/admin/brands` page scrolls-to + highlights (background flash for 1s) the row with matching `id={brandId}` on mount. `/admin/families` page reads `?brandId` query param and pre-filters the queue to that brand's families. Minor page-side wiring (`useEffect` scroll + `useSearchParams` filter).

### /admin queues shape (OPS-01/02)

- **D-82-09: Per-row Card + inline action buttons + Dialog for merge** (per Area 4a discussion). Mirrors `ListIndexClient.tsx` L145–220 verbatim as a pattern: each row = `<Card><CardContent className="pt-4"><div className="flex items-start gap-3">…</div></CardContent></Card>`, `needs_review = true` rows floated to top (`ORDER BY needs_review DESC, name ASC` in the DAL). Actions inline: "Confirm as new" button (immediate — flips `needs_review=false`, refresh via `router.refresh()` after Server Action + `revalidatePath('/admin/brands')`), "Rename" button (opens edit-name Dialog), "Merge into…" button (opens merge Dialog with `<BrandPicker>` target picker). Layout scoped to `max-w-2xl` inherited from `admin/layout.tsx`. `AdminSubNav.tsx` grows two new links: `Brands` (`/admin/brands`) and `Families` (`/admin/families`).

- **D-82-10: Merge-target picker reuses `<BrandPicker>` verbatim** (per Area 4b discussion). Same component. Dialog embeds `<BrandPicker brands={allBrandsExceptSource} value={target} onChange={setTarget} />`. Filter out the source row client-side. Zero new component. For `/admin/families`, a sibling `<FamilyPicker>` (same shape, `watch_families.name` scoped to a fixed `brandId`) may be needed if merge-family-into-family is required — planner picks whether OPS-02 needs family-merge at all (roadmap language emphasizes rename + alias + confirm; family-merge is not enumerated in the OPS-02 criterion). Recommend: OPS-01 = brand merge (spec'd), OPS-02 = family rename + add alias + confirm (no family-merge for MVP).

- **D-82-11: OPS-02 "Add alias" as a small Dialog with input + existing aliases as removable chips + append (dedup)** (per Area 4c discussion). Dialog content: (a) header lists current aliases as `<Badge variant="secondary">` chips with an inline `<Button size="icon-sm" variant="ghost">×</Button>` for removal, (b) `<Input>` for new alias + `<Button>Add alias</Button>` action, (c) each add appends normalized string (`trim().toLowerCase()`) to the `aliases text[]` via `UPDATE watch_families SET aliases = aliases || ARRAY[$1] WHERE id = $2 AND NOT (aliases @> ARRAY[$1])`. Dedup silently — user re-adding an existing alias is a no-op. Remove-chip calls `UPDATE watch_families SET aliases = array_remove(aliases, $1) WHERE id = $2`. Both actions revalidate `/admin/families`.

- **D-82-12: Merge pre-flight counts families with `brand_id = source.id`; if >0, dialog asks operator whether to move all families to target OR cancel** (per Area 4d discussion). Two-radio flow: (a) "Move all N families to target" (default — one transaction: `UPDATE watches_catalog SET brand_id=target WHERE brand_id=source; UPDATE watch_families SET brand_id=target WHERE brand_id=source; DELETE FROM brands WHERE id=source`), (b) "Cancel — I'll resolve families first" (dismisses the dialog). When source has zero families, skip the pre-flight prompt and merge in one step (`UPDATE watches_catalog … + DELETE FROM brands …`). All in a single transaction via `db.transaction()`. Error paths surface via toast; success revalidates `/admin/brands` + `/admin/families`.

### Server Action pattern

- **D-82-13: New file `src/app/actions/cms/brands.ts` mirrors `src/app/actions/cms/collectionPaths.ts` structure** (implicit from CMS convention). Every action starts with `try { await assertOwner() } catch { return { success: false, error: 'Not authorized' } }`. Uses `db` client (bypasses RLS — canonical CMS pattern per D-06 comment in `collectionPaths.ts` L2–8). Actions: `confirmBrandAsNew(id)`, `renameBrand(id, name)`, `mergeBrand(sourceId, targetId, moveFamilies: boolean)`. Zod schemas with `.strict()` for mass-assignment protection. Revalidate `/admin/brands` + `revalidateTag` (research picks the specific tag surface). Same convention for `src/app/actions/cms/families.ts`: `confirmFamilyAsNew(id)`, `renameFamily(id, name)`, `addFamilyAlias(id, alias)`, `removeFamilyAlias(id, alias)`.

- **D-82-14: Slug regeneration on rename.** `brands.slug` has `unique('brands_slug_unique')`. Rename must regenerate slug via `slugifyWithRandomSuffix(name)` (existing helper — `src/lib/slug.ts`, already used by Phase 80 resolver at `catalog-resolver.ts:5`). Same pattern for `watch_families.slug` (nullable — planner decides whether rename regenerates or leaves null).

### Claude's Discretion

- **Exact scroll-to + highlight implementation for `/admin/brands#brand-{brandId}` deep-link.** `useEffect` with `window.location.hash` + `scrollIntoView` + a `data-highlighted` attribute driving a Tailwind background-pulse. Planner picks the exact CSS animation and cleanup timing.
- **Whether `AdminSubNav` becomes 4 links or splits into two sub-navs.** Today it has 2 links (`Lists` + `Paths`). Adding `Brands` + `Families` gives 4. Planner may keep flat 4 or add a nested tab structure per section. Recommend flat 4 for MVP.
- **Whether OPS-02 gains family-merge as opportunistic scope.** Roadmap OPS-02 language is narrower (rename + add alias + confirm). Merge is only spec'd for OPS-01 (brands). Planner may add family-merge if it's near-zero-cost, but shouldn't block the phase on it.
- **Whether existing `SearchEntry` catalog-search still uses `listCatalogBrandNames()` (renamed from `listCatalogBrands()`) or switches to the new `listBrands()` at the same time.** Both work; the string[] path is fine as-is. Planner picks whether to consolidate.
- **Test surface split: unit tests for `BrandPicker` (client-filter + affordance emit) vs integration tests for the /admin queue Server Actions (against local Supabase).** Planner picks vitest vs local-fixture integration split.
- **Whether to add a `SlugField` primitive** to expose slug-preview in rename dialogs. Not strictly needed (slug is generated). Nice-to-have if operator wants to see the URL that results.
- **`aliases` normalization consistency.** D-82-11 chose `trim().toLowerCase()`. This must match the resolver's tier-2 alias lookup (`WHERE aliases @> ARRAY[lower(trim($1))]`). Planner verifies the exact SQL shape in `catalog-resolver.ts` L47 and mirrors it.

### Folded Todos

None folded. `drizzle-kit-pg-net-introspection-bug.md` (score 0.6) is orthogonal — a drizzle-kit tooling issue unrelated to UI/admin work.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### v8.4 Milestone Inputs (mandatory)

- `.planning/REQUIREMENTS.md` — full milestone decisions D-01..D-08, UI-01/02/03 + OPS-01/02 requirement language (L75–84), "Out of Scope" table. D-07 "reuse v5.1 admin CMS pattern from Phase 47" is the pattern anchor; D-05 defines the resolver contract Phase 82 calls (not modifies).
- `.planning/ROADMAP.md` § Phase 82 (L368–379) — 5 success criteria. Roadmap language on UI-02 ("Couldn't find that brand — add as '{typed}'") is the verbatim copy source for D-82-05.
- `.planning/seeds/SEED-021-catalog-brand-model-canonicalization.md` — origin signal. Phase 82 delivers the "admin-review queue + user-facing lock" half of SEED-021.

### Phase 78–81 Carryforward (mandatory)

- `.planning/phases/78-schema-additions-operator-resolve-queue/78-CONTEXT.md` — Phase 78's D-78-02 grammar (`auto-resolved` / `merge:<uuid>` / `new` / `skip`) is the semantic ancestor of Phase 82's queue actions. D-78-04 exact-only-auto-resolve philosophy = "when in doubt, queue it" applies to Phase 82's Confirm/Rename/Merge triage. Ships `aliases text[]` (empty) + `needs_review boolean` (default false) columns that Phase 82's queues render.
- `.planning/phases/80-not-null-constraint-flip-ingest-hardening/80-CONTEXT.md` — Phase 80's D-80-01/02 resolver contract Phase 82's UI-02 affordance path CALLS unchanged; D-80-04 silent-response semantics Phase 82's D-82-04 mirrors; auto-create with `needs_review=true` is the QUEUE PRODUCER Phase 82 consumes.
- `.planning/phases/81-recommender-display-server-action-swap/81-CONTEXT.md` — Phase 81's D-81-01 (`addWatch`/`editWatch` canonical name overwrite via extended `upsertCatalogFromUserInput` / `getCatalogById` return) is the DOWNSTREAM path the picker's `brand_id` flows into. D-81-02 (`Watch.brandId?` + `Watch.familyId?` on the domain type) is what UI-03 read-only display reads to render canonical strings on catalog-linked watches.
- Phase 45 admin CMS pattern (`.planning/phases/` archive if extant — see `.planning/milestones/*` archives) — reused-as-canonical. Phase 82 does NOT invent a new admin surface; it grows the existing pattern.

### Existing Code (mandatory — Phase 82 modifies these directly)

- `src/app/admin/layout.tsx` — `assertOwner()` layout guard + `redirect('/')` on failure + `max-w-2xl px-4 py-8` layout. Phase 82's `/admin/brands` and `/admin/families` inherit this layout by living under `src/app/admin/{brands,families}/page.tsx`. Do NOT modify the layout.
- `src/components/admin/AdminSubNav.tsx` — 2-link ghost-button nav (`Curated Lists`, `Collection Paths`). Phase 82 EXTENDS `NAV_LINKS` to 4 links (add `Brands` → `/admin/brands`, `Families` → `/admin/families`). Preserves the `underline underline-offset-4 font-semibold text-foreground` active-state pattern.
- `src/components/admin/ListIndexClient.tsx` (L145–220) — the CANONICAL Card + inline actions + Dialog pattern Phase 82's queue components mirror. Copy the row structure verbatim (`<Card><CardContent className="pt-4"><div className="flex items-start gap-3">…</div></CardContent></Card>`), swap Curated-List metadata for Brand/Family metadata, swap `moveListUp` / `moveListDown` / `deleteCuratedList` for `confirmBrandAsNew` / `renameBrand` / `mergeBrand`.
- `src/app/actions/cms/collectionPaths.ts` (L1–80) — the CANONICAL Server Action file structure Phase 82's `src/app/actions/cms/brands.ts` and `src/app/actions/cms/families.ts` mirror. `assertOwner()` first, `.strict()` Zod schemas, `revalidatePath` on success, `console.error` on catch, `ActionResult<T>` return.
- `src/components/watch/StructuredEntryPanel.tsx` (L220–228) — Brand `<Input>` replaced by `<BrandPicker>`. Panel gains a new prop `brands: { id: string; name: string }[]` (prop-drilled from `AddWatchFlow`). Panel's cache key + POST body construction unchanged (still sends `brand: brand.trim()` string to `/api/extract-watch`; the picker just constrains what the user CAN type).
- `src/components/watch/WatchForm.tsx` (L328–355) — Brand + Model fields become read-only chips when `watch.catalogId != null`. Add new prop `viewerIsAdmin: boolean`. Below the chips (or beside them, planner picks), render the "Edit catalog mapping" link cluster when `mode === 'edit' && watch.catalogId != null && viewerIsAdmin`.
- `src/components/watch/AddWatchFlow.tsx` (L75, L90) — thread a new `brandsWithIds: { id: string; name: string }[]` prop alongside the existing `catalogBrands: string[]`. Prop-drill to `StructuredEntryPanel` at L639 region.
- `src/app/watch/new/page.tsx` (L95–102) — extend the `Promise.all(...)` to include `listBrands()` alongside `listCatalogBrands()` (renamed to `listCatalogBrandNames()`). Prop-drill `brandsWithIds` and `catalogBrandNames` through `<AddWatchFlow>`.
- `src/data/catalog.ts` (L1045–1081) — rename `listCatalogBrands()` → `listCatalogBrandNames()` (keep the string[] shape for `parseSearchQuery`). Ship new sibling `listBrands(): Promise<{ id: string; name: string }[]>` that SELECTs `id, name` FROM `brands` ORDER BY name ASC.
- `src/lib/auth.ts` (L70–79) — `assertOwner()` already returns the caller's `{ id, email }` post-admin-check. Phase 82 relies on this unchanged. WatchForm's `viewerIsAdmin` prop is threaded through the page, not re-checked in the component.

### Existing Code (read-only — Phase 82 reads these, doesn't modify)

- `src/data/catalog-resolver.ts` (L54, L207) — `resolveBrandId` + `resolveFamilyId` are Phase 80's frozen contract. Phase 82's UI-02 auto-create path relies on `resolveBrandId`'s tier-3 auto-create + `needs_review=true` write. DO NOT MODIFY.
- `src/data/recommendations.ts` (L164–165) — `SELECT id, name FROM brands` pattern reference. Phase 82's `listBrands()` uses the same shape.
- `src/components/watch/SearchEntry.tsx` (L202–338) — the CANONICAL `@base-ui/react/combobox` pattern reference for `BrandPicker`. Copy the controlled-open (`inputValue` + `onInputValueChange` with `details.reason !== 'input-change'` guard, controlled `open` + `onOpenChange`), the `filter={null}` + `filteredItems={results}` disabling of internal string-match. DO NOT MODIFY SearchEntry itself.
- `src/db/schema.ts` (L519–564) — `brands` and `watchFamilies` table shapes. `needsReview` (default false), `aliases` (default `'{}'`) columns are Phase 82's queue-render fields. `brands.slug` UNIQUE + `watchFamilies.slug` nullable. `watch_families.name_normalized` GENERATED (used by resolver alias tier for dedup). Phase 82 UPDATES `needsReview`, `name`, `slug`, and `aliases` — reads all other fields.
- `src/app/actions/watches.ts` (L97–177 `addWatch` + L553–704 `editWatch`) — Phase 81's canonical-name overwrite path. Phase 82 doesn't modify these; the picker's `brand_id` selection flows through them via `/api/extract-watch` → `upsertCatalogFromUserInput` (Phase 81 extended return type).
- `src/app/api/extract-watch/route.ts` — the ingest route Phase 82's UI-02 affordance path targets. Silent-response contract per D-80-04 preserved (no new envelope fields).

### UI Patterns (mandatory)

- `src/components/ui/button.tsx` — `variant="ghost"` for nav links, `variant="default"` for primary CTAs (New / Add), `variant="destructive"` for Delete, `variant="outline"` for Cancel. `size="sm"` on inline row actions, `size="icon-sm"` on chip-remove buttons. Referenced by all admin-side action rendering.
- `src/components/ui/dialog.tsx` — `Dialog` / `DialogContent` / `DialogHeader` / `DialogTitle` / `DialogDescription` / `DialogFooter` / `DialogClose` primitives. Phase 82 uses these for Rename, Merge, Add-Alias dialogs. `showCloseButton={false}` for confirmation dialogs (matches `ListIndexClient.tsx` L225).
- `src/components/ui/badge.tsx` — `<Badge variant="secondary">` for `needs_review` pills on rows + for alias chips in the Add-Alias dialog.
- `src/components/ui/card.tsx` — `Card` / `CardContent` / `CardHeader` / `CardTitle` / `CardDescription` primitives. Phase 82 uses `<Card><CardContent className="pt-4">…</CardContent></Card>` per row (matches `ListIndexClient.tsx`).
- `src/components/ui/input.tsx` / `label.tsx` — form primitives for rename input + add-alias input.
- `sonner` `toast` — success + error surface on Server Action returns (matches `ListIndexClient.tsx` L108–113 pattern).
- `@base-ui/react/combobox` — `Combobox.Root`, `Combobox.Input`, `Combobox.Portal`, `Combobox.Positioner`, `Combobox.Popup`, `Combobox.List`, `Combobox.Item`. Phase 82's `BrandPicker` uses these exclusively.

### Local-First Verification (mandatory)

- `CLAUDE.md` § Local-First Development — the gate. Phase 82 is UI-heavy + runtime-behavior-change on `/admin/*` Server Actions. Verify via `npm run dev` against local Supabase: (a) sign in as `viewer@horlo.test` (non-admin), navigate to `/admin/brands` → assert redirect to `/`; (b) sign in as tyler (admin), see /admin/brands queue with any seeded `needs_review=true` rows (or seed one manually to test); (c) exercise Confirm, Rename, Merge (with source having 1+ families → pre-flight prompt fires; with source having 0 families → single-step merge); (d) exercise /admin/families Rename + Add alias + Remove alias + Confirm; (e) `/watch/new` structured-entry → BrandPicker filter + affordance + Find specs completes without blocking; (f) `/watch/[id]/edit` on a catalog-linked watch shows read-only chips + admin-link cluster; (g) `/watch/[id]/edit` on a `catalogId=null` legacy watch (if any in local seed) shows editable Inputs.
- Memory: `[[local-first-dev]]` — same rule. Phase 82 UI paths + admin Server Actions cannot be validated by build/vitest alone.
- Memory: `[[mobile-ui-verify-on-prod]]` — mobile-Safari behavior for the picker + admin queues still verifies on prod. Desktop path verifies locally.

### Critical Memories (additional)

- Memory: `[[next-clear-operational-debt]]` — `workflow.use_worktrees=false` globally. Phase 82 is build-gated. No worktrees.
- Memory: `[[next16-revalidatetag-deprecated]]` — new Server Actions must use `updateTag(tag)` for read-your-own-writes (already Phase 81 canonical) OR `revalidateTag(tag, 'max')` for cross-viewer stale-while-revalidate. Match the pattern the existing `src/app/actions/cms/collectionPaths.ts` uses (`revalidatePath` + `revalidateTag(tag, 'max')`).
- Memory: `[[accent-is-active-token]]` — for any admin selection UI (checkboxes, active nav, radio pills), use `bg-accent text-accent-foreground` (with `dark:` pair). Do NOT use `bg-primary` for selected states.
- Memory: `[[button-outline-dark-override]]` — any Button outline override must pair light + dark utilities (`<tw> dark:<tw>`).
- Memory: `[[assert-disappearance-too]]` — tests for BrandPicker's affordance click AND merge/add-alias dialog dismissals must assert BOTH mount AND unmount. E.g., clicking "Couldn't find" should assert affordance-mounts-elsewhere AND popup-closes.
- Memory: `[[reexport-only-doesnt-bind-locally]]` — if any new helper file is `export { x } from 'X'`, in-file callers still need `import { x } from 'X'`. `npm run build` catches this; not tests alone.
- Memory: `[[space-y-inline-block-siblings]]` — the Add-Alias chip list + input stack: use `flex flex-col` on the parent OR `block` on each `<Badge>`/`<Input>` child. `space-y-*` alone doesn't stack inline-block siblings.
- Memory: `[[verdict-hidden-on-owned-watches]]` — orthogonal but adjacent. WatchForm on edit-mode already runs owner-only.
- Memory: `[[button-medium-guardrail]]` — no raw `font-medium`. Use `font-semibold` (label primitive baseline is D-15).
- Memory: `[[phase-complete-999-1-misset]]` — hand-correct STATE.md after phase.complete.

### Test Pattern Precedents

- `src/app/actions/__tests__/cms-curatedLists.test.ts` — the CANONICAL CMS Server Action test pattern. Every action → `{ success: false, error: 'Not authorized' }` when `assertOwner()` throws. Phase 82's `brands.ts` + `families.ts` action tests mirror this.
- `src/app/actions/__tests__/cms-collectionPaths.test.ts` — additional CMS test pattern reference for the auth gate D-06 "assertOwner() first statement" test class.
- `src/components/watch/StructuredEntryPanel.test.tsx` — existing panel test. Phase 82 adds tests for the new `brands` prop threading + `<BrandPicker>` render.
- `src/components/watch/SearchEntry.test.tsx` — canonical combobox-test pattern (jsdom + assertions on both open state AND selection). Phase 82's `BrandPicker.test.tsx` mirrors this.
- Phase 78 / 80 / 81 patterns for local-first integration test recipes. Phase 82's `/admin/*` action tests use the same discipline (fixture SQL sets up a `needs_review=true` brand + one referencing family + one referencing catalog row; test runs each action and asserts DB state).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`src/app/admin/layout.tsx`** — `assertOwner()` guard + `max-w-2xl px-4 py-8` layout. Phase 82's `/admin/brands` and `/admin/families` are children of this layout.
- **`src/components/admin/AdminSubNav.tsx`** — 2-link ghost-nav. Phase 82 grows this to 4 links.
- **`src/components/admin/ListIndexClient.tsx`** L145–220 — Card + inline actions + Dialog pattern. Direct pattern reference for `BrandsQueue` / `FamiliesQueue` client components.
- **`src/app/actions/cms/collectionPaths.ts`** — Server Action file structure reference. `assertOwner()` first, `.strict()` Zod, `ActionResult<T>` return, `revalidatePath`, `console.error` on catch.
- **`src/lib/auth.ts`** L70–79 — `assertOwner()` unchanged. Phase 82 calls it in every new Server Action.
- **`src/components/watch/SearchEntry.tsx`** L202–338 — `@base-ui/react/combobox` controlled-open pattern. Direct copy target for `BrandPicker.tsx` structure.
- **`src/data/catalog.ts`** § `listCatalogBrands` L1075–1081 — the existing brand-list DAL shape. Phase 82 extends: renames the string[] version + ships a new `{id,name}[]` sibling.
- **`src/data/catalog-resolver.ts`** § `resolveBrandId` — unchanged. Phase 82's UI-02 auto-create fires through this via `/api/extract-watch`'s existing upsert path.
- **`src/lib/slug.ts`** § `slugifyWithRandomSuffix` — existing slug generator. Phase 82's rename actions call this to regenerate `brands.slug`.
- **`updateTag` / `revalidatePath` / `revalidateTag`** — Phase 82's Server Actions preserve the existing invalidation graph. New tags may include `admin:brands` / `admin:families` but planner picks. `revalidatePath('/admin/brands')` after every mutation is the baseline.

### Established Patterns

- **`assertOwner()` first statement** in every CMS Server Action. NOT a re-check inside DAL — the SOLE gate.
- **`db` client (Drizzle) bypasses RLS** for CMS DAL. This is intentional per D-06.
- **`ActionResult<T>` return type** on Server Actions. Never throw across the boundary; return `{ success: false, error: '…' }`.
- **Server Component fetches data + client sub-component owns interaction** (SEED-018 + `AdminListsPage` pattern). Phase 82's `/admin/brands/page.tsx` is a Server Component; the queue rendering is a client `<BrandsQueue>` component consuming SSR-fetched rows.
- **`sonner` toast** for user-visible error/success feedback.
- **`Dialog` for destructive-with-context actions** (Delete, Merge). Simple button-flip for non-destructive (Confirm-as-new).
- **`@base-ui/react/combobox` controlled-open pattern** (SearchEntry L207–232). Reused verbatim in `BrandPicker`.
- **Prop-drill catalog data from `/watch/new` page** through `AddWatchFlow` → `StructuredEntryPanel`. Phase 82 adds one more list (`brandsWithIds`) alongside `catalogBrands` (renamed to `catalogBrandNames`).
- **Slug regeneration on rename** via `slugifyWithRandomSuffix`. Existing helper.
- **`Watch.brandId?` + `Watch.familyId?` optional fields** (Phase 81 D-81-02). Phase 82 UI-03 reads these — but the read-only display sources canonical strings from the JOIN through `catalogId`, not from `Watch.brand`/`.model` directly, because the display should not depend on Phase 81's write-time overwrite having landed (belt-and-suspenders).

### Integration Points

- **Phase 80's resolver** — Phase 82's UI-02 affordance path relies on it end-to-end. No changes.
- **Phase 81's canonical-name overwrite** — Phase 82's picker `brand_id` selection flows through `/api/extract-watch` → `upsertCatalogFromUserInput` → resolver → `addWatch` cleanData.brand overwrite. Unchanged.
- **v5.1 admin CMS pattern (Phase 45/47)** — Phase 82 extends the pattern with two new sections. Adopting patterns wholesale rather than reinventing.
- **`AddWatchFlow`'s `viewerUserId` + `isAdmin` prop threading** (SEED-018) — Phase 82 reuses the `isAdmin` prop for the WatchForm admin-link gate; needs no new page-level query.
- **`SearchEntry`'s search-typeahead** — UNCHANGED. `BrandPicker` is a sibling, not a refactor.
- **`WatchForm.tsx` mode-switching** — Phase 82 respects `mode === 'edit'` gate for the admin link; `mode === 'create'` (from AddWatchFlow) doesn't gain the read-only chips (create mode already goes through the picker path).

</code_context>

<specifics>
## Specific Ideas

- **Zero new backend surface for UI-02.** The affordance is UX-only; the actual auto-create fires via the existing `/api/extract-watch` route + Phase 80 `resolveBrandId`. Phase 82's client can't tell whether a brand was auto-created vs matched — it doesn't need to. The queue is the operator's after-the-fact surface.
- **Reuse `ListIndexClient.tsx` as the physical template for the queue clients.** Copy the row structure verbatim; swap metadata + actions; keep the reorder-button vertical column position but remove it (brands + families don't sort by user). This is not "refactor SearchEntry" cost — it's "read one file, produce two similarly-shaped files."
- **`BrandPicker.tsx` is the SAME COMPONENT used by three different call sites**: (1) `StructuredEntryPanel` brand field (UI-01), (2) merge-target picker inside `/admin/brands`'s merge Dialog (OPS-01), and possibly (3) the `WatchForm`'s create-mode brand field if we later swap that too (not in Phase 82 scope). The component takes `brands: {id,name}[]` + `onCouldntFind` (optional — merge dialog doesn't need it). Reusability is a first-class concern.
- **Two-link admin cluster in WatchForm ships as `<div className="flex gap-2 mt-1">…</div>`** with two `<Button variant="ghost" size="sm" render={<Link .../>}>Edit brand</Button>` chips. Small, unobtrusive, chip-styled. Not a full row.
- **Merge pre-flight prompt copy** (planner may refine): "Source brand has N families. Merging will move all families to target. Continue?" with radio for "Move all N families" (default) and "Cancel — resolve families first."
- **The alias dialog's chip-remove button reuses the `X` icon convention** already used elsewhere in admin (planner locates existing icon if any; else lucide-react `X`).
- **`AdminSubNav` flat 4-link nav** — planner may reorganize if visual density becomes an issue, but flat is simplest.
- **Slug regeneration on family rename may leave `slug` NULL** if the resolver ecosystem doesn't need it. Planner decides based on where `watch_families.slug` is referenced.

</specifics>

<deferred>
## Deferred Ideas

- **Family-merge (mergeFamilyIntoFamily)**. Not spec'd in OPS-02. Planner may add if near-zero-cost, but not required.
- **Bulk multi-select queue actions.** Deferred; single-row Card + Dialog is enough at current volume (<100 queue rows expected).
- **`/admin/brands/{id}` deep-page for a single brand.** Deferred; queue + inline dialogs cover OPS-01/02.
- **A `<Typeahead>` primitive extracted from `SearchEntry` + `BrandPicker`.** Deferred; two consumers isn't enough duplication to justify the abstraction yet. Revisit if a third typeahead consumer emerges (e.g., a curator picker).
- **Non-admin owner "request a canonical fix" surface.** Not in Phase 82 scope (roadmap language locks the admin link to admin viewers).
- **Auto-suggest merge targets in the queue itself** (e.g., "This brand looks similar to `Hamilton`. Merge?"). Nice-to-have; would piggyback on the same fuzzy scoring the Phase 78 dry-run script uses (`extensions.word_similarity`).
- **Undo for merge / delete-source.** Would require an audit log. Deferred.
- **Alias search / sort inside the family Add-Alias dialog** if aliases grow past 5. Not needed at current scale.
- **Highlight-flash animation on `/admin/brands#brand-{brandId}` deep-link** — planner picks CSS pattern; may be dropped for MVP if scroll-into-view alone is enough.
- **`/admin/families?brandId=` filter chip UI** for clearer state signaling. Planner may add a "showing families of Brand X" banner + clear-filter link.

### Reviewed Todos (not folded)

- `drizzle-kit-pg-net-introspection-bug.md` (score 0.6) — orthogonal tooling issue about drizzle-kit's introspection failing on `net.http_method` domain CHECK. Not part of Phase 82's UI/admin scope. Stays open in todo backlog.

</deferred>

---

*Phase: 82-Add-Watch UI + Operator Admin*
*Context gathered: 2026-07-13*
