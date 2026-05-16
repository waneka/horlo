# Phase 42: Nyquist Hardening Sweep + UAT Triage — Research

**Researched:** 2026-05-15
**Domain:** Vitest browser mode + CSS computed-style testing + planning-artifact authoring
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Claude pre-triages all ~33 UAT items with cited evidence before execution. SUPERSEDED and DEFERRED items close on evidence alone. Items that genuinely survive become the CLOSED-candidate set.
- **D-02:** CLOSED-candidate set runs as a blocking `42-HUMAN-UAT.md` checklist (same pattern as `41-HUMAN-UAT.md`). Execution pauses for user sign-off before the phase can close.
- **D-03:** Ambiguous items default to CLOSED-candidate (err toward running, not deferring).
- **D-04:** Fold in the 5 stale Phase 20.1 debug entries (status: diagnosed) → move to `.planning/debug/resolved/`. Items: `verdict-empty-collection-message`, `wishlist-textarea-not-prefilled`, `recently-evaluated-rail-missing` (06); `search-row-expand-broken` (07); `no-escape-from-manual-entry` (08).
- **D-05:** Closure table appended to this CONTEXT.md as a `<triage>` section during execution.
- **D-06:** Add Playwright as the CSS-chain assertion tool — committed regardless of jsdom sufficiency.
- **D-07:** Browser-based computed-style assertions cover all visual surfaces touched by Phases 25–31.
- **D-08:** All new assertions check computed styles, not class names.
- **D-09:** Targeted depth for Phase 25/26 VALIDATION.md — cite existing test coverage + prod UAT sign-off (commit `7132ac0`) for non-visual reqs; author new behavioral tests only where genuine coverage gap exists.
- **D-10:** All 6 VALIDATION.md files consolidated under `42-validation-backfill/` subfolder inside this phase directory. Source phase directories stay deleted.

### Claude's Discretion

- **Existing partial VALIDATION.md (27, 28, 30, 31):** Recover from git history (`git show dd58ba4^:<path>`), root-cause what made it `partial`, close that specific gap, add D-07 browser tests for visual surfaces, then flip frontmatter to `nyquist_compliant: true` + `wave_0_complete: true`.
- **Playwright integration mechanism:** Prefer Vitest browser mode (`vitest --browser` with Playwright provider) over a standalone `@playwright/test` runner.
- **Consolidated filenames:** Inside `42-validation-backfill/`, keep original phase-numbered names (`25-VALIDATION.md` … `31-VALIDATION.md`).
- **UAT item sourcing:** Use `v4.0-MILESTONE-AUDIT.md` `items:` blocks as the authoritative source list.

### Deferred Ideas (OUT OF SCOPE)

- **DEBT-12 (drizzle journal repair)** — unscheduled/opportunistic, NOT in Phase 42.
- **CI pipeline** — no `.github/workflows/` exists; setting up CI is a separate concern.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEBT-10 | Nyquist hardening sweep: author VALIDATION.md for Phases 25/26 (missing), upgrade Phases 27/28/30/31 from `partial` to `nyquist_compliant: true` + `wave_0_complete: true`; Phase 30 gains CSS-chain assertions checking computed styles | §Architecture Patterns, §Standard Stack, §Code Examples |
| DEBT-11 | Triage all ~33 deferred human UAT items across v4.0 Phases 18/20/20.1/22/23; produce a closure table (CLOSED / SUPERSEDED / DEFERRED with evidence); blocking HUMAN-UAT.md for CLOSED candidates | §UAT Source Material, §Architecture Patterns |

</phase_requirements>

---

## Summary

Phase 42 is a documentation + testing-infrastructure phase: no product code ships, no schema changes, no dependency on the catalog serial spine. It closes two tech-debt items (DEBT-10, DEBT-11) that have accumulated since the v4.0 and v4.1 milestones.

**DEBT-10 (Nyquist hardening)** requires authoring or upgrading six VALIDATION.md files, consolidated into a `42-validation-backfill/` folder, and wiring real-browser computed-style assertions for the visual surfaces those phases built. The highest-stakes upgrade is Phase 30 (the `h-full` hotfix regression the CSS-chain blind spot let through). The core research question — is Vitest 2.1.9 browser mode viable on this stack? — is answered YES with specific packages and config shape documented below.

**DEBT-11 (UAT triage)** requires pre-triaging all 33 items using evidence from gap-closure plans (20.1-06/07/08) and Phase 39/39b changes, then running the survivor set as a blocking human UAT checklist. The authoritative item source is `v4.0-MILESTONE-AUDIT.md`.

Two important pre-existing findings reduce scope: (1) all 5 stale debug entries listed in D-04 have ALREADY been moved to `.planning/debug/resolved/` — this task is already done and need not be replanned; (2) `git show dd58ba4^:<path>` works for all five deleted VALIDATION.md paths (27, 28, 29, 30, 31) — recovery is straightforward.

**Primary recommendation:** Use Vitest 2.1.9 browser mode with `@vitest/browser@2.1.9` + `playwright` (string provider). Maintain a `vitest.workspace.ts` with two projects — jsdom for all existing tests, browser/chromium for the new `.browser.test.tsx` files. No Vitest upgrade needed. The `@vitest/browser-playwright` package exists but is a v3/v4 artifact — do not install it for this stack.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| CSS computed-style assertions | Browser (real Chromium via Playwright) | — | jsdom's `getComputedStyle` does not compute Tailwind utility chains; only a real browser resolves `h-full` → computed `height`, `object-cover` → computed `object-fit` |
| Phase VALIDATION.md authoring | Planning artifacts (no code tier) | — | Pure documentation; no runtime tier involved |
| UAT triage closure table | Planning artifacts | Human verification | D-02 blocking checklist requires human sign-off before phase close |
| Test file scaffolding (Wave 0) | Dev tooling | Existing test infra | Additive on top of Vitest 2.1.9 + jsdom suite |
| Debug entry movement (D-04) | File-system housekeeping | — | Already complete — not a Phase 42 planning concern |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `vitest` | `^2.1.9` (installed) | Test runner | Project-locked; do NOT upgrade |
| `@vitest/browser` | `2.1.9` | Enables browser mode; must match vitest version exactly | Exact peer dep: `{ vitest: '2.1.9' }` [VERIFIED: npm registry] |
| `playwright` | latest (`^1.60.0`) | Browser automation provider for `@vitest/browser` | Peer dep: `playwright: '*'` in `@vitest/browser@2.1.9`; currently at 1.60.0 on npm [VERIFIED: npm registry] |

