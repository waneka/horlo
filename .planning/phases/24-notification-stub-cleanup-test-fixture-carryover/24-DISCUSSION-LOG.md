# Phase 24: Notification Stub Cleanup + Test Fixture & Carryover - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-01
**Phase:** 24-notification-stub-cleanup-test-fixture-carryover
**Areas discussed:** None — user delegated all gray areas to Claude's Discretion

---

## Gray Area Selection

| Area | Description | Selected |
|------|-------------|----------|
| TEST-04/05/06 coverage depth | Minimum-viable smoke vs. standard representative vs. comprehensive | (delegated) |
| Pre-flight assertion location | Migration DO block vs. standalone script vs. both | (delegated) |
| Type-union narrowing aggressiveness | Aggressive narrow vs. keep-wider | (delegated) |
| wornPublic regression-lock tests | Delete vs. keep-as-historical vs. rewrite as wear_visibility positive | (delegated) |

**User's choice:** "No discussion, you choose"

**Notes:** User opted out of interactive gray-area discussion entirely. Phase 24 is mechanical cleanup with mostly-locked decisions from ROADMAP success criteria + PROJECT.md Key Decisions; the four remaining gray areas were resolved by Claude in CONTEXT.md as Claude's Discretion (D-01..D-04) with full rationale for each.

---

## Claude's Discretion (Captured in CONTEXT.md)

| Decision | Captured Choice | Alternative(s) Rejected |
|----------|-----------------|-------------------------|
| D-01 Pre-flight assertion | Both script + in-migration DO block | Script-only (single point of failure); in-migration-only (no deploy-prep visibility) |
| D-02 TEST-04/05/06 depth | Standard representative coverage | Minimum-viable smoke (re-defers v1.0 debt); comprehensive table-driven (scope blow-up) |
| D-03 Type-union narrowing | Aggressive narrow (`'follow' \| 'watch_overlap'`) | Keep wider type to mirror enum (loses TS-as-deletion-oracle leverage) |
| D-04 wornPublic regression-locks | Rewrite as positive `wear_visibility` assertions | Delete (loses architectural intent); keep as-is (dead negative checks) |

D-05 (commit / sequencing order) was a fifth Claude-resolved decision not originally listed as a gray area — derived from success criteria #2's explicit "Drizzle pgEnum is updated AFTER prod migration applies" requirement.

## Deferred Ideas

None — discussion stayed within phase scope (no scope-creep prompts surfaced).
