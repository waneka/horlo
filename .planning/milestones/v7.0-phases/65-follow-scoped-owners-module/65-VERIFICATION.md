---
phase: 65-follow-scoped-owners-module
verified: 2026-05-28T17:30:00Z
re_verified: 2026-05-28T17:35:00Z
status: passed
score: 5/5 must-haves verified + 2 gaps resolved post-verify (commit 748a2aaf) + prod UAT 9 pass / 1 skip / 0 issues (2026-05-28)
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 5/5 must-haves verified (1 phase-introduced regression flagged + 1 minor tracking gap)
  gaps_closed:
    - "Gap #1 (BLOCKER candidate) — font-medium raw-palette regression on FollowedOwnersModule.tsx lines 76 + 97. RESOLVED in commit 748a2aaf via swap to font-semibold (closest non-forbidden weight; preserves UI-SPEC's header > displayName + chip-username > displayName hierarchy intent — one notch heavier than spec'd weight 500). npm run test now reports 4028 pass / 1 fail; the remaining failure is the documented pre-existing CommentGateLocked.tsx baseline per memory `project_baseline_not_green_build_is_gate`. Build remains green."
    - "Gap #2 (WARNING) — deferred-items.md tracking-hygiene gap. RESOLVED in commit 748a2aaf. File now documents both (a) the font-medium resolution and (b) the Plan 65-03 Task 4 prod human-verify checklist as the sole outstanding gate before phase-complete."
  gaps_remaining: []
  regressions: []
remaining_work:
  - "Plan 65-03 Task 4 (checkpoint:human-verify) — push origin/main → wait 2-3 min for Vercel PPR cache fill → walk the 10-step prod checklist in 65-03-PLAN.md §how-to-verify (B1/B2/B3 desktop placement; mobile single-column collapse; '+N more' caption; soft-nav PPR safety; owner self-exclusion; privacy gate) → type 'approved'. Then run /gsd-verify-work 65 to close phase."
original_gaps:
  - truth: "Project test baseline preserved (no new test regressions introduced by this phase)"
    status: failed
    reason: "Phase 65 Plan 02 introduced a NEW raw-palette test failure that did not exist on HEAD before this phase. The pre-existing baseline per the durable memory `project_baseline_not_green_build_is_gate` lists ONE pre-existing failure: `CommentGateLocked.tsx font-medium`. After Phase 65, there are TWO: CommentGateLocked.tsx AND `src/components/insights/FollowedOwnersModule.tsx`. The new file uses `font-medium` on lines 76 and 97. `git log --all -- src/components/insights/FollowedOwnersModule.tsx` shows the file was first committed in Phase 65 Plan 02 (commit 0e23bc74) — so the regression IS attributable to this phase. The deferred-items.md classification claiming it was 'pre-existing on HEAD before Plan 65-03 began' is technically true (Plan 03 inherited it from Plan 02) but misleading at the phase level — the FILE itself did not exist on HEAD before Phase 65 started."
    artifacts:
      - path: "src/components/insights/FollowedOwnersModule.tsx"
        issue: "Lines 76 and 97 use `font-medium` which violates tests/no-raw-palette.test.ts FORBIDDEN list. Build still passes (raw-palette is a unit test, not a build gate), but `npm run test` failure count increased from 1 → 2 on phase-modified files."
    missing:
      - "Either: (a) replace `font-medium` with a semantic-token utility on FollowedOwnersModule.tsx lines 76 + 97 before phase close, OR (b) explicitly classify this as a known-acceptable deviation in deferred-items.md and update the durable-memory baseline to reflect the new 2-failure baseline, OR (c) defer to a follow-up palette-cleanup phase by recording an override in the verification frontmatter."
  - truth: "deferred-items.md tracks all known unfinished work for this phase"
    status: partial
    reason: "deferred-items.md tracks ONLY the font-medium raw-palette issue. The plan scope explicitly identifies TWO deferred items: (a) Task 4 (Plan 65-03 checkpoint:human-verify — prod human-verify after Vercel deploy + cache fill) AND (b) the font-medium issue. Task 4 IS documented in the SUMMARY's `Deferred Verification` section (65-03-SUMMARY.md line 252) and the frontmatter (`tasks_deferred: 1`), but is NOT listed in deferred-items.md alongside the font-medium item. A future close-the-phase workflow that reads deferred-items.md as the canonical follow-up list will miss the prod human-verify gate."
    artifacts:
      - path: ".planning/phases/65-follow-scoped-owners-module/deferred-items.md"
        issue: "Only documents item #1 (font-medium). Missing item #2: Plan 65-03 Task 4 prod human-verify 10-step checklist (push → Vercel → 2-3min cache fill → walk through B1/B2/B3 desktop placement, mobile single-column collapse, '+N more' caption, soft-nav PPR safety, owner self-exclusion, privacy gate)."
    missing:
      - "Append a second deferred-item entry to deferred-items.md documenting the Task 4 prod human-verify checkpoint with its 10-step checklist reference (or link to 65-03-PLAN.md §<how-to-verify>). This is purely a tracking-hygiene issue — the work itself is correctly identified in SUMMARY.md; it's just not consolidated where a phase-complete workflow expects to read it."
