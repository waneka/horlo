# Phase 52: Option D — Cache Components canonical pattern fix - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-21
**Phase:** 52-option-d-cache-components-canonical-pattern-fix-for-u-userna
**Areas discussed:** Validator scope, Playwright e2e test, Cleanup bundling, loading.tsx reconciliation

---

## Validator scope

### Initial scope — where to add `unstable_instant = { prefetch: 'static' }`

| Option | Description | Selected |
|--------|-------------|----------|
| Just `[tab]/page.tsx` | Audit followup's explicit recommendation — narrow scope, validator-driven scope decision | ✓ |
| Sweep all PPR-classified routes | Catch all structural defects at once; higher risk of scope explosion | |
| Just `[tab]/page.tsx` + `[username]/page.tsx` | Narrow + bare-username redirect; defensive variant | |

**User's choice:** Just `[tab]/page.tsx`
**Notes:** Per audit followup — lowest-risk start, let validator surface this route's defects first.

### Cross-route response

| Option | Description | Selected |
|--------|-------------|----------|
| Add `unstable_instant = false` opt-outs | Docs' documented opt-out pattern; no behavior change | ✓ |
| Fix all surfaced routes inline in Phase 52 | Could balloon scope unpredictably | |
| Capture as Phase 53 seed | Defer entirely | |
| Decide at validator-output time | Ambiguity at execution time | |

**User's choice:** Add `unstable_instant = false` opt-outs
**Notes:** Documents intent at the surfaced sites; sweep itself is future phase via SEED-014.

### CI gating

| Option | Description | Selected |
|--------|-------------|----------|
| Hard gate | Build fails on validator errors; recurrence-5 prevention contract | ✓ |
| Advisory — log but don't fail | Weaker guarantee; right if transient validator noise expected | |
| Hard gate just for `[tab]/page.tsx` | Equivalent in practice since only one file has the export | |

**User's choice:** Hard gate

### Findings log

| Option | Description | Selected |
|--------|-------------|----------|
| New SEED-014 + CONTEXT note | Central log; clean phase separation | ✓ |
| Inline in Phase 52 RESEARCH.md only | Lives in phase archive; harder to surface later | |
| Comments in each opt-out site | Lowest friction; least discoverable | |

**User's choice:** New SEED-014 + CONTEXT note

---

## Playwright e2e test

### Install decision

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — install + add e2e test | Audit followup Step 7; catches the exact bug class | ✓ |
| No — vitest source-grep + manual UAT | Lowest friction; misses runtime regressions | |
| Defer Playwright | SEED-015 for e2e harness; operator may want runtime test NOW | |

**User's choice:** Yes — install Playwright + add e2e test
**Notes:** After four recurrences, operator wants runtime contract for chrome-mounted invariant.

### Auth setup

| Option | Description | Selected |
|--------|-------------|----------|
| Test-only seeded user + storageState | Standard Playwright pattern | ✓ |
| Mock cookies / inject session JWT | Faster; couples to Supabase cookie internals | |
| Defer auth setup; anon-redirect test only | Lowest blast radius | |

**User's choice:** Test-only seeded user + storageState

### Test target

| Option | Description | Selected |
|--------|-------------|----------|
| Local `npm run dev` only | Fastest CI feedback; doesn't catch edge divergence | ✓ |
| Against preview deploy in CI | Catches edge runtime; more setup | |
| Both | Strongest coverage; highest setup cost | |
| Local + post-deploy curl script | Curl script for prod-contract; local PW for invariant | |

**User's choice:** Local `npm run dev` only
**Notes:** `unstable_instant` validator covers structural defects; e2e is a complement.

### PW helper

| Option | Description | Selected |
|--------|-------------|----------|
| Use `@next/playwright` `instant()` | Framework-aligned contract | ✓ |
| Standard `@playwright/test` only | Cheaper deps; drifts from official semantics | |
| Both available, use `instant()` initially | Most flexible | |

**User's choice:** Use `@next/playwright` `instant()`

---

## Cleanup bundling

### CR-01 (proxy.ts safety comment)

| Option | Description | Selected |
|--------|-------------|----------|
| Fix inline in Phase 52 | Bundling avoids context-switch | ✓ |
| Defer to a separate cleanup phase | Cleaner phase boundaries | |
| Open a GitHub issue and defer | Risk of drift | |

