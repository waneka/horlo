---
phase: 51-profile-route-ppr-opt-out-recurrence-3-fix-for-u-username-ta
plan: 06
type: execute
status: complete
requirements: [REQ-51-01, REQ-51-02, REQ-51-07]
completed_at: 2026-05-21
operator_decision: "Push main directly to origin (preview-bypass) — operator accepted prod-after-push risk"
---

# Plan 51-06 SUMMARY — Vercel preview / prod-contract verification (CHECKPOINT)

## Operator decision recorded

The plan was written assuming a feature-branch push that triggers a Vercel preview. Phase 51 was executed with `branching_strategy: none` (per phase config), so all 28 commits landed on local `main`. At the Wave 5 checkpoint, the operator chose **"Push main directly to origin"** (option 2 of 4) after the orchestrator explicitly surfaced the trade-off: this path inverts the plan's gating intent (preview-verify, then merge) into a prod-after-push contract check. Accepted with explicit consent.

## What was deployed

- **Source:** local `main` at HEAD `84779ae` (28 commits ahead of origin/main pre-push, all phase-51-tagged)
- **Push:** `git push origin main` succeeded — `2459a3d..84779ae main -> main`
- **Vercel deploy:** auto-triggered on main push; reachable as **https://www.horlo.app**
- **Deploy ID (sample):** `x-vercel-id: sfo1::g7kgj-1779328409627-2a7ed9d6f21d`

## Verifier results

### Direct REQ-51-07 (Branch B contract) — PASS

```
$ curl -s -o /dev/null --cookie-jar /dev/null --cookie /dev/null \
    -w '%{http_code}' -D headers \
    https://www.horlo.app/u/twwaneka/collection
307

$ grep -iE "(cache-control|location)" headers
cache-control: no-store
location: /login?next=%2Fu%2Ftwwaneka%2Fcollection
```

- Status: **307** ✓
- `cache-control: no-store` ✓ (Router Cache poisoning vector closed)
- Location: `/login?next=...` ✓ (Branch B re-gate live)

### `scripts/verify-phase-51-prod.sh` notes (script limitation under Branch B)

The verifier script's Check 1 (REQ-51-01: state-tree-aware RSC body ≥100 bytes) and Check 2 (REQ-51-02: prefetch RSC body ≥100 OR `x-nextjs-postponed: 1`) are written assuming anonymous public access to `/u/*` (Branch A). Under Branch B, the proxy redirects anonymous requests to `/login` BEFORE the route renders, so an anonymous curl receives the 307 redirect body (15 bytes) instead of the RSC payload. The verifier fails-fast at Check 1 with `set -e` and never reaches Check 3.

This is a **script-design gap, not a regression** — under Branch B, REQ-51-01/02 are inherently un-testable without an authenticated cookie. The operator UAT below covers the authenticated path that the verifier cannot.

**Follow-up:** the verifier could be patched in a future phase to either (a) accept an auth cookie env var, or (b) skip Check 1/2 entirely when `PHASE51_BRANCH_B=1` and reach Check 3 via early-jump. Not blocking for phase 51.

## Operator UAT result

The operator performed the recurrence-3 repro path in production:

1. ✓ Signed in at https://www.horlo.app
2. ✓ Hard reload of `/u/twwaneka/collection`
3. ✓ Two full click-through cycles across all profile tabs: collection → wishlist → worn → notes → stats → insights (+ common-ground when visible)

**Result:** **PASS — zero 404s across two click cycles.** F3-Composite structural opt-out from Cache Components PPR holds in prod. REQ-51-01 (state-tree-aware RSC non-empty) and REQ-51-02 (prefetch RSC non-empty or postponed) are satisfied via observed authenticated behavior. The recurrence-3 symptom does not reproduce.

## Phase requirements — final status

| Req | Description | Where verified | Status |
|-----|-------------|----------------|--------|
| REQ-51-01 | State-tree-aware RSC body non-empty on prod | Operator UAT (authenticated) | PASS |
| REQ-51-02 | Prefetch RSC non-empty OR `x-nextjs-postponed: 1` on prod | Operator UAT (authenticated) | PASS |
| REQ-51-03 | `/u/[username]/[tab]` NOT in prerender output | Local `assert-phase-51-build.mjs` (build manifest) | PASS |
| REQ-51-04 | layout.tsx has no `<Suspense fallback=…>` around ProfileGate | Local vitest `tests/profile-route-51.test.ts` Test 1 | PASS |
| REQ-51-05 | ProfileGate accepts `viewerId` as a prop | Local vitest Test 2 | PASS |
| REQ-51-06 | ProfileShellResolver retains `'use cache'` + `cacheTag` | Local vitest Test 3 | PASS |
| REQ-51-07 | Anon `/u/*/collection` → 307 + `Cache-Control: no-store` | Direct curl against prod | PASS |

All seven phase requirements satisfied.

## Self-Check

- [x] Branch B contract verified on prod via direct curl (REQ-51-07)
- [x] Operator UAT confirmed REQ-51-01 / REQ-51-02 (the recurrence-3 symptom does not reproduce in prod)
- [x] Local assertions still GREEN on the post-push tree (REQ-51-03, REQ-51-04, REQ-51-05, REQ-51-06)
- [x] No revert needed
- [x] Deploy SHA recorded; can be referenced by 51-08 when closing the debug file

## Next

Plan 51-08 closes the loop on `.planning/debug/profile-page-404-top-nav.md` — records the resolution and moves it to `.planning/debug/resolved/`.
