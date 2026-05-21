---
phase: 51-profile-route-ppr-opt-out-recurrence-3-fix
fixed_at: 2026-05-21T05:38:38Z
review_path: .planning/phases/51-profile-route-ppr-opt-out-recurrence-3-fix-for-u-username-ta/51-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 51: Code Review Fix Report

**Fixed at:** 2026-05-21T05:38:38Z
**Source review:** .planning/phases/51-profile-route-ppr-opt-out-recurrence-3-fix-for-u-username-ta/51-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope (Critical + Warning): 8
- Fixed: 8
- Skipped: 0
- Out of scope (Info findings IN-01, IN-02, IN-03): 3 — intentionally deferred per
  orchestrator guidance ("Critical+Warning scope only").

**Verification performed:**
- Per-fix: re-read modified file (Tier 1) + `tsc --noEmit` / `node --check` /
  `bash -n` syntax check as appropriate (Tier 2).
- Aggregate post-pass: `npm run build` → compiled successfully, all 33 routes
  generated, no TS errors introduced in modified files.
- Targeted vitest suites (3 files, 29 tests) all pass:
  - `tests/profile-route-51.test.ts` — 3 pass
  - `tests/proxy.test.ts` — 22 pass (was 23 before WR-01 row removal)
  - `tests/app/profile-tab-insights.test.tsx` — 4 pass

## Fixed Issues

### CR-01: Comment in `proxy.ts` falsely claims `getSession()` is network-free

**Files modified:** `src/lib/supabase/proxy.ts`, `src/proxy.ts`
**Commit:** `a1e94f7`
**Applied fix:** Rewrote the rationale comment in both files to honestly describe
what `getSession()` actually does:
- Acknowledged that `_callRefreshToken()` (GoTrueClient.js:2358) is a network
  round-trip triggered when the access token is within `EXPIRY_MARGIN_MS` of
  expiry — so the "no transient failure" guarantee is narrower than the original
  wording claimed, not absolute.
- Stated plainly that the PRIMARY recurrence-2 mitigation is the
  `Cache-Control: no-store` header on the 307 → /login (src/proxy.ts:23), NOT
  the `getUser` → `getSession` swap. The swap narrows the failure window; the
  header closes the cache-poisoning vector.
- Retained the existing "forged JWT trade-off" paragraph verbatim — only the
  network-free framing was misleading; the trust model paragraph is accurate.

No code behavior change in this commit — comments only. Plan / SUMMARY markdown
documents in `.planning/phases/51-.../` were intentionally left as-is per
orchestrator guidance scoping CR-01 to source code only.

### CR-02: `insecureUserWarningProxy` will log warnings on every authenticated request

**Files modified:** `src/lib/supabase/proxy.ts`, `src/proxy.ts`, `tests/proxy.test.ts`
**Commit:** `9040d36`
**Applied fix:** Confined the `insecureUserWarningProxy` to the inside of
`updateSession()` by changing the return shape from `{ supabase, user, response }`
to `{ supabase, userId, response }`. The single string-prop access on the proxied
User now happens inside `updateSession()` (one `console.warn` per request, as
before) but the proxied User object never crosses the module boundary. Callers
receive a plain `string | null` for the id, which is the only field they ever
consumed (`src/proxy.ts:29` reads `user?.id`).

**Deviation from operator's preferred option (b):**
The orchestrator's guidance preferred option (b) — passing
`auth: { suppressGetSessionWarning: true }` to `createServerClient`. I verified
this is **not feasible** in the current Supabase versions:

- `@supabase/auth-js`'s `GoTrueClientOptions` (`src/lib/types.ts:74-177`) does
  NOT expose `suppressGetSessionWarning`. The field exists as a `protected`
  instance field on `GoTrueClient` (`src/GoTrueClient.ts:269`) and is only
  flipped internally on sign-in / refresh / explicit user-token assignment
  paths. It is not a constructor input.
- `@supabase/supabase-js`'s `SupabaseClientOptions.auth` type (lines 61-127 in
  the installed source) similarly does not surface this field. Passing it would
  fail TypeScript strictness and would be silently dropped at runtime.

