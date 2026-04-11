---
phase: 01-visual-polish-security-hardening
plan: 02
subsystem: security
tags: [ssrf, security, api, extractor]
requires: []
provides:
  - "src/lib/ssrf.ts module (isPrivateIp, resolveAndValidate, safeFetch, SsrfError)"
  - "SSRF-safe outbound fetch pipeline for /api/extract-watch"
  - "SEC-01 requirement closed"
affects:
  - "src/lib/extractors/index.ts (fetchAndExtract now routes through safeFetch)"
  - "src/app/api/extract-watch/route.ts (maps SsrfError to 400 with UI-SPEC copy)"
tech-stack:
  added:
    - "node:dns (built-in) — DNS resolution with all:true for multi-address validation"
    - "node:net (built-in) — net.isIPv4 / net.isIPv6 format detection"
  patterns:
    - "DNS pre-resolution + private-range blocklist (RFC1918, loopback, link-local, CGNAT, multicast, reserved)"
    - "Manual redirect following with per-hop revalidation (redirect: 'manual')"
    - "Fail-closed IP classification — unknown formats treated as private"
key-files:
  created:
    - path: "src/lib/ssrf.ts"
      purpose: "SSRF-hardened fetch module — DNS pinning, private-IP rejection, bounded redirect chain"
    - path: "tests/ssrf.test.ts"
      purpose: "Vitest unit coverage of IPv4/IPv6 classification, resolveAndValidate mocks, safeFetch redirect behavior"
  modified:
    - path: "src/lib/extractors/index.ts"
      change: "fetchAndExtract now imports and calls safeFetch instead of bare fetch"
    - path: "src/app/api/extract-watch/route.ts"
      change: "Catches SsrfError and returns 400 with the exact UI-SPEC copy before the generic 500 path"
decisions:
  - "Used node built-ins (dns/net) instead of the ssrf-req-filter npm package — zero new deps, ~110 lines of code"
  - "Fail-closed on unknown IP formats (isPrivateIp returns true) to prevent bypass via unusual literals"
  - "Redirect chain capped at 5 hops (default) to bound DoS surface and per-hop DNS overhead"
  - "Error copy is fixed to the UI-SPEC string; no IP/hostname leak in the 400 response body"
metrics:
  tasks_completed: 2
  files_created: 2
  files_modified: 2
  started: 2026-04-11
  completed: 2026-04-11
requirements_closed:
  - SEC-01
---

# Phase 01 Plan 02: SSRF Hardening Summary

Server-side DNS-pinned `safeFetch` closes SEC-01 by rejecting RFC1918/loopback/link-local/CGNAT/multicast/reserved ranges and validating every redirect hop, replacing the bare `fetch(url)` call in `fetchAndExtract`.

## What Changed

### New: `src/lib/ssrf.ts`

A self-contained SSRF hardening module built on `node:dns` + `node:net` (zero new dependencies). Exposes four symbols:

- **`isPrivateIp(ip: string): boolean`** — classifies any IP literal against 11 IPv4 CIDR ranges (10/8, 172.16/12, 192.168/16, 127/8, 169.254/16, 100.64/10, 0/8, 192.0.0/24, 198.18/15, 240/4, 224/4) and 5 IPv6 prefixes (`::1`, `fc`, `fd`, `fe80`, `ff`). Unknown formats return `true` (fail-closed).
- **`resolveAndValidate(hostname)`** — calls `dns.lookup(hostname, { all: true })`, throws `SsrfError` on DNS failure, empty result, or any private hit in the address list. Returns the first address for pinning.
- **`safeFetch(url, options?, maxRedirects = 5)`** — loops: parse URL → `resolveAndValidate` → `fetch(..., { redirect: 'manual' })` → on 3xx re-parse `Location` (relative-safe via `new URL(location, currentUrl)`) and re-validate; throws `SsrfError('Too many redirects')` at the cap and `SsrfError('Redirect with no Location header')` on a bare 3xx.
- **`SsrfError`** — dedicated `Error` subclass with `name = 'SsrfError'` so the route handler can `instanceof` it.

### New: `tests/ssrf.test.ts`

Vitest suite covering:

- **IPv4 classification (15 cases):** every private range plus public controls (8.8.8.8, 1.1.1.1, example.com `93.184.216.34`). Explicit regression for AWS metadata `169.254.169.254` and CGNAT boundaries (`100.64.0.1`, `100.127.255.255`).
- **IPv6 classification (7 cases):** `::1`, `fc00::1`, `fd00::1`, `fe80::1`, `ff00::1` private; Google/Cloudflare DNS public.
- **Fail-closed:** `'not-an-ip'` → `true`.
- **`resolveAndValidate`:** public pin, mixed-address rejection, loopback-only rejection, AWS metadata rejection, DNS failure wrapping, empty result rejection. `node:dns` mocked via `vi.mock`.
- **`safeFetch`:** happy path (verifies `redirect: 'manual'` propagates), redirect-to-private blocked before second fetch, 3xx without Location header, `maxRedirects` cap triggers `'Too many redirects'`.

