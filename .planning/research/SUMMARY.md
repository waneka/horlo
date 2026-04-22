# Research Summary — v3.0 Production Nav & Daily Wear Loop

**Project:** Horlo
**Milestone:** v3.0 — Production Nav & Daily Wear Loop
**Domain:** Production navigation overhaul + notifications + people-search + WYWT photo post flow, layered onto an existing Next.js 16 / Supabase / Drizzle / cacheComponents production app
**Researched:** 2026-04-21
**Confidence:** HIGH (architecture, codebase-derived patterns, storage RLS, iOS getUserMedia); MEDIUM (heic2any behavior, sonner version, bio-search tradeoffs)

---

## Executive Summary

v3.0 is a subsequent milestone on a production app, not greenfield work. The existing stack is locked: Next.js 16 App Router with `cacheComponents: true`, React 19, Supabase Auth + Postgres, Drizzle ORM, Tailwind 4, Zustand (filter-only). This milestone adds the production navigation frame, closes the social loop with notifications, and turns WYWT into a photo-first daily habit with three-tier privacy. Only two new npm packages are required (`sonner@^2.0.7` for toasts, `heic2any@^0.0.4` for iOS HEIC conversion). Everything else is implemented using APIs and patterns already in the stack.

The recommended build order is bottom-up by data dependency, not feature-by-feature: schema + storage migrations must land first (they unblock everything), followed by the visibility ripple across existing DAL functions (the highest-risk code change in the milestone), then notifications and nav in parallel, then the WYWT photo form, and finally people-search and the Explore stub. The phase ordering matters because the three-tier visibility change touches at least 8 existing DAL functions — if any are missed, private wears become visible to non-followers. This is the primary risk vector for the milestone, not the new features themselves.

Five architecture decisions are unresolved and must be answered before planning begins. The most consequential is the WYWT image upload pipeline direction (client → Storage directly vs. client → Server Action → Storage), which affects the security model, bandwidth, and the Next.js body size limit. The others concern bottom-nav data fetching, storage bucket topology, `worn_public` deprecation timing, and the wear detail navigation model. These are documented explicitly in the Open Architecture Decisions section and must be resolved in the requirements step before the roadmap is drafted.

---

## Open Architecture Decisions

**These 5 decisions must be resolved before the roadmapper runs. Each has a recommended answer but requires explicit user sign-off.**

---

**Decision 1: WYWT image upload pipeline direction**

- **Option A (recommended):** Client captures + processes image → client uploads directly to Supabase Storage using anon key → client passes storage path to Server Action → Server Action inserts `wear_events` row. EXIF stripping happens in-browser via canvas re-encode.
- **Option B:** Client sends raw file bytes in FormData to a Server Action → server strips EXIF (needs `sharp` or pure-JS) → server uploads to Storage via service-role client → server inserts row.
- **Consequences:** Option A avoids doubling bandwidth and sidesteps the Next.js 4MB body size limit, but requires correct client-side EXIF stripping (a security-sensitive operation). Option B is architecturally cleaner (no binary data on the client path, server validates everything) but doubles bandwidth and requires configuring `next.config.ts` body limit.

**Cross-link:** Pitfall E-4 (EXIF not stripped), Pitfall F-1 (Storage RLS is a separate system), Pitfall E-3 (client-only validation).

---

**Decision 2: Bottom nav `ownedWatches` data fetching**

- **Option A:** `BottomNav` calls `getWatchesByUser(user.id)` independently — duplicates the DB read already done in `Header`, but both run in parallel inside separate Suspense boundaries (no latency penalty, one extra DB query per render).
- **Option B (recommended):** Wrap `getWatchesByUser` with React `cache()` so `Header` and `BottomNav` share the same request-scoped result. Same pattern as `getTasteOverlapData` in `src/data/follows.ts` line 261.

**Cross-link:** Pitfall A-1 (viewer data outside Suspense).

---

**Decision 3: Storage bucket topology — single private bucket vs. split**

- **Option A (recommended):** Single private `wear-photos` bucket. Signed URLs for all wear photos. Simple; one RLS policy set; no bucket routing complexity in the upload path.
- **Option B:** Two buckets — `public-wear-photos` (public read) for `visibility = 'public'` wears, `private-wear-photos` (private) for `followers` and `private` wears. Avoids signed URL overhead for public-tier wears but doubles RLS surface area and complicates upload routing.

**Cross-link:** Pitfall F-1 (Storage RLS is separate from table RLS), Pitfall F-2 (signed URLs cached by Next.js).

---

**Decision 4: `worn_public` deprecation timing**

