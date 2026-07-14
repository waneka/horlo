# Phase 82: Add-Watch UI + Operator Admin - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-13
**Phase:** 82-add-watch-ui-operator-admin
**Areas discussed:** Brand-picker shape + fetch strategy (UI-01), UI-02 "Couldn't find" affordance UX, UI-03 read-only + "Edit catalog mapping" link, /admin queues interaction shape (OPS-01/02)

---

## Area 1a — Brand-picker component shape

| Option | Description | Selected |
|--------|-------------|----------|
| New dedicated BrandPicker.tsx | ~120-line focused component using the same `@base-ui/react/combobox` primitive + controlled-open pattern from SearchEntry, no image thumbs/pills. Own props: `brands: {id,name}[]`, `value`, `onChange`, `onCouldntFind`. Mounts inside StructuredEntryPanel. | ✓ |
| Extract shared `<Typeahead>` primitive | Generalize the Combobox pattern shared with SearchEntry into `src/components/ui/typeahead.tsx`. More refactor surface. | |
| Extend SearchEntry with `mode='brand'` variant | Add a discriminant prop; SearchEntry file grows; coupling gets messy. | |

**User's choice:** New dedicated BrandPicker.tsx
**Notes:** Recommended option. Cheapest, clearest, no coupling to SearchEntry's watch-catalog-specific behavior.

---

## Area 1b — Brand list fetch strategy

| Option | Description | Selected |
|--------|-------------|----------|
| SSR full list + client-side filter | Extend the DAL to SELECT `{id,name}[]` from `brands`, SSR at `/watch/new`, prop-drill through AddWatchFlow → StructuredEntryPanel. Client does substring filter. Zero round-trips per keystroke. | ✓ |
| Server-fetch on keystroke via /api/brands?q= | Debounced fetch per keystroke, mirroring SearchEntry's pattern. Better for growth (10k+ brands); overkill at 100-row scale. | |
| Hybrid — SSR list for <200, else server-fetch | Adaptive strategy. Premature. | |

**User's choice:** SSR full list + client-side filter
**Notes:** Recommended. ~100 brands today. `listCatalogBrands()` will be renamed and a sibling `listBrands()` shipped.

---

## Area 2a — Auto-create timing

| Option | Description | Selected |
|--------|-------------|----------|
| Fire on 'Find specs' click via existing /api/extract-watch | Existing route already calls resolveBrandId inside its upsert path (Phase 80 wired this). Zero new route surface. | ✓ |
| Fire on affordance click via new /api/brands/resolve | Dedicated resolve route: affordance click POSTs the typed string; picker locks selection before Find specs runs. New route to build. | |
| Fire on addWatch submit only | Simplest client but hides brand identity from the user until commit. | |

**User's choice:** Fire on Find specs click via existing route
**Notes:** Recommended. Zero new surface; matches Phase 80 D-80-04 silence semantics.

---

## Area 2b — User feedback when a new brand gets auto-created

| Option | Description | Selected |
|--------|-------------|----------|
| Silent — no client-visible signal | Mirrors Phase 80 D-80-04. Affordance click IS the confirmation. Operator sees `needs_review` row later. | ✓ |
| Subtle inline hint after selection | Small ghost badge "Added as new brand" next to the selection. Adds copy + state. | |
| Toast on successful commit | Toast during addWatch success. Weakens the "silent, never blocks" contract. | |

**User's choice:** Silent — no client-visible signal
**Notes:** Recommended.

---

## Area 2c — Affordance copy + placement

| Option | Description | Selected |
|--------|-------------|----------|
| Verbatim copy, sibling of Combobox.List | `Couldn't find that brand — add as "{typed}"` — exact roadmap wording. Rendered outside the List per SearchEntry SRCH-03 lesson. Full-width button, min-h-[44px], ghost, muted-foreground. | ✓ |
| Softer copy: `Add "{typed}" as a new brand` | Shorter/action-oriented. Deviates from roadmap. | |
| Reveal only after 300ms debounce | Adds artificial latency. | |

**User's choice:** Verbatim copy, sibling of Combobox.List
**Notes:** Recommended. Preserves roadmap language + SearchEntry click-semantics lesson.

---

## Area 3a — UI-03 read-only scope

| Option | Description | Selected |
|--------|-------------|----------|
| Read-only ONLY when catalogId present | Read-only chip when `watch.catalogId != null`; existing free-text Inputs preserved for `catalogId = null` legacy rows. | ✓ |
| Read-only always — including catalogId=null | Uniform UX but blocks editing legacy null-catalogId rows. | |
| Read-only for display + Accordion 'Advanced' override | Backdoor breaks D-02 canonical-write contract. | |

**User's choice:** Read-only ONLY when catalogId present
**Notes:** Recommended. Phase 17 ON DELETE SET NULL edge case preserved as editable fallback.

---

