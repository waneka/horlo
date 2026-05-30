---
gsd_state_version: 1.0
milestone: v8.1
milestone_name: Add-Watch Polish
status: verifying
last_updated: "2026-05-30T20:42:52.591Z"
last_activity: "2026-05-30 — Phase 74 Plan 02 execution complete (MOB-01 closed structurally: globals.css @layer base font-size 1rem floor + 3 user-facing className rewrites text-sm → text-base md:text-sm + 2 fs-walking static guards locking viewport meta + text-sm-on-native-form-controls invariants)"
progress:
  total_phases: 3
  completed_phases: 3
  total_plans: 5
  completed_plans: 5
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-28 — v8.0 Add-Watch Redesign STARTED)

**Core value:** A collector can evaluate any watch against their collection and get a meaningful, preference-aware answer about whether it adds something or just duplicates what they already own.
**Current focus:** Phase 74 — DupeBanner Gate Refinement + Mobile Polish

## Current Position

Phase: 74 (DupeBanner Gate Refinement + Mobile Polish) — READY FOR VERIFICATION
Plan: 2 of 2 — COMPLETE
Status: Phase complete — ready for verification
Next: /gsd-verify-phase 74  →  bundled prod push (Phases 72+73+74 single deploy + UAT walk per CONTEXT D-15)
Last activity: 2026-05-30 — Phase 74 Plan 02 execution complete (MOB-01 closed structurally: globals.css @layer base font-size 1rem floor + 3 user-facing className rewrites text-sm → text-base md:text-sm + 2 fs-walking static guards locking viewport meta + text-sm-on-native-form-controls invariants)

```
v8.1 Progress [██████████████████████████████] 100% (5/5 plans across 3 phases — Phase 72 done, Phase 73 done, Phase 74 done; verify + bundled prod push next)
```

**STATE.md hand-correction (recurrence-5 of `project_phase_complete_999_1_misset`):** `gsd-sdk query phase.complete 72` returned `next_phase: null` + `is_last_phase: true` and rewrote frontmatter to `status: milestone_complete / completed_phases: 2 / percent: 200`. ROADMAP is fine (Phase 72 marked Complete, 73+74 Not started). STATE.md hand-fixed back to the real next phase.

## Performance Metrics

- v8.0: 6 phases (66-71), 22 plans, 2 days, 150 commits, 39/39 reqs
- v7.0: 7 phases (59-65), 29 plans, 4 days, 244 commits
- 34/34 v7.0 requirements shipped (ROUTE 6, PHOTO 9, WPIC 6, GRID 5, PAGE 4, FOLL 4)
- src/ +5,057 / −628 LOC across 65 files; tests/ +3,982 / −502 LOC across 33 files
- Phase 65 prod UAT: 9 pass / 1 skip / 0 issues
- Blockers encountered: 0
- v6.0 (prior): 8 phases (53-58 + 56A + 57.1), 37 plans, 3 days; 34/34 reqs shipped

## Accumulated Context

### Key Decisions