- **Option A (recommended):** Deprecate in v3.0. Backfill `visibility` from `worn_public` (`false` → `'private'`, `true` → `'public'`), then remove `wornPublic` reads from all DAL functions in Phase 12. Keep the column with a deprecation comment; remove in a future milestone.
- **Option B:** Keep `worn_public` as a master override that, if `false`, overrides all per-row `visibility` to effective-private. Preserves global toggle behavior but complicates the DAL (two parallel systems).

**Cross-link:** Pitfall G-6 (incorrect backfill — `false` must map to `'private'`, not `'followers'`), ARCHITECTURE.md `worn_public` migration strategy.

---

**Decision 5: Wear detail — modal overlay vs. dedicated route**

- **Option A:** `/wear/[wearEventId]` dedicated route. Clean URL, shareable, server-rendered. Signed URL generation is lazy (on page load).
- **Option B (likely recommended):** Modal overlay triggered by tapping a wear tile in the WYWT rail. No route change. Matches the "lightweight interactions" product principle. Signed URLs must be pre-generated for rail tiles at render time.
- **Consequences:** Affects whether Phase 15 includes a new route or a modal component. Also affects whether signed URLs are pre-generated for all rail tiles (Option B) or lazily on tap (Option A).

**Cross-link:** FEATURES.md differentiators (wear detail overlay), Pitfall F-2 (signed URL caching).

---

## Key Findings

### Recommended Stack

