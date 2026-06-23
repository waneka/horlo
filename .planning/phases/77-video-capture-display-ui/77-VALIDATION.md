---
phase: 77
slug: video-capture-display-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-23
---

# Phase 77 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source of truth: `77-RESEARCH.md` §"Validation Architecture" (lines 602–722).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3 (`vitest.config.ts` at repo root; jsdom env for components, node env for fs-walking guards) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/hooks/useMediaCapability.test.ts tests/unit/videoCapture.test.ts tests/unit/posterExtraction.test.ts` |
| **Full suite command** | `npm run test` (== `vitest run`) |
| **Estimated runtime** | ~25s quick / ~90s full |

---

## Sampling Rate

- **After every task commit:** Run quick command (capability + capture + poster — the units under heaviest churn during execution)
- **After every plan wave:** Run `npm run test` (full Vitest suite, includes static prebuild guards)
- **Before `/gsd-verify-work`:** Full suite + `npm run build` (build is the authoritative gate per durable memory `project_baseline_not_green_build_is_gate`)
- **Max feedback latency:** 30 seconds (quick command)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 77-XX-cleanup-spike | TBD | 1 | — | T-77-spike-route | Unauthenticated `/spike-mr-capture` removed from prod | structural | `! ls src/app/spike-mr-capture 2>/dev/null` | n/a | ⬜ pending |
| 77-XX-dal-wr02 | TBD | 1 | WR-02 | — | DAL readers include `mediaType`, `mediaPath`, `posterPath` in SELECT | unit | `npx vitest run tests/unit/dalMediaColumns.test.ts` | ❌ W0 | ⬜ pending |
| 77-XX-types | TBD | 1 | VID-06 | — | `MediaState` discriminated union: `{ kind:'none'\|'photo'\|'video' }`; co-existing photo+video unconstructable | unit (TS) | `npx tsc --noEmit` + `npx vitest run tests/unit/mediaState.test.ts` | ❌ W0 | ⬜ pending |
| 77-XX-capability-hook | TBD | 2 | VID-01, VID-04 | — | `useMediaCapability()` returns `supportsVideoCapture=true` only when MR + getUserMedia + mp4/webm supported | unit | `npx vitest run tests/hooks/useMediaCapability.test.ts` | ❌ W0 | ⬜ pending |
| 77-XX-compose-3btn | TBD | 2 | VID-01 | T-15-01 | ComposeStep renders 3 buttons when `supportsVideoCapture=true`, 2 when false (no disabled state) | unit | `npx vitest run tests/components/wywt/ComposeStep.video.test.tsx` | ❌ W0 | ⬜ pending |
| 77-XX-capture-view | TBD | 2 | VID-02, VID-03 | T-15-01 | `VideoCaptureView` consumes stream-as-prop (no `getUserMedia` inside); `cameraOpeningRef` re-entrance guard | unit | `npx vitest run tests/components/wywt/VideoCaptureView.test.tsx` | ❌ W0 | ⬜ pending |
| 77-XX-timer-3s | TBD | 2 | VID-02 | — | `MediaRecorder.stop()` fires at exactly 3000ms; cancel before 3000ms stops + emits no blob | unit | `npx vitest run tests/unit/videoCapture.test.ts` | ❌ W0 | ⬜ pending |
| 77-XX-poster-extract | TBD | 2 | VID-05 | — | `extractPosterBlob` sets `video.currentTime = duration * 0.75` then `canvas.toBlob('image/jpeg', 0.85)` | unit | `npx vitest run tests/unit/posterExtraction.test.ts` | ❌ W0 | ⬜ pending |
| 77-XX-wearcard-video | TBD | 3 | VID-13 | — | `WearCard` renders video branch when `mediaType='video'`; renders `VideoPlayBadge` overlay | unit | `npx vitest run tests/components/wear/WearCard.video.test.tsx` | ❌ W0 | ⬜ pending |
| 77-XX-wywttile-video | TBD | 3 | VID-13, VID-14-icon | — | `WywtTile` renders `<VideoPlayBadge />` when `mediaType='video'`; no badge when `'photo'` | unit | `npx vitest run tests/components/home/WywtTile.video.test.tsx` | ❌ W0 | ⬜ pending |
| 77-XX-video-client | TBD | 3 | VID-14 | — | `<video autoplay muted loop playsInline>` on detail + stories lane; `onError` swaps to poster + "Video unavailable" label | unit | `npx vitest run tests/components/wear/WearVideoClient.test.tsx` | ❌ W0 | ⬜ pending |
| 77-XX-tap-toggle | TBD | 3 | VID-14 (D-06) | — | Tapping `<video>` toggles `.pause()` / `.play()`; no native `controls` attribute | unit | `npx vitest run tests/components/wear/WearVideoClient.test.tsx -t "tap toggles play/pause"` | ❌ W0 | ⬜ pending |
| 77-XX-vid15-regression | TBD | 3 | VID-15 | — | `WearCard` rendered without `mediaType` produces byte-identical DOM as pre-Phase-77 photo path | regression | `npx vitest run tests/components/wear/WearCard.test.tsx -t "VID-15"` | ❌ W0 (extend existing) | ⬜ pending |
| 77-XX-vid15-photo-client | TBD | 3 | VID-15 | — | `WearPhotoClient.tsx` unchanged; existing tests still pass | regression | `npx vitest run tests/components/wear/` | ✅ existing | ⬜ pending |
| 77-XX-submit-pipeline | TBD | 3 | VID-01, VID-06 | T-76-{idor,size} | ComposeStep submit calls `logWearWithVideo` (never `logWearWithPhoto`) when `MediaState.kind==='video'`; upload→upload→action ordering preserved; compensating cleanup on action reject | integration | `npx vitest run tests/components/wywt/ComposeStep.submit.video.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

> Plan IDs (`TBD`) populate after `gsd-planner` completes. The orchestrator (or executor) updates `Plan` and `Task ID` columns once `77-XX-PLAN.md` files are written.

---

## Wave 0 Requirements

Test files that do NOT yet exist on disk — planner MUST seed empty stubs (or RED tests under TDD) in Wave 0 so Wave 1+ implementations have a real assertion to flip green:

- [ ] `tests/hooks/useMediaCapability.test.ts` — capability probe (VID-01, VID-04)
- [ ] `tests/unit/videoCapture.test.ts` — `MediaRecorder.start/stop` timer + cancel guard (VID-02, VID-03)
- [ ] `tests/unit/posterExtraction.test.ts` — canvas seek + `toBlob('image/jpeg', 0.85)` (VID-05)
- [ ] `tests/unit/mediaState.test.ts` — discriminated union narrowing (VID-06)
- [ ] `tests/unit/dalMediaColumns.test.ts` — WR-02 column inclusion across 5 DAL readers
- [ ] `tests/components/wywt/VideoCaptureView.test.tsx` — render + discard + iOS gesture guard (VID-02, VID-03)
- [ ] `tests/components/wywt/ComposeStep.video.test.tsx` — 3-button chooser + capability hide (VID-01)
- [ ] `tests/components/wywt/ComposeStep.submit.video.test.tsx` — submit pipeline integration (VID-01, VID-06)
- [ ] `tests/components/wear/WearVideoClient.test.tsx` — autoplay attrs + error fallback (VID-14)
- [ ] `tests/components/wear/WearCard.video.test.tsx` — video branch (VID-13) + VID-15 regression
- [ ] `tests/components/home/WywtTile.video.test.tsx` — `VideoPlayBadge` overlay (VID-13)

**No framework install needed.** Vitest, @testing-library/react, jsdom are already in use (confirmed via `package.json` scripts: `test`, `test:watch`, `test:e2e`).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| iOS 26.6 Safari live `getUserMedia` + 3s record + `playsInline` inline playback (no fullscreen takeover) | VID-02, VID-04, VID-14 | Real camera permission + iOS WebKit codec path not faithfully simulated in jsdom; covered by Spike 001 empirically, must re-verify on the actual production build | After prod deploy: open `/wywt` on iPhone Safari → tap "Record video" → grant camera → tap "Record 3s" → confirm 3s auto-stop → confirm inline `<video>` preview plays muted-looped without fullscreen → submit → confirm `/wear/{id}` shows autoplay-muted-loop video without fullscreen takeover |
| Tile poster + `VideoPlayBadge` overlay visual weight across rail / feed / profile grid | VID-13, VID-14 (icon sizing D-14) | Pixel-level icon scaling per surface size is a perceptual check, not a numeric assertion | After prod deploy: visit home rail, feed, and a profile grid that has a video wear → confirm `<Play>` icon visually centered, backdrop visible on bright + dark posters, weight uniform across surfaces |
| Progress-ring sweep over 3.0s (D-09) | VID-02 | CSS animation timing visual — automated test asserts code path, not perceived smoothness | After prod deploy: tap Record 3s on iPhone Safari → confirm ring fills clockwise over ~3s with no janks |
| Stories lane: video loops until user swipes (D-07, no auto-advance on `onEnded`) | VID-14 | Embla swipe + video loop interaction is multi-frame; automated test only asserts code absence of `onEnded` handler | After prod deploy: open `/wears/{username}` with a video post → confirm video keeps looping; lane does NOT advance to the next slide on video end |
| Either-or per post (CHECK constraint sanity) | VID-01, VID-06 | DB-layer enforcement; automated tests assert UI, not the DB layer | After prod deploy: try to POST a wear with both `mediaPath` and `photoUrl` populated (via DevTools network throttle / manual fetch) → confirm Server Action rejects or DB CHECK fires |

> Per durable memory `feedback_mobile_ui_verify_on_prod`: iOS-camera + autoplay-inline verifications go in the HUMAN_NEEDED queue and run on the prod Vercel build, NOT locally.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify entries or Wave 0 dependencies declared
- [ ] Sampling continuity: no 3 consecutive tasks without an automated verify
- [ ] Wave 0 covers all ❌ test files listed above
- [ ] No watch-mode flags in any plan command (always `vitest run`, never `vitest`)
- [ ] Feedback latency < 30s for the quick command set
- [ ] `nyquist_compliant: true` set in frontmatter (after planner verifies all VID-* + WR-02 requirements have ≥1 automated test)

**Approval:** pending
