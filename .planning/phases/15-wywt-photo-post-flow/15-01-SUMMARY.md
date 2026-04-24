---
phase: 15
plan: 01
subsystem: photo-pipeline
tags: [photo, exif, worker, camera, upload, wywt]
dependency-graph:
  requires: []
  provides:
    - "stripAndResize() helper (canvas re-encode + 1080px cap, EXIF-stripped)"
    - "isHeicFile() + PhotoUploader component (HEIC dispatched to Web Worker)"
    - "heic-worker.ts (dynamic import('heic2any') inside Worker, separate chunk)"
    - "WristOverlaySvg geometry component (UI-SPEC §D-08 contract)"
    - "CameraCaptureView Client Component (stream-as-prop architectural enforcement of Pitfall 1)"
    - "uploadWearPhoto() + buildWearPhotoPath() Storage helper (path: {userId}/{wearEventId}.jpg)"
  affects:
    - "Plan 15-02 (ThemedToaster) — independent, no shared symbols"
    - "Plan 15-03 (Post Dialog) — consumes PhotoUploader, CameraCaptureView, WristOverlaySvg, uploadWearPhoto"
    - "Plan 15-04 (Wear Detail) — consumes uploadWearPhoto path convention to render hero"
tech-stack:
  added:
    - "sonner@^2.0.7 (dependency, used by Plan 15-02)"
    - "heic2any@^0.0.4 (dependency, lazy-imported by Worker only)"
    - "exifr@^7.1.3 (devDependency for orientation fallback + tests)"
  patterns:
    - "Web Worker via new URL(...heic-worker.ts, import.meta.url) — Pattern 4"
    - "Canvas re-encode for EXIF strip + resize — Pattern 5"
    - "Client-direct Storage upload with RLS folder enforcement — Pattern 7"
    - "MediaStream as a prop — architectural enforcement of iOS gesture rule (Pitfall 1)"
key-files:
  created:
    - "src/lib/exif/strip.ts"
    - "src/lib/exif/heic-worker.ts"
    - "src/lib/storage/wearPhotos.ts"
    - "src/components/wywt/PhotoUploader.tsx"
    - "src/components/wywt/CameraCaptureView.tsx"
    - "src/components/wywt/WristOverlaySvg.tsx"
    - "src/types/exifr.d.ts"
    - "tests/lib/exif-strip.test.ts"
    - "tests/lib/storage-path.test.ts"
    - "tests/components/PhotoUploader.test.tsx"
    - "tests/components/WristOverlaySvg.test.tsx"
  modified:
    - "package.json"
    - "package-lock.json"
decisions:
  - "exifr/dist/lite.esm.js shipped without .d.ts — added ambient declaration in src/types/exifr.d.ts"
  - "CameraCaptureView takes stream: MediaStream as a prop instead of calling getUserMedia internally — architectural enforcement of Pitfall 1; parent's tap handler is the only place getUserMedia is allowed"
  - "WristOverlaySvg is a pure presentational Server Component (no 'use client' needed) — keeps overlay out of the camera-view client bundle"
  - "Storage helper validates wearEventId as UUID before constructing the path — defense in depth alongside Phase 11 RLS folder enforcement"
metrics:
  duration_min: 9
  completed: "2026-04-24T18:40Z"
  tasks: 3
  tests_added: 26
---

# Phase 15 Plan 01: Photo Pipeline Summary

Browser-side photo capture/upload pipeline shipped: `stripAndResize` (canvas re-encode + 1080px cap, EXIF-stripped), `isHeicFile` + `PhotoUploader` (HEIC dispatched to a Web Worker, non-HEIC bypasses the worker), `heic-worker.ts` (dynamic `import('heic2any')` inside Worker for separate chunk emission), `WristOverlaySvg` (UI-SPEC §D-08 geometry pin), `CameraCaptureView` (takes MediaStream as a prop — architectural enforcement of iOS gesture rule), and `uploadWearPhoto` (client-direct Supabase Storage upload at `{userId}/{wearEventId}.jpg`). Four Wave 0 test files green: `exif-strip` (7), `PhotoUploader` (7), `storage-path` (7), `WristOverlaySvg` (5). Plan-level greps clean: no eager `heic2any` import, no `getUserMedia` runtime call in `CameraCaptureView`. Production `next build` (Turbopack) compiles + type-checks successfully.

## Tasks Completed

