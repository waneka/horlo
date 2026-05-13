---
phase: 39b
slug: audit-driven-discovery-polish-heavier-ux
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-13
updated_at: 2026-05-13
---

# Phase 39b — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Hydrated from `39b-RESEARCH.md` § Validation Architecture and populated
> with the Per-Task Verification Map during `/gsd-plan-phase`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `vitest` ^2.1.9 + `@testing-library/react` ^16.3.2 + `jsdom` (`environment: 'jsdom'`) |
| **Config file** | `vitest.config.ts` (verified at repo root) |
| **Quick run command** | `npx vitest run tests/static/ReferenceIdentityCard.no-engine.test.ts tests/components/insights/ReferenceIdentityCard.test.tsx tests/components/profile/LockedTabCard.test.tsx tests/components/profile/WornCalendar.test.tsx tests/static/hierarchy.lineage-3-node.test.ts` |
| **Full suite command** | `npm test` (alias for `vitest run`) |
| **DB-integration command** | `set -a; source .env.local; set +a; npx vitest run tests/data/getCollectorsForCatalog.test.ts` (Phase 36 vitest env-loading lesson) |
| **Estimated runtime** | ~1.5s quick / ~10–20s full / +5s DB-integration |

---

## Sampling Rate

- **After every task commit:** Run quick command (subset above)
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-T1 | 39b-01 | 0 | DISC-11 | — | CTE returns imageUrl on every LineageRow | static + grep | `grep -c "wc.image_url" src/data/hierarchy.ts` ≥ 2 | yes | ⬜ pending |
| 01-T2 | 39b-01 | 0 | DISC-11 | — | Static guard updated; 1 intentional RED until Plan 39b-05 | static | `npx vitest run tests/static/hierarchy.lineage-3-node.test.ts` (1 expected fail) | yes | ⬜ pending |
| 01-T3 | 39b-01 | 0 | DISC-11 | — | WearEventLite.note exposed | grep | `grep -E "note:?\s*string\s*\|\s*null" src/components/profile/WornCalendar.tsx` ≥ 1 | yes | ⬜ pending |
| 01-T4 | 39b-01 | 0 | DISC-11 | — | getWatchesByUser numeric-cast verified (A3) | grep | `grep -E "formality:.*Number\(\|sportiness:.*Number\(\|heritageScore:.*Number\(\|confidence:.*Number\(" src/data/watches.ts` ≥ 4 lines | yes | ⬜ pending |
| 01-T5 | 39b-01 | 0 | DISC-11 | T-39b-02 | Idempotent UPDATE WHERE family_id IS NULL + INSERT ON CONFLICT DO NOTHING | grep + tsc | `grep -c "ON CONFLICT (predecessor_catalog_id, successor_catalog_id, relationship_type)" scripts/seed-lineage.ts` ≥ 1 | yes | ⬜ pending |
| 01-T6 | 39b-01 | 0 | DISC-11 | — | npm script wires tsx + .env.local | grep + JSON parse | `grep -c '"db:seed-lineage":' package.json` = 1; JSON parses | yes | ⬜ pending |
| 01-T7 | 39b-01 | 0 | DISC-11 | T-39b-02 | Operator commits ~20 family_id + ~15 lineage edges; idempotency proven by second-run zero-counts | manual | Operator UAT — second prod run prints `family_patched=0 edges_inserted=0` | n/a | ⬜ pending |
| 02-T1 | 39b-02 | 1 | DISC-11 | — | Static guard for ReferenceIdentityCard (vacuous-pass pre-file) | static | `npx vitest run tests/static/ReferenceIdentityCard.no-engine.test.ts` exit 0 | yes | ⬜ pending |
| 02-T2 | 39b-02 | 1 | DISC-11 (NSV-06/20) | bundle-leak | Pure renderer; zero engine imports; no 'use client' | static + grep | Same guard non-vacuously green + grep counts 0 for similarity/composer/server-only/'use client' | yes | ⬜ pending |
| 02-T3 | 39b-02 | 1 | DISC-11 (NSV-06/20) | — | Confidence gate + suppression + headline + scale omission | unit | `npx vitest run tests/components/insights/ReferenceIdentityCard.test.tsx` (6 tests green) | yes | ⬜ pending |
| 02-T4 | 39b-02 | 1 | DISC-11 (NSV-06) | — | /watch/{id} mounts card or fallback caption for collection.length === 0 | grep + build | `grep -c "ReferenceIdentityCard" 'src/app/watch/[id]/page.tsx'` ≥ 2; `npm run build` exit 0 | yes | ⬜ pending |
| 02-T5 | 39b-02 | 1 | DISC-11 (NSV-20) | — | /catalog/{id} mounts card or fallback caption (replaces "no card, no CTAs") | grep + build | `grep "Add a few watches to see how this one fits your collection." 'src/app/catalog/[catalogId]/page.tsx'` = 1; build exit 0 | yes | ⬜ pending |
| 03-T1 | 39b-03 | 1 | DISC-11 (NSV-14 #1) | T-39b-03 | encodeURIComponent on producer; common-ground returns null preserved | grep | `grep "encodeURIComponent(currentPath)" src/components/profile/LockedTabCard.tsx` ≥ 1 | yes | ⬜ pending |
| 03-T2 | 39b-03 | 1 | DISC-11 (NSV-14 #1) | T-39b-03 | All 4 LockedTabCard callsites thread same-origin currentPath | grep | `grep -c "currentPath={currentPath}" 'src/app/u/[username]/[tab]/page.tsx'` ≥ 4 | yes | ⬜ pending |
| 03-T3 | 39b-03 | 1 | DISC-11 (NSV-14 #1) | T-39b-03 | Encoded href asserted explicitly | unit | `npx vitest run tests/components/profile/LockedTabCard.test.tsx` (11 tests green, including encoded-href #2) | yes | ⬜ pending |
| 03-T4 | 39b-03 | 1 | DISC-11 (NSV-14 #2) | XSS-low | selectedDate + day-cell button + wear-detail panel | grep | `grep "No wear events on" src/components/profile/WornCalendar.tsx` = 1 + `grep "aria-label" ...` ≥ 1 | yes | ⬜ pending |
| 03-T5 | 39b-03 | 1 | DISC-11 (NSV-14 #2) | — | First-event-day mount + onClick → panel + empty-day caption | unit | `npx vitest run tests/components/profile/WornCalendar.test.tsx` (3 tests green) | yes | ⬜ pending |
| 03-T6 | 39b-03 | 1 | DISC-11 (NSV-14 #3) | — | WornList <li> wraps in <Link>; HorizontalBarChart unwrapped (D-39b-14 lock) | grep | `grep "href={\`/watch/\${watch.id}\`}" src/components/profile/StatsTabContent.tsx` ≥ 1; HorizontalBarChart ref count unchanged | yes | ⬜ pending |
| 04-T1 | 39b-04 | 2 | DISC-11 (NSV-18) | T-39b-01, T-39b-04 | Integration test asserts 4 privacy edges + dedup | integration | `set -a; source .env.local; set +a; npx vitest run tests/data/getCollectorsForCatalog.test.ts` (6 tests green when env present) | yes | ⬜ pending |
| 04-T2 | 39b-04 | 2 | DISC-11 (NSV-18) | T-39b-01, T-39b-04 | Two-layer privacy + self-exclusion + sold-filter at DAL WHERE | grep | `grep -E "profileSettings\.collectionPublic.*true" src/data/discovery.ts` ≥ 2 lines (both queries) | yes | ⬜ pending |
| 04-T3 | 39b-04 | 2 | DISC-11 (NSV-18) | — | Hide-if-empty + count label only when totalCount > 5 | grep | `grep "if (collectors.length === 0) return null" src/components/insights/OtherOwnersRoster.tsx` = 1 + `grep "totalCount > 5" ...` = 1 | yes | ⬜ pending |
| 04-T4 | 39b-04 | 2 | DISC-11 (NSV-18) | — | Mount on /catalog/{id} only (not /watch/{id}) | grep + build | `grep -c "OtherOwnersRoster" 'src/app/watch/[id]/page.tsx'` = 0; `grep -c "OtherOwnersRoster" 'src/app/catalog/[catalogId]/page.tsx'` ≥ 2 | yes | ⬜ pending |
| 05-T1 | 39b-05 | 3 | DISC-11 (NSV-02/16) | — | getSameFamilyForCatalog exported (closes RED from 01-T2) | grep + static | `grep -E "export (async )?function getSameFamilyForCatalog" src/data/hierarchy.ts` = 1; `npx vitest run tests/static/hierarchy.lineage-3-node.test.ts` exit 0 (was RED in 01-T2; now GREEN) | yes | ⬜ pending |
| 05-T2 | 39b-05 | 3 | DISC-11 (NSV-02/16) | — | Both rails ship as Server Components; hide-if-empty + 6-cap + typography lock | grep | `grep -c "if (rows.length === 0) return null" src/components/insights/SameFamilyRail.tsx src/components/insights/LineageRail.tsx` = 2; `grep -c "font-semibold" SameFamilyRail.tsx LineageRail.tsx` = 0 | yes | ⬜ pending |
| 05-T3 | 39b-05 | 3 | DISC-11 (NSV-02/16) | — | /watch/{id} mounts both rails for all viewer states | grep + build | `grep -c "SameFamilyRail" 'src/app/watch/[id]/page.tsx'` ≥ 2; `grep -c "LineageRail" ...` ≥ 2; build exit 0 | yes | ⬜ pending |
| 05-T4 | 39b-05 | 3 | DISC-11 (NSV-02/16) | — | /catalog/{id} mounts both rails after OtherOwnersRoster | grep + build | `grep -c "SameFamilyRail" 'src/app/catalog/[catalogId]/page.tsx'` ≥ 2; render-order JSX snippet captured in SUMMARY | yes | ⬜ pending |

---

## Wave 0 Requirements

New test files (all created in Wave 0 — before Wave 1 UI plans depend on them):

- [x] `tests/static/hierarchy.lineage-3-node.test.ts` — EXTENDED with imageUrl + LineageRow + getSameFamilyForCatalog assertions (Plan 39b-01 Task 2; one intentional RED until Plan 39b-05)
- [ ] `tests/static/ReferenceIdentityCard.no-engine.test.ts` — mandated import-boundary guard (mirrors `CollectionFitCard.no-engine.test.ts`) — Plan 39b-02 Task 1 (vacuous-pass pattern; non-vacuously green after Task 2)
- [ ] `tests/components/insights/ReferenceIdentityCard.test.tsx` — confidence ≥ 0.5 gate + suppression rule — Plan 39b-02 Task 3
- [ ] `tests/components/profile/LockedTabCard.test.tsx` (EXTEND) — logged-in FollowButton + unauthenticated sign-in link + common-ground returns null — Plan 39b-03 Task 3
- [ ] `tests/components/profile/WornCalendar.test.tsx` (NEW) — first-event-day selection + day-click + empty-day caption — Plan 39b-03 Task 5
- [ ] `tests/data/getCollectorsForCatalog.test.ts` (NEW) — 6 tests covering two-layer privacy + self-exclusion + sold filter + dedup — Plan 39b-04 Task 1

Wave 0 also ships:
- [ ] `scripts/seed-lineage.ts` — idempotent operator script — Plan 39b-01 Task 5
- [ ] Operator commits ~20 family_id seeds + ~15 lineage edges to prod DB — Plan 39b-01 Task 7 (BLOCKING checkpoint; D-39b-19; autonomous: false)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `scripts/seed-lineage.ts` writes to prod DB | D-39b-19 / NSV-02+16 | Touches production data; idempotency must be verified empirically | Operator runs `npm run db:seed-lineage` against prod with explicit DATABASE_URL override; verifies summary `family_patched=N family_skipped=0 edges_inserted=M edges_skipped=0`; re-runs and verifies `family_patched=0 edges_inserted=0` (idempotent no-op). |
| Fresh-account `/watch/{id}` + `/catalog/{id}` smoke | NSV-06 / NSV-20 | Browser-level rendering against prod data | Sign in as a fresh account (empty collection); navigate to `/watch/{id}` and `/catalog/{id}` for a high-confidence watch — verify ReferenceIdentityCard renders above CTA block; navigate to a low-confidence catalog — verify card suppressed, fallback caption + CTAs render. |
| Privacy-gated NSV-18 roster | NSV-18 / T-39b-01 | Cross-account browser verification | Sign in as viewer-A; navigate to `/catalog/{id}` that viewer-B (public-profile + public-collection) owns — verify viewer-B chip renders. Sign in as viewer-C (private-profile or private-collection) and view the same page — verify viewer-C chip does NOT render. Sign in as viewer-D and view a catalog viewer-D themselves own — verify viewer-D's own chip does NOT render (self-exclusion). |
| Lineage rails on `/watch/{id}` + `/catalog/{id}` | NSV-02 / NSV-16 | Module-absent verification requires inspecting DOM for absence | After Wave 0 ships, navigate to a seeded catalog — verify Same family + Lineage rails render with cards. Navigate to a non-seeded catalog — verify both rails are DOM-absent (not rendered as empty cards). |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 20s
- [x] `nyquist_compliant: true` set in frontmatter
- [ ] Wave 0 operator smoke (`scripts/seed-lineage.ts` idempotent second-run) verified

**Approval:** planner-approved 2026-05-13; awaiting Wave 0 execution
