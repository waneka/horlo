---
phase: 79-backfill-migration-display-hydration
verified: 2026-06-25T17:40:00Z
status: human_needed
score: 5/5 truths verified (1 with workflow caveat)
overrides_applied: 0
re_verification:
  previous_status: null
  previous_score: null
  gaps_closed: []
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Independently re-run the 6 sign-off SQL queries from 79-POST-DEPLOY.md against prod Supabase (or confirm Tyler did so) — verifier cannot connect to prod"
    expected: "All 6 queries return the values documented in the Sign-off section (205/205 catalog resolved; 4 watches Hamilton / 0 Hamilton Watch; 7 rows pointing at canonical Hamilton 294591c7...; 53 brands; 171 families; natural-key constraint present)"
    why_human: "Verifier has no prod DB connection. The in-session prod sign-off recorded in 79-POST-DEPLOY.md is self-reported by the operator; an independent rerun (or operator re-affirmation) is the contract-level proof"
  - test: "Visually confirm collection grid + detail page + profile rail no longer render 'Hamilton Watch' free-text variants (DISP-03 UI surface contract)"
    expected: "Every user-owned watch whose pre-apply text was 'Hamilton Watch' now renders 'Hamilton' on every surface"
    why_human: "DISP-03 success criterion is phrased as a UI guarantee ('no UI surface still renders stale free-text'); verifier can confirm the DB UPDATE landed (4 watches.brand = 'Hamilton' / 0 = 'Hamilton Watch' per query #5) but the UI-render proof needs a logged-in browser session"
  - test: "Confirm acceptance of SC5 workflow deviation: prod apply was clean ON SECOND ATTEMPT after a one-off SQL Hamilton rename + decision-file regen. Operator must signal whether 'script ships clean; operator pre-flight needed local→prod UUID rekey' counts as MIG-05 met"
    expected: "Tyler confirms the deviation is acceptable + the lesson is captured as the documented [[catalog-id-divergence]] memory extension (already noted as a follow-up in 79-05-SUMMARY)"
    why_human: "This is a judgment call on whether SC5's 'pushes cleanly to prod via supabase db push --linked on the first attempt' applies literally to a SCRIPT push (not a SQL migration). The phase intentionally swapped to script-driven so the SC5 wording in ROADMAP doesn't map verbatim. Verifier flags PASSED WITH CAVEAT pending operator acceptance"
---

# Phase 79: Backfill Migration + Display Hydration — Verification Report

**Phase Goal (ROADMAP.md L290):** Every existing `watches_catalog` row resolves to a canonical `brand_id` and `family_id`; every existing `watches` row whose `catalogId` is set has its display strings hydrated from the canonical names — and a post-flight assertion proves zero unresolved NULLs.

**Verified:** 2026-06-25
**Status:** human_needed (5/5 success criteria substantively met; 2 items need operator visual/connection confirmation; 1 SC5 workflow nuance needs explicit operator acceptance)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Success Criteria (ROADMAP.md L294-298) — Per-Criterion Verification

