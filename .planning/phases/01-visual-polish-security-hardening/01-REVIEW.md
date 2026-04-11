---
doc_type: code-review
phase: "01"
phase_name: visual-polish-security-hardening
reviewed: 2026-04-11
depth: standard
files_reviewed: 33
status: issues_found
findings:
  critical: 2
  warning: 5
  info: 4
  total: 11
---

# Phase 01: Code Review Report

**Reviewed:** 2026-04-11
**Depth:** standard
**Files Reviewed:** 33
**Status:** issues_found

## Summary

Reviewed the Phase 01 "Visual Polish & Security Hardening" changes. The SSRF boundary (`src/lib/ssrf.ts`) and image host allowlist (`src/lib/images.ts`) are well-motivated and have good test coverage, but contain two high-impact correctness gaps that defeat their security guarantees in specific attacker-controlled scenarios: DNS-rebinding TOCTOU between validation and `fetch`, and an IPv4-mapped-IPv6 bypass. The `next.config.ts` `remotePatterns` list is also out of sync with `ALLOWED_HOSTS`, which will cause broken `next/image` renders for apex-domain retailer URLs that otherwise pass the allowlist. Theme hydration in `ThemeToggle.tsx` is correct.

**Findings:** 2 critical, 5 warning, 4 info (11 total)

---

## Critical Issues

### CR-01: DNS rebinding / TOCTOU gap in `safeFetch` — resolved IP is not pinned into the request

**File:** `src/lib/ssrf.ts:79-107`
**Issue:** `safeFetch` calls `resolveAndValidate(parsed.hostname)` to validate the hostname, then calls `fetch(currentUrl, …)` passing the original URL. The validation `dns.lookup` and `fetch`'s own internal DNS lookup are two independent resolutions. An attacker controlling authoritative DNS for a hostname can respond with a public IP on the first lookup (passing validation) and a private RFC1918 / 169.254.169.254 IP on the second (the one `fetch` actually dials) — classic DNS rebinding. `resolveAndValidate` even returns `addresses[0].address` for pinning, but the return value is discarded. This defeats the entire SSRF guard for the primary attack the guard is meant to block.

**Fix:** Pin the validated IP into the actual fetch via an `undici.Agent` with a `connect` hook that reuses the validated address:

```ts
import { Agent } from 'undici'
const dispatcher = new Agent({
  connect: {
    lookup: (hostname, _opts, cb) => {
      resolveAndValidate(hostname)
        .then((ip) => cb(null, ip, net.isIPv4(ip) ? 4 : 6))
        .catch((err) => cb(err, '', 0))
    },
  },
})
// then: fetch(currentUrl, { ...options, dispatcher, redirect: 'manual' })
```

This keeps SNI/Host correct and ensures the address `fetch` dials is exactly the one that was validated.

---

### CR-02: IPv4-mapped IPv6 addresses bypass `isPrivateIp`

**File:** `src/lib/ssrf.ts:19,34-38`
**Issue:** `PRIVATE_IPV6_PREFIXES = ['::1', 'fc', 'fd', 'fe80', 'ff']` does not cover IPv4-mapped IPv6 addresses. A hostname resolving to `::ffff:127.0.0.1`, `::ffff:169.254.169.254`, or `::ffff:10.0.0.1` will be classified as IPv6 by `net.isIPv6()`, checked against the prefix list, miss every entry, and return `false` (public). Combined with CR-01, and even independently, this allows reaching the loopback interface, the AWS/GCE metadata endpoint, and internal networks. Also missing: `::` (unspecified).

**Fix:** Detect IPv4-mapped form and recurse through the IPv4 check; also reject the unspecified address explicitly.

```ts
function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase()
  if (lower === '::' || lower === '::1') return true
  const v4mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (v4mapped) return isPrivateIpv4(v4mapped[1])
  const v4compat = lower.match(/^::(\d+\.\d+\.\d+\.\d+)$/)
  if (v4compat) return isPrivateIpv4(v4compat[1])
  return PRIVATE_IPV6_PREFIXES.some((prefix) => lower.startsWith(prefix))
}
```

Add tests for `::ffff:127.0.0.1`, `::ffff:169.254.169.254`, `::ffff:10.0.0.1`, `::`, and `::ffff:8.8.8.8` (should be public → false).

---

## Warnings

### WR-01: `next.config.ts` `remotePatterns` is out of sync with `ALLOWED_HOSTS`

