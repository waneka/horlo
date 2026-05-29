---
gsd_state_version: 1.0
milestone: v8.0
milestone_name: Add-Watch Redesign
status: executing
last_updated: "2026-05-29T05:32:34.844Z"
last_activity: 2026-05-29
progress:
  total_phases: 4
  completed_phases: 3
  total_plans: 12
  completed_plans: 11
  percent: 92
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-28 — v8.0 Add-Watch Redesign STARTED)

**Core value:** A collector can evaluate any watch against their collection and get a meaningful, preference-aware answer about whether it adds something or just duplicates what they already own.
**Current focus:** Phase 69 — SearchEntry + StructuredEntryPanel + Cache Hygiene

## Current Position

Phase: 69 (SearchEntry + StructuredEntryPanel + Cache Hygiene) — EXECUTING
Plan: 6 of 6
Status: Ready to execute
Last activity: 2026-05-29
Resume file: None

## Performance Metrics

- v7.0: 7 phases (59-65), 29 plans, 4 days, 244 commits
- 34/34 v7.0 requirements shipped (ROUTE 6, PHOTO 9, WPIC 6, GRID 5, PAGE 4, FOLL 4)
- src/ +5,057 / −628 LOC across 65 files; tests/ +3,982 / −502 LOC across 33 files
- Phase 65 prod UAT: 9 pass / 1 skip / 0 issues
- Blockers encountered: 0
- v6.0 (prior): 8 phases (53-58 + 56A + 57.1), 37 plans, 3 days; 34/34 reqs shipped

## Accumulated Context

### Key Decisions

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

### Pending Todos

None.

### Blockers/Concerns

None. Phase 60 COMPLETE — all 4 plans, verification passed (10/10 must-haves), prod migration applied + verified.

## Deferred Items

Items acknowledged and deferred at milestone close on 2026-05-28 (v7.0):

| Category | Item | Status |
|----------|------|--------|
| debug_session | knowledge-base | unknown (empty/stale) |
| debug_session | mobile-title-above-fold | diagnosed (resolved by Phase 64-05) |
| uat_gap | Phase 59 — 59-HUMAN-UAT.md | passed (false-positive — 0 pending) |
| uat_gap | Phase 62 — 62-UAT.md | resolved (false-positive — 0 pending) |
| verification_gap | Phase 61 — 61-VERIFICATION.md | human_needed (false-positive — phase prod-verified 2026-05-26, see project_phase_61_complete memory) |
| quick_task | 260413-qp3-price-prominence-and-filter-collapse | missing |
| quick_task | 260421-rdb-fix-404-on-watch-detail-pages-for-watche | missing |
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
| seed | SEED-005-v6-market-value | dormant (planted for future post-v8) |
| seed | SEED-007-market-pricing-api-spike | dormant |
| seed | SEED-008-v5.1-explore-redesign | active (shipped — re-classify) |
| seed | SEED-010-v5.3-add-watch-redesign | dormant (planted for v8.0) |
| seed | SEED-012-v6.0-social-interaction | active (shipped — re-classify) |
| seed | SEED-013-v7.0-watch-photos | dormant (shipped this milestone — re-classify) |
| seed | SEED-014-cache-components-canonical-sweep | dormant |
| seed | SEED-015-inline-grid-engagement | dormant (shipped — Phase 63 — re-classify) |
| seed | SEED-016-watch-detail-redesign | dormant (shipped — Phases 64+65 — re-classify) |

**Total deferred:** 28 (2 debug, 3 false-positive UAT/verification, 10 quick-task backlog, 13 seeds).
**Notes:** Quick-task backlog has rolled past v5.2, v6.0, and now v7.0 closes — most were superseded by later phases. Seeds marked "shipped" should be promoted/closed by `/gsd-new-milestone` housekeeping or a one-off seeds audit.
| Phase 66 P01 | 4 | 3 tasks | 4 files |
| Phase 66 P02 | 10 | 3 tasks | 3 files |
| Phase 68 P01 | 429 | 2 tasks | 2 files |
| Phase 69 P01 | ~3min | 2 tasks | 3 files |
| Phase 69 P02 | 3min | 2 tasks | 4 files |
| Phase 69 P03 | 8m 5s | 3 tasks | 7 files |
| Phase 69 P5 | 8m | 1 tasks | 2 files |

## Session Continuity

Last activity: 2026-05-28 — Roadmap for v8.0 created. Phases 66-71 defined; all 39 requirements mapped (SRCH-17..26 → Phase 69; EXTR-01..04, EXTR-08 → Phase 66; EXTR-05..07 → Phase 69; CONF-01..10 → Phase 68; CONF-11, DUPE-01 DAL, DUPE-03 DAL → Phase 67; DUPE-01 UI, DUPE-02, DUPE-03 UI, CLNP-05, CLNP-06 → Phase 70; CLNP-01..04 → Phase 71; CLNP-07 → Phase 69). Parallelization: 66+67 in parallel, then 68+69 in parallel, then 70, then 71.
Next action: `/gsd-plan-phase 66` (or run 66+67 in parallel)
