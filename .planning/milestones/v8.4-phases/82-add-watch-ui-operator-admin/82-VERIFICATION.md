---
phase: 82-add-watch-ui-operator-admin
verified: 2026-07-14T20:03:00Z
status: human_needed
score: 5/5
overrides_applied: 0
human_verification:
  - test: "Local-first walkthrough — Steps 1a/1b/1c/1d in 82-POST-DEPLOY.md"
    expected: "BrandPicker typeahead filters brands, affordance auto-creates needs_review=true brand, WatchForm chips lock canonical strings + admin link cluster deep-links, /admin/brands Confirm/Rename/Merge all work end-to-end (including WAI-ARIA radiogroup pre-flight + merge transaction atomicity), /admin/families Rename/Add-alias/Remove-alias round-trip to resolver tier-2"
    why_human: "Runtime SQL transaction atomicity, combobox popup behavior on real DOM, Server Action revalidatePath + router.refresh() cycle, and alias resolver round-trip require npm run dev against local Supabase — not testable by vitest or build"
  - test: "Bundled prod push + Vercel deploy green (Step 2)"
    expected: "git push origin main succeeds, Vercel build green, smoke curl on /admin/brands returns 200 (redirect to login for anon, 200 for admin)"
    why_human: "Production deploy is a human action; Vercel dashboard confirmation required"
  - test: "iPhone Safari UAT (Step 3a) — BrandPicker on /watch/new mobile"
    expected: "BrandPicker popup opens, known brand tap selects and closes, unknown brand affordance appears and fires on tap, Find specs completes without blocking"
    why_human: "Mobile-Safari behavior per [[mobile-ui-verify-on-prod]] is verified on prod only"
  - test: "/admin/brands and /admin/families render on prod — read-only navigation (Step 3b)"
    expected: "Both admin queue pages render brand/family rows in correct order (needs_review DESC, name ASC)"
    why_human: "Prod DB state validation requires human eyes on the live page"
  - test: "WatchForm admin link cluster deep-link round-trip (Step 3c)"
    expected: "'Edit family' from WatchForm edit page navigates to /admin/families?brandId= with filter banner + Clear filter; 'Edit brand' navigates to /admin/brands#brand-{id} with scroll+highlight"
    why_human: "Scroll-to + 1s background pulse animation is visual behavior not unit-testable; filter banner render requires live DB row"
---

# Phase 82: Add-Watch UI + Operator Admin — Verification Report