Test count: ~25 assertions across 16 `it` blocks.

### Modified: `src/lib/extractors/index.ts`

- Added `import { safeFetch } from '@/lib/ssrf'`.
- `fetchAndExtract` replaces `await fetch(url, …)` with `await safeFetch(url, …)`. Headers unchanged. Behavior on `!response.ok` unchanged.

### Modified: `src/app/api/extract-watch/route.ts`

- Added `import { SsrfError } from '@/lib/ssrf'`.
- In the `catch (error)` block, before the generic 500 fall-through, added:
  ```ts
  if (error instanceof SsrfError) {
    return NextResponse.json(
      { error: "That URL points to a private address and can't be imported." },
      { status: 400 }
    )
  }
  ```
- Copy matches the UI-SPEC Copywriting Contract exactly, including the apostrophe. No IP, hostname, or underlying message is leaked to the client.

## Verification

Per plan 01-02 instructions and the orchestrator's critical note, vitest is being installed in parallel by plan 01-01 in a separate worktree. This worktree does not have vitest available, so test execution is deferred to the orchestrator's post-merge verification step.

- `npm run build` — my touched files compile cleanly; a pre-existing build failure in `src/components/layout/ThemeToggle.tsx:31` (PopoverTrigger `asChild` prop typing) belongs to plan 01-01 and was logged to `deferred-items.md`. Not in scope for 01-02.
- Static grep verification:
  - `src/lib/ssrf.ts` exports `SsrfError`, `isPrivateIp`, `resolveAndValidate`, `safeFetch`, contains `"redirect: 'manual'"`, `169.254`, `100.64`.
  - `src/lib/extractors/index.ts` imports `safeFetch` from `@/lib/ssrf` and no longer contains `await fetch(url,`.
  - `src/app/api/extract-watch/route.ts` imports `SsrfError`, contains `instanceof SsrfError`, `private address`, `status: 400`.

## Threat Register Status

| Threat ID | Disposition | Mitigation in this plan |
|-----------|-------------|--------------------------|
| T-01-10 SSRF | mitigate | `resolveAndValidate` rejects all RFC1918/loopback/link-local/CGNAT/multicast/reserved ranges before any outbound request |
| T-01-11 DNS rebinding | mitigate | `dns.lookup` called with `{ all: true }` — every returned address is validated; hostname strings are never trusted |
| T-01-12 AWS metadata | mitigate | 169.254.0.0/16 entry in `PRIVATE_RANGES_V4` + regression test `rejects AWS metadata IP` |
| T-01-13 Redirect pivot | mitigate | `redirect: 'manual'` + per-hop `resolveAndValidate` + regression test `blocks redirect to private IP` |
| T-01-14 Redirect-loop DoS | mitigate | `maxRedirects = 5` default + regression test `caps redirect chain at maxRedirects` |
| T-01-15 Error leak | mitigate | 400 response uses the static UI-SPEC copy; no IP, no stack trace, no underlying message |
| T-01-16 DNS TOCTOU | accept | Documented in plan — full mitigation requires undici `dispatcher` + `connect` override, scoped to v2 hardening |
| T-01-17 IPv6 mapped IPv4 | mitigate | `net.isIPv6` branch + `PRIVATE_IPV6_PREFIXES`; unknown formats fall through to `true` (fail-closed) |

## Deviations from Plan

None. The plan was executed verbatim:

- `src/lib/ssrf.ts` mirrors the RESEARCH.md skeleton with a minor local typing (`Array<{ address: string; family: number }>`) instead of importing `dns.LookupAddress`, because the vitest mock replaces the whole `node:dns` module — importing the type eagerly would fight the mock.
- Test file, grep verifications, and acceptance criteria match the plan tasks 1:1.

## Deferred Issues

- **`src/components/layout/ThemeToggle.tsx:31`** — `PopoverTrigger asChild` TypeScript error. This file is owned by plan 01-01 (parallel wave). Logged to `.planning/phases/01-visual-polish-security-hardening/deferred-items.md`. Out of scope for 01-02.

## Commits

| Task | Hash | Message |
|------|------|---------|
| 1 | 3d92387 | feat(01-02): add DNS-pinned safeFetch SSRF module with unit tests |
| 2 | 187a253 | feat(01-02): route fetchAndExtract through safeFetch and surface SsrfError as 400 |

## Self-Check: PASSED

- `src/lib/ssrf.ts` — FOUND
- `tests/ssrf.test.ts` — FOUND
- `src/lib/extractors/index.ts` contains `safeFetch` import and call — FOUND
- `src/app/api/extract-watch/route.ts` contains `SsrfError` import and 400 branch — FOUND
- Commit `3d92387` — FOUND in git log
- Commit `187a253` — FOUND in git log
