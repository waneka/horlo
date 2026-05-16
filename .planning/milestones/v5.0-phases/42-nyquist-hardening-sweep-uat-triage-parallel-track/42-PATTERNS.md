# Phase 42: Nyquist Hardening Sweep + UAT Triage - Pattern Map

**Mapped:** 2026-05-15
**Files analyzed:** 12 new/modified files
**Analogs found:** 12 / 12

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `vitest.workspace.ts` | config | — | `vitest.config.ts` | extend (splits into two projects) |
| `tests/browser/phase25-css-chain.browser.test.tsx` | test | event-driven (DOM) | `tests/components/layout/UserMenu.test.tsx` | role-match |
| `tests/browser/phase26-css-chain.browser.test.tsx` | test | event-driven (DOM) | `tests/components/wywt/CameraCaptureView.test.tsx` + RESEARCH.md §Browser Mode Test | role-match + research example |
| `tests/browser/phase27-css-chain.browser.test.tsx` | test | event-driven (DOM) | `tests/components/wywt/CameraCaptureView.test.tsx` | role-match |
| `tests/browser/phase28-css-chain.browser.test.tsx` | test | event-driven (DOM) | `tests/components/watch/WatchCard.test.tsx` | partial-match (low priority phase) |
| `tests/browser/phase29-css-chain.browser.test.tsx` | test | event-driven (DOM) | `tests/components/profile/ProfileTabs.test.tsx` | exact (same component) |
| `tests/browser/phase30-css-chain.browser.test.tsx` | test | event-driven (DOM) | `tests/components/wywt/CameraCaptureView.test.tsx` + RESEARCH.md §Code Examples | exact (same component) |
| `42-validation-backfill/25-VALIDATION.md` | artifact | — | `41-VALIDATION.md` (frontmatter) + `29-VALIDATION.md` (structure) | exact shape |
| `42-validation-backfill/26-VALIDATION.md` | artifact | — | `41-VALIDATION.md` + `29-VALIDATION.md` | exact shape |
| `42-validation-backfill/27-VALIDATION.md` | artifact | — | `29-VALIDATION.md` (recovered) + `30-VALIDATION.md` (recovered) | exact shape |
| `42-validation-backfill/28-VALIDATION.md` | artifact | — | `29-VALIDATION.md` (recovered) | exact shape |
| `42-validation-backfill/30-VALIDATION.md` | artifact | — | `41-VALIDATION.md` | exact shape |
| `42-validation-backfill/31-VALIDATION.md` | artifact | — | `30-VALIDATION.md` (recovered, docs-only exception) | partial shape |
| `42-HUMAN-UAT.md` | artifact | — | `41-HUMAN-UAT.md` | exact shape |

---

## Pattern Assignments

---

### `vitest.workspace.ts` (config)

**Analog:** `vitest.config.ts` (existing, line 1–22)

