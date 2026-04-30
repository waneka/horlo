---
phase: 20
slug: collection-fit-surface-polish-verdict-copy
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-29
updated: 2026-04-29
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `20-RESEARCH.md` § "Validation Architecture". Filled by gsd-planner during plan creation; re-verified by gsd-plan-checker.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x (jsdom env; setupFiles `tests/setup.ts`; alias `server-only` → `tests/shims/server-only.ts`) |
| **Config file** | `vitest.config.ts` + `tests/setup.ts` |
| **Quick run command** | `npx vitest run --reporter=basic` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10-15s for unit slice (verdict module + card); ~25-30s full suite (incl. integration tests) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=basic` (full suite — fast enough at ~30s).
- **After every plan wave:** Run `npx vitest run`.
- **Before `/gsd-verify-work`:** Full suite must be green; `npx tsc --noEmit` must be clean.
- **Max feedback latency:** ~30s.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 20-01-T1 | 01 | 1 | FIT-01..04 (types contract) | T-20-01-02 | Tampering — types-only no runtime exports | static | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 20-01-T2 | 01 | 1 | FIT-04 (success criterion 5) | T-20-01-01 | Info Disclosure — fs read-only | static | `npx vitest run tests/no-evaluate-route tests/static/CollectionFitCard.no-engine` | ❌ W0 | ⬜ pending |
| 20-01-T3 | 01 | 1 | FIT-01..04 (Wave 0 scaffold) | — | — | scaffold (it.todo) | `npx vitest run src/lib/verdict tests/actions/verdict tests/components/search tests/app/watch-page-verdict tests/app/catalog-page src/components/insights/CollectionFitCard` | ❌ W0 | ⬜ pending |
| 20-02-T1 | 02 | 2 | FIT-02 (D-02 aggregate) | T-20-02-01 | Info Disclosure — viewer-scoped query | unit | `npx vitest run src/lib/verdict/viewerTasteProfile` | ❌ W0 | ⬜ pending |
| 20-02-T2 | 02 | 2 | FIT-02 (D-09 shim) | T-20-02-03 | Tampering — closed-union coercion | unit | `npx vitest run src/lib/verdict/shims` | ❌ W0 | ⬜ pending |
| 20-02-T3 | 02 | 2 | FIT-02 (D-01 composer + Pitfall 4 gate) | T-20-02-02 | Tampering — slot-fill via JSX auto-escape | unit | `npx vitest run src/lib/verdict/composer src/lib/verdict/confidence` | ❌ W0 | ⬜ pending |
| 20-02-T4 | 02 | 2 | FIT-02 (D-09 byte-lock) | — | — | static | `diff <(git show HEAD:src/lib/similarity.ts \| shasum -a 256) <(shasum -a 256 src/lib/similarity.ts)` | ✓ exists | ⬜ pending |
| 20-03-T1 | 03 | 2 | FIT-01 (D-04 pure renderer) | T-20-03-01 | Tampering — JSX auto-escape, no innerHTML | unit (RTL) | `npx vitest run src/components/insights/CollectionFitCard tests/static/CollectionFitCard.no-engine` | ❌ W0 | ⬜ pending |
| 20-03-T2 | 03 | 2 | FIT-04 (D-06 loading state) | — | — | static | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 20-04-T1 | 04 | 3 | FIT-03 (D-03 Server compute) | T-20-04-01 | Info Disclosure — viewer-scoped collection | integration | `npx vitest run tests/app/watch-page-verdict` | ❌ W0 | ⬜ pending |
| 20-04-T2 | 04 | 3 | FIT-01 (renderer migration) | — | — | static + suite | `npx vitest run tests/components tests/app && test ! -f src/components/insights/SimilarityBadge.tsx` | ✓ exists | ⬜ pending |
| 20-05-T1 | 05 | 3 | FIT-04 (D-06 Server Action) | T-20-05-01..03 | Spoofing/Tampering/Repudiation — auth + Zod + log | unit | `npx vitest run tests/actions/verdict` | ❌ W0 | ⬜ pending |
| 20-05-T2 | 05 | 3 | FIT-04 (D-06 cache) | — | — | unit (RTL hook) | `npx vitest run tests/components/search/useWatchSearchVerdictCache` | ❌ W0 | ⬜ pending |
| 20-05-T3 | 05 | 3 | FIT-04 (D-05 accordion) | T-20-05-04..07 | Info Disclosure / Tampering — controlled toast set | unit (RTL) | `npx vitest run tests/components/search/WatchSearchRow tests/components/search/WatchSearchRowsAccordion` | ✓ exists (row), ❌ W0 (accordion) | ⬜ pending |
| 20-05-T4 | 05 | 3 | FIT-04 (wiring) | — | — | static + suite | `npx tsc --noEmit && npx vitest run tests/components/search` | ✓ exists | ⬜ pending |
| 20-06-T1 | 06 | 3 | FIT-03 (D-10 catalog page + D-07/D-08 framing) | T-20-06-01, T-20-06-02 | Info Disclosure / Tampering — viewer-scoped + Drizzle bind | integration | `npx vitest run tests/app/catalog-page tests/no-evaluate-route` | ❌ W0 | ⬜ pending |
| 20-06-T2 | 06 | 3 | FIT-03 (DiscoveryWatchCard repoint + cleanup) | — | — | static + suite | `npx vitest run tests/no-evaluate-route tests/app/catalog-page && grep -r '/evaluate?catalogId' src/ \|\| true` | ✓ exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

> Test stubs and fixtures that Plan 01 creates; Plans 02–06 fill in. Inventory aligned to actual file paths used by Plans 02–06.

- [ ] `tests/no-evaluate-route.test.ts` — file-system assertion that `src/app/evaluate/`, `page.tsx`, `route.ts` do not exist (always-on; created at Plan 01)
- [ ] `tests/static/CollectionFitCard.no-engine.test.ts` — text-scan asserting card never imports `@/lib/similarity` or `@/lib/verdict/composer` (vacuous-pass before Plan 03; real assertions once card exists)
- [ ] `src/lib/verdict/composer.test.ts` — composer determinism + 4 roadmap-example template hits + confidence gate + null-tolerance — placeholder it.todo created by Plan 01; Plan 02 fills in 9 real tests
- [ ] `src/lib/verdict/viewerTasteProfile.test.ts` — viewer aggregate pure function + NULL skip semantics — placeholder Plan 01; Plan 02 fills 8 real tests
- [ ] `src/lib/verdict/shims.test.ts` — `catalogEntryToSimilarityInput` round-trip + closed-union coercion — placeholder Plan 01; Plan 02 fills 6 real tests
- [ ] `src/lib/verdict/confidence.test.ts` — Phase 19.1 D-14 gating thresholds (0.5 / 0.7) for fallback / hedged / contextual — placeholder Plan 01; Plan 02 fills 4 real tests
- [ ] `src/components/insights/CollectionFitCard.test.tsx` — pure-renderer invariant + framing branches (same-user, cross-user, self-via-cross-user) — placeholder Plan 01; Plan 03 fills 8 real RTL tests
- [ ] `tests/actions/verdict.test.ts` — Server Action auth, Zod, error paths, Pitfall 3 serialization — placeholder Plan 01; Plan 05 fills 8 real tests
- [ ] `tests/components/search/WatchSearchRowsAccordion.test.tsx` — accordion expand / one-at-a-time / ESC / cache / Server Action — placeholder Plan 01; Plan 05 fills 10 real RTL tests
- [ ] `tests/components/search/useWatchSearchVerdictCache.test.tsx` — revision-keyed cache invalidation — placeholder Plan 01; Plan 05 fills 4 real tests
- [ ] `tests/app/watch-page-verdict.test.ts` — /watch/[id] verdict integration (FIT-03 framing branches + D-07) — placeholder Plan 01; Plan 04 fills 4 real integration tests
- [ ] `tests/app/catalog-page.test.ts` — /catalog/[catalogId] integration (404, framing branches, D-07, D-08) — placeholder Plan 01; Plan 06 fills 5 real integration tests
- [ ] **Update existing** `tests/components/search/WatchSearchRow.test.tsx` to drop `/evaluate?catalogId=` href assertions and add accordion-friendly DOM expectations — owned by Plan 05 Task 3

> All scaffolds created in Plan 01 use `it.todo` so per-task automated verifies in Plans 02–06 run cleanly (todos report as skipped, suite green). Plans 02–06 replace `it.todo` with real assertions; the suite stays green throughout.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Verdict copy reads naturally | FIT-02 | Subjective tone — automated check verifies template hit, not tone | Click 5 catalog rows in `/search?tab=watches` covering `core fit / role duplicate / hard mismatch / partial overlap / heritage echo`. Confirm contextual phrasings sound like the four roadmap examples and don't read as templated noise. |
| Accordion expand animation feels right | FIT-04 | Visual smoothness | Manually expand/collapse rows in `/search?tab=watches`. Confirm `data-[state=open]:animate-in` slide+fade transition (150ms duration) is consistent with rest of app. |
| Cross-user `/watch/[id]` empty-collection layout | FIT-03 / D-07 | Layout regression risk when card is hidden | Sign in as a viewer with 0 watches, navigate to `/u/{otherUser}/collection` → click a watch. Confirm CollectionFitCard is absent and surrounding sections (specs, photos) reflow correctly. |
| /catalog/[catalogId] D-08 self-owned callout | FIT-03 / D-08 | Visual + data correctness | From `/explore` Trending rail, click a DiscoveryWatchCard for a watch you OWN. Confirm "You own this watch" callout appears, the link "Visit your watch detail" navigates to `/watch/{your-per-user-id}`, and the date format is `Added Apr 12, 2026` (not relative). |
| Sonner error toast surface on Server Action failure | FIT-04 | Toast positioning + theme | Inspect DevTools Network — block `getVerdictForCatalogWatch` request manually. Confirm toast renders with copy "Couldn't compute verdict. Try again." and the accordion panel collapses. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (12 scaffolds + 1 update mapped)
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved by planner 2026-04-29 — pending plan-checker re-verification