### Do NOT Install (Wrong Version)

| Package | Why Wrong |
|---------|-----------|
| `@vitest/browser-playwright` | This is a v3/v4 package (4.1.6 latest); does NOT exist for v2.x [VERIFIED: npm registry] |
| `vitest@latest` (upgrade) | Latest is 4.1.6; upgrading risks breaking this project's Next.js 16 + React 19 compatibility; DEBT-10 does not warrant the risk |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@playwright/test` | — | Standalone Playwright test runner | Fallback ONLY if Vitest browser mode proves unviable; would require a second config and second `package.json` script |

**Installation:**
```bash
npm install --save-dev @vitest/browser@2.1.9 playwright
npx playwright install chromium
```

**Version verification (confirmed):**
```bash
npm view @vitest/browser@2.1.9 peerDependencies
# → { vitest: '2.1.9', playwright: '*', webdriverio: '*' }
npm view @vitest/browser version  # → 2.1.9 exists ✓
npm view playwright version       # → 1.60.0 ✓
```

---

## Architecture Patterns

### System Architecture Diagram

```
npm test (vitest run, reads vitest.workspace.ts)
        │
        ├── Project: "unit" (environment: jsdom)
        │     include: tests/**/*.test.{ts,tsx} (existing suite)
        │     └── All existing 27-VALIDATION / 28-VALIDATION etc. math tests
        │
        └── Project: "browser" (environment: browser, provider: playwright/chromium)
              include: tests/**/*.browser.test.{ts,tsx}
              │
              ├── Phase 25 browser tests  (UserMenu avatar, empty-state card CSS)
              ├── Phase 26 browser tests  (WearDetailHero aspect-ratio + object-cover chain)
              ├── Phase 27 browser tests  (ProfileWatchCard aspect-[4/5] + object-cover chain)
              ├── Phase 28 browser tests  (AddWatchFlow layout, WishlistRationalePanel)
              ├── Phase 29 browser tests  (ProfileTabs scroll overflow)
              └── Phase 30 browser tests  ← HIGHEST PRIORITY
                    CameraCaptureView: `aspect-square` wrapper computes square dimensions
                    <video>: h-full + w-full → computed height fills wrapper
                    <video>: object-cover computed value = 'cover'
                    (assertions that WOULD HAVE caught the h-full hotfix regression)
```

### Recommended Project Structure

```
.planning/phases/42-nyquist-hardening-sweep-uat-triage-parallel-track/
├── 42-CONTEXT.md          (this file — triage closure table appended here)
├── 42-RESEARCH.md         (this file)
├── 42-HUMAN-UAT.md        (D-02 blocking checklist — created during execution)
├── 42-VALIDATION.md       (this phase's own Nyquist artifact)
└── 42-validation-backfill/
    ├── 25-VALIDATION.md   (authored from scratch — D-09 targeted depth)
    ├── 26-VALIDATION.md   (authored from scratch — D-09 targeted depth)
    ├── 27-VALIDATION.md   (recovered + upgraded — root-cause: Wave 0 tests never landed)
    ├── 28-VALIDATION.md   (recovered + upgraded — root-cause: per-task map was TBD)
    ├── 30-VALIDATION.md   (recovered + upgraded — root-cause: Wave 0 test file missing)
    └── 31-VALIDATION.md   (recovered — root-cause: docs-only phase, Nyquist not applicable)

tests/
└── browser/
    ├── phase25-css-chain.browser.test.tsx
    ├── phase26-css-chain.browser.test.tsx
    ├── phase27-css-chain.browser.test.tsx
    ├── phase28-css-chain.browser.test.tsx
    ├── phase29-css-chain.browser.test.tsx
    └── phase30-css-chain.browser.test.tsx   ← most critical
```

### Pattern 1: Vitest 2.1.9 Workspace Config (jsdom + browser mode)

**What:** A `vitest.workspace.ts` file at the repo root defines two projects in a single runner. The existing `vitest.config.ts` is preserved but the workspace takes over routing.

**When to use:** Whenever the project needs both jsdom-environment tests (existing suite) and real-browser-environment tests (new CSS-chain assertions) under one `npm test` command.

```typescript
// vitest.workspace.ts (NEW — repo root)
import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  {
    // Inherit existing vitest.config.ts settings for the unit suite
    extends: './vitest.config.ts',
    test: {
      name: 'unit',
      // All existing tests — environment is jsdom (inherited from vitest.config.ts)
      include: [
        'tests/**/*.test.ts',
        'tests/**/*.test.tsx',
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
      ],
      // Exclude browser tests from the unit project
      exclude: ['tests/browser/**'],
    },
  },
  {
    test: {
      name: 'browser',
      include: ['tests/browser/**/*.browser.test.{ts,tsx}'],
      browser: {
        enabled: true,
        provider: 'playwright',  // string literal — v2.x API, NOT a function import
        name: 'chromium',        // v2.x uses `name`, NOT `instances`
        headless: true,
      },
      // Alias @/* to src/ — same as vitest.config.ts
      resolve: {
        alias: {
          '@': new URL('./src', import.meta.url).pathname,
        },
      },
    },
  },
])
```

