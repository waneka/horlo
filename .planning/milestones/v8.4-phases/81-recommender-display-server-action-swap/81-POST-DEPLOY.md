---
phase: 81-recommender-display-server-action-swap
plan: 04
deploy_type: bundled-code-only
has_migration: false
local_gate_ref: 81-04-SUMMARY.md
deployed_at: <TBD by operator>
deployed_commit: <TBD by operator>
---

# Phase 81 — Prod Deployment Runbook

**Date written:** 2026-07-12
**Operator:** Tyler Waneka
**Depends on:** Plans 01/02/03 all committed on `main`; Plan 04 local walkthrough green
  (see `81-04-SUMMARY.md`)
**Goal:** Ship the recommender + Server Action canonical brand/family swap to prod
  in a single Vercel push, then confirm on Tyler's real collection that the drift
  loop is closed end-to-end on prod data.

---

## Purpose

Phase 81 makes two coordinated code changes with no schema impact:

1. **Recommender read-path canonical FK swap** (Plan 02) — the "From Collectors
   Like You" rail now excludes drift-branded rows by canonical `brand_id` /
   `family_id` (not free-text `brand|model` strings), boosts multi-brand matches
   through canonical `brand_id`, and renders rationale copy from canonical
   `brands.name` via INNER JOIN in `topUpFromCatalogPopularity`. An owner of
   `Hamilton` no longer sees `Hamilton Watch` in their own rail; peers' Hamilton
   watches surface under the rationale `Fans of Hamilton love this` (canonical),
   never `Fans of Hamilton Watch love this` (drift).

2. **Server Action canonical overwrite on writes** (Plan 03) — `addWatch` (both
   branches) and `editWatch` auto-overwrite `watches.brand` / `watches.model`
   from the resolved canonical `brands.name` / `watch_families.name` before
   persisting. A user typing `Hamilton Watch` at add-watch or edit-watch time
   persists `Hamilton` in the DB. Non-catalog-linked watches (Phase 17
   `ON DELETE SET NULL` legacy) bypass the overwrite cleanly.

**Why bundled deploy is safe:** Phase 81 introduces no schema change (Phase 80
already flipped `brand_id` + `family_id` to NOT NULL and prod DB is fully
canonicalized post-Phase-79). All runtime behavior is code-only. The local
walkthrough documented in `81-04-SUMMARY.md` proves all four assertions
(RECO-01 exclusion, RECO-04 canonical rationale, DISP-01 add-write, DISP-02
edit-write) hold against a live post-Phase-79 DB with a synthesized drift
catalog row. Prod smoke re-verifies the same four assertions on real prod data
without any drift fixture (prod is canonical post-Phase-79).

---

## Pre-Deploy Checklist

Before running the deploy steps:

- [ ] `81-04-SUMMARY.md` exists and every walkthrough step is marked pass —
      SQL inspection outputs must show canonical `brand='Hamilton'` persisted
      for DISP-01/02 test watches, and rail screenshots (or observation notes)
      must show `Fans of Hamilton love this` (not `Hamilton Watch`) for
      RECO-04.
- [ ] Local drift fixture cleanup ran (REVERT block applied) — no lingering
      `Hamilton Watch / DriftTest Chrono` row in local `watches_catalog`; no
      lingering `Test DISP-01` / `Test DISP-02` watches under
      `viewer@horlo.test`.
- [ ] `git status` is clean — no uncommitted or unstaged code changes.
- [ ] `git log --oneline -20` shows a coherent Phase 81 commit range on
      `main`: Plans 01/02/03 execution commits (7 total) + this plan's fixture
      + POST-DEPLOY commits. No worktree branches (per
      `[[next-clear-operational-debt]]` — `workflow.use_worktrees=false`
      globally).
- [ ] `main` is up to date with `origin/main` (no unmerged upstream commits
      that might change file paths mid-push).

---

## Deploy Steps

Phase 81 is a **single-push, code-only** deploy. No migration order to
choreograph; no soak window required. Total operator time: ~5 minutes.

### Step 1 — Confirm the local gate is green

**What you're doing:** Rechecking that `81-04-SUMMARY.md` records a
walkthrough where all four D-81-04 assertions passed. This is the primary
correctness gate per `[[local-first-dev]]`.

**Commands:**

