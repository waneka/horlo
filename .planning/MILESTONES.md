# Milestones

## v8.2 Discovery Freshness (Shipped: 2026-06-10)

**Phases completed:** 1 phase (75), 2 plans, 6 tasks
**Timeline:** ~2 hours of code work on 2026-05-30 (close held open until 2026-06-09); 14 commits since v8.1 close
**Code:** 6 src/+tests/ files changed (+874 / −11 LOC) — 2 new test files (228 + 413 LOC); zero existing-test churn
**Source:** SEED-017 (planted 2026-05-30 from operator observation that the home "From Collectors Like You" rail surfaces the same ~2 watches across collection changes despite being the largest above-the-fold content slot)
**Pattern:** Single-phase polish milestone (mirrors v4.1 / v5.1 / v5.2 / v8.1 shape — small N of req-IDs, 2 wave-1-parallel plans, no new UI surface)
**Verification:** Both plans automated-verified (build exit 0 + targeted vitest green); D-16 4-case rotation/top-up cases + 4-case mutation-invalidation regression cases all pass. Closed without `/gsd-audit-milestone` (mirrors v5.0/v5.1/v7.0/v8.0/v8.1 close decisions for polish milestones).

**Key accomplishments:**

1. **DISC-RECS-CACHE: read-your-own-writes invalidation for the home recs rail** (Phase 75 Plan 01) — `CollectorsLikeYou.tsx` now registers `cacheTag(`viewer:${viewerId}:recs`)` inside its `'use cache'` scope, on the line immediately after the existing `cacheLife('minutes')`. All four watch-mutation Server Actions in `src/app/actions/watches.ts` (`addWatch`, `editWatch`, `removeWatch`, `moveWishlistToCollection`) call `updateTag(`viewer:${user.id}:recs`)` immediately after their existing `revalidatePath('/')`. Read-your-own-writes semantics (per-viewer, scoped) — the user who just mutated sees the rec change THIS render; cross-user cache-key safety (Pitfall 7 from v2.0 Phase 10) preserved. Mirrors the v7.0 Phase 63 `viewer:${id}:counts` tag shape.

2. **`updateTag` (not single-arg `revalidateTag`) per Next 16 deprecation** (Phase 75 Plan 01 D-02) — Plan originally spec'd `revalidateTag(tag)` single-arg form which is deprecated in Next 16 (signature is now `(tag, profile)` and the single-arg form doesn't type-check cleanly). Executor migrated all 4 call sites + test assertions to `updateTag(tag)` — the named Next 16 primitive for read-your-own-write. Documented in MEMORY as `project_next16_revalidatetag_deprecated`. Pre-existing `notifications.ts` `viewer:${id}:counts` site was the first canonical caller; this is the second.

3. **DISC-RECS-VARIATION: 6h-window deterministic rotation** (Phase 75 Plan 02 D-06/07/08/09) — `SEED_POOL_SIZE` bumped 15→30 in `src/data/recommendations.ts`. New `ROTATION_WINDOW_MS = 6 * 60 * 60 * 1000` constant. Exported `seedFor` (djb2-style 32-bit hash of `viewerId` + `floor(Date.now() / ROTATION_WINDOW_MS)`) + `mulberry32` (inline 5-LOC PRNG, no external dep). Fisher-Yates shuffle of the top-30 pool → take first `SAMPLED_SEED_SIZE` (15). Same window = same shuffle = cache-stable; next window = different shuffle = rail rotates 4× daily.

4. **DISC-RECS-VARIATION: sparse-pool catalog-popularity top-up** (Phase 75 Plan 02 D-10/D-11/D-14) — New exported `topUpFromCatalogPopularity()` helper fires when post-viewer-exclusion `candidateMap.size < SPARSE_POOL_THRESHOLD` (8). Queries `watches_catalog` ordered by `(ownersCount DESC, brand ASC) LIMIT 20`. Uses `ownersCount` only (not + `wishlistCount`) — ownership matches the rail title "From Collectors Like You." Determinism comes from the daily pg_cron refresh of `ownersCount` (03:00 UTC) — no PRNG needed for top-up. The rail never looks broken with 1-2 cards even on a fresh small user base.

5. **`Recommendation.representativeOwnerId` widened to `string | null`** (Phase 75 Plan 02 D-12/D-13) — Synthetic top-up rows emit `null` ownerId (no real owner to attribute) and route through the existing community-fallback rationale `"Popular in the community"` — no new rationale template or copy surface. `RecommendationCard.tsx` inspection-verified non-dereferencing of the field — non-breaking type widening. Locked the synthetic-row marker through to UI consumers via JSDoc on the type.

6. **Mutation-invalidation regression suite + pure-function smoke tests** — `tests/app/actions/watches-recs-invalidation.test.ts` (Phase 75 Plan 01 D-15, 4 cases asserting each mutation action fires `updateTag(viewer:${user.id}:recs)` exactly once per call — catches future mutation actions that forget to invalidate). Plus `src/data/__tests__/recommendations.test.ts` (Phase 75 Plan 02 D-16, 4 rotation/top-up cases + 6 pure-function smoke tests for `seedFor` / `mulberry32` / Fisher-Yates determinism — 10 total).

**Notable engineering work:**

- **`project_next16_revalidatetag_deprecated` memory durable lesson** — first project encounter with the Next 16 cache-API signature drift. Future plans specifying read-your-own-write should call out `updateTag` directly, not the legacy single-arg `revalidateTag` form. Cross-user stale-while-revalidate (`revalidateTag(tag, 'max')`) is still correct in its proper place.

- **No code-side changes between code-complete (2026-05-30) and close (2026-06-09)** — the milestone was code-complete in ~2 hours on May 30 but the close was held open for 10 days. STATE.md `status: verifying` correctly reflected the gap; no drift in the working tree (clean) and no follow-up commits required at close. Mirrors `feedback_mobile_ui_verify_on_prod` patience for prod UAT (DISC-RECS-VARIATION specifically needs ≥6h between sessions to observe rotation — a 10-day window comfortably clears it).

