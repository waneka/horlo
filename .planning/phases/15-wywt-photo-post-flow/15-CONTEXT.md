# Phase 15: WYWT Photo Post Flow - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 15 ships the first-class wear-post flow for Horlo v3.0. It delivers:

- **Two-step wear-post modal** — Step 1 reuses the existing `WatchPickerDialog` (with a new `onWatchSelected` callback prop); Step 2 is a new photo + note + visibility form built as a dedicated `WywtPostDialog` wrapper.
- **Photo capture + upload pipeline** — inline `getUserMedia` camera path with a custom SVG wrist-framing overlay, file-picker upload path with `heic2any` in a Web Worker, EXIF stripping + 1080px resize via canvas re-encode on **both** paths, and client-direct upload to the `wear-photos` Supabase Storage bucket.
- **Three-tier visibility selector** — segmented-control UI with Private / Followers / Public, default = Public.
- **Duplicate-day preflight** — Step 1 picker disables watches already worn today; Server Action still defense-in-depth checks the unique constraint.
- **New Server Action `logWearWithPhoto`** — companion to the existing `markAsWorn`; accepts client-generated `wearEventId` + storage path; validates the Storage object exists before inserting the `wear_events` row.
- **New route `/wear/[wearEventId]`** — Server Component detail page with mobile-first full-bleed image hero + metadata stack below; DAL applies three-tier visibility gate and returns a uniform 404 for missing-or-private.
- **Sonner `<Toaster />`** — mounted in the root layout using a custom wrapper bound to the existing custom `ThemeProvider` (NOT the `npx shadcn add sonner` next-themes-coupled scaffold).
- **Call-site routing** — the new photo flow is opened from `NavWearButton` (desktop top nav + mobile bottom nav Wear CTA) and the `WywtRail` self-placeholder tile. Profile `LogTodaysWearButton` stays on the single-tap quick-log path unchanged.

**Out of scope (reaffirmed):**
- Edit-after-post / add-photo-to-existing-wear — WYWT-FUT-01
- Live AR wrist-pose overlay (auto-position the watch hint in viewfinder) — WYWT-FUT-02
- Delete wear event action — WYWT-FUT-03
- Likes / reactions / comments on wear photos — PROJECT.md out of scope (no engagement mechanics)
- Multi-photo carousel per wear event — out of scope (one wrist shot per wear preserves the rail/data-model simplicity)
- Confirmation dialog before submit — out of scope (friction anti-pattern per product brief)
- Share-link / copy-URL affordance on `/wear/[id]` — not in this phase
- `wear` notification type (click-through to `/wear/[id]` from notification bell) — Phase 13 did not introduce a wear-type notification; feed/search wiring to `/wear/[id]` is a future concern (route ships as durable URL regardless)

</domain>

<decisions>
## Implementation Decisions

### Orchestration refactor (WYWT-01, WYWT-02)

- **D-01:** Introduce a new **`WywtPostDialog` wrapper** that owns step state (`'picker' | 'compose'`) and the composed form fields (photo blob, note, visibility, watch selection, client-generated `wearEventId`). Step 1 renders the existing `WatchPickerDialog`; Step 2 renders the new compose form.
- **D-02:** `WatchPickerDialog` gains an **optional `onWatchSelected?: (watchId: string) => void` prop**. When provided, the picker emits the selection upward and **skips the internal `markAsWorn` call**. When absent, existing single-tap behavior (direct `markAsWorn` on submit) is preserved byte-for-byte. Backwards-compatible contract; no behavior change for current callers.
- **D-03:** **Picker preflight prop** `wornTodayIds?: ReadonlySet<string>` (or equivalent). Watches in this set render visually disabled (e.g., `opacity-50` + "Worn today" micro-label + `aria-disabled="true"`) and cannot be selected. Parent fetches today's wear events when opening the dialog. See D-11 for the duplicate-day rationale.
- **D-04:** **Call-site routing:**
  - `NavWearButton` (desktop top nav + mobile bottom nav Wear CTA) → opens `WywtPostDialog` (photo flow)
  - `WywtRail` self-placeholder tile → opens `WywtPostDialog` (photo flow)
  - Profile `LogTodaysWearButton` → **unchanged**, stays on the existing `WatchPickerDialog` single-tap `markAsWorn` path
  - `WywtRail` non-self tile tap → **unchanged**, keeps opening the existing Reels-style `WywtOverlay` (Phase 10 pattern preserved per WYWT-18)
- **D-05:** Step 2 header shows a **compact watch card** (thumbnail image + brand/model) with a text **"Change"** link on the right (accent color, underlined) that returns the dialog to Step 1. Form state (photo blob, note, visibility) is preserved across back-and-forth; only the watch selection resets on Change. (Preservation is minor: user swapping watches likely wants to keep their note/visibility intent; swap of watch is the adjustment.)

