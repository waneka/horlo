---
status: resolved
phase: 15-wywt-photo-post-flow
source: [15-VERIFICATION.md]
started: 2026-04-24T19:55:00Z
updated: 2026-04-25T00:30:00Z
---

## Current Test

[all items approved by user 2026-04-25]

## Tests

### 1. Camera gesture rule on real iPhone (WYWT-04)
expected: Tapping "Take wrist shot" on iOS Safari 16+ over HTTPS invokes `getUserMedia` as first await on the user-gesture tap; live preview renders with `WristOverlaySvg` (two arm lines, two concentric circles with 10:10 hands, crown at 3 o'clock); Capture produces preview state with X button + Retake link.
why_human: jsdom cannot simulate iOS Safari gesture context; iOS Simulator does not grant real camera access. Requires physical iPhone + HTTPS tunnel.
result: passed

### 2. EXIF orientation upright across rotations (WYWT-06)
expected: Portrait, landscape (90°), and upside-down (180°) captures all render upright on `/wear/[id]` after EXIF strip + resize.
why_human: Real-device EXIF metadata varies per iPhone model + iOS version; `createImageBitmap` auto-orient behavior differs across Safari versions.
result: passed

### 3. Camera permission-denied UX (WYWT-04 D-3)
expected: With Safari camera permission denied in iOS Settings → Safari, tapping "Take wrist shot" surfaces an inline `role="alert"` banner reading "Camera access denied — use Upload photo instead."; Upload photo path still functions; submit succeeds via upload.
why_human: Real browser permission model cannot be reliably tested in jsdom; requires iOS Settings configuration.
result: passed

### 4. HEIC worker chunk emission — A2 spike (WYWT-05)
expected: With Safari DevTools Network tab open, selecting a `.heic` file triggers a separate `heic-worker.*.js` chunk request NOT present on initial route load; HEIC converts to JPEG, EXIF stripped, submit succeeds.
why_human: Turbopack production chunk-emission cannot be verified in unit tests. A2 spike deferred from Plan 15-01 to manual UAT. If the worker merges into main bundle, evaluate the `public/workers/heic-worker.js` fallback path.
result: passed

### 5. EXIF GPS stripped in stored Supabase Storage object (WYWT-06 / T-15-03)
expected: An iPhone photo with known GPS EXIF uploaded and stored in the `wear-photos` bucket has no `GPSLatitude`/`GPSLongitude` fields when downloaded and inspected with `exiftool` (or `exifr`).
why_human: End-to-end verification requires real Supabase Storage write + download + exiftool inspection. The unit test verifies the in-memory stripped blob; the UAT verifies the stored object.
result: passed

### 6. Duplicate-day preflight disable + server 23505 catch (WYWT-12)
expected: Logging a wear for watchA; reopening Wear CTA shows watchA disabled in the picker with "Worn today" micro-label; force-submitting via DevTools produces inline `role="alert"` reading "Already logged this watch today"; the orphan Storage object is removed after the 23505 catch.
why_human: Requires real Supabase session + DB UNIQUE constraint firing + Storage cleanup observation. Integration test is env-gated.
result: passed

### 7. Sonner toast on success in light + dark themes (WYWT-16)
expected: Submit → modal closes → Sonner toast "Wear logged" renders at bottom-center; auto-dismisses ~4s; theme switches mid-flow produce toasts in the corresponding theme.
why_human: Visual regression on toast position/theme/stacking cannot be verified in jsdom.
result: passed

### 8. Three-tier gating on real /wear/[id] route (WYWT-17)
expected: Using two accounts (userA + userB): followers-only wear visible to follower, 404 to non-follower; private wear 404 to all non-owners; non-existent UUID 404; uniform 404 across missing and denied cases.
why_human: Integration test file exists (14 cells) but is env-gated. End-to-end DB + RLS + session verification needs live Supabase.
result: passed

### 9. Phase 10 rail overlay non-regression (WYWT-18)
expected: Home-page non-self WYWT tile tap opens Reels-style `WywtOverlay` (full-screen embla carousel, close button, header nav intact); self-placeholder tile tap opens `WywtPostDialog` (Phase 15 two-step modal).
why_human: End-to-end UI flow across two dialog systems; requires live home page with seeded wear events. `home-privacy.test.ts` (non-regression) is env-gated.
result: passed

## Summary

total: 9
passed: 9
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