- **Phase 74 D-06/D-07 — MOB-01 @layer base font-size floor + responsive text-sm rewrites** (Phase 74 Plan 02) — `src/app/globals.css` gains a new `@layer base { input,textarea,select { font-size: 1rem; } }` block (16px DOM-default; specificity 0,0,1 — utilities still win; no `!important`). The 3 user-facing offenders flip bare `text-sm` → `text-base md:text-sm` (16px mobile, 14px desktop — mirrors shadcn `Input` + `Textarea` primitives at `src/components/ui/input.tsx:12` + `src/components/ui/textarea.tsx:10`): `CommentCompose.tsx:60` raw textarea, `CommentItem.tsx:170` raw edit-comment textarea, `SearchEntry.tsx:242` Combobox.Input. Out of scope per CONTEXT D-07 (verified untouched via empty `git diff --stat`): shadcn primitives, `src/components/admin/*` (admin tooling — out of v8.1 user-facing scope), `src/app/layout.tsx` viewport export (D-08 — no `maximumScale`/`userScalable`/`minimumScale`; pinch-zoom preserved per ROADMAP SC#3). Phase 72 LOCKED Combobox composition is NOT altered — only the className string on the one element changes.
- **Phase 74 D-11/D-12 — two fs-walking static guards lock the MOB-01 invariants** (Phase 74 Plan 02) — `tests/static/no-iOS-zoom-viewport.test.ts` (7 tests, all pass) parses `src/app/layout.tsx` `viewport` export with a regex and asserts the body does NOT contain `maximumScale`, `userScalable`, or `minimumScale`; also rejects raw `maximum-scale=` / `user-scalable=` HTML smuggled via `dangerouslySetInnerHTML`. `tests/static/no-text-sm-on-native-form-controls.test.ts` (2 tests, all pass) walks `src/components/comment/` + `src/components/watch/SearchEntry.tsx` (scope deliberately limited per D-12 — admin/* + the rest of src/ NOT walked); for every `<textarea|<input|<select|<Combobox.Input` opening tag with `className` containing bare `text-sm`, asserts the same className ALSO contains `md:text-sm`. Both files declare `// @vitest-environment node` on line 1 per `project_vitest_static_node_env` — without the pragma vite externalizes node:fs, `readdirSync`/`readFileSync` become undefined, and the guards silently pass on Vercel prebuild (Phase 59 prod-deploy failure history). MOB-01 pinch-zoom + actual auto-zoom verification is prod UAT only per D-09 (jsdom + Tailwind compilation is not in test harness — D-13 rejected).
- **JSDoc-prose grep-collision recurrence-4 preempted again in Phase 74 Plan 02** — initial D-12 guard's SCOPE LIMIT comment cited `src/components/admin/*` verbatim to explain the deliberate exclusion; the literal token tripped the AC `grep -c "src/components/admin" tests/...test.ts` returns 0 criterion. Reworded to "Admin-only components (the admin/ subtree) are NOT walked …" — preserves documentation intent; grep returns 0. 4th documented recurrence (Phase 64 WatchDetailTrailing → Phase 69 quartet → Phase 70 RailEntry → Phase 74-01 ConfirmStep → Phase 74-02 D-12 guard). Durable lesson re-confirmed: any AC grep targeting a literal token will false-positive on JSDoc-prose using that token; paraphrase in prose, keep the literal in code/strings only.

- **Phase 74 D-01/D-02 — DUPE-04 hide-CTA-entirely via additive bannerActive prop** (Phase 74 Plan 01) — when DupeBanner is mounted (`state.dupeContext != null`), the ConfirmStep primary CTA (`Section 6` at `ConfirmStep.tsx:311-325`) is NOT rendered at all — no "Saving..." copy, no disabled stub, no placeholder. ConfirmStepProps gains additive optional `bannerActive?: boolean` (default false) per Phase 68 D-03 additive-extension contract; Section 6 wrapped in `{!bannerActive && (<Button ...>...</Button>)}`. AddWatchFlow.tsx:694 reverts `pending={state.pending || state.dupeContext != null}` → `pending={state.pending}` (Phase 68 D-03 pending-semantic purity restored — pending = real async work only) + new adjacent `bannerActive={state.dupeContext != null}` prop. Phase 70 D-11 DupeBanner sibling pattern UNCHANGED.
- **Phase 74 D-03 — ghost row stays mounted while bannerActive=true** (Phase 74 Plan 01) — "Edit details" and "Start over" Section 5 ghost buttons (`ConfirmStep.tsx:289-308`) remain mounted and clickable while the banner is active; price/reference/year inputs remain editable. ONLY Section 6's primary `<Button>` is removed from the DOM. Pending revert (D-02) means ghost buttons remain enabled while `state.pending === false` (the default when no real async work is in flight) regardless of bannerActive.
- **Phase 74 D-04 + D-10 — disappearance-paired assertion pivot for 3 WR-01 tests + new Test D** (Phase 74 Plan 01) — the 3 existing Phase 70 gap-plan-08 WR-01 tests in `AddWatchFlow.test.tsx` pivot from `toBeDisabled()` assertions to disappearance assertions (`queryByText('Confirm primary').not.toBeInTheDocument()`) PAIRED with banner-appears assertions on `data-testid='dupe-banner-{owned|wishlist}'`. Triple-assertion pattern per `feedback_test_assert_disappearance_too` (recurrence-3 — first shipped Phase 72 SRCH-03b, second Phase 73 ROUTE-01). New WR-01 Test D added: pure absence-by-construction — `bannerActive=true` → CTA absent → addWatch never called; closes DUPE-04 SC#1.
- **Phase 74 ConfirmStep mock honors bannerActive in test file** (Phase 74 Plan 01) — vi.mock for `@/components/watch/ConfirmStep` in `AddWatchFlow.test.tsx` updated to destructure `bannerActive` and OMIT the `<button onClick={onPrimary}>Confirm primary</button>` when `bannerActive===true` (Start over + Edit details ghost buttons stay rendered, mirrors D-03). Without the mock update, jsdom would not observe the disappearance and the disappearance-pair pattern would be silently bypassed. New durable lesson: when production conditionally renders DOM under a prop, the test mock MUST honor the same prop or the structural-absence contract is unverifiable.
- **Phase 74 JSDoc-prose grep-collision (recurrence-4) preempted** (Phase 74 Plan 01) — the new ConfirmStep `bannerActive?` JSDoc initially referenced "Section 6 primary CTA" verbatim, which doubled `grep -c 'Section 6' ConfirmStep.tsx` (JSDoc + actual `{/* Section 6 ... */}` block comment). Reworded JSDoc to "the primary CTA in the final section" — single source of truth restored. Recurrence-4 of the JSDoc-as-grep-target pattern documented in Phase 64 (CommentThread), Phase 69 (StructuredEntryPanel quartet), and Phase 70 Plan 04 (RailEntry/VerdictBundle). Future plans: prefer paraphrased prose for any literal token that an AC grep targets.

- **Phase 73 D-01 — search-pick owned redirect uses catalogId UUID, not reference model number** (Phase 73 Plan 01) — `handleSearchPick` owned branch now pushes `/w/${encodeURIComponent(result.catalogId)}` (UUID, always present per `SearchCatalogWatchResult` contract) instead of `result.reference` (a brand-supplied model number string like `REF-001` that failed the `/w/[ref]` UUID regex at `src/app/w/[ref]/page.tsx:151` → 404). The new slug passes the guard → Branch 2 `findViewerWatchByCatalogId` at page.tsx:439 resolves ownership server-side → in-place D-06 owned render at page.tsx:472. Phase 59 D-04 UUID-only invariant preserved (D-02 — route handler untouched). No client-side round-trip added (D-03). encodeURIComponent preserved for defense-in-depth (D-05).
- **Phase 73 D-04 — both owned search-pick branches collapsed to single early-return push** (Phase 73 Plan 01) — the Phase 70 D-06 "owned + null reference → confirm-with-banner" branch ceases to exist on the search-pick path (catalogId is always present, so the null-reference case is mooted). Removed: `resolveDupeContext` round-trip, `toast.error` path, `setConfirmStatus('owned')` setup, and the entire `setState({ kind: 'confirming', ... })` transition for the owned-null-ref search-pick case. The D-06 "confirm-with-banner" pattern remains in use on `handleStructuredSubmit` and `handleUrlBackup` branches — untouched. Both Pick owned + Pick owned no-ref test buttons now redirect identically.
- **Disappearance assertion pairing (recurrence-2 of `feedback_test_assert_disappearance_too`)** (Phase 73 Plan 01) — T-70-01 + T-70-02 now BOTH assert push-target appearance AND `expect(screen.queryByTestId('confirm-step')).not.toBeInTheDocument()` AND `expect(screen.queryByTestId('dupe-banner-owned')).not.toBeInTheDocument()` (triple assertion). When a click both effects a push AND should dismiss overlapping confirming-state UI, assert BOTH directions in jsdom; pair `getByX.toBeInTheDocument()` with `queryByY.not.toBeInTheDocument()`. Guards against any future regression that reintroduces the confirming-state path on owned picks.
- **WR-02 Test A deletion is the implicit consequence of D-04** (Phase 73 Plan 01) — when CONTEXT.md D-06 enumerates only T-70-01 + T-70-02 assertion updates but the D-04 collapse also invalidates an unrelated WR-02 test ("owned (D-06 null-ref fallthrough) + resolver failure → toast.error"), surface the deletion as an implicit consequence in the plan body rather than waiting for the test run to discover it. RESEARCH §Open Questions captures this kind of test-impact ripple before execution; planner must enumerate them in the plan tasks. Pattern: every branch removal needs a sweep across tests for sites that mount through that branch.

- **llm-structured.ts is sibling-of-llm.ts and server-only** (Phase 66 Plan 01, D-01) — the new structured-INPUT LLM extractor lives at `src/lib/extractors/llm-structured.ts` next to `llm.ts`; file header explicitly disambiguates structured-INPUT (user identity) from structured-DATA / `./structured.ts` (JSON-LD scraping); module is marked `import 'server-only'` to gate against Client Component import (API-key leak mitigation).
- **llm-structured.ts throws on missing API key (not return-null)** (Phase 66 Plan 01) — mirrors `llm.ts:54-58`, NOT the silent-null fire-and-forget pattern of `taste/enricher.ts:88-95`. Route's `categorizeExtractionError` catch needs throws to map to `generic-network` HTTP 500.
- **validateAndCleanData is now public surface of `src/lib/extractors/llm.ts`** (Phase 66 Plan 01) — exported (was module-private) so the structured-input extractor reuses the existing 80-LOC enum-validation function for `toolUse.input` (typed `unknown` per SDK). Single source of truth for enum normalization across both URL and structured paths.
- **EnrichmentSource union extended with 'structured-input' literal** (Phase 66 Plan 01, D-03) — additive only; all four existing callers (`enricher.test.ts:50`, `route.ts:196`, `backfill-taste.ts:262`, `reenrich-taste.ts:148`) keep using literals that remain valid. No exhaustive switch consumers; zero signature ripple.
- **WatchDetailHero JSDoc prose must avoid "import.*CommentThread" word sequence** — the PAGE-03 static guard (`expect(content).not.toMatch(/import.*CommentThread/)`) is a full-content scan; prose in JSDoc matching the regex is a false-positive; reword to "CommentThread is NOT referenced in this file" (Phase 64 Plan 02).
- **vi.hoisted() required for vitest mock error classes** — vi.mock factories are hoisted before top-level let/const initialization; error class stubs must live inside vi.hoisted() (Phase 61 Plan 01 lesson).
- **getWatchPhotosForWatch has no userId param** — ownership resolved by RSC before calling; pure read by watchId; signing happens at page level per PATTERNS.md.
- **Variant C is a hard cutover** (operator decision 2026-05-25) — legacy `/watch/[id]` + `/catalog/[catalogId]` routes are REMOVED (no redirect); un-migrated links fail loudly; CI guard is the completeness guarantee (ROUTE-03).
- **`watches_catalog` is NOT wipeable** — in-place ALTER only for photo schema; data migrations keyed by (brand, model, reference), not id (ids diverge local/prod).
- **`workflow.use_worktrees = false` is permanent** — this project is build-gated + DB-touching; `.env.local` unavailable in worktrees.
- **DB migrations**: `drizzle-kit push` LOCAL ONLY; prod uses `supabase db push --linked`.
- **Phase ordering is locked**: 59 (route merge) → 60 (photo schema/DAL) → 61 (photo UI) → 62 (wear pics surfacing) → 63 (grid engagement, depends on 59 only) → 64 (IA redesign, depends on 61+62+63).
- **`unstable_instant = false` on `/u/[username]/[tab]` is PERMANENT** — do not re-enable (Phase 52 lesson).
- **Phase 64 must preserve Phase 51/52 Cache Components structure** — CommentThread stays an uncached Suspense sibling.
- **OtherOwnersRoster + CatalogPageActions on unified route are cross-user only** — gated on `!isOwner` per spike §4.D; Phase 64 IA redesign resolves definitively.
- **Build-gate proven (ROUTE-03/D-11)** — `npm run build` exits 1 with any `/watch/${` literal; exits 0 clean. Vercel will block deploys with missed link migrations.
- **Tests for deleted legacy pages removed** — `tests/app/catalog-page.test.ts` and `tests/app/watch-page-verdict.test.ts` deleted (imported the now-deleted pages); unified route integration coverage in `tests/integration/phase59-unified-route.test.ts` from Plan 01.
- **watch_photos Supabase migration is authoritative** — backfill + lossless assert + DROP COLUMN + RLS + bucket live in `20260525000000_phase60_watch_photos.sql`; Drizzle migration `0013_phase60_watch_photos.sql` is local-sync only; prod push is Plan 04.
- **src/data/watches.ts temporarily broken on row.imageUrl** — RESOLVED in Plan 03 (mappers repointed; cover subquery across all 3 read paths).
- **Cover subquery returns raw storagePath** — Phase 61 signs URLs; DAL stays admin-client-free (D-04/D-06 Open Q1 decision).
- **embla v8 uses watchDrag (not draggable) in reInit()** — PLAN referenced `draggable` but embla v8 renames to `watchDrag`; auto-fixed in Phase 61 Plan 02 (functionally identical).
- **signedPhotos is optional in WatchDetailProps** — backward compat; RSC always passes it; old image block in `else` branch for non-Phase-61 callers.
- **WatchPhotoStep imports PhotoDropzone** — reuses Plan 02 upload pipeline instead of inlining (avoids ~100 lines of duplication; plan explicitly permitted this).
- **onWatchCreated callback intercepts WatchForm create-success** — optional prop fires with (watchId, dest) instead of router.push; all other WatchForm callers are backward compatible.
- **signCoverUrls must be called outside 'use cache' scope** — createSupabaseServerClient reads cookies() which is unavailable in cached context; resolveProfileShellSigned wrapper added outside cached scope in profile-shell-resolver.tsx (Phase 61 Plan 04).
- **D-07 Cover badge edit-mode only** — `isCover && editMode` gate in SortablePhotoThumb; no Cover span in WatchPhotoSection view-mode filmstrip (Plan 05 UAT-confirmed revision).
- **Immediate optimistic delete uses aborted-signal pattern** — `signal.aborted = true` + no-op transition flushes `useOptimistic` on Undo; `setDeletedIds` fires at click time, `deleteWatchPhotoAction` only after 5s timeout (Plan 05 gap #6).
- **PhotoDropzone id prop** — allows filmstrip +Add tile to trigger full-width dropzone below filmstrip via `document.getElementById` click (Plan 05 gap #2).
- **WatchForm onWatchCreated suppresses success toast** — when onWatchCreated is present on create-mode commit, pass {} opts to run() so no Sonner toast action-button can navigate away from the photos-pending step; WatchPhotoStep onDone/onSkip own all navigation (Plan 06 gap #9 fix).
- **P61-BUG-01 static guard** — tests/static/ppr-dynamic-before-use-cache.test.ts with @vitest-environment node encodes the durable ordering rule for the two fixed PPR routes; prevents silent recurrence of the React #419 soft-nav regression (Plan 06 gap #1 guard).
- **hideWearPic/unhideWearPic use dual-layer ownership** — server action re-checks via watchDAL.getWatchById; DAL adds a second layer via sql`` subquery WHERE watch_id IN (SELECT id FROM watches WHERE user_id = ?); defense in depth for T-62-04 IDOR threat.
- **WearEventLite.photoUrl propagates through WornTabContent** — added photoUrl to WornTabContent's local WearEventLite (the intermediary type) so TypeScript enforces the chain from page.tsx RSC through to WornTimeline and WornCalendar.
- **Option A pre-fetch for wear-pic social state** — all wear-pic like/comment state fetched per-pic in the page RSC via Promise.all; avoids client waterfall; consistent with CommentThread pattern (Phase 62 Plan 04).
- **SignedWearPic kept distinct from SignedPhoto** — union would collapse discriminant needed for badge/social-row conditional rendering in WatchPhotoSection (Phase 62 Plan 04).
- **eye/hide toggle uses onPointerDown** — consistent with Phase 61 editMode toggle; avoids Router Cache stale-instance issue (Phase 62 Plan 04).
- **Per-slide wear-pic social overlay uses wp loop var** — each slide's LikeButton target and comment count use `wp.wearEventId` (not `activeWearPic`) so every slide is independently interactive; JSX-position-only relocation closes WPIC-06 UAT Test 4 cosmetic gap (Phase 62 Plan 05).
- **Social comment button keeps onClick** — fresh-per-interaction controls are not subject to the Router-Cache stale-instance onPointerDown mitigation; that mitigation applies only to one-shot editMode / eye-hide toggles (Phase 62 Plan 05).
- **Q6 single inArray query for viewer liked set** — `inArray(watchLikes.watchId, watchIds) + eq(watchLikes.userId, viewerId)` is a single batched query; `viewerLikedSet = new Set(rows.map(r => r.watchId))`; no N+1 (Phase 63 Plan 01).
- **canComment reuses existing allowedSet** — `getBatchedWatchCounts` already computes `allowedSet` for Q5 comment-count gate; `canComment = allowedSet.has(id)` adds zero new queries (Phase 63 Plan 01).
- **D-12 gap closed in both engagement actions** — `revalidateTag('viewer:{user.id}:counts','max')` added inside `if(ownerProfile?.username)` block in `toggleLikeAction` and `addCommentAction`; matches `getBatchedWatchCountsCached` cacheTag scope (Phase 63 Plan 01).
- **text-destructive used for liked Heart chip** — no-raw-palette test forbids `text-red-\d`; `text-destructive` is the design token matching LikeButton; plan specified `text-red-400` but test enforcement required the token (Phase 63 Plan 03 Rule 1 auto-fix).
- **MAX_LOOKAHEAD = 70 in ppr-guard** — Branch 1 of /w/[ref]/page.tsx has 59-line gap between createSupabaseAdminClient and getLikesForTargetCached; 50 was too tight (Phase 64 Plan 01 auto-fix).
- **Privacy guard uses exact-line-match for directive detection** — CRITICAL prose comment in CommentThread.tsx lines 1-3 contains 'use client'/'use cache' as text; regex match would false-positive; trim() === directive form is the correct check (Phase 64 Plan 01 auto-fix).
- **WatchDetailTrailing comment reworded to avoid grep false-positive** — initial header comment `// NO 'use client'` contained the literal string `'use client'`; the plan's RSC assertion `! grep -q "use client"` matched the prose; reworded to `// Pure RSC — no client directive` to let the grep pass while preserving intent (Phase 64 Plan 03).
- **Branch 2-D06 omits OtherOwnersRoster + CatalogPageActions** — cross-user-only components; Phase-64 TODO at ~595 resolved by absence; not a gap (Phase 64 Plan 04).
- **Branch 3 container upgraded to space-y-8 (D-14 parity)** — OtherOwnersRoster + CatalogPageActions surfaced high near verdict (D-13 resolved); Phase-64 TODO comments removed (Phase 64 Plan 04).
- **Task 3 prod human-verify auto-approved in chain mode** — actual prod check (push → Vercel, wait for cache fill, verify desktop 2-col, mobile collapse, jump scroll, soft-nav #419, catalog branch, owner gates) is PENDING / human_needed (Phase 64 Plan 04).
- **FollowedOwnersModule locked as pure RSC** — `tests/static/followed-owners-module-rsc.test.ts` (// @vitest-environment node) fires CI tripwire if 'use client' or 'use cache' appears in first 5 lines; protects /w/[ref] PPR boundary from silent React #419 soft-nav regression once Plan 03 wires the component into WatchDetailHero (Phase 65 Plan 02).
- **FollowedOwner is type-only across the client/server boundary** — Plan 02 component imports `import type { FollowedOwner } from '@/data/follows'` and NEVER `getFollowedOwnersForCatalog`; preserves Plan 03's ability to thread the prop through `WatchDetailHero` ('use client' island) without dragging server-only DAL across the boundary (Phase 65 Plan 02 D-11 enforcement).
- **Route handler now Zod-discriminated by `mode`** (Phase 66 Plan 02, D-07/D-08) — `POST /api/extract-watch` accepts `{ mode: 'url', url } | { mode: 'structured', brand, model, reference?, year? }`. Schema colocated at top of route.ts; uses Zod v4 `.issues[0]` (not `.errors[0]`); closure-scoped `let mode` defaults to `'url'` so the catch always has a value to emit.
- **Every JSON response on `/api/extract-watch` carries `mode: 'url' | 'structured'`** (Phase 66 Plan 02, D-06 coordination point) — success AND error envelopes. Phase 69 `<ExtractErrorCard>` reads `body.mode` to pick copy variant; no client-side mode tracking needed. Auth 401 response intentionally omits mode (auth runs before mode is known — universal across both modes).
- **CATEGORY_COPY value type is now `{ url, structured }` per category** (Phase 66 Plan 02, D-06 unlock) — `structured-data-missing.structured` = "Couldn't find specs for that watch. Try adding a reference number, or enter manually."; `generic-network.structured` = "Something went wrong looking that up. Try again in a moment."; URL-mode strings preserved verbatim from Phase 25 LOCKED D-15.
- **Structured branch flow** (Phase 66 Plan 02, D-03/D-04) — `extractFromStructuredInput` → empty-output gate → `upsertCatalogFromUserInput` (3 fields, NOT `upsertCatalogFromExtractedUrl` — EXTR-08 / Pitfall 5) → taste-enrichment parity with `source: 'structured-input'` + `photoSourcePath: null` → `revalidateTag('explore', 'max')` → success envelope with `source: 'llm'`, `confidence: 'medium'`, `fieldsExtracted`, `llmUsed: true`, `mode: 'structured'`.
- **EXTR-02 cheerio short-circuit asserted via `mockFetchAndExtract.not.toHaveBeenCalled()`** (Phase 66 Plan 02, Rule 3 deviation) — `vi.spyOn(cheerio, 'load')` raises `Cannot redefine property: load` in this environment. Route-level assertion is strictly stronger because cheerio is downstream of `fetchAndExtract` for this route. Plan 01's import discipline (`./llm` direct, not the barrel) provides the module-graph defense.
- **Auth fixture in `tests/api/extract-watch-auth.test.ts` extended** (Phase 66 Plan 02, additive) — three `mkPost({ url: ... })` callers now send `mkPost({ mode: 'url', url: ... })` so the new Zod schema parses them; the `.toEqual({ error: 'Unauthorized' })` strict-equality check on the auth 401 path remains untouched (auth response intentionally omits mode).
- **ExtractErrorCard mode-branch is single-row, derivation lives in component body** (Phase 69 Plan 04, Phase 66 D-06) — `mode?: 'url' | 'structured'` added as optional prop (default URL-mode behavior for backward compat). Only `category === 'structured-data-missing' && mode === 'structured'` derives a new body string ("Couldn't find specs for that watch. Try adding a reference number, or enter manually."); CONTRACT_BY_CATEGORY stays LOCKED as the URL-mode source of truth. 4 other Phase 25 D-15 categories reuse LOCKED copy in both modes. UI-SPEC A9 backward-compat regression guard: existing 15 tests stay green (no mode prop → URL-mode behavior).
- **StructuredEntryPanel is a pure presenter ships dormant** (Phase 69 Plan 04) — Phase 70 mounts; props in, callbacks out (`onSubmitStructured(data)` + `onSwitchToUrl()`); no useRouter / no action imports. Cache check (D-18 JSON-tuple key with per-field trim().toLowerCase(), year nullable) happens BEFORE network call. Generic-network catch path on `fetch` rejection sets `extractError='generic-network'` so ExtractErrorCard branch renders (mode-branch only affects `structured-data-missing` body).
- **CatalogPhotoUploader `onError` is REQUIRED (not optional) — auto-fix** (Phase 69 Plan 04, Rule 3 deviation) — Plan body referenced only `onPhotoReady`/`onClear`/`disabled` props but the actual `CatalogPhotoUploaderProps` declares `onError: (message: string) => void` as required. Passed no-op `onError={() => {}}` in StructuredEntryPanel because the uploader surfaces its own error UI inline and the photo is optional (a failure does not block Find specs). Document for any future consumer.
- **photoBlob held in state but not read inside StructuredEntryPanel** (Phase 69 Plan 04) — destructured as `const [, setPhotoBlob] = useState<Blob | null>(null)` to avoid unused-state warning. Phase 70 wires the upload pipeline at ConfirmStep commit. The state is held in React so Phase 70 wiring is a one-line addition (return photoBlob from the panel as part of onSubmitStructured payload or via a separate callback).
- **JSDoc prose can trip presenter-purity / no-raw-palette / acceptance-grep checks** (Phase 69 Plan 04, recurrence-2 of the JSDoc-as-test-input class) — three separate prose-vs-grep collisions in this plan:
  (a) `grep -v '^//' | grep -c "useRouter\|next/navigation"` matched JSDoc `* ` block comments containing the literal tokens — fixed by rewording to "no client-side navigation hooks";
  (b) `grep -c "Have a URL for this watch?"` AC required exactly 1 hit but JSDoc + JSX = 2 — fixed by rewording JSDoc to "URL backup ghost link (EXTR-07 copy verbatim in JSX)";
  (c) no-raw-palette `\bfont-medium\b` word-boundary regex matched JSDoc explaining the guardrail — fixed by rewording to "no raw weight-500 className overrides".
  Pattern: any grep-based test or AC that targets a literal token can false-positive on prose explaining that literal. Future plans: prefer "Anti-Pattern N — don't use X" prose phrasing where X is paraphrased, or scope grep tests to JSX-only via more specific patterns.

- **DupeBanner is a pure-presenter sibling above ConfirmStep — never a ConfirmStep prop extension** (Phase 70 Plan 02, D-11) — Phase 68 D-03 ConfirmStep prop contract is LOCKED; adding `onMoveToCollection`/`onAddAnotherCopy` callbacks to ConfirmStep would break it. DupeBanner mounts ABOVE ConfirmStep in the `confirming` branch when `state.dupeContext !== null`. Plan 02 ships the presenter dormant (123 LOC component + 121 LOC test, 6 cases green); Plan 05 wires the JSX. Two visual contexts — owned (DUPE-02) → "Already in your collection"; wishlist (DUPE-03) → "On your wishlist". Null-reference fallback (D-06) hides both the "View existing" button AND the "Reference: …" subtext line.
- **no-raw-palette guardrail #4 pinned at Phase 70 Plan 02** — DupeBanner headline uses `text-sm font-semibold text-foreground` (NOT `font-medium`). Recurrence #4 of the Phase 65 / 68 / 69 guardrail family. The forbidden `\bfont-medium\b` regex would catch `font-medium` on the plain `<p>` element if used; Button CVA `font-medium` is the component default and stays inside the Button primitive. `grep -c "font-medium" src/components/watch/DupeBanner.tsx` returns 0; targeted run of `tests/no-raw-palette.test.ts` shows 3 PRE-EXISTING failures (CommentGateLocked, SearchEntry.tsx, SearchEntry.test.tsx — Phase 69 Plan 04 recurrence-2) — DupeBanner is NOT in the failure list.
- **moveWishlistToCollection ships as Wave 2 Server Action** (Phase 70 Plan 03, D-10) — new export at `src/app/actions/watches.ts:382`; UPDATE on existing watch row (NOT INSERT) because `editWatch` (watches.ts:496-650) deliberately skips `logActivity` + `findOverlapRecipients` + `logNotification`. T-70-01 IDOR mitigation = two-layer gate (Zod uuid + `watchDAL.getWatchById(user.id, watchId)`); T-70-02 idempotency = `priorRow.status === 'owned'` early-return without re-firing side-effects; T-70-03 = template-literal `Cannot move ${status} watch to collection` for sold/grail. 8-case unit suite green; build gate exit 0. Plan 05 wires `DupeBanner.onMoveToCollection → moveWishlistToCollection(dupeContext.existingWatchId)`.
- **Pitfall 3 resolved by omission, not type extension** (Phase 70 Plan 03) — CONTEXT D-10's `source: 'wishlist_move'` literal in `logActivity` metadata would not type-check: `WatchAddedMetadata` at activities.ts:23-27 is `{ brand, model, imageUrl }` only. Resolution = operator `console.warn('[Phase 70] moveWishlistToCollection: wishlist→collection', { watchId })` ABOVE the action's mutation block. Same telemetry intent at zero type-extension cost. Case 3 of the unit suite has a defensive `expect(logActivity).not.toHaveBeenCalledWith(..., expect.objectContaining({ source: 'wishlist_move' }))` to catch future regression.
- **Watch.pricePaid is `number | undefined` not nullable** (Phase 70 Plan 03 Rule 1 fix) — `src/lib/types.ts:60` declares `pricePaid?: number`. Plan body's `?? null` fallback pattern violated the static contract; build gate caught it. `?? undefined` is semantically equivalent inside `Partial<Watch>` because `mapDomainToRow` strips undefined keys before the DB UPDATE — prior DB value is preserved when caller omits. Pattern applies to any other `?: T` field on Watch when constructing update payloads.
- **FlowState final union — 7 variants, 6 removed (Phase 70 Plan 04 CLNP-05)** — `src/components/watch/flowTypes.ts` rewritten to D-01 final shape: `search-idle`, `extracting-url`, `extraction-failed` (+ new `mode: 'url' \| 'structured'` field for Phase 69 D-06 ExtractErrorCard parity), `confirming` (+ new `catalogId`, `pickedResult`, `dupeContext`, `pending` fields), `form-prefill`, `manual-entry`, `photos-pending`. Removed: `idle`, `extracting`, `verdict-ready`, `wishlist-rationale-open`, `submitting-wishlist`, `submitting-collection`. ROADMAP CLNP-05 listed `search-idle` + `search-results` + `structured-input` + `extracting-structured` as 4 separate orchestrator-level states; D-01 collapses those into 1 (`search-idle`) because SearchEntry (Phase 69) owns the result/structured/extracting sub-states internally — splitting them at the orchestrator would mirror SearchEntry's local state. **Phase 71 CLNP-02 static guard asserts against THIS shape, NOT the ROADMAP draft enumeration** (per CONTEXT.md §Phase 71 forward-coordination). Commit c8f0c38c.
- **DupeContext interface shipped (Phase 70 Plan 04)** — `export interface DupeContext { existingWatchId: string; existingStatus: 'owned' \| 'wishlist'; existingReference: string \| null }` at `src/components/watch/flowTypes.ts:49`. `existingReference: null` is legitimate (catalog rows without public ref) and tells DupeBanner (Plan 02) to hide its "View existing" `/w/[ref]` link per D-06. Consumed by Plan 02 DupeBanner + Plan 05 orchestrator.
- **D-02 transition map ships verbatim as a 19-line JSDoc block ABOVE FlowState** (Phase 70 Plan 04) — pattern-mapping decision per D-02; future readers see the state-machine at a glance without leaving the type file. Reads as `search-idle ──onPick (owned)──→ /w/[ref]   [DUPE-01]` style entries; one line per transition. Phase 71 CLNP-02 static guard treats this as a documentation reference, not an assertion target.
- **RailEntry.verdict re-typed to `unknown \| null` (was `VerdictBundle \| null`)** (Phase 70 Plan 04) — drops the stale legacy verdict-types import while preserving `RailEntry` shape for `RecentlyEvaluatedRail.tsx` through Phase 71 cleanup. Phase 71 deletes both fields + their consumer in a single sweep alongside the RecentlyEvaluatedRail disposition (CLNP-04). `RailEntry` + `PendingTarget` exports retained per CLNP-04 deferral.
- **JSDoc-prose grep-collision recurrence-3 mitigated proactively** (Phase 70 Plan 04) — initial RailEntry comment included the literal phrase "stale `VerdictBundle` import"; reworded to "stale legacy verdict-types import" so `grep -c "VerdictBundle" src/components/watch/flowTypes.ts` returns 0. Recurrence-3 of the pattern from `feedback_decision_coverage_gate_citations` family + Phase 69 Plan 04 lessons. No semantic change.
- **onSubmitStructured widened to 3-arg (result, catalogId, photoBlob?) across StructuredEntryPanel + SearchEntry** (Phase 70 Plan 06 — CR-01 upstream half) — closes VERIFICATION gap #1 half-A: the EXIF-cleaned Blob captured by `CatalogPhotoUploader` inside `StructuredEntryPanel` flowed into a write-only `const [, setPhotoBlob] = useState<Blob | null>(null)` and silently died. Plan 06 reads `photoBlob` from state, forwards it as `photoBlob ?? undefined` (third arg, `Blob | undefined` sentinel — `undefined` = absence, no-pick AND post-clear both surface as `undefined`) in both cache-hit + network-success branches of `handleFindSpecs`. SearchEntry stays an identity-stable pass-through (`onSubmitStructured={onSubmitStructured}` unchanged at line 345) — the TypeScript widen makes the contract enforcement explicit. AddWatchFlow's 2-arg `handleStructuredSubmit` signature still type-checks because optional third args are tolerable on the consumer side; gap plan 07 widens the consumer and calls `uploadCatalogSourcePhoto` before `addWatch` (mirrors `WatchForm.tsx:222-249`). 4 new regression tests in StructuredEntryPanel.test.tsx + 1 in SearchEntry.test.tsx; existing tests 8/10 of StructuredEntryPanel widened to assert the new arity. Commits `0db88d1c` (panel) + `03c88a5e` (search).
- **VERIFICATION gaps #2 (WR-01) + #3 (WR-02) fully close — ConfirmStep pending-gate + handleSearchPick toast.error fallback** (Phase 70 Plan 08) — Phase 70 gap closure trilogy COMPLETE. (a) WR-01: one-line gate at `AddWatchFlow.tsx:731` widens ConfirmStep `pending={state.pending}` to `pending={state.pending || state.dupeContext != null}` — when DupeBanner is mounted, the ConfirmStep primary CTA disables so the user is forced through one of the banner's explicit affordances (View existing / Move to Collection / Add another copy → clears dupeContext → CTA re-enables). DupeBanner's own `pending={state.pending}` prop intentionally unchanged (banner's buttons disable during the moveWishlistToCollection await, NOT just because mounted). (b) WR-02: refactored `handleSearchPick` (AddWatchFlow.tsx:155-247) adds an explicit `if (!dupeRow) { toast.error("Couldn't check your collection — try again"); return }` guard after each `resolveDupeContext` await in the owned (D-06 null-ref fallthrough) and wishlist branches — when the search projection pre-signals viewerState BUT the resolver returns null (transient `findViewerWatchByCatalogIdAction` failure), the orchestrator KNOWS a dupe exists; surfaces toast.error + stays on search-idle. The null-viewerState branch keeps silent-fallthrough by design (mirrors structured-input + URL-backup paths where viewerState is NOT pre-known). `resolveDupeContext` itself unchanged (null-on-failure semantic correct for unknown-dupe callers). Top-level `vi.mock('sonner', ...)` mock infrastructure added at AddWatchFlow.test.tsx for the new toast assertions (pre-existing handleConfirmPrimary `toast.error` calls had been hitting real sonner runtime in jsdom — harmless no-op, now hits mock). 7 new regression tests (3 WR-01 + 4 WR-02 including 2 boundary inverses: null-viewerState branch silently proceeds; owned-with-ref redirect fast-path bypasses resolver entirely). Existing 21 AddWatchFlow tests + gap-suite (6 files, 80 total) all stay green; `npm run build` exit 0. Forward signal: `gsd-verify-phase 70` re-verification expected to flip score 4/6 → 6/6, status `gaps_found` → `passed`. 12 visual UAT items (2 from this plan, 2 from plans 06+07, 8 pre-existing) deferred to bundled Phase 71 prod push per `feedback_mobile_ui_verify_on_prod`. Commits `84f5c496` (WR-01 + sonner mock + 3 tests) + `eb4da1f3` (WR-02 + 4 tests).
- **VERIFICATION gap #1 fully closes — CR-01 consumer + CR-02 movement + CR-02 imageUrl** (Phase 70 Plan 07) — `handleConfirmPrimary` payload now (a) OMITS movement entirely when `captured.catalogId` is set (catalog row + Phase 19.5 LLM-derived taste enrichment owns the truth; no synthetic `'auto'` default ever — pre-gap quartz/manual catalog rows persisted `movement='auto'` to the user's watches row, overriding catalog truth), (b) forwards `extracted.movement` verbatim only when no catalogId AND extracted volunteered it (URL-backup transient failure), (c) strips dead `imageUrl: captured.extracted.imageUrl` line entirely (Phase 60 dropped the column; `mapDomainToRow:94` silently drops it; dead-code obscured the cover-fallback chain), and (d) wires `uploadCatalogSourcePhoto(user.id, 'pending', captured.photoBlob)` BEFORE `addWatch` when `captured.photoBlob` is set; forwards `photoSourcePath` into the payload — mirrors `WatchForm.tsx:222-249` (dynamic imports, fire-and-forget on failure). FlowState.confirming variant gains optional `photoBlob?: Blob | null`; `handleStructuredSubmit` widened to 3-arg matching Plan 06's contract; all 5 confirming setState sites pass photoBlob explicitly (null for search-pick + URL-backup; the captured Blob for structured-submit). 7 new gap-plan-07 regression tests green in the describe block; existing 13 AddWatchFlow tests + CLNP-07 cache-hygiene test stay green; `npm run build` exit 0. JSDoc-prose grep-collision recurrence-3 preempted (CR-02 explanation comments reworded to avoid backticked literal patterns that the plan's done-criteria static greps target). Commits `53b22a34` (FlowState + handleStructuredSubmit + tests) + `7060799c` (handleConfirmPrimary payload + upload pipeline).

### Pending Todos

None.

### Blockers/Concerns

None.

## Deferred Items

Items acknowledged and deferred at milestone close on 2026-05-29 (v8.0):

| Category | Item | Status |
|----------|------|--------|
| debug_session | knowledge-base | unknown (empty/stale — pre-existing, not v8.0-related) |
| debug_session | mobile-title-above-fold | diagnosed (resolved by Phase 64-05 — pre-existing) |
| uat_gap | Phase 66 — 66-HUMAN-UAT.md | resolved (0 pending — false positive in audit-open scan) |
| verification_gap | Phase 66 — 66-VERIFICATION.md | human_needed (UAT walked + resolved separately; verifier never re-flipped status) |
| verification_gap | Phase 69 — 69-VERIFICATION.md | human_needed (UAT walked 2026-05-29 → 69-UAT.md captured SRCH-02 + SRCH-03; **promoted to v8.1 scope**) |
| quick_task | 260413-qp3-price-prominence-and-filter-collapse | missing |
| quick_task | 260421-rdb-fix-404-on-watch-detail-pages-for-watche | missing (related to ROUTE-01 captured in 70-UAT.md — **rolls into v8.1 scope**) |
| quick_task | 260421-srx-wrap-follower-following-counts-in-link-o | missing |
| quick_task | 260424-nk2-fix-phase-15-uat-bug-wywt-rail-and-overl | missing |
| quick_task | 260513-hvu-hotfix-search-watches-tab-returns-empty- | missing |
| quick_task | 260513-m31-fix-otherownersroster-count-label-always | missing |
| quick_task | 260519-08p-fix-next-js-image-aspect-ratio-console-w | missing |
| quick_task | 260519-d69-fix-4-collection-path-ui-issues-in-pathc | missing |
| quick_task | 260519-g4v-fu-02-fix-explore-brands-a-z-letter-anch | missing |
| quick_task | 260519-ga9-fu-01-expose-brand-era-genre-archetype-f | missing |
| seed | SEED-001-catalog-hierarchy-and-attributes | dormant |
| seed | SEED-002-hybrid-recommender | dormant |
| seed | SEED-003-onboarding-cold-start-flow | dormant |
| seed | SEED-004-v5-discovery-north-star | dormant (shipped — re-classify) |
| seed | SEED-005-v6-market-value | dormant (planted for post-v8.1) |
| seed | SEED-007-market-pricing-api-spike | dormant |
| seed | SEED-008-v5.1-explore-redesign | active (shipped — re-classify) |
| seed | SEED-010-v5.3-add-watch-redesign | shipped this milestone (v8.0 was built on this) — re-classify |
| seed | SEED-012-v6.0-social-interaction | active (shipped — re-classify) |
| seed | SEED-013-v7.0-watch-photos | dormant (shipped v7.0 — re-classify) |
| seed | SEED-014-cache-components-canonical-sweep | dormant |
| seed | SEED-015-inline-grid-engagement | dormant (shipped — Phase 63 — re-classify) |
| seed | SEED-016-watch-detail-redesign | dormant (shipped — Phases 64+65 — re-classify) |

**Total deferred:** 28 (2 debug, 1 false-positive UAT, 2 verification_gaps now in v8.1 scope, 10 quick-task backlog, 13 seeds).
**v8.1 polish scope (formal):** 6 defects — SRCH-01 (multi-token search), SRCH-02 (combobox keyboard), SRCH-03 (footer click no-op), ROUTE-01 (/w/[ref] 404), DUPE-04 (Saving... copy), MOB-01 (iOS input zoom). 3 phases: 72/73/74.
**Notes:** Quick-task backlog has rolled past v5.2, v6.0, v7.0, and now v8.0 closes — most were superseded by later phases. Seeds marked "shipped" should be promoted/closed by `/gsd-new-milestone` housekeeping or a one-off seeds audit.
| Phase 66 P01 | 4 | 3 tasks | 4 files |
| Phase 66 P02 | 10 | 3 tasks | 3 files |
| Phase 68 P01 | 429 | 2 tasks | 2 files |
| Phase 69 P01 | ~3min | 2 tasks | 3 files |
| Phase 69 P02 | 3min | 2 tasks | 4 files |
| Phase 69 P03 | 8m 5s | 3 tasks | 7 files |
| Phase 69 P5 | 8m | 1 tasks | 2 files |
| Phase 69 P06 | 4 | 2 tasks | 2 files |
| Phase 70 P01 | 17 | 4 tasks | 7 files |
| Phase 70 P02 | 5min | 2 tasks | 2 files |
| Phase 70 P03 | 4 | 2 tasks | 2 files |
| Phase Phase 70 P04 P04 | 3min | 1 tasks | 2 files |
| Phase 70 P05 | 35 | 3 tasks | 3 files |
| Phase 70 P06 | 5min | 2 tasks | 4 files |
| Phase 70 P07 | 9min | 2 tasks | 3 files |
| Phase 70 P08 | ~12min | 2 tasks | 2 files |
| Phase 72-search-composition-fixes P01 | 3min | 2 tasks | 2 files |
| Phase 72-search-composition-fixes P02 | 15min | 3 tasks | 2 files |
| Phase 73 P01 | 4min | 3 tasks | 2 files |
| Phase 74 P01 | 6min | 3 tasks | 3 files |
| Phase 74 P02 | 4min | 3 tasks | 6 files |

## Quick Tasks Completed

| Quick Task ID | Description | Commits | Date |
|---------------|-------------|---------|------|
| 260530-e55 | SRCH-03 followup: composite footer onClick closes combobox popup + mounts StructuredEntryPanel | 6070c5cc, 17d5bc0f | 2026-05-30 |

## Session Continuity

Last activity: 2026-05-30 — Phase 74 Plan 02 execution complete. MOB-01 closed structurally: src/app/globals.css gains a new @layer base block setting font-size 1rem on input/textarea/select (DOM-default 16px floor; specificity 0,0,1 — utilities still win; no !important); CommentCompose.tsx:60 + CommentItem.tsx:170 + SearchEntry.tsx:242 flip bare text-sm → text-base md:text-sm (mirrors shadcn primitives); 2 new fs-walking static guards added with `// @vitest-environment node` pragma on line 1: no-iOS-zoom-viewport.test.ts (7 tests, locks viewport export against maximumScale/userScalable/minimumScale + raw HTML meta forms) and no-text-sm-on-native-form-controls.test.ts (2 tests, scope-limited to comment/* + SearchEntry.tsx). Acceptance criteria all green; npm run build exit 0; font-medium guardrail intact (0 new introductions). JSDoc-prose grep-collision recurrence-4 preempted in D-12 guard SCOPE LIMIT comment (reworded `src/components/admin/*` → "the admin/ subtree" to clear the AC grep-returns-0 check).
Next action: /gsd-verify-phase 74 (expect MOB-01 + DUPE-04 automated checks pass; prod walk human_needed) → bundled v8.1 prod push (Phases 72 + 73 + 74 single deploy + single UAT walk per CONTEXT D-15 covering all 6 items: SRCH-01/02/03 + ROUTE-01 + DUPE-04 + MOB-01).

## Operator Next Steps

- /gsd-verify-phase 74 (expect DUPE-04 + MOB-01 automated checks pass; prod walk human_needed)
- Bundle prod push for Phase 72 SRCH-03 footer + Phase 73 ROUTE-01 + Phase 74 DUPE-04/MOB-01 — single deploy, single UAT walk per CONTEXT D-15 covering all 6 v8.1 items
- /gsd-complete-milestone v8.1 after prod UAT passes (Phase 74 is last phase of v8.1) — remember to archive .planning/phases/72-*, 73-*, 74-* dirs into .planning/milestones/v8.1-phases/ per `feedback_milestone_close_phase_dir_archival_miss` (or /gsd-new-milestone's phases.clear --confirm will DELETE the un-archived work)
- Per `project_phase_complete_999_1_misset` recurrence: after `gsd-sdk query phase.complete 74` (run during verify or close), hand-correct STATE.md `next_phase` + `progress` fields if they drift