**File:** `next.config.ts:5-21`, cross-ref `src/lib/images.ts:1-16`
**Issue:** `getSafeImageUrl` accepts apex hosts for every entry in `ALLOWED_HOSTS` (via `hostname === h`). But `remotePatterns` only lists `hodinkee.com` as an explicit apex; all others (`rolex.com`, `omega-watches.com`, `tudorwatch.com`, `seikowatches.com`, `grand-seiko.com`, `wornandwound.com`, `teddybaldassarre.com`, `watchesofmayfair.com`, `chrono24.com`, `watchuseek.com`, `squarespace-cdn.com`) are `**.<host>` only. Next.js `**.example.com` does NOT match the apex `example.com`. A user who pastes `https://rolex.com/…/foo.jpg` will pass `getSafeImageUrl` but `next/image` will throw a 500 at request time.

**Fix:** Add apex entries to match every wildcard, or derive both lists from a single source of truth.

### WR-02: `getSafeImageUrl` does not enforce `https:` protocol

**File:** `src/lib/images.ts:18-31`
**Issue:** The allowlist check only validates hostname, not protocol. `http://hodinkee.com/foo.jpg` passes. While `remotePatterns` is `protocol: 'https'` and will reject at render, the function advertises itself as returning "safe" URLs.

**Fix:** Check `protocol !== 'https:'` → return `null`. Add a regression test.

### WR-03: API route leaks internal error messages to clients

**File:** `src/app/api/extract-watch/route.ts:49-64`
**Issue:** The catch-all returns `error instanceof Error ? error.message : 'Extraction failed'` with status 500. `fetchAndExtract` can throw from cheerio, from the Anthropic SDK, or from node internals, and the raw message is echoed back — possibly surfacing library internals, Anthropic error structure, or key-presence hints.

**Fix:** Return a generic 500 message; keep `console.error` for server-side logs. The `SsrfError` branch already returns a friendly 400.

### WR-04: `preferences/page.tsx` silently resets case-size range on empty input

**File:** `src/app/preferences/page.tsx:284-312`
**Issue:** Clearing the min input writes `min: 20`; clearing max writes `max: 46`. These overwrite prior values on every keystroke and allow `min: 4` (below the HTML `min={20}`) during transitional typing.

**Fix:** Leave prior value on empty input; clamp to `[20, 55]`; validate `min <= max` before committing.

### WR-05: `toggleArrayItem` in preferences performs an unchecked `as string[]` cast

**File:** `src/app/preferences/page.tsx:27-36`
**Issue:** The generic accepts any `keyof typeof preferences`, including non-array fields. No compile-time guarantee. A refactor passing a string-valued field name would crash at runtime.

**Fix:** Narrow the generic to array-valued keys via a mapped conditional type.

---

## Info

### IN-01: Redundant `images.squarespace-cdn.com` entry in `next.config.ts`

**File:** `next.config.ts:19-20`
`{ hostname: '**.squarespace-cdn.com' }` already matches `images.squarespace-cdn.com`. Harmless but noisy.

### IN-02: `WatchForm` image URL field has no allowlist feedback

**File:** `src/components/watch/WatchForm.tsx:246-257`
A rejected URL silently falls back to the placeholder with no explanation. UX gap.

### IN-03: `chart.tsx` uses `dangerouslySetInnerHTML` for theme CSS

**File:** `src/components/ui/chart.tsx:93-114`
Not exploitable today — values come from static code. Flag for visibility if `chartConfig` ever accepts user-provided colors.

### IN-04: `resolveAndValidate` return value is computed but unused

**File:** `src/lib/ssrf.ts:70` / `ssrf.ts:89`
Tied to CR-01 — the return was presumably intended for pinning.

---

## Files Reviewed

33 source + test files across `next.config.ts`, `src/app/`, `src/components/`, `src/lib/`, `tests/`.

## Notes on focus areas

- **`src/lib/ssrf.ts`** — Structure is sound. CR-01 (DNS rebinding TOCTOU) and CR-02 (IPv4-mapped bypass) must be fixed before this can be relied on for SSRF defense.
- **`src/app/api/extract-watch/route.ts`** — Protocol allowlist and SSRF delegation correct; only error-message leakage (WR-03).
- **`next.config.ts` remotePatterns** — Drift from `ALLOWED_HOSTS` (WR-01).
- **`src/lib/images.ts`** — Missing `https:` protocol enforcement (WR-02).
- **`src/components/layout/ThemeToggle.tsx`** — Hydration handling correct, no issues.
