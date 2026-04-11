---
phase: 01-visual-polish-security-hardening
plan: 03
subsystem: security/images
tags: [security, next-image, remotePatterns, SEC-02, VIS-04]
requires:
  - next.config.ts (pre-existing empty NextConfig)
  - src/components/watch/WatchCard.tsx (pre-existing with raw <img>)
  - src/components/watch/WatchDetail.tsx (pre-existing with raw <img>)
provides:
  - getSafeImageUrl helper + ALLOWED_HOSTS constant
  - next.config.ts images.remotePatterns allow-list (14 retailer hosts)
  - next/image render pipeline in both watch components
  - tests/images.test.ts unit coverage for the helper
  - tests/no-raw-img.test.ts CI invariant against regression
affects:
  - All watch image rendering (collection grid + detail view)
  - next/image optimizer allow-list (server-side enforcement)
tech-stack:
  added: []
  patterns:
    - "next/image with fill + sizes + object-cover for responsive images"
    - "Client-side allow-list helper as defense-in-depth before optimizer"
    - "Grep-style test file to enforce no-raw-<img> invariant"
key-files:
  created:
    - src/lib/images.ts
    - tests/images.test.ts
    - tests/no-raw-img.test.ts
  modified:
    - next.config.ts
    - src/components/watch/WatchCard.tsx
    - src/components/watch/WatchDetail.tsx
decisions:
  - "Subdomain match uses hostname.endsWith('.' + host) — catches nested subdomains without regex"
  - "Unlisted hosts fall back to lucide Watch icon placeholder silently (no error copy) per UI-SPEC"
  - "statusColors map deleted from both components — Plan 05 owns full semantic-token migration; this plan only touches the image element"
  - "aspect-[4/5] applied to WatchCard (UI-SPEC) but WatchDetail keeps aspect-square (inspection view)"
metrics:
  duration: "~3 minutes"
  completed: "2026-04-11T18:21:20Z"
  tasks_completed: 2
  files_changed: 6
requirements: [SEC-02, VIS-04]
---

# Phase 01 Plan 03: next/image Allow-list & Migration Summary

Close SEC-02 by routing every watch image through `next/image` with a server-enforced `remotePatterns` allow-list and a client-side `getSafeImageUrl()` helper that returns `null` for unknown hosts, so the UI silently falls back to the lucide Watch placeholder rather than triggering an optimizer error.

## What Was Built

### Task 1 — Helper + config (commit `3af03f2`)

- **`src/lib/images.ts`**: exports `ALLOWED_HOSTS` (14 retailer hosts: hodinkee, chrono24, watchuseek, rolex, omega-watches, tudorwatch, seikowatches, grand-seiko, wornandwound, teddybaldassarre, watchesofmayfair, cdn.shopify.com, squarespace-cdn.com, images.squarespace-cdn.com) and `getSafeImageUrl(url)` which returns the URL on exact-host or subdomain match (via `hostname === h || hostname.endsWith('.' + h)`) or `null` on empty/malformed/disallowed input.
- **`next.config.ts`**: populated `images.remotePatterns` with 15 entries (each retailer gets a `**.domain.tld` wildcard plus bare-domain entries where relevant). Next.js 16 enforces this at the image optimization layer — any unlisted host is rejected server-side regardless of client manipulation.
- **`tests/images.test.ts`**: unit tests cover null/undefined/empty input, malformed URL, disallowed hosts (evil.example.com, localhost, pinterest), exact-host matches, subdomain matches, and the required-host set assertion.

### Task 2 — Component migration + invariant test (commit `38c05b2`)

