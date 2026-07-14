---
phase: 82-add-watch-ui-operator-admin
plan: "06"
deploy_type: bundled-code-only
has_migration: false
local_gate_ref: 82-VALIDATION.md § Manual-Only Verifications
deployed_at: <TBD by operator>
deployed_commit: <TBD by operator>
---

# Phase 82 — POST-DEPLOY Runbook

**Date written:** 2026-07-13
**Operator:** Tyler Waneka
**Depends on:** Plans 01/02/03/04/05 all committed on `main`
**Goal:** Verify BrandPicker + WatchForm chips + /admin/brands + /admin/families locally, then ship to prod and confirm on iPhone Safari.

---

## Purpose

Phase 82 closes v8.4's user-facing and operator-admin loop:

1. **UI-01/02 — BrandPicker on structured entry** (`/watch/new` structured panel): the Brand field is now a combobox that filters existing brands client-side, with a "Couldn't find that brand — add as X" affordance when zero matches. Clicking the affordance locks the typed string; the existing `/api/extract-watch` route auto-creates the brand row with `needs_review = true` silently.

2. **UI-03 — WatchForm read-only chips** (`/w/[ref]/edit`): catalog-linked watches render canonical `brands.name` / `watch_families.name` as read-only chips. Admin owners see an "Edit brand" → `/admin/brands#brand-{id}` and "Edit family" → `/admin/families?brandId={brandId}` link cluster beneath the chips. Non-admin owners see the chips but not the links. `catalogId = null` legacy watches keep editable Inputs.

3. **OPS-01 — /admin/brands** full queue: Confirm as new (flips `needs_review`), Rename (regenerates slug), Merge into (transactional — moves watch_families + watches_catalog refs, deletes source, with WAI-ARIA radiogroup pre-flight when source has referencing families). Deep-link `#brand-{id}` scrolls + pulses.

4. **OPS-02 — /admin/families** full queue: Confirm as new, Rename, Add alias (normalized to lowercase, deduped), Remove alias. Aliases feed directly into Phase 80's resolver tier-2 for future ingests. `?brandId=` filter banner for the WatchForm deep-link.

**Why bundled deploy is safe:** Phase 82 is code-only — no schema migration (all v8.4 schema shipped in Phases 78–80). Prod DB is fully canonical post-Phase-79.

---

## Pre-Deploy Checklist

Before running Step 1:

- [ ] All Phase 82 commits on `main`: `git log --oneline | head -20` shows commits for Plans 01/02/03/04/05 (feat 82-01/02/03/04/05 + their docs commits).
- [ ] `git status` shows no uncommitted Phase 82 code (untracked planning artifacts like `.bak` files are acceptable).
- [ ] Local Supabase is running: `supabase status` shows active.
- [ ] `.env.development.local` exists and points `DATABASE_URL` + `NEXT_PUBLIC_SUPABASE_*` to `127.0.0.1:54321`/`54322`.

---

## Step 1 — Local-First Verification (npm run dev + local Supabase)

Per `[[local-first-dev]]` — verify all runtime paths before prod push.

Start the dev server first:

```bash
npm run dev
# leave running; use a separate terminal for SQL commands
```

---

### Step 1a — BrandPicker + "Couldn't find" affordance + auto-create (UI-01 / UI-02)

**Sign in as:** `viewer@horlo.test` (password: `password123`) — non-admin user

1. Navigate to `/watch/new`.
2. Click "Not finding it? Add manually" to reach the Structured Entry panel.
3. In the Brand field (now a combobox input, not a bare text input), type `CustomWatchCoTest82`.
   - Assert the popup opens.
   - Assert all items are filtered to zero (no brand contains this string).
   - Assert the footer affordance button appears with the exact text: `Couldn't find that brand — add as "CustomWatchCoTest82"`
4. Click the affordance button.
   - Assert the popup closes.
   - Assert the typed string `CustomWatchCoTest82` remains locked in the brand field.
5. Fill in a model name (e.g., `TestModel82`). Fill any other required fields if present. Leave the URL/reference blank or use a throwaway value.
6. Click **Find specs**.
   - Assert the extract flow completes without a blocking client-visible error (the URL fetch may fail or return no useful data — that is fine; the assertion is that no error about the brand appears).