| Task | Name                                                                                      | Commit  | Files                                                                                                                                                                                                                |
| ---- | ----------------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Install deps + stripAndResize helper + Wave 0 exif-strip test                             | c5a3e7a | package.json, package-lock.json, src/lib/exif/strip.ts, tests/lib/exif-strip.test.ts                                                                                                                                 |
| 2    | HEIC Web Worker + PhotoUploader + Wave 0 PhotoUploader test (+ exifr type declaration)    | de0dc27 | src/lib/exif/heic-worker.ts, src/components/wywt/PhotoUploader.tsx, tests/components/PhotoUploader.test.tsx, src/types/exifr.d.ts                                                                                    |
| 3    | WristOverlaySvg + CameraCaptureView + uploadWearPhoto helper + storage-path/overlay tests | ad3f473 | src/components/wywt/WristOverlaySvg.tsx, src/components/wywt/CameraCaptureView.tsx, src/lib/storage/wearPhotos.ts, tests/lib/storage-path.test.ts, tests/components/WristOverlaySvg.test.tsx                         |

## Verification Results

| Check                                                                                          | Result                                                            |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `npm run test -- tests/lib/exif-strip.test.ts`                                                 | PASS (7/7)                                                        |
| `npm run test -- tests/components/PhotoUploader.test.tsx`                                      | PASS (7/7)                                                        |
| `npm run test -- tests/lib/storage-path.test.ts tests/components/PhotoUploader.test.tsx`       | PASS (14/14)                                                      |
| `npm run test -- tests/components/WristOverlaySvg.test.tsx`                                    | PASS (5/5)                                                        |
| Plan total (4 files)                                                                           | PASS (26/26 in ~1.4s)                                             |
| `grep -rn "from 'heic2any'" src/ \| grep -v heic-worker`                                       | empty (no eager import — anti-pattern check OK)                   |
| `grep -n 'getUserMedia' src/components/wywt/CameraCaptureView.tsx`                             | comments only; no runtime call (Pitfall 1 architectural enforcement) |
| `grep -c 'line\|circle\|rect' src/components/wywt/WristOverlaySvg.tsx`                         | 9 (incl. comments); JSX has 4 line + 2 circle + 1 rect = 7 shapes (test pins exact count + forbids path/polygon/polyline/ellipse) |
| `npx eslint <new files>`                                                                       | PASS (clean)                                                      |
| `npx next build` (Turbopack)                                                                   | PASS — `Compiled successfully in 4.5s` + `Finished TypeScript in 4.7s` |
| `npx tsc --noEmit`                                                                             | 2 pre-existing errors in `tests/components/preferences/PreferencesClient.debt01.test.tsx` (unchanged file, out of scope per deviation Rule 3 SCOPE BOUNDARY) |

## A2 Spike Result (Turbopack chunk emission for `new URL('./heic-worker.ts', import.meta.url)`)

**Status:** PARTIAL — pattern verified, final chunk-emission verification deferred to Plan 15-03.

**What was verified now:**

1. Production `npx next build` (Next.js 16.2.3 + Turbopack) compiles `PhotoUploader.tsx` + `heic-worker.ts` cleanly. The build output shows `Compiled successfully in 4.5s` with no errors related to the worker URL pattern.
2. Vitest's worker-resolution path under Vite (which uses the same `new URL(..., import.meta.url)` recognition) emits the worker as a separate module URL: `http://localhost:3000/src/lib/exif/heic-worker.ts?worker_file&type=module` — confirming the bundler recognizes the pattern correctly.
3. No eager `import 'heic2any'` exists anywhere under `src/`; the `await import('heic2any')` lives only inside the worker file (verified: `grep -rn "heic2any" src/` shows runtime imports only in `heic-worker.ts`).

**What is deferred to Plan 15-03:**

The production-bundle chunk-emission inspection (DevTools Network tab showing `heic-worker.<hash>.js` loading on first HEIC selection) requires a consumer route that mounts `PhotoUploader`. Plan 15-01 ships only the primitives — no route imports `PhotoUploader` yet, so Turbopack's tree-shaker correctly excludes the worker from the production bundle. When Plan 15-03 wires `ComposeStep` → `PhotoUploader` into `WywtPostDialog` and `NavWearButton` lazy-loads `WywtPostDialog`, the worker chunk will be emitted; the executor of 15-03 should perform the final manual UAT (DevTools Network tab observation) at that point.

If 15-03 finds Turbopack folds the worker into the main client chunk, the documented fallback per 15-RESEARCH.md §Open Question 1 is `public/workers/heic-worker.js` + `new Worker('/workers/heic-worker.js')` (static asset path, no bundler chunking).

## Exact Versions Installed