- **`src/components/watch/WatchCard.tsx`**: imports `next/image`, lucide `Watch` (aliased `WatchIcon`), and `getSafeImageUrl`. Calls `const safeUrl = getSafeImageUrl(watch.imageUrl)` before render. Image container switches from `aspect-square bg-gray-100` to `aspect-[4/5] bg-muted` per UI-SPEC. Renders `<Image fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" className="object-cover">` when `safeUrl` is non-null, otherwise a centered `WatchIcon` at 40% opacity. Deleted: hand-rolled SVG placeholder, `statusColors` map (Plan 05 territory), and the dynamic class on the status Badge.
- **`src/components/watch/WatchDetail.tsx`**: same imports + `safeUrl` pattern. Image container becomes `relative aspect-square w-32 sm:w-48 shrink-0 overflow-hidden rounded-lg bg-muted` (inspection view keeps 1:1). Renders `<Image fill sizes="(max-width: 1024px) 100vw, 50vw">` or the `WatchIcon` fallback. Deleted the hand-rolled SVG; layout restructure (lg:grid-cols-[2fr_1fr]) is Plan 04's job.
- **`tests/no-raw-img.test.ts`**: reads each file via `fs.readFileSync` and asserts `expect(src).not.toMatch(/<img\s/)` plus `expect(src).toMatch(/from ['"]next\/image['"]/)`. Fails CI if a future PR reintroduces a raw `<img>` to either component (T-01-22 mitigation).

## Deviations from Plan

None — plan executed exactly as written. The `statusColors` dangling-reference note in the plan's Task 2 description was honored: the Badge was replaced with `<Badge className="absolute top-2 right-2" variant="secondary">{watch.status}</Badge>` before the broken reference would have triggered a type error.

## Known Stubs

None. All image rendering paths are wired end-to-end: allow-listed URL → next/image optimizer, disallowed URL → lucide Watch placeholder, no URL → lucide Watch placeholder. `imageUrl` data is preserved unchanged so that adding a new host to `ALLOWED_HOSTS` + `remotePatterns` re-enables rendering without a data migration.

## Verification

Verification was not executed in this worktree because:
1. Plan 01-01 (parallel wave) is adding vitest — this worktree does not yet have vitest installed
2. The orchestrator runs tests after wave merge per parallel-execution guidance

Static verification (grep-based) passed inline:

- `grep -q "export function getSafeImageUrl" src/lib/images.ts` — PASS
- `grep -q "ALLOWED_HOSTS" src/lib/images.ts` — PASS
- `grep -q "remotePatterns" next.config.ts` — PASS
- `grep -q "hodinkee.com" next.config.ts` — PASS
- `grep -q "cdn.shopify.com" next.config.ts` — PASS
- `grep -q "from 'next/image'" src/components/watch/WatchCard.tsx` — PASS
- `grep -q "from 'next/image'" src/components/watch/WatchDetail.tsx` — PASS
- `grep -q "getSafeImageUrl" src/components/watch/WatchCard.tsx` — PASS
- `grep -q "getSafeImageUrl" src/components/watch/WatchDetail.tsx` — PASS
- `grep -nE "<img\\s" src/components/watch/WatchCard.tsx src/components/watch/WatchDetail.tsx` — returns nothing (PASS)
- `grep -q 'aspect-\\[4/5\\]' src/components/watch/WatchCard.tsx` — PASS

## Threat Model Alignment

| Threat ID | Disposition | Status |
|-----------|-------------|--------|
| T-01-20 (Spoofing: attacker image host) | mitigate | Addressed via `remotePatterns` server enforcement |
| T-01-21 (Info Disclosure: optimizer as proxy) | mitigate | Same `remotePatterns` defense |
| T-01-22 (Tampering: raw `<img>` regression) | mitigate | `tests/no-raw-img.test.ts` blocks CI on regression |
| T-01-23 (XSS via `<img onerror>`) | mitigate | React + next/image serialize `src` through optimizer |
| T-01-24 (Referrer leakage) | accept | Out of scope for Phase 1 |

No new threat surface introduced — the plan only narrows existing surface.

## Commits

| Task | Hash | Message |
|------|------|---------|
| 1 | `3af03f2` | feat(01-03): add getSafeImageUrl helper + remotePatterns allow-list |
| 2 | `38c05b2` | feat(01-03): migrate WatchCard + WatchDetail to next/image |

## Self-Check: PASSED

- `src/lib/images.ts` — FOUND
- `tests/images.test.ts` — FOUND
- `tests/no-raw-img.test.ts` — FOUND
- `next.config.ts` modified — FOUND
- `src/components/watch/WatchCard.tsx` modified — FOUND
- `src/components/watch/WatchDetail.tsx` modified — FOUND
- Commit `3af03f2` — FOUND in git log
- Commit `38c05b2` — FOUND in git log