| #   | Success Criterion (Req)               | Status     | Evidence                                                                                                                                                                                                                                                                                                                                                                       |
| --- | ------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| SC1 | MIG-02 brand backfill `--apply` idempotent | VERIFIED   | `scripts/v8.4-brand-canonicalization.ts` L970 `applyBrandPath()` performs INSERT new brands + UPDATE catalog brand_id. Prod result (79-POST-DEPLOY.md L13-19): 37 new brands, 105 catalog rows resolved → cumulative 205/205. Idempotency proven via integration test `tests/integration/scripts/v8.4-apply-idempotent.test.ts` (4 tests green per 79-04-SUMMARY) + D-79-04 gate at script L914-924. |
| SC2 | MIG-03 family backfill + aliases routing | VERIFIED (scope caveat) | Script L1076 `applyFamilyPath()` implements INSERT new families + idempotent alias-append SQL (L1161 `NOT (aliases @> ARRAY[${sourceNorm}]::text[])`). Prod result: 139 new families, 161 catalog rows resolved → cumulative 205/205. **Zero aliases appended** because operator policy under the prod regen flipped ALL family needs-review rows to `new` (no `merge:` decisions). Aliases-routing CODE PATH is implemented + unit-tested; the Brut Date→Brut Datejust live alias-append remains unproven on prod (no such row existed in prod catalog this run; documented in 79-04-SUMMARY Known Stubs + 79-05-SUMMARY deviation 3). |
| SC3 | MIG-04 post-flight predicate divergence | VERIFIED   | Script L1298 `postFlightAssertion()` uses POSITIVE predicate `IS DISTINCT FROM NULL` (L1310-1311 + L1316-1319) vs UPDATE's `WHERE brand_id IS NULL` (L1021 UPDATE re-run predicate). Throws inside `sql.begin` callback → automatic ROLLBACK on mismatch (L1324-1331). Prod result: total=205 / resolved_brand=205 / resolved_family=205 (79-POST-DEPLOY.md L31-33). Test gate at `tests/unit/scripts/v8.4-post-deploy-template.test.ts` (9 pass) asserts predicate divergence. |
| SC4 | DISP-03 watches display hydration       | VERIFIED (DB) / NEEDS UI CONFIRM | Script L1255 `applyHydration()` UPDATE FROM JOIN — unconditional (no WHERE filter on watches.brand/model text; JOIN naturally skips catalog_id IS NULL orphans per D-79-08). Only `brand` + `model` columns touched. Prod result: 38 watches hydrated (79-POST-DEPLOY.md L19); independent prod query: `watches.brand = 'Hamilton'` → 4 rows; `watches.brand = 'Hamilton Watch'` → 0 rows (79-05-SUMMARY L46-47). DB-level proof complete. UI-render proof (collection grid, detail page, profile rail) routed to human verification (item 2). |
| SC5 | MIG-05 portability — prod push clean first try | PASSED WITH WORKFLOW CAVEAT | The SCRIPT shipped clean first try (post-Plan-04). Plan 79-05's **operator pre-flight** required: (a) one-off SQL `UPDATE brands SET name = 'Hamilton' WHERE id = '294591c7-...'` on prod, (b) `--force --mode=brands` + `--force --mode=families` against prod to regenerate decision files keyed to prod UUIDs (local-keyed file had 0/18 valid UUIDs in prod brands table), (c) operator re-marked needs-review → new. The second `--apply --mode=both` attempt then ran clean — strict gate D-79-01 caught the divergence cleanly. Phase 79 ships NO new SQL migration (script-driven per D-79-05 + 79-CONTEXT specifics L158) so SC5's `supabase db push --linked` literal wording doesn't fully apply; the SC's *intent* (clean prod push) was met on attempt #2. Documented in 79-05-SUMMARY L26-35 + 79-POST-DEPLOY.md L102-112 as a known deviation requiring operator acceptance (see human verification item 3). |

**Score: 5/5 truths verified** (SC2 with scope caveat — aliases routing CODE proven, live alias append on prod deferred for lack of test data; SC5 with workflow caveat).

---

### Required Artifacts

