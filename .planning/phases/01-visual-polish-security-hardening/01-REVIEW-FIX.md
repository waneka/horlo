---
phase: "01"
fixed_at: 2026-04-11
review_path: .planning/phases/01-visual-polish-security-hardening/01-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
tests_passing: true
build_passing: true
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-04-11
**Source review:** `.planning/phases/01-visual-polish-security-hardening/01-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (2 critical, 5 warning)
- Fixed: 7
- Skipped: 0
- Tests: 382 passed (371 baseline + 11 new regression tests)
- Build: green (`npm run build` on Next.js 16.2.3)

## Fixed Issues

### CR-01: DNS rebinding / TOCTOU gap in `safeFetch`

**Files modified:** `src/lib/ssrf.ts`, `tests/ssrf.test.ts`
**Commit:** `db107cc`
**Applied fix:** Added `createSsrfSafeDispatcher()` that builds an `undici.Agent` whose `connect.lookup` hook runs `resolveAndValidate(hostname)` and returns the validated IP to the socket layer with the correct family. `safeFetch` now passes this dispatcher to `fetch` alongside the existing early `resolveAndValidate` call, eliminating the TOCTOU gap between validation and the internal DNS lookup that `fetch` would otherwise perform. SNI/Host headers are preserved because the hostname is still the URL's hostname — only the dialed address is pinned. Added regression tests asserting the dispatcher is passed to `fetch` and that the resolver returns the validated public IP (and rejects when the validated IP is private).

### CR-02: IPv4-mapped IPv6 bypass in `isPrivateIp`

**Files modified:** `src/lib/ssrf.ts`, `tests/ssrf.test.ts`
**Commit:** `2def631`
**Applied fix:** Rewrote `isPrivateIpv6` to handle `::` (unspecified), `::ffff:a.b.c.d` (IPv4-mapped), and `::a.b.c.d` (IPv4-compatible) by extracting the embedded IPv4 and delegating to `isPrivateIpv4`. Added test cases for `::`, `::ffff:127.0.0.1`, `::ffff:169.254.169.254`, `::ffff:10.0.0.1`, `::ffff:192.168.1.1`, `::127.0.0.1`, and `::ffff:8.8.8.8` (public, should be allowed).

### WR-01: `next.config.ts` `remotePatterns` out of sync with `ALLOWED_HOSTS`

**Files modified:** `next.config.ts`
**Commit:** `a844a19`
**Applied fix:** `next.config.ts` now imports `ALLOWED_HOSTS` from `./src/lib/images` and derives `remotePatterns` by generating both an apex entry (`hostname: host`) and a wildcard subdomain entry (`hostname: '**.' + host`) for every allowed host, all with `protocol: 'https'`. Single source of truth — adding a host to `ALLOWED_HOSTS` automatically updates `next/image`. Build verified successful.

### WR-02: `getSafeImageUrl` did not enforce `https:` protocol

**Files modified:** `src/lib/images.ts`, `tests/images.test.ts`
**Commit:** `6dd19db`
**Applied fix:** Reject any URL whose `protocol` is not `https:` before the hostname allowlist check. Added regression tests covering `http://hodinkee.com/foo.jpg`, `http://www.rolex.com/foo.jpg`, `ftp://hodinkee.com/foo.jpg`, and `javascript:alert(1)` — all now return `null`.

### WR-03: API route leaked internal error messages

**Files modified:** `src/app/api/extract-watch/route.ts`
**Commit:** `a65369d`
**Applied fix:** Catch-all branch now returns a fixed generic message (`"Failed to extract watch data from URL."`) instead of `error.message`. `console.error('Extraction error:', error)` retained for server-side debugging. The `SsrfError` branch is unchanged.

### WR-04: Preferences page silently reset case-size range on empty input

**Files modified:** `src/app/preferences/page.tsx`
**Commit:** `ce1405b`
**Applied fix:** Min and max case-size handlers now:
1. Leave the prior value untouched when the input string is empty (no clobbering on mid-typing clears).
2. Reject non-finite parse results.
3. Clamp values to `[20, 55]` via a new `clampCaseSize` helper.
4. Refuse to commit an update that would make `min > max`.

Constants `CASE_SIZE_MIN` and `CASE_SIZE_MAX` are defined once in the component and referenced by both the clamp helper and the HTML `min`/`max` attributes.

### WR-05: `toggleArrayItem` unchecked `as string[]` cast

**Files modified:** `src/app/preferences/page.tsx`
**Commits:** `ce1405b`, `27ceee5` (follow-up to satisfy `tsc`)
**Applied fix:** Introduced a `StringArrayKeys` mapped conditional type bound to `UserPreferences` (with `NonNullable` to strip optional-field noise). `toggleArrayItem` now takes `field: StringArrayKeys`, and `preferences[field]` is directly typed as `string[]` — no runtime cast. A future refactor that adds a non-array field will no longer compile through this function. Required a follow-up commit because the first attempt used a generic `<K extends ArrayKeys<typeof preferences>>` that lost the index-signature link at the call site; binding the mapped type directly to `UserPreferences` resolves this. Note: `updatePreferences({ [field]: newArray })` still uses a type assertion because TypeScript cannot synthesize a computed-key partial; this is unavoidable and scoped narrowly.

## Skipped Issues

None — all 7 in-scope findings were fixed.

## Verification

- `npx vitest run` — 382/382 tests passing (7 test files).
- `npm run build` — compiled successfully, TypeScript clean, 8/8 static pages generated.

---

_Fixed: 2026-04-11_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
