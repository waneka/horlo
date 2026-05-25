---
phase: 61
slug: photo-upload-carousel-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-25
---

# Phase 61 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `61-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + @testing-library/react |
| **Config file** | `vitest.config.ts` (jsdom environment, `tests/setup.tsx`) |
| **Quick run command** | `npx vitest run tests/actions/watchPhotos.test.ts` |
| **Full suite command** | `npm run build` (exit 0 is the authoritative gate) |
| **Estimated runtime** | ~30s quick · ~build time full |

> MEMORY `project_baseline_not_green_build_is_gate`: `npm run build` exit 0 is authoritative; ignore pre-existing tsc/test noise (incl. CommentGateLocked font-medium failure). Static fs-walking guards need `// @vitest-environment node` (MEMORY `project_vitest_static_node_env`).

---

## Sampling Rate

- **After every task commit:** Run `npm run build` (exit 0)
- **After every plan wave:** Run `npm run build && npx vitest run tests/actions/watchPhotos.test.ts tests/components/watch-photo-section.test.tsx`
- **Before `/gsd-verify-work`:** Full suite (build exit 0) must be green
- **Max feedback latency:** ~30 seconds (quick) / build time (full)

---

## Per-Task Verification Map

> Filled in concretely once plans assign task IDs. Requirement → behavior mapping below is the contract each task must satisfy.

| Req ID | Behavior | Test Type | Automated Command | File Exists |
|--------|----------|-----------|-------------------|-------------|
| PHOTO-02 | `addWatchPhotoAction` records photo, respects 10-cap, rejects cross-user | unit/integration | `npx vitest run tests/actions/watchPhotos.test.ts` | ❌ W0 |
| PHOTO-02 | Cap enforcement: batch > remaining slots → accept up to cap, surface rejection message (no silent drop) | unit (component) | `npx vitest run tests/components/photo-uploader.test.tsx` | ❌ W0 |
| PHOTO-03 | Carousel renders via `useEmblaCarousel`; arrows advance slides; position indicator updates | unit (component) | `npx vitest run tests/components/watch-photo-section.test.tsx` | ❌ W0 |
| PHOTO-05 | `reorderWatchPhotosAction`: ownership check, photo-set mismatch, happy path, revalidatePath | unit | `npx vitest run tests/actions/watchPhotos.test.ts` | ❌ W0 |
| PHOTO-06 | `deleteWatchPhotoAction`: ownership check, photo-not-found, happy path | unit | `npx vitest run tests/actions/watchPhotos.test.ts` | ❌ W0 |
| PHOTO-09 | `AddWatchFlow` transitions to photos step after watch row created + watchId available | unit (component) | `npx vitest run tests/components/add-watch-flow-photos.test.tsx` | ❌ W0 |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/actions/watchPhotos.test.ts` — PHOTO-02/05/06 server-action ownership + cap + error paths
- [ ] `tests/components/watch-photo-section.test.tsx` — PHOTO-03 carousel arrow/index behavior
- [ ] `tests/components/photo-uploader.test.tsx` — PHOTO-02 cap enforcement + batch-rejection message
- [ ] `tests/components/add-watch-flow-photos.test.tsx` — PHOTO-09 state-machine transition + skip path

---

## Manual-Only Verifications

> MEMORY `feedback_mobile_ui_verify_on_prod`: device/visual behavior is confirmed by the user on **prod** (push origin main → Vercel), not locally (local e2e skips on empty test DB). Bundle into one deploy, build-gate before push.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Carousel swipe on iOS Safari | PHOTO-03 | Touch gesture; jsdom cannot simulate native swipe | On prod, open `/w/[ref]` on iPhone, swipe between owner photos |
| Filmstrip drag-reorder on touch | PHOTO-05 | iOS touch-drag + `touchAction: 'manipulation'` gotcha | On prod, Edit mode, long-press-drag a thumbnail to first → cover updates across grids |
| OS photo picker (camera-or-library) | PHOTO-02 | Native OS picker, no forced `capture` | On prod mobile, tap +Add → picker offers camera + library |
| "Skip for now" friction / prominence | PHOTO-09 | Visual hierarchy + tap-target size judgment | On prod, run add-watch flow; confirm photos step is prominent, Skip is clearly secondary |
| Carousel index reset on revisit | PHOTO-03 | Router Cache stale-instance is prod-only (MEMORY `project_router_cache_stale_instance`) | On prod, navigate away + back to `/w/[ref]`; carousel/Edit state resets on interaction |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