| Artifact                                                                                          | Expected                                                            | Status      | Details                                                                                                                                                |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `scripts/v8.4-brand-canonicalization.ts`                                                          | Atomic apply script with all D-79-* helpers                         | VERIFIED    | 2125 LOC (matches 79-04-SUMMARY); single `sql.begin` callback at L1971 wraps applyBrandPath + applyFamilyPath + applyHydration + postFlightAssertion   |
| `.planning/v8.4-brand-merge-decisions.md`                                                         | Prod-keyed; 17 auto + 1 merge + 37 new + 0 needs-review = 55 rows   | VERIFIED    | Counts confirmed via grep: 17 auto-resolved + 1 merge:294591c7... (Hamilton) + 37 new + 0 needs-review. Committed at `8eee3a10`.                       |
| `.planning/v8.4-family-merge-decisions.md`                                                        | Prod-keyed; 21 auto + 139 new + 0 needs-review = 160 rows           | VERIFIED    | Counts confirmed: 21 auto-resolved + 139 new + 0 needs-review = 160 rows (matches 79-05-SUMMARY L61). Committed at `8eee3a10`.                         |
| `.planning/phases/79-backfill-migration-display-hydration/79-POST-DEPLOY.md`                      | Auto-generated then hand-patched; operator sign-off                 | VERIFIED    | Auto-generated by `writePostDeployArtifact` (script L1479-1483); hand-patched per 79-05-SUMMARY memory follow-up #2; sign-off checked at L97-99; committed at `c103d5b5` |
| Local-keyed `.bak` files (`.planning/v8.4-*-merge-decisions.local-keyed.md.bak`)                  | Preserved untracked per 79-POST-DEPLOY L112                         | VERIFIED    | Both `.bak` files present in working tree as untracked files (`git status` confirms)                                                                   |
| `tests/unit/scripts/v8.4-*.test.ts` (4 unit suites)                                               | All green (host-detect, strict-gate, family-build, post-deploy)     | VERIFIED    | `npx vitest run tests/unit/scripts/` → 51 passed / 0 todo / 0 failed across 7 files (4 Plan 01-04 stubs + 3 carryforward)                              |
| `tests/integration/scripts/v8.4-apply-{atomic,idempotent}.test.ts`                                | DATABASE_URL-gated greens per 79-04-SUMMARY                         | VERIFIED (per 79-04-SUMMARY) | 79-04-SUMMARY L139-140 reports DATABASE_URL set → 14 pass; verifier did not re-run integration against local DB to avoid mutating local state          |

---

### Key Link Verification