```bash
grep -c "PASS" .planning/phases/81-recommender-display-server-action-swap/81-04-SUMMARY.md
# expect: at least 4 (one per assertion — RECO-01 / RECO-04 / DISP-01 / DISP-02)

grep -c "cleanup executed\|REVERT applied" .planning/phases/81-recommender-display-server-action-swap/81-04-SUMMARY.md
# expect: at least 1 (post-walk cleanup was run)
```

**If either grep fails:** stop and revisit the local walkthrough before
pushing. The bundled deploy assumes the local gate is green.

---

### Step 2 — Confirm all Phase 81 code commits are on `main` and working
tree is clean

**What you're doing:** Verifying nothing is uncommitted and the Plan 01/02/03
+ Plan 04 fixture commits are all present as a coherent range. Phase 81 has
**no migration to push** — this is a pure code deploy.

**Commands:**

```bash
git status
# expect: nothing to commit, working tree clean (or only untracked non-Phase-81
# artifacts — verify none look like Phase 81 leftovers)

git log --oneline -20
# scan for: Plan 01 commits (feat/docs 81-01), Plan 02 commits (feat 81-02),
# Plan 03 commits (test/feat/docs 81-03), Plan 04 commits (test/docs 81-04)
```

**If uncommitted Phase 81 changes are present:** stage + commit them
individually before pushing. Do not `git add -A` — enumerate files.

---

### Step 3 — Push to `main`

**What you're doing:** Pushing the bundled Phase 81 code + fixture + docs to
`origin/main`. Vercel auto-deploys on push. The single push covers Plans 01
through 04 in one deploy.

**Commands:**

```bash
git push origin main
```

Expected duration: instant (push) + 2–4 minutes (Vercel build + deploy).

---

### Step 4 — Wait for the Vercel deploy to go green

**What you're doing:** Confirming the Vercel build succeeded before smoke
testing. If the build fails, do NOT proceed to Step 5 — investigate the build
error first.