| Package    | Specifier in package.json | Type                                |
| ---------- | ------------------------- | ----------------------------------- |
| `sonner`   | `^2.0.7`                  | dependency (used by Plan 15-02)     |
| `heic2any` | `^0.0.4`                  | dependency (lazy in worker)         |
| `exifr`    | `^7.1.3`                  | devDependency (lite ESM build for orientation fallback + test EXIF parse) |

Verification commands recorded in Task 1 commit message; package-lock.json captures the resolved tree.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] exifr/dist/lite.esm.js missing TypeScript declarations**
- **Found during:** Task 2 (production `next build` type-check step)
- **Issue:** `npx next build` failed with `TS7016: Could not find a declaration file for module 'exifr/dist/lite.esm.js'` because the npm package ships no `.d.ts` for the lite ESM build.
- **Fix:** Added `src/types/exifr.d.ts` with an ambient `declare module 'exifr/dist/lite.esm.js'` that exposes the `orientation()` helper signature we consume.
- **Files modified:** `src/types/exifr.d.ts` (created)
- **Commit:** `de0dc27`

**2. [Rule 3 - Blocking] jsdom omits Blob.prototype.arrayBuffer (test infrastructure)**
- **Found during:** Task 2 (PhotoUploader test, HEIC path)
- **Issue:** `await file.arrayBuffer()` inside `convertHeic()` rejected with `TypeError: f.arrayBuffer is not a function` under vitest's jsdom environment. Worker was constructed but `postMessage` was never called.
- **Fix:** Test-local `ensureArrayBufferPolyfill()` patches `Blob.prototype.arrayBuffer` via `new Response(this).arrayBuffer()` before each test in the `PhotoUploader` describe block. This stays scoped to the test file.
- **Files modified:** `tests/components/PhotoUploader.test.tsx`
- **Commit:** `de0dc27`

**3. [Rule 3 - Blocking] jsdom canvas backend missing (test infrastructure)**
- **Found during:** Task 1 (exif-strip test)
- **Issue:** jsdom returns `null` from `HTMLCanvasElement.prototype.getContext('2d')` and from `canvas.toBlob` because it has no canvas backend. The helper threw `Canvas 2D context unavailable` before reaching the `toBlob` step.
- **Fix:** Test-local `stubGetContext()` returns a recording 2D context (drawImage/translate/scale/rotate as vi.fn) and `stubCanvasToBlob(bytes)` replaces `HTMLCanvasElement.prototype.toBlob` with a function that synthesizes an `image/jpeg` Blob of the requested size. Both stubs reset between tests.
- **Files modified:** `tests/lib/exif-strip.test.ts`
- **Commit:** `c5a3e7a`

### Architectural Choices Already Documented in the Plan (not deviations, recorded for traceability)

- **CameraCaptureView accepts `stream: MediaStream` as a prop instead of calling `getUserMedia`** — explicitly called out in the plan's Step 2 and reaffirmed by Pitfall 1. This is an architectural enforcement, not a deviation.
- **WristOverlaySvg is a Server Component (no `'use client'`)** — pure presentational, no hooks needed. The plan permitted this ("can be a Server Component").

### No Other Deviations

The plan executed exactly as written for all three tasks. No Rule-1 bug fixes, no Rule-2 missing-functionality additions, no Rule-4 architectural escalations.

## Authentication Gates

None encountered.

## jsdom Canvas Shims

Two test-local shims were added to make Wave 0 tests runnable under jsdom (which has no real canvas backend nor `createImageBitmap`):

| Shim                         | Where                              | Purpose                                                                                              |
| ---------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `stubGetContext()`           | `tests/lib/exif-strip.test.ts`     | Replace `HTMLCanvasElement.prototype.getContext` with a vi.fn returning a recording 2D context stub   |
| `stubCanvasToBlob(bytes)`    | `tests/lib/exif-strip.test.ts`     | Replace `HTMLCanvasElement.prototype.toBlob` with a function producing a synthetic image/jpeg Blob   |
| `stubCreateImageBitmap(w,h)` | `tests/lib/exif-strip.test.ts`     | Define `globalThis.createImageBitmap` returning a fixed-size bitmap stub                              |
| `ensureArrayBufferPolyfill()`| `tests/components/PhotoUploader.test.tsx` | Patch `Blob.prototype.arrayBuffer` via `new Response(this).arrayBuffer()` so `file.arrayBuffer()` resolves |
| `WorkerMock` class           | `tests/components/PhotoUploader.test.tsx` | Recording Worker constructor that simulates `onmessage`/`onerror` via queueMicrotask                  |