**IMPORTANT:** In Vitest v2.x the browser provider is set via `provider: 'playwright'` (a string). The v3/v4 API uses `provider: playwright()` (a function import from `@vitest/browser-playwright`) — that pattern does NOT apply here. [VERIFIED: v2.vitest.dev]

**`package.json` test script stays unchanged:**
```json
"test": "vitest run"
```
When a `vitest.workspace.ts` is present at the root, `vitest run` automatically picks it up and runs both projects. No script change needed. [VERIFIED: Vitest 2.x workspace docs]

### Pattern 2: Rendering a React Component in Browser Mode and Reading Computed Styles

**What:** In Vitest browser mode the test runs in a real Chromium process. `window.getComputedStyle()` returns the actual browser-computed value — Tailwind utility classes are resolved by the real CSS engine.

**The acceptance bar:** An assertion that "would have caught the `h-full` hotfix regression." The regression was: `<video>` lacked `h-full`, so `object-cover` had no height to cover against, producing a black bar. The browser-mode assertion must check `computed height` and `object-fit` on the video element.

**Concrete pattern for Phase 30 (CameraCaptureView):**

```typescript
// tests/browser/phase30-css-chain.browser.test.tsx
// Source: vitest.dev/guide/browser — getComputedStyle in browser mode
import { render, screen } from '@testing-library/react'
import CameraCaptureView from '@/components/wywt/CameraCaptureView'

describe('Phase 30 CSS-chain assertions (DEBT-10 D-08)', () => {
  // This test WOULD HAVE caught the h-full hotfix regression:
  // Before the hotfix: <video> had no h-full class → computed height was 0px or auto
  // After the hotfix: <video> has h-full → computed height fills the aspect-square wrapper
  it('video element has computed height that fills its aspect-square container', async () => {
    // Render into the real browser DOM (Playwright/Chromium)
    render(<CameraCaptureView /* minimal props */ />)

    const wrapper = screen.getByTestId('camera-wrapper')  // or query by role/class
    const video = wrapper.querySelector('video')!

    const wrapperStyle = window.getComputedStyle(wrapper)
    const videoStyle = window.getComputedStyle(video)

    // wrapper: aspect-square → height equals width
    const wrapperWidth = parseFloat(wrapperStyle.width)
    const wrapperHeight = parseFloat(wrapperStyle.height)
    expect(Math.abs(wrapperHeight - wrapperWidth)).toBeLessThanOrEqual(1)

    // video: h-full w-full → fills wrapper (NOT 0px)
    const videoHeight = parseFloat(videoStyle.height)
    expect(videoHeight).toBeGreaterThan(0)
    expect(videoHeight).toBeCloseTo(wrapperHeight, 0)

    // video: object-cover class → computed object-fit is 'cover'
    expect(videoStyle.objectFit).toBe('cover')
  })
})
```

**Note on test ID:** If `CameraCaptureView` doesn't expose a `data-testid`, use `document.querySelector('.aspect-square')` or add a testid via a minimal prop. The assertion shape is what matters; the selector is implementation detail for the planner.

### Pattern 3: Recovering Deleted VALIDATION.md from Git History

**What:** All four deleted VALIDATION.md files are recoverable via `git show dd58ba4^:<path>`. All five paths were verified to work in this research session.

```bash
# Recover each file:
git show dd58ba4^:.planning/phases/27-watch-card-collection-render-polish/27-VALIDATION.md
git show dd58ba4^:.planning/phases/28-add-watch-flow-verdict-copy-polish/28-VALIDATION.md
git show dd58ba4^:.planning/phases/30-wywt-capture-alignment-fix/30-VALIDATION.md
git show dd58ba4^:.planning/phases/31-v4-0-verification-backfill/31-VALIDATION.md
# (Phase 29 — the COMPLIANT exemplar, also recoverable):
git show dd58ba4^:.planning/phases/29-nav-profile-chrome-cleanup/29-VALIDATION.md
```

All five commands return valid YAML-frontmatter Markdown files. [VERIFIED: git show in this session]

### Pattern 4: The 41-HUMAN-UAT.md Pattern (D-02 Reuse)

`41-HUMAN-UAT.md` has this shape:

```yaml
---
status: partial
phase: 41-account-danger-zone-branded-auth-emails-parallel-track
source: [41-VERIFICATION.md]
started: 2026-05-16T03:30:00Z
updated: 2026-05-16T03:30:00Z
---

## Current Test
[awaiting human testing]

## Tests

### N. [Test description]
expected: [precise expected behavior]
result: [pending / pass / fail]

## Summary
total: N
passed: 0
issues: 0
pending: N
...

## Gaps
```

The `42-HUMAN-UAT.md` follows this exact shape. Each CLOSED-candidate UAT item from D-01 pre-triage becomes one numbered test entry. The user updates `result:` for each. Phase 42 cannot close until all results are `pass` or the item is reclassified to DEFERRED.

### Pattern 5: VALIDATION.md Frontmatter Shape (from Phase 29 compliant exemplar)

```yaml
---
phase: 29
slug: nav-profile-chrome-cleanup
status: approved
nyquist_compliant: true
wave_0_complete: false   # NOTE: even the compliant Phase 29 has wave_0_complete: false
created: 2026-05-05
---
```

