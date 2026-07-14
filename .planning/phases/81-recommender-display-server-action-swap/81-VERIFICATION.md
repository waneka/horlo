---
phase: 81-recommender-display-server-action-swap
verified: 2026-07-13T23:20:00Z
status: passed
score: 5/5 must-haves verified (technical); prod deploy walk green 2026-07-13
overrides_applied: 0
re_verification: 2026-07-13T23:59:00Z
human_verification:
  - test: "Bundled Vercel deploy per 81-POST-DEPLOY.md — `git push origin main` then run the 4-step prod smoke walkthrough on Tyler's real account against horlo.app (mirrors D-81-04 with Tyler's collection; no drift fixture on prod because prod is canonical post-Phase-79)"
    expected: "All 4 assertions green on prod: (i) Tyler's own watches NOT in home rail (RECO-01 self-exclusion sanity); (ii) rec rationale strings render canonical brand names (RECO-04); (iii) addWatch with typed drift brand persists canonical (DISP-01); (iv) editWatch retyping drift persists canonical (DISP-02); throwaway watch DELETEd after walk"
    why_human: "Requires operator credential access to horlo.app + Vercel dashboard; live prod DB writes; explicit human sign-off in 81-POST-DEPLOY.md § Sign-off — the operator checkpoint (Plan 04 Task 3) explicitly gates this step and is designed to be human-owned. Not skippable programmatically."
  - test: "Local seed p95 spot-check for home rail render (Success Criterion #5 — perf)"
    expected: "No perceptible p95 regression relative to pre-Phase-81 baseline. Two INNER JOINs on pk-indexed columns; brandNameLookup SELECT is ~5-30 rows per viewer"
    why_human: "No baseline artifact exists per RESEARCH.md Open Question #10 — this is an accepted informal spot-check per Plan 04 SUMMARY; operator subjective observation post-deploy"
---

# Phase 81: Recommender + Display Server Action Swap Verification Report

**Phase Goal:** The home rail's exclusion key + multi-brand-match scoring + rationale templates read brand/family from canonical FKs (eliminating `Héron` vs `Héron Watches`-class drift in user-visible recs), and the `addWatch` / `editWatch` Server Actions auto-overwrite the stored display strings from the canonical FK targets on every write.

**Verified:** 2026-07-13T23:20:00Z
**Status:** human_needed (all technical must-haves verified in codebase + local walkthrough green; prod deploy is an operator-owned checkpoint gate)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Home "From Collectors Like You" rail no longer surfaces user's own watch under `Brut Date` vs `Brut Datejust` / `Héron` vs `Héron Watches` drift (RECO-01) | VERIFIED | `src/data/recommendations.ts` L40-49 defines module-scope `excludeKey(w)` helper keying `${w.brandId}\|${w.familyId}` with `${brand}\|${model}` fallback; called at three identity-critical sites: exclusion loop (L271), candidateMap key, and synthetic top-up (L599). Operator D-81-04 walkthrough step (i) 2026-07-13 confirmed drift row excluded on home rail (81-04-SUMMARY line 71). |
| 2 | Multi-brand `+100` scoring fires for `Hamilton` and `Hamilton Watch` both against canonical Hamilton brand row (RECO-02, RECO-03) | VERIFIED | `src/data/recommendations.ts` L521-546 owned-brand IN clause switched from `lower(trim(watchesCatalog.brand))` string-comparison to `${watchesCatalog.brandId} IN (…uuid…)` via `sql.join(brandArr.map(id => sql\`${id}\`), sql\`, \`)` — the exact anti-pitfall shape per `[[drizzle-sql-any-array-pitfall]]`. Scoring at L564 uses `viewerOwnedBrandIds.has(row.brandId)`. `topBrandOf` in `src/lib/recommendations.ts` L134-167 counts by `w.brandId` with brandNameLookup wiring; excludes legacy `brandId=undefined` from counting. |
| 3 | Recommendation rationale strings render canonical `brands.name` (RECO-04) | VERIFIED | `src/lib/recommendations.ts` L74-79 rationaleFor reads `ctx.viewerTopBrand?.brandName` (pre-computed by DAL from brands.name via brandNameLookup); no per-candidate topBrandOf call. `src/data/recommendations.ts` L175 computes viewerTopBrand once and threads it through rationaleFor ctx (L326, L341). Operator D-81-04 walkthrough step (ii) 2026-07-13 confirmed `Fans of Hamilton love this` rendered canonical (81-04-SUMMARY line 72). |
| 4 | addWatch + editWatch persist canonical `brands.name` / `watch_families.name` regardless of user's typed strings (DISP-01, DISP-02) | VERIFIED | `src/app/actions/watches.ts`: (a) catalogId branch L161-162 `cleanData.brand = catalogRow.canonicalBrand; cleanData.model = catalogRow.canonicalFamily`; (b) user-input branch L197-198 `cleanData.brand = upsertResult.brandName; cleanData.model = upsertResult.familyName` (fail-loud on null L187 preserved); (c) editWatch L660-676 canonical overwrite block gated on `priorRow.catalogId && (cleanData.brand \|\| cleanData.model)`, updates BOTH cleanData AND updatePayload for transaction-path parity. Operator D-81-04 walkthrough steps (iii)+(iv) 2026-07-13 confirmed DB persisted canonical `Hamilton` for typed drift `Hamilton Watch` (81-04-SUMMARY lines 73-74). |
| 5 | Existing recommendation + collection-rail tests still pass; no measurable p95 regression on home rail | PARTIAL/VERIFIED | 32/32 targeted tests pass (13 DAL recs + 11 lib recs + 8 recs-invalidation, run 2026-07-13 verifier). Perf side is informal — no baseline artifact exists per RESEARCH.md Open Q #10, acknowledged in 81-04-SUMMARY line 120 as an accepted looseness. INNER JOINs are on pk-indexed columns; brandNameLookup is a single ~5-30 row SELECT per viewer. |