**Where to check:** [Vercel dashboard](https://vercel.com/) → horlo project
→ latest deployment. Wait for state = **Ready**. Expected build time ≈ 2–4
minutes (Phase 81 changes touch ~4 src files + a handful of tests; no new
deps).

**Typical failure modes and mitigations:**

- **TypeScript pass fails on an in-file caller** — matches the
  `[[reexport-only-doesnt-bind-locally]]` pattern (Phase 80 Plan 01 hit this).
  Add an `import` alongside any Phase 81 re-export. Push a fix commit.
- **Env var missing on prod** — Phase 81 uses no new env vars; if this fires,
  the failure is unrelated to Phase 81.

If build succeeds → proceed to Step 5.

---

### Step 5 — Prod smoke walkthrough on Tyler's account

**What you're doing:** Mirroring the D-81-04 local walkthrough on prod
against Tyler's real collection. Prod is already canonical post-Phase-79
(no `Hamilton Watch` catalog rows survived Phase 79 apply — see
`79-POST-DEPLOY.md` verification section), so this walk does **NOT** apply
the drift fixture on prod. It proves the code works against real
canonical data.

Steps (i)–(iv) mirror the local D-81-04 walkthrough:

**(i) RECO-01 self-exclusion sanity check on prod**

1. Sign into `https://horlo.app` as Tyler.
2. Load the home page.
3. Inspect the "From Collectors Like You" rail.
4. **Assert:** none of Tyler's own owned watches appear in the rail. The
   exclusion loop now keys on canonical `brandId | familyId` (with the
   `${brand}|${model}` fallback for legacy `catalog_id = null` edge case
   only). Because Tyler's watches are all catalog-linked post-Phase-79, the
   FK-keyed exclusion path fires; nothing Tyler owns should surface.

**(ii) RECO-04 canonical rationale text on prod**

1. On the same rail, find any recommendation whose rationale references a
   brand Tyler owns (Hamilton is the load-bearing case; any other match is
   also acceptable evidence).
2. **Assert:** the rationale reads `Fans of Hamilton love this` (canonical
   `brands.name`), **NOT** `Fans of Hamilton Watch love this`. The rail's
   `topUpFromCatalogPopularity` now INNER JOINs `brands` + `watch_families`
   and projects `b.name` / `f.name` — synthetic top-up rows carry canonical
   display strings.

**(iii) DISP-01 add-watch canonical overwrite on prod**

1. Navigate to Add Watch (`/watch/new` or the equivalent flow).
2. Choose an intentionally-drifted brand string. Since prod is canonical
   post-Phase-79 and there is no live `Hamilton Watch` catalog row, the
   catalog-id branch cannot be exercised with drift text on prod. Instead,
   exercise the **user-input branch**: type an intentional case-variant of
   an existing prod brand, e.g. type `hamilton watch` (all lowercase, or
   `HAMILTON WATCH` all caps) with a throwaway model like `Prod DISP-01 Test`
   and a `reference` you can identify.
3. Submit the form.
4. Open the [Supabase prod SQL editor](https://supabase.com/dashboard/)
   and run:

```sql
SELECT id, brand, model, reference, catalog_id, created_at
  FROM watches
 WHERE user_id = (SELECT id FROM auth.users WHERE email = '<tyler's email>')
   AND model = 'Prod DISP-01 Test'
 ORDER BY created_at DESC LIMIT 1;
```

5. **Assert:** `brand = 'Hamilton'` (canonical, NOT the typed drift string).
   The Server Action's user-input branch consumes the
   `upsertCatalogFromUserInput` return's `brandName` + `familyName`
   (canonical, JOIN-derived) into `cleanData.brand` / `cleanData.model`.

**(iv) DISP-02 edit-watch canonical overwrite on prod**

1. Navigate to the just-created watch's edit form.
2. Re-type the brand field with the same drift variant (`hamilton watch` or
   `HAMILTON WATCH`). Save.
3. Re-run the same SQL query as step (iii).
4. **Assert:** `brand = 'Hamilton'` (canonical) still. The `editWatch`
   Server Action's canonical overwrite path fetches
   `getCatalogById(priorRow.catalogId)` and writes
   `catalogRow.canonicalBrand` into `updatePayload.brand` before the DB
   UPDATE.

**(v) Cleanup — DELETE the throwaway watch**

Do NOT leave the `Prod DISP-01 Test` watch in Tyler's real collection.

Option A — via the UI: navigate to the watch, delete it.
Option B — via SQL editor:

```sql
DELETE FROM watches
 WHERE user_id = (SELECT id FROM auth.users WHERE email = '<tyler's email>')
   AND model = 'Prod DISP-01 Test';
```

Confirm deletion:

```sql
SELECT COUNT(*)
  FROM watches
 WHERE user_id = (SELECT id FROM auth.users WHERE email = '<tyler's email>')
   AND model = 'Prod DISP-01 Test';
-- expect: 0
```

**Paste your prod smoke observations below this line:**

```
Step (i):  [ ] pass — [note observation]
Step (ii): [ ] pass — [note rationale text seen]
Step (iii) DB row: [ ] pass — [paste brand column value]
Step (iv) DB row after edit: [ ] pass — [paste brand column value]
Step (v) cleanup: [ ] confirmed 0 rows
```

---

## Rollback Plan

Phase 81 is code-only — no DB migration to undo. Rollback is a `git revert`
of the Phase 81 commit range + a Vercel redeploy.

**If Step 4 (Vercel build) fails:**
- No rollback needed — the failed build does not become the live deploy.
- Fix the build error, push a follow-up commit, wait for Ready.

**If Step 5 (prod smoke) surfaces a bug in any of (i)-(iv):**
- Identify which Plan (01, 02, or 03) owns the misbehaving code path.
- Revert the offending Plan's commits with `git revert <hash>` (or a range
  revert if multi-commit). Push. Vercel redeploys the reverted code within
  2–4 minutes.
- Raise a follow-up plan describing the observed prod behavior + the local
  walkthrough gap that missed it.
- **Note:** any data written during Steps (iii)/(iv) prod smoke walk (i.e.
  the throwaway `Prod DISP-01 Test` watch) does NOT require rollback — the
  canonical strings persisted are the correct end state even if the code
  is reverted. Just DELETE the throwaway watch per Step (v).

**If a broader issue surfaces post-deploy (recommender rail 500s, home page
degraded):**
- Immediate mitigation is `git revert` of the merge range and redeploy.
- Phase 81 changes only touch `topUpFromCatalogPopularity` (recommender
  read path) + Server Actions on writes. A 500 on the rail would surface
  in Vercel logs; a broken write would surface as an
  `[watches] canonical overwrite failed` log line or a user-visible error
  on save.

---

## What this push does NOT do (forward-armor against scope creep)

- Does NOT change the schema (Phase 79 + Phase 80 already delivered all v8.4
  schema work — `brand_id` / `family_id` NOT NULL, `aliases text[]`,
  `needs_review` boolean).
- Does NOT sync `watches_catalog.brand` / `watches_catalog.model` to canonical
  strings on write (D-81-03 kept read-time JOIN only; Phase 82's `/admin/brands`
  merge will naturally UPDATE denorm strings when it moves catalog rows).
- Does NOT modify the Phase 80 ingest resolver contract — extension is on
  the upsert helpers' return shape, not on the resolver return.
- Does NOT add admin UI surfaces (Phase 82 UI-01..03, OPS-01/OPS-02).
- Does NOT re-backfill existing personal watches (Phase 79 DISP-03 already
  hydrated them; Phase 81 DISP-01/02 is forward-write-only).
- Does NOT add net-new cache invalidation tags — Phase 75's
  `updateTag(viewer:${user.id}:recs)` tags fanout for `addWatch` and
  `editWatch` are unchanged.

---

## Phase 81 Deliverables Summary

| Requirement | Status |
|-------------|--------|
| RECO-01 — recommender excludes viewer's owned brands via canonical `brand_id` | Landed Plan 02 (`excludeKey(w)` module-scope helper, keyed 3-site identity) |
| RECO-02 — multi-brand `+100` boost via `brand_id IN (…)` clause | Landed Plan 02 (`sql.join(brandArr.map(id => sql\`${id}\`), sql\`, \`)`) |
| RECO-03 — `topBrandOf` keys on canonical `brand_id` + returns `{ brandId, brandName }` | Landed Plan 02 (`topBrandOf(watches, brandNameLookup)`) |
| RECO-04 — rail rationale renders canonical `brands.name` via INNER JOIN | Landed Plan 02 (`topUpFromCatalogPopularity` INNER JOINs `brands` + `watch_families`; synthetic Watch carries canonical `brand`) |
| DISP-01 — `addWatch` persists canonical `watches.brand` / `watches.model` on both branches | Landed Plan 03 (catalogId branch reads `canonicalBrand`; user-input branch consumes `upsertCatalogFromUserInput` return's `brandName`) |
| DISP-02 — `editWatch` canonical overwrite before UPDATE (catalog-linked only) | Landed Plan 03 (guard on `priorRow.catalogId` + brand/model edit; non-catalog-linked bypass verified) |

Local-first gate closed at Plan 04 (this plan). Prod smoke closes the loop
end-to-end.

---

## Sign-off

| Field | Value |
|-------|-------|
| Deploy commit (post `git push`) | \_____ |
| Deploy started (Vercel Ready) | \_____ |
| Step 5 prod smoke completed | \_____ |
| Throwaway prod watch DELETEd | \_____ |
| Operator sign-off (Tyler) | \_____ |
| Date | \_____ |

---

## References

- **Local walkthrough:** `.planning/phases/81-recommender-display-server-action-swap/81-04-SUMMARY.md`
- **Fixture:** `.planning/phases/81-recommender-display-server-action-swap/fixtures/drift-hamilton.sql`
- **Plan 01 (foundation):** `81-01-SUMMARY.md` — Watch type + DAL widening
- **Plan 02 (recommender):** `81-02-SUMMARY.md` — read-path canonical FK swap
- **Plan 03 (Server Actions):** `81-03-SUMMARY.md` — write-path canonical overwrite
- **Phase 79 POST-DEPLOY (predecessor):** `.planning/phases/79-backfill-migration-display-hydration/79-POST-DEPLOY.md`
- **Phase 80 POST-DEPLOY (predecessor):** `.planning/phases/80-not-null-constraint-flip-ingest-hardening/80-POST-DEPLOY.md`
- **D-81-04 walkthrough recipe:** `81-CONTEXT.md` § Decisions § Deploy + local-first verification
- **Local-first gate:** `CLAUDE.md` § Local-First Development
- **Memories:** `[[local-first-dev]]`, `[[drizzle-sql-any-array-pitfall]]`,
  `[[catalog-id-divergence]]`, `[[reexport-only-doesnt-bind-locally]]`,
  `[[next-clear-operational-debt]]`