**Key finding:** Phase 29 is the only `nyquist_compliant: true` exemplar in v4.1, and it has `wave_0_complete: false`. For Phases 25/26/27/28/30 the target is `nyquist_compliant: true` + `wave_0_complete: true` (per DEBT-10 and ROADMAP SC#1). This means Phase 42 must achieve a higher standard than even Phase 29 reached.

Phase 41's VALIDATION.md sets the current reference shape:
```yaml
---
phase: 41
slug: account-danger-zone-branded-auth-emails-parallel-track
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-15
---
```

### Anti-Patterns to Avoid

- **Class-name assertions in browser tests:** `expect(element.classList.contains('h-full')).toBe(true)` is explicitly forbidden by D-08 and REQUIREMENTS.md. Always check `getComputedStyle(el).height`, not class presence.
- **Installing `@vitest/browser-playwright`:** This is a v3/v4-only package. Installing it alongside Vitest 2.1.9 will cause version conflicts.
- **Upgrading Vitest:** The project uses `^2.1.9`; latest is 4.1.6. An upgrade risks Next.js 16 / React 19 compatibility breakage. DEBT-10 does not justify this risk.
- **Using jsdom getComputedStyle for Tailwind:** jsdom does not load Tailwind's PostCSS output. `getComputedStyle` in jsdom always returns empty strings for Tailwind utility properties. Real browser mode is the only honest check.
- **Re-litigating shipped phases (D-09):** Phases 25/26 had full prod UAT sign-off at commit `7132ac0`. Do not reconstruct full coverage. Cite the prod approval + cite existing test-suite coverage. Author new tests only for genuine gaps.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Real-browser computed-style testing | Custom Playwright `@playwright/test` runner with second config | `@vitest/browser@2.1.9` workspace project | One runner, one `npm test` command, no dual config; vitest v2.1.9 browser mode has its own Playwright provider [VERIFIED] |
| CSS class-name assertions | `classList.contains('h-full')` checks | `window.getComputedStyle(el).height` in browser mode | Class names don't prove CSS chain resolves correctly; h-full regression shipped through 6/6 PASS on class-name checks |

**Key insight:** The v4.1 feedback memory documents exactly why class-name assertions are insufficient. The 6-pillar checker validated declared tokens, not whether the CSS chain produced the claimed visual contract. Phase 30's black-bar shipped through 6/6 PASS. Only computed styles in a real browser can catch this category of regression.

---

## Root-Cause Analysis: Why 27, 28, 30, 31 are `partial`

Recovered VALIDATION.md files confirm the specific gaps for each:

| Phase | `nyquist_compliant` | `wave_0_complete` | Root Cause of `partial` Status |
|-------|--------------------|--------------------|-------------------------------|
| 27 | false | false | Per-task verification map exists but all Wave 0 test files are marked `❌ W0` (not created). Tests listed: phase27-schema.test.ts, phase27-backfill.test.ts, watches-bulkReorder.test.ts, reorderWishlist.test.ts, watches-getWatchesByUser-orderBy.test.ts, ProfileWatchCard-priceLine.test.tsx, CollectionTabContent.test.tsx. Approval was pending Wave 0 delivery. |
| 28 | false | false | Per-task map row had `TBD` in all columns — planner never filled the table. Wave 0 test stubs were listed but not created. Approval pending planner completing the map. |
| 30 | false | false | Wave 0 test file `tests/components/wywt/CameraCaptureView.test.tsx` was the sole gap. **This file now EXISTS** (the hotfix plan created it with 4 math tests). So Phase 30's only remaining gap is the D-08 computed-style assertion (class-name math tests exist; browser-mode CSS chain assertion does not). |
| 31 | false | false | Phase 31 is a docs-only phase — the VALIDATION.md itself notes "Out of Nyquist Scope: This phase does not modify production code, does not add tests, and produces no executable artifacts." The `nyquist_compliant: false` is intentionally kept. **Implication:** Phase 31's VALIDATION.md should remain `nyquist_compliant: false` with explicit documentation of why — it is not upgradeable in the traditional sense. The planner should confirm with the user or treat this as a known deviation. |

[VERIFIED: git show dd58ba4^ recovery in this session]

---

## Visual Surfaces by Phase (D-07 Scope)

The browser tests in D-07 cover "all visual surfaces touched by Phases 25–31." Here is what each phase actually shipped:

| Phase | Visual Surfaces | CSS Chain at Risk | Priority for Browser Test |
|-------|----------------|-------------------|--------------------------|
| 25 | `UserMenu` avatar+chevron trigger; `FormStatusBanner` (shared); `ExtractErrorCard` (5-category); `NotesEmptyOwnerActions`; empty-state Cards (Collection/Wishlist/Worn tabs) | Layout of cards + inline feedback banners | MEDIUM — layout correctness |
| 26 | `WearDetailHero` (`w-full aspect-[4/5] overflow-hidden` wrapper + `w-full h-full object-cover` image); `WearPhotoClient` (same wrapper pattern × 3 states) | `aspect-[4/5]` → computed ratio; `h-full object-cover` → computed height > 0 and objectFit = 'cover' | HIGH — same class of failure as Phase 30 |
| 27 | `ProfileWatchCard` (`aspect-[4/5]` wrapper + `object-cover` Next.js Image); `CollectionTabContent` + `WishlistTabContent` grid (`grid-cols-2`) | `aspect-[4/5]` → computed dimensions; grid layout → 2 columns | HIGH — WishlistTabContent also uses SortableContext DnD which does not affect static CSS chain |
| 28 | `AddWatchFlow` (layout unchanged in Phase 28; copy changes only); `WishlistRationalePanel` (prose layout) | Low — Phase 28 was primarily copy/logic; no new aspect-ratio/object-fit surfaces | LOW — minimal visual surface |
| 29 | `ProfileTabs` (`overflow-x-auto overflow-y-hidden pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`) | Scroll overflow CSS — jsdom cannot test this; browser mode required | MEDIUM — overflow behavior |
| 30 | `CameraCaptureView` wrapper (`aspect-square`) + `<video>` (`h-full w-full object-cover`) | THE regression surface — `h-full` → computed height fills wrapper; without it, computed height = 0 | CRITICAL — this is the acceptance bar |
| 31 | None (docs-only phase) | N/A | SKIP |

**Phase 26 and Phase 30 have the same class of failure risk.** `WearDetailHero` uses `h-full object-cover` on `<img>` — the same pattern as `CameraCaptureView`'s `<video>`. Browser tests for Phase 26 should mirror Phase 30's assertions.

---

## UAT Source Material (DEBT-11)

### Item Counts by Phase

```
Phase 18 (/explore Discovery Surface): 9 items
Phase 20 (Collection Fit + Verdict Copy): 5 items
Phase 20.1 (Add-Watch Flow Rethink): 8 items
Phase 20.1 debug hygiene note: 5 stale debug entries (D-04) — ALREADY RESOLVED
Phase 22 (Settings Restructure + Account): 6 items
Phase 23 (Settings Sections + Schema-Field UI): 5 items
TOTAL: 33 items
```

### Pre-Triage Signal (from audit)

The v4.0 Milestone Audit provided pre-triage signals the planner and executor can use:

- **Phase 20.1 items** (8): Audit explicitly notes "Most likely partially overtaken by gap-closure plans 06/07/08 — needs re-baseline." Claude's pre-triage (D-01) should find many of these SUPERSEDED by plans 20.1-06/07/08 and the Phase 39/39b UX work.
- **Phase 20.1 debug entries** (5): ALL five are already in `.planning/debug/resolved/`. D-04 is a NO-OP — no move needed. The planner should note this as "already resolved prior to Phase 42" in the plan.
- **Phase 22 items** (6): Email change, password, settings visual items. Some of these may be CLOSED-candidate (live network behavior, but testable on prod).
- **Phase 23 items** (5): Preferences persistence, theme sync, notesPublic cross-page revalidation (blocked by DEBT-09 regression — resolved in Phase 32), Chronometer end-to-end.
- **Phase 18 items** (9): Sparse-network states (hero render, rail loading) — these may be genuinely DEFERRED since they require specific network conditions not reliably reproducible.

### Items Source Format

The v4.0-MILESTONE-AUDIT.md `items:` blocks enumerate each item as a string describing: the behavior + why it was deferred. The 23-VERIFICATION.md `human_verification:` array gives the most detail on Phase 23's 5 items with test steps and expected results.

---

## D-04: Already Resolved — No Action Needed

**Finding:** All 5 debug entries named in D-04 are already in `.planning/debug/resolved/`:

```
.planning/debug/resolved/verdict-empty-collection-message.md  ✓
.planning/debug/resolved/wishlist-textarea-not-prefilled.md   ✓
.planning/debug/resolved/recently-evaluated-rail-missing.md   ✓
.planning/debug/resolved/search-row-expand-broken.md          ✓
.planning/debug/resolved/no-escape-from-manual-entry.md       ✓
```

[VERIFIED: ls .planning/debug/ and ls .planning/debug/resolved/ in this session]

The root `.planning/debug/` directory contains only `knowledge-base.md` and the `resolved/` subdirectory — no stale `status: diagnosed` entries remain. **The planner MUST NOT create a plan task to move these files.** Instead, the triage closure table should note "D-04 debug hygiene: already resolved prior to Phase 42 execution."

---

## Common Pitfalls

### Pitfall 1: Wrong `@vitest/browser` API (v2 vs v3/v4 confusion)

**What goes wrong:** Installing `@vitest/browser-playwright` (a v3/v4 package) or using the function-import syntax `provider: playwright()` in the config.
**Why it happens:** Context7 and current vitest.dev docs document the v4 API, which ships `@vitest/browser-playwright` as a separate package. The v2.x API uses `provider: 'playwright'` (string) directly in the config.
**How to avoid:** For Vitest 2.1.9, install only `@vitest/browser@2.1.9` + `playwright`. The config is `provider: 'playwright'` (string), not a function.
**Warning signs:** TypeScript error "playwright is not a function" or "cannot find module '@vitest/browser-playwright'".

### Pitfall 2: jsdom getComputedStyle Returns Empty Strings

**What goes wrong:** Writing a test that calls `window.getComputedStyle(el).objectFit` in a jsdom environment and getting `''` (empty string) — test passes vacuously.
**Why it happens:** jsdom doesn't execute CSS. It doesn't load Tailwind's PostCSS output. `getComputedStyle` always returns empty for CSS properties set via class names.
**How to avoid:** All D-07/D-08 assertions MUST be in `*.browser.test.tsx` files (routed to the browser project in `vitest.workspace.ts`). Never assert computed styles in jsdom tests.
**Warning signs:** Test passes but `getComputedStyle(el).objectFit` returns `''`.

### Pitfall 3: Phase 31 Cannot Reach nyquist_compliant: true

**What goes wrong:** Trying to upgrade Phase 31's VALIDATION.md to `nyquist_compliant: true` and `wave_0_complete: true`.
**Why it happens:** Phase 31 is a docs-only phase. Its own VALIDATION.md explicitly states "Out of Nyquist Scope: This phase does not modify production code." The `nyquist_compliant: false` is the correct terminal state.
**How to avoid:** Do not set Phase 31's VALIDATION.md to `nyquist_compliant: true`. The planner should explicitly scope Phase 31's VALIDATION.md as "upgrade status field to document the intentional exception" — e.g., `status: scope_exception` with a rationale section.
**Warning signs:** ROADMAP SC#1 appears to require upgrading 27/28/30/31 — note that 31 is an intentional exception to document, not overcome.

### Pitfall 4: Wave 0 Confusion for Phase 27

**What goes wrong:** Assuming Phase 27's Wave 0 test stubs still need to be created.
**Why it happens:** Phase 27's VALIDATION.md shows all Wave 0 files as `❌ W0 (not created)`.
**How to avoid:** Before creating any Phase 27 Wave 0 files, `find tests/ -name "*phase27*" -o -name "*bulkReorder*" -o -name "*ProfileWatchCard-price*"` to see if they were created later. Some may already exist (Phase 27 did ship 5/5 plans successfully). The planner task should verify existence before creating.
**Warning signs:** Creating duplicate test files that shadow existing ones.

### Pitfall 5: CameraCaptureView Requires MediaStream Mocking

**What goes wrong:** The Phase 30 browser test fails because `CameraCaptureView` tries to access `navigator.mediaDevices.getUserMedia()` in the real browser, which requires permission.
**Why it happens:** Vitest browser mode runs in a real Chromium instance; media devices are gated by OS permission dialogs.
**How to avoid:** Mock `navigator.mediaDevices` before rendering the component. Use `vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({...}) } })` or render only the wrapper/video element in isolation, not the full composed flow. The CSS-chain assertions only need the wrapper div and video element to be in the DOM — they don't need a live stream.
**Warning signs:** Test hangs or shows a permission dialog in the Chromium window.

---

## Code Examples

### Browser Mode Test — Phase 30 CSS Chain (CRITICAL)

```typescript
// tests/browser/phase30-css-chain.browser.test.tsx
// Source: v2.vitest.dev/guide/browser + CameraCaptureView.tsx inspection
// These assertions WOULD HAVE caught the h-full hotfix regression (commit 2dd7377)

import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('Phase 30 CSS-chain: CameraCaptureView layout (DEBT-10)', () => {
  beforeEach(() => {
    // Stub mediaDevices to prevent getUserMedia permission prompt in Chromium
    vi.stubGlobal('navigator', {
      ...navigator,
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [],
        }),
      },
    })
  })

  it('aspect-square wrapper computes equal width and height', () => {
    // Mount just the wrapper element (not the full component to avoid stream init)
    const wrapper = document.createElement('div')
    wrapper.className = 'relative w-full aspect-square overflow-hidden rounded-md bg-black'
    wrapper.style.width = '360px'
    document.body.appendChild(wrapper)

    const style = window.getComputedStyle(wrapper)
    const w = parseFloat(style.width)
    const h = parseFloat(style.height)
    expect(h).toBeGreaterThan(0) // Not collapsed
    expect(Math.abs(h - w)).toBeLessThanOrEqual(1) // aspect-square: height === width

    document.body.removeChild(wrapper)
  })

  it('video with h-full w-full object-cover computes height > 0 and objectFit = cover', () => {
    // This assertion FAILS before commit 2dd7377 (the h-full hotfix) — before the fix,
    // the video element had no h-full so computed height was 0px or auto.
    const wrapper = document.createElement('div')
    wrapper.className = 'relative w-full aspect-square overflow-hidden rounded-md bg-black'
    wrapper.style.width = '360px'

    const video = document.createElement('video')
    video.className = 'block h-full w-full object-cover' // Classes from CameraCaptureView.tsx:137
    wrapper.appendChild(video)
    document.body.appendChild(wrapper)

    const style = window.getComputedStyle(video)
    expect(parseFloat(style.height)).toBeGreaterThan(0) // h-full → fills wrapper
    expect(style.objectFit).toBe('cover')               // object-cover → cover

    document.body.removeChild(wrapper)
  })
})
```

### Browser Mode Test — Phase 26 CSS Chain (Same Class of Failure)

```typescript
// tests/browser/phase26-css-chain.browser.test.tsx
// WearDetailHero uses the same h-full + object-cover pattern as CameraCaptureView
// Source: WearDetailHero.tsx inspection (lines 33-38, 68-73)

describe('Phase 26 CSS-chain: WearDetailHero photo layout (DEBT-10)', () => {
  it('aspect-[4/5] wrapper + h-full object-cover image chain resolves correctly', () => {
    const wrapper = document.createElement('div')
    wrapper.className = 'w-full aspect-[4/5] overflow-hidden bg-muted'
    wrapper.style.width = '360px'

    const img = document.createElement('img')
    img.className = 'w-full h-full object-cover'
    wrapper.appendChild(img)
    document.body.appendChild(wrapper)

    const wStyle = window.getComputedStyle(wrapper)
    const iStyle = window.getComputedStyle(img)

    // aspect-[4/5] → height = width * (5/4)
    const w = parseFloat(wStyle.width)
    const h = parseFloat(wStyle.height)
    expect(h).toBeGreaterThan(0)
    expect(Math.abs(h - w * 1.25)).toBeLessThanOrEqual(1)

    // img: h-full → fills wrapper; object-cover → cover
    expect(parseFloat(iStyle.height)).toBeGreaterThan(0)
    expect(iStyle.objectFit).toBe('cover')

    document.body.removeChild(wrapper)
  })
})
```

### vitest.workspace.ts Config (Verified v2.1.9 Shape)

```typescript
// vitest.workspace.ts (repo root — new file)
// Source: v2.vitest.dev/guide/workspace
import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  {
    extends: './vitest.config.ts',  // inherits environment: 'jsdom', setupFiles, globals, alias
    test: {
      name: 'unit',
      include: [
        'tests/**/*.test.ts',
        'tests/**/*.test.tsx',
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
      ],
      exclude: ['tests/browser/**'],
    },
  },
  {
    test: {
      name: 'browser',
      include: ['tests/browser/**/*.browser.test.{ts,tsx}'],
      browser: {
        enabled: true,
        provider: 'playwright',  // v2.x: string, NOT playwright() function
        name: 'chromium',        // v2.x: `name`, NOT `instances[0].browser`
        headless: true,
      },
      resolve: {
        alias: {
          '@': new URL('./src', import.meta.url).pathname,
        },
      },
    },
  },
])
```

---

## Vitest Browser Mode Viability — Final Verdict

**Verdict: VIABLE on Vitest 2.1.9 without an upgrade.**

| Question | Answer |
|----------|--------|
| Does Vitest 2.1.9 support browser mode with Playwright? | YES. `@vitest/browser@2.1.9` exists with peerDep `vitest: '2.1.9'`. |
| What packages? | `@vitest/browser@2.1.9` + `playwright` (no `@vitest/browser-playwright`) |
| Config format? | `provider: 'playwright'` (string) + `name: 'chromium'` — v2.x API |
| Upgrade required? | NO. No Vitest upgrade needed or recommended. |
| Dual-suite from one runner? | YES. `vitest.workspace.ts` with two projects (unit/jsdom + browser/chromium) |
| `npm test` semantics preserved? | YES. `vitest run` picks up `vitest.workspace.ts` automatically. |
| Can read computed styles? | YES. `window.getComputedStyle()` in browser tests runs in real Chromium; Tailwind is resolved by real CSS engine. |
| Would Phase 30 assertion have caught the regression? | YES — `computed height > 0` and `objectFit = 'cover'` on `<video>` would have been `0px` and `''` (empty) before the `h-full` hotfix. |
| Fallback if needed? | Scoped `@playwright/test` runner with `playwright.config.ts` — costs a second runner, second script (`test:browser`), second Playwright process separate from Vitest; no `npm test` unification. |

[VERIFIED: npm registry — @vitest/browser@2.1.9 exists with correct peer deps]
[VERIFIED: v2.vitest.dev — provider is string 'playwright', name is 'chromium', defineWorkspace is available]

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Vitest | Test runner | ✓ | 2.1.9 (installed) | — |
| `@vitest/browser` | Browser mode | ✗ (not yet installed) | Must be 2.1.9 | — (required by D-06) |
| Playwright (chromium) | Browser tests | ✗ (not yet installed) | Any; 1.60.0 on npm | Standalone `@playwright/test` (adds second runner) |
| git | VALIDATION.md recovery | ✓ | present | — |
| `.planning/debug/resolved/` | D-04 verification | ✓ | All 5 files already present | — |

**Missing dependencies with no fallback:**
- `@vitest/browser@2.1.9` — required by D-06; Wave 0 plan must install it
- Playwright Chromium binary (`npx playwright install chromium`) — required after package install

**Missing dependencies with fallback:**
- None — `@playwright/test` standalone is available as fallback if browser mode proves unviable, but research confirms browser mode IS viable.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 + `@vitest/browser@2.1.9` (browser project) + jsdom (unit project) |
| Config file | `vitest.workspace.ts` (new) extends `vitest.config.ts` (existing) |
| Quick run command — unit | `npx vitest run --project unit <file>` |
| Quick run command — browser | `npx vitest run --project browser <file>` |
| Full suite command | `npm test` (= `vitest run`; picks up workspace automatically) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEBT-10 | Phase 30: video computed height > 0 + objectFit = cover | browser | `npx vitest run --project browser tests/browser/phase30-css-chain.browser.test.tsx` | ❌ Wave 0 |
| DEBT-10 | Phase 26: aspect-[4/5] wrapper + h-full object-cover chain | browser | `npx vitest run --project browser tests/browser/phase26-css-chain.browser.test.tsx` | ❌ Wave 0 |
| DEBT-10 | Phase 27: aspect-[4/5] + object-cover on ProfileWatchCard | browser | `npx vitest run --project browser tests/browser/phase27-css-chain.browser.test.tsx` | ❌ Wave 0 |
| DEBT-10 | Phase 25: UserMenu, empty-state card layout (targeted) | browser | `npx vitest run --project browser tests/browser/phase25-css-chain.browser.test.tsx` | ❌ Wave 0 |
| DEBT-10 | Phase 29: ProfileTabs overflow-x-auto scroll behavior | browser | `npx vitest run --project browser tests/browser/phase29-css-chain.browser.test.tsx` | ❌ Wave 0 |
| DEBT-11 | Human UAT CLOSED-candidate items pass live verification | human | `42-HUMAN-UAT.md` checklist | ❌ Wave 0 (D-02) |

### Sampling Rate

- **Per task commit:** `npx vitest run --project unit <touched-file>` for unit project; `npx vitest run --project browser <touched-file>` for browser tests
- **Per wave merge:** `npm test` (full suite — both projects)
- **Phase gate:** Full suite green (no regression delta against 51 pre-existing failing tests) + `npm run build` exit 0

### Wave 0 Gaps

- [ ] `vitest.workspace.ts` — dual-project config (unit jsdom + browser chromium)
- [ ] `npm install --save-dev @vitest/browser@2.1.9 playwright` + `npx playwright install chromium`
- [ ] `tests/browser/` directory
- [ ] `tests/browser/phase25-css-chain.browser.test.tsx`
- [ ] `tests/browser/phase26-css-chain.browser.test.tsx`
- [ ] `tests/browser/phase27-css-chain.browser.test.tsx`
- [ ] `tests/browser/phase28-css-chain.browser.test.tsx` (LOW priority — Phase 28 has minimal visual surface)
- [ ] `tests/browser/phase29-css-chain.browser.test.tsx`
- [ ] `tests/browser/phase30-css-chain.browser.test.tsx` ← CRITICAL
- [ ] `42-HUMAN-UAT.md` skeleton (D-02 blocking checklist)

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Phase 27's Wave 0 test stubs (bulkReorder, ProfileWatchCard-priceLine, etc.) do NOT already exist as test files in the repo — the `❌ W0` markers in the recovered VALIDATION.md are still accurate | §Root-Cause Analysis | If tests exist, the planner doesn't need to create them; executor would find them and skip creation |
| A2 | `vitest.workspace.ts` with `extends: './vitest.config.ts'` correctly inherits the `resolve.alias` and `setupFiles` settings in v2.1.9 | §Code Examples | If inheritance is broken, the unit project would fail to resolve `@/` imports; fix: copy alias manually into the unit project config |
| A3 | The Tailwind 4 PostCSS output IS loaded when browser tests run in Chromium (i.e., the dev server / vite build serves the CSS correctly to the browser test iframe) | §Vitest Browser Mode Viability | If Tailwind CSS is not served, computed styles return empty strings even in browser mode; fix: ensure vite config processes Tailwind before browser tests run |
| A4 | Phase 31's correct terminal state is `nyquist_compliant: false` (intentional exception for docs-only phases); ROADMAP SC#1 "27, 28, 30, 31" being upgraded does not include a docs-only exception carved out | §Root-Cause Analysis | If ROADMAP SC#1 requires Phase 31 to be `nyquist_compliant: true`, the planner must handle this differently — possibly by marking it `status: scope_exception` with rationale |

---

## Open Questions

1. **Phase 27 Wave 0 test files — do they already exist?**
   - What we know: Phase 27 VALIDATION.md (recovered) marks all Wave 0 files as `❌ W0`. Phase 27 did ship 5/5 plans.
   - What's unclear: Whether the plan executor created the test files during execution despite the VALIDATION.md not being updated.
   - Recommendation: First plan task should `find tests/ -name "*phase27*" -o -name "*bulkReorder*"` before creating new stubs.

2. **Phase 31 nyquist_compliant upgrade — is it in or out of scope for SC#1?**
   - What we know: ROADMAP SC#1 names Phases 27/28/30/31 as targets. Phase 31's own VALIDATION.md says Nyquist is "out of scope" for it.
   - What's unclear: Does the planner interpret SC#1 as requiring Phase 31 to reach `nyquist_compliant: true`, or as "produce an updated VALIDATION.md that documents the intentional exception"?
   - Recommendation: Treat Phase 31 as "document the exception in upgraded VALIDATION.md" — change `status: draft` to `status: scope_exception`, add rationale. Leave `nyquist_compliant: false`. Flag this in the plan task so user can override.

3. **Tailwind 4 CSS served to browser test iframe?**
   - What we know: Vitest browser mode serves tests via a Vite dev server. The project's `postcss.config.mjs` processes Tailwind 4.
   - What's unclear: Whether the Vite dev server used by `@vitest/browser` in v2.1.9 automatically processes the project's `postcss.config.mjs` and serves Tailwind CSS to the iframe where tests run.
   - Recommendation: Wave 0 plan should include a smoke test that verifies a known class resolves to a non-empty computed value (e.g., `bg-black` → `background-color: rgb(0, 0, 0)`). If this fails, the planner knows to add a CSS import to the browser test setup.

---

## Sources

### Primary (HIGH confidence)

- npm registry — `@vitest/browser@2.1.9` version, peer deps, existence [VERIFIED in this session]
- npm registry — `@vitest/browser-playwright@4.1.6` (v3/v4 only; NOT v2) [VERIFIED in this session]
- npm registry — `playwright@1.60.0` (current) [VERIFIED in this session]
- git history — `git show dd58ba4^:<path>` recovery of all 5 deleted VALIDATION.md files [VERIFIED in this session]
- Filesystem — all 5 D-04 debug entries already in `.planning/debug/resolved/` [VERIFIED in this session]
- `vitest.config.ts` — current project config (jsdom, setupFiles, alias) [VERIFIED: Read in this session]
- `package.json` — installed Vitest 2.1.9, no `@vitest/browser`, no `playwright` [VERIFIED: Read in this session]
- `CameraCaptureView.tsx` — lines 130-137 show `h-full w-full object-cover` on `<video>` (the hotfix addition) [VERIFIED: Read in this session]
- v2.vitest.dev/guide/browser — v2.x browser mode config: `provider: 'playwright'` (string), `name: 'chromium'` [CITED]
- v2.vitest.dev/guide/workspace — `defineWorkspace` available in v2.1.9; workspace file format [CITED]

### Secondary (MEDIUM confidence)

- Context7 `/vitest-dev/vitest` — browser mode configuration (v3/v4 API documented; v2.x shape inferred by contrast) [CITED: Context7]
- `41-HUMAN-UAT.md` — canonical `*-HUMAN-UAT.md` file shape [VERIFIED: Read in this session]
- `41-VALIDATION.md` — current compliant VALIDATION.md shape [VERIFIED: Read in this session]
- `v4.0-MILESTONE-AUDIT.md` — authoritative UAT item enumeration [VERIFIED: Read in this session]

### Tertiary (LOW confidence)

- Assumption A3: Tailwind 4 PostCSS output served to browser test iframe — inferred from Vite plugin behavior; not directly confirmed against `@vitest/browser@2.1.9`

---

## Metadata

**Confidence breakdown:**
- Vitest browser mode viability: HIGH — npm registry confirms `@vitest/browser@2.1.9` with correct peer deps; v2.vitest.dev confirms provider string + defineWorkspace
- Config shape (v2.x vs v3/v4 API delta): HIGH — confirmed from both registry inspection and v2.vitest.dev docs
- CSS-chain assertion pattern: MEDIUM — `getComputedStyle` in browser mode is standard Web API; Tailwind serving to iframe is A3 assumption (LOW for that specific sub-claim)
- Git recovery: HIGH — all 5 paths confirmed working in this session
- D-04 pre-resolved status: HIGH — confirmed by filesystem read
- Phase 31 intentional exception: MEDIUM — based on Phase 31's own VALIDATION.md text; may not align with how planner interprets ROADMAP SC#1

**Research date:** 2026-05-15
**Valid until:** 2026-06-15 (30 days; Vitest ecosystem moves fast but v2.x is stable/frozen)
