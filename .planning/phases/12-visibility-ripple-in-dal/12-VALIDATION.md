---
phase: 12
slug: visibility-ripple-in-dal
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-22
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Sourced from `12-RESEARCH.md` §"Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 2.1.9 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test -- tests/integration/phase12-visibility-matrix.test.ts tests/data/getWearRailForViewer.test.ts tests/data/getFeedForUser.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds (quick), ~120 seconds (full) |
| **Env requirement (integration)** | `DATABASE_URL` + `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (auto-skip when absent) |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- tests/integration/phase12-visibility-matrix.test.ts`
- **After every plan wave:** Run `npm test -- tests/integration/phase12-visibility-matrix.test.ts tests/data/getWearRailForViewer.test.ts tests/data/getFeedForUser.test.ts tests/integration/home-privacy.test.ts`
- **Before `/gsd-verify-work`:** Full `npm test` must be green (no NEW failures vs Phase 11 baseline of 11 pre-existing failures)
- **Max feedback latency:** ~30 seconds per task

---

## Per-Task Verification Map

> Populated by planner from per-plan task IDs. Authoritative requirement→test mapping below.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _planner-fills_ | 01 | 0 | WYWT-10 | G-3 / G-5 | three-tier matrix | integration | `npm test -- tests/integration/phase12-visibility-matrix.test.ts` | ❌ Wave 0 | ⬜ pending |

### Phase Requirements → Test Cells (from RESEARCH §Validation Architecture)

| Req ID | Behavior | Test Type | File |
|--------|----------|-----------|------|
| WYWT-10 | `getWearEventsForViewer` — followers wear visible to follower, invisible to stranger, visible to self | integration matrix | `tests/integration/phase12-visibility-matrix.test.ts` (NEW, Wave 0) |
| WYWT-10 | `getWearRailForViewer` — followers tile only for followed actors; `worn_public=true` no longer surfaces follower-tier wear to non-followers | integration | `tests/integration/phase12-visibility-matrix.test.ts` |
| WYWT-10 | `getFeedForUser` — `metadata->>'visibility' IN ('public','followers')` gate; legacy NULL fails closed (D-09) | integration | `tests/integration/phase12-visibility-matrix.test.ts` |
| WYWT-10 | Profile worn tab non-owner — calls viewer-aware function; private wear hidden | integration | `tests/integration/phase12-visibility-matrix.test.ts` |
| WYWT-10 | Pitfall G-3 — directional follow check (A→B but not B→A) | integration | (above) |
| WYWT-10 | Pitfall G-4 — `profile_public=false` outer gate preserved even with `visibility='public'` wear | integration | (above) |
| WYWT-10 | Pitfall G-5 — owner sees own private wear in own surfaces | integration | (above) |
| WYWT-10 | `addToWishlistFromWearEvent` — uniform `'Wear event not found'` for follower-tier wear when viewer doesn't follow | integration | (above) |
| WYWT-10 | `getWearRailForViewer` SQL shape — visibility OR branch; no `profileSettings.wornPublic` reference | unit (modify existing) | `tests/data/getWearRailForViewer.test.ts` (MODIFY) |
| WYWT-10 | `getFeedForUser` SQL shape — `metadata->>'visibility'`; no `wornPublic` reference; legacy-NULL fail-closed assertion | unit (modify existing) | `tests/data/getFeedForUser.test.ts` (MODIFY) |
| WYWT-11 | `profile_settings.worn_public` column does not exist post-migration | integration (information_schema) | folded into matrix file final cell |
| WYWT-11 | `wornPublic` not in `src/db/schema.ts profileSettings` | unit (TS compile) | `npm run build` |
| WYWT-11 | `wornPublic` not in `src/data/profiles.ts ProfileSettings` | unit (TS compile) | `npm run build` |
| WYWT-11 | `wornPublic` toggle absent from rendered SettingsClient | grep verification (no RTL test currently) | `grep -rn "wornPublic" src/components/settings/` returns empty |
| Repo-wide invariant | Zero `wornPublic`/`worn_public` references in `src/` and `tests/` outside `supabase/migrations/` | shell verification | `grep -rn "wornPublic\|worn_public" src/ tests/ \| grep -v supabase/migrations` returns empty |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/integration/phase12-visibility-matrix.test.ts` — full three-tier × three-viewer matrix (NEW); covers G-3, G-4, G-5, G-7, D-09, WYWT-11 column-drop final cell
- [ ] `tests/data/getWearRailForViewer.test.ts` — MODIFY: replace `wornPublic` assertions with `visibility` SQL-shape assertions (mock-chain pattern)
- [ ] `tests/data/getFeedForUser.test.ts` — MODIFY: extend with `metadata->>'visibility'` shape assertions; add legacy-NULL fail-closed assertion
- [ ] (Optional) `tests/data/getWearEventsForViewer.test.ts` — per-function unit test for the new viewer-aware DAL function (or fold into existing wearEvents.test.ts if present)

**Privacy-first ordering rule:** All Wave 0 test files MUST exist and be authored before any DAL function is touched. The matrix file's negative cells (stranger sees followers wear) MUST run BEFORE positive cells in the same describe block — catches inverted G-3 first.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| End-to-end UAT — three test accounts (owner/follower/stranger), wears at all three visibility tiers, rendering across home rail / profile worn tab / feed | WYWT-10 | Privacy-first UAT rule (per SUMMARY.md / v2.0 retrospective) — visual confirmation that no private/follower-only event leaks to a stranger's rendered surface | (1) Seed three test accounts; (2) follower follows owner, stranger does not; (3) owner logs three wears (public, followers, private); (4) verify each viewer's home rail, profile-of-owner worn tab, and feed; (5) confirm G-4 outer gate by toggling owner's `profile_public=false` — all wears should disappear from non-owner surfaces |
| Settings UI no longer shows the `wornPublic` toggle | WYWT-11 / D-06 | Visual verification that the row is gone (grep covers source, but the rendered DOM is the user-facing truth) | Open `/settings` in dev; confirm no "Show worn timeline publicly" toggle row |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (matrix file + 2 modified unit files)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s per task
- [ ] `nyquist_compliant: true` set in frontmatter (planner sets after Per-Task Verification Map is filled)

**Approval:** pending