7. Verify the DB row was auto-created:

```bash
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c \
  "SELECT id, name, needs_review FROM brands WHERE name = 'CustomWatchCoTest82';"
# expect: 1 row with needs_review = true
```

8. Cleanup (required before Step 1c to keep the admin queue uncontaminated):

```bash
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c \
  "DELETE FROM brands WHERE name = 'CustomWatchCoTest82';"
```

**Sign-off:** - [ ] Step 1a PASS — affordance appeared, popup closed, auto-create row confirmed in DB, cleanup done.

---

### Step 1b — WatchForm read-only chips + admin link cluster (UI-03)

**Part A — Admin owner sees chips + links**

1. Sign in (or stay signed in) as tyler (admin).
2. Navigate to `/w/[ref]/edit` for any watch where `catalog_id` is not null (most post-Phase-79 watches qualify — pick any from your collection).
   - Assert the Brand field renders as a **read-only chip** (a `<div>` with a grey-muted border, not a text `<Input>`). It should show the canonical `brands.name`.
   - Assert the Model field also renders as a **read-only chip** showing the canonical `watch_families.name`.
   - Assert an "Edit brand" link is visible below/beside the chips. Clicking it should navigate to `/admin/brands#brand-{brandId}` (the brands queue page, anchored to the row).
   - Assert an "Edit family" link is also visible. Clicking it should navigate to `/admin/families?brandId={brandId}`.

**Part B — Non-admin owner sees chips WITHOUT links**

3. Sign out; sign in as `viewer@horlo.test` (password: `password123`).
4. Navigate to `/w/[ref]/edit` for a watch owned by this user with `catalog_id` != null. (If viewer@horlo.test has no catalog-linked watches in the local seed, pick any viewer-owned watch and manually set `catalog_id` to a valid value via SQL, then reset afterward.)
   - Assert the Brand and Model fields render as **read-only chips** (no editable input).
   - Assert the "Edit brand" / "Edit family" link cluster is **NOT present** in the DOM (not just hidden — absent).

**Part C — Legacy null catalogId still shows editable Inputs (optional)**

5. Optionally: via SQL, temporarily set `catalog_id = NULL` on one watch row; reload its edit page; assert editable `<input>` fields for brand + model reappear; revert the change:

```bash
# Before:
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c \
  "UPDATE watches SET catalog_id = NULL WHERE id = '<watch-id>';"

# After verifying editable inputs appear, revert:
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c \
  "UPDATE watches SET catalog_id = '<original-catalog-id>' WHERE id = '<watch-id>';"
```

**Sign-off:** - [ ] Step 1b PASS — admin sees chips + link cluster; non-admin sees chips without links; (optional) null catalogId shows editable Inputs.

---

### Step 1c — /admin/brands queue: Confirm + Rename + Merge (OPS-01)

**Sign in as tyler (admin).**

1. Navigate to `/admin/brands`.
   - Assert `AdminSubNav` shows 4 tabs: **Curated Lists** / **Collection Paths** / **Brands** / **Families**.
   - Assert the Brands tab is active.
   - Assert the queue renders (may be empty if no `needs_review = true` brands exist locally).

2. Seed a `needs_review` brand for Confirm + Rename testing:

```bash
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c \
  "INSERT INTO brands (name, slug, needs_review) VALUES ('TestBrand82Seed', 'testbrand82seed-abc123', true) RETURNING id;"
# copy the id — you'll need it for SQL checks
```

3. Refresh `/admin/brands`.
   - Assert `TestBrand82Seed` appears at the **top** of the list with a `needs review` badge.

4. Click **Confirm as new** on `TestBrand82Seed`.
   - Assert a success toast appears: "Brand confirmed." (or similar).
   - Assert the row re-renders without the `needs review` badge.
   - SQL verify:

```bash
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c \
  "SELECT needs_review FROM brands WHERE name = 'TestBrand82Seed';"
# expect: false
```

