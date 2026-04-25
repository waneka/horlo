# Deferred Items — Phase 15

Pre-existing issues observed during execution but out-of-scope for current plans.

## Plan 15-02 — pre-existing tsc errors (not introduced by this plan)

Observed via `npx tsc --noEmit` against base commit `8c831ae`:

- `src/app/u/[username]/layout.tsx(21,4)`: `Cannot find name 'LayoutProps'` — Next.js 16 LayoutProps generic type may need explicit import or redefinition
- `tests/components/preferences/PreferencesClient.debt01.test.tsx(86,67)` & `(129,7)`: `Type 'undefined' is not assignable to type 'UserPreferences'` — test fixtures pass undefined where typed prop is required

These are pre-existing on the base commit (verified by stashing 15-02 changes and re-running tsc). Not regressions; not blocking 15-02 verification.

## UAT Issue 1 — WristOverlaySvg geometry — DEFERRED to user

**File:** `src/components/wywt/WristOverlaySvg.tsx`

**Issues identified during 2026-04-25 iOS UAT:**
- Arm lines too close together (currently y=38/y=62 → 24 apart; should be ~10% smaller than outer-circle diameter — i.e., ~40 apart given outer r=22)
- Both clock hands are the same length (current SVG has them ending at y=27 in a "V" shape pointing up; canonical 10:10 needs hour hand shorter than minute hand)
- Hands not at canonical 10:10 (currently render closer to 11:05)
- Arm lines visible through watch face (should be clipped or masked behind the bezel)

**Status:** User taking ownership of the SVG redesign. Will hand-craft (or trace from a reference) and drop into the same file. The component's API (`className`, `viewBox`, `aria-hidden`) is stable — only the inner shapes need replacement. No surrounding code changes required.

**Camera centering** (UAT Issue 2) and **dialog scroll** (UAT Issue 3) were resolved in commits `60a2b0d` and `618a74a` respectively — only the overlay geometry remains.
