# Phase 14 — Deferred Items (out of scope for in-flight plans)

## Pre-existing TypeScript errors (not caused by Phase 14 plans)

- `src/app/u/[username]/layout.tsx:21` — `Cannot find name 'LayoutProps'` (TS2304)
  - Confirmed pre-existing via `git stash` + `npx tsc --noEmit` on base `ed1dc1d`.
  - Next.js 16 generated types name resolution; unrelated to Settings/Preferences work.
  - Discovered during: 14-08 acceptance check (`npx tsc --noEmit`).
  - Action: Track for a future quick-fix; not blocking for this phase.