These shims live in the test files only — production code uses real browser APIs.

## Threat-Model Mitigations Verified

| Threat ID | Mitigation                                                                                                                                                          | Verification                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| T-15-01   | CameraCaptureView takes pre-acquired MediaStream as prop — getUserMedia must be parent's first await                                                                 | `grep -n 'getUserMedia' src/components/wywt/CameraCaptureView.tsx` returns comments only (no runtime call)   |
| T-15-02   | Worker URL is build-time resolved via `new URL('./heic-worker.ts', import.meta.url)`; no arbitrary URL loading                                                        | `src/components/wywt/PhotoUploader.tsx:54-56` shows hard-coded relative URL                                  |
| T-15-03   | All upload paths traverse `stripAndResize()` (canvas re-encode strips EXIF by construction)                                                                          | Wave 0 test asserts `result.blob.type === 'image/jpeg'` after re-encode; helper has NO code path that copies input EXIF to output |
| T-15-08   | `buildWearPhotoPath` hard-codes `${userId}/${wearEventId}.jpg`; Storage RLS rejects writes outside `auth.uid()` folder                                                | `tests/lib/storage-path.test.ts` pins first-segment-equals-userId contract; Phase 11 RLS migration is the DB-side enforcer |
| T-15-09   | heic2any author statement + canvas re-encode after HEIC conversion (defense in depth — Pipeline always passes through `stripAndResize` after `convertHeic`)         | `src/components/wywt/PhotoUploader.tsx:91-95` runs `stripAndResize(blob)` AFTER HEIC conversion              |
| T-15-10   | useEffect cleanup stops all tracks + nulls srcObject on every unmount path                                                                                           | `src/components/wywt/CameraCaptureView.tsx:60-65` unmount cleanup verified by reading                        |
| T-15-11   | 1080px cap bounds canvas memory; canvas.toBlob throwing on bad input is caught by caller's try/catch in PhotoUploader / CameraCaptureView                            | `src/lib/exif/strip.ts:108-110` throws on toBlob null; PhotoUploader.handleFileChange catches all errors via onError |

## Plan Success Criteria — Final Status

| #   | Criterion                                                                                            | Status                                          |
| --- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 1   | `stripAndResize(blob)` produces ≤1080px EXIF-free JPEG                                                | DONE (canvas re-encode is the strip mechanism)  |
| 2   | `isHeicFile` detects by MIME + extension; only HEIC triggers Worker                                   | DONE (test pins both detection paths + worker dispatch) |
| 3   | `new URL('./heic-worker.ts', import.meta.url)` confirmed to emit a separate chunk under Next 16.2.3 + Turbopack OR fallback documented | PARTIAL — pattern compiles + Vite verifies same recognition; final production-chunk inspection deferred to 15-03 (no consumer in this plan) |
| 4   | `WristOverlaySvg` renders exact UI-SPEC geometry                                                      | DONE (test pins coords + forbids extras)        |
| 5   | `CameraCaptureView` takes pre-acquired MediaStream as prop                                            | DONE (architectural enforcement of Pitfall 1)   |
| 6   | `uploadWearPhoto` uploads to `{userId}/{wearEventId}.jpg` with `upsert: false`                        | DONE (`src/lib/storage/wearPhotos.ts:67-72`)    |
| 7   | Three Wave 0 test files green: exif-strip, PhotoUploader, storage-path                                | DONE (4 files actually — also added WristOverlaySvg test for the geometry contract); all 26 tests passing |

## Self-Check: PASSED

**Files** (all 11 verified present):
- src/lib/exif/strip.ts
- src/lib/exif/heic-worker.ts
- src/lib/storage/wearPhotos.ts
- src/components/wywt/PhotoUploader.tsx
- src/components/wywt/CameraCaptureView.tsx
- src/components/wywt/WristOverlaySvg.tsx
- src/types/exifr.d.ts
- tests/lib/exif-strip.test.ts
- tests/lib/storage-path.test.ts
- tests/components/PhotoUploader.test.tsx
- tests/components/WristOverlaySvg.test.tsx

**Commits** (all 3 verified in `git log`):
- c5a3e7a: feat(15-01): ship EXIF-strip + resize helper with Wave 0 test
- de0dc27: feat(15-01): HEIC worker + PhotoUploader with Wave 0 test (A2 spike deferred to 15-03)
- ad3f473: feat(15-01): WristOverlaySvg + CameraCaptureView + Storage helper + storage-path test

