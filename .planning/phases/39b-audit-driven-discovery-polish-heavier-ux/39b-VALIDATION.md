---
phase: 39b
slug: audit-driven-discovery-polish-heavier-ux
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-13
---

# Phase 39b — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Hydrated from `39b-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `vitest` ^2.1.9 + `@testing-library/react` ^16.3.2 + `jsdom` (`environment: 'jsdom'`) |
| **Config file** | `vitest.config.ts` (verified at repo root) |
| **Quick run command** | `npx vitest run tests/static/ReferenceIdentityCard.no-engine.test.ts tests/components/profile/LockedTabCard.test.tsx tests/components/profile/WornCalendar.test.tsx tests/data/collectors.test.ts` |
| **Full suite command** | `npm test` (alias for `vitest run`) |
| **Estimated runtime** | ~1.5s quick / ~10–20s full |

---

## Sampling Rate

- **After every task commit:** Run quick command (subset above)
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~20 seconds

---

## Per-Task Verification Map

> Filled by gsd-planner during plan generation. Each task ID maps to its plan + wave + REQ-ID + threat ref. The planner attaches `<automated>` blocks to tasks.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _(planner fills)_ | | | | | | | | | ⬜ pending |

---

## Wave 0 Requirements

New test files (all created in Wave 0 — before Wave 1 UI plans depend on them):

- [ ] `tests/static/ReferenceIdentityCard.no-engine.test.ts` — mandated import-boundary guard (mirrors `CollectionFitCard.no-engine.test.ts`) — D-39b-01
- [ ] `tests/components/insights/ReferenceIdentityCard.test.tsx` — confidence ≥ 0.5 gate + suppression rule — NSV-06 / NSV-20
- [ ] `tests/components/profile/LockedTabCard.test.tsx` — logged-in FollowButton + unauthenticated sign-in link + `tab === 'common-ground'` returns null — NSV-14
- [ ] `tests/components/profile/WornCalendar.test.tsx` — `selectedDate` initializes to first event day + empty-day caption + day-cell onClick — NSV-14
- [ ] `tests/data/collectors.test.ts` (or extend `tests/data/discovery.test.ts`) — `getCollectorsForCatalog` two-layer privacy + self-exclusion + overfetch boundary — NSV-18
- [ ] `tests/data/hierarchy.test.ts` (extend `hierarchy.lineage-3-node.test.ts`) — `getSameFamilyForCatalog` + `getLineageForReference` imageUrl extension — NSV-02 / NSV-16

Wave 0 also ships:
- [ ] `scripts/seed-lineage.ts` — idempotent operator script (UPDATE…WHERE family_id IS NULL; INSERT…ON CONFLICT DO NOTHING)
- [ ] Operator commits ~20 family_id seeds + ~15 lineage edges to prod DB (D-39b-19; checkpoint, autonomous: false)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `scripts/seed-lineage.ts` writes to prod DB | D-39b-19 / NSV-02+16 | Touches production data; idempotency must be verified empirically | Operator runs `npm run db:seed-lineage` against prod with explicit DATABASE_URL override; verifies summary print (`family_patched=N family_skipped=0 edges_inserted=M edges_skipped=0`); re-runs and verifies the second run prints `family_patched=0 edges_inserted=0` (idempotent no-op). |
| Fresh-account `/watch/{id}` + `/catalog/{id}` smoke | NSV-06 / NSV-20 | Browser-level rendering against prod data | Sign in as a fresh account (empty collection), navigate to `/watch/{id}` and `/catalog/{id}` for a high-confidence watch — verify ReferenceIdentityCard renders above the 3-CTA block; navigate to a low-confidence catalog — verify card is suppressed, fallback caption + CTAs render. |
| Privacy-gated NSV-18 roster | NSV-18 / T-39b-01 | Cross-account browser verification | Sign in as viewer-A; navigate to `/catalog/{id}` that viewer-B (public-profile, public-collection) owns — verify viewer-B chip renders. Sign in as viewer-C (private-profile) and view the same page — verify viewer-C's own chip does NOT render. |
| Lineage rails on `/watch/{id}` + `/catalog/{id}` | NSV-02 / NSV-16 | Module-absent verification requires inspecting DOM for the absence of a section | After Wave 0 ships, navigate to a seeded catalog — verify Same family + Lineage rails render with cards. Navigate to a non-seeded catalog — verify both rails are DOM-absent (not rendered as empty cards). |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter
- [ ] Wave 0 operator smoke (`scripts/seed-lineage.ts` idempotent second-run) verified

**Approval:** pending