**Phase Goal:** The add-watch flow surfaces a brand-picker autocomplete that locks new entries to canonical brands (with a labeled escape hatch for net-new), the edit-watch form renders canonical strings as read-only, and an operator can walk the `needs_review` queue without dropping to CLI.
**Verified:** 2026-07-14T20:03:00Z
**Status:** human_needed (all automated checks VERIFIED; 5 items require local + prod walkthrough)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth (from ROADMAP Success Criteria) | Status | Evidence |
|---|---------------------------------------|--------|----------|
| 1 | StructuredEntryPanel Brand field renders as typeahead autocomplete sourced from `brands.name`; selecting one attaches `brand_id` (UI-01) | VERIFIED | `src/components/watch/BrandPicker.tsx` — 142-line combobox with `@base-ui/react/combobox` controlled-open; wired at `StructuredEntryPanel.tsx` L239-252 replacing raw Input; `listBrands()` DAL SELECT+id in `src/data/catalog.ts`; prop-drilled through `AddWatchFlow` and `SearchEntry`; 9/9 `BrandPicker.test.tsx` + 18/18 `StructuredEntryPanel.test.tsx` pass |
| 2 | Zero-match typed string shows "Couldn't find that brand — add as '{typed}'" affordance; clicking routes through INGEST-03 auto-create with `needs_review: true`; user flow continues without gating (UI-02) | VERIFIED | `BrandPicker.tsx` L121-135 — affordance as sibling of `Combobox.List` inside Popup; gate: `filteredBrands.length === 0 && inputValue.trim().length > 0 && onCouldntFind`; click calls `onCouldntFind(inputValue.trim()) + setOpen(false)`; auto-create fires via existing `/api/extract-watch` route through Phase 80 `resolveBrandId` tier-3 (no new route surface per D-82-03); `BrandPicker.test.tsx` test 5 asserts BOTH callback AND popup close (`assert-disappearance-too`) |
| 3 | WatchForm edit screen renders canonical `brands.name` / `watch_families.name` as read-only chips; "Edit catalog mapping" link cluster visible only to admin owner; user cannot persist non-canonical string (UI-03) | VERIFIED | `WatchForm.tsx` L345-407 — conditional chip on `watch?.catalogId != null` per D-82-06; `aria-readonly="true"` on chip div; admin link cluster gated on `mode === 'edit' && watch?.catalogId != null && viewerIsAdmin` per D-82-07/D-82-08; `getWatchById` in `src/data/watches.ts` L204-241 LEFT JOINs `brands` + `watchFamilies` for `canonicalBrand`/`canonicalFamily`; edit page L SSR-fetches `profiles.is_admin` per SEED-018 pattern; 8/8 `WatchForm.test.tsx` pass |
| 4 | `/admin/brands` lists brands ordered by `needs_review DESC, name ASC`; each `needs_review: true` row exposes confirm-as-new / rename / merge-into-existing; merge UPDATEs all referencing `watches_catalog.brand_id` to target and deletes source in a single transaction (OPS-01) | VERIFIED | `src/app/admin/brands/page.tsx` — Server Component fetching `listBrandsForQueue()` (ORDER BY `desc(brands.needsReview), asc(brands.name)`); `src/components/admin/BrandsQueue.tsx` — 344 lines with Card rows + Confirm/Rename/Merge dialogs + `BrandPicker` merge target + WAI-ARIA radiogroup pre-flight + deep-link `useEffect`; `src/data/brands.ts` `mergeBrandInDb()` — `db.transaction` atomic: UPDATE watches_catalog → UPDATE watch_families (conditional) → DELETE brands; 13/13 `cms-brands.test.ts` pass; AdminSubNav extended to 4 links |
| 5 | `/admin/families` mirrors OPS-01 for `watch_families`; adds "Add alias" action that appends to `aliases text[]` so operator can route aliases from queue UI (OPS-02) | VERIFIED | `src/app/admin/families/page.tsx` — Server Component with Zod uuid() `?brandId` validation + `listFamiliesForQueue()` + `getBrandNameById()`; `src/components/admin/FamiliesQueue.tsx` — 344 lines with Confirm/Rename/Add-alias/Remove-alias (no merge per D-82-10 scope); `src/data/families.ts` `addFamilyAliasInDb` SQL `aliases || ARRAY[value]::text[]` with `NOT (aliases @> ...)` dedup guard + `removeFamilyAliasInDb` via `array_remove`; 18/18 `cms-families.test.ts` pass including T8 normalization `"  Submariner  "` → `"submariner"` matching resolver Tier 2 |

**Score:** 5/5 truths verified

---

## Grep Armor Results

