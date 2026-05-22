---
phase: 51-profile-route-ppr-opt-out-recurrence-3-fix-for-u-username-ta
plan: 07
subsystem: profile-routing
tags: [next-config, redirects, ppr, cache-components, bare-username]
one_liner: "Bare-username /u/[username] redirect moved from a streaming-context redirect() page to a next.config.ts redirects() rule (308) so it is evaluated before routing and bypasses Cache Components / PPR — eliminates the x-vercel-cache: PRERENDER 200 that was baked into the prerender."
requires:
  - 51-03 (depends_on per plan frontmatter; layout/page restructure landed in worktree base before this plan)
provides:
  - "Build-time-resolved 308 redirect rule for /u/:username → /u/:username/collection"
  - "Removal of src/app/u/[username]/page.tsx as a page artifact"
affects:
  - "Next.js routing precedence for bare-username profile URL — now matched by the config redirect before the filesystem"
  - "Bare-username navigation entry points (rare path; operator's repro uses tab clicks, not bare-username navigation)"
tech_added:
  - "next.config.ts async redirects() function"
tech_patterns:
  - "Use build-time config-level redirects (not page-level redirect()) for static path mappings that should bypass Cache Components / PPR"
key_files:
  created: []
  modified:
    - next.config.ts
  deleted:
    - src/app/u/[username]/page.tsx
decisions:
  - id: "D-51-07-01"
    decision: "Use permanent: true (308) for the bare-username redirect"
    rationale: "Bare-username → collection-tab is a stable product invariant. Browser caching of the 308 is a feature, not a bug, for this contract. If the default tab ever changes, a config update + browser-cache awareness is acceptable cost. Plan-locked decision."
  - id: "D-51-07-02"
    decision: "Delete src/app/u/[username]/page.tsx entirely rather than wrap it in await connection()"
    rationale: "Config-level redirects are checked before routing per Next 16 docs (node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/redirects.md:39) and are not subject to Cache Components / PPR — eliminates the bug at the structural level, not at the runtime level. await connection() was demonstrated to be ignored by Vercel's prod edge (F2 attempt this session, commit b963e6a, reverted)."
metrics:
  duration_minutes: 5
  completed_date: "2026-05-21"
  tasks_completed: 1
  files_modified: 1
  files_deleted: 1
---

# Phase 51 Plan 07: Bare-Username Redirect Cache Fix Summary

## One-Liner

Bare-username `/u/[username]` redirect moved from a streaming-context `redirect()` page to a `next.config.ts` `redirects()` rule (308) so it is evaluated before routing and bypasses Cache Components / PPR — eliminates the `x-vercel-cache: PRERENDER` 200 that was baked into the prerender.

## Objective Recap

The bare-username path `src/app/u/[username]/page.tsx` was calling `redirect(\`/u/${username}/collection\`)` inside a page component. Per the Next 16 `redirect()` doc, when used in a streaming context this inserts a meta-tag redirect on the client side — and that meta tag was being baked into the prerender by Cache Components. The result observed on prod: `x-vercel-cache: PRERENDER` on the bare-username request (a prerendered cached 200, not a live 307/308).

Optional cleanup branch (operator pre-approved as in-scope). Touches only `next.config.ts` and `src/app/u/[username]/page.tsx`.

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Add redirects() rule + delete bare-username page | `50a208b` | `next.config.ts` (modified), `src/app/u/[username]/page.tsx` (deleted) |

## Implementation Notes

**Config rule shape (post-edit `next.config.ts`):**

```ts
async redirects() {
  return [
    {
      source: '/u/:username',
      destination: '/u/:username/collection',
      permanent: true, // 308
    },
  ]
}
```

The `:username` path parameter is correctly anchored — per the Next 16 redirects doc, `/u/:username` matches `/u/<segment>` but NOT `/u/<a>/<b>` (no nested-path match). This was verified by inspecting the build artifact's compiled regex:

```
"regex": "^(?!/_next)/u(?:/([^/]+?))(?:/)?$"
```

The `(?!/_next)` negative lookahead prevents matching Next.js internals; the `[^/]+?` ensures single-segment matching; the optional trailing slash is handled. So `/u/twwaneka/collection`, `/u/twwaneka/followers`, etc. continue to route to their respective pages (matched after the redirects table per Next 16 routing order).

**Why permanent: true (308) and not permanent: false (307):**

Plan-locked decision (`<interfaces>` recommendation). The contract "bare-username → /collection tab" is a stable product invariant; browser-level caching of the 308 is acceptable. If the default tab ever changes, the trade-off is a config update + browser-cache awareness — operator pre-approved.

**Build verification:**

- `npm run build` → succeeded; compiled in 5.5s, 33 static pages generated, TypeScript clean.
- Route table no longer lists `/u/[username]` as a page — only `/u/[username]/[tab]`, `/u/[username]/followers`, `/u/[username]/following` remain (matching the post-deletion filesystem).
- `.next/routes-manifest.json` contains the redirect rule with `statusCode: 308` and the correct anchored regex.

**Test verification:**

- `npx vitest run tests/profile-route-51.test.ts` → all 3 specs pass (REQ-51-04, -05, -06).
  - The phase-51 regression tests are pure structural assertions on `layout.tsx`, `profile-gate.tsx`, and `profile-shell-resolver.tsx`. None of them assert anything about `next.config.ts` or the deleted `page.tsx`, so they continued to pass as expected.

## Deviations from Plan

None — plan executed exactly as written. The plan's `<action>` block specified the exact `next.config.ts` body and the `rm` deletion; both were applied verbatim.

## Verification

- `grep -c "async redirects" next.config.ts` → 1 (PASS)
- `test ! -f src/app/u/[username]/page.tsx` → true (PASS — file is deleted in worktree HEAD)
- `npm run build` → succeeded
- `.next/routes-manifest.json` contains the 308 redirect rule
- `npx vitest run tests/profile-route-51.test.ts` → 3/3 pass

## Post-Deploy Smoke (handed off to plan 51-06)

Per the plan's `<output>` block, the post-deploy contract check is owned by plan 51-06 (preview deploy gate). The expected behavior on the preview URL:

```bash
curl -I https://<preview-url>/u/twwaneka
# Expected: HTTP/2 308
# Expected: location: /u/twwaneka/collection
# Expected: NO x-vercel-cache: PRERENDER header on the bare-username response
```

Plan 51-06 should pick up this preview-deploy verification.

## Threat Flags

None. The change moves a redirect from page-level to config-level; no new network endpoints, auth paths, file access patterns, or trust-boundary schema changes are introduced.

## Known Stubs

None.

## Success Criteria Check

- [x] `next.config.ts` exports `async redirects()` returning `/u/:username → /u/:username/collection` with `permanent: true`
- [x] `src/app/u/[username]/page.tsx` deleted
- [x] `npm run build` succeeds
- [x] No regressions in `tests/profile-route-51.test.ts`
- [x] Preview-deploy smoke covered by plan 51-06 gate (deferred per plan output spec)
- [x] No file modifications outside `next.config.ts` and `src/app/u/[username]/page.tsx`
- [x] STATE.md / ROADMAP.md untouched (per parallel-execution contract)

## Self-Check: PASSED

- `next.config.ts` contains `async redirects()` (grep count = 1)
- `src/app/u/[username]/page.tsx` is deleted (file absent on disk; deletion recorded in commit `50a208b`)
- Commit `50a208b` exists on branch `worktree-agent-a40b59f6c2df9b23c`
- Build output confirms the redirect rule is in `.next/routes-manifest.json`
- All 3 phase-51 structural tests pass
