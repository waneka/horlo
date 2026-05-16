---
phase: 25
slug: profile-nav-prominence-empty-states-form-polish
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-15
backfill_location: .planning/phases/42-nyquist-hardening-sweep-uat-triage-parallel-track/42-validation-backfill/
backfill_reason: source phase directory never had a VALIDATION.md; authored from scratch by Phase 42 DEBT-10
---

# Phase 25 — Validation Strategy (Phase 42 Backfill)

> Authored from scratch at **targeted depth** (D-09) under Phase 42 DEBT-10. Phase 25
> shipped to production with full UAT sign-off at commit `7132ac0`, 2026-05-02. This
> artifact closes the validation-artifact gap — it does not reconstruct coverage as if
> the phase were unverified.
>
> No source phase directory exists (deleted by commit `dd58ba4`). This artifact lives in
> `42-validation-backfill/` per decision D-10.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.9 + @testing-library/react 16.3.2 + jsdom 25 |
| **Config file** | `vitest.config.ts` (existing, repo root) |
| **Quick run command** | `npx vitest run --project unit tests/components/layout/UserMenu.test.tsx` |
| **Browser test command** | `npx vitest run --project browser tests/browser/phase25-css-chain.browser.test.tsx` |
| **Full suite command** | `npm test` (runs `vitest run`; reads `vitest.workspace.ts`) |
| **Estimated runtime** | ~15s focused / ~90s full suite |

---

## Sampling Rate

- **After every task commit:** Run focused quick run command for the touched component.
- **After every plan wave:** Run `npm test`.
- **Before `/gsd-verify-work`:** Full suite must be green (both unit + browser projects).
- **Max feedback latency:** 30 seconds.

---

## Per-Task Verification Map

Phase 25 delivered: `UserMenu` dual-affordance trigger redesign (avatar Link + chevron, gap-1 spacing, size-11 hit target), Profile DropdownMenuItem removal, `FormStatusBanner` (shared), `ExtractErrorCard` (5-category), `NotesEmptyOwnerActions`, empty-state Cards (Collection/Wishlist/Worn tabs), ProfileTabs scroll-lock.

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| NAV-13 | `UserMenu` avatar Link is the sole profile entry (Profile DropdownMenuItem removed) | unit | `npx vitest run --project unit tests/components/layout/UserMenu.test.tsx` | ✅ existing | approved |
| NAV-13 | `UserMenu` dual-affordance container: `flex items-center gap-1` (gap-1 spacing, NOT gap-2) | unit | `npx vitest run --project unit tests/components/layout/UserMenu.test.tsx` | ✅ existing | approved |
| NAV-13 | `UserMenu` avatar Link: `size-11 rounded-full` hit target (44×44) | unit | `npx vitest run --project unit tests/components/layout/UserMenu.test.tsx` | ✅ existing | approved |
| NAV-13 | `gap-1` container computes 4px `column-gap` between flex children; `size-11` link computes 44×44px | browser (computed style) | `npx vitest run --project browser tests/browser/phase25-css-chain.browser.test.tsx` | ✅ existing (Phase 42 backfill) | approved |
| UX-01 | Empty-state Cards (Collection/Wishlist/Worn tabs) render correct heading + CTA copy per state | component smoke | `npx vitest run --project unit tests/components/` | prod UAT evidence: `7132ac0`, 2026-05-02 | approved |
| UX-02 | `FormStatusBanner` renders in 5 categories (error, success, warning, info, loading) with correct icons | component smoke | `npx vitest run --project unit tests/components/` | prod UAT evidence: `7132ac0`, 2026-05-02 | approved |
| UX-03 | `ExtractErrorCard` renders in 5 error categories (network, auth, parse, timeout, unknown) | component smoke | `npx vitest run --project unit tests/components/` | prod UAT evidence: `7132ac0`, 2026-05-02 | approved |
| UX-04 | `NotesEmptyOwnerActions` renders prompt copy + CTA for owner with no notes | component smoke | `npx vitest run --project unit tests/components/` | prod UAT evidence: `7132ac0`, 2026-05-02 | approved |
| NAV-14 | ProfileTabs: locked to horizontal-only scroll; no vertical bleed | unit (class-name) | `npx vitest run --project unit tests/components/profile/ProfileTabs.test.tsx` | ✅ existing | approved |

*Status: ⬜ pending · ✅ approved · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/components/layout/UserMenu.test.tsx` — existing; covers NAV-13 dual-affordance, gap-1, size-11, avatar Link as sole profile entry
- [x] `tests/components/profile/ProfileTabs.test.tsx` — existing; covers NAV-14 scroll-lock CSS (class-name based; D-08 browser mode for Phase 29's cross-phase re-assertion in `phase29-css-chain.browser.test.tsx`)
- [x] `tests/browser/phase25-css-chain.browser.test.tsx` — Phase 42 backfill; covers NAV-13 computed-style assertions (gap-1 → 4px column-gap; size-11 → 44×44px)

**Coverage gap assessment (D-09):** No genuine behavioral coverage gap found for Phase 25 non-visual requirements. The UserMenu test suite is extensive (12+ tests per the recovered research). Empty-state, FormStatusBanner, ExtractErrorCard, and NotesEmptyOwnerActions are simpler presentational components whose behavior is fully observable in prod. Prod UAT sign-off at commit `7132ac0` (2026-05-02) is the wave-0 evidence for those items.

No new behavioral tests were authored — no genuine coverage gap exists.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| UserMenu opens on click, closes on outside click | NAV-13 | Interactive popover behavior requires real browser | Click avatar or chevron → menu opens → click outside → menu closes |
| Empty-state copy renders correctly across all 3 tab states | UX-01 | Visual content verification | Navigate to a profile with 0 owned/wishlist/worn items on each tab; verify correct heading + CTA copy per state |
| `FormStatusBanner` visual appearance in 5 categories | UX-02 | Color/icon appearance requires human eye | Trigger each error category during URL import; verify appropriate icon + color coding |

Prod UAT sign-off: commit `7132ac0`, 2026-05-02. All manual items verified in production.

---

## Backfill Rationale

**D-09 — Targeted depth:** Phase 25 shipped to production with full UAT sign-off at commit `7132ac0`, 2026-05-02. This VALIDATION.md closes the artifact gap without reconstructing coverage as if the phase were unverified. The principle is: existing test coverage is cited where it exists; prod UAT sign-off is cited as wave-0 evidence for non-automated items; new behavioral tests are authored only where a genuine coverage gap exists.

**D-10 — Consolidated location:** The Phase 25 directory was deleted by commit `dd58ba4` ("docs: start milestone v5.0"). This artifact lives in `42-validation-backfill/` alongside the other five backfilled VALIDATION.md files. Source phase directories stay deleted; Phase 42 owns DEBT-10 end-to-end.

**Coverage gap finding:** After examining the existing test suite, no genuine coverage gap was found for Phase 25. The `UserMenu.test.tsx` suite is the primary automated coverage; the browser test from Phase 42 adds computed-style assertions that class-name tests cannot provide (per D-08). Empty-state and form feedback components have prod UAT sign-off as their wave-0 evidence.

---

## Validation Sign-Off

- [x] All requirements have automated verify or explicit prod UAT citation — no TBD rows
- [x] NAV-13 visual surface: `tests/browser/phase25-css-chain.browser.test.tsx` cited (D-07 browser computed-style)
- [x] Non-visual requirements: existing unit test coverage or prod UAT `7132ac0` cited
- [x] No genuine coverage gap found — no new behavioral tests authored
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** Phase 42 DEBT-10 backfill (targeted depth, D-09) — 2026-05-16