| From                            | To                              | Via                                                                                       | Status | Details                                                                                                                                                |
| ------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `main()` apply branch           | `applyBrandPath`                | Called inside `sql.begin` at script L1975                                                 | WIRED  | Single atomic transaction per D-79-03                                                                                                                  |
| `main()` apply branch           | `applyFamilyPath(tx, familyMap, brandMap)` | Called at L1984 with `brandMap` parameter (re-resolve fix per 79-04 Rule 1 deviation #2)  | WIRED  | brandMap passed so applyFamilyPath Step 4.3 re-resolves stale synthetic UUIDs                                                                           |
| `main()` apply branch           | `applyHydration`                | Called at L1991 with tx                                                                   | WIRED  | DISP-03 unconditional UPDATE FROM JOIN per D-79-08                                                                                                     |
| `main()` apply branch           | `postFlightAssertion`           | Called at L1996; throws inside same tx → ROLLBACK                                          | WIRED  | MIG-04 with positive predicate per [[post-flight-assertion-predicate-divergence]]                                                                      |
| `main()` apply branch (Stage 5) | `writePostDeployArtifact`       | Called at L2013, AFTER sql.begin commits                                                  | WIRED  | D-79-10 post-success only (never invoked on rollback)                                                                                                  |
| Decision files                  | Strict gate                     | `strictPreflightGate` at L728 reads brandRows + familyRows, calls existing*IdsFn DB check | WIRED  | D-79-01 — refused first prod apply on Hamilton merge:UUID divergence (proven by 79-05-SUMMARY L29)                                                     |
| `applyFamilyPath` Step 4.4      | `watch_families.aliases`        | `NOT (aliases @> ARRAY[${sourceNorm}]::text[])` predicate at L1161                        | WIRED (code) / UNEXERCISED (data) | Idempotency guard implemented; no merge: family rows existed on prod this run → 0 alias appends; integration-test-fixture-only coverage |
| `idempotentReRunGate`           | `applyBrandPath` / re-run exit  | Stage 1 at script L1875-1879                                                              | WIRED  | D-79-04 fires before strict gate per Plan 02 decision                                                                                                   |

---

### D-79-NN Decision Coverage

| Decision | Locked Contract                                                          | Implementation Location                                                              | Status     |
| -------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ---------- |
| D-79-01  | Strictest pre-flight gate (no escape hatches)                            | `strictPreflightGate` L728; called at Stage 2 main() L1882                            | VERIFIED — caught real bug on first prod apply (79-05-SUMMARY L29) |
| D-79-02  | Silent local / interactive prod confirmation                             | `isLocalDatabaseUrl` L150 + `confirmIfProd` L190; called at Stage 3                  | VERIFIED — host-detect.test 8 pass / 0 todo                         |
| D-79-03  | Single atomic transaction wrapping all writes + post-flight              | One `sql.begin` callback at L1971-2008 wrapping 6 mutation steps + 1 assertion       | VERIFIED — Plan 02's transient brand-only block DELETED per 79-04-SUMMARY |
| D-79-04  | Re-run safety via "already applied" detection                            | `idempotentReRunGate` L914; fires Stage 1 BEFORE strict gate                          | VERIFIED — apply-idempotent integration test green per 79-04-SUMMARY |
| D-79-05  | Single script with `--mode=brands|families|both` switch                  | `parseArgs` L120 + mode dispatch in main()                                            | VERIFIED — Phase 78 dry-run path preserved unchanged                |
| D-79-06  | Merge decisions auto-append source string to canonical aliases (idempotent) | `applyFamilyPath` Step 4.4 L1150-1163 with NOT (aliases @>) containment guard         | VERIFIED (code) — 0 prod aliases this run due to operator policy   |
| D-79-07  | Family dry-run reads brand decisions in-memory (Option 2 path)           | `familyDryRun` L1579; brand→family chain via BrandDecisionMap                         | VERIFIED — Plan 03 Hamilton/Hamilton Watch canonical collapse confirmed |
| D-79-08  | Hydration write-through every catalog-linked watch, no exceptions        | `applyHydration` L1255-1268; unconditional UPDATE FROM JOIN; only brand+model touched | VERIFIED — JOIN naturally skips catalog_id IS NULL orphans          |
| D-79-09  | New brand+family INSERTs default `needs_review = false`                  | INSERT statements at L981 (brands) + L1121 (watch_families) include `needs_review` field | VERIFIED — operator marking 'new' IS the approval signal             |
| D-79-10  | Full POST-DEPLOY.md auto-generated by script after successful apply      | `renderPostDeployMarkdown` L1351 + `writePostDeployArtifact` L1479-1483 (Stage 5)    | VERIFIED — generated artifact + sign-off present at `c103d5b5`     |

**10/10 D-79-* decisions visibly implemented in script + tested.**

---

### Requirements Coverage

| Requirement | Source Plan                                | Description                                                                       | Status                       | Evidence                                                                                                                                                            |
| ----------- | ------------------------------------------ | --------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MIG-02      | 79-02-PLAN.md, 79-04-PLAN.md, 79-05-PLAN.md | Brand backfill `--apply` populates `brand_id`, idempotent on re-run               | SATISFIED                    | applyBrandPath L970; 105 catalog rows resolved this run; cumulative 205/205 (POST-DEPLOY L17). REQUIREMENTS.md L40 marked `[x]`.                                    |
| MIG-03      | 79-03-PLAN.md, 79-04-PLAN.md, 79-05-PLAN.md | Family backfill `--apply` populates `family_id`; typo cases routed into aliases   | SATISFIED (scope caveat)     | applyFamilyPath L1076 + alias-append SQL L1161; 161 family resolutions; 0 alias appends because no operator merge: family rows existed (operator flip-to-new policy on prod). Code path & idempotency proven via unit fixtures. REQUIREMENTS.md L41 marked `[x]`. |
| MIG-04      | 79-01-PLAN.md, 79-04-PLAN.md                | Post-flight predicate divergence verifies zero unresolved                         | SATISFIED                    | postFlightAssertion L1298 with IS DISTINCT FROM NULL; 205/205 confirmed in POST-DEPLOY L31-33; REQUIREMENTS.md L42 marked `[x]`.                                    |
| MIG-05      | 79-05-PLAN.md                              | Prod-portable migration; clean first push                                         | SATISFIED WITH WORKFLOW CAVEAT | Script-driven (D-79-05) so no SQL migration filename concern. Strict gate caught a real local-vs-prod UUID divergence on first prod apply attempt; operator re-prepped via SQL rename + decision-file regen; second attempt clean. **REQUIREMENTS.md L43 still shows `- [ ]` unchecked** — this is a docs-state lag, NOT a verification failure (coverage table L122 marks "Pending" but ROADMAP L298 + 79-POST-DEPLOY L134 both treat MIG-05 as closed). See follow-up #2 below. |
| DISP-03     | 79-04-PLAN.md, 79-05-PLAN.md                | Display hydration overwrites brand+model from canonical                           | SATISFIED (DB) — UI confirm pending | applyHydration L1255 unconditional UPDATE FROM JOIN; 38 watches hydrated on prod; 0 'Hamilton Watch' free-text watches remain (79-05-SUMMARY L47). UI surface render proof is human-verification item #2. REQUIREMENTS.md L69 marked `[x]`. |

**Orphan check:** ROADMAP L292 lists exactly `MIG-02, MIG-03, MIG-04, MIG-05, DISP-03`. All 5 requirements appear in at least one plan's frontmatter. **No orphaned requirements.**

---

### Data-Flow Trace (Level 4)

Not applicable — Phase 79 is a one-shot data-migration phase, not a runtime feature. The "dynamic data" check applies to runtime components; this phase's deliverable IS the data write itself. The in-script atomic transaction structure (sql.begin → 6 mutation steps → assertion → conditional commit/rollback) is verified above.

### Behavioral Spot-Checks

| Behavior                                                                | Command                                                                                          | Result                                                  | Status |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------- | ------ |
| Script unit tests pass                                                  | `npx vitest run tests/unit/scripts/`                                                             | 7 files / 51 tests / 0 todo / 0 failed                  | PASS   |
| Next.js build still passes                                              | `npm run build`                                                                                  | Compiled output present (sampled tail)                  | PASS   |
| Brand decisions file row counts                                         | `awk` on `.planning/v8.4-brand-merge-decisions.md`                                               | 17 auto + 1 merge + 37 new + 0 needs-review = 55        | PASS   |
| Family decisions file row counts                                        | `awk` on `.planning/v8.4-family-merge-decisions.md`                                              | 21 auto + 139 new + 0 needs-review = 160                | PASS   |
| Hamilton merge target = prod canonical UUID                             | `grep "merge:" .planning/v8.4-brand-merge-decisions.md`                                          | `merge:294591c7-daa3-4c84-8b16-49a031842cc5` (prod UUID) | PASS   |
| sql.begin call site count                                               | `grep -c "sql\.begin(" scripts/v8.4-brand-canonicalization.ts`                                   | 1 actual call (L1971) — unified atomic transaction      | PASS   |
| IS DISTINCT FROM NULL predicate present                                 | `grep "IS DISTINCT FROM NULL"`                                                                   | 6 occurrences (assertion + POST-DEPLOY template)        | PASS   |
| Forbidden `= ANY(${arr})` array-spread pattern                          | `grep "= ANY("` per forward-armor                                                                | 0 occurrences                                           | PASS   |
| Prod sign-off: live reconnection to confirm 205/205                     | Cannot run — verifier has no prod DB connection                                                  | (deferred)                                              | SKIP — routed to human verification item #1 |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| (none declared) | — | — | SKIP — Phase 79 declares no probe-style scripts; verification harness is the vitest integration suite already exercised in Plan 04 + the operator sign-off SQL block in 79-POST-DEPLOY.md |

---

### Anti-Patterns Found

| File                                            | Line  | Pattern                                                  | Severity   | Impact                                                                                                                                                  |
| ----------------------------------------------- | ----- | -------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/v8.4-brand-canonicalization.ts`        | 1404  | Hardcoded local Supabase Hamilton UUID `20969364-...` inside `renderPostDeployMarkdown` template (Sign-off Query #2) | WARNING    | Generated 79-POST-DEPLOY.md emits a verification SQL block keyed to LOCAL Hamilton UUID; operator must hand-patch when generating against prod. Documented as memory follow-up #2 in 79-05-SUMMARY L73 + 79-POST-DEPLOY L58. Hand-patch already applied in committed artifact. Followup: parameterize via PostDeployArgs.hamiltonBrandId or query at write time. |
| `scripts/v8.4-brand-canonicalization.ts`        | —     | TBD/FIXME/XXX                                            | (none)     | Zero unreferenced debt markers in script.                                                                                                               |
| `scripts/v8.4-brand-canonicalization.ts`        | —     | TODO/HACK/PLACEHOLDER                                    | (none)     | Zero.                                                                                                                                                   |
| `.planning/REQUIREMENTS.md`                     | 43    | `MIG-05` still `- [ ]` unchecked despite L122 + ROADMAP saying "Pending → closes in P79" | INFO       | Docs-state lag, not a code defect. Phase 79 contract treats MIG-05 as closed (see follow-up #2 below for explicit update recommendation).               |

---

### Human Verification Required

#### 1. Independent prod sign-off SQL re-run (or operator re-affirmation)

**Test:** Re-execute the 6 SQL queries in `.planning/phases/79-backfill-migration-display-hydration/79-POST-DEPLOY.md` § "Operator Sign-Off Queries" against prod Supabase (paste each into the SQL editor).

**Expected:**
- Q1: `brand_null=0, family_null=0`
- Q2: `rows_pointing_at_canonical_hamilton >= count(catalog rows where lower(trim(brand)) IN ('hamilton','hamilton watch'))` (using prod Hamilton UUID `294591c7-daa3-4c84-8b16-49a031842cc5`, NOT the hardcoded `20969364-...`)
- Q3: `new_brand_count = 37` (within the apply hour; may be stale if more than ~1h has passed since prod apply)
- Q4: `cardinality(aliases) > 0` → 0 rows (operator flipped all merges to new this run)
- Q5: every Hamilton-prefixed row reads `brand = 'Hamilton'`, none read `'Hamilton Watch'`
- Q6: `watches_catalog_natural_key` constraint present (1 row)

**Why human:** Verifier has no prod DB connection. 79-POST-DEPLOY.md L97 marks sign-off as already verified by the operator via in-session prod queries — Tyler's explicit ACK that he ran them (or a fresh run) is the contract-level proof.

#### 2. Visual UI confirmation that DISP-03 surfaces don't render 'Hamilton Watch'

**Test:** Sign in as the prod user(s) whose pre-apply watches text contained `Hamilton Watch`. Open collection grid, watch detail page, and profile rail.

**Expected:** Every Hamilton-* watch renders `Hamilton` (not `Hamilton Watch`) on every surface — including any read-cached views.

**Why human:** DISP-03's success criterion (ROADMAP L297) is a UI guarantee. DB-level proof exists (0 rows `watches.brand = 'Hamilton Watch'` on prod), but verifier cannot open a browser session. If a Server Component caches a stale render that survives the data UPDATE, the UI surface might still show `Hamilton Watch` even though the DB is correct — Phase 81 RECO-* + DISP-01/02 explicitly defer auto-overwrite-on-write to a later phase, so any cache-revalidation gap surfaces here.

#### 3. Explicit acceptance of SC5 workflow deviation

**Test:** Confirm SC5 is met for the purposes of marking Phase 79 complete, given:
- The SCRIPT shipped clean from Plan 04 verification through to prod apply (no script bug surfaced).
- The OPERATOR WORKFLOW required a one-off SQL `UPDATE brands SET name = 'Hamilton' WHERE id = '294591c7-...'` on prod + a full `--force` regen of both decision files against prod state before the second apply attempt landed clean.
- Strict gate D-79-01 caught this divergence safely (no partial writes; no rollback corruption); operator detour was ~30 minutes documented in 79-05-SUMMARY L26-35.
- Phase 79 ships NO new SQL migration (per D-79-05), so SC5's literal `supabase db push --linked` wording is interpretive.

**Expected:** Tyler confirms this is acceptable scope for SC5 closure. (Memory follow-up to extend `[[catalog-id-divergence]]` is already noted in 79-05-SUMMARY L72.)

**Why human:** This is a judgment call between "script ships clean" (engineer's view) and "first prod attempt fails" (operations view). The strict gate firing IS the safety net working as designed — but Tyler is the only person who can sign off on whether the prep detour fits "clean first try" loosely enough.

---

### Phase 80 Readiness Check

Phase 80 (CANON-01/CANON-02 NOT NULL flip + INGEST-01..04) requires:

| Precondition                                                    | Status     | Evidence                                                                                          |
| --------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------- |
| Zero `watches_catalog.brand_id IS NULL` rows on prod            | VERIFIED   | Post-flight assertion held: resolved_brand=205 of total=205 (79-POST-DEPLOY L31-33); independent verification query at 79-05-SUMMARY L43-45 |
| Zero `watches_catalog.family_id IS NULL` rows on prod           | VERIFIED   | Same — resolved_family=205 of total=205                                                            |
| `brands.name_normalized` populated for fuzzy-lookup pre-req     | VERIFIED   | Generated column (Phase 78 schema); all 53 prod brands present per 79-05-SUMMARY L46              |
| `watch_families.aliases` GIN index present (CANON-03 carryforward) | VERIFIED   | Phase 78 migration `20260624000000_phase78_aliases_needs_review.sql` shipped per 79-CONTEXT L98     |

**Phase 80 is unblocked** — the NOT NULL constraint flip can proceed without violating any existing row, and INGEST-01..04's resolution path has fully-populated FK targets to look up against.

---

### Gaps Summary

**No BLOCKER gaps.** The phase goal (every catalog row resolved + every catalog-linked watch hydrated + post-flight zero NULL proof) is met on prod per 79-POST-DEPLOY.md + 79-05-SUMMARY's independently-verified counts. All 10 D-79-* decisions are visibly implemented in `scripts/v8.4-brand-canonicalization.ts`. All 5 ROADMAP success criteria are substantively met (SC2 with a documented scope caveat — aliases CODE path is proven but live alias-append was unexercised on prod because of operator policy; SC5 with a documented workflow caveat — script ships clean, operator pre-flight needed local→prod UUID rekey).

**Two WARNINGs surface for follow-up but do not block phase completion:**

1. **`renderPostDeployMarkdown` hardcodes the local Hamilton UUID** at script L1404 (`20969364-f3b1-4b1d-ab2f-e5d22e9ffabc`). The auto-generated 79-POST-DEPLOY.md for prod was hand-patched to read the prod canonical Hamilton UUID `294591c7-daa3-4c84-8b16-49a031842cc5`. Future prod re-runs would re-generate with the stale local UUID. Already captured as a memory follow-up in 79-05-SUMMARY L73. Recommend parameterizing via `PostDeployArgs.hamiltonBrandId?: string` (or a generic `merge_decision_targets: Array<{brandId, label}>` shape) — defer to a quick fix or a Phase 80 prep task.

2. **REQUIREMENTS.md MIG-05 still marked `- [ ]` unchecked at L43** despite ROADMAP L298 closing it in Phase 79 and the requirements-coverage table at L122 also reading "Pending". The phase summary (79-POST-DEPLOY L134) records MIG-05 as deliverable. Recommend flipping L43 to `[x]` and L122 to `Complete` as part of phase close — this is a docs hygiene item, not a code defect.

**One human-judgment item:** SC5 ("pushes cleanly to prod via supabase db push --linked on the first attempt") deserves explicit operator acceptance given the workflow nuance described above (script clean / operator pre-flight needed regen). The strict gate firing IS the contract working as designed; the question is whether the regen detour fits inside the SC5 envelope. Verifier's recommendation: PASSED with the deviation accepted, since (a) the script itself shipped clean, (b) the safety net (D-79-01 strict gate) caught the issue safely with zero partial writes, (c) the lesson is captured as the documented `[[catalog-id-divergence]]` extension.

**Recommended follow-ups (rolled up):**

- **F1 (LOW, ~30 min quick fix):** Parameterize `renderPostDeployMarkdown` Section 2 Hamilton UUID so prod-target re-runs don't emit the local literal. Add to follow-up backlog.
- **F2 (TRIVIAL, ~2 min):** Update `.planning/REQUIREMENTS.md` L43 (`MIG-05`) from `[ ]` → `[x]` and L122 from `Pending` → `Complete`. Can be folded into the phase-close commit.
- **F3 (DOCS):** Extend `[[catalog-id-divergence]]` memory to call out that brand + family decision-file UUIDs also diverge local/prod (already in 79-05-SUMMARY L72 memory follow-ups).

---

_Verified: 2026-06-25_
_Verifier: Claude (gsd-verifier)_