---

# Phase 65: Follow-Scoped Owners Module Verification Report

**Phase Goal:** On `/w/[ref]`, viewers see at-a-glance which collectors **they follow** also own this watch — a compact, hide-if-empty "people you follow who own this" module rendered in the hero right column (under the existing minimal title/spec/like/owner-actions block), with linkable avatar + @username chips routing to each owner's profile / per-user watch detail.

**Verified:** 2026-05-28T17:30:00Z
**Status:** gaps_found (1 BLOCKER candidate + 1 WARNING tracking-hygiene)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | FOLL-01: Module renders on `/w/[ref]` hero right column when ≥1 followed owner exists; entirely absent from DOM (hide-if-empty) at zero. Null-catalogId Branch 1 case also hidden. | VERIFIED | `src/components/insights/FollowedOwnersModule.tsx:69` — `if (owners.length === 0) return null`. `src/app/w/[ref]/page.tsx:181-183` — Branch 1 ternary `watch.catalogId ? getFollowedOwnersForCatalog(...) : Promise.resolve({ owners: [], totalCount: 0 })`. `:533-535` mirrors for owned sub-branch. Hide-if-empty is a single source-of-truth gate. Component test 1+2 verify both empty + non-zero-totalCount paths return null. |
| 2 | FOLL-02: Follow direction is one-way `viewer → owner` (NOT mutual, NOT reversed). | VERIFIED | `src/data/follows.ts:291-297` — exactly one `innerJoin(follows, and(eq(follows.followerId, viewerId), eq(follows.followingId, profiles.id)))`. Identical join replicated in count query (`:318-324`). Tests 7+8 in `tests/data/getFollowedOwnersForCatalog.test.ts` lock this contract (Test 8 seeds only viewer→alice and asserts alice appears; Test 7 seeds bob with NO follow and asserts bob excluded). DAL test file currently skips locally per env-mismatch (identical baseline to canonical sibling getCollectorsForCatalog test). |
| 3 | FOLL-03: Each owner row is a navigable avatar + @username chip with an accessible label. | VERIFIED | `src/components/insights/FollowedOwnersModule.tsx:85-89` — absolute-inset `<Link href=\`/u/${owner.username}/collection\` aria-label=\`${name}'s collection\` ...>` where `name = owner.displayName ?? \`@${owner.username}\``. AvatarDisplay size={40} (`:90-95`), min-h-[44px] tap target (`:83`), focus-visible:ring-2 (`:88`). Component test 5 verifies both Alice (displayName present) + Bob (displayName null → "@bob's collection") aria-label cases pass. |
| 4 | FOLL-04: Single query (no N+1), privacy-respecting (profilePublic + collectionPublic), non-blocking (Promise.all parallel pre-fetch). | VERIFIED | `src/data/follows.ts:278-308` — single SELECT joining follows ⋈ watches ⋈ profiles ⋈ profileSettings, both `profilePublic = true` AND `collectionPublic = true` predicates inside WHERE (`:301-302`), replicated in count query (`:328-329`); JS Set dedup (`:338-350`). Pre-fetch sites: Branch 1 `src/app/w/[ref]/page.tsx:178-184` (inside Promise.all), Branch 2 pure-catalog `:439-450` (inside 9-tuple Promise.all), Branch 2 owned sub-branch `:533-535` (serial await alongside ownedSameFamily/ownedLineage). |
| 5 | Mobile: module stacks naturally below right-column content (single-column collapse, no separate layout). | VERIFIED (code) — NEEDS HUMAN (visual on prod) | Vertical `<ul>` with no `lg:hidden`/`hidden lg:block` JSX duplication (`src/components/insights/FollowedOwnersModule.tsx:77-109`). Responsive collapse handled entirely by parent hero's `lg:grid-cols-[3fr_2fr]` at narrow widths (no responsive variants on the chip stack itself). Per durable memory `feedback_mobile_ui_verify_on_prod`, mobile/visual behavior verifies on prod after deploy — captured in Task 4 prod human-verify checkpoint (intentionally deferred). |