**Score:** 5/5 truths verified (technical implementation + local walkthrough). Truth 5's perf side is informal per accepted-looseness (RESEARCH Open Q #10).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/types.ts` | Watch.brandId?/familyId? optional fields | VERIFIED | L102-103: `brandId?: string` + `familyId?: string` present next to catalogId. |
| `src/data/watches.ts` | getWatchesByUser + getWatchById LEFT JOIN projection with `?? undefined` mapping | VERIFIED | L152-153 project `catalogBrandId: watchesCatalog.brandId, catalogFamilyId: watchesCatalog.familyId`; L178-179 map to `brandId: catalogBrandId ?? undefined, familyId: catalogFamilyId ?? undefined`. Mirrored in getWatchById at L208-209 + L227-228. |
| `src/data/catalog.ts` | CatalogEntryWithCanonical + widened upsert helpers | VERIFIED | L337-339: interface `CatalogEntryWithCanonical extends CatalogEntry { canonicalBrand: string; canonicalFamily: string }`. L145 + L224: upsert helpers return `{ catalogId, brandName, familyName } \| null`. L352 getCatalogById returns `CatalogEntryWithCanonical \| null` with LEFT JOIN on brands + watchFamilies. |
| `src/lib/recommendations.ts` | topBrandOf widened + RationaleContext.viewerTopBrand + rationaleFor consumption | VERIFIED | L27 `viewerTopBrand: { brandId, brandName } \| null` on RationaleContext; L134-167 topBrandOf accepts brandNameLookup + returns `{ brandId, brandName } \| null` with Pitfall 6 defensive null-return (L165); L74-79 rationaleFor reads `ctx.viewerTopBrand`. |
| `src/data/recommendations.ts` | brandNameLookup + viewerOwnedBrandIds + excludeKey + INNER JOINs + brand_id IN clause + synthetic Watch FK propagation | VERIFIED | L40-49 excludeKey helper; L172-174 brandNameLookup Map built INSIDE getRecommendationsForViewer (T-81-P02-01 cross-viewer poisoning mitigation confirmed); L182-186 viewerOwnedBrandIds Set; L502-503 + L536-537 four INNER JOINs (brands + watch_families in both popularity + owned-brand SELECTs); L541 brand_id IN via sql.join; synthetic Watch construction inside topUpFromCatalogPopularity carries brandId/familyId. |
| `src/app/actions/watches.ts` | addWatch canonical overwrite (both branches) + editWatch canonical overwrite path | VERIFIED | 6 canonicalBrand/canonicalFamily references at L161-162 (addWatch catalogId branch) + L667-672 (editWatch DISP-02 block); 2 upsertResult.brandName/familyName references at L197-198 (addWatch user-input branch); guard at L660-663; catalogRow-null defensive skip preserves fail-safe semantics. |
| `src/data/hierarchy.ts` | Plan 05 scope-patch: getSameFamilyForCatalog + getLineageForReference canonical INNER JOIN | VERIFIED | L86-93 getSameFamilyForCatalog projects `brand: brands.name, model: watchFamilies.name` with 2 INNER JOINs on brands + watchFamilies + GROUP BY canonical columns + ORDER BY canonical. L150-151 + L180-181 getLineageForReference recursive CTE has JOIN brands b + JOIN watch_families f in BOTH seed arm AND recursive arm; L134 + L162 project `b.name AS brand, f.name AS model` in both arms (Pitfall 5 extension). |
| `.planning/phases/81-.../fixtures/drift-hamilton.sql` | Reversible drift fixture with APPLY + REVERT stanzas | VERIFIED | 224 lines; `BEGIN APPLY` / `END APPLY` + `BEGIN REVERT` / `END REVERT` sections; INSERT resolves brand_id + family_id via SELECT subselects (portable across environments); REVERT emits remaining-row-count validation. |
| `.planning/phases/81-.../81-POST-DEPLOY.md` | Operator bundled deploy runbook | VERIFIED | 367 lines; contains `git push` (L137), Rollback Plan (§L274), Sign-off (§L341), Prod Smoke Walk section. Structured per Phase 79/80 POST-DEPLOY pattern. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `src/data/watches.ts` mapRowToWatch/getWatchesByUser | Watch.brandId | LEFT JOIN watches_catalog + `?? undefined` at mapper | VERIFIED | L152 project + L178 map with `?? undefined` fallback. |
| `src/data/catalog.ts` upsertCatalogFrom*/getCatalogById | brands.name + watch_families.name | LEFT JOIN or CTE subselect resolving FK → canonical name | VERIFIED | L163-171 getCatalogById LEFT JOINs brands + watchFamilies; upsert CTEs (L195-199 + L318-320) SELECT `(SELECT name FROM brands WHERE id = r.brand_id) AS brand_name, (SELECT name FROM watch_families WHERE id = r.family_id) AS family_name`. |
| `src/data/recommendations.ts` getRecommendationsForViewer | brands.name | `SELECT id, name FROM brands WHERE id IN (…)` inside function scope with empty-array guard | VERIFIED | L160-171 brandNameLookup SELECT with `viewerBrandIds.length === 0 ? [] : …` empty guard (Pitfall 2); L167-170 `IN (${sql.join(…, sql\`, \`)})` — anti-pitfall correct shape; L172 Map constructed INSIDE function body (T-81-P02-01 mitigation). |
| `src/data/recommendations.ts` exclusion set | synthetic Watch in topUpFromCatalogPopularity | Shared module-scope `excludeKey(w)` helper called at 3 sites | VERIFIED | Helper at L40; called via `norm = excludeKey` alias at L271 (exclusion loop + candidateMap key) + `excludeKey(row)` at L599 (synthetic top-up); Pitfall 5 identity by construction. |
| `src/data/recommendations.ts` topUpFromCatalogPopularity owned-brand SELECT | watches_catalog.brand_id | `IN (sql.join(brandArr.map(id => sql\`${id}\`), sql\`, \`))` | VERIFIED | L541-544 exact anti-pitfall shape; guard at L521 `if (viewerOwnedBrandIds.size > 0)`. |
| `src/lib/recommendations.ts` rationaleFor | ctx.viewerTopBrand?.brandName | Brand-match template reads pre-computed viewerTopBrand from ctx | VERIFIED | L74-79 rationaleFor consumes ctx.viewerTopBrand; caller-provides pattern (no per-candidate DB derivation). |
| `src/app/actions/watches.ts` addWatch catalogId branch | catalogRow.canonicalBrand / canonicalFamily | Extended getCatalogById return shape from Plan 01 | VERIFIED | L143 fetch + L161-162 canonical assignment; reference at L163 stays `catalogRow.reference ?? undefined` (D-10 override unchanged). |
| `src/app/actions/watches.ts` addWatch user-input branch | upsertResult.brandName / familyName | Extended upsertCatalogFromUserInput return shape | VERIFIED | L178-186 upsertResult fail-loud null-check; L197-198 canonical assignment. |
| `src/app/actions/watches.ts` editWatch | catalogDAL.getCatalogById(priorRow.catalogId) | Guarded conditional overwrite when catalog-linked + brand/model edited | VERIFIED | L660-676 guard + fetch + dual-payload update (cleanData + updatePayload); non-catalog-linked bypass (Case 8 test guard); catalogRow-null defensive skip. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `getRecommendationsForViewer` return | brandNameLookup Map | `db.select({id, name}).from(brands).where(sql\`… IN …\`)` (inside function scope) | Yes — real brands table query with parameterized IN clause | FLOWING |
| `topUpFromCatalogPopularity` synthetic Watch | row.brand, row.model, row.brandId, row.familyId | `.select({brand: brands.name, model: watchFamilies.name, brandId: watchesCatalog.brandId, familyId: watchesCatalog.familyId})` with two INNER JOINs | Yes — canonical strings from JOIN, FK identity from schema | FLOWING |
| `addWatch` write | cleanData.brand / cleanData.model | Either catalogRow.canonicalBrand (from getCatalogById LEFT JOIN) OR upsertResult.brandName (from upsert CTE subselect) | Yes — both paths resolve through brand_id → brands.name | FLOWING |
| `editWatch` write | updatePayload.brand / .model | catalogRow.canonicalBrand from getCatalogById | Yes — gated on priorRow.catalogId present | FLOWING |
| `getSameFamilyForCatalog` (Plan 05) | SameFamilyWatch.brand / .model | `brand: brands.name, model: watchFamilies.name` via INNER JOIN | Yes — verified via live psql smoke on drift fixture returning canonical `Hamilton / Khaki Field Mechanical` (81-05-SUMMARY line 89) | FLOWING |
| `getLineageForReference` (Plan 05) | LineageRow.brand / .model | Both seed + recursive CTE arms project `b.name AS brand, f.name AS model` via JOIN brands b + JOIN watch_families f | Yes — canonical strings in both arms; CYCLE + depth guard preserved | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full build compiles clean | `npm run build` | Exit 0; PPR route map printed; all routes prerender-classified | PASS |
| Phase 81 targeted test suites pass | `npm run test -- src/data/__tests__/recommendations.test.ts tests/lib/recommendations.test.ts src/app/actions/__tests__/watches-recs-invalidation.test.ts` | 32/32 pass (13 DAL + 11 lib + 8 recs-invalidation) in 1.20s | PASS |
| Drizzle SQL ANY-array anti-pattern absent | `grep -c "= ANY(" src/data/recommendations.ts src/lib/recommendations.ts src/data/hierarchy.ts src/data/catalog.ts src/data/watches.ts src/app/actions/watches.ts src/app/actions/wishlist.ts` | 0 across all 7 files | PASS |
| INNER JOINs present on recommender + hierarchy | `grep -c "innerJoin" src/data/recommendations.ts src/data/hierarchy.ts` | 4 + 2 = 6 total (Plan 02 popularity + owned-brand SELECTs × 2 JOINs each = 4; Plan 05 getSameFamilyForCatalog = 2) | PASS |
| brandNameLookup constructed inside function scope (T-81-P02-01) | `grep -n "new Map<string, string>(" src/data/recommendations.ts` returns match INSIDE getRecommendationsForViewer body | L172 inside function starting at L125 | PASS |
| Cache-invalidation contract preserved (updateTag calls) | `grep -c "updateTag" src/app/actions/watches.ts` | 4 calls at L18 (import) + L362 addWatch + L554 moveWishlistToCollection + L743 editWatch; count matches pre-Plan-03 baseline | PASS |
| revalidateTag calls preserved (cross-user invalidation) | `grep -c "revalidateTag" src/app/actions/watches.ts` | 27 matches (includes explore + profile:username tags across all mutation actions) | PASS |