The reviewer-suggested "documented escape hatch" is not present in
`@supabase/ssr@0.7` + `@supabase/auth-js@2.x` (the versions resolved by the
project's lockfile). I fell back to option (a) as instructed.

**Surgical scope confirmed:** No proxy-flow rewrite. Only the function return
shape changed; the request-handling order (getSession → user check → redirect)
is byte-identical. Two callers updated (`src/proxy.ts`, `tests/proxy.test.ts`
mock helper). The 22 proxy.test.ts assertions still pass.

A true zero-warn fix would require decoding the JWT directly via `jose`
(reviewer's option (a) variant). That is a larger semantic change — it skips
the auto-refresh round-trip path entirely — and was explicitly deferred per
"DO NOT do a full proxy-flow rewrite" guidance. Documented in-code in the new
comment block in `src/lib/supabase/proxy.ts` lines 51-65 so a future fix has
context.

### WR-01: `tests/proxy.test.ts` tests `/u/twwaneka` redirect that is unreachable in production

**Files modified:** `tests/proxy.test.ts`
**Commit:** `2ed8c0c`
**Applied fix:** Removed the `['/u/twwaneka']` row from the Branch B
re-gating `it.each(...)` table. `next.config.ts:22-29` defines a 308 redirect
`/u/:username` → `/u/:username/collection` that runs at the framework level
before the proxy executes; the bare-username URL never reaches the proxy in
production. Added an inline comment above the table explaining why the bare
path is intentionally absent so future contributors do not re-add it. The other
rows (`/u/<user>/<tab>` variants) continue to model real traffic that DOES
reach the proxy and exercise the Branch B 307 + `Cache-Control: no-store`
contract.

Test count went from 23 → 22 (one row removed); all remaining assertions
unchanged and passing.

### WR-02: Page and gate both call `isFollowing` — duplicate work

**Files modified:** `src/app/u/[username]/[tab]/page.tsx`,
`src/app/u/[username]/profile-gate.tsx`
**Commit:** `312998f`
**Applied fix:** Hoisted the `isFollowing` fetch to the page (which is also the
runtime-API consumer for `getCurrentUser`) and pass the result to `ProfileGate`
via a new optional `initialIsFollowing?: boolean` prop. The gate prefers the
caller-supplied value when present and falls back to its own fetch otherwise
(via `initialIsFollowingProp ?? (viewerId && !isOwner ? await isFollowing(...) : false)`),
so the gate remains correct for non-tab callers that might not pre-compute
follow state.

Additional micro-optimization: the page's `initialIsFollowing` computation now
short-circuits for the owner case (`viewerId !== null && !isOwner`) instead of
calling `isFollowing(ownerId, ownerId)` which always returns false. The locked
tab branches that consume `initialIsFollowing` only render for non-owner viewers
anyway, so this is a no-op behavior change with one fewer DB round-trip in the
owner path.

Net result: 1 DB roundtrip per profile-tab render instead of 2.

### WR-03: `assert-phase-51-build.mjs` fails OPEN when route is absent

**Files modified:** `scripts/assert-phase-51-build.mjs`
**Commit:** `73ab544`
**Applied fix:** Added a "route not found in any manifest" branch that fails
closed (exit 3) instead of silently passing (exit 0). The script now:
1. Tracks whether `/u/[username]/[tab]` appears in any of the four inspected
   manifest slots (routes / dynamicRoutes / pages) during the inspection loop.
2. After the violations check, if the route was not found anywhere AND no
   `BUILD_LOG` substring check confirmed non-PPR classification, prints a
   diagnostic and exits 3 ("inconclusive — manifest shape may have changed").
3. Documents the recovery paths: update `inspectManifest()` for the new shape,
   or supply `BUILD_LOG=<path>` to defer to the build-log substring check.

Added an exit-code table entry (exit 3) in the header docblock. Manually
tested four scenarios:
- No `.next/` directory → exit 2 (unchanged SKIP).
- Manifest present, route absent, no BUILD_LOG → exit 3 (new fail-closed).
- Manifest present, route absent, BUILD_LOG without PPR literal → exit 0 (BUILD_LOG
  confirms non-PPR, override succeeds).
- Manifest present, route in `routes[]` → exit 1 (unchanged regression-fail).

Also passes against the real `.next/prerender-manifest.json` produced by `npm
run build` in the worktree (exit 0, route present in `dynamicRoutes` without
the matched PPR markers).

### WR-04: `verify-phase-51-prod.sh` Branch B check is opt-in despite Branch B being the chosen path

**Files modified:** `scripts/verify-phase-51-prod.sh`
**Commit:** `0b0857f`
**Applied fix:** Inverted the default. Changed `if [ "${PHASE51_BRANCH_B:-0}" = "1" ]`
to `if [ "${PHASE51_BRANCH_B:-1}" != "0" ]`. Updated the env-var documentation
in the header comment block and the inline comment above Check 3 to describe
the new opt-OUT semantics (set `PHASE51_BRANCH_B=0` to suppress — only
appropriate for an emergency rollback to the legacy Branch A configuration).
The reviewer's exact suggested form was followed. `bash -n` syntax check
passes.

### WR-05: `verify-phase-51-prod.sh` uses macOS-specific `mktemp -t` syntax

**Files modified:** `scripts/verify-phase-51-prod.sh`
**Commit:** `340b931`
**Applied fix:** Replaced all three `mktemp -t TEMPLATE` invocations (lines 60,
61, 91 in the original) with the portable `mktemp "${TMPDIR:-/tmp}/TEMPLATE"`
form. Added an inline WR-05 comment above the first call explaining the macOS
/ Linux difference. The portable form works identically on macOS, Linux (GNU
coreutils), and BusyBox. `bash -n` syntax check passes; tested the new form
locally — it correctly creates files in `$TMPDIR` (resolved to
`/var/folders/.../T/` on macOS).

### WR-06: `tests/app/profile-tab-insights.test.tsx` does not assert `viewerId` is plumbed to ProfileGate

**Files modified:** `tests/app/profile-tab-insights.test.tsx`
**Commit:** `0c0f0ab`
**Applied fix:** Added `expect(gateEl.props.username).toBe('alice')` and
`expect(gateEl.props.viewerId).toBe('user-1')` assertions in:
1. The owner-insights case (line 100-115 region) — pins REQ-51-05 ("viewerId is
   passed to ProfileGate as a prop") at the JSX-output level, complementing
   the source-grep assertion in `tests/profile-route-51.test.ts`.
2. The collection-branch regression-smoke test (the only other case that
   returns JSX — the non-owner and anonymous insights cases throw via
   `notFound()` before constructing the gate). Re-cast `result` to `any` so
   the prop walk type-checks.

A future refactor that switches from prop plumbing to context plumbing would
now be caught by these test assertions even if the literal `viewerId` token
still appears somewhere in the page source. All 4 tests in the file pass.

## Skipped Issues

None. All 8 in-scope findings were applied successfully.

## Out-of-Scope Findings (not applied — Info tier excluded by orchestrator)

- **IN-01:** Encode username in `currentPath` (defensive; not a real attack surface
  per the reviewer — Next route segments cannot contain `/`).
- **IN-02:** Extract `tryGetCurrentUser()` helper for the UnauthorizedError catch
  pattern (cross-cutting refactor across `[tab]/page.tsx`,
  `followers/page.tsx`, `following/page.tsx`).
- **IN-03:** Comment update on `profile-gate.tsx:46` `notFound()` (cosmetic —
  the existing defensive `notFound()` is correct, only the docstring framing
  could be sharper).

Per orchestrator guidance ("Critical+Warning scope only; skip Info findings
IN-01, IN-02, IN-03 unless one is a trivial side-effect of another fix") these
were intentionally not applied. None of the Critical/Warning fixes I made
touched the same lines as these Info findings, so no incidental side-effects
either.

## Open Notes for the Operator

1. **CR-02 logic-bug flag:** The fix is a `User` → `userId` extraction at the
   `updateSession` boundary. Type-checking passed, all proxy.test.ts assertions
   pass, but the semantic verification ("one warning per request, not N
   warnings") cannot be asserted from a unit test alone — it requires real
   dev-server logs or a structured-logging check that does not exist in this
   project. The behavior is consistent with the Supabase auth-js source I
   inspected (`insecureUserWarningProxy` warns once per `suppressWarningRef`,
   and `suppressWarningRef.value` is set to `true` after first warn).
   **Suggest:** spot-check `npm run dev` console output on a real authenticated
   `/u/<user>/<tab>` navigation to confirm exactly one (or zero) warnings.

2. **WR-02 cache-hit interaction:** The page's `ProfileShellResolver` call at
   line 94 and the gate's call at line 46 are still BOTH present — `WR-02` only
   dedupes `isFollowing`, not the resolver. Per the original REVIEW.md note
   ("ProfileShellResolver is cached so the second call is a cache lookup"),
   the resolver double-call is acceptable. If the operator wants a stricter
   "single call per render" contract, that would require either moving all
   viewer-dependent reads into the gate (deeper refactor) or threading the
   resolved object through. Not in this fix pass.

3. **Build manifest still emits `experimentalPPR: true` for the route:**
   `npm run build` against the post-fix commits produces a
   `.next/prerender-manifest.json` where
   `dynamicRoutes['/u/[username]/[tab]']` has
   `experimentalPPR: true, renderingMode: 'PARTIALLY_STATIC'`. The
   `assert-phase-51-build.mjs` script does NOT match on these keys (it checks
   `prerender:true` / `fallback:'static'`) so it returns OK. This state
   pre-dates my fixes (the manifest shape was the same on the source-of-truth
   commit before any Phase 51 review-fix work). The phase ships behind Branch B
   re-gating (proxy 307 + `Cache-Control: no-store`), so the user-visible
   recurrence-3 mitigation is intact regardless of this PPR classification.
   **Out of scope** for this fix pass — flagging so the operator can decide
   whether a follow-up phase should either (a) extend the assert script to
   match `experimentalPPR`/`PARTIALLY_STATIC`, or (b) acknowledge that the
   manifest classification is decoupled from the Branch B safety contract.

---

_Fixed: 2026-05-21T05:38:38Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