5. Click **Rename brand** on `TestBrand82Seed`.
   - Assert a dialog opens with title "Rename TestBrand82Seed" (or similar).
   - Change the name to `TestBrand82Renamed`.
   - Click **Rename brand** in the dialog footer.
   - Assert a success toast + the row updates to `TestBrand82Renamed`.
   - SQL verify (slug should be regenerated with a new random suffix):

```bash
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c \
  "SELECT name, slug FROM brands WHERE name = 'TestBrand82Renamed';"
# expect: name = 'TestBrand82Renamed'; slug = 'testbrand82renamed-<suffix>'
```

6. Seed a second brand **with a referencing family** for Merge testing:

```bash
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres << 'SQL'
INSERT INTO brands (name, slug, needs_review)
  VALUES ('TestBrand82MergeSource', 'tb82ms-abc123', false)
  RETURNING id;
-- copy this id as MERGE_SOURCE_ID

INSERT INTO watch_families (name, brand_id)
  VALUES ('TestFam82', '<MERGE_SOURCE_ID>');
-- replace <MERGE_SOURCE_ID> with the id from above
SQL
```

7. On the `TestBrand82MergeSource` row, click **Merge into…**.
   - A dialog opens.
   - Use the BrandPicker inside the dialog to select `TestBrand82Renamed` as the merge target.
   - Assert a **WAI-ARIA radiogroup** appears with copy similar to: "Source brand has 1 families. Merging will move all families to target. Continue?" — with a radio option "Move all 1 families to target" selected by default.
   - Confirm merge (click the Merge/Confirm button).
   - Assert a success toast "Brand merged." (or similar).
   - Assert `TestBrand82MergeSource` row disappears from the queue.
   - SQL verify:

```bash
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres << 'SQL'
-- Source brand should be deleted:
SELECT COUNT(*) FROM brands WHERE name = 'TestBrand82MergeSource';
-- expect: 0

-- TestFam82 should now reference the target brand:
SELECT b.name AS brand_name
  FROM watch_families wf
  JOIN brands b ON b.id = wf.brand_id
 WHERE wf.name = 'TestFam82';
-- expect: TestBrand82Renamed
SQL
```

8. Cleanup:

```bash
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c \
  "DELETE FROM watch_families WHERE name = 'TestFam82'; DELETE FROM brands WHERE name = 'TestBrand82Renamed';"
```

9. Deep-link check: from the Step 1b WatchForm (admin owner), click **Edit brand**.
   - Assert navigation goes to `/admin/brands#brand-{brandId}`.
   - Assert the matching row scrolls into view and briefly pulses a background highlight (~1 second).

**Sign-off:** - [ ] Step 1c PASS — Confirm/Rename/Merge round-tripped correctly; WAI-ARIA radiogroup fired on merge with families; deep-link scroll + pulse verified; cleanup done.

---

### Step 1d — /admin/families queue: Rename + Add alias + Remove alias + alias round-trip (OPS-02)

**Sign in as tyler (admin).**

1. Navigate to `/admin/families`.
   - Assert the queue renders with family rows.
   - Assert the filter banner is absent (no `?brandId` in the URL).

2. Seed a test family (or use any existing family — the cleanup step will remove only the seed row):

```bash
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c \
  "SELECT id FROM brands LIMIT 1;"
# copy one brand id as SOME_BRAND_ID

psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c \
  "INSERT INTO watch_families (name, brand_id, needs_review) \
   VALUES ('TestFamily82', '<SOME_BRAND_ID>', true) RETURNING id;"
# copy this id as TEST_FAMILY_ID
```

3. Refresh `/admin/families`.
   - Assert `TestFamily82` appears with a `needs review` badge.

4. Click **Rename** on `TestFamily82`.
   - Dialog opens; rename to `TestFamily82Renamed`.
   - Click **Rename family** in dialog.
   - Assert success toast + row updates to `TestFamily82Renamed`.

5. Click **Add alias** on `TestFamily82Renamed`.
   - Assert the dialog "Aliases for TestFamily82Renamed" (or similar) opens.
   - The alias chip strip is empty.
   - Type `Test Alias 82` (mixed case + spaces).
   - Click **Add alias**.
   - Assert the chip strip now shows one badge: `test alias 82` (normalized to lowercase+trimmed).