**User's choice:** Fix inline in Phase 52

### `scripts/assert-phase-51-build.mjs`

| Option | Description | Selected |
|--------|-------------|----------|
| Delete; rely on `unstable_instant` validator | Audit followup's preferred option | ✓ |
| Fix to match Next 16.2 manifest shape | Defense-in-depth; ongoing maintenance | |
| Repurpose as `assert-phase-52-build.mjs` | Source-grep belt-and-suspenders; mild duplication | |

**User's choice:** Delete; rely on `unstable_instant` validator

### Diagnosis reversal doc updates

| Option | Description | Selected |
|--------|-------------|----------|
| Update both inline (page comment + Phase 51 CONTEXT) | Critical for next session not to be misled | ✓ |
| Update only the page comment | Phase 51 CONTEXT as historical artifact | |
| Add a `## Diagnosis Reversal` section to page comment | Preserves full history; more verbose | |

**User's choice:** Update both inline in Phase 52

### `.continue-here.md` blocking anti-pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Search + retire if found | Preemptive grep; no-op if none exists | ✓ |
| Skip — leave intact | Risk if one exists from a different workstream | |
| Add a NEW `.continue-here.md` in Phase 52 | Records corrected anti-pattern explicitly | |

**User's choice:** Search + retire if found

---

## loading.tsx reconciliation

### Boundary shape

| Option | Description | Selected |
|--------|-------------|----------|
| Keep all 3 boundaries | Audit's recommendation — "having all is harmless" | ✓ |
| Drop loading.tsx — page Suspense covers tab nav | Cleaner; risk on subtle prefetch-timing case | |
| Drop loading.tsx + shared skeleton component | + factor skeleton overlap | |

**User's choice:** Keep all 3

### loading.tsx comment

| Option | Description | Selected |
|--------|-------------|----------|
| Rewrite to match Phase 52's structure | Single source of truth for future debugging | ✓ |
| Delete the comment block | Self-explanatory after Phase 52; cheaper | |
| Move architectural explanation to a new ARCHITECTURE doc | Best for future debugging if pattern propagates | |

**User's choice:** Rewrite the comment to match Phase 52's structure

### Skeleton fidelity

| Option | Description | Selected |
|--------|-------------|----------|
| Intentionally distinct (current state) | Reinforces persistent-chrome UX; already implemented | ✓ |
| Identical — content-only skeleton everywhere | Simpler skeletons; less informative | |
| Audit + harmonize skeleton spacing/sizes | UI polish bundled in; risk of scope creep | |

**User's choice:** Intentionally distinct

### Suspense permanence

| Option | Description | Selected |
|--------|-------------|----------|
| Always keep layout Suspense | Structural rule per docs, not perf opt | ✓ |
| Suspense only if validator demands | Risk of drift | |
| Always Suspense + always async ProfileChrome | Same as recommended + explicit lock | |

**User's choice:** Always keep layout Suspense

---

## Claude's Discretion

- Final shape of the refactor is **validator-driven**. The proposed `ProfileChrome` + `ProfileTabContent` shape is a working hypothesis; planner spawns phase-researcher to confirm via docs, then produces executable shape based on actual validator output.
- Plan wave structure: Wave 0 (test scaffolds — TDD), Wave 1 (Step 1 probe), Wave 2 (refactor based on validator output), Wave 3 (cleanups + tests), Wave 4 (deploy + UAT). Planner's call.
- Exact SEED-014 structure is planner's call. Suggested: surfaced-route table (route, opt-out applied, suspected fix shape), confidence, sweep-ordering.

## Deferred Ideas

(See CONTEXT.md `<deferred>` section for full list — duplicated here for audit completeness.)

- `'use cache'` → `'use cache: remote'` migration for `ProfileShellResolver`
- Real 404 HTTP status for unknown username
- Vercel preview-deploy Playwright runs (Phase 52 ships with local dev target only)
- Broader Cache Components canonical-pattern sweep (captured as SEED-014)
- Skeleton pixel-fidelity audit
- Cleanup of stale comments across the profile route beyond the loading.tsx + page-comment updates