The existing stack requires no structural changes. Two packages are added: `sonner@^2.0.7` (13.9 kB gzipped; requires a thin client wrapper to use the project's custom ThemeProvider instead of `next-themes`; must mount outside Suspense boundaries) and `heic2any@^0.0.4` (~600 kB WASM; must be lazy-loaded via a dedicated Web Worker — standard dynamic imports are insufficient because webpack includes the import string at build time regardless of execution path).

All other features — Supabase Storage, `getUserMedia`, canvas EXIF stripping, `pg_trgm`, notifications schema, and the bottom nav — use existing stack capabilities. The critical non-obvious constraint is that `next/image` must not be used for wear photos: `next.config.ts` already has `images: { unoptimized: true }` and there is a confirmed Next.js 16 bug (#88873) where image optimization returns errors for signed Supabase Storage URLs.

**New packages:**
- `sonner@^2.0.7` — toast notifications; custom ThemeProvider wrapper required; mount outside Suspense
- `heic2any@^0.0.4` — iOS HEIC conversion; Web Worker lazy-load mandatory; 600 kB WASM

**Infrastructure additions (no npm):**
- `pg_trgm` Postgres extension — GIN indexes on `profiles.username` and `profiles.bio`; must be in a Drizzle migration, not a dashboard click
- Supabase Storage bucket `wear-photos` — private; per-user RLS on `storage.objects` (separate system from table RLS)
- `notifications` Drizzle table — partial index on `(userId) WHERE readAt IS NULL` for efficient unread count
- `wear_events` schema extension — `photo_url TEXT`, `note TEXT CHECK (length <= 200)`, `visibility wear_visibility NOT NULL DEFAULT 'public'`
- `wear_visibility` Postgres enum — `public`, `followers`, `private`

### Expected Features

**Must have (table stakes):**
- Sticky mobile bottom nav — always visible; 5 destinations; elevated center Wear CTA with iOS safe-area handling (`env(safe-area-inset-bottom)`, `viewport-fit=cover`)
- Desktop top nav — logo, Explore, persistent search, Wear CTA, +Add, notifications bell, profile dropdown
- Slim mobile top bar — logo, search icon, notifications icon, settings icon
- Stub `/explore` route — "coming soon" placeholder; nav must have no broken links
- Follow notification and watch-overlap notification — live types wired into existing Server Actions (fire-and-forget)
- Unread bell badge — server-rendered per-request; no WebSocket, no polling
- Notifications inbox with "Mark all read" — server-authoritative bulk UPDATE on `readAt IS NULL`
- `/search` with live debounced ILIKE people search — 2-character minimum enforced server-side
- WYWT multi-step modal (pick watch → photo/note/visibility)
- Per-wear visibility selector defaulting to Private — never default Public; always show the picker
- EXIF stripping before upload — canvas re-encode mandatory on ALL upload paths (camera AND file upload)
- Sonner toast on successful wear log

**Should have (differentiators):**
- Elevated center Wear CTA with cradle/notch visual treatment (CSS only)
- Wear CTA "done today" muted state
- Taste overlap % inline on people-search result rows
- Follow/unfollow inline from search results
- Stubbed UI templates for Price Drop and Trending notification types (render null for unknown types — no malformed cards)
- Edit-after-post: add a photo to an already-logged wear event
- Watch-overlap notifications grouped by watch at display time

**Defer to future milestone:**
- Wear detail overlay (scope depends on Decision 5; defer if route approach)
- Notification digest email (custom SMTP not configured)
- Full-text pg_trgm similarity scoring (ILIKE sufficient at current user count)
- Supabase Realtime / live bell updates (free tier limit; server-render + `router.refresh()` is correct)

**Anti-features to exclude:**
- Bottom nav hiding on scroll (utility app, not an infinite-scroll feed)
- Hamburger menu (retired by bottom nav)
- Likes, reactions, comments on wear photos
- `piexifjs` (canvas re-encode already strips EXIF; piexifjs is for selective preservation)
- `react-webcam`, `browser-image-compression`, `react-dropzone`, `sharp` (all unnecessary)

### Architecture Approach

v3.0 adds new client islands, server surfaces, DAL functions, and Server Actions on top of the existing architecture without changing any foundational patterns. The Server Component shell + Client Component island split is consistent throughout: `BottomNav` (Server) + `BottomNavClient` (Client), `/search` page (Server) + `SearchClient` (Client), `/notifications` page (Server) + `MarkAllReadButton` (Client). The `cacheComponents: true` constraint governs every new viewer-scoped component — all components that call `getCurrentUser()` or read cookies must live inside a `<Suspense>` boundary, and no `'use cache'` function may call `getCurrentUser()` internally (pass `viewerId` as an explicit argument instead).

**Major new components:**
1. `BottomNav` (Server) + `BottomNavClient` (Client) — nav shell; shares watched data with `Header` via `cache()`-wrapped DAL
2. `notifications` DAL + Server Actions — `getUnreadCount`, `getNotificationsPage`, `markAllRead`, `insertNotification`, `checkRecentOverlapNotification`; fire-and-forget wiring into `followUser` and `addWatch`
3. `SearchClient` + `searchProfiles` DAL — pg_trgm ILIKE with batched `isFollowing` lookup (no N+1)
4. `WywtPostDialog` (orchestrator) → `WatchPickerDialog` (step 1, extended with `onWatchSelected` prop) → `WywtPhotoForm` (step 2) → `CameraCapture`
5. Schema + Storage foundation — `wear_visibility` enum, `notifications` table, `wear_events` extensions, Storage bucket + RLS, pg_trgm GIN indexes

**Modified existing files (key ones):**
- `src/app/layout.tsx` — add `<BottomNav>` in Suspense, `pb-16 md:pb-0` on `<main>`, `<Toaster />` outside Suspense
- `src/data/wearEvents.ts` — visibility ripple in `getPublicWearEventsForViewer` and `getWearRailForViewer`
- `src/data/activities.ts` — `getFeedForUser` watch_worn gate via `visibility` in activity metadata
- `src/app/u/[username]/layout.tsx` — replace `getAllWearEventsByUser` with viewer-aware function for worn tab
- `src/app/actions/follows.ts` and `watches.ts` — add `insertNotification` fire-and-forget
- `src/components/home/WatchPickerDialog.tsx` — add `onWatchSelected?: (watch: Watch) => void` prop

### Critical Pitfalls

**CRITICAL — these will cause data loss, privacy leaks, or broken builds if missed:**

1. **Storage RLS is a separate system from table RLS (Pitfall F-1)** — `wear_events` table RLS does not protect image files in Supabase Storage. Write explicit `storage.objects` policies for the `wear-photos` bucket. Test: access a private wear photo URL directly in incognito — confirm 403. Pairs with Decision 3.

2. **Three-tier visibility ripple must audit all wear-reading DAL functions before migration (Pitfall G-1 + G-4)** — At least 8 existing DAL functions read `wear_events`. Missing one means followers-only wears are visible publicly. Every function must add the per-row visibility check AND the `profile_public` guard.

3. **`'use cache'` without `viewerId` as explicit argument leaks data across users (Pitfall B-6)** — Grep gate before shipping: `grep -r "use cache" src/ | xargs grep -l "getCurrentUser\|cookies()"` must return empty.

4. **Bottom nav outside Suspense breaks cacheComponents builds (Pitfall A-1)** — Wrap in its own `<Suspense fallback={<BottomNavSkeleton />}>`. Never place as a bare `<body>` child.

5. **EXIF not stripped from all upload paths (Pitfall E-4)** — ALL paths (camera AND file upload) must go through canvas re-encode before upload. `heic2any` output must never be uploaded directly. Verify with `exiftool` on a stored file.

6. **Backfill maps `worn_public = false` to wrong visibility tier (Pitfall G-6)** — `false` → `'private'` (not `'followers'`). Post-migration: `SELECT visibility, COUNT(*) FROM wear_events GROUP BY visibility` — confirm `'followers'` count is 0.

7. **Notification generation inside primary Server Action transaction (Pitfall B-2)** — Always fire-and-forget: `generateNotification(...).catch(err => console.error(err))`. Notification failure must never roll back a follow or watch-add.

---

## Implications for Roadmap

**Phase ordering is dictated by hard data dependencies.** The three-tier visibility ripple must complete before the WYWT photo form ships. Schema must exist before any DAL work. Notifications DAL must exist before the nav bell is wired.

### Phase 11: Schema + Storage Foundation

**Rationale:** Hard prerequisite for everything. Nothing else can start until this phase deploys.
**Delivers:** All schema migrations to prod; Storage bucket with RLS; pg_trgm + GIN indexes; backfill of `worn_public → visibility`.
**Avoids:** Pitfall G-6, F-1, F-4, C-1.
**Research flag:** None — schema fully specified in ARCHITECTURE.md and STACK.md.

### Phase 12: Visibility Ripple in DAL

**Rationale:** Highest-risk phase in the milestone. Modifies existing working privacy code. Write integration tests first.
**Delivers:** All 8+ wear-reading DAL functions updated to three-tier check. `markAsWorn` updated to pass `visibility` in activity metadata. Profile worn tab DAL call updated.
**Avoids:** Pitfall G-1, G-3, G-4, G-5, G-7, F-1.
**Research flag:** None — codebase is source of truth; ARCHITECTURE.md has audited each function.

### Phase 13: Notifications Foundation

**Rationale:** Can parallelize with Phase 12 after Phase 11. Write path is independent of visibility ripple.
**Delivers:** Notifications DAL + Server Actions. `insertNotification` wired into `followUser` and `addWatch` (fire-and-forget). `/notifications` inbox + `MarkAllReadButton`. `NotificationBell` leaf Server Component. Unread count in Header and BottomNav.
**Avoids:** Pitfall B-1 (isolate as leaf Suspense), B-2 (fire-and-forget), B-3 (dedup UNIQUE constraint), B-4 (recipient-only RLS), B-6 (`'use cache'` safety), B-9 (self-notification DB CHECK).
**Research flag:** None — pattern mirrors existing `logActivity()` in v2.0.

### Phase 14: Bottom Nav + Navigation Shell

**Rationale:** Depends on Phase 13 for unread count DAL. Establishes `WywtPostDialog` orchestration shell that Phase 15 needs.
**Delivers:** `BottomNav` + `BottomNavClient` + `BottomNavSkeleton`. Root layout updated. `WywtPostDialog` outer shell. `WatchPickerDialog` extended with `onWatchSelected`. Desktop top nav and slim mobile top bar (Header surgery). `MobileNav` retired. iOS safe-area handling.
**Avoids:** Pitfall A-1, A-2, A-3, A-4, I-2 (WatchPickerDialog must not be forked).
**Research flag:** None — follows existing Header + HeaderNav Server/Client split.

### Phase 15: WYWT Photo Post Flow

**Rationale:** Depends on Phase 11 (schema), Phase 12 (visibility ripple in place), Phase 14 (dialog orchestration). Decision 1 (upload pipeline) and Decision 5 (wear detail) must be resolved before this phase begins.
**Delivers:** `WywtPhotoForm` + `CameraCapture`. `logWearWithPhoto` Server Action. Image utilities (HEIC convert, canvas resize, EXIF strip). Storage upload wired. `<Toaster />` in root layout. Edit-after-post.
**Avoids:** Pitfall D-1 (iOS gesture context), D-2 (MediaStream cleanup), D-4 (image too large), E-1 (heic2any eager load), E-2 (sideways images), E-3 (client-only validation), E-4 (EXIF all paths), F-2 (signed URLs cached), F-3 (orphan storage files on delete), F-4 (folder enforcement), H-1 (Toaster inside Suspense), H-2 (toast in Server Action), H-3 (theme mismatch).
**Research flag:** YES — EXIF orientation handling: PITFALLS.md recommends `exifr` (30KB) for reading EXIF orientation before canvas draw; STACK.md says no new library needed. Resolve before building the image pipeline.

### Phase 16: People Search

**Rationale:** Depends only on Phase 11 for pg_trgm. Independent of visibility ripple. Can parallelize with Phases 14–15 after Phase 11.
**Delivers:** `searchProfiles` DAL (batched `isFollowing`). `searchPeople` Server Action. `SearchClient` + `SearchResultsList` + `SearchResultRow`. `/search` page with 4 tabs.
**Avoids:** Pitfall C-1 (pg_trgm from Phase 11 migration), C-2 (server-side 2-char minimum), C-3 (private profiles in search), C-4 (N+1 following-status).
**Research flag:** None — pg_trgm and search DAL fully specified.

### Phase 17: Explore Stub

**Rationale:** No data dependencies. One file. Can be done any time after Phase 14.
**Delivers:** `src/app/explore/page.tsx` — "coming soon" Server Component. BottomNav Explore tab no longer 404s.
**Research flag:** None.

### Phase Ordering Rationale

- Phase 11 is a hard prerequisite for all other phases — schema must exist before any DAL can reference new columns/tables
- Phase 12 must precede Phase 15 — WYWT photo form writes `visibility` values; the ripple must be in place so those values are read correctly
- Phase 13 can parallelize with Phase 12 — no data dependency between notifications and the visibility ripple
- Phase 14 must follow Phase 13 (unread count DAL) but can start its non-bell work in parallel
- Phase 15 must follow Phase 12 and Phase 14
- Phase 16 can parallelize with Phases 14–15 after Phase 11
- Phase 17 floats

**Privacy-first UAT rule (Pitfall I-1):** Each privacy-touching phase (12, 13, 15) must include a cross-user UAT checklist before shipping. Do not defer UAT to milestone end — the v2.0 retrospective found a privacy bug at Phase 10 that would have been caught at Phase 6 if per-phase UAT existed.

### Research Flags

**Needs research during Phase 15 planning:**
- EXIF orientation auto-correction: does `createImageBitmap` correct EXIF orientation on iOS Safari 15+, or is `exifr` required? STACK.md and PITFALLS.md contradict each other on this.

**Standard patterns (skip research):**
- Phase 11 — Drizzle + Supabase migration patterns documented in deploy runbook
- Phase 12 — codebase is source of truth; ARCHITECTURE.md has the full DAL audit
- Phase 13 — fire-and-forget pattern identical to existing `logActivity()`
- Phase 14 — follows existing Header + HeaderNav Server/Client split exactly
- Phase 16 — pg_trgm setup fully documented in STACK.md
- Phase 17 — one file, no decisions

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Two new packages only; existing stack validated in production. WASM size and Web Worker pattern verified. Sonner version MEDIUM (GitHub only, no Context7). |
| Features | HIGH | Strong comparable app evidence. Table stakes and anti-features well-documented. Followers-tier risk documented with clear mitigation. |
| Architecture | HIGH | Codebase is the primary source. Build order is unambiguous. 5 open decisions documented with recommendations. |
| Pitfalls | HIGH | 30+ pitfalls catalogued. All CRITICAL/HIGH pitfalls derived from existing codebase patterns and v2.0 retrospective. |

**Overall confidence:** HIGH — the 5 open architecture decisions are the remaining uncertainty. Once resolved, planning can proceed with high confidence.

### Gaps to Address

- **EXIF orientation handling:** Resolve before Phase 15 planning — `createImageBitmap` vs. `exifr` for orientation correction.
- **Taste overlap % in search:** ARCHITECTURE.md notes the join may be too slow at query time. Phase 16 plan should decide: compute inline or stub with follower-count ranking.
- **Decision 5 (wear detail):** Phase 15 scope depends on modal vs. route. Must be resolved in requirements.

---

## Sources

### Primary (HIGH confidence)

- Existing codebase — `src/app/layout.tsx`, `src/data/wearEvents.ts`, `src/data/activities.ts`, `src/db/schema.ts`, `src/app/actions/wearEvents.ts`, `src/components/home/WatchPickerDialog.tsx`, `src/proxy.ts`
- `.planning/PROJECT.md` — milestone requirements, established architecture decisions
- Supabase Storage docs — RLS policies, signed URLs, bucket creation
- MDN: getUserMedia — iOS Safari quirks (HIGH confidence)
- Next.js 16 issue #88873 — `next/image` bug with Supabase Storage signed URLs (confirmed open)

### Secondary (MEDIUM confidence)

- heic2any Web Worker lazy-load pattern (DEV Community)
- sonner GitHub releases v2.0.7
- Supabase pg_trgm extension docs
- Bottom nav UX patterns (AppMySite 2025, phone-simulator.com 2026)
- Notification schema patterns (DEV Community)

### Tertiary (LOW confidence)

- Bio search UX tradeoffs — 4-character minimum for bio matches is inferred from product brief + UX consensus; no specific source

---
*Research completed: 2026-04-21*
*Ready for roadmap: YES — pending resolution of 5 Open Architecture Decisions above*