6. Attempt to add the same alias again:
   - Type `Test Alias 82` again.
   - Click **Add alias**.
   - Assert the chip strip still shows exactly 1 badge (dedup silently no-ops).

7. SQL verify alias stored:

```bash
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c \
  "SELECT aliases FROM watch_families WHERE name = 'TestFamily82Renamed';"
# expect: {test alias 82}  (or equivalent Postgres array notation)
```

8. Click the X on the `test alias 82` chip.
   - Assert a success toast "Alias removed." (or similar).
   - Assert the chip strip is now empty.

9. SQL verify alias removed:

```bash
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c \
  "SELECT aliases FROM watch_families WHERE name = 'TestFamily82Renamed';"
# expect: {}
```

10. Alias resolver round-trip (optional but recommended):
    - Add alias `brut date` to `TestFamily82Renamed` via the dialog.
    - Navigate to `/watch/new` → structured entry.
    - Set Brand to `TestFamily82Renamed`'s brand; set Model to `Brut Date` (mixed case).
    - Click **Find specs**.
    - SQL verify the alias tier resolved correctly (check the most recently created `watches_catalog` row):

```bash
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c \
  "SELECT family_id FROM watches_catalog ORDER BY created_at DESC LIMIT 1;"
# expect: id matching TestFamily82Renamed — NOT a newly-created family row
```

11. Deep-link filter check:
    - Navigate to `/admin/families?brandId=<SOME_BRAND_ID>` (replace with a real UUID).
    - Assert the banner appears: `Showing families of <BrandName>. Clear filter.`
    - Assert only that brand's families are visible in the queue.
    - Click "Clear filter." — assert banner disappears and full queue returns.

12. Cleanup:

```bash
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c \
  "DELETE FROM watch_families WHERE name IN ('TestFamily82Renamed', 'TestFamily82');"
# if the alias round-trip in step 10 created a watches_catalog row, delete it:
# DELETE FROM watches_catalog WHERE family_id = '<TEST_FAMILY_ID>';
```

**Sign-off:** - [ ] Step 1d PASS — Rename, Add alias (normalized + dedup), Remove alias, deep-link filter + banner all verified; (optional) resolver alias round-trip confirmed; cleanup done.

---

## Step 2 — Bundled Prod Deploy

Per Phase 81 close pattern — single `git push` covers Plans 01–05 in one Vercel deploy.

1. Verify all Phase 82 commits are on `main` and tree is clean:

```bash
git log --oneline -20
# scan for: feat(82-01), feat(82-02), feat(82-03), feat(82-04), feat(82-05)
# and their corresponding docs commits

git status
# expect: nothing to commit, working tree clean
# (untracked .bak / scripts files are acceptable and do not affect the deploy)
```

- [ ] All Phase 82 commits present on `main`.
- [ ] Working tree clean (no uncommitted Phase 82 code changes).

2. Push to `main`:

```bash
git push origin main
```

Expected duration: instant (push) + 2–4 minutes (Vercel build + deploy).

- [ ] `git push` completed without error.

