---
phase: 82
plan: 03
subsystem: watch-form
tags: [watch-form, read-only-chip, admin-link, canonical-join, viewerIsAdmin]
dependency_graph:
  requires: [82-01]
  provides: [UI-03]
  affects: [src/data/watches.ts, src/app/w/[ref]/edit/page.tsx, src/components/watch/WatchForm.tsx]
tech_stack:
  added: []
  patterns:
    - Left JOIN canonical brand/family name projection in getWatchById
    - Read-only chip pattern (Phase 20.1 D-12 precedent at WatchForm L370-380)
    - viewerIsAdmin SSR-fetch pattern (mirrors /watch/new SEED-018 pattern)
key_files:
  created:
    - src/components/watch/WatchForm.test.tsx
  modified:
    - src/data/watches.ts
    - src/app/w/[ref]/edit/page.tsx
    - src/components/watch/WatchForm.tsx
decisions:
  - "D-82-06: Read-only chip gates on watch.catalogId != null; legacy null rows keep editable Input"
  - "D-82-07: Admin link cluster gates on mode=edit + catalogId!=null + viewerIsAdmin"
  - "D-82-08: Two-link cluster — Edit brand → /admin/brands#brand-{brandId}, Edit family → /admin/families?brandId={brandId}"
  - "RESEARCH Pitfall 4 Option B: getWatchById LEFT JOINs brands + watch_families; chip renders canonicalBrand ?? watch.brand"
  - "Tasks 1+2 executed as a single commit unit per plan guidance (WatchForm prop + page together avoids TS build error at task boundary)"
metrics:
  duration: "~15 minutes"
  completed: "2026-07-14T02:34:00Z"
  tasks_completed: 2
  files_changed: 4
---

# Phase 82 Plan 03: WatchForm read-only chips + admin link cluster + canonical JOIN Summary

**One-liner:** WatchForm brand/model fields lock to canonical read-only chips on catalogId-linked watches via LEFT JOIN projection, with admin-only deep-link cluster to /admin/brands and /admin/families.

## What Was Built

### Task 1+2 (combined): DAL extension + edit page is_admin + WatchForm chips + tests

**`src/data/watches.ts`** — `getWatchById` extended with two additional LEFT JOINs:
- `.leftJoin(brands, eq(brands.id, watchesCatalog.brandId))`
- `.leftJoin(watchFamilies, eq(watchFamilies.id, watchesCatalog.familyId))`

Projections `canonicalBrand: brands.name` and `canonicalFamily: watchFamilies.name` added. Return type widened to `Watch & { canonicalBrand: string | undefined; canonicalFamily: string | undefined }`. Drizzle null coerced to `undefined` via `?? undefined` pattern. `brands` and `watchFamilies` imported directly per `[[reexport-only-doesnt-bind-locally]]` rule.

**`src/app/w/[ref]/edit/page.tsx`** — SSR-fetch of `profiles.is_admin` added via `Promise.all([getWatchById(...), supabase.from('profiles').select('is_admin')...])`, mirroring the SEED-018 pattern at `/watch/new` L100-104. `viewerIsAdmin = Boolean(profileAdminRow?.data?.is_admin)` (fail-closed). `createSupabaseServerClient` imported from `@/lib/supabase/server`. `viewerIsAdmin` prop passed to WatchForm.

**`src/components/watch/WatchForm.tsx`** — Modified:
- New `WatchWithCanonical = Watch & { canonicalBrand?: string; canonicalFamily?: string }` local type.
- `viewerIsAdmin?: boolean` prop added to `WatchFormProps` (defaults to `false`).
- Brand field: conditional chip `{watch?.catalogId != null ? <div aria-readonly="true" ...>{watch.canonicalBrand ?? watch.brand}</div> : <Input ...>}`.
- Model field: same conditional chip pattern with `{watch.canonicalFamily ?? watch.model}`.
- Admin link cluster: `{mode === 'edit' && watch?.catalogId != null && viewerIsAdmin && <div className="flex gap-2 mt-1"><Button variant="ghost" size="sm" render={<Link href="/admin/brands#brand-{watch.brandId}">}>Edit brand</Button>...}`.
- `import Link from 'next/link'` added.

**`src/components/watch/WatchForm.test.tsx`** (new) — 8 tests covering:
1. catalogId!=null → read-only chip, no brand Input
2. canonicalBrand undefined → fallback to watch.brand in chip
3. viewerIsAdmin=false → no admin link cluster
4. viewerIsAdmin=true + mode=edit + catalogId!=null → cluster renders with correct hrefs
5. mode=create + admin → cluster still absent (mode gate)
6. catalogId=null → editable Input present (legacy fallback)
7. a11y — brand chip carries aria-readonly="true"
8. grep armor — admin URL literals exactly 1 each in source

## Verification

- All 8 `WatchForm.test.tsx` tests pass: `npx vitest run src/components/watch/WatchForm.test.tsx`
- `npm run build` exits 0 (Compiled successfully in 5.8s)
- Grep armor: `aria-readonly="true"` count = 3 (brand + model + pre-existing status chip) ≥ 2; admin URL literals exactly 1 each; `viewerIsAdmin` count = 4 ≥ 3 in WatchForm.tsx; `canonicalBrand`/`canonicalFamily` count = 4 each in watches.ts

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

**Tasks 1+2 combined:** Per the plan's explicit guidance ("Take option (a) — build gate verifies at the plan boundary, not per-task"), Tasks 1 and 2 were committed together as a single atomic commit rather than in two separate commits. This avoids a TS build error at the Task 1 boundary (WatchForm didn't yet accept `viewerIsAdmin` until Task 2).

### Test 4 (admin link href assertion)

The plan specified `getByRole('link', { name: /edit brand/i })` for the admin link assertion. In practice, `<Button render={<Link href="...">}>` from base-ui renders an `<a role="button">` — the `role="button"` attribute is set explicitly, so ARIA role resolution returns "button", not "link". The test was updated to use `getByText()` + `document.querySelector('a[href="..."]')` to assert both presence and correct href. This is equivalent assertion coverage per the behavior spec.

## Security Review (T-82-04 mitigation)

- `viewerIsAdmin` sourced exclusively server-side at `/w/[ref]/edit/page.tsx` via `supabase.from('profiles').select('is_admin')` — cannot be forged client-side.
- WatchForm gates admin cluster JSX on prop value — non-admin owners see read-only chips with no DOM disclosure of admin links.
- Client-side prop flip is accepted risk (T-82-P03-01): the linked `/admin/brands` and `/admin/families` pages are gated by `assertOwner()` at the layout level.

## Known Stubs

None — the chips source from the canonical `brands.name` via the LEFT JOIN projection and fall back to `watch.brand` for legacy rows.

## Threat Flags

No new threat surface beyond what the plan's threat model covers.

## Self-Check: PASSED

- FOUND: src/data/watches.ts
- FOUND: src/app/w/[ref]/edit/page.tsx
- FOUND: src/components/watch/WatchForm.tsx
- FOUND: src/components/watch/WatchForm.test.tsx
- FOUND: commit de5a13f5 (feat(82-03): WatchForm read-only chips + admin link cluster + canonical JOINs)