### Probe Execution

No conventional `scripts/*/tests/probe-*.sh` probes declared for this phase. Verification path uses `npm run build` + targeted vitest + operator D-81-04 walkthrough. Marked N/A.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| RECO-01 | 81-02-PLAN, 81-05-PLAN | Exclusion key switches to canonical `brand_id \| family_id` | SATISFIED | excludeKey helper + 3-site identity + Plan 05 same-family/lineage rails scope patch. REQUIREMENTS.md L58 marked complete. Operator walk step (i) confirmed. |
| RECO-02 | 81-02-PLAN | Multi-brand IN clause switches to `brand_id IN (…)` | SATISFIED | L541 `${watchesCatalog.brandId} IN (${sql.join(…)})` — canonical FK identity. REQUIREMENTS.md L59 marked complete. |
| RECO-03 | 81-02-PLAN | topBrandOf operates on resolved brand_id | SATISFIED | Widened signature + brandNameLookup wiring; legacy `brandId=undefined` excluded from counting. REQUIREMENTS.md L60 marked complete. |
| RECO-04 | 81-02-PLAN, 81-05-PLAN | Rationale templates read canonical `brands.name` | SATISFIED | rationaleFor reads ctx.viewerTopBrand (pre-computed from brands.name); INNER JOINs on synthetic top-up + same-family + lineage produce canonical strings. REQUIREMENTS.md L61 marked complete. Operator walk step (ii) confirmed. |
| DISP-01 | 81-01-PLAN, 81-03-PLAN | addWatch persists canonical brand/model on both branches | SATISFIED | catalogId branch L161-162 + user-input branch L197-198; both fail-loud on null preserved. REQUIREMENTS.md L67 marked complete. Operator walk step (iii) confirmed. |
| DISP-02 | 81-01-PLAN, 81-03-PLAN | editWatch canonical overwrite on UPDATE | SATISFIED | L660-676 guarded overwrite block updates cleanData + updatePayload for transaction-path parity; catalogRow-null defensive skip. REQUIREMENTS.md L68 marked complete. Operator walk step (iv) confirmed. |

