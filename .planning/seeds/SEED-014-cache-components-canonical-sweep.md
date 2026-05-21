---
id: SEED-014
status: dormant
planted: 2026-05-21
planted_during: Phase 52 — Option D Cache Components canonical pattern fix (recurrence-4 React #419)
trigger_when: post-Phase-52 — when a future phase needs to extend Cache Components canonical-pattern validation across additional routes in the 30-route PPR list from .planning/audits/cache-components-2026-05-21.md, OR when a new recurrence surfaces on a route that hasn't yet been opted into `unstable_instant`.
scope: medium
related_phases: [Phase 39c unstable_instant removal (REVERSED by D-52-11), Phase 51 PPR opt-out (Branch B 307 + no-store contract), Phase 52 Option D structural fix]
---

# SEED-014: Cache Components canonical-pattern sweep

## The Idea

Phase 52 narrowly fixed `/u/[username]/[tab]` by adopting the canonical Next 16 Cache Components pattern — sync layout + Suspense + async runtime-API consumer + `unstable_instant` validator export. The original Cache Components audit (`.planning/audits/cache-components-2026-05-21.md`) classified ~30 routes as PPR-eligible, but Phase 52 explicitly scoped to ONE route to keep the fix shippable. This seed captures the future-phase sweep: opt the remaining PPR routes into `unstable_instant` validation one-at-a-time, fix structural defects each surfaces, and document the resulting canonical patterns so they're reusable.

## Scope

- **Target routes (audit's PPR list — 30 routes):** any route that reads cookies, headers, or other runtime APIs and could plausibly benefit from instant-navigation prefetching. Specific candidates to sweep first:
  - `/u/[username]/followers` and `/u/[username]/following` — same `/u/[username]/` layout subtree as Phase 52; the validator already runs on the shared layout, so these are partially validated today (Phase 52 confirmed: no errors surfaced).
  - `/watch/[id]` and `/watch/[id]/edit` — high-traffic dynamic routes.
  - `/explore` and `/explore/paths` — main discovery surfaces.
  - `/insights`, `/notifications`, `/preferences`, `/settings` — auth-gated singletons.
- **One route at a time:** add `unstable_instant` export, run `npm run build`, capture validator output, apply the canonical refactor or `unstable_instant = false` opt-out per the audit's documented decision matrix.
- **Carry forward Phase 52's D-52-DEV-01 lesson:** for multi-dynamic-param routes use `{ prefetch: 'runtime', samples: [...] }` with an INLINE TypeScript annotation; the `as const` form trips Next 16.2.3's "Invalid segment configuration" check at build time. Single-dynamic-param routes may accept `{ prefetch: 'static' }` per the doc's canonical example — empirically test.
- **Skeleton fidelity audit:** verify that each opted-in route's `loading.tsx` skeleton matches the page's intended static shell. Phase 52 kept the three intentionally-distinct skeletons (`ProfileShellSkeleton` for cold load, `ProfileTabContentSkeleton` for tab nav, implicit `loading.tsx` for client navigation) per D-52-15; the sweep may surface other routes with similar three-boundary structures.
- **E2E coverage:** for each opted-in route, add a Playwright `instant()` test (the `@next/playwright` helper) mirroring Phase 52's pattern when the operator's Plan 52-02 scaffolding lands.

## Why this matters

1. **Recurrence prevention.** The same bug class that hit `/u/[username]/[tab]` four times (recurrences 1-4 in `.planning/debug/resolved/profile-page-404-top-nav.md`) can recur on ANY route with top-level runtime API access outside Suspense. The validator is the structural CI gate — without it, the same class will land on other routes silently and surface in prod.
2. **Documented contract becomes enforced contract.** Phase 52's audit followup says "having all three Suspense boundaries (layout + page + loading.tsx) is harmless" — that's true today because we have only ONE route at this fidelity. As we sweep, the pattern becomes the documented & enforced contract across the codebase.
3. **D-52-DEV-01 unlock.** The empirical refinement around runtime+samples is non-obvious. Capturing it in this seed (vs. only in Phase 52 SUMMARY commits) gives future planner agents a reusable lesson.

## When to surface

- Starting a "Cache Components canonical sweep" milestone (e.g., v5.2.x or v5.3 phase).
- After a **new bug recurrence** surfaces on a route not currently using `unstable_instant` — at that point the sweep becomes urgent for that specific route + adjacent siblings.
- When migrating to a future Next.js minor that changes Cache Components semantics — the sweep is the natural moment to re-verify the canonical pattern across all targets.

## Open Questions

1. **`'use cache' → 'use cache: remote'` migration:** Phase 52 deferred the `ProfileShellResolver` migration (audit's in-memory-only-on-serverless finding). The sweep phase may need to factor this in for routes that depend on `'use cache'` (does the migration belong here, or in its own seed?).
2. **404 status preservation:** Phase 52 noted that `notFound()` mid-stream produces 200 + noindex (not a real 404 HTTP status). The sweep phase should decide whether this is acceptable across all opted-in routes, or whether a separate "true 404 status" follow-up phase is needed.
3. **Vercel preview-deploy e2e runs:** Phase 52 ships with local-dev-server Playwright targets only (D-52-07). The sweep phase is the natural moment to graduate to preview-deploy targets — pin the infra cost / config decision then.
4. **Skeleton coverage audit:** is there a route with PPR / instant-nav potential whose current `loading.tsx` is wrong? Phase 52 did not audit; the sweep should.

## Breadcrumbs (Phase 52 hand-off)

### Phase 52 findings (from `.planning/phases/52-.../52-06-FINDINGS.md`)

- **`/u/[username]/[tab]`:** in-route structural defects resolved (layout sync + Suspense + async `ProfileChrome`; outer sync `ProfileTabPage` + inner async `ProfileTabContent` inside Suspense). `unstable_instant = { prefetch: 'runtime', samples: [{ params: { username: 'twwaneka', tab: 'collection' } }] }` exported. `npm run build` exit 0; 33/33 static pages; ◐ Partial Prerender.
- **Cross-route violations:** zero surfaced after Plans 04+05 shipped. The 29 remaining PPR routes from the original audit are this seed's scope.
- **D-52-DEV-01 verbatim:** use `{ prefetch: 'runtime', samples: [...] }` with inline type annotation for multi-dynamic-param routes; `{ prefetch: 'static' }` works for single-dynamic-param routes per the doc canonical example.

### Reference artifacts

- `.planning/audits/cache-components-2026-05-21.md` — original audit + 30-route PPR list.
- `.planning/audits/cache-components-2026-05-21-followup.md` — Option D plan (Phase 52 narrow scope).
- `.planning/phases/52-option-d-cache-components-canonical-pattern-fix-for-u-userna/52-CONTEXT.md` — phase scope, decisions, invariants.
- `.planning/phases/52-.../52-RESEARCH.md` — Cache Components research (Pattern 1, Pattern 2, Pattern 3, Pattern 4 references for sweep phase).
- `.planning/phases/52-.../52-PATTERNS.md` — current-vs-target diffs (analog mappings the sweep can replicate).
- `.planning/phases/52-.../52-06-FINDINGS.md` — Wave 2 close cross-route finding record.
- `.planning/debug/resolved/profile-page-404-top-nav.md` — four-recurrence narrative the sweep is preventing repeating.

### Source-pattern locations (Phase 52 canonical shape)

- `src/app/u/[username]/layout.tsx` — sync layout pattern (D-52-16 structural lock).
- `src/app/u/[username]/profile-chrome.tsx` — async runtime-API consumer pattern.
- `src/app/u/[username]/[tab]/page.tsx` — outer sync + inner async + `unstable_instant` validator export pattern.
- `src/app/u/[username]/profile-shell-skeleton.tsx` — three-boundary skeleton pattern (full chrome vs. content-only).

### Decisions that carry forward

- D-52-11: `unstable_instant` is the validator, NOT a runtime feature. Removing it removes the validation, not the bug.
- D-52-16: Always-sync-layout, always-Suspense, always-async-consumer. The structural lock.
- D-52-CF-01..04: Phase 51 + 39c invariants preserved through any Cache Components refactor (Branch B contract, Pitfall 1 viewerId scope, Pitfall 5 notFound ordering, resolver cacheTag/cacheLife invariants).

### Anti-patterns to avoid

- Adding `unstable_instant = { prefetch: 'static' }` to a multi-dynamic-param route without samples — trips `INSTANT_VALIDATION_ERROR` ("Add it to the sample's `params` object").
- Using `as const` form on the unstable_instant config object — trips "Invalid segment configuration export detected" (use inline type annotation instead).
- Reading cookies or headers at the top of a layout or page (outside Suspense) — the recurrence-4 root cause.
- Treating `unstable_instant = false` as a "permanent fix" — it's an explicit opt-out for routes that legitimately can't be instant, NOT a workaround for structural defects. Each opt-out should reference this seed as the deferred fix.
