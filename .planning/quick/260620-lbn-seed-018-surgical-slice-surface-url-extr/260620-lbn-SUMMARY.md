---
phase: quick-260620-lbn
plan: "01"
subsystem: add-watch-flow
tags: [seed-018, url-extraction, admin-gate, catalog-only, ux]
dependency_graph:
  requires: []
  provides: [url-surface-affordance, catalog-only-server-action]
  affects: [src/components/watch/AddWatchFlow.tsx, src/components/watch/ConfirmStep.tsx, src/app/watch/new/page.tsx, src/app/actions/watches.ts]
tech_stack:
  added: []
  patterns: [assertOwner-gate, OPTIONS_FOR_VIEWER-computed-inline, COALESCE-upsert]
key_files:
  created: []
  modified:
    - src/components/watch/AddWatchFlow.tsx
    - src/components/watch/AddWatchFlow.test.tsx
    - src/components/watch/ConfirmStep.tsx
    - src/components/watch/ConfirmStep.test.tsx
    - src/app/watch/new/page.tsx
    - src/app/actions/watches.ts
decisions:
  - "Reuse handleSwitchToUrl verbatim for the new URL affordance — no new state, no new handler"
  - "catalog-only short-circuits in handleConfirmPrimary BEFORE payload assembly — addWatch never called"
  - "isAdmin resolved server-side only; client-supplied flag never trusted"
  - "OPTIONS_FOR_VIEWER computed inline from constant OPTIONS + CATALOG_ONLY_OPTION to keep WAI-ARIA values in sync"
  - "Price field hidden entirely on catalog-only (isCatalogOnly guard) — no disabled input, no label-only"
  - "Admin stays on /watch/new after catalog-only success (no router.push) — enables rapid batch seeding"
metrics:
  duration: "~20 minutes"
  completed: "2026-06-20"
  tasks_completed: 2
  files_changed: 6
---

# Quick Task 260620-lbn: SEED-018 Surgical Slice — URL Surface + Catalog-Only Save

## One-liner

"Add from URL" one-tap affordance on landing + admin-gated `saveCatalogOnlyFromExtract` Server Action writing to `watches_catalog` without polluting the admin's own collection.

## What Changed

- **URL surface (Task 1):** Inserted `<button type="button" onClick={handleSwitchToUrl}>Add from URL</button>` between `<SearchEntry>` and the "Skip search — enter manually" link in the `search-idle` branch of `AddWatchFlow`. Reuses the existing `handleSwitchToUrl` callback verbatim — no new state, no new handler. Visual weight matches the skip-search link (identical `className`).

- **Catalog-only Server Action (Task 2, Piece A):** New `saveCatalogOnlyFromExtract` export in `src/app/actions/watches.ts`. Three-block CMS pattern: (1) `assertOwner()` throws `UnauthorizedError('Not an admin')` on non-admin, (2) Zod-parse subset of `UrlExtractedCatalogInput`, (3) `upsertCatalogFromExtractedUrl` (idempotent COALESCE) + `revalidateTag('explore', 'max')`. Returns `{ success: true, data: { catalogId } }` on success. Import added: `assertOwner` from `@/lib/auth`.

- **Page isAdmin resolution (Task 2, Piece B):** `src/app/watch/new/page.tsx` added a fourth parallel query in `Promise.all` — `supabase.from('profiles').select('is_admin').eq('id', user.id).single()`. Computes `const isAdmin = Boolean(profileAdminRow?.data?.is_admin)` with fail-closed semantics on error. Passes `isAdmin={isAdmin}` to `<AddWatchFlow>`.

- **AddWatchFlow wiring (Task 2, Piece C):** `isAdmin: boolean` added to `AddWatchFlowProps` and destructured. `confirmStatus` state union widened from `'owned' | 'wishlist' | 'grail'` to `'owned' | 'wishlist' | 'grail' | 'catalog-only'`. `handleConfirmPrimary` branches at the top for `catalog-only` — calls `saveCatalogOnlyFromExtract`, toasts success, resets to search-idle, no `router.push`. Type-safe narrowing: `const nonCatalogStatus = confirmStatus as 'owned' | 'wishlist' | 'grail'` after early return so `defaultDestinationForStatus` receives the correct union. `isAdmin={isAdmin}` forwarded to `<ConfirmStep>`.

