---
phase: 15
slug: wywt-photo-post-flow
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-24
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `15-RESEARCH.md` §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 2.1.9 (jsdom environment) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test -- tests/integration/phase15-wywt-photo-flow.test.ts tests/integration/phase15-wear-detail-gating.test.ts tests/components/WywtPostDialog.test.tsx tests/components/PhotoUploader.test.tsx tests/components/ThemedToaster.test.tsx tests/lib/exif-strip.test.ts` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~30s quick; ~90s full (existing suites + phase 15 integration) |

---

## Sampling Rate

- **After every task commit:** Run the **quick run command** above for the files touched by the task.
- **After every plan wave:** Run `npm run test` (full suite).
- **Before `/gsd-verify-work`:** Full suite must be green AND manual iOS UAT checklist signed off.
- **Max feedback latency:** 30 seconds for quick; 90 seconds for full.

---

## Per-Task Verification Map

| Req ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|--------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| WYWT-01 | 15-PostDialog | 2 | Two-step modal flow (picker → compose) | — | Step 1 blocks advance without watch selection | integration (RTL) | `npm run test -- tests/components/WywtPostDialog.test.tsx` | ❌ W0 | ⬜ pending |
| WYWT-02 | 15-PostDialog | 2 | "Change" link returns to Step 1 preserving state | — | Note + visibility state retained across back-nav | integration (RTL) | same as WYWT-01 | ❌ W0 | ⬜ pending |
| WYWT-03 | 15-PostDialog | 2 | Submit with no photo valid | — | `wear_events.photo_url` nullable path verified | integration (RTL + DB) | `npm run test -- tests/integration/phase15-wywt-photo-flow.test.ts` | ❌ W0 | ⬜ pending |
| WYWT-04 | 15-Camera | 2 | Camera gesture rule + dotted-oval overlay | T-15-01 (camera gesture DoS) | `getUserMedia` first await on user gesture; MediaStream cleanup on unmount | **manual-only** (jsdom cannot simulate iOS gesture context) | Real iOS device UAT checklist (below) | n/a | ⬜ pending |
| WYWT-05 | 15-Photo | 1 | HEIC conversion via Web Worker | T-15-02 (worker import poisoning) | `new URL('./heic-worker.ts', import.meta.url)` — no arbitrary URL loading; heic2any metadata-stripped | integration (mocked worker dispatcher) | `npm run test -- tests/components/PhotoUploader.test.tsx` | ❌ W0 | ⬜ pending |
| WYWT-06 | 15-Photo | 1 | EXIF stripped + 1080px resize on ALL paths | T-15-03 (EXIF GPS leak) | Canvas re-encode strips all tags; verified post-encode with `exifr.parse()` | integration (exif parse on encoded blob) | `npm run test -- tests/lib/exif-strip.test.ts` | ❌ W0 | ⬜ pending |
| WYWT-07 | 15-PostDialog | 2 | Live 0/200 character counter | — | Textarea maxlength enforced client + server zod | unit (RTL) | same as WYWT-01 | ❌ W0 | ⬜ pending |
| WYWT-08 | 15-PostDialog | 2 | Visibility selector default Public | T-15-04 (visibility default tampering) | zod enum validates; server action does not trust client default | unit (RTL) | same as WYWT-01 | ❌ W0 | ⬜ pending |
| WYWT-12 | 15-Action | 2 | Duplicate-day guard — preflight disable + server 23505 | T-15-05 (duplicate-day race) | DB UNIQUE + preflight; zod UUID validation | integration — DB | `npm run test -- tests/integration/phase15-wywt-photo-flow.test.ts` | ❌ W0 | ⬜ pending |
| WYWT-15 | 15-Action | 2 | Client-direct upload + server validates object exists | T-15-06 (client-side tampering of hasPhoto) | Server Action calls `supabase.storage.list(userId, {search})` before insert; rejects missing object | integration — Supabase | same as WYWT-12 | ❌ W0 | ⬜ pending |
| WYWT-16 | 15-PostDialog | 2 | Sonner "Wear logged" toast on success | — | Toast called from Client Component, not Server Action | integration (RTL + spy on `toast.success`) | same as WYWT-01 | ❌ W0 | ⬜ pending |
| WYWT-17 | 15-Detail | 3 | `/wear/[id]` three-tier gate + uniform 404 | T-15-07 (photo existence leak via response differential) | DAL returns null for missing OR denied; `notFound()` identical path | integration — DB 9-cell matrix | `npm run test -- tests/integration/phase15-wear-detail-gating.test.ts` | ❌ W0 | ⬜ pending |
| WYWT-18 | 15-Detail | 3 | Rail tile tap preserves Phase 10 overlay; durable `/wear/[id]` URL | — | No regression on existing home-privacy tests | smoke | `npm run test -- tests/integration/home-privacy.test.ts` | ✅ | ⬜ pending |
| WYWT-19 | 15-Toaster | 1 | `<Toaster />` outside Suspense, inside `<ThemeProvider>` | — | Custom ThemeProvider wrapper, NOT next-themes scaffold | unit (DOM-structure assertion on layout render) | `npm run test -- tests/components/ThemedToaster.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Plan labels above are indicative; the planner will finalize naming in PLAN.md frontmatter.*