**Score:** 5/5 truths verified (Truth 5 has the standard human-verify deferral consistent with Phase 64 IA work)

### Deferred Items

Items not yet met but explicitly addressed in later milestone phases. (None — v7.0 has no later phases; the 10-step prod human-verify is a within-phase deferral, not a cross-phase deferral.)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/data/follows.ts::FollowedOwner` | Typed projection { userId, username, displayName, avatarUrl } | VERIFIED | Line 218-223. Distinct symbol (D-11), not re-exported from discovery.ts. |
| `src/data/follows.ts::getFollowedOwnersForCatalog` | DAL with single-query + privacy gates + follow-direction join + count(DISTINCT) | VERIFIED | Line 275-352. Full 5-conjunct WHERE replicated in main+count query. JSDoc cites D-05/05a/05b/06/07/08, Pitfalls 1/3/4. Drizzle `asc` import on line 4. |
| `src/components/insights/FollowedOwnersModule.tsx` | Pure RSC: chip stack, hide-if-empty, "and N more" caption | VERIFIED — minor regression | Line 1-117. NO 'use client', NO 'use cache'. Returns null on owners.length===0 (line 69). Strict `>` overflow gate (line 110). NOTE: lines 76+97 use `font-medium` → new raw-palette test failure (see Anti-Patterns + Gap #1). |
| `src/app/w/[ref]/page.tsx` | 3 pre-fetch sites + 2 hero prop passes + 1 direct render on Branch 2 pure-catalog | VERIFIED | Imports lines 15-16. Branch 1 Promise.all line 178-184. Branch 1 hero call line 365-366. Branch 2 pure-catalog Promise.all line 447. Branch 2 owned serial await line 533-535. Branch 2 owned hero call line 621-622. Branch 2 pure-catalog direct render line 763-766. `OtherOwnersRoster` line 771 unchanged. |
| `src/components/watch/WatchDetailHero.tsx` | 2 new optional props + render between LikeButton+jump and Last-Worn | VERIFIED | Type-only import line 33. Function import line 32. Props interface lines 109+114. Destructuring lines 135-136. JSX render lines 319-322 between LikeButton block (ends 313) and Last-Worn block (starts 324). Safe `?? []`/`?? 0` defaults. |
| `tests/data/getFollowedOwnersForCatalog.test.ts` | 8 integration tests (6 mirrored + Tests 7+8 for FOLL-02) | VERIFIED (env-gated skip locally — identical baseline to sibling) | `it(` count = 8. Test 7 + Test 8 both reference FOLL-02 in descriptions. Same env-gating pattern as canonical sibling `tests/data/getCollectorsForCatalog.test.ts:24-29` (`hasDrizzle && hasSupabaseAdmin ? describe : describe.skip`). Locally skips 8/8 (env mismatch documented in 65-01-SUMMARY); same skip count baseline. |
| `tests/components/insights/FollowedOwnersModule.test.tsx` | 11 component tests | VERIFIED | 11/11 pass under jsdom (run command confirmed during verification). |
| `tests/static/followed-owners-module-rsc.test.ts` | Static RSC guard with `// @vitest-environment node` | VERIFIED | Line 1 = `// @vitest-environment node`. 3 it-blocks pass: no 'use client', no 'use cache', exports FollowedOwnersModule. Uses strict `line.trim() === "'use client'"` shape (not fuzzy substring) per the documented Phase 64 false-positive precedent. |
| `tests/static/watch-detail-ia-order.test.ts` | Extended with 2 new describes (FOLL-04 + B1 sibling-composition) | VERIFIED | New describes on lines 167 + 180. FOLL-04 asserts ≥3 active-code calls (passes — Branch 1 + Branch 2 owned + Branch 2 pure-catalog). B1 asserts the function NAME is not in any `import {...} from` block in WatchDetailHero (passes — only the TYPE is imported). Pre-existing PAGE-01/02/03/04 + mobile-header describes untouched. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `page.tsx` (Branch 1) | `getFollowedOwnersForCatalog` | Promise.all entry guarded by `watch.catalogId` ternary | WIRED | Lines 178-184. Null-handling identical to existing `getCatalogById` pattern. |
| `page.tsx` (Branch 2 pure-catalog) | `getFollowedOwnersForCatalog` | 9-tuple Promise.all (after `roster`, before `getSameFamilyForCatalog`) | WIRED | Line 447. No ternary needed (`ref` IS catalogId on this branch). |
| `page.tsx` (Branch 2 owned sub-branch) | `getFollowedOwnersForCatalog` | Serial `await` next to `ownedSameFamily`/`ownedLineage` | WIRED | Lines 533-535. Mirrors existing serial-await pattern on this sub-branch. |
| `page.tsx` (Branch 1) | `WatchDetailHero` | `followedOwners={...}` + `followedOwnersTotal={...}` props | WIRED | Lines 365-366. |
| `page.tsx` (Branch 2 owned) | `WatchDetailHero` | Same 2 props | WIRED | Lines 621-622. |
| `page.tsx` (Branch 2 pure-catalog) | `FollowedOwnersModule` | Direct render above `OtherOwnersRoster` (no hero on this branch) | WIRED | Lines 763-766. Comment cites D-03a coexistence. `OtherOwnersRoster` (line 771) untouched (D-03a). |
| `WatchDetailHero.tsx` | `FollowedOwnersModule` | Named import + JSX render | WIRED | Import line 32. Render lines 319-322 with `?? []`/`?? 0` safe defaults. |
| `WatchDetailHero.tsx` | `FollowedOwner` (type) | `import type` ONLY (D-11) | WIRED | Line 33. Static guard at `tests/static/watch-detail-ia-order.test.ts:180-195` enforces the function is NOT imported. |
| `FollowedOwnersModule.tsx` | `FollowedOwner` (type) | `import type` ONLY (D-11) | WIRED | Line 4. Static guard at `tests/static/followed-owners-module-rsc.test.ts` enforces pure-RSC. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| Branch 1 page.tsx `followedOwners` | `{ owners, totalCount }` | `getFollowedOwnersForCatalog` (real db.select with INNER JOIN follows + watches + profiles + profileSettings) | YES — production DAL query | FLOWING |
| Branch 2 pure-catalog page.tsx `followedOwnersForCatalog` | Same shape | Same DAL | YES | FLOWING |
| Branch 2 owned sub-branch `ownedFollowedOwners` | Same shape | Same DAL | YES | FLOWING |
| `WatchDetailHero` `followedOwners`/`followedOwnersTotal` props | `FollowedOwner[]` + `number` | Threaded from page.tsx pre-fetch via JSON-serializable props (B1 sibling composition) | YES | FLOWING |
| `FollowedOwnersModule` `owners`/`totalCount` props | Same shape | Threaded from hero (or directly from page.tsx on Branch 2 pure-catalog) | YES | FLOWING |

No HOLLOW_PROP or DISCONNECTED data paths found. The DAL produces real DB query results; props flow without static fallback or hardcoded empty values (the `?? []`/`?? 0` defaults in the hero are backward-compat safety, not stub data).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase 65 static guards green | `npx vitest run tests/static/followed-owners-module-rsc.test.ts tests/static/watch-detail-ia-order.test.ts` | 17 passed (17) — includes 3 RSC guard + 14 IA-order (incl. 2 new Phase 65 describes) | PASS |
| Component tests green | `npx vitest run tests/components/insights/FollowedOwnersModule.test.tsx` | 11 passed (11) | PASS |
| DAL tests env-gated skip | `npx vitest run tests/data/getFollowedOwnersForCatalog.test.ts` (no env) | 8 skipped (8) — identical baseline to canonical sibling | PASS |
| PPR static guard regression-free | `npx vitest run tests/static/ppr-dynamic-before-use-cache.test.ts` | 4 passed (4) | PASS |
| Build green + PPR contract intact | `npm run build` | exit 0; `◐ /w/[ref]` Partial Prerender preserved | PASS |
| Raw-palette baseline (regression check) | `npx vitest run tests/no-raw-palette.test.ts` | 4029 tests / 2 fail (CommentGateLocked.tsx + **FollowedOwnersModule.tsx** — both `font-medium`) | FAIL — see Gap #1; phase introduced 1 new failure |

### Probe Execution

N/A — this phase has no convention probes under `scripts/*/tests/probe-*.sh`. The plan-declared verification commands are all vitest-based (covered in Behavioral Spot-Checks above).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| FOLL-01 | 65-02, 65-03 | Hide-if-empty + render on hero right column when ≥1 followed owner | SATISFIED | FollowedOwnersModule.tsx:69 (return null), page.tsx Branch 1 ternary :181-183, hero render :319-322 |
| FOLL-02 | 65-01, 65-03 | One-way viewer → owner follow direction | SATISFIED | follows.ts:291-297 (single INNER JOIN follows with followerId=viewerId AND followingId=profiles.id). Tests 7+8 lock the contract. |
| FOLL-03 | 65-02, 65-03 | Navigable chip with accessible label | SATISFIED | FollowedOwnersModule.tsx:85-89 absolute-inset Link with aria-label, /u/{username}/collection href |
| FOLL-04 | 65-01, 65-03 | Single query + privacy + non-blocking | SATISFIED | follows.ts single SELECT with both privacy predicates + page.tsx Promise.all parallel pre-fetch on all 3 branches |

No orphaned requirements. All 4 FOLL-* requirements declared by plans are realized in code.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/insights/FollowedOwnersModule.tsx` | 76, 97 | `font-medium` raw-palette utility | WARNING | Fails `tests/no-raw-palette.test.ts > FollowedOwnersModule.tsx does not use /\bfont-medium\b/`. NOT a build-gate failure (build still exits 0), but `npm run test` failure count INCREASED by 1 vs the documented baseline of 1 pre-existing failure (CommentGateLocked). Tracked in deferred-items.md as a Plan 65-02 follow-up. Plan 65-02 verifier missed this; plan 65-03 explicitly documented out-of-scope; phase-level verification now surfaces it. |

No TODO/FIXME/XXX markers, no hardcoded empty data, no console.log-only handlers, no stub returns. Component is fully wired against real props and primitives.

### Human Verification Required

The following are the standard mobile/visual + soft-nav PPR safety checks that, per the durable memories `feedback_mobile_ui_verify_on_prod` and `project_ppr_dynamic_before_use_cache`, can only be verified on Vercel prod after cache fills:

1. **Desktop B1 placement** — On `/w/<your-watch-id>` (with catalogId set), confirm hero right column shows: brand+model → spec strip → like+jump → "From your circle" module → Last worn → Flag → Action buttons. With 0 followed owners, "From your circle" is entirely absent (no header). Chip click navigates to `/u/<their-username>/collection`.
2. **Desktop B1 non-owner / null-catalogId** — Module entirely absent for URL-extracted watches with `catalogId === null`.
3. **Branch 2 pure-catalog dual-roster** — "From your circle" renders ABOVE existing "X collectors own this" (`OtherOwnersRoster`); both coexist by design (D-03a).
4. **Mobile single-column collapse (375-414px)** — Module stacks naturally below right-column content; `min-h-[44px]` chip tap targets are finger-friendly; long names truncate with ellipsis.
5. **Overflow "+N more"** — Plain caption appears under 5 chips when >5 followed owners exist; absent at ≤5.
6. **Soft-nav PPR safety** — Multiple soft-navs from home/profile/notifications → `/w/[ref]`; ZERO React #419 in console; ZERO 404 on URLs that work on hard refresh. Wait ≥2-3 min after Vercel deploy for cache fill.
7. **Owner self-exclusion** — On a watch you own, YOU never appear in your own "From your circle" chip list (D-05a in DAL).
8. **Privacy gate** — A followed user with `profilePublic=false` OR `collectionPublic=false` does NOT appear (D-05 — follows do not override privacy).
9. **Verify after deploy timing** — Local build cannot reproduce the soft-nav PPR family (per `project_ppr_dynamic_before_use_cache`); only verifiable on prod AFTER cache fills.
10. **Acceptance signal** — User types "approved" on Task 4 checkpoint or routes to gap-closure.

These are correctly classified `human_needed` per phase precedent (Phase 64 used the same pattern). The full 10-step checklist is documented in `.planning/phases/65-follow-scoped-owners-module/65-03-PLAN.md` `<how-to-verify>`.

### Gaps Summary

The code-side delivery is FULLY COMPLETE and goal-achieving:

- All 4 requirements (FOLL-01..04) realized in code with passing static guards + component tests.
- DAL has the correct one-way follow direction + both privacy gates + count(DISTINCT) + JS dedup.
- Component is pure RSC with hide-if-empty, correct chip semantics, and strict `>` overflow gate.
- Integration covers all 3 render branches with correct null-handling on Branch 1 and serial-await on the owned sub-branch.
- PPR scaffolding (line 50 `unstable_instant = false`, line 98 `await connection()`, outer Suspense) is structurally preserved; `npm run build` exits 0 with `◐ Partial Prerender` on `/w/[ref]`.
- `src/data/discovery.ts` is untouched per D-06.
- Existing `OtherOwnersRoster` is positionally and propositionally unchanged per D-03a.

TWO gaps that need addressing before phase-complete:

1. **NEW raw-palette test regression** (Gap #1, BLOCKER candidate). Plan 65-02 introduced `font-medium` on 2 lines of `FollowedOwnersModule.tsx`. The deferred-items.md claim that this was "pre-existing on HEAD before Plan 03 began" is technically true but misleading at the phase level — the FILE didn't exist before Phase 65. The project's durable baseline-failure memory documents only ONE pre-existing palette failure (CommentGateLocked); this phase now adds a second. This is a NEW regression in the phase-level baseline.

   - **Suggested override** (if intentional): An override block in this VERIFICATION.md frontmatter explicitly accepting the deviation and committing to a follow-up palette-cleanup phase would make this an UNCERTAIN/WARNING rather than a BLOCKER. The deferred-items.md tracking IS in place (line 6-15).
   - **Suggested fix** (preferred — 2-line change): Replace `font-medium` with a semantic-token alternative on lines 76 + 97 (similar to how the OtherOwnersRoster handles emphasis). Adds ~5 min of work and clears the regression cleanly without expanding scope.

2. **deferred-items.md tracking gap** (Gap #2, WARNING). The deferred-items.md file lists ONE deferred item (font-medium) but the phase scope explicitly carries TWO (font-medium AND the Plan 65-03 Task 4 prod human-verify checkpoint). Task 4 IS documented in 65-03-SUMMARY.md but a future `/gsd-complete-phase`-style workflow that reads deferred-items.md as the canonical "what's left" file will miss the prod human-verify gate. Recommended: append a second entry to deferred-items.md referencing the 10-step checklist in 65-03-PLAN.md `<how-to-verify>`.

Beyond these two issues, the phase is ready for prod human-verify. The user's pattern-completion path is: (a) fix or accept Gap #1, (b) update deferred-items.md per Gap #2, (c) push origin/main, (d) wait 2-3 min, (e) walk through the 10-step checklist on Vercel prod, (f) type "approved" on Task 4.

---

_Verified: 2026-05-28T17:30:00Z_
_Verifier: Claude (gsd-verifier)_
