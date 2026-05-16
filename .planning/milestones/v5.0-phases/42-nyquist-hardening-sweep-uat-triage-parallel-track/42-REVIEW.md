---
phase: 42-nyquist-hardening-sweep-uat-triage-parallel-track
reviewed: 2026-05-16T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - vitest.workspace.ts
  - tests/browser/setup.browser.ts
  - tests/browser/css-chain-smoke.browser.test.tsx
  - tests/browser/phase25-css-chain.browser.test.tsx
  - tests/browser/phase26-css-chain.browser.test.tsx
  - tests/browser/phase27-css-chain.browser.test.tsx
  - tests/browser/phase28-css-chain.browser.test.tsx
  - tests/browser/phase29-css-chain.browser.test.tsx
  - tests/browser/phase30-css-chain.browser.test.tsx
findings:
  critical: 0
  warning: 3
  info: 1
  total: 4
status: issues_found
---

# Phase 42: Code Review Report

**Reviewed:** 2026-05-16T00:00:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Reviewed the DEBT-10 Vitest browser-mode test infrastructure: one workspace config, one setup file, and seven browser test files covering phases 25–30 plus a smoke test. The implementation correctly follows D-08 (computed styles, never class names) and D-07 (DOM-only construction) throughout all test files.

Three issues found:

1. The `phase28` test uses assertions that both pass without any CSS applied — the test cannot detect a broken Tailwind CSS chain for Phase 28's visual surface.
2. The `phase30` `beforeEach` stubs `navigator` globally without a corresponding `afterEach` + `vi.unstubAllGlobals()` restore, which — while low-risk given per-file iframe isolation — leaves the stub accumulated across both tests in that file.
3. All seven test files perform `document.body.removeChild(el)` at the end of the test body without a `try/finally` guard. If any assertion before the cleanup throws, the DOM node is leaked into subsequent tests in the same file, which could corrupt layout-dependent `getComputedStyle` reads in later assertions.

---

## Warnings

### WR-01: phase28 CSS-chain assertions are browser defaults — they cannot detect a broken CSS chain

**File:** `tests/browser/phase28-css-chain.browser.test.tsx:35-39`
**Issue:** Both assertions pass unconditionally regardless of whether Tailwind CSS is loaded. `display: 'block'` is the browser default for `<div>` elements and does not require any CSS class to be applied. `parseFloat(style.fontSize) > 0` is also always true: a browser that has not received any stylesheet still renders text at the system default (typically 16px). If `globals.css` were entirely absent from the browser iframe, this test would still pass, making it useless as a CSS-chain regression guard for Phase 28's `text-sm text-muted-foreground` surface.

**Fix:** Replace both assertions with one that requires CSS to have been applied. The most reliable option for `text-sm` is a specific pixel value rather than `> 0`:

```typescript
// text-sm in Tailwind 4 → font-size: 0.875rem = 14px at default 16px root font size
// This value is NOT the browser default (16px), so it fails if CSS is not loaded.
expect(parseFloat(style.fontSize)).toBeCloseTo(14, 0)
```

If testing `space-y-2` or `text-muted-foreground` is also desired, note that `space-y-2` only affects child spacing (requires children with margin-top), and `text-muted-foreground` resolves to an `oklch()` color that differs from the browser's default `rgb(0, 0, 0)` — either could be used as an additional meaningful assertion.

---

### WR-02: phase30 stubs `navigator` in `beforeEach` with no `afterEach` restore

**File:** `tests/browser/phase30-css-chain.browser.test.tsx:21-33`
**Issue:** `vi.stubGlobal('navigator', { ...navigator, mediaDevices: { ... } })` is called in `beforeEach` but there is no corresponding `afterEach(() => vi.unstubAllGlobals())`. The `unstubGlobals` config option defaults to `false` in vitest 2.x, so the stub is not auto-restored between tests. On the second and subsequent `beforeEach` invocations, `...navigator` spreads the already-stubbed object rather than the original browser `navigator`. While the current stub only adds `mediaDevices`, this is a fragile pattern: the original `navigator` is lost after the first test, and any future additions to the spread could mask the real browser API.

**Fix:** Add an `afterEach` cleanup to restore the original globals:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// inside describe block:
afterEach(() => {
  vi.unstubAllGlobals()
})
```

---

### WR-03: DOM nodes leaked on assertion failure across all browser test files

**File:** `tests/browser/css-chain-smoke.browser.test.tsx:25-35`, `tests/browser/phase25-css-chain.browser.test.tsx:31-42`, `tests/browser/phase26-css-chain.browser.test.tsx:35-53`, `tests/browser/phase27-css-chain.browser.test.tsx:32-42`, `tests/browser/phase28-css-chain.browser.test.tsx:28-40`, `tests/browser/phase29-css-chain.browser.test.tsx:29-44`, `tests/browser/phase30-css-chain.browser.test.tsx:37-52`
**Issue:** Every test appends an element to `document.body` and calls `removeChild` at the end of the test body. There is no `try/finally` guard. If any assertion between `appendChild` and `removeChild` throws (i.e., a test failure), the node is leaked into `document.body` for the remaining tests in the same file. Vitest browser mode gives each test file its own iframe by default, so this only affects within-file ordering — but that is enough to corrupt layout-sensitive assertions. For example, in `phase27`, a leaked wide grid element could widen `document.body` and change the computed width of a subsequently added element. The `phase30` file has two tests that both depend on accurate `getComputedStyle` reads on elements inside `document.body`.

The safest fix is a global `afterEach` in `setup.browser.ts` that resets `document.body`:

```typescript
// tests/browser/setup.browser.ts
import '../../src/app/globals.css'
import { afterEach } from 'vitest'

afterEach(() => {
  document.body.innerHTML = ''
})
```

Alternatively, individual tests can use try/finally, but the setup-file approach covers all current and future browser tests at once without per-test boilerplate.

---

## Info

### IN-01: Browser project `@/*` alias uses `URL.pathname` instead of `fileURLToPath`

**File:** `vitest.workspace.ts:40`
**Issue:** The `@/*` alias is defined as `new URL('./src', import.meta.url).pathname` while the base `vitest.config.ts` uses `fileURLToPath(new URL('./src', import.meta.url))`. On macOS and Linux both forms produce the same string. On Windows, `URL.pathname` returns a leading slash before the drive letter (e.g., `/C:/Users/...`) while `fileURLToPath` returns the correct Windows path (`C:\Users\...`). The project is macOS-only in practice, but the inconsistency between the two configs is unnecessary.

**Fix:** Mirror the base config's approach for consistency:

```typescript
import { fileURLToPath } from 'node:url'

// in the browser project resolve block:
resolve: {
  alias: {
    '@': fileURLToPath(new URL('./src', import.meta.url)),
  },
},
```

---

_Reviewed: 2026-05-16T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