**Existing config pattern** (`vitest.config.ts`, lines 1–22):
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.tsx'],
    globals: true,
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx', 'src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'server-only': fileURLToPath(new URL('./tests/shims/server-only.ts', import.meta.url)),
    },
  },
})
```

**New workspace config pattern** (from RESEARCH.md §Pattern 1 — VERIFIED against v2.vitest.dev):
```typescript
// vitest.workspace.ts (repo root — NEW FILE)
import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  {
    // Inherit jsdom environment, setupFiles, globals, alias from existing config
    extends: './vitest.config.ts',
    test: {
      name: 'unit',
      include: [
        'tests/**/*.test.ts',
        'tests/**/*.test.tsx',
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
      ],
      // CRITICAL: exclude browser tests from unit project
      exclude: ['tests/browser/**'],
    },
  },
  {
    test: {
      name: 'browser',
      include: ['tests/browser/**/*.browser.test.{ts,tsx}'],
      browser: {
        enabled: true,
        provider: 'playwright',  // v2.x: string literal, NOT playwright() function import
        name: 'chromium',        // v2.x: `name` field, NOT `instances[0].browser`
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

**Critical version note:** `provider: 'playwright'` is a string in Vitest v2.x. The v3/v4 API uses `provider: playwright()` (function import from `@vitest/browser-playwright`) — that package does NOT exist for v2.x. Do NOT install `@vitest/browser-playwright`.

**Installation required before this file works:**
```bash
npm install --save-dev @vitest/browser@2.1.9 playwright
npx playwright install chromium
```

---

### `tests/browser/phase30-css-chain.browser.test.tsx` (test, browser mode — CRITICAL)

**Analog:** `tests/components/wywt/CameraCaptureView.test.tsx` (existing unit test for same component)

**Component under test — CSS chain** (`src/components/wywt/CameraCaptureView.tsx`, lines 120–137):
```tsx
<div
  ref={wrapperRef}
  className="relative w-full aspect-square overflow-hidden rounded-md bg-black"
>
  <video
    ref={videoRef}
    autoPlay
    playsInline
    muted
    aria-label="Camera preview"
    // h-full is REQUIRED for object-cover to engage. Without it, the
    // <video> element keeps its intrinsic 16:9 aspect inside the
    // aspect-square wrapper, leaving a black bar at the bottom...
    // (Phase 30 hotfix; D-05.)
    className="block h-full w-full object-cover"
  />
```

**Existing unit test imports/structure** (`tests/components/wywt/CameraCaptureView.test.tsx`, lines 15–16):
```typescript
import { describe, it, expect } from 'vitest'
import { computeObjectCoverSourceRect } from '@/components/wywt/CameraCaptureView'
```

**Browser test pattern** (from RESEARCH.md §Code Examples — this is the acceptance-bar pattern):
```typescript
// tests/browser/phase30-css-chain.browser.test.tsx
// These assertions WOULD HAVE caught the h-full hotfix regression.
// Before the fix: <video> had no h-full → computed height was 0px
// After the fix: h-full → computed height fills the aspect-square wrapper

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
    const wrapper = document.createElement('div')
    wrapper.className = 'relative w-full aspect-square overflow-hidden rounded-md bg-black'
    wrapper.style.width = '360px'
    document.body.appendChild(wrapper)

    const style = window.getComputedStyle(wrapper)
    const w = parseFloat(style.width)
    const h = parseFloat(style.height)
    expect(h).toBeGreaterThan(0)
    expect(Math.abs(h - w)).toBeLessThanOrEqual(1) // aspect-square: height === width

    document.body.removeChild(wrapper)
  })

  it('video with h-full w-full object-cover computes height > 0 and objectFit = cover', () => {
    // This assertion FAILS before the h-full hotfix — before the fix,
    // video had no h-full so computed height was 0px.
    const wrapper = document.createElement('div')
    wrapper.className = 'relative w-full aspect-square overflow-hidden rounded-md bg-black'
    wrapper.style.width = '360px'

    const video = document.createElement('video')
    video.className = 'block h-full w-full object-cover' // from CameraCaptureView.tsx:137
    wrapper.appendChild(video)
    document.body.appendChild(wrapper)

    const style = window.getComputedStyle(video)
    expect(parseFloat(style.height)).toBeGreaterThan(0) // h-full → fills wrapper
    expect(style.objectFit).toBe('cover')               // object-cover → cover

    document.body.removeChild(wrapper)
  })
})
```

**Anti-pattern (D-08 forbids this):**
```typescript
// FORBIDDEN — class-name check, not computed style
expect(video.classList.contains('h-full')).toBe(true)
```

---

### `tests/browser/phase26-css-chain.browser.test.tsx` (test, browser mode — HIGH priority)

**Analog:** `tests/components/wywt/CameraCaptureView.test.tsx` (same CSS-chain failure class)

**Component under test — CSS chain** (`src/components/wear/WearDetailHero.tsx`, lines 33–40):
```tsx
<div className="w-full aspect-[4/5] overflow-hidden bg-muted md:rounded-lg md:max-w-[600px] md:mx-auto">
  {/* eslint-disable-next-line @next/next/no-img-element */}
  <img
    src={watchImageUrl}
    alt={altText}
    className="w-full h-full object-cover"
    loading="eager"
  />
</div>
```

**Browser test pattern** (from RESEARCH.md §Code Examples):
```typescript
// tests/browser/phase26-css-chain.browser.test.tsx
// WearDetailHero uses same h-full + object-cover pattern as CameraCaptureView
// Same class of failure: if h-full is dropped, object-cover has nothing to cover

import { describe, it, expect } from 'vitest'

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

---

### `tests/browser/phase27-css-chain.browser.test.tsx` (test, browser mode — HIGH priority)

**Analog:** `tests/components/wywt/CameraCaptureView.test.tsx` (same pattern)

**Component under test — CSS chain** (`src/components/profile/ProfileWatchCard.tsx`, line 61):
```tsx
<div className="relative aspect-[4/5] bg-muted">
  {safeUrl ? (
    <Image
      src={safeUrl}
      alt={`${watch.brand} ${watch.model}`}
      fill
      sizes="(max-width: 640px) 50vw, ..."
      className="object-cover"
    />
  ) : (
    <div className="flex h-full w-full items-center justify-center">
```

**Grid layout** (`src/components/profile/CollectionTabContent.tsx`, line 170):
```tsx
<div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
```

**Browser test pattern:**
```typescript
// tests/browser/phase27-css-chain.browser.test.tsx
// ProfileWatchCard aspect-[4/5] wrapper + object-cover chain
// CollectionTabContent/WishlistTabContent grid-cols-2 layout

import { describe, it, expect } from 'vitest'

describe('Phase 27 CSS-chain: ProfileWatchCard + grid layout (DEBT-10)', () => {
  it('aspect-[4/5] card wrapper computes correct height-to-width ratio', () => {
    const wrapper = document.createElement('div')
    wrapper.className = 'relative aspect-[4/5] bg-muted'
    wrapper.style.width = '180px'
    document.body.appendChild(wrapper)

    const style = window.getComputedStyle(wrapper)
    const w = parseFloat(style.width)
    const h = parseFloat(style.height)
    expect(h).toBeGreaterThan(0)
    // aspect-[4/5] → h = w * (5/4) = 225px at 180px width
    expect(Math.abs(h - w * 1.25)).toBeLessThanOrEqual(1)

    document.body.removeChild(wrapper)
  })

  it('grid-cols-2 container renders two equal-width columns', () => {
    const grid = document.createElement('div')
    grid.className = 'grid grid-cols-2 gap-4'
    grid.style.width = '360px'

    const card1 = document.createElement('div')
    const card2 = document.createElement('div')
    grid.appendChild(card1)
    grid.appendChild(card2)
    document.body.appendChild(grid)

    const s1 = window.getComputedStyle(card1)
    const s2 = window.getComputedStyle(card2)
    // Each column should be ~half the grid width (minus gap)
    expect(parseFloat(s1.width)).toBeGreaterThan(100)
    expect(Math.abs(parseFloat(s1.width) - parseFloat(s2.width))).toBeLessThanOrEqual(1)

    document.body.removeChild(grid)
  })
})
```

**Note on Next.js `<Image fill>` in browser tests:** The `fill` prop on Next.js Image generates `position: absolute; width: 100%; height: 100%` inline styles. The browser test can assert `object-fit: cover` on a plain `<img>` with class `object-cover` — the computed style check is about the Tailwind CSS chain, not the Next.js Image component internals.

---

### `tests/browser/phase29-css-chain.browser.test.tsx` (test, browser mode — MEDIUM priority)

**Analog:** `tests/components/profile/ProfileTabs.test.tsx` (existing unit test for same component)

**Existing unit test — class-name assertion** (`tests/components/profile/ProfileTabs.test.tsx`, lines 121–138):
```typescript
// This test already covers className presence (acceptable in unit test)
// The BROWSER test must cover computed overflow behavior that jsdom cannot resolve
it('TabsList has overflow-x-auto AND overflow-y-hidden + scrollbar-hiding utilities + pb-2', () => {
  const { container } = render(<ProfileTabs username="tyler" />)
  const firstTrigger = container.querySelector('[data-tab-id]')
  const tabsList = firstTrigger?.parentElement
  const cls = tabsList!.className
  expect(cls).toContain('overflow-x-auto')
  expect(cls).toContain('overflow-y-hidden')
  // ...class-name checks
})
```

**Component CSS** (`src/components/profile/ProfileTabs.tsx`, line 65):
```tsx
className="w-full justify-start gap-2 overflow-x-auto overflow-y-hidden pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
```

**Browser test pattern (computed overflow, not class names):**
```typescript
// tests/browser/phase29-css-chain.browser.test.tsx
// ProfileTabs scroll overflow chain — jsdom cannot verify computed overflow behavior

import { describe, it, expect } from 'vitest'

describe('Phase 29 CSS-chain: ProfileTabs scroll overflow (DEBT-10)', () => {
  it('overflow-x-auto computes to scroll or auto, overflow-y-hidden computes to hidden', () => {
    const tabsList = document.createElement('div')
    tabsList.className = 'w-full justify-start gap-2 overflow-x-auto overflow-y-hidden pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
    tabsList.style.width = '320px'
    document.body.appendChild(tabsList)

    const style = window.getComputedStyle(tabsList)
    // overflow-x-auto → computed overflowX = 'auto' or 'scroll'
    expect(['auto', 'scroll']).toContain(style.overflowX)
    // overflow-y-hidden → computed overflowY = 'hidden'
    expect(style.overflowY).toBe('hidden')
    // pb-2 → computed paddingBottom = '8px'
    expect(parseFloat(style.paddingBottom)).toBeGreaterThan(0)

    document.body.removeChild(tabsList)
  })
})
```

---

### `tests/browser/phase25-css-chain.browser.test.tsx` (test, browser mode — MEDIUM priority)

**Analog:** `tests/components/layout/UserMenu.test.tsx` (existing unit test for Phase 25 component)

**Existing unit test — layout assertions (class-name based)** (`tests/components/layout/UserMenu.test.tsx`, lines 148–166):
```typescript
// Phase 25 §Spacing Scale — class-name checks (unit test)
it('Test 11 (Phase 25 §Spacing Scale) — dual-affordance container uses gap-1 (NOT gap-2)', () => {
  const wrapper = container.querySelector('div.flex.items-center.gap-1') as HTMLElement | null
  expect(wrapper).not.toBeNull()
  expect(wrapper!.className).toContain('gap-1')
})

it('Test 12 — avatar Link uses size-11 hit target (44×44)', () => {
  expect(avatarLink.className).toContain('size-11')
  expect(avatarLink.className).toContain('rounded-full')
})
```

**Browser test pattern (computed layout, not class names):**
```typescript
// tests/browser/phase25-css-chain.browser.test.tsx
// UserMenu trigger layout — avatar + chevron dual-affordance spacing

import { describe, it, expect } from 'vitest'

describe('Phase 25 CSS-chain: UserMenu avatar + empty-state card layout (DEBT-10)', () => {
  it('gap-1 container computes 4px gap between flex children', () => {
    const container = document.createElement('div')
    container.className = 'flex items-center gap-1'
    const child1 = document.createElement('div')
    child1.style.width = '44px'
    const child2 = document.createElement('div')
    child2.style.width = '32px'
    container.appendChild(child1)
    container.appendChild(child2)
    document.body.appendChild(container)

    const style = window.getComputedStyle(container)
    expect(style.display).toBe('flex')
    expect(style.alignItems).toBe('center')
    // gap-1 → column-gap: 4px
    expect(parseFloat(style.columnGap)).toBeCloseTo(4, 0)

    document.body.removeChild(container)
  })

  it('size-11 avatar hit-target computes 44×44px', () => {
    const link = document.createElement('a')
    link.className = 'size-11 rounded-full'
    document.body.appendChild(link)

    const style = window.getComputedStyle(link)
    // size-11 → width: 44px, height: 44px (Tailwind size scale: 11 * 4px = 44px)
    expect(parseFloat(style.width)).toBeCloseTo(44, 0)
    expect(parseFloat(style.height)).toBeCloseTo(44, 0)

    document.body.removeChild(link)
  })
})
```

---

### `tests/browser/phase28-css-chain.browser.test.tsx` (test, browser mode — LOW priority)

**Analog:** `tests/components/watch/WatchCard.test.tsx` (closest existing component test)

**Phase 28 context:** Phase 28 was primarily copy/logic changes — no new aspect-ratio/object-fit surfaces. Per RESEARCH.md §Visual Surfaces by Phase: "Low — Phase 28 was primarily copy/logic; no new aspect-ratio/object-fit surfaces." This file is minimal.

**Browser test pattern:**
```typescript
// tests/browser/phase28-css-chain.browser.test.tsx
// Phase 28 visual surfaces: AddWatchFlow (layout unchanged), WishlistRationalePanel (prose)
// Priority: LOW — no new aspect-ratio/object-fit chains introduced in Phase 28

import { describe, it, expect } from 'vitest'

describe('Phase 28 CSS-chain: WishlistRationalePanel prose layout (DEBT-10)', () => {
  it('WishlistRationalePanel prose container is block-level and readable', () => {
    // Phase 28 added WishlistRationalePanel — prose copy layout only
    const panel = document.createElement('div')
    panel.className = 'space-y-2 text-sm text-muted-foreground'
    panel.style.width = '320px'
    document.body.appendChild(panel)

    const style = window.getComputedStyle(panel)
    expect(style.display).toBe('block')
    expect(parseFloat(style.fontSize)).toBeGreaterThan(0)

    document.body.removeChild(panel)
  })
})
```

---

### `42-validation-backfill/25-VALIDATION.md` and `26-VALIDATION.md` (artifacts — new)

**Analog:** `41-VALIDATION.md` (frontmatter shape) + `29-VALIDATION.md` recovered from git history (structure/depth)

**Frontmatter pattern** (from `41-VALIDATION.md`, lines 1–8):
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

**Target frontmatter for Phases 25/26** (higher standard than Phase 29 — per DEBT-10 and ROADMAP SC#1):
```yaml
---
phase: 25
slug: <original-phase-slug>
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-15
backfill_location: .planning/phases/42-nyquist-hardening-sweep-uat-triage-parallel-track/42-validation-backfill/
backfill_reason: source phase directory deleted by commit dd58ba4
---
```

**Per-task verification map structure** (from `29-VALIDATION.md`, recovered — the column layout):
```markdown
| Req ID | Behavior | Threat Ref | Test Type | Automated Command | File Exists | Status |
|--------|----------|------------|-----------|-------------------|-------------|--------|
| NAV-13 | [behavior] | — | unit | `npx vitest run <file>` | ✅ existing | approved |
```

**Wave 0 coverage citation pattern** (D-09 principle — from `29-VALIDATION.md`):
- For non-visual requirements with existing test coverage: `✅ existing (cite test file)` + status `approved`
- For prod-UAT sign-off evidence: cite commit `7132ac0` and date 2026-05-02
- For browser tests (DEBT-10 D-07): `❌ W0 (Phase 42 backfill)` → test file in `tests/browser/phase25-css-chain.browser.test.tsx`

---

### `42-validation-backfill/27-VALIDATION.md`, `28-VALIDATION.md`, `30-VALIDATION.md`, `31-VALIDATION.md` (artifacts — upgrade)

**Analog:** Recovered from git history via `git show dd58ba4^:<path>`. All four commands confirmed working.

**Recovery commands:**
```bash
git show dd58ba4^:.planning/phases/27-watch-card-collection-render-polish/27-VALIDATION.md
git show dd58ba4^:.planning/phases/28-add-watch-flow-verdict-copy-polish/28-VALIDATION.md
git show dd58ba4^:.planning/phases/30-wywt-capture-alignment-fix/30-VALIDATION.md
git show dd58ba4^:.planning/phases/31-v4-0-verification-backfill/31-VALIDATION.md
```

**Recovered Phase 30 frontmatter** (before upgrade):
```yaml
---
phase: 30
slug: wywt-capture-alignment-fix
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-05
---
```

**Target frontmatter after upgrade** (Phases 27, 28, 30):
```yaml
---
phase: 30
slug: wywt-capture-alignment-fix
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-05
upgraded: 2026-05-15
upgrade_ref: Phase 42 DEBT-10 (42-nyquist-hardening-sweep-uat-triage-parallel-track)
---
```

**Phase 31 exception frontmatter** (docs-only phase — intentional deviation):
```yaml
---
phase: 31
slug: v4-0-verification-backfill
status: scope_exception
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-05
upgraded: 2026-05-15
upgrade_ref: Phase 42 DEBT-10
exception_reason: "Phase 31 is a docs-only phase. It does not modify production code, add tests, or produce executable artifacts. nyquist_compliant: false is the correct terminal state. See recovered VALIDATION.md rationale."
---
```

**Root-cause closure pattern** (what to add to each upgraded VALIDATION.md body):

For Phase 27 (`partial` because Wave 0 tests were `❌ W0`):
```markdown
## Phase 42 Upgrade Notes

Root cause of `partial`: Per-task verification map existed but all Wave 0 test files
were marked `❌ W0 (not created)`. Resolution: Phase 27 Wave 0 tests exist in the
current repo at `tests/integration/phase27-*.test.ts` (created after the VALIDATION.md
was authored). Browser CSS-chain assertions added in `tests/browser/phase27-css-chain.browser.test.tsx`.
```

For Phase 30 (`partial` because Wave 0 test missing — now exists):
```markdown
## Phase 42 Upgrade Notes

Root cause of `partial`: Wave 0 test file `tests/components/wywt/CameraCaptureView.test.tsx`
was listed as the sole gap. This file NOW EXISTS (4 math tests for computeObjectCoverSourceRect).
Remaining gap closed by Phase 42: computed-style browser assertion added in
`tests/browser/phase30-css-chain.browser.test.tsx` per DEBT-10 D-08.
```

---

### `42-HUMAN-UAT.md` (artifact — blocking checklist)

**Analog:** `41-HUMAN-UAT.md` (exact shape reuse per D-02)

**Full file shape** (from `41-HUMAN-UAT.md`, lines 1–36):
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
result: [pending]

## Summary

total: N
passed: 0
issues: 0
pending: N
skipped: 0
blocked: 0

## Gaps
```

**Phase 42 adaptation:**
```yaml
---
status: partial
phase: 42-nyquist-hardening-sweep-uat-triage-parallel-track
source: [42-CONTEXT.md §triage — CLOSED-candidate items]
started: <ISO timestamp when checklist is created>
updated: <ISO timestamp>
---
```

Each CLOSED-candidate UAT item (surviving D-01 pre-triage) becomes one `### N.` entry with:
- `expected:` — the precise behavior from the original UAT item in `v4.0-MILESTONE-AUDIT.md`
- `result: [pending]` — user fills in `pass` or `fail` during execution
- Phase cannot close until all items have non-`pending` results

---

## Shared Patterns

### Browser Test DOM-Only Pattern (No React, No Component Import)

**Source:** RESEARCH.md §Code Examples (Phase 30 + Phase 26 examples)
**Apply to:** All `tests/browser/*.browser.test.tsx` files

The preferred pattern for Phase 42 CSS-chain assertions does NOT import React components. It constructs raw DOM elements, assigns Tailwind class names, and reads `window.getComputedStyle()`. This avoids:
- `navigator.mediaDevices` mock complexity in full component renders
- Next.js Image / Link mock overhead
- Server component / RSC import issues in the browser test environment

```typescript
// Template for all phase NN browser test files
import { describe, it, expect } from 'vitest'
// NO React, NO @testing-library/react, NO component imports

describe('Phase NN CSS-chain: <Component> layout (DEBT-10)', () => {
  it('<specific CSS chain> computes <expected value>', () => {
    const el = document.createElement('<tag>')
    el.className = '<exact Tailwind classes from component source>'
    el.style.width = '<explicit width to anchor aspect-ratio calculations>'
    document.body.appendChild(el)

    const style = window.getComputedStyle(el)
    expect(style.<property>).<matcher>  // computed value, NOT class presence

    document.body.removeChild(el)  // cleanup
  })
})
```

### Computed-Style Assertions (D-08 hard requirement)

**Source:** REQUIREMENTS.md DEBT-10 + RESEARCH.md §Anti-Patterns
**Apply to:** Every assertion in every `*.browser.test.tsx` file

```typescript
// CORRECT — computed style
const style = window.getComputedStyle(element)
expect(style.objectFit).toBe('cover')         // checks the CSS chain resolved
expect(parseFloat(style.height)).toBeGreaterThan(0)  // checks layout computed

// FORBIDDEN — class name check (explicitly banned by D-08)
expect(element.classList.contains('object-cover')).toBe(true)  // NOT this
expect(element.className).toContain('h-full')                   // NOT this
```

### VALIDATION.md Frontmatter (Compliant State)

**Source:** `41-VALIDATION.md` lines 1–8 (current reference) + `29-VALIDATION.md` (recovered, approved reference)
**Apply to:** All six VALIDATION.md files in `42-validation-backfill/`

```yaml
---
phase: <NN>
slug: <original-phase-slug>
status: approved
nyquist_compliant: true    # target for 25, 26, 27, 28, 30
wave_0_complete: true      # target for 25, 26, 27, 28, 30 — higher bar than Phase 29
created: <original-creation-date>
---
```

Phase 31 exception: `status: scope_exception`, `nyquist_compliant: false`, `wave_0_complete: false` with `exception_reason` field.

### Vitest Test File Header Comment Block

**Source:** `tests/components/wywt/CameraCaptureView.test.tsx` lines 1–15, `tests/integration/phase27-schema.test.ts` lines 1–10
**Apply to:** All `tests/browser/*.browser.test.tsx` files

```typescript
// tests/browser/phaseNN-css-chain.browser.test.tsx
//
// Phase NN CSS-chain assertions (DEBT-10 D-07/D-08).
//
// Checks computed styles in real Chromium — NOT class names.
// D-08 requirement: assertions that would have caught the h-full hotfix regression.
//
// Visual surfaces covered:
//   - <Component>: <specific CSS chain at risk>
//
// References:
//   - <NN>-CONTEXT.md <requirement ID>
//   - 42-validation-backfill/<NN>-VALIDATION.md (backfilled artifact)
```

---

## No Analog Found

All files have analogs. No entries in this section.

---

## Pre-existing Test Files to Verify Before Creating (Phase 27 Pitfall 4)

Before the planner creates Phase 27 Wave 0 test stubs, verify these files do NOT already exist:

```bash
find /path/to/tests -name "*phase27*" -o -name "*bulkReorder*" -o -name "*ProfileWatchCard-price*"
```

**Research finding (confirmed in this session):** The following Phase 27 tests ALREADY EXIST:
- `tests/integration/phase27-schema.test.ts` — sort_order column + index
- `tests/integration/phase27-bulk-reorder.test.ts` — bulkReorderWishlist owner enforcement
- `tests/integration/phase27-backfill.test.ts` — backfill idempotency
- `tests/integration/phase27-getwatchesbyuser-order.test.ts` — ORDER BY sort_order

The `❌ W0` markers in the recovered Phase 27 VALIDATION.md are STALE. These tests were created after the VALIDATION.md was authored. Phase 27's Wave 0 gap is CLOSED except for the browser CSS-chain assertion (which Phase 42 adds). The planner must not create duplicate test files for Phase 27.

---

## Metadata

**Analog search scope:** `tests/` directory (all subdirectories), `src/components/wywt/`, `src/components/wear/`, `src/components/profile/`, `.planning/phases/41-*/`, git history (`dd58ba4^`)
**Files scanned:** 11 source/test files read directly; 4 VALIDATION.md files recovered from git history
**Pattern extraction date:** 2026-05-15