### Step 2 form UX (WYWT-03, WYWT-04, WYWT-05, WYWT-06, WYWT-07, WYWT-08)

- **D-06:** **Photo section before capture** = dashed/dotted rectangular "Add a photo" zone. Inside: two side-by-side buttons — "Take wrist shot" (camera icon) and "Upload photo" (image icon). Both CTAs visible simultaneously. Tapping Camera **expands the zone inline** into the `<video>` preview (no sub-dialog, no route change). Tapping Upload launches the native file picker. Both are optional — submitting with no photo is valid (WYWT-03).
- **D-07:** **Photo section after capture** = preview fills the zone at full width; top-right absolute-positioned **X button** removes the photo and returns the section to the chooser state. A text link below the preview reads **"Retake"** for the camera path or **"Choose another"** for the upload path — exact labels match the capture source.
- **D-08:** **Camera overlay geometry** (WYWT-04, Pitfall D-5 relative units). Build as **inline SVG** with `viewBox` + percentage-based coordinates so it scales exactly with the `<video>` element across all viewport widths. Shapes (nothing else):
  1. Two thin horizontal lines spanning full width = arm (one at ~38% vertical, one at ~62%)
  2. Two concentric circles centered between the arm lines = watch bezel (outer) + face (inner)
  3. Hour + minute hands inside the inner circle set to **10:10** (hour hand toward 10, minute hand toward 2)
  4. Small crown at 3 o'clock position on the outer circle
  Explicitly **no** hour markers, **no** lugs, **no** strap, **no** edge decoration. Stroke weight, color, and dashed-vs-solid treatment is Claude's Discretion (recommend thin semi-transparent white ~1.5px solid). Reference image at `assets/overlay-reference.png` (captured during this discussion; user clarified the concentric-circle simplification verbally).