- **6th recurrence of `gsd-sdk milestone.complete` extractor garbage** — auto-generated accomplishments at close were "1. [Rule 3 — Blocking issue] Plan's `revalidateTag(tag)` single-arg form is deprecated in Next 16 → migrated to `updateTag(tag)`" (a fragment lifted from 75-01 SUMMARY's "What Changed From Plan" numbered list) and "Files exist:" (a section header from 75-02 SUMMARY). Hand-rewrote this entry per the operator pattern documented in `project_v7_0_complete` / `project_v8_1_complete`. Confirmed across v6.0 / v7.0 / v8.0 / v8.1 / v8.2 — 6 consecutive milestones.

- **3rd recurrence of phase-dir archival miss** — `gsd-sdk milestone.complete` returned `"archived": {"phases": false}`; the CLI archives top-level docs but does NOT archive `.planning/phases/` directories. Hand-archived `.planning/phases/75-recommendations-freshness/` → `.planning/milestones/v8.2-phases/` inline per `feedback_milestone_close_phase_dir_archival_miss`.

- **`audit-open` surfaced SEED-017 as still-active** at close — even though Phase 75 shipped SEED-017's exact scope. Hand-patched the seed's frontmatter (`status: active` → `status: shipped` + `shipped_in: v8.2` + `shipped: 2026-06-09`) before close so it stops appearing as forward roadmap. The audit doesn't know which seed a milestone implements; the operator does.

**Known deferred (27 items acknowledged at close):**

27 items recorded in STATE.md `## Deferred Items`: 2 debug sessions (pre-existing — `knowledge-base`, `mobile-title-above-fold`), 11 quick tasks (oldest from April 2026 — long-tail backlog carried from v8.1 unchanged), 14 unimplemented seeds. Of the 14 seeds, 6 are genuine future work (SEED-001/002/003/005/007/014) and 6 are already-shipped seeds still flagged as `status: active|dormant` and need their seed-file `status:` field flipped to `shipped:` (SEED-008 / 010 / 012 / 013 / 015 / 016). SEED-017 was dropped from the deferred list because it shipped THIS milestone. Consistent with `project_next_clear_operational_debt` pattern across v6.0 / v7.0 / v8.0 / v8.1 closes.

---

## v8.1 Add-Watch Polish (Shipped: 2026-05-30)

**Phases completed:** 3 phases (72, 73, 74), 5 plans, 11 tasks
**Timeline:** 1 day (2026-05-29 → 2026-05-30), 47 commits since v8.0 close (5 feat, 3 fix, 8 test, 28 docs, 3 chore)
**Code:** 12 src/+tests/ files changed (+730 / −146 LOC); 2 new fs-walking static guards
**Source:** v8.0 post-deploy human UAT on prod (`418f0515`) — 6 defects captured (SRCH-01/02/03 + ROUTE-01 + DUPE-04 + MOB-01) all closed here
**Pattern:** Pure subtraction-of-defects against shipped v8.0 code — no new features, each phase ships its own targeted regression test, single bundled prod push + single iPhone UAT walk (per Phase 74 CONTEXT D-15)
**Verification:** All 5 plans automated-verified (build exit 0 + targeted vitest green); 6/6 bundled prod UAT items passed on horlo.app 2026-05-30

**Key accomplishments:**

1. **SRCH-01 multi-token search match** (Phase 72 Plan 01) — `searchCatalogForAddFlow` WHERE clause rewritten from single-substring OR to AND-of-ORs per whitespace-split token; "Brut Datejust" and "Timex Weekender" now match brand-only-overlap rows. DAL-only fix; tokenizer + parameter binding tested with mocked Postgres.

2. **SRCH-02 keyboard nav + SRCH-03 footer click** (Phase 72 Plan 02) — Combobox.Up/Down/Enter restored via two surgical edits to SearchEntry: `isItemEqualToValue` prop on the Combobox root (base-ui requires it for highlight tracking) + removal of `index={i}` from Combobox.Item (the prop overrode internal item ordering and broke keyboard sequencing). Footer "What I'm looking for isn't here" button relocated outside `Combobox.List` as a Popup-sibling so the click survives base-ui's list-blur close; LOCKED composition slots from Phase 72 D-05..D-08.

3. **ROUTE-01 owned-redirect fix** (Phase 73 Plan 01) — `handleSearchPick` owned branches swapped slug source from `result.reference` (model number; failed `/w/[ref]` UUID guard → 404) to `result.catalogId` (UUID always present in search results). Both owned branches collapsed to a single early-return `router.push(/w/${catalogId})`; receiver route untouched. Test scaffolding pivoted from URL-mode owned (T-70-01) and reference-mode owned (T-70-02) to a single catalogId target; WR-02 Test A deleted (rendered unreachable); WR-01 Test B pivoted to structured-submit.

4. **DUPE-04 hide-CTA-entirely under DupeBanner** (Phase 74 Plan 01) — ConfirmStep Section 6 primary CTA (`Saving...` button on non-saving state, surfaced from Phase 70 gap-plan-08 WR-01 OR-gate) NOT rendered at all when DupeBanner is mounted. Implemented via additive optional `bannerActive?: boolean` on ConfirmStep (Phase 68 D-03 additive-extension contract preserved); AddWatchFlow.tsx:694 reverted from `pending={state.pending || state.dupeContext != null}` to `pending={state.pending}` (Phase 68 D-03 pending-semantic purity restored) + new adjacent `bannerActive={state.dupeContext != null}`. The banner IS the choice surface; absence is structural, not a disabled stub. Phase 70 D-11 DupeBanner sibling pattern UNCHANGED.

5. **MOB-01 global iOS auto-zoom floor + 3 className rewrites** (Phase 74 Plan 02) — Global `@layer base { input, textarea, select { font-size: 1rem; } }` in `src/app/globals.css` catches DOM-default native elements (specificity 0,0,1 — utilities still win; no `!important`). Three user-facing offenders flip bare `text-sm` → `text-base md:text-sm` (16px mobile, 14px desktop — mirrors shadcn `Input` + `Textarea` primitives): `CommentCompose.tsx:60`, `CommentItem.tsx:170`, `SearchEntry.tsx:242` (Combobox.Input). Out of scope: shadcn primitives (already correct), `src/components/admin/*` (out of v8.1 user-facing scope), `src/app/layout.tsx` viewport export (no `maximumScale`/`userScalable` per ROADMAP SC#3; pinch-zoom preserved).

6. **2 fs-walking static guards lock the MOB-01 invariants** (Phase 74 Plan 02) — `tests/static/no-iOS-zoom-viewport.test.ts` parses `src/app/layout.tsx` viewport export and asserts body does NOT contain `maximumScale`/`userScalable`/`minimumScale` (also rejects raw HTML `maximum-scale=` smuggled via `dangerouslySetInnerHTML`). `tests/static/no-text-sm-on-native-form-controls.test.ts` walks `src/components/comment/` + `src/components/watch/SearchEntry.tsx` (scope deliberately limited) and asserts every `<textarea|<input|<select|<Combobox.Input` with bare `text-sm` ALSO has `md:text-sm`. Both files declare `// @vitest-environment node` on line 1 per `project_vitest_static_node_env` (without the pragma vite externalizes node:fs → readdirSync undefined → guards silently pass on Vercel prebuild → false-negative regression).

**Notable engineering work:**

- **5th recurrence of JSDoc-prose grep-collision pattern** preempted in Phase 74 Plan 02 D-12 guard. Initial SCOPE LIMIT comment cited `src/components/admin/*` verbatim and would have tripped the AC `grep -c "src/components/admin" returns 0`. Reworded to "the admin/ subtree" — preserves intent, clears the grep. 5 documented recurrences across Phases 64/69/70/74-01/74-02. Durable lesson reinforced: AC greps targeting literal tokens false-positive on JSDoc-prose using that token; paraphrase in prose, keep the literal in code/strings only.

- **Disappearance-paired assertion pattern** (per `feedback_test_assert_disappearance_too` recurrence-3) carried forward in DUPE-04 test pivot. 3 existing WR-01 tests (A/B/C) flipped from `toBeDisabled()` to `not.toBeInTheDocument()` paired with `getByTestId('dupe-banner-{owned|wishlist}').toBeInTheDocument()`; new WR-01 Test D asserts absence-by-construction (banner mounted → CTA absent → addWatch never callable).

- **Extractor garbage hit again on milestone.complete** — 5th milestone (after v6.0/v7.0/v8.0). Final accomplishment bullet was `"1. [Rule 1 — Bug-preemption] JSDoc-prose grep-collision recurrence-4 preempted in D-12 guard"` lifted from a SUMMARY.md numbered list and mangled. Hand-rewrote this entry per the operator pattern documented in `project_v7_0_complete`.

- **STATE.md progress recurrence-5 of `project_phase_complete_999_1_misset`** — Phase 74 `phase.complete` returned `is_last_phase: true` (correct, no `next_phase` corruption this time) but still inflated `completed_phases` to 4 against `total_phases: 3` → 133%. Hand-corrected to 3/3 / 100% before milestone close. Recurrence confirms the progress-counter bug is independent of the next-phase-id bug.

**Known deferred (29 items acknowledged at close):**

27 acknowledged items recorded in STATE.md `## Deferred Items`: 2 debug sessions (pre-existing), 11 quick tasks (oldest from April 2026 — long-tail backlog), 14 unimplemented seeds (12 dormant + 2 active — represents the forward roadmap, not operational debt; promoted via `/gsd-new-milestone`). The 3 v8.1 UAT files (72/73/74) flagged by audit are false positives — all `status: passed` with 0 pending. Consistent with `project_next_clear_operational_debt` pattern across v6.0 / v7.0 / v8.0 closes.

---

## v8.0 Add-Watch Redesign (Shipped: 2026-05-29)

**Phases completed:** 6 phases (66, 67, 68, 69, 70, 71), 22 plans
**Timeline:** 2 days (2026-05-28 → 2026-05-29)
**Scope:** 63 files changed, +7,894 / −2,226 LOC across src/ and tests/
**Git range:** 150 commits (`b201ada8` → `8b6a405d`)
**Requirements:** 39/39 v8.0 requirements shipped (EXTR 8, SRCH 10, CONF 11, DUPE 3, CLNP 7)

**Key accomplishments:**

1. **Search-first add-watch flow** — Replaced the verdict-driven add path with an Omega-style typeahead → confirm/redirect orchestrator. `/watch/new` now opens with `SearchEntry` (`@base-ui/react/combobox` 1.3.0); typing ≥2 chars after a 250ms debounce hits `searchCatalogForAddFlow` Server Action; results render brand/model/reference/cover-photo rows with "In collection" / "On wishlist" viewer-state badges (Phases 67 + 69 + 70).
2. **DUPE-01/02/03 wired end-to-end** — Owned `viewerState` auto-redirects to `/w/[ref]` (no confirm shown); "Add another copy" affordance for legitimate duplicates; `moveWishlistToCollection` UPDATE-not-INSERT for wishlist → owned status flip with activity-feed + cross-user overlap notification fan-out (Phase 70 Plans 02 + 03 + 05; Phase 67 Plan 01 DAL).
3. **Module-scope cache hygiene** — All four caches (`useCatalogSearchCache`, `useStructuredExtractCache`, `useUrlExtractCache`, `useWatchSearchVerdictCache`) now reset on user-switch via shared `lastUserId` guard; CLNP-07 closes the pre-existing `useWatchSearchVerdictCache` tech debt in the same change (Phase 69 Plans 02 + 03 + 06).
4. **ConfirmStep + DupeBanner + StructuredEntryPanel** — Three pure-presenter components for the new flow: status-picker with grail option, status-gated price field, 3-tier image fallback (ConfirmStep); "View existing" / "Add another copy" / "Move to Collection" affordances above ConfirmStep (DupeBanner); 4-field inline-mounted entry form with EXIF-cleaned photo blob forwarded through commit (StructuredEntryPanel) (Phases 68 + 70 Plan 02 + Plan 06).
5. **`/api/extract-watch` structured mode** — New `mode: 'structured'` discriminator short-circuits HTML scraping; `llm-structured.ts` sibling Anthropic strict-tool-use extractor; `validateAndCleanData` promoted to public surface for cross-mode reuse (Phase 66).
6. **Dead-code subtraction + structural guards** — `VerdictStep`, `WishlistRationalePanel`, `PasteSection`, `RecentlyEvaluatedRail` (+ test files) deleted; ~926 LOC removed; `flowTypes.ts` pruned 93 → 64 lines; `AddWatchFlow.tsx`'s 10 rail/setRail/railRef sites swept; 2 new `// @vitest-environment node` static guards prevent reintroduction; Vercel prebuild widened to full `tests/static/` directory; 8 pre-existing fs-walking guards retrofitted with the directive to close the Phase 59 landmine class structurally (Phase 71).

**Known deferred (formally v8.1 polish scope):**

6 defects captured via post-deploy human UAT on prod (`418f0515`):

- **SRCH-01** (blocker): Multi-token search (`Brut Datejust`, `Timex Weekender`) returns zero matches when brand alone matches
- **SRCH-02** (major): Combobox keyboard navigation broken — Up/Down/Enter all dead
- **SRCH-03** (major): "Not finding it?" footer click is a no-op
- **ROUTE-01** (blocker): Owned-redirect `/w/[ref]` resolves 404
- **DUPE-04** (major): WR-01 gate surfaces as misleading "Saving..." copy
- **MOB-01** (minor): iOS Safari input zoom on focus (whole app)

Phase 70's 8 + Phase 69's 4 human_verification items walked: 9 pass / 0 partial / 6 distinct defects across 3 issue tests. v8.1 polish milestone opens next.

**Notable engineering work:**

- 70-VERIFICATION.md required manual re-verification after Plans 70-06/07/08 closed CR-01 (StructuredEntryPanel photo blob), CR-02 (`movement: 'auto'` data corruption), WR-01 (ConfirmStep dupe-gate), WR-02 (silent dupe fallthrough) — `phase.complete` flow doesn't re-run the verifier automatically. Score flipped `gaps_found` (4/6) → `passed` (6/6).
- Phase 70's `gaps_found` was almost missed during /gsd-progress audit — VERIFICATION.md frozen at pre-fix timestamp; surfaced + re-verified inline during milestone close.
- `phase.complete` SDK verb mis-archived (phase dirs not migrated, extractor garbage in accomplishments, CLNP-01..04 checkboxes not flipped) — all hand-corrected at close. 4th recurrence of the extractor pattern (v6.0, v7.0, v8.0).

---

## v7.0 Watch Photos & Detail Redesign (Shipped: 2026-05-28)

**Phases completed:** 7 phases (59, 60, 61, 62, 63, 64, 65), 29 plans
**Timeline:** 4 days (2026-05-25 → 2026-05-28), 244 commits since v6.0 close (46 feat, 39 fix, 27 test, 123 docs)
**Code:** 65 `src/` files changed (+5,057 / −628 LOC); 33 `tests/` files changed (+3,982 / −502 LOC); `src/` at ~55,320 LOC
**Source:** SEED-013 (multi-photo + carousel + wear-pic surfacing), SEED-015 (inline grid engagement), SEED-016 (`/w/[ref]` detail redesign), and the Phase 50 watch-detail architecture spike (Variant C verdict).
**Audit:** Closed without a formal `/gsd-audit-milestone`. 34/34 v7.0 requirements checked off in REQUIREMENTS.md traceability table; STATE.md reported `status: milestone_complete`; pre-close artifact audit's 28 open items acknowledged as deferred (see STATE.md `## Deferred Items`).

**Requirements shipped (34/34 satisfied):**

- **ROUTE-01..06** — Variant C hard cutover: every watch lives at canonical `/w/[ref]`; legacy `/watch/[id]` + `/catalog/[catalogId]` removed (no redirect); CI link-audit guard (ROUTE-03) fails the build on any surviving `/watch/${` literal; per-viewer framing (owner vs cross-user) and the two-layer privacy gate preserved (Phase 59).
- **PHOTO-01..09** — In-place ALTER on `watches_catalog`; `watch_photos` table with per-watch ~10-cap; EXIF-strip + ≤1080px JPEG re-encode pipeline; drag-reorder filmstrip; first-photo cover thread across grids and rails; per-photo delete with undo; prominent (not buried) photo upload affordance in the add-watch flow (Phases 60 + 61).
- **WPIC-01..06** — Public wear photos auto-surface on watch detail (public = consent); owner per-pic hide control; dual-layer ownership enforcement (server action + DAL sql\`\` subquery); Wears tab shows actual wear photo (not the generic catalog image); Home rail stays ephemeral (24/48h); non-public wear pics never surface; surfaced pics carry the v6.0 likes/comments layer (Phase 62).
- **GRID-01..05** — One-tap like + lightweight inline comment composer from profile collection/wishlist grid cards; optimistic `♥ N · 💬 M` counts; full thread still clicks through (compose-only inline by design); GATE-03 wishlist mutual-follow gate enforced per card; `text-destructive` token (not raw `text-red-…`) for liked Heart chip (Phase 63).
- **PAGE-01..04** — `/w/[ref]` recomposed into an intentional information hierarchy (carousel-forward, elevated verdict, deliberate comment placement, four spec cards, gap-fill + notes); mobile-only brand+model hoist above the carousel via JSX dup (not CSS `order-`); Phase 51/52 Cache Components structure intact (CommentThread stays an uncached Suspense sibling; `unstable_instant = false` on related routes not disturbed); MAX_LOOKAHEAD bumped to 70 in the PPR guard for Branch 1 (Phase 64).
- **FOLL-01..04** — Compact "people you follow who own this" module in the hero right column; hide-if-empty; one-way "viewer → owner" direction (taste-discovery / social-proof framing, not mutual-only and not "people who follow you"); each chip a navigable `avatar + @username` link; single efficient query via follows-join over the catalog roster; respects existing profile visibility (Phase 65).

**Also delivered (bug-fixes / architectural cleanup, no formal req-ID):**

- **React #419 soft-nav 404** on `/w/[ref]` and `/wear/[id]` resolved (Phase 61 Plan 06) via `await connection()` static-shell opt-out above the page/layout Suspense + admin-client cover URL signing. Static guard `tests/static/ppr-dynamic-before-use-cache.test.ts` (`@vitest-environment node`) encodes the durable ordering rule for the two fixed routes.
- **React #418 date-TZ hydration** mismatch in `WatchDetail` / `WornTimeline` / `WornCalendar` resolved via `toLocaleDateString('en-US', { timeZone: 'UTC' })` (Phase 61 Plan 06).
- **Catalog-photo placeholder gap** closed inline via migration `20260526120000` (31 prod `watch_photos` rows backfilled from catalog covers).
- **IDOR CR-02** fixed: storage path must prefix `{userId}/` (Phase 61 Plan 01).
- **Add-watch flow gap #9** — `WatchForm.onWatchCreated` suppresses Sonner success toast so the action-button cannot navigate away from the photos-pending step (Phase 61 Plan 06).
- **D-12 cache fix** — `revalidateTag('viewer:{user.id}:counts','max')` added inside `if(ownerProfile?.username)` block in both `toggleLikeAction` and `addCommentAction` (Phase 63 Plan 01).

**Verification:** All 7 phases prod-verified via human UAT on horlo.app. Phase 65 final UAT 9 pass / 1 skip (overflow caption — no >5-followed catalog in prod) / 0 issues. Build green (`npm run build` exit 0); ROUTE-03 CI guard active.

**Known tech debt at close (non-blocking):**

- Phase 61's PPR-ordering static guard is pinned to two routes; broader sweep is **SEED-014 Cache Components canonical sweep** (dormant).
- Phase 65 overflow caption ("and N more") untested at prod scale (no v7.0 catalog has >5 followed owners); covered by component tests only.
- Some shipped seeds (SEED-013, SEED-015, SEED-016, plus prior-milestone SEED-004/008/012) remain flagged dormant/active in the seeds index — re-classification deferred to `/gsd-new-milestone` housekeeping.

**Known deferred items at close:** 28 open artifact-audit items acknowledged as deferred (see STATE.md `## Deferred Items`) — 2 debug sessions (1 stale, 1 Phase-64 resolved), 3 false-positive UAT/verification flags, 10 stale quick-task slugs, 13 backlog seeds. None are v7.0 work.

**Phase directories archived to** `.planning/milestones/v7.0-phases/` per the `feedback_milestone_close_phase_dir_archival_miss` memory (hand-verified before `/gsd-new-milestone` runs `phases.clear --confirm`).

---

## v6.0 Social Interaction (Shipped: 2026-05-24)

**Phases completed:** 8 phases (53, 54, 55, 56, 56A, 57, 57.1, 58), 37 plans
**Timeline:** 3 days (2026-05-22 → 2026-05-24), 257 commits (58 feat, 27 test, 26 fix)
**Code:** 51 `src/` files changed, +4,436 / −484 LOC
**Source:** SEED-012 — a scoped, tasteful likes-and-comments layer on individual watches and wears; social warmth atop the Rdio-style discovery, explicitly *not* "Instagram for watches."
**Audit:** ✅ `passed` (`/gsd-audit-milestone`, 2026-05-24) — 34/34 requirements satisfied across a 3-source cross-reference, 7/7 cross-phase integration flows wired, 0 critical blockers. First v6.x close run through a formal audit.

**Requirements shipped (34/34 satisfied):**

- **LIKE-01..05** — like/unlike individual watches (any status) + wear posts with optimistic state, count hidden at zero, and a UNIQUE-constraint idempotency backstop (Phases 53, 56).
- **CMNT-01..09** — flat newest-first comments on watches + wears with compose-above, 500-char limit enforced at input/Zod/DB CHECK, live counter, in-place edit ("[edited]") + inline-confirm delete, optimistic-at-top reconcile, and count badges (Phases 57, 57.1).
- **GATE-01..05** — wishlist comments restricted to mutual followers (likes stay open — the intended asymmetry); "Follow to comment" locked-state CTA with no content leak; owner always exempt; bidirectional `isMutualFollow` check (Phases 53, 54, 57).
- **NOTIF-11..16** — owner notified on others' likes/comments (never self), like-grouping ("X and N others"), rapid-churn dedup via partial UNIQUE indexes, independent `notifyOnLike`/`notifyOnComment` Settings opt-out, and bell/inbox rendering with deep-links (Phases 55, 58).
- **FEED-06/07** — comments (not likes) surface in the home Network Activity feed, gated so a comment on a mutual-follow-gated wishlist watch is never leaked to ineligible viewers (Phase 57).
- **SEC-01..06** — two-layer privacy (RLS `TO authenticated` + DAL gate) on every interaction; gate enforced in both layers (DAL-direct integration test); Server Actions re-verify auth + authorship (no IDOR, Zod `.strict()`); per-viewer cache scoping; FK cascade removes interactions when a watch/wear is deleted (Phases 53, 54, 55).
- **DISP-01** — profile collection/wishlist grid cards show a batched "♥ N · 💬 M" line per watch (constant ≤5 queries, no N+1) (Phase 57).

**Also delivered (UX/architecture, no formal req-ID):** Phase 56A unified the two disconnected wear-viewing experiences into routed `/wears/[username]` (full-screen stories lane) + `/wear/[id]` (permalink) sharing one `WearCard`/`LikeButton`/`WearCommentHost`, deleting the legacy `WywtOverlay`/`WywtSlide` client modal.

**Verification:** All 5 UI phases passed on-prod human UAT (horlo.app). Per-phase VERIFICATION scores: 53 5/5, 54 5/5, 55 5/5, 56 9/9, 56A 16/16, 57 13/13, 57.1 6/6, 58 3/3.

**Known tech debt at close (non-blocking):** Nyquist VALIDATION docs for phases 54–58 left at `draft` (the described tests exist and pass — doc-reconciliation only; run `/gsd-validate-phase N` to reconcile); ~6 cosmetic doc/impl mismatches (stale JSDoc/comments, benign null-compose race, DragOverlay ghost-card missing count props); pre-existing `wornPublic` test-fixture `tsc` noise across 9 files (Phase 12 column-drop fallout, runtime unaffected).

**Known deferred items at close:** 24 open artifact-audit items acknowledged as deferred (see STATE.md `## Deferred Items`) — 1 false-positive debug-index, 10 stale quick-task slugs, 13 backlog seeds. None are v6.0 work.

---

## v5.2 Polish + Taxonomy (Shipped: 2026-05-20)

**Phases completed:** 5 phases (48, 49, 49.1, 50, 50.1), 21 plans, 34 tasks
**Timeline:** 2 days (2026-05-19 → 2026-05-20)
**Source:** SEED-011 — small, fast milestone clearing 2 user-facing bugs and 2 architectural spikes before larger v6/v7 work

**Requirements shipped (6/6 satisfied):**

- **BUG-01** — Wishlist watch on `/catalog/[catalogId]` no longer mislabeled as "you own this"; the `status='owned'` filter on `findViewerWatchByCatalogId` correctly distinguishes wishlist/sold/grail from owned (Phase 48).
- **BUG-02** — `/search` filter chips render with legible text contrast in dark mode across all 7 chip groups (movement/size/style + FU-01 brand/era/genre/archetype) (Phase 48).
- **TAX-01** — Genre-vs-style taxonomy spike produced a written recommendation: drop the genre/archetype surface, single source of truth on `style_tags` (Phase 49).
- **TAX-02** — Genre/archetype taxonomy surface removed: `primary_archetype` column dropped from `watches_catalog`, `GenreChips`/`ArchetypeChips`/`/explore/genres`/`archetype-config` deleted, `filters.genre`/`filters.archetype` removed from `CatalogSearchFilters`, similarity weights rebalanced (0.04 archetypeMatch redistributed), enricher chain stripped of archetype refs (Phase 49.1).
- **ARCH-01** — Watch-detail architecture spike produced a written verdict: keep the `/catalog/[catalogId]` cross-user spec view and `/watch/[id]` owner per-user view as separate routes; do not merge in v5.2 (Phase 50).
- **ARCH-02** — URL canonicalization shipped: when the viewer owns a catalog ref, `/catalog/[catalogId]` issues a page-layer `redirect()` from `next/navigation` to `/watch/[id]`. Page-layer only — NOT `proxy.ts` (per `feedback_proxy_router_cache_poisoning` memory). The Phase 48 BUG-01 maintenance tax retires with it (Phase 50.1).

**Closeout cleanup (audit-driven, inline):**

- **D-DEBT-01** — Dead `self-via-cross-user` framing surface removed across 6 files: `src/lib/verdict/types.ts` (Framing union shrunk, `VerdictBundleSelfOwned` deleted), `src/lib/verdict/composer.ts` (Exclude simplified), `src/components/insights/CollectionFitCard.tsx` (YouOwnThisCallout + formatOwnedDate removed), `src/components/insights/CollectionFitCard.test.tsx`, `src/components/watch/WishlistRationalePanel.tsx`, `src/components/watch/CatalogPageActions.tsx` (stale JSDoc). 5244 vitest pass / build green / tsc clean.
- **D-DRIFT-01** — `.planning/REQUIREMENTS.md` checkboxes synced for BUG-01/BUG-02/TAX-01/TAX-02 (traceability table was Complete; bullet checkboxes drifted).

**Verification:** v5.2-MILESTONE-AUDIT.md status = `passed` after closeout; integration check PASSED, 5/5 E2E flows wired, full vitest 5244/5245 pass (one fewer = removed self-owned callout test), build exit 0.

**Known deferred items at close:** 23 (see STATE.md `## Deferred Items`).

**Non-blocking operational gates remaining (post-deploy verification):**

- **D-DEBT-02** (Phase 49.1) — 5 prod/visual user-action gates: prod `supabase db push --linked` (Plan 08 Task 2 — autonomous:false per D-MIG-02), prod migration test, `/explore` deep-link smoke, `/watch+/catalog` ReferenceIdentityCard parity smoke, `/explore/genres` 404 live check.
- **D-DEBT-03** (Phase 48) — 1 dark-mode chip legibility UAT (9-step protocol; oklch paint resolution requires real browser; static gates strongly predict success).

---

## v5.1 Explore Page Redesign (Shipped: 2026-05-19)

**Phases completed:** 5 phases (43-47), 27 plans
**Timeline:** 3 days (2026-05-16 → 2026-05-19)
**Codebase:** 508 files changed since v5.0 (incl. `.planning/`), +44,199 / −3,368 lines; `src/` at ~46,900 LOC
**Requirements:** 32/32 v5.1 requirements shipped (PLSH 7, ENRH 6, CMS 10, EXPL 9)

**Delivered:** Built `/explore` as a top-level evergreen, taste-driven discovery surface — a five-module "rabbit hole" distinct from Home's daily check-in — preceded by a UI polish pass and an LLM/vision catalog-enrichment pass, with all editorial content authored through a new in-app admin CMS.

**Key accomplishments:**

- **Polish pass (Phase 43)** — migrated the `/search` filter sheet to a swipe/backdrop-dismissable `FilterDrawer`, suppressed wear UI on wishlist cards, equal-height watch cards with the add-CTA lifted above the grid, device avatar upload with circular crop into a new `avatars` Supabase Storage bucket, and the deprecated Claude model ID updated to `claude-sonnet-4-6`. 7 plans (4 original + 3 UAT gap-closure).
- **Catalog enrichment (Phase 44)** — hardened the enrichment script with two-turn `web_search`, rate-limit retry/backoff, and per-`catalog_id` success/failure logging; a confidence-threshold + photo-existence downgrade guard in `updateCatalogTaste`; human-reviewed factual propose/apply scripts; and a full ~100-row production enrichment run verified for archetype coverage.
- **In-app admin CMS (Phase 45)** — a 5-table migration (`curated_lists`, `curated_list_items`, `collection_paths`, `collection_path_nodes`, `cms_settings`) with two-layer-defended RLS; owner-gated `/admin/lists` + `/admin/paths` routes with `assertOwner()` in every Server Action; full list/path CRUD with markdown editor, cover uploader, and search-as-you-type watch picker; 6 seed collection paths authored.
- **Explore shell + Browse + Archetypes (Phase 46)** — the new `/explore` 5-module responsive shell (self-hiding empty modules); Browse the Catalog with brand/era/genre indices + A–Z brand nav; a Collector Archetypes chip rail deep-linking into archetype-prefiltered `/search`; `/search` Watches tab extended with brand/era/genre/archetype facets. 6 plans (4 original + 2 UAT gap-closure). The old Phase 18 Explore surface was retired.
- **Editorial half of /explore (Phase 47)** — the Curated Lists Rail + `/explore/lists` see-all + per-list detail pages; a quality-gated Hero with manual pin override + weekly rotation + immediate `revalidateTag('explore:hero')` propagation; the Where Collections Go module + `PathCard` (numbered vertical stack at 360px) + `/explore/paths`.

**End-of-milestone follow-ups** (closed as quick tasks before close, 2026-05-19): FU-01 — brand/era/genre/archetype facets made editable in the `/search` filter drawer (`260519-ga9`); FU-02 — `/explore/brands` A–Z smooth scroll fixed by moving `scroll-behavior` to the real scroll container (`260519-g4v`). Both deployed to prod and operator-verified.

**Milestone close (2026-05-19):** Closed without a formal `/gsd-audit-milestone` (as v5.0 was). The pre-close artifact audit surfaced 23 open items — 10 completed quick tasks flagged only for missing SUMMARY frontmatter status, 3 resolved UAT files, 9 future-milestone seeds, and 1 misidentified reference doc — all acknowledged as non-blocking. Phase 45 (7 items) and Phase 47 verification + FU-01/FU-02 human-verify checkpoints were all operator-approved.

**Known deferred items:** see STATE.md `## Deferred Items` and the v5.0-carryover list (DEBT-12 prod drizzle-journal repair; Phase 39c UAT Issue 2; 31 v3.0 + Phase 35/41 human-verification UAT items; smaller carryover).

---

## v5.0 Discovery North Star (Shipped: 2026-05-16)

**Phases completed:** 14 phases (32, 33, 33b, 34, 35, 36, 37, 38, 39, 39b, 39c, 40, 41, 42), 64 plans, 97 tasks
**Timeline:** 11 days (2026-05-06 → 2026-05-16)
**Scope:** 533 files changed (incl. `.planning/`), +92,757 / −30,489 lines; `src/` at 38,625 LOC
**Git range:** 433 commits since v4.1 tag
**Requirements:** 16/16 in-scope v5.0 requirements shipped; 1 ad-hoc DEBT-12 (drizzle journal repair) carried to v5.x as opportunistic housekeeping

**Delivered:** Made Rdio-style click-driven discovery the organizing principle of Horlo — audited every discovery surface, rebuilt the catalog as a 5-level Brand/Family/Reference/Variant/Individual hierarchy, wired catalog taste into the fit engine, and closed the high-leverage dead-end backlog.

**Key accomplishments:**

- **Discovery audit + product north-star (Phases 33 + 33b)** — produced a falsifiable 136-row click-path audit of every clickable affordance across 13 surfaces, then a 42-cell Rdio drift-vector matrix scoring each discovery vector ship/partial/missing; authored 4 product verdicts (combine home+explore=NO, lineage browse=DEFERRED, dead-end closure=YES, CAT-13 framing=discovery) that gated all downstream polish phases.
- **Catalog 5-level hierarchy, Layers A–D (Phases 34–37)** — shipped `brands` + `watch_families` (Layer A); `watch_lineage_edges` junction with BEFORE-INSERT cycle-detection trigger + recursive-CTE `CYCLE` guards and a structured `movement_type` enum + era/material columns (Layer B); `watch_variants` table + clean-slate catalog wipe-and-relink + the `watches.catalog_id` NOT NULL flip (Layer C); 7 collector-diary provenance columns + the `divestments` table as recommender prep (Layer D).
- **CAT-13 engine rewire (Phase 38)** — `analyzeSimilarity()` now consumes catalog taste columns as an additive 9th scoring dimension gated on `confidence >= 0.5`, making the Phase 19.1 LLM-enrichment investment visible in fit verdicts for the first time; 19/19 static guards green.
- **Audit-driven discovery polish (Phases 39 + 39b)** — closed the entire Phase 33b Q3 high-leverage dead-end backlog (NSV-01/02/06/08/12/14/15/16/18/20): mostSimilar Link wraps, common-ground walk-back fallback, fresh-account ReferenceIdentityCard, 8-row Collector Profile sub-cluster, catalog other-owners roster with two-layer privacy, and inline Same-family + Lineage rails — backed by a 100-watch / 32-family / 52-edge prod catalog bootstrap.
- **Profile layout Next 16 conformance (Phase 39c)** — refactored `/u/[username]` to Cache Components + Suspense (ProfileGate Server Component + cached ProfileShellResolver replacing 8 uncached top-level fetches), achieving Partial Prerender and fixing the Router-Cache-poisoning 404 bug surfaced during 39b UAT.
- **Search & verdict polish (Phase 40)** — three faceted filters (movement / size band / style) on the `/search` Watches tab with a mobile bottom-sheet (SRCH-16), plus the pairwise "Compare with what you own" drill-down in CollectionFitCard (FIT-05).
- **Account & email polish (Phase 41)** — Danger Zone (Wipe Collection / Delete Account) with type-to-confirm + password re-auth two-step modals, and three branded react-email Supabase Auth templates installed in the dashboard.
- **Test & validation hardening (Phases 32 + 42)** — restored the DEBT-09 `notesPublic` persistence regression carried from v4.0; ran the Nyquist hardening sweep and triaged ~33 deferred human-UAT items across v4.0 phases.

**Milestone close (2026-05-16):** Pre-close audit surfaced 4 verification gaps (Phases 35/38/40/41) and 2 human-UAT gaps (Phases 35/41) — all operator-approved at close (not deferred). Phase 40's `SearchPageClient.test.tsx` regression was already fixed at commit `083c251` (6/6 green); Phase 38's D-07 test-fixture gap was closed by Plan 38-04 (re-verified PASSED 2026-05-12).

**Known deferred items:**

- **DEBT-12** — repair prod's `drizzle.__drizzle_migrations` journal (1 row vs N expected). Never mapped to a v5.0 phase; opportunistic — fold into the next prod-deploy phase that needs `drizzle-kit migrate` to run cleanly.
- Phase 39c VERIFICATION.md is technically stale (verified against a false-positive sign-off state), but the post-recovery codebase genuinely delivers the phase goal — see `.planning/debug/resolved/profile-page-404-top-nav.md`.
- v5.1 Explore Page Redesign (SEED-008) — DISC-09 was dropped from v5.0 on 2026-05-12 and promoted to a dedicated v5.1 milestone.

**No milestone audit run:** `/gsd-audit-milestone` was not run for v5.0; close proceeded on the disk-complete + operator-approval basis.

---

## v4.1 Polish & Patch (Shipped: 2026-05-05)

**Phases completed:** 5 phases (27, 28, 29, 30, 31), 21 plans + 1 quick task + 1 post-ship hotfix
**Timeline:** 2 days (2026-05-04 → 2026-05-05)
**Scope:** 71 source files changed (excluding `.planning/`), +5,044 / −190 lines
**Git range:** 152 commits since v4.0 tag (`83bc79d` → `5691858`)
**Audit:** `tech_debt` — 12/12 requirements satisfied at code level; 1 NEW finding (DEBT-09 Phase 23-era regression discovered by Phase 31 audit) deferred to v4.2 / v5.0; 4/5 phases Nyquist `partial` (parity with v4.0 posture)

**Key accomplishments:**

1. **Reorderable wishlist + denser mobile grid + price-aware cards (Phase 27)** — `watches.sort_order` column + `watches_user_sort_idx` composite index; `bulkReorderWishlist` DAL with three-layer owner enforcement (Zod `.strict` + session-userId + DAL WHERE+count+set-completeness check); `reorderWishlist` Server Action with `revalidatePath('/u/[username]/[tab]', 'page')` dynamic-segment match; `@dnd-kit/*` DnD wiring on Wishlist (mouse 150ms / touch 250ms / keyboard sensors, optimistic + Sonner rollback, symmetric drop-indicator, `aria-roledescription="sortable"`); status-driven price line in ProfileWatchCard (Owned/Sold→Paid→Market; Wishlist/Grail→Target→Market; hidden when null); `grid-cols-2` mobile grid on Collection + Wishlist (both owner + non-owner branches). Code review: 2 BLOCKERs + 5 WARNINGs all fixed inline. UAT approved across desktop + iOS Safari + keyboard reorder + failure rollback + non-owner public view.

2. **Add-Watch flow lands users back where they started (Phase 28)** — Sonner action-slot success toast wired across 4 commit sites (AddWatchFlow Wishlist commit, WatchForm Collection/manual commit, /search inline Wishlist, /catalog/[id] inline Wishlist) with literal "View" CTA pointing at `/u/{viewerUsername}/{matching-tab}`; D-05/D-06 suppress carve-out when destination matches action target via `canonicalize` (handles `/u/me/` rewrite, query strip, trailing slash). `?returnTo=` validated round-trip across 8 entry-point callsites; server-side validator at `/watch/new` chokepoint reuses auth-callback regex byte-identically (proven by source-equality test) plus self-loop guard. AddWatchFlow.handleWishlistConfirm: D-15 `router.refresh()` REMOVED (replaced by `router.push(dest)`); /search + /catalog inline-commit sites RETAIN refresh per D-05 row 5/6 carve-out. 25 literal copy strings shipped; speech-act split: `rationalePhrasings` (1st-person, required field on VerdictBundleFull) for wishlist auto-fill, `contextualPhrasings` (verdict-to-user) for verdict display; WishlistRationalePanel reads `verdict.rationalePhrasings[0]`. Security audit closed all 21 declared threats including open-redirect (`//evil.com` falls back to default).

3. **Three-layer Add-Watch reset + module-scope cache survival (Phase 29 + Quick Task)** — UserMenu Profile DropdownMenuItem deleted; both surrounding separators preserved per UI-SPEC D-01 wording precision (avatar Link is sole profile entry per Phase 25 dual-affordance). ProfileTabs locked to horizontal scroll only (`overflow-y-hidden pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`); `tabs.tsx` primitive UNCHANGED (Pitfall 7). FORM-04 three-layer defense: Layer 1 — per-request `crypto.randomUUID()` nonce as `<AddWatchFlow key={flowKey}>`; Layer 2 — `useLayoutEffect` cleanup-on-hide with StrictMode-safe ref-guarded skip cases (initial idle + form-prefill survives); Layer 3 — explicit reset BEFORE `router.push(dest)` in handleWishlistConfirm. UAT 10/10 passed across three rounds (round 1: 8 pass + 2 issues; round 2: 1 closed via Plan 29-05 module-scope verdict cache migration; round 3: 1 closed via Plan 29-06 StrictMode-safe cleanup; final issue closed via Quick Task FORM-04 Gap 3 `useUrlExtractCache` so re-paste skips `/api/extract-watch` round-trip). Test infra hardened: `tests/setup.ts` → `tests/setup.tsx` with global `<StrictMode>` wrapper around RTL `render()` so this regression class is caught in CI.

4. **WYWT WYSIWYG capture math + iOS Safari hotfix (Phase 30)** — `CameraCaptureView.tsx`: wrapperRef + aspect-square wrapper class + `computeObjectCoverSourceRect` named export + extended readiness guard (`if (!video || !wrapper || video.videoWidth === 0 || video.videoHeight === 0)`) + 9-arg `ctx.drawImage(video, sx, sy, sw, sh, 0, 0, wrapperW, wrapperH)` capture math. RED test scaffold imports `computeObjectCoverSourceRect` directly from production module (4/4 pure-math fixtures GREEN: 1920×1080, 1280×720, 1080×1080 — all delta=(0,0)). `WristOverlaySvg.tsx` + `ComposeStep.tsx` + `src/lib/exif/strip.ts` UNTOUCHED (locked). **Post-ship hotfix `2dd7377`**: added `h-full` to `<video>` so object-cover engages on iPhone — initial ship had `<video class="block w-full object-cover">` without `h-full`, the element kept its intrinsic 16:9 aspect inside the aspect-square wrapper, object-cover had nothing to crop, and the WYSIWYG capture math assumed a crop that never happened. Owner iOS Safari UAT post-deploy 2026-05-05: preview square, no black bar, wrist centered in saved JPEG. Surfaces UI-SPEC CSS-chain blind spot (saved as feedback memory).

5. **v4.0 verification asymmetry resolved + DEBT-09 surfaced (Phase 31)** — Wrote phase-level `23-VERIFICATION.md` (Phase 23 goal-backward audit; FEAT-07 GAP framing; 5 UAT carryover; sub-plan citation for SET-09/11/12) — score `4/5 + 1 GAP`. Wrote phase-level `24-VERIFICATION.md` (Phase 24 goal-backward audit; 5/5 success criteria PASS; 7 REQ-IDs SATISFIED; 46 tests across 5 files re-confirmed) — score `5/5 PASS`. Appended `## Closure` section to `v4.0-MILESTONE-AUDIT.md` with byte-equality invariant intact (`git diff ... | grep -E '^-[^-]' | wc -l` returns 0 — 17 insertions, 0 deletions). Both backfilled VERIFICATION.md files placed under `.planning/milestones/v4.0-phases/` with bidirectional `closes_audit_items:` cross-references. **Surfaced new finding `DEBT-09` (HIGH severity)**: Phase 23 SUMMARY claimed `notesPublic` Zod field + `revalidatePath('/u/{username}/{tab}')` shipped via commit `4d362ff`, but `git merge-base --is-ancestor 4d362ff HEAD` returns exit 1 — that commit never reached `main`. Tests/actions/watches.notesPublic.test.ts is 0/4 PASS. Phase 31 audit-only per scope; remediation deferred.

**Tech debt deferred:**

- **DEBT-09 (NEW, HIGH)** — `addWatch` / `editWatch` in `src/app/actions/watches.ts` do not persist `notesPublic` and do not call `revalidatePath('/u/...')`. Phase 23 SUMMARY-claimed implementation never reached `main`. RED test scaffold reproducible (4/4 FAIL). Owner: v4.2 patch or v5.0 carryover. Not a v4.1 blocker — DEBT-07/08 only required the audit, which Phase 31 delivered. Surfacing the regression IS the audit's value.
- `useWatchSearchVerdictCache` (module-scoped Map post 29-05) not cleared on signOut — theoretical cross-user verdict leak when collectionRevision values coincidentally match. Pre-existing post-29-05; v5.0+ polish.
- Cancel mid-flow does not honor `?returnTo=` — by Phase 28 spec (only mandated nav-on-commit); browser-back relies on Phase 29 Layer 2 useLayoutEffect cleanup. Documented design choice.
- Nyquist 4/5 partial (Phase 29 alone COMPLIANT) — same posture as v4.0; carryover to v5.0 Nyquist hardening sweep.

See `.planning/milestones/v4.1-MILESTONE-AUDIT.md` for the full audit detail.

---

## v4.0 Discovery & Polish (Shipped: 2026-05-03)

**Phases completed:** 12 phases (17, 18, 19, 19.1, 20, 20.1, 21, 22, 23, 24, 25, 26), 65 plans
**Timeline:** 6 days (2026-04-27 → 2026-05-02)
**Scope:** 472 files changed, +97,147 / −1,959 lines, 62,322 LOC TypeScript in src/+tests/+scripts/
**Git range:** 430 commits (c573ad4 → 7132ac0)
**Audit:** `tech_debt` — 75/75 actionable requirements satisfied + 1 deferred (SMTP-06); 2 phases shipped without phase-level VERIFICATION.md (23, 24); ~33 deferred human UAT items across Phases 18 / 20 / 20.1 / 22 / 23

**Key accomplishments:**

1. **Catalog foundation + LLM taste enrichment (Phase 17 + 19.1)** — Canonical `watches_catalog` table laid silently underneath per-user `watches` with public-read RLS, service-role-only writes, `pg_trgm` GIN indexes, NULLS-NOT-DISTINCT natural-key UNIQUE, idempotent batched backfill, daily SECURITY DEFINER pg_cron count refresh + `watches_catalog_daily_snapshots` for the Gaining Traction rail. Phase 19.1 layered 8 LLM-derived taste columns (formality / sportiness / heritage_score / primary_archetype / era_signal / design_motifs / confidence / extracted_from_photo) via Anthropic Sonnet strict tool-use, fire-and-forget enrichment from both manual entry and URL extract, optional reference-photo upload to a new `catalog-source-photos` Supabase bucket. `analyzeSimilarity()` byte-locked across both phases (silent infrastructure)
2. **Discovery surface live (Phase 18)** — `/explore` Server Component shell shipped with sparse-network welcome hero (gated on `followingCount < 3 && wearEventsCount < 1`) + Popular Collectors / Trending Watches / Gaining Traction rails (per-viewer + global cacheLife with explicit `updateTag` for read-your-own-writes and `revalidateTag('explore', 'max')` for SWR fan-out). BottomNav reshaped to 5 slots: Home / Search / Wear / Explore / Profile (D-03/D-04 amend original DISC-08 wording). See-all routes at `/explore/collectors` (50-row cap) and `/explore/watches` (stacked Trending+Gaining at limit:50 each)
3. **Search Watches + Collections (Phase 19)** — Two stub tabs from v3.0 populated with anti-N+1 catalog watch search (single `inArray` viewer-state batch keyed by viewerId) and two-layer-privacy collection search (BOTH `profile_public` AND `collection_public` + viewer self-exclusion). All-tab union capped at 5 each via three independent sub-effects with per-section AbortController for safe rapid-tab-switch
4. **Collection Fit verdict reframe + Add-Watch Flow Rethink (Phase 20 + 20.1)** — Pure-renderer `<CollectionFitCard>` (no engine imports — static guard locked) replaces `<SimilarityBadge>` (deleted) across `/watch/[id]`, `/search` row inline-expand accordion, and new `/catalog/[catalogId]` route. 12-template composer (4 roadmap-mandated + 8 supporting) with confidence gating at 0.5 / 0.7 thresholds reads Phase 19.1 taste attributes via `viewerTasteProfile` Drizzle aggregate. `/evaluate` route eliminated — URL-paste capability moved into the Add-Watch Flow as `verdict-as-step`. Pasting a URL → verdict preview → 3-button decision (wishlist / owned / skip) is a single coherent gesture. Catalog deep-link from `/search?tab=watches` → `/watch/new?catalogId=X&intent=owned` short-circuits to form-prefill. Manual entry preserved as secondary affordance
5. **Custom SMTP via Resend (Phase 21)** — `mail.horlo.app` verified at Resend with SPF + DKIM + DMARC `p=none` + bounce MX records published via Cloudflare auto-configure. Supabase Auth wired to `smtp.resend.com:465` with `Horlo <noreply@mail.horlo.app>` sender. D-07 round-trip gate (Invite-User Inbox + real Gmail signup Inbox) passed before flipping toggles. Confirm email + Secure email change + Secure password change toggles all flipped ON in production. All three Auth email templates (Confirm signup / Reset Password / Change Email) standardized on canonical `/auth/callback?token_hash={{ .TokenHash }}&type=...&next=...` PKCE+SSR pattern (preempting SET-04 in Phase 22). Backout-plan section in `docs/deploy-db-setup.md` with **T-21-PREVIEWMAIL** + **T-21-WWWALLOWLIST** footguns
6. **Settings restructure + schema-field UI (Phase 22 + 23)** — `@base-ui/react` vertical-tabs shell at `/settings` with 6 sections in canonical SaaS order (Account / Profile / Preferences / Privacy / Notifications / Appearance), hash-driven via `window.history.pushState` (NOT `router.push`) so tab switching doesn't re-run the page Server Component loader. Account section ships email change with pending banner ("Confirmation sent to BOTH old@ AND new@"; T-22-S4 mitigation never displays new email as current pre-confirmation) and password change with 24h staleness `isSessionStale` re-auth dialog. `/auth/confirm/route.ts` extended to switch on `type` (5 EmailOtpType values). `/preferences` redirects to `/settings#preferences`. Preferences exposes `collectionGoal` + `overlapTolerance` Selects as dedicated top Cards. Privacy/Notifications/Appearance restyled. WatchForm exposes per-note `notesPublic` Public/Private pill + `isChronometer` Checkbox; WatchDetail renders only-if-true Certification row
7. **Notification stub cleanup + test debt paydown + polish (Phase 24 + 25 + 26)** — Pre-flight zero-row assertion + `notification_type` enum rename+recreate (with T-24-PARTIDX partial-index surgery for enum-bound dependents) eliminated `price_drop` + `trending_collector` dead code across src/, tests/, scripts/, seed/. 4 `wornPublic` test fixture files rewritten to `wear_visibility` enum. Three v1.0-carryover test suites finally landed: `watchStore` filter reducer, `/api/extract-watch` route integration, `WatchForm`/`FilterBar`/`WatchCard` component tests. Profile graduates to first-class top-right affordance — DesktopTopNav + SlimTopNav avatar dual-affordance (Link to /u/{username}, chevron to UserMenu). 4 empty-state CTAs across collection/wishlist/worn/notes (with API-key-aware Add-manually fallback). 5-category URL-extract error taxonomy (`host-403`, `structured-data-missing`, `LLM-timeout`, `quota-exceeded`, `generic-network`) with locked copy + lucide icons. Hybrid Sonner toast + inline `aria-live="polite"` form feedback rolled across 7 forms via shared `useFormFeedback` hook + `FormStatusBanner`. WYWT auto-nav with Suspense-wrapped photo render covering the 200–800ms storage-CDN propagation window. Phase 25 + 26 received UAT approval on prod commit 7132ac0

**Tech debt deferred:**

- 2 phases shipped without phase-level VERIFICATION.md (Phase 23 only has sub-plan 23-06; Phase 24 has none — implementation evidence in plan-level SUMMARYs)
- ~33 deferred human UAT items across Phases 18 / 20 / 20.1 / 22 / 23 (visual / interactive / live-network behaviors; Phase 25 + 26 UAT approved on prod)
- Nyquist VALIDATION.md drift — only 3/12 phases reached `nyquist_compliant: true` + `wave_0_complete: true` (Phases 19, 19.1, 21); Phases 25 + 26 have no VALIDATION.md
- SMTP-06 staging-prod sender split (`mail.staging.horlo.app`) — pending staging Supabase project per Phase 21 CONTEXT D-01
- REQUIREMENTS.md DISC-08 / NAV-14 wording drift (still references "Notifications" slot; Phase 18 D-03 / D-04 amended to "Profile") — implementation matches amendment, doc string never updated
- Phase 999.1 directory still in `.planning/phases/` (v3.0 archival miss)
- WatchForm.tsx CardDescription / photoError unused imports flagged in plan summaries
- Pre-existing test failures: `tests/no-raw-palette.test.ts` × 2 (font-medium UI-SPEC vs lint conflict), `tests/app/explore.test.tsx` × 3 (Phase 14 stub copy superseded by Phase 18) — pre-existing, not v4.0 fallout
- Pre-existing `LayoutProps` TS error in `src/app/u/[username]/layout.tsx:21` — carried from v3.0
- 5 Phase 20.1 UAT debug entries closed by gap-closure plans 20.1-06/07/08 — moved to `.planning/debug/resolved/` at milestone close

See `.planning/milestones/v4.0-MILESTONE-AUDIT.md` for the full audit detail.

---

## v3.0 Production Nav & Daily Wear Loop (Shipped: 2026-04-27)

**Phases completed:** 7 phases (11, 12, 13, 14, 15, 16, 999.1), 37 plans, 56 tasks
**Timeline:** 5 days (2026-04-22 → 2026-04-26)
**Scope:** 372 files changed, ~58k insertions / ~28k deletions, 21,311 LOC TypeScript in src/
**Git range:** 178 commits since 2026-04-22
**Audit:** `tech_debt` — 51/51 requirements satisfied at code level; ~30 advisory items + 31 deferred human-verification UAT items

**Key accomplishments:**

1. **Schema + storage foundation (Phase 11)** — `wear_visibility` enum (public/followers/private), `wear_events.photo_url`+`note`+`visibility` columns with `worn_public` backfill, `notifications` table with recipient-only RLS + partial UNIQUE dedup index, `pg_trgm` extension + GIN trigram indexes on `profiles.username`/`bio`, `wear-photos` private Storage bucket with three-tier SELECT RLS, SECURITY DEFINER helpers with revoked PUBLIC/anon EXECUTE, DEBT-02 RLS audit on users/watches/user_preferences (NOTIF-01, SRCH-08, WYWT-09/11/13/14, DEBT-02)
2. **Visibility ripple in DAL (Phase 12)** — Three-tier wear privacy wired through `getWearEventsForViewer` / `getWearRailForViewer` / `getFeedForUser` (jsonb metadata gate) / `addToWishlistFromWearEvent`; `worn_public` column dropped from schema + local + prod (WYWT-10/11)
3. **Notifications foundation (Phase 13)** — Fire-and-forget `logNotification` with opt-out + self-guard + internal try/catch; 6-function notifications DAL with explicit-viewerId two-layer defense; `markAllNotificationsRead` + `markNotificationRead` + `markNotificationsSeen` Server Actions; cached `NotificationBell` Server Component with per-viewer `cacheTag`; `/notifications` page with optimistic per-row read flip; Settings opt-out toggles (NOTIF-02..10)
4. **Production nav shell (Phase 14)** — Mobile `BottomNav` (5-item sticky with elevated Wear cradle), `SlimTopNav` (<768px) / `DesktopTopNav` (≥768px) split, `MobileNav` hamburger deleted, `/explore` + `/search` stubs close nav-link 404s, `/insights` retired to owner-only profile tab, `UserMenu` consolidates Profile/Settings/Theme/Sign out, shared `PUBLIC_PATHS` constant + `isPublicPath` predicate unifies proxy + nav auth gate, IBM Plex Sans + `viewport-fit=cover` metadata, DEBT-01 regression-locked (NAV-01..12, DEBT-01)
5. **WYWT photo post flow (Phase 15)** — Two-step modal (`WywtPostDialog` reuses `WatchPickerDialog` for step 1, new `ComposeStep` for photo + note + visibility); `CameraCaptureView` with `WristOverlaySvg` static guide overlay; `PhotoUploader` with HEIC→JPEG via `heic2any` lazy-loaded in Web Worker; canvas-reencoded JPEG ≤1080px with EXIF strip; client-direct upload to `wear-photos` bucket; `logWearWithPhoto` Server Action with orphan-cleanup on 23505 + non-23505; `/wear/[wearEventId]` route with three-tier gate + uniform 404 + per-request signed URL; Sonner `<ThemedToaster />` bound to custom `ThemeProvider` (WYWT-01..08, WYWT-12, WYWT-15..19)
6. **People search (Phase 16)** — `/search` 4-tab page with People populated; `searchProfiles` DAL with two-layer privacy + compound bio-search predicate + batched `isFollowing` (anti-N+1); `useSearchState` hook (250 ms debounce + AbortController + URL sync + 2-char client minimum); XSS-safe `HighlightedText`; `PeopleSearchRow` with avatar + highlighted username/bio + overlap pill + inline `FollowButton`; `DesktopTopNav` search input restyled, `HeaderNav` deleted; pg_trgm Bitmap Index Scan evidence captured via forced-plan EXPLAIN ANALYZE (SRCH-01..07)
7. **Phase 5 code-review follow-ups (Phase 999.1)** — `PreferencesClient` surfaces save failures via `role="alert"` inline banner (MR-01); dead `UnauthorizedError` imports removed (MR-02); MR-03 closed paperwork-only with in-tree note citing Phase 6 RLS migration + Phase 11 DEBT-02 audit migration

**Tech debt deferred:**

- 31 human-verification UAT items (iOS device tests, multi-session flows, FOUC checks, prod browser smoke tests)
- WristOverlaySvg geometry redesign (user owns)
- 9 test files with stale `wornPublic` references (Phase 12 fallout fixture cleanup)
- WYWT post-submit auto-navigation to `/wear/[wearEventId]` (currently dialog closes with toast only — UX enhancement, not a requirement gap)
- Pre-existing `LayoutProps` TS error in `src/app/u/[username]/layout.tsx:21`
- Nyquist coverage partial across phases — most have draft VALIDATION.md without `nyquist_compliant: true` + `wave_0_complete: true`

See `.planning/milestones/v3.0-MILESTONE-AUDIT.md` for full audit detail.

---

## v2.0 Taste Network Foundation (Shipped: 2026-04-22)

**Phases completed:** 6 phases, 21 plans, 54 tasks

**Key accomplishments:**

- Row-level security enabled on users, watches, and user_preferences with 12 owner-scoped policies using InitPlan-optimized auth.uid()
- One-liner:
- One-liner:
- `logActivity` DAL created and integrated into `addWatch` (watch_added/wishlist_added) and `markAsWorn` (watch_worn) with fire-and-forget error handling; column-drop migration awaiting user `drizzle-kit push`.
- Adds per-note visibility columns to `watches`, the profiles DAL with safe fail-open defaults, a cross-user wear-event visibility gate enforcing worn_public, Zod-strict Server Actions for profile edit / privacy toggles / note-visibility toggle, and a pure computeTasteTags function covering all six D-06 rules.
- Ships the user-visible skeleton of the profile experience: `/u/[username]/[tab]` lands on Collection by default, ProfileHeader exposes owner identity + counts + taste tags + inline edit, and `/settings` flips the four PRIV toggles with optimistic UI plus a localStorage-persisted New Note Visibility default.
- Replaces the Plan 02 placeholder tab page with three viewer-aware tab content components — Collection (filter chips + search + owner-only Add Watch card), Wishlist (target price + notes), and Notes (per-row optimistic visibility pill + remove dialog) — and adds a Zod-strict ownership-scoped `removeNote` Server Action. Per-tab and per-note visibility flags gate non-owners at the Server Component layer (PRIV-02 / PRIV-03 / PRIV-05).
- Replaces the Plan 03 fallthrough placeholder for the `worn` and `stats` tabs with full implementations: Worn ships a Timeline / Calendar segmented view, per-watch filter, and owner-only "Log Today's Wear" dialog — wired through the Plan 01 `getPublicWearEventsForViewer` DAL visibility gate (PRIV-04 + PRIV-05). Stats ships Most Worn / Least Worn / Style / Role distribution cards plus a Collection Observations panel powered by a new `src/lib/stats.ts` helper module — collection_public gates the page, with wear data gated separately through the same DAL function so 0-count cards render when worn_public=false.
- Follow/unfollow DAL + Server Actions with Zod .strict() and self-follow rejection, batched follower-list joins with no N+1, and a pure `computeTasteOverlap` library backed by a React cache()-wrapped `getTasteOverlapData` loader.
- FollowButton Client Component (3 variants) with optimistic follow/unfollow + router.refresh() reconciliation + desktop CSS hover-swap + mobile two-tap; wired into ProfileHeader non-owner slot and LockedProfileState auto-accept card; layout hydrates isFollowing server-side.
- Two Server-Component list routes (`/u/[username]/followers` + `/u/[username]/following`) with a Client-Component FollowerListCard that composes AvatarDisplay size=40 + an inline FollowButton behind an absolute-positioned Link overlay; batched `isFollowing` hydration keeps per-row initial state server-rendered without N+1.
- Single-sourced three-way Common Ground gate (viewerId && !isOwner && collectionPublic) extracted to a server-only helper; hero band + 6th tab + per-tab LockedTabCard all wired and pinned by 36 new tests across 5 files. T-09-21 / T-09-22 / T-09-23 mitigations enforced at the gate helper with payload-shape contract assertions.
- Unblocked the Phase 10 network home: expanded activities RLS to own-or-followed, enabled Next 16 Cache Components with a FOUC-free root layout refactor, and published the shared feed types + timeAgo helper every downstream plan depends on.
- Landed the Network Activity feed's read-side backbone: a two-layer-privacy keyset-paginated JOIN DAL, a pure-function time-window aggregator for F-08 bulk collapse, and a Zod-strict `loadMoreFeed` Server Action — 28 unit tests (12 + 8 + 8) green plus an 11-case integration suite that runs whenever a local Supabase stack is available.
- Shipped the WYWT rail's data-access backbone and the "Add to wishlist from wear event" Server Action — two-layer-privacy single-JOIN DAL returning deduped most-recent-per-actor tiles within a 48h rolling window, plus a Zod-strict action that snapshots watch metadata into a new wishlist row without mass-assignment risk. 17 tests green (8 unit + 9 integration-gated on the DAL side; 9 action tests fully unit).
- Delivered the three data surfaces Plan 07 needs to render the non-feed home sections — a pure `wishlistGap` fn (9 canonical roles, 10%-under-representation + no-wishlist-coverage gap detection), a `getRecommendationsForViewer` DAL that composes `tasteOverlap` + privacy-filtered candidate pool + 5-template rule-based rationale (no LLM), and a `getSuggestedCollectors` DAL with an `(overlap DESC, userId ASC)` keyset cursor for Load More — plus the `loadMoreSuggestions` Server Action. 27 unit tests green (11 + 8 + 4 + 7 — 4 unit on the Suggested DAL; 16 integration-gated tests activate with a local Supabase stack).
- Shipped the Network Activity section of the 5-section home: a Server Component that runs the Plan 02 DAL + pure aggregator and hands rows to three leaf renderers (ActivityRow, AggregatedActivityRow, FeedEmptyState), plus a 'use client' LoadMoreButton that calls `loadMoreFeed` with keyset-safe pagination and renders page-2+ rows inline via the same pure renderers — 29 behavioral tests green (10 + 6 + 7 + 6).
- Shipped the daily-retention hook of Horlo v2.0 — the WYWT rail + Instagram-Reels-style overlay + the ONE `WatchPickerDialog` component that Plan 10-08 will import for the nav `+ Wear` button. Four test suites (32 cases) all green, full repo suite (1827) still green, lint + build green on shipped files. Avoided Pitfall 10 (duplicate dialogs) and Pitfall 4 (hydration mismatch) per RESEARCH.md.
- Built the three remaining home-page sections: From Collectors Like You (cached rec rail with `'use cache'` + `cacheLife('minutes')` + prop-borne viewerId to avoid cross-user cache-key leakage), Personal Insights (4-card grid that hides entirely when viewer owns 0 watches), and Suggested Collectors (row list reusing Phase 9 FollowButton variant="inline", plus a LoadMoreSuggestionsButton mirroring Plan 05's state machine so both Load More controls on the home feel identical). 10 new components + 5 test files = 34 new unit tests, all green; full suite 2031/2031 passing, lint zero-error, `npm run build` green across all 20 routes under `cacheComponents: true`.
- Shipped the home page composition that ties Wave 1 + Wave 2 into the 5-section authenticated network home. One new client component (NavWearButton, 4 TDD tests green), one Header modification (lazy picker trigger + parallel owned-watches fetch), one full `src/app/page.tsx` replacement (5 sections in L-01 locked order). Pitfall 10 upheld — exactly one WatchPickerDialog source in the tree; NavWearButton and WywtRail both lazy-import it. Build green across 20 routes under `cacheComponents: true`, lint green on all 4 plan-08 files, full test suite 2052/2052 passing.
- Closed Phase 10 by (a) flipping REQUIREMENTS.md + ROADMAP.md to reflect the shipped 5-section scope — FEED-05 added, WYWT-03/DISC-02/DISC-04 promoted from Future into a new "Network Home" v2.0 subsection, traceability table extended with 4 Phase 10 rows, coverage 31 → 35, Phase 10 renamed "Network Home" with 9 success criteria — and (b) landing a 5-scenario end-to-end privacy test (`tests/integration/home-privacy.test.ts`) that exercises the full DAL chain (feed + WYWT rail + Suggested Collectors) against a seeded local Postgres. The E2E caught one Rule 2 correctness gap: the WYWT DAL's non-self privacy branch only checked worn_public and missed the outer profile_public gate. Patched in-flight. All 5 E2E scenarios green locally; full suite remains 2052 passing when the integration suite skips (DATABASE_URL unset).

---

## v1.0 MVP (Shipped: 2026-04-19)

**Phases completed:** 5 of 6 phases, 26 plans, 36 tasks
**Timeline:** 5 days (2026-04-10 → 2026-04-15)
**Scope:** 222 files changed, ~45k lines, 7,958 LOC TypeScript
**Git range:** 157 commits (588f47c → b3e547b)
**Tests:** 697 passing, 3 skipped (18 test files)

**Key accomplishments:**

1. **Visual polish & security hardening** — Theme system (light/dark/system), fully responsive layouts, SSRF protection with IP pinning, CSP headers, `next/image` domain allowlist, days-since-worn badges, collection balance charts
2. **Preference-aware scoring** — `complicationExceptions`, `collectionGoal` (balanced/specialist/variety), and gap-fill scoring wired into the similarity engine with full Vitest coverage
3. **Wishlist intelligence** — Deal flags, target price alerts, gap-fill scores, Good Deals + Sleeping Beauties insight sections
4. **Data layer foundation** — Drizzle ORM schema, server-only DAL with per-user scoping, Server Actions for all mutations, Supabase Postgres backing store
5. **Authentication** — Supabase Auth via `@supabase/ssr`, `proxy.ts` enforcement, double-verified auth in every Server Action and DAL function, UserMenu with no-JS logout form
6. **Zustand → Postgres migration** — All pages converted to Server Components, Zustand demoted to filter-only state, similarity engine reads from props not stores, `preferencesStore` and `useIsHydrated` deleted entirely
7. **Production deployment** — `horlo.app` live on Vercel + Supabase, verified deploy runbook (`docs/deploy-db-setup.md`) hardened with 6 real footgun fixes from actual execution

**Known gaps:**

- Phase 6 (Test Suite Completion) was not executed — TEST-04, TEST-05, TEST-06 requirements carry forward to v1.1
- 3 MEDIUM code review findings deferred to backlog 999.1 (RLS on public tables, PreferencesClient error swallowing, unused UnauthorizedError import)

---