3. Watch the Vercel deploy:
   - Open [Vercel dashboard](https://vercel.com/) → horlo project → latest deployment.
   - Wait for status = **Ready**.

- [ ] Vercel deploy status: **Ready** (green).

4. Smoke check:

```bash
curl -sfI https://horlo.app/watch/new | head -1
# expect: HTTP/2 200 or HTTP/2 307 (redirect to /login if unauthenticated)
```

- [ ] Smoke check: 200 or 307 returned.

**Typical failure modes:**
- **TypeScript pass fails:** matches `[[reexport-only-doesnt-bind-locally]]` pattern. Check the Vercel build log for the file + line. Push a follow-up fix commit.
- **Missing env var:** Phase 82 introduces no new env vars. If this fires, the failure is unrelated to Phase 82.

---

## Step 3 — Prod UAT (iPhone Safari + desktop)

Per `[[mobile-ui-verify-on-prod]]` — mobile-Safari behavior verifies on prod.

---

### Step 3a — BrandPicker on iPhone Safari (UI-01 / UI-02)

1. On iPhone Safari, sign in to `https://horlo.app`.
2. Navigate to `/watch/new`.
3. Click "Not finding it? Add manually" to reach the Structured Entry panel.
4. Tap the Brand field.
   - Assert the BrandPicker popup opens.
   - Assert tap targets are large enough to use comfortably (minimum 44px height per D-82-05).
5. Type a known brand (e.g., `Rolex`, `Hamilton`, `Omega`).
   - Assert the dropdown filters to matching brands.
   - Tap one of the results.
   - Assert the popup closes and the selected brand is locked in the field.
6. Clear the field. Type `TestMobileBrand82` (a string that does not exist).
   - Assert zero items shown.
   - Assert the affordance appears: `Couldn't find that brand — add as "TestMobileBrand82"`
   - Tap the affordance button.
   - Assert the popup closes and `TestMobileBrand82` is locked in the field.
7. Tap **Find specs** (with the unknown brand locked).
   - Assert the flow proceeds without a blocking error specific to mobile.
   - (The extract may fail on the URL fetch — that is acceptable; no brand-related error should appear.)

- [ ] Step 3a PASS — BrandPicker filters on mobile; known-brand tap selects; unknown-brand affordance appears and tapping it closes the popup; Find specs completes.

---

### Step 3b — /admin/brands + /admin/families on desktop (OPS-01 / OPS-02)

**On desktop Chrome or Safari, signed in as tyler (admin).**

1. Navigate to `https://horlo.app/admin/brands`.
   - Assert `AdminSubNav` shows 4 tabs (Curated Lists, Collection Paths, Brands, Families).
   - Assert the Brands queue renders.
   - If any `needs_review = true` brands exist from real user activity, they should appear at the top.
   - **Do NOT run Confirm/Rename/Merge on prod data** without explicitly intending to — read-only navigation only unless you have a specific target in mind.

2. Navigate to `https://horlo.app/admin/families`.
   - Assert the Families queue renders with family rows.
   - Assert no `?brandId` banner is shown (no filter active).
   - **Do NOT run Add alias / Remove alias / Rename on prod data** without explicitly intending to — read-only navigation only.

- [ ] Step 3b PASS — /admin/brands renders; /admin/families renders; AdminSubNav shows 4 tabs; no destructive actions taken on prod data.

---

### Step 3c — /admin/families?brandId= deep-link from WatchForm (UI-03 + OPS-02 seam)

**On desktop, signed in as tyler (admin).**

1. Navigate to `/w/[ref]/edit` for any of your own catalog-linked watches on prod.
   - Assert the Brand and Model fields render as **read-only chips** (not editable inputs).
   - Assert the "Edit brand" and "Edit family" links are visible.
2. Click **Edit family**.
   - Assert navigation goes to `/admin/families?brandId=<real-brand-id>`.
   - Assert the filter banner appears: `Showing families of <BrandName>. Clear filter.`
   - Assert the queue shows only families belonging to that brand.
   - Click **Clear filter.**
   - Assert the banner disappears and the full families queue loads.
3. Go back; click **Edit brand**.
   - Assert navigation goes to `/admin/brands#brand-{brandId}`.
   - Assert the brands queue scrolls to that row and briefly highlights it.

- [ ] Step 3c PASS — WatchForm admin links navigate correctly; /admin/families?brandId= filter + banner renders; /admin/brands#brand-{id} scroll + highlight fires; Clear filter resets the queue.

---

## Requirement Sign-Off Table

After all steps above are ticked, flip this table:

| Req | Coverage | Local Step | Prod Step | Status |
|-----|----------|------------|-----------|--------|
| UI-01 | BrandPicker combobox on structured entry | Step 1a | Step 3a | ⬜ |
| UI-02 | "Couldn't find" affordance + auto-create with needs_review | Step 1a | Step 3a | ⬜ |
| UI-03 | WatchForm read-only chips + admin link cluster | Step 1b + 1c (deep-link) | Step 3c | ⬜ |
| OPS-01 | /admin/brands Confirm/Rename/Merge + WAI-ARIA pre-flight | Step 1c | Step 3b | ⬜ |
| OPS-02 | /admin/families Rename/Add-alias/Remove-alias + ?brandId filter | Step 1d | Step 3b + 3c | ⬜ |

---

## Step 4 — Post-Close Actions (after all sign-offs are ✅)

These actions belong to the **operator** after prod UAT passes. The executor does not run these.

- [ ] Update `.planning/REQUIREMENTS.md` — flip UI-01, UI-02, UI-03, OPS-01, OPS-02 checkboxes and traceability table rows to "Complete / 2026-07-13".
- [ ] Update `.planning/ROADMAP.md` — mark Phase 82 complete; flip v8.4 milestone header from 🚧 to ✅ if all 25/25 requirements are shipped.
- [ ] Run `gsd-sdk query phase.complete 82` (or `/gsd-verify-work 82` equivalent).
- [ ] Hand-correct `STATE.md` after `phase.complete` runs — the `next_phase` field is expected to mis-set to `999.1` (5th recurrence per `[[phase-complete-999-1-misset]]`). Correct it to `null`; set milestone status to "complete; next action: /gsd-complete-milestone v8.4".
- [ ] Extract memory `[[phase-82-complete]]` with what shipped (BrandPicker UI-01/02, WatchForm chips UI-03, /admin/brands OPS-01, /admin/families OPS-02) and any close-time gotchas.
- [ ] Run `/gsd-complete-milestone v8.4` to archive Phase 82 and close the v8.4 milestone.

---

## Rollback Plan

Phase 82 is code-only — no schema migration to undo.

**If Vercel build fails (Step 2):** The failed build does not become the live deploy. Fix the TypeScript error, push a follow-up commit, wait for Ready.

**If prod UAT surfaces a bug (Step 3):** Identify which Plan owns the misbehaving path, revert with `git revert <hash>`, push. Phase 82 has five logical rollback targets:
- Plan 01 (`0ce30065`, `985dbcd0`) — DAL + prop threading
- Plan 02 (`6e983017`, `b00d8015`) — BrandPicker component
- Plan 03 (`de5a13f5`) — WatchForm chips + admin link
- Plan 04 (`4ddd4d61`, `f3caf90f`) — /admin/brands
- Plan 05 (`fe8f85ca`, `dc5c57f3`) — /admin/families

---

## Sign-Off

| Field | Value |
|-------|-------|
| Local walkthrough completed | \_____ |
| Deploy commit (post `git push`) | \_____ |
| Vercel Ready | \_____ |
| iPhone Safari UAT completed | \_____ |
| Desktop desktop follow-up completed | \_____ |
| Operator sign-off (Tyler) | \_____ |
| Date | \_____ |

---

## References

- **Phase context:** `.planning/phases/82-add-watch-ui-operator-admin/82-CONTEXT.md`
- **Validation contract:** `.planning/phases/82-add-watch-ui-operator-admin/82-VALIDATION.md`
- **Plan 01 (DAL + prop pipeline):** `82-01-SUMMARY.md`
- **Plan 02 (BrandPicker):** `82-02-SUMMARY.md`
- **Plan 03 (WatchForm chips):** `82-03-SUMMARY.md`
- **Plan 04 (/admin/brands):** `82-04-SUMMARY.md`
- **Plan 05 (/admin/families):** `82-05-SUMMARY.md`
- **Phase 81 POST-DEPLOY (precedent):** `.planning/phases/81-recommender-display-server-action-swap/81-POST-DEPLOY.md`
- **Local-first gate:** `CLAUDE.md` § Local-First Development
- **Memories:** `[[local-first-dev]]`, `[[mobile-ui-verify-on-prod]]`, `[[phase-complete-999-1-misset]]`, `[[reexport-only-doesnt-bind-locally]]`, `[[next-clear-operational-debt]]`

---

*Runbook generated 2026-07-13 by /gsd-execute-phase (Plan 82-06)*
*Wave scope: Plans 82-01/02/03/04/05 landed on `main`; deploy uses bundled push per Phase 81 close pattern.*