| Check | Specification | Result | Status |
|-------|--------------|--------|--------|
| `grep -c "Couldn't find that brand" BrandPicker.tsx` | ≥1 | 2 (1 in JSDoc comment, 1 in JSX L133) | PASS — functional occurrence at L133 confirmed |
| `await assertOwner()` calls in `cms/brands.ts` | 3 | 3 (lines 39, 60, 82) | PASS |
| `await assertOwner()` calls in `cms/families.ts` | 4 | 4 (lines 50, 71, 93, 119) | PASS |
| `font-medium` in BrandPicker.tsx | 0 in rendered CSS | 1 (line 24 — JSDoc comment only, not a Tailwind class) | PASS — JSDoc reference to guardrail rule, no rendered utility |
| `font-medium` in BrandsQueue.tsx | 0 | 0 | PASS |
| `font-medium` in FamiliesQueue.tsx | 0 | 0 | PASS |
| `font-medium` in WatchForm.tsx | 0 | 0 | PASS |
| `bg-primary` in BrandsQueue.tsx | 0 | 0 | PASS |
| `bg-primary` in FamiliesQueue.tsx | 0 | 0 | PASS |
| `"Merge into"` in FamiliesQueue.tsx | 0 (D-82-10: no family-merge) | 0 | PASS |
| `db.transaction` in `src/data/brands.ts` | ≥1 | 1 (line 74) | PASS |
| `.strict()` total in brands.ts + families.ts | ≥7 | 7 (3+4) | PASS |
| `z.string().uuid()` in `admin/families/page.tsx` | ≥1 | 1 (line 15) | PASS |
| assert-disappearance in BrandPicker.test.tsx | both mount + close asserted | Test 5: affordance mount (`toBeInTheDocument`) + popup close (`not.toBeInTheDocument`) | PASS |

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/watch/BrandPicker.tsx` | UI-01/02 delivery | VERIFIED | 142 lines; substantive combobox implementation with controlled-open pattern |
| `src/components/watch/BrandPicker.test.tsx` | 9 tests | VERIFIED | 9/9 pass including assert-disappearance affordance test |
| `src/components/watch/StructuredEntryPanel.tsx` | BrandPicker wire-in | VERIFIED | L239-252 replaces raw Input with BrandPicker |
| `src/components/watch/WatchForm.tsx` | UI-03 chips + admin link | VERIFIED | L345-407 conditional chips; L398-407 admin link cluster |
| `src/components/watch/WatchForm.test.tsx` | 8 tests | VERIFIED | 8/8 pass covering chip/Input switch, admin link gate, aria-readonly, legacy fallback |
| `src/data/watches.ts` | LEFT JOIN for canonical fields | VERIFIED | L204-241 `getWatchById` LEFT JOINs `brands` + `watchFamilies` for `canonicalBrand`/`canonicalFamily` |
| `src/app/w/[ref]/edit/page.tsx` | `is_admin` threading | VERIFIED | SSR-fetches `profiles.is_admin` via `Promise.all`, threads `viewerIsAdmin` to WatchForm |
| `src/data/catalog.ts` | `listBrands()` + renamed `listCatalogBrandNames()` | VERIFIED | Both functions present; `listBrands()` returns `{id,name}[]` from `brands` table |
| `src/app/watch/new/page.tsx` | `Promise.all` extended | VERIFIED | Fetches both `listCatalogBrandNames()` + `listBrands()`; props drilled through AddWatchFlow |
| `src/data/brands.ts` | brands DAL with transaction | VERIFIED | `listBrandsForQueue`, `confirmBrand`, `renameBrandInDb`, `mergeBrandInDb` (db.transaction) |
| `src/app/actions/cms/brands.ts` | 3 Server Actions | VERIFIED | `confirmBrandAsNew`, `renameBrand`, `mergeBrand`; all gated by `assertOwner()` first |
| `src/app/actions/__tests__/cms-brands.test.ts` | 13 tests | VERIFIED | 13/13 pass |
| `src/app/admin/brands/page.tsx` | Server Component | VERIFIED | Fetches `listBrandsForQueue()` + `listBrands()`; mounts `BrandsQueue` |
| `src/components/admin/BrandsQueue.tsx` | Queue with 3 actions | VERIFIED | 344 lines; Card rows, Confirm/Rename/Merge dialogs, BrandPicker merge target, WAI-ARIA radiogroup, deep-link useEffect |
| `src/data/families.ts` | families DAL | VERIFIED | `listFamiliesForQueue`, `confirmFamily`, `renameFamilyInDb`, `addFamilyAliasInDb`, `removeFamilyAliasInDb`, `getBrandNameById` |
| `src/app/actions/cms/families.ts` | 4 Server Actions | VERIFIED | `confirmFamilyAsNew`, `renameFamily`, `addFamilyAlias`, `removeFamilyAlias`; all `assertOwner()` first |
| `src/app/actions/__tests__/cms-families.test.ts` | 18 tests | VERIFIED | 18/18 pass including T8 normalization load-bearing test |
| `src/app/admin/families/page.tsx` | Server Component with UUID validation | VERIFIED | `z.string().uuid()` guards `?brandId`; `listFamiliesForQueue` + `getBrandNameById` |
| `src/components/admin/FamiliesQueue.tsx` | Queue with add/remove alias | VERIFIED | 344 lines; Confirm/Rename/Add-alias/Remove-alias with chip strip; no Merge (D-82-10) |
| `src/components/admin/AdminSubNav.tsx` | 4-link extension | VERIFIED | `NAV_LINKS` has 4 entries including `/admin/brands` and `/admin/families` |
| `.planning/phases/82-add-watch-ui-operator-admin/82-POST-DEPLOY.md` | Operator runbook | VERIFIED | Steps 1a/1b/1c/1d + Step 2 deploy + Steps 3a/3b/3c prod UAT + sign-off table |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `BrandPicker` | `StructuredEntryPanel` | import + JSX L239 | WIRED | `<BrandPicker brands={brandsWithIds ?? []} ... onCouldntFind={...} />` replaces raw Input |
| `listBrands()` | `/watch/new` page | Promise.all + prop `brandsWithIds` | WIRED | Page fetches both brand lists; `brandsWithIds` drills through `AddWatchFlow` → `SearchEntry` → `StructuredEntryPanel` → `BrandPicker` |
| `getWatchById` | `canonicalBrand`/`canonicalFamily` | LEFT JOIN `brands` + `watchFamilies` | WIRED | `watches.ts` L228-229 adds LEFT JOINs; return type includes optional canonical fields |
| `edit/page.tsx` | `viewerIsAdmin` | `profiles.is_admin` SSR fetch → `WatchForm` prop | WIRED | `Promise.all` includes `supabase.from('profiles').select('is_admin')`; `viewerIsAdmin` threaded to `<WatchForm>` |
| `BrandsQueue` | `confirmBrandAsNew`/`renameBrand`/`mergeBrand` | import + onClick handlers | WIRED | All 3 Server Actions imported and called in action handlers (lines 84, 97, 112) |
| `mergeBrandInDb` | atomic transaction | `db.transaction()` | WIRED | Transaction covers `watches_catalog` UPDATE → `watch_families` UPDATE (conditional) → `DELETE brands` |
| `FamiliesQueue` | `addFamilyAlias` | normalization + `addFamilyAliasInDb` | WIRED | Server Action normalizes `trim().toLowerCase()` before `addFamilyAliasInDb`; dedup guard in SQL |
| `aliases text[]` | Phase 80 resolver tier-2 | unchanged resolver path | WIRED | `addFamilyAliasInDb` appends to `aliases`; resolver tier-2 in `catalog-resolver.ts` reads `aliases @> ARRAY[lower(trim($1))]` — unchanged contract |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| UI-01 | 82-01, 82-02 | StructuredEntryPanel typeahead sourced from `brands.name`; selection sets `brand_id` | SATISFIED | BrandPicker + listBrands() DAL + prop pipeline; 9 BrandPicker tests + 18 StructuredEntryPanel tests pass |
| UI-02 | 82-02 | "Couldn't find" affordance → INGEST-03 auto-create with `needs_review: true`; flow unblocked | SATISFIED | Affordance in BrandPicker L121-135; auto-create via Phase 80 resolver called by existing extract-watch route (no new surface); test 5 asserts both callback + popup close |
| UI-03 | 82-03 | WatchForm read-only chips for canonical strings; admin link cluster | SATISFIED | WatchForm L345-407; `getWatchById` canonical LEFT JOINs; edit page `is_admin` threading; 8/8 WatchForm tests |
| OPS-01 | 82-04 | `/admin/brands` queue with confirm/rename/merge; merge in single transaction | SATISFIED | Full brand queue + 3 Server Actions + `db.transaction`; 13/13 cms-brands tests |
| OPS-02 | 82-05 | `/admin/families` queue mirrors OPS-01 + add-alias action; aliases feed resolver | SATISFIED | Full family queue + 4 Server Actions + alias SQL; normalization matches resolver; 18/18 cms-families tests |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `npm run build` exits 0 | `npm run build 2>&1 \| grep 'Compiled\|Exit'` | "Compiled successfully in 5.8s", Exit code 0 | PASS |
| BrandPicker unit tests 9/9 | `npx vitest run src/components/watch/BrandPicker.test.tsx` | 9 tests passed | PASS |
| WatchForm unit tests 8/8 | `npx vitest run src/components/watch/WatchForm.test.tsx` | 8 tests passed | PASS |
| CMS brands SA tests 13/13 | `npx vitest run src/app/actions/__tests__/cms-brands.test.ts` | 13 tests passed | PASS |
| CMS families SA tests 18/18 | `npx vitest run src/app/actions/__tests__/cms-families.test.ts` | 18 tests passed | PASS |
| `/admin/brands` route in build | `npm run build` output includes route | Route present in build output | PASS |
| `/admin/families` route in build | `npm run build` output includes route | Route present in build output | PASS |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `BrandPicker.tsx` | 24 | `font-medium` in JSDoc comment body | INFO | Not a rendered Tailwind utility; appears in `/* */` comment citing the guardrail rule itself. No visual impact. |

No other debt markers (TBD/FIXME/XXX), hardcoded empty returns, or stub patterns found across Phase 82 deliverables.

---

## Human Verification Required

82-POST-DEPLOY.md operator runbook checkpoints are the remaining gate for prod deployment. The automated suite (48 tests + build) verifies structure and logic; the following behaviors require a human walkthrough:

### 1. Local-first walkthrough (Steps 1a/1b/1c/1d)

**Test:** Per 82-POST-DEPLOY.md, sign in as admin on `npm run dev` against local Supabase. Walk: (1a) `/watch/new` structured entry → BrandPicker typeahead → unknown brand affordance → Find specs → verify `needs_review = true` brand in DB. (1b) `/w/[ref]/edit` as admin → chips render + admin link cluster visible; as non-admin → chips only. (1c) `/admin/brands` → seed TestBrand82Seed → Confirm/Rename/Merge with radiogroup pre-flight → verify atomic move. (1d) `/admin/families` → Rename/Add-alias/Remove-alias cycle + optional alias resolver round-trip.
**Expected:** All 4 sign-off checkboxes ticked per runbook.
**Why human:** SQL transaction atomicity (merge), real-DOM combobox interactions, `router.refresh()` cycle, and alias resolver round-trip require live `npm run dev` + local Supabase.

### 2. Bundled prod push + Vercel deploy (Step 2)

**Test:** `git push origin main`; confirm Vercel build green on dashboard; smoke `curl` `/admin/brands`.
**Expected:** Deploy succeeds; admin page returns 200 for authenticated admin, redirect for anon.
**Why human:** Production push is a human action.

### 3. iPhone Safari BrandPicker (Step 3a)

**Test:** On iPhone Safari prod, `/watch/new` → structured entry → BrandPicker popup opens, known brand tap selects, unknown brand affordance appears and fires on tap, Find specs completes without blocking.
**Expected:** All mobile interactions work; no tap-target failures.
**Why human:** Mobile-Safari behavior per `[[mobile-ui-verify-on-prod]]` memory — desktop verifies locally but iPhone Safari verifies on prod only.

### 4. Prod admin queue page render (Step 3b)

**Test:** Visit `/admin/brands` and `/admin/families` on prod; confirm rows render in correct order; read-only navigation only (no destructive prod actions during UAT).
**Expected:** Both pages load with brand/family rows; `needs_review` badges visible on flagged rows.
**Why human:** Prod DB state required for meaningful row verification.

### 5. WatchForm deep-link round-trip (Step 3c)

**Test:** From a catalog-linked watch edit page, click "Edit family" → assert `/admin/families?brandId=` filter banner renders + "Clear filter" dismisses it. Click "Edit brand" → assert `/admin/brands#brand-{id}` scroll + 1s background highlight fires.
**Expected:** Both deep-links land on correct admin page sections; filter banner copy "Showing families of {brandName}. Clear filter." visible.
**Why human:** Visual scroll-to + pulse animation is not unit-testable; filter banner requires live prod DB row with a `brandId` match.

---

## Gaps Summary

No gaps found. All 5 success criteria are satisfied in the delivered code. The `human_needed` status reflects 82-POST-DEPLOY.md operator walkthrough requirements, not automated verification failures.

---

_Verified: 2026-07-14T20:03:00Z_
_Verifier: Claude (gsd-verifier)_