**No orphaned requirements** — all 6 IDs claimed in PLAN frontmatter are backed by concrete implementation evidence AND marked `[x]` in REQUIREMENTS.md L58-68 + L127-132.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No debt markers (TODO/FIXME/XXX) found in any file modified by this phase | — | — |
| — | — | No `= ANY(${arr})` anti-pattern; all IN clauses use `IN (sql.join(arr.map(id => sql\`${id}\`), sql\`, \`))` shape per `[[drizzle-sql-any-array-pitfall]]` | — | — |
| — | — | No hardcoded empty stubs in rendering paths | — | — |
| — | — | No `revalidateTag(tag)` single-arg form; write-path uses `updateTag(tag)` per Next 16 semantics + Phase 75 D-02 | — | — |

Clean.

### Human Verification Required

**1. Prod bundled deploy per 81-POST-DEPLOY.md**

- **Test:** `git push origin main` triggers Vercel auto-deploy; then run the 4-step prod smoke walk on Tyler's account against horlo.app.
- **Expected:** (i) Tyler's own owned watches NOT in home rail (RECO-01 self-exclusion sanity); (ii) rec rationale strings render canonical brand names (RECO-04); (iii) add throwaway watch with typed drift brand → DB persists canonical (DISP-01); (iv) edit throwaway retyping drift → DB persists canonical (DISP-02); throwaway watch DELETEd post-walk.
- **Why human:** Requires operator credential access to horlo.app + Vercel dashboard; live prod DB writes; the human-verify checkpoint (Plan 04 Task 3, `autonomous: false`) explicitly gates this step and is designed to be operator-owned. Not skippable programmatically.