---

## Wave 0 Requirements

- [ ] `tests/integration/phase15-wywt-photo-flow.test.ts` — end-to-end happy path + duplicate-day (WYWT-12) + client-direct upload + server validation (WYWT-15) + orphan-cleanup-on-23505 verification
- [ ] `tests/integration/phase15-wear-detail-gating.test.ts` — 9-cell privacy matrix (3 visibility × 3 viewer relations) mirroring `tests/integration/home-privacy.test.ts` (WYWT-17)
- [ ] `tests/components/WywtPostDialog.test.tsx` — RTL coverage for WYWT-01, 02, 03, 07, 08, 16
- [ ] `tests/components/PhotoUploader.test.tsx` — HEIC detection + worker dispatch (mocked `Worker`); WYWT-05
- [ ] `tests/components/ThemedToaster.test.tsx` — placement (outside Suspense) + theme binding via custom `ThemeProvider` (WYWT-19)
- [ ] `tests/lib/exif-strip.test.ts` — canvas re-encode produces JPEG with no EXIF tags and correct 1080px longest-side cap (WYWT-06)
- [ ] `tests/lib/storage-path.test.ts` *(optional, merge into another file if trivial)* — path validator rejects `otherUserId/*` writes
- [ ] `exifr` devDependency — required for EXIF verification in `tests/lib/exif-strip.test.ts` and integration orphan test

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| iOS Safari `getUserMedia` gesture rule holds | WYWT-04 | jsdom cannot simulate iOS user-gesture context; iOS Simulator does not grant real camera | Real iPhone (iOS 16+), Safari, HTTPS tunnel (ngrok/cloudflared). Tap "Take wrist shot" → allow camera → verify live video preview + dotted oval overlay renders |
| Camera capture renders upright across orientations | WYWT-06 | Real device EXIF metadata varies; canvas + `createImageBitmap` behavior differs per iOS version | Capture portrait AND landscape; verify stored image renders upright on `/wear/[id]` |
| Camera permission-denied UX | WYWT-04 (D-3) | Real browser permission model; cannot reliably test in jsdom | Deny camera in Safari settings; tap "Take wrist shot"; verify inline actionable error; Upload path still works |
| HEIC upload + worker chunk is a separate bundle | WYWT-05 / A2 spike | Turbopack worker chunk emission is not yet verified for Next 16.2.3 in this repo | Open DevTools Network tab → tap Upload → select `.heic` → verify `heic2any` chunk loads only on this interaction, not on initial route load |
| EXIF GPS stripped in stored Supabase Storage object | WYWT-06 / T-15-03 | Requires real Supabase + `exiftool` (or `exifr` in a Node script) against the stored object | Upload iOS Photos image with known GPS EXIF → download from Storage → run `exiftool` (or `node scripts/check-exif.mjs`) → assert no `GPSLatitude` / `GPSLongitude` fields |
| Duplicate-day: preflight disables watch in picker; force-insert via dev tools → inline error | WYWT-12 | Combines real session + DB UNIQUE constraint | Log a wear; refresh home; verify the watch is disabled in the picker; open DevTools, re-invoke `logWearWithPhoto` manually → assert 23505-derived inline error |
| `/wear/[id]` for a follower-only event is 404 to a non-follower | WYWT-17 | Combines real RLS + viewer-session | Seed: userA posts followers-only event; userB (non-follower) visits `/wear/[id]` → assert HTTP 404, NOT a JSON error leak |
| "Wear logged" Sonner toast visible on success | WYWT-16 | Visual regression on toast position, theme, and stacking | Submit valid wear; verify toast at viewport bottom-right, matches active theme (light/dark), auto-dismisses ~4s |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s (quick) / 90s (full)
- [ ] Manual iOS UAT checklist signed off before `/gsd-verify-work`
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