## Area 3b — "Edit catalog mapping" admin link visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Show ONLY when owner AND is_admin=true | Threads viewer's `is_admin` server-side (SEED-018 pattern). Zero-cost defense-in-depth. Matches roadmap language literally. | ✓ |
| Show to all watch owners — link routes to 'request fix' surface | Would need a new user-facing route. Out of scope. | |
| Show to admins only (regardless of ownership) | Simpler but violates 'watch owner' language and shows the link on other users' pages when admin views them. | |

**User's choice:** Show ONLY when owner AND is_admin=true
**Notes:** Recommended. Horlo is single-operator today; owner==admin. `viewerIsAdmin` prop threaded to WatchForm.

---

## Area 3c — 'Edit catalog mapping' link destination

| Option | Description | Selected |
|--------|-------------|----------|
| Deep-link to /admin/brands#brand-{brandId} + /admin/families?brandId={brandId} | Two-link cluster: "Edit brand" scrolls-to + highlights the row; "Edit family" filters queue to that brand's families. Requires hash-scroll + query-param wiring. | ✓ |
| Single link to /admin/brands (top of queue) | Simple, no hash wiring. Admin scrolls/searches. | |
| Modal-inline mini-editor on the WatchForm page | Duplicates OPS-01/02 surface. | |

**User's choice:** Deep-link
**Notes:** Recommended. Direct routing to the specific rows the admin needs to fix.

---

## Area 4a — /admin queues interaction shape

| Option | Description | Selected |
|--------|-------------|----------|
| Per-row Card with inline action buttons + Dialog for merge | Mirrors /admin/lists (ListIndexClient.tsx pattern). `needs_review DESC, name ASC`. Inline Confirm, Rename dialog, Merge dialog. | ✓ |
| Multi-select checkboxes + toolbar bulk actions | Adds selection state + toolbar. Not needed at current volume. | |
| Inline dropdown per row (no dialogs) | Denser but harder to preview destructive actions. | |

**User's choice:** Per-row Card + inline actions + Dialog for merge
**Notes:** Recommended. Consistent with existing admin patterns; easy to add multi-select later.

---

## Area 4b — Merge-target picker

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse BrandPicker from UI-01 | Same component. Dialog embeds `<BrandPicker brands={allBrandsExceptSource} ...>`. Zero new component. | ✓ |
| Ship a heavier BrandCombobox variant with ownersCount + needsReview badges | Enriched data + a second component variant. Overkill for phase 82. | |

**User's choice:** Reuse BrandPicker
**Notes:** Recommended. First-class reusability confirmed.

---

## Area 4c — OPS-02 'Add alias' UX

| Option | Description | Selected |
|--------|-------------|----------|
| Small dialog: input + existing aliases list (removable chips) + append (dedup) | Full CRUD on the array in one dialog. Dedup via `@>` containment (matches D-80-02 tier-2). | ✓ |
| Append-only prompt — no removal | Simplest; no way to undo typos. | |
| Alias-list as a separate /admin/families/{id}/aliases page | Overkill for typical single-alias use case. | |

**User's choice:** Small dialog with add + remove chips
**Notes:** Recommended. Normalized as `trim().toLowerCase()`; matches resolver expectations.

---

## Area 4d — Merge safety / family handling

| Option | Description | Selected |
|--------|-------------|----------|
| Merge only rewrites watches_catalog.brand_id refs — no family handling assumed | Simple three-step tx: UPDATE catalog refs, UPDATE families, DELETE source. | |
| Pre-flight check + explicit family-handling prompt | Before merge dialog: count families; if >0, radio for "Move all N families to target" (default) or "Cancel — resolve families first." Single transaction. | ✓ |
| Block merge if source has families — must be resolved separately | Strict but adds friction. | |

**User's choice:** Pre-flight check + explicit family-handling prompt
**Notes:** Recommended. Keeps operator informed; still one transaction on chosen option.

---

## Claude's Discretion

- Exact scroll-to + highlight animation implementation for `/admin/brands#brand-{brandId}`
- Whether `AdminSubNav` becomes 4 flat links or nests
- Whether OPS-02 gains family-merge as opportunistic scope
- Whether SearchEntry stays on renamed `listCatalogBrandNames` or switches to new `listBrands`
- Test surface split: unit vs local-fixture integration
- Whether a `SlugField` primitive helps
- `aliases` normalization must match resolver's tier-2 lookup exactly

## Deferred Ideas

- Family-merge (mergeFamilyIntoFamily)
- Bulk multi-select queue actions
- `/admin/brands/{id}` deep-page
- `<Typeahead>` primitive extraction
- Non-admin owner "request a canonical fix" surface
- Auto-suggest merge targets in the queue via fuzzy scoring
- Undo for merge / delete-source
- Alias search / sort inside Add-Alias dialog
- Highlight-flash animation on deep-link (may be dropped for MVP)
- `/admin/families?brandId=` filter chip UI

## Reviewed Todos (not folded)

- `drizzle-kit-pg-net-introspection-bug.md` (score 0.6) — orthogonal drizzle-kit tooling issue; unrelated to UI/admin scope.