**2. Perf spot-check (Success Criterion #5)**

- **Test:** Load home rail on prod post-deploy; compare subjective render feel vs pre-Phase-81.
- **Expected:** No perceptible p95 regression. Two INNER JOINs are on pk-indexed columns; brandNameLookup adds ~5-30 row SELECT per viewer.
- **Why human:** No baseline artifact exists per RESEARCH.md Open Q #10 — accepted informal spot-check per Plan 04 SUMMARY.

### Gaps Summary

**No blocker gaps.** All 5 must-have technical truths are verified in the codebase with concrete evidence — code matches PLAN specifications, tests pass (32/32), build passes, grep armor holds, brandNameLookup lives inside function scope (T-81-P02-01), excludeKey identity property is guaranteed by construction via a shared module-scope helper called at 3 identity-critical sites.

Operator D-81-04 local-first walkthrough was executed 2026-07-13 on `npm run dev` + local Supabase against the drift-Hamilton fixture; all 4 assertions (RECO-01 exclusion, RECO-04 canonical rationale, DISP-01 add canonical, DISP-02 edit canonical) passed AFTER Plan 05 scope-patch fixed detail-page rail drift discovered mid-walk. Fixture reverted clean (all remaining_* counts = 0).

The `human_needed` status reflects the outstanding operator-owned prod deploy checkpoint (Plan 04 Task 3, explicitly `autonomous: false`), NOT a technical failure. The bundled Vercel push + prod smoke walk are the operator's next action per 81-POST-DEPLOY.md — the runbook exists (367 lines) with rollback plan and sign-off placeholder; only the human execution + attestation remain.

Success Criterion #5's perf side is informal per RESEARCH.md Open Q #10 (no baseline artifact) and accepted as looseness in 81-04-SUMMARY line 120 — this is the second human-verification item, resolvable via post-deploy subjective spot-check.

---

_Verified: 2026-07-13T23:20:00Z_
_Verifier: Claude (gsd-verifier)_