- **ConfirmStep widening (Task 2, Piece D):** Additive prop changes per Phase 68 D-03 contract. `CTA_LABELS` extended with `'catalog-only': 'Save to Catalog'`. Module-scope `CATALOG_ONLY_OPTION` constant. `OPTIONS_FOR_VIEWER` computed inline: `isAdmin ? [...OPTIONS, CATALOG_ONLY_OPTION] : OPTIONS`. `handleKeyDown` `values` array derives from `OPTIONS_FOR_VIEWER.map(o => o.value)` — roving-tabindex cycles 4 options for admins, 3 for non-admins. Price field wrapped in `{!isCatalogOnly && (...)}` — entirely absent (no disabled input). `isAdmin?: boolean` prop (default `false`). `status` and `onStatusChange` unions widened to include `'catalog-only'`. Font-semibold guardrail maintained throughout.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | b1c20ddd | feat(quick-260620-lbn-01): surface "Add from URL" on Add-Watch landing |
| Task 2 | 9e0ee504 | feat(quick-260620-lbn-01): add admin-gated catalog-only save path |

## Deviations from Plan

None — plan executed exactly as written.

Notable implementation notes:
- `ExtractedWatchData` does NOT have a `productionYear` field (plan text suggested mapping `confirmYear` from `confirmYear`); used `confirmYear ?? null` directly (the state variable already captures the user's year input).
- Pre-existing test failures in `tests/components/watch/AddWatchFlow.test.tsx` (2 FORM-04 tests looking for `/paste a product page URL/i` placeholder) are baseline noise — confirmed pre-existing by reverting and re-running.

## Admin-Gate Pattern Reused

`assertOwner()` from `src/lib/auth.ts` (line 70): selects `profiles.is_admin` for the session user; throws `UnauthorizedError('Not an admin')` when false/missing. The catalog DAL bypasses RLS via Drizzle direct connection — `assertOwner` is the SOLE enforced write gate, mirroring all `src/app/actions/cms/*.ts` Server Actions.

## No DB Migration

Confirmed: no schema change, no migration. `upsertCatalogFromExtractedUrl` was already idempotent (ON CONFLICT ON CONSTRAINT watches_catalog_natural_key DO UPDATE COALESCE). Safe to re-call even if `/api/extract-watch` already inserted the row.

## Known Stubs

None. Both affordances are fully wired: URL button calls real handler; catalog-only action calls real DAL.

## Threat Flags

None. No new network endpoints, no new auth paths beyond the server-side `assertOwner` gate (which existed in auth.ts). The new Server Action is gated identically to all CMS actions.

## UAT Script

**Verify both pieces locally and on prod:**

1. **URL surface (any user):** Visit `/watch/new`. On the landing you should see:
   - `SearchEntry` (search input) at the top
   - "Add from URL" link below it
   - "Skip search — enter manually" link at the bottom
   Click "Add from URL" — the URL `<Input>` appears with `← Back to search`, SearchEntry and both affordance links unmount. Paste a watch URL and click "Find specs" to confirm the extract flow works end-to-end.

2. **Catalog-only hidden for non-admins:** Sign in as a regular user (`profiles.is_admin = false`). Use any path (search-pick or URL-extract) to reach the confirming step. The radiogroup shows exactly 3 options: Owned / Wishlist / Grail. No "Catalog only" button exists anywhere in the DOM.

3. **Catalog-only visible for admin:** Sign in as admin user (`profiles.is_admin = true`). Reach the confirming step. A 4th "Catalog only" radio is present. Select it: the price field disappears, the primary CTA reads "Save to Catalog".

4. **Admin catalog-only save:** With admin + "Catalog only" selected, click "Save to Catalog". Observe:
   - Toast says "Saved to catalog"
   - Flow returns to `/watch/new` landing (SearchEntry visible again)
   - `router.push` was NOT called — you stay on `/watch/new` to add more
   - Verify in Supabase Studio or locally: `SELECT COUNT(*) FROM watches WHERE user_id = '<admin-uuid>'` count is UNCHANGED; `SELECT * FROM watches_catalog WHERE brand = '...' AND model = '...'` shows the row.

5. **Server-side gate spot-check:** As a non-admin, open browser devtools → Network. Trigger any confirming state, then from Console call the action directly (or use the React DevTools to inspect props and confirm `isAdmin=false` was passed). The "Catalog only" button should not exist in the DOM at all — the option is not rendered (not disabled, not aria-hidden, simply absent).

## Self-Check: PASSED

All key files exist. Both commits verified in git log:
- b1c20ddd: Task 1 — "Add from URL" affordance
- 9e0ee504: Task 2 — admin-gated catalog-only save path

`npm run build` exits 0. All new tests pass (34 AddWatchFlow + 21 ConfirmStep). Pre-existing baseline noise (2 FORM-04 tests in tests/components/watch/AddWatchFlow.test.tsx) unchanged.