- **D-09:** **Upload path HEIC conversion** (WYWT-05). `heic2any` must be **lazy-loaded in a Web Worker** so the WASM bundle does not bloat any page's initial JS. Only load when a file with HEIC mime-type is selected. Non-HEIC uploads skip the worker entirely and go straight to the EXIF-strip canvas step.
- **D-10:** **EXIF stripping + 1080px resize** (WYWT-06) applies on **BOTH paths** (camera + upload) via canvas re-encode (`canvas.toBlob('image/jpeg', 0.85)`). Single shared helper (`src/lib/exif/strip.ts` or similar) consumed by both capture paths. Target output < 500KB JPEG (Pitfall D-4). Orientation correction handled per researcher's finding on the open research flag (`createImageBitmap` vs `exifr` — Phase 15 researcher resolves).
- **D-11:** **Note textarea** (WYWT-07) is plain text, 200-char hard cap (matches DB `CHECK (length(note) <= 200)` from Phase 11). Bottom-right counter reads `0/200` in muted foreground; turns destructive red at 200. Extra characters are blocked at input (maxLength attribute). No markdown, no emoji keyboard coupling.
- **D-12:** **Visibility selector** (WYWT-08) is a **three-button segmented control** (iOS-style inline toggle group). Buttons labeled "Private" / "Followers" / "Public". **Default = Public** (locked per STATE.md D-1 — user explicit override of researcher's "Private default" recommendation). Active button highlighted in accent color. A **sub-label row below the segmented control** dynamically describes the active choice:
  - Private → "Only you"
  - Followers → "Followers — people who follow you"
  - Public → "Anyone on Horlo"
  The sub-label is mandatory — it addresses the "Followers tier introduction risk" flagged in FEATURES.md (the Followers tier is new in v3.0; users must see the description to understand it is narrower than Public).

### Duplicate-day handling (WYWT-12)

- **D-13:** **Preflight disable in Step 1** (Recommended per discussion). The `WywtPostDialog` wrapper fetches today's wear events via an existing DAL call (e.g., `getWearEventsForUserOnDate(userId, today)` or equivalent — planner decides exact DAL shape) when the dialog opens. The resulting watch-id set is passed to `WatchPickerDialog` via the D-03 `wornTodayIds` prop. Already-worn watches render disabled; the user cannot advance to Step 2 with a same-day duplicate. Prevents the unique-constraint conflict entirely on the happy path.
- **D-14:** **Server-side defense-in-depth.** The new `logWearWithPhoto` Server Action still checks the `(userId, watchId, wornDate)` unique constraint before insert — if a race or a hand-crafted request slips through, returns `{ success: false, error: 'Already logged this watch today' }`. The Step 2 UI surfaces this inline via the existing `role="alert"` pattern and bounces the user back to Step 1 with their selection cleared. The photo blob is retained so the user can pick a different watch without re-capturing. (Pitfall F-3 orphan cleanup applies if photo was already uploaded — best-effort delete in the action.)

### Upload pipeline + post-submit UX (WYWT-15, WYWT-16)

- **D-15:** **Client-direct upload** (STATE D1, WYWT-15, Pitfall E-3). Pipeline:
  1. Client generates `wearEventId = crypto.randomUUID()` before opening Step 2.
  2. On submit: client processes photo via EXIF-strip + resize canvas (D-10) → uploads the resulting JPEG blob to `wear-photos/{userId}/{wearEventId}.jpg` using the user's session-scoped Supabase client.
  3. Client then calls `logWearWithPhoto({ wearEventId, watchId, note, visibility, hasPhoto: boolean })` Server Action.
  4. Server Action validates the Storage object exists at the expected path when `hasPhoto === true` (defense-in-depth against a malicious client asserting a photo that isn't there).
  5. Server Action inserts `wear_events` row with the same `id = wearEventId` and `photo_url = <path>` (path only, not URL — signed URLs minted at read time per Phase 11 D-02 and Pitfall F-2).
  6. `logActivity('watch_worn', ...)` fired after successful insert with `visibility` in metadata (Phase 12 D-10 contract).
- **D-16:** **No-photo path** skips the Storage step entirely. Client submits `hasPhoto: false`; Server Action inserts row with `photo_url = NULL`.
- **D-17:** **Orphan handling** — if the `wear_events` row insert fails after a successful Storage upload, the Server Action issues a **best-effort Storage delete** (try/catch, log-only on failure). Accepts Phase 11 D-04 MVP orphan-risk posture — scheduled cleanup cron is deferred beyond v3.0.
- **D-18:** **Upload UX during submission** — the Step 2 submit button shows an inline spinner and label text "Logging…" while disabled (matches existing `WatchPickerDialog` pattern); Cancel/Change buttons also disabled. Modal stays open until both the Storage upload and Server Action complete. No progress bar, no optimistic close.
- **D-19:** **Post-submit** — close the dialog and fire a **Sonner toast "Wear logged"**. User stays on their current page (no forced navigation). Toast does **not** include a "View" action in v3.0 — keeps the interaction lightweight and matches "no-engagement-mechanics" framing. Relevant scroll positions / rail data should invalidate via `revalidatePath('/')` or equivalent so the new wear appears on next render.

### `/wear/[wearEventId]` detail route (WYWT-17, WYWT-18)

- **D-20:** **Layout** — **mobile-first full-bleed image hero** with metadata stacked below:
  - Hero: image fills viewport width, aspect ratio 4:5 (portrait) or 1:1 (planner chooses — 4:5 matches typical wrist-shot composition better; 1:1 is cleaner).
  - Below: collector avatar + username (links to `/u/[username]`), watch card (brand + model + watch thumbnail, optionally links to `/watch/[id]` when the viewer can see it), note text (if present), relative time (use existing `formatRelativeTime` from Phase 10 feed).
  - Desktop: image caps at ~600px in a centered column, same metadata stack below.
- **D-21:** **No-photo fallback hero** — when `photo_url` is null, the hero slot renders the watch's `imageUrl` from the `watches` table instead. If the watch also has no `imageUrl`, render a muted placeholder with the brand/model typography centered. Maintains visual rhythm for every wear detail page.
- **D-22:** **Gating** — new DAL function `getWearEventByIdForViewer(viewerId: string | null, wearEventId: string)` that mirrors the three-tier predicate from Phase 12's `getWearEventsForViewer`:
  - Owner bypass (G-5) — viewer = actor always sees
  - Non-owner — joins `profile_settings.profile_public = true` (G-4 outer gate) + three-tier visibility check (public; followers requires viewer-follows-actor row)
  - Returns null if any gate fails OR the row doesn't exist
  Page calls `notFound()` (Next `notFound()` helper) uniformly when DAL returns null — **no response differential** between "missing row" and "private row" (prevents existence leak, mirrors v2.0 Phase 8 notes-IDOR mitigation and Phase 10 WYWT D-decision on identical error strings).
- **D-23:** **Signed URL minting** — the detail-page DAL (or the Server Component using it) mints a **per-request signed URL** for `photo_url` using Supabase Storage's `createSignedUrl()`. **Pitfall F-2** enforced: this minting must NOT live inside any `'use cache'`-wrapped function (signed URLs are time-bounded and user-scoped; caching them across requests or users is a security and freshness bug). Signed URL TTL is Claude's Discretion — suggest ~60 minutes; the URL is consumed immediately for the `<img>` tag. Since `next.config.ts` has `images.unoptimized: true`, the signed URL passes through to the browser unmodified (the `next/image` optimizer does not try to refetch it via a proxy domain).
- **D-24:** **Entry points** (WYWT-18 reaffirmed):
  - `WywtRail` tile tap (non-self, within the rail's 48-hour window) → continues to open the existing `WywtOverlay` (Phase 10 pattern preserved)
  - `/wear/[wearEventId]` is the durable URL for external-entry references (future notification click-throughs, feed activity-row taps, search results, shared links)
  - This phase does not wire any notification or feed tap to `/wear/[id]` — the route ships as a durable destination; wiring is a future concern

### Sonner toaster mount (WYWT-19)

- **D-25:** **Toaster mounted in root layout** (`src/app/layout.tsx`). Must be **outside the dynamic Suspense boundary** (Pitfall H-1) — Sonner is a pure client-rendered portal and does not need viewer-scoped data. Safe to sit at the bare `<body>` level or just below it, above the existing Suspense wrapper around Header + children.
- **D-26:** **Custom wrapper** (`src/components/ui/ThemedToaster.tsx` or similar) — a thin Client Component that imports Horlo's custom `ThemeProvider` context to pass the current theme (`light | dark | system`) to Sonner's `theme` prop. Do **NOT** use the `npx shadcn add sonner` scaffold, which couples to `next-themes` (Pitfall H-3 — Horlo has a custom ThemeProvider because `cacheComponents: true` forbids `cookies()` in the layout body; `next-themes` reads cookies directly and breaks the inline theme script contract).
- **D-27:** **Toast fired from client components only** (Pitfall H-2). `WywtPostDialog` invokes `toast.success('Wear logged')` from its Client Component submit handler after the Server Action returns success. Server Actions themselves never call `toast` directly.
- **D-28:** **Package** — verify `sonner` is installed in `package.json`; if absent, `npm i sonner` is the first planner task. (Observation: neither `Toaster` mount nor `sonner` import appears anywhere in `src/` currently — it's genuinely a new dependency for v3.0.)

### Claude's Discretion

- Exact file locations for new components (`src/components/wywt/` vs `src/components/home/` vs new `src/components/wear/` folder — planner decides based on existing convention density).
- SVG overlay stroke weight (recommend 1.5px), color (recommend `rgba(255,255,255,0.85)` for visibility on dark viewfinder), dashed vs solid (recommend solid — cleaner than dashed at small stroke weights).
- Exact hero aspect ratio (4:5 vs 1:1).
- Signed URL TTL for `/wear/[id]` photo hero (recommend 60 minutes).
- Web Worker boundary for `heic2any` (likely `src/lib/exif/heic-worker.ts` plus a dynamic import gate).
- Whether `getWearEventByIdForViewer` extracts a shared visibility predicate helper from the Phase 12 `getWearEventsForViewer` implementation or inlines it.
- `revalidatePath` / `revalidateTag` scope on successful wear log (home rail, profile worn tab, /).
- Segmented-control icon set (recommend lucide `Lock` / `Users` / `Globe2`).
- Whether the watch card in Step 2 header links to `/watch/[id]` or is display-only (recommend display-only to keep the step focused).
- Post-capture "Remove X" vs "Retake" button styling (both needed per D-07).

### Folded Todos
- None — `gsd-tools todo match-phase 15` returned 0 matches.

### Open research flag (passed to gsd-phase-researcher, not user-facing)
- **STATE.md todo**: "Resolve EXIF orientation research flag before Phase 15 planning: does `createImageBitmap` correct EXIF orientation on iOS Safari 15+, or is `exifr` required?" — researcher must answer this before D-10 can be implemented reliably.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & roadmap
- `.planning/PROJECT.md` — v3.0 milestone framing, Core Value, constraints, Key Decisions (two-layer privacy, Cache Components + inline theme script pattern, viewer-aware DAL precedent)
- `.planning/REQUIREMENTS.md` — WYWT-01..08, WYWT-12, WYWT-15..19 acceptance criteria; WYWT-FUT-01..03 deferral fences; out-of-scope rationale
- `.planning/ROADMAP.md` §"Phase 15: WYWT Photo Post Flow" — goal, success criteria, pitfalls list (D-1..5, E-1..4, F-2..4, H-1..3)
- `.planning/STATE.md` §"Key Decisions (v3.0)" — D-1 default Public visibility (user override), D1 client-direct upload, D3 single private bucket + signed URLs, D5 hybrid wear detail nav; §"Todos" — EXIF orientation research flag

### Prior phase context (locked decisions that must be honored)
- `.planning/phases/11-schema-storage-foundation/11-CONTEXT.md` — **D-01..D-03** (storage.objects three-tier RLS + folder enforcement `{userId}/{wearEventId}.jpg`), **D-02** (signed URLs for ALL reads including public; never cache inside `'use cache'`), **D-04** (orphan cleanup = best-effort in Server Action; scheduled cron deferred), **D-09** (notification_type enum already includes `price_drop`/`trending_collector` stubs — irrelevant here but cross-phase awareness)
- `.planning/phases/12-visibility-ripple-in-dal/12-CONTEXT.md` — **D-03** (`getWearEventsForViewer` three-tier pattern — mirror for new `getWearEventByIdForViewer`), **D-04** (no signed URL work in Phase 12 — Phase 15 owns the minting), **D-09** (feed reads `metadata->>'visibility'` — logActivity write-path contract), **D-10** (`WatchWornMetadata` requires `visibility` — Phase 15's new Server Action must pass the user-chosen visibility through)
- `.planning/phases/13-notifications-foundation/13-CONTEXT.md` — **D-27** (`logActivity` fire-and-forget pattern — same shape for any notification Phase 15 introduces; none currently planned)
- `.planning/phases/14-nav-shell-explore-stub/14-CONTEXT.md` — **D-23** (`NotificationBell` `viewerId` prop + two-layer discipline — no change), **Reusable Assets → `NavWearButton`** (existing lazy-loaded picker trigger — Phase 15 swaps the lazy target), **Integration Points → `<main>` pb-[calc(4rem+env(safe-area-inset-bottom))]** (modal must not be clipped beneath bottom nav on iOS)

### v3.0 Research (read before planning)
- `.planning/research/SUMMARY.md` §"Phase 15" / §"Open Architecture Decisions" for any 4/5/6 that touch WYWT
- `.planning/research/FEATURES.md` §"Feature 4: WYWT Photo Post Flow" — chooser-first pattern, EXIF privacy rationale, Followers tier introduction risk
- `.planning/research/PITFALLS.md` §D (WYWT Photo Capture — D-1..D-5: iOS gesture, MediaStream cleanup, permission UX, canvas resize, relative-unit overlay), §E (HEIC worker, EXIF orientation, server-side storage validation, EXIF strip on all paths), §F (Storage RLS, signed-URL-no-cache, orphan files, folder enforcement), §H (Toaster placement, Server Action toast boundary, custom ThemeProvider wrapper)
- `.planning/research/ARCHITECTURE.md` — WYWT schema, Storage bucket + RLS patterns, client-direct upload decision
- `.planning/research/STACK.md` — `heic2any`, Sonner, Supabase Storage client API

### Codebase Anchors (read to confirm current state before editing)
- `src/components/home/WatchPickerDialog.tsx` — extend with `onWatchSelected` + `wornTodayIds` props (NO fork per Pitfall I-2)
- `src/components/layout/NavWearButton.tsx` — swap lazy import to `WywtPostDialog` for the photo flow; preserve `appearance` prop
- `src/components/home/WywtRail.tsx` + `src/components/home/WywtTile.tsx` — self-placeholder route to `WywtPostDialog`; non-self tiles keep opening `WywtOverlay`
- `src/components/home/WywtOverlay.tsx` + `src/components/home/WywtSlide.tsx` — **unchanged** (Reels pattern preserved per WYWT-18)
- `src/components/profile/LogTodaysWearButton.tsx` — **unchanged** (stays on `markAsWorn` quick-log)
- `src/app/actions/wearEvents.ts` — existing `markAsWorn` untouched; add new `logWearWithPhoto` Server Action alongside
- `src/data/wearEvents.ts` — `getWearEventsForViewer` pattern to mirror for new `getWearEventByIdForViewer`; `logWearEvent` pattern for the photo-bearing insert
- `src/data/activities.ts` — `logActivity` signature with `WatchWornMetadata` (Phase 12 D-10 — pass `visibility` from picker)
- `src/lib/wearVisibility.ts` — `WearVisibility` type
- `src/lib/wywtTypes.ts` — existing tile shape; may need `visibility` plumbing consistency
- `src/db/schema.ts` — `wear_events` already has `photoUrl`, `note`, `visibility` (Phase 11 shipped); no schema changes in Phase 15
- `src/app/layout.tsx` — add `<ThemedToaster />` outside the Suspense wrapper (Pitfall H-1); viewport already has `viewport-fit=cover` from Phase 14
- `next.config.ts` — `images.unoptimized: true` already set (allows signed URLs to pass to `<img>` unmodified per D-23)
- Supabase Storage bucket `wear-photos` — already provisioned in Phase 11 with three-tier SELECT RLS + folder-enforcement INSERT/UPDATE/DELETE RLS

### Existing integration test patterns
- `tests/integration/home-privacy.test.ts` — two-layer privacy harness, conditional activation on `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`. Use this shape for Phase 15 visibility matrix on `/wear/[id]` (owner / follower / stranger × public / followers / private).
- `tests/integration/isolation.test.ts` — cross-user RLS enforcement pattern (Storage RLS also testable via direct Supabase client)

### Production Runbook & memory
- `docs/deploy-db-setup.md` — prod migration flow (no Phase 15 schema migrations expected; Phase 11 already shipped the columns)
- Memory: `DB migration rules` — drizzle-kit push is LOCAL ONLY; prod uses `supabase db push --linked`
- Memory: `Supabase SECDEF grants` — `REVOKE FROM PUBLIC` alone does not block anon; relevant if Phase 15 introduces any new SECURITY DEFINER helpers (none currently planned — DAL-only reads)

### External docs
- Next.js 16 `cacheComponents` docs (`node_modules/next/dist/docs/...`) — signed URLs must not cross a `'use cache'` boundary
- MDN `navigator.mediaDevices.getUserMedia` — iOS Safari gesture-context discipline
- `heic2any` README — Web Worker / WASM loading pattern
- Sonner docs — `<Toaster>` placement, `theme` prop, custom theme providers (avoid next-themes coupling)
- Supabase Storage client — `.upload()`, `.createSignedUrl()`, RLS interaction

### Assets
- `.planning/phases/15-wywt-photo-post-flow/assets/overlay-reference.png` — user-provided geometry sketch for the camera overlay. **User verbal clarification during discussion**: the horizontal lines are **arm edges**, the watch is **two concentric circles** (bezel + face), hands at **10:10**, a **small crown at 3 o'clock**, and **nothing else** (no hour markers, no lugs, no strap). The screenshot's edge-lug marks are NOT to be recreated — stop at the concentric circles + crown + hands.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`WatchPickerDialog`** (`src/components/home/WatchPickerDialog.tsx`) — 189-line Client Component with search, list, submit state machine. Extend with `onWatchSelected?: (watchId: string) => void` + `wornTodayIds?: ReadonlySet<string>` props. Preserves single-tap quick-log behavior when `onWatchSelected` is absent. Do NOT fork (Pitfall I-2).
- **`NavWearButton`** (`src/components/layout/NavWearButton.tsx`) — Client Component with `React.lazy` + render-gated `{open && ...}` pattern for the picker. Phase 15 adjusts the lazy import target (picker → `WywtPostDialog`) but preserves the `appearance` prop (header / bottom-nav) and ownership of trigger state.
- **`WywtOverlay`** + **`WywtSlide`** (`src/components/home/`) — Reels-style overlay for non-self rail tiles. Untouched in Phase 15 per WYWT-18.
- **`getWearEventsForViewer`** (`src/data/wearEvents.ts:102-162`) — canonical three-tier predicate. Mirror the same self-bypass (G-5) + outer `profile_public` gate (G-4) + follow-relationship check (G-3) shape for the new `getWearEventByIdForViewer`.
- **`logWearEvent`** (`src/data/wearEvents.ts:9-19`) — existing insert with `onConflictDoNothing` + optional `note`. Phase 15 may need a widened variant that also accepts `photoUrl` and `visibility` (or extend in place — planner's call).
- **`logActivity`** (`src/data/activities.ts`) — fire-and-forget pattern; `WatchWornMetadata` already accepts `visibility` from Phase 12. New Server Action passes `visibility` through unchanged.
- **`markAsWorn`** (`src/app/actions/wearEvents.ts:13-54`) — existing quick-log Server Action. Phase 15 keeps it unchanged and adds a new `logWearWithPhoto` alongside it — not a refactor.
- **`formatRelativeTime`** (Phase 10 feed helper) — reuse on `/wear/[id]` for the timestamp line (matches Phase 13 D-13 precedent).
- **`Avatar` / `Card` / `Button` / `Input` / `Dialog` / `Textarea`** — shadcn/base-ui primitives in `src/components/ui/` for the Step 2 form composition.
- **`getCurrentUser`** (`src/lib/auth`) — both the new Server Action and the `/wear/[id]` Server Component call this for viewer identity.

### Established Patterns
- **Two-layer privacy** (v2.0 + Phase 11 + Phase 12) — applies to `/wear/[id]`: RLS on `wear_events` + `storage.objects` (Phase 11 DB layer) AND DAL WHERE predicate in `getWearEventByIdForViewer` (new). Either layer breaking alone is still caught.
- **Viewer-aware DAL split** (quick-260421-rdb + Phase 12) — owner-only functions (like `logWearEvent`) stay scoped; viewer-aware functions (`getWearEventByIdForViewer`) take `viewerId` as explicit argument and apply three-tier gating.
- **Uniform-404-on-privacy** (v2.0 Phase 8 notes-IDOR; Phase 10 WYWT `getWearEventById`) — missing row and private row return identical error response; no existence leak.
- **`'use cache'` + `viewerId` argument discipline** — Signed URLs for `/wear/[id]` photo hero must NEVER live inside a cached function (Pitfall F-2). DAL returns the raw path; Server Component mints the signed URL inline per request.
- **Fire-and-forget `logActivity`** after successful primary insert (never before; failure never rolls back the wear).
- **Lazy dialog loading** (`React.lazy` + render-gated `{open && ...}`) — repeat for `WywtPostDialog`; keeps the nav bundle lean.
- **`ActionResult<T>` discriminated union** — new `logWearWithPhoto` returns this shape; WywtPostDialog surfaces errors via `role="alert"` banner like `PreferencesClient` (DEBT-01 / MR-01 precedent).
- **`crypto.randomUUID()`** — already used for watch IDs (`src/lib/utils.ts` `generateId`); reuse for client-side `wearEventId` generation.

### Integration Points
- **Root layout** (`src/app/layout.tsx`) — mount `<ThemedToaster />` (new) outside the dynamic Suspense wrapper (Pitfall H-1). viewport-fit=cover already present (Phase 14 D-07).
- **`NavWearButton.tsx`** — swap lazy import from `WatchPickerDialog` to `WywtPostDialog` (WywtPostDialog internally renders WatchPickerDialog for Step 1).
- **`WywtRail.tsx` / `WywtTile.tsx`** — self-placeholder tile tap routes to `WywtPostDialog` (was `WatchPickerDialog` direct); non-self tile tap unchanged.
- **`WatchPickerDialog.tsx`** — add `onWatchSelected` + `wornTodayIds` props; preserve existing `markAsWorn` behavior when `onWatchSelected` is absent.
- **`src/app/actions/wearEvents.ts`** — add new `logWearWithPhoto` Server Action alongside existing `markAsWorn` (existing unchanged).
- **`src/data/wearEvents.ts`** — add `getWearEventByIdForViewer`; optionally extend `logWearEvent` signature or add a sibling `logWearEventWithPhoto` insert helper.
- **New files (expected):**
  - `src/components/wywt/WywtPostDialog.tsx` — orchestrator wrapper (Client Component)
  - `src/components/wywt/ComposeStep.tsx` — Step 2 form (Client Component)
  - `src/components/wywt/CameraCaptureView.tsx` — getUserMedia + canvas capture + SVG overlay (Client Component)
  - `src/components/wywt/PhotoUploader.tsx` — file input + HEIC worker delegation (Client Component)
  - `src/components/wywt/WristOverlaySvg.tsx` — inline SVG per D-08 (pure presentational)
  - `src/components/wywt/VisibilitySegmentedControl.tsx` — per D-12 (Client Component)
  - `src/lib/exif/strip.ts` — shared canvas resize + EXIF strip helper
  - `src/lib/exif/heic-worker.ts` — Web Worker entry for heic2any (bundler may need config for the worker)
  - `src/lib/storage/wearPhotos.ts` — client-direct upload helper (wraps Supabase Storage client with the `{userId}/{wearEventId}.jpg` path convention)
  - `src/app/wear/[wearEventId]/page.tsx` — detail route Server Component
  - `src/components/wear/WearDetailHero.tsx` + `WearDetailMetadata.tsx` — detail page composition (Server or Client as appropriate)
  - `src/components/ui/ThemedToaster.tsx` — Sonner wrapper bound to custom ThemeProvider
- **Bottom-nav clearance** — `<main>` already has `pb-[calc(4rem+env(safe-area-inset-bottom))]` from Phase 14; verify `/wear/[id]` inherits this from the shared layout.

</code_context>

<specifics>
## Specific Ideas

- **Overlay SVG geometry (D-08)** — final shape list:
  - Container aspect matches `<video>` display; use `preserveAspectRatio="xMidYMid meet"`.
  - Two horizontal strokes at ~38% and ~62% vertical (relative viewBox units) spanning full width = arm.
  - Outer circle: center at 50%/50%, radius ~22% of min(width,height); inner circle: same center, radius ~17%.
  - Hour hand: short line from center toward the "10" position (angle -60° from top); minute hand: longer line toward "2" (angle +60° from top).
  - Crown: small rectangle or rounded-cap line at the outer-circle 3 o'clock edge (right side), extending 2-3% outward.
  - Nothing else — no hour markers, no lugs, no strap edges, no bracelet pattern. (User-clarified during discussion on 2026-04-24.)
  - Stroke recommendation: 1.5px solid, `rgba(255,255,255,0.85)` so it reads on any viewfinder content. Planner can adjust.

- **Client-generated `wearEventId`** — generating the id on the client (before upload) lets the Storage path be known before the Server Action is called, which is the reason we can validate the object exists server-side (Pitfall E-3). If the id were server-generated, the client would have to upload to a temp path and then rename post-insert — complicates cleanup and makes the path convention less clean.

- **No-engagement-mechanics posture extends to the detail page** — `/wear/[id]` explicitly does NOT include like/comment/share/save buttons in this phase. Page is pure visual surfacing: image + watch + collector + note + time. Matches PROJECT.md Out-of-Scope ("No engagement mechanics") and keeps the data model simple.

- **The toast toast does not include a "View" action** in v3.0. Rationale: the user just composed the post; navigating them to see it again is the "heavy social post" pattern we're explicitly avoiding. If users later ask for it, revisit — but not as a default in this phase.

- **Preflight DAL query shape (D-13)** — the simplest path is a new narrow helper like `getWornTodayIdsForUser(userId: string, today: string): Promise<ReadonlySet<string>>` selecting `watchId` from `wear_events` where `userId = $1 AND wornDate = $2`. Returns a Set. The alternative — computing from an already-fetched full wear-event list — is possible if another DAL call on the page can donate the data, but a dedicated narrow DAL is cleaner for the picker contract.

- **Sonner install** — `sonner` is not yet a dependency. The first executor task in the phase plan should be `npm i sonner` before any component imports it. (Not a schema migration; trivially reversible.)

- **EXIF orientation research flag resolution is blocking** — researcher must answer this before the planner can specify the canvas-draw order in D-10 (draw-then-autoOrient vs pre-rotate-then-draw). Ship the researcher's finding in `15-RESEARCH.md` §EXIF.

- **Device testing guidance (dev exposure)** — `getUserMedia` on iOS Safari requires HTTPS. `localhost` is exempt but only resolves on the host machine. For real-device testing during development, the fastest paths are: `npx ngrok http 3000` (free tier, rotating URL) or `cloudflared tunnel --url http://localhost:3000` (free, stable URL with Cloudflare account). Both produce an HTTPS URL the user can open on their iPhone to exercise camera permissions and the full flow. Add this note to the phase plan's UAT instructions. Avoid `mkcert` + LAN IP routes unless the user specifically wants a persistent local rig — the setup tax outweighs the benefit for a short UAT cycle.

- **Integration test matrix for `/wear/[id]`** — mirror the Phase 12 privacy-first UAT rule:
  - 3 visibility tiers × 3 viewer relations (owner / follower / stranger) = 9 cells
  - Each cell asserts either a visible response OR a uniform 404
  - Activates only when `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` present (same gate as existing integration suite)

- **Signed URL and `<img>` interaction** — `images.unoptimized: true` is already set in `next.config.ts`; that means we can set `<img src={signedUrl} />` (native HTML `img`) directly without `next/image`'s remotePatterns check tripping on the Supabase signed-URL domain. If the planner wants to use `next/image` instead, they must add the Supabase storage domain to `remotePatterns` AND verify the signed URL's query string survives the next/image optimization loop (it generally does NOT — next/image strips query params on cached optimized variants, which breaks signed-URL auth). Native `<img>` is the safer call.

</specifics>

<deferred>
## Deferred Ideas

- **Photo edit-after-post** (add a photo to an existing wear event) — **WYWT-FUT-01**. Requires a new `updateWearEvent` Server Action + UI affordance on the wear detail view or profile worn tab. Out of scope for v3.0.
- **Live wrist-pose AR overlay** (auto-position the watch hint in viewfinder using MediaPipe or equivalent) — **WYWT-FUT-02**. Major new infra; the static SVG overlay is the MVP.
- **Delete wear event action** — **WYWT-FUT-03**. Belongs in a future settings/UX polish phase.
- **Likes / reactions / comments / carousels** — PROJECT.md permanent out-of-scope; not deferred, explicitly rejected.
- **Confirmation dialog before submit** — friction anti-pattern per product brief; explicitly rejected.
- **`wear` notification type** (with click-through to `/wear/[id]`) — Phase 13 did not introduce this type. If a future phase adds wear-notifications, the click-through target is already a durable URL.
- **Feed activity-row tap → `/wear/[id]`** — Phase 10 feed watch-worn rows don't currently link to a wear detail; Phase 15 ships the URL but does not update feed-row link targets. Small follow-up when the route proves out.
- **Search-result tap → `/wear/[id]`** — Phase 16 (People Search) wires search; if it shows wear snippets as results, they can link to `/wear/[id]`. Phase 15 just ensures the URL exists.
- **Signed URL cache invalidation** — TTL-based signed URLs don't need explicit invalidation in v3.0; revisit if the rail or worn tab surface heavy concurrent traffic and per-render minting becomes a bottleneck.
- **Scheduled orphan-storage cleanup cron** — Phase 11 D-04 accepted best-effort orphan cleanup in the Server Action; scheduled cleanup deferred until storage volume grows.
- **Share-link / copy-URL affordance on `/wear/[id]`** — useful if users start sharing wears externally. Not in Phase 15.
- **Multi-device logout invalidating in-flight uploads** — signed-URL uploads from a session that's been logged out will fail server-side RLS; UX for surfacing this gracefully is not a Phase 15 concern (default `ActionResult` error path handles it).
- **Compress-on-camera via `MediaRecorder` stream constraints** — the current canvas re-encode pipeline handles resize + EXIF strip in a single place. If mobile upload times become an issue, revisit stream constraints before switching pipelines.
- **First-use tooltip on Followers tier** — FEATURES.md called this out as a mitigation for the Followers tier introduction risk; the sub-label copy (D-12) addresses the risk for v3.0. Revisit if user research shows confusion persists.

### Reviewed Todos (not folded)
- None — `gsd-tools todo match-phase 15` returned 0 matches.

</deferred>

---

*Phase: 15-wywt-photo-post-flow*
*Context gathered: 2026-04-24*
