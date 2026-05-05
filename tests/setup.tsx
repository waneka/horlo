import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// PointerEvent polyfill — required for base-ui Checkbox / Slider clicks under jsdom.
// base-ui dispatches `new PointerEvent('click', ...)` internally; jsdom does not implement
// PointerEvent, causing a ReferenceError when these components are exercised via userEvent.
// Polyfill it to MouseEvent so the userEvent.click path can reach onCheckedChange / onValueChange.
// Per RESEARCH.md Pitfall 6: lifted here from WatchForm.isChronometer.test.tsx so all
// component tests benefit without needing per-file polyfills.
if (typeof window !== 'undefined' && !('PointerEvent' in window)) {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number
    pointerType: string
    constructor(type: string, props: PointerEventInit = {}) {
      super(type, props)
      this.pointerId = props.pointerId ?? 0
      this.pointerType = props.pointerType ?? 'mouse'
    }
  }
  // @ts-expect-error attach polyfill
  window.PointerEvent = PointerEventPolyfill
}

// React Testing Library's `waitFor` auto-advances Jest fake timers by checking
// `typeof jest !== 'undefined'`. Vitest's `vi.useFakeTimers()` does set
// `setTimeout.clock` (which RTL also checks), but `jest` is undefined so RTL
// falls back to real-timer polling — which deadlocks tests that combine
// `vi.useFakeTimers()` with `waitFor()` (the polling setInterval is itself
// faked and never fires).
//
// This shim aliases a minimal `jest` global to `vi` so RTL detects fake timers
// and calls `jest.advanceTimersByTime(interval)` (which is now
// `vi.advanceTimersByTime`). Standard vitest+RTL workaround documented in
// vitest's migration guide. Only the timer-related members RTL actually uses
// are forwarded.
if (typeof (globalThis as { jest?: unknown }).jest === 'undefined') {
  Object.defineProperty(globalThis, 'jest', {
    value: {
      advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms),
      runAllTimers: () => vi.runAllTimers(),
      useFakeTimers: () => vi.useFakeTimers(),
      useRealTimers: () => vi.useRealTimers(),
    },
    writable: true,
    configurable: true,
  })
}

// jsdom does not implement window.matchMedia — stub it so libraries like
// next-themes that probe `(prefers-color-scheme: dark)` do not crash under test.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

// Node 25 exposes a native `localStorage` without method implementations
// (warns `--localstorage-file was provided without a valid path`). That object
// leaks through vitest's jsdom env and shadows jsdom's functional storage
// on both `globalThis` AND `window`, breaking any test that exercises
// `localStorage.setItem` / `.getItem`. Install a minimal in-memory Storage
// implementation so code-under-test can read/write as it would in a browser.
if (
  typeof window !== 'undefined' &&
  typeof window.localStorage?.setItem !== 'function'
) {
  class MemoryStorage implements Storage {
    private store: Map<string, string> = new Map()
    get length() {
      return this.store.size
    }
    clear(): void {
      this.store.clear()
    }
    getItem(key: string): string | null {
      return this.store.has(key) ? this.store.get(key)! : null
    }
    setItem(key: string, value: string): void {
      this.store.set(key, String(value))
    }
    removeItem(key: string): void {
      this.store.delete(key)
    }
    key(index: number): string | null {
      return [...this.store.keys()][index] ?? null
    }
  }
  const ls = new MemoryStorage()
  Object.defineProperty(globalThis, 'localStorage', {
    value: ls,
    writable: true,
    configurable: true,
  })
  Object.defineProperty(window, 'localStorage', {
    value: ls,
    writable: true,
    configurable: true,
  })
}

// jsdom does not implement IntersectionObserver — stub it so libraries like
// embla-carousel-react (which observes slide-in-view for lazy rendering) do
// not crash under test. The stub is a no-op that satisfies the constructor
// signature; tests don't need real intersection semantics.
if (
  typeof window !== 'undefined' &&
  typeof window.IntersectionObserver === 'undefined'
) {
  class StubIntersectionObserver implements IntersectionObserver {
    readonly root: Element | Document | null = null
    readonly rootMargin: string = ''
    readonly thresholds: ReadonlyArray<number> = []
    constructor(
      _callback: IntersectionObserverCallback,
      _options?: IntersectionObserverInit,
    ) {}
    observe(_target: Element): void {}
    unobserve(_target: Element): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return []
    }
  }
  Object.defineProperty(window, 'IntersectionObserver', {
    value: StubIntersectionObserver,
    writable: true,
    configurable: true,
  })
  Object.defineProperty(globalThis, 'IntersectionObserver', {
    value: StubIntersectionObserver,
    writable: true,
    configurable: true,
  })
}

// jsdom does not implement ResizeObserver — stub it for the same reason as
// IntersectionObserver. embla-carousel-react observes viewport size changes
// and crashes without this.
if (
  typeof window !== 'undefined' &&
  typeof window.ResizeObserver === 'undefined'
) {
  class StubResizeObserver implements ResizeObserver {
    constructor(_cb: ResizeObserverCallback) {}
    observe(_target: Element): void {}
    unobserve(_target: Element): void {}
    disconnect(): void {}
  }
  Object.defineProperty(window, 'ResizeObserver', {
    value: StubResizeObserver,
    writable: true,
    configurable: true,
  })
  Object.defineProperty(globalThis, 'ResizeObserver', {
    value: StubResizeObserver,
    writable: true,
    configurable: true,
  })
}

// ─── Phase 29 Plan 06 (FORM-04 Gap 2) — wrap all RTL render() in StrictMode ──
//
// React StrictMode runs every effect with a mount → cleanup → mount cycle on
// initial render. Wrapping render() under StrictMode here means EVERY RTL test
// exercises the same lifecycle that Next.js 16 dev runs in real browsers.
//
// This is the test-infra gap that let the Plan 29-04 cleanup regression slip
// through CI: the cleanup clobbered initialState-derived form-prefill, but
// without StrictMode in tests, the bug only surfaced in dev manual UAT.
//
// Implementation: re-route @testing-library/react's render() through a wrapper
// that mounts the UI under <StrictMode>. The standard pattern is to override
// render via the `wrapper` option, but doing it once globally requires either
// (a) a vi.mock of '@testing-library/react' or (b) a custom render export
// imported by every test file.
//
// We use (a) here — global vi.mock — because there are existing tests that
// import `render` directly and would otherwise need to be touched. The mock
// preserves all other exports (screen, waitFor, fireEvent, renderHook,
// userEvent integration, act, cleanup) and only intercepts `render` to
// inject the StrictMode wrapper.
import { StrictMode, type ReactElement } from 'react'
import * as RTL from '@testing-library/react'

vi.mock('@testing-library/react', async (importOriginal) => {
  const actual = await importOriginal<typeof RTL>()
  return {
    ...actual,
    render: (ui: ReactElement, options?: Parameters<typeof actual.render>[1]) => {
      const StrictModeWrapper = ({ children }: { children: React.ReactNode }) => (
        <StrictMode>{children}</StrictMode>
      )
      const ExistingWrapper = options?.wrapper
      const Wrapper = ExistingWrapper
        ? ({ children }: { children: React.ReactNode }) => (
            <StrictMode>
              <ExistingWrapper>{children}</ExistingWrapper>
            </StrictMode>
          )
        : StrictModeWrapper
      return actual.render(ui, { ...options, wrapper: Wrapper })
    },
  }
})
